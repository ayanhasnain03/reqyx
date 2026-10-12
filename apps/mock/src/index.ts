import { serve, upgradeWebSocket } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const API_KEY = process.env.MOCK_API_KEY ?? "reqyx-secret";
const BEARER = process.env.MOCK_BEARER ?? "reqyx-token";
const BASIC_USER = process.env.MOCK_BASIC_USER ?? "reqyx";
const BASIC_PASS = process.env.MOCK_BASIC_PASS ?? "reqyx";
const ACCESS_TOKEN_TTL_SEC = Number(process.env.MOCK_ACCESS_TTL ?? 900);
const REFRESH_TOKEN_TTL_SEC = Number(process.env.MOCK_REFRESH_TTL ?? 60 * 60 * 24 * 7);
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allowHeaders: ["*"],
    exposeHeaders: ["X-Request-Id", "X-Echo-Method", "Set-Cookie"],
  }),
);

app.use("*", async (c, next) => {
  c.header("X-Request-Id", crypto.randomUUID());
  await next();
});

function headersObject(c: { req: { raw: Request } }) {
  const out: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function readBody(c: {
  req: { raw: Request; header: (name: string) => string | undefined };
}) {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.raw.clone().json();
    } catch {
      return null;
    }
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await c.req.raw.clone().formData();
      const data: Record<string, string> = {};
      form.forEach((value, key) => {
        data[key] = typeof value === "string" ? value : value.name;
      });
      return data;
    } catch {
      return null;
    }
  }
  try {
    return await c.req.raw.clone().text();
  } catch {
    return null;
  }
}

app.get("/health", (c) =>
  c.json({ ok: true, uptime: process.uptime(), now: new Date().toISOString() }),
);

app.all("/echo", async (c) => {
  const body = ["GET", "HEAD"].includes(c.req.method) ? null : await readBody(c);
  c.header("X-Echo-Method", c.req.method);
  return c.json({
    method: c.req.method,
    url: c.req.url,
    path: c.req.path,
    query: c.req.query(),
    headers: headersObject(c),
    body,
  });
});

app.get("/json", (c) =>
  c.json({
    message: "hello from mock",
    nested: { a: 1, b: [true, false], c: null },
    at: Date.now(),
  }),
);

app.get("/status/:code", (c) => {
  const code = Number(c.req.param("code"));
  if (!Number.isInteger(code) || code < 100 || code > 599) {
    return c.json({ error: "code must be 100-599" }, 400);
  }
  return c.json({ status: code, ok: code >= 200 && code < 300 }, code as 200);
});

app.get("/delay/:ms", async (c) => {
  const ms = Math.min(Math.max(Number(c.req.param("ms")) || 0, 0), 30_000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  return c.json({ delayedMs: ms });
});

app.get("/headers", (c) => c.json({ headers: headersObject(c) }));

app.get("/cookies/set", (c) => {
  const name = c.req.query("name") || "reqyx_session";
  const value = c.req.query("value") || crypto.randomUUID();
  const maxAge = Number(c.req.query("maxAge") ?? 3600);
  setCookie(c, name, value, {
    path: "/",
    httpOnly: true,
    maxAge: Number.isFinite(maxAge) ? maxAge : 3600,
  });
  return c.json({ ok: true, name, value });
});

app.get("/cookies/echo", (c) => {
  const cookie = c.req.header("cookie") ?? "";
  return c.json({ cookie });
});

app.get("/query", (c) => c.json({ query: c.req.query() }));

app.get("/auth/bearer", (c) => {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || match[1] !== BEARER) {
    return c.json({ error: "Unauthorized", hint: `Bearer ${BEARER}` }, 401);
  }
  return c.json({ ok: true, auth: "bearer", subject: "reqyx-user" });
});

app.get("/auth/basic", (c) => {
  const header = c.req.header("authorization") ?? "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) {
    c.header("WWW-Authenticate", 'Basic realm="reqyx-mock"');
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const decoded = Buffer.from(match[1]!, "base64").toString("utf8");
    const [user, pass] = decoded.split(":");
    if (user !== BASIC_USER || pass !== BASIC_PASS) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
    return c.json({ ok: true, auth: "basic", user });
  } catch {
    return c.json({ error: "Invalid basic auth" }, 401);
  }
});

app.get("/auth/api-key", (c) => {
  const key =
    c.req.header("x-api-key") ??
    c.req.header("api-key") ??
    c.req.query("api_key");
  if (key !== API_KEY) {
    return c.json({ error: "Unauthorized", hint: `X-Api-Key: ${API_KEY}` }, 401);
  }
  return c.json({ ok: true, auth: "api-key" });
});

type AuthAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
};

type AuthSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
};

type PublicProfile = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

const authAccounts = new Map<string, AuthAccount>();
const authSessionsByAccess = new Map<string, AuthSession>();
const authSessionsByRefresh = new Map<string, AuthSession>();

function seedDemoAccount() {
  const demo: AuthAccount = {
    id: "demo-user",
    name: "Demo User",
    email: "demo@reqyx.dev",
    password: "password123",
    createdAt: new Date().toISOString(),
  };
  authAccounts.set(demo.email.toLowerCase(), demo);
}
seedDemoAccount();

function publicProfile(account: AuthAccount): PublicProfile {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    createdAt: account.createdAt,
  };
}

function findAccountByEmail(email: string) {
  return authAccounts.get(email.trim().toLowerCase()) ?? null;
}

function findAccountById(id: string) {
  for (const account of authAccounts.values()) {
    if (account.id === id) return account;
  }
  return null;
}

function revokeSession(session: AuthSession) {
  authSessionsByAccess.delete(session.accessToken);
  authSessionsByRefresh.delete(session.refreshToken);
}

function issueSession(userId: string): AuthSession {
  const now = Date.now();
  const session: AuthSession = {
    userId,
    accessToken: `atk_${crypto.randomUUID().replace(/-/g, "")}`,
    refreshToken: `rtk_${crypto.randomUUID().replace(/-/g, "")}`,
    accessExpiresAt: now + ACCESS_TOKEN_TTL_SEC * 1000,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_SEC * 1000,
  };
  authSessionsByAccess.set(session.accessToken, session);
  authSessionsByRefresh.set(session.refreshToken, session);
  return session;
}

function setAuthCookies(c: Context, session: AuthSession) {
  setCookie(c, ACCESS_COOKIE, session.accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });
  setCookie(c, REFRESH_COOKIE, session.refreshToken, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });
}

function clearAuthCookies(c: Context) {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/" });
}

function authTokenResponse(account: AuthAccount, session: AuthSession) {
  return {
    user: publicProfile(account),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

function readBearerToken(c: Context) {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function resolveAccessSession(c: Context) {
  const token = readBearerToken(c) || getCookie(c, ACCESS_COOKIE) || null;
  if (!token) return { error: "Missing access token", status: 401 as const };

  const session = authSessionsByAccess.get(token);
  if (!session) return { error: "Invalid access token", status: 401 as const };
  if (session.accessExpiresAt <= Date.now()) {
    return { error: "Access token expired", status: 401 as const };
  }
  return { session, token };
}

function parseAuthBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  return {
    name: typeof data.name === "string" ? data.name.trim() : "",
    email: typeof data.email === "string" ? data.email.trim() : "",
    password: typeof data.password === "string" ? data.password : "",
    refreshToken:
      typeof data.refreshToken === "string" ? data.refreshToken.trim() : "",
  };
}

app.post("/auth/signup", async (c) => {
  const body = parseAuthBody(await c.req.json().catch(() => null));
  if (!body?.name || !body.email || !body.password) {
    return c.json(
      { error: "name, email, and password are required" },
      400,
    );
  }
  if (body.password.length < 6) {
    return c.json({ error: "password must be at least 6 characters" }, 400);
  }
  if (findAccountByEmail(body.email)) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const account: AuthAccount = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
    password: body.password,
    createdAt: new Date().toISOString(),
  };
  authAccounts.set(account.email.toLowerCase(), account);

  const session = issueSession(account.id);
  setAuthCookies(c, session);
  return c.json(authTokenResponse(account, session), 201);
});

async function handleSignIn(c: Context) {
  const body = parseAuthBody(await c.req.json().catch(() => null));
  if (!body?.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const account = findAccountByEmail(body.email);
  if (!account || account.password !== body.password) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const session = issueSession(account.id);
  setAuthCookies(c, session);
  return c.json(authTokenResponse(account, session));
}

app.post("/auth/signin", (c) => handleSignIn(c));
app.post("/auth/login", (c) => handleSignIn(c));

app.post("/auth/refresh", async (c) => {
  const body = parseAuthBody(await c.req.json().catch(() => null));
  const refreshToken =
    body?.refreshToken || getCookie(c, REFRESH_COOKIE) || null;
  if (!refreshToken) {
    return c.json({ error: "Missing refresh token" }, 401);
  }

  const existing = authSessionsByRefresh.get(refreshToken);
  if (!existing) {
    return c.json({ error: "Invalid refresh token" }, 401);
  }
  if (existing.refreshExpiresAt <= Date.now()) {
    revokeSession(existing);
    clearAuthCookies(c);
    return c.json({ error: "Refresh token expired" }, 401);
  }

  const account = findAccountById(existing.userId);
  if (!account) {
    revokeSession(existing);
    clearAuthCookies(c);
    return c.json({ error: "User not found" }, 401);
  }

  revokeSession(existing);
  const session = issueSession(account.id);
  setAuthCookies(c, session);
  return c.json(authTokenResponse(account, session));
});

function handleProfile(c: Context) {
  const resolved = resolveAccessSession(c);
  if ("error" in resolved) {
    return c.json(
      {
        error: resolved.error,
        hint: "Send Authorization: Bearer <accessToken> or access_token cookie",
      },
      resolved.status,
    );
  }

  const account = findAccountById(resolved.session.userId);
  if (!account) {
    return c.json({ error: "User not found" }, 401);
  }

  return c.json({
    user: publicProfile(account),
    auth: {
      tokenType: "Bearer",
      expiresAt: new Date(resolved.session.accessExpiresAt).toISOString(),
    },
  });
}

app.get("/auth/profile", (c) => handleProfile(c));
app.get("/auth/me", (c) => handleProfile(c));

app.post("/auth/logout", (c) => {
  const access = readBearerToken(c) || getCookie(c, ACCESS_COOKIE) || null;
  const refresh = getCookie(c, REFRESH_COOKIE) || null;

  const session =
    (access ? authSessionsByAccess.get(access) : undefined) ??
    (refresh ? authSessionsByRefresh.get(refresh) : undefined);
  if (session) revokeSession(session);

  clearAuthCookies(c);
  return c.json({ ok: true });
});

type User = { id: string; name: string; email: string; createdAt: string };

const users = new Map<string, User>([
  [
    "1",
    {
      id: "1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "2",
    {
      id: "2",
      name: "Grace Hopper",
      email: "grace@example.com",
      createdAt: new Date().toISOString(),
    },
  ],
]);

app.get("/users", (c) => c.json({ users: [...users.values()] }));

app.post("/users", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    email?: string;
  } | null;
  if (!body?.name || !body?.email) {
    return c.json({ error: "name and email required" }, 400);
  }
  const user: User = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  return c.json(user, 201);
});

app.get("/users/:id", (c) => {
  const user = users.get(c.req.param("id"));
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json(user);
});

app.put("/users/:id", async (c) => {
  const id = c.req.param("id");
  const existing = users.get(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    email?: string;
  } | null;
  if (!body?.name || !body?.email) {
    return c.json({ error: "name and email required" }, 400);
  }
  const user: User = {
    ...existing,
    name: body.name,
    email: body.email,
  };
  users.set(id, user);
  return c.json(user);
});

app.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const existing = users.get(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
  };
  const user: User = {
    ...existing,
    name: body.name ?? existing.name,
    email: body.email ?? existing.email,
  };
  users.set(id, user);
  return c.json(user);
});

app.delete("/users/:id", (c) => {
  const id = c.req.param("id");
  if (!users.has(id)) return c.json({ error: "Not found" }, 404);
  users.delete(id);
  return c.json({ ok: true, id });
});

app.get("/events", (c) =>
  streamSSE(c, async (stream) => {
    let i = 0;
    while (i < 20) {
      i += 1;
      await stream.writeSSE({
        event: i % 3 === 0 ? "ping" : "message",
        data: JSON.stringify({
          n: i,
          at: new Date().toISOString(),
          text: `event ${i}`,
        }),
        id: String(i),
      });
      await stream.sleep(500);
    }
    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ ok: true }),
      id: "done",
    });
  }),
);

function createMockSocketHandlers() {
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    onOpen(_event: unknown, ws: { send: (data: string) => void }) {
      ws.send(JSON.stringify({ type: "system", data: "Connected" }));
      timer = setInterval(() => {
        ws.send(
          JSON.stringify({
            type: "tick",
            at: new Date().toISOString(),
          }),
        );
      }, 3000);
    },
    onMessage(
      event: { data: unknown },
      ws: { send: (data: string) => void },
    ) {
      const raw =
        typeof event.data === "string" ? event.data : String(event.data);
      if (raw === "ping") {
        ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
        return;
      }
      ws.send(
        JSON.stringify({
          type: "echo",
          data: raw,
          at: Date.now(),
        }),
      );
    },
    onClose() {
      if (timer) clearInterval(timer);
    },
  };
}


app.get("/ws", upgradeWebSocket(() => createMockSocketHandlers()));
app.get(
  "/",
  async (c, next) => {
    if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
      return next();
    }
    return c.json({
      name: "Reqyx mock API",
      port: PORT,
      docs: {
        health: "GET /health",
        echo: "ANY /echo",
        json: "GET /json",
        status: "GET /status/:code",
        delay: "GET /delay/:ms",
        headers: "GET /headers",
        query: "GET /query",
        authBearer: "GET /auth/bearer  Authorization: Bearer reqyx-token",
        authBasic: "GET /auth/basic  Authorization: Basic base64(reqyx:reqyx)",
        authApiKey: "GET /auth/api-key  X-Api-Key: reqyx-secret",
        signup: "POST /auth/signup  { name, email, password }",
        signin: "POST /auth/signin|/auth/login  { email, password }",
        refresh: "POST /auth/refresh  { refreshToken? } or refresh_token cookie",
        profile: "GET /auth/profile|/auth/me  Bearer accessToken or access_token cookie",
        logout: "POST /auth/logout",
        demoUser: "demo@reqyx.dev / password123",
        users: "GET|POST /users  GET|PUT|PATCH|DELETE /users/:id",
        sse: "GET /events",
        websocket: "WS /ws  (also WS /)",
      },
    });
  },
  upgradeWebSocket(() => createMockSocketHandlers()),
);

app.notFound((c) =>
  c.json(
    { error: "Not found", path: c.req.path, hint: "GET / for route list" },
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

const wss = new WebSocketServer({ noServer: true });

serve(
  {
    fetch: app.fetch,
    port: PORT,
    websocket: { server: wss },
  },
  (info) => {
    console.log(`Reqyx mock API  http://localhost:${info.port}`);
    console.log(`  health        GET  /health`);
    console.log(`  echo          ANY  /echo`);
    console.log(`  users         CRUD /users`);
    console.log(`  sse           GET  /events`);
    console.log(`  websocket     WS   /ws`);
    console.log(`  auth bearer   ${BEARER}`);
    console.log(`  auth basic    ${BASIC_USER}:${BASIC_PASS}`);
    console.log(`  auth api-key  ${API_KEY}`);
    console.log(`  auth signup   POST /auth/signup`);
    console.log(`  auth signin   POST /auth/signin`);
    console.log(`  auth profile  GET  /auth/profile`);
    console.log(`  demo user     demo@reqyx.dev / password123`);
  },
);
