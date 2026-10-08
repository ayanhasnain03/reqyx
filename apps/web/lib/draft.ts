import {
  createId,
  emptyAuth,
  emptyKeyValue,
  type RequestDraft,
  type RequestKind,
} from "@repo/core";

export function createDraft(partial?: Partial<RequestDraft>): RequestDraft {
  return {
    id: partial?.id ?? createId(),
    name: partial?.name ?? "Untitled",
    kind: partial?.kind ?? "http",
    method: partial?.method ?? "GET",
    url:
      partial?.url ??
      (partial?.kind === "websocket"
        ? "ws://localhost:8080/ws"
        : partial?.kind === "sse"
          ? "http://localhost:8080/events"
          : "http://localhost:8080"),
    params: partial?.params ?? [emptyKeyValue()],
    headers: partial?.headers ?? [
      emptyKeyValue({ key: "Accept", value: "application/json" }),
    ],
    body: partial?.body ?? "",
    bodyMode: partial?.bodyMode ?? "raw",
    auth: partial?.auth ?? emptyAuth(),
    updatedAt: partial?.updatedAt ?? Date.now(),
  };
}

export function normalizeDraft(value: unknown): RequestDraft | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RequestDraft>;
  if (!item.id || !item.url) return null;
  return createDraft({
    ...item,
    kind: (item.kind as RequestKind | undefined) ?? "http",
    auth: item.auth ?? emptyAuth(),
    bodyMode: item.bodyMode ?? "raw",
    params: item.params ?? [emptyKeyValue()],
    headers: item.headers ?? [emptyKeyValue()],
  });
}

export function draftFromKind(kind: RequestKind): RequestDraft {
  if (kind === "sse") {
    return createDraft({
      kind: "sse",
      name: "SSE stream",
      method: "GET",
      url: "http://localhost:8080/events",
      headers: [
        emptyKeyValue({ key: "Accept", value: "text/event-stream" }),
      ],
      bodyMode: "none",
    });
  }

  if (kind === "websocket") {
    return createDraft({
      kind: "websocket",
      name: "WebSocket",
      method: "GET",
      url: "ws://localhost:8080/ws",
      headers: [emptyKeyValue()],
      bodyMode: "none",
    });
  }

  return createDraft({ kind: "http" });
}
