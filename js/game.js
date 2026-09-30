(() => {
  "use strict";

  const W = 900, H = 600, WW = 2700, WH = 1800, DAWN = 300;
  const cv = document.getElementById("game");

  // 初始化高畫質渲染引擎
  RENDERER.init(cv);
  const ctx = RENDERER.getCtx();
  const dpr = RENDERER.getDpr();

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- 世界建築與地圖 ----------
  const houses = [], solids = [], spots = [[210, 175], [690, 175], [210, 440], [690, 440]];
  window.DISTRICTS.forEach((d, di) => {
    const col = di % 3, row = (di / 3) | 0, empty = (col + row * 2 + 1) % 4;
    let w = 0;
    spots.forEach((s, si) => {
      if (si === empty) return;
      const x = col * 900 + s[0], y = row * 600 + s[1];
      const wordData = d.words[w++];
      const [jp, zh, icon, romaji] = wordData;

      let bType = "house_shop";
      if (d.theme === "tavern" || d.theme === "market") bType = "house_tavern";
      else if (d.theme === "mystic" || d.theme === "lotus") bType = "house_shrine";
      else if (d.theme === "water" || d.theme === "sakura") bType = (si % 2 === 0 ? "house_shop" : "house_tavern");

      houses.push({
        id: houses.length,
        x, y,
        dx: x,
        dy: y + 60,
        color: d.color,
        bType,
        district: d.name,
        word: { jp, zh, icon, romaji: romaji || "" }
      });
    });
  });

  houses.forEach(h => solids.push({ x0: h.x - 48, x1: h.x + 48, y0: h.y - 25, y1: h.y + 45 }));
  const ALL = houses.map(h => h.word);
  const blocked = (x, y, r = 18) => solids.some(s => Math.hypot(x - clamp(x, s.x0, s.x1), y - clamp(y, s.y0, s.y1)) < r);

  const LAMPS = [];
  [450, 1350, 2250].forEach(x => [300, 900, 1500].forEach(y => LAMPS.push({ x: x + 62, y: y - 62 })));
  const ansPos = h => [{ x: h.x - 85, y: h.y + 75 }, { x: h.x + 85, y: h.y + 75 }, { x: h.x, y: h.y + 122 }];

  // ---------- 遊戲狀態 ----------
  const P = { x: 1350, y: 900, hp: 6, maxHp: 6, inv: 0 };
  const b = { dmg: 1.2, rate: 0, mag: 0, dash: 0 };
  const keys = new Set();
  let state = "menu";
  let elapsed = 0, oil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let orders = [], job = null, enemies = [], gems = [], parts = [], texts = [], rings = [], misses = [];
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0;
  let choices = [], joy = null, touch = false, inter = null, cargo = { x: 0, y: 0 }, last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };

  let bossT = 75, ended = false, bossQ = null, codexBack = "menu";
  const WL = { katana: 1, boom: 0, fire: 0, thunder: 0 };
  const WI = {
    katana: { jp: "かたな", zh: "妖刀斬" },
    boom: { jp: "ブーメラン", zh: "陰陽符" },
    fire: { jp: "ファイアボール", zh: "狐火炎" },
    thunder: { jp: "サンダー", zh: "天狐雷" }
  };
  let proj = [], surgeT = 40, fAng = 0;
  const wT = { boom: 0, thunder: 0 };

  const UP = [
    { n: "刀光精進", s: "攻擊強化", d: "妖刀傷害 +1.5", f: () => { b.dmg += 1.5; } },
    { n: "疾風連斬", s: "攻速加快", d: "攻擊頻率大幅提升", f: () => { b.rate++; }, ok: () => b.rate < 4 },
    { n: "招財勾玉", s: "吸取靈氣", d: "靈玉經驗吸取範圍 +50%", f: () => { b.mag++; }, ok: () => b.mag < 3 },
    { n: "仙藥葫蘆", s: "生命上限", d: "最大生命 +2 並完全恢復", f: () => { P.maxHp += 2; P.hp = P.maxHp; }, ok: () => P.maxHp < 12 },
    { n: "八咫燈油", s: "燈油補給", d: "燈油即刻恢復 +35%", f: () => { oil = Math.min(100, oil + 35); } },
    { n: "縮地瞬步", s: "衝刺加速", d: "衝刺冷卻時間大幅縮短", f: () => { b.dash++; }, ok: () => b.dash < 3 }
  ];

  const say = (v, x, y, c = "#fff") => texts.push({ v, x, y, c, life: 1.8 });
  function burst(x, y, c, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 80 + Math.random() * 200;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c, r: 2 + Math.random() * 3.5, life: 0.35 + Math.random() * 0.35 });
    }
  }

  function makeOrder() {
    if (orders.length >= 5) return;
    const busy = new Set(orders.map(o => o.from.id));
    const from = pick(houses.filter(h => !busy.has(h.id)));
    const to = pick(houses.filter(h => h !== from && dist(h, from) > 420 && dist(h, from) < 2000));
    if (from && to) {
      orders.push({ from, to, word: STORE.pick(ALL), rev: elapsed > 45 && Math.random() < 0.35, life: 95 });
    }
  }

  function start() {
    AUDIO.init();
    state = "play";
    Object.assign(P, { x: 1350, y: 900, hp: 6, maxHp: 6, inv: 1.2 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0 });
    Object.assign(WL, { katana: 1, boom: 0, fire: 0, thunder: 0 });
    proj = []; eb = []; surgeT = 45; wT.boom = 0; wT.thunder = 1;
    elapsed = 0; oil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    orders = []; job = null; enemies = []; gems = []; parts = []; texts = []; rings = []; misses = [];
    bossT = 75; ended = false; bossQ = null; orderT = 3; spawnT = 1; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0;
    keys.clear(); joy = null;
    for (let i = 0; i < 4; i++) makeOrder();
    RENDERER.setCam(clamp(P.x - W / 2, 0, WW - W), clamp(P.y - H / 2, 0, WH - H));
  }

  const xpNeed = () => 10 + level * 9;
  function offerUp() {
    const wc = shuffle(Object.keys(WI).filter(k => WL[k] < 5).map(k => ({
      n: WI[k].zh,
      s: WI[k].jp,
      d: WL[k] ? `武器提升至 Lv.${WL[k] + 1}` : "解鎖全新秘術武器！",
      f: () => { WL[k]++; if (k === "boom") wT.boom = 0; }
    })));
    const pc = shuffle(UP.filter(u => !u.ok || u.ok()));
    choices = shuffle([...wc.slice(0, 2), ...pc].slice(0, 3));
    state = "levelup";
    keys.clear();
    joy = null;
    AUDIO.levelUp();
  }

  function pickUp(i) {
    if (state !== "levelup" || !choices[i]) return;
    choices[i].f();
    level++;
    xp = Math.max(0, xp - xpNeed());
    state = "play";
    P.inv = 0.6;
    say(`獲得：${choices[i].n}`, P.x, P.y - 45, "#ffe9a0");
    burst(P.x, P.y, "#ffe9a0", 24);
  }

  function interact() {
    if (state !== "play" || !inter || job) return;
    const o = inter;
    orders = orders.filter(x => x !== o);
    job = {
      word: o.word,
      to: o.to,
      ans: shuffle([o.word, ...shuffle(ALL.filter(w => w !== o.word)).slice(0, 2)]),
      hold: 0,
      idx: -1,
      lock: 0.6,
      rev: o.rev
    };
    nameT = 4.5;
    cargo = { x: P.x, y: P.y };
    say(o.rev ? `句子委託：「${o.word.jp}をください」` : `取貨：${o.word.icon} ${o.word.jp}＝${o.word.zh}`, P.x, P.y - 45, "#ffe9a0");
    AUDIO.deliverSuccess();
  }

  function resolve(i) {
    const j = job, w = j.ans[i], pos = ansPos(j.to)[i];
    job = null;
    nameT = 0;
    STORE.rec(j.word.jp, w === j.word);

    if (w === j.word) {
      delivered++;
      const gain = 8;
      oil = Math.min(100, oil + 16 + gain);
      P.hp = Math.min(P.maxHp, P.hp + 1);
      xp += j.rev ? 12 : 8;
      score += 50;
      say(`${w.icon} ${w.jp}＝${w.zh} 送達！`, pos.x, pos.y - 35, "#fff0a6");
      say(`燈油 +${16 + gain}%`, pos.x, pos.y - 12, "#ffd27a");
      burst(pos.x, pos.y, "#ffe28b", 32);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
    } else {
      failed++;
      misses.push(j.word);
      say(`送錯了！${j.word.icon} 是「${j.word.jp}」`, pos.x, pos.y - 36, "#ff8f8f");
      enemies.push({
        x: pos.x, y: pos.y + 20,
        type: "mis",
        w: j.word,
        hp: 6 + Math.floor(elapsed / 90),
        max: 6 + Math.floor(elapsed / 90),
        speed: 82,
        flash: 0,
        wob: 0
      });
      say("誤配妖怪現身！擊敗以複習單字", pos.x, pos.y - 12, "#e5b8ff");
      burst(pos.x, pos.y, "#c98cff", 24);
      RENDERER.triggerShake(6);
      AUDIO.deliverWrong();
    }
  }

  function hurt(e, dmg, isCrit = false) {
    if (e.hp <= 0) return;
    if (e.shield) {
      e.flash = 0.08;
      RENDERER.spawnDamageNumber(0, e.x, e.y - 20, false, "#9be7ff");
      return;
    }
    e.hp -= dmg;
    e.flash = 0.12;
    burst(e.x, e.y, "#ffe6aa", 4);
    RENDERER.spawnDamageNumber(dmg, e.x, e.y - 25, isCrit, isCrit ? "#ffcc00" : "#ffffff");

    if (isCrit) {
      RENDERER.triggerHitStop(0.04);
      RENDERER.triggerShake(5);
    }

    if (e.hp > 0) return;

    // 怪物擊敗
    const isMis = e.type === "mis";
    score += isMis ? 80 : e.type === "boss" ? 400 : 15;

    if (e.type === "boss") {
      oil = Math.min(100, oil + 25);
      say("大妖鬼擊破！燈油 +25%", e.x, e.y - 65, "#ffe9a0");
      RENDERER.triggerShake(14);
      for (let k = 0; k < 8; k++) {
        gems.push({ x: e.x + (Math.random() - 0.5) * 70, y: e.y + (Math.random() - 0.5) * 70, v: 6 });
      }
      STORE.rec(e.word.jp, true);
    }

    const gemCount = isMis ? 4 : 1;
    for (let i = 0; i < gemCount; i++) {
      gems.push({ x: e.x + (Math.random() - 0.5) * 28, y: e.y + (Math.random() - 0.5) * 28, v: isMis ? 4 : 2 });
    }
    burst(e.x, e.y, isMis ? "#c98cff" : "#bce9ff", isMis ? 28 : 14);

    if (isMis) {
      STORE.rec(e.w.jp, true);
      say(`複習完成：${e.w.icon} ${e.w.jp}＝${e.w.zh}`, e.x, e.y - 45, "#f3d9ff");
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
    }
  }

  function dash() {
    if (state !== "play" || dashCd > 0) return;
    const m = move();
    if (Math.hypot(m.x, m.y) < 0.1) return;
    dashT = 0.22;
    dashCd = Math.max(0.6, 1.8 - b.dash * 0.38);
    P.inv = Math.max(P.inv, 0.35);
    burst(P.x, P.y, "#d5f6ff", 12);
    RENDERER.triggerShake(3);
    AUDIO.dash();
  }

  function move() {
    if (joy) {
      const n = Math.hypot(joy.dx, joy.dy);
      return n < 0.12 ? { x: 0, y: 0 } : { x: joy.dx, y: joy.dy };
    }
    const x = +keys.has("r") - +keys.has("l");
    const y = +keys.has("d") - +keys.has("u");
    const n = Math.hypot(x, y);
    return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
  }

  const mkQ = bs => ({
    word: bs.word,
    lock: 0.4,
    ans: shuffle([bs.word, ...shuffle(ALL.filter(w => w !== bs.word)).slice(0, 2)])
  });

  function answerBoss(i) {
    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (!bossQ || bossQ.lock > 0 || !bs) return;
    const ok = bossQ.ans[i] === bs.word;
    STORE.rec(bs.word.jp, ok);

    if (ok) {
      bs.shield = false;
      bossQ = null;
      say("結界破除！全力進攻！", bs.x, bs.y - 75, "#9be7ff");
      burst(bs.x, bs.y, "#9be7ff", 35);
      RENDERER.triggerShake(9);
      AUDIO.breakShield();
    } else {
      oil = Math.max(1, oil - 6);
      say(`答錯！燈油 -6%（${bs.word.icon}＝${bs.word.jp}）`, P.x, P.y - 50, "#ff8f8f");
      AUDIO.deliverWrong();
      bs.word = STORE.pick(ALL);
      bossQ = mkQ(bs);
      bossQ.lock = 1.0;
    }
  }

  function weapons(dt) {
    // 1. 妖刀斬擊 (Katana) - 自動斬擊
    atkT -= dt;
    if (atkT <= 0) {
      const reach = 145 + (WL.katana - 1) * 16;
      let near = null, nd = reach;
      for (const e of enemies) {
        const d = dist(P, e);
        if (e.hp > 0 && d < nd) { near = e; nd = d; }
      }
      if (!near) {
        atkT = 0.1;
      } else {
        atkT = Math.max(0.24, 0.72 - b.rate * 0.13);
        const ang = Math.atan2(near.y - P.y, near.x - P.x);
        RENDERER.addSlashArc(P.x, P.y, reach * 0.85, ang);
        rings.push({ x: P.x, y: P.y, r: reach, life: 0.18 });

        for (const e of enemies) {
          if (e.hp > 0 && dist(P, e) <= reach) {
            const isCrit = Math.random() < 0.25;
            hurt(e, (b.dmg + (WL.katana - 1) * 0.8) * (isCrit ? 1.6 : 1.0), isCrit);
          }
        }
        AUDIO.slash();
      }
    }

    // 2. 陰陽符咒迴力鏢 (Boomerang)
    if (WL.boom > 0) {
      wT.boom -= dt;
      if (wT.boom <= 0) {
        let t = null, nd = 540;
        for (const e of enemies) {
          const d = dist(P, e);
          if (e.hp > 0 && d < nd) { t = e; nd = d; }
        }
        if (!t) {
          wT.boom = 0.15;
        } else {
          wT.boom = Math.max(0.75, 2.0 - WL.boom * 0.24);
          const count = 1 + (WL.boom >= 3) + (WL.boom >= 5);
          const baseAng = Math.atan2(t.y - P.y, t.x - P.x);
          for (let i = 0; i < count; i++) {
            const a = baseAng + (i - (count - 1) / 2) * 0.32;
            proj.push({ x: P.x, y: P.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, t: 0, back: false });
          }
          AUDIO.boomerang();
        }
      }
    }

    for (const q of proj) {
      q.t += dt;
      if (q.t > 0.6) q.back = true;
      if (q.back) {
        const dx = P.x - q.x, dy = P.y - q.y;
        const d = Math.hypot(dx, dy) || 1;
        q.vx = (dx / d) * 580;
        q.vy = (dy / d) * 580;
        if (d < 25) q.done = true;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      for (const e of enemies) {
        if (e.hp > 0 && !(e.ib > elapsed) && Math.hypot(e.x - q.x, e.y - q.y) < (e.type === "boss" ? 54 : 32)) {
          e.ib = elapsed + 0.38;
          hurt(e, 1.5 + WL.boom * 0.7);
        }
      }
    }
    proj = proj.filter(q => !q.done);

    // 3. 狐火環繞 (Fireball)
    if (WL.fire > 0) {
      fAng += dt * 2.8;
      const count = WL.fire + 1;
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * 96, fy = P.y + Math.sin(a) * 96;
        for (const e of enemies) {
          if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - fx, e.y - fy) < (e.type === "boss" ? 54 : 30)) {
            e.ifr = elapsed + 0.42;
            hurt(e, 1.2 + WL.fire * 0.6);
            burst(fx, fy, "#ff8833", 4);
          }
        }
      }
    }

    // 4. 天狐落雷 (Thunder)
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const c = enemies.filter(e => e.hp > 0 && dist(P, e) < 450);
        if (!c.length) {
          wT.thunder = 0.2;
        } else {
          wT.thunder = Math.max(0.9, 2.6 - WL.thunder * 0.3);
          shuffle(c).slice(0, 1 + (WL.thunder >> 1)).forEach(t => {
            rings.push({ x: t.x, y: t.y, r: 70, life: 0.2 });
            burst(t.x, t.y - 25, "#fff67a", 18);
            for (const e of enemies) {
              if (e.hp > 0 && dist(e, t) < 70) {
                hurt(e, 3.5 + WL.thunder * 1.2, true);
              }
            }
          });
          AUDIO.thunder();
        }
      }
    }
  }

  function spawnEnemy(tier, rad, ang, ring) {
    const a = ang ?? Math.random() * 6.283;
    const x = clamp(P.x + Math.cos(a) * rad, 30, WW - 30);
    const y = clamp(P.y + Math.sin(a) * rad, 30, WH - 30);
    const r = Math.random();

    let t = { type: "ghost", hp: 2.2 * tier, speed: 95 + Math.min(75, elapsed / 4) };
    if (elapsed > 45 && r < 0.22) {
      t = { type: "runner", hp: 1.5 * tier, speed: 195 + Math.min(65, elapsed / 5) };
    } else if (elapsed > 100 && r < 0.36) {
      t = { type: "tank", hp: 8 * tier, speed: 60 };
    } else if (elapsed > 80 && r < 0.5 && !ring) {
      t = { type: "shooter", hp: 3 * tier, speed: 88, cd: 1 + Math.random() * 2 };
    }

    enemies.push({ x, y, flash: 0, wob: Math.random() * 6, ...t, hp: Math.ceil(t.hp), max: Math.ceil(t.hp) });
  }

  function update(dt) {
    if (state !== "play") return;

    // 頓挫時間處理
    if (RENDERER.updateEffects(dt)) return;

    elapsed += dt;
    oil -= dt;
    if (oil <= 0) {
      oil = 0;
      state = "lost";
      return;
    }
    if (elapsed >= DAWN) {
      state = "won";
      AUDIO.deliverSuccess();
      return;
    }

    P.inv = Math.max(0, P.inv - dt);
    dashT = Math.max(0, dashT - dt);
    dashCd = Math.max(0, dashCd - dt);
    hintT = Math.max(0, hintT - dt);
    nameT = Math.max(0, nameT - dt);

    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - dt * 5);
      p.vy *= (1 - dt * 5);
      p.life -= dt;
    }
    parts = parts.filter(p => p.life > 0);

    for (const t of texts) {
      t.y -= 32 * dt;
      t.life -= dt;
    }
    texts = texts.filter(t => t.life > 0);

    for (const r of rings) r.life -= dt;
    rings = rings.filter(r => r.life > 0);

    for (const o of orders) o.life -= dt;
    orders = orders.filter(o => o.life > 0);

    orderT -= dt;
    if (orderT <= 0 || orders.length < 3) {
      makeOrder();
      orderT = 5 + Math.random() * 2;
    }

    // 玩家位移
    const m = move();
    const sp = dashT > 0 ? 820 : 295;
    const nx = clamp(P.x + m.x * sp * dt, 24, WW - 24);
    const ny = clamp(P.y + m.y * sp * dt, 24, WH - 24);
    if (!blocked(nx, P.y)) P.x = nx;
    if (!blocked(P.x, ny)) P.y = ny;

    if (keys.has("dash")) dash();

    cargo.x += (P.x - 30 - cargo.x) * Math.min(1, dt * 8);
    cargo.y += (P.y + 18 - cargo.y) * Math.min(1, dt * 8);

    // 武器運算
    weapons(dt);

    // 敵人生成強度計算
    const pw = Object.values(WL).reduce((x, y) => x + y, 0) + b.dmg + b.rate;
    const tier = 1 + elapsed / 65 + pw * 0.05;

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = Math.max(0.3, 1.6 - elapsed * 0.0048);
      const count = Math.min(6, 1 + Math.floor(elapsed / 50));
      for (let k = 0; k < count && enemies.length < 95; k++) {
        spawnEnemy(tier, 560);
      }
    }

    surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = 45;
      const count = 12 + Math.floor(elapsed / 25);
      say("百鬼夜行！妖怪包圍！", P.x, P.y - 75, "#ff8f8f");
      AUDIO.thunder();
      for (let k = 0; k < count; k++) {
        spawnEnemy(tier, 440, (k / count) * 6.283, true);
      }
    }

    // 敵人邏輯與傷害碰撞（純近戰衝撞，完全移除彈幕射擊）
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // 所有怪物皆朝玩家逼近衝撞
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;

      const hitRadius = (e.type === "boss" ? 52 : e.type === "tank" ? 34 : e.type === "mis" ? 32 : 25);
      if (P.inv <= 0 && d < hitRadius) {
        P.hp -= e.type === "tank" ? 2 : 1;
        P.inv = 1.1;
        RENDERER.triggerShake(10);
        burst(P.x, P.y, "#ff8f8f", 16);
        say("受傷！", P.x, P.y - 36, "#ff8f8f");
        AUDIO.hurt();
        if (P.hp <= 0) { state = "lost"; return; }
      }
    }
    enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || dist(e, P) < 1150));

    // Boss 生成
    bossT -= dt;
    if (bossT <= 0 && !enemies.some(e => e.type === "boss")) {
      const a = Math.random() * 6.283;
      const hp = Math.round((16 + level * 2.5) * (1 + pw * 0.05 + elapsed / 190));
      enemies.push({
        x: clamp(P.x + Math.cos(a) * 520, 50, WW - 50),
        y: clamp(P.y + Math.sin(a) * 520, 50, WH - 50),
        type: "boss",
        word: STORE.pick(ALL),
        shield: true,
        hp, max: hp,
        speed: 64,
        flash: 0,
        wob: 0
      });
      bossT = 90;
      say("大妖鬼出現！答對單字即可破除結界", P.x, P.y - 75, "#ff8f8f");
      AUDIO.thunder();
    }

    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (bs && dist(P, bs) < 380) {
      if (!bossQ) bossQ = mkQ(bs);
      bossQ.lock = Math.max(0, bossQ.lock - dt);
    } else {
      bossQ = null;
    }

    // 靈玉經驗吸收
    const att = 110 + b.mag * 80;
    for (const g of gems) {
      const d = dist(P, g);
      if (d < att && d > 0) {
        const s = 240 + (att - d) * 3;
        g.x += ((P.x - g.x) / d) * s * dt;
        g.y += ((P.y - g.y) / d) * s * dt;
      }
      if (d < 24) {
        xp += g.v;
        g.done = true;
        AUDIO.gem();
      }
    }
    gems = gems.filter(g => !g.done);

    // 配送取貨與送貨
    inter = null;
    if (!job) {
      let nd = 62;
      for (const o of orders) {
        const d = Math.hypot(P.x - o.from.dx, P.y - o.from.dy);
        if (d < nd) { nd = d; inter = o; }
      }
    }

    if (job) {
      job.lock = Math.max(0, job.lock - dt);
      let idx = -1;
      if (job.lock <= 0 && dist(P, job.to) < 270) {
        const ps = ansPos(job.to);
        let nd = 34;
        ps.forEach((p, i) => {
          const d = dist(P, p);
          if (d < nd) { nd = d; idx = i; }
        });
      }
      if (idx !== job.idx) {
        job.idx = idx;
        job.hold = 0;
      } else if (idx >= 0) {
        job.hold += dt;
        if (job.hold >= 0.5) resolve(idx);
      }
    }

    // 鏡頭平滑追蹤
    const targetCamX = clamp(P.x - W / 2, 0, WW - W);
    const targetCamY = clamp(P.y - H / 2, 0, WH - H);
    const curCam = RENDERER.getCam();
    RENDERER.setCam(
      curCam.x + (targetCamX - curCam.x) * Math.min(1, dt * 9),
      curCam.y + (targetCamY - curCam.y) * Math.min(1, dt * 9)
    );

    if (xp >= xpNeed()) offerUp();
  }

  // ---------- 繪圖主循環 ----------
  function drawWorld() {
    const cam = RENDERER.getCam();
    const shakeOffset = RENDERER.getShakeOffset();

    ctx.save();
    ctx.translate(-cam.x + shakeOffset.x, -cam.y + shakeOffset.y);

    // 1. 地面與道路
    RENDERER.drawGround(elapsed, DAWN);

    // 2. 町屋建築（帶遠程導引光柱與標記）
    houses.forEach(h => {
      const hasOrder = orders.some(o => o.from === h);
      const isDestination = job && job.to === h;
      RENDERER.drawHouse(h, hintT);

      // 若有待接委託：升起顯眼的金色導引光柱與包裹圖標
      if (hasOrder) {
        const floatY = h.y - 75 + Math.sin(elapsed * 4 + h.id) * 4;
        ctx.save();
        const beam = ctx.createLinearGradient(0, floatY - 24, 0, h.y - 8);
        beam.addColorStop(0, "rgba(255, 215, 80, 0.45)");
        beam.addColorStop(1, "rgba(255, 215, 80, 0)");
        ctx.fillStyle = beam;
        ctx.fillRect(h.x - 10, floatY - 24, 20, h.y - floatY + 16);

        ctx.fillStyle = "#ffd54f";
        ctx.beginPath();
        ctx.arc(h.x, floatY, 13, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.font = "14px sans-serif";
        ctx.fillText("📦", h.x, floatY + 5);
        ctx.restore();
      }

      // 若為送貨目的地：升起靈光鳥居標記
      if (isDestination) {
        const floatY = h.y - 80 + Math.sin(elapsed * 4) * 4;
        ctx.save();
        ctx.fillStyle = "#40c4ff";
        ctx.beginPath();
        ctx.arc(h.x, floatY, 14, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = "15px sans-serif";
        ctx.fillText("⛩", h.x, floatY + 5);
        ctx.restore();
      }
    });

    // 3. 街角提燈 (🏮)
    LAMPS.forEach(l => {
      ctx.fillStyle = "rgba(255, 207, 106, 0.25)";
      ctx.beginPath();
      ctx.arc(l.x, l.y, 48, 0, 6.28);
      ctx.fill();
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏮", l.x, l.y + 10);
    });

    // 4. 委託氣泡 (町屋上方和風繪卷木札)
    for (const o of orders) {
      const h = o.from;
      const floatY = h.y - 120 + Math.sin(elapsed * 3.5 + h.id) * 4;
      const isTarget = (inter === o);

      ctx.save();
      // 繪卷底框（黑漆金箔底）
      ctx.fillStyle = isTarget ? "#fffbf0" : "#f7f0df";
      ctx.beginPath();
      ctx.roundRect(h.x - 84, floatY, 168, 70, 10);
      ctx.fill();
      ctx.strokeStyle = isTarget ? "#ff8833" : "#8c724b";
      ctx.lineWidth = isTarget ? 3.5 : 2;
      ctx.stroke();

      // 金箔頂飾
      ctx.fillStyle = isTarget ? "#ff8833" : "#c29d5b";
      ctx.fillRect(h.x - 84, floatY, 168, 4);

      ctx.textAlign = "center";
      ctx.fillStyle = "#1e1824";
      ctx.font = "900 16px 'Zen Maru Gothic', sans-serif";
      ctx.fillText(o.rev ? `📝 ${o.word.jp}をください` : `${o.word.icon} ${o.word.jp}`, h.x, floatY + 28);

      ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#5c4834";
      ctx.fillText(`送往：${o.to.word.jp}`, h.x, floatY + 50);

      // 剩餘時間條 (金黃至火紅)
      ctx.fillStyle = "#ffa726";
      ctx.fillRect(h.x - 70, floatY + 62, (140 * o.life) / 95, 3.5);
      ctx.restore();

      // 站在門口時顯示專屬取貨標籤
      if (inter === o) {
        ctx.save();
        ctx.fillStyle = "#ffeed4";
        ctx.beginPath();
        ctx.roundRect(h.dx - 45, h.dy - 16, 90, 26, 7);
        ctx.fill();
        ctx.strokeStyle = "#ff8833";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#1a1622";
        ctx.font = "900 13px 'Zen Maru Gothic', sans-serif";
        ctx.fillText("按 E 取貨", h.dx, h.dy + 1);
        ctx.restore();
      }
    }

    // 5. 送達判定圈 (和風結界魔法陣)
    if (job && dist(P, job.to) < 330) {
      ansPos(job.to).forEach((p, i) => {
        const cur = (job.idx === i);
        ctx.save();
        // 陣底柔光
        ctx.fillStyle = cur ? "rgba(255, 235, 140, 0.95)" : "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 35, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = cur ? "#ff7700" : "#c29d5b";
        ctx.lineWidth = cur ? 4.5 : 2.5;
        ctx.stroke();

        // 結界蓄力外環 (站立 0.5 秒)
        if (cur) {
          ctx.strokeStyle = "#ff5500";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 42, -1.57, -1.57 + 6.283 * Math.min(1, job.hold / 0.5));
          ctx.stroke();
        }

        ctx.textAlign = "center";
        if (job.rev) {
          ctx.font = "28px sans-serif";
          ctx.fillText(job.ans[i].icon, p.x, p.y + 10);
        } else {
          ctx.font = "900 16px 'Zen Maru Gothic', sans-serif";
          ctx.fillStyle = "#1e1829";
          ctx.fillText(job.ans[i].jp, p.x, p.y + 6);
        }
        ctx.restore();
      });
    }

    // 6. 靈玉經驗寶石
    for (const g of gems) {
      ctx.fillStyle = "#6bf0ff";
      ctx.beginPath();
      ctx.arc(g.x, g.y, 6, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(g.x - 2, g.y - 2, 2, 0, 6.28);
      ctx.fill();
    }

    // 7. 怪物繪製
    enemies.forEach(e => RENDERER.drawMonster(e, P, elapsed));

    // 8. 武器彈幕 (符咒迴力鏢)
    for (const q of proj) {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(elapsed * 16);
      ctx.fillStyle = "#ffe48a";
      ctx.fillRect(-16, -5, 32, 10);
      ctx.strokeStyle = "#ff3333";
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -5, 32, 10);
      ctx.fillStyle = "#ff3333";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("敕令", 0, 3);
      ctx.restore();
    }

    // 9. 狐火 (Fireball)
    if (WL.fire > 0) {
      const count = WL.fire + 1;
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * 96, fy = P.y + Math.sin(a) * 96;
        ctx.save();
        ctx.fillStyle = "rgba(100, 230, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(fx, fy, 13, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, 6.28);
        ctx.fill();
        ctx.restore();
      }
    }


    // 11. 貨物包裹跟隨
    if (job) {
      ctx.save();
      ctx.fillStyle = "#2c2236";
      ctx.beginPath();
      ctx.roundRect(cargo.x - 16, cargo.y - 16, 32, 32, 8);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#ffeed4";
      ctx.fillText(nameT > 0 && !job.rev ? job.word.icon : "？", cargo.x, cargo.y + 6);
      ctx.restore();
    }

    // 12. 主角 (狐耳快遞員)
    const moveDir = move();
    RENDERER.drawPlayer(P, dashT > 0, P.inv, elapsed, moveDir);

    // 13. 斬擊弧與擊中打擊環
    RENDERER.drawSlashArcs();
    for (const r of rings) {
      const a = r.life / 0.18;
      ctx.strokeStyle = `rgba(255, 235, 140, ${a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, 6.28);
      ctx.stroke();
    }

    // 14. 粒子與飄字
    for (const p of parts) {
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;

    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 17px 'Zen Maru Gothic', sans-serif";
      ctx.fillStyle = t.c;
      ctx.fillText(t.v, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // 15. 浮動傷害數字
    RENDERER.drawDamageNumbers();

    ctx.restore();

    // 16. 動態 2D 光影遮罩（深夜至黎明）
    RENDERER.renderLighting(P, LAMPS, oil, elapsed, DAWN);

    // 17. 櫻花雨與夜行幽火
    RENDERER.drawAtmosphere(elapsed);

    // 18. 送貨目的地導引羅盤 (人魂靈火導引)
    const targetHouse = job ? job.to : orders.reduce((n, o) => (!n || dist(P, o.from) < dist(P, n) ? o.from : n), null);
    if (targetHouse && (targetHouse.x < cam.x || targetHouse.x > cam.x + W || targetHouse.y < cam.y || targetHouse.y > cam.y + H)) {
      const an = Math.atan2(targetHouse.y - P.y, targetHouse.x - P.x);
      const cx = clamp(P.x - cam.x + Math.cos(an) * 210, 50, W - 50);
      const cy = clamp(P.y - cam.y + Math.sin(an) * 210, 95, H - 50);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(an);
      ctx.fillStyle = "#ffd152";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- 輸入監聽 ----------
  const MAP = {
    ArrowLeft: "l", a: "l", A: "l",
    ArrowRight: "r", d: "r", D: "r",
    ArrowUp: "u", w: "u", W: "u",
    ArrowDown: "d", s: "d", S: "d",
    Shift: "dash", " ": "dash"
  };

  addEventListener("keydown", e => {
    if (e.key === "c" || e.key === "C") {
      if (state === "codex") {
        state = codexBack;
      } else if (state === "menu" || state === "won" || state === "lost") {
        codexBack = state;
        state = "codex";
      }
      return;
    }
    if (e.key === "m" || e.key === "M") {
      AUDIO.toggleMute();
      return;
    }
    if (state === "levelup" && "123".includes(e.key)) {
      pickUp(+e.key - 1);
      return;
    }
    if (state !== "play") {
      if (e.key === "Enter" && state !== "levelup" && state !== "codex") start();
      return;
    }
    if (e.key === "e" || e.key === "E") interact();
    else if (bossQ && "123".includes(e.key)) answerBoss(+e.key - 1);
    else if ((e.key === "h" || e.key === "H") && job && oil > 3 && hintT <= 0) {
      oil -= 3;
      hintT = 3.5;
    } else if (MAP[e.key]) {
      e.preventDefault();
      keys.add(MAP[e.key]);
    }
  });

  addEventListener("keyup", e => MAP[e.key] && keys.delete(MAP[e.key]));
  addEventListener("blur", () => { keys.clear(); joy = null; });

  const pp = e => {
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  };
  const hit = (p, bt) => Math.hypot(p.x - bt.x, p.y - bt.y) < bt.r + 10;

  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    AUDIO.init();
    if (e.pointerType !== "mouse") touch = true;
    const p = pp(e);

    if (state === "codex") {
      state = codexBack;
      return;
    }
    if (state === "menu") {
      // 點擊圖鑑鈕
      if (p.x > W - 140 && p.y < 70) {
        codexBack = state;
        state = "codex";
        return;
      }
      return start();
    }
    if (state === "won" || state === "lost") {
      return start();
    }
    if (state === "levelup") {
      const cardW = 240, cardH = 340, startX = 65, gap = 40;
      for (let i = 0; i < 3; i++) {
        const cx = startX + i * (cardW + gap);
        if (p.x >= cx && p.x <= cx + cardW && p.y >= 190 && p.y <= 190 + cardH) {
          pickUp(i);
          return;
        }
      }
      return;
    }
    if (bossQ && p.y > H - 125) {
      const boxW = 680, bx = (W - boxW) / 2, optW = 195;
      for (let i = 0; i < 3; i++) {
        const ox = bx + 22 + i * (optW + 24);
        if (p.x >= ox && p.x <= ox + optW && p.y >= H - 80) {
          answerBoss(i);
          return;
        }
      }
    }
    if (inter && hit(p, btnE)) {
      interact();
    } else if (hit(p, btnD)) {
      dash();
    } else if (p.x < W / 2 && p.y > 80 && !joy) {
      joy = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
    } else if (p.y < 80 && p.x > 700 && job && oil > 3 && hintT <= 0) {
      oil -= 3;
      hintT = 3.5;
    }
  });

  cv.addEventListener("pointermove", e => {
    if (joy?.id !== e.pointerId) return;
    const p = pp(e);
    const dx = p.x - joy.x, dy = p.y - joy.y;
    const n = Math.hypot(dx, dy);
    const s = n > 60 ? 60 / n : 1;
    joy.dx = (dx * s) / 60;
    joy.dy = (dy * s) / 60;
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => {
    cv.addEventListener(ev, e => {
      if (joy?.id === e.pointerId) joy = null;
    });
  });

  // ---------- 遊戲幀迴圈 ----------
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    update(dt);
    AUDIO.updateBgm(dt, state, elapsed, DAWN);

    if ((state === "won" || state === "lost") && !ended) {
      ended = true;
      STORE.finish(score, delivered);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state === "menu") {
      UI.drawMainMenu(ctx, STORE, elapsed);
    } else {
      drawWorld();
      UI.drawHud(
        ctx, P, oil, elapsed, DAWN, delivered, failed, score, level, xp, xpNeed(),
        job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, WL, WI, b
      );
      if (bossQ) UI.drawBossQuiz(ctx, bossQ);
      if (state === "levelup") UI.drawLevelUp(ctx, level, choices);
      if (state === "won" || state === "lost") UI.drawEndScreen(ctx, state, score, delivered, failed, misses);
    }

    if (state === "codex") {
      UI.drawCodex(ctx, STORE, ALL);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
