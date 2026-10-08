# Reqyx

Minimal API testing platform — Next.js workspace + Chrome extension for local request execution and DevTools.

## Architecture

- `apps/web` — request builder, auth, synced history, response viewer
- `apps/extension` — MV3 service worker fetch (any host/port, including localhost) + popup + DevTools panel
- `apps/mock` — Hono mock API on `:8080` for HTTP / SSE / WebSocket / auth testing
- `packages/core` — shared types, protocol, execute helper
- `packages/ui` — design tokens and UI primitives

Stack: Better Auth + PostgreSQL + Drizzle, tRPC + TanStack Query.

Flow: web UI → `postMessage` → content script → background `fetch` → result back to UI.

Local URLs (`http://localhost:PORT`, `127.0.0.1`, `*.localhost`) always go through the extension so you can hit any local port without CORS. Other URLs use the extension when connected, otherwise browser `fetch`.

## Setup

```sh
cp .env.example apps/web/.env
docker compose up -d
pnpm install
pnpm --filter web db:push
```

## Develop

```sh
pnpm --filter web dev
pnpm --filter extension dev
pnpm --filter mock dev
```

Mock API defaults to `http://localhost:8080` (matches workspace `{{baseUrl}}`). `GET /` lists routes.

## Auth & routing

- Sign up / sign in at `/signup` and `/login` (required — no guest mode)
- Workspace lives at `/r/[id]`; `/` redirects to `/r/new`
- History, collections, environments, and settings sync through protected tRPC (no localStorage)
- Sidebar toggles: auto-save history, save request body, save status codes

## Load the extension

1. Build: `pnpm --filter extension build`
2. Chrome → `chrome://extensions` → Developer mode
3. Load unpacked → select `apps/extension/dist` (or click **Reload** if already loaded)
4. Click the Reqyx toolbar icon — popup should show Connect/Disconnect plus HTTP/SSE/WebSocket shortcuts
5. Open `http://localhost:3000` — sign in, then badge should read **Extension** when connected
6. DevTools → **Reqyx** panel for the embedded workspace

### Workspace features

- HTTP requests with params, headers, body modes, auth (Bearer / Basic / API key)
- SSE stream testing and WebSocket connections
- Environments with `{{variable}}` substitution
- Collections, history sync, cURL / Fetch code generation
- Extension connect/disconnect from popup, DevTools panel, or workspace header

## Scripts

```sh
pnpm dev
pnpm build
pnpm check-types
pnpm --filter web db:push
pnpm --filter web db:studio
pnpm --filter mock dev
```

### Mock API (`apps/mock`)

| Route | Purpose |
|-------|---------|
| `GET /health` | Health check |
| `ANY /echo` | Echo method, headers, query, body |
| `GET /json` | Sample nested JSON |
| `GET /status/:code` | Forced status (100–599) |
| `GET /delay/:ms` | Artificial latency (max 30s) |
| `GET /auth/bearer` | Bearer `reqyx-token` |
| `GET /auth/basic` | Basic `reqyx:reqyx` |
| `GET /auth/api-key` | Header `X-Api-Key: reqyx-secret` |
| `CRUD /users` | In-memory users collection |
| `GET /events` | SSE stream |
| `WS /ws` (or `WS /`) | WebSocket echo + ticks — use `ws://localhost:8080/ws` |
