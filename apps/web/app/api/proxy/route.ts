import { NextResponse } from "next/server";
import {
  HTTP_METHODS,
  executeRequest,
  type ExecutePayload,
  type HttpMethod,
  type KeyValue,
} from "@repo/core";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isKeyValue(value: unknown): value is KeyValue {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<KeyValue>;
  return (
    typeof row.id === "string" &&
    typeof row.key === "string" &&
    typeof row.value === "string" &&
    typeof row.enabled === "boolean"
  );
}

function isBlockedProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host === "::1"
  ) {
    // Allow loopback outside production (local mock + cookie tests).
    return process.env.NODE_ENV === "production";
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  if (host === "metadata.google.internal") return true;
  return false;
}

function isAllowedProxyUrl(
  input: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "Proxy only allows http/https URLs" };
    }
    if (isBlockedProxyHost(url.hostname)) {
      return { ok: false, error: "Proxy blocks private / reserved hosts" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
}

function parsePayload(body: unknown): ExecutePayload | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Partial<ExecutePayload>;
  if (typeof data.url !== "string" || !data.url.trim()) return null;
  if (
    typeof data.method !== "string" ||
    !HTTP_METHODS.includes(data.method as HttpMethod)
  ) {
    return null;
  }
  if (!Array.isArray(data.headers) || !data.headers.every(isKeyValue)) {
    return null;
  }
  if (typeof data.body !== "string") return null;

  return {
    method: data.method as HttpMethod,
    url: data.url.trim(),
    headers: data.headers,
    body: data.body,
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = parsePayload(json);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const allowed = isAllowedProxyUrl(payload.url);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 400 });
  }

  const result = await executeRequest(payload);
  return NextResponse.json(result);
}
