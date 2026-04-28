/**
 * Hash-based router for the web client.
 *
 * Routes are represented as `{ name, params }`. Unknown or empty hashes fall
 * back to the default route (`chat`). The router is intentionally minimal —
 * it does no DOM manipulation; view mounting lives in `shell/main-slot.ts`.
 */

export type RouteName =
  | "workspace"
  | "chat"
  | "flash-diary"
  | "automation"
  | "automation-log"
  | "wiki"
  | "sources"
  | "check"
  | "sync"
  | "review"
  | "graph"
  | "settings"
  | "project-log";

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  anchor?: string;
}

interface RouteSpec {
  name: RouteName;
  paramKey?: string;
}

const ROUTE_TABLE: Record<string, RouteSpec> = {
  workspace: { name: "workspace", paramKey: "section" },
  chat: { name: "chat", paramKey: "id" },
  "flash-diary": { name: "flash-diary" },
  automation: { name: "automation", paramKey: "id" },
  "automation-log": { name: "automation-log", paramKey: "id" },
  wiki: { name: "wiki", paramKey: "path" },
  sources: { name: "sources" },
  check: { name: "check" },
  sync: { name: "sync" },
  review: { name: "review", paramKey: "id" },
  graph: { name: "graph" },
  settings: { name: "settings", paramKey: "section" },
  "project-log": { name: "project-log" },
};

const DEFAULT_ROUTE: Route = { name: "chat", params: {} };

export function parseHash(hash: string): Route {
  if (!hash || hash === "#" || hash === "#/") {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const trimmed = hash.startsWith("#/") ? hash.slice(2) : hash.replace(/^#/, "");
  const anchorIndex = trimmed.indexOf("#");
  const routePart = anchorIndex === -1 ? trimmed : trimmed.slice(0, anchorIndex);
  const anchor = anchorIndex === -1 ? undefined : decodeURIComponent(trimmed.slice(anchorIndex + 1));
  const slashIndex = routePart.indexOf("/");
  const head = slashIndex === -1 ? routePart : routePart.slice(0, slashIndex);
  const tail = slashIndex === -1 ? "" : routePart.slice(slashIndex + 1);
  if (head === "publish") {
    return { name: "settings", params: { section: "app-config" } };
  }
  const spec = ROUTE_TABLE[head];
  if (!spec) {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const params: Record<string, string> = {};
  if (tail && spec.paramKey) {
    params[spec.paramKey] = decodeURIComponent(tail);
  }
  return anchor ? { name: spec.name, params, anchor } : { name: spec.name, params };
}

function formatRoute(route: { name: RouteName; params?: Record<string, string> }): string {
  const spec = ROUTE_TABLE[route.name];
  const key = spec?.paramKey;
  const value = key ? route.params?.[key] : undefined;
  const encodedValue = value ? encodeRouteParam(route.name, value) : undefined;
  const anchor = "anchor" in route && typeof route.anchor === "string" && route.anchor
    ? `#${encodeURIComponent(route.anchor)}`
    : "";
  return encodedValue ? `#/${route.name}/${encodedValue}${anchor}` : `#/${route.name}${anchor}`;
}

interface Router {
  start(): void;
  navigate(route: { name: RouteName; params?: Record<string, string> }): void;
  current(): Route;
}

export function createRouter(onChange: (route: Route) => void): Router {
  let current: Route = parseHash(window.location.hash);
  function emit(): void {
    current = parseHash(window.location.hash);
    onChange(current);
  }
  return {
    start() {
      window.addEventListener("hashchange", emit);
      emit();
    },
    navigate(route) {
      window.location.hash = formatRoute(route);
    },
    current() {
      return current;
    },
  };
}

function encodeRouteParam(routeName: RouteName, value: string): string {
  if (routeName === "workspace") {
    return value.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  }
  return encodeURIComponent(value);
}
