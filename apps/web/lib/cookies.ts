import type { StoredCookie } from "@repo/core";

const STORAGE_KEY = "reqyx.cookie-jar";

export function loadCookieJar(): StoredCookie[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCookie[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((cookie) => ({
      ...cookie,
      hostOnly: cookie.hostOnly ?? true,
    }));
  } catch {
    return [];
  }
}

export function saveCookieJar(jar: StoredCookie[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jar));
}
