/**
 * Frontend build metadata injected by the browser bundler.
 * Falls back to stable development values when running in tests.
 */
declare const __BUILD_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

interface BuildInfo {
  version: string;
  builtAt: string;
}

export const BUILD_INFO: BuildInfo = {
  version: typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : "dev",
  builtAt: typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "development",
};
