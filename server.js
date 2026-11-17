// Random Chess server: serves the game page and runs online games over WebSockets.
// Start with:  npm install  &&  npm start      (port: PORT env var, default 1828)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 1828;
const DATA_FILE = path.join(__dirname, "games.json");
const GAME_TTL_MS = 14 * 24 * 60 * 60 * 1000; // forget games idle for 14 days

// ---------- games: code -> { state, players: { w, b }, updated } ----------
let games = new Map();
try {
  games = new Map(Object.entries(JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))));
  console.log(`Loaded ${games.size} saved game(s).`);
} catch (e) { /* no saved games yet */ }

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const now = Date.now();
    for (const [code, g] of games) if (now - g.updated > GAME_TTL_MS) games.delete(code);
    saveNow();
  }, 1000);
}

// write to a temp file, then rename, so a crash mid-write can't corrupt games.json
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(Object.fromEntries(games)));
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (err) { console.error("Could not save games:", err.message); }
}

// save pending changes when pm2 / Ctrl+C stops the server
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { if (saveTimer) saveNow(); process.exit(0); });
}

function newCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let code;
  do {
    code = Array.from(crypto.randomBytes(8), b => alphabet[b % alphabet.length]).join("");
  } while (games.has(code));
  return code;
}

// ---------- checking what clients send (same rules file the page uses) ----------
const Game = require("./public/shared.js");
const ID_RE = /^[a-z0-9]{8,40}$/;
const CODE_RE = /^[a-z0-9]{6,16}$/;
const validState = Game.valid;
const isFreshStart = Game.isFreshStart;

// ---------- HTTP: serve the page ----------
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/shared.js": ["shared.js", "text/javascript; charset=utf-8"],
  "/i18n.js": ["i18n.js", "text/javascript; charset=utf-8"],
};
const server = http.createServer((req, res) => {
  const file = STATIC[req.url.split("?")[0]];
  if (req.method === "GET" && file) {
    fs.readFile(path.join(__dirname, "public", file[0]), (err, body) => {
      if (err) { res.writeHead(500); return res.end(file[0] + " missing"); }
      res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-cache" });
      res.end(body);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

// ---------- WebSockets: online games ----------
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function socketsIn(code) {
  return [...wss.clients].filter(c => c.gameCode === code);
}

function broadcastPeers(code) {
  const here = socketsIn(code);
  const msg = { type: "peers", w: here.some(c => c.role === "w"), b: here.some(c => c.role === "b") };
  here.forEach(c => send(c, msg));
}

function attach(ws, code, role) {
  const old = ws.gameCode;
  ws.gameCode = code;
  ws.role = role;
  if (old && old !== code) broadcastPeers(old);
  send(ws, { type: "joined", code, role, state: games.get(code).state });
  broadcastPeers(code);
}

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== "object") return;

    if (m.type === "create") {
      if (!ID_RE.test(m.playerId || "") || !validState(m.state) || !isFreshStart(m.state)) return send(ws, { type: "error", message: "Couldn't create the game." });
      const code = newCode();
      games.set(code, { state: m.state, players: { w: m.playerId, b: null }, updated: Date.now() });
      scheduleSave();
      attach(ws, code, "w");

    } else if (m.type === "join") {
      if (!CODE_RE.test(m.code || "") || !ID_RE.test(m.playerId || "")) return;
      const g = games.get(m.code);
      if (!g) return send(ws, { type: "error", message: "This game doesn't exist anymore.", fatal: true });
      let role;
      if (g.players.w === m.playerId) role = "w";
      else if (g.players.b === m.playerId) role = "b";
      else if (!g.players.b) { g.players.b = m.playerId; role = "b"; scheduleSave(); }
      else role = "spectator";
      attach(ws, m.code, role);

    } else if (m.type === "state") {
      const g = games.get(ws.gameCode);
      if (!g || (ws.role !== "w" && ws.role !== "b")) return;
      const cur = g.state, next = m.state;
      const ok = validState(next) && next.seq === cur.seq + 1 &&
        (m.restart ? isFreshStart(next) : (cur.turn === ws.role && !cur.over));
      if (!ok) {
        // out of sync or not your turn: send the real state back
        return send(ws, { type: "state", state: cur, force: true });
      }
      g.state = next;
      g.updated = Date.now();
      scheduleSave();
      socketsIn(ws.gameCode).forEach(c => { if (c !== ws) send(c, { type: "state", state: next }); });
    }
  });

  ws.on("close", () => { if (ws.gameCode) broadcastPeers(ws.gameCode); });
});

// drop dead connections so "opponent connected" stays accurate
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Random Chess running on http://localhost:${PORT}`));
