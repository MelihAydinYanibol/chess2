// Sound effects, made on the fly with the Web Audio API (no sound files needed).
(function (root) {
"use strict";
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem("rc-mute") === "1"; } catch (e) {}

function ac() {
  if (!ctx) {
    const C = root.AudioContext || root.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
// browsers only allow sound after the first click or key press
["pointerdown", "keydown"].forEach(ev => root.addEventListener(ev, () => { if (!muted) ac(); }, { once: true, capture: true }));

function tone(freq, dur, { type = "sine", vol = .3, at = 0, slide = 0, attack = .005 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + .05);
}
function noise(dur, { vol = .3, at = 0, freq = 1200, q = .7, type = "lowpass", slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}
const notes = (list, opts) => list.forEach(([f, at, dur]) => tone(f, dur || .18, { ...opts, at }));

const SOUNDS = {
  rollTick: () => tone(900 + Math.random() * 500, .03, { type: "square", vol: .05 }),
  rollDone: () => { tone(660, .08, { type: "triangle", vol: .18 }); tone(990, .12, { type: "triangle", vol: .14, at: .05 }); },
  rollDead: () => tone(260, .25, { type: "sawtooth", vol: .08, slide: .6 }),
  move: () => { noise(.06, { vol: .35, freq: 900 }); tone(140, .09, { type: "sine", vol: .25 }); },
  capture: () => { noise(.12, { vol: .45, freq: 2400, type: "bandpass", q: 1.2 }); tone(220, .14, { type: "triangle", vol: .25, slide: .5 }); },
  check: () => { tone(880, .14, { type: "square", vol: .09 }); tone(660, .2, { type: "square", vol: .09, at: .15 }); },
  cardGet: () => notes([[784, 0], [988, .07], [1319, .14, .3]], { type: "triangle", vol: .13 }),
  cardHidden: () => { noise(.08, { vol: .12, freq: 3000, type: "highpass" }); tone(520, .1, { type: "triangle", vol: .08 }); },
  buy: () => notes([[1319, 0, .08], [1568, .06, .25]], { type: "square", vol: .07 }),
  barricade: () => { [0, .09, .18].forEach(at => { noise(.18, { vol: .35, freq: 700, at, q: 4, type: "bandpass" }); tone(110, .2, { type: "square", vol: .1, at }); }); tone(1800, .5, { type: "sine", vol: .06, at: .3 }); },
  abra: () => { notes([[523, 0], [659, .06], [784, .12], [1047, .18], [1319, .24], [1568, .3, .5]], { type: "sine", vol: .1 }); noise(.7, { vol: .06, freq: 6000, type: "highpass", at: .1 }); },
  mine: () => { noise(.25, { vol: .3, freq: 400, slide: .4 }); tone(90, .3, { type: "sine", vol: .25, slide: .6 }); },
  reborn: () => { tone(220, 1.1, { type: "sine", vol: .12, slide: 2, attack: .3 }); tone(330, 1.1, { type: "sine", vol: .08, slide: 2, attack: .4 }); notes([[1047, .5, .3], [1319, .65, .4]], { type: "triangle", vol: .07 }); },
  nomad: () => { noise(.5, { vol: .15, freq: 500, slide: 6, type: "bandpass", q: 2 }); notes([[659, .35], [784, .45], [988, .55], [1319, .65, .35]], { type: "triangle", vol: .09 }); },
  boom: () => { noise(1.1, { vol: .8, freq: 1800, slide: .05 }); tone(70, .8, { type: "sine", vol: .55, slide: .4 }); },
  shield: () => { tone(1200, .6, { type: "sine", vol: .1, slide: 1.5 }); noise(.4, { vol: .3, freq: 900, slide: .2 }); },
  portal: () => { tone(300, 1.2, { type: "sine", vol: .1, slide: 3, attack: .2 }); tone(450, 1.2, { type: "triangle", vol: .05, slide: 3, attack: .3 }); },
  freeze: () => notes([[2093, 0, .1], [2637, .05, .1], [3136, .1, .3]], { type: "sine", vol: .07 }),
  unlock: () => { noise(.12, { vol: .3, freq: 1500, q: 3, type: "bandpass" }); tone(400, .15, { type: "square", vol: .06, at: .05, slide: 1.5 }); },
  spellEnd: () => notes([[1568, 0], [1319, .07], [1047, .14], [784, .21, .4]], { type: "sine", vol: .09 }),
  promo: () => notes([[523, 0, .12], [659, .1, .12], [784, .2, .12], [1047, .3, .5]], { type: "triangle", vol: .14 }),
  draw: () => { noise(.2, { vol: .1, freq: 4000, type: "highpass" }); notes([[880, 0, .1], [1175, .1, .2]], { type: "triangle", vol: .1 }); },
  burn: () => noise(.8, { vol: .2, freq: 2500, slide: .3, type: "bandpass", q: .5 }),
  win: () => notes([[523, 0, .15], [659, .15, .15], [784, .3, .15], [1047, .45, .6], [784, .6, .2], [1047, .75, .7]], { type: "triangle", vol: .16 }),
  lose: () => notes([[392, 0, .3], [349, .28, .3], [311, .56, .3], [262, .84, .8]], { type: "triangle", vol: .13 }),
  drawGame: () => notes([[523, 0, .3], [523, .3, .5]], { type: "triangle", vol: .12 }),
  tick: () => tone(1500, .04, { type: "square", vol: .05 }),
  alarm: () => { tone(988, .12, { type: "square", vol: .09 }); tone(988, .12, { type: "square", vol: .09, at: .18 }); },
  invite: () => notes([[784, 0, .12], [1047, .12, .12], [1319, .24, .35]], { type: "sine", vol: .16 }),
  click: () => tone(1200, .03, { type: "triangle", vol: .06 }),
};

root.Sound = {
  play(name) { if (muted || !SOUNDS[name]) return; try { SOUNDS[name](); } catch (e) {} },
  get muted() { return muted; },
  setMuted(v) { muted = !!v; try { localStorage.setItem("rc-mute", muted ? "1" : "0"); } catch (e) {} if (!muted) ac(); },
};
})(this);
