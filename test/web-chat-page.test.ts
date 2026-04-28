// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountChatPage } from "../web/client/src/pages/chat/index.js";

describe("mountChatPage", () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="chat-app"></section>';
  });

  it("renders chat structure including header actions", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    window.localStorage.setItem("llmWiki.panel.chat.sidebarWidth", "360");
    const chat = mountChatPage(container);
    const threadViewport = container.querySelector<HTMLElement>(".chat-thread__viewport");
    const sidebarToggle = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-toggle]");
    const railToggle = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-rail-toggle]");

    expect(chat.newConversationButton.id).toBe("chat-new-conversation");
    expect(chat.newConversationButton.getAttribute("aria-label")).toBe("新对话");
    expect(chat.newConversationButton.textContent?.trim()).toBe("");
    expect(chat.newConversationButton.querySelector("svg")).not.toBeNull();
    expect(chat.conversationList.id).toBe("chat-conversation-list");
    expect(chat.messageList.id).toBe("chat-message-list");
    expect(threadViewport).not.toBeNull();
    expect(threadViewport?.contains(chat.messageList)).toBe(true);
    expect(chat.composer.id).toBe("chat-composer");
    expect(container.querySelectorAll("[data-chat-search-scope]")).toHaveLength(3);
    expect(container.querySelector("[data-chat-app]")).not.toBeNull();
    expect(container.querySelector("[data-panel-handle='chat.sidebarWidth']")).not.toBeNull();
    expect(sidebarToggle).not.toBeNull();
    expect(sidebarToggle?.getAttribute("aria-label")).toBe("折叠会话栏");
    expect(sidebarToggle?.textContent?.trim()).toBe("");
    expect(sidebarToggle?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".chat-sidebar__header [data-chat-sidebar-toggle]")).not.toBeNull();
    expect(container.querySelector(".chat-thread__actions [data-chat-sidebar-toggle]")).toBeNull();
    expect(railToggle?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[data-chat-refs-toggle]")).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".chat-workspace")?.style.getPropertyValue("--chat-sidebar-width")).toBe("360px");
  });

  it("renders conversation titles only and selected state", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.renderConversationList(
      [
        {
          id: "c1",
          title: "First thread",
          updatedAt: "2026-04-17T10:00:00.000Z",
          latestMessage: "hello world",
        },
      ],
      "c1",
    );

    const active = chat.conversationList.querySelector<HTMLElement>("[data-conversation-id='c1']");
    expect(active?.classList.contains("active")).toBe(true);
    expect(active?.textContent).toContain("First thread");
    expect(active?.textContent).not.toContain("hello world");
    expect(chat.conversationList.querySelector(".chat-conversation-item__snippet")).toBeNull();
    expect(chat.conversationList.querySelector("[data-conversation-delete='c1']")).not.toBeNull();
  });

  it("renders messages and thread article chips", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.renderThread({
      title: "Spec thread",
      messages: [
        { id: "m1", role: "user", content: "hello", createdAt: "2026-04-17T10:00:00.000Z" },
        { id: "m2", role: "assistant", content: "world", createdAt: "2026-04-17T10:00:01.000Z" },
      ],
      articleRefs: ["wiki/concepts/example.md"],
    });

    expect(chat.messageList.querySelectorAll(".chat-message")).toHaveLength(2);
    expect(chat.messageList.textContent).toContain("hello");
    expect(chat.messageList.textContent).toContain("world");
    expect(chat.articleRefs.textContent).toContain("wiki/concepts/example.md");
  });

  it("renders markdown-like message content as readable HTML and marks short lines compact", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.renderThread({
      id: "c1",
      title: "Spec thread",
      messages: [
        { id: "m1", role: "user", content: "这个是讲什么的?", createdAt: "2026-04-17T10:00:00.000Z" },
        {
          id: "m2",
          role: "assistant",
          content: "**Windows 11**\n\n- 第一项\n- 第二项",
          createdAt: "2026-04-17T10:00:01.000Z",
        },
      ],
      articleRefs: [],
    });

    const messages = chat.messageList.querySelectorAll<HTMLElement>(".chat-message");
    const assistantBody = messages[1]?.querySelector<HTMLElement>(".chat-message__body");

    expect(messages[0]?.classList.contains("chat-message--compact")).toBe(true);
    expect(assistantBody?.classList.contains("markdown-rendered")).toBe(true);
    expect(assistantBody?.innerHTML).toContain("<strong>Windows 11</strong>");
    expect(assistantBody?.innerHTML).toContain("<ul>");
    expect(assistantBody?.textContent).not.toContain("**Windows 11**");
    expect(assistantBody?.textContent).toContain("第一项");
    expect(assistantBody?.textContent).toContain("第二项");
  });

  it("emits handlers for create, select, composer input, scope change, send, and delete", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const onCreateConversation = vi.fn();
    const onOpenConversation = vi.fn();
    const onDeleteConversation = vi.fn();
    const onSendMessage = vi.fn();
    const onComposerChange = vi.fn();
    const onSearchScopeChange = vi.fn();
    const onAppChange = vi.fn();
    const chat = mountChatPage(container, {
      onCreateConversation,
      onOpenConversation,
      onDeleteConversation,
      onSendMessage,
      onComposerChange,
      onSearchScopeChange,
      onAppChange,
    });
    chat.setApps([
      {
        id: "codex-app",
        name: "Codex 应用",
        mode: "chat",
        provider: "codex-cli",
        model: "gpt-5-codex",
        enabled: true,
      },
    ], "codex-app");

    chat.renderConversationList(
      [{ id: "c1", title: "Thread one", updatedAt: "2026-04-17T10:00:00.000Z", latestMessage: "hi" }],
      null,
    );

    chat.newConversationButton.click();
    chat.conversationList.querySelector<HTMLElement>("[data-conversation-id='c1']")?.click();
    chat.composer.value = "draft message";
    chat.composer.dispatchEvent(new Event("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>("[data-chat-search-scope='web']")?.click();
    container.querySelector<HTMLSelectElement>("[data-chat-app]")!.value = "codex-app";
    container.querySelector<HTMLSelectElement>("[data-chat-app]")?.dispatchEvent(new Event("change", { bubbles: true }));
    chat.composerForm.requestSubmit();
    container.querySelector<HTMLButtonElement>("[data-conversation-delete='c1']")?.click();

    expect(onCreateConversation).toHaveBeenCalledOnce();
    expect(onOpenConversation).toHaveBeenCalledWith("c1");
    expect(onDeleteConversation).toHaveBeenCalledWith("c1");
    expect(onComposerChange).toHaveBeenCalledWith("draft message");
    expect(onSearchScopeChange).toHaveBeenCalledWith("web");
    expect(onAppChange).toHaveBeenCalledWith("codex-app");
    expect(onSendMessage).toHaveBeenCalledWith("draft message");
  });

  it("renders live composer article refs and search scope state", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.setComposerArticleRefs(["wiki/a.md", "wiki/b.md"]);
    chat.setSearchScope("both");
    chat.setApps([
      {
        id: "research-app",
        name: "Research App",
        mode: "knowledge",
        provider: "openai",
        model: "gpt-4.1",
        enabled: true,
      },
    ], "research-app");
    chat.setComposerDraft("draft content");

    const composerRefs = container.querySelector<HTMLElement>("#chat-composer-refs");
    const bothButton = container.querySelector<HTMLButtonElement>("[data-chat-search-scope='both']");

    expect(composerRefs?.textContent).toContain("wiki/a.md");
    expect(composerRefs?.textContent).toContain("wiki/b.md");
    expect(composerRefs?.classList.contains("hidden")).toBe(false);
    expect(bothButton?.classList.contains("is-active")).toBe(true);
    expect(container.querySelector<HTMLSelectElement>("[data-chat-app]")?.value).toBe("research-app");
    expect(chat.composer.value).toBe("draft content");
  });

  it("collapses the conversation sidebar into a narrow rail and supports reopening it", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    const sidebarToggle = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-toggle]");
    const railToggle = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-rail-toggle]");
    const workspace = container.querySelector<HTMLElement>(".chat-workspace");
    const sidebar = container.querySelector<HTMLElement>(".chat-sidebar");

    expect(workspace?.dataset.chatSidebarCollapsed).toBe("false");
    expect(sidebar?.dataset.chatSidebarCollapsed).toBe("false");

    sidebarToggle?.click();
    expect(workspace?.dataset.chatSidebarCollapsed).toBe("true");
    expect(sidebar?.dataset.chatSidebarCollapsed).toBe("true");
    expect(sidebarToggle?.hidden).toBe(true);
    expect(railToggle?.hidden).toBe(false);
    expect(railToggle?.classList.contains("hidden")).toBe(false);

    railToggle?.click();
    expect(workspace?.dataset.chatSidebarCollapsed).toBe("false");
    expect(sidebar?.dataset.chatSidebarCollapsed).toBe("false");
    expect(sidebarToggle?.hidden).toBe(false);
    expect(railToggle?.hidden).toBe(true);
    expect(railToggle?.classList.contains("hidden")).toBe(true);
  });

  it("allows dragging the conversation sidebar to 1px and auto-collapses back to the saved width", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    window.localStorage.setItem("llmWiki.panel.chat.sidebarWidth", "360");
    mountChatPage(container);

    const workspace = container.querySelector<HTMLElement>(".chat-workspace")!;
    const handle = container.querySelector<HTMLElement>("[data-panel-handle='chat.sidebarWidth']")!;
    const railToggle = container.querySelector<HTMLButtonElement>("[data-chat-sidebar-rail-toggle]")!;

    vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      top: 0,
      right: 1200,
      bottom: 800,
      left: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);

    handle.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, bubbles: true }));

    expect(workspace.style.getPropertyValue("--chat-sidebar-width")).toBe("1px");
    expect(workspace.dataset.chatSidebarCollapsed).toBe("false");

    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 1, bubbles: true }));

    expect(workspace.dataset.chatSidebarCollapsed).toBe("true");
    expect(window.localStorage.getItem("llmWiki.chat.conversationSidebarCollapsed")).toBe("1");
    expect(window.localStorage.getItem("llmWiki.panel.chat.sidebarWidth")).toBe("360");

    railToggle.click();

    expect(workspace.dataset.chatSidebarCollapsed).toBe("false");
    expect(workspace.style.getPropertyValue("--chat-sidebar-width")).toBe("360px");
  });

  it("collapses selected page refs independently", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.setComposerArticleRefs(["wiki/a.md"]);
    const refsPanel = container.querySelector<HTMLElement>("[data-chat-refs-panel]");
    const refsToggle = container.querySelector<HTMLButtonElement>("[data-chat-refs-toggle]");
    const composerRefs = container.querySelector<HTMLElement>("#chat-composer-refs");

    expect(refsPanel?.hidden).toBe(false);
    expect(composerRefs?.hidden).toBe(false);

    refsToggle?.click();
    expect(refsPanel?.dataset.chatRefsCollapsed).toBe("true");
    expect(refsToggle?.textContent).toContain("展开");
    expect(composerRefs?.hidden).toBe(true);

    refsToggle?.click();
    expect(refsPanel?.dataset.chatRefsCollapsed).toBe("false");
    expect(refsToggle?.textContent).toContain("折叠");
    expect(composerRefs?.hidden).toBe(false);
  });

  it("renders the current app runtime summary", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.setRuntimeSummary({
      appLabel: "Research App",
      providerLabel: "Google (Gemini)",
      modelLabel: "gemini-2.5-pro",
      sourceLabel: "OAuth · Gemini CLI · gemini@example.com",
    });

    const summary = container.querySelector<HTMLElement>("#chat-runtime-summary");
    expect(summary?.classList.contains("hidden")).toBe(false);
    expect(summary?.textContent).toContain("Research App");
    expect(summary?.textContent).toContain("OAuth · Gemini CLI · gemini@example.com");
    expect(summary?.textContent).toContain("Google (Gemini)");
    expect(summary?.textContent).toContain("gemini-2.5-pro");
  });

  it("shows search scope buttons in the composer area", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const chat = mountChatPage(container);

    chat.renderThread({
      id: "c1",
      title: "Thread one",
      messages: [],
      articleRefs: [],
    });

    expect(container.querySelectorAll("[data-chat-search-scope]")).toHaveLength(3);
  });

  it("supports deleting a conversation directly from the list without opening it first", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const onDeleteConversation = vi.fn();
    const onOpenConversation = vi.fn();
    const chat = mountChatPage(container, {
      onDeleteConversation,
      onOpenConversation,
    });

    chat.renderConversationList(
      [{ id: "c1", title: "Thread one", updatedAt: "2026-04-17T10:00:00.000Z", latestMessage: "hi" }],
      null,
    );

    container.querySelector<HTMLButtonElement>("[data-conversation-delete='c1']")?.click();

    expect(onDeleteConversation).toHaveBeenCalledWith("c1");
    expect(onOpenConversation).not.toHaveBeenCalled();
  });

  it("supports inline thread title rename", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const onRenameConversation = vi.fn();
    const chat = mountChatPage(container, { onRenameConversation });

    chat.renderThread({
      id: "c1",
      title: "Before rename",
      messages: [],
      articleRefs: [],
    });

    const title = container.querySelector<HTMLElement>("#chat-thread-title");
    title?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = container.querySelector<HTMLInputElement>(".chat-thread__title-input");
    expect(input).not.toBeNull();

    input!.value = "After rename";
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onRenameConversation).toHaveBeenCalledWith("c1", "After rename");
  });

  it("sends with Enter but keeps Shift+Enter for new lines", () => {
    const container = document.getElementById("chat-app") as HTMLElement;
    const onSendMessage = vi.fn();
    const chat = mountChatPage(container, { onSendMessage });

    chat.composer.value = "first line";
    chat.composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    chat.composer.value = "second line";
    chat.composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));

    expect(onSendMessage).toHaveBeenCalledOnce();
    expect(onSendMessage).toHaveBeenCalledWith("first line");
  });
});
