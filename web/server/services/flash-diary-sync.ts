import fs from "node:fs";
import path from "node:path";

interface FlashDiarySyncState {
  mode: "local";
  lastSyncedAt: string | null;
  queueSize: number;
}

export function readFlashDiarySyncState(wikiRoot: string): FlashDiarySyncState {
  const filePath = path.join(wikiRoot, ".llmwiki", "flash-diary-sync.json");
  if (!fs.existsSync(filePath)) {
    return {
      mode: "local",
      lastSyncedAt: null,
      queueSize: 0,
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Partial<FlashDiarySyncState>;
    return {
      mode: "local",
      lastSyncedAt: typeof raw.lastSyncedAt === "string" ? raw.lastSyncedAt : null,
      queueSize: typeof raw.queueSize === "number" ? raw.queueSize : 0,
    };
  } catch {
    return {
      mode: "local",
      lastSyncedAt: null,
      queueSize: 0,
    };
  }
}
