/**
 * Hash-based router for the web client.
 *
 * Routes are represented as `{ name, params }`. Unknown or empty hashes fall
 * back to the default route (`chat`). The router is intentionally minimal —
 * it does no DOM manipulation; view mounting lives in `shell/main-slot.ts`.
 */

export type RouteName = "chat" | "check" | "sync" | "review" | "settings";

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

interface RouteSpec {
  name: RouteName;
  paramKey?: string;
}

const ROUTE_TABLE: Record<string, RouteSpec> = {
  chat: { name: "chat", paramKey: "id" },
  check: { name: "check" },
  sync: { name: "sync" },
  review: { name: "review", paramKey: "id" },
  settings: { name: "settings", paramKey: "section" },
};

const DEFAULT_ROUTE: Route = { name: "chat", params: {} };

export function parseHash(hash: string): Route {
  if (!hash || hash === "#" || hash === "#/") {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const trimmed = hash.startsWith("#/") ? hash.slice(2) : hash.replace(/^#/, "");
  const [head, tail] = trimmed.split("/", 2);
  const spec = ROUTE_TABLE[head];
  if (!spec) {
    return { ...DEFAULT_ROUTE, params: {} };
  }
  const params: Record<string, string> = {};
  if (tail && spec.paramKey) {
    params[spec.paramKey] = tail;
  }
  return { name: spec.name, params };
}

function formatRoute(route: { name: RouteName; params?: Record<string, string> }): string {
  const spec = ROUTE_TABLE[route.name];
  const key = spec?.paramKey;
  const value = key ? route.params?.[key] : undefined;
  return value ? `#/${route.name}/${value}` : `#/${route.name}`;
}

export interface Router {
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
