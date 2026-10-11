import type { ExecutePayload, HttpResult, KeyValue } from "./types";

function enabledHeaders(headers: KeyValue[]): Headers {
  const out = new Headers();
  for (const header of headers) {
    if (!header.enabled) continue;
    const key = header.key.trim();
    if (!key) continue;
    out.set(key, header.value);
  }
  return out;
}

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string | string[]>;
  };

  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie.call(headers);
    if (Array.isArray(list) && list.length > 0) {
      return list.filter((value): value is string => Boolean(value));
    }
  }

  // node-fetch style raw()
  if (typeof headers.raw === "function") {
    const raw = headers.raw();
    const fromRaw = raw["set-cookie"] ?? raw["Set-Cookie"];
    if (Array.isArray(fromRaw)) {
      return fromRaw.filter(Boolean);
    }
    if (typeof fromRaw === "string" && fromRaw) {
      return [fromRaw];
    }
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export async function executeRequest(
  payload: ExecutePayload,
  signal?: AbortSignal,
): Promise<HttpResult> {
  const started = performance.now();
  const url = payload.url.trim();

  if (!url) {
    return { ok: false, error: "URL is required", timeMs: 0 };
  }

  try {
    const init: RequestInit = {
      method: payload.method,
      headers: enabledHeaders(payload.headers),
      signal,
      redirect: "follow",
    };

    if (
      payload.body &&
      payload.method !== "GET" &&
      payload.method !== "HEAD"
    ) {
      init.body = payload.body;
    }

    const response = await fetch(url, init);
    const body = await response.text();
    const headers: KeyValue[] = [];

    for (const [index, value] of collectSetCookieHeaders(response).entries()) {
      headers.push({
        id: `set-cookie-${index}`,
        key: "set-cookie",
        value,
        enabled: true,
      });
    }

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") return;
      headers.push({
        id: key,
        key,
        value,
        enabled: true,
      });
    });

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      timeMs: Math.round(performance.now() - started),
      size: new TextEncoder().encode(body).byteLength,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Request aborted"
          : error.message
        : "Request failed";

    return {
      ok: false,
      error: message,
      timeMs: Math.round(performance.now() - started),
    };
  }
}
