/** Without a configured URL, the API is reached through the dev server that served the app, which proxies /api to the backend. */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? window.location.origin).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${url}`, init);
  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" ? body.message : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  // orval types every call from the OpenAPI contract, so the response shape is checked at generation time.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
