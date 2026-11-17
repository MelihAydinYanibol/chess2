// Random Chess server: serves the game page and runs online games over WebSockets.
// Start with:  npm install  &&  npm start      (port: PORT env var, default 1828)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 1828;
const INDEX = path.join(__dirname, "public", "index.html");
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

// ---------- checking what clients send ----------
const TYPES = ["pawn", "rook", "knight", "bishop", "queen", "king"];
const PIECE_RE = /^[wb]_(king|queen|rook2?|bishop2?|knight2?|paw[1-8])$/;
const ID_RE = /^[a-z0-9]{8,40}$/;
const CODE_RE = /^[a-z0-9]{6,16}$/;

function validState(s) {
  const isPos = v => Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 8);
  const isPiece = p => typeof p === "string" && PIECE_RE.test(p);
  const isType = t => TYPES.includes(t);
  try {
    if (!s || typeof s !== "object" || !Number.isInteger(s.seq)) return false;
    if (s.turn !== "w" && s.turn !== "b") return false;
    if (!s.board || typeof s.board !== "object") return false;
    const seen = new Set();
    for (const p in s.board) {
      if (!isPiece(p) || !isPos(s.board[p])) return false;
      const k = s.board[p].join(",");
      if (seen.has(k)) return false;
      seen.add(k);
    }
    for (const col of ["w", "b"]) {
      const ko = s.kingOptions && s.kingOptions[col];
      if (!Array.isArray(ko) || !ko.every(isType) || !ko.includes("king")) return false;
      const cap = s.captured && s.captured[col];
      if (!Array.isArray(cap) || !cap.every(isPiece)) return false;
    }
    if (!s.deadRolls || typeof s.deadRolls !== "object") return false;
    for (const p in s.deadRolls) if (!isPiece(p) || !isType(s.deadRolls[p])) return false;
    // games saved before promotions existed
    if (s.rollLists === undefined) s.rollLists = { w: TYPES.slice(), b: TYPES.slice() };
    if (s.promoted === undefined) s.promoted = [];
    if (s.pendingPromo === undefined) s.pendingPromo = null;
    for (const col of ["w", "b"]) {
      const rl = s.rollLists && s.rollLists[col];
      if (!Array.isArray(rl) || rl.length > 40 || !rl.every(isType) || !TYPES.every(t => rl.includes(t))) return false;
    }
    if (!Array.isArray(s.promoted) || !s.promoted.every(isPiece)) return false;
    if (s.pendingPromo !== null && (!s.pendingPromo || !isPiece(s.pendingPromo.piece))) return false;
    if (s.locked !== null) {
      const l = s.locked;
      if (!l || !isPiece(l.piece) || !s.board[l.piece] || !isType(l.roll)) return false;
      if (!Array.isArray(l.moves) || !l.moves.every(isPos)) return false;
    }
    if (s.lastRoll !== null && (!s.lastRoll || !isPiece(s.lastRoll.piece) || !isType(s.lastRoll.roll))) return false;
    if (s.over !== null && (!s.over || typeof s.over.title !== "string" || typeof s.over.text !== "string")) return false;
    if (s.note !== null && typeof s.note !== "string") return false;
    if (!Array.isArray(s.log) || s.log.length > 50 || !s.log.every(x => typeof x === "string" && x.length < 300)) return false;
    return true;
  } catch (e) { return false; }
}

// A restart must be a real new game, not an arbitrary position.
const START_BOARD = (() => {
  const b = {};
  const back = ["rook", "knight", "bishop", "queen", "king", "bishop2", "knight2", "rook2"];
  back.forEach((n, c) => { b["b_" + n] = [0, c]; b["w_" + n] = [7, c]; });
  for (let c = 0; c < 8; c++) { b["b_paw" + (c + 1)] = [1, c]; b["w_paw" + (c + 1)] = [6, c]; }
  return b;
})();
function isFreshStart(s) {
  const keys = Object.keys(s.board);
  return keys.length === 32 &&
    keys.every(p => START_BOARD[p] && START_BOARD[p].join() === s.board[p].join()) &&
    s.turn === "w" && s.over === null && s.locked === null && s.pendingPromo === null &&
    Object.keys(s.deadRolls).length === 0 && s.promoted.length === 0 &&
    ["w", "b"].every(c => s.kingOptions[c].length === 6 && new Set(s.kingOptions[c]).size === 6 &&
      s.rollLists[c].length === 6 && new Set(s.rollLists[c]).size === 6 && s.captured[c].length === 0);
}

// ---------- HTTP: serve the page ----------
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    fs.readFile(INDEX, (err, html) => {
      if (err) { res.writeHead(500); return res.end("index.html missing"); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(html);
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
      if (!ID_RE.test(m.playerId || "") || !validState(m.state)) return send(ws, { type: "error", message: "Couldn't create the game." });
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
