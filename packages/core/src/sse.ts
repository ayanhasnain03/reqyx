import { createId } from "./format";
import type { KeyValue, SseEvent } from "./types";

function enabledHeaders(headers: KeyValue[]): Headers {
  const out = new Headers();
  for (const header of headers) {
    if (!header.enabled) continue;
    const key = header.key.trim();
    if (!key) continue;
    out.set(key, header.value);
  }
  if (!out.has("Accept")) {
    out.set("Accept", "text/event-stream");
  }
  return out;
}

export function parseSseChunk(
  buffer: string,
): { events: SseEvent[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? "";
  const events: SseEvent[] = [];

  for (const part of parts) {
    if (!part.trim() || part.startsWith(":")) continue;
    let event = "message";
    let data = "";
    const lines = part.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        data += (data ? "\n" : "") + line.slice(5).trimStart();
      }
    }
    events.push({
      id: createId(),
      event,
      data,
      raw: part,
      at: Date.now(),
    });
  }

  return { events, rest };
}

export async function streamSse(
  url: string,
  headers: KeyValue[],
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<{ status: number; statusText: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers: enabledHeaders(headers),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      response.ok
        ? "SSE response had no body"
        : `SSE failed: ${response.status} ${response.statusText}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      onEvent(event);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseChunk(`${buffer}\n\n`);
    for (const event of parsed.events) {
      onEvent(event);
    }
  }

  return { status: response.status, statusText: response.statusText };
}
