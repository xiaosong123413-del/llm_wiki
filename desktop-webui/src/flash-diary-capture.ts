export function buildFlashDiaryCaptureHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>\u95ea\u5ff5\u65e5\u8bb0</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f9f8fe;
        color: #1a1a1a;
      }
      main {
        box-sizing: border-box;
        min-height: 100vh;
        padding: 24px;
        display: grid;
      }
      .card {
        display: grid;
        gap: 18px;
        padding: 24px;
        border: 1px solid #e8e5f0;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 18px 50px rgba(124, 92, 252, 0.10);
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        color: #7c5cfc;
        text-transform: uppercase;
      }
      h1 {
        margin: 6px 0 0;
        font-size: 32px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #555555;
        line-height: 1.7;
      }
      textarea {
        width: 100%;
        min-height: 240px;
        resize: vertical;
        box-sizing: border-box;
        border: 1px solid #e8e5f0;
        border-radius: 18px;
        padding: 14px 16px;
        outline: none;
        background: #fff;
        font: inherit;
      }
      textarea:focus {
        border-color: #7c5cfc;
        box-shadow: 0 0 0 4px rgba(124, 92, 252, 0.12);
      }
      .toolbar,
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .toolbar {
        align-items: center;
        justify-content: space-between;
      }
      .actions {
        justify-content: flex-end;
      }
      .target-switch {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .target-copy {
        display: grid;
        gap: 4px;
        margin-top: -6px;
      }
      .target-copy strong {
        font-size: 14px;
        color: #1a1a1a;
      }
      .target-copy span {
        font-size: 13px;
        color: #777;
        line-height: 1.6;
      }
      .target-switch button {
        min-height: 42px;
        border-color: #e8e5f0;
        background: #fcfbff;
        color: #555555;
      }
      .target-switch button.active {
        border-color: #7c5cfc;
        background: #f3f0ff;
        color: #7c5cfc;
      }
      .media-list {
        display: grid;
        gap: 8px;
        max-height: 120px;
        overflow: auto;
      }
      .media-item {
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid #e8e5f0;
        background: #fcfbff;
        color: #555555;
        overflow-wrap: anywhere;
      }
      button {
        min-height: 44px;
        padding: 0 18px;
        border-radius: 14px;
        border: 1px solid #e8e5f0;
        background: #fff;
        color: #1a1a1a;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      button.primary {
        border-color: #7c5cfc;
        background: #7c5cfc;
        color: white;
      }
      .status {
        min-height: 22px;
        font-size: 14px;
        color: #555555;
      }
      .status.error {
        color: #b12727;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <div>
          <div class="eyebrow">FLASH DIARY</div>
          <h1>\u95ea\u5ff5\u65e5\u8bb0</h1>
          <p>\u8bb0\u5f55\u4e00\u6761\u65b0\u7684\u95ea\u5ff5\uff0c\u6216\u628a\u5185\u5bb9\u4f5c\u4e3a\u526a\u85cf\u6e90\u6599\u4fdd\u5b58\u3002</p>
        </div>
        <div class="target-switch" role="group" aria-label="\u4fdd\u5b58\u76ee\u6807">
          <button type="button" class="active" data-target="flash-diary">\u8bb0\u5165\u65e5\u8bb0</button>
          <button type="button" data-target="clipping">\u8bb0\u5165\u526a\u85cf</button>
        </div>
        <div class="target-copy">
          <strong id="target-copy-title">\u5f53\u524d\u4f1a\u5199\u5165 raw/\u95ea\u5ff5\u65e5\u8bb0</strong>
          <span id="target-copy-desc">\u9002\u5408\u5feb\u901f\u8bb0\u5f55\u60f3\u6cd5\uff0c\u6309\u5f53\u5929\u65e5\u8bb0\u5012\u5e8f\u8ffd\u8bb0\u3002</span>
        </div>
        <textarea id="flash-diary-text" placeholder="\u5199\u4e0b\u8fd9\u4e00\u523b\u60f3\u5230\u7684\u5185\u5bb9..."></textarea>
        <div class="toolbar">
          <button type="button" id="choose-media">\u9009\u62e9\u56fe\u7247 / \u89c6\u9891</button>
          <div id="media-list" class="media-list"></div>
        </div>
        <div id="status" class="status"></div>
        <div class="actions">
          <button type="button" id="cancel">\u53d6\u6d88</button>
          <button type="button" class="primary" id="submit">\u63d0\u4ea4</button>
        </div>
      </section>
    </main>
    <script>
      const text = document.getElementById("flash-diary-text");
      const mediaList = document.getElementById("media-list");
      const status = document.getElementById("status");
      const targetCopyTitle = document.getElementById("target-copy-title");
      const targetCopyDesc = document.getElementById("target-copy-desc");
      const selectedMedia = [];
      let target = "flash-diary";

      function escapeHtml(value) {
        return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
      }

      function renderMedia() {
        mediaList.innerHTML = selectedMedia.length
          ? selectedMedia.map((file) => '<div class="media-item">' + escapeHtml(file) + '</div>').join("")
          : '<p>\u672a\u9009\u62e9\u9644\u4ef6</p>';
      }

      function renderTargetCopy() {
        if (!targetCopyTitle || !targetCopyDesc) return;
        if (target === "clipping") {
          targetCopyTitle.textContent = "\u5f53\u524d\u4f1a\u5199\u5165 raw/\u526a\u85cf";
          targetCopyDesc.textContent = "\u9002\u5408\u4fdd\u5b58\u94fe\u63a5\u3001\u7f51\u9875\u6458\u8981\u6216\u4e34\u65f6\u7d20\u6750\uff0c\u540e\u7eed\u53ef\u4ee5\u8fdb sources_full \u548c compile \u6d41\u7a0b\u3002";
          return;
        }
        targetCopyTitle.textContent = "\u5f53\u524d\u4f1a\u5199\u5165 raw/\u95ea\u5ff5\u65e5\u8bb0";
        targetCopyDesc.textContent = "\u9002\u5408\u5feb\u901f\u8bb0\u5f55\u60f3\u6cd5\uff0c\u6309\u5f53\u5929\u65e5\u8bb0\u5012\u5e8f\u8ffd\u8bb0\u3002";
      }

      document.getElementById("choose-media").addEventListener("click", async () => {
        const files = await window.llmWikiDesktop.chooseFlashDiaryMedia();
        selectedMedia.splice(0, selectedMedia.length, ...files);
        renderMedia();
      });

      document.querySelectorAll("[data-target]").forEach((button) => {
        button.addEventListener("click", () => {
          target = button.dataset.target === "clipping" ? "clipping" : "flash-diary";
          document.querySelectorAll("[data-target]").forEach((item) => item.classList.toggle("active", item === button));
          renderTargetCopy();
        });
      });

      document.getElementById("cancel").addEventListener("click", () => {
        window.close();
      });

      document.getElementById("submit").addEventListener("click", () => {
        window.llmWikiDesktop.submitFlashDiaryEntry({
          target,
          text: text.value,
          mediaPaths: selectedMedia,
        });
        window.close();
      });

      renderMedia();
      renderTargetCopy();
      text.focus();
    </script>
  </body>
</html>`;
}

export function buildFlashDiaryCaptureDataUrl(): string {
  const html = buildFlashDiaryCaptureHtml();
  return `data:text/html;charset=utf-8;base64,${Buffer.from(html, "utf8").toString("base64")}`;
}
