(() => {
"use strict";
const W = 900, H = 600, WW = 2700, WH = 1800, DAWN = 300;
const cv = document.getElementById("game"), ctx = cv.getContext("2d");
const dpr = Math.min(window.devicePixelRatio || 1, 2);
cv.width = W * dpr; cv.height = H * dpr;
const dk = document.createElement("canvas"); dk.width = W; dk.height = H;
const dctx = dk.getContext("2d");
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- 世界 ----------
const houses = [], solids = [], spots = [[210,175],[690,175],[210,440],[690,440]];
window.DISTRICTS.forEach((d, di) => {
  const col = di % 3, row = (di / 3) | 0, empty = (col + row * 2 + 1) % 4; let w = 0;
  spots.forEach((s, si) => {
    if (si === empty) return;
    const x = col * 900 + s[0], y = row * 600 + s[1], [jp, zh, icon] = d.words[w++];
    houses.push({ id: houses.length, x, y, dx: x, dy: y + 77, color: d.color, word: { jp, zh, icon } });
  });
});
houses.forEach(h => solids.push({ x0: h.x - 50, x1: h.x + 50, y0: h.y - 39, y1: h.y + 58 }));
const ALL = houses.map(h => h.word);
const blocked = (x, y, r = 16) => solids.some(s => Math.hypot(x - clamp(x, s.x0, s.x1), y - clamp(y, s.y0, s.y1)) < r);
const DECOR = [], LAMPS = [], EMO = ["🐾","🌊","✨","🍬","🚏","⚓","🌸","🍥","🪷"];
{ let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let di = 0; di < 9; di++) for (let k = 0; k < 16; k++) {
    const x = (di % 3) * 900 + 40 + rnd() * 820, y = ((di / 3) | 0) * 600 + 40 + rnd() * 520;
    if (Math.abs(x % 900 - 450) < 60 || Math.abs(y % 600 - 300) < 60 || blocked(x, y, 60)) continue;
    DECOR.push({ x, y, e: EMO[di], s: 14 + (rnd() * 10 | 0) }); }
  [450, 1350, 2250].forEach(x => [300, 900, 1500].forEach(y => LAMPS.push({ x: x + 62, y: y - 62 }))); }
const ansPos = h => [{ x: h.x - 108, y: h.y + 93 }, { x: h.x + 108, y: h.y + 93 }, { x: h.x, y: h.y + 155 }];

// ---------- 狀態 ----------
const P = { x: 1350, y: 900, hp: 5, maxHp: 5, inv: 0 };
const b = { dmg: 1, rate: 0, mag: 0, dash: 0 };
const keys = new Set();
let state = "menu", elapsed = 0, oil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
let orders = [], job = null, enemies = [], gems = [], parts = [], texts = [], rings = [], misses = [];
let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, shake = 0;
let choices = [], camX = 0, camY = 0, joy = null, touch = false, inter = null, cargo = { x: 0, y: 0 }, audio = null, last = performance.now();
const btnE = { x: 810, y: 422, r: 38 }, btnD = { x: 811, y: 534, r: 47 };

let bossT = 80, ended = false, bossQ = null, codexBack = "menu";
const WL = { katana: 1, boom: 0, fire: 0, thunder: 0 };
const WI = { katana: { jp: "かたな", zh: "刀" }, boom: { jp: "ブーメラン", zh: "迴力鏢" }, fire: { jp: "ファイアボール", zh: "火球" }, thunder: { jp: "サンダー", zh: "雷" } };
let proj = [], eb = [], surgeT = 40, idle = 0, fAng = 0, shoutN = 0; const wT = { boom: 0, thunder: 0 };
const UP = [
  { n: "刀術精進", d: "刀光攻擊力 +1", f: () => b.dmg++ },
  { n: "疾風連斬", d: "刀光攻擊更快", f: () => b.rate++, ok: () => b.rate < 4 },
  { n: "招財磁鐵", d: "吸取範圍變大", f: () => b.mag++, ok: () => b.mag < 3 },
  { n: "強健體魄", d: "生命上限 +1 並回滿", f: () => { P.maxHp++; P.hp = P.maxHp; }, ok: () => P.maxHp < 9 },
  { n: "添燈油", d: "燈油 +25", f: () => { oil = Math.min(100, oil + 25); } },
  { n: "殘影衝刺", d: "衝刺冷卻縮短", f: () => b.dash++, ok: () => b.dash < 3 }
];

function beep(f, d = .1, t = "sine", v = .05, e = f) {
  if (!audio) return;
  try {
    const n = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = t; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(Math.max(30, e), n + d);
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + d);
    o.connect(g).connect(audio.destination); o.start(n); o.stop(n + d);
  } catch {}
}
const say = (v, x, y, c = "#fff") => texts.push({ v, x, y, c, life: 1.7 });
function burst(x, y, c, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = 60 + Math.random() * 180;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c, r: 2 + Math.random() * 3, life: .3 + Math.random() * .3 });
  }
}

function makeOrder() {
  if (orders.length >= 5) return;
  const busy = new Set(orders.map(o => o.from.id));
  const from = pick(houses.filter(h => !busy.has(h.id)));
  const to = pick(houses.filter(h => h !== from && dist(h, from) > 420 && dist(h, from) < 2000));
  if (from && to) orders.push({ from, to, word: STORE.pick(ALL), rev: elapsed > 45 && Math.random() < .35, life: 95 });
}

function start() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
  state = "play"; Object.assign(P, { x: 1350, y: 900, hp: 5, maxHp: 5, inv: 1 });
  Object.assign(b, { dmg: 1, rate: 0, mag: 0, dash: 0 }); Object.assign(WL, { katana: 1, boom: 0, fire: 0, thunder: 0 }); proj = []; eb = []; surgeT = 40; idle = 0; wT.boom = 0; wT.thunder = 1;
  elapsed = 0; oil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
  orders = []; job = null; enemies = []; gems = []; parts = []; texts = []; rings = []; misses = [];
  bossT = 80; ended = false; bossQ = null; orderT = 4; spawnT = 1; atkT = .3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; shake = 0;
  keys.clear(); joy = null;
  for (let i = 0; i < 4; i++) makeOrder();
  camX = clamp(P.x - W / 2, 0, WW - W); camY = clamp(P.y - H / 2, -40, WH - H + 40);
  beep(440, .12, "sine", .06, 690); mStep = 0; mT = 0;
}

const xpNeed = () => 10 + level * 8;
function offerUp() {
  const wc = shuffle(Object.keys(WI).filter(k => WL[k] < 5).map(k => ({ n: WI[k].jp, s: WI[k].zh, d: WL[k] ? `武器升級 Lv.${WL[k]}→${WL[k] + 1}` : "新武器！", f: () => { WL[k]++; if (k === "boom") wT.boom = 0; } })));
  const pc = shuffle(UP.filter(u => !u.ok || u.ok()));
  choices = shuffle([...wc.slice(0, 2), ...pc].slice(0, 3));
  state = "levelup"; keys.clear(); joy = null; beep(600, .17, "sine", .08, 960);
}
function pickUp(i) {
  if (state !== "levelup" || !choices[i]) return;
  choices[i].f(); level++; xp = Math.max(0, xp - xpNeed()); state = "play"; P.inv = .6;
  say("獲得：" + choices[i].n + (choices[i].s ? "＝" + choices[i].s : ""), P.x, P.y - 40, "#ffe9a0"); burst(P.x, P.y, "#ffe9a0", 20);
}

function interact() {
  if (state !== "play" || !inter || job) return;
  const o = inter; orders = orders.filter(x => x !== o);
  job = { word: o.word, to: o.to, ans: shuffle([o.word, ...shuffle(ALL.filter(w => w !== o.word)).slice(0, 2)]), hold: 0, idx: -1, lock: .7, rev: o.rev };
  nameT = 4; cargo = { x: P.x, y: P.y };
  say(o.rev ? `句子委託：「${o.word.jp}をください」` : `取貨：${o.word.icon} ${o.word.jp}＝${o.word.zh}`, P.x, P.y - 45, "#ffe9a0"); beep(480, .12);
}

function resolve(i) {
  const j = job, w = j.ans[i], pos = ansPos(j.to)[i]; job = null; nameT = 0; STORE.rec(j.word.jp, w === j.word);
  if (w === j.word) {
    delivered++; const gain = 6;
    oil = Math.min(100, oil + 14 + gain); P.hp = Math.min(P.maxHp, P.hp + 1); xp += j.rev ? 9 : 6; score += 40;
    say(`${w.icon} ${w.jp}＝${w.zh} 送達！`, pos.x, pos.y - 30, "#fff0a6"); say(`燈油 +${14 + gain}`, pos.x, pos.y - 8, "#ffd27a");
    burst(pos.x, pos.y, "#ffe28b", 28); shake = 6; beep(550, .18, "sine", .09, 950);
  } else {
    failed++; misses.push(j.word);
    say(`送錯了！${j.word.icon} 是「${j.word.jp}」`, pos.x, pos.y - 34, "#ffacac");
    enemies.push({ x: pos.x, y: pos.y + 20, type: "mis", w: j.word, hp: 5 + Math.floor(elapsed / 120), speed: 78, flash: 0, wob: 0 });
    say("誤配妖怪出現！打倒它來複習", pos.x, pos.y - 10, "#d9b3ff");
    burst(pos.x, pos.y, "#c98cff", 22); shake = 5; beep(220, .2, "square", .05, 90);
  }
}

function hurt(e, dmg) {
  if (e.hp <= 0) return; if (e.shield) { e.flash = .06; return; } e.hp -= dmg; e.flash = .1; burst(e.x, e.y, "#ffe6aa", 3);
  if (e.hp > 0) return;
  const mis = e.type === "mis"; score += mis ? 60 : 10;
  if (e.type === "boss") { score += 300; oil = Math.min(100, oil + 20); say("Boss 擊破！燈油 +20", e.x, e.y - 60, "#ffe9a0"); shake = 10;
    for (let k = 0; k < 6; k++) gems.push({ x: e.x + (Math.random() - .5) * 60, y: e.y + (Math.random() - .5) * 60, v: 5 }); STORE.rec(e.word.jp, true); }
  for (let i = 0, n = mis ? 3 : 1; i < n; i++) gems.push({ x: e.x + (Math.random() - .5) * 24, y: e.y + (Math.random() - .5) * 24, v: mis ? 4 : 2 });
  burst(e.x, e.y, mis ? "#c98cff" : "#bce9ff", mis ? 24 : 10);
  if (mis) { STORE.rec(e.w.jp, true); say(`複習完成：${e.w.icon} ${e.w.jp}＝${e.w.zh}`, e.x, e.y - 40, "#e8d2ff"); shake = 6; }
}

function dash() {
  if (state !== "play" || dashCd > 0) return;
  const m = move(); if (Math.hypot(m.x, m.y) < .12) return;
  dashT = .2; dashCd = 1.8 - b.dash * .35; P.inv = Math.max(P.inv, .3); burst(P.x, P.y, "#d5f6ff", 8); beep(290, .16, "triangle", .06, 760);
}
function move() {
  if (joy) return Math.hypot(joy.dx, joy.dy) < .12 ? { x: 0, y: 0 } : { x: joy.dx, y: joy.dy };
  let x = +keys.has("r") - +keys.has("l"), y = +keys.has("d") - +keys.has("u"); const n = Math.hypot(x, y);
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

const mkQ = bs => ({ word: bs.word, lock: .4, ans: shuffle([bs.word, ...shuffle(ALL.filter(w => w !== bs.word)).slice(0, 2)]) });
function answerBoss(i) {
  const bs = enemies.find(e => e.type === "boss" && e.shield); if (!bossQ || bossQ.lock > 0 || !bs) return;
  const ok = bossQ.ans[i] === bs.word; STORE.rec(bs.word.jp, ok);
  if (ok) { bs.shield = false; bossQ = null; say("破防成功！攻擊吧", bs.x, bs.y - 70, "#9be7ff"); burst(bs.x, bs.y, "#9be7ff", 30); shake = 8; beep(700, .2, "triangle", .08, 1200); }
  else { oil = Math.max(1, oil - 5); say(`答錯！燈油 -5（${bs.word.icon}＝${bs.word.jp}）`, P.x, P.y - 50, "#ffacac"); beep(200, .2, "square", .05, 90); bs.word = STORE.pick(ALL); bossQ = mkQ(bs); bossQ.lock = 1; }
}
let muted = false, mStep = 0, mT = 0;
const SC = [0, 2, 4, 7, 9], MEL = [0,2,4,2,3,1,2,0,4,3,2,1,0,2,1,-2];
const nf = (i, root) => 220 * Math.pow(2, (root + SC[(i % 5 + 5) % 5] + 12 * Math.floor(i / 5)) / 12);
function music(dt) {
  if (!audio) return;
  if (muted || state === "menu" || state === "won" || state === "lost") { BGM && !BGM.paused && BGM.pause(); return; }
  if (BGM) { BGM.paused && BGM.play().catch(() => {}); return; }
  mT -= dt; if (mT > 0) return; mT = .34;
  const pr = elapsed / DAWN, root = pr > .66 ? 5 : pr > .33 ? 2 : 0;
  if (pr > .66 || mStep % 2 === 0) beep(nf(MEL[mStep % 16], root), .3, "triangle", .028);
  if (mStep % 4 === 0) beep(nf(MEL[(mStep >> 2) * 3 % 16], root) / 2, .6, "sine", .04);
  mStep++;
}

const shout = k => { if (++shoutN % 5 === 1) say(WI[k].jp + "！", P.x, P.y - 34, "#ffe9a0"); };
function weapons(dt) {
  if (WL.boom) { wT.boom -= dt;
    if (wT.boom <= 0) {
      let t = null, nd = 520; for (const e of enemies) { const d = dist(P, e); if (e.hp > 0 && d < nd) { t = e; nd = d; } }
      if (!t) wT.boom = .15; else {
        wT.boom = Math.max(.8, 2.1 - WL.boom * .22); shout("boom"); const n = 1 + (WL.boom >= 3) + (WL.boom >= 5), base = Math.atan2(t.y - P.y, t.x - P.x);
        for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .35; proj.push({ x: P.x, y: P.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, t: 0, back: false }); }
        beep(330, .1, "triangle", .04, 520);
      } } }
  for (const q of proj) {
    q.t += dt; if (q.t > .6) q.back = true;
    if (q.back) { const dx = P.x - q.x, dy = P.y - q.y, d = Math.hypot(dx, dy) || 1; q.vx = dx / d * 560; q.vy = dy / d * 560; if (d < 22) q.done = true; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    for (const e of enemies) if (e.hp > 0 && !(e.ib > elapsed) && Math.hypot(e.x - q.x, e.y - q.y) < (e.type === "boss" ? 52 : 30)) { e.ib = elapsed + .4; hurt(e, 1.2 + WL.boom * .6); }
  }
  proj = proj.filter(q => !q.done);
  if (WL.fire) { fAng += dt * 2.6; const n = WL.fire + 1;
    for (let i = 0; i < n; i++) { const a = fAng + i * 6.283 / n, x = P.x + Math.cos(a) * 92, y = P.y + Math.sin(a) * 92;
      for (const e of enemies) if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - x, e.y - y) < (e.type === "boss" ? 52 : 27)) { e.ifr = elapsed + .45; hurt(e, 1 + WL.fire * .5); } } }
  if (WL.thunder) { wT.thunder -= dt;
    if (wT.thunder <= 0) {
      const c = enemies.filter(e => e.hp > 0 && dist(P, e) < 420);
      if (!c.length) wT.thunder = .2; else {
        wT.thunder = Math.max(1, 2.7 - WL.thunder * .3); shout("thunder");
        shuffle(c).slice(0, 1 + (WL.thunder >> 1)).forEach(t => { rings.push({ x: t.x, y: t.y, r: 60, life: .18 }); burst(t.x, t.y - 20, "#fff27a", 14);
          for (const e of enemies) if (e.hp > 0 && dist(e, t) < 60) hurt(e, 3 + WL.thunder); });
        beep(120, .2, "sawtooth", .06, 40);
      } } }
}
function spawnEnemy(tier, rad, ang, ring) {
  const a = ang ?? Math.random() * 6.283, x = clamp(P.x + Math.cos(a) * rad, 20, WW - 20), y = clamp(P.y + Math.sin(a) * rad, 20, WH - 20), r = Math.random();
  let t = { type: "ghost", skin: (Math.random() * 4) | 0, hp: 2 * tier, speed: 92 + Math.min(70, elapsed / 4) };
  if (elapsed > 50 && r < .2) t = { type: "runner", hp: 1 + tier * .5, speed: 190 + Math.min(60, elapsed / 5) };
  else if (elapsed > 110 && r < .34) t = { type: "tank", hp: 7 * tier, speed: 58 };
  else if (elapsed > 90 && r < .48 && !ring) t = { type: "shooter", hp: 2.5 * tier, speed: 85, cd: 1 + Math.random() * 2 };
  enemies.push({ x, y, flash: 0, wob: Math.random() * 6, ...t, hp: Math.ceil(t.hp) });
}

function update(dt) {
  if (state !== "play") return;
  elapsed += dt; oil -= dt;
  if (oil <= 0) { oil = 0; state = "lost"; return; }
  if (elapsed >= DAWN) { state = "won"; beep(550, .4, "sine", .09, 1050); return; }
  P.inv = Math.max(0, P.inv - dt); dashT = Math.max(0, dashT - dt); dashCd = Math.max(0, dashCd - dt);
  hintT = Math.max(0, hintT - dt); nameT = Math.max(0, nameT - dt); shake = Math.max(0, shake - 35 * dt);
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 5; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.y -= 30 * dt; t.life -= dt; } texts = texts.filter(t => t.life > 0);
  for (const r of rings) r.life -= dt; rings = rings.filter(r => r.life > 0);
  for (const o of orders) o.life -= dt; orders = orders.filter(o => o.life > 0);
  orderT -= dt; if (orderT <= 0 || orders.length < 3) { makeOrder(); orderT = 5 + Math.random() * 2; }

  const m = move(), sp = dashT > 0 ? 800 : 285;
  const nx = clamp(P.x + m.x * sp * dt, 19, WW - 19), ny = clamp(P.y + m.y * sp * dt, 19, WH - 19);
  if (!blocked(nx, P.y)) P.x = nx; if (!blocked(P.x, ny)) P.y = ny;
  if (keys.has("dash")) dash();
  cargo.x += (P.x - 30 - cargo.x) * Math.min(1, dt * 8); cargo.y += (P.y + 18 - cargo.y) * Math.min(1, dt * 8);

  // 自動攻擊
  atkT -= dt;
  if (atkT <= 0) {
    const reach = 130 + (WL.katana - 1) * 14; let near = null, nd = reach;
    for (const e of enemies) { const d = dist(P, e); if (e.hp > 0 && d < nd) { near = e; nd = d; } }
    if (!near) atkT = .1; else {
      atkT = Math.max(.25, .75 - b.rate * .14); rings.push({ x: P.x, y: P.y, r: reach, life: .18 });
      for (const e of enemies) if (e.hp > 0 && dist(P, e) <= reach) hurt(e, b.dmg + (WL.katana - 1) * .5);
      beep(260, .08, "sawtooth", .025, 110);
    }
  }

  // 敵人：強度隨時間與玩家武器等級成長
  weapons(dt); idle = (m.x || m.y) ? 0 : idle + dt;
  const pw = Object.values(WL).reduce((x, y) => x + y, 0) + b.dmg + b.rate, tier = 1 + elapsed / 70 + pw * .05;
  spawnT -= dt * (idle > 2.5 ? 2 : 1);
  if (spawnT <= 0) {
    spawnT = Math.max(.32, 1.7 - elapsed * .0046);
    for (let k = 0, n = Math.min(6, 1 + Math.floor(elapsed / 55)); k < n && enemies.length < 90; k++) spawnEnemy(tier, 560);
  }
  surgeT -= dt;
  if (surgeT <= 0) { surgeT = 45; const n = 12 + Math.floor(elapsed / 25); say("百鬼夜行！被包圍了！", P.x, P.y - 75, "#ffb7bb"); beep(120, .6, "sawtooth", .07, 60);
    for (let k = 0; k < n; k++) spawnEnemy(tier, 430, k / n * 6.283, true); }
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, e.flash - dt); const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    const dir = e.type === "shooter" ? (d > 300 ? 1 : d < 220 ? -1 : 0) : 1;
    e.x += dx / d * e.speed * dt * dir; e.y += dy / d * e.speed * dt * dir;
    if (e.type === "shooter" && (e.cd -= dt) <= 0) { e.cd = 2.4; eb.push({ x: e.x, y: e.y, vx: dx / d * 210, vy: dy / d * 210, life: 4 }); }
    if (P.inv <= 0 && d < (e.type === "boss" ? 52 : e.type === "tank" ? 32 : e.type === "mis" ? 34 : 27)) {
      P.hp -= e.type === "tank" ? 2 : 1; P.inv = 1.1; shake = 10; burst(P.x, P.y, "#ff9494", 14); say("受傷！", P.x, P.y - 35, "#ffaaaa"); beep(180, .24, "sawtooth", .07, 55);
      if (P.hp <= 0) { state = "lost"; return; }
    }
  }
  for (const q of eb) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    if (P.inv <= 0 && Math.hypot(q.x - P.x, q.y - P.y) < 15) { q.life = 0; P.hp--; P.inv = 1.1; shake = 8; burst(P.x, P.y, "#ff9494", 10); beep(200, .2, "sawtooth", .06, 60); if (P.hp <= 0) { state = "lost"; return; } }
  }
  eb = eb.filter(q => q.life > 0);
  enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || dist(e, P) < 1100));
  bossT -= dt;
  if (bossT <= 0 && !enemies.some(e => e.type === "boss")) {
    const a = Math.random() * 6.283, hp = Math.round((14 + level * 2) * (1 + pw * .04 + elapsed / 200));
    enemies.push({ x: clamp(P.x + Math.cos(a) * 520, 40, WW - 40), y: clamp(P.y + Math.sin(a) * 520, 40, WH - 40), type: "boss", word: STORE.pick(ALL), shield: true, hp, max: hp, speed: 62, flash: 0, wob: 0 });
    bossT = 90; say("單字 Boss 出現！答對名字才能破防", P.x, P.y - 75, "#ffb7bb"); beep(140, .5, "sawtooth", .07, 70);
  }
  const bs = enemies.find(e => e.type === "boss" && e.shield);
  if (bs && dist(P, bs) < 380) { if (!bossQ) bossQ = mkQ(bs); bossQ.lock = Math.max(0, bossQ.lock - dt); } else bossQ = null;

  const att = 105 + b.mag * 75;
  for (const g of gems) {
    const d = dist(P, g);
    if (d < att && d > 0) { const s = 230 + (att - d) * 3; g.x += (P.x - g.x) / d * s * dt; g.y += (P.y - g.y) / d * s * dt; }
    if (d < 22) { xp += g.v; g.done = true; beep(790, .04, "sine", .012, 1050); }
  }
  gems = gems.filter(g => !g.done);

  // 互動 / 答題（需站在圈內 0.5 秒才判定，避免衝刺誤觸）
  inter = null;
  if (!job) { let nd = 60; for (const o of orders) { const d = Math.hypot(P.x - o.from.dx, P.y - o.from.dy); if (d < nd) { nd = d; inter = o; } } }
  if (job) {
    job.lock = Math.max(0, job.lock - dt); let idx = -1;
    if (job.lock <= 0 && dist(P, job.to) < 260) {
      const ps = ansPos(job.to); let nd = 30;
      ps.forEach((p, i) => { const d = dist(P, p); if (d < nd) { nd = d; idx = i; } });
    }
    if (idx !== job.idx) { job.idx = idx; job.hold = 0; } else if (idx >= 0) { job.hold += dt; if (job.hold >= .5) resolve(idx); }
  }

  camX += (clamp(P.x - W / 2, 0, WW - W) - camX) * Math.min(1, dt * 9);
  camY += (clamp(P.y - H / 2, -40, WH - H + 40) - camY) * Math.min(1, dt * 9);
  if (xp >= xpNeed()) offerUp();
}

// ---------- 繪圖 ----------
const box = (x, y, w, h, c, r = 10) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
const txt = (v, x, y, s, c = "#fff", a = "center") => { ctx.fillStyle = c; ctx.textAlign = a; ctx.font = `bold ${s}px "Noto Sans JP","Noto Sans TC",system-ui,sans-serif`; ctx.fillText(v, x, y); };
const on = (x, y, m = 100) => x > camX - m && x < camX + W + m && y > camY - m && y < camY + H + m;

function drawHouse(h) {
  if (!on(h.x, h.y, 140)) return;
  ctx.fillStyle = "#3b4763"; ctx.beginPath(); ctx.moveTo(h.x - 56, h.y - 10); ctx.lineTo(h.x, h.y - 66); ctx.lineTo(h.x + 56, h.y - 10); ctx.fill();
  box(h.x - 49, h.y - 11, 98, 70, "#f6ecd2"); box(h.x - 24, h.y + 10, 48, 49, h.color, 5);
  box(h.x - 45, h.y - 42, 90, 27, h.color, 6); txt(h.word.jp, h.x, h.y - 22, 18, "#1f2a40");
  txt(h.word.icon, h.x, h.y + 44, 25);
  if (hintT > 0) { box(h.x - 36, h.y + 65, 72, 22, "#fff", 6); txt(h.word.zh, h.x, h.y + 81, 14, "#1f2a40"); }
}

function drawEnemy(e) {
  const mis = e.type === "mis", r = mis ? 27 : e.type === "boss" ? 44 : e.type === "tank" ? 26 : e.type === "runner" ? 14 : 18, sk = mis ? 0 : e.skin, img = ART[mis ? "mis" : "ghost"], f = e.flash > 0;
  const fill = c => { ctx.fillStyle = f ? "#fff" : c; }, dot = (x, y, q, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, q, 0, 6.283); ctx.fill(); };
  ctx.save(); ctx.translate(e.x, e.y + Math.sin(elapsed * 8 + e.wob) * 3);
  if (e.type === "boss") {
    fill("#7a2a3a"); ctx.beginPath(); ctx.arc(0, -6, r, Math.PI, 0); ctx.lineTo(r, r); for (let k = 5; k >= -5; k -= 2) ctx.lineTo(k * r / 5, r - 8 + (k % 4 ? 6 : 0)); ctx.lineTo(-r, r); ctx.fill();
    dot(-14, -10, 6, "#fff"); dot(14, -10, 6, "#fff"); dot(-14, -10, 2.5, "#22304a"); dot(14, -10, 2.5, "#22304a"); fill("#f2c94c"); ctx.fillRect(-16, -r - 10, 32, 10);
    if (e.shield) { ctx.strokeStyle = "#9be7ffcc"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -2, r + 9, 0, 6.283); ctx.stroke(); txt("🛡", 0, -r - 16, 20); }
    txt(e.word.icon, 0, 8, 26); box(-34, r + 12, 68, 6, "#2a3556", 3); box(-34, r + 12, 68 * clamp(e.hp / e.max, 0, 1), 6, "#ff6b7a", 3);
  } else if (e.type === "runner") { ctx.rotate(Math.atan2(P.y - e.y, P.x - e.x)); fill("#ff9b5a"); ctx.beginPath(); ctx.moveTo(r + 8, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r + 5, 0); ctx.lineTo(-r, r); ctx.fill(); dot(2, -3, 3, "#22304a");
  } else if (e.type === "tank") { dot(0, 0, r, f ? "#fff" : "#5d6a8a"); dot(0, 0, r - 7, f ? "#fff" : "#7a88aa"); dot(-7, -3, 3, "#ffd27a"); dot(7, -3, 3, "#ffd27a");
  } else if (e.type === "shooter") { dot(0, 0, r, f ? "#fff" : "#b23a5a"); dot(0, 0, 8, "#fff"); dot(Math.max(-3, Math.min(3, (P.x - e.x) / 60)), 0, 4, "#22304a");
  } else if (img) ctx.drawImage(img, -r * 1.6, -r * 1.7, r * 3.2, r * 3.2);
  else if (sk === 1) { // 唐傘小僧
    fill("#c94a68"); ctx.beginPath(); ctx.arc(0, -4, r + 4, Math.PI, 0); ctx.fill(); ctx.fillRect(-r - 4, -5, 2 * r + 8, 4);
    fill("#f4e9d3"); ctx.fillRect(-7, -4, 14, r + 4); dot(0, 3, 6, "#fff"); dot(0, 3, 2.5, "#22304a"); dot(3, r - 2, 4, "#ff8fa3");
  } else if (sk === 2) { // 河童
    fill("#5fbf7a"); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); dot(0, -r + 2, 8, f ? "#fff" : "#9be7ff");
    dot(-6, -3, 4, "#fff"); dot(6, -3, 4, "#fff"); dot(-6, -3, 1.8, "#22304a"); dot(6, -3, 1.8, "#22304a"); fill("#f2c94c"); ctx.fillRect(-6, 4, 12, 5);
  } else if (sk === 3) { // 狸貓
    fill("#9a6b45"); dot(-r * .7, -r * .8, 6, f ? "#fff" : "#9a6b45"); dot(r * .7, -r * .8, 6, f ? "#fff" : "#9a6b45");
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); dot(0, 6, r * .55, f ? "#fff" : "#e8d3ae");
    dot(-6, -4, 5, "#3a2a20"); dot(6, -4, 5, "#3a2a20"); dot(-6, -4, 1.6, "#fff"); dot(6, -4, 1.6, "#fff");
  } else { // 幽靈／誤配妖怪
    fill(mis ? "#8a4fc0" : "#e8f1ff"); ctx.beginPath(); ctx.arc(0, -4, r, Math.PI, 0); ctx.lineTo(r, r);
    for (let k = 3; k >= -3; k -= 2) ctx.lineTo(k * r / 3, r - 6 + (k % 4 ? 4 : 0)); ctx.lineTo(-r, r); ctx.fill(); dot(-r / 3, -6, 3, "#22304a"); dot(r / 3, -6, 3, "#22304a");
  }
  if (mis) txt(`${e.w.icon}${e.w.jp}`, 0, -r - 10, 15, "#f0deff");
  ctx.restore();
}

function drawWorld() {
  ctx.save(); ctx.translate(-camX + (Math.random() - .5) * shake, -camY + (Math.random() - .5) * shake);
  window.DISTRICTS.forEach((d, i) => { ctx.fillStyle = d.color; ctx.fillRect((i % 3) * 900, ((i / 3) | 0) * 600, 900, 600); });
  ctx.fillStyle = "#e3d5b0";
  [450, 1350, 2250].forEach(x => ctx.fillRect(x - 45, 0, 90, WH)); [300, 900, 1500].forEach(y => ctx.fillRect(0, y - 45, WW, 90));
  window.DISTRICTS.forEach((d, i) => { ctx.globalAlpha = .28; txt(d.name, (i % 3) * 900 + 450, ((i / 3) | 0) * 600 + 90, 30, "#1f2a40"); ctx.globalAlpha = 1; });
  ctx.strokeStyle = "#ffffff99"; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
  [450, 1350, 2250].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WH); ctx.stroke(); });
  [300, 900, 1500].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WW, y); ctx.stroke(); }); ctx.setLineDash([]);
  ctx.globalAlpha = .55; for (const d of DECOR) if (on(d.x, d.y, 30)) txt(d.e, d.x, d.y, d.s); ctx.globalAlpha = 1;
  houses.forEach(drawHouse);
  for (const l of LAMPS) if (on(l.x, l.y, 60)) { ctx.fillStyle = "#ffcf6a33"; ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, 6.283); ctx.fill(); txt("🏮", l.x, l.y + 8, 24); }

  for (const o of orders) {
    const h = o.from; if (!on(h.x, h.y, 200)) continue; const y = h.y - 158 + Math.sin(elapsed * 3 + h.id) * 3, act = inter === o;
    box(h.x - 80, y, 160, 74, "#f6ecd2", 12); ctx.strokeStyle = act ? "#ff9c32" : "#3b4763"; ctx.lineWidth = act ? 4 : 2;
    ctx.beginPath(); ctx.roundRect(h.x - 80, y, 160, 74, 12); ctx.stroke();
    txt(o.rev ? `📝 ${o.word.jp}をください` : `${o.word.icon} ${o.word.jp}`, h.x, y + 28, o.rev ? 15 : 19, "#1f2a40"); txt(`送往：${o.to.word.jp}`, h.x, y + 55, 16, "#1f2a40");
    box(h.x - 64, y + 66, 128 * o.life / 95, 4, "#ffaf53", 2);
  }
  if (job && dist(P, job.to) < 320) {
    ansPos(job.to).forEach((p, i) => {
      const cur = job.idx === i;
      ctx.fillStyle = cur ? "#ffe9a0" : "#fff8"; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "#3b4763"; ctx.lineWidth = 3; ctx.stroke();
      if (cur) { ctx.strokeStyle = "#ff9c32"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, 36, -1.57, -1.57 + 6.283 * Math.min(1, job.hold / .5)); ctx.stroke(); }
      if (job.rev) txt(job.ans[i].icon, p.x, p.y + 10, 28); else txt(job.ans[i].jp, p.x, p.y + 6, job.ans[i].jp.length > 3 ? 12 : 16, "#1f2a40");
    });
  }
  for (const g of gems) { ctx.fillStyle = "#7fd8ff"; ctx.beginPath(); ctx.moveTo(g.x, g.y - 7); ctx.lineTo(g.x + 6, g.y); ctx.lineTo(g.x, g.y + 7); ctx.lineTo(g.x - 6, g.y); ctx.fill(); }
  enemies.forEach(drawEnemy);
  for (const q of proj) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(elapsed * 14); ctx.fillStyle = "#ffd84a"; ctx.fillRect(-14, -4, 28, 8); ctx.fillRect(-4, -14, 8, 28); ctx.restore(); }
  if (WL.fire) for (let i = 0, n = WL.fire + 1; i < n; i++) { const a = fAng + i * 6.283 / n, x = P.x + Math.cos(a) * 92, y = P.y + Math.sin(a) * 92;
    ctx.fillStyle = "#ff7a2a"; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.fill(); ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill(); }
  for (const q of eb) { ctx.fillStyle = "#ff5a7a"; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 6.283); ctx.fill(); }
  if (job) {
    box(cargo.x - 15, cargo.y - 15, 30, 30, "#14161f", 8);
    txt(nameT > 0 && !job.rev ? job.word.icon : "？", cargo.x, cargo.y + 7, nameT > 0 ? 20 : 18, "#ffe9a0");
  }
  ctx.globalAlpha = P.inv > 0 && (Math.floor(elapsed * 20) % 2) ? .4 : 1;
  if (ART.player) ctx.drawImage(ART.player, P.x - 32, P.y - 46, 64, 64); else {
  ctx.fillStyle = "#ff9c5a"; ctx.beginPath(); ctx.arc(P.x, P.y, 17, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(P.x - 6, P.y - 3, 2.5, 0, 6.283); ctx.arc(P.x + 6, P.y - 3, 2.5, 0, 6.283); ctx.fill();
  box(P.x - 14, P.y - 26, 28, 9, "#d24a4a", 4); }
  ctx.globalAlpha = 1; txt("🏮", P.x + 22, P.y + 8, 18);
  for (const r of rings) { ctx.strokeStyle = `rgba(255,240,170,${r.life / .18})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 - r.life / .3), 0, 6.283); ctx.stroke(); }
  for (const p of parts) { ctx.globalAlpha = clamp(p.life * 3, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); } ctx.globalAlpha = 1;
  for (const t of texts) { ctx.globalAlpha = clamp(t.life, 0, 1); txt(t.v, t.x, t.y, 17, t.c); } ctx.globalAlpha = 1;
  ctx.restore();

  // 夜色：由深夜逐漸轉為天亮；提燈周圍保持明亮
  const a = .68 * Math.pow(1 - elapsed / DAWN, 1.2);
  dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, W, H); dctx.fillStyle = `rgba(${8 + 70 * elapsed / DAWN | 0},${14 + 30 * elapsed / DAWN | 0},${46 + 20 * elapsed / DAWN | 0},${a})`; dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = "destination-out";
  const sx = P.x - camX, sy = P.y - camY, lr = 150 + oil * 1.6, gr = dctx.createRadialGradient(sx, sy, 20, sx, sy, lr);
  gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = gr; dctx.fillRect(0, 0, W, H);
  for (const l of LAMPS) { if (!on(l.x, l.y, 150)) continue; const lx = l.x - camX, ly = l.y - camY, g2 = dctx.createRadialGradient(lx, ly, 8, lx, ly, 140);
    g2.addColorStop(0, "rgba(0,0,0,.85)"); g2.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g2; dctx.fillRect(lx - 140, ly - 140, 280, 280); }
  ctx.drawImage(dk, 0, 0, W, H);
}

function drawHud() {
  box(0, 0, W, 70, "#101830e0", 0);
  txt("🏮", 12, 30, 22, "#fff", "left"); box(44, 14, 200, 16, "#2a3556", 8); box(44, 14, 200 * oil / 100, 16, oil < 25 ? "#ff7a6a" : "#ffc45a", 8);
  txt(`❤️ ${P.hp}/${P.maxHp}`, 262, 30, 19, "#fff", "left"); txt(`送達 ${delivered}／送錯 ${failed}`, 375, 30, 17, "#dfe8ff", "left");
  box(560, 16, 190, 12, "#2a3556", 6); box(560, 16, 190 * elapsed / DAWN, 12, "#ffb86b", 6); txt("🌙", 545, 30, 17, "#fff", "right"); txt("🌅", 772, 30, 17, "#fff", "left");
  box(560, 40, 190, 10, "#2a3556", 5); box(560, 40, 190 * clamp(xp / xpNeed(), 0, 1), 10, "#78d5ff", 5); txt(`Lv.${level}`, 760, 50, 14, "#fff", "left");
  txt(`✨ H：看中文（-3 燈油）`, 887, 30, 13, "#b9c8ee", "right");
  let l;
  if (!job) l = "找房子上的委託氣泡，到門口按 E 取貨，記住日文名字";
  else if (nameT > 0 && job.rev) l = `句子委託：「${job.word.jp}をください」→ 送往「${job.to.word.jp}」，到圈裡選出對應的圖案`;
  else if (nameT > 0) l = `記住：${job.word.icon} ${job.word.jp}＝${job.word.zh}　→ 送往「${job.to.word.jp}」`;
  else l = `貨物已包起來：送往「${job.to.word.jp}」，到圈裡站 0.5 秒選出${job.rev ? "對應的圖案" : "它的日文名"}` + (hintT > 0 ? `　（${job.word.zh}）` : "");
  txt(l, 12, 60, 15, "#ffe89f", "left");
  // 方向箭頭
  const t = job ? job.to : orders.reduce((n, o) => (!n || dist(P, o.from) < dist(P, n) ? o.from : n), null);
  if (t && !on(t.x, t.y, -60)) {
    const an = Math.atan2(t.y - P.y, t.x - P.x), x = P.x - camX + Math.cos(an) * 190, y = P.y - camY + Math.sin(an) * 190;
    ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.fillStyle = "#ffe89f"; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.fill(); ctx.restore();
  }
  box(8, 76, 560, 22, "#101830aa", 8); txt(Object.keys(WI).filter(k => WL[k]).map(k => `${WI[k].jp}Lv${WL[k]}`).join("　"), 16, 92, 14, "#ffe9a0", "left");
  if (bossQ) {
    box(120, 496, 660, 92, "#101830ee", 16); txt(`🛡 ${bossQ.word.icon} 的日文是？（按 1／2／3 或點選）`, 450, 524, 18, "#9be7ff");
    bossQ.ans.forEach((w, i) => { box(140 + i * 215, 538, 200, 40, bossQ.lock > 0 ? "#3b4763" : "#f6ecd2", 10); txt(`${i + 1}. ${w.jp}`, 240 + i * 215, 565, 18, "#1f2a40"); });
  }
  if (touch) {
    ctx.globalAlpha = .55; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(btnD.x, btnD.y, btnD.r, 0, 6.283); ctx.fill();
    txt("衝刺", btnD.x, btnD.y + 6, 18, "#1f2a40");
    if (inter) { ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(btnE.x, btnE.y, btnE.r, 0, 6.283); ctx.fill(); txt("取貨", btnE.x, btnE.y + 6, 18, "#1f2a40"); }
    if (joy) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(joy.x, joy.y, 62, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(joy.x + joy.dx * 62, joy.y + joy.dy * 62, 25, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
  } else if (inter && !job) txt("按 E 取貨", P.x - camX, P.y - camY - 45, 16, "#ffe89f");
}

function panel(w, h) { ctx.fillStyle = "#0b1024aa"; ctx.fillRect(0, 0, W, H); box((W - w) / 2, (H - h) / 2, w, h, "#1b2646f5", 22); }
function drawOverlay() {
  if (state === "menu") {
    panel(700, 400);
    txt("妖怪快遞社：夜行配達", 450, 190, 34); txt("取貨時記住「日文名字」，貨物之後會被黑布包起來", 450, 245, 19, "#dfe8ff");
    txt("送到目的地，站進正確名字的圈裡 0.5 秒", 450, 283, 19, "#dfe8ff"); txt("送錯會召喚誤配妖怪——打倒它就是複習", 450, 321, 19, "#d9b3ff");
    txt("燈油會一直燃燒，送貨才能補充；撐到天亮就贏了", 450, 359, 19, "#ffe69a");
    txt("WASD／方向鍵移動　E 取貨　Shift 衝刺　H 提示　M 靜音　C 圖鑑", 450, 402, 16, "#9fb2de"); txt("點一下或按 Enter 開始", 450, 448, 25, "#ffe69a"); txt(`最佳得分 ${STORE.data.best}　最多送達 ${STORE.data.bestDel}`, 450, 482, 15, "#9fb2de");
  } else if (state === "codex") {
    panel(840, 470); txt("單字圖鑑", 450, 118, 28); txt("★ = 熟練度：答對升星、答錯歸零，越不熟的詞越常出現（C／點一下 返回）", 450, 144, 14, "#9fb2de"); let n = 0;
    ALL.forEach((w, i) => { const cx = 60 + (i % 9) * 90, cy = 160 + ((i / 9) | 0) * 112, m = STORE.get(w.jp), seen = m.ok + m.ng > 0; if (m.box >= 4) n++;
      box(cx, cy, 84, 104, seen ? "#f6ecd2" : "#33405f", 10); txt(seen ? w.icon : "？", cx + 42, cy + 36, 28); txt(seen ? w.jp : "？？", cx + 42, cy + 62, w.jp.length > 3 ? 12 : 15, "#1f2a40");
      if (seen) { txt(w.zh, cx + 42, cy + 80, 12, "#3b4763"); txt("★".repeat(m.box) + "☆".repeat(4 - m.box), cx + 42, cy + 97, 11, "#d08a1e"); } });
    txt(`已精通 ${n} / ${ALL.length}`, 450, 515, 16, "#ffe69a");
  } else if (state === "levelup") {
    panel(800, 340); txt(`升級！Lv.${level}`, 450, 178, 32); txt("選一項能力繼續（點選或按 1／2／3）", 450, 208, 16, "#cfe2ff");
    for (let i = 0; i < 3; i++) { const x = 80 + i * 247; box(x, 230, 225, 190, ["#ffeed4", "#e0f0ff", "#f0e2fa"][i]);
      txt(choices[i].n, x + 112, 300, choices[i].n.length > 6 ? 17 : 22, "#1f2a40"); txt(choices[i].s || "", x + 112, 324, 15, "#52627d"); txt(choices[i].d, x + 112, 345, 15, "#3b4763"); txt(String(i + 1), x + 112, 395, 18, "#52627d"); }
  } else if (state === "won" || state === "lost") {
    panel(640, 340); txt(state === "won" ? "🌅 天亮了，快遞社平安！" : "🏮 燈滅了…今天先收工吧", 450, 200, 32);
    txt(`送達 ${delivered}　送錯 ${failed}　得分 ${score}`, 450, 250, 21, "#e3efff");
    const u = [...new Map(misses.map(w => [w.jp, w])).values()].slice(0, 6);
    txt(u.length ? "要複習的詞：" + u.map(w => `${w.icon}${w.jp}＝${w.zh}`).join("　") : "這局全部答對，太強了！", 450, 300, 15, "#d9b3ff");
    txt("點一下或按 Enter 再跑一趟", 450, 395, 24, "#ffe69a");
  }
}

// ---------- 輸入 ----------
const MAP = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d", Shift: "dash" };
addEventListener("keydown", e => {
  if ((e.key === "c" || e.key === "C") && (state === "codex" || state === "menu" || state === "won" || state === "lost")) { if (state === "codex") state = codexBack; else { codexBack = state; state = "codex"; } return; }
  if (e.key === "m" || e.key === "M") { muted = !muted; return; }
  if (state === "levelup" && "123".includes(e.key)) return pickUp(+e.key - 1);
  if (state !== "play") { if (e.key === "Enter" && state !== "levelup" && state !== "codex") start(); return; }
  if (e.key === "e" || e.key === "E") interact();
  else if (bossQ && "123".includes(e.key)) answerBoss(+e.key - 1);
  else if ((e.key === "h" || e.key === "H") && job && oil > 3 && hintT <= 0) { oil -= 3; hintT = 3; }
  else if (MAP[e.key]) { e.preventDefault(); keys.add(MAP[e.key]); }
});
addEventListener("keyup", e => MAP[e.key] && keys.delete(MAP[e.key]));
addEventListener("blur", () => { keys.clear(); joy = null; });
const pp = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
const hit = (p, bt) => Math.hypot(p.x - bt.x, p.y - bt.y) < bt.r + 8;
cv.addEventListener("pointerdown", e => {
  e.preventDefault(); cv.setPointerCapture(e.pointerId); if (e.pointerType !== "mouse") touch = true; const p = pp(e);
  if (state === "codex") { state = codexBack; return; }
  if (state === "menu" || state === "won" || state === "lost") { if (p.x > 740 && p.y > 540) { codexBack = state; state = "codex"; return; } return start(); }
  if (state === "levelup") { if (p.y > 230 && p.y < 420 && p.x > 80 && p.x < 820) pickUp(clamp(Math.floor((p.x - 80) / 247), 0, 2)); return; }
  if (bossQ && p.y > 496 && p.x > 120 && p.x < 780) { answerBoss(clamp(Math.floor((p.x - 140) / 215), 0, 2)); return; }
  if (inter && hit(p, btnE)) interact(); else if (hit(p, btnD)) dash();
  else if (p.x < W / 2 && p.y > 70 && !joy) joy = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
  else if (p.y < 70 && p.x > 700 && job && oil > 3 && hintT <= 0) { oil -= 3; hintT = 3; }
});
cv.addEventListener("pointermove", e => {
  if (joy?.id !== e.pointerId) return; const p = pp(e), dx = p.x - joy.x, dy = p.y - joy.y, n = Math.hypot(dx, dy), s = n > 62 ? 62 / n : 1;
  joy.dx = dx * s / 62; joy.dy = dy * s / 62;
});
["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => cv.addEventListener(ev, e => { if (joy?.id === e.pointerId) joy = null; }));

function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now; update(dt); music(dt);
  if ((state === "won" || state === "lost") && !ended) { ended = true; STORE.finish(score, delivered); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawWorld();
  if (state !== "menu") drawHud(); drawOverlay();
  if (state === "menu" || state === "won" || state === "lost") txt("📖 圖鑑 (C)", 886, 582, 16, "#ffe69a", "right"); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
