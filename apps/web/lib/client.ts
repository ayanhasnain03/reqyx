import {
  applyAuth,
  buildRequestBody,
  buildUrl,
  executeRequest,
  isLocalHostUrl,
  resolveVariables,
  streamSse,
  withContentType,
  type ExecutePayload,
  type HttpResult,
  type KeyValue,
  type RequestDraft,
  type SseEvent,
  type WsMessage,
} from "@repo/core";
import { createId } from "@repo/core";
import {
  connectWsViaExtension,
  detectExtension,
  executeViaExtension,
  startSseViaExtension,
  type ExtensionState,
} from "./bridge";

export type Transport = "extension" | "browser";

export type TransportInfo = {
  transport: Transport;
  extension: ExtensionState;
};

export async function resolveTransport(): Promise<TransportInfo> {
  const extension = await detectExtension();
  return {
    transport:
      extension.installed && extension.connected ? "extension" : "browser",
    extension,
  };
}

export function buildExecutePayload(
  draft: RequestDraft,
  variables: KeyValue[],
): ExecutePayload {
  const resolvedUrl = resolveVariables(draft.url, variables);
  const resolvedParams = draft.params.map((row) => ({
    ...row,
    key: resolveVariables(row.key, variables),
    value: resolveVariables(row.value, variables),
  }));
  const resolvedHeaders = draft.headers.map((row) => ({
    ...row,
    key: resolveVariables(row.key, variables),
    value: resolveVariables(row.value, variables),
  }));
  const resolvedAuth = {
    ...draft.auth,
    token: resolveVariables(draft.auth.token, variables),
    username: resolveVariables(draft.auth.username, variables),
    password: resolveVariables(draft.auth.password, variables),
    key: resolveVariables(draft.auth.key, variables),
    value: resolveVariables(draft.auth.value, variables),
  };

  const authed = applyAuth(resolvedAuth, resolvedHeaders, resolvedParams);
  const formRows = draft.bodyMode === "urlencoded" || draft.bodyMode === "formdata"
    ? resolvedParams
    : [];
  const built = buildRequestBody(
    draft.bodyMode,
    resolveVariables(draft.body, variables),
    formRows,
  );
  const headers = withContentType(authed.headers, built.contentType);

  return {
    method: draft.method,
    url: buildUrl(resolvedUrl, authed.params),
    headers,
    body: built.body,
  };
}

export async function sendRequest(
  payload: ExecutePayload,
  preferred: Transport,
  signal?: AbortSignal,
): Promise<{ result: HttpResult; transport: Transport }> {
  const local = isLocalHostUrl(payload.url);
  const extension = await detectExtension();
  const wantExtension =
    (preferred === "extension" || local) &&
    extension.installed &&
    extension.connected;

  if (wantExtension) {
    const viaExtension = await executeViaExtension(payload);
    if (viaExtension) {
      return { result: viaExtension, transport: "extension" };
    }
  }

  if (local) {
    if (!extension.installed) {
      return {
        result: {
          ok: false,
          error:
            "Localhost requests need the Reqyx extension. Load apps/extension/dist in chrome://extensions, then reload this page.",
          timeMs: 0,
        },
        transport: "browser",
      };
    }

    if (!extension.connected) {
      return {
        result: {
          ok: false,
          error:
            "Extension is disconnected. Connect it from the header or the extension popup, then try again.",
          timeMs: 0,
        },
        transport: "browser",
      };
    }
  }

  return {
    result: await executeRequest(payload, signal),
    transport: "browser",
  };
}

export async function startSseSession(
  payload: ExecutePayload,
  preferred: Transport,
  onEvent: (event: SseEvent) => void,
  onEnd: (error?: string) => void,
): Promise<{ stop: () => void; transport: Transport }> {
  const extension = await detectExtension();
  const local = isLocalHostUrl(payload.url);
  const useExtension =
    (preferred === "extension" || local) &&
    extension.installed &&
    extension.connected;

  if (useExtension) {
    const handle = startSseViaExtension(
      payload.url,
      payload.headers,
      onEvent,
      onEnd,
    );
    return { stop: handle.stop, transport: "extension" };
  }

  const controller = new AbortController();
  void streamSse(payload.url, payload.headers, onEvent, controller.signal)
    .then(() => onEnd())
    .catch((error: unknown) => {
      onEnd(error instanceof Error ? error.message : "SSE failed");
    });

  return {
    stop: () => controller.abort(),
    transport: "browser",
  };
}

export function startWsSession(
  url: string,
  preferred: Transport,
  onMessage: (message: WsMessage) => void,
): { send: (data: string) => void; close: () => void; transport: Transport } {
  const local = url.startsWith("ws://localhost") || url.startsWith("ws://127.0.0.1");

  if (preferred === "extension" || local) {
    const handle = connectWsViaExtension(url, onMessage);
    return {
      send: handle.send,
      close: handle.close,
      transport: "extension",
    };
  }

  const socket = new WebSocket(url);
  socket.addEventListener("open", () => {
    onMessage({
      id: createId(),
      direction: "system",
      data: "Connected",
      at: Date.now(),
    });
  });
  socket.addEventListener("message", (event) => {
    onMessage({
      id: createId(),
      direction: "in",
      data: String(event.data),
      at: Date.now(),
    });
  });
  socket.addEventListener("close", () => {
    onMessage({
      id: createId(),
      direction: "system",
      data: "Disconnected",
      at: Date.now(),
    });
  });
  socket.addEventListener("error", () => {
    onMessage({
      id: createId(),
      direction: "system",
      data: "WebSocket error",
      at: Date.now(),
    });
  });

  return {
    transport: "browser",
    send: (data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
        onMessage({
          id: createId(),
          direction: "out",
          data,
          at: Date.now(),
        });
      }
    },
    close: () => socket.close(),
  };
}
