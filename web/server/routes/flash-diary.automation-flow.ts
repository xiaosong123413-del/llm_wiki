/**
 * Source-owned automation flow for flash-diary quick capture.
 *
 * The automation workspace imports this route-adjacent module directly so the
 * quick-capture DAG stays owned by the flash-diary code surface.
 */

import type { CodeDerivedAutomationSeed } from "../services/code-derived-automation-types.js";
import {
  flowBranch,
  flowEdge,
  flowNode,
} from "../services/code-derived-automation-builders.js";

const FLASH_DIARY_CAPTURE_MERMAID = `
flowchart TD
    A["全局快捷键触发<br/>globalShortcut.register()"] --> B["打开闪念记录窗口<br/>showFlashDiaryCaptureWindow()"]
    B --> C["POST /api/flash-diary/append<br/>handleFlashDiaryAppend()"]
    C --> D["appendFlashDiaryEntry()<br/>生成当天闪念日记写入内容"]
    D --> E["copyDiaryMedia()<br/>复制附件到当天媒体目录"]
    E --> F["renderDiaryEntryBlock()<br/>拼出 Markdown 条目块"]
    F --> G{"当天日记文件是否已存在"}
    G -->|否| H["初始化当天日记文件<br/>current = # YYYY-MM-DD"]
    G -->|是| I["读取现有日记文件<br/>readFile(diaryPath, \"utf8\")"]
    H --> J["prependDiaryBlock()<br/>把新条目插到标题下方"]
    I --> J
    J --> K["writeFile()<br/>写回当天日记文件"]
    K --> L{"appendFlashDiaryEntry() 是否抛错"}
    L -->|否| M["返回相对路径和修改时间<br/>res.json({ success: true, data: result })"]
    L -->|是| N["recordFlashDiaryFailure()<br/>写入 flash-diary-failures.json"]
`.trim();

export const codeDerivedAutomationSeeds: readonly CodeDerivedAutomationSeed[] = [
  {
    slug: "flash-diary-capture",
    name: "闪念日记快速记录",
    summary: "从全局快捷键唤起记录窗口，到写入当天日记文件或记录失败项的真实流程。",
    icon: "message-circle",
    sourcePaths: [
      "desktop-webui/src/main.ts",
      "web/server/routes/flash-diary.ts",
      "web/server/services/flash-diary.ts",
    ],
    mermaid: FLASH_DIARY_CAPTURE_MERMAID,
    flow: {
      nodes: [
        flowNode("flash-trigger", "trigger", "全局快捷键触发", "桌面端快捷键先拉起快速记录窗口。", "globalShortcut.register()"),
        flowNode("flash-window", "action", "打开闪念记录窗口", "把文本和媒体选择界面展示给用户。", "showFlashDiaryCaptureWindow()"),
        flowNode("flash-append-api", "action", "POST /api/flash-diary/append", "把文本、媒体路径和时间发给后端。", "handleFlashDiaryAppend()"),
        flowNode("flash-append-service", "action", "appendFlashDiaryEntry()", "后端开始生成当天闪念日记的写入内容。", "appendFlashDiaryEntry()"),
        flowNode("flash-copy-media", "action", "copyDiaryMedia()", "先把附件复制到当天闪念日记媒体目录。", "copyDiaryMedia()"),
        flowNode("flash-render-block", "action", "renderDiaryEntryBlock()", "把时间、正文和附件引用拼成 Markdown 条目块。", "renderDiaryEntryBlock()"),
        flowNode("flash-branch-file", "branch", "当天日记文件是否已存在", "不存在就初始化文件，存在就读取现有内容。", "fs.existsSync(diaryPath)"),
        flowNode("flash-new-file", "action", "初始化当天日记文件", "不存在时创建 '# YYYY-MM-DD\\n\\n' 头部。", "current = `# ${date}\\n\\n`"),
        flowNode("flash-read-file", "action", "读取现有日记文件", "存在时读取完整内容作为 prepend 基底。", "readFile(diaryPath, \"utf8\")"),
        flowNode("flash-prepend", "merge", "prependDiaryBlock()", "把新条目插到标题下方最前面。", "prependDiaryBlock()"),
        flowNode("flash-write", "action", "writeFile()", "把更新后的 Markdown 写回当天日记文件。", "writeFile(diaryPath, next, \"utf8\")"),
        flowNode("flash-branch-result", "branch", "appendFlashDiaryEntry() 是否抛错", "成功返回 path/modifiedAt，失败则在路由层记录 failure。", "handleFlashDiaryAppend() try / catch"),
        flowNode("flash-success", "action", "返回相对路径和修改时间", "成功响应 path、mediaFiles 和 modifiedAt。", "res.json({ success: true, data: result })"),
        flowNode("flash-failure", "action", "recordFlashDiaryFailure()", "把失败记录写入 .llmwiki/flash-diary-failures.json。", "recordFlashDiaryFailure()"),
      ],
      edges: [
        flowEdge("flash-trigger", "flash-window"),
        flowEdge("flash-window", "flash-append-api"),
        flowEdge("flash-append-api", "flash-append-service"),
        flowEdge("flash-append-service", "flash-copy-media"),
        flowEdge("flash-copy-media", "flash-render-block"),
        flowEdge("flash-render-block", "flash-branch-file"),
        flowEdge("flash-branch-file", "flash-new-file"),
        flowEdge("flash-branch-file", "flash-read-file"),
        flowEdge("flash-new-file", "flash-prepend"),
        flowEdge("flash-read-file", "flash-prepend"),
        flowEdge("flash-prepend", "flash-write"),
        flowEdge("flash-write", "flash-branch-result"),
        flowEdge("flash-branch-result", "flash-success"),
        flowEdge("flash-branch-result", "flash-failure"),
      ],
      branches: [
        flowBranch("flash-file-state", "文件存在分支", "flash-branch-file", ["flash-new-file", "flash-read-file"], "flash-prepend"),
        flowBranch("flash-write-result", "写入结果分支", "flash-branch-result", ["flash-success", "flash-failure"]),
      ],
    },
  },
];
