#!/usr/bin/env node
// Bundle the browser client into dist/client/
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.join(here, "dist/client");
const assetsDir = path.join(outDir, "assets");
const buildTime = new Date().toISOString();
const buildVersion = buildTime.replace(/[-:.TZ]/g, "").slice(0, 14);

fs.mkdirSync(assetsDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(here, "client/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "browser",
  outfile: path.join(assetsDir, "main.js"),
  sourcemap: false,
  treeShaking: true,
  minify: true,
  logLevel: "info",
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});

const indexTemplate = fs.readFileSync(path.join(here, "client/index.html"), "utf8");
fs.writeFileSync(
  path.join(outDir, "index.html"),
  indexTemplate.replaceAll("%BUILD_VERSION%", buildVersion),
  "utf8",
);
fs.copyFileSync(path.join(here, "client/styles.css"), path.join(assetsDir, "styles.css"));

const stylesOutDir = path.join(assetsDir, "styles");
fs.mkdirSync(stylesOutDir, { recursive: true });
const stylesSrcDir = path.join(here, "client/assets/styles");
for (const name of fs.readdirSync(stylesSrcDir)) {
  const src = path.join(stylesSrcDir, name);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(stylesOutDir, name));
  }
}

console.log(`client bundled to ${outDir} (${buildVersion})`);
