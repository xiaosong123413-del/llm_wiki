import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

export async function prepareActiveSources(vaultRoot, selectedFiles) {
  const activeDir = path.join(vaultRoot, "sources");
  const fullDir = path.join(vaultRoot, "sources_full");

  await mkdir(activeDir, { recursive: true });
  const existing = await readdir(activeDir).catch(() => []);
  await Promise.all(
    existing.map((file) => rm(path.join(activeDir, file), { force: true })),
  );

  for (const file of selectedFiles) {
    await cp(path.join(fullDir, file), path.join(activeDir, file), {
      force: true,
    });
  }

  return selectedFiles.length;
}
