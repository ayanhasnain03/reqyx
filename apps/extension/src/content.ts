window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const data = event.data as {
    source?: string;
    type?: string;
  } | null;

  if (!data || data.source !== "reqyx") return;

  const allowed = new Set([
    "PING",
    "EXECUTE",
    "SET_CONNECTED",
    "SSE_START",
    "SSE_STOP",
    "WS_CONNECT",
    "WS_SEND",
    "WS_CLOSE",
  ]);

  if (!data.type || !allowed.has(data.type)) return;

  void chrome.runtime.sendMessage(data).then((response) => {
    if (!response) return;
    window.postMessage(response, window.location.origin);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.source !== "reqyx") return;
  window.postMessage(message, window.location.origin);
});
