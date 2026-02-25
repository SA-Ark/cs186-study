/**
 * CS 186 Study Assistant — Lightweight proxy server
 * Serves static files + proxies /api/chat to Anthropic using OAuth credentials.
 * No external dependencies — uses Node.js built-in modules only.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const STATIC_DIR = path.join(__dirname, "public");
const MODEL = process.env.COCKPIT_MODEL || "claude-opus-4-6";

// OAuth config (same as plan-cockpit)
const REFRESH_URL = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const REFRESH_MARGIN_MS = 300_000; // 5 minutes
const OAUTH_SYSTEM_PREFIX =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const OAUTH_BETA_HEADER =
  "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14";

const CS186_CONTEXT = `<system-context>
You are a CS 186 (Database Systems) study assistant for UC Berkeley Spring 2026 Midterm 1.
You ONLY answer questions about topics covered in Midterm 1:
- SQL (SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, Joins, Subqueries, CTEs, Views)
- Disks, Files & Records (HDD/SSD, pages, heap files, sorted files, slotted pages, record layout)
- IO Cost Analysis (heap vs sorted file costs, B = pages, R = records/page)
- B+ Trees (structure, search, insert with splits, delete, bulk loading, fan-out)
- B+ Tree Advanced (clustered vs unclustered, composite indexes, prefix rule, IO costs)
- Spatial Indexes (KD Trees, R-Trees, MBRs, nearest neighbor search)
- Buffer Management (buffer pool, frames, dirty bit, pin count, LRU, MRU, Clock policy)

NOT on this midterm: Sorting/Hashing, Relational Algebra, Join Algorithms, Query Optimization.

Be concise but thorough. Use examples when helpful. For B+ tree operations, show the tree state step by step.
If asked about topics not on this midterm, say so and redirect to relevant topics.
</system-context>`;

let _cachedToken = null;
let _cachedExpiresAt = 0;

function getCredPath() {
  return (
    process.env.CLAUDE_CREDENTIALS_PATH ||
    path.join(process.env.HOME || "/root", ".claude", ".credentials.json")
  );
}

function loadCredentials() {
  const data = JSON.parse(fs.readFileSync(getCredPath(), "utf-8"));
  return data.claudeAiOauth;
}

function saveCredentials(creds) {
  const credPath = getCredPath();
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  data.claudeAiOauth = creds;
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2));
}

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: "POST",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function refreshToken(refreshTok) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshTok,
  }).toString();

  const res = await httpsPost(REFRESH_URL, {
    "Content-Type": "application/x-www-form-urlencoded",
  }, body);

  if (res.status !== 200) {
    throw new Error(`Token refresh failed: ${res.status} ${res.body}`);
  }

  const data = JSON.parse(res.body);
  const creds = loadCredentials();
  creds.accessToken = data.access_token || data.accessToken;
  creds.refreshToken = data.refresh_token || data.refreshToken || refreshTok;
  creds.expiresAt = data.expires_in
    ? Date.now() + data.expires_in * 1000
    : data.expiresAt || Date.now() + 28800_000;

  saveCredentials(creds);
  return creds;
}

async function getAccessToken() {
  const now = Date.now();

  if (_cachedToken && now < _cachedExpiresAt - REFRESH_MARGIN_MS) {
    return _cachedToken;
  }

  const creds = loadCredentials();
  const expiresAt = creds.expiresAt || 0;
  const accessToken = creds.accessToken || "";

  if (now < expiresAt - REFRESH_MARGIN_MS && accessToken) {
    _cachedToken = accessToken;
    _cachedExpiresAt = expiresAt;
    return accessToken;
  }

  const refreshTok = creds.refreshToken || "";
  if (!refreshTok) throw new Error("No refresh token in credentials");

  const newCreds = await refreshToken(refreshTok);
  _cachedToken = newCreds.accessToken;
  _cachedExpiresAt = newCreds.expiresAt;
  return _cachedToken;
}

// MIME types for static file serving
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

function serveStatic(req, res) {
  let filePath = path.join(STATIC_DIR, req.url === "/" ? "index.html" : req.url);

  // SPA fallback: if file doesn't exist and no extension, serve index.html
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(STATIC_DIR, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=3600",
  });
  res.end(content);
}

async function handleChat(req, res) {
  // Read request body
  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const messages = parsed.messages || [];
  if (!messages.length) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No messages" }));
    return;
  }

  // Inject CS186 context into first user message (OAuth requires fixed system prompt)
  const injected = [...messages];
  for (let i = 0; i < injected.length; i++) {
    if (injected[i].role === "user") {
      const orig = injected[i].content;
      injected[i] = {
        role: "user",
        content: [
          { type: "text", text: CS186_CONTEXT, cache_control: { type: "ephemeral" } },
          { type: "text", text: typeof orig === "string" ? orig : JSON.stringify(orig) },
        ],
      };
      break;
    }
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Auth failed: " + err.message }));
    return;
  }

  const apiBody = JSON.stringify({
    model: MODEL,
    max_tokens: 2048,
    system: OAUTH_SYSTEM_PREFIX,
    messages: injected.slice(-20),
    stream: true,
  });

  // Stream proxy to Anthropic
  const apiReq = https.request(
    {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": OAUTH_BETA_HEADER,
      },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode, {
        "Content-Type": apiRes.headers["content-type"] || "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      apiRes.pipe(res);
    }
  );

  apiReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Proxy error: " + err.message }));
  });

  apiReq.write(apiBody);
  apiReq.end();
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      await handleChat(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Health check
  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`CS186 Study Assistant running on :${PORT}`);
});
