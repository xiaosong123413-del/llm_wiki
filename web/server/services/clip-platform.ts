import type { ClipPlatform } from "./clip-pipeline.js";

export function detectClipPlatform(url: string): ClipPlatform {
  const lower = url.toLowerCase();
  if (lower.includes("xiaohongshu.com") || lower.includes("xhslink.com")) return "xhs";
  if (lower.includes("douyin.com") || lower.includes("iesdouyin.com")) return "douyin";
  if (lower.includes("bilibili.com") || lower.includes("b23.tv")) return "bilibili";
  return "generic";
}
