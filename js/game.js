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
  const magnetRadius = rank => 110 + clamp(rank, 0, 3) * 80;
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
  // 擊退用逐幀位移，保留碰撞而不是在施放當幀直接跳到終點。
  const KNOCK_SPEED = 520;
  function knockback(e, distance) {
    if (e.type === "boss" || e.hp <= 0 || !distance) return;
    const length = dist(P, e) || 1;
    const sign = Math.sign(distance);
    (e.knockQueue ||= []).push({
      dx: (e.x - P.x) / length * sign,
      dy: (e.y - P.y) / length * sign,
      remaining: Math.abs(distance)
    });
    // 不允許多次快速觸發留下無限長的擊退佇列。
    if (e.knockQueue.length > 3) e.knockQueue.shift();
  }
  function moveKnockback(e, dt) {
    const q = e.knockQueue;
    if (!q?.length) return false;
    const k = q[0], distance = Math.min(k.remaining, KNOCK_SPEED * dt);
    const steps = Math.max(1, Math.ceil(distance / 8));
    for (let i = 0; i < steps; i++) {
      const dx = k.dx * distance / steps, dy = k.dy * distance / steps;
      // 分軸、分段碰撞：牆壁會擋住推力，不會穿過建築。
      if (!blocked(e.x + dx, e.y, 16)) e.x += dx;
      if (!blocked(e.x, e.y + dy, 16)) e.y += dy;
    }
    k.remaining -= distance;
    if (k.remaining <= 0.001) q.shift();
    return true;
  }
  const ansPos = h => window.WORLD.answerPositions(h);
  // 僅場景答案使用較自然的筆文字體。字型已在 index.html 子集載入，
  // Noto 完整字面備援；不修改 HUD、教學和圖鑑的字體。
  const sceneAnswerFont = size => UI.readableFont(size, "400").replace(
    "'Noto Sans JP', 'Microsoft JhengHei', sans-serif",
    "'Yuji Syuku', 'Kaisei Decol', 'Noto Sans JP', serif"
  );
  const getWordDistrictWords = word => window.CONTENT.getSiblingWords(word);
  const writtenLength = text => Array.from(String(text || "").normalize("NFC")).length;
  const kanaScript = text => {
    const chars = Array.from(String(text || ""));
    if (chars.length && chars.every(ch => /[ぁ-ゖー]/u.test(ch))) return "hiragana";
    if (chars.length && chars.every(ch => /[ァ-ヺー]/u.test(ch))) return "katakana";
    return "mixed";
  };
  function answerChoices(word) {
    const seen = new Set([word.jp]), distractors = [];
    const targetLength = writtenLength(word.jp);
    const targetScript = kanaScript(word.jp);
    const source = [
      ...getWordDistrictWords(word),
      ...ALL,
      ...(window.CONTENT.getAnswerCandidates?.() || window.CONTENT.getAllWords())
    ];
    const candidates = shuffle(source).filter(w => w && !seen.has(w.jp) && writtenLength(w.jp) === targetLength);
    const take = pool => {
      const w = pool.find(candidate => !seen.has(candidate.jp));
      if (!w) return false;
      seen.add(w.jp);
      distractors.push(w);
      return true;
    };

    // 優先保留一個同文字系的近似項，再混入另一文字系，避免字數或平／片假名成為答案提示。
    if (targetScript === "hiragana" || targetScript === "katakana") {
      take(candidates.filter(w => kanaScript(w.jp) === targetScript));
      take(candidates.filter(w => {
        const script = kanaScript(w.jp);
        return script !== targetScript && (script === "hiragana" || script === "katakana");
      }));
    }
    while (distractors.length < 2 && take(candidates)) {}
    if (distractors.length < 2) {
      // 未來詞包缺少同長度詞時仍使用真實且不重複的詞，不中斷當局。
      while (distractors.length < 2 && take(shuffle(source).filter(w => w && w.jp))) {}
    }
    return shuffle([word, ...distractors]);
  }

  // ---------- 遊戲狀態 ----------
  const P = { x: START.x, y: START.y, inv: 0, faceAng: 0, faceX: 1 };
  const b = { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0 };
  const keys = new Set(), heldCodes = new Set();
  let state = "menu";
  const artPending = () => state === 'overworld' ? window.MAP_ART_READY === false
    : ['play','pause','levelup'].includes(state) && window.ART_READY === false;
  let quitConfirm = false;
  let menuFocus = 0, menuFocusState = "menu", gpMenuDir = "";
  let levelupFocus = 0, gpLevelupDir = "";
  let pendingMenuActivation = null;
  function activateWithFeedback(id) {
    if (pendingMenuActivation || ((state === "won" || state === "lost") && endCooldown > 0)) return;
    if (id === 'start' || id === 'world') AUDIO.prepareMusic?.('overworld');
    else if (id === 'restart') AUDIO.prepareMusic?.('play');
    UI.pressButton?.(id);
    pendingMenuActivation = { id, state, quitConfirm, remaining: 0.12 };
  }
  function menuButtons() {
    if (menuFocusState !== state) { menuFocus = 0; menuFocusState = state; }
    if (quitConfirm) return UI.EXIT_BTNS;
    if (state === "menu") return UI.MENU_BTNS;
    if (state === "pause") return UI.PAUSE_BTNS;
    if (state === "won" || state === "lost") {
      const review = typeof UI.reviewButtons === "function" ? UI.reviewButtons(misses).slice(0, 3) : [];
      return review.length ? [...UI.END_BTNS, ...review] : UI.END_BTNS;
    }
    return null;
  }
  function moveMenu(delta) {
    if (pendingMenuActivation) return;
    UI.setButtonHover?.(null);
    const buttons = menuButtons();
    menuFocus = (menuFocus + delta + buttons.length) % buttons.length;
  }
  function returnHome() {
    pendingMenuActivation = null;
    UI.setButtonHover?.(null);
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
    else if (typeof id === "string" && id.startsWith("review-")) {
      const button = (menuButtons() || []).find(item => item.id === id);
      if (button?.word?.jp) AUDIO.speak(button.word.jp);
    }
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
  let seals = 0, sealsEarned = 0, study = null;
  let recallIndependent = 0, recallAssisted = 0;
  const recallSources = { delivery: { independent: 0, assisted: 0 }, boss: { independent: 0, assisted: 0 } };
  const READ_DWELL = 0.65;
  function learningSummary() {
    const result = {
      practiced: 0, gained: 0, lost: 0, review: 0,
      independent: recallIndependent, assisted: recallAssisted,
      sources: {
        delivery: { independent: recallSources.delivery.independent, assisted: recallSources.delivery.assisted },
        boss: { independent: recallSources.boss.independent, assisted: recallSources.boss.assisted }
      }
    };
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
  function noteSuccess(kind, assisted) {
    if (assisted) { recallAssisted++; recallSources[kind].assisted++; }
    else { recallIndependent++; recallSources[kind].independent++; }
  }
  function grantSeal() {
    if (delivered > 0 && delivered % CFG.AWAKEN_EVERY === 0 && sealsEarned < CFG.AWAKEN_MAX) { seals++; sealsEarned++; }
  }
  function awakeningState() {
    const every = CFG.AWAKEN_EVERY;
    return {
      seals, earned: sealsEarned,
      nextIn: sealsEarned >= CFG.AWAKEN_MAX ? 0 : every - (delivered % every),
      awakened: Object.values(WL).filter(v => v >= 5).length
    };
  }
  function rememberWord(jp, assisted) {
    if (assisted) STORE.recAssisted(jp);
    else if (typeof STORE.recRecall === "function") STORE.recRecall(jp, elapsed * 1000);
    else STORE.rec(jp, true);
  }
  function bossBlueprint(index) {
    const role = ["mid", "mid", "gate", "final"][index] || "mid";
    return {
      hp: CFG.BOSS_HP_BASE[index],
      oil: CFG.BOSS_OIL_REWARD[index],
      quiz: role !== "gate",
      role
    };
  }
  function rollCrit(base, step) {
    const chance = Math.min(0.5, base + (b.crit || 0) * step);
    const isCrit = Math.random() < chance;
    return { isCrit, mult: isCrit ? 1.8 : 1 };
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
  let ended = false, bossQ = null, bossSealBreak = null, codexBack = "menu", codexTab = "cards", codexPage = 0;
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
    barrier: { id: "barrier", jp: "じょうか", zh: "淨化靈陣", type: "active", category: "全方結界", desc: "展開 360 度低傷害除魔陣，Lv4 起可震退周身妖怪" },
    fire: { id: "fire", jp: "きつねび", zh: "狐火炎", type: "active", category: "烈焰火把", desc: "周身飛旋烈焰火把，高速甩擊灼燒貼身妖怪" },
    boom: { id: "boom", jp: "おふだ", zh: "陰陽符", type: "active", category: "穿透咒符", desc: "擲出迴旋陰陽符咒，來回穿透路徑上的敵人" },
    thunder: { id: "thunder", jp: "いかずち", zh: "天狐雷", type: "active", category: "天罰落雷", desc: "固定係數落雷。Lv4 鎖定三個威脅，覺醒為三朵雷雲，不依生命秒殺" },
    needle: { id: "needle", jp: "せんぼん", zh: "天狐靈針", type: "active", category: "高速靈針", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪" }
  };

  const WEAPON_UPGRADES = {
    katana:["暖光單刃，斬擊前方妖怪","雙刃交叉，距離 +16、傷害 +0.8","三刃收束，距離與傷害再提升","蓄風四刃；下一階射出穿透風刃","覺醒・斷空殘月斬：世界距離 720、最多 6 體，前三全傷其後 ×0.75，冷卻下限 0.6 秒"],
    barrier:["展開單盤除魔陣，低傷害全方位攻擊","雙盤刻印，範圍擴大、傷害小幅提升","反轉雙盤，範圍與傷害再提升","蓄勢大陣，半徑 252，命中可震退敵人","覺醒・金剛退魔曼荼羅：半徑縮為 220，換 1.8 秒地面緩速；不回油、不聚怪"],
    fire:["一顆狐火環繞護身，僅接觸周遭妖怪","兩顆狐火環繞護身，不主動飛出","三顆狐火環繞護身，不主動飛出","三顆護火，其中一顆離體追敵後回歸","覺醒・墨焰黑龍：三顆護火，每 6 秒一條黑龍；不再離體。焦土最多 2 處"],
    boom:["單符回旋，穿透路徑上的妖怪","一次擲出 2 枚符咒","三符碎焰，冷卻縮短","蓄火四符；下一階改為投射爆符","覺醒・兩儀太極湮滅：兩枚爆符，半徑 135，單波最多清除 6 發普通彈"],
    thunder:["190 範圍內攻擊最近 1 隻，傷害 2 倍係數","270 範圍內同時攻擊 2 隻，傷害 3 倍係數","350 範圍內同時攻擊 3 隻，傷害 4.5 倍係數，不依生命秒殺","450 範圍內鎖定 3 個威脅，固定 6 倍係數","覺醒・建御雷神破界天罰：450 範圍內三朵雷雲，每朵半徑 90、8 倍係數"],
    needle:["三發靈針，貫穿前方妖怪","五發雙羽，傷害提升","七發三叉，傷害再提升","八星噴射；下一階弧線射出","覺醒・九尾極寒靈暴：八發追蹤冰針，單層殉爆最多再命中 3 隻，不連鎖"]
  };

  let proj = [], needles = [], winds = [], ghosts = [], dragonShots = [], dragonScorches = [], sacredSanctuary = null, surgeT = SURGE_FIRST, fAng = 0, fireEmitT = 0, fireSfxT = 0, fireAttackT = 0;
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
    { id: "dmg", n: "修羅破軍", s: "こうげき", cat: "攻擊爆發", d: "整體傷害係數 +0.30（最多 4 層）", f: () => { b.dmg += 0.30; b.dmgUp = (b.dmgUp || 0) + 1; }, ok: () => (b.dmgUp || 0) < 4 },
    { id: "rate", n: "神樂疾奏", s: "れんぞく", cat: "攻擊爆發", d: "妖刀、結界、靈針冷卻縮短", f: () => { b.rate++; }, ok: () => b.rate < 4 },
    { id: "crit", n: "心眼一閃", s: "かいしん", cat: "攻擊爆發", d: "妖刀/天雷暴擊率 +15%，結界 +10%（機率上限 50%，倍率 1.8）", f: () => { b.crit = (b.crit || 0) + 1; }, ok: () => (b.crit || 0) < 3 },
    { id: "spd", n: "神足草履", s: "いどう", cat: "神速機動", d: "移動速度約 +15%（最多 3 層）", f: () => { b.spd = (b.spd || 0) + 1; }, ok: () => (b.spd || 0) < 3 },
    { id: "dash", n: "縮地瞬步", s: "ダッシュ", cat: "神速機動", d: "衝刺冷卻大幅縮短，衝刺附加無敵突進", f: () => { b.dash++; }, ok: () => b.dash < 3 },
    { id: "mag", n: "招財勾玉", s: "じしゃく", cat: "輔助資源", d: "靈玉吸取範圍 +80", f: () => { b.mag++; }, ok: () => b.mag < 3 }
  ];

  // Stop concurrent injury warnings becoming two ghosted copies at the same location.
  const say = (v, x, y, c = "#fff") => {
    const injury = typeof v === "string" && /^(受創|妖火灼身)/.test(v);
    if (injury) for (const t of texts) {
      if (!t.injury || Math.abs(t.x - x) > 180 || Math.abs(t.y - y) > 110) continue;
      t.life = Math.min(t.life, 0.12);
      t.y -= 22;
    }
    texts.push({ v, x, y, c, life: injury ? 1.12 : 1.8, injury });
  };
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

    let chosenWord = typeof study?.pick === "function" ? study.pick(elapsed, [...livingMisWords, ...activeOrderWords]) : null;
    if (study && typeof study.pick === "function" && !chosenWord) return;
    if (!chosenWord && priorityMissed.length > 0) {
      chosenWord = pick(priorityMissed);
    } else if (!chosenWord) {
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
    const reachable = localHouses.filter(h => h !== from && dist(h, from) > 420 && dist(h, from) < 2000);
    const nearby = reachable.filter(h => dist(h, from) < 900);
    const hasNear = orders.some(o => dist(o.from, o.to) < 900);
    const to = pick(!hasNear && nearby.length ? nearby : reachable);
    if (!to || !chosenWord) return;
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
    window.loadMapArt?.();
    if (reset) overworld = window.OVERWORLD.createState("gate");
    AUDIO.restartMusic();
    overworldNoticeT = 0;
    keys.clear(); heldCodes.clear();
    joy = null;
    gpOverworldDir = "";
    state = "overworld";
  }

  function moveOverworld(dx, dy) {
    if (state !== "overworld" || artPending()) return false;
    return window.OVERWORLD.move(overworld, dx, dy);
  }

  function confirmOverworld() {
    if (state !== "overworld" || artPending()) return;
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
    AUDIO.prepareMusic?.('play');
    AUDIO.restartMusic();
    window.loadGameArt?.();
    configureStage(stageId);
    AUDIO.init();
    // 單字與音效於實際播放時載入，避免與進關必要圖像爭用網路。
    state = "play";
    tutorial = null;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    Object.assign(P, { x: START.x, y: START.y, inv: 1.2, faceAng: 0, faceX: 1 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0, crit: 0, oilRegen: 0, dmgUp: 0, heals: 0 });
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 });
    proj = []; needles = []; winds = []; ghosts = []; dragonShots = []; dragonScorches = []; sacredSanctuary = null; enemyBullets = []; surgeT = SURGE_FIRST; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1;
    fAng = 0; fireEmitT = 0; fireSfxT = 0; fireAttackT = 0;
    wT.boom = 0; wT.thunder = 1; wT.barrier = 1.5; wT.needle = 0.5; wT.fire = 0; wT.katana = 0.3;
    elapsed = 0; warnDawnT = 0; oil = 100; maxOil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    orders = []; job = null; inter = null; enemies = []; gems = []; texts = []; rings = []; misses = [];
    learningStart = Object.fromEntries(Object.entries(STORE.data.m).map(([jp,m])=>[jp,{ok:m.ok,ng:m.ng,box:m.box}]));
    seals = 0; sealsEarned = 0; recallIndependent = 0; recallAssisted = 0;
    recallSources.delivery.independent = recallSources.delivery.assisted = 0;
    recallSources.boss.independent = recallSources.boss.assisted = 0;
    study = typeof STORE.createStudySession === "function" ? STORE.createStudySession(ALL) : null;
    FX.reset();
    SKILLFX.reset();
    rerolls = 2; titleCardT = 3; runSummary = null;
    bossStage = 0; bossT = BOSS_TIMES[0]; finalBossDefeated = false; finalBossPos = null; finalBossEnt = null; victorySeq = null; lampSeq = null;
    ended = false; bossQ = null; bossSealBreak = null; orderT = 5; spawnT = 8; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; endCooldown = 0; lanternHitT = 0;
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
      if ((WL[k] || 0) >= 4) return false;
      if (WL[k] === 0 && !canLearnNew) return false;
      return true;
    });
    const awakenKeys = Object.keys(WI).filter(k => WL[k] === 4 && seals > 0);

    const weaponCard = (k, nextLvl) => {
      const isNew = WL[k] === 0;
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
        d: nextLvl === 5 ? `${descText}（覺醒・耗 1 印）` : descText,
        f: () => {
          if (nextLvl === 5 && (seals <= 0 || WL[k] !== 4)) return;
          if (nextLvl === 5) seals--;
          WL[k] = nextLvl;
          window.useSkillArt?.(k, WL[k]);
          if (k === "katana") { wT.katana = 0; atkT = 0; }
          if (k === "boom") wT.boom = 0;
          if (k === "barrier") wT.barrier = 0;
          if (k === "needle") wT.needle = 0;
          if (k === "fire" || k === "thunder") wT[k] = 0;
        }
      };
    };
    const wc = shuffle(eligibleWeaponKeys).map(k => weaponCard(k, WL[k] + 1));
    const awakenCard = awakenKeys.length ? weaponCard(shuffle(awakenKeys)[0], 5) : null;

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

    if (awakenCard) {
      const rest = shuffle([...wc.slice(0, 2), ...pc.slice(0, 2)]).slice(0, 2);
      choices = shuffle([awakenCard, ...rest]);
      if (!choices.some(card => card.lv === 5)) choices[choices.length - 1] = awakenCard;
      choices = choices.slice(0, 3);
    } else if (wc.length > 0 && pc.length > 0) {
      choices = shuffle([...wc.slice(0, 2), ...pc.slice(0, 2)]).slice(0, 3);
    } else if (wc.length > 0) {
      choices = wc.slice(0, 3);
    } else {
      choices = pc.slice(0, 3);
    }

    for (const choice of choices) if (choice.type === 'weapon') window.prepareSkillArt?.(choice.id, choice.lv);
    if (!choices.length) {
      xp = Math.max(0, xp - xpNeed());
      level++;
      state = "play";
      say("修行圓滿・繼續夜行", P.x, P.y - 45, "#ffe9a0");
      return;
    }
    state = "levelup";
    levelupFocus = 0;
    gpLevelupDir = "";
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
    study?.seen?.(o.word);
  }

  function resolve(i) {
    const j = job;
    if (!j || !Array.isArray(j.ans)) return;
    const w = j.ans[i];
    const pos = ansPos(j.to)[i];
    if (w == null || (j.wrongPaid && w !== j.word)) return;
    if (j.assisted) markBossAssisted(j.word);

    if (w === j.word) {
      job = null;
      nameT = 0;
      delivered++;
      grantSeal();
      if (j.assisted) {
        rememberWord(j.word.jp, true);
        noteSuccess("delivery", true);
        oil = Math.min(maxOil, oil + 12);
        score += 25;
        say(`${w.jp}＝${w.zh} 輔助送達！`, pos.x, pos.y - 35, "#fff0a6");
        say("燈油 +12 點（神助）", pos.x, pos.y - 12, "#ffd27a");
      } else {
        rememberWord(j.word.jp, false);
        noteSuccess("delivery", false);
        const gain = 10;
        oil = Math.min(maxOil, oil + 18 + gain);
        score += 50;
        say(`${w.jp}＝${w.zh} 配達完遂！`, pos.x, pos.y - 35, "#fff0a6");
        say(`燈油 +${18 + gain} 點`, pos.x, pos.y - 12, "#ffd27a");
      }
      xp += CFG.DELIVERY_XP;
      study?.seen?.(j.word);
      FX.deliver(pos.x, pos.y);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
      HAPTICS.deliverSuccess();
      if (finalBossDefeated && delivered >= GOAL_DELIVERIES) startVictorySequence();
    } else {
      j.wrongPaid = true;
      j.assisted = true;
      j.hold = 0;
      j.showMeaningT = 4;
      failed++;
      oil = Math.max(0, oil - 6);
      misses.push(j.word);
      STORE.rec(j.word.jp, false);
      study?.mistake?.(j.word, elapsed);
      say(`${j.word.jp}＝${j.word.zh}・記住後再送，燈油 -6`, pos.x, pos.y - 36, "#ff8f8f");
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
      AUDIO.speak(j.word.jp);
      if (oil <= 0) { oil = 0; loseRun(); }
    }
  }

  function hurtPlayer(amount, label) {
    if (state !== "play" || P.inv > 0) return false;
    if (b.shield > 0) {
      b.shield--;
      P.inv = 0.85;
      RENDERER.triggerShake(6);
      burst(P.x, P.y, "#ffe28b", 22);
      say(`護盾抵擋！剩餘 ${b.shield}`, P.x, P.y - 45, "#ffe28b");
      AUDIO.breakShield();
      HAPTICS.shield();
      return false;
    }
    oil -= amount;
    lanternHitT = 0.42;
    P.inv = 1;
    RENDERER.triggerShake(10);
    burst(P.x, P.y, "#ff6b81", 18);
    say(label || `受創・燈油 −${amount}`, P.x, P.y - 36, "#cb6e60");
    AUDIO.hurt();
    HAPTICS.damage();
    if (oil <= 0) {
      oil = 0;
      if (finalBossDefeated && delivered >= GOAL_DELIVERIES) startVictorySequence();
      else loseRun();
      return true;
    }
    return false;
  }

  function hurt(e, dmg, isCrit = false, fromShatter = false) {
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
      const reward = e.oilReward || 35;
      oil = Math.min(maxOil, oil + reward);
      bossT = BOSS_TIMES[bossStage] == null ? Infinity : Math.max(0, BOSS_TIMES[bossStage] - elapsed);
      say(e.final ? "夜明けの大妖鬼 撃破！" : `大妖鬼擊破！燈油 +${reward}`, e.x, e.y - 65, "#ffe9a0");
      if (!e.final) RENDERER.triggerShake(14); // 最終 Boss 由收尾演出處理，不震動整個畫面
      for (let k = 0; k < 8; k++) {
        dropGem(e.x + (Math.random() - 0.5) * 70, e.y + (Math.random() - 0.5) * 70, 6);
      }
      // 不再誤將擊殺視為單字掌握 STORE.rec
      if (e.final && delivered >= GOAL_DELIVERIES) startVictorySequence();
    }

    const gemCount = 1;
    for (let i = 0; i < gemCount; i++) {
      dropGem(e.x + (Math.random() - 0.5) * 28, e.y + (Math.random() - 0.5) * 28, 2);
    }
    FX.death(e.x, e.y, isMis ? "#c98cff" : "#bce9ff", e.type === "boss");

    // 冰晶碎裂：同一 volley 只爆一次，最多再命中 3 隻，不凍結、不遞迴。
    if (e.shatterVolley && !(e.freezeT > 0 && (e.freezeEnds == null || elapsed < e.freezeEnds))) delete e.shatterVolley;
    const volley = e.shatterVolley;
    if (!fromShatter && volley && !volley.used) {
      volley.used = true;
      burst(e.x, e.y, "#bdf4ff", 14);
      let extra = 0;
      for (const foe of enemies) {
        if (extra >= 3) break;
        if (foe === e || foe.hp <= 0 || foe.shield || foe.type === "boss") continue;
        if (volley.hits.has(foe) || dist(e, foe) >= 105) continue;
        volley.hits.add(foe);
        extra++;
        hurt(foe, 2.5 * b.dmg, false, true);
      }
    }

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

    // 升級頁優先於一般遊戲按鍵。Xbox A 確認「焦點紙札」，Y 重抽；
    // B/X 不再錯誤地直接選第 2/3 張。搖桿需回中才可再次移動，防止連跳。
    if (state === "levelup") {
      const axis = Math.abs(ay) >= Math.abs(ax) ? ay : ax;
      const dir = axis > 0.55 ? 1 : axis < -0.55 ? -1 : 0;
      if (dir && dir !== gpLevelupDir) {
        levelupFocus = clamp(levelupFocus + dir, 0, Math.max(0, choices.length - 1));
      }
      gpLevelupDir = dir;
      if (justPressed(0)) { AUDIO.init(); pickUp(levelupFocus); }
      else if (justPressed(3)) reroll();
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      gpMove = { x: 0, y: 0 };
      return;
    }
    gpLevelupDir = "";

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
      if (justPressed(0)) { AUDIO.init(); activateWithFeedback(buttons[menuFocus].id); }
      else if (justPressed(1) || justPressed(9)) { if (quitConfirm) activateMenu('exit-cancel'); else if (state === 'pause') togglePause(); else if (state === 'won' || state === 'lost') returnHome(); }
      else if (justPressed(8) && !quitConfirm) activateMenu('codex');
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      return;
    }
    gpMenuDir = '';

    // A 鍵 (Button 0)：遊戲中互動（升級選卡已在上方獨立處理）
    if (justPressed(0)) {
      AUDIO.init();
      if (state === "overworld") confirmOverworld();
      else if (state === "play" && inter) interact();
    }

    // B 鍵 (Button 1): 衝刺
    if (justPressed(1)) {
      if (state === "overworld") returnHome();
      else if (state === "play") dash();
    }

    // X 鍵 (Button 2): 提示
    if (justPressed(2)) {
      if (state === "play" && job) triggerHint();
    }

    // Boss 答題專用：LB / RB / Y；保留 A 取貨、B 衝刺、X 提示。
    if (state === "play" && bossQ && !job?.reading) {
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
      const assisted = bs.wasAssisted || bossQ.wasAssisted || (job?.assisted && job.word.jp === bs.word.jp);
      rememberWord(bs.word.jp, assisted);
      noteSuccess("boss", assisted);
      bs.shield = false;
      bs.quizzed = true;
      bossSealBreak = { boss: bs, at: performance.now() };
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
      if (!bs.wrongPaid) {
        bs.wrongPaid = true;
        misses.push(bs.word);
        STORE.rec(bs.word.jp, false);
        study?.mistake?.(bs.word, elapsed);
        oil -= 6;
      }
      bossQ.wasAssisted = true;
      bs.wasAssisted = true;
      if (job?.word.jp === bs.word.jp) job.assisted = true;
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
      AUDIO.speak(bs.word.jp);
      say(`${bs.word.jp}＝${bs.word.zh}・同一題再答`, P.x, P.y - 50, "#ff8f8f");
      if (oil <= 0) {
        oil = 0;
        loseRun();
        return;
      }
      bossQ.wrong.push(i);
      bossQ.lock = 0.3;
    }
  }

  function markBossAssisted(word) {
    const bs = enemies.find(e => e.type === "boss" && e.shield && e.word?.jp === word.jp);
    if (bs) bs.wasAssisted = true;
  }

  function triggerHint() {
    if (state !== "play" || !job || hintT > 0) return;
    if (!job.hintStage) job.hintStage = 0;
    if (job.hintStage === 0) {
      job.hintStage = 1;
      hintT = 0.5;
      job.assisted = true;
      AUDIO.speak(job.word.jp);
      const wrongIndices = job.ans.map((w, idx) => w !== job.word ? idx : -1).filter(idx => idx >= 0);
      if (wrongIndices.length > 0) {
        job.eliminatedIdx = pick(wrongIndices);
      }
      say("天狐靈音：聆聽發音，排除一項！", P.x, P.y - 45, "#80deea");
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
    const wave = q.wave || { hits: q.volleyHits || new Set(), bullets: 0 };
    SKILLFX.play("boom","hit",5,{x:q.x,y:q.y,r:135,evolved:true});
    AUDIO.boomerang(5);
    RENDERER.triggerShake(5);
    for(const eb of enemyBullets) {
      if (wave.bullets >= 6) break;
      if (eb.life>0 && !eb.bossHazard && dist(eb,q)<=135) { eb.life=0; wave.bullets++; burst(eb.x,eb.y,"#ffc172",6); }
    }
    for(const e of enemies)if(e.hp>0&&!wave.hits.has(e)&&dist(e,q)<=135){
      wave.hits.add(e);hurt(e,6.5*b.dmg);e.ib=elapsed+0.38;
    }
  }

  function weapons(dt) {
    // 1. 妖刀斬擊 (Katana) - 方向性扇形斬擊 (依玩家面朝方向前方 140 度扇形索敵，不擊中身後)
    wT.katana = (wT.katana ?? atkT) - dt;
    atkT = wT.katana;
    if (WL.katana > 0 && wT.katana <= 0) {
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
        wT.katana = atkT = 0.1;
      } else {
        wT.katana = atkT = wMax.katana = Math.max(0.6, 0.72 - b.rate * 0.13);
        const swingReach = WL.katana === 5 ? 720 : reach * 0.85;
        RENDERER.addSlashArc(P.x, P.y, swingReach, faceAng, 2.2, SKILLFX.tier(WL.katana));
        SKILLFX.play("katana", "swing", WL.katana, { x: P.x, y: P.y, ang: faceAng, reach: swingReach });

        // 僅判定面朝方向前方扇形範圍 (角度差 <= 1.22 弧度，約 140 度角)
        for (const e of enemies) {
          if (e.hp > 0 && WL.katana < 5) {
            const ed = dist(P, e);
            if (ed <= reach) {
              const eang = Math.atan2(e.y - P.y, e.x - P.x);
              let diff = Math.abs(eang - faceAng);
              while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
              if (diff <= 1.22) {
                const crit = rollCrit(0.2, 0.15);
                hurt(e, (b.dmg + (WL.katana - 1) * 0.8) * crit.mult, crit.isCrit);
                SKILLFX.play("katana", "hit", WL.katana, { x: e.x, y: e.y, ang: faceAng, crit: crit.isCrit });
              }
            }
          }
        }
        if (WL.katana===5 && winds.length<8) winds.push({
          x:P.x,y:P.y,originX:P.x,originY:P.y,vx:Math.cos(faceAng)*1680,vy:Math.sin(faceAng)*1680,
          ang:faceAng,size:360,life:1.2,hits:new Set(),dmg:(b.dmg+3.2)*1.15,traveled:0,
          maxTravel:720
        });
        AUDIO.slash(WL.katana);
      }
    }

    for(const wave of winds){
      if(!EVOLUTIONS.move(wave,dt,null,12))continue;
      wave.ang=Math.atan2(wave.vy,wave.vx);
      const stepDist=Math.hypot(wave.vx,wave.vy)*dt;
      const cap=wave.maxTravel||720;
      const nextTravel=(wave.traveled||0)+stepDist;
      if(nextTravel>=cap && stepDist>0){
        const back=(nextTravel-cap)/stepDist;
        wave.x-=wave.vx*dt*back;
        wave.y-=wave.vy*dt*back;
        wave.traveled=cap;
        // 射程結束即消散，不停在原地等剩餘的生命時間。
        wave.life=0;
      }else wave.traveled=nextTravel;
      for (const eb of enemyBullets) {
        if (eb.life > 0 && !eb.bossHazard && dist(eb, wave) <= 90) {
          eb.life = 0;
          burst(eb.x, eb.y, "#9bf7ff", 6);
        }
      }
      for(const e of enemies){
        if(!(e.hp>0) || wave.hits.size>=6 || wave.hits.has(e)) continue;
        const along=Math.abs((e.x-wave.x)*Math.cos(wave.ang)+(e.y-wave.y)*Math.sin(wave.ang));
        const side=Math.abs(-(e.x-wave.x)*Math.sin(wave.ang)+(e.y-wave.y)*Math.cos(wave.ang));
        if(along>=(e.type==='boss'?95:75) || side>=180+(e.type==='boss'?40:22)) continue;
        const ox=e.x-wave.originX, oy=e.y-wave.originY;
        if(Math.hypot(ox,oy)>720) continue;
        let ad=Math.abs(Math.atan2(oy,ox)-wave.ang);
        while(ad>Math.PI) ad=Math.abs(ad-2*Math.PI);
        if(ad>1.22) continue;
        const hitIndex=wave.hits.size;
        wave.hits.add(e);
        const pierceScale=hitIndex<3?1:0.75;
        const crit=rollCrit(0.2,0.15);
        hurt(e, wave.dmg * pierceScale * crit.mult, crit.isCrit);SKILLFX.play("katana","hit",5,{x:e.x,y:e.y,ang:wave.ang,crit:crit.isCrit});
      }
      const cam=RENDERER.getCam(),view=viewBounds(),margin=wave.size*0.62;
      const left=cam.x+view.left,right=cam.x+view.right,top=cam.y+view.top,bottom=cam.y+view.bottom;
      if(wave.x<left-margin||wave.x>right+margin||wave.y<top-margin||wave.y>bottom+margin||wave.traveled>=wave.maxTravel)wave.life=0;
    }
    winds=winds.filter(p=>p.life>0);

    // 2. 淨化靈陣 (Barrier AoE) - 360 度全方位退魔衝擊環（全新卡牌秘術技能）
    if (WL.barrier > 0) {
      wT.barrier -= dt;
      if (wT.barrier <= 0) {
        const awakened = WL.barrier === 5;
        wT.barrier = wMax.barrier = awakened ? 3.2 : Math.max(1.2, 3.2 - WL.barrier * 0.42 - b.rate * 0.2);
        const r = awakened ? 220 : 140 + WL.barrier * 28;
        if (awakened) sacredSanctuary = { x: P.x, y: P.y, r, life: 1.8, maxLife: 1.8 };
        SKILLFX.play("barrier", "cast", WL.barrier, { x: P.x, y: P.y, r });
        let hitAny = false;
        for (const e of enemies) {
          if (e.hp > 0 && dist(P, e) <= r) {
            hitAny = true;
            const crit = rollCrit(0.15, 0.1);
            const damage = awakened
              ? (2.0 + WL.barrier * 1.1) * b.dmg * 0.5
              : (b.dmg + (WL.barrier - 1) * 0.8) * 0.4;
            hurt(e, damage * crit.mult, crit.isCrit);
            if (WL.barrier >= 4 && e.type !== "boss") knockback(e, 50 + WL.barrier * 10);
            burst(e.x, e.y, "#ffe082", 6);
          }
        }
        if (hitAny) RENDERER.triggerShake(5);
        AUDIO.barrier(WL.barrier);
      }
    }

    if (sacredSanctuary && sacredSanctuary.life > 0) {
      sacredSanctuary.life -= dt;
    }

    // 3. 天狐靈針 (Needles) - 面朝方向多發穿甲破魔靈針
    if (WL.needle > 0) {
      wT.needle -= dt;
      if (wT.needle <= 0) {
        const needleFloor = WL.needle === 5 ? 0.65 : 0.45;
        wT.needle = wMax.needle = Math.max(needleFloor, 1.25 - WL.needle * 0.16 - b.rate * 0.1);
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
          if(nd.ice){nd.hits.add(e);EVOLUTIONS.freeze(e,elapsed,nd.volley||null);}
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
          wT.boom = wMax.boom = WL.boom === 5 ? Math.max(1.6, 2.0 - WL.boom * 0.24) : Math.max(0.75, 2.0 - WL.boom * 0.24);
          const count = EVOLUTIONS.boomCount(WL.boom);
          const wave = { hits: new Set(), bullets: 0 };
          const baseAng = Math.atan2(t.y - P.y, t.x - P.x);
          for (let i = 0; i < count; i++) {
            const a = baseAng + (i - (count - 1) / 2) * (WL.boom>=4?0.28:0.32);
            proj.push({ x: P.x, y: P.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, t: 0, back: false, life:WL.boom===5?1.25:2, level:WL.boom, volleyHits: wave.hits, wave });
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

    // 5. 狐火環繞 + 脫離追擊
    if (WL.fire > 0) {
      fireSfxT = Math.max(0, fireSfxT - dt);
      let fireHit = false;
      fAng += dt * 2.8;
      const emitEmber = (fireEmitT -= dt) <= 0;
      if (emitEmber) fireEmitT = 0.05;
      const count = EVOLUTIONS.fireCount(WL.fire);
      const awaySlots = new Set(ghosts.filter(p=>p.fireAttack&&p.life>0&&p.level===WL.fire).map(p=>p.slot));
      for (let i = 0; i < count; i++) {
        if (awaySlots.has(i)) continue;
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * EVOLUTIONS.FIRE_ORBIT, fy = P.y + Math.sin(a) * EVOLUTIONS.FIRE_ORBIT;
        if (emitEmber) {
          const orbitSpeed = EVOLUTIONS.FIRE_ORBIT * 2.8;
          SKILLFX.play("fire", "ember", WL.fire, { x: fx, y: fy, ang: a, vx:-Math.sin(a)*orbitSpeed, vy:Math.cos(a)*orbitSpeed });
        }
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
      if (fireHit && fireSfxT <= 0) { AUDIO.fireball(WL.fire); fireSfxT = 0.15; }
      // Lv1–3 僅維持環繞與接觸傷害；Lv4 才准許三顆脫離追擊。
      if(WL.fire===4){
        fireAttackT=Math.max(0,fireAttackT-dt);
        const targets=enemies.filter(e=>e.hp>0&&!e.shield&&dist(P,e)<520);
        if(fireAttackT<=0 && targets.length && !ghosts.some(p=>p.fireAttack&&p.life>0)){
          const n=Math.min(EVOLUTIONS.fireAttackCount(WL.fire),count);
          for(let k=0;k<n;k++){
            const slot=Math.floor(k*count/n),a=fAng+(slot*6.283)/count;
            ghosts.push(EVOLUTIONS.fireSpirit(P,a,WL.fire,slot));
          }
          fireAttackT=EVOLUTIONS.fireAttackCooldown(WL.fire);
        }
      }
    }

    // MAX foxfire: one dragon every 6 seconds, aimed at a pack ahead rather than the player's feet.
    if(WL.fire===5){
      wT.fire=Math.max(0,wT.fire-dt);
      const face = P.faceAng || 0;
      const ahead = enemies.filter(e => {
        if (e.hp <= 0 || e.shield) return false;
        const d = dist(P, e);
        if (d < 90 || d > 560) return false;
        let diff = Math.abs(Math.atan2(e.y - P.y, e.x - P.x) - face);
        while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
        return diff <= 1.15;
      });
      const pool = ahead.length ? ahead : enemies.filter(e => e.hp > 0 && !e.shield && dist(P, e) > 90 && dist(P, e) < 560);
      let target = null, bestN = -1;
      for (const e of pool) {
        let n = 0;
        for (const o of pool) if (dist(o, e) < 140) n++;
        if (n > bestN) { target = e; bestN = n; }
      }
      if(wT.fire<=0 && target && !ghosts.some(g=>g.dragon&&g.life>0)){
        wT.fire=wMax.fire=6;
        const cam=RENDERER.getCam(),view=viewBounds();
        const left=cam.x+view.left,right=cam.x+view.right,top=cam.y+view.top,bottom=cam.y+view.bottom;
        // 黑龍在原版尺寸上放大 1.5 倍，仍維持左右側入場。
        const face=target.x>=P.x?1:-1,size=clamp(view.width*0.66,450,1020);
        const endX=face>0?left+size*0.08:right-size*0.08;
        const startX=face>0?left-size*0.8:right+size*0.8;
        const y=clamp(P.y-90,top+view.height*0.27,bottom-view.height*0.23);
        const summoned=EVOLUTIONS.dragon(P,face>0?0:Math.PI,Math.random()*6.283,{startX,endX,y,size});
        summoned.target=target;ghosts.push(summoned);
        AUDIO.fireball(WL.fire);
      }
    }
    for(const spirit of ghosts){
      if(spirit.dragon){
        // Follow the visible screen edge as the courier and camera move.
        if(spirit.entry){
          const cam=RENDERER.getCam(),view=viewBounds(),side=spirit.faceX,size=spirit.size;
          const left=cam.x+view.left,right=cam.x+view.right,top=cam.y+view.top,bottom=cam.y+view.bottom;
          spirit.entry.startX=side>0?left-size*0.8:right+size*0.8;
          spirit.entry.endX=side>0?left+size*0.08:right-size*0.08;
          spirit.entry.y=clamp(P.y-90,top+view.height*0.27,bottom-view.height*0.23);
        }
        if(!EVOLUTIONS.dragonStep(spirit,dt,P,blocked))continue;
      }
      else if(spirit.fireAttack){if(!EVOLUTIONS.fireSpiritStep(spirit,dt,P,enemies,blocked))continue;}
      else {EVOLUTIONS.seek(spirit,dt,enemies);if(!EVOLUTIONS.move(spirit,dt,blocked,10))continue;}
      if(!spirit.dragon&&(spirit.trail-=dt)<=0){spirit.trail=0.05;SKILLFX.play("fire","ghostTrail",spirit.level??5,spirit);}
      if(spirit.dragon){
        if(!spirit.shot && spirit.age>=1.08){
          const target=(spirit.target?.hp>0&&!spirit.target.shield?spirit.target:null) || enemies.filter(e=>e.hp>0&&!e.shield).sort((a,b)=>dist(spirit,a)-dist(spirit,b))[0] ||
            {x:spirit.x+Math.cos(spirit.ang)*440,y:spirit.y+Math.sin(spirit.ang)*440};
          dragonShots.push(EVOLUTIONS.dragonFireball(spirit,target));
          spirit.shot=true;
        }
        continue;
      }
      if(spirit.fireAttack&&spirit.returning)continue;
      for(const e of enemies)if(e.hp>0&&dist(e,spirit)<(e.type==='boss'?64:42)){
        if(!spirit.hitSet.has(e)){
          spirit.hitSet.add(e);
          hurt(e,(2.1+(spirit.level||1)*0.9)*b.dmg);
          SKILLFX.play("fire","hit",spirit.level??5,{x:e.x,y:e.y});
          burst(e.x,e.y,"#ff7043",8);
        }
        if(spirit.fireAttack){spirit.returning=true;spirit.target=null;break;}
        spirit.life=0;break;
      }
    }
    ghosts=ghosts.filter(p=>p.life>0);
    for(const shot of dragonShots){
      const impact=EVOLUTIONS.dragonFireballStep(shot,dt,enemies,blocked);
      if(!impact.impact)continue;
      if(impact.target)hurt(impact.target,12*b.dmg);
      for(const e of enemies)if(e.hp>0&&e!==impact.target&&!e.shield&&Math.hypot(e.x-impact.x,e.y-impact.y)<140)hurt(e,4*b.dmg);
      if(dragonScorches.length<2) dragonScorches.push({x:impact.x,y:impact.y,life:2.5,maxLife:2.5,r:140,tick:0.6});
      SKILLFX.play("fire","hit",5,{x:impact.x,y:impact.y});
      burst(impact.x,impact.y,"#ff7a28",12);
    }
    dragonShots=dragonShots.filter(p=>p.life>0);
    for(const scorch of dragonScorches){
      scorch.life-=dt;
      scorch.tick-=dt;
      while(scorch.tick<=0&&scorch.life>0){
        scorch.tick+=0.6;
        for(const e of enemies)if(e.hp>0&&!e.shield&&!(e.scorchReady>elapsed)&&Math.hypot(e.x-scorch.x,e.y-scorch.y)<scorch.r){
          e.scorchReady = elapsed + 0.6;
          hurt(e,1.8*b.dmg);
        }
      }
    }
    dragonScorches=dragonScorches.filter(p=>p.life>0);

    // 6. 天狐落雷：固定係數，不依生命秒殺。
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const rank = WL.thunder;
        const radius = rank >= 4 ? 450 : magnetRadius(rank);
        const candidates = enemies.filter(e => e.hp > 0 && !e.shield && dist(P, e) <= radius);
        if (!candidates.length) {
          wT.thunder = 0.2;
        } else {
          const threat = e => e.type === "boss" ? 0 : e.type === "shooter" ? 1 : e.type === "tank" ? 2 : 3;
          candidates.sort((a, b) => rank >= 4 ? (threat(a) - threat(b) || dist(P, a) - dist(P, b)) : dist(P, a) - dist(P, b));
          wT.thunder = wMax.thunder = rank === 5 ? 2.4 : rank === 4 ? 2 : Math.max(2, 2.6 - rank * 0.35);
          const crit = rollCrit(0.2, 0.15);
          if (rank === 5) {
            const anchors = candidates.slice(0, 3);
            const struck = new Set();
            anchors.forEach((anchor, i) => {
              const delay = 0.06 + i * 0.12;
              SKILLFX.play("thunder", "storm", 5, { x: anchor.x, y: anchor.y, r: 90, delay });
              SKILLFX.play("thunder", "strike", 5, { x: anchor.x, y: anchor.y, r: 90, stormChild: true, delay: delay + 0.08 });
              for (const e of enemies) if (e.hp > 0 && !e.shield && !struck.has(e) && dist(e, anchor) <= 90) {
                struck.add(e);
                hurt(e, 8 * b.dmg * crit.mult, crit.isCrit);
                e.flash = 0.22;
              }
            });
            RENDERER.triggerShake(8);
          } else {
            const mult = rank === 1 ? 2 : rank === 2 ? 3 : rank === 3 ? 4.5 : 6;
            const count = rank === 4 ? 3 : rank;
            for (const e of candidates.slice(0, count)) {
              SKILLFX.play("thunder", "strike", rank, { x: e.x, y: e.y, r: radius });
              hurt(e, mult * b.dmg * crit.mult, crit.isCrit);
            }
          }
          AUDIO.thunder(rank);
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
    if (state !== "play" || artPending()) return;
    if (isPortrait()) { suspend(); return; }
    checkTutorial();
    if (tutorial) return;

    let quizNear = null;
    for (const e of enemies) {
      if (e.type !== "boss" || !e.shield || e.hp <= 0 || e.quizClosed) continue;
      if (dist(P, e) < 380) quizNear = e;
      else if (e.quizEntered) e.quizClosed = true;
    }
    if (quizNear) quizNear.quizEntered = true;
    if (job && !job.readClosed && dist(P, job.to) < 220) job.reading = true;
    if (job?.reading && dist(P, job.to) >= 270) { job.reading = false; job.readClosed = true; }
    const safeRead = !!(job?.reading || quizNear);
    if (!safeRead) {
      elapsed += dt;
      bossT -= dt;
      oil = Math.min(maxOil, oil - dt * 0.43 + (b.oilRegen || 0) * dt);
      if (oil <= 0) {
        oil = 0;
        if (finalBossDefeated && delivered >= GOAL_DELIVERIES) { startVictorySequence(); return; }
        loseRun();
        return;
      }
      if (elapsed >= DAWN && warnDawnT === 0) {
        warnDawnT = -1;
        const need = Math.max(0, GOAL_DELIVERIES - delivered);
        say(!finalBossDefeated ? "擊敗大妖" : `還差 ${need} 件委託`, P.x, P.y - 75, "#ffb3ba");
      }
    }

    if (warnDawnT > 0 && !safeRead) warnDawnT -= dt;

    // 燈火受擊衝量獨立衰減；即使命中停頓，也讓 HUD 的震盪自然回穩。
    lanternHitT = Math.max(0, lanternHitT - dt);

    // 命中停頓只凍結戰鬥動作；夜行時鐘、Boss 排程與耗油照常前進。
    if (hitStopped && !safeRead) return;

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

    if (!safeRead) {
      for (const o of orders) o.life -= dt;
      const expired = orders.filter(o => o.life <= 0).length;
      orders = orders.filter(o => o.life > 0);
      if (expired) say("委託逾期", P.x, P.y - 45, "#ff8f8f");
      orderT -= dt;
      const desiredOrders = CFG.orderSlots(elapsed, delivered);
      if (orderT <= 0 || orders.length < desiredOrders) {
        makeOrder();
        orderT = 7 + Math.random() * 3;
      }
    }

    // 玩家位移（基礎速度微調較慢，可藉由卡片提升）
    const m = dashT > 0 ? dashDir : move();
    if (Math.hypot(m.x, m.y) > 0.05) {
      P.faceAng = Math.atan2(m.y, m.x);
    }
    const baseSpd = 230 + (b.spd || 0) * 35;
    const sp = dashT > 0 ? 780 : baseSpd;
    const steps = Math.max(1, Math.ceil(sp * dt / 9));
    for (let i = 0; i < steps; i++) {
      const nx = P.x + m.x * sp * dt / steps;
      const ny = P.y + m.y * sp * dt / steps;
      if (!blocked(nx, P.y)) P.x = nx;
      if (!blocked(P.x, ny)) P.y = ny;
    }
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

    if (!safeRead) {
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
    }

    if (!safeRead) {
    // 敵人邏輯與傷害碰撞（衝撞扣燈油；若有護盾則扣護盾）
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.attackT = Math.max(0, (e.attackT || 0) - dt);
      const knocked = moveKnockback(e, dt);
      if (e.freezeT > 0) {
        e.freezeT = Math.max(0, e.freezeEnds == null ? e.freezeT - dt : e.freezeEnds - elapsed);
        if (!(e.freezeT > 0 && (e.freezeEnds == null || elapsed < e.freezeEnds))) {
          e.freezeT = 0;
          delete e.shatterVolley;
        } else {
          e.walking = false;
          continue;
        }
      }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.type === "mis") {
        e.speed = MIS_SPEED;
      }
      const revealing = e.revealT && e.revealT > 0;
      if (revealing) e.revealT = Math.max(0, e.revealT - dt);
      const baseSpd = Number.isFinite(e.speed) ? e.speed : 0;
      let curSpd = revealing ? 0 : ((e.slowT && e.slowT > 0) ? Math.min(baseSpd, 25) : baseSpd);
      if (sacredSanctuary && sacredSanctuary.life > 0 && e.type !== "boss" && dist(e, sacredSanctuary) <= sacredSanctuary.r) curSpd *= 0.6;
      let hazardHit = null;
      if (e.type === "boss" && window.BOSS_AI?.step) {
        const stepped = window.BOSS_AI.step(e, P, dt, {
          blocked: (x, y, r = 32) => blocked(x, y, r),
          stageId: STAGE.id,
          paused: surgeWarningT > 0
        });
        if (stepped?.hit) hazardHit = stepped.hit;
      }
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const bossBusy = e.type === "boss" && !!e.hazard;

      // 所有怪物逼近玩家（加入建築物碰撞障礙滑移）
      const step = (bossBusy || knocked) ? 0 : CFG.chaseStep(d, curSpd, dt, e.type, STAGE_ENEMY.shots !== false);
      const stepX = ((dx || (d === 1 && !dy ? 1 : 0)) / d) * step;
      const stepY = (dy / d) * step;
      const oldX = e.x, oldY = e.y;
      if (!blocked(e.x + stepX, e.y, 16)) e.x += stepX;
      if (!blocked(e.x, e.y + stepY, 16)) e.y += stepY;
      e.walking = !knocked && !revealing && (e.x !== oldX || e.y !== oldY);
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
      if (!revealing && (hazardHit || (!bossBusy && Math.hypot(P.x - e.x, P.y - e.y) < hitRadius))) {
        e.attackT = 0.24;
        const dmg = hazardHit ? hazardHit.damage : (e.type === "tank" ? 18 : 10);
        if (hurtPlayer(dmg)) return;
      }
    }

    // 敵人幽冥妖火彈更新
    for (const eb of enemyBullets) {
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;
      if (blocked(eb.x, eb.y, 8)) { eb.life = 0; continue; }
      if (dist(P, eb) < 20) {
        eb.life = 0;
        if (hurtPlayer(8, "妖火灼身・燈油 −8")) return;
      }
    }
    enemyBullets = enemyBullets.filter(eb => eb.life > 0);
    const despawnRadius = Math.max(1150, spawnRadius(0) + 300);
    enemies = enemies.filter(e => e.hp > 0 && (e.type === "boss" || (e.type === "mis" && dist(e, P) < 3000) || dist(e, P) < despawnRadius));

    if (finalBossDefeated && delivered >= GOAL_DELIVERIES && state === "play") {
      startVictorySequence();
      return;
    }

    if (bossT <= 0 && bossStage < BOSS_TIMES.length) {
      const plan = bossBlueprint(bossStage);
      const alive = enemies.filter(e => e.type === "boss" && e.hp > 0);
      const wait = plan.role === "final"
        ? alive.some(e => !e.gatekeeper)
        : plan.role === "gate"
          ? alive.some(e => !e.final)
          : alive.length > 0;
      const position = wait || plan.hp == null ? null : spawnPosition(spawnRadius(520), Math.random() * 6.283, 52);
      if (position) {
        const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));
        let bossPool = ALL.filter(w => !livingMisWords.has(w.jp));
        if (bossPool.length === 0) bossPool = ALL;
        let word = null;
        let introduced = true;
        if (plan.quiz) {
          const studied = study?.seenWords?.() || [];
          if (studied.length) word = studied[studied.length - 1];
          else { word = STORE.pick(bossPool); introduced = false; }
        }
        enemies.push({
          ...position,
          type: "boss",
          word,
          shield: !!plan.quiz,
          role: plan.role,
          gatekeeper: plan.role === "gate",
          final: plan.role === "final",
          bossIndex: bossStage,
          oilReward: plan.oil,
          hp: plan.hp,
          max: plan.hp,
          speed: plan.role === "gate" ? 70 : plan.role === "final" ? 46 : 58,
          flash: 0,
          wob: 0,
          attackCd: 1.2,
          introduced
        });
        bossStage++;
        const nextBossAt = BOSS_TIMES[bossStage];
        bossT = nextBossAt == null ? Number.POSITIVE_INFINITY : Math.max(0, nextBossAt - elapsed);
        const harborBoss = STAGE_ENEMY.bossTheme === "harbor";
        say(plan.role === "final" ? (harborBoss ? "港霧大妖" : "大妖出現") : (harborBoss ? "港霧妖將" : "大妖出現"), P.x, P.y - 75, "#ff8f8f");
        AUDIO.thunder();
      }
    }
    }

    const bs = enemies.find(e => e.type === "boss" && e.shield);
    if (bs && dist(P, bs) < 380) {
      if (!bs.quiz) {
        const needsIntro = bs.introduced === false && !!bs.word;
        if (needsIntro) {
          say(`${bs.word.jp}＝${bs.word.zh}`, bs.x, bs.y - 78, "#9be7ff");
          AUDIO.speak(bs.word.jp);
          study?.seen?.(bs.word);
          bs.wasAssisted = true;
          bs.introduced = true;
        }
        bs.quiz = mkQ(bs);
        if (needsIntro) bs.quiz.introduced = true;
      }
      bossQ = bs.quiz;
      bossQ.reading = quizNear === bs;
      bossQ.lock = Math.max(0, bossQ.lock - dt);
    } else {
      bossQ = null;
    }

    if (!safeRead) {
    // 靈玉經驗吸收
    const att = magnetRadius(b.mag);
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
    }

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
        // 開場台詞與光環仍走。讀題時不震退、不刪彈。
        if (!safeRead) {
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
          for (const eb of enemyBullets) {
            if (dist(job.to, eb) < 240) {
              eb.life = 0;
              burst(eb.x, eb.y, "#ffe082", 4);
            }
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
        if (job.hold >= READ_DWELL) resolve(idx);
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

    if (!safeRead && xp >= xpNeed()) offerUp();
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

  function drawBossHazard(h) {
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;
    ctx.save();
    ctx.globalAlpha = h.phase === "recovery" ? 0.28 : 0.72;
    if (h.kind === "slam") {
      const r = h.r || 150;
      ctx.fillStyle = "rgba(255,65,35,0.18)";
      ctx.strokeStyle = "#ffbd72";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff0cb";
      ctx.font = UI.readableFont(16, "900");
      ctx.textAlign = "center";
      ctx.fillText("砸地！離開紅圈", h.x, h.y + 8);
    } else if (h.kind === "charge") {
      const ang = h.angle || 0;
      const len = 620 * 0.65;
      ctx.strokeStyle = "rgba(255,120,50,0.45)";
      ctx.lineWidth = 104;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + Math.cos(ang) * len, h.y + Math.sin(ang) * len);
      ctx.stroke();
    } else if (h.kind === "ring") {
      const gap = h.gapAngle || 0;
      const half = (h.gapWidth || Math.PI / 2) / 2;
      ctx.strokeStyle = "rgba(255,80,40,0.85)";
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r || 80, gap + half, gap + Math.PI * 2 - half);
      ctx.stroke();
    } else if (h.kind === "tide") {
      const ang = h.angle || 0;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const off = h.safeOffset || 0;
      const lane = h.safeWidth || 130;
      const sx = h.x - sin * off, sy = h.y + cos * off;
      ctx.strokeStyle = "rgba(150,230,255,0.55)";
      ctx.lineWidth = lane;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(sx - cos * 300, sy - sin * 300);
      ctx.lineTo(sx + cos * 300, sy + sin * 300);
      ctx.stroke();
      const prog = Number.isFinite(h.progress) ? h.progress : -280;
      const wx = h.x + cos * prog, wy = h.y + sin * prog;
      const gap = lane / 2;
      ctx.strokeStyle = h.phase === "telegraph" ? "rgba(80,150,200,0.4)" : "rgba(30,110,170,0.75)";
      ctx.lineWidth = 120;
      ctx.beginPath();
      ctx.moveTo(wx - sin * (off - 460), wy + cos * (off - 460));
      ctx.lineTo(wx - sin * (off - gap), wy + cos * (off - gap));
      ctx.moveTo(wx - sin * (off + gap), wy + cos * (off + gap));
      ctx.lineTo(wx - sin * (off + 460), wy + cos * (off + 460));
      ctx.stroke();
      if (h.phase === "telegraph") {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#d7f6ff";
        ctx.font = UI.readableFont(16, "900");
        ctx.textAlign = "center";
        ctx.fillText("潮來！站上亮帶", sx, sy);
      }
    }
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
      // 44px 新石燈的火袋中心約在腳底上方 22px，降低一排柔光球的視覺重量。
      const lampLightY = l.y - 22;
      FX.glow(ctx, l.x, lampLightY, 96, "#ffcf6a", 0.24);
      const lamp = window.ART && window.ART.prop_lantern;
      if (lamp && lamp.complete && lamp.naturalWidth) {
        const lw = 44;
        const lh = lw * lamp.naturalHeight / lamp.naturalWidth;
        RENDERER.drawScenerySprite?.(lamp,l.x-lw/2,l.y-lh+8,lw,lh);
        FX.glow(ctx, l.x, lampLightY, 32, "#ffe3a0", 0.34);
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
          ctx.font = job.rev ? UI.readableFont(18, "700") : sceneAnswerFont(19);
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
          ctx.arc(p.x, p.y, 44, -1.57, -1.57 + 6.283 * Math.min(1, job.hold / READ_DWELL));
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 6. 手繪封印靈玉：以墨線／和紙亮面取代螢光圓點。
    for (const g of gems) {
      if (!nearView(g.x, g.y, 40)) continue;
      RENDERER.drawSpiritGem(g, elapsed);
    }

    // 技能的貼地圖案（淨化靈陣等）畫在所有角色之前，才會被角色蓋住。
    if (sacredSanctuary && sacredSanctuary.life > 0) {
      const lifeNorm = sacredSanctuary.life / (sacredSanctuary.maxLife || 1.8);
      const alpha = Math.min(0.92, lifeNorm * 1.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      const sr = sacredSanctuary.r, sx = sacredSanctuary.x, sy = sacredSanctuary.y;
      const SQ = 0.6; // 俯視地面壓扁比率
      const mandalaArt = window.ART?.barrier_mandala_ukiyoe;
      if (mandalaArt?.naturalWidth > 0 && mandalaArt?.naturalHeight > 0) {
        const width = sr * 2.32;
        const height = width * mandalaArt.naturalHeight / mandalaArt.naturalWidth;
        const breathe = 1 + Math.sin(elapsed * 3.2) * 0.015 * liveMotion();
        ctx.translate(sx, sy);
        ctx.scale(breathe, breathe);
        ctx.drawImage(mandalaArt, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {

      // 1. 曼荼羅外圍三重金輪結界 (Triple Golden Mandala Rings)
      ctx.strokeStyle = '#ffdf7a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * SQ, 0, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr * 0.94, sr * 0.94 * SQ, 0, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr * 0.76, sr * 0.76 * SQ, 0, 0, 6.283); ctx.stroke();

      // 曼荼羅金色神域柔光底色
      ctx.fillStyle = 'rgba(255, 224, 130, 0.2)';
      ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * SQ, 0, 0, 6.283); ctx.fill();

      // 2. 旋轉金剛法輪輻條 (Rotating Vajra Dharma Wheel Spokes)
      const rot = elapsed * 0.35;
      ctx.strokeStyle = 'rgba(255, 215, 100, 0.65)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const fa = rot + i * Math.PI / 8;
        const r0 = sr * 0.28, r1 = sr * 0.76;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(fa) * r0, sy + Math.sin(fa) * r0 * SQ);
        ctx.lineTo(sx + Math.cos(fa) * r1, sy + Math.sin(fa) * r1 * SQ);
        ctx.stroke();
      }

      // 3. 中心八葉蓮華曼荼羅印 (Center 8-Petal Lotus Mandorla)
      const pulse = 1 + Math.sin(elapsed * 6) * 0.08;
      ctx.fillStyle = 'rgba(255, 235, 160, 0.35)'; ctx.strokeStyle = '#ffe57f'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr * 0.28 * pulse, sr * 0.28 * SQ * pulse, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffab00'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(sx, sy, sr * 0.16, sr * 0.16 * SQ, 0, 0, 6.283); ctx.stroke();

      // 4. 擴散金色退魔衝擊光波 (Expanding Purifying Shockwave Rings)
      const wavePhase = (elapsed * 1.5) % 1;
      const waveR = sr * wavePhase;
      ctx.strokeStyle = `rgba(255, 240, 180, ${(1 - wavePhase) * 0.7})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, waveR, waveR * SQ, 0, 0, 6.283); ctx.stroke();

      // 5. 八方立體神域鳥居與通天神聖金光柱 (8 Radiant Torii Gates & Soaring Holy Light Pillars)
      for (let i = 0; i < 8; i++) {
        const ta = i * Math.PI / 4 + elapsed * 0.08;
        const tx = sx + Math.cos(ta) * sr * 0.88, ty = sy + Math.sin(ta) * sr * 0.88 * SQ;

        // 通天神光柱 (Skyward Celestial Light Pillar)
        const beamH = 110 + Math.sin(elapsed * 3 + i) * 15;
        const beamGrad = ctx.createLinearGradient(0, ty - beamH, 0, ty);
        beamGrad.addColorStop(0, 'rgba(255, 245, 180, 0)');
        beamGrad.addColorStop(0.3, 'rgba(255, 220, 100, 0.15)');
        beamGrad.addColorStop(1, 'rgba(255, 235, 140, 0.45)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(tx - 12, ty - beamH, 24, beamH);

        // 鳥居基座與朱紅柱 (Vermilion Torii Posts with Gold Caps)
        ctx.fillStyle = '#b72818'; ctx.strokeStyle = '#4a0e08'; ctx.lineWidth = 1.2;
        ctx.fillRect(tx - 8, ty - 26, 4, 26); ctx.strokeRect(tx - 8, ty - 26, 4, 26);
        ctx.fillRect(tx + 4, ty - 26, 4, 26); ctx.strokeRect(tx + 4, ty - 26, 4, 26);
        // 金色柱腳
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(tx - 9, ty - 3, 6, 4); ctx.fillRect(tx + 3, ty - 3, 6, 4);
        // 貫 (Nuki - 中間橫樑)
        ctx.fillStyle = '#9c2014';
        ctx.fillRect(tx - 11, ty - 18, 22, 3);
        // 笠木與島木 (Kasagi/Shimaki - 頂層微翹橫頂)
        ctx.fillStyle = '#b72818'; ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx - 14, ty - 28); ctx.lineTo(tx + 14, ty - 28);
        ctx.lineTo(tx + 12, ty - 24); ctx.lineTo(tx - 12, ty - 24);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 懸掛白色注連繩紙垂 (Sacred Shide Talismans)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx - 2, ty - 15, 4, 6);
      }
      ctx.restore();
      }
    }
    FX.drawGround(ctx, cam, view);
    // Lit ground occupies a flattened perspective plane beneath every actor.
    // Animated molten patch: slow breathing, flickering ink strokes and drifting embers.
    const animateGroundHeat=liveMotion()!==0;
    for(const zone of dragonScorches){
      if(!nearView(zone.x,zone.y,zone.r*1.25))continue;
      const age=zone.maxLife-zone.life,fade=Math.max(0,Math.min(0.84,zone.life/0.75,age/0.30));
      const pulse=animateGroundHeat?1+Math.sin(age*7.5)*0.024:1;
      const w=zone.r*2.1*pulse,h=zone.r*1.23*(animateGroundHeat?1+Math.sin(age*6.2)*0.02:1);
      ctx.save();ctx.globalAlpha=fade;
      const art=window.ART?.dragon_burning_ground_l5;
      if(art?.naturalWidth>0){
        ctx.drawImage(art,zone.x-w/2+(animateGroundHeat?Math.sin(age*3.5)*2:0),zone.y-h/2,w,h);
      }else{
        ctx.fillStyle='rgba(185,53,17,0.38)';
        ctx.beginPath();ctx.ellipse(zone.x,zone.y,zone.r,zone.r*0.53,0,0,6.283);ctx.fill();
      }
      // Ink-like secondary motion without a costly whole-screen distortion shader.
      for(let i=0;i<(animateGroundHeat?6:0);i++){
        const a=i*2.4,fx=zone.x+Math.cos(a)*zone.r*0.65,fy=zone.y+Math.sin(a)*zone.r*0.29;
        const sway=Math.sin(age*5+i*1.75)*8,rise=(age*21+i*13)%23;
        ctx.strokeStyle='rgba(252,164,64,0.28)';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(fx-7,fy+4);
        ctx.quadraticCurveTo(fx+sway,fy-8-rise*0.3,fx+sway*0.7+7,fy-19-rise*0.6);ctx.stroke();
        ctx.fillStyle='rgba(255,201,114,0.42)';
        ctx.beginPath();ctx.arc(fx+sway*0.45,fy-4-rise,1.8+Math.sin(age*8+i)*0.5,0,6.283);ctx.fill();
      }
      ctx.restore();
    }
    SKILLFX.drawArtFx?.(ctx, true);

    for (const e of enemies) if (e.hp > 0 && e.hazard && nearView(e.hazard.x, e.hazard.y, 480)) drawBossHazard(e.hazard);

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

    // Lv1–3 僅環繞、Lv4 三火脫離追擊；MAX 六火常駐並召喚黑龍。
    if (WL.fire > 0) {
      const count = EVOLUTIONS.fireCount(WL.fire);
      const orbitR = EVOLUTIONS.FIRE_ORBIT;
      const awaySlots = new Set(ghosts.filter(p=>p.fireAttack&&p.life>0&&p.level===WL.fire).map(p=>p.slot));
      for (let i = 0; i < count; i++) {
        if (awaySlots.has(i)) continue;
        const a = fAng + (i * 6.283) / count;
        SKILLFX.paint(ctx, "fire", WL.fire, {
          x: P.x + Math.cos(a) * orbitR, y: P.y + Math.sin(a) * orbitR,
          ang: a, origin: P, orbitR, time: elapsed + i * 0.2, orbit: true
        });
      }
    }

    // 12.5 破魔靈針彈幕
    for(const p of ghosts)if(!p.dragon)SKILLFX.paint(ctx,"ghost",p.level??5,p);
    for (const nd of needles) SKILLFX.paint(ctx, "needle", nd.level??WL.needle, { x: nd.x, y: nd.y, ang: Math.atan2(nd.vy, nd.vx) });

    // 13. 斬擊弧與結界擊中環
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

    // 14. 飄字：受傷提示用高對比墨邊 + 亮色字，避免被褐色場景吞掉。
    for (const t of texts) {
      const injury = typeof t.v === "string" && /^(受創|妖火灼身)/.test(t.v);
      ctx.save();
      ctx.globalAlpha = injury ? clamp(t.life * 1.15, 0, 1) : clamp(t.life, 0, 1);
      ctx.textAlign = "center";
      ctx.font = UI.readableFont(17, "bold");
      if (injury) {
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#211719";
        ctx.lineWidth = 2.6;
        ctx.strokeText(t.v, t.x, t.y);
      }
      ctx.fillStyle = injury ? "#fff4d3" : t.c;
      ctx.fillText(t.v, t.x, t.y);
      ctx.restore();
    }

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
        ctx.strokeStyle='#fff4dd';ctx.lineWidth=2.5;
        const text=job.rev?job.ans[i].zh:job.ans[i].jp, y=p.y+(meaning?0:8);
        ctx.font=job.rev?UI.readableFont(31,'700'):sceneAnswerFont(33);
        const ready=job.rev || UI.answerFontReady(text,31,'700');
        if(ready){ctx.strokeText(text,p.x,y);ctx.fillStyle=job.eliminatedIdx===i?'#888899':'#161224';ctx.fillText(text,p.x,y);}
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
    SKILLFX.drawArtFx?.(ctx, false);
    // 妖刀手繪刀氣屬於自發光前景：夜色遮罩後再合成，保持浮世繪青白與金色筆觸。
    for(const p of winds) SKILLFX.paint(ctx,"wind",5,p);
    // 黑龍改由 HUD 上層合成，避免再次被羅盤、提燈及任務 UI 蓋住。
    // The projectile floats above the world, separate from the ground fire.
    for(const shot of dragonShots){
      if(!nearView(shot.x,shot.y,120))continue;
      ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(shot.ang);
      // Bounded woodblock-ink comet tail and warm aura. Draw only while a
      // shot is alive; no particles accumulate in long-running sessions.
      const age=shot.maxLife-shot.life,anim=liveMotion()!==0;
      const shimmer=anim?Math.sin(age*24)*0.045:0;
      ctx.fillStyle='rgba(242,84,26,0.16)';
      ctx.beginPath();ctx.ellipse(-11,0,86+shimmer*100,60+shimmer*80,0,0,6.283);ctx.fill();
      ctx.fillStyle='rgba(255,180,64,0.18)';
      ctx.beginPath();ctx.ellipse(-3,0,65,42,0,0,6.283);ctx.fill();
      for(let i=0;i<(anim?10:4);i++){
        const back=48+i*13+(anim?(age*82+i*7)%22:0);
        const sideways=Math.sin(i*2.5+(anim?age*12:0))*(9+i*2.9);
        const alpha=(0.36+(i%3)*0.16)*(1-i/15);
        ctx.globalAlpha=alpha;
        ctx.strokeStyle=i%3===0?'#ffe0a0':i%3===1?'#ff9d38':'#da4b1f';
        ctx.lineWidth=3.8-i*0.2;
        ctx.beginPath();
        ctx.moveTo(-back+17,sideways-4);
        ctx.quadraticCurveTo(-back+6,sideways-13,-back-9,sideways+4);
        ctx.stroke();
        ctx.fillStyle=i%2?'#ffd478':'#f47e35';
        ctx.beginPath();ctx.arc(-back-5,sideways+7,2.5-i*0.12,0,6.283);ctx.fill();
      }
      ctx.globalAlpha=1;
      const art=window.ART?.dragon_fireball_l5;
      if(art?.naturalWidth>0){
        ctx.drawImage(art,-72,-72,144,144);
      }else{
        ctx.fillStyle='#f6aa45';ctx.strokeStyle='#572720';ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(0,0,35,0,6.283);ctx.fill();ctx.stroke();
      }
      // A short golden brush-flash keeps the ball distinct from blue katana arcs.
      ctx.globalAlpha=anim?0.64+Math.sin(age*22)*0.08:0.60;
      ctx.strokeStyle='#ffe9a1';ctx.lineWidth=3.5;
      ctx.beginPath();ctx.arc(0,0,57,-0.78,0.55);ctx.stroke();
      ctx.globalAlpha=1;      ctx.restore();
    }
    RENDERER.drawSlashArcs();
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

  function drawDragonHudOverlay() {
    const cam = RENDERER.getCam(), shakeOffset = RENDERER.getShakeOffset();
    ctx.save();
    ctx.translate(-cam.x+shakeOffset.x,-cam.y+shakeOffset.y);
    for (const dragon of ghosts) if (dragon.dragon && dragon.life>0) SKILLFX.paint(ctx,"ghost",5,dragon);
    ctx.restore();
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
    if (artPending()) return;
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
      else if (e.key === 'Enter' || action === 'interact') activateWithFeedback(menuButtons()[menuFocus].id);
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
      } else if (!e.repeat && (e.key === 'Enter' || action === 'interact')) { e.preventDefault(); AUDIO.init(); activateWithFeedback(buttons[menuFocus].id); }
      return;
    }
    if (state === "levelup") {
      if (e.code === 'Tab' || ['u','d','l','r'].includes(action)) {
        e.preventDefault();
        if (!e.repeat) {
          const dir = e.code === 'Tab' ? (e.shiftKey ? -1 : 1) : ['u','l'].includes(action) ? -1 : 1;
          levelupFocus = clamp(levelupFocus + dir, 0, Math.max(0, choices.length - 1));
        }
      } else if (!e.repeat && "123".includes(e.key) && e.key.length === 1) {
        e.preventDefault();
        levelupFocus = +e.key - 1;
        pickUp(levelupFocus);
      } else if (!e.repeat && (e.key === 'Enter' || action === 'interact')) {
        e.preventDefault();
        pickUp(levelupFocus);
      } else if (!e.repeat && e.code === 'KeyR') {
        e.preventDefault();
        reroll();
      }
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
    else if (bossQ && !job?.reading && !e.repeat && "123".includes(e.key)) {
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
    if (artPending()) return;
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
      if (button) { menuFocus = UI.EXIT_BTNS.indexOf(button); activateWithFeedback(button.id); }
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
          menuFocus = (UI.pauseButtons?.() || UI.PAUSE_BTNS).findIndex(b=>b.id===btn.id);
          activateWithFeedback(btn.id);
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
      if (btn) { menuFocus = menuButtons().findIndex(b=>b.id===btn.id); activateWithFeedback(btn.id); }
      return;
    }
    if (state === "levelup") {
      const cardW = 720, cardH = 108, startX = 90, gap = 14, cy = 176;
      for (let i = 0; i < 3; i++) {
        const cx = startX;
        const rowY = cy + i * (cardH + gap);
        if (p.x >= cx && p.x <= cx + cardW && p.y >= rowY && p.y <= rowY + cardH) {
          levelupFocus = i;
          pickUp(i);
          return;
        }
      }
      if (UI.REROLL_BTN && hitButton(p, UI.REROLL_BTN)) reroll();
      return;
    }
    if (bossQ && !job?.reading) {
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
    if (state === "levelup" && e.pointerType === "mouse") {
      const pt = pp(e);
      for (let i=0;i<choices.length;i++) {
        const y=176+i*122;
        if (pt.x>=90 && pt.x<=810 && pt.y>=y && pt.y<=y+108) {levelupFocus=i;break;}
      }
    }
    if(e.pointerType === 'mouse'){
      const available = quitConfirm ? UI.EXIT_BTNS
        : state === "pause" ? UI.pauseButtons?.()
        : ["menu","won","lost"].includes(state) ? menuButtons() : null;
      const over = available?.find(b=>hitButton(pp(e),b));
      UI.setButtonHover?.(over?.id || null);
      if(over && !pendingMenuActivation) menuFocus = available.findIndex(b=>b.id===over.id);
    }
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

  cv.addEventListener("pointerleave", () => UI.setButtonHover?.(null));
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
    proj = []; needles = []; winds = []; ghosts = []; dragonShots = []; dragonScorches = []; enemyBullets = [];
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
      boss: enemies.find(e => e.type === "boss" && e.hp > 0) || null,
      awakening: awakeningState(),
      reading: {
        active: !!(job?.reading || bossQ?.reading),
        kind: job?.reading ? "delivery" : "boss",
        progress: job ? Math.min(1, (job.hold || 0) / READ_DWELL) : 0
      }
    };
  }

  function runFrame(now) {
    menuButtons();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    levelupCooldown = Math.max(0, levelupCooldown - dt);
    if (pendingMenuActivation) {
      const action = pendingMenuActivation;
      if (state !== action.state || quitConfirm !== action.quitConfirm) pendingMenuActivation = null;
      else if ((action.remaining -= dt) <= 0) {
        pendingMenuActivation = null;
        activateMenu(action.id);
      }
    }

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
    if (artPending()) {
      ctx.save();
      const area = viewBounds(), cover = window.ART?.cover;
      ctx.fillStyle = '#080c1a'; ctx.fillRect(area.left,area.top,area.width,area.height);
      if (cover) ctx.drawImage(cover,area.left,area.top,area.width,area.height);
      ctx.fillStyle = 'rgba(8,12,26,0.88)'; ctx.fillRect(area.left,area.top,area.width,area.height);
      UI.drawAssetProgress?.(ctx,true);
      ctx.restore();
    } else if (state === "menu") {
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
        if (state === "play") drawDragonHudOverlay();
        if (titleCardT > 0 && state === "play") UI.drawTitleCard(ctx, STAGE, stageChapter(), titleCardT);
        const activeBoss = enemies.find(e => e.type === "boss" && e.hp > 0) || null;
        const sealFade = bossSealBreak?.boss === activeBoss ? Math.max(0,1-(performance.now()-bossSealBreak.at)/850) : 0;
        if (bossQ || activeBoss) UI.drawBossQuiz(ctx,bossQ,inputMode,activeBoss,sealFade);
        if (state === "levelup") UI.drawLevelUp(ctx, level + 1, choices, WL, WI, rerolls, now / 1000, levelupFocus, inputMode, awakeningState());
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
