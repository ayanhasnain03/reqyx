const CONNECTED_KEY = "reqyx.connected";

const statusDot = document.querySelector<HTMLElement>("#status-dot");
const statusLabel = document.querySelector<HTMLElement>("#status-label");
const versionLabel = document.querySelector<HTMLElement>("#version");
const toggleButton = document.querySelector<HTMLButtonElement>("#toggle");
const openApp = document.querySelector<HTMLAnchorElement>("#open-app");

async function getConnected(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONNECTED_KEY);
  return stored[CONNECTED_KEY] !== false;
}

function render(connected: boolean) {
  if (!statusDot || !statusLabel || !toggleButton) return;
  statusDot.dataset.state = connected ? "connected" : "disconnected";
  statusLabel.textContent = connected ? "Connected" : "Disconnected";
  toggleButton.textContent = connected ? "Disconnect" : "Connect";
  toggleButton.dataset.mode = connected ? "disconnect" : "connect";
}

function openWorkspace(kind?: string) {
  const url = new URL("http://localhost:3000/r/new");
  if (kind && kind !== "http") url.searchParams.set("kind", kind);
  void chrome.tabs.create({ url: url.toString() });
}

async function init() {
  const connected = await getConnected();
  render(connected);

  if (versionLabel) {
    versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  if (openApp) {
    openApp.href = "http://localhost:3000/r/new";
  }

  toggleButton?.addEventListener("click", async () => {
    const next = !(await getConnected());
    await chrome.storage.local.set({ [CONNECTED_KEY]: next });
    render(next);
  });

  document.querySelector("#open-http")?.addEventListener("click", () => {
    openWorkspace("http");
  });
  document.querySelector("#open-sse")?.addEventListener("click", () => {
    openWorkspace("sse");
  });
  document.querySelector("#open-ws")?.addEventListener("click", () => {
    openWorkspace("websocket");
  });
  document.querySelector("#open-panel")?.addEventListener("click", () => {
    openWorkspace();
  });
}

void init();
