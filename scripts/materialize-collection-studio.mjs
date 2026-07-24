import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "assets", "collection-studio-v10");
const output = path.join(root, "wiki", "admin", "studio", "index.html");

const parts = (await readdir(sourceDir))
  .filter((name) => name.endsWith(".part"))
  .sort();
if (!parts.length) throw new Error(`No Collection Studio asset parts found in ${sourceDir}`);
const encoded = (await Promise.all(parts.map((name) => readFile(path.join(sourceDir, name), "utf8"))))
  .join("")
  .replace(/\s+/g, "");
const html = gunzipSync(Buffer.from(encoded, "base64"));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`[collection-studio] materialized ${path.relative(root, output)} (${html.length} bytes)`);
