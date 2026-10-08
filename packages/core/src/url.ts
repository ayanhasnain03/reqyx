import type { KeyValue } from "./types";

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  if (
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("[::1]") ||
    trimmed.startsWith("::1")
  ) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function isLocalHostUrl(input: string): boolean {
  const value = normalizeUrl(input);
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function buildUrl(base: string, params: KeyValue[]): string {
  const trimmed = normalizeUrl(base);
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    for (const param of params) {
      if (!param.enabled) continue;
      const key = param.key.trim();
      if (!key) continue;
      url.searchParams.append(key, param.value);
    }
    return url.toString();
  } catch {
    const query = params
      .filter((param) => param.enabled && param.key.trim())
      .map(
        (param) =>
          `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`,
      )
      .join("&");

    if (!query) return trimmed;
    return `${trimmed}${trimmed.includes("?") ? "&" : "?"}${query}`;
  }
}
