export type ApiError = { code: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Browser helper for the JSON route handlers under /api. Never throws; callers branch on `ok`. */
export async function apiRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error ?? { code: "HTTP_" + res.status, message: `Request failed (${res.status})` },
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Could not reach the server. Check your connection." } };
  }
}
