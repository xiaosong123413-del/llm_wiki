"""Bridge Xiaomi Health account flows and sleep sync for the workspace health page.

This script is invoked by the Node server. It keeps Python-only SDK usage in one
place and exposes three focused commands:

- ``send-code``: request an SMS verification code and persist the short-lived
  login session locally.
- ``connect-account``: finish account login and emit a reusable token JSON blob.
- ``qr-login``: show a Xiaomi account QR login and emit a reusable token JSON
  blob after the user scans it.
- ``sync``: fetch recent sleep-centric health data and normalize it for the UI.
"""

from __future__ import annotations

import asyncio
import base64
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from mi_fitness.auth import XiaomiAuth
from mi_fitness.client import MiHealthClient
from mi_fitness.exceptions import AuthError, CaptchaRequiredError, DeviceUntrustedError
from mi_fitness.models import AuthToken, HeartRateData, IntensityData, SleepData, StepData
from mi_fitness.auth.password import (
    ensure_ticket_login_ready,
    fetch_captcha_image,
    get_phone_info,
    normalize_captcha_url,
    send_ticket,
)

CHINA_TZ = timezone(timedelta(hours=8))
DEFAULT_SYNC_DAYS = 7
SESSION_FILE = Path(".llmwiki/health-domain-account-session.json")
JPEG_SIGNATURE = b"\xff\xd8\xff"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
XIAOMI_LOGIN_CAPTCHA_URL = "https://account.xiaomi.com/pass/getCode?icodeType=login"


class BridgeError(Exception):
    """Structured bridge error propagated back to the Node server."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "",
        data: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.data = data or {}


def main() -> None:
    if len(sys.argv) != 3:
        emit_error("usage: mi-fitness-bridge.py <command> <request-json-path>")
    command = sys.argv[1].strip()
    request_path = Path(sys.argv[2]).resolve()
    payload = json.loads(request_path.read_text(encoding="utf-8-sig"))
    try:
        result = asyncio.run(run_command(command, payload))
    except BridgeError as error:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": str(error),
                    "errorCode": error.code,
                    "errorData": error.data,
                },
                ensure_ascii=False,
            )
        )
        raise SystemExit(1) from error
    except Exception as error:  # noqa: BLE001
        print(
            json.dumps(
                {"success": False, "error": str(error)},
                ensure_ascii=False,
            )
        )
        raise SystemExit(1) from error
    print(json.dumps({"success": True, "data": result}, ensure_ascii=False))


async def run_command(command: str, payload: dict[str, Any]) -> dict[str, Any]:
    if command == "send-code":
        return await send_verification_code(payload)
    if command == "connect-account":
        return await connect_account(payload)
    if command == "qr-login":
        return await connect_account_with_qr(payload)
    if command == "sync":
        return await sync_health(payload)
    raise ValueError(f"unsupported bridge command: {command}")


async def send_verification_code(payload: dict[str, Any]) -> dict[str, Any]:
    project_root = read_project_root(payload)
    username = read_required_text(payload, "username")
    captcha_code = read_text(payload, "captchaCode")
    session = read_session(project_root)

    if captcha_code and session.get("username") == username:
        return await resend_verification_code_with_saved_session(
            project_root,
            username,
            captcha_code,
            session,
        )

    async with XiaomiAuth(username=username) as auth:
        result = await send_verification_code_with_auth(
            project_root,
            username,
            auth,
            captcha_code,
        )
        write_session(project_root, build_session_payload(username, auth))
    return result


async def resend_verification_code_with_saved_session(
    project_root: Path,
    username: str,
    captcha_code: str,
    session: dict[str, Any],
) -> dict[str, Any]:
    async with XiaomiAuth(username=username) as auth:
        restore_saved_login_session(auth, session)
        result = await send_verification_code_with_auth(
            project_root,
            username,
            auth,
            captcha_code,
        )
        write_session(project_root, build_session_payload(username, auth))
        return result


async def send_verification_code_with_auth(
    project_root: Path,
    username: str,
    auth: XiaomiAuth,
    captcha_code: str,
) -> dict[str, Any]:
    http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
    try:
        await ensure_ticket_login_ready(http)
        await send_ticket(
            http,
            username,
            captcha_code=await resolve_captcha_code(captcha_code) if captcha_code else "",
        )
    except CaptchaRequiredError as error:
        raise await build_captcha_challenge_error(project_root, username, auth, error) from error
    except AuthError as error:
        if captcha_code:
            raise await build_invalid_captcha_error(project_root, username, auth) from error
        raise
    try:
        masked_phone, ticket_token = await get_phone_info(
            http,
            username,
            captcha_code=await resolve_captcha_code(captcha_code) if captcha_code else "",
        )
    except CaptchaRequiredError as error:
        raise await build_captcha_challenge_error(project_root, username, auth, error) from error
    except AuthError:
        return {
            "maskedPhone": mask_phone_identifier(username),
            "ticketReady": False,
            "message": "短信验证码已经发到你的手机；如果已经收到，请直接填写短信验证码并点“验证码登录并连接”。",
        }
    auth._ticket_token = ticket_token  # pyright: ignore[reportPrivateUsage]
    return {
        "maskedPhone": masked_phone,
        "ticketReady": True,
    }


async def build_captcha_challenge_error(
    project_root: Path,
    username: str,
    auth: XiaomiAuth,
    error: CaptchaRequiredError,
) -> BridgeError:
    http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
    image = await fetch_captcha_image(http, error.captcha_url)
    write_session(project_root, build_session_payload(username, auth))
    return BridgeError(
        "获取验证码前需要先完成图形验证码。",
        code="captcha_required",
        data={
            "captchaImageDataUrl": build_captcha_image_data_url(image),
        },
    )


async def build_invalid_captcha_error(
    project_root: Path,
    username: str,
    auth: XiaomiAuth,
) -> BridgeError:
    http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
    image = await fetch_captcha_image(http, normalize_captcha_url(XIAOMI_LOGIN_CAPTCHA_URL))
    write_session(project_root, build_session_payload(username, auth))
    return BridgeError(
        "图形验证码可能错误或已过期，请按新图重新输入。",
        code="captcha_required",
        data={
            "captchaImageDataUrl": build_captcha_image_data_url(image),
        },
    )


async def connect_account(payload: dict[str, Any]) -> dict[str, Any]:
    project_root = read_project_root(payload)
    username = read_required_text(payload, "username")
    password = read_text(payload, "password")
    verification_code = read_text(payload, "verificationCode")
    captcha_code = read_text(payload, "captchaCode")
    session = read_session(project_root)

    if verification_code and session.get("username") == username:
        session = await ensure_ticket_token_ready(
            project_root,
            username,
            captcha_code,
            session,
        )
        return await connect_with_saved_session(project_root, username, verification_code, session)

    if not password:
        raise ValueError("请输入账号密码。")

    async with XiaomiAuth(username=username, password=password) as auth:
        try:
            if verification_code:
                await auth.login(
                    verification_code_handler=lambda _phone: resolve_verification_code(
                        verification_code
                    )
                )
            else:
                await auth.login()
        except DeviceUntrustedError as error:
            raise ValueError("当前设备需要短信验证码，请先点击“获取验证码”。") from error
        clear_session(project_root)
        return {
            "tokenJson": auth.token.model_dump_json(indent=2),
            "userId": str(auth.token.user_id or "") or None,
        }


async def connect_with_saved_session(
    project_root: Path,
    username: str,
    verification_code: str,
    session: dict[str, Any],
) -> dict[str, Any]:
    async with XiaomiAuth(username=username) as auth:
        restore_saved_login_session(auth, session)
        await auth.login_with_verification_code(verification_code)
        clear_session(project_root)
        return {
            "tokenJson": auth.token.model_dump_json(indent=2),
            "userId": str(auth.token.user_id or "") or None,
        }


async def connect_account_with_qr(payload: dict[str, Any]) -> dict[str, Any]:
    status_path = Path(read_required_text(payload, "statusPath")).resolve()
    async with XiaomiAuth() as auth:
        await auth.login_qr(
            qr_callback=lambda qr_image_url, login_url: write_qr_login_status(
                status_path,
                qr_image_url,
                login_url,
            )
        )
        return {
            "tokenJson": auth.token.model_dump_json(indent=2),
            "userId": str(auth.token.user_id or "") or None,
        }


async def write_qr_login_status(
    status_path: Path,
    qr_image_url: str,
    login_url: str,
) -> None:
    status_path.parent.mkdir(parents=True, exist_ok=True)
    status_path.write_text(
        json.dumps(
            {
                "qrImageUrl": qr_image_url,
                "loginUrl": login_url,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


async def ensure_ticket_token_ready(
    project_root: Path,
    username: str,
    captcha_code: str,
    session: dict[str, Any],
) -> dict[str, Any]:
    if read_text(session, "ticketToken"):
        return session
    if not captcha_code:
        raise ValueError("短信验证码已发送，请先提交图形验证码。")
    return await recover_ticket_token_with_saved_session(
        project_root,
        username,
        captcha_code,
        session,
    )


async def recover_ticket_token_with_saved_session(
    project_root: Path,
    username: str,
    captcha_code: str,
    session: dict[str, Any],
) -> dict[str, Any]:
    async with XiaomiAuth(username=username) as auth:
        restore_saved_login_session(auth, session)
        http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
        await ensure_ticket_login_ready(http)
        try:
            _, ticket_token = await get_phone_info(
                http,
                username,
                captcha_code=captcha_code,
            )
        except CaptchaRequiredError as error:
            raise await build_captcha_challenge_error(project_root, username, auth, error) from error
        auth._ticket_token = ticket_token  # pyright: ignore[reportPrivateUsage]
        next_session = build_session_payload(username, auth)
        write_session(project_root, next_session)
        return next_session


async def sync_health(payload: dict[str, Any]) -> dict[str, Any]:
    token_json = read_required_text(payload, "tokenJson")
    api_base_url = read_text(payload, "apiBaseUrl")
    relative_uid_text = read_text(payload, "relativeUid")
    days = max(1, read_int(payload.get("days"), DEFAULT_SYNC_DAYS))

    auth = XiaomiAuth()
    auth.token = AuthToken.model_validate_json(token_json)
    client = MiHealthClient(auth, base_url=api_base_url) if api_base_url else MiHealthClient(auth)
    async with client:
        relative_uid = await resolve_relative_uid(client, relative_uid_text)
        sleep_days, heart_days, step_days, intensity_days = await asyncio.gather(
            client.get_sleep(relative_uid, days=days),
            client.get_heart_rate(relative_uid, days=days),
            client.get_steps(relative_uid, days=days),
            client.get_intensity_history(relative_uid, days=days),
        )
        snapshot_days = build_snapshot_days(
            sleep_days,
            heart_days,
            step_days,
            intensity_days,
        )
    return {
        "importedAt": datetime.now(tz=CHINA_TZ).isoformat(),
        "sleepDays": snapshot_days,
    }


async def resolve_relative_uid(
    client: MiHealthClient,
    relative_uid_text: str,
) -> int:
    user_id = str(client.auth.token.user_id or "").strip()
    if relative_uid_text:
        if relative_uid_text == user_id:
            raise ValueError("二维码登录已成功，但当前 mi-fitness SDK 暂不支持读取当前登录账号本人的小米健康数据。")
        return int(relative_uid_text)
    raise ValueError("二维码登录已成功，但当前 mi-fitness SDK 暂不支持读取当前登录账号本人的小米健康数据。")


def build_snapshot_days(
    sleep_days: list[SleepData],
    heart_days: list[HeartRateData],
    step_days: list[StepData],
    intensity_days: list[IntensityData],
) -> list[dict[str, Any]]:
    heart_by_date = index_by_date(heart_days)
    step_by_date = index_by_date(step_days)
    intensity_by_date = index_by_date(intensity_days)
    snapshot_days: list[dict[str, Any]] = []
    for sleep in sorted(sleep_days, key=lambda item: item.time):
        date_key = extract_date_key(sleep)
        if not date_key:
            continue
        sleep_segment = choose_primary_sleep_segment(sleep)
        bed_time = format_clock(sleep_segment.bedtime if sleep_segment else sleep.time)
        wake_time = format_clock(
            sleep_segment.wake_up_time
            if sleep_segment
            else sleep.time + sleep.total_duration * 60
        )
        heart = heart_by_date.get(date_key)
        steps = step_by_date.get(date_key)
        intensity = intensity_by_date.get(date_key)
        snapshot_days.append(
            {
                "date": date_key,
                "bedTime": bed_time,
                "wakeTime": wake_time,
                "totalSleepMinutes": sleep.total_duration,
                "deepSleepMinutes": sleep.sleep_deep_duration,
                "sleepScore": sleep.sleep_score,
                "restingHeartRate": heart.avg_rhr if heart else 0,
                "sleepAverageHeartRate": sleep.avg_hr,
                "awakeMinutes": sleep.sleep_awake_duration,
                "steps": steps.steps if steps else 0,
                "intensityMinutes": intensity.duration if intensity else 0,
            }
        )
    if not snapshot_days:
        raise ValueError("没有读取到可用的睡眠数据。")
    return snapshot_days


def choose_primary_sleep_segment(sleep: SleepData) -> Any | None:
    if not sleep.segment_details:
        return None
    return max(sleep.segment_details, key=lambda segment: segment.duration)


def index_by_date(items: list[Any]) -> dict[str, Any]:
    lookup: dict[str, Any] = {}
    for item in items:
        date_key = extract_date_key(item)
        if date_key:
            lookup[date_key] = item
    return lookup


def extract_date_key(item: Any) -> str:
    at = getattr(item, "at", None)
    if at is None:
        return ""
    return at.astimezone(CHINA_TZ).date().isoformat()


def format_clock(timestamp_seconds: int) -> str:
    if timestamp_seconds <= 0:
        return "--:--"
    dt = datetime.fromtimestamp(timestamp_seconds, tz=CHINA_TZ)
    return dt.strftime("%H:%M")


async def resolve_verification_code(code: str) -> str:
    trimmed = code.strip()
    if not trimmed:
        raise ValueError("请输入短信验证码。")
    return trimmed


async def resolve_captcha_code(code: str) -> str:
    trimmed = code.strip()
    if not trimmed:
        raise ValueError("请输入图形验证码。")
    return trimmed


def read_project_root(payload: dict[str, Any]) -> Path:
    raw = read_required_text(payload, "projectRoot")
    return Path(raw).resolve()


def read_required_text(payload: dict[str, Any], key: str) -> str:
    value = read_text(payload, key)
    if not value:
        raise ValueError(f"{key} is required")
    return value


def read_text(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    return value.strip() if isinstance(value, str) else ""


def restore_saved_login_session(auth: XiaomiAuth, session: dict[str, Any]) -> None:
    http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
    auth.token.device_id = read_text(session, "deviceId") or read_cookie_text(
        session,
        "deviceId",
    )
    auth._ticket_token = read_text(session, "ticketToken")  # pyright: ignore[reportPrivateUsage]
    for key, value in dict(session.get("cookies") or {}).items():
        if isinstance(key, str) and isinstance(value, str):
            http.cookies.set(key, value)


def build_session_payload(username: str, auth: XiaomiAuth) -> dict[str, Any]:
    http = auth._ensure_http()  # pyright: ignore[reportPrivateUsage]
    cookies = collect_cookie_values(http.cookies)
    device_id = auth.token.device_id or read_cookie_text({"cookies": cookies}, "deviceId")
    return {
        "username": username,
        "deviceId": device_id,
        "ticketToken": auth._ticket_token,  # pyright: ignore[reportPrivateUsage]
        "cookies": cookies,
    }


def collect_cookie_values(cookies: Any) -> dict[str, str]:
    jar = getattr(cookies, "jar", None)
    if jar is not None:
        values: dict[str, str] = {}
        for cookie in jar:
            name = getattr(cookie, "name", "")
            value = getattr(cookie, "value", "")
            if isinstance(name, str) and isinstance(value, str):
                values[name] = value
        return values
    return {
        key: value
        for key, value in dict(cookies.items()).items()
        if isinstance(key, str) and isinstance(value, str)
    }


def read_cookie_text(session: dict[str, Any], key: str) -> str:
    cookies = dict(session.get("cookies") or {})
    value = cookies.get(key)
    return value if isinstance(value, str) else ""


def mask_phone_identifier(value: str) -> str:
    normalized = value.strip()
    if normalized.isdigit() and len(normalized) == 11:
        return f"{normalized[:3]}******{normalized[-2:]}"
    return normalized


def build_captcha_image_data_url(image: bytes) -> str:
    encoded = base64.b64encode(image).decode("ascii")
    return f"data:{detect_image_mime_type(image)};base64,{encoded}"


def detect_image_mime_type(image: bytes) -> str:
    if image.startswith(JPEG_SIGNATURE):
        return "image/jpeg"
    if image.startswith(PNG_SIGNATURE):
        return "image/png"
    return "application/octet-stream"


def read_int(value: Any, fallback: int) -> int:
    return value if isinstance(value, int) else fallback


def session_path(project_root: Path) -> Path:
    return project_root / SESSION_FILE


def read_session(project_root: Path) -> dict[str, Any]:
    path = session_path(project_root)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_session(project_root: Path, value: dict[str, Any]) -> None:
    path = session_path(project_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def clear_session(project_root: Path) -> None:
    path = session_path(project_root)
    if path.exists():
        path.unlink()


def emit_error(message: str) -> None:
    print(json.dumps({"success": False, "error": message}, ensure_ascii=False))
    raise SystemExit(1)


if __name__ == "__main__":
    main()
