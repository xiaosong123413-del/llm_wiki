import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(desktopRoot, "..");
const runtimeConfigPath = path.join(desktopRoot, "desktop-runtime.json");

const runtimeConfig = {
  projectRoot,
};

fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, "utf8");
