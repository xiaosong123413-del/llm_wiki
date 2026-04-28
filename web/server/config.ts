import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export interface ServerConfig {
  sourceVaultRoot: string;
  runtimeRoot: string;
  port: number;
  host: string;
  author: string;
  projectRoot: string;
}

export function parseArgs(argv: string[]): ServerConfig {
  const args = argv.slice(2);
  let sourceVaultRoot: string | null = null;
  let runtimeRoot: string | null = null;
  let port = 4175;
  let host = "127.0.0.1";
  let author = os.userInfo().username || "me";

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    switch (a) {
      case "--source-vault":
        sourceVaultRoot = args[++i] ?? null;
        break;
      case "--runtime-root":
        runtimeRoot = args[++i] ?? null;
        break;
      case "--port":
      case "-p":
        port = parseInt(args[++i] ?? "4175", 10);
        break;
      case "--host":
        host = args[++i] ?? host;
        break;
      case "--author":
        author = args[++i] ?? author;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (a.startsWith("--")) {
          console.error(`unknown flag: ${a}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  if (!sourceVaultRoot) {
    console.error("error: --source-vault <root> is required");
    printHelp();
    process.exit(1);
  }

  if (!runtimeRoot) {
    console.error("error: --runtime-root <root> is required");
    printHelp();
    process.exit(1);
  }

  const resolvedSourceVaultRoot = resolveExistingDirectory(sourceVaultRoot, "source vault root");
  const resolvedRuntimeRoot = resolveExistingDirectory(runtimeRoot, "runtime root");
  validateDistinctRoots(resolvedSourceVaultRoot, resolvedRuntimeRoot);

  return {
    sourceVaultRoot: resolvedSourceVaultRoot,
    runtimeRoot: resolvedRuntimeRoot,
    port,
    host,
    author,
    projectRoot: findProjectRoot(process.cwd()),
  };
}

function resolveExistingDirectory(input: string, label: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    console.error(`error: ${label} does not exist or is not a directory: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

function validateDistinctRoots(sourceVaultRoot: string, runtimeRoot: string): void {
  const normalizedSourceRoot = canonicalizeRoot(sourceVaultRoot);
  const normalizedRuntimeRoot = canonicalizeRoot(runtimeRoot);
  if (normalizedSourceRoot === normalizedRuntimeRoot) {
    console.error("error: source vault root and runtime root must not be the same directory");
    process.exit(1);
  }
  if (isPathInside(normalizedRuntimeRoot, normalizedSourceRoot)) {
    console.error("error: runtime root must not be inside source vault root");
    process.exit(1);
  }
  if (isPathInside(normalizedSourceRoot, normalizedRuntimeRoot)) {
    console.error("error: source vault root must not be inside runtime root");
    process.exit(1);
  }
}

function canonicalizeRoot(rootPath: string): string {
  const realPath = fs.realpathSync.native(rootPath);
  return process.platform === "win32" ? realPath.toLowerCase() : realPath;
}

function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    const syncScript = path.join(current, "scripts", "sync-compile.mjs");
    const packageJson = path.join(current, "package.json");
    if (fs.existsSync(syncScript) && fs.existsSync(packageJson)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

function printHelp(): void {
  console.log(`
Usage:
  npm start -- --source-vault <vault-root> --runtime-root <runtime-root> [--port 4175] [--host 127.0.0.1] [--author lewis]

Options:
      --source-vault  Path to the editable source vault root (required).
      --runtime-root  Path to the generated/runtime root (required).
  -p, --port     Port to listen on (default: 4175).
      --host     Host to bind to (default: 127.0.0.1 — local only).
      --author   Author name written into feedback files (default: $USER).
  -h, --help     Show this help.
`);
}
