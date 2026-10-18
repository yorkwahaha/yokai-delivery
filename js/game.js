(() => {
  "use strict";

  const W = 900, H = 600;
  const CFG = window.GAME_CONFIG;
  // hard 原樣保存既有小怪曲線；僅夜行町預設 normal，暫不接難度 UI。
  const MOB_DIFFICULTY_PROFILES = Object.freeze({
    hard: Object.freeze({ hpScale: 1, speedScale: 1, timeScale: 1, powerScale: 1,
      intervalScale: 1, cap: 95, surgeCountScale: 1, surgePacingScale: 1, capSurges: false, xpNeedScale: 1 }),
    normal: Object.freeze({ hpScale: 0.65, speedScale: 0.82, timeScale: 0.35, powerScale: 0,
      intervalScale: 1.15, cap: 57, surgeCountScale: 0.6, surgePacingScale: 2, capSurges: true, xpNeedScale: 0.75 })
  });
  function mobDifficultyForStage(stage) {
    return stage.id === "night-town"
      ? MOB_DIFFICULTY_PROFILES[stage.pacing?.mobDifficulty === "hard" ? "hard" : "normal"]
      : MOB_DIFFICULTY_PROFILES.hard;
  }
  let STAGE = window.CONTENT.getStage("night-town");
  let MOB_DIFFICULTY = mobDifficultyForStage(STAGE);
  let STAGE_PACING = STAGE.pacing || {};
  let STAGE_VISUAL = STAGE.visual || {};
  let STAGE_ENEMY = STAGE.enemy || {};
  let START = STAGE.start || { x: 1350, y: 900 };
  let DAWN = STAGE_PACING.runSeconds || CFG.RUN_SECONDS;
  let GOAL_DELIVERIES = STAGE_PACING.goalDeliveries || CFG.GOAL_DELIVERIES;
  let BOSS_TIMES = STAGE_PACING.bossTimes || CFG.BOSS_TIMES;
  let SURGE_FIRST = (STAGE_PACING.surgeFirst || CFG.SURGE_FIRST) * MOB_DIFFICULTY.surgePacingScale;
  let SURGE_INTERVAL = (STAGE_PACING.surgeInterval || CFG.SURGE_INTERVAL) * MOB_DIFFICULTY.surgePacingScale;
  let XP_NEED_SCALE = (STAGE_PACING.xpNeedScale || 1) * MOB_DIFFICULTY.xpNeedScale;
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
  const tiltK = () => window.VIEWPORT?.tiltScale?.() || 1;
  const worldViewBounds = () => window.VIEWPORT?.worldBounds?.() || viewBounds();
  const upright = (x,y,draw) => window.VIEWPORT.upright(ctx,x,y,draw);
  const uprightHere = (x,y) => {
    const k=tiltK();
    if(k!==1){ctx.translate(x,y);ctx.scale(1,1/k);ctx.translate(-x,-y);}
  };
  const tiltWorld = (cam,shake) => {
    const k=tiltK();
    const z=window.VIEWPORT?.worldZoom?.() || 1;
    if(z!==1){
      ctx.translate(W/2,H/2);
      ctx.scale(z,z);
      ctx.translate(-W/2,-H/2);
    }
    ctx.translate(-cam.x+shake.x,(-cam.y+shake.y)*k);
    if(k!==1)ctx.scale(1,k);
  };
  const isPortrait = () => window.innerWidth <= 900 && window.innerHeight >= window.innerWidth;
  addEventListener("resize", () => {
    RENDERER.resize?.(); joy = null;
    if (isPortrait() && state === "play") suspend();
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
  const worldSpacingScaleY = () => window.VIEWPORT?.spacingScaleY?.() || 1;
  let WORLD_STATE = window.WORLD.createStageWorld(STAGE, window.CONTENT,
    {spacingScaleY:worldSpacingScaleY()});
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
  function knockback(e, distance, origin = null) {
    if (e.type === "boss" || e.hp <= 0 || !distance) return;
    const from = origin || P;
    const length = dist(from, e) || 1;
    const sign = Math.sign(distance);
    (e.knockQueue ||= []).push({
      dx: (e.x - from.x) / length * sign,
      dy: (e.y - from.y) / length * sign,
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
    if (state === "won") {
      const btns = typeof UI.endScreenButtons === "function" ? UI.endScreenButtons(state) : null;
      if (Array.isArray(btns) && btns.length) return btns;
      const worldBtn = UI.END_BTNS ? UI.END_BTNS.find(b => b.id === "world") : null;
      return worldBtn ? [worldBtn] : [];
    }
    if (state === "lost") {
      const base = (typeof UI.endScreenButtons === "function" ? UI.endScreenButtons(state) : null) || UI.END_BTNS || [];
      const review = typeof UI.reviewButtons === "function" ? UI.reviewButtons(misses).slice(0, 3) : [];
      return review.length ? [...base, ...review] : base;
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
    pendingDepart = false;
    AUDIO.dropPrepared?.();
    UI.setButtonHover?.(null);
    quitConfirm = false;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    state = "menu"; menuFocus = 0; menuFocusState = state;
    window.dispatchEvent(new Event('gamepause'));
  }
  function activateMenu(id) {
    if ((state === "won" || state === "lost") && endCooldown > 0) return;
    if (state === "won" || state === "lost") {
      const allowed = menuButtons() || [];
      if (!allowed.some(b => b && b.id === id)) return;
    }
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
  let pendingDepart = false;
  let overworldNoticeT = 0;
  let gpOverworldDir = "";
  let elapsed = 0, warnDawnT = 0, oil = 100, maxOil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let orders = [], job = null, enemies = [], enemyBullets = [], gems = [], texts = [], rings = [], misses = [];
  let deliveryEventSeq = 0;
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
    let hp = CFG.BOSS_HP_BASE[index];
    if (STAGE && STAGE.id === "night-town" && typeof hp === "number") {
      hp = role === "final" ? Math.round(hp * 0.65) : Math.round(hp * 0.5);
    }
    return {
      hp,
      oil: CFG.BOSS_OIL_REWARD[index],
      quiz: role !== "gate",
      role
    };
  }
  function rollCrit(base, step, critLvl = b.crit) {
    let chance;
    if (typeof base === "object" && base !== null) {
      if (typeof base.critChance === "number") {
        chance = base.critChance;
      } else {
        const lvl = typeof base.critLvl === "number" ? base.critLvl : (b.crit || 0);
        const bVal = typeof step === "number" ? step : 0.2;
        const sVal = typeof critLvl === "number" ? critLvl : 0.15;
        chance = Math.min(0.5, bVal + lvl * sVal);
      }
    } else if (typeof step === "undefined") {
      chance = Math.min(0.5, base || 0);
    } else {
      chance = Math.min(0.5, base + (critLvl || 0) * step);
    }
    const isCrit = Math.random() < chance;
    return { isCrit, mult: isCrit ? 1.8 : 1 };
  }
  const wMax = { katana: 0.72, barrier: 3, needle: 1, boom: 2, thunder: 2.6, fire:1.1 };
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, endCooldown = 0, lanternHitT = 0;
  let playerAttackPoseT = 0, playerHurtPoseT = 0; // 視覺專用計時，不影響武器冷卻／碰撞
  let dashDir = { x: 1, y: 0 };
  let choices = [], levelupCooldown = 0, joy = null, touch = window.matchMedia?.("(pointer: coarse)")?.matches || false, inter = null, cargo = { x: 0, y: 0 }, pTrail = [], last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };
  const btnPause = { x: W - 52, y: 14, w: 38, h: 52 };
  // Compact interactive view switch below pause, outside the minimap's right edge.
  const btnView = { id: 'view-toggle', x: W - 66, y: 80, w: 52, h: 44 };
  function toggleViewMode() {
    const viewport = window.VIEWPORT;
    if (!viewport?.setTiltScale || state !== 'play') return;
    const next = (viewport.tiltTargetScale?.() ?? viewport.tiltScale()) === 1 ? 0.6 : 1;
    // Projection animates in world space over 0.8 s; buildings and collisions
    // stay fixed. Respect reduced-motion without compromising the switch.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    viewport.animateTiltScale(next, reduce ? 0 : 0.8);
    // Do not teleport the camera: each frame compensates around the courier.
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
  }
  let gpPrevButtons = [], gpMove = { x: 0, y: 0 };

  let bossT = BOSS_TIMES[0], bossStage = 0, finalBossDefeated = false;
  let finalBossPos = null, finalBossEnt = null, victorySeq = null;

  function checkVictoryCondition() {
    if (!finalBossDefeated) return false;
    if (STAGE && STAGE.id === "night-town") {
      return elapsed >= DAWN;
    }
    return delivered >= GOAL_DELIVERIES;
  }
  let ended = false, bossQ = null, bossSealBreak = null, codexBack = "menu", codexTab = "cards", codexPage = 0;
  let codexFocus = 'cards', codexFilter = { by: "all", id: null };
  function wordCodexState() {
    return { filter: codexFilter, page: codexPage };
  }
  function applyWordCodex(action) {
    const pack = UI.wordGallery();
    const next = window.CARD_GALLERY_UI.reduce(pack.cards, wordCodexState(), action, UI.wordGalleryViewport(), pack.catalogs);
    codexFilter = next.filter || { by: "all", id: null };
    codexPage = next.page || 0;
    if (next.close) state = codexBack;
  }
  function selectCodex(id) {
    codexFocus = id;
    if(id==='cards'||id==='words'){
      codexTab=id;
      codexPage=0;
      if(id==='words') codexFilter={by:'all',id:null};
      return;
    }
    if (codexTab==='words' && window.CARD_GALLERY_UI && typeof UI.wordGallery==='function') {
      if(id==='prev'||id==='next') applyWordCodex({type:'page', delta:id==='prev'?-1:1});
      else if(id==='filter-stage'||id==='filter-pack') applyWordCodex({type:'cycle', by:id==='filter-stage'?'stage':'pack'});
      else if(id==='back') state=codexBack;
      return;
    }
    if(id==='prev'||id==='next')turnCodexPage(id==='prev'?-1:1);
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
    MOB_DIFFICULTY = mobDifficultyForStage(STAGE);
    STAGE_PACING = STAGE.pacing || {};
    STAGE_VISUAL = STAGE.visual || {};
    STAGE_ENEMY = STAGE.enemy || {};
    const sourceStart = STAGE.start || { x: 1350, y: 900 };
    START = {x:sourceStart.x,y:sourceStart.y*worldSpacingScaleY()};
    DAWN = STAGE_PACING.runSeconds || CFG.RUN_SECONDS;
    GOAL_DELIVERIES = STAGE_PACING.goalDeliveries || CFG.GOAL_DELIVERIES;
    BOSS_TIMES = STAGE_PACING.bossTimes || CFG.BOSS_TIMES;
    SURGE_FIRST = (STAGE_PACING.surgeFirst || CFG.SURGE_FIRST) * MOB_DIFFICULTY.surgePacingScale;
    SURGE_INTERVAL = (STAGE_PACING.surgeInterval || CFG.SURGE_INTERVAL) * MOB_DIFFICULTY.surgePacingScale;
    XP_NEED_SCALE = (STAGE_PACING.xpNeedScale || 1) * MOB_DIFFICULTY.xpNeedScale;
    SPAWN_INTERVAL_SCALE = STAGE_PACING.spawnIntervalScale || 1;
    SPAWN_COUNT_BONUS = STAGE_PACING.spawnCountBonus || 0;
    WORLD_STATE = window.WORLD.createStageWorld(STAGE, window.CONTENT,
      {spacingScaleY:worldSpacingScaleY()});
    window.RENDERER?.setDepthStage?.(STAGE.id);
    window.VIEWPORT?.setZoomStage?.(STAGE.id);
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
  let buildRevision = 1;
  let buildMutations = [];
  let buildCharms = [];
  let buildDuos = [];

  const CHARM_CONFIG = {
    charm_power: {
      id: "charm_power",
      n: "力紋守",
      s: "りきもん",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "對已持有技能增加小幅基礎傷害（+0.20）；次級傷害不再次乘算",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    },
    charm_step: {
      id: "charm_step",
      n: "風步守",
      s: "かぜあるき",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "提升移動速度（+28 px/s），採單一集中參數；無穿牆、無無敵",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    },
    charm_gather: {
      id: "charm_gather",
      n: "招靈守",
      s: "しょうれい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "擴大靈玉拾取吸收半徑（+75 px）；不增產量、不自動完成送貨",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    },
    charm_cadence: {
      id: "charm_cadence",
      n: "疾奏守",
      s: "しっそう",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針攻擊冷卻小幅縮短（有效頻率 +0.25）；保留每招冷卻下限與 Lv5 固有節奏，不加速雷雲、火龍或時鐘",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    },
    charm_reach: {
      id: "charm_reach",
      n: "遠霞守",
      s: "とおがすみ",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    },
    charm_guard: {
      id: "charm_guard",
      n: "紙甲守",
      s: "かみよろい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "受創燈油損失減少 10%；護盾與無敵優先判定，小傷不歸零、不回油，不減免答題扣油",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（不可重複取得）",
      inPool: true
    }
  };

  const MUTATION_CONFIG = {
    mut_fan: {
      id: "mut_fan",
      skillId: "needle",
      skillIds: ["needle", "boom"],
      n: "千本散射",
      s: "さんしゃ",
      cat: "【 共享變異 】",
      levelText: "◆ 共享變異",
      d: "朝向多角度散射，發數增加且散射角擴大；單發傷害按發數比例分攤（每次施放總傷害預算上限控管）",
      requirementText: "持有天狐靈針或陰陽符（取得其他適用技能後沿用）",
      limitText: "每種限選一次（每技能最多 3 種變異，取得其他適用技能後沿用）",
      inPool: true
    },
    mut_seek: {
      id: "mut_seek",
      skillId: "needle",
      skillIds: ["needle", "boom"],
      n: "引魂追跡",
      s: "ついせき",
      cat: "【 共享變異 】",
      levelText: "◆ 共享變異",
      d: "靈針與未黏附陰陽符具備轉向角速率平滑追蹤妖怪，失去目標後沿當前方向直行（非瞬移）",
      requirementText: "持有天狐靈針或陰陽符（取得其他適用技能後沿用）",
      limitText: "每種限選一次（每技能最多 3 種變異，取得其他適用技能後沿用）",
      inPool: true
    },
    mut_frost: {
      id: "mut_frost",
      skillId: "needle",
      skillIds: ["needle", "boom"],
      n: "冰魄封靈",
      s: "ひょうはくふうれい",
      cat: "【 共享變異 】",
      levelText: "◆ 共享變異",
      d: "靈針命中與陰陽符主爆累積寒冷並短暫冰封；Boss 具備高寒冷門檻與 2.0 秒抗性免疫期（不被永久失能）",
      requirementText: "持有天狐靈針或陰陽符（取得其他適用技能後沿用）",
      limitText: "每種限選一次（每技能最多 3 種變異，取得其他適用技能後沿用）",
      inPool: true
    },
    mut_pierce: {
      id: "mut_pierce",
      skillId: "needle",
      skillIds: ["needle"],
      n: "靈針・穿透增額",
      s: "せんぼん・ぞうがく",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "保持既有穿透；第 2、第 3 隻命中獨敵各增加該針生成時 15% 傷害（總增額至多 30%），不額外投射，同敵去重",
      requirementText: "持有天狐靈針",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_return: {
      id: "mut_return",
      skillId: "needle",
      skillIds: ["needle"],
      n: "靈針・回旋折返",
      s: "せんぼん・おりかえし",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "沿途累積位移達有限距離後單次折返飛回生成原點；回程不再轉向，往返同敵至多扣血一次，總壽命不延長且不額外生成新針",
      requirementText: "持有天狐靈針",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_crosscut: {
      id: "mut_crosscut",
      skillId: "katana",
      skillIds: ["katana"],
      n: "妖刀・十字交斬",
      s: "ようとう・こうざん",
      cat: "【 妖刀變異 】",
      levelText: "◆ 妖刀變異",
      d: "主斬後延遲施展一次有限側向交叉斬；共用攻擊預算與傷害上界，Lv5 風刃不重複派生",
      requirementText: "持有退魔妖刀",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_pulse: {
      id: "mut_pulse",
      skillId: "barrier",
      skillIds: ["barrier"],
      n: "靈陣・連環脈衝",
      s: "れいじん・みゃくどう",
      cat: "【 靈陣變異 】",
      levelText: "◆ 靈陣變異",
      d: "一次大陣拆為兩次較小脈衝；兩次共享原傷害與控制預算，不重置受擊冷卻",
      requirementText: "持有淨化靈陣",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_branch: {
      id: "mut_branch",
      skillId: "thunder",
      skillIds: ["thunder"],
      n: "天狐雷・連鎖分歧",
      s: "てんこれい・ぶんき",
      cat: "【 天狐雷變異 】",
      levelText: "◆ 天狐雷變異",
      d: "主雷命中後分出至多 1 道次級雷擊，傷害為當次主雷 25%；次級不得再分支，不以生命百分比計傷",
      requirementText: "持有天狐雷",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_orbit: {
      id: "mut_orbit",
      skillId: "fire",
      skillIds: ["fire"],
      n: "狐火・偏心輪道",
      s: "こか・へんしんりんどう",
      cat: "【 狐火變異 】",
      levelText: "◆ 狐火變異",
      d: "狐火環繞半徑改為長短軸偏心橢圓（rx=126, ry=78），不增加火球數量與接觸傷害倍率，保持各級接觸與 Lv5 黑龍特性",
      requirementText: "持有狐火",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    },
    mut_splitblast: {
      id: "mut_splitblast",
      skillId: "boom",
      skillIds: ["boom"],
      n: "陰陽符・餘燼爆散",
      s: "おふだ・ばくさん",
      cat: "【 陰陽符變異 】",
      levelText: "◆ 陰陽符變異",
      d: "主爆後原爆心延遲 0.18 秒產生一次小型次爆（半徑 55%）；對原直擊目標取主爆全傷 25%，其餘取濺射傷 25%，無擊退、不再次派生",
      requirementText: "持有陰陽符",
      limitText: "每種限選一次（每技能最多 3 種變異）",
      inPool: true
    }
  };

  const DUO_CONFIG = {
    duo_thundercircle: {
      id: "duo_thundercircle",
      skillIds: ["barrier", "thunder"],
      n: "雷紋陣",
      s: "らいもんじん",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "淨化靈陣內落雷引發墨紋衝擊（延遲 0.12 秒、半徑 64）；至多命中 3 敵各一次，總傷害為該次非暴擊雷基傷 20% 分攤（無再派生）",
      beforeText: "落雷",
      afterText: "墨紋衝擊",
      requirementText: "持有淨化靈陣 Lv3+ 與 天狐雷 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；不重新落雷、不聚怪）",
      inPool: true
    },
    duo_inkfire: {
      id: "duo_inkfire",
      skillIds: ["katana", "fire"],
      n: "墨焰斬",
      s: "ぼくえんざん",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）",
      beforeText: "直接斬",
      afterText: "留墨焰",
      requirementText: "持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；每次攻擊有觸發上限、無再派生）",
      inPool: true
    },
    duo_frostseal: {
      id: "duo_frostseal",
      skillIds: ["needle", "boom"],
      n: "寒封符",
      s: "かんぷうふ",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "陰陽符主爆命中帶寒冷目標時給一次受限控場反應（普通怪凍結結束後追擊×0.65持續0.35秒，Boss追擊×0.90持續0.15秒；每cast限1敵、2秒免疫）",
      beforeText: "直投",
      afterText: "寒封",
      requirementText: "持有天狐靈針 Lv3+ 與 陰陽符 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；不重置冰封、Boss受限）",
      inPool: true
    },
    duo_cinderseal: {
      id: "duo_cinderseal",
      skillIds: ["fire", "boom"],
      n: "餘燼符",
      s: "よじんふ",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "陰陽符主爆命中灼燒目標時留下短效餘燼（延遲 0.3 秒、半徑 64、持續 0.8 秒）；至多命中 3 敵各一次，總傷害為該次非暴擊符傷 15% 分攤（無再派生）",
      beforeText: "引爆",
      afterText: "留餘燼",
      requirementText: "持有狐火炎 Lv3+ 與 陰陽符 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；每次引爆限一處、無再派生）",
      inPool: true
    }
  };

  function addDuo(id) {
    const cfg = DUO_CONFIG[id];
    if (!cfg || !cfg.inPool) return false;
    if (buildDuos.includes(id)) return false;
    if (!cfg.skillIds.every(s => (WL[s] || 0) >= 3)) return false;
    buildDuos.push(id);
    buildRevision++;
    return true;
  }

  function removeDuo(id) {
    const idx = buildDuos.indexOf(id);
    if (idx >= 0) {
      buildDuos.splice(idx, 1);
      buildRevision++;
      return true;
    }
    return false;
  }

  function getSkillMutations(skillId, list = buildMutations) {
    if (!Array.isArray(list)) return [];
    return list.filter(id => {
      const cfg = MUTATION_CONFIG[id];
      if (!cfg) return false;
      if (Array.isArray(cfg.skillIds)) return cfg.skillIds.includes(skillId);
      return cfg.skillId === skillId;
    });
  }

  function addMutation(id) {
    const cfg = MUTATION_CONFIG[id];
    if (!cfg || !cfg.inPool) return false;
    if (buildMutations.includes(id)) return false;
    const applicable = Array.isArray(cfg.skillIds) ? cfg.skillIds : [cfg.skillId];
    const owned = applicable.filter(s => (WL[s] || 0) > 0);
    if (owned.length === 0) return false;
    if (owned.some(s => getSkillMutations(s).length >= 3)) return false;
    buildMutations.push(id);
    buildRevision++;
    return true;
  }

  function removeMutation(id) {
    const idx = buildMutations.indexOf(id);
    if (idx >= 0) {
      buildMutations.splice(idx, 1);
      buildRevision++;
      return true;
    }
    return false;
  }

  function addCharm(id) {
    if (!CHARM_CONFIG[id]) return false;
    if (buildCharms.includes(id)) return false;
    if (buildCharms.length >= 3) return false;
    buildCharms.push(id);
    buildRevision++;
    return true;
  }

  function removeCharm(id) {
    const idx = buildCharms.indexOf(id);
    if (idx >= 0) {
      buildCharms.splice(idx, 1);
      buildRevision++;
      return true;
    }
    return false;
  }

  function getEffectiveDmg(buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    const powerBonus = charms.includes("charm_power") ? 0.20 : 0;
    return (b.dmg || 1) + powerBonus;
  }

  function getEffectiveMoveSpeed(buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    const stepBonus = charms.includes("charm_step") ? 28 : 0;
    return 230 + (b.spd || 0) * 35 + stepBonus;
  }

  function getEffectiveMagnetRadius(buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    const gatherBonus = charms.includes("charm_gather") ? 75 : 0;
    return magnetRadius(b.mag) + gatherBonus;
  }

  function getEffectiveRate(buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    const cadenceBonus = charms.includes("charm_cadence") ? 0.25 : 0;
    return (b.rate || 0) + cadenceBonus;
  }

  function getEffectiveReachMultiplier(buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    return charms.includes("charm_reach") ? 1.10 : 1.0;
  }

  function applyFrost(e, now, volley = null) {
    if (e.hp <= 0 || e.shield) return false;
    if (e.freezeReady && e.freezeReady > now) return false;
    if (e.freezeT > 0 && (e.freezeEnds == null || now < e.freezeEnds)) return false;

    const threshold = e.type === "boss" ? 3 : 1;
    e.frostHits = (e.frostHits || 0) + 1;
    if (e.frostHits < threshold) {
      return false;
    }
    e.frostHits = 0;
    return EVOLUTIONS.freeze(e, now, volley);
  }

  function getBuildState() {
    const activeSkills = Object.keys(WI).filter(k => (WL[k] || 0) > 0);
    return {
      schemaVersion: 1,
      activeSkills,
      charms: [...buildCharms],
      mutations: [...buildMutations],
      duos: [...buildDuos]
    };
  }

  function resolveAttackSpec(skillId, lvl, buildState, options = {}) {
    const level = typeof lvl === "number" ? lvl : (WL[skillId] || 0);
    const baseRate = getEffectiveRate(buildState);
    const baseDmg = getEffectiveDmg(buildState);
    const reachMult = getEffectiveReachMultiplier(buildState);
    if (skillId === "katana") {
      const baseReach = 145 + (level - 1) * 16;
      const reach = level === 5 ? baseReach : Math.round(baseReach * reachMult);
      const swingReach = level === 5 ? 720 : reach * 0.85;
      const cooldown = Math.max(0.6, 0.72 - baseRate * 0.13);
      const slashDmg = baseDmg + (level - 1) * 0.8;
      const windDmg = (baseDmg + 3.2) * 1.15;
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasCrosscut = mutations.includes("mut_crosscut");
      const crosscutDmg = Number((slashDmg * 0.60).toFixed(2));
      const crosscutReach = level === 5 ? 220 : Math.round(reach * 0.90);
      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoInkfire = duos.includes("duo_inkfire");
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + critLvl * 0.15);
      return {
        skillId: "katana",
        level,
        isAwakened: level === 5,
        reach,
        swingReach,
        arc: 1.22,
        cooldown,
        slashDmg,
        windDmg,
        maxTravel: 720,
        pierceLimit: 6,
        pierceScaleAfterThree: 0.75,
        source: hasCrosscut ? "mutation" : (hasDuoInkfire ? "duo" : "base"),
        derivationDepth: 0,
        hasCrosscut,
        crosscutDelay: 0.16,
        crosscutDmg,
        crosscutReach,
        crosscutArc: 1.15,
        crosscutAngleOffset: Math.PI * 0.42,
        hasDuoInkfire,
        duoInkfire: hasDuoInkfire ? { delay: 0.12, radius: 56, budgetRate: 0.20, maxTargets: 3 } : null,
        critLvl,
        critChance,
        critMult: 1.8
      };
    }
    if (skillId === "needle") {
      const isAwakened = level === 5;
      const needleFloor = isAwakened ? 0.65 : 0.45;
      const cooldown = Math.max(needleFloor, 1.25 - level * 0.16 - baseRate * 0.1);
      const rawCount = window.EVOLUTIONS?.needleCount ? window.EVOLUTIONS.needleCount(level) : [3, 5, 7, 8, 8][Math.max(0, Math.min(4, level - 1))];
      const speed = 640;
      const rawSpread = isAwakened ? 1.35 : (level === 4 ? 0.65 : 0.45);
      const rawLife = isAwakened ? 0.95 : 0.65;
      const life = Number((rawLife * reachMult).toFixed(4));
      const range = Math.round(440 * reachMult);
      const rawBaseDamage = isAwakened ? 4.9 : (1.4 + level * 0.7);

      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : (buildMutations || []);
      const hasFan = mutations.includes("mut_fan");
      const hasSeek = mutations.includes("mut_seek");
      const hasFrost = mutations.includes("mut_frost");
      const hasPierce = mutations.includes("mut_pierce");
      const hasReturn = mutations.includes("mut_return");

      const count = hasFan ? rawCount + 3 : rawCount;
      const spread = hasFan ? rawSpread + 0.35 : rawSpread;
      const perShotScale = hasFan ? 0.72 : 1.0;
      const baseDamage = Number((rawBaseDamage * perShotScale).toFixed(4));
      const damage = baseDamage * baseDmg;

      const tracking = isAwakened || hasSeek;
      const turnRate = tracking ? (isAwakened ? 4.8 : 4.2) : 0;
      const seekRange = Math.round(480 * reachMult);
      const frost = isAwakened || hasFrost;

      const pierceBonusScale = hasPierce ? 0.15 : 0;
      const maxPierceBonusHits = hasPierce ? 2 : 0;
      const pierceBonusMax = hasPierce ? 0.30 : 0;

      const returnDistance = hasReturn ? Math.min(220, Number((speed * life * 0.40).toFixed(2))) : 0;

      const spec = {
        skillId: "needle",
        level,
        isAwakened,
        source: mutations.length > 0 ? "mutation" : "base",
        count,
        speed,
        spread,
        life,
        range,
        cooldown,
        baseDamage,
        damage,
        tracking,
        frost,
        hasPierce,
        pierceBonusScale,
        maxPierceBonusHits,
        pierceBonusMax,
        hasReturn,
        returnDistance,
        derivation: "none"
      };

      if (hasFan) {
        spec.fan = true;
        spec.perShotScale = perShotScale;
        spec.damageBudget = {
          baseNominal: rawCount * rawBaseDamage * baseDmg,
          totalNominal: count * damage,
          perShotScale
        };
      }
      if (hasSeek) {
        spec.seek = true;
        spec.turnRate = turnRate;
        spec.seekRange = seekRange;
      }
      if (hasFrost) {
        spec.frostThreshold = 1;
        spec.bossFrostThreshold = 3;
      }
      if (hasPierce) {
        spec.pierce = true;
        spec.pierceBonusScale = pierceBonusScale;
        spec.maxPierceBonusHits = maxPierceBonusHits;
        spec.pierceBonusMax = pierceBonusMax;
      }
      if (hasReturn) {
        spec.return = true;
        spec.returnDistance = returnDistance;
      }
      if (mutations.length > 0) {
        spec.mutations = [...mutations];
      }
      return spec;
    }
    if (skillId === "barrier") {
      const isAwakened = level === 5;
      const cooldown = isAwakened
        ? 3.2
        : Math.max(1.2, 3.2 - level * 0.42 - baseRate * 0.2);
      const baseRadius = isAwakened
        ? 220
        : Math.round((140 + level * 28) * reachMult);
      const baseDamage = isAwakened
        ? (2.0 + level * 1.1) * baseDmg * 0.5
        : (baseDmg + (level - 1) * 0.8) * 0.4;
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasPulse = mutations.includes("mut_pulse");
      const pulseCount = hasPulse ? 2 : 1;
      const pulseDelay = 0.18;
      const pulseScale = hasPulse ? 0.50 : 1.0;
      const radius = hasPulse ? Math.round(baseRadius * 0.85) : baseRadius;
      const damage = Number((baseDamage * pulseScale).toFixed(4));
      const fullKnockback = level >= 4 ? 50 + level * 10 : 0;
      const knockback = hasPulse ? Math.round(fullKnockback * 0.50) : fullKnockback;
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.15 + critLvl * 0.10);
      const sanctuary = isAwakened ? { duration: 1.8, radius: 220 } : null;

      return {
        skillId: "barrier",
        level,
        isAwakened,
        source: hasPulse ? "mutation" : "base",
        derivationDepth: 0,
        cooldown,
        baseRadius,
        radius,
        baseDamage,
        damage,
        hasPulse,
        pulseCount,
        pulseDelay,
        pulseScale,
        pulseRadius: radius,
        knockback,
        fullKnockback,
        critLvl,
        critChance,
        critMult: 1.8,
        sanctuary
      };
    }
    if (skillId === "thunder") {
      const isAwakened = level === 5;
      const cooldown = isAwakened
        ? 2.4
        : level === 4
          ? 2.0
          : Math.max(2.0, Number((2.6 - level * 0.35).toFixed(2)));
      const mult = level === 1 ? 2.0 : level === 2 ? 3.0 : level === 3 ? 4.5 : level === 4 ? 6.0 : 8.0;
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const rawRadius = level >= 4 ? 450 : (110 + Math.min(level, 3) * 80);
      const radius = Math.round(rawRadius * reachMult);
      const targetCount = level === 4 ? 3 : (level === 5 ? 3 : level);
      const damage = Number((mult * baseDmg).toFixed(4));
      const cloudRadius = 90;

      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasBranch = mutations.includes("mut_branch");
      const branchCount = hasBranch ? 1 : 0;
      const branchScale = 0.25;
      const branchDamage = Number((damage * branchScale).toFixed(4));
      const branchRadius = Math.round(180 * reachMult);

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : buildDuos;
      const hasDuoThundercircle = duos.includes("duo_thundercircle");

      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + critLvl * 0.15);

      return {
        skillId: "thunder",
        level,
        isAwakened,
        source: hasBranch ? "mutation" : (hasDuoThundercircle ? "duo" : "base"),
        derivationDepth: 0,
        cooldown,
        mult,
        baseDamage: damage,
        damage,
        radius,
        targetCount,
        hasBranch,
        branchCount,
        branchScale,
        branchDamage,
        branchRadius,
        cloudRadius,
        hasDuoThundercircle,
        duoThundercircle: hasDuoThundercircle ? { delay: 0.12, radius: 64, budgetRate: 0.20, maxTargets: 3 } : null,
        critLvl,
        critChance,
        critMult: 1.8
      };
    }
    if (skillId === "fire") {
      const isAwakened = level === 5;
      const count = window.EVOLUTIONS?.fireCount ? window.EVOLUTIONS.fireCount(level) : [1, 2, 3, 3, 3][Math.max(0, Math.min(4, level - 1))];
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasOrbit = mutations.includes("mut_orbit");
      const rx = hasOrbit ? 126 : 98;
      const ry = hasOrbit ? 78 : 98;
      const angularSpeed = 2.8;
      const hitInterval = 0.42;
      const contactDamage = Number(((1.2 + level * 0.6) * baseDmg).toFixed(4));
      const attackCount = window.EVOLUTIONS?.fireAttackCount ? window.EVOLUTIONS.fireAttackCount(level) : [0, 0, 0, 1, 0][Math.max(0, Math.min(4, level - 1))];
      const spiritDamage = Number(((2.1 + (level || 1) * 0.9) * baseDmg).toFixed(4));
      const spiritCooldown = window.EVOLUTIONS?.fireAttackCooldown ? window.EVOLUTIONS.fireAttackCooldown(level) : [2.5, 2.2, 1.9, 1.55, 1.05][Math.max(0, Math.min(4, level - 1))];
      const cooldown = isAwakened ? 7.2 : spiritCooldown;
      const dragonDirectDmg = Number((12 * baseDmg).toFixed(4));
      const dragonSplashDmg = Number((4 * baseDmg).toFixed(4));
      const dragonScorchDmg = Number((1.8 * baseDmg).toFixed(4));
      const scorchDuration = 5;
      const scorchRadius = 140;

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoInkfire = duos.includes("duo_inkfire");
      const hasDuoCinderseal = duos.includes("duo_cinderseal");

      return {
        skillId: "fire",
        level,
        isAwakened,
        source: hasOrbit ? "mutation" : ((hasDuoInkfire || hasDuoCinderseal) ? "duo" : "base"),
        derivationDepth: 0,
        count,
        hasOrbit,
        hasDuoInkfire,
        hasDuoCinderseal,
        rx,
        ry,
        angularSpeed,
        hitInterval,
        contactDamage,
        attackCount,
        spiritDamage,
        spiritCooldown,
        cooldown,
        dragonDirectDmg,
        dragonSplashDmg,
        dragonScorchDmg,
        scorchDuration,
        scorchRadius
      };
    }
    if (skillId === "boom") {
      const isAwakened = level === 5;
      const baseCount = window.EVOLUTIONS?.boomCount ? window.EVOLUTIONS.boomCount(level) : [1, 2, 3, 4, 2][Math.max(0, Math.min(4, level - 1))];
      const cooldown = isAwakened ? 1.6 : Number((2.0 - level * 0.24).toFixed(2));
      const speed = 880;
      const life = 1.4;
      const fuse = 1.5;
      const spread = level >= 4 ? 0.28 : 0.32;
      const baseRadius = [78, 92, 108, 122, 135][Math.max(0, Math.min(4, level - 1))];
      const radius = Math.round(baseRadius * reachMult);
      const rawDamage = 1.5 + level * 0.7;
      const baseDamage = Number((rawDamage * baseDmg).toFixed(4));
      const splashScale = 0.20;
      const baseSplashDamage = Number((baseDamage * splashScale).toFixed(4));
      const knockback = 72;

      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : (buildMutations || []);
      const hasFan = mutations.includes("mut_fan");
      const hasSplitblast = mutations.includes("mut_splitblast");
      const hasSeek = mutations.includes("mut_seek");
      const hasFrost = mutations.includes("mut_frost");
      const tracking = hasSeek;
      const turnRate = hasSeek ? 4.2 : 0;
      const seekRange = Math.round(480 * reachMult);
      const frost = hasFrost;
      const frostThreshold = 1;
      const bossFrostThreshold = 3;

      const count = hasFan ? Math.min(6, baseCount + 2) : baseCount;
      const damage = hasFan ? ((baseDamage * baseCount) / count) : baseDamage;
      const splashDamage = hasFan ? ((baseSplashDamage * baseCount) / count) : baseSplashDamage;

      const splitblastDelay = 0.18;
      const splitblastRadiusScale = 0.55;
      const splitblastRadius = hasSplitblast ? Math.round(radius * splitblastRadiusScale) : 0;
      const splitblastDirectScale = 0.25;
      const splitblastSplashScale = 0.25;
      const splitblastDirectDamage = hasSplitblast
        ? (hasFan ? (damage * splitblastDirectScale) : Number((damage * splitblastDirectScale).toFixed(4)))
        : 0;
      const splitblastSplashDamage = hasSplitblast
        ? (hasFan ? (splashDamage * splitblastSplashScale) : Number((splashDamage * splitblastSplashScale).toFixed(4)))
        : 0;

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoFrostseal = duos.includes("duo_frostseal");
      const hasDuoCinderseal = duos.includes("duo_cinderseal");

      return {
        skillId: "boom",
        level,
        isAwakened,
        source: (hasFan || hasSplitblast || hasSeek || hasFrost) ? "mutation" : ((hasDuoFrostseal || hasDuoCinderseal) ? "duo" : "base"),
        derivationDepth: 0,
        baseCount,
        count,
        cooldown,
        speed,
        life,
        fuse,
        spread,
        baseRadius,
        radius,
        baseDamage: rawDamage,
        damage,
        splashScale,
        splashDamage,
        knockback,
        hasFan,
        fan: hasFan,
        hasSplitblast,
        splitblastDelay,
        splitblastRadiusScale,
        splitblastRadius,
        splitblastDirectScale,
        splitblastSplashScale,
        splitblastDirectDamage,
        splitblastSplashDamage,
        hasSeek,
        seek: hasSeek,
        tracking,
        turnRate,
        seekRange,
        hasFrost,
        frost,
        frostThreshold,
        bossFrostThreshold,
        hasDuoFrostseal,
        duoFrostseal: hasDuoFrostseal ? { slowDuration: 0.35, slowMult: 0.65, bossSlowDuration: 0.15, bossSlowMult: 0.90, immuneDuration: 2.0 } : null,
        hasDuoCinderseal,
        duoCinderseal: hasDuoCinderseal ? { delay: 0.3, radius: 64, life: 0.8, budgetRate: 0.15, maxTargets: 3 } : null,
        mutations: [...mutations]
      };
    }
    return {
      skillId,
      level,
      isAwakened: level === 5,
      source: "base"
    };
  }

  const WI = {
    katana: { id: "katana", jp: "かたな", zh: "妖刀斬", type: "active", category: "方向斬擊", desc: "揮出凌厲新月刀芒，斬裂前方扇形妖怪" },
    barrier: { id: "barrier", jp: "じょうか", zh: "淨化靈陣", type: "active", category: "全方結界", desc: "展開 360 度低傷害除魔陣，Lv4 起可震退周身妖怪" },
    fire: { id: "fire", jp: "きつねび", zh: "狐火炎", type: "active", category: "烈焰火把", desc: "周身飛旋烈焰火把，高速甩擊灼燒貼身妖怪" },
    boom: { id: "boom", jp: "おふだ", zh: "陰陽符", type: "active", category: "延爆咒符", desc: "擲出符咒黏住妖怪，稍後爆炸；周圍受到濺射並震退" },
    thunder: { id: "thunder", jp: "いかずち", zh: "天狐雷", type: "active", category: "天罰落雷", desc: "固定係數落雷。Lv4 鎖定三個威脅，覺醒為三朵雷雲，不依生命秒殺" },
    needle: { id: "needle", jp: "せんぼん", zh: "天狐靈針", type: "active", category: "高速靈針", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪" }
  };

  const WEAPON_UPGRADES = {
    katana:["暖光單刃，斬擊前方妖怪","雙刃交叉，距離 +16、傷害 +0.8","三刃收束，距離與傷害再提升","蓄風四刃；下一階射出穿透風刃","覺醒・斷空殘月斬：世界距離 720、最多 6 體，前三全傷其後 ×0.75，冷卻下限 0.6 秒"],
    barrier:["展開單盤除魔陣，低傷害全方位攻擊","雙盤刻印，範圍擴大、傷害小幅提升","反轉雙盤，範圍與傷害再提升","蓄勢大陣，半徑 252，命中可震退敵人","覺醒・金剛退魔曼荼羅：半徑縮為 220，換 1.8 秒地面緩速；不回油、不聚怪"],
    fire:["一顆狐火環繞護身，僅接觸周遭妖怪","兩顆狐火環繞護身，不主動飛出","三顆狐火環繞護身，不主動飛出","三顆護火，其中一顆離體追敵後回歸","覺醒・墨焰黑龍：三顆護火，每 7.2 秒一條黑龍（露臉 1.5 秒＋退場後 5 秒）；不再離體。每次三球、五秒焦土最多三處"],
    boom:["單符黏附後延遲爆炸；本體全傷，周圍濺射並震退","一次擲出 2 枚符咒","三符齊射，冷卻縮短","四符齊射，爆炸範圍加大","覺醒・兩儀延爆：兩枚符咒，爆炸範圍最大"],
    thunder:["190 範圍內攻擊最近 1 隻，傷害 2 倍係數","270 範圍內同時攻擊 2 隻，傷害 3 倍係數","350 範圍內同時攻擊 3 隻，傷害 4.5 倍係數，不依生命秒殺","450 範圍內鎖定 3 個威脅，固定 6 倍係數","覺醒・建御雷神破界天罰：450 範圍內三朵雷雲，每朵半徑 90、8 倍係數"],
    needle:["三發靈針，貫穿前方妖怪","五發雙羽，傷害提升","七發三叉，傷害再提升","八星噴射；下一階弧線射出","覺醒・九尾極寒靈暴：八發追蹤冰針，單層殉爆最多再命中 3 隻，不連鎖"]
  };

  let proj = [], needles = [], winds = [], ghosts = [], dragonShots = [], dragonScorches = [], crosscuts = [], barrierPulses = [], sacredSanctuary = null, splitblasts = [], duoShockwaves = [], inkfireMarks = [], surgeT = SURGE_FIRST, fAng = 0, fireEmitT = 0, fireSfxT = 0, fireAttackT = 0;
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
      t.y -= 22 / tiltK();
    }
    texts.push({ v, x, y, c, life: injury ? 1.12 : 1.8, injury });
  };
  const burst = (x, y, c, n = 16) => FX.burst(x, y, c, n);

  function nextDeliveryEventId(word) {
    deliveryEventSeq += 1;
    const key = window.CARD_COLLECTION && typeof window.CARD_COLLECTION.wordKey === "function"
      ? window.CARD_COLLECTION.wordKey(word && word.jp)
      : (word && word.jp) || "word";
    return `delivery:${STAGE.id}:${key}:${deliveryEventSeq}`;
  }

  function stampDeliveryCard(job, pos) {
    const api = window.CARD_DELIVERY;
    if (!api || typeof api.openCards !== "function" || !job || !job.word || !job.cardEventId) return;
    try {
      const bag = api.openCards(localStorage, location);
      const before = bag.marks(job.word.jp);
      const result = bag.record({ id: job.cardEventId, jp: job.word.jp, kind: "delivery", ok: true });
      if (result && result.persisted === false && pos) say("印記尚未寫入本機", pos.x, pos.y - 78, "#efe2ff");
      if (result && result.newAwards && result.newAwards.length && pos) {
        const names = result.newAwards.map(id => {
          const pack = window.CONTENT && window.CONTENT.WORD_PACKS && window.CONTENT.WORD_PACKS[id];
          return pack && pack.name || id;
        }).join("、");
        say(`套卡已集齊・${names}${result.persisted === false ? "・尚未寫入本機" : ""}`, pos.x, pos.y - 96, "#efe2ff");
      }
      if (result && result.applied && result.reason === "success" && before < 4 && bag.marks(job.word.jp) >= 4 && pos) {
        say(`${job.word.jp}・言靈齊印 4/4`, pos.x, pos.y - 58, "#efe2ff");
      }
    } catch {
      // 印記寫不進磁碟時，這一單仍然算送達。
    }
  }

  function makeOrder() {
    const orderCap = CFG.orderSlots(elapsed, delivered);
    if (orders.length >= orderCap) return;
    const busy = new Set(orders.map(o => o.from.id));
    const nearbyHouses = houses.filter(h => dist(P, h) < 1400);
    const candidateHouses = nearbyHouses.length >= 4 ? nearbyHouses : houses.filter(h => dist(P, h) < 2200);
    if (!candidateHouses.length) return;

    // 1. 場上活著的誤配妖所代表的詞（妖還在時以戰鬥擊殺複習為主，不發重複委託避免照名牌選答案）
    const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));

    // 2. 當前委託欄與手上包裹已佔用的詞
    const activeOrderWords = new Set(orders.map(o => o.word.jp));
    if (job && job.word) activeOrderWords.add(job.word.jp);

    // 配送委託只看言靈圖鑑。Boss、護符聽題與熟練度仍走原來的 Study。
    let chosenWord = null;
    const cardApi = window.CARD_DELIVERY;
    if (cardApi && typeof cardApi.choose === "function") {
      let picked = null;
      try {
        picked = window.CARD_DELIVERY.choose(ALL, [...livingMisWords, ...activeOrderWords], Math.random);
      } catch {
        return;
      }
      if (!picked || !picked.word) return;
      chosenWord = picked.word;
    } else {
      const priorityMissed = ALL.filter(w => {
        const m = STORE.get(w.jp);
        return (m.missBoost || 1) > 1 && !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp);
      });
      chosenWord = typeof study?.pick === "function" ? study.pick(elapsed, [...livingMisWords, ...activeOrderWords]) : null;
      if (study && typeof study.pick === "function" && !chosenWord) return;
      if (!chosenWord && priorityMissed.length > 0) {
        chosenWord = pick(priorityMissed);
      } else if (!chosenWord) {
        let pool = ALL.filter(w => !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp));
        if (pool.length === 0) pool = ALL.filter(w => !livingMisWords.has(w.jp));
        if (pool.length === 0) pool = ALL;
        chosenWord = STORE.pick(pool);
      }
    }

    // 詞先決定，再盡量送到教同一個詞的町屋；沒有對應房子時仍用這個詞。
    const openHouses = candidateHouses.filter(h => !busy.has(h.id));
    const matching = openHouses.filter(h => h.word && h.word.jp === chosenWord.jp);
    const from = pick(matching.length ? matching : openHouses);
    if (!from) return;
    // 最低合理分隔提升至 580px，合理上限 1250px，確保取件→送達平均路程明顯拉高且不致過度漂移
    const reachable = houses.filter(h => h !== from && dist(h, from) >= 580 && dist(h, from) <= 1250);
    const pool = reachable.length ? reachable : houses.filter(h => h !== from && dist(h, from) >= 420 && dist(h, from) <= 1600);
    if (!pool.length) return;

    // 分隔層級：中長程（850–1250px，約 70%）與近路捷徑（580–850px，約 30%）
    const far = pool.filter(h => dist(h, from) >= 850);
    const near = pool.filter(h => dist(h, from) < 850);
    let to = null;
    if (Math.random() < 0.30 && near.length > 0) {
      to = pick(near);
    } else if (far.length > 0) {
      to = pick(far);
    } else {
      to = pick(pool);
    }
    if (!to || !chosenWord) return;
    orders.push({ from, to, word: chosenWord, rev: false, life: 110, cardEventId: nextDeliveryEventId(chosenWord) });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      AUDIO.stopSpeech();
      RENDERER.clearShake();
      keys.clear(); heldCodes.clear();
      joy = null;
      window.dispatchEvent(new Event('gamepause'));
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
    // A journey map is intentionally browsable in portrait. Only active combat requires rotation.
    if (document.body?.dataset) document.body.dataset.gameScreen = "map";
  }

  function moveOverworld(dx, dy) {
    if (state !== "overworld" || artPending()) return false;
    return window.OVERWORLD.move(overworld, dx, dy);
  }

  function confirmOverworld() {
    if (state !== "overworld") return;
    if (artPending()) {
      const selected = window.OVERWORLD.selectedNode(overworld);
      if (selected && window.OVERWORLD.isEnterable(selected) && selected.id === overworld.currentId) {
        AUDIO.prepareMusic?.('play');
        pendingDepart = true;
      }
      return;
    }
    const selected = window.OVERWORLD.selectedNode(overworld);
    if (selected.id !== overworld.currentId) {
      if (window.OVERWORLD.isEnterable(selected)) {
        if (!window.OVERWORLD.moveTo(overworld, selected.id)) {
          overworldNoticeT = 1.5;
          AUDIO.warningPulse?.(1);
        }
      } else {
        overworldNoticeT = 1.5;
        AUDIO.warningPulse?.(1);
      }
      return;
    }
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
    window.loadStageMapArt?.(stageId);
    configureStage(stageId);
    if (STAGE.id === "rain-port") window.refreshPortArt?.();
    if (STAGE.id === "sakura-pass") {
      window.refreshSakuraArt?.();
      window.refreshSakuraScene?.();
    }
    AUDIO.init();
    // 單字與音效於實際播放時載入，避免與進關必要圖像爭用網路。
    state = "play";
    tutorial = null;
    keys.clear(); heldCodes.clear(); joy = null; gpMove = { x: 0, y: 0 };
    Object.assign(P, { x: START.x, y: START.y, inv: 1.2, faceAng: 0, faceX: 1 });
    Object.assign(b, { dmg: 1.2, rate: 0, mag: 0, dash: 0, shield: 0, spd: 0, crit: 0, oilRegen: 0, dmgUp: 0, heals: 0 });
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0 });
    buildRevision++;
    buildMutations = [];
    buildCharms = [];
    buildDuos = [];
    proj = []; needles = []; winds = []; ghosts = []; dragonShots = []; dragonScorches = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; splitblasts = []; duoShockwaves = []; inkfireMarks = []; enemyBullets = []; surgeT = SURGE_FIRST; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1;
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
    ended = false; bossQ = null; bossSealBreak = null; orderT = 5; spawnT = 8; atkT = 0.3; dashT = 0; dashCd = 0; hintT = 0; nameT = 0; endCooldown = 0; lanternHitT = 0; playerAttackPoseT = playerHurtPoseT = 0;
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
    RENDERER.setCam(P.x - W / 2, P.y - H / (2 * tiltK()));
    checkTutorial();
  }

  const xpNeed = () => Math.round(CFG.xpNeed(level) * XP_NEED_SCALE);
  const MAX_ACTIVE_WEAPONS = 4;

  function getEligibleChoices() {
    const scopeRevision = buildRevision;
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
      let consumed = false;
      const isNew = WL[k] === 0;
      const descList = WEAPON_UPGRADES[k] || [];
      const descText = descList[nextLvl - 1] || WI[k].desc;
      const choiceId = `weapon:${k}:${nextLvl}`;

      const checkWeaponEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        if (nextLvl === 5) return seals > 0 && WL[k] === 4;
        if (WL[k] === 0) return Object.keys(WI).filter(key => (WL[key] || 0) > 0).length < MAX_ACTIVE_WEAPONS;
        return (WL[k] || 0) + 1 === nextLvl && nextLvl <= 5;
      };

      const applyWeaponEffect = () => {
        if (!checkWeaponEligibility()) return false;
        consumed = true;
        if (nextLvl === 5) seals--;
        WL[k] = nextLvl;
        window.useSkillArt?.(k, WL[k]);
        if (k === "katana") { wT.katana = 0; atkT = 0; }
        if (k === "boom") wT.boom = 0;
        if (k === "barrier") wT.barrier = 0;
        if (k === "needle") wT.needle = 0;
        if (k === "fire" || k === "thunder") wT[k] = 0;
        if (k === "fire" && WL[k] === 5) AUDIO.preloadDragon?.();
        return true;
      };

      return {
        id: k,
        choiceId,
        type: "weapon",
        n: WI[k].zh,
        s: WI[k].jp,
        cat: `【 ${WI[k].category} 】`,
        levelText: isNew ? "★ 新解鎖" : nextLvl === 5 ? "Lv5 覺醒" : `◆ 等級 ${WL[k]} ➔ ${nextLvl}`,
        rarity: isNew ? "new" : nextLvl >= 5 ? "max" : "up",
        lv: nextLvl,
        d: nextLvl === 5 ? `${descText}（覺醒・耗 1 印）` : descText,
        revision: scopeRevision,
        ok: checkWeaponEligibility,
        f: applyWeaponEffect
      };
    };
    const wc = shuffle(eligibleWeaponKeys).map(k => weaponCard(k, WL[k] + 1));
    const awakenCard = awakenKeys.length ? weaponCard(shuffle(awakenKeys)[0], 5) : null;

    const pc = shuffle(UP.filter(u => !u.ok || u.ok())).map(u => {
      let consumed = false;
      const choiceId = `passive:${u.id}`;
      const checkPassiveEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        return !u.ok || u.ok();
      };
      const applyPassiveEffect = () => {
        if (!checkPassiveEligibility()) return false;
        consumed = true;
        u.f();
        return true;
      };
      return {
        id: u.id,
        choiceId,
        type: "passive",
        n: u.n,
        s: u.s,
        cat: `【 ${u.cat} 】`,
        levelText: "◆ 體質修行",
        rarity: "passive",
        d: u.d,
        revision: scopeRevision,
        ok: checkPassiveEligibility,
        f: applyPassiveEffect
      };
    });

    // 變異選項：每技能最多 3 個變異；已持有至少一個適用武器，且所有已持有適用技能均未滿 3 個
    const eligibleMutationKeys = Object.keys(MUTATION_CONFIG).filter(mutId => {
      const cfg = MUTATION_CONFIG[mutId];
      if (!cfg || !cfg.inPool) return false;
      if (buildMutations.includes(mutId)) return false;
      const applicable = Array.isArray(cfg.skillIds) ? cfg.skillIds : [cfg.skillId];
      const owned = applicable.filter(s => (WL[s] || 0) > 0);
      if (owned.length === 0) return false;
      return owned.every(s => getSkillMutations(s).length < 3);
    });

    const mutationCard = (mutId) => {
      let consumed = false;
      const meta = MUTATION_CONFIG[mutId];
      const skillId = meta.skillId;
      const choiceId = `mutation:${skillId}:${mutId}`;
      const applicable = Array.isArray(meta.skillIds) ? meta.skillIds : [skillId];
      const owned = applicable.filter(s => (WL[s] || 0) > 0);

      let cardName = meta.n;
      let cardCat = meta.cat;
      let cardLevelText = meta.levelText;
      let cardReq = meta.requirementText;
      let cardDesc = meta.d;

      if (mutId === "mut_fan") {
        const hasNeedle = owned.includes("needle");
        const hasBoom = owned.includes("boom");
        if (hasNeedle && !hasBoom) {
          cardName = "靈針・千本散射";
          cardCat = "【 靈針變異 】";
          cardLevelText = "◆ 靈針變異";
          cardReq = "持有天狐靈針（取得陰陽符後亦適用）";
          cardDesc = "朝向多角度散射，發數增加且散射角擴大；單發傷害分配受限（每次施放總傷害預算上限控管）";
        } else if (!hasNeedle && hasBoom) {
          cardName = "陰陽符・千本散射";
          cardCat = "【 陰陽符變異 】";
          cardLevelText = "◆ 陰陽符變異";
          cardReq = "持有陰陽符（取得天狐靈針後亦適用）";
          cardDesc = "朝向多角度散射，陰陽符發數增加（+2、最多 6 發）；每符傷害按發數比例分攤，保持每次施放總傷害預算上限";
        } else if (hasNeedle && hasBoom) {
          cardName = "千本散射";
          cardCat = "【 共享變異 】";
          cardLevelText = "◆ 共享變異";
          cardReq = "持有天狐靈針或陰陽符（同時生效，後續取得亦適用）";
          cardDesc = "朝向多角度散射，靈針與陰陽符發數增加；單發傷害按發數比例分攤，共享每次施放總傷害預算控管";
        }
      } else if (mutId === "mut_seek") {
        const hasNeedle = owned.includes("needle");
        const hasBoom = owned.includes("boom");
        if (hasNeedle && !hasBoom) {
          cardName = "靈針・引魂追跡";
          cardCat = "【 靈針變異 】";
          cardLevelText = "◆ 靈針變異";
          cardReq = "持有天狐靈針（取得陰陽符後亦適用）";
          cardDesc = "靈針具備轉向角速率平滑追蹤妖怪，失去目標後沿當前方向直行（非瞬移）";
        } else if (!hasNeedle && hasBoom) {
          cardName = "陰陽符・引魂追跡";
          cardCat = "【 陰陽符變異 】";
          cardLevelText = "◆ 陰陽符變異";
          cardReq = "持有陰陽符（取得天狐靈針後亦適用）";
          cardDesc = "未黏附陰陽符具備轉向角速率平滑追蹤妖怪，失去目標後沿當前方向直行（非瞬移）";
        } else if (hasNeedle && hasBoom) {
          cardName = "引魂追跡";
          cardCat = "【 共享變異 】";
          cardLevelText = "◆ 共享變異";
          cardReq = "持有天狐靈針或陰陽符（同時生效，後續取得亦適用）";
          cardDesc = "靈針與未黏附陰陽符具備轉向角速率平滑追蹤妖怪，失去目標後沿當前方向直行（非瞬移）";
        }
      } else if (mutId === "mut_frost") {
        const hasNeedle = owned.includes("needle");
        const hasBoom = owned.includes("boom");
        if (hasNeedle && !hasBoom) {
          cardName = "靈針・冰魄封靈";
          cardCat = "【 靈針變異 】";
          cardLevelText = "◆ 靈針變異";
          cardReq = "持有天狐靈針（取得陰陽符後亦適用）";
          cardDesc = "命中累積寒冷並短暫冰封；Boss 具備高寒冷門檻與 2.0 秒抗性免疫期（不被永久失能）";
        } else if (!hasNeedle && hasBoom) {
          cardName = "陰陽符・冰魄封靈";
          cardCat = "【 陰陽符變異 】";
          cardLevelText = "◆ 陰陽符變異";
          cardReq = "持有陰陽符（取得天狐靈針後亦適用）";
          cardDesc = "主爆命中累積寒冷並短暫冰封（次爆不累寒）；Boss 具備高寒冷門檻與 2.0 秒抗性免疫期（不被永久失能）";
        } else if (hasNeedle && hasBoom) {
          cardName = "冰魄封靈";
          cardCat = "【 共享變異 】";
          cardLevelText = "◆ 共享變異";
          cardReq = "持有天狐靈針或陰陽符（同時生效，後續取得亦適用）";
          cardDesc = "靈針命中與陰陽符主爆累積寒冷並短暫冰封；Boss 具備高寒冷門檻與 2.0 秒抗性免疫期（不被永久失能）";
        }
      }

      const checkMutationEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        if (!meta || !meta.inPool) return false;
        if (buildMutations.includes(mutId)) return false;
        const currentOwned = applicable.filter(s => (WL[s] || 0) > 0);
        if (currentOwned.length === 0) return false;
        return currentOwned.every(s => getSkillMutations(s).length < 3);
      };

      const applyMutationEffect = () => {
        if (!checkMutationEligibility()) return false;
        consumed = true;
        buildMutations.push(mutId);
        return true;
      };

      return {
        id: mutId,
        choiceId,
        type: "mutation",
        skillId: owned.length === 1 ? owned[0] : skillId,
        skillIds: owned.length > 0 ? [...owned] : [...applicable],
        n: cardName,
        s: meta.s,
        cat: cardCat,
        levelText: cardLevelText,
        rarity: "mutation",
        d: cardDesc,
        requirementText: cardReq,
        limitText: meta.limitText,
        revision: scopeRevision,
        ok: checkMutationEligibility,
        f: applyMutationEffect
      };
    };

    const mc = shuffle(eligibleMutationKeys).map(id => mutationCard(id));

    // 御守選項：等級達 2 以上、御守未滿 3 個
    const eligibleCharmKeys = (level >= 2 && buildCharms.length < 3)
      ? Object.keys(CHARM_CONFIG).filter(id => CHARM_CONFIG[id].inPool && !buildCharms.includes(id))
      : [];

    const charmCard = (charmId) => {
      let consumed = false;
      const meta = CHARM_CONFIG[charmId];
      const choiceId = `charm:${charmId}`;

      const checkCharmEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        if (!meta || !meta.inPool) return false;
        if (buildCharms.includes(charmId)) return false;
        return buildCharms.length < 3;
      };

      const applyCharmEffect = () => {
        if (!checkCharmEligibility()) return false;
        consumed = true;
        buildCharms.push(charmId);
        return true;
      };

      return {
        id: charmId,
        choiceId,
        type: "charm",
        n: meta.n,
        s: meta.s,
        cat: meta.cat,
        levelText: meta.levelText,
        rarity: "charm",
        d: meta.d,
        requirementText: meta.requirementText,
        limitText: meta.limitText,
        revision: scopeRevision,
        ok: checkCharmEligibility,
        f: applyCharmEffect
      };
    };

    const cc = shuffle(eligibleCharmKeys).map(id => charmCard(id));

    // 共鳴選項：兩技能均持有且至少 Lv3，每組限選一次，其他 Duo 未啟用
    const eligibleDuoKeys = Object.keys(DUO_CONFIG).filter(duoId => {
      const cfg = DUO_CONFIG[duoId];
      if (!cfg || !cfg.inPool) return false;
      if (buildDuos.includes(duoId)) return false;
      return cfg.skillIds.every(s => (WL[s] || 0) >= 3);
    });

    const duoCard = (duoId) => {
      let consumed = false;
      const meta = DUO_CONFIG[duoId];
      const choiceId = `duo:${duoId}`;

      const checkDuoEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        if (!meta || !meta.inPool) return false;
        if (buildDuos.includes(duoId)) return false;
        return meta.skillIds.every(s => (WL[s] || 0) >= 3);
      };

      const applyDuoEffect = () => {
        if (!checkDuoEligibility()) return false;
        consumed = true;
        buildDuos.push(duoId);
        return true;
      };

      return {
        id: duoId,
        choiceId,
        type: "duo",
        skillIds: [...meta.skillIds],
        n: meta.n,
        s: meta.s,
        cat: meta.cat,
        levelText: meta.levelText,
        rarity: "duo",
        d: meta.d,
        beforeText: meta.beforeText,
        afterText: meta.afterText,
        requirementText: meta.requirementText,
        limitText: meta.limitText,
        revision: scopeRevision,
        ok: checkDuoEligibility,
        f: applyDuoEffect
      };
    };

    const dc = shuffle(eligibleDuoKeys).map(id => duoCard(id));

    let result = [];
    if (awakenCard) {
      const restPool = shuffle([...wc.slice(0, 2), ...mc.slice(0, 2), ...cc.slice(0, 2), ...dc.slice(0, 2), ...pc.slice(0, 2)]);
      const rest = restPool.slice(0, 2);
      if (mc.length > 0 && !rest.some(card => card.type === "mutation") && rest.length > 0) {
        rest[rest.length - 1] = mc[0];
      }
      if (cc.length > 0 && !rest.some(card => card.type === "charm")) {
        const nonMutIdx = rest.findIndex(c => c.type !== "mutation");
        if (nonMutIdx >= 0) {
          rest[nonMutIdx] = cc[0];
        } else if (rest.length < 2) {
          rest.push(cc[0]);
        }
      }
      result = shuffle([awakenCard, ...rest]);
      if (!result.some(card => card.lv === 5)) result[result.length - 1] = awakenCard;
      result = result.slice(0, 3);
    } else {
      const pool = [];
      if (wc.length > 0) pool.push(...wc.slice(0, 2));
      if (mc.length > 0) pool.push(...mc.slice(0, 2));
      if (cc.length > 0) pool.push(...cc.slice(0, 2));
      if (dc.length > 0) pool.push(...dc.slice(0, 2));
      if (pc.length > 0) pool.push(...pc.slice(0, 2));
      result = shuffle(pool).slice(0, 3);
      if (mc.length > 0 && !result.some(card => card.type === "mutation")) {
        result[result.length - 1] = mc[0];
      }
      if (cc.length > 0 && !result.some(card => card.type === "charm")) {
        const nonMutIdx = result.findIndex(c => c.type !== "mutation");
        if (nonMutIdx >= 0) {
          result[nonMutIdx] = cc[0];
        } else if (result.length < 3) {
          result.push(cc[0]);
        }
      }
    }
    return result;
  }

  function offerUp() {
    if (state !== "play" && state !== "levelup") return;
    buildRevision++;
    choices = getEligibleChoices();

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

  function applyChoice(choiceId, revision) {
    if (state !== "levelup") return { ok: false, reason: "not_in_levelup" };
    if (levelupCooldown > 0) return { ok: false, reason: "cooldown_active" };
    if (typeof revision !== "number" || revision !== buildRevision) {
      return { ok: false, reason: "stale_revision" };
    }

    let idx = -1;
    if (typeof choiceId === "number") {
      idx = choiceId >= 0 && choiceId < choices.length ? choiceId : -1;
    } else if (typeof choiceId === "string") {
      idx = choices.findIndex(c => c.choiceId === choiceId || c.id === choiceId);
    }
    if (idx < 0 || !choices[idx]) return { ok: false, reason: "invalid_choice_id" };

    const choice = choices[idx];
    if (typeof choice.ok === "function" && !choice.ok()) {
      return { ok: false, reason: "ineligible" };
    }

    const req = xpNeed();
    const applied = choice.f();
    if (applied === false) {
      return { ok: false, reason: "ineligible" };
    }
    xp = Math.max(0, xp - req);
    level++;
    buildRevision++;
    state = "play";
    P.inv = 0.6;
    say(`獲得：${choice.n}`, P.x, P.y - 45, "#ffe9a0");
    if (choice.lv === 5) {
      say(`${choice.n}・覺醒！`, P.x, P.y - 75, "#b8f2df");
      AUDIO.fanfare();
    }
    FX.levelUp(P.x, P.y);
    return { ok: true, revision: buildRevision, level, id: choice.id };
  }

  function pickUp(i) {
    if (state !== "levelup" || levelupCooldown > 0 || !choices[i]) return;
    return applyChoice(i, buildRevision);
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
      cardEventId: o.cardEventId,
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
      stampDeliveryCard(j, pos);
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
        const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
        if (story && story.delivery && (delivered === 1 || delivered % 3 === 0)) {
          say(story.delivery, pos.x, pos.y - 56, "#d2f0ff");
        }
      }
      xp += CFG.DELIVERY_XP;
      study?.seen?.(j.word);
      FX.deliver(pos.x, pos.y);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
      HAPTICS.deliverSuccess();
      if (checkVictoryCondition()) startVictorySequence();
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
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return false;
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
    const hasGuard = buildCharms.includes("charm_guard");
    const actualDamage = hasGuard
      ? Math.min(amount, Math.max(Number.MIN_VALUE, parseFloat((amount * 0.90).toPrecision(12))))
      : amount;
    oil -= actualDamage;
    lanternHitT = 0.42;
    P.inv = 1;
    playerHurtPoseT = 0.44; // +0.2 秒視覺時間，無敵與碰撞不變
    RENDERER.triggerShake(10);
    burst(P.x, P.y, "#ff6b81", 18);
    let hurtText = label;
    if (!hurtText) {
      hurtText = `受創・燈油 −${actualDamage}`;
    } else if (/[−-]\s*\d+(?:\.\d+)?/.test(hurtText)) {
      hurtText = hurtText.replace(/[−-]\s*\d+(?:\.\d+)?/, `−${actualDamage}`);
    } else {
      hurtText = `${hurtText}・燈油 −${actualDamage}`;
    }
    say(hurtText, P.x, P.y - 36, "#cb6e60");
    AUDIO.hurt();
    HAPTICS.damage();
    if (oil <= 0) {
      oil = 0;
      if (checkVictoryCondition()) startVictorySequence();
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
    e.freezeT = 0; delete e.shatterVolley; e.frostHits = 0;

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
      const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
      const bTitle = e.title || story?.bossTitle || "大妖鬼";
      say(e.final ? `夜明けの${bTitle} 撃破！` : `${bTitle}擊破！燈油 +${reward}`, e.x, e.y - 65, "#ffe9a0");
      if (!e.final) RENDERER.triggerShake(14); // 最終 Boss 由收尾演出處理，不震動整個畫面
      for (let k = 0; k < 8; k++) {
        dropGem(e.x + (Math.random() - 0.5) * 70, e.y + (Math.random() - 0.5) * 70, 6);
      }
      // 不再誤將擊殺視為單字掌握 STORE.rec
      if (e.final && checkVictoryCondition()) startVictorySequence();
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
    if (checkVictoryCondition()) {
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
    winds = []; ghosts = []; proj = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; dragonShots = []; dragonScorches = []; splitblasts = []; duoShockwaves = []; inkfireMarks = [];
    AUDIO.fadeOutMusic(700);
    window.dispatchEvent(new Event('gamepause'));
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
    winds = []; ghosts = []; proj = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; dragonShots = []; dragonScorches = []; splitblasts = []; duoShockwaves = []; inkfireMarks = [];
    gems = [];
    keys.clear(); heldCodes.clear();
    joy = null;
    bossQ = null;
    job = null;
    orders = [];
    inter = null;
    enemyBullets = [];
    RENDERER.clearShake(); // 演出期間不震動整個畫面，只有 Boss 自己抖
    AUDIO.thunder();
    window.dispatchEvent(new Event('gamepause'));
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
      AUDIO.stopBossMusic?.();
      endCooldown = 0.8;
    }
  }

  function pollGamepad() {
    if ((isPortrait() && state !== "overworld" && state !== "menu") || document.hidden) {
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
      else if (justPressed(1) || justPressed(9)) { if (quitConfirm) activateMenu('exit-cancel'); else if (state === 'pause') togglePause(); else if (state === 'won' || state === 'lost') activateMenu('menu'); }
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
      if (bs.final) AUDIO.startBossMusic?.();
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

  // R5 實測候選，尚未定案。延遲另一候選是 2 秒，只改 BOOM_FUSE。
  const BOOM_FUSE = 1.5;
  const BOOM_SPLASH = 0.2;
  const BOOM_KNOCK = 72;
  const BOOM_RADIUS = [78, 92, 108, 122, 135];
  const boomRadius = rank => Math.round(BOOM_RADIUS[Math.max(0, Math.min(4, (rank | 0) - 1))] * getEffectiveReachMultiplier());
  const boomFullDamage = rank => (1.5 + rank * 0.7) * getEffectiveDmg();
  function boomTargetLive(q) {
    const e = q.target;
    return !!(e && e.hp > 0 && enemies.includes(e));
  }
  function explodeTalisman(q) {
    if (q.exploded || q.done) return;
    q.exploded = true;
    q.done = true;
    const rank = q.level ?? WL.boom;
    const radius = q.radius ?? boomRadius(rank);
    const full = q.damage ?? boomFullDamage(rank);
    const splash = q.splashDamage ?? Number((full * BOOM_SPLASH).toFixed(4));
    const knock = q.knockback ?? BOOM_KNOCK;
    const primary = q.target;
    const primaryLive = !!(primary && primary.hp > 0 && enemies.includes(primary));
    SKILLFX.play("boom", "hit", rank, { x: q.x, y: q.y, r: radius, target: primaryLive ? primary : null, evolved: rank === 5 });
    if (typeof AUDIO.ofudaBurst === "function") AUDIO.ofudaBurst(rank);
    RENDERER.triggerShake(rank === 5 ? 5 : 3);
    let harmed = false;
    const castState = q.castState || (q.castState = { frostsealUsed: false, cinderUsed: false });
    if (primaryLive) {
      const primaryCold = !primary.shield && !primary.vanish && !primary.done && ((primary.frostHits > 0) || (primary.freezeEnds && primary.freezeEnds > elapsed));
      const primaryBurned = !primary.shield && !primary.vanish && !primary.done && !!(primary.fireBurnEnds && primary.fireBurnEnds > elapsed);
      const before = primary.hp;
      hurt(primary, full);
      if (primary.hp < before) {
        harmed = true;
        if (q.hasDuoFrostseal && !castState.frostsealUsed && primaryCold && primary.hp > 0 && !primary.vanish && !primary.done) {
          if (!primary.frostsealImmuneEnds || elapsed >= primary.frostsealImmuneEnds) {
            castState.frostsealUsed = true;
            primary.frostsealImmuneEnds = elapsed + 2.0;
            if (primary.type === "boss") {
              primary.frostsealSlowEnds = elapsed + 0.15;
              primary.frostsealSlowMult = 0.90;
            } else {
              const freezeActive = primary.freezeEnds && primary.freezeEnds > elapsed;
              primary.frostsealSlowEnds = (freezeActive ? primary.freezeEnds : elapsed) + 0.35;
              primary.frostsealSlowMult = 0.65;
            }
            SKILLFX.play("boom", "hit", rank, { x: primary.x, y: primary.y, r: 40, frostseal: true });
          }
        }
        if (q.hasDuoCinderseal && !castState.cinderUsed && primaryBurned) {
          castState.cinderUsed = true;
          if (dragonScorches.length < 3) {
            dragonScorches.push({
              x: primary.x,
              y: primary.y,
              life: 0.8,
              maxLife: 0.8,
              r: 64,
              delay: 0.3,
              birthFrame: true,
              isCinder: true,
              damageBudget: Number((full * 0.15).toFixed(4)),
              ticked: false
            });
            SKILLFX.play("fire", "hit", 5, { x: primary.x, y: primary.y, cinder: true });
          }
        }
        if (q.frost && primary.hp > 0) {
          applyFrost(primary, elapsed, null);
        }
      }
    }
    for (const e of enemies) {
      if (e === primary || e.hp <= 0 || dist(e, q) > radius) continue;
      const eCold = !e.shield && !e.vanish && !e.done && ((e.frostHits > 0) || (e.freezeEnds && e.freezeEnds > elapsed));
      const eBurned = !e.shield && !e.vanish && !e.done && !!(e.fireBurnEnds && e.fireBurnEnds > elapsed);
      const before = e.hp;
      hurt(e, splash);
      knockback(e, knock, q);
      if (e.hp < before) {
        harmed = true;
        if (q.hasDuoFrostseal && !castState.frostsealUsed && eCold && e.hp > 0 && !e.vanish && !e.done) {
          if (!e.frostsealImmuneEnds || elapsed >= e.frostsealImmuneEnds) {
            castState.frostsealUsed = true;
            e.frostsealImmuneEnds = elapsed + 2.0;
            if (e.type === "boss") {
              e.frostsealSlowEnds = elapsed + 0.15;
              e.frostsealSlowMult = 0.90;
            } else {
              const freezeActive = e.freezeEnds && e.freezeEnds > elapsed;
              e.frostsealSlowEnds = (freezeActive ? e.freezeEnds : elapsed) + 0.35;
              e.frostsealSlowMult = 0.65;
            }
            SKILLFX.play("boom", "hit", rank, { x: e.x, y: e.y, r: 40, frostseal: true });
          }
        }
        if (q.hasDuoCinderseal && !castState.cinderUsed && eBurned) {
          castState.cinderUsed = true;
          if (dragonScorches.length < 3) {
            dragonScorches.push({
              x: e.x,
              y: e.y,
              life: 0.8,
              maxLife: 0.8,
              r: 64,
              delay: 0.3,
              birthFrame: true,
              isCinder: true,
              damageBudget: Number((full * 0.15).toFixed(4)),
              ticked: false
            });
            SKILLFX.play("fire", "hit", 5, { x: e.x, y: e.y, cinder: true });
          }
        }
        if (q.frost && e.hp > 0) {
          applyFrost(e, elapsed, null);
        }
      }
    }
    if (!harmed) HAPTICS.hit(false);

    if (q.hasSplitblast && splitblasts.length < 32) {
      splitblasts.push({
        x: q.x,
        y: q.y,
        delay: q.splitblastDelay ?? 0.18,
        radius: q.splitblastRadius ?? Math.round(radius * 0.55),
        directDamage: q.splitblastDirectDamage ?? Number((full * 0.25).toFixed(4)),
        splashDamage: q.splitblastSplashDamage ?? Number((splash * 0.25).toFixed(4)),
        primaryTarget: primary,
        level: rank,
        hits: new Set(),
        triggered: false
      });
    }
  }

  function weapons(dt) {
    // 0. 墨焰斬延遲墨焰痕佇列（上限 16，延遲 0.12 秒，出生幀 dt 不扣，在妖刀攻擊前推進）
    if (inkfireMarks.length > 0) {
      for (const im of inkfireMarks) {
        im.delay -= dt;
        if (im.delay <= 0) {
          im.triggered = true;
          SKILLFX.play("katana", "hit", 1, { x: im.x, y: im.y, inkfire: true });
          burst(im.x, im.y, "#ff3d00", 8);
          const hitTargets = enemies
            .filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(im, e) <= im.radius)
            .slice(0, 3);
          if (hitTargets.length > 0) {
            const damagePerTarget = im.damageBudget / hitTargets.length;
            for (const e of hitTargets) {
              if (e.hp > 0 && !e.shield && !e.vanish && !e.done) {
                hurt(e, damagePerTarget, false);
                e.flash = 0.15;
              }
            }
          }
        }
      }
      inkfireMarks = inkfireMarks.filter(im => !im.triggered);
    }

    // 1. 妖刀斬擊 (Katana) - 方向性扇形斬擊 (依玩家面朝方向前方 140 度扇形索敵，不擊中身後)
    wT.katana = (wT.katana ?? atkT) - dt;
    atkT = wT.katana;
    if (WL.katana > 0 && wT.katana <= 0) {
      const spec = resolveAttackSpec("katana", WL.katana, getBuildState(), { faceAng: P.faceAng || 0 });
      const reach = spec.reach;
      const faceAng = P.faceAng || 0;
      let hasEnemyInArc = false;
      for (const e of enemies) {
        if (e.hp > 0 && dist(P, e) <= (spec.isAwakened ? 560 : reach)) {
          const eang = Math.atan2(e.y - P.y, e.x - P.x);
          let diff = Math.abs(eang - faceAng);
          while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
          if (diff <= spec.arc) {
            hasEnemyInArc = true;
            break;
          }
        }
      }
      if (!hasEnemyInArc) {
        wT.katana = atkT = 0.1;
      } else {
        wT.katana = atkT = wMax.katana = spec.cooldown;
        playerAttackPoseT = 0.16;
        const swingReach = spec.swingReach;
        RENDERER.addSlashArc(P.x, P.y, swingReach, faceAng, 2.2, SKILLFX.tier(WL.katana));
        SKILLFX.play("katana", "swing", WL.katana, { x: P.x, y: P.y, ang: faceAng, reach: swingReach });

        let qualifyingInkfireHit = null;
        const mainHits = new Set();
        // 僅判定面朝方向前方扇形範圍 (角度差 <= spec.arc 弧度，約 140 度角)
        for (const e of enemies) {
          if (e.hp > 0 && !spec.isAwakened) {
            const ed = dist(P, e);
            if (ed <= reach) {
              const eang = Math.atan2(e.y - P.y, e.x - P.x);
              let diff = Math.abs(eang - faceAng);
              while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
              if (diff <= spec.arc) {
                mainHits.add(e);
                const wasBurned = !!(e.fireBurnEnds && e.fireBurnEnds > elapsed);
                const hpBefore = e.hp;
                const crit = rollCrit(spec);
                hurt(e, spec.slashDmg * crit.mult, crit.isCrit);
                SKILLFX.play("katana", "hit", WL.katana, { x: e.x, y: e.y, ang: faceAng, crit: crit.isCrit });
                if (spec.hasDuoInkfire && !qualifyingInkfireHit && wasBurned && e.hp < hpBefore && !e.shield && !e.vanish && !e.done) {
                  qualifyingInkfireHit = { x: e.x, y: e.y, baseDmg: spec.slashDmg };
                }
              }
            }
          }
        }
        if (qualifyingInkfireHit && inkfireMarks.length < 16) {
          const damageBudget = Number((qualifyingInkfireHit.baseDmg * 0.20).toFixed(4));
          inkfireMarks.push({
            x: qualifyingInkfireHit.x,
            y: qualifyingInkfireHit.y,
            radius: 56,
            delay: 0.12,
            damageBudget,
            triggered: false
          });
        }
        if (spec.isAwakened && winds.length < 8) winds.push({
          x: P.x, y: P.y, originX: P.x, originY: P.y, vx: Math.cos(faceAng) * 1680, vy: Math.sin(faceAng) * 1680,
          ang: faceAng, size: 360, life: 1.2, hits: new Set(),
          dmg: spec.windDmg, traveled: 0, maxTravel: spec.maxTravel,
          pierceLimit: spec.pierceLimit, pierceScale: spec.pierceScaleAfterThree,
          attackSnapshot: spec,
          critLvl: spec.critLvl,
          critChance: spec.critChance,
          mainHits,
          inkfireUsed: false
        });
        if (spec.hasCrosscut && crosscuts.length < 4) {
          const crossAng = faceAng + (spec.crosscutAngleOffset || (Math.PI * 0.42));
          crosscuts.push({
            x: P.x,
            y: P.y,
            faceAng,
            crossAng,
            delay: spec.crosscutDelay || 0.16,
            reach: spec.crosscutReach,
            arc: spec.crosscutArc || 1.15,
            dmg: spec.crosscutDmg,
            level: WL.katana,
            hits: new Set(),
            mainHits,
            derivationDepth: (spec.derivationDepth || 0) + 1,
            critLvl: spec.critLvl,
            critChance: spec.critChance,
            attackSnapshot: { ...spec }
          });
        }
        AUDIO.slash(WL.katana);
      }
    }

    for (const wave of winds) {
      if (!EVOLUTIONS.move(wave, dt, null, 12)) continue;
      wave.ang = Math.atan2(wave.vy, wave.vx);
      const stepDist = Math.hypot(wave.vx, wave.vy) * dt;
      const cap = wave.maxTravel || 720;
      const nextTravel = (wave.traveled || 0) + stepDist;
      if (nextTravel >= cap && stepDist > 0) {
        const back = (nextTravel - cap) / stepDist;
        wave.x -= wave.vx * dt * back;
        wave.y -= wave.vy * dt * back;
        wave.traveled = cap;
        // 射程結束即消散，不停在原地等剩餘的生命時間。
        wave.life = 0;
      } else wave.traveled = nextTravel;
      for (const eb of enemyBullets) {
        if (eb.life > 0 && !eb.bossHazard && dist(eb, wave) <= 90) {
          eb.life = 0;
          burst(eb.x, eb.y, "#9bf7ff", 6);
        }
      }
      for (const e of enemies) {
        const pierceCap = wave.pierceLimit || 6;
        if (!(e.hp > 0) || wave.hits.size >= pierceCap || wave.hits.has(e)) continue;
        const along = Math.abs((e.x - wave.x) * Math.cos(wave.ang) + (e.y - wave.y) * Math.sin(wave.ang));
        const side = Math.abs(-(e.x - wave.x) * Math.sin(wave.ang) + (e.y - wave.y) * Math.cos(wave.ang));
        if (along >= (e.type === 'boss' ? 95 : 75) || side >= 180 + (e.type === 'boss' ? 40 : 22)) continue;
        const ox = e.x - wave.originX, oy = e.y - wave.originY;
        if (Math.hypot(ox, oy) > (wave.maxTravel || 720)) continue;
        let ad = Math.abs(Math.atan2(oy, ox) - wave.ang);
        while (ad > Math.PI) ad = Math.abs(ad - 2 * Math.PI);
        if (ad > 1.22) continue;
        const wasBurned = !!(e.fireBurnEnds && e.fireBurnEnds > elapsed);
        const hpBefore = e.hp;
        const hitIndex = wave.hits.size;
        wave.hits.add(e);
        if (wave.mainHits) wave.mainHits.add(e);
        const pierceScale = hitIndex < 3 ? 1 : (wave.pierceScale || 0.75);
        const crit = rollCrit(wave.attackSnapshot || wave);
        hurt(e, wave.dmg * pierceScale * crit.mult, crit.isCrit);
        SKILLFX.play("katana", "hit", 5, { x: e.x, y: e.y, ang: wave.ang, crit: crit.isCrit });
        if (wave.attackSnapshot?.hasDuoInkfire && !wave.inkfireUsed && wasBurned && e.hp < hpBefore && !e.shield && !e.vanish && !e.done) {
          wave.inkfireUsed = true;
          if (inkfireMarks.length < 16) {
            const baseDmg = wave.dmg * pierceScale;
            const damageBudget = Number((baseDmg * 0.20).toFixed(4));
            inkfireMarks.push({
              x: e.x,
              y: e.y,
              radius: 56,
              delay: 0.12,
              damageBudget,
              triggered: false
            });
          }
        }
      }
      const cam = RENDERER.getCam(), view = worldViewBounds(), margin = wave.size * 0.62;
      const left = cam.x + view.left, right = cam.x + view.right, top = cam.y + view.top, bottom = cam.y + view.bottom;
      if (wave.x < left - margin || wave.x > right + margin || wave.y < top - margin || wave.y > bottom + margin || wave.traveled >= wave.maxTravel) wave.life = 0;
    }
    winds = winds.filter(p => p.life > 0);

    if (crosscuts.length > 0) {
      for (const cc of crosscuts) {
        cc.delay -= dt;
        if (cc.delay <= 0 && !cc.triggered) {
          cc.triggered = true;
          const tier = SKILLFX.tier(cc.level);
          RENDERER.addSlashArc(cc.x, cc.y, cc.reach, cc.crossAng, 2.0, tier);
          SKILLFX.play("katana", "swing", cc.level, { x: cc.x, y: cc.y, ang: cc.crossAng, reach: cc.reach });
          AUDIO.slash(cc.level);
          for (const e of enemies) {
            if (e.hp > 0 && !cc.hits.has(e)) {
              const ed = Math.hypot(e.x - cc.x, e.y - cc.y);
              if (ed <= cc.reach) {
                let diff = Math.abs(Math.atan2(e.y - cc.y, e.x - cc.x) - cc.crossAng);
                while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
                if (diff <= cc.arc) {
                  cc.hits.add(e);
                  const isMainHit = cc.mainHits && cc.mainHits.has(e);
                  const baseSlash = cc.attackSnapshot ? cc.attackSnapshot.slashDmg : (cc.dmg / 0.60);
                  const finalDmg = isMainHit
                    ? Number((baseSlash * 0.40).toFixed(2))
                    : cc.dmg;
                  const crit = rollCrit(cc.attackSnapshot || cc);
                  hurt(e, finalDmg * crit.mult, crit.isCrit);
                  SKILLFX.play("katana", "hit", cc.level, { x: e.x, y: e.y, ang: cc.crossAng, crit: crit.isCrit });
                }
              }
            }
          }
        }
      }
      crosscuts = crosscuts.filter(cc => !cc.triggered);
    }

    // 2. 淨化靈陣 (Barrier AoE) - 360 度全方位退魔衝擊環（全新卡牌秘術技能）
    if (WL.barrier > 0) {
      wT.barrier -= dt;
      if (wT.barrier <= 0) {
        const spec = resolveAttackSpec("barrier", WL.barrier, getBuildState());
        wT.barrier = wMax.barrier = spec.cooldown;
        const r = spec.radius;
        if (spec.isAwakened && spec.sanctuary) {
          sacredSanctuary = { x: P.x, y: P.y, r: spec.sanctuary.radius, life: spec.sanctuary.duration, maxLife: spec.sanctuary.duration };
        }
        SKILLFX.play("barrier", "cast", spec.level, { x: P.x, y: P.y, r });
        let hitAny = false;
        for (const e of enemies) {
          if (e.hp > 0 && dist(P, e) <= r) {
            hitAny = true;
            const crit = rollCrit(spec);
            hurt(e, spec.damage * crit.mult, crit.isCrit);
            if (spec.knockback > 0 && e.type !== "boss") knockback(e, spec.knockback);
            burst(e.x, e.y, "#ffe082", 6);
          }
        }
        if (hitAny) RENDERER.triggerShake(5);
        AUDIO.barrier(spec.level);

        if (spec.hasPulse && barrierPulses.length < 4) {
          barrierPulses.push({
            x: P.x,
            y: P.y,
            delay: spec.pulseDelay || 0.18,
            radius: spec.radius,
            damage: spec.damage,
            knockback: spec.knockback,
            level: spec.level,
            hits: new Set(),
            derivationDepth: (spec.derivationDepth || 0) + 1,
            critLvl: spec.critLvl,
            critChance: spec.critChance,
            attackSnapshot: { ...spec }
          });
        }
      }
    }

    if (barrierPulses.length > 0) {
      for (const bp of barrierPulses) {
        bp.delay -= dt;
        if (bp.delay <= 0 && !bp.triggered) {
          bp.triggered = true;
          SKILLFX.play("barrier", "cast", bp.level, { x: bp.x, y: bp.y, r: bp.radius });
          AUDIO.barrier(bp.level);
          let hitAny = false;
          for (const e of enemies) {
            if (e.hp > 0 && !bp.hits.has(e)) {
              if (Math.hypot(e.x - bp.x, e.y - bp.y) <= bp.radius) {
                bp.hits.add(e);
                hitAny = true;
                const crit = rollCrit(bp.attackSnapshot || bp);
                hurt(e, bp.damage * crit.mult, crit.isCrit);
                if (bp.knockback > 0 && e.type !== "boss") knockback(e, bp.knockback, bp);
                burst(e.x, e.y, "#ffe082", 6);
              }
            }
          }
          if (hitAny) RENDERER.triggerShake(3);
        }
      }
      barrierPulses = barrierPulses.filter(bp => !bp.triggered);
    }

    if (sacredSanctuary && sacredSanctuary.life > 0) {
      sacredSanctuary.life -= dt;
    }

    // 3. 天狐靈針 (Needles) - 面朝方向多發穿甲破魔靈針
    if (WL.needle > 0) {
      wT.needle -= dt;
      if (wT.needle <= 0) {
        const spec = resolveAttackSpec("needle", WL.needle, getBuildState());
        wT.needle = wMax.needle = spec.cooldown;
        const count = spec.count;
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

        if (spec.isAwakened) {
          const volley = EVOLUTIONS.iceVolley(P, enemies, shootAng);
          for (const nd of volley) {
            nd.dmg = spec.damage; // 快照傷害，飛行途中不回寫
            nd.baseDmg = spec.baseDamage;
            nd.speed = spec.speed;
            nd.range = spec.range;
            nd.attackSnapshot = spec;
            nd.tracking = spec.tracking;
            nd.turnRate = spec.turnRate || 4.8;
            nd.seekRange = spec.seekRange || 480;
            nd.frost = spec.frost;
            nd.hasPierce = spec.hasPierce || false;
            nd.pierceBonusScale = spec.pierceBonusScale || 0;
            nd.maxPierceBonusHits = spec.maxPierceBonusHits || 0;
            nd.pierceBonusMax = spec.pierceBonusMax || 0;
            nd.pierceHits = 0;
            nd.pierceBonusCount = 0;
            nd.pierceBonusScaleTotal = 0;
            nd.originX = nd.originX ?? P.x;
            nd.originY = nd.originY ?? P.y;
            nd.hasReturn = spec.hasReturn || false;
            nd.returnDistance = spec.returnDistance || 0;
            nd.distanceTraveled = 0;
            nd.returned = false;
            nd.returning = false;
            needles.push(nd);
          }
          if (spec.fan) {
            const extraCount = spec.count - 8;
            const sharedVolley = volley[0]?.volley || { used: false, hits: new Set() };
            for (let i = 0; i < extraCount; i++) {
              const a = shootAng + ((i % 2 === 0 ? 1 : -1) * (0.85 + Math.floor(i / 2) * 0.35));
              needles.push({
                x: P.x, y: P.y,
                originX: P.x, originY: P.y,
                vx: Math.cos(a) * spec.speed, vy: Math.sin(a) * spec.speed,
                life: spec.life,
                level: spec.level,
                curve: false, launchAng: a, ang: a, age: 0,
                aimX: P.x + Math.cos(a) * spec.range, aimY: P.y + Math.sin(a) * spec.range,
                dmg: spec.damage,
                baseDmg: spec.baseDamage,
                speed: spec.speed,
                range: spec.range,
                hits: new Set(),
                trail: 0,
                ice: true,
                frost: true,
                tracking: spec.tracking,
                turnRate: spec.turnRate || 4.8,
                seekRange: spec.seekRange || 480,
                target: null,
                attackSnapshot: spec,
                volley: sharedVolley,
                hasPierce: spec.hasPierce || false,
                pierceBonusScale: spec.pierceBonusScale || 0,
                maxPierceBonusHits: spec.maxPierceBonusHits || 0,
                pierceBonusMax: spec.pierceBonusMax || 0,
                pierceHits: 0,
                pierceBonusCount: 0,
                pierceBonusScaleTotal: 0,
                hasReturn: spec.hasReturn || false,
                returnDistance: spec.returnDistance || 0,
                distanceTraveled: 0,
                returned: false,
                returning: false
              });
            }
          }
        } else {
          const spread = spec.spread;
          for (let i = 0; i < count; i++) {
            const a = shootAng + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
            needles.push({
              x: P.x, y: P.y,
              originX: P.x, originY: P.y,
              vx: Math.cos(a) * spec.speed, vy: Math.sin(a) * spec.speed,
              life: spec.life,
              level: spec.level,
              curve: false, launchAng: a, ang: a, age: 0,
              aimX: P.x + Math.cos(shootAng) * spec.range, aimY: P.y + Math.sin(shootAng) * spec.range,
              dmg: spec.damage, // 快照傷害，飛行途中不回寫
              baseDmg: spec.baseDamage,
              speed: spec.speed,
              range: spec.range,
              hits: new Set(), // 命中同敵去重
              trail: 0,
              ice: spec.frost || false,
              frost: spec.frost || false,
              tracking: spec.tracking || false,
              turnRate: spec.turnRate || 4.2,
              seekRange: spec.seekRange || 480,
              target: null,
              attackSnapshot: spec,
              hasPierce: spec.hasPierce || false,
              pierceBonusScale: spec.pierceBonusScale || 0,
              maxPierceBonusHits: spec.maxPierceBonusHits || 0,
              pierceBonusMax: spec.pierceBonusMax || 0,
              pierceHits: 0,
              pierceBonusCount: 0,
              pierceBonusScaleTotal: 0,
              hasReturn: spec.hasReturn || false,
              returnDistance: spec.returnDistance || 0,
              distanceTraveled: 0,
              returned: false,
              returning: false
            });
          }
        }
        SKILLFX.play("needle", "fire", spec.level, { x: P.x + Math.cos(shootAng) * 28, y: P.y + Math.sin(shootAng) * 28 });
        AUDIO.needle(spec.level);
      }
    }

    for (const nd of needles) {
      if (!nd.returning) {
        EVOLUTIONS.curve(nd, dt);
        if (nd.tracking && (!nd.curve || nd.curved || nd.curveDone)) {
          if (!nd.target || nd.target.hp <= 0 || dist(nd, nd.target) > (nd.seekRange || 480)) {
            nd.target = null;
            nd.retargetT = (nd.retargetT || 0) - dt;
            if (nd.retargetT <= 0) {
              nd.retargetT = 0.12;
              let nearest = nd.seekRange || 480;
              for (const e of enemies) {
                if (e.hp > 0 && !nd.hits?.has(e)) {
                  const d = dist(nd, e);
                  if (d < nearest) {
                    nearest = d;
                    nd.target = e;
                  }
                }
              }
            }
          }
          if (nd.target && nd.target.hp > 0) {
            const targetAng = Math.atan2(nd.target.y - nd.y, nd.target.x - nd.x);
            const diff = Math.atan2(Math.sin(targetAng - nd.ang), Math.cos(targetAng - nd.ang));
            const maxTurn = (nd.turnRate || 4.2) * dt;
            const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
            nd.ang += turn;
            nd.vx = Math.cos(nd.ang) * nd.speed;
            nd.vy = Math.sin(nd.ang) * nd.speed;
          }
        }
      }
      const prevX = nd.x, prevY = nd.y;
      if (!EVOLUTIONS.move(nd, dt, nd.curve ? blocked : null, 6)) continue;
      const stepDist = Math.hypot(nd.x - prevX, nd.y - prevY);

      if (nd.hasReturn && !nd.returned) {
        nd.distanceTraveled = (nd.distanceTraveled || 0) + stepDist;
        if (nd.distanceTraveled >= nd.returnDistance) {
          nd.returned = true;
          nd.returning = true;
          nd.curve = false;
          nd.curved = true;
          nd.curveDone = true;
          nd.tracking = false;
          const retAng = Math.atan2(nd.originY - nd.y, nd.originX - nd.x);
          nd.ang = retAng;
          const spd = nd.speed || 640;
          nd.vx = Math.cos(retAng) * spd;
          nd.vy = Math.sin(retAng) * spd;
        }
      } else if (nd.returning) {
        const dOrigin = Math.hypot(nd.x - nd.originX, nd.y - nd.originY);
        const pastOrigin = ((nd.x - nd.originX) * nd.vx + (nd.y - nd.originY) * nd.vy) >= 0;
        if (dOrigin <= Math.max(20, stepDist * 1.1) || pastOrigin) {
          nd.life = 0;
        }
      }
      if ((nd.trail -= dt) <= 0) {
        nd.trail = 0.03;
        SKILLFX.play("needle", "trail", nd.level ?? WL.needle, { x: nd.x, y: nd.y, ang: Math.atan2(nd.vy, nd.vx) });
      }
      for (const e of enemies) {
        if (e.hp > 0 && !(e.inb > elapsed) && !nd.hits?.has(e) && dist(e, nd) < (e.type === "boss" ? 54 : 30)) {
          e.inb = elapsed + 0.2;
          nd.hits?.add(e);
          let dmg = nd.dmg;
          if (nd.hasPierce && !e.shield) {
            nd.pierceHits = (nd.pierceHits || 0) + 1;
            if (nd.pierceHits > 1) {
              const maxHits = nd.maxPierceBonusHits ?? 2;
              const bonusCount = nd.pierceBonusCount || 0;
              if (bonusCount < maxHits) {
                const maxBudget = nd.pierceBonusMax ?? 0.30;
                const usedScale = nd.pierceBonusScaleTotal || 0;
                const remainingScale = Math.max(0, maxBudget - usedScale);
                const addScale = Math.min(nd.pierceBonusScale ?? 0.15, remainingScale);
                if (addScale > 0) {
                  dmg = nd.dmg * (1 + addScale);
                  nd.pierceBonusCount = bonusCount + 1;
                  nd.pierceBonusScaleTotal = usedScale + addScale;
                }
              }
            }
          }
          hurt(e, dmg);
          if (nd.frost || nd.ice) applyFrost(e, elapsed, nd.volley || null);
          SKILLFX.play("needle", "hit", nd.level ?? WL.needle, { x: nd.x, y: nd.y });
        }
      }
    }
    needles = needles.filter(nd => nd.life > 0);

    // 4. 陰陽符：單向飛行，命中後黏住，延遲爆炸一次。
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
          const spec = resolveAttackSpec("boom", WL.boom, getBuildState());
          wT.boom = wMax.boom = spec.cooldown;
          const count = spec.count;
          const baseAng = Math.atan2(t.y - P.y, t.x - P.x);
          const castState = { frostsealUsed: false, cinderUsed: false };
          for (let i = 0; i < count; i++) {
            const a = baseAng + (i - (count - 1) / 2) * spec.spread;
            proj.push({
              x: P.x, y: P.y,
              vx: Math.cos(a) * spec.speed,
              vy: Math.sin(a) * spec.speed,
              ang: a,
              speed: spec.speed,
              t: 0,
              life: spec.life,
              fuse: 0,
              initialFuse: spec.fuse,
              level: spec.level,
              stuck: false,
              target: null,
              seekTarget: null,
              retargetT: 0,
              searchCount: 0,
              tracking: spec.tracking,
              turnRate: spec.turnRate || 4.2,
              seekRange: spec.seekRange,
              hasSeek: spec.hasSeek,
              frost: spec.frost,
              hasFrost: spec.hasFrost,
              hasDuoFrostseal: spec.hasDuoFrostseal,
              hasDuoCinderseal: spec.hasDuoCinderseal,
              castState: castState,
              exploded: false,
              radius: spec.radius,
              damage: spec.damage,
              splashDamage: spec.splashDamage,
              knockback: spec.knockback,
              hasSplitblast: spec.hasSplitblast,
              splitblastDelay: spec.splitblastDelay,
              splitblastRadius: spec.splitblastRadius,
              splitblastDirectDamage: spec.splitblastDirectDamage,
              splitblastSplashDamage: spec.splitblastSplashDamage,
              mutations: [...spec.mutations]
            });
          }
          if (typeof AUDIO.ofudaLaunch === "function") AUDIO.ofudaLaunch(WL.boom);
          else AUDIO.boomerang(WL.boom);
        }
      }
    }

    if (splitblasts.length > 0) {
      for (const sb of splitblasts) {
        sb.delay -= dt;
        if (sb.delay <= 0) {
          sb.triggered = true;
          SKILLFX.play("boom", "hit", sb.level, { x: sb.x, y: sb.y, r: sb.radius, secondary: true });
          for (const e of enemies) {
            if (e.hp <= 0 || e.shield || sb.hits.has(e)) continue;
            if (dist(e, sb) <= sb.radius) {
              sb.hits.add(e);
              const isPrimary = (e === sb.primaryTarget);
              const dmg = isPrimary ? sb.directDamage : sb.splashDamage;
              hurt(e, dmg);
            }
          }
        }
      }
      splitblasts = splitblasts.filter(sb => !sb.triggered);
    }

    for (const q of proj) {
      const rank = q.level ?? WL.boom;
      if (q.stuck) {
        if (!boomTargetLive(q)) { explodeTalisman(q); continue; }
        q.x = q.target.x;
        q.y = q.target.y;
        q.fuse -= dt;
        if (q.fuse <= 0) explodeTalisman(q);
        continue;
      }

      if (q.tracking) {
        if (q.seekTarget) {
          if (q.seekTarget.hp <= 0 || q.seekTarget.shield || q.seekTarget.vanish || q.seekTarget.done || !enemies.includes(q.seekTarget) || dist(q, q.seekTarget) > q.seekRange) {
            q.seekTarget = null;
          }
        }
        q.retargetT = (q.retargetT || 0) - dt;
        if (!q.seekTarget && q.retargetT <= 1e-4) {
          q.retargetT = 0.20;
          q.searchCount = (q.searchCount || 0) + 1;
          let nearest = q.seekRange;
          let chosen = null;
          for (const e of enemies) {
            if (e.hp > 0 && !e.shield && !e.vanish && !e.done) {
              const d = dist(q, e);
              if (d <= nearest) {
                nearest = d;
                chosen = e;
              }
            }
          }
          q.seekTarget = chosen;
        }
        if (q.seekTarget) {
          const curAng = (typeof q.ang === "number") ? q.ang : Math.atan2(q.vy, q.vx);
          const targetAng = Math.atan2(q.seekTarget.y - q.y, q.seekTarget.x - q.x);
          const diff = Math.atan2(Math.sin(targetAng - curAng), Math.cos(targetAng - curAng));
          const maxTurn = (q.turnRate || 4.2) * dt;
          const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
          const newAng = Math.atan2(Math.sin(curAng + turn), Math.cos(curAng + turn));
          q.ang = newAng;
          const spd = q.speed || 880;
          q.vx = Math.cos(newAng) * spd;
          q.vy = Math.sin(newAng) * spd;
        }
      }

      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if ((q.trail = (q.trail || 0) - dt) <= 0) { q.trail = 0.035; SKILLFX.play("boom", "trail", rank, { x: q.x, y: q.y }); }
      let stuck = false;
      for (const e of enemies) {
        if (e.hp > 0 && Math.hypot(e.x - q.x, e.y - q.y) < (e.type === "boss" ? 54 : 32)) {
          q.stuck = true;
          q.target = e;
          q.seekTarget = null;
          q.fuse = q.initialFuse ?? BOOM_FUSE;
          q.x = e.x;
          q.y = e.y;
          q.vx = 0;
          q.vy = 0;
          stuck = true;
          break;
        }
      }
      if (stuck) continue;
      if (q.life <= 0) q.done = true;
    }
    proj = proj.filter(q => !q.done);

    // 5. 狐火環繞 + 脫離追擊
    if (WL.fire > 0) {
      fireSfxT = Math.max(0, fireSfxT - dt);
      let fireHit = false;
      const fireSpec = resolveAttackSpec("fire", WL.fire, getBuildState());
      fAng += dt * fireSpec.angularSpeed;
      const emitEmber = (fireEmitT -= dt) <= 0;
      if (emitEmber) fireEmitT = 0.05;
      const count = fireSpec.count;
      const awaySlots = new Set(ghosts.filter(p=>p.fireAttack&&p.life>0&&p.level===WL.fire).map(p=>p.slot));
      for (let i = 0; i < count; i++) {
        if (awaySlots.has(i)) continue;
        const a = fAng + (i * 6.283) / count;
        const fx = P.x + Math.cos(a) * fireSpec.rx, fy = P.y + Math.sin(a) * fireSpec.ry;
        if (emitEmber) {
          SKILLFX.play("fire", "ember", WL.fire, { x: fx, y: fy, ang: a, vx:-Math.sin(a)*fireSpec.rx*fireSpec.angularSpeed, vy:Math.cos(a)*fireSpec.ry*fireSpec.angularSpeed });
        }
        for (const e of enemies) {
          if (e.hp > 0 && !(e.ifr > elapsed) && Math.hypot(e.x - fx, e.y - fy) < (e.type === "boss" ? 54 : 30)) {
            e.ifr = elapsed + fireSpec.hitInterval;
            const hpBefore = e.hp;
            hurt(e, fireSpec.contactDamage);
            if (e.hp < hpBefore) {
              fireHit = true;
              if ((fireSpec.hasDuoInkfire || fireSpec.hasDuoCinderseal) && e.hp > 0 && !e.shield && !e.vanish && !e.done) {
                e.fireBurnEnds = elapsed + 1.0;
              }
            }
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
          const n=Math.min(fireSpec.attackCount,count);
          for(let k=0;k<n;k++){
            const slot=Math.floor(k*count/n),a=fAng+(slot*6.283)/count;
            const spirit = EVOLUTIONS.fireSpirit(P,a,WL.fire,slot);
            spirit.x = P.x + Math.cos(a) * fireSpec.rx;
            spirit.y = P.y + Math.sin(a) * fireSpec.ry;
            spirit.spiritDamage = fireSpec.spiritDamage;
            spirit.hasDuoInkfire = !!fireSpec.hasDuoInkfire;
            spirit.hasDuoCinderseal = !!fireSpec.hasDuoCinderseal;
            ghosts.push(spirit);
          }
          AUDIO.fireball(4); // Detached foxfire uses the same fire-lv1-4 sound as orbiting flames.
          fireAttackT=fireSpec.spiritCooldown;
        }
      }
    }

    // MAX: 0.35s entry, 1.5s fully visible, 0.35s exit, then 5s offscreen.
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
        const dragonSpec = resolveAttackSpec("fire", 5, getBuildState());
        wT.fire=wMax.fire=dragonSpec.cooldown;
        const cam=RENDERER.getCam(),view=worldViewBounds();
        const left=cam.x+view.left,right=cam.x+view.right,top=cam.y+view.top,bottom=cam.y+view.bottom;
        // 黑龍在原版尺寸上放大 1.5 倍，仍維持左右側入場。
        const face=target.x>=P.x?1:-1,size=clamp(view.width*0.66,450,1020);
        const endX=face>0?left+size*0.08:right-size*0.08;
        const startX=face>0?left-size*0.8:right+size*0.8;
        const y=clamp(P.y-90,top+view.height*0.27,bottom-view.height*0.23);
        const summoned=EVOLUTIONS.dragon(P,face>0?0:Math.PI,Math.random()*6.283,{startX,endX,y,size});
        summoned.target=target;
        summoned.dragonDirectDmg = dragonSpec.dragonDirectDmg;
        summoned.dragonSplashDmg = dragonSpec.dragonSplashDmg;
        summoned.dragonScorchDmg = dragonSpec.dragonScorchDmg;
        summoned.scorchDuration = dragonSpec.scorchDuration;
        summoned.scorchRadius = dragonSpec.scorchRadius;
        summoned.hasDuoInkfire = !!dragonSpec.hasDuoInkfire;
        summoned.hasDuoCinderseal = !!dragonSpec.hasDuoCinderseal;
        ghosts.push(summoned);
        AUDIO.fireDragon?.();
      }
    }
    for(const spirit of ghosts){
      if(spirit.dragon){
        // Follow the visible screen edge as the courier and camera move.
        if(spirit.entry){
          const cam=RENDERER.getCam(),view=worldViewBounds(),side=spirit.faceX,size=spirit.size;
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
        if(!spirit.shot && spirit.age>=0.60){
          const target=(spirit.target?.hp>0&&!spirit.target.shield?spirit.target:null) || enemies.filter(e=>e.hp>0&&!e.shield).sort((a,b)=>dist(spirit,a)-dist(spirit,b))[0] ||
            {x:spirit.x+Math.cos(spirit.ang)*440,y:spirit.y+Math.sin(spirit.ang)*440};
          const cam=RENDERER.getCam(), view=worldViewBounds();
          const left=cam.x+view.left+30,right=cam.x+view.right-30,top=cam.y+view.top+30,bottom=cam.y+view.bottom-30;
          const angle=Math.random()*Math.PI*2,landings=[];
          for(let k=0;k<3;k++){
            let point=null;
            for(let attempt=0;attempt<10;attempt++){
              const a=angle+k*Math.PI*2/3+(Math.random()-.5)*.30+attempt*.41;
              const radius=105+Math.random()*30;
              const x=clamp(target.x+Math.cos(a)*radius,left,right),y=clamp(target.y+Math.sin(a)*radius,top,bottom);
              if(blocked(x,y,30)||landings.some(p=>Math.hypot(p.x-x,p.y-y)<125))continue;
              point={x,y};break;
            }
            // Keep three projectiles even in a crowded village; collision remains authoritative.
            landings.push(point||{x:clamp(target.x+Math.cos(angle+k*Math.PI*2/3)*165,left,right),
              y:clamp(target.y+Math.sin(angle+k*Math.PI*2/3)*165,top,bottom)});
          }
          for(const point of landings) {
            const fireball = EVOLUTIONS.dragonFireball(spirit,point,true);
            fireball.dragonDirectDmg = spirit.dragonDirectDmg;
            fireball.dragonSplashDmg = spirit.dragonSplashDmg;
            fireball.dragonScorchDmg = spirit.dragonScorchDmg;
            fireball.scorchDuration = spirit.scorchDuration;
            fireball.scorchRadius = spirit.scorchRadius;
            fireball.hasDuoInkfire = !!spirit.hasDuoInkfire;
            fireball.hasDuoCinderseal = !!spirit.hasDuoCinderseal;
            dragonShots.push(fireball);
          }
          AUDIO.fireDragonBall?.();
          spirit.shot=true;
        }
        continue;
      }
      if(spirit.fireAttack&&spirit.returning)continue;
      for(const e of enemies)if(e.hp>0&&dist(e,spirit)<(e.type==='boss'?64:42)){
        if(!spirit.hitSet.has(e)){
          spirit.hitSet.add(e);
          const spiritDmg = typeof spirit.spiritDamage === "number" ? spirit.spiritDamage : (2.1+(spirit.level||1)*0.9)*getEffectiveDmg();
          const hpBefore = e.hp;
          hurt(e, spiritDmg);
          if (e.hp < hpBefore && (spirit.hasDuoInkfire || spirit.hasDuoCinderseal) && e.hp > 0 && !e.shield && !e.vanish && !e.done) {
            e.fireBurnEnds = elapsed + 1.0;
          }
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
      const directDmg = typeof shot.dragonDirectDmg === "number" ? shot.dragonDirectDmg : 12*getEffectiveDmg();
      const splashDmg = typeof shot.dragonSplashDmg === "number" ? shot.dragonSplashDmg : 4*getEffectiveDmg();
      if(impact.target) {
        const hpBefore = impact.target.hp;
        hurt(impact.target, directDmg);
        if (impact.target.hp < hpBefore && (shot.hasDuoInkfire || shot.hasDuoCinderseal) && impact.target.hp > 0 && !impact.target.shield && !impact.target.vanish && !impact.target.done) {
          impact.target.fireBurnEnds = elapsed + 1.0;
        }
      }
      for(const e of enemies) {
        if(e.hp>0&&e!==impact.target&&!e.shield&&Math.hypot(e.x-impact.x,e.y-impact.y)<140) {
          const hpBefore = e.hp;
          hurt(e, splashDmg);
          if (e.hp < hpBefore && (shot.hasDuoInkfire || shot.hasDuoCinderseal) && e.hp > 0 && !e.shield && !e.vanish && !e.done) {
            e.fireBurnEnds = elapsed + 1.0;
          }
        }
      }
      if(dragonScorches.length===0)AUDIO.fireGround?.();
      if(dragonScorches.length>=3)dragonScorches.shift();
      const scorchDmg = typeof shot.dragonScorchDmg === "number" ? shot.dragonScorchDmg : 1.8*getEffectiveDmg();
      const scorchDur = typeof shot.scorchDuration === "number" ? shot.scorchDuration : 5;
      const scorchRad = typeof shot.scorchRadius === "number" ? shot.scorchRadius : 140;
      dragonScorches.push({
        x:impact.x,
        y:impact.y,
        life:scorchDur,
        maxLife:scorchDur,
        r:scorchRad,
        tick:0.6,
        scorchDamage:scorchDmg,
        hasDuoInkfire: !!shot.hasDuoInkfire,
        hasDuoCinderseal: !!shot.hasDuoCinderseal
      });
      SKILLFX.play("fire","hit",5,{x:impact.x,y:impact.y});
      burst(impact.x,impact.y,"#ff7a28",12);
    }
    dragonShots=dragonShots.filter(p=>p.life>0);
    for(const scorch of dragonScorches){
      if (scorch.isCinder) {
        if (scorch.birthFrame) {
          scorch.birthFrame = false;
          continue;
        }
        scorch.life -= dt;
        scorch.delay -= dt;
        if (scorch.delay <= 0 && !scorch.ticked) {
          scorch.ticked = true;
          SKILLFX.play("boom", "hit", 1, { x: scorch.x, y: scorch.y, r: scorch.r, cinder: true });
          burst(scorch.x, scorch.y, "#ff5722", 6);
          const hitTargets = enemies
            .filter(e => {
              if (e.hp <= 0 || e.shield || e.vanish || e.done) return false;
              if (e.scorchReady > elapsed) return false;
              const coveredByDragon = dragonScorches.some(s => !s.isCinder && s.life > 0 && Math.hypot(e.x - s.x, e.y - s.y) <= s.r);
              if (coveredByDragon) return false;
              return Math.hypot(e.x - scorch.x, e.y - scorch.y) <= scorch.r;
            })
            .slice(0, 3);
          if (hitTargets.length > 0) {
            const damagePerTarget = scorch.damageBudget / hitTargets.length;
            for (const e of hitTargets) {
              if (e.hp > 0 && !e.shield && !e.vanish && !e.done) {
                hurt(e, damagePerTarget, false);
                e.flash = 0.15;
                e.scorchReady = Math.max(e.scorchReady || 0, elapsed + 0.3);
              }
            }
          }
        }
        continue;
      }
      scorch.life-=dt;
      scorch.tick-=dt;
      while(scorch.tick<=0&&scorch.life>0){
        scorch.tick+=0.6;
        for(const e of enemies)if(e.hp>0&&!e.shield&&!(e.scorchReady>elapsed)&&Math.hypot(e.x-scorch.x,e.y-scorch.y)<scorch.r){
          e.scorchReady = elapsed + 0.6;
          const scorchDmg = typeof scorch.scorchDamage === "number" ? scorch.scorchDamage : 1.8*getEffectiveDmg();
          const hpBefore = e.hp;
          hurt(e, scorchDmg);
          if (e.hp < hpBefore && (scorch.hasDuoInkfire || scorch.hasDuoCinderseal) && e.hp > 0 && !e.shield && !e.vanish && !e.done) {
            e.fireBurnEnds = elapsed + 1.0;
          }
        }
      }
    }
    dragonScorches=dragonScorches.filter(p=>p.life>0);

    // 5.9 共鳴奧義：雷紋陣延遲衝擊佇列（次級佇列上限 16，延遲 0.12 秒，出生前當幀時間不扣）
    if (duoShockwaves.length > 0) {
      for (const sw of duoShockwaves) {
        sw.delay -= dt;
        if (sw.delay <= 0) {
          sw.triggered = true;
          SKILLFX.play("thunder", "strike", 1, { x: sw.x, y: sw.y, r: sw.radius, shockwave: true });
          const hitTargets = enemies
            .filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(sw, e) <= sw.radius)
            .slice(0, 3);
          if (hitTargets.length > 0) {
            const damagePerTarget = sw.damageBudget / hitTargets.length;
            for (const e of hitTargets) {
              if (e.hp > 0 && !e.shield && !e.vanish && !e.done) {
                hurt(e, damagePerTarget, false);
                e.flash = 0.15;
              }
            }
          }
        }
      }
      duoShockwaves = duoShockwaves.filter(sw => !sw.triggered);
    }

    // 6. 天狐落雷：固定係數，不依生命秒殺。
    if (WL.thunder > 0) {
      wT.thunder -= dt;
      if (wT.thunder <= 0) {
        const spec = resolveAttackSpec("thunder", WL.thunder, getBuildState());
        const radius = spec.radius;
        const candidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(P, e) <= radius);
        if (!candidates.length) {
          wT.thunder = 0.2;
        } else {
          const threat = e => e.type === "boss" ? 0 : e.type === "shooter" ? 1 : e.type === "tank" ? 2 : 3;
          candidates.sort((a, b) => spec.level >= 4 ? (threat(a) - threat(b) || dist(P, a) - dist(P, b)) : dist(P, a) - dist(P, b));
          wT.thunder = wMax.thunder = spec.cooldown;
          const crit = rollCrit(spec);
          const struck = new Set();
          const primaryTargets = [];

          // Duo 雷紋陣陣內快照
          const currentBuild = getBuildState();
          const duos = currentBuild.duos;
          const barrierLvl = WL.barrier || (currentBuild.activeSkills?.includes("barrier") ? 3 : 0);
          const hasDuoThundercircle = duos.includes("duo_thundercircle") && barrierLvl >= 1;
          const circleCenter = { x: P.x, y: P.y };
          const barrierRadius = hasDuoThundercircle
            ? resolveAttackSpec("barrier", barrierLvl, currentBuild).radius
            : 0;
          let qualifyingHitPoint = null;

          if (spec.level === 5) {
            const anchors = candidates.slice(0, spec.targetCount);
            anchors.forEach((anchor, i) => {
              const delay = 0.06 + i * 0.12;
              SKILLFX.play("thunder", "storm", 5, { x: anchor.x, y: anchor.y, r: spec.cloudRadius, delay });
              SKILLFX.play("thunder", "strike", 5, { x: anchor.x, y: anchor.y, r: spec.cloudRadius, stormChild: true, delay: delay + 0.08 });
              for (const e of enemies) if (e.hp > 0 && !e.shield && !e.vanish && !e.done && !struck.has(e) && dist(e, anchor) <= spec.cloudRadius) {
                struck.add(e);
                primaryTargets.push(e);
                const hpBefore = e.hp;
                hurt(e, spec.damage * crit.mult, crit.isCrit);
                e.flash = 0.22;
                if (!qualifyingHitPoint && hasDuoThundercircle && hpBefore > e.hp && dist(e, circleCenter) <= barrierRadius && !e.vanish && !e.done) {
                  qualifyingHitPoint = { x: e.x, y: e.y };
                }
              }
            });
            RENDERER.triggerShake(8);
          } else {
            const count = spec.targetCount;
            for (const e of candidates.slice(0, count)) {
              struck.add(e);
              primaryTargets.push(e);
              SKILLFX.play("thunder", "strike", spec.level, { x: e.x, y: e.y, r: radius });
              const hpBefore = e.hp;
              hurt(e, spec.damage * crit.mult, crit.isCrit);
              if (!qualifyingHitPoint && hasDuoThundercircle && hpBefore > e.hp && dist(e, circleCenter) <= barrierRadius && !e.vanish && !e.done) {
                qualifyingHitPoint = { x: e.x, y: e.y };
              }
            }
          }

          if (spec.hasBranch && spec.branchCount > 0 && primaryTargets.length > 0) {
            let branchTarget = null;
            for (const pt of primaryTargets) {
              const subCandidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && !struck.has(e) && dist(pt, e) <= spec.branchRadius);
              if (subCandidates.length > 0) {
                subCandidates.sort((a, b) => dist(pt, a) - dist(pt, b));
                branchTarget = subCandidates[0];
                break;
              }
            }
            if (branchTarget) {
              struck.add(branchTarget);
              SKILLFX.play("thunder", "strike", spec.level, { x: branchTarget.x, y: branchTarget.y, r: spec.branchRadius, branch: true });
              hurt(branchTarget, spec.branchDamage * crit.mult, crit.isCrit);
              branchTarget.flash = 0.15;
            }
          }

          if (qualifyingHitPoint && duoShockwaves.length < 16) {
            duoShockwaves.push({
              x: qualifyingHitPoint.x,
              y: qualifyingHitPoint.y,
              radius: 64,
              delay: 0.12,
              damageBudget: Number((spec.damage * 0.20).toFixed(4)),
              triggered: false,
              level: spec.level
            });
          }

          AUDIO.thunder(spec.level);
        }
      }
    }
  }

  function spawnRadius(minimum) {
    const area = window.VIEWPORT?.worldBoundsAtZoom?.(1) || worldViewBounds(), cam = RENDERER.getCam();
    const lag = Math.hypot(P.x - (cam.x + W / 2), P.y - (cam.y + H / (2 * tiltK())));
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

  function updateShiome(e, dt) {
    if (!e.hazard) {
      e.shiomeCd = Math.max(0, (e.shiomeCd || 0) - dt);
      if (e.pose !== "idle") e.pose = "idle";
      if (e.shiomeCd <= 0 && dist(e, P) < 210) {
        e.hazard = {
          kind: "shiome",
          phase: "telegraph",
          t: 0,
          x: e.x,
          y: e.y,
          angle: Math.atan2(P.y - e.y, P.x - e.x),
          range: 156,
          traveled: 0,
          r: 26,
          hit: false
        };
        e.pose = "attack";
      }
      return null;
    }
    const h = e.hazard;
    h.t += dt;
    if (h.phase === "telegraph") {
      if (e.pose !== "attack") e.pose = "attack";
      if (h.t >= 0.62) { h.phase = "strike"; h.t = 0; }
      return null;
    }
    if (h.phase === "strike") {
      h.traveled = Math.min(h.range, (h.traveled || 0) + 240 * dt);
      h.x = e.x + Math.cos(h.angle) * h.traveled;
      h.y = e.y + Math.sin(h.angle) * h.traveled;
      let hit = null;
      if (!h.hit && dist(P, h) <= h.r) {
        h.hit = true;
        hit = { damage: 8, kind: "shiome", x: h.x, y: h.y };
      }
      if (h.traveled >= h.range || h.t >= 0.7) {
        e.hazard = null;
        e.pose = "idle";
        e.shiomeCd = 2.4;
      }
      return hit;
    }
    e.hazard = null;
    if (e.pose !== "idle") e.pose = "idle";
    return null;
  }

  function mobPacing(atElapsed, power) {
    const cappedElapsed = Math.min(atElapsed, DAWN);
    return {
      tier: CFG.enemyTier(Math.min(atElapsed, CFG.RUN_SECONDS) * MOB_DIFFICULTY.timeScale, power * MOB_DIFFICULTY.powerScale),
      interval: CFG.spawnInterval(cappedElapsed * MOB_DIFFICULTY.timeScale) * SPAWN_INTERVAL_SCALE * MOB_DIFFICULTY.intervalScale,
      count: Math.max(1, CFG.spawnCount(cappedElapsed) + SPAWN_COUNT_BONUS)
    };
  }

  function spawnEnemy(tier, rad, ang, ring) {
    const position = spawnPosition(spawnRadius(rad), ang ?? Math.random() * 6.283, 26);
    if (!position) return;
    const r = Math.random();

    // 怪物速度曲線：封頂於 10 分鐘，破曉後加班不再增加怪物難度。
    const cappedElapsed = Math.min(elapsed, DAWN);
    const speedRamp = (cappedElapsed / DAWN) * 75 * MOB_DIFFICULTY.timeScale;
    const stageSpeed = (STAGE_ENEMY.speedScale || 1) * MOB_DIFFICULTY.speedScale;
    const shooterChance = STAGE_ENEMY.shooterChance ?? 0.14;
    const canShoot = STAGE_ENEMY.shots !== false;
    let t = { type: "ghost", hp: 2.0 * tier, speed: (52 + speedRamp * 0.9) * stageSpeed };
    // 潮目小僧只在雨夜港町、且落在幽靈帶，不改射手／坦克門檻。pose 由招式相位寫入。
    if (STAGE.id === "rain-port" && !ring && r >= 0.55 && r < 0.72) {
      t = { type: "shiome", hp: 2.2 * tier, speed: (46 + speedRamp * 0.7) * stageSpeed, pose: "idle", shiomeCd: 0.8 };
    } else if (cappedElapsed > 90 && r < 0.22) {
      t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
    } else if (cappedElapsed > 200 && r < 0.36) {
      t = { type: "tank", hp: 7 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
    } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.36 : 0.22) + shooterChance && !ring && canShoot) {
      t = { type: "shooter", hp: tier, speed: (48 + speedRamp * 0.8) * stageSpeed };
    }

    enemies.push({ ...position, flash: 0, wob: Math.random() * 6, slowT: 0, ...t,
      hp: Math.ceil(t.hp * MOB_DIFFICULTY.hpScale), max: Math.ceil(t.hp * MOB_DIFFICULTY.hpScale) });
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
        if (checkVictoryCondition()) { startVictorySequence(); return; }
        loseRun();
        return;
      }
      if (elapsed >= DAWN && warnDawnT === 0) {
        warnDawnT = -1;
        const need = Math.max(0, GOAL_DELIVERIES - delivered);
        const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
        const bTitle = story?.bossTitle || "大妖";
        const prompt = !finalBossDefeated ? `擊敗${bTitle}` : (STAGE.id === "night-town" ? "破曉已至" : `還差 ${need} 件委託`);
        say(prompt, P.x, P.y - 75, "#ffb3ba");
      }
    }

    if (warnDawnT > 0 && !safeRead) warnDawnT -= dt;

    // 燈火受擊衝量獨立衰減；即使命中停頓，也讓 HUD 的震盪自然回穩。
    lanternHitT = Math.max(0, lanternHitT - dt);

    // 命中停頓只凍結戰鬥動作；夜行時鐘、Boss 排程與耗油照常前進。
    if (hitStopped && !safeRead) return;

    P.inv = Math.max(0, P.inv - dt);
    playerAttackPoseT = Math.max(0, playerAttackPoseT - dt);
    playerHurtPoseT = Math.max(0, playerHurtPoseT - dt);
    dashT = Math.max(0, dashT - dt);
    dashCd = Math.max(0, dashCd - dt);
    hintT = Math.max(0, hintT - dt);
    nameT = Math.max(0, nameT - dt);

    FX.update(dt);
    SKILLFX.update(dt);

    for (const t of texts) {
      t.y -= 32 / tiltK() * dt;
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
    const baseSpd = getEffectiveMoveSpeed();
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
    const pressure = mobPacing(elapsed, pw);
    const tier = pressure.tier;

    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = pressure.interval;
      const count = pressure.count;
      for (let k = 0; k < count && enemies.length < MOB_DIFFICULTY.cap; k++) {
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
        for (let k = 0; k < surgePendingCount && (!MOB_DIFFICULTY.capSurges || enemies.length < MOB_DIFFICULTY.cap); k++) {
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
        surgePendingCount = Math.max(1, Math.floor((10 + Math.floor(cappedElapsed / 60)) * MOB_DIFFICULTY.surgeCountScale));
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
      if (e.frostsealSlowEnds && elapsed < e.frostsealSlowEnds && (!e.freezeEnds || elapsed >= e.freezeEnds)) {
        curSpd *= (e.frostsealSlowMult || 1.0);
      }
      let hazardHit = null;
      if (e.type === "boss" && window.BOSS_AI?.step) {
        const stepped = window.BOSS_AI.step(e, P, dt, {
          blocked: (x, y, r = 32) => blocked(x, y, r),
          stageId: STAGE.id,
          paused: surgeWarningT > 0
        });
        if (stepped?.hit) hazardHit = stepped.hit;
        if (e.final && STAGE.id === "rain-port") {
          const tideOn = e.hazard && e.hazard.kind === "tide" && (e.hazard.phase === "telegraph" || e.hazard.phase === "active");
          const nextPose = tideOn ? "attack" : "idle";
          if (e.pose !== nextPose) e.pose = nextPose;
        }
      }
      if (e.type === "shiome") {
        const waveHit = updateShiome(e, dt);
        if (waveHit) hazardHit = waveHit;
      }
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const bossBusy = e.type === "boss" && !!e.hazard;
      const shiomeHold = e.type === "shiome" && e.hazard && e.hazard.phase !== "recover";

      // 所有怪物逼近玩家（加入建築物碰撞障礙滑移）
      const step = (bossBusy || shiomeHold || knocked) ? 0 : CFG.chaseStep(d, curSpd, dt, e.type, STAGE_ENEMY.shots !== false);
      const stepX = ((dx || (d === 1 && !dy ? 1 : 0)) / d) * step;
      const stepY = (dy / d) * step;
      const oldX = e.x, oldY = e.y;
      const canDetour = e.type !== "boss" && e.type !== "mis" && step > 0;
      if (canDetour && e.detourT > 0) {
        const domY = Math.abs(stepY) >= Math.abs(stepX);
        const opened = domY ? !blocked(e.x, e.y + stepY, 16) : !blocked(e.x + stepX, e.y, 16);
        if (opened) e.detourT = 0;
      }
      if (canDetour && e.detourT > 0) {
        e.detourT -= dt;
        const tx = e.detourX * step, ty = e.detourY * step;
        if (!blocked(e.x + tx, e.y, 16)) e.x += tx;
        if (!blocked(e.x, e.y + ty, 16)) e.y += ty;
        if (e.x !== oldX || e.y !== oldY) e.detourMoved = true;
        else e.detourT = 0;
      } else {
        if (!blocked(e.x + stepX, e.y, 16)) e.x += stepX;
        if (!blocked(e.x, e.y + stepY, 16)) e.y += stepY;
      }
      if (canDetour && e.x === oldX && e.y === oldY) {
        e.stuckT = (e.stuckT || 0) + dt;
        if (e.stuckT >= 0.45) {
          if (e.detourTried && !e.detourMoved) e.detourSign = -(e.detourSign || 1);
          const sign = e.detourSign || 1;
          const hyp = Math.hypot(stepX, stepY) || 1;
          e.detourX = -stepY / hyp * sign;
          e.detourY = stepX / hyp * sign;
          e.detourT = 1.6;
          e.detourMoved = false;
          e.detourTried = true;
          e.stuckT = 0;
        }
      } else if (e.type !== "mis") {
        e.stuckT = 0;
      }
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

    if (checkVictoryCondition() && state === "play") {
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
        const harborBoss = STAGE_ENEMY.bossTheme === "harbor";
        const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
        const bossTitle = story?.bossTitle || (harborBoss ? "港霧大妖" : "大妖鬼");
        enemies.push({
          ...position,
          type: "boss",
          word,
          shield: !!plan.quiz,
          role: plan.role,
          gatekeeper: plan.role === "gate",
          final: plan.role === "final",
          umibozu: plan.role === "final" && STAGE.id === "rain-port",
          pose: "idle",
          title: bossTitle,
          bossIndex: bossStage,
          stageId: STAGE.id,
          bossTheme: STAGE_ENEMY.bossTheme,
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
        const spawnSay = plan.role === "final"
          ? (story?.bossIntro || `${bossTitle}出現！`)
          : `${bossTitle}出現！`;
        say(spawnSay, P.x, P.y - 75, "#ff8f8f");
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
    const att = getEffectiveMagnetRadius();
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
    const targetCamY = P.y - H / (2 * tiltK());
    const curCam = RENDERER.getCam();
    RENDERER.setCam(
      curCam.x + (targetCamX - curCam.x) * Math.min(1, dt * 9),
      curCam.y + (targetCamY - curCam.y) * Math.min(1, dt * 9)
    );

    if (!safeRead && state === "play" && xp >= xpNeed()) offerUp();
  }

  let rainLoad = 1;
  function rainUnit(i, salt) {
    let h = Math.imul((i + 1) ^ (salt * 0x9e3779b9), 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function drawStageWeather(t) {
    if (STAGE_VISUAL.weather !== "rain" && STAGE_VISUAL.weather !== "snow") return;
    if (!liveMotion()) t = 0;
    const intensity = Math.max(0.4, STAGE_VISUAL.rainIntensity || 1);
    const area = viewBounds();
    const drops = Math.min(80, Math.round(72 * intensity * area.width * area.height / (W * H)));
    ctx.save();
    if (STAGE_VISUAL.weather === "rain") {
      ctx.lineCap = "round";
      const streak = (x, y, length, slant, width, alpha) => {
        ctx.strokeStyle = `rgba(174, 218, 238, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + length * slant, y + length);
        ctx.stroke();
      };
      // 第一條保持原斜率，讓既有雨向測試仍量得到同一條雨絲。
      {
        const speed = 520;
        const x = area.left + ((t * speed * 0.18) % (area.width + 120)) - 60;
        const y = area.top + ((t * speed) % (area.height + 120)) - 60;
        streak(x, y, 16, 0.18, 1.5, 0.48);
      }
      if (STAGE.id === "rain-port") {
        const cover = Math.min(1, area.width * area.height / (W * H));
        const budget = rainLoad > 1.4 ? 0.55 : 1;
        const rainMul = 2;
        const bands = [
          { n: Math.max(10, Math.round(12 * rainMul * cover * budget)), speed: 78, len: 8, slant: 0.16, width: 1, alpha: 0.14 },
          { n: Math.max(8, Math.round(10 * rainMul * cover * budget)), speed: 150, len: 16, slant: 0.18, width: 1.25, alpha: 0.34 },
          { n: Math.max(6, Math.round(7 * rainMul * cover * budget)), speed: 248, len: 26, slant: 0.18, width: 1.6, alpha: 0.22 }
        ];
        const total = bands.reduce((sum, band) => sum + band.n, 0);
        let cursor = 0;
        for (const band of bands) {
          for (let k = 0; k < band.n; k++, cursor++) {
            const speed = band.speed * (0.86 + rainUnit(cursor, 2) * 0.28);
            const slant = band.slant + (rainUnit(cursor, 3) - 0.5) * 0.05;
            const spanX = area.width + 160;
            const spanY = area.height + 160;
            const travelX = speed * slant;
            const baseY = rainUnit(cursor, 7) * Math.max(8, spanY - speed - 8);
            let mix = Math.imul((cursor + 1) ^ 0x9e3779b9, 0x85ebca6b);
            mix = Math.imul(mix ^ (mix >>> 13), 0xc2b2ae35);
            mix = (mix ^ (mix >>> 16)) >>> 0;
            const baseX = (cursor + (mix / 4294967296) * 0.92) * (spanX / (total + 1));
            const x = area.left + ((baseX + t * travelX) % spanX);
            const y = area.top + ((baseY + t * speed) % spanY);
            streak(x, y, band.len * (0.82 + rainUnit(cursor, 4) * 0.4), slant, band.width, band.alpha);
          }
        }
        const ripple = window.PORT_ART?.ripple;
        for (let i = 0; i < 12; i++) {
          const life = (t * 0.8 + rainUnit(i, 8)) % 1;
          const x = area.left + rainUnit(i, 9) * area.width;
          const y = area.top + rainUnit(i, 6) * area.height;
          ctx.globalAlpha = (1 - life) * 0.28;
          ctx.beginPath();
          ctx.arc(x, y, 3 + life * 10, 0, 6.28);
          ctx.stroke();
          if (ripple?.naturalWidth) {
            const s = 8 + life * 16;
            ctx.drawImage(ripple, x - s / 2, y - s * 0.28, s, s * 0.55);
          }
        }
        ctx.globalAlpha = 1;
      } else {
        for (let i = 1; i < drops; i++) {
          const speed = 520 + (i % 5) * 55;
          const x = area.left + ((i * 97 + t * speed * 0.18) % (area.width + 120)) - 60;
          const y = area.top + ((i * 61 + t * speed) % (area.height + 120)) - 60;
          streak(x, y, 16 + (i % 4) * 4, 0.18, 1.5, 0.48);
        }
      }
    } else if (STAGE_VISUAL.weather === "snow") {
      const flakes = Math.min(50, Math.round(42 * area.width * area.height / (W * H)));
      ctx.fillStyle = "rgba(240, 248, 255, 0.75)";
      for (let i = 0; i < flakes; i++) {
        const speed = 70 + (i % 5) * 16;
        const sway = Math.sin(t * 1.6 + i) * 16;
        const x = area.left + ((i * 113 + t * 20 + sway) % (area.width + 80)) - 40;
        const y = area.top + ((i * 79 + t * speed) % (area.height + 80)) - 40;
        const r = 1.4 + (i % 3) * 0.8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const fog = Math.max(0, Math.min(0.35, STAGE_VISUAL.fog || 0));
    if (fog > 0 && typeof ctx.createRadialGradient === "function") {
      const area = viewBounds();
      const haze = ctx.createRadialGradient(
        (area.left + area.right) / 2, (area.top + area.bottom) / 2, Math.min(area.width, area.height) * 0.2,
        (area.left + area.right) / 2, area.top, Math.max(area.width, area.height) * 0.75
      );
      if (haze && typeof haze.addColorStop === "function") {
        const mid = STAGE.id === "rain-port" ? fog * 0.28 : fog;
        haze.addColorStop(0, `rgba(180, 198, 205, ${mid})`);
        haze.addColorStop(1, `rgba(92, 118, 138, ${fog * 0.85})`);
        ctx.fillStyle = haze;
        ctx.fillRect(area.left, area.top, area.width, area.height);
      }
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

  function drawShiomeWave(h) {
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;
    ctx.save();
    ctx.globalAlpha = h.phase === "telegraph" ? 0.35 : 0.7;
    ctx.strokeStyle = "rgba(186, 230, 240, 0.9)";
    ctx.lineWidth = 2;
    const len = h.phase === "telegraph" ? 18 : 36;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + Math.cos(h.angle) * len, h.y + Math.sin(h.angle) * len);
    ctx.stroke();
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
    }
    ctx.restore();
  }

  let frameShakeOffset = {x:0,y:0};
  function drawWorld() {
    const cam = RENDERER.getCam();
    const shakeOffset = frameShakeOffset;
    const holdDawn = elapsed >= DAWN && state !== "victory" && state !== "won" && state !== "lost";
    const dawnBlend = state === "victory" ? victoryDawn() : 0;
    const visualElapsed = holdDawn
      ? DAWN * 0.92
      : state === "victory"
        ? DAWN * (0.92 + 0.08 * dawnBlend)
        : elapsed;

    ctx.save();
    tiltWorld(cam,shakeOffset);
    const view = worldViewBounds();
    const roofCull = window.VIEWPORT?.drawBounds?.(cam, shakeOffset, { left: 140, right: 140, top: 280, bottom: 90 }, 12);
    const nearView = (x, y, margin = 220) =>
      x >= cam.x + view.left - margin && x <= cam.x + view.right + margin &&
      y >= cam.y + view.top - margin && y <= cam.y + view.bottom + margin;
    const houseSeen = house => roofCull
      ? house.x >= roofCull.left && house.x <= roofCull.right && house.y >= roofCull.top && house.y <= roofCull.bottom
      : nearView(house.x, house.y);

    // 1. 地面與道路
    RENDERER.drawGround(visualElapsed, DAWN, activeChunks, STAGE_VISUAL.ground || "ground", STAGE.id);
    if (STAGE.id === "rain-port" && STAGE_VISUAL.weather === "rain") {
      const motion = liveMotion();
      ctx.save();
      ctx.lineWidth = 1.2;
      const groundRipple = window.PORT_ART?.ripple;
      for (let i = 0; i < 14; i++) {
        const life = ((visualElapsed * motion * 0.65 + rainUnit(i, 11)) % 1);
        const x = cam.x + view.left + rainUnit(i, 12) * view.width;
        const y = cam.y + view.top + rainUnit(i, 13) * view.height;
        if (!groundRipple?.naturalWidth) continue;
        const s = 14 + life * 20;
        ctx.globalAlpha = (1 - life) * 0.55;
        ctx.drawImage(groundRipple, x - s / 2, y - s * 0.22, s, s * 0.42);
      }
      ctx.restore();
    }
    RENDERER.drawDistrictLabels?.(activeChunks);

    // 2. 地面高空流雲投影視差層 (Far Sky Cloud Shadows, 0.20x)
    RENDERER.drawGroundParallax?.(visualElapsed, DAWN, cam);

    // 天氣效果（雨/雪）畫在地面與視差層之後、燈籠與角色之前，避免遮擋遊戲元素
    drawStageWeather(visualElapsed);

    // 3. 街角石燈。畫在角色之前，腳底對齊燈位；圖還沒載入時退回提燈符號。
    LAMPS.forEach(l => {
      if (!nearView(l.x, l.y)) return;
      FX.glow(ctx, l.x, l.y + 8, 96, "#ffcf6a", 0.24);
    });

    // 4. 委託氣泡移至頂層 (15.5) 繪製，確保永不被建築、角色或陰影遮擋

    // 5. 送達判定圈 (和風結界魔法陣 + 退魔結界視覺)
    if (job && dist(P, job.to) < 330) {
      // 連續雙環：白色光芯、青色暈光與寬柔光束，沒有枝狀邊線。
      {
        ctx.save();
        const alpha = job.sanctuaryT > 0 ? 0.85 : 0.55;
        const cy = job.to.y + 70;
        const gy = 1 / tiltK();
        ctx.globalCompositeOperation='lighter';
        for(const [width,a,color] of [[28,0.035,'80,200,255'],[16,0.07,'90,215,255'],[7,0.3,'110,235,255'],[2.3,0.95,'220,255,255']]) {
          ctx.lineWidth=width;ctx.strokeStyle=`rgba(${color},${alpha*a})`;
          ctx.beginPath();ctx.ellipse(job.to.x,cy,245,165*gy,0,0,6.283);ctx.stroke();
        }
        ctx.lineWidth=1.5;ctx.strokeStyle=`rgba(160,245,255,${alpha*0.7})`;
        ctx.beginPath();ctx.ellipse(job.to.x,cy,228,153*gy,0,0,6.283);ctx.stroke();
        for(let k=0;k<8;k++) {
          const a=k*6.283/8, x=job.to.x+Math.cos(a)*238, y=cy+Math.sin(a)*160*gy;
          const h=42+(liveMotion()?Math.sin(elapsed*1.5+k)*8:0);
          upright(x,y,()=>{
            const g=ctx.createLinearGradient(x,y-h,x,y);
            g.addColorStop(0,'rgba(80,210,255,0)');g.addColorStop(1,`rgba(100,235,255,${alpha*0.13})`);
            ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x-18,y-h);ctx.lineTo(x+18,y-h);ctx.lineTo(x+7,y);ctx.closePath();ctx.fill();
          });
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
          upright(p.x,p.y,()=>{
            const maxElimW = 64;
            if (UI.fitText) {
              UI.fitText(ctx, answerText, p.x, p.y + 6, maxElimW, {
                minSize: 11,
                wrap: true,
                y1: p.y + 1,
                y2: p.y + 12
              });
            } else {
              ctx.fillText(answerText, p.x, p.y + 6);
            }
            ctx.strokeStyle = "#e57373";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p.x - 16, p.y - 16); ctx.lineTo(p.x + 16, p.y + 16);
            ctx.moveTo(p.x + 16, p.y - 16); ctx.lineTo(p.x - 16, p.y + 16);
            ctx.stroke();
          });
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
      // Experience crystals float upright above their ground contact point.
      RENDERER.drawGemShadow?.(g);
      upright(g.x, g.y, () => RENDERER.drawSpiritGem(g, elapsed));
    }

    // 技能的貼地圖案（淨化靈陣等）畫在所有角色之前，才會被角色蓋住。
    if (sacredSanctuary && sacredSanctuary.life > 0) {
      const lifeNorm = sacredSanctuary.life / (sacredSanctuary.maxLife || 1.8);
      const alpha = Math.min(0.92, lifeNorm * 1.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      const sr = sacredSanctuary.r, sx = sacredSanctuary.x, sy = sacredSanctuary.y;
      const SQ = 0.6 / tiltK(); // 程序圓的 2D 扁率；螢幕縱向 = k × (0.6/k)
      const mandalaArt = window.ART?.barrier_mandala_ukiyoe;
      const coreArt = window.barrierCoreArt?.(5);
      if (coreArt?.naturalWidth > 0 && coreArt?.naturalHeight > 0) {
        const tier = window.barrierArtTier?.(5) || {scale:1.18,alpha:0.90};
        // Preserve the world-ground transform; only vary painted width/opacity.
        ctx.globalAlpha = tier.alpha * Math.min(1,lifeNorm*1.3);
        const width = sr*2.15*tier.scale;
        const height = width*coreArt.naturalHeight/coreArt.naturalWidth;
        const breathe = 1 + Math.sin(elapsed*2.3)*0.016*liveMotion();
        ctx.translate(sx,sy);
        ctx.rotate(liveMotion()?elapsed*.10:0);
        ctx.scale(breathe,breathe);
        ctx.drawImage(coreArt,-width/2,-height/2,width,height);
        ctx.restore();
      } else if (window.ONMYO_VFX?.seal) {
        // Ground-space taiji/bagua diagram. The world camera alone applies perspective.
        window.ONMYO_VFX.seal(ctx,sx,sy,sr,elapsed,5,alpha);
        ctx.restore();
      } else if (mandalaArt?.naturalWidth > 0 && mandalaArt?.naturalHeight > 0) {
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
        upright(tx, ty, () => {
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
        });
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
      const age=zone.maxLife-zone.life,fade=Math.max(0,Math.min(0.84,zone.life/1.0,age/0.30));
      const pulse=animateGroundHeat?1+Math.sin(age*7.5)*0.024:1;
      const gy=1/tiltK();
      const w=zone.r*2.1*pulse,h=zone.r*1.23*gy*(animateGroundHeat?1+Math.sin(age*6.2)*0.02:1);
      ctx.save();ctx.globalAlpha=fade;
      const art=window.ART?.dragon_burning_ground_l5;
      if(art?.naturalWidth>0){
        ctx.drawImage(art,zone.x-w/2+(animateGroundHeat?Math.sin(age*3.5)*2:0),zone.y-h/2,w,h);
      }else{
        ctx.fillStyle='rgba(185,53,17,0.38)';
        ctx.beginPath();ctx.ellipse(zone.x,zone.y,zone.r,zone.r*0.53*gy,0,0,6.283);ctx.fill();
      }
      // Ink-like secondary motion without a costly whole-screen distortion shader.
      for(let i=0;i<(animateGroundHeat?6:0);i++){
        const a=i*2.4,fx=zone.x+Math.cos(a)*zone.r*0.65,fy=zone.y+Math.sin(a)*zone.r*0.29*gy;
        const sway=Math.sin(age*5+i*1.75)*8,rise=(age*21+i*13)%23;
        upright(fx,fy,()=>{
        ctx.strokeStyle='rgba(252,164,64,0.28)';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(fx-7,fy+4);
        ctx.quadraticCurveTo(fx+sway,fy-8-rise*0.3,fx+sway*0.7+7,fy-19-rise*0.6);ctx.stroke();
        ctx.fillStyle='rgba(255,201,114,0.42)';
        ctx.beginPath();ctx.arc(fx+sway*0.45,fy-4-rise,1.8+Math.sin(age*8+i)*0.5,0,6.283);ctx.fill();
        });
      }
      ctx.restore();
    }
    SKILLFX.drawArtFx?.(ctx, true);

    for (const e of enemies) if (e.hp > 0 && e.hazard && nearView(e.hazard.x, e.hazard.y, 480)) {
      if (e.hazard.kind === "shiome") drawShiomeWave(e.hazard);
      else drawBossHazard(e.hazard);
    }

    // 7. 依腳底地面接觸點排序；北側角色被屋頂遮住，南側角色在屋前。
    const actors = [
      ...houses.filter(houseSeen).map(h => ({ house: h, y: h.y + 48 })),
      ...enemies.filter(e => nearView(e.x, e.y)).map(e => ({ enemy: e, y: e.y + (e.type === "boss" ? 44 : e.type === "mis" ? 27 : 19) })),
      ...LAMPS.filter(l => nearView(l.x, l.y)).map(l => ({ lamp: l, y: l.y + 8 })),
      { player: P, y: P.y + 20 },
      // Single continuous scenery pass at EVERY tilt. No cached↔live toggle.
      ...activeChunks.flatMap(chunk => [
        ...(STAGE.id === "sakura-pass" || !chunk.decor?.torii ? [] : [{torii:chunk,y:chunk.y+chunk.h/2+36}]),
        ...(STAGE.id === "sakura-pass" ? [] : (chunk.decor?.sakuraTrees||[])).map(tree=>({tree,y:tree.y})),
        ...(chunk.decor?.ancientSakura || []).map(tree => ({ ancient: tree, y: tree.y })),
        ...((STAGE.id === "rain-port" && chunk.decor?.port?.props) || []).map(prop => ({ port: prop, y: prop.y }))
      ]).filter(actor => actor.torii
        ? nearView(actor.torii.x+actor.torii.w/2,actor.y,140)
        : actor.ancient ? houseSeen(actor.ancient)
        : actor.port ? nearView(actor.port.x, actor.port.y, 160)
        : nearView(actor.tree.x,actor.tree.y,140))
    ];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.torii || actor.tree || actor.ancient) RENDERER.drawDecorActor?.(actor,P.y);
      else if (actor.port) RENDERER.drawPortProp?.(actor.port, P.y);
      else if (actor.house) {
        RENDERER.drawHouseShadow?.(actor.house);
        upright(actor.house.x,actor.house.y+46,()=>RENDERER.drawHouse(actor.house,P.y));
      } else if (actor.enemy) {
        const e = actor.enemy;
        ctx.save();
        if (e.vanish != null) ctx.globalAlpha = Math.max(0, Math.min(1, e.vanish));
        RENDERER.drawMonsterShadow?.(e);
        upright(e.x,e.y,()=>RENDERER.drawMonster(e, P, elapsed));
        if(e.freezeT>0) upright(e.x,e.y,()=>SKILLFX.paint(ctx,'ice',5,{x:e.x,y:e.y,boss:e.type==='boss'}));

        ctx.restore();
      } else if (actor.lamp) {
        const l = actor.lamp;
        const lampLightY = l.y - 22;
        RENDERER.drawLampShadow?.(l);
        const lamp = window.ART && window.ART.prop_lantern;
        upright(l.x, l.y + 8, () => {
          if (lamp && lamp.complete && lamp.naturalWidth) {
            const lw = 44;
            const lh = lw * lamp.naturalHeight / lamp.naturalWidth;
            RENDERER.drawScenerySprite?.(lamp, l.x - lw / 2, l.y - lh + 8, lw, lh);
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
      } else {
        const movement = move();
        RENDERER.drawPlayerShadow?.(P, elapsed, movement);
        upright(P.x,P.y,()=>drawCargo()); // 貨物在直立角色後方
        upright(P.x,P.y,()=>RENDERER.drawPlayer(P, dashT > 0, P.inv, elapsed, movement, b.shield || 0, playerAttackPoseT > 0, playerHurtPoseT > 0));
      }
    }

    // 8. 武器彈幕（飛行或黏在目標身上的符咒）
    for (const q of proj) upright(q.x,q.y,()=>
      SKILLFX.paint(ctx, "boom", q.level??WL.boom, { x: q.x, y: q.y, spin: elapsed * (q.stuck ? 4 : 16), age:q.t, life:q.stuck ? 1 : q.life, exitAlpha:1 }));

    // Lv1–3 僅環繞、Lv4 三火脫離追擊；MAX 六火常駐並召喚黑龍。
    if (WL.fire > 0) {
      const fireSpec = resolveAttackSpec("fire", WL.fire, getBuildState());
      const count = fireSpec.count;
      const rx = fireSpec.rx, ry = fireSpec.ry;
      const awaySlots = new Set(ghosts.filter(p=>p.fireAttack&&p.life>0&&p.level===WL.fire).map(p=>p.slot));
      for (let i = 0; i < count; i++) {
        if (awaySlots.has(i)) continue;
        const a = fAng + (i * 6.283) / count;
        const fx=P.x+Math.cos(a)*rx,fy=P.y+Math.sin(a)*ry;
        upright(fx,fy,()=>SKILLFX.paint(ctx, "fire", WL.fire, {
          x:fx, y:fy, ang:a, origin:P, orbitR:rx, orbitRy:ry, rx, ry, time:elapsed+i*.2, orbit:true
        }));
      }
    }

    // 12.5 破魔靈針彈幕
    for(const p of ghosts)if(!p.dragon)
      upright(p.x,p.y,()=>SKILLFX.paint(ctx,"ghost",p.level??5,p));
    for (const nd of needles)
      upright(nd.x,nd.y,()=>SKILLFX.paint(ctx,"needle",nd.level??WL.needle,
        { x:nd.x,y:nd.y,ang:Math.atan2(nd.vy,nd.vx) }));

    // 13. 斬擊弧與結界擊中環 — impact rings belong to the ground plane.
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
      uprightHere(t.x,t.y);
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
        ctx.save();uprightHere(h.x,h.y+46);
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
        ctx.save();uprightHere(h.x,h.y+46);
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
        ctx.save();uprightHere(p.x,p.y);
        const meaning=job.showMeaningT>0 && job.ans[i]===job.word;
        ctx.strokeStyle='#fff4dd';ctx.lineWidth=2.5;
        const text=job.rev?job.ans[i].zh:job.ans[i].jp, y=p.y+(meaning?0:8);
        ctx.font=job.rev?UI.readableFont(31,'700'):sceneAnswerFont(33);
        const ready=job.rev || UI.answerFontReady(text,31,'700');
        if(ready){
          ctx.fillStyle=job.eliminatedIdx===i?'#888899':'#161224';
          const maxPadW = 190;
          if (UI.fitText) {
            UI.fitText(ctx, text, p.x, y, maxPadW, {
              minSize: 18,
              wrap: true,
              stroke: true,
              y1: meaning ? p.y - 7 : p.y - 1,
              y2: meaning ? p.y + 7 : p.y + 15
            });
          } else {
            ctx.strokeText(text,p.x,y);
            ctx.fillText(text,p.x,y);
          }
        }
        if(meaning){ctx.font=UI.readableFont(13,'bold');ctx.fillStyle='#d84315';ctx.strokeText(`【${job.ans[i].zh}】`,p.x,p.y+19);ctx.fillText(`【${job.ans[i].zh}】`,p.x,p.y+19);}
        ctx.restore();
      });ctx.restore();
    }

    // 15.5 委託氣泡與接案標籤（最上層繪製，確保永不被建築、角色、怪物或陰影遮擋）
    for (const o of orders) {
      const h = o.from;
      const floatY = h.y - 128 + Math.sin(elapsed * 3.5 + h.phase) * 4 * liveMotion();
      const isTarget = (inter === o);

      ctx.save();uprightHere(h.x,h.y+46);
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
        ctx.save();uprightHere(h.x,h.y+46);
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
    tiltWorld(cam,shakeOffset);
    FX.draw(ctx, cam, view);
    SKILLFX.drawArtFx?.(ctx, false);
    // 妖刀手繪刀氣屬於自發光前景：夜色遮罩後再合成，保持浮世繪青白與金色筆觸。
    for(const p of winds)
      upright(p.x,p.y,()=>SKILLFX.paint(ctx,"wind",5,p));
    // 黑龍改由 HUD 上層合成，避免再次被羅盤、提燈及任務 UI 蓋住。
    // The projectile floats above the world, separate from the ground fire.
    for(const shot of dragonShots){
      if(!nearView(shot.x,shot.y,120))continue;
      upright(shot.x,shot.y,()=>{
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
      });
    }
    RENDERER.drawSlashArcs();
    ctx.restore();
    FX.drawFlash(ctx, viewBounds());

    // 16.5 中景流動夜霧視差層 (Midground Volumetric Mist, 0.45x)
    RENDERER.drawMistParallax?.(visualElapsed, DAWN, cam);

    // 17. 櫻花雨與夜行幽火
    const motion = liveMotion();
    RENDERER.drawAtmosphere(visualElapsed, Math.round((STAGE_VISUAL.petals ?? 0) * 0.6 * motion), Math.round((STAGE_VISUAL.fireflies ?? 0) * 0.6 * motion));

    // 敵方火彈自發光，放在夜色與雨霧之上，避免遠距離攻擊被壓暗。
    ctx.save();
    tiltWorld(cam,shakeOffset);
    for (const eb of enemyBullets) upright(eb.x,eb.y,()=>{
      ctx.fillStyle = "#ba68c8";
      ctx.beginPath();ctx.arc(eb.x, eb.y, 8, 0, 6.28);ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();ctx.arc(eb.x, eb.y, 3.5, 0, 6.28);ctx.fill();
    });
    ctx.restore();

    ctx.save();
    tiltWorld(cam,shakeOffset);
    for (const e of enemies) {
      const h = e.hazard;
      if (!(e.hp > 0 && h) || !nearView(h.x, h.y, 480)) continue;
      if (h.kind === "slam") {
        upright(h.x, h.y, () => {
          ctx.fillStyle = "#fff0cb";
          ctx.font = UI.readableFont(16, "900");
          ctx.textAlign = "center";
          ctx.fillText("砸地！離開紅圈", h.x, h.y + 8);
        });
      } else if (h.kind === "tide" && h.phase === "telegraph") {
        const ang = h.angle || 0, cos = Math.cos(ang), sin = Math.sin(ang);
        const sx = h.x - sin * (h.safeOffset || 0), sy = h.y + cos * (h.safeOffset || 0);
        upright(sx, sy, () => {
          ctx.fillStyle = "#d7f6ff";
          ctx.font = UI.readableFont(16, "900");
          ctx.textAlign = "center";
          ctx.fillText("潮來！站上亮帶", sx, sy);
        });
      }
    }
    ctx.restore();

    // 破曉後若配達已完成（第一關破曉即可），使用與送貨金箭頭不同的赤色雙箭頭追蹤最終大妖鬼。
    const bossHunt = elapsed >= DAWN && (STAGE.id === "night-town" || delivered >= GOAL_DELIVERIES) && !finalBossDefeated;
    const bossTarget = bossHunt ? enemies.find(e => e.type === "boss" && e.final && e.hp > 0) : null;
    if (bossTarget) {
      const huntScreen = window.VIEWPORT?.worldToScreen
        ? window.VIEWPORT.worldToScreen(bossTarget.x, bossTarget.y, cam, shakeOffset)
        : { x: bossTarget.x - cam.x + shakeOffset.x, y: (bossTarget.y - cam.y + shakeOffset.y) * tiltK() };
      const sx = huntScreen.x;
      const sy = huntScreen.y;
      const onScreen = sx >= viewBounds().left + 70 && sx <= viewBounds().right - 70 && sy >= viewBounds().top + 90 && sy <= viewBounds().bottom - 70;
      ctx.save();
      ctx.strokeStyle = "#ff3b4f";
      ctx.fillStyle = "#ff3b4f";
      ctx.lineWidth = 4;
      if (onScreen) {
        const pulseR = 58 + Math.sin(elapsed * 8) * 7;
        // Already screen-space: no inverse world scale here.
        ctx.beginPath();
        ctx.arc(sx, sy - 30, pulseR, 0, 6.28);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.font = UI.readableFont(16, "900");
        const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
        const bMarker = bossTarget.title || story?.bossTitle || "大妖鬼";
        ctx.fillText(bMarker, sx, sy - 100);
      }
      ctx.restore();
    }

  }

  function drawDragonHudOverlay(shakeOffset = {x:0,y:0}) {
    const cam = RENDERER.getCam();
    ctx.save();
    tiltWorld(cam,shakeOffset);
    for (const dragon of ghosts) if (dragon.dragon && dragon.life>0)
      upright(dragon.x,dragon.y,()=>SKILLFX.paint(ctx,"ghost",5,dragon));
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
    if ((isPortrait() && state !== "overworld" && state !== "menu") || document.hidden) return;
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
        e.preventDefault();const buttons=UI.codexButtons(codexTab,codexPage,codexWords().length,wordCodexState());
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
    if (e.code === 'KeyV' && !action && !e.repeat) { e.preventDefault(); toggleViewMode(); return; }
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
    if (frameError || document.hidden || document.hasFocus?.() === false) return;
    if (isPortrait() && state === "play") return;
    AUDIO.setSuspended(false);
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

  function noteLoadingGesture(e) {
    if (state !== "overworld") return;
    const p = pp(e);
    const enter = window.OVERWORLD.enterButton?.() || window.OVERWORLD.ENTER_BTN;
    const here = window.OVERWORLD.selectedNode(overworld);
    if (enter && here && window.OVERWORLD.isEnterable(here) && hitButton(p, enter)) confirmOverworld();
  }
  function disabledWordReplay(e) {
    if (state !== "codex" || codexTab !== "words" || typeof UI.codexButtons !== "function") return false;
    const p = pp(e);
    const button = UI.codexButtons("words", codexPage, codexWords().length, wordCodexState()).find(b => hitButton(p, b));
    return !!(button && button.id === "replay" && button.disabled);
  }

  function levelUpLayout() {
    const custom = typeof UI.levelUpLayout === "function" ? UI.levelUpLayout(choices.length) : null;
    const baseCard = { x: 90, y: 176, w: 720, h: 108, gap: 14 };
    const card = custom && custom.card
      ? {
          x: typeof custom.card.x === "number" ? custom.card.x : baseCard.x,
          y: typeof custom.card.y === "number" ? custom.card.y : baseCard.y,
          w: typeof custom.card.w === "number" ? custom.card.w : baseCard.w,
          h: typeof custom.card.h === "number" ? custom.card.h : baseCard.h,
          gap: typeof custom.card.gap === "number" ? custom.card.gap : baseCard.gap
        }
      : baseCard;
    const reroll = custom && custom.reroll && typeof custom.reroll.x === "number" ? custom.reroll : UI.REROLL_BTN;
    return { card, reroll };
  }

  function hitLevelUpCard(p) {
    if (!p) return -1;
    const { card } = levelUpLayout();
    const count = choices.length;
    for (let i = 0; i < count; i++) {
      const rowY = card.y + i * (card.h + card.gap);
      if (p.x >= card.x && p.x <= card.x + card.w && p.y >= rowY && p.y <= rowY + card.h) {
        return i;
      }
    }
    return -1;
  }

  function hitLevelUpReroll(p) {
    if (!p) return false;
    const { reroll: btn } = levelUpLayout();
    return !!(btn && hitButton(p, btn));
  }

  let mapDrag = null;
  document.getElementById("game-container").addEventListener("pointerdown", e => {
    e.preventDefault();
    if (frameError) { recoverFrameError(); return; }
    if (disabledWordReplay(e)) return;
    AUDIO.init();
    if ((isPortrait() && state !== "overworld" && state !== "menu") || document.hidden) return;
    if (state === "overworld" && artPending()) noteLoadingGesture(e);
    if (artPending()) return;
    cv.setPointerCapture(e.pointerId);
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

    // Instant 2D / 2.5D toggle. Do not let this touch start a movement joystick.
    if (state === 'play' && hitButton(p, btnView)) {
      toggleViewMode();
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
      const button=UI.codexButtons(codexTab,codexPage,codexWords().length,wordCodexState()).find(b=>hitButton(p,b));
      if(button){if(!button.disabled)selectCodex(button.id);return;}

      // 單字頁的返回鈕已在圖鑑 hitbox 裡，並回到 codexBack。舊的固定返回區只留給秘術頁。
      if (codexTab === "words") return;
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

      const enter = window.OVERWORLD.enterButton?.() || window.OVERWORLD.ENTER_BTN;
      const here = window.OVERWORLD.selectedNode(overworld);
      if (window.OVERWORLD.isEnterable(here) && hitButton(p, enter)) {
        confirmOverworld();
        return;
      }

      // 地圖自由拖曳與節點點選分離：pointerdown 僅記錄起始點，不立即觸發節點移動
      mapDrag = {
        id: e.pointerId,
        startX: p.x,
        startY: p.y,
        lastX: p.x,
        lastY: p.y,
        dragged: false
      };
      return;
    }
    if (state === 'menu' || state === 'won' || state === 'lost') {
      const btn = menuButtons().find(b => hitButton(p, b));
      if (btn) { menuFocus = menuButtons().findIndex(b=>b.id===btn.id); activateWithFeedback(btn.id); }
      return;
    }
    if (state === "levelup") {
      const hitIndex = hitLevelUpCard(p);
      if (hitIndex >= 0) {
        levelupFocus = hitIndex;
        pickUp(hitIndex);
        return;
      }
      if (hitLevelUpReroll(p)) reroll();
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
    if (state === "overworld" && mapDrag && mapDrag.id === e.pointerId) {
      const p = pp(e);
      const dx = p.x - mapDrag.lastX, dy = p.y - mapDrag.lastY;
      mapDrag.lastX = p.x;
      mapDrag.lastY = p.y;
      if (Math.hypot(p.x - mapDrag.startX, p.y - mapDrag.startY) > 6) {
        mapDrag.dragged = true;
      }
      if (mapDrag.dragged && window.OVERWORLD?.pan) {
        window.OVERWORLD.pan(overworld, -dx, -dy);
      }
      return;
    }
    if (state === "levelup" && e.pointerType === "mouse") {
      const hitIndex = hitLevelUpCard(pp(e));
      if (hitIndex >= 0) levelupFocus = hitIndex;
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
      const p=pp(e),button=UI.codexButtons(codexTab,codexPage,codexWords().length,wordCodexState()).find(b=>hitButton(p,b));
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
      if (disabledWordReplay(e)) return;
      if (joy?.id === e.pointerId) joy = null;
      if (state === "overworld" && mapDrag && mapDrag.id === e.pointerId) {
        const wasDragged = mapDrag.dragged;
        const p = pp(e);
        mapDrag = null;
        if (!wasDragged && ev === "pointerup") {
          // 純點擊（位移 <= 6px）：進行節點點選與移動
          const node = window.OVERWORLD?.hitTest(overworld, p.x, p.y);
          if (node) {
            if (node.id === overworld.currentId) {
              window.OVERWORLD.clearInspect(overworld);
              confirmOverworld();
            } else if (node.type === "stage" && !window.OVERWORLD.isEnterable(node)) {
              window.OVERWORLD.inspect(overworld, node.id);
            } else {
              const ok = window.OVERWORLD.moveTo(overworld, node.id);
              if (!ok && node.type === "stage") window.OVERWORLD.inspect(overworld, node.id);
            }
          }
        }
      }
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
    proj = []; needles = []; winds = []; ghosts = []; dragonShots = []; dragonScorches = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; splitblasts = []; duoShockwaves = []; inkfireMarks = []; enemyBullets = [];
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

  const stageChapter = () => {
    const s = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
    if (s && typeof s.chapter === "number") return s.chapter;
    const idx = Object.keys(window.CONTENT.STAGES).indexOf(STAGE.id);
    return idx < 3 ? 1 : idx < 6 ? 2 : 3;
  };
  // HUD 需要的即時資料：武器冷卻比例、Boss、連擊與附近委託房屋（小地圖用）。
  function hudExtra(time) {
    const cd = {};
    if (WL.katana > 0) cd.katana = clamp((atkT - 0.1) / Math.max(0.01, wMax.katana - 0.1), 0, 1);
    for (const k of ["barrier", "needle", "boom", "thunder", ...(WL.fire===5?["fire"]:[])]) if (WL[k] > 0) cd[k] = clamp(wT[k] / wMax[k], 0, 1);
    const guideTarget = job ? job.to : orders.reduce((n, o) => (!n || dist(P, o.from) < dist(P, n) ? o.from : n), null);
    const bossHunting = elapsed >= DAWN && (STAGE.id === "night-town" || delivered >= GOAL_DELIVERIES) && !finalBossDefeated;
    const huntTarget = bossHunting ? enemies.find(e => e.type === "boss" && e.final && e.hp > 0) : null;
    const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
    const bossTitle = huntTarget?.title || story?.bossTitle || "大妖";
    return {
      time, cd, houses, cam: RENDERER.getCam(),
      stageId: STAGE.id,
      bossTitle,
      lanternHit: clamp(lanternHitT / 0.42, 0, 1),
      // 固定在任務區旋轉的方向箭頭：送貨／取貨目標（金），破曉後的大妖（赤雙箭頭）。
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
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    rainLoad = dt > 0.034 ? Math.min(2.2, rainLoad + 0.35) : Math.max(1, rainLoad - 0.12);
    const previousTilt = tiltK();
    const previousZoom = window.VIEWPORT?.worldZoom?.() || 1;
    window.VIEWPORT?.advanceTilt?.(dt);
    const currentTilt = tiltK();
    const currentZoom = window.VIEWPORT?.worldZoom?.() || 1;
    const liveRun = state === "play" || state === "pause" || state === "levelup"
      || (state === "codex" && (codexBack === "play" || codexBack === "pause" || codexBack === "levelup"));
    if ((previousTilt !== currentTilt || previousZoom !== currentZoom) && liveRun) {
      const camera = RENDERER.getCam();
      const next = window.VIEWPORT?.reanchor?.(P, camera, previousTilt, previousZoom, currentTilt, currentZoom);
      if (next) RENDERER.setCam(next.x, next.y);
    }
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

    if (pendingDepart && state === "overworld" && !artPending()) {
      pendingDepart = false;
      confirmOverworld();
    }
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
      const story = window.STORY && typeof window.STORY.get === "function" && window.STORY.get(STAGE.id);
      runSummary = {
        prevBest,
        newBest: score > prevBest,
        elapsedSeconds: elapsed,
        goal: GOAL_DELIVERIES,
        stageName: STAGE.name,
        learning: learningSummary(),
        clearText: story?.clear || null,
        chapter: stageChapter(),
        chapterTitle: story?.chapterTitle || null,
        bossTitle: story?.bossTitle || null
      };
      STORE.finish(STAGE.id, score, delivered, state === "won");
    }
    if (state === "play") titleCardT = Math.max(0, titleCardT - dt);
    const screen = state === "codex" ? lastScreen : state === "menu" ? "menu" : state === "overworld" ? "map" : state === "won" || state === "lost" ? "end" : "run";
    const uiScreen = state === "overworld" ? "map" : state === "menu" ? "menu" : "other";
    if (document.body?.dataset && document.body.dataset.gameScreen !== uiScreen) document.body.dataset.gameScreen = uiScreen;
    if (screen !== lastScreen) { lastScreen = screen; fadeT = FADE_TIME; }
    fadeT = Math.max(0, fadeT - dt);

    const v = window.VIEWPORT?.get() || {offsetX:0,offsetY:0};
    const pixelScale = (v.scale || 1) * RENDERER.getDpr();
    ctx.setTransform(pixelScale, 0, 0, pixelScale, v.offsetX * pixelScale, v.offsetY * pixelScale);

    const bounds = window.VIEWPORT?.hudBounds() || viewBounds();
    btnPause.x = bounds.right - btnPause.w - Math.max(0, (44 / (window.VIEWPORT?.get().scale || 1) - btnPause.w) / 2);
    btnPause.y = bounds.top + 14;
    btnView.x = bounds.right - btnView.w - 1;
    btnView.y = btnPause.y + btnPause.h + 12;
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
      frameShakeOffset = RENDERER.getShakeOffset();
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
        const bossHunt = elapsed >= DAWN && (STAGE.id === "night-town" || delivered >= GOAL_DELIVERIES) && !finalBossDefeated;
        UI.drawHud(
          ctx, P, oil, maxOil, elapsed, DAWN, delivered, failed, score, level, xp, xpNeed(),
          job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, GOAL_DELIVERIES,
          dashCd, dashMax, bossHunt, hudExtra(now / 1000)
        );
        if (state === 'play') UI.drawButton(ctx, btnView,
          (window.VIEWPORT?.tiltTargetScale?.() ?? tiltK()) === 1 ? '2.5D' : '2D', {size: 13, quiet: true, scrollText: false});
        if (surgeWarningT > 0) UI.drawSurgeWarning(ctx, surgeWarningT);
        if (state === "play") drawDragonHudOverlay(frameShakeOffset);
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
      if (codexTab === "words" && window.CARD_GALLERY_UI && typeof UI.wordGallery === "function") {
        applyWordCodex({ type: "page", delta: 0 });
      } else {
        const lastPage=codexTab==='cards'?Math.ceil(UI.CARD_LIST.length/UI.codexRows())-1:Math.ceil(codexWords().length/15)-1;
        codexPage=clamp(codexPage,0,Math.max(0,lastPage));
      }
      UI.drawCodex(ctx, STORE, codexWords(), codexTab, codexPage, codexBack === "play" || codexBack === "pause", codexFocus, wordCodexState());
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

  if (window.DEV_MODE && typeof window.DEV_MODE.isDevMode === "function" && window.DEV_MODE.isDevMode(location)) {
    window.DEV_TOOLS = window.DEV_MODE;
    const nodes = window.OVERWORLD && window.OVERWORLD.STAGE_NODES;
    const asked = new URLSearchParams(location.search).get("stage");
    window.DEV_MODE.mountDevPanel(document, {
      dev: true,
      nodes,
      preselect: asked || "",
      getStage: id => window.CONTENT.getStage(id),
      onEnter(id) {
        start(id);
        if (document.documentElement && document.documentElement.dataset) {
          document.documentElement.dataset.devStage = STAGE.id;
        }
      }
    });
  }

  requestAnimationFrame(frame);
})();
