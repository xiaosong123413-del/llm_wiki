/**
 * Shared HTTP and AI helpers for the remote-brain Worker modules.
 *
 * These utilities keep route files focused on endpoint behavior while
 * preserving the Worker's existing JSON response, request parsing, and
 * Workers AI guard semantics.
 */

interface WorkerAiEnv {
  AI?: Ai;
}

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function safeJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

export function requireAi(env: WorkerAiEnv, model?: string): Response | null {
  if (!env.AI) return json({ ok: false, error: "missing_ai_binding" }, 500);
  if (!model) return json({ ok: false, error: "missing_ai_model" }, 500);
  return null;
}

export function titleFromPath(pagePath: string): string {
  return pagePath.replace(/^wiki\//, "").replace(/\.md$/, "").split("/").pop() || pagePath;
}
