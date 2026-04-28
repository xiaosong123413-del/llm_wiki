import { BUILD_INFO } from "./build-info.js";

interface RuntimeSnapshot {
  route: string;
  mainWidth: string;
  browserHidden: boolean;
  buildVersion: string;
  builtAt: string;
}

export function readRuntimeSnapshot(
  shellRoot: HTMLElement | null,
  mainSlot: HTMLElement | null,
): RuntimeSnapshot {
  return {
    route: window.location.hash || "#/chat",
    mainWidth: mainSlot ? `${Math.round(mainSlot.getBoundingClientRect().width)}px` : "0px",
    browserHidden: shellRoot?.hasAttribute("data-browser-hidden") ?? false,
    buildVersion: BUILD_INFO.version,
    builtAt: BUILD_INFO.builtAt,
  };
}
