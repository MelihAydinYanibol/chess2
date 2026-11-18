// Random Chess server: serves the page, runs online games (the server holds the real game and rolls the dice),
// keeps players, points and the leaderboard, sends invites, and stores game records for replay links.
// Start with:  npm install  &&  npm start      (port: PORT env var, default 1828)

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const Game = require("./public/shared.js");

const PORT = Number(process.env.PORT) || 1828;
const DATA_FILE = path.join(__dirname, "data.json.gz");
const OLD_GAMES_FILE = path.join(__dirname, "games.json");
const REPLAY_DIR = path.join(__dirname, "replays");
const GAME_TTL_MS = 14 * 24 * 60 * 60 * 1000;  // forget games idle for 14 days
const POINTS = { win: 3, draw: 1, loss: 0 };

fs.mkdirSync(REPLAY_DIR, { recursive: true });

// ---------- saved data ----------
// games:   code -> { state, seats: { w, b } (player ids), invited, public, started, rated, replayId, record, updated }
// players: pid  -> { name, points, w, d, l, created }
let games = new Map(), players = new Map();
try {
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(DATA_FILE)));
  games = new Map(Object.entries(data.games || {}));
  players = new Map(Object.entries(data.players || {}));
  console.log(`Loaded ${games.size} game(s) and ${players.size} player(s).`);
} catch (e) {
  // games saved by the older version (each browser kept the game; players were identified by a secret id)
  try {
    const old = JSON.parse(fs.readFileSync(OLD_GAMES_FILE, "utf8"));
    for (const [code, g] of Object.entries(old)) {
      const st = Game.migrate(g.state);
      games.set(code, {
        state: st, seats: { w: g.players.w ? pidOf(g.players.w) : null, b: g.players.b ? pidOf(g.players.b) : null },
        invited: null, public: false, started: !!g.players.b, rated: true, replayId: null, record: Game.newRecord(st), updated: g.updated,
      });
    }
    console.log(`Moved ${games.size} game(s) from games.json.`);
  } catch (e2) { /* nothing saved yet */ }
}

let saveTimer = null;
function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 1500);
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const now = Date.now();
  for (const [code, g] of games) if (now - g.updated > GAME_TTL_MS) games.delete(code);
  try {
    const body = zlib.gzipSync(JSON.stringify({ games: Object.fromEntries(games), players: Object.fromEntries(players) }));
    fs.writeFileSync(DATA_FILE + ".tmp", body);
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (err) { console.error("Could not save:", err.message); }
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (saveTimer) saveNow(); process.exit(0); });

// ---------- helpers ----------
function pidOf(secret) { return crypto.createHash("sha256").update("rc:" + secret).digest("hex").slice(0, 16); }
function randomCode(n, taken) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let code;
  do code = Array.from(crypto.randomBytes(n), b => alphabet[b % alphabet.length]).join("");
  while (taken && taken(code));
  return code;
}
const SECRET_RE = /^[a-z0-9]{16,40}$/;
const CODE_RE = /^[a-z0-9]{6,16}$/;
const NAME_RE = /^[\p{L}\p{N} _.\-]{2,20}$/u;
const nameOf = pid => (pid && players.get(pid) && players.get(pid).name) || "";
function cleanName(n) { return typeof n === "string" ? n.trim().replace(/\s+/g, " ") : ""; }
function nameTaken(name, exceptPid) {
  const low = name.toLowerCase();
  for (const [pid, p] of players) if (pid !== exceptPid && p.name.toLowerCase() === low) return true;
  return false;
}
function publicPlayer(pid) {
  const p = players.get(pid);
  return p ? { pid, name: p.name, points: p.points, w: p.w, d: p.d, l: p.l } : null;
}

// ---------- replays ----------
const REPLAY_RE = /^[a-z0-9]{10}$/;
function saveReplay(record) {
  const id = randomCode(10, c => fs.existsSync(path.join(REPLAY_DIR, c + ".json.gz")));
  const { lastN, ...rec } = record;
  fs.writeFileSync(path.join(REPLAY_DIR, id + ".json.gz"), zlib.gzipSync(JSON.stringify(rec)));
  return id;
}
// loose checks for a record uploaded from a game played in the browser (local or against the computer)
function validRecord(r) {
  if (!r || typeof r !== "object" || !Array.isArray(r.frames) || !Array.isArray(r.log)) return false;
  if (r.frames.length < 1 || r.frames.length > 2500 || r.log.length > 20000) return false;
  const isPos = v => Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 8);
  return r.frames.every(f => f && f.board && typeof f.board === "object" && Object.keys(f.board).length <= 64 &&
      Object.entries(f.board).every(([p, pos]) => Game.PIECE_RE.test(p) && isPos(pos)) && Number.isInteger(f.L)) &&
    r.log.every(e => e && typeof e.k === "string" && Array.isArray(e.a));
}

// ---------- HTTP ----------
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/shared.js": ["shared.js", "text/javascript; charset=utf-8"],
  "/i18n.js": ["i18n.js", "text/javascript; charset=utf-8"],
  "/sound.js": ["sound.js", "text/javascript; charset=utf-8"],
  "/rulebook.js": ["rulebook.js", "text/javascript; charset=utf-8"],
};
function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const file = STATIC[url];
  if (req.method === "GET" && file) {
    fs.readFile(path.join(__dirname, "public", file[0]), (err, body) => {
      if (err) { res.writeHead(500); return res.end(file[0] + " missing"); }
      res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-cache" });
      res.end(body);
    });
    return;
  }
  const rm = url.match(/^\/api\/replay\/([a-z0-9]+)$/);
  if (req.method === "GET" && rm && REPLAY_RE.test(rm[1])) {
    fs.readFile(path.join(REPLAY_DIR, rm[1] + ".json.gz"), (err, gz) => {
      if (err) return sendJson(res, 404, { error: "not found" });
      const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" };
      if (/\bgzip\b/.test(req.headers["accept-encoding"] || "")) { headers["Content-Encoding"] = "gzip"; res.writeHead(200, headers); res.end(gz); }
      else { res.writeHead(200, headers); res.end(zlib.gunzipSync(gz)); }
    });
    return;
  }
  if (req.method === "POST" && url === "/api/replays") {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > 4 * 1024 * 1024) { sendJson(res, 413, { error: "too big" }); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      let rec;
      try { rec = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return sendJson(res, 400, { error: "bad json" }); }
      if (!validRecord(rec)) return sendJson(res, 400, { error: "bad record" });
      rec.names = { w: String((rec.names && rec.names.w) || "").slice(0, 20), b: String((rec.names && rec.names.b) || "").slice(0, 20) };
      sendJson(res, 200, { id: saveReplay(rec) });
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// ---------- WebSockets ----------
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
const clients = () => [...wss.clients];
const socketsOf = pid => clients().filter(c => c.pid === pid);
const socketsIn = code => clients().filter(c => c.gameCode === code);

function roleIn(g, pid) { return g.seats.w === pid ? "w" : g.seats.b === pid ? "b" : "spectator"; }
function sendGame(ws, code) {
  const g = games.get(code);
  if (!g) return;
  const role = roleIn(g, ws.pid);
  send(ws, {
    type: "state", code, role, now: Date.now(),
    state: Game.viewFor(g.state, role === "spectator" ? null : role),
    names: { w: nameOf(g.seats.w), b: nameOf(g.seats.b) },
    started: g.started, replayId: g.replayId || null, invited: nameOf(g.invited),
  });
}
function broadcastGame(code) {
  socketsIn(code).forEach(c => sendGame(c, code));
  scheduleLobby();
}

// lobby: who is online and which games are open, sent to everyone (debounced)
let lobbyTimer = null;
function scheduleLobby() { if (!lobbyTimer) lobbyTimer = setTimeout(sendLobby, 300); }
function sendLobby() {
  lobbyTimer = null;
  const online = new Map();
  for (const c of clients()) {
    if (!c.pid || !players.has(c.pid)) continue;
    const g = c.gameCode && games.get(c.gameCode);
    const playing = g && !g.state.over && roleIn(g, c.pid) !== "spectator";
    const prev = online.get(c.pid);
    online.set(c.pid, { ...publicPlayer(c.pid), playing: !!playing || (prev && prev.playing) });
  }
  const open = [];
  for (const [code, g] of games) {
    if (!g.public || g.invited || g.state.over) continue;
    const free = !g.seats.w ? "w" : !g.seats.b ? "b" : null;
    const host = g.seats.w || g.seats.b;
    if (!free || !host || !socketsOf(host).length) continue;   // only games whose creator is still here
    open.push({ code, host: nameOf(host), cfg: g.state.cfg });
  }
  const msg = { type: "lobby", players: [...online.values()].sort((a, b) => b.points - a.points), games: open.slice(0, 30) };
  clients().forEach(c => { if (c.pid) send(c, msg); });
}
function leaderboard() {
  return [...players.entries()].map(([pid]) => publicPlayer(pid))
    .filter(p => p.w + p.d + p.l > 0)
    .sort((a, b) => b.points - a.points || b.w - a.w || a.l - b.l).slice(0, 50);
}

function attach(ws, code) {
  const old = ws.gameCode;
  ws.gameCode = code;
  if (old && old !== code) broadcastGame(old);
  sendGame(ws, code);
  scheduleLobby();
}

function newGame(cfgIn, creatorPid, opts) {
  const cfg = Game.normCfg(cfgIn);
  const state = Game.freshState(0, cfg);
  const creatorSide = cfg.randomSides ? (Math.random() < .5 ? "w" : "b") : "w";
  const code = randomCode(8, c => games.has(c));
  const g = {
    state, seats: { w: null, b: null }, invited: opts.invited || null, public: !!opts.public && !opts.invited,
    started: false, rated: false, replayId: null, record: null, updated: Date.now(),
  };
  g.seats[creatorSide] = creatorPid;
  games.set(code, g);
  scheduleSave();
  return code;
}
function startIfReady(g) {
  if (g.started || !g.seats.w || !g.seats.b) return;
  g.started = true;
  g.state.turnStart = Date.now();
  g.record = Game.newRecord(g.state, { w: nameOf(g.seats.w), b: nameOf(g.seats.b) });
}

// game over: points for both players (once per game) and the record for the replay link
function finish(code) {
  const g = games.get(code);
  if (!g || !g.state.over || g.rated) return;
  g.rated = true;
  const win = g.state.over.w;
  for (const col of ["w", "b"]) {
    const p = players.get(g.seats[col]);
    if (!p) continue;
    if (!win) { p.d++; p.points += POINTS.draw; }
    else if (win === col) { p.w++; p.points += POINTS.win; }
    else { p.l++; p.points += POINTS.loss; }
  }
  if (g.record) {
    Game.recordStep(g.record, g.state);
    try { g.replayId = saveReplay(g.record); } catch (e) { console.error("Could not save replay:", e.message); }
    g.record = null;
  }
  scheduleSave();
  const lb = leaderboard();
  clients().forEach(c => {
    if (!c.pid) return;
    send(c, { type: "leaderboard", rows: lb });
    if (c.pid === g.seats.w || c.pid === g.seats.b) send(c, { type: "me", me: publicPlayer(c.pid) });
  });
}

function changed(code) {
  const g = games.get(code);
  g.updated = Date.now();
  if (g.record) Game.recordStep(g.record, g.state);
  if (g.state.over) finish(code);
  scheduleSave();
  broadcastGame(code);
}

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== "object") return;

    // --- who is this ---
    if (m.type === "hello") {
      if (!SECRET_RE.test(m.secret || "")) return;
      ws.pid = pidOf(m.secret);
      if (!players.has(ws.pid)) {
        const name = cleanName(m.name);
        if (NAME_RE.test(name) && !nameTaken(name)) {
          players.set(ws.pid, { name, points: 0, w: 0, d: 0, l: 0, created: Date.now() });
          scheduleSave();
        } else return send(ws, { type: "needName", taken: !!name && NAME_RE.test(name) });
      }
      send(ws, { type: "me", me: publicPlayer(ws.pid) });
      send(ws, { type: "leaderboard", rows: leaderboard() });
      scheduleLobby();
      return;
    }
    if (m.type === "setName") {
      if (!ws.pid) return;
      const name = cleanName(m.name);
      if (!NAME_RE.test(name)) return send(ws, { type: "nameError", key: "nameBad" });
      if (nameTaken(name, ws.pid)) return send(ws, { type: "nameError", key: "nameTaken" });
      const p = players.get(ws.pid);
      if (p) p.name = name;
      else players.set(ws.pid, { name, points: 0, w: 0, d: 0, l: 0, created: Date.now() });
      scheduleSave();
      socketsOf(ws.pid).forEach(c => send(c, { type: "me", me: publicPlayer(ws.pid) }));
      scheduleLobby();
      if (ws.gameCode) broadcastGame(ws.gameCode);
      return;
    }
    if (!ws.pid || !players.has(ws.pid)) return;

    if (m.type === "leaderboard") return send(ws, { type: "leaderboard", rows: leaderboard() });

    // --- games ---
    if (m.type === "create") {
      let invited = null;
      if (typeof m.invite === "string" && players.has(m.invite) && m.invite !== ws.pid) invited = m.invite;
      const code = newGame(m.cfg, ws.pid, { public: m.public !== false, invited });
      attach(ws, code);
      if (invited) sendInvite(code, ws.pid, invited);
    } else if (m.type === "invite") {
      // invite someone into the game you're waiting in
      const g = games.get(ws.gameCode);
      if (!g || roleIn(g, ws.pid) === "spectator" || g.started || !players.has(m.pid) || m.pid === ws.pid) return;
      g.invited = m.pid;
      g.public = false;
      sendInvite(ws.gameCode, ws.pid, m.pid);
      broadcastGame(ws.gameCode);
    } else if (m.type === "inviteReply") {
      const g = games.get(m.code);
      if (!g || g.invited !== ws.pid) return;
      if (!m.accept) {
        g.invited = null;
        const host = g.seats.w || g.seats.b;
        socketsOf(host).forEach(c => send(c, { type: "inviteDeclined", name: nameOf(ws.pid) }));
        broadcastGame(m.code);
        return;
      }
      join(ws, m.code);
    } else if (m.type === "join") {
      if (!CODE_RE.test(m.code || "")) return;
      if (!games.has(m.code)) return send(ws, { type: "error", key: "gameGone", fatal: true });
      join(ws, m.code);
    } else if (m.type === "leave") {
      const old = ws.gameCode;
      ws.gameCode = null;
      if (old) broadcastGame(old);
      scheduleLobby();
    } else if (m.type === "act") {
      const code = ws.gameCode, g = games.get(code);
      if (!g) return;
      const role = roleIn(g, ws.pid);
      if (role === "spectator") return send(ws, { type: "actError", key: "msgWatch" });
      if (!g.started && m.act && m.act.kind !== "resign") return send(ws, { type: "actError", key: "msgWaitOpp" });
      const res = Game.applyAction(g.state, role, m.act);
      if (!res.ok) return send(ws, { type: "actError", key: res.err });
      g.state.seq++;
      changed(code);
    } else if (m.type === "restart") {
      // only after the game has ended; sides are drawn again if random sides is on
      const g = games.get(ws.gameCode);
      if (!g || !g.state.over || roleIn(g, ws.pid) === "spectator") return;
      g.state = Game.freshState(g.state.seq + 1, g.state.cfg);
      if (g.state.cfg.randomSides && Math.random() < .5) g.seats = { w: g.seats.b, b: g.seats.w };
      g.rated = false; g.replayId = null; g.started = false;
      startIfReady(g);
      changed(ws.gameCode);
    }
  });

  ws.on("close", () => { if (ws.gameCode) broadcastGame(ws.gameCode); scheduleLobby(); });
});

function join(ws, code) {
  const g = games.get(code);
  if (roleIn(g, ws.pid) === "spectator" && !g.started) {
    const free = !g.seats.w ? "w" : !g.seats.b ? "b" : null;
    if (free && (!g.invited || g.invited === ws.pid)) {
      g.seats[free] = ws.pid;
      g.invited = null;
      startIfReady(g);
      scheduleSave();
    }
  }
  attach(ws, code);
  broadcastGame(code);
}
function sendInvite(code, fromPid, toPid) {
  const g = games.get(code);
  socketsOf(toPid).forEach(c => send(c, { type: "invite", code, from: nameOf(fromPid), cfg: g.state.cfg }));
}

// timers: the server ends turns and games when time runs out
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of games) {
    if (!g.started || g.state.over) continue;
    if (Game.tick(g.state, now)) { g.state.seq++; changed(code); }
  }
}, 500);

// drop dead connections so "opponent connected" and the lobby stay accurate
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Random Chess running on http://localhost:${PORT}`));
