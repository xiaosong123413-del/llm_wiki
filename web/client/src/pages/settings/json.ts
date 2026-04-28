/**
 * Shared JSON-response parsing helpers for settings submodules.
 *
 * The settings UI talks to many local API routes that may occasionally return
 * stale HTML when the desktop shell points at an old WebUI instance. Keeping
 * this parser in one place avoids duplicating the same recovery message across
 * settings panels.
 */

export async function readSettingsJsonPayload<T>(response: Response): Promise<T> {
  const responseClone = typeof response.clone === "function" ? response.clone() : null;
  try {
    return await response.json() as T;
  } catch {
    let body = "";
    try {
      body = responseClone ? await responseClone.text() : "";
    } catch {
      body = "";
    }
    const isHtml = /<(!doctype|html)\b/i.test(body.trim());
    if (isHtml) {
      throw new Error("接口返回的是页面 HTML，不是 API JSON。当前桌面端可能连到了旧 Web 服务，请重启 LLM Wiki WebUI。");
    }
    throw new Error("接口返回的不是 JSON，请重启 LLM Wiki WebUI 后再刷新账号。");
  }
}
