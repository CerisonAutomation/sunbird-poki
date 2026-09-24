// Tiny shared helpers for the leaderboard Vercel Functions.

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The client may run on a different origin (e.g. a portal build pointing
      // at a hosted leaderboard). Match the reference server's permissive CORS.
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sanitize(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[<>&"']/g, "")
    .slice(0, max);
}

export function boundedNum(value: unknown, cap: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(n, cap));
}
