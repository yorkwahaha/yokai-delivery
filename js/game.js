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
  const HAPTICS = window.HAPTICS || { dash(){}, damage(){}, shield(){}, hit(){}, pickup(){}, deliverSuccess(){}, deliverWrong(){}, bossDefeat(){}, levelUp(){}, warning(){} };
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
  const MIS_SPEED = 200;
  function codexWords() {
    const seen = new Set(), words = [];
    for (const stage of Object.values(window.CONTENT.STAGES || {})) {
      if (!stage.implemented || !STORE.isStageUnlocked(stage.id)) continue;
      for (const word of window.CONTENT.getStageWords(stage)) {
        if (seen.has(word.jp)) continue;
        seen.add(word.jp);
        words.push(word);
      }
    }
    return words;
  }
  const blocked = (x, y, r = 18) => solids.some(s => Math.hypot(x - clamp(x, s.x0, s.x1), y - clamp(y, s.y0, s.y1)) < r);
  function knockback(e, distance) {
    if (e.type === "boss") return;
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
  const ansPos = h => [{ x: h.x - 125, y: h.y + 125 }, { x: h.x + 125, y: h.y + 125 }, { x: h.x, y: h.y + 190 }];
  const getWordDistrictWords = word => window.CONTENT.getSiblingWords(word);
  function answerChoices(word) {
    const seen = new Set([word.jp]), distractors = [];
    for (const w of [...shuffle(getWordDistrictWords(word)), ...shuffle(ALL)]) {
      if (!w || seen.has(w.jp)) continue;
      seen.add(w.jp); distractors.push(w);
      if (distractors.length === 2) break;
    }
    return shuffle([word, ...distractors]);
  }

  // ---------- 遊戲狀態 ----------
  const P = { x: START.x, y: START.y, inv: 0, faceAng: 0, faceX: 1 };
  const b = { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0 };
  const keys = new Set(), heldCodes = new Set();
  let state = "menu";
  let quitConfirm = false;
  let menuFocus = 0, menuFocusState = "menu", gpMenuDir = "";
  function menuButtons() {
    if (menuFocusState !== state) { menuFocus = 0; menuFocusState = state; }
    return quitConfirm ? UI.EXIT_BTNS : state === "menu" ? UI.MENU_BTNS : state === "pause" ? UI.PAUSE_BTNS : state === "won" || state === "lost" ? UI.END_BTNS : null;
  }
  function moveMenu(delta) {
    const buttons = menuButtons();
    menuFocus = (menuFocus + delta + buttons.length) % buttons.length;
  }
  function returnHome() {
    quitConfirm = false;
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
    else if (id === "exit-cancel") { quitConfirm = false; menuFocus = 0; }
    else if (id === "exit-confirm") returnHome();
    else if (id === "menu") {
      if (state === "pause") { quitConfirm = true; menuFocus = 0; }
      else returnHome();
    }
    else if (id === "cards" || id === "codex") { codexBack = state; selectCodex(id === "cards" ? "cards" : "words"); state = "codex"; }
  }
  let overworld = window.OVERWORLD.createState("gate");
  let overworldNoticeT = 0;
  let gpOverworldDir = "";
  let elapsed = 0, warnDawnT = 0, oil = 100, maxOil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let orders = [], job = null, enemies = [], enemyBullets = [], gems = [], texts = [], rings = [], misses = [];
  const GEM_LIMIT = 512, GEM_DISTANCE = 2400;
  function dropGem(x, y, v) {
    if (gems.length < GEM_LIMIT) { gems.push({x,y,v}); return; }
    // 滿池合併到最近一顆，保留經驗總量；只在擊殺時掃描，非每幀搜尋。
    let nearest = gems[0], best = Infinity;
    for (const g of gems) {
      const d = (g.x-x)**2 + (g.y-y)**2;
      if (d < best) { best = d; nearest = g; }
    }
    if (dist(P,nearest) > GEM_DISTANCE) Object.assign(nearest,{x,y,v,done:false});
    else nearest.v += v;
  }
  // rerolls 是每局可重抽升級選項的次數。
  let rerolls = 2, titleCardT = 0;
  // 畫面切換不再硬切：新畫面從黑幕淡入。
  const FADE_TIME = 0.45;
  let lastScreen = "menu", fadeT = 0, runSummary = null;
  let learningStart = {};
  function learningSummary() {
    const result = { practiced: 0, gained: 0, lost: 0, review: 0 };
    for (const [jp, m] of Object.entries(STORE.data.m)) {
      const before = learningStart[jp] || {ok:0,ng:0,box:0};
      if (m.ok === before.ok && m.ng === before.ng) continue;
      result.practiced++;
      result.gained += Math.max(0,m.box-before.box);
      result.lost += Math.max(0,before.box-m.box);
      if (m.missBoost > 1) result.review++;
    }
    return result;
  }
  const wMax = { katana: 0.72, barrier: 3, needle: 1, boom: 2, thunder: 2.6, fire:1.1 };
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, endCooldown = 0, lanternHitT = 0;
  let dashDir = { x: 1, y: 0 };
  let choices = [], levelupCooldown = 0, joy = null, touch = window.matchMedia?.("(pointer: coarse)")?.matches || false, inter = null, cargo = { x: 0, y: 0 }, pTrail = [], last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };
  const btnPause = { x: W - 52, y: 14, w: 38, h: 52 };
  let gpPrevButtons = [], gpMove = { x: 0, y: 0 };

  let bossT = BOSS_TIMES[0], bossStage = 0, finalBossDefeated = false;
  let finalBossPos = null, finalBossEnt = null, victorySeq = null;
  let ended = false, bossQ = null, codexBack = "menu", codexTab = "cards", codexPage = 0;
  let codexFocus = 'cards';
  function selectCodex(id) {
    codexFocus = id;
    if(id==='cards'||id==='words'){codexTab=id;codexPage=0;}
    else if(id==='prev'||id==='next')turnCodexPage(id==='prev'?-1:1);
    else if(id==='back')state=codexBack;
  }
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
    katana:["暖光單刃，斬擊前方妖怪","雙刃交叉，距離 +16、傷害 +0.8","三刃收束，距離與傷害再提升","蓄風四刃；下一階射出穿透風刃","覺醒・風刃：斬擊同時射出穿透風刃"],
    barrier:["展開單盤除魔陣，震退四周妖怪","雙盤刻印，範圍與傷害提升","反轉雙盤，範圍、傷害再提升","蓄勢大陣；下一階升起光柱","覺醒・昇靈結界：光柱升起，範圍與震退最強"],
    fire:["召喚 2 顆暖光狐火環繞護身","狐火增加至 4 顆，傷害提升","五火白芯，傷害再提升","蓄魂六火；下一階化為追蹤鬼火","覺醒・追魂鬼火：六靈追擊遠方妖怪"],
    boom:["單符回旋，穿透路徑上的妖怪","一次擲出 2 枚符咒","三符碎焰，冷卻縮短","蓄火四符；下一階改為投射爆符","覺醒・爆符：四符命中引爆範圍傷害"],
    thunder:["落雷轟擊最強妖怪及近處敵人","同時鎖定 2 名強敵","同時鎖定 3 名強敵","三雷餘波擴大；下一階展開雷獄","覺醒・雷獄：轟擊大範圍內所有妖怪"],
    needle:["三發靈針，貫穿前方妖怪","五發雙羽，傷害提升","七發三叉，傷害再提升","八星噴射；下一階弧線射出","覺醒・弧光八星：八針彎曲一次後直飛"]
  };

  let proj = [], needles = [], winds = [], ghosts = [], surgeT = SURGE_FIRST, fAng = 0, fireEmitT = 0;
  let surgeWarningT = 0, surgePendingCount = 0, surgePendingTier = 1;
  const wT = { boom: 0, thunder: 0, barrier: 0, needle: 0, fire: 0 };

  const UP = [
    { id: "shield", n: "金剛結界", s: "けっかい", cat: "防禦生存", d: "召喚金剛勾玉護盾，抵擋 2 次受傷（可疊加）", f: () => { b.shield = Math.min(6, (b.shield || 0) + 2); }, ok: () => (b.shield || 0) < 6 },
    { id: "oil_max", n: "長明燈油", s: "あぶら", cat: "血厚續航", d: "燈油上限 +30 並補充 30 點，常駐每秒回油 +0.06（上限 2 層）", f: () => { maxOil += 30; oil = Math.min(maxOil, oil + 30); b.oilRegen = Math.min(0.12, (b.oilRegen || 0) + 0.06); }, ok: () => (b.oilRegen || 0) < 0.12 },
    { id: "oil_heal", n: "添燈香油", s: "かいふく", cat: "緊急急救", d: "恢復 50% 燈油，並震退周圍妖怪（每場最多 3 次）", f: () => {
      b.heals = (b.heals || 0) + 1;
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
    }, ok: () => (b.heals || 0) < 3 },
    { id: "dmg", n: "修羅破軍", s: "こうげき", cat: "攻擊爆發", d: "整體傷害係數 +0.35（最多 6 層）", f: () => { b.dmg += 0.35; b.dmgUp = (b.dmgUp || 0) + 1; }, ok: () => (b.dmgUp || 0) < 6 },
    { id: "rate", n: "神樂疾奏", s: "れんぞく", cat: "攻擊爆發", d: "妖刀、結界、靈針冷卻縮短", f: () => { b.rate++; }, ok: () => b.rate < 4 },
    { id: "crit", n: "心眼一閃", s: "かいしん", cat: "攻擊爆發", d: "妖刀/天雷暴擊率 +15%，結界 +10%", f: () => { b.crit = (b.crit || 0) + 1; }, ok: () => (b.crit || 0) < 3 },
    { id: "spd", n: "神足草履", s: "いどう", cat: "神速機動", d: "移動速度約 +15%（最多 3 層）", f: () => { b.spd = (b.spd || 0) + 1; }, ok: () => (b.spd || 0) < 3 },
    { id: "dash", n: "縮地瞬步", s: "ダッシュ", cat: "神速機動", d: "衝刺冷卻大幅縮短，衝刺附加無敵突進", f: () => { b.dash++; }, ok: () => b.dash < 3 },
    { id: "mag", n: "招財勾玉", s: "じしゃく", cat: "輔助資源", d: "靈玉吸取範圍 +80", f: () => { b.mag++; }, ok: () => b.mag < 3 }
  ];

  const say = (v, x, y, c = "#fff") => texts.push({ v, x, y, c, life: 1.8 });
  const burst = (x, y, c, n = 16) => FX.burst(x, y, c, n);

  function makeOrder() {
    const orderCap = CFG.orderSlots(elapsed, delivered);
    if (orders.length >= orderCap) return;
    const busy = new Set(orders.map(o => o.from.id));
    const localHouses = houses.filter(h => dist(P, h) < 2200);
    if (!localHouses.length) return;

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

    // 詞先決定，再盡量送到教同一個詞的町屋；沒有對應房子時仍用這個詞。
    const openHouses = localHouses.filter(h => !busy.has(h.id));
    const matching = openHouses.filter(h => h.word && h.word.jp === chosenWord.jp);
    const from = pick(matching.length ? matching : openHouses);
    if (!from) return;
    const to = pick(localHouses.filter(h => h !== from && dist(h, from) > 420 && dist(h, from) < 2000));
    if (!to) return;
    orders.push({ from, to, word: chosenWord, rev: false, life: 110 });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      AUDIO.stopSpeech();
      RENDERER.clearShake();
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
    AUDIO.restartMusic();
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
    quitConfirm = false;
    AUDIO.restartMusic();
    window.loadGameArt?.();
    configureStage(stageId);
    AUDIO.init();
    AUDIO.preloadWords?.(ALL);
    state = "play";
    tutorial = null;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    Object.assign(P, { x: START.x, y: START.y, inv: 1.2, faceAng: 0, faceX: 1 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0, crit: 0, oilRegen: 0, dmgUp: 0, heals: 0 });
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 });
    proj = []; needles = []; winds = []; ghosts = []; enemyBullets = []; surgeT = SURGE_FIRST; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1;
    wT.boom = 0; wT.thunder = 1; wT.barrier = 1.5; wT.needle = 0.5; wT.fire = 0;
    elapsed = 0; warnDawnT = 0; oil = 100; maxOil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    orders = []; job = null; inter = null; enemies = []; gems = []; texts = []; rings = []; misses = [];
    learningStart = Object.fromEntries(Object.entries(STORE.data.m).map(([jp,m])=>[jp,{ok:m.ok,ng:m.ng,box:m.box}]));
    FX.reset();
    SKILLFX.reset();
    rerolls = 2; titleCardT = 3; runSummary = null;
    bossStage = 0; bossT = BOSS_TIMES[0]; finalBossDefeated = false; finalBossPos = null; finalBossEnt = null; victorySeq = null; lampSeq = null;
    ended = false; bossQ = null; orderT = 5; spawnT = 8; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; endCooldown = 0; lanternHitT = 0;
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
        levelText: isNew ? "★ 新解鎖" : nextLvl===5 ? "Lv5 覺醒" : `◆ 等級 ${WL[k]} ➔ ${nextLvl}`,
        rarity: isNew ? "new" : nextLvl >= 5 ? "max" : "up",
        lv: nextLvl,
        d: descText,
        f: () => {
          WL[k]++;
          if (k === "katana") atkT = 0;
          if (k === "boom") wT.boom = 0;
          if (k === "barrier") wT.barrier = 0;
          if (k === "needle") wT.needle = 0;
          if (k === "fire" || k === "thunder") wT[k] = 0;
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
      rarity: "passive",
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

    if (!choices.length) {
      xp = Math.max(0, xp - xpNeed());
      level++;
      state = "play";
      say("修行圓滿・繼續夜行", P.x, P.y - 45, "#ffe9a0");
      return;
    }
    state = "levelup";
    levelupCooldown = 0.4;
    keys.clear(); heldCodes.clear();
    joy = null;
    AUDIO.levelUp();
    HAPTICS.levelUp();
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
    if(choices[i].lv===5){say(`${choices[i].n}・覺醒！`,P.x,P.y-75,"#b8f2df");AUDIO.fanfare();}
    FX.levelUp(P.x, P.y);
  }

  function reroll() {
    if (state !== "levelup" || levelupCooldown > 0 || rerolls <= 0) return;
    rerolls--;
    offerUp();
  }

  function interact() {
    if (state !== "play" || !inter || job) return;
    const o = inter;
    orders = orders.filter(x => x !== o);

    // 干擾項優先挑選包裹單字自身所屬區的近義詞（如動物區 ねこ 優先配 いぬ、うさぎ）
    const finalAns = answerChoices(o.word);

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
      assisted: enemies.some(e => e.type === "boss" && e.shield && e.word?.jp === o.word.jp && e.wasAssisted)
    };
    nameT = 4.5;
    cargo = { x: pTrail.length > 0 ? pTrail[pTrail.length - 1].x : P.x - 44, y: pTrail.length > 0 ? pTrail[pTrail.length - 1].y : P.y + 10 };
    say("裝好了", P.x, P.y - 45, "#ffe9a0");
    AUDIO.pickup();
    HAPTICS.pickup();
    AUDIO.speak(o.word.jp); // 取貨時就念出單字，讓沒學過的玩家先聽到再配送
  }

  function resolve(i) {
    const j = job, w = j.ans[i], pos = ansPos(j.to)[i];
    if (j.assisted) markBossAssisted(j.word);
    job = null;
    nameT = 0;

    if (w === j.word) {
      delivered++;
      if (j.assisted) {
        STORE.recAssisted(j.word.jp);
        oil = Math.min(maxOil, oil + 12);
        score += 25;
        say(`${w.jp}＝${w.zh} 輔助送達！`, pos.x, pos.y - 35, "#fff0a6");
        say("燈油 +12 點（神助）", pos.x, pos.y - 12, "#ffd27a");
      } else {
        STORE.rec(j.word.jp, true);
        const gain = 10;
        oil = Math.min(maxOil, oil + 18 + gain);
        score += 50;
        say(`${w.jp}＝${w.zh} 配達完遂！`, pos.x, pos.y - 35, "#fff0a6");
        say(`燈油 +${18 + gain} 點`, pos.x, pos.y - 12, "#ffd27a");
      }
      xp += 12;
      FX.deliver(pos.x, pos.y);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
      HAPTICS.deliverSuccess();
    } else {
      failed++;
      oil = Math.max(0,oil-8);
      misses.push(j.word);
      STORE.rec(j.word.jp, false);
      say("誤配！燈油 -8，瘴氣妖魔現身！", pos.x, pos.y - 36, "#ff8f8f");
      const cappedElapsed = Math.min(elapsed, DAWN);
      const awayX = pos.x - j.to.x;
      const awayY = pos.y - j.to.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      let spawn = null;
      for (const radius of [118, 236, 354, 472]) {
        spawn = spawnPosition(radius, Math.atan2(awayY / awayLen, awayX / awayLen), 34, pos);
        if (spawn) break;
      }
      if (spawn) enemies.push({
        ...spawn,
        type: "mis",
        w: j.word,
        hp: 5 + Math.floor(cappedElapsed / 180),
        max: 5 + Math.floor(cappedElapsed / 180),
        speed: MIS_SPEED,
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

      say(spawn ? "擊敗誤配妖怪以淨化單字" : "暫無安全出生點，錯詞將優先安排複習", pos.x, pos.y - 12, "#e5b8ff");
      burst(pos.x, pos.y, "#c98cff", 24);
      RENDERER.triggerShake(6);
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
      AUDIO.speak(j.word.jp); // 出現時即播一次讀音
      if(oil<=0)loseRun();
    }
  }

  function hurt(e, dmg, isCrit = false) {
    if (e.hp <= 0) return;
    if (e.shield) {
      e.flash = 0.08;
      if (!e.shieldFeedbackUntil || elapsed >= e.shieldFeedbackUntil) {
        RENDERER.spawnDamageNumber("結界", e.x, e.y - 20, false, "#9be7ff");
        e.shieldFeedbackUntil = elapsed + 0.6;
      }
      return;
    }
    e.hp -= dmg;
    e.flash = 0.12;
    HAPTICS.hit(isCrit);
    burst(e.x, e.y, "#ffe6aa", 4);
    RENDERER.spawnDamageNumber(dmg, e.x, e.y - 25, isCrit, isCrit ? "#ffcc00" : "#ffffff");

    if (isCrit) {
      RENDERER.triggerHitStop(0.04);
      RENDERER.triggerShake(5);
    }

    if (e.hp > 0) return;

    // 怪物擊敗
    const isMis = e.type === "mis";
    score += isMis ? 0 : e.type === "boss" ? 400 : 15;

    if (e.type === "boss") {
      AUDIO.bossDeath();
      HAPTICS.bossDefeat();
      if (e.final) {
        finalBossDefeated = true;
        finalBossPos = { x: e.x, y: e.y };
        finalBossEnt = e;
      }
      oil = Math.min(maxOil, oil + 35);
      bossT = BOSS_TIMES[bossStage] == null ? Infinity : Math.max(0, BOSS_TIMES[bossStage] - elapsed);
      say(e.final ? "夜明けの大妖鬼 撃破！" : "大妖鬼擊破！燈油 +35", e.x, e.y - 65, "#ffe9a0");
      if (!e.final) RENDERER.triggerShake(14); // 最終 Boss 由收尾演出處理，不震動整個畫面
      for (let k = 0; k < 8; k++) {
        dropGem(e.x + (Math.random() - 0.5) * 70, e.y + (Math.random() - 0.5) * 70, 6);
      }
      // 不再誤將擊殺視為單字掌握 STORE.rec
    }

    const gemCount = 1;
    for (let i = 0; i < gemCount; i++) {
      dropGem(e.x + (Math.random() - 0.5) * 28, e.y + (Math.random() - 0.5) * 28, 2);
    }
    FX.death(e.x, e.y, isMis ? "#c98cff" : "#bce9ff", e.type === "boss");

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
    FX.dashTrail(P.x, P.y, dashDir.x, dashDir.y);
    RENDERER.triggerShake(3);
    AUDIO.dash();
    HAPTICS.dash();
  }

  // 燈油耗盡演出（秒）：提燈熄滅、BGM 淡出停止 → 黑暗中停留 2 秒 → 才進入結算。
  const LAMPOUT = { snuff: 0.8, dark: 2.0 };
  let lampSeq = null;
  const lampOutAmount = () => {
    if (!lampSeq) return 0;
    const k = Math.min(1, lampSeq.t / LAMPOUT.snuff);
    return k >= 1 ? 1 : Math.max(0, Math.min(1, k + Math.sin(lampSeq.t * 38) * 0.12 * (1 - k)));
  };

  function loseRun() {
    if (state === "lampout" || state === "lost") return;
    if (finalBossDefeated && delivered >= GOAL_DELIVERIES) {
      startVictorySequence();
      return;
    }
    state = "lampout";
    lampSeq = { t: 0 };
    keys.clear(); heldCodes.clear();
    joy = null;
    bossQ = null;
    job = null;
    inter = null;
    enemyBullets = [];
    winds = []; ghosts = [];
    AUDIO.fadeOutMusic(700);
  }

  function updateLampSequence(dt) {
    if (!lampSeq) return;
    lampSeq.t += dt;
    FX.update(dt);
    for (const tx of texts) { tx.y -= 32 * dt; tx.life -= dt; }
    texts = texts.filter(tx => tx.life > 0);
    if (lampSeq.t >= LAMPOUT.snuff + LAMPOUT.dark) {
      state = "lost";
      endCooldown = 1.0;
    }
  }

  // 收尾演出時間軸（秒）：小怪定格、Boss 邊抖邊連環爆炸 → 最後大爆 → 小怪原地燃燒消失 → 曙光 → 曙光亮起 2 秒後結算。
  const VICTORY = { explode: 1.6, ignite: 2.0, burn: 1.0, dawn: 3.0, dawnFade: 1.2, settle: 5.0 };
  const victoryDawn = () => victorySeq ? Math.max(0, Math.min(1, (victorySeq.t - VICTORY.dawn) / VICTORY.dawnFade)) : 0;

  function startVictorySequence() {
    if (victorySeq || state !== "play") return;
    const p = finalBossPos || { x: P.x, y: P.y - 120 };
    // Boss 已死亡被移出戰場；留一個定格的分身，演出時讓它抖動並爆炸。
    const boss = finalBossEnt ? { ...finalBossEnt, hp: 1, max: 1, shield: false, dying: true, flash: 0, slowT: 0 } : null;
    enemies = enemies.filter(e => e.type !== "boss");
    if (boss) enemies.push(boss);
    victorySeq = { t: 0, bossX: p.x, bossY: p.y, boss, blastT: 0, blasts: 0, bossGone: !boss, ignited: false, fireT: 0 };
    state = "victory";
    winds=[];ghosts=[];
    keys.clear(); heldCodes.clear();
    joy = null;
    bossQ = null;
    job = null;
    orders = [];
    inter = null;
    enemyBullets = [];
    RENDERER.clearShake(); // 演出期間不震動整個畫面，只有 Boss 自己抖
    AUDIO.thunder();
  }

  function updateVictorySequence(dt) {
    const v = victorySeq;
    if (!v) return;
    v.t += dt;
    const t = v.t;

    if (!v.bossGone) {
      if (t < VICTORY.explode) {
        v.boss.x = v.bossX + (Math.random() - 0.5) * 9;
        v.boss.y = v.bossY + (Math.random() - 0.5) * 5;
        v.boss.flash = Math.random() < 0.4 ? 0.1 : 0;
        v.blastT -= dt;
        if (v.blastT <= 0) {
          v.blastT = 0.13;
          const bx = v.bossX + (Math.random() - 0.5) * 90, by = v.bossY - 25 + (Math.random() - 0.5) * 80;
          burst(bx, by, Math.random() < 0.5 ? "#ffb74d" : "#ff5252", 14);
          rings.push({ x: bx, y: by, life: 0.35, maxL: 0.35, maxR: 70, color: "#ffcc80" });
          if (v.blasts++ % 3 === 0) AUDIO.breakShield();
        }
      } else {
        v.bossGone = true;
        enemies = enemies.filter(e => e !== v.boss);
        burst(v.bossX, v.bossY, "#fff3b0", 90);
        burst(v.bossX, v.bossY, "#ff5252", 60);
        rings.push({ x: v.bossX, y: v.bossY, life: 0.8, maxL: 0.8, maxR: 240, color: "#fff3b0" });
        rings.push({ x: v.bossX, y: v.bossY, life: 0.55, maxL: 0.55, maxR: 150, color: "#ff8a65" });
        AUDIO.thunder();
      }
    }

    if (t >= VICTORY.ignite && v.bossGone) {
      const k = Math.min(1, (t - VICTORY.ignite) / VICTORY.burn);
      v.fireT -= dt;
      const emit = v.fireT <= 0;
      if (emit) v.fireT = 0.07;
      for (const e of enemies) {
        if (!e.burning) { e.burning = true; burst(e.x, e.y - 10, "#ff6d00", 10); }
        e.vanish = 1 - k;
        if (emit) burst(e.x + (Math.random() - 0.5) * 22, e.y - 8 - Math.random() * 22, Math.random() < 0.5 ? "#ff8a3d" : "#ffd54f", 3);
      }
      if (!v.ignited) { v.ignited = true; AUDIO.breakShield(); }
      if (k >= 1) enemies = [];
    }

    FX.update(dt);
    for (const tx of texts) {
      tx.y -= 32 * dt;
      tx.life -= dt;
    }
    texts = texts.filter(tx => tx.life > 0);
    for (const r of rings) r.life -= dt;
    rings = rings.filter(r => r.life > 0);

    if (t >= VICTORY.settle) {
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
      else if (justPressed(1) || justPressed(9)) { if (quitConfirm) activateMenu('exit-cancel'); else if (state === 'pause') togglePause(); else if (state === 'won' || state === 'lost') returnHome(); }
      else if (justPressed(8) && !quitConfirm) activateMenu('codex');
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

    // Y 鍵 (Button 3)：升級畫面重抽
    if (state === "levelup" && justPressed(3)) reroll();

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
      } else if (state === "pause" || state === "menu" || state === "overworld") {
        codexBack = state;
        state = "codex";
      }
    }

    // 圖鑑：LB / RB 切換頁籤；十字鍵左右翻單字頁；B 返回。
    if (state === "codex") {
      if (justPressed(4)) {
        selectCodex('cards');
      } else if (justPressed(5)) {
        selectCodex('words');
      }
      if (justPressed(14)) selectCodex('prev');
      else if (justPressed(15)) selectCodex('next');
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
    return {
      word: bs.word,
      wrong: [],
      lock: 0.4,
      wasAssisted: !!bs.wasAssisted,
      ans: answerChoices(bs.word)
    };
  };

  function answerBoss(i) {
    if (state !== "play") return;
    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (!bossQ || bossQ.lock > 0 || !bs) return;
    if (i < 0 || i >= bossQ.ans.length) return;
    if (bossQ.wrong.includes(i)) return;
    const ok = bossQ.ans[i] === bs.word;

    if (ok) {
      if (bs.wasAssisted || bossQ.wasAssisted || (job?.assisted && job.word.jp === bs.word.jp)) {
        STORE.recAssisted(bs.word.jp);
      } else {
        STORE.rec(bs.word.jp, true);
      }
      bs.shield = false;
      bossQ = null;
      bs.quiz = null;
      say(`${bs.word.jp}＝${bs.word.zh}・結界破除！`, bs.x, bs.y - 75, "#9be7ff");
      burst(bs.x, bs.y, "#9be7ff", 35);
      FX.flash("#9be7ff", 0.18, 0.22);
      FX.emit("ring", "#9be7ff", { x: bs.x, y: bs.y, life: 0.3, s0: 20, s1: 110, a: 0.9, ease: true });
      RENDERER.triggerShake(9);
      AUDIO.breakShield();
      HAPTICS.shield();
    } else {
      misses.push(bs.word);
      STORE.rec(bs.word.jp, false);
      oil -= 8;
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
      say("答錯！燈油 -8 點，結界震盪！", P.x, P.y - 50, "#ff8f8f");
      if (oil <= 0) {
        oil = 0;
        loseRun();
        return;
      }
      bossQ.wrong.push(i);
      if (bossQ.wrong.length < bossQ.ans.length - 1) {
        bossQ.wasAssisted = true;
        bs.wasAssisted = true;
        if (job?.word.jp === bs.word.jp) job.assisted = true;
        bossQ.lock = 0.8;
        say("排除錯誤選項，再試一次！", P.x, P.y - 75, "#ffb3ba");
      } else {
        const lastWordJp = bs.word ? bs.word.jp : "";
        say(`${bs.word.jp}＝${bs.word.zh}・記住正解再挑戰`, P.x, P.y - 100, "#fff0a6");
        const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
        let pool = ALL.filter(w => w.jp !== lastWordJp && !livingMisWords.has(w.jp));
        if (pool.length === 0) pool = ALL.filter(w => w.jp !== lastWordJp);
        if (pool.length === 0) pool = ALL;
        bs.word = STORE.pick(pool);
        bs.wasAssisted = true;
        bs.quiz = mkQ(bs);
        bossQ = bs.quiz;
        bossQ.lock = 1.0;
      }
    }
  }

  function markBossAssisted(word) {
    const bs = enemies.find(e => e.type === "boss" && e.shield && e.word?.jp === word.jp);
    if (bs) bs.wasAssisted = true;
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
      say("天狐靈音：聆聽發音，排除一項！（燈油 -3）", P.x, P.y - 45, "#80deea");
      AUDIO.pickup();
    } else if (job.hintStage === 1 && oil > 4) {
      oil -= 4;
      job.hintStage = 2;
      job.assisted = true;
      job.showMeaningT = 4.0;
      hintT = 4.0;
      say(`破幻神符：${job.word.jp} 意為「${job.word.zh}」（燈油 -4）`, P.x, P.y - 45, "#ffd54f");
      AUDIO.pickup();
    }
    if (job.assisted) markBossAssisted(job.word);
  }

  function explodeTalisman(q){
    if(q.done)return;q.done=true;
    SKILLFX.play("boom","hit",5,{x:q.x,y:q.y,r:135,evolved:true});
    AUDIO.boomerang(5);
    for(const e of enemies)if(e.hp>0&&!q.volleyHits.has(e)&&dist(e,q)<=135){
      q.volleyHits.add(e);hurt(e,5*b.dmg);e.ib=elapsed+0.38;
    }
  }

  function weapons(dt) {
    // 1. 妖刀斬擊 (Katana) - 方向性扇形斬擊 (依玩家面朝方向前方 140 度扇形索敵，不擊中身後)
    atkT -= dt;
    if (WL.katana > 0 && atkT <= 0) {
      const reach = 145 + (WL.katana - 1) * 16;
      const faceAng = P.faceAng || 0;
      let hasEnemyInArc = false;
      for (const e of enemies) {
        if (e.hp > 0 && dist(P, e) <= (WL.katana===5?560:reach)) {
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
        atkT = wMax.katana = Math.max(0.24, 0.72 - b.rate * 0.13);
        if(WL.katana<5) RENDERER.addSlashArc(P.x, P.y, reach * 0.85, faceAng, 2.2, SKILLFX.tier(WL.katana));
        SKILLFX.play("katana", "swing", WL.katana, { x: P.x, y: P.y, ang: faceAng, reach: reach * 0.85 });

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
                SKILLFX.play("katana", "hit", WL.katana, { x: e.x, y: e.y, ang: faceAng, crit: isCrit });
              }
            }
          }
        }
        if (WL.katana===5 && winds.length<8) winds.push({x:P.x,y:P.y,vx:Math.cos(faceAng)*560,vy:Math.sin(faceAng)*560,ang:faceAng,size:360,life:0.95,hits:new Set(),dmg:(b.dmg+3.2)*1.15});
        AUDIO.slash(WL.katana);
      }
    }

    for(const wave of winds){
      const blockBlade=(x,y,r)=>[-0.9,-0.45,0,0.45,0.9].some(t=>blocked(x-Math.sin(wave.ang)*180*t,y+Math.cos(wave.ang)*180*t,r));
      if(!EVOLUTIONS.move(wave,dt,blockBlade,12))continue;
      for(const e of enemies)if(e.hp>0 && !wave.hits.has(e) && Math.abs((e.x-wave.x)*Math.cos(wave.ang)+(e.y-wave.y)*Math.sin(wave.ang))<(e.type==='boss'?95:75) && Math.abs(-(e.x-wave.x)*Math.sin(wave.ang)+(e.y-wave.y)*Math.cos(wave.ang))<180+(e.type==='boss'?40:22)){
        wave.hits.add(e);
        const decay = [1, 0.75, 0.55][Math.min(wave.hits.size - 1, 2)];
        hurt(e, wave.dmg * decay);SKILLFX.play("katana","hit",5,{x:e.x,y:e.y,ang:wave.ang});
        if(wave.hits.size>=3){wave.life=0;break;}
      }
    }
    winds=winds.filter(p=>p.life>0);

    // 2. 淨化靈陣 (Barrier AoE) - 360 度全方位退魔衝擊環（全新卡牌秘術技能）
    if (WL.barrier > 0) {
      wT.barrier -= dt;
      if (wT.barrier <= 0) {
        wT.barrier = wMax.barrier = Math.max(1.2, 3.2 - WL.barrier * 0.42 - b.rate * 0.2);
        const r = 140 + WL.barrier * 28;
        // 激發 360 度擴散金色退魔衝擊環與咒陣
        SKILLFX.play("barrier", "cast", WL.barrier, { x: P.x, y: P.y, r });
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
        AUDIO.barrier(WL.barrier);
      }
    }

    // 3. 天狐靈針 (Needles) - 面朝方向多發穿甲破魔靈針
    if (WL.needle > 0) {
      wT.needle -= dt;
      if (wT.needle <= 0) {
        wT.needle = wMax.needle = Math.max(0.45, 1.25 - WL.needle * 0.16 - b.rate * 0.1);
        const count = EVOLUTIONS.needleCount(WL.needle);
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
        const spread = WL.needle===5 ? 1.35 : WL.needle===4 ? 0.65 : 0.45;
        if(WL.needle===5) needles.push(...EVOLUTIONS.iceVolley(P,enemies,shootAng));
        else for (let i = 0; i < count; i++) {
          const a = shootAng + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
          needles.push({
            x: P.x, y: P.y,
            vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
            life: WL.needle===5 ? 0.95 : 0.65,
            level:WL.needle,
            curve:WL.needle===5,launchAng:a,ang:a,age:0,aimX:P.x+Math.cos(shootAng)*440,aimY:P.y+Math.sin(shootAng)*440,
            dmg: 1.4 + WL.needle * 0.7,
            trail: 0
          });
        }
        SKILLFX.play("needle", "fire", WL.needle, { x: P.x + Math.cos(shootAng) * 28, y: P.y + Math.sin(shootAng) * 28 });
        AUDIO.needle(WL.needle);
      }
    }

    for (const nd of needles) {
      EVOLUTIONS.curve(nd,dt);
      if(!EVOLUTIONS.move(nd,dt,nd.curve?blocked:null,6))continue;
      if ((nd.trail -= dt) <= 0) { nd.trail = 0.03; SKILLFX.play("needle", "trail", nd.level??WL.needle, { x: nd.x, y: nd.y, ang: Math.atan2(nd.vy, nd.vx) }); }
      for (const e of enemies) {
        if (e.hp > 0 && !(e.inb > elapsed) && !nd.hits?.has(e) && dist(e, nd) < (e.type === "boss" ? 54 : 30)) {
          e.inb = elapsed + 0.2;
          hurt(e, nd.dmg * b.dmg);
          if(nd.ice){nd.hits.add(e);EVOLUTIONS.freeze(e,elapsed);}
          SKILLFX.play("needle", "hit", nd.level??WL.needle, { x: nd.x, y: nd.y });
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
          wT.boom = wMax.boom = Math.max(0.75, 2.0 - WL.boom * 0.24);
          const count = EVOLUTIONS.boomCount(WL.boom);
          const volleyHits = new Set();
          const baseAng = Math.atan2(t.y - P.y, t.x - P.x);
          for (let i = 0; i < count; i++) {
            const a = baseAng + (i - (count - 1) / 2) * (WL.boom>=4?0.28:0.32);
            proj.push({ x: P.x, y: P.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, t: 0, back: false, life:WL.boom===5?1.25:2, level:WL.boom, volleyHits });
          }
          if(WL.boom<5) AUDIO.boomerang(WL.boom);
        }
      }
    }

    for (const q of proj) {
      const rank=q.level??WL.boom;
      q.t += dt;
      if (q.t > 0.6 && rank<5) q.back = true;
      if (q.back) {
        const dx = P.x - q.x, dy = P.y - q.y;
        const d = Math.hypot(dx, dy) || 1;
        q.vx = (dx / d) * 580;
        q.vy = (dy / d) * 580;
        if (d < 25) q.done = true;
      }
      if(rank===5){
        if(!EVOLUTIONS.move(q,dt,blocked,8)){explodeTalisman(q);continue;}
      }else{q.x+=q.vx*dt;q.y+=q.vy*dt;}
      if ((q.trail = (q.trail || 0) - dt) <= 0) { q.trail = 0.035; SKILLFX.play("boom", "trail", rank, { x: q.x, y: q.y }); }
      for (const e of enemies) {
        if (e.hp > 0 && !(e.ib > elapsed) && Math.hypot(e.x - q.x, e.y - q.y) < (e.type === "boss" ? 54 : 32)) {
          if(rank===5){explodeTalisman(q);break;}
          e.ib = elapsed + 0.38;
          hurt(e, (1.5 + rank * 0.7) * b.dmg);
          SKILLFX.play("boom", "hit", rank, { x: q.x, y: q.y, target: e });
        }
      }
    }
    proj = proj.filter(q => !q.done);

    // 5. 狐火環繞 (Fireball)
    if (WL.fire > 0 && WL.fire < 5) {
      wT.fire = Math.max(0, wT.fire - dt);
      let fireHit = false;
      fAng += dt * 2.8;
      const emitEmber = (fireEmitT -= dt) <= 0;
      if (emitEmber) fireEmitT = 0.05;
      const count = EVOLUTIONS.fireCount(WL.fire);
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * EVOLUTIONS.FIRE_ORBIT, fy = P.y + Math.sin(a) * EVOLUTIONS.FIRE_ORBIT;
        if (emitEmber) SKILLFX.play("fire", "ember", WL.fire, { x: fx, y: fy, ang: a });
        for (const e of enemies) {
          if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - fx, e.y - fy) < (e.type === "boss" ? 54 : 30)) {
            e.ifr = elapsed + 0.42;
            const hpBefore = e.hp;
            hurt(e, (1.2 + WL.fire * 0.6) * b.dmg);
            if (e.hp < hpBefore) fireHit = true;
            SKILLFX.play("fire", "hit", WL.fire, { x: fx, y: fy });
          }
        }
      }
      if (fireHit && wT.fire <= 0) { AUDIO.fireball(WL.fire); wT.fire = 0.15; }
    }

    if(WL.fire===5){
      wT.fire=Math.max(0,wT.fire-dt);fAng+=dt*2.8;
      const targets=enemies.filter(e=>e.hp>0&&!e.shield&&dist(P,e)<560).sort((a,b)=>dist(P,a)-dist(P,b));
      if(wT.fire<=0 && targets.length){
        wT.fire=wMax.fire=1.4;
        if(ghosts.length<3)ghosts.push(EVOLUTIONS.dragon(P,targets[Math.floor(Math.random()*Math.min(3,targets.length))],Math.random()*6.283));
        AUDIO.fireball(WL.fire);
      }
    }
    for(const spirit of ghosts){
      if(spirit.dragon){if(!EVOLUTIONS.dragonStep(spirit,dt,P,blocked))continue;}
      else {EVOLUTIONS.seek(spirit,dt,enemies);if(!EVOLUTIONS.move(spirit,dt,blocked,10))continue;}
      if((spirit.trail-=dt)<=0){spirit.trail=0.05;SKILLFX.play("fire","ghostTrail",5,spirit);}
      for(const e of enemies)if(e.hp>0&&(!spirit.dragon||spirit.age>0.6)&&dist(e,spirit)<(e.type==='boss'?64:42)){
        if(!spirit.hitSet.has(e)){spirit.hitSet.add(e);hurt(e,(spirit.dragon?12:6.8)*b.dmg);SKILLFX.play("fire","hit",5,{x:e.x,y:e.y});}
        if(!spirit.dragon){spirit.life=0;break;}
      }
    }
    ghosts=ghosts.filter(p=>p.life>0);

    // 6. 天狐落雷 (Thunder)
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const c = enemies.filter(e => e.hp > 0 && !e.shield && dist(P, e) < 450);
        if (!c.length) {
          wT.thunder = 0.2;
        } else {
          wT.thunder = wMax.thunder = Math.max(0.9, 2.6 - WL.thunder * 0.3);
          if(WL.thunder===5){
            const targets=enemies.filter(e=>e.hp>0 && !e.shield && dist(P,e)<380);
            SKILLFX.play("thunder","storm",5,{x:P.x,y:P.y,r:380});
            const isCrit=Math.random()<(0.2+(b.crit||0)*0.15),mult=isCrit?(1.8+(b.crit||0)*0.4):1;
            targets.forEach(e=>hurt(e,11*b.dmg*mult,isCrit));
            [...targets].sort((a,b)=>b.max-a.max).slice(0,6).forEach((e,i)=>SKILLFX.play("thunder","strike",5,{x:e.x,y:e.y,stormChild:true,delay:0.08+i*0.025}));
          }else{
            const targets=[...c].sort((a,b)=>b.hp-a.hp).slice(0,Math.min(3,WL.thunder));
            const struck=new Set();
            targets.forEach(t=>{
              SKILLFX.play("thunder","strike",WL.thunder,{x:t.x,y:t.y});
              const isCrit=Math.random()<(0.2+(b.crit||0)*0.15),mult=isCrit?(1.8+(b.crit||0)*0.4):1;
              for(const e of enemies)if(e.hp>0&&!struck.has(e)&&dist(e,t)<(WL.thunder===4?95:75)){
                struck.add(e);hurt(e,(3.5+WL.thunder*1.5)*b.dmg*mult,isCrit);
              }
            });
          }
          AUDIO.thunder(WL.thunder);
        }
      }
    }
  }

  function spawnRadius(minimum) {
    const area = viewBounds(), cam = RENDERER.getCam();
    const lag = Math.hypot(P.x - (cam.x + W / 2), P.y - (cam.y + H / 2));
    return Math.max(minimum, Math.hypot(area.width / 2, area.height / 2) + lag + 64);
  }

  function spawnPosition(rad, angle, collisionRadius, origin = P) {
    for (let tries = 0; tries <= 10; tries++) {
      const a = angle + tries * 0.63;
      const x = origin.x + Math.cos(a) * rad, y = origin.y + Math.sin(a) * rad;
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
    const shooterChance = STAGE_ENEMY.shooterChance ?? 0.14;
    const canShoot = STAGE_ENEMY.shots !== false;
    let t = { type: "ghost", hp: 2.0 * tier, speed: (52 + speedRamp * 0.9) * stageSpeed };
    if (cappedElapsed > 90 && r < 0.22) {
      t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
    } else if (cappedElapsed > 200 && r < 0.36) {
      t = { type: "tank", hp: 7 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
    } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.36 : 0.22) + shooterChance && !ring && canShoot) {
      t = { type: "shooter", hp: tier, speed: (48 + speedRamp * 0.8) * stageSpeed };
    }

    enemies.push({ ...position, flash: 0, wob: Math.random() * 6, slowT: 0, ...t, hp: Math.ceil(t.hp), max: Math.ceil(t.hp) });
  }

  function update(dt, hitStopped = false) {
    if (state !== "play") return;
    if (isPortrait()) { suspend(); return; }
    checkTutorial();
    if (tutorial) return;

    elapsed += dt;
    bossT -= dt;
    oil = Math.min(maxOil, oil - dt * 0.43 + (b.oilRegen || 0) * dt); // 10 分鐘制：總自然耗油維持接近舊 5 分鐘制
    if (oil <= 0) {
      oil = 0;
      if (finalBossDefeated && delivered >= GOAL_DELIVERIES) { startVictorySequence(); return; }
      loseRun();
      return;
    }
    if (elapsed >= DAWN) {
      if (delivered >= GOAL_DELIVERIES && finalBossDefeated) {
        startVictorySequence();
        return;
      }
      if (!finalBossDefeated) {
        const activeBoss = enemies.find(e => e.type === "boss" && e.hp > 0);
        if (activeBoss && !activeBoss.final) {
          activeBoss.final = true;
          bossStage = BOSS_TIMES.length;
          say("大妖鬼覺醒！破曉決戰", activeBoss.x, activeBoss.y - 75, "#ff5555");
        } else if (!activeBoss && bossStage < BOSS_TIMES.length - 1) {
          bossStage = BOSS_TIMES.length - 1; bossT = 0;
        }
      }
      if (warnDawnT === 0) {
        warnDawnT = -1;
        const need = Math.max(0, GOAL_DELIVERIES - delivered);
        say(!finalBossDefeated ? "擊敗大妖" : `還差 ${need} 件委託`, P.x, P.y - 75, "#ffb3ba");
      }
    }

    if (warnDawnT > 0) warnDawnT -= dt;

    // 燈火受擊衝量獨立衰減；即使命中停頓，也讓 HUD 的震盪自然回穩。
    lanternHitT = Math.max(0, lanternHitT - dt);

    // 命中停頓只凍結戰鬥動作；夜行時鐘、Boss 排程與耗油照常前進。
    if (hitStopped) return;

    P.inv = Math.max(0, P.inv - dt);
    dashT = Math.max(0, dashT - dt);
    dashCd = Math.max(0, dashCd - dt);
    hintT = Math.max(0, hintT - dt);
    nameT = Math.max(0, nameT - dt);

    FX.update(dt);
    SKILLFX.update(dt);

    for (const t of texts) {
      t.y -= 32 * dt;
      t.life -= dt;
    }
    texts = texts.filter(t => t.life > 0);

    for (const r of rings) r.life -= dt;
    rings = rings.filter(r => r.life > 0);

    for (const o of orders) o.life -= dt;
    const expired = orders.filter(o => o.life <= 0).length;
    orders = orders.filter(o => o.life > 0);
    if (expired) {
      say("委託逾期", P.x, P.y - 45, "#ff8f8f"); // 逾期不扣燈油、不算誤配
    }

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
    const tier = CFG.enemyTier(elapsed, pw);

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = CFG.spawnInterval(cappedElapsed) * SPAWN_INTERVAL_SCALE;
      const count = Math.max(1, CFG.spawnCount(cappedElapsed) + SPAWN_COUNT_BONUS);
      for (let k = 0; k < count && enemies.length < 95; k++) {
        spawnEnemy(tier, 560);
      }
    }

    // 百鬼夜行：一次音效，保留 2.4 秒準備時間。
    if (surgeWarningT > 0) {
      surgeWarningT -= dt;
      if (surgeWarningT <= 0) {
        // 預警結束後生成包圍波，不再追加第二段音效或文字。
        surgeWarningT = 0;
        surgeT = SURGE_INTERVAL;
        RENDERER.triggerShake(14);
        for (let k = 0; k < surgePendingCount; k++) {
          spawnEnemy(surgePendingTier, 450, (k / surgePendingCount) * 6.283, true);
        }
      }
    } else {
      surgeT -= dt;
      if (surgeT <= 0) {
        // 啟動 2.4 秒預警（閃爍 3 次，每 0.8 秒一次）
        surgeWarningT = 2.4;
        AUDIO.warningPulse();
        HAPTICS.warning();
        RENDERER.triggerShake(5);
        surgePendingTier = tier;
        surgePendingCount = 10 + Math.floor(cappedElapsed / 60);
      }
    }

    // 敵人邏輯與傷害碰撞（衝撞扣燈油；若有護盾則扣護盾）
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.attackT = Math.max(0, (e.attackT || 0) - dt);
      if(e.freezeT>0){e.freezeT=Math.max(0,e.freezeEnds==null?e.freezeT-dt:e.freezeEnds-elapsed);e.walking=false;if(e.freezeT>0)continue;}
      if (e.slowT > 0) e.slowT -= dt;
      if (e.type === "mis") {
        e.speed = MIS_SPEED;
      }
      const revealing = e.revealT && e.revealT > 0;
      if (revealing) e.revealT = Math.max(0, e.revealT - dt);
      const curSpd = revealing ? 0 : ((e.slowT && e.slowT > 0) ? Math.min(e.speed, 25) : e.speed);
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // 定點預告砸地：蓄勢時鎖定位置，玩家可離開 150px 判定範圍。
      let slamHit = false;
      if (e.type === "boss") {
        e.slamCd = Math.max(0, (e.slamCd || 0) - dt);
        e.slamRecovery = Math.max(0, (e.slamRecovery || 0) - dt);
        if (e.slam) {
          e.slam.t -= dt;
          if (e.slam.t <= 0) {
            slamHit = Math.hypot(P.x-e.slam.x,P.y-e.slam.y) < 150;
            rings.push({x:e.slam.x,y:e.slam.y,life:0.4,maxL:0.4,maxR:150,color:'#ff8050'});
            burst(e.slam.x,e.slam.y,'#ffbd72',28);
            e.slam = null; e.slamRecovery = 0.7; e.attackT = 0.4;
            RENDERER.triggerShake(8); AUDIO.thunder();
          }
        } else if (e.slamCd <= 0 && e.slamRecovery <= 0 && d < 230) {
          e.slam = {x:e.x,y:e.y,t:1.1}; e.slamCd = 5;
        }
      }
      const bossBusy = e.type === "boss" && (e.slam || e.slamRecovery > 0);

      // 所有怪物逼近玩家（加入建築物碰撞障礙滑移）
      const step = bossBusy ? 0 : CFG.chaseStep(d, curSpd, dt, e.type, STAGE_ENEMY.shots !== false);
      const stepX = ((dx || (d === 1 && !dy ? 1 : 0)) / d) * step;
      const stepY = (dy / d) * step;
      const oldX = e.x, oldY = e.y;
      if (!blocked(e.x + stepX, e.y, 16)) e.x += stepX;
      if (!blocked(e.x, e.y + stepY, 16)) e.y += stepY;
      e.walking = !revealing && (e.x !== oldX || e.y !== oldY);
      if (e.type === "mis") {
        e.stuckT = step > 0 && e.x === oldX && e.y === oldY ? (e.stuckT || 0) + dt : 0;
        if (e.stuckT >= 2.5) {
          const safe = spawnPosition(160, Math.atan2(e.y - P.y, e.x - P.x), 34);
          if (safe) { Object.assign(e, safe); e.revealT = 0.9; }
          e.stuckT = 0;
          continue;
        }
      }

      // 射手型妖怪（shooter）：於中距離發射幽冥妖火彈
      if (STAGE_ENEMY.shots !== false && (e.type === "shooter" || (e.type === "mis" && !revealing))) {
        e.shootCd = (e.shootCd || (2.0 + Math.random())) - dt;
        if (e.shootCd <= 0 && d > 50 && d < (e.type === "mis" ? 200 : 460)) {
          e.shootCd = 3.2 + Math.random() * 1.2;
          e.attackT = 0.24;
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
      if (!revealing && P.inv <= 0 && (slamHit || (!bossBusy && d < hitRadius))) {
        e.attackT = 0.24;
        if (b.shield && b.shield > 0) {
          b.shield--;
          P.inv = 0.85;
          RENDERER.triggerShake(6);
          burst(P.x, P.y, "#ffe28b", 22);
          say(`護盾抵擋！剩餘 ${b.shield}`, P.x, P.y - 45, "#ffe28b");
          AUDIO.breakShield();
          HAPTICS.shield();
        } else {
          const dmg = (slamHit ? 20 : e.type === "tank" ? 18 : 10);
          oil -= dmg;
          lanternHitT = 0.42;
          P.inv = 1.0;
          RENDERER.triggerShake(10);
          burst(P.x, P.y, "#ff6b81", 18);
          say(`受傷！燈油 -${dmg} 點`, P.x, P.y - 36, "#ff6b81");
          AUDIO.hurt();
          HAPTICS.damage();
          if (oil <= 0) {
            oil = 0;
            loseRun();
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
      if (blocked(eb.x, eb.y, 8)) { eb.life = 0; continue; }
      if (dist(P, eb) < 20 && P.inv <= 0) {
        eb.life = 0;
        if (b.shield && b.shield > 0) {
          b.shield--;
          P.inv = 0.8;
          RENDERER.triggerShake(5);
          say(`護盾抵擋！剩餘 ${b.shield}`, P.x, P.y - 45, "#ffe28b");
          AUDIO.breakShield();
          HAPTICS.shield();
        } else {
          const dmg = 8;
          oil -= dmg;
          lanternHitT = 0.42;
          P.inv = 0.85;
          RENDERER.triggerShake(7);
          burst(P.x, P.y, "#ff6b81", 14);
          say(`妖火中彈！燈油 -${dmg} 點`, P.x, P.y - 36, "#ff6b81");
          AUDIO.hurt();
          HAPTICS.damage();
          if (oil <= 0) {
            oil = 0;
            loseRun();
            return;
          }
        }
      }
    }
    enemyBullets = enemyBullets.filter(eb => eb.life > 0);
    const despawnRadius = Math.max(1150, spawnRadius(0) + 300);
    enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || (e.type === "mis" && dist(e, P) < 3000) || dist(e, P) < despawnRadius));

    if (elapsed >= DAWN && finalBossDefeated && delivered >= GOAL_DELIVERIES && state === "play") {
      startVictorySequence();
      return;
    }

    // 3 / 6 / 9 分鐘中型 Boss，9:50 最終 Boss；上一隻尚未擊破時不重疊。
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
        say(isFinal ? (harborBoss ? "港霧大妖" : "大妖出現") : (harborBoss ? "港霧妖將" : "大妖出現"), P.x, P.y - 75, "#ff8f8f");
        AUDIO.thunder();
      }
    }

    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (bs && dist(P, bs) < 380) {
      if (!bs.quiz) bs.quiz = mkQ(bs);
      bossQ = bs.quiz;
      bossQ.lock = Math.max(0, bossQ.lock - dt);
    } else {
      bossQ = null;
    }

    // 靈玉經驗吸收
    const att = 110 + b.mag * 80;
    for (const g of gems) {
      const d = dist(P, g);
      if (d > GEM_DISTANCE) { g.done = true; continue; }
      if (d < att && d > 0) {
        const s = 240 + (att - d) * 3;
        g.x += ((P.x - g.x) / d) * s * dt;
        g.y += ((P.y - g.y) / d) * s * dt;
      }
      if (d < 24) {
        xp += g.v;
        g.done = true;
        FX.gem(g.x, g.y);
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

      // 進入外移後的答題區時激發結界。
      if (toDist < 220 && !job.sanctuaryTriggered) {
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
          if (ed < 240 && e.type !== "boss") {
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
        ps.slice(0,job.ans.length).forEach((p, i) => {
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
    if (!liveMotion()) t = 0;
    const intensity = Math.max(0.4, STAGE_VISUAL.rainIntensity || 1);
    const area = viewBounds();
    const drops = Math.min(80, Math.round(72 * intensity * area.width * area.height / (W * H)));
    ctx.save();
    ctx.strokeStyle = "rgba(174, 218, 238, 0.48)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let i = 0; i < drops; i++) {
      const speed = 520 + (i % 5) * 55;
      const x = area.left + ((i * 97 + t * speed * 0.18) % (area.width + 120)) - 60;
      const y = area.top + ((i * 61 + t * speed) % (area.height + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const length = 16 + (i % 4) * 4;
      ctx.lineTo(x + length * 0.18, y + length);
      ctx.stroke();
    }
    const fog = Math.max(0, Math.min(0.35, STAGE_VISUAL.fog || 0));
    if (fog > 0) {
      const area = viewBounds();
      const haze = ctx.createLinearGradient(area.left, area.top, area.right, area.bottom);
      haze.addColorStop(0, `rgba(120, 150, 170, ${fog * 0.55})`);
      haze.addColorStop(0.5, `rgba(180, 198, 205, ${fog})`);
      haze.addColorStop(1, `rgba(98, 125, 148, ${fog * 0.7})`);
      ctx.fillStyle = haze;
      ctx.fillRect(area.left, area.top, area.width, area.height);
    }
    ctx.restore();
  }

  // ---------- 繪圖主循環 ----------
  function liveMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : 1;
  }

  // 跟隨角色的貨物圖示（世界座標，需在已平移的 ctx 內呼叫）。
  function drawCargo() {
    if (!job) return;
    ctx.save();
    const cyPos = cargo.y + Math.sin(elapsed * 5) * 3 * liveMotion();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    UI.drawWordCue(ctx, job.word, cargo.x, cyPos + 1, job.word.cue === "emoji" ? 40 : 28);
    ctx.restore();
  }

  function drawWorld() {
    const cam = RENDERER.getCam();
    const shakeOffset = RENDERER.getShakeOffset();
    const holdDawn = elapsed >= DAWN && state !== "victory" && state !== "won" && state !== "lost";
    const dawnBlend = state === "victory" ? victoryDawn() : 0;
    const visualElapsed = holdDawn
      ? DAWN * 0.92
      : state === "victory"
        ? DAWN * (0.92 + 0.08 * dawnBlend)
        : elapsed;

    ctx.save();
    ctx.translate(-cam.x + shakeOffset.x, -cam.y + shakeOffset.y);
    const view = viewBounds();
    const nearView = (x, y, margin = 220) =>
      x >= cam.x + view.left - margin && x <= cam.x + view.right + margin &&
      y >= cam.y + view.top - margin && y <= cam.y + view.bottom + margin;

    // 1. 地面與道路
    RENDERER.drawGround(visualElapsed, DAWN, activeChunks, STAGE_VISUAL.ground || "ground");

    // 2. 地面高空流雲投影視差層 (Far Sky Cloud Shadows, 0.20x)
    RENDERER.drawGroundParallax?.(visualElapsed, DAWN, cam);

    // 3. 街角石燈。畫在角色之前，腳底對齊燈位；圖還沒載入時退回提燈符號。
    LAMPS.forEach(l => {
      if (!nearView(l.x, l.y)) return;
      // 光源在石燈的火袋（約離腳底 30px 高），用柔邊的加法光暈，不再是貼地的硬邊圓。
      FX.glow(ctx, l.x, l.y - 30, 150, "#ffcf6a", 0.5);
      const lamp = window.ART && window.ART.prop_lantern;
      if (lamp && lamp.complete && lamp.naturalWidth) {
        const lw = 34;
        const lh = lw * lamp.naturalHeight / lamp.naturalWidth;
        ctx.drawImage(lamp, l.x - lw / 2, l.y - lh + 8, lw, lh);
        FX.glow(ctx, l.x, l.y - 30, 44, "#ffe3a0", 0.55);
      } else {
        ctx.fillStyle = "#3a2a22";
        ctx.fillRect(l.x - 2, l.y - 16, 4, 22);
        ctx.fillStyle = "#ffb347";
        ctx.beginPath();
        ctx.roundRect(l.x - 8, l.y - 8, 16, 18, 3);
        ctx.fill();
      }
    });

    // 4. 委託氣泡移至頂層 (15.5) 繪製，確保永不被建築、角色或陰影遮擋

    // 5. 送達判定圈 (和風結界魔法陣 + 退魔結界視覺)
    if (job && dist(P, job.to) < 330) {
      // 連續雙環：白色光芯、青色暈光與寬柔光束，沒有枝狀邊線。
      {
        ctx.save();
        const alpha = job.sanctuaryT > 0 ? 0.85 : 0.55;
        const cy = job.to.y + 70;
        ctx.globalCompositeOperation='lighter';
        for(const [width,a,color] of [[28,0.035,'80,200,255'],[16,0.07,'90,215,255'],[7,0.3,'110,235,255'],[2.3,0.95,'220,255,255']]) {
          ctx.lineWidth=width;ctx.strokeStyle=`rgba(${color},${alpha*a})`;
          ctx.beginPath();ctx.ellipse(job.to.x,cy,245,165,0,0,6.283);ctx.stroke();
        }
        ctx.lineWidth=1.5;ctx.strokeStyle=`rgba(160,245,255,${alpha*0.7})`;
        ctx.beginPath();ctx.ellipse(job.to.x,cy,228,153,0,0,6.283);ctx.stroke();
        for(let k=0;k<8;k++) {
          const a=k*6.283/8, x=job.to.x+Math.cos(a)*238, y=cy+Math.sin(a)*160;
          const h=42+(liveMotion()?Math.sin(elapsed*1.5+k)*8:0);
          const g=ctx.createLinearGradient(x,y-h,x,y);
          g.addColorStop(0,'rgba(80,210,255,0)');g.addColorStop(1,`rgba(100,235,255,${alpha*0.13})`);
          ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x-18,y-h);ctx.lineTo(x+18,y-h);ctx.lineTo(x+7,y);ctx.closePath();ctx.fill();
        }
        ctx.restore();
      }

      // 答題圓墊在地面上，店面、玩家和妖怪都畫在它後面。判定仍是墊心 38px。
      ansPos(job.to).slice(0,job.ans.length).forEach((p, i) => {
        const cur = (job.idx === i);
        const isEliminated = (job.eliminatedIdx === i);
        const answerText = job.rev ? job.ans[i].zh : job.ans[i].jp;

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
          ctx.fillText(answerText, p.x, p.y + 6);
          ctx.strokeStyle = "#e57373";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x - 16, p.y - 16); ctx.lineTo(p.x + 16, p.y + 16);
          ctx.moveTo(p.x + 16, p.y - 16); ctx.lineTo(p.x - 16, p.y + 16);
          ctx.stroke();
          ctx.restore();
          return;
        }

        ctx.fillStyle = cur ? "rgba(255, 235, 140, 0.98)" : "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 36, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = cur ? "#ff7700" : "#c29d5b";
        ctx.lineWidth = cur ? 5 : 2.5;
        ctx.stroke();
        if (cur) {
          ctx.strokeStyle = "#ff5500";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 44, -1.57, -1.57 + 6.283 * Math.min(1, job.hold / 0.45));
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 6. 靈玉經驗寶石
    for (const g of gems) {
      if (!nearView(g.x, g.y, 40)) continue;
      FX.glow(ctx, g.x, g.y, g.v > 2 ? 54 : 38, "#6bf0ff", 0.55 + 0.25 * Math.sin(elapsed * 6 + g.x));
      ctx.fillStyle = "#6bf0ff";
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.v > 2 ? 8 : 6, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(g.x - 2, g.y - 2, 2, 0, 6.28);
      ctx.fill();
    }

    // 技能的貼地圖案（淨化靈陣等）畫在所有角色之前，才會被角色蓋住。
    FX.drawGround(ctx, cam, view);

    // Boss 預告置於地面，固定圓心與實際傷害半徑一致。
    for (const e of enemies) if(e.hp>0 && e.slam && nearView(e.x,e.y)) {
      const s=e.slam, progress=1-s.t/1.1;
      ctx.save();ctx.fillStyle='rgba(255,65,35,0.16)';ctx.strokeStyle='#ffbd72';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(s.x,s.y,150,0,6.283);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#ff583a';ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(s.x,s.y,150,-1.57,-1.57+6.283*progress);ctx.stroke();
      ctx.font=UI.readableFont(16,'900');ctx.fillStyle='#fff0cb';ctx.textAlign='center';
      ctx.fillText('砸地！離開紅圈',s.x,s.y+80);ctx.restore();
    }

    // 7. 依腳底地面接觸點排序；北側角色被屋頂遮住，南側角色在屋前。
    const actors = [
      ...houses.filter(h => nearView(h.x, h.y)).map(h => ({ house: h, y: h.y + 48 })),
      ...enemies.filter(e => nearView(e.x, e.y)).map(e => ({ enemy: e, y: e.y + (e.type === "boss" ? 44 : e.type === "mis" ? 27 : 19) })),
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
        if(e.freezeT>0) SKILLFX.paint(ctx,'ice',5,{x:e.x,y:e.y,boss:e.type==='boss'});

        ctx.restore();
      } else {
        drawCargo(); // 貨物圖示畫在角色後方，不遮住角色臉與上半身
        RENDERER.drawPlayer(P, dashT > 0, P.inv, elapsed, move(), b.shield || 0);
      }
    }

    // 8. 武器彈幕 (符咒迴力鏢)
    for (const q of proj) SKILLFX.paint(ctx, "boom", q.level??WL.boom, { x: q.x, y: q.y, spin: elapsed * 16 });

    // Lv1–4 保留環繞狐火；MAX 只畫實際飛行的火龍。
    if (WL.fire > 0 && WL.fire < 5) {
      const count = EVOLUTIONS.fireCount(WL.fire);
      const orbitR = EVOLUTIONS.FIRE_ORBIT;
      for (let i = 0; i < count; i++) {
        const a = fAng + (i * 6.283) / count;
        SKILLFX.paint(ctx, "fire", WL.fire, {
          x: P.x + Math.cos(a) * orbitR, y: P.y + Math.sin(a) * orbitR,
          ang: a, origin: P, orbitR, time: elapsed + i * 0.2
        });
      }
    }

    // 12.5 破魔靈針彈幕
    for(const p of winds) SKILLFX.paint(ctx,"wind",5,p);
    for(const p of ghosts) SKILLFX.paint(ctx,"ghost",5,p);
    for (const nd of needles) SKILLFX.paint(ctx, "needle", nd.level??WL.needle, { x: nd.x, y: nd.y, ang: Math.atan2(nd.vy, nd.vx) });

    // 13. 斬擊弧與結界擊中環
    RENDERER.drawSlashArcs();
    for (const r of rings) {
      const maxL = r.maxL || 0.32;
      const progress = 1 - (r.life / maxL);
      const curR = r.maxR ? (r.maxR * (0.35 + 0.65 * progress)) : r.r;
      const a = Math.max(0, r.life / maxL);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color || "#ffeb8c";
      ctx.lineWidth = 3 + (1 - progress) * 2;
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

    // 14. 飄字（發光粒子在夜色遮罩之後以加法混色繪製）
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
        const floatY = h.y - 75 + Math.sin(elapsed * 4 + h.phase) * 4 * liveMotion();
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
        const floatY = h.y - 80 + Math.sin(elapsed * 4) * 4 * liveMotion();
        ctx.save();
        ctx.fillStyle = "#40c4ff";
        ctx.beginPath();
        ctx.arc(h.x, floatY, 14, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x - 8, floatY - 6); ctx.lineTo(h.x + 8, floatY - 6);
        ctx.moveTo(h.x - 6, floatY - 2); ctx.lineTo(h.x + 6, floatY - 2);
        ctx.moveTo(h.x - 5, floatY - 2); ctx.lineTo(h.x - 5, floatY + 8);
        ctx.moveTo(h.x + 5, floatY - 2); ctx.lineTo(h.x + 5, floatY + 8);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 答案文字置頂；圓墊仍在地面，鄰屋屋頂不能遮住選項。
    if(job && dist(P,job.to)<330) {
      ctx.save();ctx.textAlign='center';
      ansPos(job.to).slice(0,job.ans.length).forEach((p,i)=>{
        const meaning=job.showMeaningT>0 && job.ans[i]===job.word;
        ctx.font="900 28px 'Noto Sans JP', 'Microsoft JhengHei', sans-serif";
        ctx.strokeStyle='#ffffff';ctx.lineWidth=5;
        const text=job.rev?job.ans[i].zh:job.ans[i].jp, y=p.y+(meaning?0:8);
        ctx.strokeText(text,p.x,y);ctx.fillStyle=job.eliminatedIdx===i?'#888899':'#161224';ctx.fillText(text,p.x,y);
        if(meaning){ctx.font=UI.readableFont(13,'bold');ctx.fillStyle='#d84315';ctx.strokeText(`【${job.ans[i].zh}】`,p.x,p.y+19);ctx.fillText(`【${job.ans[i].zh}】`,p.x,p.y+19);}
      });ctx.restore();
    }

    // 15.5 委託氣泡與接案標籤（最上層繪製，確保永不被建築、角色、怪物或陰影遮擋）
    for (const o of orders) {
      const h = o.from;
      const floatY = h.y - 128 + Math.sin(elapsed * 3.5 + h.phase) * 4 * liveMotion();
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
      // 委託送什麼東西一句話就好，送往哪裡不需要顯示。
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
    RENDERER.renderLighting(P, LAMPS, oil, visualElapsed, DAWN, maxOil, lampOutAmount(), shakeOffset);

    // 技能光效自帶光源：在夜色遮罩之後加法繪製，才會真的「發亮」而不是被壓暗。
    ctx.save();
    ctx.translate(-cam.x + shakeOffset.x, -cam.y + shakeOffset.y);
    FX.draw(ctx, cam, view);
    ctx.restore();
    FX.drawFlash(ctx, view);

    // 16.5 中景流動夜霧視差層 (Midground Volumetric Mist, 0.45x)
    RENDERER.drawMistParallax?.(visualElapsed, DAWN, cam);

    // 17. 櫻花雨與夜行幽火
    const motion = liveMotion();
    RENDERER.drawAtmosphere(visualElapsed, Math.round((STAGE_VISUAL.petals ?? 0) * 0.6 * motion), Math.round((STAGE_VISUAL.fireflies ?? 0) * 0.6 * motion));
    drawStageWeather(visualElapsed);

    // 敵方火彈自發光，放在夜色與雨霧之上，避免遠距離攻擊被壓暗。
    ctx.save();
    ctx.translate(-cam.x + shakeOffset.x, -cam.y + shakeOffset.y);
    for (const eb of enemyBullets) {
      ctx.fillStyle = "#ba68c8";
      ctx.beginPath();ctx.arc(eb.x, eb.y, 8, 0, 6.28);ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();ctx.arc(eb.x, eb.y, 3.5, 0, 6.28);ctx.fill();
    }
    ctx.restore();

    // 破曉後若配達已完成，使用與送貨金箭頭不同的赤色雙箭頭追蹤最終大妖鬼。
    const bossHunt = elapsed >= DAWN && delivered >= GOAL_DELIVERIES && !finalBossDefeated;
    const bossTarget = bossHunt ? enemies.find(e => e.type === "boss" && e.final && e.hp > 0) : null;
    if (bossTarget) {
      const sx = bossTarget.x - cam.x, sy = bossTarget.y - cam.y;
      const onScreen = sx >= viewBounds().left + 70 && sx <= viewBounds().right - 70 && sy >= viewBounds().top + 90 && sy <= viewBounds().bottom - 70;
      ctx.save();
      ctx.strokeStyle = "#ff3b4f";
      ctx.fillStyle = "#ff3b4f";
      ctx.lineWidth = 4;
      if (onScreen) {
        const pulseR = 58 + Math.sin(elapsed * 8) * 7;
        ctx.beginPath();
        ctx.arc(sx, sy - 30, pulseR, 0, 6.28);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = UI.readableFont(16, "900");
        ctx.fillText("大妖鬼", sx, sy - 100);
      }
      ctx.restore();
    }

  }

  function turnCodexPage(delta) {
    const next = UI.codexButtons(codexTab,codexPage,codexWords().length).find(b=>b.id==='next');
    if(delta>0&&next.disabled)return;
    const lastPage = codexTab==='cards'?Math.ceil(UI.CARD_LIST.length/UI.codexRows())-1:Math.max(0,Math.ceil(codexWords().length/15)-1);
    codexPage = clamp(codexPage + delta, 0, lastPage);
  }

  // ---------- 輸入監聽 ----------
  addEventListener("keydown", e => {
    if (frameError) {
      if (!e.repeat && (e.code === "Enter" || e.code === "Escape")) recoverFrameError();
      return;
    }
    if (isPortrait() || document.hidden) return;
    if (CONTROLS.isOpen()) return;
    if (e.target?.closest?.('button, input, select, textarea, dialog')) return;
    if (!e.repeat && state === "play") AUDIO.init();
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
    if (quitConfirm) {
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' || action === 'pause') activateMenu('exit-cancel');
      else if (e.code === 'Tab' || ['u','d','l','r'].includes(action)) moveMenu(e.code === 'Tab' ? (e.shiftKey ? -1 : 1) : ['u','l'].includes(action) ? -1 : 1);
      else if (e.key === 'Enter' || action === 'interact') activateMenu(menuButtons()[menuFocus].id);
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
        selectCodex(codexTab === "cards" ? "words" : "cards");
      } else if (action === "l" || action === "r") {
        e.preventDefault();
        selectCodex(action === "l" ? 'prev' : 'next');
      } else if(action==='u'||action==='d') {
        e.preventDefault();const buttons=UI.codexButtons(codexTab,codexPage,codexWords().length);
        const index=buttons.findIndex(b=>b.id===codexFocus);codexFocus=buttons[(index+(action==='u'?-1:1)+buttons.length)%buttons.length].id;
      } else if(!e.repeat&&(e.code==='Enter'||action==='interact')) {
        e.preventDefault();selectCodex(codexFocus);
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
    if (state === "levelup" && !e.repeat && e.code === "KeyR") {
      reroll();
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
    else if (bossQ && !e.repeat && "123".includes(e.key)) {
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
    if (frameError) return;
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
  const hitButton = (p, bt) => {
    const minimum = 44 / (window.VIEWPORT?.get().scale || 1);
    const px = Math.max(0, (minimum - bt.w) / 2), py = Math.max(0, (minimum - bt.h) / 2);
    return p.x >= bt.x - px && p.x <= bt.x + bt.w + px && p.y >= bt.y - py && p.y <= bt.y + bt.h + py;
  };

  document.getElementById("game-container").addEventListener("pointerdown", e => {
    e.preventDefault();
    if (frameError) { recoverFrameError(); return; }
    if (isPortrait() || document.hidden) return;
    cv.setPointerCapture(e.pointerId);
    AUDIO.init();
    touch = e.pointerType !== "mouse";
    inputMode = touch ? 'touch' : 'keyboard';
    if (tutorial) {
      const p = pp(e);
      UI.TUTORIAL_BTNS.forEach((bt,i) => { if(hitButton(p, bt)) closeTutorial(i===1); });
      return;
    }
    if (e.pointerType === "mouse" && e.button === 2) { dash(); return; }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = pp(e);

    if (quitConfirm) {
      const button = UI.EXIT_BTNS.find(b=>hitButton(p, b));
      if (button) activateMenu(button.id);
      return;
    }

    // 檢查右上角暫停鈕點擊
    if (hitButton(p, btnPause)) {
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
        if (hitButton(p, {x, y:btn.y, w, h})) {
          activateMenu(btn.id);
          return;
        }
      }
      return;
    }

    if (state === "codex") {
      const button=UI.codexButtons(codexTab,codexPage,codexWords().length).find(b=>hitButton(p,b));
      if(button){if(!button.disabled)selectCodex(button.id);return;}

      // 點擊底部返回按鈕或外圍區域
      if (hitButton(p, {x:W/2-95,y:548,w:190,h:42})) {
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
      if (hitButton(p, back)) {
        returnHome();
        return;
      }

      const enter = window.OVERWORLD.ENTER_BTN;
      const here = window.OVERWORLD.currentNode(overworld);
      if (window.OVERWORLD.isEnterable(here) && hitButton(p, enter)) {
        confirmOverworld();
        return;
      }

      const node = window.OVERWORLD.hitTest(overworld, p.x, p.y);
      if (node) {
        if (node.id === overworld.currentId) confirmOverworld();
        else {
          const ok = window.OVERWORLD.moveTo(overworld, node.id);
          if (!ok && !window.OVERWORLD.isEnterable(node)) {
            overworldNoticeT = 1.5;
            AUDIO.warningPulse?.();
          }
        }
      }
      return;
    }
    if (state === 'menu' || state === 'won' || state === 'lost') {
      const btn = menuButtons().find(b => hitButton(p, b));
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
      if (UI.REROLL_BTN && hitButton(p, UI.REROLL_BTN)) reroll();
      return;
    }
    if (bossQ) {
      const layout = UI.bossQuizLayout(bossQ.ans.length);
      for (let i = 0; i < layout.options.length; i++) {
        const option = layout.options[i];
        if (p.x >= option.x && p.x <= option.x+option.w && p.y >= option.y && p.y <= option.y+option.h) {
          answerBoss(i);
          return;
        }
      }
    }
    if (inter && hit(p, btnE)) {
      interact();
    } else if (hit(p, btnD)) {
      dash();
    } else if (job && UI.HINT_BTN && hitButton(p, UI.HINT_BTN)) {
      triggerHint();
    } else if ((e.pointerType === "mouse" || (p.x < W / 2 && p.y > 80)) && !joy) {
      joy = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
    }
  });

  cv.addEventListener("contextmenu", e => e.preventDefault());
  cv.addEventListener("pointermove", e => {
    if(state==='codex'){
      const p=pp(e),button=UI.codexButtons(codexTab,codexPage,codexWords().length).find(b=>hitButton(p,b));
      if(button)codexFocus=button.id;
    }
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
  let frameError = false;
  function recoverFrameError() {
    frameError = false;
    state = "menu";
    menuFocus = 0;
    menuFocusState = "menu";
    quitConfirm = false;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    tutorial = null; bossQ = null; job = null; inter = null;
    orders = []; enemies = []; gems = []; texts = []; rings = [];
    proj = []; needles = []; winds = []; ghosts = []; enemyBullets = [];
    victorySeq = null; lampSeq = null; finalBossEnt = null;
    FX.reset(); SKILLFX.reset(); RENDERER.clearShake();
    AUDIO.setSuspended(false);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!frameError) {
      try { runFrame(now); return; }
      catch (error) {
        frameError = true;
        state = "pause";
        keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
        AUDIO.setSuspended(true);
        console.error("遊戲迴圈發生錯誤", error);
      }
    }
    const density = RENDERER.getDpr() || 1;
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.fillStyle = "#141b2b";
    ctx.fillRect(0, 0, (cv.width || W) / density, (cv.height || H) / density);
    ctx.fillStyle = "#fff1d4";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("發生錯誤，請重新整理。", 24, 60);
  }

  const stageChapter = () => Math.max(1, Object.keys(window.CONTENT.STAGES).indexOf(STAGE.id) + 1);
  // HUD 需要的即時資料：武器冷卻比例、Boss、連擊與附近委託房屋（小地圖用）。
  function hudExtra(time) {
    const cd = {};
    if (WL.katana > 0) cd.katana = clamp((atkT - 0.1) / Math.max(0.01, wMax.katana - 0.1), 0, 1);
    for (const k of ["barrier", "needle", "boom", "thunder", ...(WL.fire===5?["fire"]:[])]) if (WL[k] > 0) cd[k] = clamp(wT[k] / wMax[k], 0, 1);
    const guideTarget = job ? job.to : orders.reduce((n, o) => (!n || dist(P, o.from) < dist(P, n) ? o.from : n), null);
    const bossHunting = elapsed >= DAWN && delivered >= GOAL_DELIVERIES && !finalBossDefeated;
    const huntTarget = bossHunting ? enemies.find(e => e.type === "boss" && e.final && e.hp > 0) : null;
    return {
      time, cd, houses, cam: RENDERER.getCam(),
      lanternHit: clamp(lanternHitT / 0.42, 0, 1),
      // 固定在任務區旋轉的方向箭頭：送貨／取貨目標（金），破曉後的大妖鬼（赤雙箭頭）。
      guideAngle: guideTarget ? Math.atan2(guideTarget.y - P.y, guideTarget.x - P.x) : null,
      bossAngle: huntTarget ? Math.atan2(huntTarget.y - P.y, huntTarget.x - P.x) : null,
      boss: enemies.find(e => e.type === "boss" && e.hp > 0) || null
    };
  }

  function runFrame(now) {
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

    const hitStopped = RENDERER.updateEffects(dt);
    if (state !== 'play' || tutorial) RENDERER.clearShake();

    if (state === "play") {
      update(dt, hitStopped);
    } else if (state === "levelup") {
      // 升級選卡期間凍結燈油消耗與遊戲時間，給予玩家安心閱讀與思考時間
    } else if (state === "lampout") {
      updateLampSequence(dt);
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
      const prevBest = STORE.getStageStats(STAGE.id).bestScore || 0;
      runSummary = { prevBest, newBest: score > prevBest, goal: GOAL_DELIVERIES, stageName: STAGE.name, learning: learningSummary() };
      STORE.finish(STAGE.id, score, delivered, state === "won");
    }
    if (state === "play") titleCardT = Math.max(0, titleCardT - dt);
    const screen = state === "codex" ? lastScreen : state === "menu" ? "menu" : state === "overworld" ? "map" : state === "won" || state === "lost" ? "end" : "run";
    if (screen !== lastScreen) { lastScreen = screen; fadeT = FADE_TIME; }
    fadeT = Math.max(0, fadeT - dt);

    const v = window.VIEWPORT?.get() || {offsetX:0,offsetY:0};
    const pixelScale = (v.scale || 1) * RENDERER.getDpr();
    ctx.setTransform(pixelScale, 0, 0, pixelScale, v.offsetX * pixelScale, v.offsetY * pixelScale);

    const bounds = window.VIEWPORT?.hudBounds() || viewBounds();
    btnPause.x = bounds.right - btnPause.w - Math.max(0, (44 / (window.VIEWPORT?.get().scale || 1) - btnPause.w) / 2);
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
      if (state === "victory" || state === "lampout") {
        const dawnP = victoryDawn();
        if (dawnP > 0) {
          const dawnGlow = ctx.createLinearGradient(0, 0, 0, H);
          dawnGlow.addColorStop(0, `rgba(255, 226, 165, ${0.42 * dawnP})`);
          dawnGlow.addColorStop(0.55, `rgba(255, 178, 105, ${0.14 * dawnP})`);
          dawnGlow.addColorStop(1, "rgba(255, 178, 105, 0)");
          ctx.fillStyle = dawnGlow;
          const area = viewBounds();
      ctx.fillRect(area.left, area.top, area.width, area.height);
          FX.glow(ctx, (area.left + area.right) / 2, area.top, 900, "#ffe0a4", 0.6 * dawnP);
        }
      } else {
        const dashMax = Math.max(0.6, 1.8 - b.dash * 0.38);
        const bossHunt = elapsed >= DAWN && delivered >= GOAL_DELIVERIES && !finalBossDefeated;
        UI.drawHud(
          ctx, P, oil, maxOil, elapsed, DAWN, delivered, failed, score, level, xp, xpNeed(),
          job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, GOAL_DELIVERIES,
          dashCd, dashMax, bossHunt, hudExtra(now / 1000)
        );
        if (surgeWarningT > 0) UI.drawSurgeWarning(ctx, surgeWarningT);
        if (titleCardT > 0 && state === "play") UI.drawTitleCard(ctx, STAGE, stageChapter(), titleCardT);
        if (bossQ) UI.drawBossQuiz(ctx, bossQ, inputMode);
        if (state === "levelup") UI.drawLevelUp(ctx, level + 1, choices, WL, WI, rerolls, now / 1000);
        if (state === "pause") {
          UI.drawPauseMenu(ctx, AUDIO.isMuted ? AUDIO.isMuted() : false, quitConfirm ? 0 : menuFocus);
          if (quitConfirm) UI.drawExitConfirm(ctx, menuFocus);
        }
        if (state === "won" || state === "lost") UI.drawEndScreen(ctx, state, score, delivered, failed, misses, menuFocus, { ...runSummary, won: state === "won", time: now / 1000 });
      }
    }

    if (state === "codex") {
      const lastPage=codexTab==='cards'?Math.ceil(UI.CARD_LIST.length/UI.codexRows())-1:Math.ceil(codexWords().length/15)-1;
      codexPage=clamp(codexPage,0,Math.max(0,lastPage));
      UI.drawCodex(ctx, STORE, codexWords(), codexTab, codexPage, codexBack === "play" || codexBack === "pause", codexFocus);
    }
    if (tutorial) UI.drawTutorial(ctx, tutorial, inputMode);
    if (fadeT > 0) UI.drawFade(ctx, fadeT / FADE_TIME);

    if (STORE.canSave && !STORE.canSave()) {
      const area = viewBounds();
      ctx.save();
      ctx.fillStyle = "#32151d";ctx.fillRect(area.left, area.bottom - 34, area.width, 34);
      ctx.fillStyle = "#ffcfb4";ctx.textAlign = "center";ctx.font = UI.readableFont(14, "bold");
      ctx.fillText("本機無法儲存進度，重新整理會遺失未儲存紀錄。", (area.left + area.right) / 2, area.bottom - 11);
      ctx.restore();
    }

  }

  requestAnimationFrame(frame);
})();
