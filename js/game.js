(() => {
  "use strict";

  const W = 900, H = 600;
  const CFG = window.GAME_CONFIG;
  let STAGE = window.CONTENT.getStage("night-town");
  let STAGE_PACING = STAGE.pacing || {};
  let STAGE_VISUAL = STAGE.visual || {};
  let STAGE_ENEMY = STAGE.enemy || {};
  let START = STAGE.start || { x: 1350, y: 900 };
  let DAWN = STAGE_PACING.runSeconds || CFG.RUN_SECONDS;
  let GOAL_DELIVERIES = STAGE_PACING.goalDeliveries || CFG.GOAL_DELIVERIES;
  let BOSS_TIMES = STAGE_PACING.bossTimes || CFG.BOSS_TIMES;
  let SURGE_FIRST = STAGE_PACING.surgeFirst || CFG.SURGE_FIRST;
  let SURGE_INTERVAL = STAGE_PACING.surgeInterval || CFG.SURGE_INTERVAL;
  let XP_NEED_SCALE = STAGE_PACING.xpNeedScale || 1;
  let SPAWN_INTERVAL_SCALE = STAGE_PACING.spawnIntervalScale || 1;
  let SPAWN_COUNT_BONUS = STAGE_PACING.spawnCountBonus || 0;
  const cv = document.getElementById("game");

  // 初始化高畫質渲染引擎
  RENDERER.init(cv);
  const ctx = RENDERER.getCtx();
  CONTROLS.mount();
  const controlsButton = document.getElementById("controls-open");
  const viewBounds = () => window.VIEWPORT?.bounds() || {left:0,top:0,right:W,bottom:H,width:W,height:H};
  const isPortrait = () => window.innerWidth <= 900 && window.innerHeight >= window.innerWidth;
  addEventListener("resize", () => {
    RENDERER.resize?.(); joy = null;
    if (isPortrait()) suspend();
    else wakeAudio();
  });

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

  // ---------- Stage / Word Pack / Chunk 世界 ----------
  let WORLD_STATE = window.WORLD.createStageWorld(STAGE, window.CONTENT);
  const houses = [], solids = [], LAMPS = [], activeChunks = [];
  const ALL = window.CONTENT.getStageWords(STAGE);
  const CODEX_ALL = window.CONTENT.getAllWords ? window.CONTENT.getAllWords() : ALL;
  const blocked = (x, y, r = 18) => solids.some(s => Math.hypot(x - clamp(x, s.x0, s.x1), y - clamp(y, s.y0, s.y1)) < r);
  function knockback(e, distance) {
    const length = dist(P, e) || 1;
    const steps = Math.ceil(distance / 8);
    const dx = (e.x - P.x) / length * distance / steps;
    const dy = (e.y - P.y) / length * distance / steps;
    // 小步分軸檢查沿途碰撞，避免落點安全但中途穿越建築。
    for (let i = 0; i < steps; i++) {
      if (!blocked(e.x + dx, e.y, 16)) e.x += dx;
      if (!blocked(e.x, e.y + dy, 16)) e.y += dy;
    }
  }
  const ansPos = h => [{ x: h.x - 85, y: h.y + 75 }, { x: h.x + 85, y: h.y + 75 }, { x: h.x, y: h.y + 122 }];
  const getWordDistrictWords = word => window.CONTENT.getSiblingWords(word);

  // ---------- 遊戲狀態 ----------
  const P = { x: START.x, y: START.y, inv: 0, faceAng: 0, faceX: 1 };
  const b = { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0 };
  const keys = new Set(), heldCodes = new Set();
  let state = "menu";
  let menuFocus = 0, menuFocusState = "menu", gpMenuDir = "";
  function menuButtons() {
    if (menuFocusState !== state) { menuFocus = 0; menuFocusState = state; }
    return state === "menu" ? UI.MENU_BTNS : state === "pause" ? UI.PAUSE_BTNS : state === "won" || state === "lost" ? UI.END_BTNS : null;
  }
  function moveMenu(delta) {
    const buttons = menuButtons();
    menuFocus = (menuFocus + delta + buttons.length) % buttons.length;
  }
  function returnHome() {
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    state = "menu"; menuFocus = 0; menuFocusState = state;
  }
  function activateMenu(id) {
    if ((state === "won" || state === "lost") && endCooldown > 0) return;
    if (id === "start") enterOverworld();
    else if (id === "restart") start();
    else if (id === "world") enterOverworld(false);
    else if (id === "resume") togglePause();
    else if (id === "mute") AUDIO.toggleMute();
    else if (id === "controls") controlsButton.click();
    else if (id === "tutorial") showTutorial('pickup', true);
    else if (id === "menu") returnHome();
    else if (id === "cards" || id === "codex") { codexBack = state; codexTab = id === "cards" ? "cards" : "words"; state = "codex"; }
  }
  let overworld = window.OVERWORLD.createState("gate");
  let overworldNoticeT = 0;
  let gpOverworldDir = "";
  let elapsed = 0, warnDawnT = 0, oil = 100, maxOil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let orders = [], job = null, enemies = [], enemyBullets = [], gems = [], parts = [], texts = [], rings = [], misses = [];
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, endCooldown = 0;
  let dashDir = { x: 1, y: 0 };
  let choices = [], levelupCooldown = 0, joy = null, touch = window.matchMedia?.("(pointer: coarse)")?.matches || false, inter = null, cargo = { x: 0, y: 0 }, pTrail = [], last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };
  const btnPause = { x: W - 52, y: 14, w: 38, h: 52 };
  let gpPrevButtons = [], gpMove = { x: 0, y: 0 };

  let bossT = BOSS_TIMES[0], bossStage = 0, finalBossDefeated = false;
  let finalBossPos = null, victorySeq = null;
  let ended = false, bossQ = null, codexBack = "menu", codexTab = "cards", codexPage = 0;
  let worldSyncSignature = "";

  // Only operation guidance: never reads the current word or mutates answer assistance.
  const tutorialIds = ['pickup', 'listen', 'delivery', 'dash', 'boss'];
  let tutorial = null, tutorialSeen = new Set(), tutorialSkipped = false;
  let inputMode = touch ? 'touch' : 'keyboard';
  try {
    const saved = JSON.parse(localStorage.getItem('yokai-tutorial-v1'));
    tutorialSkipped = saved === 'skip';
    if (Array.isArray(saved)) tutorialSeen = new Set(saved.filter(id => tutorialIds.includes(id)));
  } catch {}
  function showTutorial(id, replay = false) {
    tutorial = { id, replay, focus: 0 };
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
  }
  function closeTutorial(skip = false) {
    if (!tutorial) return;
    if (tutorial.replay) {
      const next = tutorialIds[tutorialIds.indexOf(tutorial.id) + 1];
      if (!skip && next) { showTutorial(next, true); return; }
    } else {
      tutorialSeen.add(tutorial.id);
      if (skip) tutorialSkipped = true;
      try { localStorage.setItem('yokai-tutorial-v1', JSON.stringify(tutorialSkipped ? 'skip' : [...tutorialSeen])); } catch {}
    }
    tutorial = null;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
  }
  function checkTutorial() {
    if (tutorialSkipped || tutorial) return;
    const id = bossQ && !tutorialSeen.has('boss') ? 'boss' : job && dist(P, job.to) < 230 && tutorialSeen.has('listen') && !tutorialSeen.has('delivery') ? 'delivery'
      : job && !tutorialSeen.has('listen') ? 'listen' : elapsed >= 12 && !tutorialSeen.has('dash') ? 'dash'
      : !job && !tutorialSeen.has('pickup') ? 'pickup' : null;
    if (id && !tutorialSeen.has(id)) showTutorial(id);
  }

  function replaceList(target, source) {
    target.splice(0, target.length, ...source);
  }

  function configureStage(stageId = "night-town") {
    STAGE = window.CONTENT.getStage(stageId);
    STAGE_PACING = STAGE.pacing || {};
    STAGE_VISUAL = STAGE.visual || {};
    STAGE_ENEMY = STAGE.enemy || {};
    START = STAGE.start || { x: 1350, y: 900 };
    DAWN = STAGE_PACING.runSeconds || CFG.RUN_SECONDS;
    GOAL_DELIVERIES = STAGE_PACING.goalDeliveries || CFG.GOAL_DELIVERIES;
    BOSS_TIMES = STAGE_PACING.bossTimes || CFG.BOSS_TIMES;
    SURGE_FIRST = STAGE_PACING.surgeFirst || CFG.SURGE_FIRST;
    SURGE_INTERVAL = STAGE_PACING.surgeInterval || CFG.SURGE_INTERVAL;
    XP_NEED_SCALE = STAGE_PACING.xpNeedScale || 1;
    SPAWN_INTERVAL_SCALE = STAGE_PACING.spawnIntervalScale || 1;
    SPAWN_COUNT_BONUS = STAGE_PACING.spawnCountBonus || 0;
    WORLD_STATE = window.WORLD.createStageWorld(STAGE, window.CONTENT);
    replaceList(ALL, window.CONTENT.getStageWords(STAGE));
  }

  function syncWorld(force = false) {
    const pinned = new Set();
    for (const o of orders) {
      if (o.from?.chunkKey) pinned.add(o.from.chunkKey);
      if (o.to?.chunkKey) pinned.add(o.to.chunkKey);
    }
    if (job?.to?.chunkKey) pinned.add(job.to.chunkKey);

    const pinList = [...pinned].sort();
    const signature = `${WORLD_STATE.keyAt(P.x, P.y)}|${pinList.join(";")}`;
    if (!force && signature === worldSyncSignature) return;

    const snapshot = WORLD_STATE.update(P.x, P.y, pinList);
    replaceList(activeChunks, snapshot.chunks);
    replaceList(houses, snapshot.houses);
    replaceList(solids, snapshot.solids);
    replaceList(LAMPS, snapshot.lamps);
    worldSyncSignature = signature;
  }
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
      "斬擊距離 +16，基礎傷害 +0.8",
      "斬擊距離 +16，基礎傷害再 +0.8",
      "斬擊距離 +16，基礎傷害再 +0.8",
      "斬擊距離 +16，基礎傷害再 +0.8"
    ],
    barrier: [
      "展開 360 度除魔陣，週期性震退重創四周敵人",
      "範圍、傷害提升，冷卻縮短",
      "範圍、傷害提升，冷卻再縮短",
      "範圍、傷害提升，冷卻再縮短",
      "範圍、傷害提升至最高階"
    ],
    fire: [
      "召喚 2 顆狐火環繞護身",
      "狐火增加至 3 顆，傷害提升",
      "狐火增加至 4 顆，傷害提升",
      "狐火增加至 5 顆，傷害提升",
      "維持 5 顆狐火，傷害提升至最高階"
    ],
    boom: [
      "擲出穿透陰陽符咒，來回重創路徑上敵人",
      "符咒傷害提升，冷卻縮短",
      "一次擲出 2 枚符咒",
      "符咒傷害提升，冷卻再縮短",
      "一次擲出 3 枚符咒"
    ],
    thunder: [
      "引導九天金雷，精準轟擊全場最強大妖怪",
      "同時鎖定 2 名強敵，傷害提升",
      "落雷傷害提升，冷卻縮短",
      "同時鎖定 3 名強敵",
      "落雷傷害提升至最高階"
    ],
    needle: [
      "向面朝方向高速散射破魔靈針，貫穿前方妖怪",
      "靈針傷害提升，冷卻縮短",
      "靈針增加至 5 發，傷害提升",
      "靈針傷害提升，冷卻再縮短",
      "靈針增加至 7 發"
    ]
  };
  let proj = [], needles = [], surgeT = SURGE_FIRST, fAng = 0;
  let surgeWarningT = 0, surgePendingCount = 0, surgePendingTier = 1, lastWarningCycle = 0;
  const wT = { boom: 0, thunder: 0, barrier: 0, needle: 0, fire: 0 };

  const UP = [
    { id: "shield", n: "金剛結界", s: "けっかい", cat: "防禦生存", d: "召喚金剛勾玉護盾，抵擋 2 次受傷（可疊加）", f: () => { b.shield = Math.min(6, (b.shield || 0) + 2); }, ok: () => (b.shield || 0) < 6 },
    { id: "oil_max", n: "長明燈油", s: "あぶら", cat: "血厚續航", d: "燈油上限 +30 並立即補滿，常駐每秒回油 +0.22（上限 2 層）", f: () => { maxOil += 30; oil = maxOil; b.oilRegen = Math.min(0.44, (b.oilRegen || 0) + 0.22); }, ok: () => (b.oilRegen || 0) < 0.44 },
    { id: "oil_heal", n: "添燈香油", s: "かいふく", cat: "緊急急救", d: "恢復 50% 燈油，並震退周圍妖怪", f: () => {
      oil = Math.min(maxOil, oil + maxOil * 0.5);
      rings.push({ x: P.x, y: P.y, r: 210, maxR: 210, life: 0.38, maxL: 0.38, color: "#a5d6a7" });
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const ed = dist(P, e);
        if (ed > 210) continue;
        hurt(e, 3.2 * b.dmg);
        knockback(e, 90);
      }
      burst(P.x, P.y, "#a5d6a7", 30);
      AUDIO.barrier();
    } },
    { id: "dmg", n: "修羅破軍", s: "こうげき", cat: "攻擊爆發", d: "整體傷害係數 +0.35", f: () => { b.dmg += 0.35; } },
    { id: "rate", n: "神樂疾奏", s: "れんぞく", cat: "攻擊爆發", d: "妖刀、結界、靈針冷卻縮短", f: () => { b.rate++; }, ok: () => b.rate < 4 },
    { id: "crit", n: "心眼一閃", s: "かいしん", cat: "攻擊爆發", d: "妖刀/天雷暴擊率 +15%，結界 +10%", f: () => { b.crit = (b.crit || 0) + 1; }, ok: () => (b.crit || 0) < 3 },
    { id: "spd", n: "神足草履", s: "いどう", cat: "神速機動", d: "移動速度約 +15%（最多 3 層）", f: () => { b.spd = (b.spd || 0) + 1; }, ok: () => (b.spd || 0) < 3 },
    { id: "dash", n: "縮地瞬步", s: "ダッシュ", cat: "神速機動", d: "衝刺冷卻大幅縮短，衝刺附加無敵突進", f: () => { b.dash++; }, ok: () => b.dash < 3 },
    { id: "mag", n: "招財勾玉", s: "じしゃく", cat: "輔助資源", d: "靈玉吸取範圍 +80", f: () => { b.mag++; }, ok: () => b.mag < 3 }
  ];

  const say = (v, x, y, c = "#fff") => texts.push({ v, x, y, c, life: 1.8 });
  function burst(x, y, c, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 80 + Math.random() * 200;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c, r: 2 + Math.random() * 3.5, life: 0.35 + Math.random() * 0.35 });
    }
  }

  function makeOrder() {
    const orderCap = CFG.orderSlots(elapsed, delivered);
    if (orders.length >= orderCap) return;
    const busy = new Set(orders.map(o => o.from.id));
    const localHouses = houses.filter(h => dist(P, h) < 2200);
    const from = pick(localHouses.filter(h => !busy.has(h.id)));
    if (!from) return;
    const to = pick(localHouses.filter(h => h !== from && dist(h, from) > 420 && dist(h, from) < 2000));
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

    // 配達本體固定採「圖像／中文語意 → 日文假名」辨識。
    // 台灣日語學習者若改成中文落地答案，只是在做圖片找母語，學習價值很低。
    orders.push({ from, to, word: chosenWord, rev: false, life: 110 });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      keys.clear(); heldCodes.clear();
      joy = null;
    } else if (state === "pause" && !isPortrait() && !document.hidden) {
      state = "play";
      AUDIO.setSuspended(false);
      last = performance.now();
    }
  }

  function enterOverworld(reset = true) {
    window.loadGameArt?.();
    if (reset) overworld = window.OVERWORLD.createState("gate");
    overworldNoticeT = 0;
    keys.clear(); heldCodes.clear();
    joy = null;
    gpOverworldDir = "";
    state = "overworld";
  }

  function moveOverworld(dx, dy) {
    if (state !== "overworld") return false;
    return window.OVERWORLD.move(overworld, dx, dy);
  }

  function confirmOverworld() {
    if (state !== "overworld") return;
    const result = window.OVERWORLD.confirm(overworld);
    if (result.ok && result.stageId) {
      start(result.stageId);
      return;
    }
    if (result.locked) {
      overworldNoticeT = 1.5;
      AUDIO.warningPulse(1);
    }
  }

  function start(stageId = STAGE.id) {
    window.loadGameArt?.();
    configureStage(stageId);
    AUDIO.init();
    state = "play";
    tutorial = null;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    Object.assign(P, { x: START.x, y: START.y, inv: 1.2, faceAng: 0, faceX: 1 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0, crit: 0, oilRegen: 0 });
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 });
    proj = []; needles = []; enemyBullets = []; surgeT = SURGE_FIRST; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1; lastWarningCycle = 0;
    wT.boom = 0; wT.thunder = 1; wT.barrier = 1.5; wT.needle = 0.5; wT.fire = 0;
    elapsed = 0; warnDawnT = 0; oil = 100; maxOil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    orders = []; job = null; enemies = []; gems = []; parts = []; texts = []; rings = []; misses = [];
    bossStage = 0; bossT = BOSS_TIMES[0]; finalBossDefeated = false; finalBossPos = null; victorySeq = null;
    ended = false; bossQ = null; orderT = 5; spawnT = 8; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; endCooldown = 0;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    pTrail = [];
    for (let i = 0; i <= 24; i++) {
      pTrail.push({ x: P.x - i * 2, y: P.y + 10 });
    }
    cargo = { x: P.x - 44, y: P.y + 10 };
    if (STORE.startRun) STORE.startRun(STAGE.id);
    WORLD_STATE.reset();
    worldSyncSignature = "";
    syncWorld(true);
    makeOrder();
    RENDERER.setCam(P.x - W / 2, P.y - H / 2);
    checkTutorial();
  }

  const xpNeed = () => Math.round(CFG.xpNeed(level) * XP_NEED_SCALE);
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
    levelupCooldown = 0.4;
    keys.clear(); heldCodes.clear();
    joy = null;
    AUDIO.levelUp();
  }

  function pickUp(i) {
    if (state !== "levelup" || levelupCooldown > 0 || !choices[i]) return;
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
        oil = Math.min(maxOil, oil + 10);
        score += 25;
        say(`${w.jp}＝${w.zh} 輔助送達！`, pos.x, pos.y - 35, "#fff0a6");
        say("燈油 +10 點（神助）", pos.x, pos.y - 12, "#ffd27a");
      } else {
        STORE.rec(j.word.jp, true);
        const gain = 10;
        oil = Math.min(maxOil, oil + 18 + gain);
        score += 50;
        say(`${w.jp}＝${w.zh} 配達完遂！`, pos.x, pos.y - 35, "#fff0a6");
        say(`燈油 +${18 + gain} 點`, pos.x, pos.y - 12, "#ffd27a");
      }
      xp += 12;
      burst(pos.x, pos.y, "#ffe28b", 32);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
    } else {
      failed++;
      misses.push(j.word);
      STORE.rec(j.word.jp, false);
      say("誤配！單字有誤，瘴氣妖魔現身！", pos.x, pos.y - 36, "#ff8f8f");
      const cappedElapsed = Math.min(elapsed, DAWN);
      const awayX = pos.x - j.to.x;
      const awayY = pos.y - j.to.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      let spawnX = pos.x + (awayX / awayLen) * 118;
      let spawnY = pos.y + (awayY / awayLen) * 118;
      if (blocked(spawnX, spawnY, 34)) {
        spawnX = pos.x - (awayY / awayLen) * 118;
        spawnY = pos.y + (awayX / awayLen) * 118;
      }
      enemies.push({
        x: spawnX, y: spawnY,
        type: "mis",
        w: j.word,
        hp: 5 + Math.floor(cappedElapsed / 180),
        max: 5 + Math.floor(cappedElapsed / 180),
        speed: 210 + (b.spd || 0) * 35,
        revealT: 0.9,
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
      AUDIO.bossDeath();
      if (e.final) {
        finalBossDefeated = true;
        finalBossPos = { x: e.x, y: e.y };
      }
      oil = Math.min(maxOil, oil + 35);
      say(e.final ? "夜明けの大妖鬼 撃破！" : "大妖鬼擊破！燈油 +35", e.x, e.y - 65, "#ffe9a0");
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
    if (Math.hypot(m.x, m.y) < 0.1) {
      m.x = Math.cos(P.faceAng);
      m.y = Math.sin(P.faceAng);
    }
    dashDir = { x: m.x, y: m.y };
    P.faceAng = Math.atan2(m.y, m.x);
    dashT = 0.22;
    dashCd = Math.max(0.6, 1.8 - b.dash * 0.38);
    P.inv = Math.max(P.inv, 0.35);
    burst(P.x, P.y, "#d5f6ff", 12);
    RENDERER.triggerShake(3);
    AUDIO.dash();
  }

  function startVictorySequence() {
    if (victorySeq || state !== "play") return;
    const p = finalBossPos || { x: P.x, y: P.y - 120 };
    victorySeq = {
      t: 0,
      bossX: p.x,
      bossY: p.y,
      burst2: false,
      burst3: false,
      purgeStarted: false
    };
    state = "victory";
    keys.clear(); heldCodes.clear();
    joy = null;
    bossQ = null;
    job = null;
    orders = [];
    inter = null;
    enemyBullets = [];
    burst(p.x, p.y, "#ffd180", 70);
    burst(p.x, p.y, "#ff5252", 48);
    rings.push({ x: p.x, y: p.y, life: 0.9, maxL: 0.9, maxR: 170, color: "#ffcc80" });
    RENDERER.triggerShake(18);
    AUDIO.thunder();
  }

  function updateVictorySequence(dt) {
    if (!victorySeq) return;
    victorySeq.t += dt;
    const t = victorySeq.t;

    if (t >= 0.28 && !victorySeq.burst2) {
      victorySeq.burst2 = true;
      burst(victorySeq.bossX, victorySeq.bossY, "#fff3b0", 58);
      rings.push({ x: victorySeq.bossX, y: victorySeq.bossY, life: 0.7, maxL: 0.7, maxR: 220, color: "#fff3b0" });
      RENDERER.triggerShake(11);
    }
    if (t >= 0.58 && !victorySeq.burst3) {
      victorySeq.burst3 = true;
      burst(victorySeq.bossX, victorySeq.bossY, "#c77dff", 72);
      AUDIO.breakShield();
    }
    if (t >= 0.78 && !victorySeq.purgeStarted) {
      victorySeq.purgeStarted = true;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        e.vanish = 1;
        burst(e.x, e.y, e.type === "mis" ? "#e1bee7" : "#bce9ff", 18);
      }
      RENDERER.triggerShake(8);
    }

    if (victorySeq.purgeStarted) {
      const vanish = Math.max(0, 1 - (t - 0.78) / 0.82);
      for (const e of enemies) e.vanish = vanish;
      if (vanish <= 0) enemies = [];
    }

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

    // Boss 爆散 → 小怪灰飛煙滅 → 曙光完整亮起 → 保留 2 秒餘韻再結算。
    if (t >= 4.8) {
      state = "won";
      endCooldown = 0.8;
    }
  }

  function pollGamepad() {
    if (isPortrait() || document.hidden) {
      gpMove = { x: 0, y: 0 };
      // 消耗遮罩期間的按鈕狀態，回橫向後需重新按下。
      const gp = navigator.getGamepads?.()?.find(g => g && g.connected);
      gpPrevButtons = gp ? gp.buttons.map(b => b.pressed) : [];
      return;
    }
    if (!navigator.getGamepads) {
      gpMove = { x: 0, y: 0 };
      gpPrevButtons = [];
      gpOverworldDir = "";
      return;
    }
    const gamepads = navigator.getGamepads();
    if (!gamepads) {
      gpMove = { x: 0, y: 0 };
      gpPrevButtons = [];
      gpOverworldDir = "";
      return;
    }
    const gp = Array.from(gamepads).find(g => g && g.connected);
    if (!gp) {
      gpMove = { x: 0, y: 0 };
      gpPrevButtons = [];
      gpOverworldDir = "";
      return;
    }

    if (CONTROLS.isOpen()) {
      CONTROLS.gamepad(gp, gpPrevButtons);
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      gpMove = { x: 0, y: 0 };
      return;
    }
    if (tutorial) {
      if (gp.buttons.some((b, i) => b.pressed && !gpPrevButtons[i]) || gp.axes.some(a => Math.abs(a) > 0.55)) inputMode = 'gamepad';
      const pressed = i => gp.buttons[i]?.pressed && !gpPrevButtons[i];
      if (pressed(12) || pressed(13) || pressed(14) || pressed(15)) tutorial.focus = 1 - tutorial.focus;
      if (pressed(1) || pressed(9)) closeTutorial(true);
      else if (pressed(0)) closeTutorial(tutorial.focus === 1);
      gpPrevButtons = gp.buttons.map(b => b.pressed); gpMove = { x: 0, y: 0 };
      return;
    }
    // 1. 蘑菇頭類比搖桿 (左搖桿 axes 0, 1) + 十字鍵 (buttons 12, 13, 14, 15)
    let ax = gp.axes[0] || 0;
    let ay = gp.axes[1] || 0;
    if (gp.buttons.some((b,i) => b.pressed && !gpPrevButtons[i]) || Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55) inputMode = 'gamepad';
    if (Math.hypot(ax, ay) < 0.18) { ax = 0; ay = 0; }
    if (gp.buttons[14]?.pressed) ax = -1;
    if (gp.buttons[15]?.pressed) ax = 1;
    if (gp.buttons[12]?.pressed) ay = -1;
    if (gp.buttons[13]?.pressed) ay = 1;

    const norm = Math.hypot(ax, ay);
    gpMove = norm > 1 ? { x: ax / norm, y: ay / norm } : { x: ax, y: ay };

    // 2. 按鈕邊緣觸發判定 (Edge Trigger)
    const justPressed = i => gp.buttons[i]?.pressed && !gpPrevButtons[i];

    if (state === "overworld") {
      let dir = "";
      if (Math.abs(ax) > Math.abs(ay) && Math.abs(ax) > 0.55) dir = ax > 0 ? "right" : "left";
      else if (Math.abs(ay) > 0.55) dir = ay > 0 ? "down" : "up";
      if (dir && dir !== gpOverworldDir) {
        if (dir === "left") moveOverworld(-1, 0);
        else if (dir === "right") moveOverworld(1, 0);
        else if (dir === "up") moveOverworld(0, -1);
        else if (dir === "down") moveOverworld(0, 1);
      }
      gpOverworldDir = dir;
    } else {
      gpOverworldDir = "";
    }

    const buttons = menuButtons();
    if (buttons) {
      const dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0.55 ? 1 : ax < -0.55 ? -1 : 0) : (ay > 0.55 ? 1 : ay < -0.55 ? -1 : 0);
      if (dir && dir !== gpMenuDir) moveMenu(dir);
      gpMenuDir = dir;
      if (justPressed(0)) { AUDIO.init(); activateMenu(buttons[menuFocus].id); }
      else if (justPressed(1) || justPressed(9)) { if (state === 'pause') togglePause(); else if (state === 'won' || state === 'lost') returnHome(); }
      else if (justPressed(8)) activateMenu('codex');
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      return;
    }
    gpMenuDir = '';

    // A 鍵 (Button 0): 互動 / 選卡1 / 確認
    if (justPressed(0)) {
      AUDIO.init();
      if (state === "overworld") confirmOverworld();
      else if (state === "levelup") pickUp(0);
      else if (state === "play" && inter) interact();
    }

    // B 鍵 (Button 1): 衝刺 / 選卡2
    if (justPressed(1)) {
      if (state === "overworld") returnHome();
      else if (state === "levelup") pickUp(1);
      else if (state === "play") dash();
    }

    // X 鍵 (Button 2): 提示 / 選卡3
    if (justPressed(2)) {
      if (state === "levelup") pickUp(2);
      else if (state === "play" && job) triggerHint();
    }

    // Boss 答題專用：LB / RB / Y；保留 A 取貨、B 衝刺、X 提示。
    if (state === "play" && bossQ) {
      if (justPressed(4)) answerBoss(0);
      else if (justPressed(5)) answerBoss(1);
      else if (justPressed(3) && bossQ.ans.length > 2) answerBoss(2);
    }

    // Start 鍵 (Button 9): 暫停開關
    if (justPressed(9)) {
      if (state === "play" || state === "pause") togglePause();
    }

    // Select 鍵 (Button 8): 圖鑑開關
    if (justPressed(8)) {
      if (state === "codex") {
        state = codexBack;
      } else if (state === "play" || state === "pause" || state === "menu" || state === "overworld") {
        codexBack = state;
        state = "codex";
      }
    }

    // 圖鑑：LB / RB 切換頁籤；十字鍵左右翻單字頁；B 返回。
    if (state === "codex") {
      if (justPressed(4)) {
        codexTab = "cards";
      } else if (justPressed(5)) {
        codexTab = "words";
      }
      if (codexTab === "words") {
        if (justPressed(14)) turnCodexPage(-1);
        else if (justPressed(15)) turnCodexPage(1);
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
      misses.push(bs.word);
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
    if (state !== "play" || !job || oil <= 3 || hintT > 0) return;
    if (!job.hintStage) job.hintStage = 0;
    if (job.hintStage === 0) {
      oil -= 3;
      job.hintStage = 1;
      job.assisted = true;
      AUDIO.speak(job.word.jp);
      const wrongIndices = job.ans.map((w, idx) => w !== job.word ? idx : -1).filter(idx => idx >= 0);
      if (wrongIndices.length > 0) {
        job.eliminatedIdx = pick(wrongIndices);
      }
      say("天狐靈音：聆聽發音，排除一項！（輔助）", P.x, P.y - 45, "#80deea");
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
              knockback(e, 50 + WL.barrier * 10);
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
          shootAng = near ? Math.atan2(near.y - P.y, near.x - P.x) : P.faceAng;
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
      wT.fire = Math.max(0, wT.fire - dt);
      let fireHit = false;
      fAng += dt * 2.8;
      const count = Math.min(5, WL.fire + 1);
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * 96, fy = P.y + Math.sin(a) * 96;
        for (const e of enemies) {
          if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - fx, e.y - fy) < (e.type === "boss" ? 54 : 30)) {
            e.ifr = elapsed + 0.42;
            const hpBefore = e.hp;
            hurt(e, (1.2 + WL.fire * 0.6) * b.dmg);
            if (e.hp < hpBefore) fireHit = true;
            burst(fx, fy, "#ff8833", 4);
          }
        }
      }
      if (fireHit && wT.fire <= 0) { AUDIO.fireball(); wT.fire = 0.15; }
    }

    // 6. 天狐落雷 (Thunder)
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const c = enemies.filter(e => e.hp > 0 && !e.shield && dist(P, e) < 450);
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

  function spawnRadius(minimum) {
    const area = viewBounds(), cam = RENDERER.getCam();
    const lag = Math.hypot(P.x - (cam.x + W / 2), P.y - (cam.y + H / 2));
    return Math.max(minimum, Math.hypot(area.width / 2, area.height / 2) + lag + 64);
  }

  function spawnPosition(rad, angle, collisionRadius) {
    for (let tries = 0; tries <= 10; tries++) {
      const a = angle + tries * 0.63;
      const x = P.x + Math.cos(a) * rad, y = P.y + Math.sin(a) * rad;
      if (!blocked(x, y, collisionRadius)) return { x, y };
    }
    return null;
  }

  function spawnEnemy(tier, rad, ang, ring) {
    const position = spawnPosition(spawnRadius(rad), ang ?? Math.random() * 6.283, 26);
    if (!position) return;
    const r = Math.random();

    // 怪物速度曲線：封頂於 10 分鐘，破曉後加班不再增加怪物難度。
    const cappedElapsed = Math.min(elapsed, DAWN);
    const speedRamp = (cappedElapsed / DAWN) * 75;
    const stageSpeed = STAGE_ENEMY.speedScale || 1;
    const shooterBonus = STAGE_ENEMY.shooterChanceBonus || 0;
    let t = { type: "ghost", hp: 2.0 * tier, speed: (52 + speedRamp * 0.9) * stageSpeed };
    if (cappedElapsed > 90 && r < 0.22) {
      t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
    } else if (cappedElapsed > 200 && r < 0.36) {
      t = { type: "tank", hp: 7 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
    } else if (cappedElapsed > 160 && r < 0.5 + shooterBonus && !ring) {
      t = { type: "shooter", hp: 2.8 * tier, speed: (48 + speedRamp * 0.8) * stageSpeed };
    }

    enemies.push({ ...position, flash: 0, wob: Math.random() * 6, slowT: 0, ...t, hp: Math.ceil(t.hp), max: Math.ceil(t.hp) });
  }

  function update(dt) {
    if (state !== "play") return;
    if (isPortrait()) { suspend(); return; }
    checkTutorial();
    if (tutorial) return;

    // 頓挫時間處理
    if (RENDERER.updateEffects(dt)) return;

    elapsed += dt;
    oil = Math.min(maxOil, oil - dt * 0.43 + (b.oilRegen || 0) * dt); // 10 分鐘制：總自然耗油維持接近舊 5 分鐘制
    if (oil <= 0) {
      oil = 0;
      state = "lost";
      endCooldown = 1.0;
      return;
    }
    if (elapsed >= DAWN) {
      if (delivered >= GOAL_DELIVERIES && finalBossDefeated) {
        startVictorySequence();
        return;
      } else {
        if (!warnDawnT || warnDawnT <= 0) {
          warnDawnT = 4.0;
          const need = Math.max(0, GOAL_DELIVERIES - delivered);
          say(need > 0 ? `あと配達 ${need}` : "大妖鬼を倒せ！", P.x, P.y - 75, "#ffb3ba");
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
    const desiredOrders = CFG.orderSlots(elapsed, delivered);
    if (orderT <= 0 || orders.length < desiredOrders) {
      makeOrder();
      orderT = 7 + Math.random() * 3;
    }

    // 玩家位移（基礎速度微調較慢，可藉由卡片提升）
    const m = dashT > 0 ? dashDir : move();
    if (Math.hypot(m.x, m.y) > 0.05) {
      P.faceAng = Math.atan2(m.y, m.x);
    }
    const baseSpd = 230 + (b.spd || 0) * 35;
    const sp = dashT > 0 ? 780 : baseSpd;
    const nx = P.x + m.x * sp * dt;
    const ny = P.y + m.y * sp * dt;
    if (!blocked(nx, P.y)) P.x = nx;
    if (!blocked(P.x, ny)) P.y = ny;
    syncWorld();

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

    // 加大圖案後保留 64px 間距，短軌跡與原地停留也不會藏到角色下方。
    const FOLLOW_DIST = 64;
    let targetPos = { x: P.x - FOLLOW_DIST * (P.faceX || 1), y: P.y + 10 };
    if (pTrail.length > 0) {
      let accum = 0;
      let prevPt = { x: P.x, y: P.y };
      for (let i = 0; i < pTrail.length; i++) {
        const pt = pTrail[i];
        const seg = Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
        if (accum + seg >= FOLLOW_DIST) {
          const ratio = seg > 0.001 ? (FOLLOW_DIST - accum) / seg : 0;
          targetPos = {
            x: prevPt.x + (pt.x - prevPt.x) * ratio,
            y: prevPt.y + (pt.y - prevPt.y) * ratio
          };
          break;
        }
        accum += seg;
        prevPt = pt;
      }
    }
    cargo.x += (targetPos.x - cargo.x) * Math.min(1, dt * 10);
    cargo.y += (targetPos.y - cargo.y) * Math.min(1, dt * 10);
    const cargoGap = Math.hypot(cargo.x - P.x, cargo.y - P.y);
    if (cargoGap < FOLLOW_DIST) {
      const angle = cargoGap > 0.01 ? Math.atan2(cargo.y - P.y, cargo.x - P.x) : P.faceAng + Math.PI;
      cargo.x = P.x + Math.cos(angle) * FOLLOW_DIST;
      cargo.y = P.y + Math.sin(angle) * FOLLOW_DIST;
    }

    // 武器運算
    weapons(dt);

    // 敵人生成強度計算：整段 10 分鐘平滑拉升，破曉後加班不再增加難度。
    const cappedElapsed = Math.min(elapsed, DAWN);
    const pw = Object.values(WL).reduce((x, y) => x + y, 0) + b.dmg + b.rate;
    const tier = CFG.enemyTier(cappedElapsed, pw);

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = CFG.spawnInterval(cappedElapsed) * SPAWN_INTERVAL_SCALE;
      const count = Math.max(1, CFG.spawnCount(cappedElapsed) + SPAWN_COUNT_BONUS);
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
        surgeT = SURGE_INTERVAL;
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
        surgePendingCount = 10 + Math.floor(cappedElapsed / 60);
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
      const revealing = e.revealT && e.revealT > 0;
      if (revealing) e.revealT = Math.max(0, e.revealT - dt);
      const curSpd = revealing ? 0 : ((e.slowT && e.slowT > 0) ? Math.min(e.speed, 25) : e.speed);
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // 所有怪物逼近玩家（加入建築物碰撞障礙滑移）
      const step = CFG.chaseStep(d, curSpd, dt, e.type);
      const stepX = ((dx || (d === 1 && !dy ? 1 : 0)) / d) * step;
      const stepY = (dy / d) * step;
      if (!blocked(e.x + stepX, e.y, 16)) e.x += stepX;
      if (!blocked(e.x, e.y + stepY, 16)) e.y += stepY;

      // 射手型妖怪（shooter）：於中距離發射幽冥妖火彈
      if (e.type === "shooter" || (e.type === "mis" && !revealing)) {
        e.shootCd = (e.shootCd || (2.0 + Math.random())) - dt;
        if (e.shootCd <= 0 && d > 50 && d < (e.type === "mis" ? 200 : 460)) {
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
      if (!revealing && P.inv <= 0 && d < hitRadius) {
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
    const despawnRadius = Math.max(1150, spawnRadius(0) + 300);
    enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || e.type === "mis" || dist(e, P) < despawnRadius));

    if (finalBossDefeated && delivered >= GOAL_DELIVERIES && state === "play") {
      startVictorySequence();
      return;
    }

    // 3 / 6 / 9 分鐘中型 Boss，9:50 最終 Boss；上一隻尚未擊破時不重疊。
    bossT -= dt;
    if (bossT <= 0 && bossStage < BOSS_TIMES.length && !enemies.some(e => e.type === "boss")) {
      const a = Math.random() * 6.283;
      const cappedElapsed = Math.min(elapsed, DAWN);
      const isFinal = bossStage === BOSS_TIMES.length - 1;
      const stageScale = 1 + bossStage * 0.15 + (isFinal ? 0.55 : 0);
      const hp = Math.round((18 + level * 2.2) * (1 + pw * 0.04 + cappedElapsed / 380) * stageScale * (STAGE_ENEMY.bossHpScale || 1));
      const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
      let bossPool = ALL.filter(w => !livingMisWords.has(w.jp));
      if (bossPool.length === 0) bossPool = ALL;
      const radius = spawnRadius(520);
      const position = spawnPosition(radius, a, 52);
      if (position) {
        enemies.push({
          ...position,
          type: "boss",
          word: STORE.pick(bossPool),
          shield: true,
          final: isFinal,
          hp, max: hp,
          speed: 40 + (cappedElapsed / DAWN) * 45,
          flash: 0,
          wob: 0
        });
        bossStage++;
        const nextBossAt = BOSS_TIMES[bossStage];
        bossT = nextBossAt == null ? Number.POSITIVE_INFINITY : Math.max(0, nextBossAt - elapsed);
        const harborBoss = STAGE_ENEMY.bossTheme === "harbor";
        say(isFinal ? (harborBoss ? "⚠ 港霧大妖" : "⚠ 大妖鬼") : (harborBoss ? "⚓ 港霧妖將" : "👹 大妖鬼"), P.x, P.y - 75, "#ff8f8f");
        AUDIO.thunder();
      }
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

    // 配送取貨：靠近町屋即可出現裝置對應的取貨操作。
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
    const targetCamX = P.x - W / 2;
    const targetCamY = P.y - H / 2;
    const curCam = RENDERER.getCam();
    RENDERER.setCam(
      curCam.x + (targetCamX - curCam.x) * Math.min(1, dt * 9),
      curCam.y + (targetCamY - curCam.y) * Math.min(1, dt * 9)
    );

    if (xp >= xpNeed()) offerUp();
  }

  function drawStageWeather(t) {
    if (STAGE_VISUAL.weather !== "rain") return;
    const intensity = Math.max(0.4, STAGE_VISUAL.rainIntensity || 1);
    const area = viewBounds();
    const drops = Math.round(72 * intensity * area.width * area.height / (W * H));
    ctx.save();
    ctx.strokeStyle = "rgba(174, 218, 238, 0.48)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let i = 0; i < drops; i++) {
      const x = area.left + ((i * 97 + t * 430) % (area.width + 120)) - 60;
      const y = area.top + ((i * 61 + t * 760) % (area.height + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12, y + 28);
      ctx.stroke();
    }
    const fog = Math.max(0, Math.min(0.35, STAGE_VISUAL.fog || 0));
    if (fog > 0) {
      const haze = ctx.createLinearGradient(0, 0, W, H);
      haze.addColorStop(0, `rgba(120, 150, 170, ${fog * 0.55})`);
      haze.addColorStop(0.5, `rgba(180, 198, 205, ${fog})`);
      haze.addColorStop(1, `rgba(98, 125, 148, ${fog * 0.7})`);
      ctx.fillStyle = haze;
      const area = viewBounds();
      ctx.fillRect(area.left, area.top, area.width, area.height);
    }
    ctx.restore();
  }

  // ---------- 繪圖主循環 ----------
  function drawWorld() {
    const cam = RENDERER.getCam();
    const shakeOffset = RENDERER.getShakeOffset();
    const holdDawn = elapsed >= DAWN && state !== "victory" && state !== "won" && state !== "lost";
    const dawnBlend = state === "victory" && victorySeq
      ? Math.max(0, Math.min(1, (victorySeq.t - 1.6) / 1.2))
      : 0;
    const visualElapsed = holdDawn
      ? DAWN * 0.92
      : state === "victory"
        ? DAWN * (0.92 + 0.08 * dawnBlend)
        : elapsed;

    ctx.save();
    ctx.translate(-cam.x + shakeOffset.x, -cam.y + shakeOffset.y);

    // 1. 地面與道路
    RENDERER.drawGround(visualElapsed, DAWN, activeChunks, STAGE_VISUAL.ground || "ground");

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
        ctx.font = UI.readableFont(13, "900");
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
          ctx.font = UI.readableFont(18, "900");
          ctx.fillText(job.rev ? job.ans[i].zh : job.ans[i].jp, p.x, p.y + 6);
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
        ctx.font = "900 28px 'Noto Sans JP', 'Microsoft JhengHei', sans-serif";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        const answerText = job.rev ? job.ans[i].zh : job.ans[i].jp;
        ctx.strokeText(answerText, p.x, p.y + (showMeaning ? 0 : 8));
        ctx.fillStyle = "#161224";
        ctx.fillText(answerText, p.x, p.y + (showMeaning ? 0 : 8));

        if (showMeaning) {
          ctx.font = UI.readableFont(13, "bold");
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

    // 7. 依腳底地面接觸點排序；北側角色被屋頂遮住，南側角色在屋前。
    const actors = [
      ...houses.map(h => ({ house: h, y: h.y + 48 })),
      ...enemies.map(e => ({ enemy: e, y: e.y + (e.type === "boss" ? 44 : e.type === "mis" ? 27 : 19) })),
      { player: P, y: P.y + 20 }
    ];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.house) RENDERER.drawHouse(actor.house);
      else if (actor.enemy) {
        const e = actor.enemy;
        ctx.save();
        if (e.vanish != null) ctx.globalAlpha = Math.max(0, Math.min(1, e.vanish));
        RENDERER.drawMonster(e, P, elapsed);
        ctx.restore();
      } else RENDERER.drawPlayer(P, dashT > 0, P.inv, elapsed, move(), b.shield || 0);
    }

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
      ctx.font = UI.readableFont(17, "bold");
      ctx.fillStyle = t.c;
      ctx.fillText(t.v, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // 15. 浮動傷害數字
    RENDERER.drawDamageNumbers();

    // 配送導引標記在建築與角色之上，避免被深度排序遮住。
    houses.forEach(h => {
      const hasOrder = orders.some(o => o.from === h);
      const isDestination = job && job.to === h;


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
        ctx.font = UI.readableFont(14, "");
        UI.drawActionIcon(ctx,'pickup',h.x,floatY-3,13);
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
        ctx.font = UI.readableFont(15, "");
        ctx.fillText("⛩", h.x, floatY + 5);
        ctx.restore();
      }
    });

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
      ctx.font = UI.readableFont(14, "900");
      // 委託送什麼東西一句話就好，送往哪裡不需要顯示
      ctx.fillText(`${o.word.icon}  ${o.word.zh}`, h.x, floatY + 23);

      // 剩餘時間條 (金黃至火紅)
      ctx.fillStyle = isTarget ? "#ff8833" : "#ffa726";
      ctx.fillRect(h.x - 76, floatY + 34, (152 * o.life) / 110, 3);
      ctx.restore();

      // 靠近町屋時顯示最短操作標籤；觸控版不出現鍵盤字樣。
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
        ctx.font = UI.readableFont(12, "900");
        ctx.fillText("取貨", h.x, tagY + 18);
        ctx.restore();
      }
    }

    ctx.restore();

    // 16. 動態 2D 光影遮罩（深夜至黎明）
    RENDERER.renderLighting(P, LAMPS, oil, visualElapsed, DAWN);

    // 貨物本體置於夜色遮罩上，保持光暈與圖案清晰。
    if (job) {
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      const floatBob = Math.sin(elapsed * 5) * 3;
      const cyPos = cargo.y + floatBob;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 9;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      UI.drawWordCue(ctx, job.word, cargo.x, cyPos + 1, job.word.cue === "emoji" ? 40 : 28);
      ctx.textBaseline = "alphabetic";

      ctx.restore();
    }



    // 17. 櫻花雨與夜行幽火
    RENDERER.drawAtmosphere(visualElapsed, STAGE.id === "night-town" ? 17 : 50);
    drawStageWeather(visualElapsed);

    // 18. 送貨目的地導引羅盤 (人魂靈火導引)
    const targetHouse = job ? job.to : orders.reduce((n, o) => (!n || dist(P, o.from) < dist(P, n) ? o.from : n), null);
    if (targetHouse && (targetHouse.x < cam.x + viewBounds().left || targetHouse.x > cam.x + viewBounds().right || targetHouse.y < cam.y + viewBounds().top || targetHouse.y > cam.y + viewBounds().bottom)) {
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
    // 破曉後若配達已完成，使用與送貨金箭頭不同的赤色雙箭頭追蹤最終大妖鬼。
    const bossHunt = elapsed >= DAWN && delivered >= GOAL_DELIVERIES && !finalBossDefeated;
    const bossTarget = bossHunt ? enemies.find(e => e.type === "boss" && e.final && e.hp > 0) : null;
    if (bossTarget) {
      const sx = bossTarget.x - cam.x, sy = bossTarget.y - cam.y;
      const onScreen = sx >= viewBounds().left + 70 && sx <= viewBounds().right - 70 && sy >= viewBounds().top + 90 && sy <= viewBounds().bottom - 70;
      ctx.save();
      ctx.strokeStyle = "#ff3b4f";
      ctx.fillStyle = "#ff3b4f";
      ctx.shadowColor = "#ff1744";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      if (onScreen) {
        const pulseR = 58 + Math.sin(elapsed * 8) * 7;
        ctx.beginPath();
        ctx.arc(sx, sy - 30, pulseR, 0, 6.28);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = UI.readableFont(16, "900");
        ctx.fillText("大妖鬼", sx, sy - 100);
      } else {
        const an = Math.atan2(bossTarget.y - P.y, bossTarget.x - P.x);
        const cx = clamp(P.x - cam.x + Math.cos(an) * 230, 62, W - 62);
        const cy = clamp(P.y - cam.y + Math.sin(an) * 230, 102, H - 62);
        ctx.translate(cx, cy);
        ctx.rotate(an);
        for (let k = 0; k < 2; k++) {
          const off = -k * 15;
          ctx.beginPath();
          ctx.moveTo(20 + off, 0);
          ctx.lineTo(-8 + off, -14);
          ctx.lineTo(-2 + off, 0);
          ctx.lineTo(-8 + off, 14);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

  }

  function turnCodexPage(delta) {
    const lastPage = Math.max(0, Math.ceil(CODEX_ALL.length / 15) - 1);
    codexPage = clamp(codexPage + delta, 0, lastPage);
  }

  // ---------- 輸入監聽 ----------
  addEventListener("keydown", e => {
    if (isPortrait() || document.hidden) return;
    if (CONTROLS.isOpen()) return;
    if (e.target?.closest?.('button, input, select, textarea, dialog')) return;
    const action = CONTROLS.action(e.code);
    inputMode = 'keyboard';
    if (tutorial) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Tab' || e.code.startsWith('Arrow')) tutorial.focus = 1 - tutorial.focus;
      else if (e.code === 'Escape' || action === 'pause') closeTutorial(true);
      else if (e.code === 'Enter' || action === 'interact') closeTutorial(tutorial.focus === 1);
      return;
    }
    if (action) e.preventDefault();
    if (e.repeat && ["pause", "codex", "mute", "interact", "hint"].includes(action)) return;
    if (action === "pause") {
      if (state === "codex") {
        state = codexBack;
        return;
      }
      if (state === "overworld" && e.key === "Escape") {
        returnHome();
        return;
      }
      if (state === "won" || state === "lost") { activateMenu("menu"); return; }
      if (state === 'won' || state === 'lost') { activateMenu('menu'); return; }
      if (state === "play" || state === "pause") {
        togglePause();
        return;
      }
    }
    if (action === "codex") {
      if (state === "codex") {
        state = codexBack;
      } else if (state === "menu" || state === "overworld" || state === "won" || state === "lost" || state === "pause") {
        codexBack = state;
        state = "codex";
      }
      return;
    }
    if (action === "mute") {
      AUDIO.toggleMute();
      return;
    }
    if (state === "codex") {
      if (e.code === "Tab") {
        e.preventDefault();
        codexTab = codexTab === "cards" ? "words" : "cards";
      } else if (codexTab === "words" && (action === "l" || action === "r")) {
        e.preventDefault();
        turnCodexPage(action === "l" ? -1 : 1);
      }
      return;
    }
    const buttons = menuButtons();
    if (buttons) {
      if (e.code === 'Tab' || ['u','d','l','r'].includes(action)) {
        e.preventDefault(); moveMenu(e.code === 'Tab' ? (e.shiftKey ? -1 : 1) : ['u','l'].includes(action) ? -1 : 1);
      } else if (!e.repeat && (e.key === 'Enter' || action === 'interact')) { e.preventDefault(); AUDIO.init(); activateMenu(buttons[menuFocus].id); }
      return;
    }
    if (state === "levelup" && !e.repeat && "123".includes(e.key)) {
      pickUp(+e.key - 1);
      return;
    }
    if (state === "overworld") {
      if (action === "l") { e.preventDefault(); moveOverworld(-1, 0); }
      else if (action === "r") { e.preventDefault(); moveOverworld(1, 0); }
      else if (action === "u") { e.preventDefault(); moveOverworld(0, -1); }
      else if (action === "d") { e.preventDefault(); moveOverworld(0, 1); }
      else if (e.key === "Enter" || action === "interact" || action === "dash") { e.preventDefault(); confirmOverworld(); }
      return;
    }
    if (state !== "play") return;
    if (action === "interact") interact();
    else if (bossQ && "123".includes(e.key)) {
      const idx = +e.key - 1;
      if (idx >= 0 && idx < bossQ.ans.length) answerBoss(idx);
    }
    else if ((action === "hint") && job) {
      triggerHint();
    } else if (["u", "d", "l", "r", "dash"].includes(action)) {
      e.preventDefault();
      heldCodes.add(e.code);
      keys.add(action);
    }
  });

  addEventListener("keyup", e => {
    const action = CONTROLS.action(e.code);
    heldCodes.delete(e.code);
    if (action && ![...heldCodes].some(code => CONTROLS.action(code) === action)) keys.delete(action);
  });
  const suspend = () => {
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    if (state === "play") togglePause();
    AUDIO.setSuspended(true);
  };
  const wakeAudio = () => {
    if (!document.hidden && !isPortrait() && document.hasFocus?.() !== false) AUDIO.setSuspended(false);
  };
  addEventListener("blur", suspend);
  addEventListener("focus", wakeAudio);
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else wakeAudio(); });

  const pp = e => {
    const r = cv.getBoundingClientRect();
    const v = window.VIEWPORT?.get() || {width:W,height:H,offsetX:0,offsetY:0};
    return {
      x: (e.clientX - r.left) * v.width / r.width - v.offsetX,
      y: (e.clientY - r.top) * v.height / r.height - v.offsetY
    };
  };
  const hit = (p, bt) => Math.hypot(p.x - bt.x, p.y - bt.y) < bt.r + 10;

  document.getElementById("game-container").addEventListener("pointerdown", e => {
    e.preventDefault();
    if (isPortrait() || document.hidden) return;
    cv.setPointerCapture(e.pointerId);
    AUDIO.init();
    touch = e.pointerType !== "mouse";
    inputMode = touch ? 'touch' : 'keyboard';
    if (tutorial) {
      const p = pp(e);
      UI.TUTORIAL_BTNS.forEach((bt,i) => { if(p.x>=bt.x && p.x<=bt.x+bt.w && p.y>=bt.y && p.y<=bt.y+bt.h) closeTutorial(i===1); });
      return;
    }
    if (e.pointerType === "mouse" && e.button === 2) { dash(); return; }
    if (e.pointerType === "mouse" && e.button !== 0) return;
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
      for (const btn of UI.pauseButtons?.() || UI.PAUSE_BTNS) {
        const x=btn.x ?? bx, w=btn.w ?? btnW, h=btn.h ?? btnH;
        if (p.x >= x && p.x <= x + w && p.y >= btn.y && p.y <= btn.y + h) {
          activateMenu(btn.id);
          return;
        }
      }
      return;
    }

    if (state === "codex") {
      if (codexTab === "words" && p.y >= 78 && p.y <= 118) {
        if (p.x >= 40 && p.x <= 104) turnCodexPage(-1);
        else if (p.x >= 796 && p.x <= 860) turnCodexPage(1);
        return;
      }
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
    if (state === "overworld") {
      const back = window.OVERWORLD.backButton();
      if (p.x >= back.x && p.x <= back.x + back.w && p.y >= back.y && p.y <= back.y + back.h) {
        returnHome();
        return;
      }

      const enter = window.OVERWORLD.ENTER_BTN;
      const here = window.OVERWORLD.currentNode(overworld);
      if (window.OVERWORLD.isEnterable(here) && p.x >= enter.x && p.x <= enter.x + enter.w && p.y >= enter.y && p.y <= enter.y + enter.h) {
        confirmOverworld();
        return;
      }

      const node = window.OVERWORLD.hitTest(overworld, p.x, p.y);
      if (node) {
        if (node.id === overworld.currentId) confirmOverworld();
        else window.OVERWORLD.moveTo(overworld, node.id);
      }
      return;
    }
    if (state === 'menu' || state === 'won' || state === 'lost') {
      const btn = menuButtons().find(b => p.x >= b.x && p.x <= b.x+b.w && p.y >= b.y && p.y <= b.y+b.h);
      if (btn) activateMenu(btn.id);
      return;
    }
    if (state === "levelup") {
      const cardW = 720, cardH = 108, startX = 90, gap = 14, cy = 176;
      for (let i = 0; i < 3; i++) {
        const cx = startX;
        const rowY = cy + i * (cardH + gap);
        if (p.x >= cx && p.x <= cx + cardW && p.y >= rowY && p.y <= rowY + cardH) {
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
    } else if (job && UI.HINT_BTN && p.x >= UI.HINT_BTN.x && p.x <= UI.HINT_BTN.x + UI.HINT_BTN.w && p.y >= UI.HINT_BTN.y && p.y <= UI.HINT_BTN.y + UI.HINT_BTN.h) {
      triggerHint();
    } else if ((e.pointerType === "mouse" || (p.x < W / 2 && p.y > 80)) && !joy) {
      joy = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
    }
  });

  cv.addEventListener("contextmenu", e => e.preventDefault());
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
    menuButtons();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    levelupCooldown = Math.max(0, levelupCooldown - dt);

    // 不論遊戲處於何種狀態（結算、升級或暫停），每幀精準倒數冷卻時間
    if (endCooldown > 0) {
      endCooldown = Math.max(0, endCooldown - dt);
    }

    // 手把輪詢（包含搖桿蘑菇頭與按鈕）
    pollGamepad();

    if (state === "play") {
      update(dt);
    } else if (state === "victory") {
      updateVictorySequence(dt);
    } else if (state === "overworld") {
      window.OVERWORLD.update(overworld, dt);
      if (overworldNoticeT > 0) overworldNoticeT = Math.max(0, overworldNoticeT - dt);
    }
    AUDIO.updateBgm(dt, tutorial ? 'pause' : state, state === "overworld" ? 0 : elapsed, DAWN);

    if ((state === "won" || state === "lost") && !ended) {
      ended = true;
      if (state === "won") AUDIO.fanfare();
      else AUDIO.lose();
      STORE.finish(STAGE.id, score, delivered, state === "won");
    }

    const v = window.VIEWPORT?.get() || {offsetX:0,offsetY:0};
    const pixelScale = (v.scale || 1) * RENDERER.getDpr();
    ctx.setTransform(pixelScale, 0, 0, pixelScale, v.offsetX * pixelScale, v.offsetY * pixelScale);

    const bounds = window.VIEWPORT?.hudBounds() || viewBounds();
    btnPause.x = bounds.right - 52;
    btnPause.y = bounds.top + 14;
    btnD.x = bounds.right - btnD.r * 3;
    btnD.y = bounds.bottom - btnD.r - 24;
    btnE.x = btnD.x;
    btnE.y = btnD.y - 110;
    if (state === "menu") {
      UI.drawMainMenu(ctx, STORE, now / 1000, menuFocus);
    } else if (state === "overworld") {
      window.OVERWORLD.draw(ctx, overworld, now / 1000, overworldNoticeT);
    } else {
      drawWorld();
      if (state === "victory") {
        const dawnP = victorySeq ? Math.max(0, Math.min(1, (victorySeq.t - 1.6) / 1.2)) : 0;
        if (dawnP > 0) {
          const dawnGlow = ctx.createLinearGradient(0, 0, 0, H);
          dawnGlow.addColorStop(0, `rgba(255, 226, 165, ${0.30 * dawnP})`);
          dawnGlow.addColorStop(0.55, `rgba(255, 178, 105, ${0.12 * dawnP})`);
          dawnGlow.addColorStop(1, "rgba(255, 178, 105, 0)");
          ctx.fillStyle = dawnGlow;
          const area = viewBounds();
      ctx.fillRect(area.left, area.top, area.width, area.height);
        }
      } else {
        const dashMax = Math.max(0.6, 1.8 - b.dash * 0.38);
        const bossHunt = elapsed >= DAWN && delivered >= GOAL_DELIVERIES && !finalBossDefeated;
        UI.drawHud(
          ctx, P, oil, maxOil, elapsed, DAWN, delivered, failed, score, level, xp, xpNeed(),
          job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, GOAL_DELIVERIES,
          dashCd, dashMax, bossHunt
        );
        if (surgeWarningT > 0) UI.drawSurgeWarning(ctx, surgeWarningT);
        if (bossQ) UI.drawBossQuiz(ctx, bossQ, inputMode);
        if (state === "levelup") UI.drawLevelUp(ctx, level + 1, choices, WL, WI);
        if (state === "pause") UI.drawPauseMenu(ctx, AUDIO.isMuted ? AUDIO.isMuted() : false, menuFocus);
        if (state === "won" || state === "lost") UI.drawEndScreen(ctx, state, score, delivered, failed, misses, menuFocus);
      }
    }

    if (state === "codex") {
      UI.drawCodex(ctx, STORE, CODEX_ALL, codexTab, codexPage);
    }
    if (tutorial) UI.drawTutorial(ctx, tutorial, inputMode);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
