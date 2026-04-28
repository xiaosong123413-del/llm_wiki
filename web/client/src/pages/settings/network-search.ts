/**
 * Network search and supporting settings panels.
 *
 * These helpers keep the main settings page focused on page composition while
 * this module owns the network-search status wiring and the adjacent static
 * support panels.
 */

interface SearchStatusResponse {
  local: {
    configured: boolean;
  };
  web: {
    configured: boolean;
    endpointHost: string | null;
  };
}

interface SearchProviderConfigResponse {
  url: string;
  keyConfigured: boolean;
  model: string;
}

interface SearchProviderTestResponse {
  success?: boolean;
  data?: {
    ok?: boolean;
    message?: string;
  };
  error?: string;
}

export function renderNetworkSearchPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="network-search" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">NETWORK SEARCH</div>
          <h1 class="settings-page__title">&#x7f51;&#x7edc;&#x641c;&#x7d22; API</h1>
          <p>&#x8054;&#x7f51;&#x641c;&#x7d22;&#x72b6;&#x6001;&#x5df2;&#x5408;&#x5e76;&#x5230;&#x8fd9;&#x91cc;&#xff0c;&#x6d4b;&#x8bd5;&#x901a;&#x8fc7;&#x65f6;&#x663e;&#x793a;&#x7eff;&#x706f;&#x3002;</p>
        </div>
        <div class="settings-run-panel__actions">
          <button type="button" class="btn btn-secondary" data-search-provider-save>&#x4fdd;&#x5b58;</button>
          <button type="button" class="btn btn-primary" data-search-provider-test>&#x5237;&#x65b0; / &#x6d4b;&#x8bd5;</button>
        </div>
      </div>
      <article class="settings-card settings-card--network-search">
        <div class="settings-card__header">
          <div>
            <div class="eyebrow">PROVIDER</div>
            <h2>&#x7f51;&#x7edc;&#x641c;&#x7d22; API</h2>
          </div>
          <span class="settings-status-light" data-search-provider-light></span>
        </div>
        <p data-search-provider-status>&#x6b63;&#x5728;&#x68c0;&#x67e5; /api/search/status...</p>
        <div class="settings-provider-fields">
          <label class="settings-field"><span>&#x5730;&#x5740;</span><input data-provider="search:url" type="text" /></label>
          <label class="settings-field"><span>&#x5bc6;&#x94a5;</span><input data-provider="search:key" type="password" /></label>
          <label class="settings-field"><span>Provider / &#x6a21;&#x578b;</span><input data-provider="search:model" type="text" /></label>
        </div>
      </article>
    </section>
  `;
}

export function renderEmbeddingPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="embedding" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">VECTOR SEARCH</div>
          <h1 class="settings-page__title">Vector Search / Embedding</h1>
          <p>&#x914d;&#x7f6e;&#x5411;&#x91cf;&#x68c0;&#x7d22;&#x548c;&#x6587;&#x672c;&#x5d4c;&#x5165;&#x670d;&#x52a1;&#x3002;</p>
        </div>
      </div>
      ${renderSimpleProviderCard("embedding", "Vector Search / Embedding")}
    </section>
  `;
}

export function renderPluginsPanel(): string {
  return `
    <section class="settings-panel" data-settings-panel="plugins" hidden>
      <div class="settings-page__header">
        <div class="settings-page__header-copy">
          <div class="eyebrow">PLUGINS</div>
          <h1 class="settings-page__title">&#x63d2;&#x4ef6; / MCP</h1>
          <p>&#x9884;&#x7559;&#x63d2;&#x4ef6;&#x3001MCP &#x548c skills &#x914d;&#x7f6e;&#x5165;&#x53e3;&#x3002;</p>
        </div>
      </div>
      <article class="settings-card"><h2>MCP</h2><p>&#x6682;&#x65f6;&#x4fdd;&#x7559;&#x5f62;&#x5f0f;&#xff0c;&#x540e;&#x7eed;&#x63a5;&#x5165;&#x63d2;&#x4ef6;&#x5e02;&#x573a;&#x548c MCP server &#x5217;&#x8868;&#x3002;</p></article>
    </section>
  `;
}

export function bindNetworkSearchPanel(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("[data-search-provider-save]")?.addEventListener("click", () => {
    void saveSearchProviderConfig(root);
  });
  root.querySelector<HTMLButtonElement>("[data-search-provider-test]")?.addEventListener("click", () => {
    void testSearchProvider(root);
  });
  void hydrateSearchStatus(root);
}

async function hydrateSearchStatus(root: HTMLElement): Promise<void> {
  const badge = root.querySelector<HTMLElement>("[data-search-provider-light]");
  const status = root.querySelector<HTMLElement>("[data-search-provider-status]");
  if (!badge || !status) return;
  await hydrateSearchProviderConfig(root);
  try {
    const response = await fetch("/api/search/status");
    const payload = await response.json() as { success?: boolean; data?: SearchStatusResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "\u641c\u7d22\u72b6\u6001\u8bfb\u53d6\u5931\u8d25");
    }
    renderSearchStatus(badge, status, payload.data.web.configured, payload.data.web.endpointHost);
  } catch (error) {
    badge.className = "settings-status-light is-error";
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function setSearchProviderStatus(
  badge: HTMLElement,
  status: HTMLElement,
  tone: "error" | "loading",
  message: string,
): void {
  badge.className = `settings-status-light is-${tone}`;
  status.textContent = message;
}

async function readSearchProviderConfigData(response: Response): Promise<SearchProviderConfigResponse> {
  const payload = await response.json() as { success?: boolean; data?: SearchProviderConfigResponse; error?: string };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? "\u4fdd\u5b58\u5931\u8d25");
  }
  return payload.data;
}

function describeSavedSearchProviderStatus(config: SearchProviderConfigResponse): string {
  if (!config.url) {
    return "\u5df2\u6e05\u7a7a\u7f51\u7edc\u641c\u7d22\u914d\u7f6e\u3002";
  }
  return `\u5df2\u4fdd\u5b58\uff1a${readHost(config.url) ?? config.url}`;
}

async function readSearchProviderTestMessage(response: Response): Promise<string> {
  const payload = await response.json() as SearchProviderTestResponse;
  if (!response.ok || !payload.success || !payload.data?.ok) {
    throw new Error(payload.error ?? payload.data?.message ?? "\u6d4b\u8bd5\u5931\u8d25");
  }
  return payload.data.message ?? "\u7f51\u7edc\u641c\u7d22 API \u53ef\u7528\u3002";
}

function renderSearchProviderTestSuccess(badge: HTMLElement, status: HTMLElement, message: string): void {
  renderSearchStatus(badge, status, true, readHost(""));
  status.textContent = message;
}

async function saveSearchProviderConfig(root: HTMLElement): Promise<void> {
  const badge = root.querySelector<HTMLElement>("[data-search-provider-light]");
  const status = root.querySelector<HTMLElement>("[data-search-provider-status]");
  if (!badge || !status) return;
  setSearchProviderStatus(badge, status, "loading", "\u6b63\u5728\u4fdd\u5b58\u7f51\u7edc\u641c\u7d22\u914d\u7f6e...");
  try {
    const response = await fetch("/api/search/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: readSearchInput(root, "search:url"),
        key: readSearchInput(root, "search:key"),
        model: readSearchInput(root, "search:model"),
      }),
    });
    const data = await readSearchProviderConfigData(response);
    renderSearchProviderConfig(root, data);
    renderSearchStatus(badge, status, Boolean(data.url), readHost(data.url));
    status.textContent = describeSavedSearchProviderStatus(data);
  } catch (error) {
    setSearchProviderStatus(
      badge,
      status,
      "error",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testSearchProvider(root: HTMLElement): Promise<void> {
  const badge = root.querySelector<HTMLElement>("[data-search-provider-light]");
  const status = root.querySelector<HTMLElement>("[data-search-provider-status]");
  if (!badge || !status) return;
  setSearchProviderStatus(badge, status, "loading", "\u6b63\u5728\u6d4b\u8bd5\u7f51\u7edc\u641c\u7d22 API...");
  try {
    const response = await fetch("/api/search/test", { method: "POST" });
    renderSearchProviderTestSuccess(badge, status, await readSearchProviderTestMessage(response));
  } catch (error) {
    setSearchProviderStatus(
      badge,
      status,
      "error",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function hydrateSearchProviderConfig(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch("/api/search/config");
    const payload = await response.json() as { success?: boolean; data?: SearchProviderConfigResponse; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "\u641c\u7d22\u914d\u7f6e\u8bfb\u53d6\u5931\u8d25");
    }
    renderSearchProviderConfig(root, payload.data);
  } catch {
    // Keep empty inputs when config cannot be loaded.
  }
}

function renderSearchProviderConfig(root: HTMLElement, config: SearchProviderConfigResponse): void {
  const urlInput = root.querySelector<HTMLInputElement>("[data-provider=\"search:url\"]");
  const keyInput = root.querySelector<HTMLInputElement>("[data-provider=\"search:key\"]");
  const modelInput = root.querySelector<HTMLInputElement>("[data-provider=\"search:model\"]");
  if (urlInput) {
    urlInput.value = config.url;
  }
  if (keyInput) {
    keyInput.value = "";
    keyInput.placeholder = config.keyConfigured ? "\u5df2\u4fdd\u5b58\u5bc6\u94a5\uff0c\u91cd\u65b0\u8f93\u5165\u53ef\u8986\u76d6" : "";
  }
  if (modelInput) {
    modelInput.value = config.model;
  }
}

function renderSearchStatus(light: HTMLElement, status: HTMLElement, configured: boolean, endpointHost: string | null): void {
  light.className = configured ? "settings-status-light is-ok" : "settings-status-light is-muted";
  status.textContent = configured
    ? `\u7f51\u7edc\u641c\u7d22 API \u5df2\u914d\u7f6e\uff1a${endpointHost ?? "\u5df2\u914d\u7f6e endpoint"}`
    : "\u672a\u914d\u7f6e CLOUDFLARE_SEARCH_ENDPOINT\uff0cscope=web \u4f1a\u8fd4\u56de\u7a7a\u7ed3\u679c\u3002";
}

function renderSimpleProviderCard(key: string, title: string): string {
  return `
    <article class="settings-card settings-card--provider">
      <div class="settings-card__header"><div><div class="eyebrow">PROVIDER</div><h2>${title}</h2></div></div>
      <div class="settings-provider-fields">
        <label class="settings-field"><span>&#x5730;&#x5740;</span><input data-provider="${key}:url" type="text" /></label>
        <label class="settings-field"><span>&#x5bc6;&#x94a5;</span><input data-provider="${key}:key" type="password" /></label>
        <label class="settings-field"><span>&#x6a21;&#x578b;</span><input data-provider="${key}:model" type="text" /></label>
      </div>
    </article>
  `;
}

function readSearchInput(root: HTMLElement, key: string): string {
  return root.querySelector<HTMLInputElement>(`[data-provider="${key}"]`)?.value.trim() ?? "";
}

function readHost(value: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
