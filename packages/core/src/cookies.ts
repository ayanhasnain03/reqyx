import { createId } from "./format";

export type StoredCookie = {
  id: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | null;
  secure: boolean;
  httpOnly: boolean;
  /** When true, Domain was omitted — match exact host only (Postman/RFC). */
  hostOnly: boolean;
};

function defaultCookiePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const idx = pathname.lastIndexOf("/");
  if (idx <= 0) return "/";
  return pathname.slice(0, idx);
}

function hostMatches(cookie: StoredCookie, requestHost: string): boolean {
  const domain = cookie.domain.replace(/^\./, "").toLowerCase();
  const host = requestHost.toLowerCase();
  if (cookie.hostOnly) return host === domain;
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(cookiePath: string, requestPath: string): boolean {
  const path = cookiePath || "/";
  if (requestPath.startsWith(path)) {
    if (path.endsWith("/") || requestPath.length === path.length) return true;
    return requestPath.charAt(path.length) === "/";
  }
  return false;
}

export function parseSetCookieHeader(
  header: string,
  requestUrl: string,
): StoredCookie | null {
  const parts = header.split(";").map((part) => part.trim()).filter(Boolean);
  const nameValue = parts[0];
  if (!nameValue) return null;

  const eq = nameValue.indexOf("=");
  if (eq <= 0) return null;

  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();
  if (!name) return null;

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  let domain = url.hostname;
  let hostOnly = true;
  let path = defaultCookiePath(url.pathname || "/");
  let expires: number | null = null;
  let secure = false;
  let httpOnly = false;
  let maxAge: number | null = null;

  for (const attr of parts.slice(1)) {
    const sep = attr.indexOf("=");
    const rawKey = sep === -1 ? attr : attr.slice(0, sep);
    const key = rawKey.trim().toLowerCase();
    const attrValue = sep === -1 ? "" : attr.slice(sep + 1).trim();

    if (key === "domain" && attrValue) {
      domain = attrValue.replace(/^\./, "");
      hostOnly = false;
    } else if (key === "path" && attrValue) {
      path = attrValue.startsWith("/") ? attrValue : `/${attrValue}`;
    } else if (key === "expires" && attrValue) {
      const ts = Date.parse(attrValue);
      if (!Number.isNaN(ts)) expires = ts;
    } else if (key === "max-age" && attrValue) {
      const seconds = Number(attrValue);
      if (Number.isFinite(seconds)) maxAge = seconds;
    } else if (key === "secure") {
      secure = true;
    } else if (key === "httponly") {
      httpOnly = true;
    }
  }

  if (maxAge !== null) {
    expires = Date.now() + maxAge * 1000;
  }

  return {
    id: createId(),
    name,
    value,
    domain,
    path,
    expires,
    secure,
    httpOnly,
    hostOnly,
  };
}

export function extractCookiesFromHeaders(
  headers: { key: string; value: string }[],
  requestUrl: string,
): StoredCookie[] {
  const out: StoredCookie[] = [];
  for (const header of headers) {
    if (header.key.toLowerCase() !== "set-cookie") continue;
    // Some stacks join cookies with newline or comma-separated pairs; prefer one header per cookie.
    const parsed = parseSetCookieHeader(header.value, requestUrl);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function pruneExpiredCookies(jar: StoredCookie[]): StoredCookie[] {
  const now = Date.now();
  return jar.filter((cookie) => cookie.expires === null || cookie.expires > now);
}

function sameCookieIdentity(a: StoredCookie, b: StoredCookie): boolean {
  return (
    a.name === b.name &&
    a.domain.toLowerCase() === b.domain.toLowerCase() &&
    a.path === b.path &&
    Boolean(a.hostOnly) === Boolean(b.hostOnly)
  );
}

/** Merge like Postman: replace matching cookies; Max-Age/Expires in the past removes. */
export function mergeCookieJar(
  jar: StoredCookie[],
  incoming: StoredCookie[],
): StoredCookie[] {
  let next = pruneExpiredCookies(
    jar.map((cookie) => ({
      ...cookie,
      hostOnly: cookie.hostOnly ?? true,
    })),
  );
  const now = Date.now();

  for (const cookie of incoming) {
    const normalized: StoredCookie = {
      ...cookie,
      hostOnly: cookie.hostOnly ?? true,
    };
    next = next.filter((item) => !sameCookieIdentity(item, normalized));
    const deleted =
      normalized.expires !== null && normalized.expires <= now;
    if (!deleted) {
      next.push(normalized);
    }
  }
  return next;
}

export function cookiesForUrl(jar: StoredCookie[], requestUrl: string): string {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return "";
  }

  const matched = pruneExpiredCookies(jar).filter((cookie) => {
    const item = { ...cookie, hostOnly: cookie.hostOnly ?? true };
    if (item.secure && url.protocol !== "https:") return false;
    if (!hostMatches(item, url.hostname)) return false;
    return pathMatches(item.path, url.pathname || "/");
  });

  // Longer paths first (RFC / Postman)
  matched.sort((a, b) => b.path.length - a.path.length);

  return matched.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export function applyCookieHeader(
  headers: { id: string; key: string; value: string; enabled: boolean }[],
  cookieHeader: string,
): { id: string; key: string; value: string; enabled: boolean }[] {
  const withoutCookie = headers.filter(
    (header) => header.key.trim().toLowerCase() !== "cookie",
  );
  if (!cookieHeader) return withoutCookie;
  return [
    ...withoutCookie,
    {
      id: createId(),
      key: "Cookie",
      value: cookieHeader,
      enabled: true,
    },
  ];
}

export function createManualCookie(input: {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}): StoredCookie | null {
  const name = input.name.trim();
  const domain = input.domain.trim().replace(/^\./, "");
  if (!name || !domain) return null;
  return {
    id: createId(),
    name,
    value: input.value,
    domain,
    path: input.path?.trim() || "/",
    expires: null,
    secure: Boolean(input.secure),
    httpOnly: Boolean(input.httpOnly),
    hostOnly: true,
  };
}
