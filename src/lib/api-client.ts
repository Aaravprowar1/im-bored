/** Small fetch wrapper for our JSON API: returns data or a typed error. */
export type ApiFailure = { code: string; message: string; fields?: Record<string, string> };

export async function api<T>(input: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: ApiFailure; status: number }> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: body?.error ?? { code: "server_error", message: "Something went wrong." } };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "You seem to be offline. Check your connection and try again." } };
  }
}
