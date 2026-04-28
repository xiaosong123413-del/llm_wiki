import { describe, expect, it } from "vitest";
import {
  buildFlashDiaryCaptureDataUrl,
  buildFlashDiaryCaptureHtml,
} from "../desktop-webui/src/flash-diary-capture.js";

describe("flash diary capture popup", () => {
  it("builds utf-8 HTML and data URL so Chinese text and CSS render as HTML", () => {
    const html = buildFlashDiaryCaptureHtml();
    const dataUrl = buildFlashDiaryCaptureDataUrl();

    expect(html).toContain('<meta charset="UTF-8"');
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
    expect(html).toContain("闪念日记");
    expect(html).not.toContain("é—ª");
    expect(dataUrl).toMatch(/^data:text\/html;charset=utf-8;base64,/);
  });
});
