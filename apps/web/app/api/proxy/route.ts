import { NextResponse } from "next/server";
import {
  HTTP_METHODS,
  executeRequest,
  isLocalHostUrl,
  type ExecutePayload,
  type HttpMethod,
  type KeyValue,
} from "@repo/core";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

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

  if (!isLocalHostUrl(payload.url)) {
    return NextResponse.json(
      { error: "Proxy only allows localhost / loopback targets" },
      { status: 400 },
    );
  }

  const result = await executeRequest(payload);
  return NextResponse.json(result);
}
