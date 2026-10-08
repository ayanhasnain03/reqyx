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

export type Transport = "extension" | "browser" | "proxy";

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
  const formRows =
    draft.bodyMode === "urlencoded" || draft.bodyMode === "formdata"
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

function looksLikeCorsOrNetworkFailure(result: HttpResult): boolean {
  if (result.ok) return false;
  const message = result.error.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed") ||
    message.includes("cors")
  );
}

async function executeViaProxy(
  payload: ExecutePayload,
  signal?: AbortSignal,
): Promise<HttpResult | null> {
  try {
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
      credentials: "include",
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text || `Proxy failed (${response.status})`;
      try {
        const json = JSON.parse(text) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        /* keep text */
      }
      return { ok: false, error: message, timeMs: 0 };
    }

    return (await response.json()) as HttpResult;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Request aborted", timeMs: 0 };
    }
    return null;
  }
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

  const browserResult = await executeRequest(payload, signal);
  if (browserResult.ok || !local || !looksLikeCorsOrNetworkFailure(browserResult)) {
    return { result: browserResult, transport: "browser" };
  }

  const proxyResult = await executeViaProxy(payload, signal);
  if (proxyResult) {
    return { result: proxyResult, transport: "proxy" };
  }

  if (!extension.installed) {
    return {
      result: {
        ok: false,
        error:
          browserResult.ok === false
            ? `${browserResult.error}. For localhost APIs without CORS, install the Reqyx extension (apps/extension/dist) or keep the Next.js server on the same machine.`
            : "Localhost request failed. Install the Reqyx extension or use the server proxy.",
        timeMs: browserResult.ok === false ? browserResult.timeMs : 0,
      },
      transport: "browser",
    };
  }

  if (!extension.connected) {
    return {
      result: {
        ok: false,
        error:
          "Could not reach localhost. Connect the Reqyx extension from the header, then try again.",
        timeMs: 0,
      },
      transport: "browser",
    };
  }

  return { result: browserResult, transport: "browser" };
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
  if (preferred === "extension") {
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
