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
    response.headers.forEach((value, key) => {
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
