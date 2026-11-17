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
const CARD_KINDS = ["barricade", "abra", "mine", "reborn", "nomad"];
const MAX_LEVEL = { barricade: 3, abra: 2, mine: 1, reborn: 1, nomad: 2 };
const DURATION = { barricade: [1, 2, 3], abra: [2, 3] };   // in full turns
const NOMAD_GIVES = [2, 3];
const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const POINT_CAP = 39;
const HAND_MAX = 7;
const NOMAD_AT = [32, 32 + 48];     // squares travelled for Wanderer I and II
const DRAW_EVERY = 6;               // plies: every 3 full turns
const SHOP = [                      // [card, level, price]
  ["reborn", 1, 3], ["barricade", 1, 4], ["mine", 1, 5], ["abra", 1, 6],
  ["barricade", 2, 7], ["abra", 2, 9], ["barricade", 3, 10],
];
const DECK = [                      // [card, level, weight %]
  ["barricade", 1, 18], ["reborn", 1, 16], ["mine", 1, 15], ["abra", 1, 14], ["barricade", 2, 10],
  ["nomad", 1, 8], ["abra", 2, 6], ["barricade", 3, 5], ["nomad", 2, 4],
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
  const e = { k, a };
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
  const occ = squares(b);
  for (const p in b) {
    if (p[0] === col) continue;
    const t = realType(p), loc = b[p];
    if (blk.has(key(...loc))) continue;
    let attacks;
    if (t === "pawn") {
      const d = p[0] === "b" ? 1 : -1;
      attacks = [[loc[0] + d, loc[1] - 1], [loc[0] + d, loc[1] + 1]];
    } else {
      attacks = movesForType(occ, blk, p, loc, t);
    }
    if (attacks.some(a => samePos(a, k))) return true;
  }
  return false;
}
function legalMoves(s, p, t) {
  const blk = lockSet(s);
  if (blk.has(key(...s.board[p]))) return [];          // frozen
  return movesForType(squares(s.board), blk, p, s.board[p], t).filter(m => {
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
  s.hands[col].push(card);
  addLog(s, "got", [col, card.t, card.l, why], col);
}
function gainPoints(s, col, n) {
  const add = Math.max(0, Math.min(n, POINT_CAP - s.earned[col]));
  s.earned[col] += add;
  s.points[col] += add;
  return add;
}
function inPreMove(s) {
  return !s.over && !s.moved && !s.locked && !s.pendingCopy && !s.pendingPromo &&
    Object.keys(s.deadRolls).length === 0 && s.hands[s.turn].length <= HAND_MAX;
}
function canUseCard(s) {
  if (s.over || s.pendingCopy || s.pendingPromo || s.hands[s.turn].length > HAND_MAX) return false;
  return s.moved ? s.postCard : (inPreMove(s) && !s.cardUsed);
}
function canBuy(s) { return inPreMove(s); }
function cardTarget(card) { return card.t === "barricade" || card.t === "mine" ? card.t : null; }
function validTarget(s, card, [r, c]) {
  if (!onBoard(r, c)) return false;
  const occ = squares(s.board), k = key(r, c);
  if (lockSet(s).has(k)) return false;
  if (card.t === "barricade") return !(occ[k] && isKing(occ[k]));
  if (card.t === "mine") return !occ[k] && !s.mines.some(m => samePos(m.sq, [r, c]));
  return false;
}
function emptySquares(s) {
  const occ = squares(s.board), blk = lockSet(s), out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!occ[key(r, c)] && !blk.has(key(r, c))) out.push([r, c]);
  return out;
}
function useCard(s, idx, target) {
  const col = s.turn, card = s.hands[col][idx];
  if (!card || !canUseCard(s)) return false;
  const need = cardTarget(card);
  if (need && !(Array.isArray(target) && validTarget(s, card, target))) return false;
  s.hands[col].splice(idx, 1);
  const opp = other(col);
  if (card.t === "barricade") {
    s.locks.push({ sq: target, until: s.ply + 2 * DURATION.barricade[card.l - 1] });
    const there = squares(s.board)[key(...target)];
    addLog(s, "useBarricade", [col, card.l, toSquare(target), there ? there[0] : ""]);
  } else if (card.t === "abra") {
    s.disguise[opp] = { type: rand(TYPES), until: s.ply + 2 * DURATION.abra[card.l - 1] };
    addLog(s, "useAbra", [col, card.l]);
  } else if (card.t === "mine") {
    s.mines.push({ sq: target, by: col, at: s.ply });
    addLog(s, "useMine", [col]);
  } else if (card.t === "reborn") {
    const free = emptySquares(s).filter(q => !s.zones.some(z => samePos(z.sq, q)));
    if (free.length) s.zones.push({ sq: rand(free) });
    addLog(s, "useReborn", [col]);
  } else if (card.t === "nomad") {
    addLog(s, "useNomad", [col, card.l]);
    for (let i = 0; i < NOMAD_GIVES[card.l - 1]; i++) give(s, col, drawDeck(), "nomadCard");
  }
  if (s.moved) s.postCard = false; else s.cardUsed = true;
  afterStep(s);
  return true;
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
function freshState(seq = 0) {
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
  };
  beginTurn(s);
  return s;
}

// A player with no legal move might still free themselves with a Barricade (freeze the attacker),
// so the game doesn't end while they hold one, could buy one, or hold a Wanderer.
function couldRescue(s, col) {
  return s.hands[col].some(c => c.t === "barricade" || c.t === "nomad") || s.points[col] >= 4;
}

function beginTurn(s) {
  s.deadRolls = {}; s.locked = null; s.note = null;
  s.moved = false; s.cardUsed = false; s.postCard = false;
  s.locks = s.locks.filter(l => l.until > s.ply);
  for (const c of ["w", "b"]) if (s.disguise[c] && s.disguise[c].until <= s.ply) s.disguise[c] = null;
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
  }
}

function advance(s) {
  s.ply++;
  if (s.ply % DRAW_EVERY === 0) {
    addLog(s, "timedDraw", []);
    for (const c of ["w", "b"]) give(s, c, drawDeck(), "draw");
  }
  s.turn = other(s.turn);
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
    addLog(s, "skip", [s.turn]);
    s.lastRoll = null;
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

  // hidden mine on the square
  let alive = true;
  const mi = s.mines.findIndex(m => samePos(m.sq, to));
  if (mi >= 0) {
    s.mines.splice(mi, 1);
    if (isKing(piece)) addLog(s, "kingMine", [col, toSquare(to)]);
    else { delete s.board[piece]; alive = false; addLog(s, "mineKill", [col, realType(piece), toSquare(to)]); }
  }

  // hidden respawn zone (kings can't be copied, so a king leaves it in place)
  const zi = alive && !isKing(piece) ? s.zones.findIndex(z => samePos(z.sq, to)) : -1;
  if (zi >= 0) {
    s.zones.splice(zi, 1);
    const sqs = copySquares(s, to);
    if (sqs.length) { s.pendingCopy = { type: realType(piece), squares: sqs }; addLog(s, "zoneFound", [col, realType(piece)]); }
    else addLog(s, "zoneLost", [col]);
  }

  // distance travelled -> Wanderer
  s.dist[col] += roll === "knight" ? 5 : Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  while (s.nomadWon[col] < 2 && s.dist[col] >= NOMAD_AT[s.nomadWon[col]]) {
    s.nomadWon[col]++;
    give(s, col, { t: "nomad", l: s.nomadWon[col] }, "distance");
  }

  if (chance(0.04)) give(s, col, { t: "reborn", l: 1 }, "move");

  // pawn on the far side: bonus roll type + 70% Bring Me My Legs
  const lastRow = col === "w" ? 0 : 7;
  if (alive && realType(piece) === "pawn" && r === lastRow && !s.promoted.includes(piece)) {
    s.pendingPromo = { piece };
    if (chance(0.70)) give(s, col, { t: "mine", l: 1 }, "pawnEnd");
  }

  s.postCard = !!taken && !isKing(taken) && s.hands[col].length > 0;
  afterStep(s);
  return true;
}

function choosePromotion(s, type) {
  if (!s.pendingPromo || !PROMO_TYPES.includes(type)) return false;
  s.rollLists[s.turn].push(type);
  s.promoted.push(s.pendingPromo.piece);
  addLog(s, "promo", [s.turn, type]);
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

// ---------- checking states that come over the network ----------
function valid(s) {
  const isPos = v => Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 8);
  const isPiece = p => typeof p === "string" && PIECE_RE.test(p);
  const isType = t => TYPES.includes(t);
  const isCol = c => c === "w" || c === "b";
  const isNat = n => Number.isInteger(n) && n >= 0 && n < 1e6;
  const isCard = c => c && CARD_KINDS.includes(c.t) && Number.isInteger(c.l) && c.l >= 1 && c.l <= MAX_LEVEL[c.t];
  const isMsg = m => m && typeof m.k === "string" && m.k.length < 40 && Array.isArray(m.a) && m.a.length < 10 &&
    m.a.every(x => (typeof x === "string" && x.length < 300) || Number.isFinite(x)) && (m.o === undefined || isCol(m.o));
  try {
    if (!s || typeof s !== "object" || !Number.isInteger(s.seq)) return false;
    if (!isCol(s.turn)) return false;
    if (!s.board || typeof s.board !== "object" || Object.keys(s.board).length > 64) return false;
    const seen = new Set();
    for (const p in s.board) {
      if (!isPiece(p) || !isPos(s.board[p])) return false;
      const k = key(...s.board[p]);
      if (seen.has(k)) return false;
      seen.add(k);
    }
    // fill in fields that older saved games don't have
    if (s.rollLists === undefined) s.rollLists = { w: TYPES.slice(), b: TYPES.slice() };
    if (s.promoted === undefined) s.promoted = [];
    if (s.pendingPromo === undefined) s.pendingPromo = null;
    const defaults = freshDefaults();
    for (const f in defaults) if (s[f] === undefined) s[f] = defaults[f];
    if (Array.isArray(s.log)) s.log = s.log.map(x => typeof x === "string" ? { k: "raw", a: [x.slice(0, 299)] } : x);
    if (typeof s.note === "string") s.note = null;
    if (s.over && typeof s.over.title === "string") s.over = { k: "raw", w: null, title: String(s.over.title), text: String(s.over.text) };

    for (const col of ["w", "b"]) {
      const ko = s.kingOptions && s.kingOptions[col];
      if (!Array.isArray(ko) || ko.length > 6 || !ko.every(isType) || !ko.includes("king")) return false;
      const cap = s.captured && s.captured[col];
      if (!Array.isArray(cap) || cap.length > 64 || !cap.every(isPiece)) return false;
      const rl = s.rollLists && s.rollLists[col];
      if (!Array.isArray(rl) || rl.length > 40 || !rl.every(isType) || !TYPES.every(t => rl.includes(t))) return false;
      const hand = s.hands && s.hands[col];
      if (!Array.isArray(hand) || hand.length > HAND_MAX + 4 || !hand.every(isCard)) return false;
      for (const f of ["points", "earned", "dist"]) if (!s[f] || !isNat(s[f][col])) return false;
      if (s.earned[col] > POINT_CAP || s.points[col] > POINT_CAP) return false;
      if (!s.nomadWon || ![0, 1, 2].includes(s.nomadWon[col])) return false;
      const d = s.disguise && s.disguise[col];
      if (d !== null && !(d && isType(d.type) && isNat(d.until))) return false;
    }
    if (!s.deadRolls || typeof s.deadRolls !== "object") return false;
    for (const p in s.deadRolls) if (!isPiece(p) || !isType(s.deadRolls[p])) return false;
    if (!Array.isArray(s.promoted) || s.promoted.length > 64 || !s.promoted.every(isPiece)) return false;
    if (s.pendingPromo !== null && (!s.pendingPromo || !isPiece(s.pendingPromo.piece))) return false;
    if (s.locked !== null) {
      const l = s.locked;
      if (!l || !isPiece(l.piece) || !s.board[l.piece] || !isType(l.roll)) return false;
      if (!Array.isArray(l.moves) || l.moves.length > 64 || !l.moves.every(isPos)) return false;
    }
    if (s.lastRoll !== null && (!s.lastRoll || !isPiece(s.lastRoll.piece) || !isType(s.lastRoll.roll))) return false;
    if (s.over !== null) {
      const o = s.over;
      if (!o || !["kingTaken", "mate", "stale", "raw"].includes(o.k) || (o.w !== null && !isCol(o.w))) return false;
    }
    if (s.note !== null && !isMsg(s.note)) return false;
    if (!Array.isArray(s.log) || s.log.length > LOG_MAX + 10 || !s.log.every(isMsg)) return false;
    if (!isNat(s.ply) || !isNat(s.nextId) || typeof s.moved !== "boolean" || typeof s.cardUsed !== "boolean" || typeof s.postCard !== "boolean") return false;
    if (!Array.isArray(s.locks) || s.locks.length > 64 || !s.locks.every(l => l && isPos(l.sq) && isNat(l.until))) return false;
    if (!Array.isArray(s.mines) || s.mines.length > 64 || !s.mines.every(m => m && isPos(m.sq) && isCol(m.by) && isNat(m.at))) return false;
    if (!Array.isArray(s.zones) || s.zones.length > 64 || !s.zones.every(z => z && isPos(z.sq))) return false;
    if (s.pendingCopy !== null) {
      const pc = s.pendingCopy;
      if (!pc || !isType(pc.type) || pc.type === "king" || !Array.isArray(pc.squares) || pc.squares.length > 25 || !pc.squares.every(isPos)) return false;
    }
    return true;
  } catch (e) { return false; }
}
function freshDefaults() {
  const f = freshState(0), out = {};
  for (const k of ["ply", "moved", "cardUsed", "postCard", "pendingCopy", "nextId", "hands", "points", "earned", "dist", "nomadWon", "locks", "disguise", "mines", "zones"]) out[k] = f[k];
  return out;
}

// A restart must be a real new game, not an arbitrary position.
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function isFreshStart(s) {
  return canon({ ...s, seq: 0 }) === canon(freshState(0));
}

const API = {
  TYPES, PROMO_TYPES, FILES, PIECE_RE, CARD_KINDS, SHOP, DECK, HAND_MAX, POINT_CAP, NOMAD_AT, DRAW_EVERY, DURATION, VALUE,
  key, onBoard, other, toSquare, isKing, rand, samePos, realType, squares, optionsFor, lockSet, isFrozen,
  legalMoves, inCheck, freshState, beginTurn, resolveRoll, makeMove, choosePromotion, endPostCard,
  useCard, buy, discard, placeCopy, canUseCard, canBuy, cardTarget, validTarget, valid, isFreshStart, addLog,
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.Game = API;
})(this);
