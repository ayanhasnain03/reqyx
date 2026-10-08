import type { ExecutePayload } from "./types";

export function toCurl(payload: ExecutePayload): string {
  const parts = [`curl --request ${payload.method}`, `  --url '${payload.url}'`];

  for (const header of payload.headers) {
    if (!header.enabled || !header.key.trim()) continue;
    parts.push(
      `  --header '${header.key.trim()}: ${header.value.replace(/'/g, "'\\''")}'`,
    );
  }

  if (
    payload.body &&
    payload.method !== "GET" &&
    payload.method !== "HEAD"
  ) {
    parts.push(`  --data '${payload.body.replace(/'/g, "'\\''")}'`);
  }

  return parts.join(" \\\n");
}

export function toFetch(payload: ExecutePayload): string {
  const headers: Record<string, string> = {};
  for (const header of payload.headers) {
    if (!header.enabled || !header.key.trim()) continue;
    headers[header.key.trim()] = header.value;
  }

  const init: Record<string, unknown> = {
    method: payload.method,
    headers,
  };

  if (
    payload.body &&
    payload.method !== "GET" &&
    payload.method !== "HEAD"
  ) {
    init.body = payload.body;
  }

  return `fetch(${JSON.stringify(payload.url)}, ${JSON.stringify(init, null, 2)})`;
}
