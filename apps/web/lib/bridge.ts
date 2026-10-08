import {
  BRIDGE_SOURCE,
  createId,
  isBridgeMessage,
  type BridgeExecute,
  type BridgePing,
  type BridgePong,
  type BridgeSetConnected,
  type BridgeSseStart,
  type BridgeSseStop,
  type BridgeStatus,
  type BridgeWsClose,
  type BridgeWsConnect,
  type BridgeWsSend,
  type ExecutePayload,
  type HttpResult,
  type KeyValue,
  type SseEvent,
  type WsMessage,
} from "@repo/core";

const PING_TIMEOUT_MS = 250;
const EXECUTE_TIMEOUT_MS = 60_000;

export type ExtensionState = {
  installed: boolean;
  connected: boolean;
  version: string | null;
};

function onceMessage<T>(
  match: (data: unknown) => data is T,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (!match(event.data)) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(event.data);
    }

    window.addEventListener("message", onMessage);
  });
}

export async function detectExtension(): Promise<ExtensionState> {
  if (typeof window === "undefined") {
    return { installed: false, connected: false, version: null };
  }

  const ping: BridgePing = { source: BRIDGE_SOURCE, type: "PING" };
  const wait = onceMessage(
    (data): data is BridgePong =>
      isBridgeMessage(data) && data.type === "PONG",
    PING_TIMEOUT_MS,
  );
  window.postMessage(ping, window.location.origin);
  const pong = await wait;

  if (!pong) {
    return { installed: false, connected: false, version: null };
  }

  return {
    installed: true,
    connected: pong.connected,
    version: pong.version,
  };
}

export async function setExtensionConnected(
  connected: boolean,
): Promise<ExtensionState> {
  if (typeof window === "undefined") {
    return { installed: false, connected: false, version: null };
  }

  const message: BridgeSetConnected = {
    source: BRIDGE_SOURCE,
    type: "SET_CONNECTED",
    connected,
  };

  const wait = onceMessage(
    (data): data is BridgeStatus =>
      isBridgeMessage(data) && data.type === "STATUS",
    PING_TIMEOUT_MS,
  );
  window.postMessage(message, window.location.origin);
  const status = await wait;

  if (!status) {
    return { installed: false, connected: false, version: null };
  }

  return {
    installed: true,
    connected: status.connected,
    version: status.version,
  };
}

export async function executeViaExtension(
  payload: ExecutePayload,
): Promise<HttpResult | null> {
  if (typeof window === "undefined") return null;

  const id = createId();
  const message: BridgeExecute = {
    source: BRIDGE_SOURCE,
    type: "EXECUTE",
    id,
    payload,
  };

  const wait = onceMessage(
    (data): data is { type: "EXECUTE_RESULT"; id: string; result: HttpResult } =>
      isBridgeMessage(data) &&
      data.type === "EXECUTE_RESULT" &&
      data.id === id,
    EXECUTE_TIMEOUT_MS,
  );

  window.postMessage(message, window.location.origin);
  const response = await wait;
  return response?.result ?? null;
}

export function startSseViaExtension(
  url: string,
  headers: KeyValue[],
  onEvent: (event: SseEvent) => void,
  onEnd: (error?: string) => void,
): { id: string; stop: () => void } {
  const id = createId();

  function onMessage(event: MessageEvent) {
    if (event.source !== window) return;
    if (!isBridgeMessage(event.data)) return;
    if (event.data.type === "SSE_EVENT" && event.data.id === id) {
      onEvent(event.data.event);
    }
    if (event.data.type === "SSE_END" && event.data.id === id) {
      window.removeEventListener("message", onMessage);
      onEnd(event.data.error);
    }
  }

  window.addEventListener("message", onMessage);
  const message: BridgeSseStart = {
    source: BRIDGE_SOURCE,
    type: "SSE_START",
    id,
    url,
    headers,
  };
  window.postMessage(message, window.location.origin);

  return {
    id,
    stop: () => {
      window.removeEventListener("message", onMessage);
      const stop: BridgeSseStop = {
        source: BRIDGE_SOURCE,
        type: "SSE_STOP",
        id,
      };
      window.postMessage(stop, window.location.origin);
    },
  };
}

export function connectWsViaExtension(
  url: string,
  onMessage: (message: WsMessage) => void,
): { id: string; send: (data: string) => void; close: () => void } {
  const id = createId();

  function handle(event: MessageEvent) {
    if (event.source !== window) return;
    if (!isBridgeMessage(event.data)) return;
    if (event.data.type === "WS_MESSAGE" && event.data.id === id) {
      onMessage(event.data.message);
    }
  }

  window.addEventListener("message", handle);
  const connect: BridgeWsConnect = {
    source: BRIDGE_SOURCE,
    type: "WS_CONNECT",
    id,
    url,
  };
  window.postMessage(connect, window.location.origin);

  return {
    id,
    send: (data: string) => {
      const message: BridgeWsSend = {
        source: BRIDGE_SOURCE,
        type: "WS_SEND",
        id,
        data,
      };
      window.postMessage(message, window.location.origin);
    },
    close: () => {
      window.removeEventListener("message", handle);
      const message: BridgeWsClose = {
        source: BRIDGE_SOURCE,
        type: "WS_CLOSE",
        id,
      };
      window.postMessage(message, window.location.origin);
    },
  };
}
