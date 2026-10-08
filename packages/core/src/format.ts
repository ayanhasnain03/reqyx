export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function statusBand(
  status: number,
): "success" | "redirect" | "client-error" | "server-error" | "unknown" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400 && status < 500) return "client-error";
  if (status >= 500) return "server-error";
  return "unknown";
}

export function prettyBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return body;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return body;
  }
}

export type BodyKind = "empty" | "json" | "text";

export function detectBodyKind(body: string): BodyKind {
  const trimmed = body.trim();
  if (!trimmed) return "empty";
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    return "text";
  }
}

export function parseJsonBody(body: string):
  | { ok: true; value: unknown; pretty: string }
  | { ok: false } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false };
  try {
    const value = JSON.parse(trimmed) as unknown;
    return { ok: true, value, pretty: JSON.stringify(value, null, 2) };
  } catch {
    return { ok: false };
  }
}

export function formatJsonBody(body: string): string | null {
  const parsed = parseJsonBody(body);
  return parsed.ok ? parsed.pretty : null;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyKeyValue(partial?: Partial<{ key: string; value: string }>) {
  return {
    id: createId(),
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    enabled: true,
  };
}
