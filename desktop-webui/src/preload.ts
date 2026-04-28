import { contextBridge, ipcRenderer } from "electron";

interface InitializePayload {
  targetRepoPath: string;
  sourceFolders: string[];
}

interface FlashDiaryEntryPayload {
  target?: "flash-diary" | "clipping";
  text: string;
  mediaPaths: string[];
}

interface ShortcutSavePayload {
  id: "flashDiaryCapture";
  accelerator: string;
}

contextBridge.exposeInMainWorld("llmWikiDesktop", {
  getDesktopConfig: () => ipcRenderer.invoke("desktop:get-config"),
  getAppBootstrap: () => ipcRenderer.invoke("desktop:get-app-bootstrap"),
  getShortcuts: () => ipcRenderer.invoke("desktop:get-shortcuts"),
  saveShortcut: (payload: ShortcutSavePayload) =>
    ipcRenderer.invoke("desktop:save-shortcut", payload),
  chooseTargetVault: () => ipcRenderer.invoke("desktop:choose-target-vault"),
  chooseSourceFolders: () => ipcRenderer.invoke("desktop:choose-source-folders"),
  saveDesktopConfig: (targetVault: string) =>
    ipcRenderer.invoke("desktop:save-config", { targetVault }),
  saveAppConfig: (payload: InitializePayload) =>
    ipcRenderer.invoke("desktop:save-app-config", payload),
  initializeApp: (payload: InitializePayload) =>
    ipcRenderer.invoke("desktop:initialize-app", payload),
  onInitializationProgress: (listener: (payload: unknown) => void) => {
    const wrappedListener = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on("desktop:initialize-progress", wrappedListener);
    return () => {
      ipcRenderer.removeListener("desktop:initialize-progress", wrappedListener);
    };
  },
  onInstanceRedirected: (listener: () => void) => {
    const wrappedListener = () => listener();
    ipcRenderer.on("desktop:instance-redirected", wrappedListener);
    return () => {
      ipcRenderer.removeListener("desktop:instance-redirected", wrappedListener);
    };
  },
  onFlashDiaryCapture: (listener: (payload: unknown) => void) => {
    const wrappedListener = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on("desktop:flash-diary-capture", wrappedListener);
    return () => {
      ipcRenderer.removeListener("desktop:flash-diary-capture", wrappedListener);
    };
  },
  chooseFlashDiaryMedia: () => ipcRenderer.invoke("desktop:choose-flash-diary-media"),
  submitFlashDiaryEntry: (payload: FlashDiaryEntryPayload) =>
    ipcRenderer.invoke("desktop:submit-flash-diary-entry", payload),
  importXiaohongshuCookie: () => ipcRenderer.invoke("desktop:import-xiaohongshu-cookie"),
  openXiaohongshuLogin: () => ipcRenderer.invoke("desktop:open-xiaohongshu-login"),
  importDouyinCookie: () => ipcRenderer.invoke("desktop:import-douyin-cookie"),
  openDouyinLogin: () => ipcRenderer.invoke("desktop:open-douyin-login"),
  fetchXiaohongshuFavorites: () => ipcRenderer.invoke("desktop:fetch-xiaohongshu-favorites"),
  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),
});

export {};
