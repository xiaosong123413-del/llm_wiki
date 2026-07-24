import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "collection-studio-v10.html.gz.b64");
const output = path.join(root, "wiki", "admin", "studio", "index.html");

const encoded = (await readFile(source, "utf8")).replace(/\s+/g, "");
const html = gunzipSync(Buffer.from(encoded, "base64"));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`[collection-studio] materialized ${path.relative(root, output)} (${html.length} bytes)`);
