// Random Chess + cards: all game rules. Used by the page and by the server (for checking states).
// Every function works on a plain state object, so a game can be sent over the network as JSON.
(function (root) {
"use strict";

const TYPES = ["pawn", "rook", "knight", "bishop", "queen", "king"];
const PROMO_TYPES = ["rook", "knight", "bishop", "queen", "king"];
const FILES = "abcdefgh";
const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const BISHOP_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
const KNIGHT_JUMPS = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
const KING_STEPS = ROOK_DIRS.concat(BISHOP_DIRS);
// copies made by "Risen from the Dead" are named like w_queenx3
const PIECE_RE = /^[wb]_(king|(?:queen|rook|bishop|knight|paw)(?:\d{1,2}|x\d{1,4})?)$/;
const LOG_MAX = 40;

// ---------- card rules (from the rule book) ----------
// when: "any" (before the move, or after a capturing move), "pre" (before the move only),
//       "roll" (after rolling, before moving), "never" (works by itself)
// target: "square", "piece" (your own), "twoPieces" (two of your own), "type" (a move type)
const CARD_INFO = {
  barricade: { levels: 3, when: "any", target: "square" },
  abra:      { levels: 2, when: "any" },
  mine:      { levels: 1, when: "any", target: "square" },
  reborn:    { levels: 1, when: "any" },
  nomad:     { levels: 4, when: "any" },
  second:    { levels: 1, when: "roll" },
  double:    { levels: 1, when: "pre" },
  curse:     { levels: 1, when: "any" },
  shield:    { levels: 1, when: "any", target: "piece" },
  crown:     { levels: 1, when: "any", target: "type" },
  scope:     { levels: 1, when: "any", target: "square" },
  counter:   { levels: 1, when: "never" },
  thief:     { levels: 1, when: "any" },
  quake:     { levels: 1, when: "any" },
  teleport:  { levels: 1, when: "any", target: "piece" },
  swap:      { levels: 1, when: "any", target: "twoPieces" },
  mycall:    { levels: 1, when: "any", target: "type" },
  rewind:    { levels: 1, when: "pre" },
};
const CARD_KINDS = Object.keys(CARD_INFO);
const DURATION = { barricade: [1, 2, 3], abra: [2, 3], curse: 2, shield: 2 };   // in full turns
const NOMAD_GIVES = [2, 3, 4, 5];
const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
// Game settings chosen when a game is created
const DEFAULT_CFG = { cards: true, drawEvery: 3, startPoints: 0, pointCap: 39, turnTime: 0, suddenDeath: 40, clockSec: 60, randomSides: true };
const CFG_CHOICES = {
  drawEvery: [0, 2, 3, 4, 5],          // full turns between timed draws (0 = off)
  startPoints: [0, 5, 10, 20],
  pointCap: [20, 39, 60, 99],
  turnTime: [0, 30, 60, 120],          // seconds per turn (0 = no turn timer)
  suddenDeath: [20, 40, 60, 100],      // full turns before the sudden-death clock starts
  clockSec: [60, 120, 180],            // each player's clock once sudden death starts
};
function normCfg(c) {
  const out = { ...DEFAULT_CFG };
  if (!c || typeof c !== "object") return out;
  for (const k in CFG_CHOICES) if (CFG_CHOICES[k].includes(c[k])) out[k] = c[k];
  for (const k of ["cards", "randomSides"]) if (typeof c[k] === "boolean") out[k] = c[k];
  return out;
}
const HAND_MAX = 7;
const NOMAD_AT = [32, 80, 144, 224];   // squares travelled for Wanderer I, II, III and IV (+48, +64, +80)
const SHOP = [                      // [card, level, price]
  ["second", 1, 2], ["reborn", 1, 3], ["scope", 1, 3], ["teleport", 1, 3], ["barricade", 1, 4], ["double", 1, 4],
  ["mine", 1, 5], ["shield", 1, 5], ["quake", 1, 5], ["abra", 1, 6], ["curse", 1, 6], ["crown", 1, 6],
  ["barricade", 2, 7], ["thief", 1, 7], ["counter", 1, 8], ["abra", 2, 9], ["barricade", 3, 10],
];
const DECK = [                      // [card, level, weight %]
  ["second", 1, 8], ["barricade", 1, 8], ["reborn", 1, 7], ["mine", 1, 7], ["abra", 1, 7], ["scope", 1, 6],
  ["teleport", 1, 6], ["double", 1, 5], ["shield", 1, 5], ["barricade", 2, 5], ["nomad", 1, 4], ["quake", 1, 4],
  ["curse", 1, 4], ["crown", 1, 3], ["abra", 2, 3], ["swap", 1, 3], ["mycall", 1, 3], ["thief", 1, 3],
  ["counter", 1, 3], ["barricade", 3, 2], ["nomad", 2, 2], ["rewind", 1, 2],
];

// ---------- helpers ----------
const key = (r, c) => r + "," + c;
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = col => col === "w" ? "b" : "w";
const toSquare = ([r, c]) => FILES[c] + (8 - r);
const isKing = p => p.endsWith("_king");
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const samePos = (a, b) => a[0] === b[0] && a[1] === b[1];

function realType(p) {
  const name = p.slice(2).replace(/x?\d+$/, "");
  return name === "paw" ? "pawn" : name;
}
function squares(b) {
  const m = {};
  for (const p in b) m[key(...b[p])] = p;
  return m;
}
function optionsFor(p, s) { return isKing(p) ? s.kingOptions[p[0]] : s.rollLists[p[0]]; }
function addLog(s, k, a = [], o) {
  const e = { k, a, n: (s.log.length ? (s.log[s.log.length - 1].n || 0) : 0) + 1 };  // n: running number, for animations
  if (o) e.o = o;            // owner: only they see the details (cards they got, mines they placed)
  s.log.push(e);
  if (s.log.length > LOG_MAX) s.log = s.log.slice(-LOG_MAX);
}
function lockSet(s) { return new Set(s.locks.map(l => key(...l.sq))); }
function isFrozen(s, p) { return !isKing(p) && !!s.board[p] && lockSet(s).has(key(...s.board[p])); }

// ---------- movement ----------
function slide(occ, blk, p, [r0, c0], dirs) {
  const out = [];
  for (const [dr, dc] of dirs) {
    let r = r0 + dr, c = c0 + dc;
    while (onBoard(r, c) && !blk.has(key(r, c))) {   // locked squares stop sliding moves
      const o = occ[key(r, c)];
      if (!o) out.push([r, c]);
      else { if (o[0] !== p[0]) out.push([r, c]); break; }
      r += dr; c += dc;
    }
  }
  return out;
}
function step(occ, blk, p, [r0, c0], offs) {
  const out = [];
  for (const [dr, dc] of offs) {
    const r = r0 + dr, c = c0 + dc;
    if (!onBoard(r, c) || blk.has(key(r, c))) continue;
    const o = occ[key(r, c)];
    if (!o || o[0] !== p[0]) out.push([r, c]);
  }
  return out;
}
function movesForType(occ, blk, p, loc, t) {
  switch (t) {
    case "pawn": {
      const r = loc[0] + (p[0] === "b" ? 1 : -1), c = loc[1];
      return onBoard(r, c) && !occ[key(r, c)] && !blk.has(key(r, c)) ? [[r, c]] : [];
    }
    case "rook": return slide(occ, blk, p, loc, ROOK_DIRS);
    case "bishop": return slide(occ, blk, p, loc, BISHOP_DIRS);
    case "queen": return slide(occ, blk, p, loc, KING_STEPS);
    case "knight": return step(occ, blk, p, loc, KNIGHT_JUMPS);
    case "king": return step(occ, blk, p, loc, KING_STEPS);
  }
  return [];
}
function applyMove(b, p, pos) {
  const taken = squares(b)[key(...pos)];
  if (taken) delete b[taken];
  b[p] = pos;
  return taken;
}

// ---------- check (real piece types; frozen pieces don't give check) ----------
function inCheck(b, col, blk) {
  const k = b[col + "_king"];
  if (!k) return true;
  return attackers(b, k, other(col), blk).length > 0;
}
// pieces of colour `by` that attack square `sq` by their real type (frozen pieces don't attack)
function attackers(b, sq, by, blk) {
  const occ = squares(b), out = [];
  for (const p in b) {
    if (p[0] !== by) continue;
    const t = realType(p), loc = b[p];
    if (blk.has(key(...loc))) continue;
    let attacks;
    if (t === "pawn") {
      const d = p[0] === "b" ? 1 : -1;
      attacks = [[loc[0] + d, loc[1] - 1], [loc[0] + d, loc[1] + 1]];
    } else {
      attacks = movesForType(occ, blk, p, loc, t);
    }
    if (attacks.some(a => samePos(a, sq))) out.push(p);
  }
  return out;
}
function legalMoves(s, p, t) {
  const blk = lockSet(s);
  if (blk.has(key(...s.board[p]))) return [];          // frozen
  const occ = squares(s.board);
  return movesForType(occ, blk, p, s.board[p], t).filter(m => {
    const there = occ[key(...m)];
    if (there && isKing(there)) return false;            // no piece may capture a king
    if (there && s.shields && s.shields.some(x => x.piece === there)) return false;   // or a shielded piece
    const test = { ...s.board };
    applyMove(test, p, m);
    return !inCheck(test, p[0], blk);
  });
}
function hasAnyLegalMove(s, col) {
  for (const p in s.board) {
    if (p[0] !== col) continue;
    for (const t of new Set(optionsFor(p, s))) if (legalMoves(s, p, t).length) return true;
  }
  return false;
}

// ---------- cards ----------
function drawDeck() {
  let x = Math.random() * 100;
  for (const [t, l, w] of DECK) { if ((x -= w) < 0) return { t, l }; }
  return { t: "barricade", l: 1 };
}
function give(s, col, card, why) {
  if (!s.cfg.cards) return;
  s.hands[col].push(card);
  addLog(s, "got", [col, card.t, card.l, why], col);
}
function gainPoints(s, col, n) {
  const add = Math.max(0, Math.min(n, s.cfg.pointCap - s.earned[col]));
  s.earned[col] += add;
  s.points[col] += add;
  return add;
}
function inPreMove(s) {
  return s.cfg.cards && !s.over && !s.moved && !s.locked && !s.pendingCopy && !s.pendingPromo && !s.choice &&
    Object.keys(s.deadRolls).length === 0 && s.hands[s.turn].length <= HAND_MAX;
}
function rolledPiece(s) {
  // the piece Second Chance would re-roll: the one that just rolled (locked, or failed)
  if (s.locked) return s.locked.piece;
  if (s.lastRoll && s.deadRolls[s.lastRoll.piece] && s.board[s.lastRoll.piece]) return s.lastRoll.piece;
  return null;
}
// can this particular card be played right now?
function canPlay(s, card) {
  if (!card || !s.cfg.cards || s.over || s.pendingCopy || s.pendingPromo || s.choice || s.hands[s.turn].length > HAND_MAX) return false;
  const info = CARD_INFO[card.t];
  if (info.when === "never") return false;
  if (info.when === "roll") return !s.moved && !s.cardUsed && !!rolledPiece(s);
  if (s.moved) {
    if (!s.postCard || info.when === "pre") return false;
  } else if (!(inPreMove(s) && !s.cardUsed)) return false;
  if (card.t === "crown") return s.kingOptions[s.turn].length < TYPES.length;
  if (card.t === "thief") return s.hands[other(s.turn)].length > 0;
  if (card.t === "rewind") return !!(s.snaps && s.snaps[other(s.turn)]);
  return true;
}
function canUseCard(s) { return s.hands[s.turn].some(c => canPlay(s, c)); }
function canBuy(s) { return inPreMove(s); }
// what a card needs from the player: a square, a piece, two pieces, or a move type
function cardTarget(card) { return CARD_INFO[card.t].target || null; }
function isShielded(s, p) { return s.shields.some(x => x.piece === p); }
function validTarget(s, card, [r, c], picks = []) {
  if (!onBoard(r, c)) return false;
  const occ = squares(s.board), k = key(r, c), p = occ[k], col = s.turn, locked = lockSet(s).has(k);
  switch (card.t) {
    case "barricade": return !locked && !(p && isKing(p));
    case "mine": return !locked && !p;   // a square with someone's hidden mine is still allowed, so nothing leaks
    case "scope": return true;
    case "shield": return !!p && p[0] === col && !isKing(p) && !isShielded(s, p);
    case "teleport": return !!p && p[0] === col && !isKing(p) && !isFrozen(s, p) && teleportSquares(s, p).length > 0;
    case "swap": {
      if (!p || p[0] !== col || isKing(p) || isFrozen(s, p)) return false;
      if (!picks.length) return true;
      const q = occ[key(...picks[0])];
      if (!q || q === p) return false;
      const test = { ...s.board, [p]: s.board[q], [q]: s.board[p] };
      return !inCheck(test, col, lockSet(s));
    }
  }
  return false;
}
function validType(s, card, type) {
  if (card.t === "crown") return TYPES.includes(type) && !s.kingOptions[s.turn].includes(type);
  if (card.t === "mycall") return TYPES.includes(type);
  return false;
}
function emptySquares(s) {
  const occ = squares(s.board), blk = lockSet(s), out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!occ[key(r, c)] && !blk.has(key(r, c))) out.push([r, c]);
  return out;
}
function teleportSquares(s, p) {
  return emptySquares(s).filter(q => {
    const test = { ...s.board, [p]: q };
    return !inCheck(test, p[0], lockSet(s));
  });
}

// A piece arrives on a square by moving, teleporting or swapping: hidden mines, respawn spots, the pawn bonus.
// Returns false if the piece died.
function arrive(s, piece, to) {
  const col = piece[0];
  const mi = s.mines.findIndex(m => samePos(m.sq, to));
  if (mi >= 0) {
    s.mines.splice(mi, 1);
    if (isKing(piece)) addLog(s, "kingMine", [col, toSquare(to)]);
    else if (isShielded(s, piece)) addLog(s, "shieldMine", [col, realType(piece), toSquare(to)]);
    else { delete s.board[piece]; s.shields = s.shields.filter(x => x.piece !== piece); addLog(s, "mineKill", [col, realType(piece), toSquare(to)]); return false; }
  }
  // hidden respawn zone (kings can't be copied, so a king leaves it in place)
  const zi = !isKing(piece) && !s.pendingCopy ? s.zones.findIndex(z => samePos(z.sq, to)) : -1;
  if (zi >= 0) {
    s.zones.splice(zi, 1);
    const sqs = copySquares(s, to);
    if (sqs.length) { s.pendingCopy = { type: realType(piece), squares: sqs }; addLog(s, "zoneFound", [col, realType(piece), toSquare(to)]); }
    else addLog(s, "zoneLost", [col, toSquare(to)]);
  }
  // pawn on the far side: bonus roll type + 70% Bring Me My Legs
  const lastRow = col === "w" ? 0 : 7;
  if (realType(piece) === "pawn" && to[0] === lastRow && !s.promoted.includes(piece) && !s.pendingPromo) {
    s.pendingPromo = { piece };
    if (chance(0.70)) give(s, col, { t: "mine", l: 1 }, "pawnEnd");
  }
  return true;
}

function useCard(s, idx, act = {}) {
  const col = s.turn, opp = other(col), card = s.hands[col][idx];
  if (!canPlay(s, card)) return false;
  const need = cardTarget(card);
  if (need === "square" || need === "piece") { if (!isSq(act.sq) || !validTarget(s, card, act.sq)) return false; }
  if (need === "twoPieces") { if (!isSq(act.sq) || !isSq(act.sq2) || !validTarget(s, card, act.sq) || !validTarget(s, card, act.sq2, [act.sq])) return false; }
  if (need === "type" && !validType(s, card, act.type)) return false;
  s.hands[col].splice(idx, 1);
  const done = () => { if (s.moved) s.postCard = false; else s.cardUsed = true; afterStep(s); return true; };

  // Counterspell in the opponent's hand cancels the card (both are used up)
  const ci = s.hands[opp].findIndex(c => c.t === "counter");
  if (ci >= 0) {
    s.hands[opp].splice(ci, 1);
    addLog(s, "countered", [opp, card.t, card.l, col]);
    return done();
  }

  const target = act.sq, occ = squares(s.board);
  switch (card.t) {
    case "barricade": {
      s.locks.push({ sq: target, until: s.ply + 2 * DURATION.barricade[card.l - 1] });
      const there = occ[key(...target)];
      addLog(s, "useBarricade", [col, card.l, toSquare(target), there ? there[0] : ""]);
      break;
    }
    case "abra":
      s.disguise[opp] = { type: rand(TYPES), until: s.ply + 2 * DURATION.abra[card.l - 1] };
      addLog(s, "useAbra", [col, card.l]);
      break;
    case "mine":
      s.mines.push({ sq: target, by: col, at: s.ply, seen: [] });
      addLog(s, "useMine", [col, toSquare(target)]);   // the square is only animated for the mine's owner
      break;
    case "reborn": {
      const free = emptySquares(s).filter(q => !s.zones.some(z => samePos(z.sq, q)));
      if (free.length) s.zones.push({ sq: rand(free), seen: [] });
      addLog(s, "useReborn", [col]);
      break;
    }
    case "nomad":
      addLog(s, "useNomad", [col, card.l]);
      for (let i = 0; i < NOMAD_GIVES[card.l - 1]; i++) give(s, col, drawDeck(), "nomadCard");
      break;
    case "second": {
      // re-roll the piece that just rolled; the new roll counts
      const p = rolledPiece(s);
      s.locked = null;
      delete s.deadRolls[p];
      const roll = rand(optionsFor(p, s));
      s.rollN++;
      addLog(s, "useSecond", [col, roll, toSquare(s.board[p])]);
      s.cardUsed = true;
      resolveRoll(s, p, roll);
      return true;
    }
    case "double":
      s.doubleNext = true;
      addLog(s, "useDouble", [col]);
      break;
    case "curse":
      s.rollLists[opp].push("king");
      s.curses.push({ col: opp, until: s.ply + 2 * DURATION.curse });
      addLog(s, "useCurse", [col, opp]);
      break;
    case "shield": {
      const p = occ[key(...target)];
      s.shields.push({ piece: p, until: s.ply + 2 * DURATION.shield });
      addLog(s, "useShield", [col, realType(p), toSquare(target)]);
      break;
    }
    case "crown":
      s.kingOptions[col] = TYPES.filter(t => t === act.type || s.kingOptions[col].includes(t));
      addLog(s, "useCrown", [col, act.type]);
      break;
    case "scope": {
      // reveal hidden mines and respawn spots in the 3x3 area, to this player only, for the rest of the game
      const near = q => Math.abs(q[0] - target[0]) <= 1 && Math.abs(q[1] - target[1]) <= 1;
      let found = 0;
      for (const m of s.mines) if (near(m.sq) && !m.seen.includes(col)) { m.seen.push(col); found++; }
      for (const z of s.zones) if (near(z.sq) && !z.seen.includes(col)) { z.seen.push(col); found++; }
      addLog(s, "useScope", [col, toSquare(target)]);
      addLog(s, "scopeFound", [col, found], col);
      break;
    }
    case "thief": {
      const i = Math.floor(Math.random() * s.hands[opp].length);
      const [stolen] = s.hands[opp].splice(i, 1);
      s.hands[col].push(stolen);
      addLog(s, "useThief", [col, stolen.t, stolen.l], col);
      break;
    }
    case "quake":
      s.mines = []; s.locks = []; s.zones = [];
      addLog(s, "useQuake", [col]);
      break;
    case "teleport": {
      const p = occ[key(...target)], from = s.board[p];
      const to = rand(teleportSquares(s, p));
      s.board[p] = to;
      addLog(s, "useTeleport", [col, realType(p), toSquare(from), toSquare(to)]);
      arrive(s, p, to);
      break;
    }
    case "swap": {
      const p = occ[key(...act.sq)], q = occ[key(...act.sq2)];
      const a = s.board[p], b = s.board[q];
      s.board[p] = b; s.board[q] = a;
      addLog(s, "useSwap", [col, toSquare(a), toSquare(b)]);
      arrive(s, p, b);
      if (s.board[q]) arrive(s, q, a);
      break;
    }
    case "mycall":
      // the opponent's first roll next turn will be this type
      s.forced = { col: opp, type: act.type, ply: s.ply + 1 };
      addLog(s, "useMycall", [col, act.type]);
      break;
    case "rewind":
      return rewind(s, col);
  }
  return done();
}

// Wheel of Time: undo the opponent's last turn. They lose it, and it's this player's move again.
function rewind(s, col) {
  const opp = other(col), snap = s.snaps[opp];
  const keep = {
    log: s.log, seq: s.seq, cfg: s.cfg, clock: s.clock, turnStart: s.turnStart, rollN: s.rollN,
    hand: s.hands[col], points: s.points[col], earned: s.earned[col],
  };
  const old = JSON.parse(JSON.stringify(snap));
  for (const k of Object.keys(s)) if (!(k in old) && !["snaps"].includes(k)) delete s[k];
  Object.assign(s, old);
  s.log = keep.log; s.seq = keep.seq; s.cfg = keep.cfg; s.clock = keep.clock; s.turnStart = keep.turnStart; s.rollN = keep.rollN;
  s.hands[col] = keep.hand; s.points[col] = keep.points; s.earned[col] = keep.earned;
  s.snaps = { [col]: null, [opp]: null };
  addLog(s, "useRewind", [col, opp]);
  advance(s, true);
  return true;
}
const SNAP_SKIP = new Set(["log", "snaps", "seq", "cfg", "clock", "turnStart", "rollN"]);
function snapshot(s) {
  const o = {};
  for (const k in s) if (!SNAP_SKIP.has(k)) o[k] = s[k];
  return JSON.parse(JSON.stringify(o));
}

function buy(s, i) {
  const item = SHOP[i];
  if (!item || !canBuy(s) || s.points[s.turn] < item[2]) return false;
  s.points[s.turn] -= item[2];
  s.hands[s.turn].push({ t: item[0], l: item[1] });
  addLog(s, "bought", [s.turn, item[0], item[1], item[2]], s.turn);
  return true;
}
function discard(s, col, idx) {
  if (col !== s.turn || s.hands[col].length <= HAND_MAX || !s.hands[col][idx]) return false;
  const [card] = s.hands[col].splice(idx, 1);
  addLog(s, "discarded", [col, card.t, card.l], col);
  afterStep(s);
  return true;
}
function copySquares(s, center) {
  const occ = squares(s.board), blk = lockSet(s);
  for (const rad of [1, 2]) {
    const out = [];
    for (let r = center[0] - rad; r <= center[0] + rad; r++)
      for (let c = center[1] - rad; c <= center[1] + rad; c++)
        if (onBoard(r, c) && !occ[key(r, c)] && !blk.has(key(r, c))) out.push([r, c]);
    if (out.length) return out;
  }
  return [];
}
function placeCopy(s, pos) {
  const pc = s.pendingCopy;
  if (!pc || !pc.squares.some(q => samePos(q, pos))) return false;
  const col = s.turn, t = pc.type;
  const id = `${col}_${t === "pawn" ? "paw" : t}x${s.nextId++}`;
  s.board[id] = pos;
  s.pendingCopy = null;
  const mi = s.mines.findIndex(m => samePos(m.sq, pos));
  if (mi >= 0) {                        // copies can be placed on a (hidden) mine, and it goes off
    s.mines.splice(mi, 1);
    delete s.board[id];
    addLog(s, "copyMine", [col, t, toSquare(pos)]);
  } else addLog(s, "copyPlaced", [col, t, toSquare(pos)]);
  afterStep(s);
  return true;
}

// ---------- turns ----------
function freshState(seq = 0, cfg) {
  const b = {};
  const back = ["rook","knight","bishop","queen","king","bishop2","knight2","rook2"];
  back.forEach((n, c) => { b["b_" + n] = [0, c]; b["w_" + n] = [7, c]; });
  for (let c = 0; c < 8; c++) { b["b_paw" + (c+1)] = [1, c]; b["w_paw" + (c+1)] = [6, c]; }
  const both = v => ({ w: typeof v === "function" ? v() : v, b: typeof v === "function" ? v() : v });
  const s = {
    board: b,
    kingOptions: both(() => TYPES.slice()),
    captured: both(() => []),
    turn: "w", deadRolls: {}, locked: null, lastRoll: null,
    checked: false, note: null, over: null, log: [], seq,
    rollLists: both(() => TYPES.slice()),
    promoted: [], pendingPromo: null,
    // cards
    ply: 0, moved: false, cardUsed: false, postCard: false, pendingCopy: null, nextId: 1,
    hands: both(() => []), points: both(0), earned: both(0), dist: both(0), nomadWon: both(0),
    locks: [], disguise: { w: null, b: null }, mines: [], zones: [],
    shields: [], curses: [], forced: null, doubleNext: false, choice: null, snaps: { w: null, b: null },
    // settings and timers
    cfg: normCfg(cfg), turnStart: Date.now(), clock: null, rollN: 0,
  };
  s.points.w = s.points.b = s.cfg.startPoints;
  beginTurn(s);
  return s;
}

// A player with no legal move might still free themselves with a Barricade (freeze the attacker),
// so the game doesn't end while they hold one, could buy one, or hold a Wanderer.
function couldRescue(s, col) {
  if (!s.cfg.cards) return false;
  const helps = ["barricade", "nomad", "quake", "teleport", "swap", "rewind", "thief"];
  return s.hands[col].some(c => helps.includes(c.t)) || s.points[col] >= 3;
}

function beginTurn(s) {
  s.deadRolls = {}; s.locked = null; s.note = null;
  s.moved = false; s.cardUsed = false; s.postCard = false; s.doubleNext = false; s.choice = null;
  s.locks = s.locks.filter(l => l.until > s.ply);
  s.shields = s.shields.filter(x => x.until > s.ply && s.board[x.piece]);
  for (const c of ["w", "b"]) if (s.disguise[c] && s.disguise[c].until <= s.ply) s.disguise[c] = null;
  // Cursed Dice wears off: take its extra "king" back out of the roll list
  s.curses = s.curses.filter(cu => {
    if (cu.until > s.ply) return true;
    const i = s.rollLists[cu.col].lastIndexOf("king");
    if (i >= 0 && s.rollLists[cu.col].filter(x => x === "king").length > 1) s.rollLists[cu.col].splice(i, 1);
    return false;
  });
  if (s.forced && s.forced.ply < s.ply) s.forced = null;
  const t = s.turn, opp = other(t);

  if (!s.board[t + "_king"]) {
    s.checked = false;
    s.over = { k: "kingTaken", w: opp };
    addLog(s, "over", ["kingTaken", opp]);
    return;
  }

  s.checked = inCheck(s.board, t, lockSet(s));
  if (s.checked) {
    const removable = s.kingOptions[t].filter(x => x !== "king");
    if (removable.length) {
      const lost = rand(removable);
      s.kingOptions[t] = s.kingOptions[t].filter(x => x !== lost);
      addLog(s, "checkLost", [t, lost]);
      s.note = { k: "noteCheckLost", a: [t, lost] };
    } else {
      addLog(s, "checkBare", [t]);
      s.note = { k: "noteCheckBare", a: [t] };
    }
    if (chance(0.30)) give(s, opp, { t: "abra", l: chance(0.7) ? 1 : 2 }, "check");
  }

  if (!hasAnyLegalMove(s, t) && !couldRescue(s, t)) {
    s.over = s.checked ? { k: "mate", w: opp } : { k: "stale", w: null };
    addLog(s, "over", [s.over.k, opp]);
    return;
  }
  // remembered for Wheel of Time, which can undo this turn
  if (s.snaps) s.snaps[t] = snapshot(s);
}

function advance(s, noDraw) {
  const now = Date.now();
  if (s.clock) s.clock[s.turn] = Math.max(0, s.clock[s.turn] - (now - s.turnStart));
  s.ply++;
  if (!noDraw && s.cfg.cards && s.cfg.drawEvery && s.ply % (s.cfg.drawEvery * 2) === 0) {
    addLog(s, "timedDraw", []);
    for (const c of ["w", "b"]) give(s, c, drawDeck(), "draw");
  }
  s.turn = other(s.turn);
  // long games: once enough full turns have passed, both players get a short clock
  if (!s.clock && s.ply >= s.cfg.suddenDeath * 2) {
    s.clock = { w: s.cfg.clockSec * 1000, b: s.cfg.clockSec * 1000 };
    addLog(s, "suddenDeath", [s.cfg.suddenDeath, s.cfg.clockSec]);
  }
  s.turnStart = now;
  beginTurn(s);
}

// Ends the turn once nothing is left to do (copy, promotion, after-capture card, discard).
function afterStep(s) {
  if (!s.moved || s.over || s.pendingCopy || s.pendingPromo || s.postCard) return;
  if (s.hands[s.turn].length > HAND_MAX) return;
  advance(s);
}

// Roll result for a piece. Returns "locked", "dead" or "skipped".
function resolveRoll(s, p, roll) {
  const moves = legalMoves(s, p, roll);
  s.lastRoll = { piece: p, roll };
  if (moves.length) { s.locked = { piece: p, roll, moves }; return "locked"; }
  s.deadRolls[p] = roll;
  const own = Object.keys(s.board).filter(q => q[0] === s.turn);
  if (own.every(q => s.deadRolls[q] || isFrozen(s, q))) {
    s.lastRoll = null;
    // Kings can't be captured, so failing every roll while in check is checkmate.
    if (inCheck(s.board, s.turn, lockSet(s))) {
      s.checked = true;
      s.over = { k: "mate", w: other(s.turn) };
      addLog(s, "skip", [s.turn]);
      addLog(s, "over", ["mate", other(s.turn)]);
      return "mate";
    }
    addLog(s, "skip", [s.turn]);
    advance(s);
    return "skipped";
  }
  return "dead";
}

function makeMove(s, r, c) {
  const { piece, roll } = s.locked;
  if (!s.locked.moves.some(m => samePos(m, [r, c]))) return false;
  const col = s.turn, from = s.board[piece], to = [r, c];
  const taken = applyMove(s.board, piece, to);
  addLog(s, "move", [col, realType(piece), toSquare(from), toSquare(to), roll, taken ? realType(taken) : ""]);
  s.lastRoll = null; s.locked = null; s.moved = true;

  if (taken) {
    s.captured[col].push(taken);
    gainPoints(s, col, VALUE[realType(taken)]);
    if (chance(0.20)) { const x = Math.random(); give(s, col, { t: "barricade", l: x < 0.6 ? 1 : x < 0.9 ? 2 : 3 }, "capture"); }
  }

  arrive(s, piece, to);

  // distance travelled -> Wanderer
  s.dist[col] += roll === "knight" ? 5 : Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  while (s.nomadWon[col] < 4 && s.dist[col] >= NOMAD_AT[s.nomadWon[col]]) {
    s.nomadWon[col]++;
    give(s, col, { t: "nomad", l: s.nomadWon[col] }, "distance");
  }

  if (chance(0.04)) give(s, col, { t: "reborn", l: 1 }, "move");

  s.postCard = !!taken && !isKing(taken) && s.hands[col].length > 0;
  afterStep(s);
  return true;
}

function choosePromotion(s, type) {
  if (!s.pendingPromo || !PROMO_TYPES.includes(type)) return false;
  s.rollLists[s.turn].push(type);
  s.promoted.push(s.pendingPromo.piece);
  const at = s.board[s.pendingPromo.piece];
  addLog(s, "promo", [s.turn, type, at ? toSquare(at) : ""]);
  s.pendingPromo = null;
  afterStep(s);
  return true;
}

function endPostCard(s) {
  if (!s.postCard) return false;
  s.postCard = false;
  afterStep(s);
  return true;
}

// ---------- older saved games: fill in fields they don't have ----------
function migrate(s) {
  const f = freshState(0);
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  s.cfg = normCfg(s.cfg);
  for (const x of s.mines.concat(s.zones)) if (!Array.isArray(x.seen)) x.seen = [];
  if (Array.isArray(s.log)) s.log = s.log.map(x => typeof x === "string" ? { k: "raw", a: [x.slice(0, 299)] } : x);
  if (typeof s.note === "string") s.note = null;
  if (s.over && typeof s.over.title === "string") s.over = { k: "raw", w: null, title: String(s.over.title), text: String(s.over.text) };
  return s;
}

// ---------- timers ----------
// The turn timer ran out: finish whatever is pending at random, or skip the turn.
function timeoutTurn(s) {
  const t = s.turn, ply = s.ply;
  const still = () => !s.over && s.turn === t && s.ply === ply;
  addLog(s, "turnTimeout", [t]);
  s.locked = null;
  while (s.hands[t].length > HAND_MAX) {
    const [card] = s.hands[t].splice(Math.floor(Math.random() * s.hands[t].length), 1);
    addLog(s, "discarded", [t, card.t, card.l], t);
  }
  s.choice = null;
  if (still() && s.pendingCopy) placeCopy(s, rand(s.pendingCopy.squares));
  if (still() && s.pendingPromo) choosePromotion(s, rand(PROMO_TYPES));
  if (still() && s.postCard) endPostCard(s);
  if (!still()) return;
  if (s.moved) return afterStep(s);
  if (inCheck(s.board, t, lockSet(s))) {          // ran out of time while in check
    s.over = { k: "mate", w: other(t) };
    addLog(s, "over", ["mate", other(t)]);
    return;
  }
  advance(s);
}
// Call regularly. Returns true if the state changed (time ran out).
function tick(s, now = Date.now()) {
  if (s.over) return false;
  const used = now - s.turnStart;
  if (s.clock && s.clock[s.turn] - used <= 0) {
    s.clock[s.turn] = 0;
    s.over = { k: "time", w: other(s.turn) };
    addLog(s, "timeOut", [s.turn]);
    addLog(s, "over", ["time", other(s.turn)]);
    return true;
  }
  if (s.cfg.turnTime && used >= s.cfg.turnTime * 1000) { timeoutTurn(s); return true; }
  return false;
}
// milliseconds left: { turn, clock } (null when that timer isn't running)
function timeLeft(s, now = Date.now()) {
  const used = now - s.turnStart;
  return {
    turn: s.cfg.turnTime && !s.over ? Math.max(0, s.cfg.turnTime * 1000 - used) : null,
    clock: s.clock ? { w: s.clock.w - (s.turn === "w" && !s.over ? used : 0), b: s.clock.b - (s.turn === "b" && !s.over ? used : 0) } : null,
  };
}

// ---------- one entry point for every player action ----------
// act: { kind: "roll"|"move"|"copy"|"card"|"buy"|"discard"|"promo"|"endPost"|"resign", sq?: [r,c], idx?, i?, type? }
// Returns { ok: true, result? } or { ok: false, err } (err is a message key in i18n.js).
function isSq(v) { return Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 8); }
function applyAction(s, col, act) {
  if (!act || typeof act !== "object") return { ok: false, err: "msgBadAction" };
  if (s.over) return { ok: false, err: "msgOver" };
  if (act.kind === "resign") {
    s.over = { k: "resign", w: other(col) };
    addLog(s, "resigned", [col]);
    addLog(s, "over", ["resign", other(col)]);
    return { ok: true };
  }
  if (col !== s.turn) return { ok: false, err: "msgNotYourTurn" };
  const fail = err => ({ ok: false, err });
  const tooMany = s.hands[col].length > HAND_MAX;
  switch (act.kind) {
    case "roll": {
      if (!isSq(act.sq)) return fail("msgBadAction");
      if (tooMany) return fail("msgDiscard");
      if (s.pendingCopy || s.pendingPromo || s.postCard || s.moved || s.choice) return fail("msgBadAction");
      if (s.locked) return fail("msgMustMoveShort");
      const p = squares(s.board)[key(...act.sq)];
      if (!p || p[0] !== col) return fail("msgBadAction");
      if (isFrozen(s, p)) return fail("msgFrozen");
      if (s.deadRolls[p]) return fail("msgDeadShort");
      let roll = rand(optionsFor(p, s));
      // My Call!: the opponent chose this roll (not for a king that has lost that move type)
      if (s.forced && s.forced.col === col && s.forced.ply === s.ply) {
        const f = s.forced.type;
        s.forced = null;
        if (optionsFor(p, s).includes(f)) { roll = f; addLog(s, "forcedRoll", [col, f]); }
      }
      s.rollN++;
      if (s.doubleNext) {
        // Double Dice: roll twice and let the player choose
        s.doubleNext = false;
        const second = rand(optionsFor(p, s));
        s.choice = { piece: p, rolls: [roll, second], moves: [legalMoves(s, p, roll).length, legalMoves(s, p, second).length] };
        s.lastRoll = { piece: p, roll };
        addLog(s, "doubleRolled", [col, roll, second]);
        return { ok: true, result: "choice" };
      }
      return { ok: true, result: resolveRoll(s, p, roll) };
    }
    case "pick": {
      if (!s.choice || ![0, 1].includes(act.i)) return fail("msgBadAction");
      const { piece, rolls } = s.choice;
      s.choice = null;
      return { ok: true, result: resolveRoll(s, piece, rolls[act.i]) };
    }
    case "move":
      if (!s.locked || !isSq(act.sq)) return fail("msgBadAction");
      return makeMove(s, act.sq[0], act.sq[1]) ? { ok: true } : fail("msgMustMoveShort");
    case "copy":
      if (!isSq(act.sq)) return fail("msgBadAction");
      return placeCopy(s, act.sq) ? { ok: true } : fail("msgBadTarget");
    case "card": {
      if (!Number.isInteger(act.idx)) return fail("msgBadAction");
      const card = s.hands[col][act.idx];
      if (!card) return fail("msgBadAction");
      if (!canPlay(s, card)) return fail("msgNoCardNow");
      return useCard(s, act.idx, act) ? { ok: true } : fail("msgBadTarget");
    }
    case "buy": {
      const item = SHOP[act.i];
      if (!item) return fail("msgBadAction");
      if (!canBuy(s)) return fail("msgNoBuyNow");
      if (s.points[col] < item[2]) return fail("msgPoor");
      return buy(s, act.i) ? { ok: true } : fail("msgNoBuyNow");
    }
    case "discard": return discard(s, col, act.idx) ? { ok: true } : fail("msgBadAction");
    case "promo": return choosePromotion(s, act.type) ? { ok: true } : fail("msgBadAction");
    case "endPost": return endPostCard(s) ? { ok: true } : fail("msgBadAction");
  }
  return fail("msgBadAction");
}

// ---------- computer player ----------
// botStep picks and applies one action for the side to move. Returns the action, or null.
const CARD_WORTH = { nomad: 9, rewind: 9, counter: 8, barricade: 6, thief: 6, abra: 5, shield: 5, crown: 5, double: 4, mine: 4,
  curse: 4, swap: 3, mycall: 4, quake: 3, teleport: 3, reborn: 3, scope: 2, second: 3 };
function botMoveScore(s, p, m) {
  const col = p[0], blk = lockSet(s), occ = squares(s.board);
  const there = occ[key(...m)];
  let score = there ? VALUE[realType(there)] * 10 + 2 : 0;
  const test = { ...s.board };
  applyMove(test, p, m);
  const myVal = isKing(p) ? 0 : VALUE[realType(p)];
  if (attackers(test, m, other(col), blk).length) score -= myVal * 8;   // walking into an attack
  if (inCheck(test, other(col), blk)) score += 4;                       // gives check
  if (realType(p) === "pawn") {
    const goal = col === "w" ? 0 : 7;
    score += (7 - Math.abs(goal - m[0])) * .4;
    if (m[0] === goal && !s.promoted.includes(p)) score += 8;
  }
  // pieces of ours that were under attack and now aren't
  if (!isKing(p) && attackers(s.board, s.board[p], other(col), blk).length && !attackers(test, m, other(col), blk).length) score += myVal * 4;
  return score + Math.random() * 1.5;
}
function botPickCard(s) {
  const col = s.turn, hand = s.hands[col], blk = lockSet(s), opp = other(col);
  const myPieces = Object.keys(s.board).filter(p => p[0] === col && !isKing(p));
  const threatened = myPieces.filter(p => attackers(s.board, s.board[p], opp, blk).length).sort((a, b) => VALUE[realType(b)] - VALUE[realType(a)]);
  const k = s.board[col + "_king"];
  const checkers = k ? attackers(s.board, k, opp, blk) : [];
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i];
    if (!canPlay(s, c)) continue;
    const use = extra => ({ kind: "card", idx: i, ...extra });
    switch (c.t) {
      case "nomad": if (hand.length + c.l + 1 <= HAND_MAX) return use(); break;
      case "rewind": {
        const last = [...s.log].reverse().find(e => e.k === "move");
        if (last && last.a[0] === opp && last.a[5]) return use();   // undo a capture
        break;
      }
      case "barricade":
        if (checkers.length === 1 && !isKing(checkers[0])) return use({ sq: s.board[checkers[0]] });
        if (Math.random() < .3) {
          let best = null, bestV = 0;
          for (const q in s.board) {
            if (q[0] !== opp || isKing(q) || blk.has(key(...s.board[q]))) continue;
            const v = VALUE[realType(q)];
            if (v > bestV) { best = q; bestV = v; }
          }
          if (best && bestV >= 3) return use({ sq: s.board[best] });
        }
        break;
      case "shield": if (threatened.length && VALUE[realType(threatened[0])] >= 3 && !isShielded(s, threatened[0])) return use({ sq: s.board[threatened[0]] }); break;
      case "crown": { const lost = TYPES.filter(t => !s.kingOptions[col].includes(t)); return use({ type: lost.includes("queen") ? "queen" : lost[0] }); }
      case "thief": return use();
      case "quake": if (s.locks.some(l => squares(s.board)[key(...l.sq)] && squares(s.board)[key(...l.sq)][0] === col) || s.mines.length >= 2) return use(); break;
      case "curse": if (Math.random() < .4) return use(); break;
      case "mycall": if (Math.random() < .4) return use({ type: "pawn" }); break;
      case "abra": if (Math.random() < .4) return use(); break;
      case "reborn": if (Math.random() < .25) return use(); break;
      case "teleport": if (threatened.length && Math.random() < .3) return use({ sq: s.board[threatened[0]] }); break;
      case "double": if (!s.moved && Math.random() < .4) return use(); break;
      case "mine":
        if (Math.random() < .35) {
          const free = emptySquares(s).filter(q => q[0] >= 2 && q[0] <= 5 && validTarget(s, c, q));
          if (free.length) return use({ sq: rand(free) });
        }
        break;
    }
  }
  return null;
}
function botChooseAction(s) {
  const col = s.turn, hand = s.hands[col];
  if (hand.length > HAND_MAX) {
    let worst = 0;
    hand.forEach((c, i) => { if (CARD_WORTH[c.t] + c.l < CARD_WORTH[hand[worst].t] + hand[worst].l) worst = i; });
    return { kind: "discard", idx: worst };
  }
  if (s.pendingCopy) {
    const goal = col === "w" ? 0 : 7;
    const sq = s.pendingCopy.squares.slice().sort((a, b) => Math.abs(goal - a[0]) - Math.abs(goal - b[0]))[0];
    return { kind: "copy", sq };
  }
  if (s.pendingPromo) return { kind: "promo", type: rand(["queen", "queen", "rook", "knight"]) };
  if (s.choice) {
    // Double Dice: take the roll with more moves, or a capture
    const sc = r => legalMoves(s, s.choice.piece, r).reduce((m, q) => { const o = squares(s.board)[key(...q)]; return Math.max(m, 1 + (o ? VALUE[realType(o)] * 3 : 0)); }, 0);
    return { kind: "pick", i: sc(s.choice.rolls[1]) > sc(s.choice.rolls[0]) ? 1 : 0 };
  }
  if (s.postCard) return (canUseCard(s) && botPickCard(s)) || { kind: "endPost" };
  if (s.locked) {
    const { piece, moves } = s.locked;
    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) { const sc = botMoveScore(s, piece, m); if (sc > bestScore) { best = m; bestScore = sc; } }
    // a bad roll: try Second Chance
    const sec = hand.findIndex(c => c.t === "second");
    if (bestScore < -5 && sec >= 0 && canPlay(s, hand[sec])) return { kind: "card", idx: sec };
    return { kind: "move", sq: best };
  }
  if (inPreMove(s)) {
    if (!s.cardUsed) { const c = botPickCard(s); if (c) return c; }
    if (hand.length < 5) {
      // buy something useful it can afford, keeping a little in reserve
      const wish = ["abra", "shield", "barricade", "thief", "double"].map(t => SHOP.findIndex(x => x[0] === t && x[1] === 1)).find(i => i >= 0 && s.points[col] >= SHOP[i][2] + 2);
      if (wish !== undefined) return { kind: "buy", i: wish };
    }
  }
  // choose which piece to roll: favour pieces that could capture or escape check
  const blk = lockSet(s), checked = inCheck(s.board, col, blk);
  const pieces = Object.keys(s.board).filter(p => p[0] === col && !s.deadRolls[p] && !isFrozen(s, p));
  if (!pieces.length) return null;
  let best = pieces[0], bestW = -Infinity;
  for (const p of pieces) {
    let w = Math.random() * 2;
    for (const t of new Set(optionsFor(p, s))) {
      const ms = legalMoves(s, p, t);
      if (!ms.length) continue;
      w += 1;
      if (checked) w += 3;
      for (const m of ms) { const o = squares(s.board)[key(...m)]; if (o) w += VALUE[realType(o)]; }
    }
    if (w > bestW) { best = p; bestW = w; }
  }
  return { kind: "roll", sq: s.board[best] };
}
function botStep(s) {
  if (s.over) return null;
  const act = botChooseAction(s);
  if (!act) return null;
  const res = applyAction(s, s.turn, act);
  if (!res.ok && act.kind !== "roll" && act.kind !== "move") {
    // fall back to the plainest action that can't fail
    if (s.postCard) applyAction(s, s.turn, { kind: "endPost" });
  }
  return res.ok ? act : null;
}

// ---------- what each player may see (online games) ----------
// viewer: "w", "b" or null (spectator). Hidden: the other side's cards, private log details,
// mines that aren't yours to see, respawn spots, and for an Abracadabra victim the real types.
const HIDDEN_LOG = { got: 1, bought: 1, discarded: 1, useThief: 1, scopeFound: 1 };
function viewFor(s, viewer) {
  const v = JSON.parse(JSON.stringify({ ...s, snaps: null }));   // Wheel of Time snapshots hold everything: never sent
  for (const c of ["w", "b"]) if (c !== viewer) v.hands[c] = v.hands[c].map(() => null);
  // only respawn spots and mines you found with Binoculars, and your own mine until your move
  v.zones = v.zones.filter(z => z.seen && z.seen.includes(viewer));
  v.mines = v.mines.filter(m => (m.by === viewer && m.at === s.ply) || (m.seen && m.seen.includes(viewer)));
  v.log = v.log.map(e => {
    if (e.o && e.o !== viewer && HIDDEN_LOG[e.k]) return { ...e, a: [e.a[0]] };
    if (e.k === "useMine" && e.a[0] !== viewer) return { ...e, a: [e.a[0]] };
    return e;
  });
  const dis = viewer && s.disguise[viewer];
  if (dis) {
    // rename the victim's own pieces so even the data doesn't say what they are
    const rename = {};
    let i = 1;
    const base = dis.type === "pawn" ? "paw" : dis.type;
    for (const p in s.board) if (p[0] === viewer && !isKing(p)) rename[p] = `${viewer}_${base}x${i++}`;
    const rn = p => rename[p] || p;
    v.board = {};
    for (const p in s.board) v.board[rn(p)] = s.board[p];
    const dr = {};
    for (const p in s.deadRolls) dr[rn(p)] = s.deadRolls[p];
    v.deadRolls = dr;
    if (v.locked) v.locked.piece = rn(v.locked.piece);
    if (v.lastRoll) v.lastRoll.piece = rn(v.lastRoll.piece);
    if (v.pendingPromo) v.pendingPromo.piece = rn(v.pendingPromo.piece);
    if (v.pendingCopy) v.pendingCopy.type = dis.type;
    if (v.choice) v.choice.piece = rn(v.choice.piece);
    v.shields = v.shields.map(x => ({ ...x, piece: rn(x.piece) }));
    v.promoted = [];
    v.captured = { w: [], b: [] };
    v.log = v.log.map(e => {
      const a = e.a.slice();
      if (e.k === "move") { a[1] = "?"; if (a[5]) a[5] = "?"; }
      if (["mineKill", "zoneFound", "copyPlaced", "copyMine", "useShield", "shieldMine", "useTeleport"].includes(e.k) && a[0] === viewer) a[1] = "?";
      return { ...e, a };
    });
    v.hiddenInfo = true;
  }
  return v;
}

// ---------- game records (replays) ----------
const FRAME_KEYS = ["board", "turn", "ply", "kingOptions", "captured", "hands", "points", "earned", "dist", "nomadWon",
  "locks", "mines", "zones", "disguise", "rollLists", "checked", "over", "pendingCopy", "clock", "shields", "curses", "forced"];
function frameOf(s) {
  const f = {};
  for (const k of FRAME_KEYS) f[k] = s[k];
  return JSON.parse(JSON.stringify(f));
}
// A recorder keeps the full log (not just the last 40 lines) and a frame after every visible change.
function newRecord(s, names) {
  return { v: 1, created: Date.now(), names: names || { w: "", b: "" }, cfg: s.cfg, log: [], frames: [{ ...frameOf(s), L: 0 }], lastN: 0 };
}
function recordStep(rec, s) {
  for (const e of s.log) if ((e.n || 0) > rec.lastN) { rec.log.push(e); rec.lastN = e.n; }
  const f = { ...frameOf(s), L: rec.log.length };
  const prev = rec.frames[rec.frames.length - 1];
  const strip = x => JSON.stringify({ ...x, L: 0 });
  if (prev && strip(prev) === strip(f)) { prev.L = f.L; return; }
  if (rec.frames.length < 2500) rec.frames.push(f);
}

const API = {
  TYPES, PROMO_TYPES, FILES, PIECE_RE, CARD_KINDS, SHOP, DECK, HAND_MAX, NOMAD_AT, DURATION, VALUE, DEFAULT_CFG, CFG_CHOICES,
  key, onBoard, other, toSquare, isKing, rand, samePos, realType, squares, optionsFor, lockSet, isFrozen,
  legalMoves, inCheck, freshState, beginTurn, normCfg, migrate, canUseCard, canPlay, canBuy, cardTarget, validTarget, validType, addLog, CARD_INFO, isShielded,
  applyAction, tick, timeLeft, botStep, viewFor, newRecord, recordStep, frameOf,
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.Game = API;
})(this);
