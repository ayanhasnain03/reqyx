const CONNECTED_KEY = "reqyx.connected";

const statusDot = document.querySelector<HTMLElement>("#panel-dot");
const statusLabel = document.querySelector<HTMLElement>("#panel-label");
const toggleButton = document.querySelector<HTMLButtonElement>("#panel-toggle");
const versionLabel = document.querySelector<HTMLElement>("#panel-version");
const banner = document.querySelector<HTMLElement>("#banner");
const frame = document.querySelector<HTMLIFrameElement>("#workspace");

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

function openKind(kind: string) {
  const url = new URL("http://localhost:3000/r/new");
  if (kind !== "http") url.searchParams.set("kind", kind);
  if (frame) frame.src = url.toString();
}

async function init() {
  render(await getConnected());

  if (versionLabel) {
    versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  toggleButton?.addEventListener("click", async () => {
    const next = !(await getConnected());
    await chrome.storage.local.set({ [CONNECTED_KEY]: next });
    render(next);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      openKind(button.dataset.kind ?? "http");
    });
  });

  frame?.addEventListener("load", () => {
    if (banner) banner.dataset.show = "false";
  });

  window.setTimeout(() => {
    if (banner && frame) {
      try {
        void fetch("http://localhost:3000", { mode: "no-cors" }).then(
          () => {
            banner.dataset.show = "false";
          },
          () => {
            banner.dataset.show = "true";
            banner.textContent =
              "Start the web app (pnpm --filter web dev) to load the workspace.";
          },
        );
      } catch {
        banner.dataset.show = "true";
      }
    }
  }, 1200);
}

void init();
