/**
 * CS 186 Study Assistant — Proxy server with persistent chat storage
 * Serves static files + proxies /api/chat to Anthropic using OAuth credentials.
 * Multi-chat support with PostgreSQL persistence for cross-device access.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

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

// Load the full knowledge base at startup
const KB_PATH = path.join(__dirname, "public", "knowledge-base.md");
let KNOWLEDGE_BASE = "";
try {
  KNOWLEDGE_BASE = fs.readFileSync(KB_PATH, "utf-8");
  console.log(`Loaded knowledge base: ${(KNOWLEDGE_BASE.length / 1024).toFixed(1)}KB`);
} catch (err) {
  console.warn("Knowledge base not found, using abbreviated context");
}

// Abbreviated role context (injected with every first user message)
const CS186_ROLE = `<tutor-role>
You are a CS 186 (Database Systems) tutor for UC Berkeley Spring 2026 Midterm 1.
You have access to a comprehensive knowledge base (provided below) containing:
- All lecture content (Lectures 1-8), midterm scope, study guide, cheat sheets
- Past exam questions and solutions (Fall 2017, Spring 2018, Fall 2018) with detailed explanations
- Flashcard content (50 concept + 40 practice cards)
- Key formulas, IO cost tables, B+ tree algorithms, buffer management traces

EXAM INFO: Midterm 1 is Thu 2/26, 8-10 PM. One 8.5x11 double-sided handwritten cheat sheet allowed.
SCOPE: SQL, Disks/Files/Records, IO Cost Model, B+ Trees, Spatial Indexes, Buffer Management.
NOT IN SCOPE: Sorting/Hashing, Relational Algebra, Join Algorithms, Query Optimization.

STUDY MATERIALS: The student has a printable cheat sheet (what they can use in-exam), an extended reference (for deep learning), flashcards with spaced repetition, a study guide, a final review test (25 exam-style questions from the review session), and an exam day cheat sheet (condensed guide for what to handwrite).

BEHAVIOR:
- Be concise but thorough. Use examples when helpful.
- For B+ tree operations, show tree state step by step.
- For IO cost questions, show your work clearly.
- Reference past exam questions when relevant to illustrate exam patterns.
- If asked about out-of-scope topics, say so and redirect to relevant topics.
- When the student seems to struggle, break down the concept from fundamentals.
</tutor-role>`;

let _cachedToken = null;
let _cachedExpiresAt = 0;

function getCredPath() {
  return (
    process.env.CLAUDE_CREDENTIALS_PATH ||
    path.join(process.env.HOME || "/root", ".claude", ".credentials.json")
  );
}

/**
 * Credential management with PostgreSQL persistence.
 * Priority: DB (survives rebuilds) > file > env var (initial seed only).
 * Every token refresh saves to both DB and file.
 */
function bootstrapCredentials() {
  const credPath = getCredPath();
  if (fs.existsSync(credPath)) return;

  const refreshToken = process.env.OAUTH_REFRESH_TOKEN;
  if (!refreshToken) return;

  const dir = path.dirname(credPath);
  fs.mkdirSync(dir, { recursive: true });

  const data = {
    claudeAiOauth: {
      accessToken: "",
      refreshToken,
      expiresAt: 0,
    },
  };
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2));
  console.log("Bootstrapped credentials from OAUTH_REFRESH_TOKEN env var");
}

async function loadCredsFromDB() {
  if (!db) return null;
  try {
    const res = await db.query("SELECT value FROM settings WHERE key = 'oauth_creds' LIMIT 1");
    if (res.rows.length) return JSON.parse(res.rows[0].value);
  } catch { /* table may not exist yet */ }
  return null;
}

async function saveCredsToDB(creds) {
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO settings (key, value) VALUES ('oauth_creds', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(creds)]
    );
  } catch { /* non-fatal */ }
}

function loadCredentials() {
  const data = JSON.parse(fs.readFileSync(getCredPath(), "utf-8"));
  return data.claudeAiOauth;
}

function saveCredentials(creds) {
  // Save to file
  const credPath = getCredPath();
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  data.claudeAiOauth = creds;
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2));
  // Also persist to DB (fire-and-forget)
  saveCredsToDB(creds).catch(() => {});
}

async function restoreCredsFromDB() {
  const dbCreds = await loadCredsFromDB();
  if (!dbCreds || !dbCreds.refreshToken) return false;

  // Check if DB creds are newer/valid
  const credPath = getCredPath();
  const fileCreds = loadCredentials();
  if (dbCreds.expiresAt > (fileCreds.expiresAt || 0)) {
    const data = { claudeAiOauth: dbCreds };
    fs.writeFileSync(credPath, JSON.stringify(data, null, 2));
    console.log("Restored credentials from database (survives rebuilds)");
    return true;
  }
  return false;
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

// ——— PostgreSQL chat storage ———
const DATABASE_URL = process.env.DATABASE_URL || "";
let db = null;

async function initDB() {
  if (!DATABASE_URL) {
    console.warn("No DATABASE_URL — chat persistence disabled");
    return;
  }
  db = new Pool({ connectionString: DATABASE_URL, max: 5 });
  await db.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("Database connected and tables ready");
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseUrl(reqUrl) {
  return new URL(reqUrl, "http://localhost");
}

// ——— Chat CRUD handlers ———
async function handleListChats(req, res) {
  if (!db) return jsonResponse(res, 503, { error: "Database not available" });
  const result = await db.query(
    `SELECT c.id, c.title, c.updated_at,
            (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
     FROM chats c ORDER BY c.updated_at DESC`
  );
  jsonResponse(res, 200, { chats: result.rows });
}

async function handleCreateChat(req, res) {
  if (!db) return jsonResponse(res, 503, { error: "Database not available" });
  const body = JSON.parse(await readBody(req));
  const title = body.title || "New Chat";
  const result = await db.query(
    "INSERT INTO chats (title) VALUES ($1) RETURNING id, title, created_at, updated_at",
    [title]
  );
  jsonResponse(res, 201, result.rows[0]);
}

async function handleGetChat(req, res, chatId) {
  if (!db) return jsonResponse(res, 503, { error: "Database not available" });
  const chat = await db.query("SELECT * FROM chats WHERE id = $1", [chatId]);
  if (!chat.rows.length) return jsonResponse(res, 404, { error: "Chat not found" });
  const messages = await db.query(
    "SELECT id, role, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC",
    [chatId]
  );
  jsonResponse(res, 200, { chat: chat.rows[0], messages: messages.rows });
}

async function handleDeleteChat(req, res, chatId) {
  if (!db) return jsonResponse(res, 503, { error: "Database not available" });
  await db.query("DELETE FROM chats WHERE id = $1", [chatId]);
  jsonResponse(res, 200, { ok: true });
}

async function handleUpdateChat(req, res, chatId) {
  if (!db) return jsonResponse(res, 503, { error: "Database not available" });
  const body = JSON.parse(await readBody(req));
  if (body.title) {
    await db.query("UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2", [body.title, chatId]);
  }
  jsonResponse(res, 200, { ok: true });
}

async function saveMessage(chatId, role, content) {
  if (!db || !chatId) return;
  await db.query("INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)", [chatId, role, content]);
  await db.query("UPDATE chats SET updated_at = NOW() WHERE id = $1", [chatId]);
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
  ".md": "text/markdown",
};

function serveStatic(req, res) {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  let filePath = path.join(STATIC_DIR, urlPath === "/" ? "index.html" : urlPath);

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
  // Short cache for JS (cache-busted via ?v= query), longer for static assets
  const cacheControl = ext === ".js" ? "public, max-age=60" : "public, max-age=3600";
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": cacheControl,
  });
  res.end(content);
}

async function handleChat(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid JSON" });
  }

  const messages = parsed.messages || [];
  const chatId = parsed.chat_id || null;
  const userText = parsed.user_message || "";

  if (!messages.length) {
    return jsonResponse(res, 400, { error: "No messages" });
  }

  // Save user message to DB
  if (chatId && userText) {
    await saveMessage(chatId, "user", userText);
    // Auto-title on first message
    if (db) {
      const countRes = await db.query("SELECT COUNT(*) as c FROM messages WHERE chat_id = $1", [chatId]);
      if (parseInt(countRes.rows[0].c) === 1) {
        const title = userText.length > 60 ? userText.substring(0, 57) + "..." : userText;
        await db.query("UPDATE chats SET title = $1 WHERE id = $2", [title, chatId]);
      }
    }
  }

  // Inject knowledge base + role context into first user message
  const injected = [...messages];
  for (let i = 0; i < injected.length; i++) {
    if (injected[i].role === "user") {
      const orig = injected[i].content;
      const contentBlocks = [];

      if (KNOWLEDGE_BASE) {
        contentBlocks.push({
          type: "text",
          text: `<knowledge-base>\n${KNOWLEDGE_BASE}\n</knowledge-base>`,
          cache_control: { type: "ephemeral" },
        });
      }

      contentBlocks.push({
        type: "text",
        text: CS186_ROLE,
        cache_control: { type: "ephemeral" },
      });

      contentBlocks.push({
        type: "text",
        text: typeof orig === "string" ? orig : JSON.stringify(orig),
      });

      injected[i] = { role: "user", content: contentBlocks };
      break;
    }
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return jsonResponse(res, 500, { error: "Auth failed: " + err.message });
  }

  const apiBody = JSON.stringify({
    model: MODEL,
    max_tokens: 4096,
    system: OAUTH_SYSTEM_PREFIX,
    messages: injected.slice(-30),
    stream: true,
  });

  // Stream proxy to Anthropic — buffer response to save to DB
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

      let responseBuffer = "";

      apiRes.on("data", (chunk) => {
        res.write(chunk);
        responseBuffer += chunk.toString();
      });

      apiRes.on("end", () => {
        res.end();
        // Extract assistant text from SSE events and save to DB
        if (chatId && apiRes.statusCode === 200) {
          let fullText = "";
          const lines = responseBuffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content_block_delta" && data.delta && data.delta.text) {
                  fullText += data.delta.text;
                }
              } catch {}
            }
          }
          if (fullText) {
            saveMessage(chatId, "assistant", fullText).catch(() => {});
          }
        }
      });
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = parseUrl(req.url);
  const pathname = url.pathname;

  try {
    // Chat message proxy (existing)
    if (req.method === "POST" && pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    // Chat CRUD
    if (pathname === "/api/chats" && req.method === "GET") {
      await handleListChats(req, res);
      return;
    }
    if (pathname === "/api/chats" && req.method === "POST") {
      await handleCreateChat(req, res);
      return;
    }

    const chatMatch = pathname.match(/^\/api\/chats\/(\d+)$/);
    if (chatMatch) {
      const chatId = parseInt(chatMatch[1]);
      if (req.method === "GET") { await handleGetChat(req, res, chatId); return; }
      if (req.method === "PUT") { await handleUpdateChat(req, res, chatId); return; }
      if (req.method === "DELETE") { await handleDeleteChat(req, res, chatId); return; }
    }

    // Health check
    if (pathname === "/api/health") {
      jsonResponse(res, 200, { ok: true, db: !!db });
      return;
    }

    // Auth seed endpoint — separates token chains from CLI
    // POST /api/auth/seed { "refresh_token": "sk-ant-ort01-...", "secret": "<SEED_SECRET>" }
    if (req.method === "POST" && pathname === "/api/auth/seed") {
      const body = JSON.parse(await readBody(req));
      if (!body.refresh_token) return jsonResponse(res, 400, { error: "Missing refresh_token" });
      if (body.secret !== (process.env.SEED_SECRET || "cs186-seed-2026")) {
        return jsonResponse(res, 403, { error: "Invalid secret" });
      }
      try {
        // Refresh the provided token to get an INDEPENDENT pair for this app
        const newCreds = await refreshToken(body.refresh_token);
        _cachedToken = newCreds.accessToken;
        _cachedExpiresAt = newCreds.expiresAt;
        jsonResponse(res, 200, {
          ok: true,
          message: "Token chain separated. This app now has independent credentials.",
          expires_at: newCreds.expiresAt,
        });
      } catch (err) {
        jsonResponse(res, 500, { error: "Refresh failed: " + err.message });
      }
      return;
    }

    serveStatic(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: err.message }));
  }
});

// Bootstrap credentials from env vars if needed (for Docker/Coolify deployment)
bootstrapCredentials();

// Initialize database, restore credentials, then start server
initDB()
  .then(() => restoreCredsFromDB())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`CS186 Study Assistant running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed (continuing without persistence):", err.message);
    server.listen(PORT, () => {
      console.log(`CS186 Study Assistant running on :${PORT} (no DB)`);
    });
  });
