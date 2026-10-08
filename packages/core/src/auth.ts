import type { AuthConfig, KeyValue } from "./types";
import { emptyKeyValue } from "./format";

function encodeBase64(value: string): string {
  if (typeof btoa === "function") {
    return btoa(value);
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const bytes = new TextEncoder().encode(value);
  let output = "";
  let i = 0;

  while (i < bytes.length) {
    const a = bytes[i++] ?? 0;
    const b = i < bytes.length ? (bytes[i++] ?? 0) : undefined;
    const c = i < bytes.length ? (bytes[i++] ?? 0) : undefined;
    const bitmap =
      (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    output += chars.charAt((bitmap >> 18) & 63);
    output += chars.charAt((bitmap >> 12) & 63);
    output += b === undefined ? "=" : chars.charAt((bitmap >> 6) & 63);
    output += c === undefined ? "=" : chars.charAt(bitmap & 63);
  }

  return output;
}

export function applyAuth(
  auth: AuthConfig,
  headers: KeyValue[],
  params: KeyValue[],
): { headers: KeyValue[]; params: KeyValue[] } {
  const nextHeaders = [...headers];
  const nextParams = [...params];

  if (auth.type === "bearer" && auth.token.trim()) {
    nextHeaders.push(
      emptyKeyValue({
        key: "Authorization",
        value: `Bearer ${auth.token.trim()}`,
      }),
    );
  }

  if (auth.type === "basic" && (auth.username || auth.password)) {
    nextHeaders.push(
      emptyKeyValue({
        key: "Authorization",
        value: `Basic ${encodeBase64(`${auth.username}:${auth.password}`)}`,
      }),
    );
  }

  if (auth.type === "apikey" && auth.key.trim()) {
    const row = emptyKeyValue({
      key: auth.key.trim(),
      value: auth.value,
    });
    if (auth.addTo === "query") {
      nextParams.push(row);
    } else {
      nextHeaders.push(row);
    }
  }

  return { headers: nextHeaders, params: nextParams };
}
