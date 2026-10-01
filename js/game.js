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
  const getWordDistrictWords = word => {
    if (!word) return [];
    const d = window.DISTRICTS.find(dist => dist.words.some(w => w[0] === word.jp));
    if (!d) return [];
    return d.words
      .filter(w => w[0] !== word.jp)
      .map(w => ({ jp: w[0], zh: w[1], icon: w[2], romaji: w[3] || "" }));
  };

  // ---------- 遊戲狀態 ----------
  const P = { x: 1350, y: 900, inv: 0, faceAng: 0, faceX: 1 };
  const b = { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0 };
  const keys = new Set();
  let state = "menu";
  let elapsed = 0, dawnTimeBonus = 0, warnDawnT = 0, oil = 100, maxOil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let orders = [], job = null, enemies = [], enemyBullets = [], gems = [], parts = [], texts = [], rings = [], misses = [];
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, endCooldown = 0;
  let choices = [], joy = null, touch = false, inter = null, cargo = { x: 0, y: 0 }, pTrail = [], last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };
  const btnPause = { x: W - 52, y: 14, w: 38, h: 52 };
  let gpPrevButtons = [], gpMove = { x: 0, y: 0 };

  let bossT = 75, ended = false, bossQ = null, codexBack = "menu", codexTab = "cards";
  const WL = { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 };
  const WI = {
    katana: { id: "katana", jp: "かたな", zh: "妖刀斬", type: "active", category: "方向斬擊", desc: "揮出凌厲新月刀芒，斬裂前方扇形妖怪" },
    barrier: { id: "barrier", jp: "じょうか", zh: "淨化靈陣", type: "active", category: "全方結界", desc: "展開 360 度除魔陣，週期性震退並重創周身妖怪" },
    fire: { id: "fire", jp: "きつねび", zh: "狐火炎", type: "active", category: "烈焰火把", desc: "周身飛旋烈焰火把，高速甩擊灼燒貼身妖怪" },
    boom: { id: "boom", jp: "おふだ", zh: "陰陽符", type: "active", category: "穿透咒符", desc: "擲出迴旋陰陽符咒，來回穿透路徑上的敵人" },
    thunder: { id: "thunder", jp: "いかずち", zh: "天狐雷", type: "active", category: "天罰落雷", desc: "引導九天金雷轟擊最強妖怪，造成毀滅性打擊" },
    needle: { id: "needle", jp: "せんぼん", zh: "天狐靈針", type: "active", category: "高速靈針", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪" }
  };

  const WEAPON_UPGRADES = {
    katana: [
      "揮出凌厲新月刀芒，斬擊前方扇形妖怪",
      "斬擊半徑大幅擴大，刀芒威力提升 +35%",
      "鋒刃疾馳銳不可當，暴擊機率提升 +20%",
      "雙刃狂瀾！前方連續揮出雙重刀芒",
      "極意・瞬獄無想斬！大範圍毀滅重創"
    ],
    barrier: [
      "展開 360 度除魔陣，週期性震退重創四周敵人",
      "除魔結界範圍大幅擴展，震退衝擊強化",
      "結界激發頻率加快，冷卻時間縮短 25%",
      "除魔波傷害大增，妖怪受擊硬直延長",
      "八咫神鏡結界！全方位金光連續轟殺"
    ],
    fire: [
      "周身飛旋烈焰火把，高速甩擊灼燒貼身敵人",
      "火勢猛烈咆哮，火把旋轉速度大幅加快",
      "烈焰覆蓋半徑擴大，灼燒傷害大幅強化",
      "追加召喚第 3 顆烈焰火把，形成不破火環",
      "三昧真火神輪！火星四濺，形成爆裂烈焰風暴"
    ],
    boom: [
      "擲出穿透陰陽符咒，來回重創路徑上敵人",
      "符咒飛行速度與穿透威力顯著提升",
      "一次擲出 2 枚符咒，覆蓋雙倍扇形路徑",
      "迴旋飛行距離增長，穿透傷害大幅強化",
      "八方敕令封魔符！多枚符咒全屏連續來回穿梭"
    ],
    thunder: [
      "引導九天金雷，精準轟擊全場最強大妖怪",
      "金雷轟擊半徑擴展，雷震擴散傷害強化",
      "落雷數量增加至 2 道，同時轟擊兩名強敵",
      "召雷冷卻時間大幅縮短 30%",
      "九天玄雷狂暴天罰！狂雷連環無情轟殺"
    ],
    needle: [
      "向面朝方向高速散射破魔靈針，貫穿前方妖怪",
      "靈針連射波數增加，穿透力顯著強化",
      "靈針飛行速度大幅提升，命中傷害強化",
      "散射扇面更廣，同時貫穿更多路徑敵人",
      "萬針齊發！化作狂暴破魔針雨席捲全場"
    ]
  };
  let proj = [], needles = [], surgeT = 45, fAng = 0;
  let surgeWarningT = 0, surgePendingCount = 0, surgePendingTier = 1, lastWarningCycle = 0;
  const wT = { boom: 0, thunder: 0, barrier: 0, needle: 0 };

  const UP = [
    { id: "shield", n: "金剛結界", s: "けっかい", cat: "防禦生存", d: "召喚金剛勾玉護盾，抵擋 2 次受傷（可疊加）", f: () => { b.shield = Math.min(6, (b.shield || 0) + 2); }, ok: () => (b.shield || 0) < 6 },
    { id: "oil_max", n: "長明燈油", s: "あぶら", cat: "血厚續航", d: "燈油上限 +30 並立即補滿，常駐每秒回油 +0.22（上限 2 層）", f: () => { maxOil += 30; oil = maxOil; b.oilRegen = Math.min(0.44, (b.oilRegen || 0) + 0.22); }, ok: () => (b.oilRegen || 0) < 0.44 },
    { id: "oil_heal", n: "添燈香油", s: "かいふく", cat: "緊急急救", d: "燈油即刻恢復 +50% 並引發除魔波", f: () => { oil = Math.min(maxOil, oil + maxOil * 0.5); b.oilHealCount = (b.oilHealCount || 0) + 1; burst(P.x, P.y, "#ffd27a", 30); } },
    { id: "dmg", n: "修羅破軍", s: "こうげき", cat: "攻擊爆發", d: "所有武器與法術傷害全面提升 +25%", f: () => { b.dmg += 0.35; } },
    { id: "rate", n: "神樂疾奏", s: "れんぞく", cat: "攻擊爆發", d: "攻擊與秘術冷卻時間縮短 20%", f: () => { b.rate++; }, ok: () => b.rate < 4 },
    { id: "crit", n: "心眼一閃", s: "かいしん", cat: "攻擊爆發", d: "暴擊率 +20%，暴擊傷害大幅躍升", f: () => { b.crit = (b.crit || 0) + 1; }, ok: () => (b.crit || 0) < 3 },
    { id: "spd", n: "神足草履", s: "いどう", cat: "神速機動", d: "移動速度 +15%（最多可疊加 3 次）", f: () => { b.spd = (b.spd || 0) + 1; }, ok: () => (b.spd || 0) < 3 },
    { id: "dash", n: "縮地瞬步", s: "ダッシュ", cat: "神速機動", d: "衝刺冷卻大幅縮短，衝刺附加無敵突進", f: () => { b.dash++; }, ok: () => b.dash < 3 },
    { id: "mag", n: "招財勾玉", s: "じしゃく", cat: "輔助資源", d: "靈玉經驗與物資吸取範圍 +60%", f: () => { b.mag++; }, ok: () => b.mag < 3 }
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
    if (!from || !to) return;

    // 1. 場上活著的誤配妖所代表的詞（妖還在時以戰鬥擊殺複習為主，不發重複委託避免照名牌選答案）
    const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));

    // 2. 當前委託欄與手上包裹已佔用的詞
    const activeOrderWords = new Set(orders.map(o => o.word.jp));
    if (job && job.word) activeOrderWords.add(job.word.jp);

    // 條件 1：若有 missBoost > 1 的詞，場上沒有帶這個詞的活誤配妖，委託欄裡也還沒有它，下一張單直接用它！
    const priorityMissed = ALL.filter(w => {
      const m = STORE.get(w.jp);
      return (m.missBoost || 1) > 1 && !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp);
    });

    let chosenWord;
    if (priorityMissed.length > 0) {
      chosenWord = pick(priorityMissed);
    } else {
      // 條件 2：活著的誤配妖所代表的詞，不要發成委託；且避免與委託欄現有單字重複
      let pool = ALL.filter(w => !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp));
      if (pool.length === 0) pool = ALL.filter(w => !livingMisWords.has(w.jp));
      if (pool.length === 0) pool = ALL;
      chosenWord = STORE.pick(pool);
    }

    orders.push({ from, to, word: chosenWord, rev: Math.random() < 0.5, life: 95 });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      keys.clear();
      joy = null;
    } else if (state === "pause") {
      state = "play";
      last = performance.now();
    }
  }

  function start() {
    AUDIO.init();
    state = "play";
    Object.assign(P, { x: 1350, y: 900, inv: 1.2, faceAng: 0, faceX: 1 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0, crit: 0, oilRegen: 0 });
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 });
    proj = []; needles = []; enemyBullets = []; surgeT = 45; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1; lastWarningCycle = 0;
    wT.boom = 0; wT.thunder = 1; wT.barrier = 1.5; wT.needle = 0.5;
    elapsed = 0; dawnTimeBonus = 0; warnDawnT = 0; oil = 100; maxOil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    orders = []; job = null; enemies = []; gems = []; parts = []; texts = []; rings = []; misses = [];
    bossT = 75; ended = false; bossQ = null; orderT = 3; spawnT = 1; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; endCooldown = 0;
    keys.clear(); joy = null; gpMove = { x: 0, y: 0 };
    pTrail = [];
    for (let i = 0; i <= 24; i++) {
      pTrail.push({ x: P.x - i * 2, y: P.y + 10 });
    }
    cargo = { x: P.x - 44, y: P.y + 10 };
    if (STORE.startRun) STORE.startRun();
    for (let i = 0; i < 4; i++) makeOrder();
    RENDERER.setCam(clamp(P.x - W / 2, 0, WW - W), clamp(P.y - H / 2, 0, WH - H));
  }

  const xpNeed = () => 10 + level * 9;
  const MAX_ACTIVE_WEAPONS = 4;

  function offerUp() {
    const owned = Object.keys(WI).filter(k => (WL[k] || 0) > 0);
    const canLearnNew = owned.length < MAX_ACTIVE_WEAPONS;

    // 武器選項：未滿 4 槽位可學新武器，已滿 4 槽位僅允許升級持有武器
    const eligibleWeaponKeys = Object.keys(WI).filter(k => {
      if (WL[k] >= 5) return false;
      if (WL[k] === 0 && !canLearnNew) return false;
      return true;
    });

    const wc = shuffle(eligibleWeaponKeys).map(k => {
      const isNew = WL[k] === 0;
      const nextLvl = WL[k] + 1;
      const descList = WEAPON_UPGRADES[k] || [];
      const descText = descList[nextLvl - 1] || WI[k].desc;
      return {
        id: k,
        type: "weapon",
        n: WI[k].zh,
        s: WI[k].jp,
        cat: `【 ${WI[k].category} 】`,
        levelText: isNew ? "★ 新解鎖" : `◆ 等級 ${WL[k]} ➔ ${nextLvl}`,
        d: descText,
        f: () => {
          WL[k]++;
          if (k === "boom") wT.boom = 0;
          if (k === "barrier") wT.barrier = 0;
          if (k === "needle") wT.needle = 0;
        }
      };
    });

    const pc = shuffle(UP.filter(u => !u.ok || u.ok())).map(u => ({
      id: u.id,
      type: "passive",
      n: u.n,
      s: u.s,
      cat: `【 ${u.cat} 】`,
      levelText: "◆ 體質修行",
      d: u.d,
      f: u.f
    }));

    if (wc.length > 0 && pc.length > 0) {
      choices = shuffle([...wc.slice(0, 2), ...pc.slice(0, 2)]).slice(0, 3);
    } else if (wc.length > 0) {
      choices = wc.slice(0, 3);
    } else {
      choices = pc.slice(0, 3);
    }

    state = "levelup";
    keys.clear();
    joy = null;
    AUDIO.levelUp();
  }

  function pickUp(i) {
    if (state !== "levelup" || !choices[i]) return;
    const req = xpNeed();
    choices[i].f();
    xp = Math.max(0, xp - req);
    level++;
    state = "play";
    P.inv = 0.6;
    say(`獲得：${choices[i].n}`, P.x, P.y - 45, "#ffe9a0");
    burst(P.x, P.y, "#ffe9a0", 24);
  }

  function interact() {
    if (state !== "play" || !inter || job) return;
    const o = inter;
    orders = orders.filter(x => x !== o);

    // 干擾項優先挑選包裹單字自身所屬區的近義詞（如動物區 ねこ 優先配 いぬ、うさぎ）
    const distractors = shuffle(getWordDistrictWords(o.word));
    while (distractors.length < 2) {
      const other = pick(ALL.filter(w => w.jp !== o.word.jp && !distractors.some(d => d.jp === w.jp)));
      if (other) distractors.push(other);
      else break;
    }
    const finalAns = shuffle([o.word, distractors[0], distractors[1]]);

    job = {
      word: o.word,
      to: o.to,
      ans: finalAns,
      hold: 0,
      idx: -1,
      lock: 0.6,
      rev: o.rev,
      sanctuaryT: 0,
      sanctuaryTriggered: false,
      hintStage: 0,
      eliminatedIdx: -1,
      showMeaningT: 0,
      assisted: false
    };
    nameT = 4.5;
    cargo = { x: pTrail.length > 0 ? pTrail[pTrail.length - 1].x : P.x - 44, y: pTrail.length > 0 ? pTrail[pTrail.length - 1].y : P.y + 10 };
    say(`${o.word.icon} 裝好了`, P.x, P.y - 45, "#ffe9a0");
    AUDIO.pickup();
    AUDIO.speak(o.word.jp);
  }

  function resolve(i) {
    const j = job, w = j.ans[i], pos = ansPos(j.to)[i];
    job = null;
    nameT = 0;

    if (w === j.word) {
      delivered++;
      if (j.assisted) {
        STORE.recAssisted(j.word.jp);
        dawnTimeBonus += 2; // 輔助送達僅加 2 秒黎明推進
        oil = Math.min(maxOil, oil + 10);
        score += 25;
        say(`${w.jp}＝${w.zh} 輔助送達！`, pos.x, pos.y - 35, "#fff0a6");
        say("燈油 +10 點（神助）", pos.x, pos.y - 12, "#ffd27a");
      } else {
        STORE.rec(j.word.jp, true);
        dawnTimeBonus += 10; // 自力送達加速黎明推進 10 秒（不影響怪物難度曲線）
        const gain = 10;
        oil = Math.min(maxOil, oil + 18 + gain);
        score += 50;
        say(`${w.jp}＝${w.zh} 配達完遂！`, pos.x, pos.y - 35, "#fff0a6");
        say(`燈油 +${18 + gain} 點`, pos.x, pos.y - 12, "#ffd27a");
      }
      xp += j.rev ? 14 : 10;
      burst(pos.x, pos.y, "#ffe28b", 32);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
    } else {
      failed++;
      misses.push(j.word);
      STORE.rec(j.word.jp, false);
      say("誤配！單字有誤，瘴氣妖魔現身！", pos.x, pos.y - 36, "#ff8f8f");
      const cappedElapsed = Math.min(elapsed, DAWN);
      enemies.push({
        x: pos.x, y: pos.y + 20,
        type: "mis",
        w: j.word,
        hp: 5 + Math.floor(cappedElapsed / 90),
        max: 5 + Math.floor(cappedElapsed / 90),
        speed: 210 + (b.spd || 0) * 35,
        flash: 0,
        wob: 0
      });

      // 若場上結界的詞與這隻妖相同，用出生時那套排除池重抽，並把 bossQ 設成 null，讓下一幀重出題
      const bs = enemies.find(e => e.type === "boss" && e.shield);
      if (bs && bs.word && bs.word.jp === j.word.jp) {
        const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
        let bossPool = ALL.filter(w => !livingMisWords.has(w.jp));
        if (bossPool.length === 0) bossPool = ALL;
        bs.word = STORE.pick(bossPool);
        bossQ = null;
      }

      say("擊敗誤配妖怪以淨化單字", pos.x, pos.y - 12, "#e5b8ff");
      burst(pos.x, pos.y, "#c98cff", 24);
      RENDERER.triggerShake(6);
      AUDIO.deliverWrong();
      AUDIO.speak(j.word.jp); // 出現時即播一次讀音
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
    score += isMis ? 30 : e.type === "boss" ? 400 : 15;

    if (e.type === "boss") {
      oil = Math.min(maxOil, oil + 35);
      say("大妖鬼擊破！燈油 +35 點", e.x, e.y - 65, "#ffe9a0");
      RENDERER.triggerShake(14);
      for (let k = 0; k < 8; k++) {
        gems.push({ x: e.x + (Math.random() - 0.5) * 70, y: e.y + (Math.random() - 0.5) * 70, v: 6 });
      }
      // 不再誤將擊殺視為單字掌握 STORE.rec
    }

    const gemCount = 1;
    for (let i = 0; i < gemCount; i++) {
      gems.push({ x: e.x + (Math.random() - 0.5) * 28, y: e.y + (Math.random() - 0.5) * 28, v: 2 });
    }
    burst(e.x, e.y, isMis ? "#c98cff" : "#bce9ff", isMis ? 28 : 14);

    if (isMis) {
      // 擊殺誤配妖怪驅散瘴氣，不呼叫 STORE.rec(true) 刷分
      say(`驅散誤配妖怪：${e.w.jp}＝${e.w.zh}`, e.x, e.y - 45, "#f3d9ff");
      RENDERER.triggerShake(7);
      AUDIO.breakShield();
      AUDIO.speak(e.w.jp);
    }
  }

  function dash() {
    if (state !== "play" || dashCd > 0) return;
    const m = move();
    if (Math.hypot(m.x, m.y) < 0.1) return;
    P.faceAng = Math.atan2(m.y, m.x);
    dashT = 0.22;
    dashCd = Math.max(0.6, 1.8 - b.dash * 0.38);
    P.inv = Math.max(P.inv, 0.35);
    burst(P.x, P.y, "#d5f6ff", 12);
    RENDERER.triggerShake(3);
    AUDIO.dash();
  }

  function pollGamepad() {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    const gp = Array.from(gamepads).find(g => g && g.connected);
    if (!gp) return;

    // 1. 蘑菇頭類比搖桿 (左搖桿 axes 0, 1) + 十字鍵 (buttons 12, 13, 14, 15)
    let ax = gp.axes[0] || 0;
    let ay = gp.axes[1] || 0;
    if (Math.hypot(ax, ay) < 0.18) { ax = 0; ay = 0; }
    if (gp.buttons[14]?.pressed) ax = -1;
    if (gp.buttons[15]?.pressed) ax = 1;
    if (gp.buttons[12]?.pressed) ay = -1;
    if (gp.buttons[13]?.pressed) ay = 1;

    const norm = Math.hypot(ax, ay);
    gpMove = norm > 1 ? { x: ax / norm, y: ay / norm } : { x: ax, y: ay };

    // 2. 按鈕邊緣觸發判定 (Edge Trigger)
    const justPressed = i => gp.buttons[i]?.pressed && !gpPrevButtons[i];

    // A 鍵 (Button 0): 互動 / 選卡1 / 確認
    if (justPressed(0)) {
      AUDIO.init();
      if (state === "menu") start();
      else if (state === "levelup") pickUp(0);
      else if (state === "pause") togglePause();
      else if (state === "play" && bossQ) {
        if (bossQ.ans.length > 0) answerBoss(0);
      }
      else if (state === "won" || state === "lost") {
        if (endCooldown <= 0) start();
      }
      else if (state === "play" && inter) interact();
    }

    // B 鍵 (Button 1): 衝刺 / 選卡2
    if (justPressed(1)) {
      if (state === "levelup") pickUp(1);
      else if (state === "play" && bossQ) {
        if (bossQ.ans.length > 1) answerBoss(1);
      }
      else if (state === "play") dash();
    }

    // X 鍵 (Button 2): 提示 / 選卡3
    if (justPressed(2)) {
      if (state === "levelup") pickUp(2);
      else if (state === "play" && bossQ) {
        if (bossQ.ans.length > 2) answerBoss(2);
      }
      else if (state === "play" && job) triggerHint();
    }

    // Start 鍵 (Button 9): 暫停開關
    if (justPressed(9)) {
      if (state === "play" || state === "pause") togglePause();
    }

    // Select 鍵 (Button 8): 圖鑑開關
    if (justPressed(8)) {
      if (state === "codex") {
        state = codexBack;
      } else if (state === "play" || state === "pause" || state === "menu") {
        codexBack = state;
        state = "codex";
      }
    }

    // 在圖鑑內時，LB / RB (Buttons 4, 5) 或左右方向鍵 (14, 15) 切換分頁，B 鍵 (1) 返回
    if (state === "codex") {
      if (justPressed(4) || justPressed(14)) {
        codexTab = "cards";
      } else if (justPressed(5) || justPressed(15)) {
        codexTab = "words";
      }
      if (justPressed(1)) {
        state = codexBack;
      }
    }

    gpPrevButtons = gp.buttons.map(b => b.pressed);
  }

  function move() {
    if (joy) {
      const n = Math.hypot(joy.dx, joy.dy);
      return n < 0.12 ? { x: 0, y: 0 } : { x: joy.dx, y: joy.dy };
    }
    if (Math.hypot(gpMove.x, gpMove.y) > 0.15) {
      return gpMove;
    }
    const x = +keys.has("r") - +keys.has("l");
    const y = +keys.has("d") - +keys.has("u");
    const n = Math.hypot(x, y);
    return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
  }

  const mkQ = bs => {
    const distractors = shuffle(getWordDistrictWords(bs.word));
    while (distractors.length < 2) {
      const other = pick(ALL.filter(w => w.jp !== bs.word.jp && !distractors.some(d => d.jp === w.jp)));
      if (other) distractors.push(other);
      else break;
    }
    return {
      word: bs.word,
      lock: 0.4,
      wasAssisted: false,
      ans: shuffle([bs.word, distractors[0], distractors[1]])
    };
  };

  function answerBoss(i) {
    if (state !== "play") return;
    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (!bossQ || bossQ.lock > 0 || !bs) return;
    if (i < 0 || i >= bossQ.ans.length) return;
    const ok = bossQ.ans[i] === bs.word;

    if (ok) {
      if (bossQ.wasAssisted) {
        STORE.recAssisted(bs.word.jp);
      } else {
        STORE.rec(bs.word.jp, true);
      }
      bs.shield = false;
      bossQ = null;
      say("結界破除！全力進攻！", bs.x, bs.y - 75, "#9be7ff");
      burst(bs.x, bs.y, "#9be7ff", 35);
      RENDERER.triggerShake(9);
      AUDIO.breakShield();
    } else {
      STORE.rec(bs.word.jp, false);
      oil -= 8;
      AUDIO.deliverWrong();
      say("答錯！燈油 -8 點，結界震盪！", P.x, P.y - 50, "#ff8f8f");
      if (oil <= 0) {
        oil = 0;
        state = "lost";
        endCooldown = 1.0;
        return;
      }
      if (bossQ.ans.length > 2) {
        bossQ.ans = bossQ.ans.filter((_, idx) => idx !== i);
        bossQ.wasAssisted = true;
        bossQ.lock = 0.8;
        say("排除錯誤選項，再試一次！", P.x, P.y - 75, "#ffb3ba");
      } else {
        const lastWordJp = bs.word ? bs.word.jp : "";
        const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
        let pool = ALL.filter(w => w.jp !== lastWordJp && !livingMisWords.has(w.jp));
        if (pool.length === 0) pool = ALL.filter(w => w.jp !== lastWordJp);
        if (pool.length === 0) pool = ALL;
        bs.word = STORE.pick(pool);
        bossQ = mkQ(bs);
        bossQ.lock = 1.0;
      }
    }
  }

  function triggerHint() {
    if (!job || oil <= 3 || hintT > 0) return;
    if (!job.hintStage) job.hintStage = 0;
    if (job.hintStage === 0) {
      oil -= 3;
      job.hintStage = 1;
      AUDIO.speak(job.word.jp);
      const wrongIndices = job.ans.map((w, idx) => w !== job.word ? idx : -1).filter(idx => idx >= 0);
      if (wrongIndices.length > 0) {
        job.eliminatedIdx = pick(wrongIndices);
      }
      say(`天狐靈音：念誦「${job.word.jp}」，排除一項！`, P.x, P.y - 45, "#80deea");
      AUDIO.pickup();
    } else if (job.hintStage === 1 && oil > 4) {
      oil -= 4;
      job.hintStage = 2;
      job.assisted = true;
      job.showMeaningT = 4.0;
      hintT = 4.0;
      say(`破幻神符：${job.word.jp} 意為「${job.word.zh}」`, P.x, P.y - 45, "#ffd54f");
      AUDIO.pickup();
    }
  }

  function weapons(dt) {
    // 1. 妖刀斬擊 (Katana) - 方向性扇形斬擊 (依玩家面朝方向前方 140 度扇形索敵，不擊中身後)
    atkT -= dt;
    if (atkT <= 0) {
      const reach = 145 + (WL.katana - 1) * 16;
      const faceAng = P.faceAng || 0;
      let hasEnemyInArc = false;
      for (const e of enemies) {
        if (e.hp > 0 && dist(P, e) <= reach) {
          const eang = Math.atan2(e.y - P.y, e.x - P.x);
          let diff = Math.abs(eang - faceAng);
          while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
          if (diff <= 1.22) {
            hasEnemyInArc = true;
            break;
          }
        }
      }
      if (!hasEnemyInArc) {
        atkT = 0.1;
      } else {
        atkT = Math.max(0.24, 0.72 - b.rate * 0.13);
        RENDERER.addSlashArc(P.x, P.y, reach * 0.85, faceAng);

        // 僅判定面朝方向前方扇形範圍 (角度差 <= 1.22 弧度，約 140 度角)
        for (const e of enemies) {
          if (e.hp > 0) {
            const ed = dist(P, e);
            if (ed <= reach) {
              const eang = Math.atan2(e.y - P.y, e.x - P.x);
              let diff = Math.abs(eang - faceAng);
              while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
              if (diff <= 1.22) {
                const isCrit = Math.random() < (0.2 + (b.crit || 0) * 0.15);
                const mult = isCrit ? (1.8 + (b.crit || 0) * 0.4) : 1.0;
                hurt(e, (b.dmg + (WL.katana - 1) * 0.8) * mult, isCrit);
              }
            }
          }
        }
        AUDIO.slash();
      }
    }

    // 2. 淨化靈陣 (Barrier AoE) - 360 度全方位退魔衝擊環（全新卡牌秘術技能）
    if (WL.barrier > 0) {
      wT.barrier -= dt;
      if (wT.barrier <= 0) {
        wT.barrier = Math.max(1.2, 3.2 - WL.barrier * 0.42 - b.rate * 0.2);
        const r = 140 + WL.barrier * 28;
        // 激發 360 度擴散金色退魔衝擊環
        rings.push({ x: P.x, y: P.y, r: r, maxR: r, life: 0.35, maxL: 0.35, color: "#ffe082" });
        let hitAny = false;
        for (const e of enemies) {
          if (e.hp > 0) {
            const ed = dist(P, e);
            if (ed <= r) {
              hitAny = true;
              const isCrit = Math.random() < (0.15 + (b.crit || 0) * 0.1);
              hurt(e, (2.0 + WL.barrier * 1.1) * b.dmg * (isCrit ? 1.6 : 1.0), isCrit);
              // 強力 360 度外向擊退
              const kx = (e.x - P.x) / (ed || 1);
              const ky = (e.y - P.y) / (ed || 1);
              e.x += kx * (50 + WL.barrier * 10);
              e.y += ky * (50 + WL.barrier * 10);
              burst(e.x, e.y, "#ffe082", 6);
            }
          }
        }
        if (hitAny) RENDERER.triggerShake(5);
        AUDIO.barrier();
      }
    }

    // 3. 天狐靈針 (Needles) - 面朝方向多發穿甲破魔靈針
    if (WL.needle > 0) {
      wT.needle -= dt;
      if (wT.needle <= 0) {
        wT.needle = Math.max(0.45, 1.25 - WL.needle * 0.16 - b.rate * 0.1);
        const count = 3 + (WL.needle >= 3 ? 2 : 0) + (WL.needle >= 5 ? 2 : 0);
        const moveDir = move();
        let shootAng = 0;
        if (Math.hypot(moveDir.x, moveDir.y) > 0.1) {
          shootAng = Math.atan2(moveDir.y, moveDir.x);
        } else {
          let near = null, nd = 450;
          for (const e of enemies) {
            const d = dist(P, e);
            if (e.hp > 0 && d < nd) { near = e; nd = d; }
          }
          shootAng = near ? Math.atan2(near.y - P.y, near.x - P.x) : 0;
        }
        const spread = 0.45;
        for (let i = 0; i < count; i++) {
          const a = shootAng + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
          needles.push({
            x: P.x, y: P.y,
            vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
            life: 0.65,
            dmg: 1.4 + WL.needle * 0.7
          });
        }
        AUDIO.needle();
      }
    }

    for (const nd of needles) {
      nd.x += nd.vx * dt;
      nd.y += nd.vy * dt;
      nd.life -= dt;
      for (const e of enemies) {
        if (e.hp > 0 && !(e.inb > elapsed) && dist(e, nd) < (e.type === "boss" ? 54 : 30)) {
          e.inb = elapsed + 0.2;
          hurt(e, nd.dmg * b.dmg);
          burst(nd.x, nd.y, "#80deea", 4);
        }
      }
    }
    needles = needles.filter(nd => nd.life > 0);

    // 4. 陰陽符咒迴力鏢 (Boomerang)
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
          hurt(e, (1.5 + WL.boom * 0.7) * b.dmg);
        }
      }
    }
    proj = proj.filter(q => !q.done);

    // 5. 狐火環繞 (Fireball)
    if (WL.fire > 0) {
      fAng += dt * 2.8;
      const count = WL.fire + 1;
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * 96, fy = P.y + Math.sin(a) * 96;
        for (const e of enemies) {
          if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - fx, e.y - fy) < (e.type === "boss" ? 54 : 30)) {
            e.ifr = elapsed + 0.42;
            hurt(e, (1.2 + WL.fire * 0.6) * b.dmg);
            burst(fx, fy, "#ff8833", 4);
          }
        }
      }
    }

    // 6. 天狐落雷 (Thunder)
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const c = enemies.filter(e => e.hp > 0 && dist(P, e) < 450);
        if (!c.length) {
          wT.thunder = 0.2;
        } else {
          wT.thunder = Math.max(0.9, 2.6 - WL.thunder * 0.3);
          // 優先鎖定場上血量最高之敵（Boss、精英或滿血坦克），契合卡面「最強妖怪」
          const targets = [...c].sort((a, b) => b.hp - a.hp).slice(0, 1 + (WL.thunder >> 1));
          targets.forEach(t => {
            rings.push({ x: t.x, y: t.y, r: 75, life: 0.22, color: "#fff67a" });
            burst(t.x, t.y - 25, "#fff67a", 18);
            const isCrit = Math.random() < (0.2 + (b.crit || 0) * 0.15);
            const mult = isCrit ? (1.8 + (b.crit || 0) * 0.4) : 1.0;
            for (const e of enemies) {
              if (e.hp > 0 && dist(e, t) < 75) {
                hurt(e, (3.5 + WL.thunder * 1.5) * b.dmg * mult, isCrit);
              }
            }
          });
          AUDIO.thunder();
        }
      }
    }
  }

  function spawnEnemy(tier, rad, ang, ring) {
    let a = ang ?? Math.random() * 6.283;
    let x = clamp(P.x + Math.cos(a) * rad, 30, WW - 30);
    let y = clamp(P.y + Math.sin(a) * rad, 30, WH - 30);
    let tries = 0;
    while (blocked(x, y, 26) && tries < 10) {
      a += 0.63;
      x = clamp(P.x + Math.cos(a) * rad, 30, WW - 30);
      y = clamp(P.y + Math.sin(a) * rad, 30, WH - 30);
      tries++;
    }
    if (blocked(x, y, 26)) return;
    const r = Math.random();

    // 怪物速度曲線：封頂於 300 秒，破曉後加班不增加怪物難度
    const cappedElapsed = Math.min(elapsed, DAWN);
    const speedRamp = (cappedElapsed / DAWN) * 75;
    let t = { type: "ghost", hp: 2.0 * tier, speed: 52 + speedRamp * 0.9 };
    if (cappedElapsed > 45 && r < 0.22) {
      t = { type: "runner", hp: 1.5 * tier, speed: 110 + speedRamp * 1.1 };
    } else if (cappedElapsed > 100 && r < 0.36) {
      t = { type: "tank", hp: 7 * tier, speed: 32 + speedRamp * 0.4 };
    } else if (cappedElapsed > 80 && r < 0.5 && !ring) {
      t = { type: "shooter", hp: 2.8 * tier, speed: 48 + speedRamp * 0.8 };
    }

    enemies.push({ x, y, flash: 0, wob: Math.random() * 6, slowT: 0, ...t, hp: Math.ceil(t.hp), max: Math.ceil(t.hp) });
  }

  function update(dt) {
    if (state !== "play") return;

    // 頓挫時間處理
    if (RENDERER.updateEffects(dt)) return;

    elapsed += dt;
    oil = Math.min(maxOil, oil - dt * 0.85 + (b.oilRegen || 0) * dt); // 燈油自然消耗（長明燈油提供常駐回油）
    if (oil <= 0) {
      oil = 0;
      state = "lost";
      endCooldown = 1.0;
      return;
    }
    if (elapsed + dawnTimeBonus >= DAWN) {
      if (delivered >= 3) {
        state = "won";
        endCooldown = 1.0;
        AUDIO.deliverSuccess();
        return;
      } else {
        if (!warnDawnT || warnDawnT <= 0) {
          warnDawnT = 4.0;
          say("孤燈難明！需完成 3 單配達方能迎來破曉！", P.x, P.y - 75, "#ffb3ba");
        }
      }
    }

    if (warnDawnT > 0) warnDawnT -= dt;

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

    // 玩家位移（基礎速度微調較慢，可藉由卡片提升）
    const m = move();
    if (Math.hypot(m.x, m.y) > 0.05) {
      P.faceAng = Math.atan2(m.y, m.x);
    }
    const baseSpd = 230 + (b.spd || 0) * 35;
    const sp = dashT > 0 ? 780 : baseSpd;
    const nx = clamp(P.x + m.x * sp * dt, 24, WW - 24);
    const ny = clamp(P.y + m.y * sp * dt, 24, WH - 24);
    if (!blocked(nx, P.y)) P.x = nx;
    if (!blocked(P.x, ny)) P.y = ny;

    if (keys.has("dash")) dash();

    // 歷史運動軌跡記錄（伴行式神式軌跡跟隨，完全跟隨玩家歷史走位，絕不與角色重疊）
    if (!pTrail || pTrail.length === 0) {
      pTrail = [{ x: P.x, y: P.y }];
    }
    const lastTrail = pTrail[0];
    const distFromLast = Math.hypot(P.x - lastTrail.x, P.y - lastTrail.y);
    if (distFromLast >= 4) {
      pTrail.unshift({ x: P.x, y: P.y });
      if (pTrail.length > 70) pTrail.pop();
    }

    // 沿著歷史軌跡尋找相距 44px 的座標點作為跟隨夥伴目標
    const FOLLOW_DIST = 44;
    let targetPos = { x: P.x - 44 * (P.face || 1), y: P.y + 10 };
    if (pTrail.length > 0) {
      let accum = 0;
      let prevPt = { x: P.x, y: P.y };
      let found = false;
      for (let i = 0; i < pTrail.length; i++) {
        const pt = pTrail[i];
        const seg = Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
        if (accum + seg >= FOLLOW_DIST) {
          const ratio = seg > 0.001 ? (FOLLOW_DIST - accum) / seg : 0;
          targetPos = {
            x: prevPt.x + (pt.x - prevPt.x) * ratio,
            y: prevPt.y + (pt.y - prevPt.y) * ratio
          };
          found = true;
          break;
        }
        accum += seg;
        prevPt = pt;
      }
      if (!found && pTrail.length > 0) {
        targetPos = { ...pTrail[pTrail.length - 1] };
      }
    }
    cargo.x += (targetPos.x - cargo.x) * Math.min(1, dt * 10);
    cargo.y += (targetPos.y - cargo.y) * Math.min(1, dt * 10);

    // 武器運算
    weapons(dt);

    // 敵人生成強度計算：封頂於 300 秒，破曉後加班不增加怪物難度
    const cappedElapsed = Math.min(elapsed, DAWN);
    const pw = Object.values(WL).reduce((x, y) => x + y, 0) + b.dmg + b.rate;
    const tier = 1 + cappedElapsed / 65 + pw * 0.05;

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = Math.max(0.3, 1.6 - cappedElapsed * 0.0048);
      const count = Math.min(6, 1 + Math.floor(cappedElapsed / 50));
      for (let k = 0; k < count && enemies.length < 95; k++) {
        spawnEnemy(tier, 560);
      }
    }

    // 百鬼夜行階段邏輯（先跳出 3 次閃爍警報，給予玩家 2.4 秒心理準備，之後才湧現百鬼衝擊）
    if (surgeWarningT > 0) {
      surgeWarningT -= dt;
      const progress = 2.4 - surgeWarningT;
      const curCycle = Math.min(3, Math.floor(progress / 0.8) + 1);

      // 每進入一個新的閃爍週期（1, 2, 3），敲響太鼓警報並給予微震動
      if (curCycle !== lastWarningCycle) {
        lastWarningCycle = curCycle;
        AUDIO.warningPulse(curCycle);
        RENDERER.triggerShake(4);
      }

      if (surgeWarningT <= 0) {
        // 3 次閃爍預警結束！百鬼正式大群衝出！
        surgeWarningT = 0;
        lastWarningCycle = 0;
        surgeT = 48; // 下一次百鬼夜行間隔
        AUDIO.thunder();
        RENDERER.triggerShake(14);
        say("百鬼夜行！突破重圍！", P.x, P.y - 75, "#ff3333");
        for (let k = 0; k < surgePendingCount; k++) {
          spawnEnemy(surgePendingTier, 450, (k / surgePendingCount) * 6.283, true);
        }
      }
    } else {
      surgeT -= dt;
      if (surgeT <= 0) {
        // 啟動 2.4 秒預警（閃爍 3 次，每 0.8 秒一次）
        surgeWarningT = 2.4;
        lastWarningCycle = 1;
        AUDIO.warningPulse(1);
        RENDERER.triggerShake(5);
        surgePendingTier = tier;
        surgePendingCount = 12 + Math.floor(cappedElapsed / 25);
      }
    }

    // 敵人邏輯與傷害碰撞（衝撞扣燈油；若有護盾則扣護盾）
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (e.slowT > 0) e.slowT -= dt;
      if (e.type === "mis") {
        e.speed = 210 + (b.spd || 0) * 35;
      }
      const curSpd = (e.slowT && e.slowT > 0) ? Math.min(e.speed, 25) : e.speed;
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // 所有怪物逼近玩家（加入建築物碰撞障礙滑移）
      const stepX = (dx / d) * curSpd * dt;
      const stepY = (dy / d) * curSpd * dt;
      if (!blocked(e.x + stepX, e.y, 16)) e.x += stepX;
      if (!blocked(e.x, e.y + stepY, 16)) e.y += stepY;

      // 射手型妖怪（shooter）：於中距離發射幽冥妖火彈
      if (e.type === "shooter") {
        e.shootCd = (e.shootCd || (2.0 + Math.random())) - dt;
        if (e.shootCd <= 0 && d > 90 && d < 460) {
          e.shootCd = 3.2 + Math.random() * 1.2;
          const bulletSpeed = 230;
          enemyBullets.push({
            x: e.x, y: e.y,
            vx: (dx / d) * bulletSpeed,
            vy: (dy / d) * bulletSpeed,
            life: 2.6
          });
        }
      }

      const hitRadius = (e.type === "boss" ? 52 : e.type === "tank" ? 34 : e.type === "mis" ? 32 : 25);
      if (P.inv <= 0 && d < hitRadius) {
        if (b.shield && b.shield > 0) {
          b.shield--;
          P.inv = 0.85;
          RENDERER.triggerShake(6);
          burst(P.x, P.y, "#ffe28b", 22);
          say(`護盾抵擋！剩餘 ${b.shield}`, P.x, P.y - 45, "#ffe28b");
          AUDIO.breakShield();
        } else {
          const dmg = (e.type === "boss" ? 24 : e.type === "tank" ? 18 : 10);
          oil -= dmg;
          P.inv = 1.0;
          RENDERER.triggerShake(10);
          burst(P.x, P.y, "#ff6b81", 18);
          say(`受傷！燈油 -${dmg} 點`, P.x, P.y - 36, "#ff6b81");
          AUDIO.hurt();
          if (oil <= 0) {
            oil = 0;
            state = "lost";
            endCooldown = 1.0;
            return;
          }
        }
      }
    }

    // 敵人幽冥妖火彈更新
    for (const eb of enemyBullets) {
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;
      if (dist(P, eb) < 20 && P.inv <= 0) {
        eb.life = 0;
        if (b.shield && b.shield > 0) {
          b.shield--;
          P.inv = 0.8;
          RENDERER.triggerShake(5);
          say(`護盾抵擋！剩餘 ${b.shield}`, P.x, P.y - 45, "#ffe28b");
          AUDIO.breakShield();
        } else {
          const dmg = 8;
          oil -= dmg;
          P.inv = 0.85;
          RENDERER.triggerShake(7);
          burst(P.x, P.y, "#ff6b81", 14);
          say(`妖火中彈！燈油 -${dmg} 點`, P.x, P.y - 36, "#ff6b81");
          AUDIO.hurt();
          if (oil <= 0) {
            oil = 0;
            state = "lost";
            endCooldown = 1.0;
            return;
          }
        }
      }
    }
    enemyBullets = enemyBullets.filter(eb => eb.life > 0);
    enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || e.type === "mis" || dist(e, P) < 1150));

    // Boss 生成（數值與速度封頂於 300 秒）
    bossT -= dt;
    if (bossT <= 0 && !enemies.some(e => e.type === "boss")) {
      const a = Math.random() * 6.283;
      const cappedElapsed = Math.min(elapsed, DAWN);
      const hp = Math.round((16 + level * 2.5) * (1 + pw * 0.05 + cappedElapsed / 190));
      const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
      let bossPool = ALL.filter(w => !livingMisWords.has(w.jp));
      if (bossPool.length === 0) bossPool = ALL;
      enemies.push({
        x: clamp(P.x + Math.cos(a) * 520, 50, WW - 50),
        y: clamp(P.y + Math.sin(a) * 520, 50, WH - 50),
        type: "boss",
        word: STORE.pick(bossPool),
        shield: true,
        hp, max: hp,
        speed: 40 + (cappedElapsed / DAWN) * 45,
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

    // 配送取貨（只要碰撞或貼著町屋任何一側，即可按 E 接案）
    inter = null;
    if (!job) {
      let nd = 46;
      for (const o of orders) {
        const h = o.from;
        const cx = clamp(P.x, h.x - 48, h.x + 48);
        const cy = clamp(P.y, h.y - 25, h.y + 45);
        const d = Math.hypot(P.x - cx, P.y - cy);
        if (d < nd) { nd = d; inter = o; }
      }
    }

    if (job) {
      job.lock = Math.max(0, job.lock - dt);
      const toDist = dist(P, job.to);

      // 式神退魔結界：當接近目的地町屋（< 140px，踏入答題圓陣範圍）時激發結界
      if (toDist < 140 && !job.sanctuaryTriggered) {
        job.sanctuaryTriggered = true;
        job.sanctuaryT = 2.8;
        AUDIO.sanctuary();
        say("式神結界展開・靜心答題！", job.to.x, job.to.y - 30, "#ffe082");
      }

      if (job.sanctuaryT > 0) {
        job.sanctuaryT -= dt;
        // 結界震退衝擊：將 240px 內的怪物強力推開並施加暫時緩速，推動時檢查建築物阻擋
        for (const e of enemies) {
          const ed = dist(job.to, e);
          if (ed < 240) {
            const pushAng = Math.atan2(e.y - job.to.y, e.x - job.to.x);
            const px = Math.cos(pushAng) * 200 * dt;
            const py = Math.sin(pushAng) * 200 * dt;
            if (!blocked(e.x + px, e.y, 16)) e.x += px;
            if (!blocked(e.x, e.y + py, 16)) e.y += py;
            e.slowT = 0.8;
          }
        }
        // 消除結界半徑內的幽冥妖火彈，保護答題專注
        for (const eb of enemyBullets) {
          if (dist(job.to, eb) < 240) {
            eb.life = 0;
            burst(eb.x, eb.y, "#ffe082", 4);
          }
        }
      }

      if (job.showMeaningT > 0) {
        job.showMeaningT -= dt;
      }

      let idx = -1;
      if (job.lock <= 0 && toDist < 270) {
        const ps = ansPos(job.to);
        let nd = 38;
        ps.forEach((p, i) => {
          if (job.eliminatedIdx === i) return;
          const d = dist(P, p);
          if (d < nd) { nd = d; idx = i; }
        });
      }
      if (idx !== job.idx) {
        job.idx = idx;
        job.hold = 0;
      } else if (idx >= 0) {
        job.hold += dt;
        if (job.hold >= 0.45) resolve(idx);
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
    RENDERER.drawGround(elapsed + dawnTimeBonus, DAWN);

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

    // 3. 街角石燈。畫在角色之前，腳底對齊燈位；圖還沒載入時退回提燈符號。
    LAMPS.forEach(l => {
      ctx.fillStyle = "rgba(255, 207, 106, 0.25)";
      ctx.beginPath();
      ctx.arc(l.x, l.y, 48, 0, 6.28);
      ctx.fill();
      const lamp = window.ART && window.ART.prop_lantern;
      if (lamp && lamp.complete && lamp.naturalWidth) {
        const lw = 34;
        const lh = lw * lamp.naturalHeight / lamp.naturalWidth;
        ctx.drawImage(lamp, l.x - lw / 2, l.y - lh + 8, lw, lh);
      } else {
        ctx.font = "26px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🏮", l.x, l.y + 10);
      }
    });

    // 4. 委託氣泡移至頂層 (15.5) 繪製，確保永不被建築、角色或陰影遮擋

    // 5. 送達判定圈 (和風結界魔法陣 + 退魔結界視覺)
    if (job && dist(P, job.to) < 330) {
      // 式神退魔結界環
      if (job.sanctuaryT > 0) {
        ctx.save();
        const alpha = Math.min(0.85, job.sanctuaryT / 1.5);
        ctx.strokeStyle = `rgba(255, 215, 64, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(job.to.x, job.to.y, 200, 0, 6.28);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 235, 140, ${alpha * 0.12})`;
        ctx.fill();

        ctx.fillStyle = `rgba(255, 235, 140, ${alpha})`;
        ctx.font = "900 13px 'Kaisei Decol', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✦ 式 神 結 界 ✦", job.to.x, job.to.y - 210);
        ctx.restore();
      }

      ansPos(job.to).forEach((p, i) => {
        const cur = (job.idx === i);
        const isEliminated = (job.eliminatedIdx === i);
        const isTarget = (job.ans[i] === job.word);
        const showMeaning = (job.showMeaningT > 0 && isTarget);

        ctx.save();
        if (isEliminated) {
          ctx.fillStyle = "rgba(100, 100, 110, 0.45)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 35, 0, 6.28);
          ctx.fill();
          ctx.strokeStyle = "rgba(150, 150, 160, 0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.fillStyle = "#888899";
          ctx.font = "900 18px 'Zen Maru Gothic', sans-serif";
          ctx.fillText(job.ans[i].jp, p.x, p.y + 6);
          // 畫排除叉號
          ctx.strokeStyle = "#e57373";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x - 16, p.y - 16); ctx.lineTo(p.x + 16, p.y + 16);
          ctx.moveTo(p.x + 16, p.y - 16); ctx.lineTo(p.x - 16, p.y + 16);
          ctx.stroke();
          ctx.restore();
          return;
        }

        // 正常答題陣底
        ctx.fillStyle = cur ? "rgba(255, 235, 140, 0.98)" : "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 36, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = cur ? "#ff7700" : "#c29d5b";
        ctx.lineWidth = cur ? 5 : 2.5;
        ctx.stroke();

        // 結界蓄力外環 (站立 0.45 秒)
        if (cur) {
          ctx.strokeStyle = "#ff5500";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 44, -1.57, -1.57 + 6.283 * Math.min(1, job.hold / 0.45));
          ctx.stroke();
        }

        ctx.textAlign = "center";
        // 放大字體至 22px，並繪製白色外描邊以保證極高辨識度！
        ctx.font = "900 22px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeText(job.ans[i].jp, p.x, p.y + (showMeaning ? 0 : 8));
        ctx.fillStyle = "#161224";
        ctx.fillText(job.ans[i].jp, p.x, p.y + (showMeaning ? 0 : 8));

        if (showMeaning) {
          ctx.font = "bold 13px 'Noto Sans JP', sans-serif";
          ctx.fillStyle = "#d84315";
          ctx.fillText(`【${job.ans[i].zh}】`, p.x, p.y + 19);
        }
        ctx.restore();
      });
    }

    // 敵人幽冥妖火彈
    for (const eb of enemyBullets) {
      ctx.save();
      ctx.fillStyle = "#ba68c8";
      ctx.shadowColor = "#ea80fc";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 8, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 3.5, 0, 6.28);
      ctx.fill();
      ctx.restore();
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

    // 9. 烈焰神火飛旋 (Swinging Torch / Foxfire - 甩火把熱血流光與跳動火舌)
    if (WL.fire > 0) {
      const count = Math.min(5, WL.fire + 1);
      const orbitR = 98;
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * orbitR;
        const fy = P.y + Math.sin(a) * orbitR;

        ctx.save();

        // 1. 火把旋轉弧形拖尾流光 (Curved Flame Trail Ribbon - 甩火把甩出的烈火光弧)
        const trailSteps = 16;
        const trailSpan = 0.85; // 弧度約 50 度
        for (let s = 0; s < trailSteps; s++) {
          const t1 = s / trailSteps;
          const t2 = (s + 1) / trailSteps;
          const a1 = a - t1 * trailSpan;
          const a2 = a - t2 * trailSpan;
          const w = 15 * (1 - t1 * 0.85); // 靠近頭部 15px，末端縮小至 2px
          const alpha = (1 - t1) * 0.85;

          ctx.strokeStyle = t1 < 0.25 ? `rgba(255, 235, 120, ${alpha})` : (t1 < 0.6 ? `rgba(255, 110, 20, ${alpha})` : `rgba(215, 35, 0, ${alpha * 0.7})`);
          ctx.lineWidth = w;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(P.x, P.y, orbitR, a2, a1);
          ctx.stroke();
        }

        // 2. 火把頭部大範圍溫暖火光 (Torch Head Blazing Aura)
        const flameAura = ctx.createRadialGradient(fx, fy, 2, fx, fy, 32);
        flameAura.addColorStop(0, "rgba(255, 245, 180, 0.95)");
        flameAura.addColorStop(0.3, "rgba(255, 140, 20, 0.8)");
        flameAura.addColorStop(0.65, "rgba(230, 45, 0, 0.45)");
        flameAura.addColorStop(1, "rgba(180, 20, 0, 0)");
        ctx.fillStyle = flameAura;
        ctx.beginPath();
        ctx.arc(fx, fy, 32, 0, 6.28);
        ctx.fill();

        // 3. 甩火把有機舞動火舌 (Dynamic Flickering Flame Teardrop & Tongues)
        // 火焰隨速度切線向後甩動 (Tangent vector)
        const moveAng = a + Math.PI / 2; // 前進切線方向
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(moveAng);

        const flick = Math.sin(elapsed * 24 + i * 3) * 3;
        const flick2 = Math.cos(elapsed * 32 + i * 2) * 2;

        // 外層赤烈火焰本體
        ctx.fillStyle = "#ff4500";
        ctx.beginPath();
        ctx.moveTo(0, 16); // 火尖朝前
        ctx.bezierCurveTo(12, 6, 14 + flick2, -10, 6, -22 + flick); // 甩向後方的火舌
        ctx.bezierCurveTo(0, -14, -6, -24 - flick, -14 - flick2, -8);
        ctx.bezierCurveTo(-12, 6, -8, 12, 0, 16);
        ctx.closePath();
        ctx.fill();

        // 內層金黃熾熱火芯
        ctx.fillStyle = "#ffb300";
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.bezierCurveTo(8, 4, 9, -6, 4, -14 + flick * 0.7);
        ctx.bezierCurveTo(0, -9, -4, -15 - flick * 0.7, -9, -5);
        ctx.bezierCurveTo(-8, 4, -5, 9, 0, 12);
        ctx.closePath();
        ctx.fill();

        // 核心白熱極高溫火球核心
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 2, 5, 0, 6.28);
        ctx.fill();

        ctx.restore();

        // 4. 甩火把脫離飛濺火星 (Flying Torch Sparks / Embers)
        for (let sp = 0; sp < 4; sp++) {
          const spPhase = (elapsed * 5 + sp * 0.25 + i * 0.3) % 1;
          const spAng = a - spPhase * 0.65 + (Math.sin(sp * 4) * 0.08);
          const spR = orbitR + Math.sin(sp * 8 + elapsed * 10) * 12;
          const spx = P.x + Math.cos(spAng) * spR;
          const spy = P.y + Math.sin(spAng) * spR;
          const spSize = (1 - spPhase) * 3 + 1;
          ctx.fillStyle = sp % 2 === 0 ? "#fff176" : "#ff7043";
          ctx.fillRect(spx - spSize / 2, spy - spSize / 2, spSize, spSize);
        }

        ctx.restore();
      }
    }


    // 11. 貨物包裹伴行（單一圓形式神法玉，無多重形狀嵌套，完全跟隨玩家歷史軌跡）
    if (job) {
      ctx.save();
      const floatBob = Math.sin(elapsed * 5) * 3;
      const cyPos = cargo.y + floatBob;
      const r = 18;

      // 1. 地面柔和陰影
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cargo.x, cargo.y + 20, 16, 6, 0, 0, 6.28);
      ctx.fill();

      // 2. 式神金光光暈
      ctx.shadowColor = "rgba(255, 215, 80, 0.75)";
      ctx.shadowBlur = 12;

      // 3. 單一圓形御神玉本體（白玉暖底 + 金色精緻描邊，無任何四邊形外框）
      ctx.fillStyle = "#fffdf2";
      ctx.beginPath();
      ctx.arc(cargo.x, cyPos, r, 0, 6.28);
      ctx.fill();

      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 4. 內圈細緻金環飾邊
      ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cargo.x, cyPos, r - 3.5, 0, 6.28);
      ctx.stroke();

      // 5. 清晰貨物圖標直接置中呈現（花、彩虹、書、魚等，直接與地面日文配對）
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "20px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      ctx.fillText(job.word.icon || "📦", cargo.x, cyPos + 1);
      ctx.textBaseline = "alphabetic";

      ctx.restore();
    }

    // 12. 主角 (狐耳快遞員 - 雙幀走動與金剛結界護盾)
    const moveDir = move();
    RENDERER.drawPlayer(P, dashT > 0, P.inv, elapsed, moveDir, b.shield || 0);

    // 12.5 破魔靈針彈幕
    for (const nd of needles) {
      ctx.save();
      const ang = Math.atan2(nd.vy, nd.vx);
      ctx.translate(nd.x, nd.y);
      ctx.rotate(ang);
      ctx.fillStyle = "#e0f7fa";
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 8;
      ctx.fillRect(-12, -2, 24, 4);
      ctx.restore();
    }

    // 13. 斬擊弧與結界擊中環
    RENDERER.drawSlashArcs();
    for (const r of rings) {
      const maxL = r.maxL || 0.32;
      const progress = 1 - (r.life / maxL);
      const curR = r.maxR ? (r.maxR * (0.35 + 0.65 * progress)) : r.r;
      const a = Math.max(0, r.life / maxL);
      ctx.save();
      ctx.strokeStyle = r.color || `rgba(255, 235, 140, ${a})`;
      ctx.lineWidth = 3 + (1 - progress) * 2;
      ctx.shadowColor = r.color || "#ffe28b";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(r.x, r.y, curR, 0, 6.28);
      ctx.stroke();
      if (r.maxR) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, curR * 0.75, 0, 6.28);
        ctx.stroke();
      }
      ctx.restore();
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

    // 15.5 委託氣泡與接案標籤（最上層繪製，確保永不被建築、角色、怪物或陰影遮擋）
    for (const o of orders) {
      const h = o.from;
      const floatY = h.y - 128 + Math.sin(elapsed * 3.5 + h.id) * 4;
      const isTarget = (inter === o);

      ctx.save();
      // 繪卷底框（寬度足 196px，確保圖標與文字完整展示不被遮擋截斷）
      const bw = 196, bh = 42;
      const bx = h.x - bw / 2;
      ctx.fillStyle = isTarget ? "#fffdf5" : "#f7f0df";
      ctx.beginPath();
      ctx.roundRect(bx, floatY, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = isTarget ? "#ff8833" : "#8c724b";
      ctx.lineWidth = isTarget ? 3.5 : 2;
      ctx.stroke();

      // 金箔頂飾
      ctx.fillStyle = isTarget ? "#ff8833" : "#c29d5b";
      ctx.fillRect(bx, floatY, bw, 3.5);

      ctx.textAlign = "center";
      ctx.fillStyle = "#1e1824";
      ctx.font = "900 14px 'Zen Maru Gothic', 'Noto Sans JP', sans-serif";
      // 委託送什麼東西一句話就好，送往哪裡不需要顯示
      ctx.fillText(`${o.word.icon} 委託：送「${o.word.jp}」`, h.x, floatY + 23);

      // 剩餘時間條 (金黃至火紅)
      ctx.fillStyle = isTarget ? "#ff8833" : "#ffa726";
      ctx.fillRect(h.x - 76, floatY + 34, (152 * o.life) / 95, 3);
      ctx.restore();

      // 靠近町屋時，在木札正下方懸掛「按 E 接案」小金標（懸掛於屋前，最頂層繪製）
      if (isTarget) {
        ctx.save();
        const tagY = floatY + 48;
        // 連接木札與按鍵標籤的雙金繩
        ctx.strokeStyle = "#d4af37";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(h.x - 26, floatY + 42);
        ctx.lineTo(h.x - 26, tagY);
        ctx.moveTo(h.x + 26, floatY + 42);
        ctx.lineTo(h.x + 26, tagY);
        ctx.stroke();

        // 金標本體
        ctx.fillStyle = "#ffeed4";
        ctx.beginPath();
        ctx.roundRect(h.x - 48, tagY, 96, 24, 6);
        ctx.fill();
        ctx.strokeStyle = "#ff8833";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#1a1622";
        ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
        ctx.fillText("按 E 接案", h.x, tagY + 16);
        ctx.restore();
      }
    }

    ctx.restore();

    // 16. 動態 2D 光影遮罩（深夜至黎明）
    RENDERER.renderLighting(P, LAMPS, oil, elapsed + dawnTimeBonus, DAWN);

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
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (state === "codex") {
        state = codexBack;
        return;
      }
      if (state === "play" || state === "pause") {
        togglePause();
        return;
      }
    }
    if (e.key === "c" || e.key === "C") {
      if (state === "codex") {
        state = codexBack;
      } else if (state === "menu" || state === "won" || state === "lost" || state === "pause") {
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
      if (e.key === "Enter" && state !== "levelup" && state !== "codex" && state !== "pause") {
        if ((state === "won" || state === "lost") && endCooldown > 0) return;
        start();
      }
      return;
    }
    if (e.key === "e" || e.key === "E") interact();
    else if (bossQ && "123".includes(e.key)) {
      const idx = +e.key - 1;
      if (idx >= 0 && idx < bossQ.ans.length) answerBoss(idx);
    }
    else if ((e.key === "h" || e.key === "H") && job) {
      triggerHint();
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

    // 檢查右上角暫停鈕點擊
    if (p.x >= btnPause.x && p.x <= btnPause.x + btnPause.w && p.y >= btnPause.y && p.y <= btnPause.y + btnPause.h) {
      if (state === "play" || state === "pause") {
        togglePause();
        return;
      }
    }

    if (state === "pause") {
      const btnW = UI.PAUSE_BTN_W || 280, btnH = UI.PAUSE_BTN_H || 44;
      const bx = W / 2 - btnW / 2;
      for (const btn of UI.PAUSE_BTNS) {
        if (p.x >= bx && p.x <= bx + btnW && p.y >= btn.y && p.y <= btn.y + btnH) {
          if (btn.id === "resume") togglePause();
          else if (btn.id === "mute") AUDIO.toggleMute();
          else if (btn.id === "cards") { codexBack = "pause"; codexTab = "cards"; state = "codex"; }
          else if (btn.id === "codex") { codexBack = "pause"; codexTab = "words"; state = "codex"; }
          else if (btn.id === "menu") { state = "menu"; }
          return;
        }
      }
      return;
    }

    if (state === "codex") {
      // 點擊頂部標籤頁切換
      const tabW = 160, tabH = 32, tabY = 56;
      const tabCardsX = W / 2 - tabW - 8, tabWordsX = W / 2 + 8;
      if (p.y >= tabY && p.y <= tabY + tabH) {
        if (p.x >= tabCardsX && p.x <= tabCardsX + tabW) {
          codexTab = "cards";
          return;
        }
        if (p.x >= tabWordsX && p.x <= tabWordsX + tabW) {
          codexTab = "words";
          return;
        }
      }

      // 點擊底部返回按鈕或外圍區域
      if (p.y >= 548 && p.y <= 590 && p.x >= W / 2 - 95 && p.x <= W / 2 + 95) {
        state = codexBack;
        return;
      }
      if (p.x < 30 || p.x > W - 30 || p.y < 20 || p.y > 590) {
        state = codexBack;
        return;
      }
      return;
    }
    if (state === "menu") {
      // 點擊右上角卡片一覽與單字圖鑑鈕
      if (p.y >= 20 && p.y <= 62) {
        if (p.x >= W - 290 && p.x <= W - 155) {
          codexBack = state;
          codexTab = "cards";
          state = "codex";
          return;
        }
        if (p.x >= W - 150 && p.x <= W - 15) {
          codexBack = state;
          codexTab = "words";
          state = "codex";
          return;
        }
      }
      return start();
    }
    if (state === "won" || state === "lost") {
      if (endCooldown > 0) return;
      // 檢查是否點擊了結算畫面的「再戰御札」按鈕區域（使用 UI.RESTART_BTN 同步座標）
      const r = UI.RESTART_BTN;
      if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        return start();
      }
      return;
    }
    if (state === "levelup") {
      const cardW = 248, cardH = 385, startX = 60, gap = 44, cy = 170;
      for (let i = 0; i < 3; i++) {
        const cx = startX + i * (cardW + gap);
        if (p.x >= cx && p.x <= cx + cardW && p.y >= cy && p.y <= cy + cardH) {
          pickUp(i);
          return;
        }
      }
      return;
    }
    if (bossQ && p.y >= H - 128 && p.y <= H - 128 + 105) {
      const boxW = 690, bx = (W - boxW) / 2, by = H - 128;
      const n = bossQ.ans.length;
      const optW = n === 2 ? 260 : 200, optH = 46;
      const gap = n === 2 ? 36 : 24;
      const totalW = n * optW + (n - 1) * gap;
      const startX = bx + (boxW - totalW) / 2;
      for (let i = 0; i < n; i++) {
        const ox = startX + i * (optW + gap);
        const oy = by + 46;
        if (p.x >= ox && p.x <= ox + optW && p.y >= oy && p.y <= oy + optH) {
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
    } else if (p.y < 80 && p.x > 300 && p.x < 600 && job) {
      triggerHint();
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

    // 不論遊戲處於何種狀態（結算、升級或暫停），每幀精準倒數冷卻時間
    if (endCooldown > 0) {
      endCooldown = Math.max(0, endCooldown - dt);
    }

    // 手把輪詢（包含搖桿蘑菇頭與按鈕）
    pollGamepad();

    if (state === "play") {
      update(dt);
    }
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
        ctx, P, oil, maxOil, elapsed + dawnTimeBonus, DAWN, delivered, failed, score, level, xp, xpNeed(),
        job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT
      );
      if (surgeWarningT > 0) UI.drawSurgeWarning(ctx, surgeWarningT);
      if (bossQ) UI.drawBossQuiz(ctx, bossQ);
      if (state === "levelup") UI.drawLevelUp(ctx, level, choices, WL, WI);
      if (state === "pause") UI.drawPauseMenu(ctx, AUDIO.isMuted ? AUDIO.isMuted() : false);
      if (state === "won" || state === "lost") UI.drawEndScreen(ctx, state, score, delivered, failed, misses);
    }

    if (state === "codex") {
      UI.drawCodex(ctx, STORE, ALL, codexTab);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
