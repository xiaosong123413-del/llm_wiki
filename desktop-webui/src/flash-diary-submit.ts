interface FlashDiaryEntryPayload {
  target?: "flash-diary" | "clipping";
  text: string;
  mediaPaths: string[];
}

interface FlashDiarySubmission {
  endpoint: "api/flash-diary/entry" | "api/source-gallery/create" | "api/clips" | "api/xhs-sync/extract";
  body: FlashDiaryEntryPayload | {
    type: "clipping";
    title: string;
    body: string;
    now: string;
  } | {
    url: string;
    body: string;
    quality: "720";
    now: string;
  } | {
    url: string;
    body: string;
    now: string;
  };
}

export function buildFlashDiarySubmission(payload: FlashDiaryEntryPayload): FlashDiarySubmission {
  const target = payload.target === "clipping" ? "clipping" : "flash-diary";
  if (target === "flash-diary") {
    return {
      endpoint: "api/flash-diary/entry",
      body: payload,
    };
  }

  const clippingUrl = extractFirstUrl(payload.text);
  const now = new Date().toISOString();
  if (!clippingUrl) {
    return {
      endpoint: "api/source-gallery/create",
      body: {
        type: "clipping",
        title: now,
        body: payload.text,
        now,
      },
    };
  }

  if (isXiaohongshuUrl(clippingUrl)) {
    return {
      endpoint: "api/xhs-sync/extract",
      body: {
        url: clippingUrl,
        body: payload.text,
        now,
      },
    };
  }

  return {
    endpoint: "api/clips",
    body: {
      url: clippingUrl,
      body: payload.text,
      quality: "720",
      now,
    },
  };
}

function extractFirstUrl(value: string): string | null {
  const raw = value.match(/https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/i)?.[0] ?? null;
  return raw ? raw.replace(/[，。、“”‘’；;,.!?！？）)】\]]+$/u, "") : null;
}

function isXiaohongshuUrl(value: string): boolean {
  return /xiaohongshu\.com|xhslink\.com/i.test(value);
}
