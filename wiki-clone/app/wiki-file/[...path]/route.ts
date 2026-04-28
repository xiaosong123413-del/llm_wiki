/**
 * Serves local wiki assets, such as images referenced from markdown pages.
 */

import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const CONTENT_TYPES = new Map<string, string>([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const rel = params.path.join("/");
  const wikiRoot = process.env.WIKI_ROOT || path.resolve(process.cwd(), "..", "wiki");
  const full = path.join(wikiRoot, rel);
  const safeRel = path.relative(wikiRoot, full);
  if (safeRel.startsWith("..") || path.isAbsolute(safeRel)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new NextResponse("not found", { status: 404 });
  }
  return new NextResponse(fs.readFileSync(full), {
    headers: { "Content-Type": contentType(full) },
  });
}

function contentType(full: string): string {
  return CONTENT_TYPES.get(path.extname(full).toLowerCase()) ?? "application/octet-stream";
}
