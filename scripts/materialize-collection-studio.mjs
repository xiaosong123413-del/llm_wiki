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
const sourceHtml = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
const html = hardenInlineSvgSizing(sourceHtml);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html, "utf8");
console.log(`[collection-studio] materialized ${path.relative(root, output)} (${Buffer.byteLength(html)} bytes)`);

/**
 * Give every inline icon an intrinsic size before page CSS is applied.
 * This prevents a host stylesheet or an early hydration frame from stretching
 * an icon-only SVG to the viewport, which appeared as a giant black plus sign.
 */
function hardenInlineSvgSizing(value) {
  let html = value.replace(/<svg([^>]*)>/gi, (_tag, attributes) => {
    const width = readAttribute(attributes, "width") ?? "24";
    const height = readAttribute(attributes, "height") ?? width;
    const widthAttribute = readAttribute(attributes, "width") ? "" : ` width="${width}"`;
    const heightAttribute = readAttribute(attributes, "height") ? "" : ` height="${height}"`;
    return `<svg${attributes}${widthAttribute}${heightAttribute}>`;
  });

  html = html.replace(
    "svg{display:block}",
    "svg{display:block;max-width:100%;max-height:100%;flex:none}",
  );
  html = html.replace(
    "</style>",
    ".capture-mark{width:42px!important;height:42px!important;display:grid!important;place-items:center!important;overflow:hidden}.capture-mark>svg{width:19px!important;height:19px!important;max-width:19px!important;max-height:19px!important}</style>",
  );
  return html;
}

function readAttribute(attributes, name) {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*[\"']([^\"']+)[\"']`, "i"),
  );
  return match?.[1];
}
