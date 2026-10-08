import {
  BRIDGE_SOURCE,
  createId,
  executeRequest,
  isBridgeMessage,
  parseSseChunk,
  type BridgeExecuteResult,
  type BridgePong,
  type BridgeSseEnd,
  type BridgeSseEvent,
  type BridgeStatus,
  type BridgeWsMessage,
  type KeyValue,
} from "@repo/core";

const CONNECTED_KEY = "reqyx.connected";
const sseControllers = new Map<string, AbortController>();
const sockets = new Map<string, WebSocket>();

async function getConnected(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONNECTED_KEY);
  return stored[CONNECTED_KEY] !== false;
}

async function setConnected(connected: boolean): Promise<boolean> {
  await chrome.storage.local.set({ [CONNECTED_KEY]: connected });
  return connected;
}

function enabledHeaders(headers: KeyValue[]): Headers {
  const out = new Headers();
  for (const header of headers) {
    if (!header.enabled) continue;
    const key = header.key.trim();
    if (!key) continue;
    out.set(key, header.value);
  }
  if (!out.has("Accept")) out.set("Accept", "text/event-stream");
  return out;
}

function replyToTab(
  tabId: number | undefined,
  message: object,
  sendResponse: (response: unknown) => void,
) {
  sendResponse(message);
  if (typeof tabId === "number") {
    void chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ [CONNECTED_KEY]: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isBridgeMessage(message)) return false;
  const tabId = sender.tab?.id;

  if (message.type === "PING") {
    void getConnected().then((connected) => {
      const pong: BridgePong = {
        source: BRIDGE_SOURCE,
        type: "PONG",
        version: chrome.runtime.getManifest().version,
        connected,
      };
      sendResponse(pong);
    });
    return true;
  }

  if (message.type === "SET_CONNECTED") {
    void setConnected(message.connected).then((connected) => {
      const status: BridgeStatus = {
        source: BRIDGE_SOURCE,
        type: "STATUS",
        version: chrome.runtime.getManifest().version,
        connected,
      };
      sendResponse(status);
    });
    return true;
  }

  if (message.type === "EXECUTE") {
    void getConnected().then(async (connected) => {
      if (!connected) {
        const response: BridgeExecuteResult = {
          source: BRIDGE_SOURCE,
          type: "EXECUTE_RESULT",
          id: message.id,
          result: {
            ok: false,
            error: "Reqyx extension is disconnected",
            timeMs: 0,
          },
        };
        sendResponse(response);
        return;
      }

      const result = await executeRequest(message.payload);
      const response: BridgeExecuteResult = {
        source: BRIDGE_SOURCE,
        type: "EXECUTE_RESULT",
        id: message.id,
        result,
      };
      sendResponse(response);
    });
    return true;
  }

  if (message.type === "SSE_START") {
    void getConnected().then(async (connected) => {
      if (!connected) {
        const end: BridgeSseEnd = {
          source: BRIDGE_SOURCE,
          type: "SSE_END",
          id: message.id,
          error: "Extension disconnected",
        };
        replyToTab(tabId, end, sendResponse);
        return;
      }

      sseControllers.get(message.id)?.abort();
      const controller = new AbortController();
      sseControllers.set(message.id, controller);
      sendResponse({ ok: true });

      try {
        const response = await fetch(message.url, {
          method: "GET",
          headers: enabledHeaders(message.headers),
          signal: controller.signal,
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
            const payload: BridgeSseEvent = {
              source: BRIDGE_SOURCE,
              type: "SSE_EVENT",
              id: message.id,
              event,
            };
            if (typeof tabId === "number") {
              void chrome.tabs.sendMessage(tabId, payload).catch(() => undefined);
            }
          }
        }

        const end: BridgeSseEnd = {
          source: BRIDGE_SOURCE,
          type: "SSE_END",
          id: message.id,
        };
        if (typeof tabId === "number") {
          void chrome.tabs.sendMessage(tabId, end).catch(() => undefined);
        }
      } catch (error) {
        const end: BridgeSseEnd = {
          source: BRIDGE_SOURCE,
          type: "SSE_END",
          id: message.id,
          error:
            error instanceof Error
              ? error.name === "AbortError"
                ? undefined
                : error.message
              : "SSE failed",
        };
        if (typeof tabId === "number") {
          void chrome.tabs.sendMessage(tabId, end).catch(() => undefined);
        }
      } finally {
        sseControllers.delete(message.id);
      }
    });
    return true;
  }

  if (message.type === "SSE_STOP") {
    sseControllers.get(message.id)?.abort();
    sseControllers.delete(message.id);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "WS_CONNECT") {
    void getConnected().then((connected) => {
      if (!connected) {
        const payload: BridgeWsMessage = {
          source: BRIDGE_SOURCE,
          type: "WS_MESSAGE",
          id: message.id,
          message: {
            id: createId(),
            direction: "system",
            data: "Extension disconnected",
            at: Date.now(),
          },
        };
        replyToTab(tabId, payload, sendResponse);
        return;
      }

      sockets.get(message.id)?.close();
      try {
        const socket = new WebSocket(message.url);
        sockets.set(message.id, socket);
        sendResponse({ ok: true });

        socket.addEventListener("open", () => {
          const payload: BridgeWsMessage = {
            source: BRIDGE_SOURCE,
            type: "WS_MESSAGE",
            id: message.id,
            message: {
              id: createId(),
              direction: "system",
              data: "Connected",
              at: Date.now(),
            },
          };
          if (typeof tabId === "number") {
            void chrome.tabs.sendMessage(tabId, payload).catch(() => undefined);
          }
        });

        socket.addEventListener("message", (event) => {
          const payload: BridgeWsMessage = {
            source: BRIDGE_SOURCE,
            type: "WS_MESSAGE",
            id: message.id,
            message: {
              id: createId(),
              direction: "in",
              data: String(event.data),
              at: Date.now(),
            },
          };
          if (typeof tabId === "number") {
            void chrome.tabs.sendMessage(tabId, payload).catch(() => undefined);
          }
        });

        socket.addEventListener("close", () => {
          sockets.delete(message.id);
          const payload: BridgeWsMessage = {
            source: BRIDGE_SOURCE,
            type: "WS_MESSAGE",
            id: message.id,
            message: {
              id: createId(),
              direction: "system",
              data: "Disconnected",
              at: Date.now(),
            },
          };
          if (typeof tabId === "number") {
            void chrome.tabs.sendMessage(tabId, payload).catch(() => undefined);
          }
        });

        socket.addEventListener("error", () => {
          const payload: BridgeWsMessage = {
            source: BRIDGE_SOURCE,
            type: "WS_MESSAGE",
            id: message.id,
            message: {
              id: createId(),
              direction: "system",
              data: "WebSocket error",
              at: Date.now(),
            },
          };
          if (typeof tabId === "number") {
            void chrome.tabs.sendMessage(tabId, payload).catch(() => undefined);
          }
        });
      } catch (error) {
        const payload: BridgeWsMessage = {
          source: BRIDGE_SOURCE,
          type: "WS_MESSAGE",
          id: message.id,
          message: {
            id: createId(),
            direction: "system",
            data: error instanceof Error ? error.message : "WebSocket failed",
            at: Date.now(),
          },
        };
        replyToTab(tabId, payload, sendResponse);
      }
    });
    return true;
  }

  if (message.type === "WS_SEND") {
    const socket = sockets.get(message.id);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message.data);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }

  if (message.type === "WS_CLOSE") {
    sockets.get(message.id)?.close();
    sockets.delete(message.id);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
