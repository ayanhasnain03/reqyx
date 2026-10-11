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
};

function hostMatches(cookieDomain: string, requestHost: string): boolean {
  const domain = cookieDomain.replace(/^\./, "").toLowerCase();
  const host = requestHost.toLowerCase();
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
  let path = "/";
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
  };
}

export function extractCookiesFromHeaders(
  headers: { key: string; value: string }[],
  requestUrl: string,
): StoredCookie[] {
  const out: StoredCookie[] = [];
  for (const header of headers) {
    if (header.key.toLowerCase() !== "set-cookie") continue;
    const parsed = parseSetCookieHeader(header.value, requestUrl);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function pruneExpiredCookies(jar: StoredCookie[]): StoredCookie[] {
  const now = Date.now();
  return jar.filter((cookie) => cookie.expires === null || cookie.expires > now);
}

export function mergeCookieJar(
  jar: StoredCookie[],
  incoming: StoredCookie[],
): StoredCookie[] {
  let next = pruneExpiredCookies(jar);
  for (const cookie of incoming) {
    next = next.filter(
      (item) =>
        !(
          item.name === cookie.name &&
          item.domain === cookie.domain &&
          item.path === cookie.path
        ),
    );
    next.push(cookie);
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
    if (cookie.secure && url.protocol !== "https:") return false;
    if (!hostMatches(cookie.domain, url.hostname)) return false;
    return pathMatches(cookie.path, url.pathname || "/");
  });

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
