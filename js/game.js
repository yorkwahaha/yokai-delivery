(() => {
  "use strict";

  const W = 900, H = 600;
  const CFG = window.GAME_CONFIG;
  // 小怪難度單一來源：CFG.resolveMobDifficultyProfile(stage)（B 線接口）。
  // 保留 MOB_DIFFICULTY_PROFILES 名稱供既有測試探針讀取；預設值與原 inline 表 parity。
  const MOB_DIFFICULTY_PROFILES = CFG.MOB_DIFFICULTY_PROFILES;
  function mobDifficultyForStage(stage) {
    return CFG.resolveMobDifficultyProfile(stage);
  }
  let STAGE = window.CONTENT.getStage("night-town");
  if (typeof window !== "undefined") {
    window.__ACTIVE_STAGE = STAGE.id;
    if (typeof window.STAGE_ART_RESOLVER !== "undefined" && typeof window.STAGE_ART_RESOLVER.setActiveStage === "function") {
      window.STAGE_ART_RESOLVER.setActiveStage(STAGE.id);
    }
  }
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

  // 屋列距離（已批准口徑）：沿「沿途所有真 chunk」的 houses，以 50px X 列去重、兩端不計。
  // 與 WORLD.update 的 50px X 去重同口徑，不是距離除常數；只數房屋的 X 列，不看高低排。
  // 關鍵：必須先以「房屋 x 嚴格介於兩端」過濾、再做 50px 去重。
  // 若先對整段 span 去重再回頭比對 x，端點房屋自己的 X 列會因 50px 取整而被誤算進去
  // （例如端點 191→200、1610→1600 會被算成兩列），於是 2 屋列被當成 4 屋列。
  function houseColumnsBetween(x1, x2) {
    const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
    const xs = new Set();
    if (!runBounds || !WORLD_STATE) return 0;
    const cx0 = Math.floor(lo / WORLD_STATE.chunkWidth), cx1 = Math.floor(hi / WORLD_STATE.chunkWidth);
    const cy0 = Math.floor(runBounds.minY / WORLD_STATE.chunkHeight), cy1 = Math.floor(runBounds.maxY / WORLD_STATE.chunkHeight);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const chunk = WORLD_STATE.getChunk(cx, cy);
        if (!chunk || !chunk.houses) continue;
        for (const h of chunk.houses) {
          if (h.x > lo && h.x < hi) xs.add(Math.round(h.x / 50) * 50);
        }
      }
    }
    return xs.size;
  }

  // 配送完成後的狀態生命週期：把仍待取貨、但取貨點離「剛送達點」太近的委託就地重選取貨屋。
  // 只動尚未被玩家取貨的委託（不在手上、也不是當下互動中的那一張）；重選不到就保留原委託，
  // 寧可維持原委託也不會發一張同屋／過近的取貨。
  function rerollPickupsTooCloseTo(referenceX, minCols = 3, minDx = 700, maxDx = 3600) {
    if (STAGE.id !== "rain-port" || referenceX === null || referenceX === undefined) return;
    const heldFrom = new Set();
    if (job?.from?.id != null) heldFrom.add(job.from.id);
    if (inter?.from?.id != null) heldFrom.add(inter.from.id);
    // Reserve every pending pickup BEFORE any reroll. Keep counts so releasing
    // one order never makes another order's original house appear available.
    const reserved = new Map();
    const reserve = id => {
      if (id != null) reserved.set(id, (reserved.get(id) || 0) + 1);
    };
    const release = id => {
      if (id == null) return;
      const remaining = (reserved.get(id) || 0) - 1;
      if (remaining > 0) reserved.set(id, remaining);
      else reserved.delete(id);
    };
    for (const o of orders) reserve(o?.from?.id);
    for (const id of heldFrom) reserve(id);
    const colsBetween = (a, b) => houseColumnsBetween(a, b);
    for (const o of orders) {
      if (!o?.from) continue;
      const oldId = o.from.id;
      if (heldFrom.has(oldId)) continue; // 手上／正在互動的委託不動
      const duplicate = (reserved.get(oldId) || 0) > 1;
      if (!duplicate && colsBetween(o.from.x, referenceX) >= minCols) continue;
      release(oldId); // Temporarily release ONLY this order, not other reservations.
      const cands = houses.filter(h => {
        if (!h || h.id === oldId) return false;
        if (o.to && h.id === o.to.id) return false;
        if ((reserved.get(h.id) || 0) > 0) return false;
        const dx = Math.abs(h.x - referenceX);
        if (dx < minDx || dx > maxDx) return false;
        // 重選後仍要守住原本的送達距離（取貨屋與送達屋不得貼在一起）
        if (o.to && Math.abs(h.x - o.to.x) < minDx) return false;
        return colsBetween(h.x, referenceX) >= minCols;
      });
      if (!cands.length) {
        // No legal, unused house: cancel this pending order rather than
        // emit a duplicate pickup. makeOrder() can replace it next frame.
        orders = orders.filter(x => x !== o);
        continue;
      }
      const sameWord = cands.filter(h => o.word && h.word && h.word.jp === o.word.jp);
      const next = sameWord.length ? sameWord : cands;
      o.from = next[Math.floor(Math.random() * next.length)];
      reserve(o.from.id); // Next order must exclude the newly selected house.
    }
  }

  // ---------- Stage / Word Pack / Chunk 世界 ----------
  const worldSpacingScaleY = () => window.VIEWPORT?.spacingScaleY?.() || 1;
  let WORLD_STATE = window.WORLD.createStageWorld(STAGE, window.CONTENT,
    {spacingScaleY:worldSpacingScaleY()});
  const houses = [], solids = [], LAMPS = [], activeChunks = [];
  // rain-port 戰鬥帶共享引用：syncWorld 賦值，blocked/spawnPosition/camera 直接讀取
  let runBounds = null;
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
  const blocked = (x, y, r = 18) => {
    // rain-port：直接用 runBounds 做半徑判 Y，涵蓋任意 X（真無限 X）
    if (runBounds) {
      if (y - r < runBounds.minY || y + r > runBounds.maxY) return true;
    }
    return solids.some(s => Math.hypot(x - clamp(x, s.x0, s.x1), y - clamp(y, s.y0, s.y1)) < r);
  };
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
  // 結界題目假名統一使用完整的 Noto Sans JP 日文字體，消除 fallback font 混入與字距不一致
  const sceneAnswerFont = size => UI.floorAnswerFont ? UI.floorAnswerFont(size) : UI.answerFont(size, "400");
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
  let menuFocus = 0, menuFocusState = "menu", gpMenuDir = "", pausePage = "main";
  let levelupFocus = 0, gpLevelupDir = "";
  let gpFusionDir = 0;
  let charmSwapIndex = 0, gpCharmDir = 0;
  let pendingMenuActivation = null;
  let quitTarget = "home";
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
    if (state === "pause") return UI.pauseButtons(pausePage);
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
    else if (id === "world" && state === "pause") { quitConfirm = true; quitTarget = "world"; menuFocus = 0; }
    else if (id === "world") enterOverworld(false);
    else if (id === "resume") togglePause();
    else if (id === "settings" || id === "pause-back") {
      pausePage = id === "settings" ? "settings" : "main";
      menuFocus = 0;
    }
    else if (id === "mute") AUDIO.toggleMute();
    else if (id === "controls") controlsButton.click();
    else if (id === "tutorial") showTutorial('pickup', true);
    else if (id === "exit-cancel") { quitConfirm = false; quitTarget = "home"; menuFocus = 0; }
    else if (id === "exit-confirm") {
      const toWorld = quitTarget === "world";
      quitTarget = "home";
      returnHome();
      if (toWorld) enterOverworld(false);
    }
    else if (id === "menu") {
      if (state === "pause") { quitConfirm = true; quitTarget = "home"; menuFocus = 0; }
      else returnHome();
    }
    else if (id === "cards" || id === "codex") { codexBack = state; selectCodex(id === "cards" ? "cards" : "words"); state = "codex"; }
    else if (typeof id === "string" && id.startsWith("review-")) {
      const button = (menuButtons() || []).find(item => item.id === id);
      if (button?.word?.jp) AUDIO.speak(button.word.jp);
    }
  }
  const OVERWORLD_LAST_KEY = "yokai.overworld.lastNode";
  function loadOverworldNode() {
    try { return localStorage.getItem(OVERWORLD_LAST_KEY) || "gate"; } catch (_) { return "gate"; }
  }
  function saveOverworldNode() {
    try { if (overworld?.currentId) localStorage.setItem(OVERWORLD_LAST_KEY, overworld.currentId); } catch (_) {}
  }
  let overworld = window.OVERWORLD.createState("gate");
  let overworldExitArmT = 0;
  let pendingDepart = false;
  let overworldNoticeT = 0;
  let gpOverworldDir = "";
  let elapsed = 0, animElapsed = 0, warnDawnT = 0, oil = 100, maxOil = 100, level = 1, xp = 0, score = 0, delivered = 0, failed = 0;
  let lastDeliveryX = null;
  let orders = [], job = null, enemies = [], enemyBullets = [], gems = [], texts = [], rings = [], misses = [];
  let deliveryEventSeq = 0;
  // 變異是稀有可選的強化，而非每次升級強塞的選項。
  let lastMutationOfferLevel = -100;
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
  let seals = 0, sealsEarned = 0, sealsSpent = 0, study = null;
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
    if (delivered > 0 && delivered % CFG.AWAKEN_EVERY === 0) {
      sealsEarned++;
      // Current held seals = earned - spent; no cap on earned, cap on held is implicit via spending
      seals = sealsEarned - sealsSpent;
    }
  }
  function awakeningState() {
    const every = CFG.AWAKEN_EVERY;
    const maxEarned = CFG.AWAKEN_MAX;
    return {
      seals, earned: sealsEarned, spent: sealsSpent,
      nextIn: every - (delivered % every),
      maxEarned,
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
      // 第三王沒有答題護盾，不能跟前兩王一律減半；825 HP 仍低於尾王 910 HP。
      hp = Math.round(hp * (role === "final" ? 0.65 : role === "gate" ? 0.75 : 0.5));
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
  const wMax = { katana: 0.72, barrier: 3, needle: 1, boom: 2, thunder: 2.6, fire: 1.1, fusion_inkblade: 1.8, fusion_foxiai: 1.6, fusion_exorcistblade: 1.7, fusion_foxfirebarrier: 2.5, fusion_exorcistseal: 2.0, fusion_thundercircle: 2.2, fusion_slashwheel: 2.0, fusion_foxthunderlantern: 2.4, fusion_flamefestival: 2.2, fusion_thundertalisman: 2.4 };
  let orderT = 0, spawnT = 0, atkT = 0, dashT = 0, dashCd = 0, hintT = 0, nameT = 0, endCooldown = 0, lanternHitT = 0;
  let playerAttackPoseT = 0, playerHurtPoseT = 0; // 視覺專用計時，不影響武器冷卻／碰撞
  let dashDir = { x: 1, y: 0 };
  let choices = [], levelupCooldown = 0, joy = null, touch = window.matchMedia?.("(pointer: coarse)")?.matches || false, inter = null, cargo = { x: 0, y: 0 }, pTrail = [], last = performance.now();
  const btnE = { x: 810, y: 420, r: 38 }, btnD = { x: 810, y: 530, r: 46 };
  const btnFusionHeld = { id: 'fusion-reopen', x: 810, y: 310, r: 36 };
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
  // 終王排程到期但前面的大妖仍存活時的等待計時；逾時強制出場，避免卡關。
  const FINAL_BOSS_WAIT_MAX = 45, FINAL_BOSS_HINT_EVERY = 12;
  let finalBossWaitT = 0, finalBossHintT = 0;
  let finalBossPos = null, finalBossEnt = null, victorySeq = null;

  function checkVictoryCondition() {
    if (!finalBossDefeated) return false;
    // 尾王死後立即達成勝利，不需等到 10:00
    if (STAGE && STAGE.id === "night-town") {
      return true;
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
      UI.selectSecretDetail?.(null);
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
    if (codexTab === 'cards' && id.startsWith('secret:')) { UI.selectSecretDetail?.(id.slice(7)); codexFocus = 'secret-back'; return; }
    if (id === 'secret-back') { UI.selectSecretDetail?.(null); codexFocus = 'cards'; return; }
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
    if (typeof window !== "undefined") {
      window.__ACTIVE_STAGE = STAGE.id;
      if (typeof window.STAGE_ART_RESOLVER !== "undefined" && typeof window.STAGE_ART_RESOLVER.setActiveStage === "function") {
        window.STAGE_ART_RESOLVER.setActiveStage(STAGE.id);
      }
    }
    MOB_DIFFICULTY = mobDifficultyForStage(STAGE);
    STAGE_PACING = STAGE.pacing || {};
    STAGE_VISUAL = STAGE.visual || {};
    STAGE_ENEMY = STAGE.enemy || {};
    const sourceStart = STAGE.start || { x: 1350, y: 900 };
    START = {x:sourceStart.x,y:sourceStart.y*worldSpacingScaleY()};
    // The original rain-port start at y=900 is outside the 180..780 walkable belt.
    // Correct only the opt-in S2 art test, without moving the deployed gameplay start.
    if (STAGE.id === "rain-port" && window.isS2ArtProdEnabled?.()) START.y = 480;
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
    // rain-port 戰鬥帶 Y 邊界（minY..maxY），其他關為 null —— 共享 let runBounds
    runBounds = snapshot.bounds;
    // 燈籠腳底 solid：腳點在 l.y+8，寬 44，供碰撞/避障/no-spawn 使用
    // 不新增燈籠、不改圖，只用既有 WORLD lamps 列表
    const lampSolids = LAMPS.filter(l => l.collidable !== false).map(l => ({
      x0: l.x - 22,
      x1: l.x + 22,
      y0: l.y + 8 - 22,
      y1: l.y + 8 + 22,
      chunkKey: l.chunkKey || null,
      isLamp: true
    }));
    // 合併到 solids（house 優先，燈籠補足），避免重複位置常數
    solids.push(...lampSolids);
    // 不再用巨寬 solid 偽裝無限 X；blocked 直接用 runBounds 做半徑判 Y
    worldSyncSignature = signature;
  }
  const WL = { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0, fusion_inkblade: 0, fusion_foxiai: 0, fusion_exorcistblade: 0, fusion_foxfirebarrier: 0, fusion_exorcistseal: 0, fusion_thundercircle: 0, fusion_slashwheel: 0, fusion_foxthunderlantern: 0, fusion_flamefestival: 0, fusion_thundertalisman: 0 };
  let buildRevision = 1;
  let buildMutations = [];
  let buildCharms = [];
  let charmLevels = {};
  let charmDrops = [];
  let charmDropSeq = 0;
  let pendingCharmOffer = null;
  let charmSwapHits = [];
  let buildDuos = [];
  let fusionToken = null;
  let fusionFocus = 0;
  let fusionEffects = []; fusionEffects._idCounter = 0;
  fusionEffects._idCounter = 0;
  let fusionStats = { casts: 0, directDmg: 0, scorchDmg: 0, byKind: {} };
  let pendingFusionCompensation = false;
  let isFreeCompensationChoice = false;
  let fusionOpenedEpoch = 0;
  let fusionOpenedRevision = 0;

  const CHARM_CONFIG = {
    charm_power: {
      id: "charm_power",
      n: "力紋守",
      s: "りきもん",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "對已持有技能增加小幅基礎傷害（+0.20）；次級傷害不再次乘算",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_step: {
      id: "charm_step",
      n: "風步守",
      s: "かぜあるき",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "提升移動速度（+28 px/s），採單一集中參數；無穿牆、無無敵",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_gather: {
      id: "charm_gather",
      n: "招靈守",
      s: "しょうれい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "擴大靈玉拾取吸收半徑（+75 px）；不增產量、不自動完成送貨",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_cadence: {
      id: "charm_cadence",
      n: "疾奏守",
      s: "しっそう",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針攻擊冷卻小幅縮短（有效頻率 +0.25）；保留每招冷卻下限與 Lv5 固有節奏，不加速雷雲、火龍或時鐘",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_reach: {
      id: "charm_reach",
      n: "遠霞守",
      s: "とおがすみ",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_guard: {
      id: "charm_guard",
      n: "紙甲守",
      s: "かみよろい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "受創燈油損失減少 10%；護盾與無敵優先判定，小傷不歸零、不回油，不減免答題扣油",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
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
      d: "多角度散射、發數增加；整輪名目總傷害提高 20%（單發按發數分配）",
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
      d: "靈針單次折返，回程可對原目標額外命中一次，造成原傷害35%，不重複冰封",
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
      d: "靈陣保持原半徑，兩次脈衝各65%原傷害，完整命中總傷增加30%",
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
      d: "狐火改為偏心橢圓軌道（rx=126, ry=78），接觸傷害+20%，Lv5黑龍傷害+15%，火球數不變",
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
    // Legacy DUO resonance skills (Lv3-based) — quarantined from normal level-up pool per R9 rules.
    // New rule: all true fusion/奧義 require 2 parents Lv5 + valid ema + dedicated fusion menu.
    // These four legacy duos are preserved for code guard/compatibility but MUST NOT appear in standard pool.
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
      inPool: false
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
      inPool: false
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
      inPool: false
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
      inPool: false
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

  const CHARM_IDS = ["charm_power", "charm_step", "charm_gather", "charm_cadence", "charm_reach", "charm_guard"];
  const CHARM_MAX_LEVEL = 3;
  const CHARM_SLOT_MAX = 3;
  const CHARM_DROP_CAP = 24;
  const CHARM_DROP_LIFE = 45;
  const CHARM_DROP_PICKUP = 42;
  const CHARM_NORMAL_CHANCE = 0.008;
  const CHARM_ELITE_CHANCE = 0.008;
  const CHARM_DROP_ART = "hud_omamori_hint_listen";

  function addCharm(id) {
    if (!CHARM_CONFIG[id]) return false;
    if (buildCharms.includes(id)) return false;
    if (buildCharms.length >= CHARM_SLOT_MAX) return false;
    buildCharms.push(id);
    charmLevels[id] = 1;
    buildRevision++;
    return true;
  }

  function removeCharm(id) {
    const idx = buildCharms.indexOf(id);
    if (idx >= 0) {
      buildCharms.splice(idx, 1);
      delete charmLevels[id];
      buildRevision++;
      return true;
    }
    return false;
  }

  function resetCharmRun() {
    buildCharms = [];
    charmLevels = {};
    charmDrops = [];
    charmDropSeq = 0;
    pendingCharmOffer = null;
    charmSwapIndex = 0;
    gpCharmDir = 0;
    charmSwapHits = [];
    // 重開／重置若發生在換守確認中，pending 已清空，必須把狀態放回 play，
    // 否則 update 不會跑（state !== play early return），整局會卡死在換守畫面。
    if (state === "charmswap") state = "play";
  }

  // 沒有 charmLevels 的舊 buildState 把已持有御守視為 Lv1，保住原本數值。
  function charmLevelOf(id, buildState = null) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    if (!charms.includes(id)) return 0;
    const table = (buildState && buildState.charmLevels && typeof buildState.charmLevels === "object")
      ? buildState.charmLevels
      : (buildState ? null : charmLevels);
    if (!table) return 1;
    const raw = table[id];
    const lv = Number.isFinite(raw) ? Math.floor(raw) : 1;
    return Math.max(1, Math.min(CHARM_MAX_LEVEL, lv));
  }

  function charmDropChance(e) {
    if (!e || e.type === "boss" || e.type === "mis") return 0;
    // DEV-ONLY: 供使用者自行驗證御守拾取與 3-slot 替換流程；正式環境嚴格維持 0.008
    if (typeof window !== "undefined" && /(?:^|[?&])dev=1(?=[&#]|$)/.test(window.location?.search || "") &&
        (window.DEV_FORCE_CHARM || /(?:^|[?&])force_charm=1(?=[&#]|$)/.test(window.location?.search || ""))) {
      return 1.0;
    }
    if (e.elite === true || e.rank === "elite" || e.type === "tank") return CHARM_ELITE_CHANCE;
    return CHARM_NORMAL_CHANCE;
  }

  function charmDropArt() {
    const resolver = typeof window !== "undefined" ? window.STAGE_ART_RESOLVER : null;
    let meta = null;
    if (resolver && typeof resolver.getSharedArt === "function") {
      meta = resolver.getSharedArt("hud", CHARM_DROP_ART);
      if (!meta || meta.status !== "APPROVED") return null;
    }
    const art = window.ART && window.ART[meta?.id || CHARM_DROP_ART];
    if (!art || !art.complete || !(art.naturalWidth > 0) || !(art.naturalHeight > 0)) return null;
    return art;
  }

  function spawnCharmDrop(x, y, charmId) {
    while (charmDrops.length >= CHARM_DROP_CAP) charmDrops.shift();
    const drop = {
      id: ++charmDropSeq,
      charmId,
      x, y,
      life: CHARM_DROP_LIFE
    };
    charmDrops.push(drop);
    return drop;
  }

  function tryRollCharmDrop(e) {
    if (!e || e.charmRolled) return null;
    e.charmRolled = true;
    const chance = charmDropChance(e);
    if (!(chance > 0)) return null;
    if (Math.random() >= chance) return null;
    const charmId = CHARM_IDS[Math.floor(Math.random() * CHARM_IDS.length) % CHARM_IDS.length];
    return spawnCharmDrop(e.x, e.y, charmId);
  }

  function paintCharmDrop(d) {
    const art = charmDropArt();
    if (!d) return false;
    const w = 40;
    const h = (art && art.naturalHeight) ? (w * art.naturalHeight / art.naturalWidth) : 48;
    upright(d.x, d.y, () => {
      // 落地御守專用金芒光環，即便在暗處街道亦清晰可辨
      FX.glow?.(ctx, d.x, d.y - h / 2, 28, "#fadb5f", 0.45);
      if (art && art.naturalWidth > 0) {
        ctx.drawImage(art, d.x - w / 2, d.y - h, w, h);
      } else {
        // 御守錦囊繪製（紅錦囊 + 金邊紋）
        ctx.save();
        ctx.fillStyle = "#c82d33";
        ctx.beginPath();
        ctx.roundRect(d.x - 14, d.y - 36, 28, 36, [4, 4, 2, 2]);
        ctx.fill();
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("守", d.x, d.y - 14);
        ctx.restore();
      }
    });
    return true;
  }

  function charmViewList() {
    return buildCharms.slice(0, CHARM_SLOT_MAX).map(id => ({
      id,
      name: CHARM_CONFIG[id]?.n || id,
      level: charmLevelOf(id),
      maxLevel: CHARM_MAX_LEVEL
    }));
  }

  function charmPendingView() {
    if (!pendingCharmOffer) return null;
    const id = pendingCharmOffer.id;
    return { id, name: CHARM_CONFIG[id]?.n || pendingCharmOffer.name || id, level: 1 };
  }

  function openCharmSwap(id) {
    pendingCharmOffer = { id, name: CHARM_CONFIG[id]?.n || id };
    charmSwapIndex = 0;
    gpCharmDir = 0;
    state = "charmswap";
    keys.clear();
    heldCodes.clear();
    joy = null;
  }

  function closeCharmSwap() {
    pendingCharmOffer = null;
    charmSwapIndex = 0;
    gpCharmDir = 0;
    if (state === "charmswap") state = "play";
  }

  function resolveCharmSwap(action) {
    if (state !== "charmswap" || !pendingCharmOffer) return false;
    if (action === "cancel") {
      // 返回：不丟棄，把御守放回腳邊；離開拾取範圍再靠近才會重新詢問。
      const drop = spawnCharmDrop(P.x, P.y, pendingCharmOffer.id);
      drop.holdUntilLeave = true;
      closeCharmSwap();
      return true;
    }
    if (action === "discard") {
      say(`放棄 ${pendingCharmOffer.name}`, P.x, P.y - 45, "#ffe9a0");
      closeCharmSwap();
      return true;
    }
    const index = action === "confirm" ? charmSwapIndex : action;
    if (!Number.isInteger(index) || index < 0 || index >= buildCharms.length || index >= CHARM_SLOT_MAX) return false;
    const incoming = pendingCharmOffer.id;
    const removed = buildCharms[index];
    buildCharms[index] = incoming;
    if (removed && removed !== incoming) delete charmLevels[removed];
    charmLevels[incoming] = 1;
    buildRevision++;
    say(`換上 ${CHARM_CONFIG[incoming]?.n || incoming}`, P.x, P.y - 45, "#ffe9a0");
    closeCharmSwap();
    return true;
  }

  function acceptCharm(id) {
    if (!CHARM_CONFIG[id]) return "invalid";
    if (buildCharms.includes(id)) {
      const lv = charmLevelOf(id);
      if (lv >= CHARM_MAX_LEVEL) return "max";
      charmLevels[id] = lv + 1;
      buildRevision++;
      say(`${CHARM_CONFIG[id].n} Lv${charmLevels[id]}`, P.x, P.y - 45, "#ffe9a0");
      return "upgrade";
    }
    if (buildCharms.length >= CHARM_SLOT_MAX) return "swap";
    buildCharms.push(id);
    charmLevels[id] = 1;
    buildRevision++;
    say(`拾取 ${CHARM_CONFIG[id].n}`, P.x, P.y - 45, "#ffe9a0");
    return "equip";
  }

  function updateCharmDrops(dt) {
    for (const d of charmDrops) {
      d.life -= dt;
      if (d.life <= 0 || dist(P, d) > GEM_DISTANCE) {
        d.done = true;
        continue;
      }
      if (pendingCharmOffer || state !== "play") continue;
      if (d.holdUntilLeave) {
        if (dist(P, d) >= CHARM_DROP_PICKUP * 1.5) d.holdUntilLeave = false;
        continue;
      }
      if (dist(P, d) >= CHARM_DROP_PICKUP) continue;
      const result = acceptCharm(d.charmId);
      if (result === "swap") {
        d.done = true;
        openCharmSwap(d.charmId);
        continue;
      }
      if (result !== "invalid") {
        d.done = true;
        HAPTICS.pickup?.();
      }
    }
    if (charmDrops.length > CHARM_DROP_CAP) charmDrops.splice(0, charmDrops.length - CHARM_DROP_CAP);
    charmDrops = charmDrops.filter(d => !d.done);
  }

  function charmGuardOilLoss(amount) {
    const lv = charmLevelOf("charm_guard");
    if (lv <= 0) return amount;
    const mul = 1 - 0.10 * lv;
    return Math.min(amount, Math.max(Number.MIN_VALUE, parseFloat((amount * mul).toPrecision(12))));
  }

  function getEffectiveDmg(buildState = null) {
    const powerBonus = charmLevelOf("charm_power", buildState) * 0.20;
    return (b.dmg || 1) + powerBonus;
  }

  function getEffectiveMoveSpeed(buildState = null) {
    // 神足草履只計 b.spd×35；風步守只計每級 +28。兩段相加，不把御守乘進草履層數。
    const stepBonus = charmLevelOf("charm_step", buildState) * 28;
    return 230 + (b.spd || 0) * 35 + stepBonus;
  }

  function getEffectiveMagnetRadius(buildState = null) {
    const gatherBonus = charmLevelOf("charm_gather", buildState) * 75;
    // 第二關 Normal 可移動中拾取經驗，不影響第一關或原 Hard。
    const portNormalBonus = STAGE.id === "rain-port" && STAGE.pacing?.mobDifficulty !== "hard" ? 70 : 0;
    return magnetRadius(b.mag) + portNormalBonus + gatherBonus;
  }

  function getEffectiveRate(buildState = null) {
    const cadenceBonus = charmLevelOf("charm_cadence", buildState) * 0.25;
    return (b.rate || 0) + cadenceBonus;
  }

  function getEffectiveReachMultiplier(buildState = null) {
    const lv = charmLevelOf("charm_reach", buildState);
    return lv > 0 ? 1 + 0.10 * lv : 1.0;
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
      WL: { ...WL },
      ownedActiveCount: activeSkills.length,
      charms: [...buildCharms],
      charmLevels: Object.fromEntries(buildCharms.map(id => [id, charmLevelOf(id)])),
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
      const perShotScale = hasFan ? Number(((rawCount * 1.20) / count).toFixed(4)) : 1.0;
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
      const pulseScale = hasPulse ? 0.65 : 1.0;
      const radius = baseRadius;
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
      const contactDamage = Number(((1.2 + level * 0.6) * baseDmg * (hasOrbit ? 1.20 : 1)).toFixed(4));
      const attackCount = window.EVOLUTIONS?.fireAttackCount ? window.EVOLUTIONS.fireAttackCount(level) : [0, 0, 0, 1, 0][Math.max(0, Math.min(4, level - 1))];
      const spiritDamage = Number(((2.1 + (level || 1) * 0.9) * baseDmg).toFixed(4));
      const spiritCooldown = window.EVOLUTIONS?.fireAttackCooldown ? window.EVOLUTIONS.fireAttackCooldown(level) : [2.5, 2.2, 1.9, 1.55, 1.05][Math.max(0, Math.min(4, level - 1))];
      const cooldown = isAwakened ? 7.2 : spiritCooldown;
      const dragonDirectDmg = Number((12 * baseDmg * (hasOrbit ? 1.15 : 1)).toFixed(4));
      const dragonSplashDmg = Number((4 * baseDmg * (hasOrbit ? 1.15 : 1)).toFixed(4));
      const dragonScorchDmg = Number((1.8 * baseDmg * (hasOrbit ? 1.15 : 1)).toFixed(4));
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
      const damage = hasFan ? ((baseDamage * baseCount * 1.20) / count) : baseDamage;
      const splashDamage = hasFan ? ((baseSplashDamage * baseCount * 1.20) / count) : baseSplashDamage;

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
    // 融合武器：墨焰斬
    if (skillId === "fusion_inkblade") {
      const isAwakened = true; // 融合武器即為覺醒狀態
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const baseReach = 280;
      const reach = Math.round(baseReach * reachMult);
      // Lv5 妖刀＋狐火的融合不應比原妖刀明顯變慢或變弱。
      const cooldown = 0.70;
      const slashDmg = Number((baseDmg * 6.5).toFixed(2));
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasCrosscut = mutations.includes("mut_crosscut");
      const crosscutDmg = Number((baseDmg * 1.5).toFixed(2));
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + (buildState?.passives?.crit ?? b.crit ?? 0) * 0.15);
      return {
        skillId: "fusion_inkblade",
        level: 1,
        isAwakened: true,
        reach,
        cooldown,
        slashDmg,
        arc: 2.0, // 114.6度扇形 (2.0 rad)
        maxTargets: 7,
        scorchDuration: 2.5,
        scorchRadius: 80,
        critChance,
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷狐居合
    if (skillId === "fusion_foxiai") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxiai",
        level: 1,
        isAwakened: true,
        reach: Math.round(360 * reachMult),
        hitWidth: 64,
        cooldown: 1.6,
        warn: 0.18,
        damage: Number((baseDmg * 21).toFixed(2)),
        maxTargets: 4,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：退魔符刃
    if (skillId === "fusion_exorcistblade") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_exorcistblade",
        level: 1,
        isAwakened: true,
        reach: Math.round(240 * reachMult),
        arc: 1.6,
        cooldown: 1.7,
        warn: 0.1,
        slashDmg: Number((baseDmg * 14).toFixed(2)),
        burstDmg: Number((baseDmg * 8).toFixed(2)),
        burstRadius: 72,
        markDelay: 0.28,
        maxTargets: 4,
        burstMaxTargets: 3,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：妖火結界
    if (skillId === "fusion_foxfirebarrier") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxfirebarrier",
        level: 1,
        isAwakened: true,
        radius: Math.round(150 * reachMult),
        cooldown: 2.5,
        warn: 0.12,
        duration: 1.75,
        pulses: 4,
        pulseInterval: 0.35,
        firstPulse: 0.12,
        damage: Number((baseDmg * 8).toFixed(2)),
        maxTargets: 6,
        knockback: 70,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：退魔封陣
    if (skillId === "fusion_exorcistseal") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_exorcistseal",
        level: 1,
        isAwakened: true,
        castRange: Math.round(190 * reachMult),
        radius: Math.round(110 * reachMult),
        cooldown: 2.0,
        warn: 0.35,
        duration: 1.15,
        pulses: 4,
        pulseInterval: 0.15,
        firstPulse: 0.35,
        damage: Number((baseDmg * 7.5).toFixed(2)),
        maxTargets: 6,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：斬界輪（妖刀＋靈陣）
    if (skillId === "fusion_slashwheel") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_slashwheel",
        level: 1,
        isAwakened: true,
        cooldown: 1.65,
        expandTime: 0.45,
        radius: Math.round(320 * reachMult),
        bands: [
          { at: Math.round(150 * reachMult), damage: Number((baseDmg * 9).toFixed(2)), maxTargets: 5 },
          { at: Math.round(320 * reachMult), damage: Number((baseDmg * 6.5).toFixed(2)), maxTargets: 5 }
        ],
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：狐雷天燈（狐火＋天狐雷）
    if (skillId === "fusion_foxthunderlantern") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxthunderlantern",
        level: 1,
        isAwakened: true,
        cooldown: 1.65,
        count: 4,
        lockRange: Math.round(390 * reachMult),
        strikeRadius: 82,
        warn: 0.12,
        damage: Number((baseDmg * 12).toFixed(2)),
        maxTargets: 4,
        splashScale: 0.65,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：炎符祭（狐火＋陰陽符）
    if (skillId === "fusion_flamefestival") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_flamefestival",
        level: 1,
        isAwakened: true,
        cooldown: 2.2,
        count: 4,
        range: Math.round(320 * reachMult),
        landRadius: 62,
        damage: Number((baseDmg * 7).toFixed(2)),
        maxTargets: 3,
        warn: 0.18,
        emberTicks: 2,
        emberInterval: 0.35,
        emberRadius: 48,
        emberDamage: Number((baseDmg * 3).toFixed(2)),
        emberMaxTargets: 2,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷符神罰（天狐雷＋陰陽符）
    // 新機制：一個主 AOE 爆炸（五枚雷符落定各自判定），每個被命中的敵人額外再受一次「既有天狐雷判定」傷害
    if (skillId === "fusion_thundertalisman") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      // 計算「既有天狐雷」單次傷害：覺醒等級用 8.0 倍率
      const thunderMult = 8.0;
      const thunderDamage = Number((thunderMult * baseDmg).toFixed(4));
      return {
        skillId: "fusion_thundertalisman",
        level: 1,
        isAwakened: true,
        cooldown: 2.4,
        count: 5,
        range: Math.round(300 * reachMult),
        strikeRadius: 70,
        warn: 0.36,
        damage: Number((baseDmg * 6.5).toFixed(2)), // 主爆炸傷害
        maxTargets: 4,
        // 新：每名命中敵人額外承受一次天狐雷傷害（去重、Boss倍率、不無限連鎖）
        thunderTickDamage: thunderDamage,
        thunderTickRadius: Math.round(450 * reachMult), // 天狐雷覺醒半徑
        thunderTickBossScale: 0.5, // Boss 承受天狐雷傷害的倍率
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷陣封界（靈陣＋天狐雷；陣域脈衝＋定點警示落雷）
    if (skillId === "fusion_thundercircle") {
      const isAwakened = true;
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const cooldown = 1.65;
      const radius = Math.round(265 * getEffectiveReachMultiplier(buildState));
      const pulseInterval = 0.42;
      const pulseCount = 4;
      const pulseDamage = baseDmg * 4.0;
      const pulseRadius = 104;
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + (buildState?.passives?.crit ?? b.crit ?? 0) * 0.15);
      return {
        skillId: "fusion_thundercircle",
        level: 1,
        isAwakened: true,
        cooldown,
        radius,
        pulseInterval,
        pulseCount,
        pulseDamage,
        pulseRadius,
        pulseWarning: 0.12, // 首波雷擊同步視覺，避免原本 0.5 + 0.6 秒的空窗
        critChance,
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
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
    needle: { id: "needle", jp: "せんぼん", zh: "天狐靈針", type: "active", category: "高速靈針", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪" },
    // 融合武器（十組 registry；全部都有真攻擊 consumer）
    fusion_inkblade: { id: "fusion_inkblade", jp: "ぼくえんざん", zh: "墨焰斬", type: "active", category: "融合・扇形斬", desc: "大型扇形墨焰斬，命中留下短暫地面灼燒；妖刀與狐火共鳴覺醒" },
    fusion_foxiai: { id: "fusion_foxiai", jp: "らいこいあい", zh: "雷狐居合", type: "active", category: "融合・雷斬", desc: "短預警後前向線性雷斬，穿過有限目標，每 cast 同敵一次" },
    fusion_exorcistblade: { id: "fusion_exorcistblade", jp: "たいまふとう", zh: "退魔符刃", type: "active", category: "融合・符刃", desc: "前向刀斬附符印、有限延遲符爆，命中與符爆各自快照" },
    fusion_foxfirebarrier: { id: "fusion_foxfirebarrier", jp: "ようかけっかい", zh: "妖火結界", type: "active", category: "融合・火域", desc: "施放點短時燃燒結界、有限週期脈衝，首碰擊退尋常妖怪" },
    fusion_exorcistseal: { id: "fusion_exorcistseal", jp: "たいまふうじん", zh: "退魔封陣", type: "active", category: "融合・封陣", desc: "前方固定落點預警後有限多段符爆陣，不永久控制 Boss" },
    fusion_thundercircle: { id: "fusion_thundercircle", jp: "らいじんふうかい", zh: "雷陣封界", type: "active", category: "融合・雷域", desc: "大型陣域脈衝定點引雷，在陣域內有節奏地多次擊中並可閃避警示；靈陣與天狐雷共鳴覺醒" },
    fusion_slashwheel: { id: "fusion_slashwheel", jp: "ざんかいりん", zh: "斬界輪", type: "active", category: "融合・斬環", desc: "高速擴散內外雙斬環，各環每敵一次；妖刀與靈陣共鳴覺醒" },
    fusion_foxthunderlantern: { id: "fusion_foxthunderlantern", jp: "こらいてんとう", zh: "狐雷天燈", type: "active", category: "融合・雷燈", desc: "三盞雷光燈籠鎖定目標、預警後定點落雷；狐火與天狐雷共鳴覺醒" },
    fusion_flamefestival: { id: "fusion_flamefestival", jp: "えんぷさい", zh: "炎符祭", type: "active", category: "融合・火符", desc: "四枚火符交錯飛散、依序引爆並留短燼；狐火與陰陽符共鳴覺醒" },
    fusion_thundertalisman: { id: "fusion_thundertalisman", jp: "らいふしんばつ", zh: "雷符神罰", type: "active", category: "融合・雷符", desc: "五枚雷符交錯落定、預警落雷並單次連鎖；天狐雷與陰陽符共鳴覺醒" },
  };

  const WEAPON_UPGRADES = {
    katana:["暖光單刃，斬擊前方妖怪","雙刃交叉，距離 +16、傷害 +0.8","三刃收束，距離與傷害再提升","蓄風四刃；下一階射出穿透風刃","覺醒・斷空殘月斬：世界距離 720、最多 6 體，前三全傷其後 ×0.75，冷卻下限 0.6 秒"],
    barrier:["展開單盤除魔陣，低傷害全方位攻擊","雙盤刻印，範圍擴大、傷害小幅提升","反轉雙盤，範圍與傷害再提升","蓄勢大陣，半徑 252，命中可震退敵人","覺醒・金剛退魔曼荼羅：半徑縮為 220，換 1.8 秒地面緩速；不回油、不聚怪"],
    fire:["一顆狐火環繞護身，僅接觸周遭妖怪","兩顆狐火環繞護身，不主動飛出","三顆狐火環繞護身，不主動飛出","三顆護火，其中一顆離體追敵後回歸","覺醒・墨焰黑龍：三顆護火，每 7.2 秒一條黑龍（露臉 1.5 秒＋退場後 5 秒）；不再離體。每次三球、五秒焦土最多三處"],
    boom:["單符黏附後延遲爆炸；本體全傷，周圍濺射並震退","一次擲出 2 枚符咒","三符齊射，冷卻縮短","四符齊射，爆炸範圍加大","覺醒・兩儀延爆：兩枚符咒，爆炸範圍最大"],
    thunder:["190 範圍內攻擊最近 1 隻，傷害 2 倍係數","270 範圍內同時攻擊 2 隻，傷害 3 倍係數","350 範圍內同時攻擊 3 隻，傷害 4.5 倍係數，不依生命秒殺","450 範圍內鎖定 3 個威脅，固定 6 倍係數","覺醒・建御雷神破界天罰：450 範圍內三朵雷雲，每朵半徑 90、8 倍係數"],
    needle:["三發靈針，貫穿前方妖怪","五發雙羽，傷害提升","七發三叉，傷害再提升","八星噴射；下一階弧線射出","覺醒・九尾極寒靈暴：八發追蹤冰針，單層殉爆最多再命中 3 隻，不連鎖"],
    // 融合武器升級描述（Lv1 即完成形，描述供圖鑑/確認畫面）
    fusion_inkblade:["融合・墨焰斬：大型扇形墨焰斬，命中留下短暫地面灼燒；妖刀與狐火共鳴覺醒","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・墨焰斬：扇形 114.6°、半徑 280、地面灼燒 2.5 秒、冷卻 1.2 秒、直接斬擊與地面焦痕雙段傷害"],
    fusion_thundercircle:["融合・雷陣封界：大型陣域脈衝定點引雷，在陣域內有節奏地多次擊中並可閃避警示","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷陣封界：陣域半徑 240、脈衝間隔 0.8 秒、落雷預警 0.6 秒、命中去重 0.3 秒"],
    fusion_foxiai:["融合・雷狐居合：短預警前向線性雷斬，穿過有限目標","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷狐居合：前向雷斬、每 cast 同敵一次、短預警、有限穿透"],
    fusion_exorcistblade:["融合・退魔符刃：前向斬附符印，短延遲符爆","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・退魔符刃：每 cast 斬擊與符爆快照分開，符爆上限 4 印"],
    fusion_foxfirebarrier:["融合・妖火結界：施放點短時燃燒結界","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・妖火結界：max1 域、4 段脈衝、首碰擊退尋常妖怪"],
    fusion_exorcistseal:["融合・退魔封陣：前方固定落點預警後多段符爆","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・退魔封陣：固定落點、有限多段符爆、Boss 不受永久控制"],
    fusion_slashwheel:["融合・斬界輪：高速擴散內外雙斬環","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・斬界輪：雙環各每敵一次、半徑 320、冷卻 2.0 秒"],
    fusion_foxthunderlantern:["融合・狐雷天燈：三盞雷光燈籠鎖定落雷","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・狐雷天燈：三燈各一擊、落點預警 0.5 秒、單燈最多 3 體"],
    fusion_flamefestival:["融合・炎符祭：四枚火符交錯引爆留燼","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・炎符祭：四符依序引爆、每符 2 次短燼、派生上限固定"],
    fusion_thundertalisman:["融合・雷符神罰：五枚雷符落定引雷連鎖","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷符神罰：五符各一擊、單次連鎖、Boss 不受控"],
  };

  let proj = [], needles = [], winds = [], ghosts = [], dragonShots = [], dragonScorches = [], crosscuts = [], barrierPulses = [], sacredSanctuary = null, splitblasts = [], duoShockwaves = [], inkfireMarks = [], surgeT = SURGE_FIRST, fAng = 0, fireEmitT = 0, fireSfxT = 0, fireAttackT = 0;
  let surgeWarningT = 0, surgePendingCount = 0, surgePendingTier = 1;
  const wT = { boom: 0, thunder: 0, barrier: 0, needle: 0, fire: 0, fusion_inkblade: 0, fusion_foxiai: 0, fusion_exorcistblade: 0, fusion_foxfirebarrier: 0, fusion_exorcistseal: 0, fusion_thundercircle: 0, fusion_slashwheel: 0, fusion_foxthunderlantern: 0, fusion_flamefestival: 0, fusion_thundertalisman: 0 };

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
    return `delivery:${STAGE.id}:${(window.CARD_DELIVERY && window.CARD_DELIVERY.SESSION_ID) || "s"}:${key}:${deliveryEventSeq}`;
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

    // rain-port：大幅拉長取件→送達水平距離（3~8棟房屋跨度，常見 4~7）
    // 房屋間距約 300~400px，目標水平跨度 900~3200px（常見 1200~2800）
    // 送達→下一取貨也拉開（3~6屋），遠近交錯、跨chunk不丟目標
    const isRainPort = STAGE.id === "rain-port";
    let from = null;

if (isRainPort) {
      // rain-port：取件點根據上次送達位置選擇（遠離上次送達點，3~8屋跨度，常見 4~7）
      const referenceX = lastDeliveryX !== null ? lastDeliveryX : P.x;
      const minH = 900, maxH = 3200, comMinH = 1200, comMaxH = 2800;
      // 最少中間屋數：3棟（硬性門檻），目標 4 棟
      const minBetweenHouses = 3;
      const targetBetweenHouses = 4;

      // 屋列口徑：已批准為「沿途所有真 chunk 的房屋、50px X 列去重、兩端不計」。
      // 原本只用「目前已載入 chunk」的 houses 計數，會漏算中間未載入的屋列，
      // 讓 2 屋列的取貨點被當成合格；這裡改用與驗收同一口徑的階段級屋列。
      const colsBetween = (a, b) => houseColumnsBetween(a, b);

      // 第一優先：按中間屋數篩選（硬性門檻）；同屋/同列因屋列數為 0 自然被排除
      let reachable = openHouses.filter(h => colsBetween(h.x, referenceX) >= minBetweenHouses);
      // 第二優先：在達到最少屋數的基礎上，偏好目標屋數範圍
      const preferred = reachable.filter(h => colsBetween(h.x, referenceX) >= targetBetweenHouses && colsBetween(h.x, referenceX) <= 8);
      // 第三優先：像素距離輔助篩選（避免過遠導致跨太多 chunk）
      const pixelFiltered = (preferred.length ? preferred : reachable).filter(h => {
        const dx = Math.abs(h.x - referenceX);
        return dx >= minH && dx <= maxH;
      });
      // 兜底：即使放寬像素距離，也必須守住同一條硬門檻（>=3 屋列，避免同屋/鄰屋/2 屋列）
      const fallback = openHouses.filter(h => {
        const dx = Math.abs(h.x - referenceX);
        return dx >= 700 && dx <= 3600 && colsBetween(h.x, referenceX) >= minBetweenHouses;
      });
      // Never prefer unlimited-distance matches over a bounded fallback.
      const pool = pixelFiltered.length ? pixelFiltered : fallback;

      if (!pool.length) return;

      // 從候選中按詞優先選取 from
      const matchingFrom = pool.filter(h => h.word && h.word.jp === chosenWord.jp);
      from = pick(matchingFrom.length ? matchingFrom : pool);
      if (!from) return;

      // 送達點：遠離取件點（3~8屋跨度，常見 4~7）
      const minH2 = 900, maxH2 = 3200, comMinH2 = 1200, comMaxH2 = 2800;
      const reachable2 = houses.filter(h => h !== from && Math.abs(h.x - from.x) >= minH2 && Math.abs(h.x - from.x) <= maxH2 && colsBetween(h.x, from.x) >= minBetweenHouses);
      const pool2 = reachable2.length ? reachable2 : houses.filter(h => h !== from && Math.abs(h.x - from.x) >= 700 && Math.abs(h.x - from.x) <= 3600 && colsBetween(h.x, from.x) >= minBetweenHouses);
      if (!pool2.length) return;
      const far2 = pool2.filter(h => Math.abs(h.x - from.x) >= comMinH2);
      const near2 = pool2.filter(h => Math.abs(h.x - from.x) < comMinH2);
      let to = null;
      // 降低近距離送達機率：15% -> 8%
      if (Math.random() < 0.08 && near2.length > 0) {
        to = pick(near2);
      } else if (far2.length > 0) {
        to = pick(far2);
      } else {
        to = pick(pool2);
      }
      if (!to || !chosenWord) return;
      orders.push({ from, to, word: chosenWord, rev: false, life: 110, cardEventId: nextDeliveryEventId(chosenWord) });
      return;
    }

    // 非 rain-port：原有邏輯
    const openHouses2 = candidateHouses.filter(h => !busy.has(h.id));
    const matching2 = openHouses2.filter(h => h.word && h.word.jp === chosenWord.jp);
    const from2 = pick(matching2.length ? matching2 : openHouses2);
    if (!from2) return;

    // 最低合理分隔提升至 580px，合理上限 1250px，確保取件→送達平均路程明顯拉高且不致過度漂移
    const reachable = houses.filter(h => h !== from2 && dist(h, from2) >= 580 && dist(h, from2) <= 1250);
    const pool = reachable.length ? reachable : houses.filter(h => h !== from2 && dist(h, from2) >= 420 && dist(h, from2) <= 1600);
    if (!pool.length) return;

    // 分隔層級：中長程（850–1250px，約 70%）與近路捷徑（580–850px，約 30%）
    const far = pool.filter(h => dist(h, from2) >= 850);
    const near = pool.filter(h => dist(h, from2) < 850);
    let to = null;
    if (Math.random() < 0.30 && near.length > 0) {
      to = pick(near);
    } else if (far.length > 0) {
      to = pick(far);
    } else {
      to = pick(pool);
    }
    if (!to || !chosenWord) return;
    orders.push({ from: from2, to, word: chosenWord, rev: false, life: 110, cardEventId: nextDeliveryEventId(chosenWord) });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      pausePage = "main";
      AUDIO.stopSpeech();
      RENDERER.clearShake();
      keys.clear(); heldCodes.clear();
      joy = null;
      window.dispatchEvent(new Event('gamepause'));
    } else if (state === "pause" && !isPortrait() && !document.hidden) {
      if (pausePage !== "main") { pausePage = "main"; menuFocus = 0; return; }
      state = "play";
      AUDIO.setSuspended(false);
      last = performance.now();
    }
  }

  function enterOverworld(reset = true) {
    window.loadMapArt?.();
    // 有進度（曾離開地圖時記下節點）就從上次位置繼續；新玩家仍從起點 gate 開始。
    if (reset) overworld = window.OVERWORLD.createState(loadOverworldNode());
    overworldExitArmT = 0;
    AUDIO.restartMusic();
    overworldNoticeT = 0;
    keys.clear(); heldCodes.clear();
    joy = null;
    gpOverworldDir = "";
    state = "overworld";
    // A journey map is intentionally browsable in portrait. Only active combat requires rotation.
    if (document.body?.dataset) document.body.dataset.gameScreen = "map";
  }

  // 地圖返回主選單需再按一次確認，避免手把 B（戰鬥中是衝刺）誤觸。
  function requestOverworldExit() {
    if (state !== "overworld") return;
    if (overworldExitArmT > 0) { overworldExitArmT = 0; saveOverworldNode(); returnHome(); return; }
    overworldExitArmT = 2.5;
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
    saveOverworldNode();
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

  function initFusionBridge() {
    if (!window.FUSION || typeof window.FUSION.bindGame !== "function") return;
    window.FUSION.bindGame({
      getEnv: () => ({
        stageId: STAGE?.id || "night-town",
        isRainPortNormal: STAGE?.id === "rain-port" && (STAGE?.pacing?.mobDifficulty !== "hard"),
        elapsed: typeof elapsed === "number" ? elapsed : 0,
        gameState: state,
        search: (typeof location !== "undefined" && location.search) || ""
      }),
      getBuildState: () => getBuildState(),
      getSkillMutations: (skillId) => getSkillMutations(skillId),
      commitTransaction: (tx) => {
        if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
          return { ok: false, error: "invalid_payload" };
        }
        for (const p of tx.parents) {
          if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
        }

        // 1. 父技能歸零並停止攻擊計時
        for (const p of tx.parents) {
          WL[p] = 0;
          wT[p] = 999999;
        }

        // 2. 裝備融合武器 (Lv1 完成態)
        WL[tx.fusionWeaponId] = 1;
        wT[tx.fusionWeaponId] = 0.32;
        window.prefetchFusionArt?.(tx.fusionWeaponId);
        wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
        buildRevision++;

        // 3. 停用來源父技能共鳴 (Duo)
        buildDuos = buildDuos.filter(d => {
          const cfg = DUO_CONFIG[d];
          if (!cfg) return true;
          return cfg.skillIds.every(s => (WL[s] || 0) > 0);
        });

        // 4. 清理來源父技能既有傷害投射與派生（其他技能投射保留）
        if (tx.parents.includes("katana")) {
          winds = [];
          crosscuts = [];
        }
        if (tx.parents.includes("fire")) {
          // ghosts 內含狐火護身、離體追敵與墨焰黑龍，全屬 fire 來源。
          ghosts = [];
          dragonShots = [];
          dragonScorches = [];
        }
        if (tx.parents.includes("barrier")) {
          barrierPulses = [];
          sacredSanctuary = null;
        }
        if (tx.parents.includes("thunder")) {
          duoShockwaves = [];
        }
        if (tx.parents.includes("boom")) {
          proj = [];
          splitblasts = [];
        }
        if (tx.parents.includes("katana") || tx.parents.includes("fire")) {
          inkfireMarks = [];
        }

        // 5. 變異補償標記
        if (tx.grantCompensation) {
          pendingFusionCompensation = true;
        }

        return { ok: true };
      },
      openUpgradeChoice: (opts) => {
        if (opts?.freeNonMutation) {
          isFreeCompensationChoice = true;
        }
        offerUp();
      },
      spawnGroundToken: (x, y) => {
        fusionToken = {
          x: Number.isFinite(x) ? x : P.x,
          y: Number.isFinite(y) ? y : P.y + 40,
          r: 36
        };
      }
    });
  }

  function start(stageId = STAGE.id) {
    quitConfirm = false;
    AUDIO.prepareMusic?.('play');
    AUDIO.restartMusic();
    window.loadGameArt?.();
    window.loadStageMapArt?.(stageId);
    // Reset S2 cache if switching away from rain-port or on fresh start
    if (STAGE.id === "rain-port" && stageId !== "rain-port") {
      window.resetS2ArtProdCache?.();
    }
    configureStage(stageId);
    if (STAGE.id === "rain-port") {
      window.refreshPortArt?.();
      // Load S2 production art assets if dev flag is enabled
      if (window.loadS2ArtProdAssets) window.loadS2ArtProdAssets();
      // Final S2 art comes from the processed RGBA/seam-locked manifest above,
      // not the model's uncropped RGB/white-matte scene files.
    }
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
    Object.assign(WL, { katana: 1, barrier: 0, fire: 0, boom: 0, thunder: 0, needle: 0, fusion_inkblade: 0, fusion_foxiai: 0, fusion_exorcistblade: 0, fusion_foxfirebarrier: 0, fusion_exorcistseal: 0, fusion_thundercircle: 0, fusion_slashwheel: 0, fusion_foxthunderlantern: 0, fusion_flamefestival: 0, fusion_thundertalisman: 0 });
    buildRevision++;
    buildMutations = [];
    resetCharmRun();
    buildDuos = [];

    // 融合系統重置與橋接更新
    fusionToken = null;
    fusionFocus = 0;
    fusionEffects = []; fusionEffects._idCounter = 0;
    fusionStats = { casts: 0, directDmg: 0, scorchDmg: 0, byKind: {} };
    pendingFusionCompensation = false;
    isFreeCompensationChoice = false;
    fusionOpenedEpoch = 0;
    fusionOpenedRevision = 0;
    window.devSpawnCharm = (charmId = "charm_power") => spawnCharmDrop(P.x + 40, P.y, charmId);
  initFusionBridge();
    if (window.FUSION && typeof window.FUSION.reset === "function") {
      window.FUSION.reset();
    }
    proj = []; needles = []; winds = []; ghosts = []; dragonShots = []; dragonScorches = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; splitblasts = []; duoShockwaves = []; inkfireMarks = []; enemyBullets = []; surgeT = SURGE_FIRST; surgeWarningT = 0; surgePendingCount = 0; surgePendingTier = 1;
    fAng = 0; fireEmitT = 0; fireSfxT = 0; fireAttackT = 0;
    wT.boom = 0; wT.thunder = 1; wT.barrier = 1.5; wT.needle = 0.5; wT.fire = 0; wT.katana = 0.3;
    for (const id of Object.keys(wT)) if (id.startsWith("fusion_")) wT[id] = 0;
    elapsed = 0; animElapsed = 0; warnDawnT = 0; oil = 100; maxOil = 100; level = 1; xp = 0; score = 0; delivered = 0; failed = 0;
    lastMutationOfferLevel = -100;
    orders = []; job = null; inter = null; enemies = []; gems = []; texts = []; rings = []; misses = [];
    // 重新開局／切關：上次送達點不得跨局殘留，否則新一局的第一張取貨會拿舊局的位置當基準。
    lastDeliveryX = null;
    learningStart = Object.fromEntries(Object.entries(STORE.data.m).map(([jp,m])=>[jp,{ok:m.ok,ng:m.ng,box:m.box}]));
    seals = 0; sealsEarned = 0; sealsSpent = 0; recallIndependent = 0; recallAssisted = 0;
    recallSources.delivery.independent = recallSources.delivery.assisted = 0;
    recallSources.boss.independent = recallSources.boss.assisted = 0;
    study = typeof STORE.createStudySession === "function" ? STORE.createStudySession(ALL) : null;
    FX.reset();
    SKILLFX.reset();
    rerolls = 2; titleCardT = 3; runSummary = null;
    bossStage = 0; bossT = BOSS_TIMES[0]; finalBossDefeated = false; finalBossWaitT = 0; finalBossHintT = 0; finalBossPos = null; finalBossEnt = null; victorySeq = null; lampSeq = null;
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
    // rain-port：開局將 P.y 夾在戰鬥帶內（安全半徑 18）
    if (runBounds) {
      const safeR = 18;
      P.y = Math.max(runBounds.minY + safeR, Math.min(runBounds.maxY - safeR, P.y));
      // 同步 cargo y
      cargo.y = P.y + 10;
    }
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
      if (k.startsWith("fusion_")) return false; // 融合武器不可由普通升級抽取
      if (window.FUSION && typeof window.FUSION.isSkillConsumed === "function" && window.FUSION.isSkillConsumed(k)) return false;
      if ((WL[k] || 0) >= 4) return false;
      if (WL[k] === 0 && !canLearnNew) return false;
      return true;
    });
    const awakenKeys = Object.keys(WI).filter(k => {
      if (k.startsWith("fusion_")) return false;
      if (window.FUSION && typeof window.FUSION.isSkillConsumed === "function" && window.FUSION.isSkillConsumed(k)) return false;
      return WL[k] === 4 && seals > 0;
    });

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
        if (nextLvl === 5) {
          seals--;
          sealsSpent++;
        }
        WL[k] = nextLvl;
        window.useSkillArt?.(k, WL[k]);
        if (k === "katana") { wT.katana = 0; atkT = 0; }
        if (k === "boom") wT.boom = 0;
        if (k === "barrier") wT.barrier = 0;
        if (k === "needle") wT.needle = 0;
        if (k === "fire" || k === "thunder") wT[k] = 0;
        if (k === "fire" && WL[k] === 5) AUDIO.preloadDragon?.();
        if (nextLvl === 5 && window.FUSION && typeof window.FUSION.onWeaponLevelUp === "function") {
          window.FUSION.onWeaponLevelUp();
        }
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

    // 奧義由獨立融合儀式視窗選擇；一般修行三選一永不塞入融合卡。
    const fc = [];

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

    // 變異選項：每技能最多 3 個變異；若為免費非變異補償選擇 (isFreeCompensationChoice)，則變異不進池
    const eligibleMutationKeys = isFreeCompensationChoice ? [] : Object.keys(MUTATION_CONFIG).filter(mutId => {
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

    // 25%機率提供最多1張變異，若已出現則接下來至少隔3級才會再出。
    // cc 與 dc 在下方才宣告，這裡不可前置讀取（會踩 TDZ）；
    // 只就已宣告的 awakenCard / wc / pc 判斷。
    const otherUpgradeAvailable = !!awakenCard || wc.length > 0 || pc.length > 0;
    const mutationOfferReady = otherUpgradeAvailable && eligibleMutationKeys.length > 0 && level - lastMutationOfferLevel >= 3 && Math.random() < 0.25;
    const mc = mutationOfferReady ? [mutationCard(pick(eligibleMutationKeys))] : [];

    // 六種 charm_* 只從地面拾取，升級卡池固定為空。
    const eligibleCharmKeys = [];

    const charmCard = (charmId) => {
      let consumed = false;
      const meta = CHARM_CONFIG[charmId];
      const choiceId = `charm:${charmId}`;

      const checkCharmEligibility = () => {
        if (consumed || scopeRevision !== buildRevision) return false;
        if (!meta || !meta.inPool) return false;
        if (buildCharms.includes(charmId)) return false;
        return buildCharms.length < CHARM_SLOT_MAX;
      };

      const applyCharmEffect = () => {
        if (!checkCharmEligibility()) return false;
        consumed = true;
        buildCharms.push(charmId);
        charmLevels[charmId] = 1;
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
      const restPool = shuffle([...fc, ...wc.slice(0, 2), ...cc.slice(0, 2), ...dc.slice(0, 2), ...pc.slice(0, 2)]);
      const rest = restPool.slice(0, 2);
      if (mc.length > 0) {
        if (rest.length >= 2) rest[1] = mc[0];
        else rest.push(mc[0]);
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
      if (fc.length > 0) pool.push(...fc);
      if (wc.length > 0) pool.push(...wc.slice(0, 2));
      if (cc.length > 0) pool.push(...cc.slice(0, 2));
      if (dc.length > 0) pool.push(...dc.slice(0, 2));
      if (pc.length > 0) pool.push(...pc.slice(0, 2));
      result = shuffle(pool).slice(0, 3);
      if (mc.length > 0) {
        if (result.length >= 3) result[2] = mc[0];
        else result.push(mc[0]);
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
    if (fc.length && !result.some(card => card.type === "fusion")) {
      const replaceIndex = result.findIndex(card => card !== awakenCard && card.type !== "mutation");
      if (replaceIndex >= 0) result[replaceIndex] = fc[0];
      else if (result.length < 3) result.push(fc[0]);
    }
    return result;
  }

  function offerUp() {
    if (state !== "play" && state !== "levelup") return;
    buildRevision++;
    choices = getEligibleChoices();
    if (choices.some(choice => choice.type === "mutation")) lastMutationOfferLevel = level;

    for (const choice of choices) if (choice.type === 'weapon') window.prepareSkillArt?.(choice.id, choice.lv);
    if (!choices.length) {
      if (isFreeCompensationChoice) {
        isFreeCompensationChoice = false;
        pendingFusionCompensation = false;
        state = "play";
        say("靈息充盈・無可選項目", P.x, P.y - 45, "#ffe9a0");
        return;
      }
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
    if (isFreeCompensationChoice) {
      isFreeCompensationChoice = false;
      pendingFusionCompensation = false;
    } else {
      xp = Math.max(0, xp - req);
      level++;
    }
    buildRevision++;
    // 融合卡只開確認面板，不能被一般升級收尾立刻蓋回 play。
    if (state === "fusion") return { ok: true, revision: buildRevision, level, id: choice.id };
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
    if (state !== "levelup" || levelupCooldown > 0) return;
    if (isFreeCompensationChoice) {
      offerUp();
      return;
    }
    if (rerolls <= 0) return;
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
    if (w == null || j.wrong?.includes(i)) return;
    if (j.assisted) markBossAssisted(j.word);

    if (w === j.word) {
      stampDeliveryCard(j, pos);
      const deliveryToX = j.to.x;
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
      if (STAGE.id === "rain-port") {
        lastDeliveryX = deliveryToX;
        // 送達後：把「尚未取貨」且取貨點離剛送達點太近的委託就地重選取貨屋。
        // 否則早先已排入的委託會讓玩家接下來仍走到剛送達的同一屋／鄰屋。
        rerollPickupsTooCloseTo(deliveryToX);
      }
      study?.seen?.(j.word);
      FX.deliver(pos.x, pos.y);
      RENDERER.triggerShake(7);
      AUDIO.deliverSuccess();
      HAPTICS.deliverSuccess();
      if (checkVictoryCondition()) startVictorySequence();
    } else {
      j.wrongPaid = true;
      (j.wrong ||= []).push(i);
      j.assisted = true;
      j.hold = 0;
      failed++;
      const penalty = Math.max(3, Math.round(maxOil * 0.05)); // 5% max HP (oil)
      oil = Math.max(0, oil - penalty);
      misses.push(j.word);
      STORE.rec(j.word.jp, false);
      study?.mistake?.(j.word, elapsed);
      // 不洩露當題正解，高對比提示
      say(`答錯了，請再試一次（燈油 −${penalty}）`, pos.x, pos.y - 36, "#ffffff");
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
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
    const actualDamage = charmGuardOilLoss(amount);
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

  // Coalesce a full sweep of enemies into one tactile hit cue.
  let lastBladeImpactAt = -Infinity;
  function hurt(e, dmg, isCrit = false, fromShatter = false, impactType = "") {
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
    if (e.hp <= 0) tryRollCharmDrop(e);
    e.flash = 0.12;
    const bladeHit = impactType === "blade" && !fromShatter;
    const bladeCue = bladeHit && (elapsed < lastBladeImpactAt || elapsed - lastBladeImpactAt >= 0.105);
    if (bladeHit) {
      // Only the sprite recoils; physics, hitboxes and Boss ground warnings remain fixed.
      if (e.type !== "boss") {
        e.hitReactT = 0.14;
        e.hitReactDir = Math.sign(e.x - P.x) || 1;
      }
      if (bladeCue) {
        lastBladeImpactAt = elapsed;
        const heavy = isCrit || e.type === "boss";
        RENDERER.triggerHitStop(isCrit ? 0.05 : heavy ? 0.042 : 0.025);
        HAPTICS.hit(isCrit);
        AUDIO.impact?.(isCrit ? "crit" : heavy ? "heavy" : "normal");
        // Small local contact flash/flecks only; no full-screen whiteout.
        FX.burst(e.x, e.y - 17, isCrit ? "#ffe4a0" : "#e8efff",
          isCrit ? 7 : 4, { speed: 130, life: 0.14, size: 5 });
      }
    } else {
      HAPTICS.hit(isCrit);
      burst(e.x, e.y, "#ffe6aa", 4);
      if (isCrit) {
        RENDERER.triggerHitStop(0.05);
      }
    }
    RENDERER.spawnDamageNumber(dmg, e.x, e.y - 25, isCrit, isCrit ? "#ffcc00" : "#ffffff");

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

      // 融合系統：真 Boss 擊殺檢查繪馬掉落資格（必須 >= 360 秒）
      if (window.FUSION && typeof window.FUSION.onBossDeath === "function") {
        window.FUSION.onBossDeath(e);
      }
    }

    const gemCount = 1;
    // 第二關 Normal 只有普通小怪改為 3 XP；Boss 與誤配妖仍為原數值。
    const gemValue = STAGE.id === "rain-port" && STAGE.pacing?.mobDifficulty !== "hard" && e.type !== "boss" && !isMis ? 3 : 2;
    for (let i = 0; i < gemCount; i++) {
      dropGem(e.x + (Math.random() - 0.5) * 28, e.y + (Math.random() - 0.5) * 28, gemValue);
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

  function dismissCombatModals() {
    if (state === "fusion" && window.FUSION && typeof window.FUSION.cancelFusion === "function") {
      window.FUSION.cancelFusion();
    }
    if (state === "charmswap") {
      pendingCharmOffer = null;
      charmSwapIndex = 0;
      gpCharmDir = 0;
      charmSwapHits = [];
    }
  }

  function loseRun() {
    if (state === "lampout" || state === "lost") return;
    if (checkVictoryCondition()) {
      startVictorySequence();
      return;
    }
    dismissCombatModals();
    state = "lampout";
    lampSeq = { t: 0 };
    keys.clear(); heldCodes.clear();
    joy = null;
    bossQ = null;
    job = null;
    inter = null;
    enemyBullets = [];
    winds = []; ghosts = []; proj = []; crosscuts = []; barrierPulses = []; sacredSanctuary = null; dragonShots = []; dragonScorches = []; splitblasts = []; duoShockwaves = []; inkfireMarks = [];
    fusionEffects = []; fusionEffects._idCounter = 0;
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
    fusionEffects = []; fusionEffects._idCounter = 0;
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

    if (state === "fusion") {
      const axis = Math.abs(ax) >= Math.abs(ay) ? ax : ay;
      const dir = axis > 0.55 ? 1 : axis < -0.55 ? -1 : 0;
      if (dir && dir !== gpFusionDir) fusionMoveFocus(dir);
      gpFusionDir = dir;
      if (justPressed(0)) {
        fusionActivateFocused();
      } else if (justPressed(1) || justPressed(9)) {
        fusionCancelPanel();
      }
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      gpMove = { x: 0, y: 0 };
      return;
    }
    gpFusionDir = 0;

    if (state === "charmswap") {
      const dir = ax > 0.55 ? 1 : ax < -0.55 ? -1 : 0;
      if (dir && dir !== gpCharmDir) charmSwapIndex = (charmSwapIndex + dir + CHARM_SLOT_MAX) % CHARM_SLOT_MAX;
      gpCharmDir = dir;
      if (justPressed(0)) resolveCharmSwap("confirm");
      else if (justPressed(1)) resolveCharmSwap("cancel");
      gpPrevButtons = gp.buttons.map(b => b.pressed);
      gpMove = { x: 0, y: 0 };
      return;
    }
    gpCharmDir = 0;

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
      else if (justPressed(1) || justPressed(9)) { if (quitConfirm) activateMenu('exit-cancel'); else if (state === 'pause') togglePause(); else if (state === 'won') activateMenu('world'); else if (state === 'lost') activateMenu('menu'); }
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
      if (state === "overworld") requestOverworldExit();
      else if (state === "play") dash();
    }

    // X 鍵 (Button 2): 提示
    if (justPressed(2)) {
      if (state === "play" && job) triggerHint();
    }

    // 手把重開奧義確認面試：Y 鍵 (Button 3) 或 X 鍵 (Button 2 且無委託提示時)
    if (state === "play" && window.FUSION && typeof window.FUSION.getState === "function") {
      const fState = window.FUSION.getState();
      if (fState.state === "held" && (justPressed(3) || (justPressed(2) && !job))) {
        if (openFusionPanel()) {
          gpPrevButtons = gp.buttons.map(b => b.pressed);
          return;
        }
      }
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
      const penalty = Math.max(3, Math.round(maxOil * 0.05));
      // lock 與 wrong 已擋掉重複選項；讀題時 elapsed 暫停，不能再拿它當扣血時鐘。
      bs.wrongPaid = true;
      misses.push(bs.word);
      STORE.rec(bs.word.jp, false);
      study?.mistake?.(bs.word, elapsed);
      oil = Math.max(0, oil - penalty);
      bossQ.wasAssisted = true;
      bs.wasAssisted = true;
      if (job?.word.jp === bs.word.jp) job.assisted = true;
      AUDIO.deliverWrong();
      HAPTICS.deliverWrong();
      // 不洩露當題正解，高對比提示
      say(`答錯了，請再試一次（燈油 −${penalty}）`, P.x, P.y - 50, "#ffffff");
      if (oil <= 0) {
        oil = 0;
        loseRun();
        return;
      }
      bossQ.wrong.push(i);
      bossQ.lock = 0.5;
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

  // ==========================================================================
  // M2-FUSION runtime helpers：四優先攻擊、目標幾何、統計與選卡輸入
  // ==========================================================================
  const FUSION_FX_MAX = 12;

  function fusionStatsFor(kind) {
    if (!fusionStats.byKind) fusionStats.byKind = {};
    if (!fusionStats.byKind[kind]) fusionStats.byKind[kind] = { casts: 0, damage: 0, hits: 0 };
    return fusionStats.byKind[kind];
  }
  function fusionRecordCast(kind) {
    fusionStats.casts++;
    const s = fusionStatsFor(kind);
    s.casts++;
    return s;
  }
  function fusionRecordDamage(kind, dmg) {
    const n = Number(dmg) || 0;
    fusionStats.directDmg += n;
    const s = fusionStatsFor(kind);
    s.damage += n;
    s.hits++;
  }

  function fusionTargetEligible(e) {
    return !!(e && e.hp > 0 && !e.shield && !e.vanish && !e.done);
  }

  function fusionLineTargets(x, y, angle, length, width, maxTargets) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const found = [];
    for (const e of enemies) {
      if (!fusionTargetEligible(e)) continue;
      const rx = e.x - x, ry = e.y - y;
      const t = rx * dx + ry * dy;
      if (t < 0 || t > length) continue;
      const perp = Math.abs(rx * dy - ry * dx);
      if (perp > width * 0.5 + (Number(e.r) || 0)) continue;
      found.push({ e, t });
    }
    found.sort((a, b) => a.t - b.t || dist({ x, y }, a.e) - dist({ x, y }, b.e));
    return found.slice(0, maxTargets).map(v => v.e);
  }

  function fusionArcTargets(x, y, angle, reach, arc, maxTargets) {
    const found = [];
    for (const e of enemies) {
      if (!fusionTargetEligible(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > reach) continue;
      let diff = Math.abs(Math.atan2(e.y - y, e.x - x) - angle);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      if (diff > arc * 0.5) continue;
      found.push({ e, d });
    }
    found.sort((a, b) => a.d - b.d);
    return found.slice(0, maxTargets).map(v => v.e);
  }

  function fusionViewModel() {
    return window.FUSION && typeof window.FUSION.getViewModel === "function"
      ? window.FUSION.getViewModel()
      : {};
  }
  function fusionLayoutButtons() {
    if (!window.FUSION || typeof UI.fusionLayout !== "function") return [];
    const layout = UI.fusionLayout(null, fusionViewModel());
    return layout && Array.isArray(layout.buttons) ? layout.buttons : [];
  }
  function fusionSyncOpen() {
    if (!window.FUSION || typeof window.FUSION.getState !== "function") return;
    const s = window.FUSION.getState();
    fusionOpenedEpoch = s.runEpoch;
    fusionOpenedRevision = s.revision;
  }
  function openFusionPanel(recipeId) {
    if (!window.FUSION || typeof window.FUSION.openFusionConfirm !== "function") return false;
    if (!window.FUSION.openFusionConfirm(recipeId)) return false;
    state = "fusion";
    const buttons = fusionLayoutButtons();
    // 多配方時焦點落在第一張合武卡，避免 Enter/A 永遠直接確認第一張。
    fusionFocus = buttons.length > 2 ? 2 : 0;
    fusionSyncOpen();
    return true;
  }
  function fusionRecipeName(id) {
    const recipe = window.FUSION?.RECIPES?.[id];
    return recipe?.name || "奧義";
  }
  function fusionConfirmSelected() {
    if (!window.FUSION || typeof window.FUSION.executeFusion !== "function") return false;
    const fState = window.FUSION.getState();
    const selected = fState?.selectedRecipeId || null;
    const res = window.FUSION.executeFusion(selected, fusionOpenedEpoch, fusionOpenedRevision);
    if (res && res.ok) {
      state = "play";
      say(`${fusionRecipeName(res.fusedWeapon)}・融合覺醒！`, P.x, P.y - 75, "#ffcc66");
      if (res.grantCompensation && typeof window.FUSION.consumeCompensation === "function") {
        window.FUSION.consumeCompensation();
      }
      return true;
    }
    if (res && (res.reason === "stale_revision" || res.reason === "stale_epoch")) fusionSyncOpen();
    return false;
  }
  function fusionCancelPanel() {
    window.FUSION?.cancelFusion?.();
    state = "play";
    say("稍後再議", P.x, P.y - 45, "#e0d0b0");
  }
  function fusionSelectById(recipeId) {
    if (!window.FUSION || typeof window.FUSION.selectRecipe !== "function") return false;
    const res = window.FUSION.selectRecipe(recipeId, fusionOpenedEpoch, fusionOpenedRevision);
    if (res && res.ok) {
      fusionSyncOpen();
      return true;
    }
    if (res && (res.reason === "stale_revision" || res.reason === "stale_epoch")) fusionSyncOpen();
    return false;
  }
  function fusionMoveFocus(delta) {
    const buttons = fusionLayoutButtons();
    if (!buttons.length) return;
    fusionFocus = ((fusionFocus + delta) % buttons.length + buttons.length) % buttons.length;
  }
  function fusionActivateFocused() {
    const buttons = fusionLayoutButtons();
    if (!buttons.length) return false;
    fusionFocus = clamp(fusionFocus, 0, buttons.length - 1);
    const btn = buttons[fusionFocus];
    if (!btn) return false;
    if (btn.id === "confirm") return fusionConfirmSelected();
    if (btn.id === "later") { fusionCancelPanel(); return true; }
    if (btn.recipeId) {
      // 選卡只更新 selectedRecipeId；焦點回到確認鈕，再由玩家按確認。
      if (fusionSelectById(btn.recipeId)) {
        fusionFocus = 0;
        return true;
      }
    }
    return false;
  }
  function fusionPointerButton(btn, index) {
    if (!btn) return false;
    if (btn.id === "confirm") return fusionConfirmSelected();
    if (btn.id === "later") { fusionCancelPanel(); return true; }
    if (btn.recipeId) {
      fusionFocus = index;
      return fusionSelectById(btn.recipeId);
    }
    return false;
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
        playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
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
                hurt(e, spec.slashDmg * crit.mult, crit.isCrit, false, "blade");
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
        hurt(e, wave.dmg * pierceScale * crit.mult, crit.isCrit, false, "blade");
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
                  hurt(e, finalDmg * crit.mult, crit.isCrit, false, "blade");
                  SKILLFX.play("katana", "hit", cc.level, { x: e.x, y: e.y, ang: cc.crossAng, crit: crit.isCrit });
                }
              }
            }
          }
        }
      }
      crosscuts = crosscuts.filter(cc => !cc.triggered);
    }

    // 1-F. 融合武器：奧義・墨焰斬 (fusion_inkblade)
    if (WL.fusion_inkblade > 0) {
      wT.fusion_inkblade = (wT.fusion_inkblade ?? 0) - dt;
      if (wT.fusion_inkblade <= 0) {
        const spec = resolveAttackSpec("fusion_inkblade", WL.fusion_inkblade, getBuildState(), { faceAng: P.faceAng || 0 });
        const reach = spec.reach || 280;
        const faceAng = P.faceAng || 0;
        let hasEnemyInArc = false;
        for (const e of enemies) {
          if (e.hp > 0 && dist(P, e) <= reach) {
            let diff = Math.abs(Math.atan2(e.y - P.y, e.x - P.x) - faceAng);
            while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
            if (diff <= (spec.arc || 2.0) / 2) {
              hasEnemyInArc = true;
              break;
            }
          }
        }
        if (!hasEnemyInArc) {
          wT.fusion_inkblade = 0.1;
        } else {
          wT.fusion_inkblade = wMax.fusion_inkblade = spec.cooldown || 1.2;
          fusionRecordCast("fusion_inkblade");
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          const crit = rollCrit(spec);
          let hitCount = 0;
          for (const e of enemies) {
            if (e.hp > 0 && !e.done && !e.vanish && hitCount < (spec.maxTargets || 6) && dist(P, e) <= reach) {
              let diff = Math.abs(Math.atan2(e.y - P.y, e.x - P.x) - faceAng);
              while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
              if (diff <= (spec.arc || 2.0) / 2) {
                hitCount++;
                const hitDmg = spec.slashDmg * crit.mult;
                hurt(e, hitDmg, crit.isCrit, false, "blade");
                fusionRecordDamage("fusion_inkblade", hitDmg);
                SKILLFX.play("katana", "hit", 5, { x: e.x, y: e.y, ang: faceAng, crit: crit.isCrit });
              }
            }
          }
          if (fusionEffects.length < FUSION_FX_MAX) {
            fusionEffects.push({
              kind: "fusion_inkblade",
              phase: "active",
              x: P.x,
              y: P.y,
              angle: faceAng,
              radius: reach,
              spread: spec.arc || 2.0,
              progress: 0,
              seed: Math.random() * 100,
              burnDuration: spec.scorchDuration || 2.5,
              burnAge: 0,
              life: 0.8,
              scorchDmg: Number((spec.slashDmg * 0.12).toFixed(2)),
              tick: 0
            });
          }
          AUDIO.slash(5);
        }
      }
    }

    // 1-G. 融合武器：奧義・雷狐居合 (fusion_foxiai)
    if (WL.fusion_foxiai > 0) {
      wT.fusion_foxiai = (wT.fusion_foxiai ?? 0) - dt;
      if (wT.fusion_foxiai <= 0) {
        const spec = resolveAttackSpec("fusion_foxiai", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const faceAng = P.faceAng || 0;
        const preTargets = fusionLineTargets(P.x, P.y, faceAng, spec.reach, spec.hitWidth, spec.maxTargets);
        if (!preTargets.length || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_foxiai = 0.12;
        } else {
          wT.fusion_foxiai = wMax.fusion_foxiai = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_foxiai");
          fusionEffects.push({
            kind: "fusion_foxiai",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: faceAng,
            radius: spec.reach,
            spread: 0,
            width: spec.hitWidth,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn,
            life: spec.warn + 0.36,
            burnAge: 0,
            damage: spec.damage,
            maxTargets: spec.maxTargets,
            critChance: spec.critChance,
            critMult: spec.critMult,
            triggered: false,
            hitSet: new Set()
          });
          AUDIO.slash(5);
        }
      }
    }

    // 1-H. 融合武器：奧義・退魔符刃 (fusion_exorcistblade)
    if (WL.fusion_exorcistblade > 0) {
      wT.fusion_exorcistblade = (wT.fusion_exorcistblade ?? 0) - dt;
      if (wT.fusion_exorcistblade <= 0) {
        const spec = resolveAttackSpec("fusion_exorcistblade", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const faceAng = P.faceAng || 0;
        const targets = fusionArcTargets(P.x, P.y, faceAng, spec.reach, spec.arc, spec.maxTargets);
        if (!targets.length || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_exorcistblade = 0.12;
        } else {
          wT.fusion_exorcistblade = wMax.fusion_exorcistblade = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_exorcistblade");
          const crit = rollCrit(spec);
          const marks = [];
          for (const e of targets) {
            const hitDmg = spec.slashDmg * crit.mult;
            hurt(e, hitDmg, crit.isCrit, false, "blade");
            fusionRecordDamage("fusion_exorcistblade", hitDmg);
            SKILLFX.play("katana", "hit", 5, { x: e.x, y: e.y, ang: faceAng, crit: crit.isCrit });
            marks.push({
              target: e,
              delay: spec.markDelay,
              damage: spec.burstDmg,
              radius: spec.burstRadius,
              triggered: false
            });
          }
          fusionEffects.push({
            kind: "fusion_exorcistblade",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: faceAng,
            radius: spec.reach,
            spread: spec.arc,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn,
            life: 0.85,
            burnAge: 0,
            marks,
            maxBurstTargets: spec.burstMaxTargets,
            critChance: spec.critChance,
            critMult: spec.critMult,
            splashHits: new Set()
          });
          AUDIO.slash(5);
        }
      }
    }

    // 1-I. 融合武器：奧義・妖火結界 (fusion_foxfirebarrier)
    if (WL.fusion_foxfirebarrier > 0) {
      wT.fusion_foxfirebarrier = (wT.fusion_foxfirebarrier ?? 0) - dt;
      if (wT.fusion_foxfirebarrier <= 0) {
        const spec = resolveAttackSpec("fusion_foxfirebarrier", 1, getBuildState());
        const activeField = fusionEffects.some(fx => fx.kind === "fusion_foxfirebarrier");
        if (activeField || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_foxfirebarrier = 0.15;
        } else {
          wT.fusion_foxfirebarrier = wMax.fusion_foxfirebarrier = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_foxfirebarrier");
          fusionEffects.push({
            kind: "fusion_foxfirebarrier",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: 0,
            radius: spec.radius,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn,
            life: spec.duration,
            burnAge: 0,
            damage: spec.damage,
            pulses: spec.pulses,
            pulseInterval: spec.pulseInterval,
            nextPulse: spec.firstPulse,
            pulseIndex: 0,
            maxTargets: spec.maxTargets,
            knockback: spec.knockback,
            knocked: new Set(),
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          AUDIO.barrier(5);
        }
      }
    }

    // 1-J. 融合武器：奧義・退魔封陣 (fusion_exorcistseal)
    if (WL.fusion_exorcistseal > 0) {
      wT.fusion_exorcistseal = (wT.fusion_exorcistseal ?? 0) - dt;
      if (wT.fusion_exorcistseal <= 0) {
        const spec = resolveAttackSpec("fusion_exorcistseal", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const activeSeals = fusionEffects.filter(fx => fx.kind === "fusion_exorcistseal").length;
        if (activeSeals >= 2 || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_exorcistseal = 0.2;
        } else {
          const faceAng = P.faceAng || 0;
          const tx = P.x + Math.cos(faceAng) * spec.castRange;
          const ty = P.y + Math.sin(faceAng) * spec.castRange;
          wT.fusion_exorcistseal = wMax.fusion_exorcistseal = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_exorcistseal");
          fusionEffects.push({
            kind: "fusion_exorcistseal",
            phase: "warn",
            x: tx,
            y: ty,
            angle: faceAng,
            radius: spec.radius,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn,
            life: spec.duration,
            burnAge: 0,
            damage: spec.damage,
            pulses: spec.pulses,
            pulseInterval: spec.pulseInterval,
            nextPulse: spec.firstPulse,
            pulseIndex: 0,
            maxTargets: spec.maxTargets,
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          AUDIO.thunder(5);
        }
      }
    }

    // 1-K. 融合武器：奧義・斬界輪 (fusion_slashwheel)
    if (WL.fusion_slashwheel > 0) {
      wT.fusion_slashwheel = (wT.fusion_slashwheel ?? 0) - dt;
      if (wT.fusion_slashwheel <= 0) {
        const spec = resolveAttackSpec("fusion_slashwheel", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const near = enemies.some(e => e.hp > 0 && !e.vanish && !e.done && dist(P, e) <= spec.radius);
        if (!near || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_slashwheel = 0.12;
        } else {
          wT.fusion_slashwheel = wMax.fusion_slashwheel = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_slashwheel");
          fusionEffects.push({
            kind: "fusion_slashwheel",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: P.faceAng || 0,
            radius: spec.radius,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: 0.18,
            life: (spec.expandTime || 0.45) + 0.8,
            burnAge: 0,
            expandTime: spec.expandTime || 0.45,
            currentRadius: 0,
            bands: (spec.bands || []).map(bd => ({ ...bd, hits: new Set(), fired: false })),
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          AUDIO.slash(5);
        }
      }
    }

    // 1-L. 融合武器：奧義・狐雷天燈 (fusion_foxthunderlantern)
    if (WL.fusion_foxthunderlantern > 0) {
      wT.fusion_foxthunderlantern = (wT.fusion_foxthunderlantern ?? 0) - dt;
      if (wT.fusion_foxthunderlantern <= 0) {
        const spec = resolveAttackSpec("fusion_foxthunderlantern", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const faceAng = P.faceAng || 0;
        const targets = enemies
          .filter(e => fusionTargetEligible(e) && dist(P, e) <= spec.lockRange)
          .sort((a, b) => dist(P, a) - dist(P, b))
          .slice(0, spec.count || 3);
        if (!targets.length || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_foxthunderlantern = 0.12;
        } else {
          wT.fusion_foxthunderlantern = wMax.fusion_foxthunderlantern = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_foxthunderlantern");
          const lanterns = [];
          const count = spec.count || 3;
          for (let i = 0; i < count; i++) {
            const t = targets[i] || null;
            const sa = faceAng + (i - (count - 1) / 2) * 0.8;
            const sx = P.x + Math.cos(sa) * 56;
            const sy = P.y + Math.sin(sa) * 56 - 36;
            lanterns.push({
              x: sx,
              y: sy,
              fromX: sx,
              fromY: sy,
              targetX: t ? t.x : P.x + Math.cos(sa) * 200,
              targetY: t ? t.y : P.y + Math.sin(sa) * 200,
              delay: (spec.warn ?? 0.12) + i * 0.06,
              struck: false,
              hitSet: new Set()
            });
          }
          fusionEffects.push({
            kind: "fusion_foxthunderlantern",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: faceAng,
            radius: spec.lockRange,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn ?? 0.12,
            life: (spec.warn ?? 0.12) + 1.05,
            burnAge: 0,
            lanterns,
            strikeRadius: spec.strikeRadius || 64,
            damage: spec.damage,
            maxTargets: spec.maxTargets || 3,
            splashScale: spec.splashScale || 0.5,
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          // Thunder SFX is triggered at the first actual lantern strike, not before the image.
        }
      }
    }

    // 1-M. 融合武器：奧義・炎符祭 (fusion_flamefestival)
    if (WL.fusion_flamefestival > 0) {
      wT.fusion_flamefestival = (wT.fusion_flamefestival ?? 0) - dt;
      if (wT.fusion_flamefestival <= 0) {
        const spec = resolveAttackSpec("fusion_flamefestival", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const faceAng = P.faceAng || 0;
        const near = enemies.some(e => e.hp > 0 && !e.vanish && !e.done && dist(P, e) <= spec.range);
        if (!near || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_flamefestival = 0.12;
        } else {
          wT.fusion_flamefestival = wMax.fusion_flamefestival = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_flamefestival");
          const count = spec.count || 4;
          const talismans = [];
          for (let i = 0; i < count; i++) {
            const sa = faceAng + (i - (count - 1) / 2) * 0.42;
            const travel = 150 + i * 40;
            talismans.push({
              fromX: P.x,
              fromY: P.y,
              x: P.x,
              y: P.y,
              targetX: P.x + Math.cos(sa) * travel,
              targetY: P.y + Math.sin(sa) * travel,
              delay: 0.28 + i * 0.12,
              exploded: false,
              hitSet: new Set()
            });
          }
          fusionEffects.push({
            kind: "fusion_flamefestival",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: faceAng,
            radius: spec.range,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: spec.warn || 0.18,
            life: 1.75,
            burnAge: 0,
            talismans,
            embers: [],
            landRadius: spec.landRadius || 62,
            damage: spec.damage,
            maxTargets: spec.maxTargets || 3,
            emberTicks: spec.emberTicks || 2,
            emberInterval: spec.emberInterval || 0.35,
            emberRadius: spec.emberRadius || 48,
            emberDamage: spec.emberDamage,
            emberMaxTargets: spec.emberMaxTargets || 2,
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          AUDIO.thunder(5);
        }
      }
    }

    // 1-N. 融合武器：奧義・雷陣封界 (fusion_thundercircle)
    if (WL.fusion_thundercircle > 0) {
      wT.fusion_thundercircle = (wT.fusion_thundercircle ?? 0) - dt;
      if (wT.fusion_thundercircle <= 0) {
        const spec = resolveAttackSpec("fusion_thundercircle", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const active = fusionEffects.filter(fx => fx.kind === "fusion_thundercircle").length;
        const near = enemies.some(e => e.hp > 0 && !e.vanish && !e.done && dist(P, e) <= spec.radius);
        if (active >= 1 || !near || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_thundercircle = 0.15;
        } else {
          wT.fusion_thundercircle = wMax.fusion_thundercircle = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_thundercircle");
          fusionEffects.push({
            kind: "fusion_thundercircle",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: 0,
            radius: spec.radius,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: 0.12,
            life: 0.12 + (spec.pulseCount - 1) * spec.pulseInterval + spec.pulseWarning + 0.65,
            burnAge: 0,
            pulses: spec.pulseCount,
            pulseInterval: spec.pulseInterval,
            nextPulse: 0.12,
            pulseIndex: 0,
            pulseDamage: spec.pulseDamage,
            pulseRadius: spec.pulseRadius,
            pulseWarning: spec.pulseWarning,
            strikes: [],
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          // Thunder SFX is triggered on the first pulse's impact, after the image appears.
        }
      }
    }

    // 1-O. 融合武器：奧義・雷符神罰 (fusion_thundertalisman)
    if (WL.fusion_thundertalisman > 0) {
      wT.fusion_thundertalisman = (wT.fusion_thundertalisman ?? 0) - dt;
      if (wT.fusion_thundertalisman <= 0) {
        const spec = resolveAttackSpec("fusion_thundertalisman", 1, getBuildState(), { faceAng: P.faceAng || 0 });
        const faceAng = P.faceAng || 0;
        const near = enemies.some(e => e.hp > 0 && !e.vanish && !e.done && dist(P, e) <= spec.range);
        if (!near || fusionEffects.length >= FUSION_FX_MAX) {
          wT.fusion_thundertalisman = 0.12;
        } else {
          wT.fusion_thundertalisman = wMax.fusion_thundertalisman = spec.cooldown;
          playerAttackPoseT = Math.max(playerAttackPoseT, 0.56);
          window.SPRITECOOK_DEV?.restartAttack?.();
          fusionRecordCast("fusion_thundertalisman");
          const count = spec.count || 5;
          const talismans = [];
          for (let i = 0; i < count; i++) {
            const sa = faceAng + (i - (count - 1) / 2) * 0.26;
            const travel = 140 + (i % 3) * 50;
            talismans.push({
              fromX: P.x,
              fromY: P.y,
              x: P.x,
              y: P.y,
              targetX: P.x + Math.cos(sa) * travel,
              targetY: P.y + Math.sin(sa) * travel,
              delay: 0.32 + i * 0.14,
              struck: false,
              hitSet: new Set()
            });
          }
          fusionEffects.push({
            kind: "fusion_thundertalisman",
            phase: "warn",
            x: P.x,
            y: P.y,
            angle: faceAng,
            radius: spec.range,
            spread: 0,
            progress: 0,
            seed: Math.random() * 100,
            warn: 0.12,
            life: 1.95,
            burnAge: 0,
            talismans,
            arcs: [],
            strikeRadius: spec.strikeRadius || 70,
            warnStrike: spec.warn || 0.36,
            damage: spec.damage,
            maxTargets: spec.maxTargets || 4,
            // 新：天狐雷額外判定參數
            thunderTickDamage: spec.thunderTickDamage,
            thunderTickRadius: spec.thunderTickRadius,
            thunderTickBossScale: spec.thunderTickBossScale,
            // 舊鏈欄位保留為 0（相容 renderer，不再使用）
            chainRadius: 0,
            chainScale: 0,
            chainMax: 0,
            critChance: spec.critChance,
            critMult: spec.critMult
          });
          AUDIO.thunder(5);
        }
      }
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
        const returnBonusHit = nd.hasReturn && nd.returning && nd.hits?.has(e) && !nd.returnBonusHits?.has(e);
        if (e.hp > 0 && (returnBonusHit || (!(e.inb > elapsed) && !nd.hits?.has(e))) && dist(e, nd) < (e.type === "boss" ? 54 : 30)) {
          if (returnBonusHit) {
            (nd.returnBonusHits ??= new Set()).add(e);
          } else {
            e.inb = elapsed + 0.2;
            nd.hits?.add(e);
          }
          let dmg = returnBonusHit ? nd.dmg * 0.35 : nd.dmg;
          if (!returnBonusHit && nd.hasPierce && !e.shield) {
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
          if (!returnBonusHit && (nd.frost || nd.ice)) applyFrost(e, elapsed, nd.volley || null);
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
          const threat = e => e.type === "boss" ? 0 : (e.type === "shooter" || e.type === "shiome") ? 1 : e.type === "tank" ? 2 : 3;
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
    const area = window.VIEWPORT?.worldBoundsAtZoom?.(Math.min(1, window.VIEWPORT?.worldZoom?.() ?? 1)) || worldViewBounds(), cam = RENDERER.getCam();
    const lag = Math.hypot(P.x - (cam.x + W / 2), P.y - (cam.y + H / (2 * tiltK())));
    return Math.max(minimum, Math.hypot(area.width / 2, area.height / 2) + lag + 64);
  }

  function spawnPosition(rad, angle, collisionRadius, origin = P) {
    for (let tries = 0; tries <= 10; tries++) {
      const a = angle + tries * 0.63;
      const x = origin.x + Math.cos(a) * rad, y = origin.y + Math.sin(a) * rad;
      // blocked 內已含 runBounds 半徑判 Y，無需重複檢查
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
    let interval = CFG.spawnInterval(cappedElapsed * MOB_DIFFICULTY.timeScale) * SPAWN_INTERVAL_SCALE * MOB_DIFFICULTY.intervalScale;
    let count = Math.max(1, CFG.spawnCount(cappedElapsed) + SPAWN_COUNT_BONUS);

    // S1 Normal：前一分鐘持續生成威脅，之後逐步接近第二關的密度。
    if (STAGE.id === "night-town" && STAGE_PACING.mobDifficulty !== "hard" && cappedElapsed < 150) {
      if (cappedElapsed < 90) {
        interval = 1.5 - 0.42 * clamp(cappedElapsed / 90, 0, 1);
        count = 1;
      } else {
        interval = 2.16 + (interval - 2.16) * ((cappedElapsed - 90) / 60);
        count = 2;
      }
    }

    return {
      tier: CFG.enemyTier(Math.min(atElapsed, CFG.RUN_SECONDS) * MOB_DIFFICULTY.timeScale, power * MOB_DIFFICULTY.powerScale),
      interval,
      count
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

    // rain-port Normal：移除真正燈籠怪 (shooter) 的 spawn 與發彈，保留低 HP 海妖 (shiome) 作為唯一遠程
    const isRainPortNormal = STAGE.id === "rain-port" && (STAGE.pacing?.mobDifficulty !== "hard");

    if (isRainPortNormal) {
      // Stage2 Normal：無燈籠怪 (shooter)，以海妖 (shiome) 擔任唯一遠程
      // runner 90s+ (原 22%)、tank 200s+ (原 14%)、shiome 160s+ (取代 shooter)
      if (cappedElapsed > 90 && r < 0.25) {
        t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
      } else if (cappedElapsed > 200 && r < 0.40) {
        t = { type: "tank", hp: 7.0 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
      } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.40 : 0.25) + shooterChance && !ring && canShoot) {
        // 遠程敵人：由雨港原生海妖 (shiome) 擔任，低 HP < ghost (2.0)
        t = { type: "shiome", hp: 0.7 * tier, speed: (46 + speedRamp * 0.7) * stageSpeed, pose: "idle" };
      }
    } else {
      // 原有生成邏輯（hard 或其他關）
      if (STAGE.id === "rain-port" && !ring && r >= 0.55 && r < 0.72) {
        t = { type: "shiome", hp: 2.2 * tier, speed: (46 + speedRamp * 0.7) * stageSpeed, pose: "idle", shiomeCd: 0.8 };
      } else if (cappedElapsed > 90 && r < 0.22) {
        t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
      } else if (cappedElapsed > 200 && r < 0.36) {
        t = { type: "tank", hp: 7.0 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
      } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.36 : 0.22) + shooterChance && !ring && canShoot) {
        t = { type: "shooter", hp: tier, speed: (48 + speedRamp * 0.8) * stageSpeed };
      }
    }

    enemies.push({ ...position, flash: 0, wob: Math.random() * 6, slowT: 0, ...t,
      hp: Math.ceil(t.hp * MOB_DIFFICULTY.hpScale), max: Math.ceil(t.hp * MOB_DIFFICULTY.hpScale) });
  }

  function update(dt, hitStopped = false) {
    if (state !== "play" || artPending()) return;
    animElapsed += dt;
    if (isPortrait()) { suspend(); return; }
    checkTutorial();
    if (tutorial) return;

    let quizNear = null;
    for (const e of enemies) {
      if (e.type !== "boss" || !e.shield || e.hp <= 0 || e.quizClosed) continue;
      if (dist(P, e) < 380) quizNear = e;
      else if (e.quizEntered) e.quizClosed = true;
    }
    if (quizNear) {
      quizNear.quizEntered = true;
      if (STAGE.id === "night-town") {
        quizNear.barrierTimer = (quizNear.barrierTimer ?? 10) - dt;
        if (quizNear.barrierTimer <= 0) {
          quizNear.barrierTimer = 0;
          quizNear.quizClosed = true;
          quizNear = null;
        }
      }
    }
    if (job && !job.readClosed && dist(P, job.to) < 220) {
      if (!job.reading) {
        job.reading = true;
        job.barrierTimer = 10.0; // 10 秒結界倒數
      }
    }
    if (job?.reading) {
      if (dist(P, job.to) >= 270) {
        job.reading = false;
        job.readClosed = true;
        job.barrierTimer = null;
      } else {
        job.barrierTimer = (job.barrierTimer ?? 10.0) - dt;
        if (job.barrierTimer <= 0) {
          // 10 秒到期必須結束暫停，扣除 5% max HP 並恢復戰鬥
          job.barrierTimer = null;
          job.reading = false;
          job.readClosed = true;
          failed++;
          const penalty = Math.max(3, Math.round(maxOil * 0.05));
          oil = Math.max(0, oil - penalty);
          say("結界消散・答題逾時", P.x, P.y - 45, "#ff4d4d");
          AUDIO.deliverWrong();
          HAPTICS.deliverWrong();
          if (oil <= 0) { oil = 0; loseRun(); return; }
        }
      }
    }
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

    // 關卡逾 12:00 (720秒) 且尾王尚存活時，開始緩慢回血 (1.5% maxHP/s，不超 max，死亡即停止回血)
    if (STAGE.id === "night-town" && elapsed >= 720 && !finalBossDefeated) {
      const liveBoss = enemies.find(e => e.type === "boss" && e.final && e.hp > 0);
      if (liveBoss) {
        const heal = (liveBoss.max || 1000) * 0.015 * dt;
        liveBoss.hp = Math.min(liveBoss.max, liveBoss.hp + heal);
        liveBoss.healPulseT = (liveBoss.healPulseT || 0) + dt;
        if (liveBoss.healPulseT >= 1.5) {
          liveBoss.healPulseT = 0;
          say("妖力湧溢・狂暴回血", liveBoss.x, liveBoss.y - 70, "#ff4d4d");
        }
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
    const isRainPortNormal = STAGE.id === "rain-port" && (STAGE.pacing?.mobDifficulty !== "hard");
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.hitReactT = Math.max(0, (e.hitReactT || 0) - dt);
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
        let ringActiveR = null;
        const h = e.hazard;
        if (h && h.kind === "ring" && h.phase === "active" && dt > 0 && !(surgeWarningT > 0) && !e.shield) {
          ringActiveR = h.r;
          h.prevR = ringActiveR;
        }
        const stepped = window.BOSS_AI.step(e, P, dt, {
          blocked: (x, y, r = 32) => blocked(x, y, r),
          stageId: STAGE.id,
          paused: surgeWarningT > 0
        });
        if (stepped?.hit) hazardHit = stepped.hit;
        if (ringActiveR !== null && e.hazard === h && h.kind === "ring" && (h.phase === "active" || h.phase === "recovery")) {
          h.prevR = ringActiveR;
        }
        if (e.umibozu && STAGE.id === "rain-port") {
          const offensiveHazard = e.hazard && ["telegraph", "active"].includes(e.hazard.phase)
            && ["tide", "slam", "charge", "tidalFan", "rainVortex"].includes(e.hazard.kind);
          const nextPose = offensiveHazard ? "attack" : "idle";
          if (e.pose !== nextPose) e.pose = nextPose;
        }
      }
      if (e.type === "shiome") {
        if (!isRainPortNormal) {
          const waveHit = updateShiome(e, dt);
          if (waveHit) hazardHit = waveHit;
        } else {
          // Normal 雨港：停原波浪 hazard，避免雙攻擊；姿態由射擊 attackT 控制
          e.pose = (e.attackT > 0) ? "attack" : "idle";
        }
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
      // 真移動方向記錄：移動時更新 faceAng，停止/凍結/暫停/擊退/揭露不轉向
      if (e.walking) {
        e.faceAng = Math.atan2(e.y - oldY, e.x - oldX);
      }
      if (e.type === "mis") {
        e.stuckT = step > 0 && e.x === oldX && e.y === oldY ? (e.stuckT || 0) + dt : 0;
        if (e.stuckT >= 2.5) {
          const safe = spawnPosition(160, Math.atan2(e.y - P.y, e.x - P.x), 34);
          if (safe) { Object.assign(e, safe); e.revealT = 0.9; }
          e.stuckT = 0;
          continue;
        }
      }

      // 射手型妖怪：於中距離發射幽冥妖火彈
      // 雨港 normal 移除真正燈籠怪 (shooter)，由海妖 (shiome) 走 enemyBullets 遠程分支，mis 停發；其他關或 hard 保留原機制 (shooter 與 mis 均可發彈)
      const canShootType = isRainPortNormal
        ? e.type === "shiome"
        : (e.type === "shooter" || (e.type === "mis" && !revealing));
      if (STAGE_ENEMY.shots !== false && canShootType) {
        e.shootCd = (e.shootCd || (2.0 + Math.random())) - dt;
        if (e.shootCd <= 0 && d > 50 && d < (e.type === "mis" ? 200 : 460)) {
          e.shootCd = 3.2 + Math.random() * 1.2;
          e.attackT = 0.24;
          if (e.type === "shiome") e.pose = "attack";
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
      let wait = plan.role === "final"
        ? alive.some(e => !e.gatekeeper)
        : plan.role === "gate"
          ? alive.some(e => !e.final)
          : alive.length > 0;
      if (wait && plan.role === "final") {
        finalBossWaitT += dt;
        finalBossHintT -= dt;
        if (finalBossHintT <= 0) {
          finalBossHintT = FINAL_BOSS_HINT_EVERY;
          const blocker = alive.find(e => !e.gatekeeper);
          say(`先擊敗${blocker?.title || "大妖"}，終王才會現身`, P.x, P.y - 75, "#ffb3ba");
        }
        if (finalBossWaitT >= FINAL_BOSS_WAIT_MAX) wait = false;
      }
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
        const isRainPortNormal = STAGE.id === "rain-port" && (STAGE.pacing?.mobDifficulty !== "hard");
        // rain-port Normal：前三王恢復高難度且第三王承接尾王強度；Hard本身完全不變。
        const harborNormalBossHps = [300, 650, 900, 1400];
        const bossHp = isRainPortNormal && typeof plan.hp === "number"
          ? (harborNormalBossHps[bossStage] ?? plan.hp)
          : plan.hp;
        enemies.push({
          ...position,
          type: "boss",
          word,
          shield: !!plan.quiz,
          role: plan.role,
          gatekeeper: plan.role === "gate",
          final: plan.role === "final",
          // All rain-port bosses share the same harbor sprite pipeline; AI, HP
          // and boss-stage progression remain untouched.
          umibozu: STAGE.id === "rain-port",
          pose: "idle",
          title: bossTitle,
          bossIndex: bossStage,
          stageId: STAGE.id,
          bossTheme: STAGE_ENEMY.bossTheme,
          oilReward: plan.oil,
          hp: bossHp,
          max: bossHp,
          speed: plan.role === "gate" ? 70 : plan.role === "final" ? 46 : 58,
          flash: 0,
          wob: 0,
          attackCd: 1.2,
          introduced
        });
        if (plan.role === "final") { finalBossWaitT = 0; finalBossHintT = 0; }
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
        const needsIntro = STAGE.id !== "night-town" && bs.introduced === false && !!bs.word;
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
      bossQ.barrierTimer = bs.barrierTimer;
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
    updateCharmDrops(dt);

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
          if (job.eliminatedIdx === i || job.wrong?.includes(i)) return;
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
    // dev=1&stage=rain-port&s2artprod=1 專用：2D 鏡頭中心往戰鬥帶中央（北建築～南海）靠攏 60%，
    // 搭配 viewport.js 的 S2 dev zoom；tilt .60 的偏移隨 tilt 平滑歸零。非 dev S2 完全不變。
    const s2Gain = (STAGE.id === "rain-port" && window.isS2ArtProdEnabled?.())
      ? Math.max(0, Math.min(1, (tiltK() - 0.6) / 0.4)) : 0;
    const camFocusY = P.y + (450 - P.y) * 0.6 * s2Gain;
    const targetCamY = camFocusY - H / (2 * tiltK());
    const curCam = RENDERER.getCam();
    // rain-port：鏡頭 Y 夾在戰鬥帶中心 ± 視野一半
    let clampedCamY = targetCamY;
    if (runBounds) {
      const halfViewH = H / (2 * tiltK());
      const minCamY = runBounds.minY - halfViewH;
      const maxCamY = runBounds.maxY - halfViewH;
      clampedCamY = Math.max(minCamY, Math.min(maxCamY, targetCamY));
    }
    RENDERER.setCam(
      curCam.x + (targetCamX - curCam.x) * Math.min(1, dt * 9),
      curCam.y + (clampedCamY - curCam.y) * Math.min(1, dt * 9)
    );

    // 融合特效時序推進、命中判定與地面短灼燒傷害
    // 題板／讀題 safeRead 期間與武器、敵人同步凍結，避免合技在答題時繼續扣血。
    for (const fx of fusionEffects) {
      if (safeRead) break;
      fx.burnAge += dt;
      fx.progress = Math.min(1, fx.burnAge / (fx.life || 0.8));
      const warn = Number(fx.warn) || 0;
      if (fx.burnAge < warn) fx.phase = "warn";
      else if (fx.kind === "fusion_inkblade") fx.phase = fx.progress >= 0.8 ? "fade" : "active";
      else fx.phase = fx.progress >= 0.8 ? "fade" : "active";

      // 地面焦墨短灼燒判定 (短灼燒，同目標 CD，目標上限)
      if (fx.kind === "fusion_inkblade" && fx.burnAge < (fx.burnDuration || 2.5)) {
        fx.tick = (fx.tick ?? 0) - dt;
        if (fx.tick <= 0) {
          fx.tick = 0.5; // 每 0.5 秒結算一次灼燒
          const sDmg = typeof fx.scorchDmg === "number" ? fx.scorchDmg : 9;
          let sHits = 0;
          for (const e of enemies) {
            if (e.hp > 0 && !e.shield && !e.vanish && !e.done && sHits < 4) {
              if (e.fusionBurnUntil && e.fusionBurnUntil > elapsed) continue;
              const d = dist({ x: fx.x, y: fx.y }, e);
              if (d <= (fx.radius || 280) * 0.85) {
                let diff = Math.abs(Math.atan2(e.y - fx.y, e.x - fx.x) - fx.angle);
                while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
                if (diff <= (fx.spread || 2.0) / 2) {
                  sHits++;
                  e.fusionBurnUntil = elapsed + 0.45;
                  hurt(e, sDmg, false);
                  fusionStats.scorchDmg += sDmg;
                  e.flash = 0.08;
                }
              }
            }
          }
        }
      }

      // 雷狐居合：短預警結束時一次線性結算，每 cast 同敵一次。
      if (fx.kind === "fusion_foxiai" && !fx.triggered && fx.burnAge >= warn) {
        fx.triggered = true;
        const hits = fusionLineTargets(fx.x, fx.y, fx.angle, fx.radius, fx.width || 64, fx.maxTargets || 4);
        const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
        for (const e of hits) {
          if (!fusionTargetEligible(e) || fx.hitSet.has(e)) continue;
          fx.hitSet.add(e);
          const dmg = fx.damage * crit.mult;
          hurt(e, dmg, crit.isCrit);
          fusionRecordDamage("fusion_foxiai", dmg);
          SKILLFX.play("thunder", "hit", 5, { x: e.x, y: e.y, ang: fx.angle, crit: crit.isCrit });
        }
        if (hits.length) RENDERER.triggerShake(4);
      }

      // 退魔符刃：斬擊瞬傷後，每個符印在自己的短延遲以當前位置引爆。
      if (fx.kind === "fusion_exorcistblade" && Array.isArray(fx.marks)) {
        for (const mark of fx.marks) {
          if (mark.triggered || fx.burnAge < mark.delay) continue;
          mark.triggered = true;
          const primary = mark.target;
          if (!fusionTargetEligible(primary)) continue;
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const dmg = mark.damage * crit.mult;
          hurt(primary, dmg, crit.isCrit);
          fusionRecordDamage("fusion_exorcistblade", dmg);
          let extra = 0;
          const maxExtra = Math.max(0, (fx.maxBurstTargets || 3) - 1);
          for (const e of enemies) {
            if (extra >= maxExtra) break;
            if (!fusionTargetEligible(e) || e === primary) continue;
            if (fx.splashHits.has(e) || dist(e, primary) > mark.radius) continue;
            fx.splashHits.add(e);
            const splash = dmg * 0.5;
            hurt(e, splash, false);
            fusionRecordDamage("fusion_exorcistblade", splash);
            extra++;
          }
          SKILLFX.play("boom", "hit", 5, { x: primary.x, y: primary.y, r: mark.radius });
        }
      }

      // 妖火結界：max1 域，固定脈衝次數；首碰擊退尋常妖怪，Boss 不受控。
      if (fx.kind === "fusion_foxfirebarrier") {
        while ((fx.pulseIndex || 0) < (fx.pulses || 0) && fx.burnAge >= (fx.nextPulse || 0)) {
          fx.pulseIndex = (fx.pulseIndex || 0) + 1;
          fx.nextPulse = (fx.nextPulse || 0) + (fx.pulseInterval || 0.35);
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const targets = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, fx) <= fx.radius)
            .sort((a, b) => dist(a, fx) - dist(b, fx))
            .slice(0, fx.maxTargets || 6);
          for (const e of targets) {
            const dmg = fx.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_foxfirebarrier", dmg);
            if (e.type !== "boss" && !fx.knocked.has(e)) {
              fx.knocked.add(e);
              knockback(e, fx.knockback || 70, fx);
            }
          }
          if (targets.length) RENDERER.triggerShake(2);
        }
      }

      // 退魔封陣：固定落點預警後有限多段符爆，不永久控制 Boss。
      if (fx.kind === "fusion_exorcistseal") {
        while ((fx.pulseIndex || 0) < (fx.pulses || 0) && fx.burnAge >= (fx.nextPulse || 0)) {
          fx.pulseIndex = (fx.pulseIndex || 0) + 1;
          fx.nextPulse = (fx.nextPulse || 0) + (fx.pulseInterval || 0.15);
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const targets = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, fx) <= fx.radius)
            .sort((a, b) => dist(a, fx) - dist(b, fx))
            .slice(0, fx.maxTargets || 6);
          for (const e of targets) {
            const dmg = fx.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_exorcistseal", dmg);
          }
          if (targets.length) RENDERER.triggerShake(3);
        }
      }

      // 斬界輪：擴散內外雙環，每環逐敵一次；Boss 只吃傷害，不受控。
      if (fx.kind === "fusion_slashwheel") {
        const t = Math.min(1, (fx.burnAge || 0) / (fx.expandTime || 0.45));
        fx.currentRadius = (fx.radius || 320) * t;
        for (const band of (fx.bands || [])) {
          if (band.fired || fx.currentRadius < band.at) continue;
          band.fired = true;
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          let hits = 0;
          for (const e of enemies) {
            if (hits >= (band.maxTargets || 5) || !fusionTargetEligible(e) || band.hits.has(e)) continue;
            if (Math.abs(dist({ x: fx.x, y: fx.y }, e) - band.at) > 30) continue;
            band.hits.add(e);
            hits++;
            const dmg = band.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_slashwheel", dmg);
            SKILLFX.play("katana", "hit", 5, { x: e.x, y: e.y, ang: fx.angle, crit: crit.isCrit });
          }
          if (hits) RENDERER.triggerShake(2);
        }
      }

      // 狐雷天燈：三盞燈籠各自飛向鎖定點，預警後定點落雷；每燈每敵一次。
      if (fx.kind === "fusion_foxthunderlantern" && Array.isArray(fx.lanterns)) {
        for (const ln of fx.lanterns) {
          const tr = Math.min(1, (fx.burnAge || 0) / Math.max(0.001, ln.delay || 0.001));
          ln.x = ln.fromX + (ln.targetX - ln.fromX) * tr;
          ln.y = ln.fromY + (ln.targetY - ln.fromY) * tr;
          if (ln.struck || (fx.burnAge || 0) < ln.delay) continue;
          ln.struck = true;
          ln.struckAt = fx.burnAge;
          if (!fx.audioPlayed) { AUDIO.thunder(5); fx.audioPlayed = true; }
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const targets = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, ln) <= (fx.strikeRadius || 64))
            .sort((a, b) => dist(a, ln) - dist(b, ln))
            .slice(0, fx.maxTargets || 3);
          for (let i = 0; i < targets.length; i++) {
            const e = targets[i];
            if (ln.hitSet.has(e)) continue;
            ln.hitSet.add(e);
            const raw = i === 0 ? fx.damage : fx.damage * (fx.splashScale || 0.5);
            const dmg = raw * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_foxthunderlantern", dmg);
            SKILLFX.play("thunder", "hit", 5, { x: e.x, y: e.y, crit: crit.isCrit });
          }
          RENDERER.triggerShake(2);
        }
      }

      // 炎符祭：火符交錯飛行、依序引爆，每符只留兩次短燼；派生固定上限。
      if (fx.kind === "fusion_flamefestival" && Array.isArray(fx.talismans)) {
        for (const t of fx.talismans) {
          const tr = Math.min(1, (fx.burnAge || 0) / Math.max(0.001, t.delay || 0.001));
          t.x = t.fromX + (t.targetX - t.fromX) * tr;
          t.y = t.fromY + (t.targetY - t.fromY) * tr;
          if (t.exploded || (fx.burnAge || 0) < t.delay) continue;
          t.exploded = true;
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const hits = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, t) <= (fx.landRadius || 62))
            .sort((a, b) => dist(a, t) - dist(b, t))
            .slice(0, fx.maxTargets || 3);
          for (const e of hits) {
            if (t.hitSet.has(e)) continue;
            t.hitSet.add(e);
            const dmg = fx.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_flamefestival", dmg);
            SKILLFX.play("boom", "hit", 5, { x: e.x, y: e.y, r: fx.landRadius });
          }
          if (fx.embers.length < 8) {
            fx.embers.push({
              x: t.x,
              y: t.y,
              ticksLeft: fx.emberTicks || 2,
              nextTick: fx.emberInterval || 0.35,
              hitSet: new Set()
            });
          }
        }
        for (const em of fx.embers) {
          if (em.ticksLeft <= 0) continue;
          em.nextTick -= dt;
          if (em.nextTick > 0) continue;
          em.nextTick = fx.emberInterval || 0.35;
          em.ticksLeft--;
          em.hitSet = new Set();
          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          const hits = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, em) <= (fx.emberRadius || 48))
            .sort((a, b) => dist(a, em) - dist(b, em))
            .slice(0, fx.emberMaxTargets || 2);
          for (const e of hits) {
            if (em.hitSet.has(e)) continue;
            em.hitSet.add(e);
            const dmg = fx.emberDamage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_flamefestival", dmg);
          }
          if (hits.length) burst(em.x, em.y, "#ff7043", 4);
        }
      }

      // 雷陣封界：大型陣域每 0.8 秒鎖定最多 3 個威脅，0.6 秒警示後定點落雷。
      if (fx.kind === "fusion_thundercircle") {
        while ((fx.pulseIndex || 0) < (fx.pulses || 0) && (fx.burnAge || 0) >= (fx.nextPulse || 0)) {
          fx.pulseIndex = (fx.pulseIndex || 0) + 1;
          fx.nextPulse = (fx.nextPulse || 0) + (fx.pulseInterval || 0.8);
          const marks = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, fx) <= (fx.radius || 240))
            .sort((a, b) => dist(a, fx) - dist(b, fx))
            .slice(0, 3);
          for (const e of marks) {
            if (fx.strikes.length >= 12) break;
            fx.strikes.push({
              x: e.x,
              y: e.y,
              delay: fx.pulseWarning || 0.6,
              radius: fx.pulseRadius || 90,
              damage: fx.pulseDamage,
              critChance: fx.critChance,
              critMult: fx.critMult,
              triggered: false,
              hitSet: new Set()
            });
          }
        }
        for (const s of fx.strikes) {
          s.delay -= dt;
          if (s.triggered || s.delay > 0) continue;
          s.triggered = true;
          if (!fx.audioPlayed) { AUDIO.thunder(5); fx.audioPlayed = true; }
          const crit = rollCrit({ critChance: s.critChance, critMult: s.critMult });
          let hits = 0;
          for (const e of enemies) {
            if (hits >= 4 || !fusionTargetEligible(e) || s.hitSet.has(e)) continue;
            if (dist(e, s) > (s.radius || 90)) continue;
            s.hitSet.add(e);
            hits++;
            const dmg = s.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_thundercircle", dmg);
            SKILLFX.play("thunder", "hit", 5, { x: e.x, y: e.y, crit: crit.isCrit });
          }
          if (hits) RENDERER.triggerShake(3);
        }
      }

      // 雷符神罰：單一主範圍爆炸 + 每名真命中敵人一次額外天狐雷（去重、Boss倍率、跨幀去重、真HP）
      // 設計：主爆炸在 fx.firstHitAt 觸發（首個 talisman delay + warnStrike），渲染器依此時間播主圖。
      // hitEvents 記錄每個真命中敵人的世界座標與判定時間，供渲染器在對應時刻畫天狐雷。
      if (fx.kind === "fusion_thundertalisman" && Array.isArray(fx.talismans)) {
        const now = fx.burnAge || 0;
        const firstTalismanDelay = Math.min(...fx.talismans.map(t => t.delay || 0));
        const firstHitAt = firstTalismanDelay + (fx.warnStrike || 0.36); // 首次可能命中時間
        
        // 初始化 hitEvents 與跨幀去重集合
        if (!fx.hitEvents) fx.hitEvents = [];
        if (!fx.hitEnemyIds) fx.hitEnemyIds = new Set();
        if (!fx.mainExplosionTriggered) fx.mainExplosionTriggered = false;

        // 主爆炸觸發：在 firstHitAt 時刻（只觸發一次）
        if (!fx.mainExplosionTriggered && now >= firstHitAt) {
          fx.mainExplosionTriggered = true;
          fx.firstHitAt = firstHitAt; // 供渲染器讀取
          
          // 主爆炸中心：施法點（玩家位置），而非符目標平均
          // 符從玩家飛出，主爆炸在施法點產生，覆蓋前方扇形區域
          fx.mainExplosionCenter = { x: fx.x, y: fx.y };

          // 判定主爆炸範圍內的敵人（單次判定，跨幀去重）
          // 半徑放大以覆蓋符飛行扇形區域（符飛行 140-190px）
          const strikeRadius = Math.max(fx.strikeRadius || 70, 200);
          const hits = enemies
            .filter(e => fusionTargetEligible(e) && dist(e, { x: fx.x, y: fx.y }) <= strikeRadius)
            .sort((a, b) => dist(a, { x: fx.x, y: fx.y }) - dist(b, { x: fx.x, y: fx.y }))
            .slice(0, fx.maxTargets || 4);

          const crit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
          for (const e of hits) {
            const enemyId = e.id || (e._id = ++fusionEffects._idCounter || 1);
            if (fx.hitEnemyIds.has(enemyId)) continue;
            fx.hitEnemyIds.add(enemyId);

            // 主爆炸傷害
            const dmg = fx.damage * crit.mult;
            hurt(e, dmg, crit.isCrit);
            fusionRecordDamage("fusion_thundertalisman", dmg);
            SKILLFX.play("thunder", "hit", 5, { x: e.x, y: e.y, crit: crit.isCrit });

            // 記錄命中事件：世界座標 + 判定時間（相對 fx 啟動）
            fx.hitEvents.push({
              enemyId,
              x: e.x,
              y: e.y,
              at: now, // 判定時間
              isBoss: e.type === "boss",
              mainDmg: dmg
            });
          }
          if (hits.length) RENDERER.triggerShake(3);
        }

        // 額外天狐雷：對每個 hitEvents 中的敵人，在判定時間點各發一次（跨幀去重已由 hitEnemyIds 保證）
        if (fx.thunderTickDamage && fx.hitEvents.length > 0) {
          for (const evt of fx.hitEvents) {
            // 只在判定幀附近處理一次（避免重複扣血）
            if (evt.processed) continue;
            if (now >= evt.at && now < evt.at + 0.05) { // 50ms 窗口
              evt.processed = true;
              const e = enemies.find(en => (en.id || en._id) === evt.enemyId);
              if (!e || e.hp <= 0) continue;
              
              const bossScale = e.type === "boss" ? (fx.thunderTickBossScale ?? 0.5) : 1.0;
              const thunderCrit = rollCrit({ critChance: fx.critChance, critMult: fx.critMult });
              const tickDmg = fx.thunderTickDamage * bossScale * thunderCrit.mult;
              hurt(e, tickDmg, thunderCrit.isCrit);
              fusionRecordDamage("fusion_thundertalisman", tickDmg);
              SKILLFX.play("thunder", "hit", 5, { x: e.x, y: e.y, crit: thunderCrit.isCrit });
              
              // 補充事件資訊供渲染器
              evt.thunderDmg = tickDmg;
              evt.thunderAt = now;
            }
          }
        }

        // 更新 talisman 位置動畫（視覺用，不參與判定）
        for (const t of fx.talismans) {
          const tr = Math.min(1, now / Math.max(0.001, t.delay || 0.001));
          t.x = t.fromX + (t.targetX - t.fromX) * tr;
          t.y = t.fromY + (t.targetY - t.fromY) * tr;
        }
      }
    }
    fusionEffects = fusionEffects.filter(fx => {
      const ttl = fx.kind === "fusion_inkblade" ? (fx.burnDuration || 2.5) : (fx.life || 0.8);
      return fx.burnAge < ttl;
    });
    // 保留 _idCounter 供敵人去重使用（filter 會建立新陣列）
    if (!fusionEffects._idCounter) fusionEffects._idCounter = 0;

    // 融合繪馬地面互動檢查
    if (fusionToken && window.FUSION && typeof window.FUSION.getState === "function") {
      const fState = window.FUSION.getState();
      if (fState.state === "ground" && dist(P, fusionToken) <= 48) {
        window.FUSION.pickupTalisman();
        openFusionPanel();
      }
    }

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

  function drawBossHazard(h, owner) {
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;

    // 第四參數傳真 Boss；舊三參數 handler 相容，strict true 才略過 fallback。
    const portDraw = RENDERER && RENDERER.drawBossHazard;
    if (typeof portDraw === "function" && portDraw(ctx, h, elapsed, owner) === true) return;

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
        const alpha = job.reading && job.barrierTimer != null ? 0.15 : (job.sanctuaryT > 0 ? 0.85 : 0.55);
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

      // 同一藍色結界圈順時針逐漸失去光芒，不另畫黃色計時器。
      if (job && job.reading && job.barrierTimer != null) {
        const timerFraction = Math.max(0, Math.min(1, job.barrierTimer / 10.0));
        const barrierR = 245, barrierY = job.to.y + 70, barrierRy = 165 / tiltK();
        ctx.save();
        // 藍圈邊緣向上升起，錯開生命週期；只作既有結界的輔助粒子。
        for (let pi = 0; pi < 72; pi++) {
          const pAngle = (pi / 72) * 6.283;
          // 藍圈暗下來的順時針扇區不再閃粒子。
          const ringPos = (((pAngle + Math.PI / 2) % 6.283) + 6.283) % 6.283 / 6.283;
          if (ringPos < 1 - timerFraction) continue;
          const age = (animElapsed * 0.6 + pi * 0.618) % 1;
          const px = job.to.x + Math.cos(pAngle) * barrierR;
          const py = barrierY + Math.sin(pAngle) * barrierRy;
          upright(px, py, () => {
            const drift = Math.sin(pi * 2.1 + age * 4) * age * 16;
            const rise = age * (42 + pi % 5 * 9);
            const blink = 0.55 + 0.45 * Math.sin(animElapsed * 9 + pi * 1.7);
            ctx.fillStyle = `rgba(145,240,255,${Math.sin(age * Math.PI) * blink * 0.85})`;
            ctx.beginPath();ctx.arc(px + drift, py - rise, 1.5 + pi % 3 * 0.55, 0, 6.283);ctx.fill();
          });
        }
        // 沿用外層同一藍色光環的位置，從正上方順時針逐步熄滅。
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(105, 225, 255, 0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(job.to.x, barrierY, barrierR, barrierRy, 0, -Math.PI/2 + 6.283 * (1-timerFraction), -Math.PI/2 + 6.283);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";

        // 10 秒醒目倒數
        const secs = Math.ceil(job.barrierTimer);
        ctx.textAlign = "center";
        ctx.font = "600 17px 'Kaisei Decol', 'Noto Serif JP', serif";
        ctx.strokeStyle = "#112d3a";
        ctx.lineWidth = 3.5;
        ctx.strokeText(`結界  ${secs}秒`, job.to.x, barrierY - 120);
        ctx.fillStyle = "#b4f3ff";
        ctx.fillText(`結界  ${secs}秒`, job.to.x, barrierY - 120);
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

    for (const d of charmDrops) {
      if (!nearView(d.x, d.y, 60)) continue;
      paintCharmDrop(d);
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
      const w=zone.r*2.1*pulse,h=zone.r*1.23*(animateGroundHeat?1+Math.sin(age*6.2)*0.02:1);
      ctx.save();ctx.globalAlpha=fade;
      let art = null;
      const res = typeof window !== "undefined" ? window.STAGE_ART_RESOLVER : null;
      if (res && typeof res.getSharedArt === "function") {
        const meta = res.getSharedArt("skills", "fire", "dragon_burning_ground_l5");
        if (meta && meta.status === "APPROVED") {
          art = window.ART && (window.ART[meta.id] || window.ART.dragon_burning_ground_l5);
        }
      } else {
        art = window.ART?.dragon_burning_ground_l5;
      }
      if(art?.naturalWidth>0){
        ctx.drawImage(art,zone.x-w/2+(animateGroundHeat?Math.sin(age*3.5)*2:0),zone.y-h/2,w,h);
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
    // 所有融合主圖先於怪物及 Boss 警示繪製，避免自己的奧義遮住敵人和危險範圍。
    for (const fx of fusionEffects) {
      RENDERER.drawFusionFx?.(ctx, fx, visualElapsed);
    }

    for (const e of enemies) if (e.hp > 0 && e.hazard && nearView(e.hazard.x, e.hazard.y, 480)) {
      if (e.hazard.kind === "shiome") drawShiomeWave(e.hazard);
      else drawBossHazard(e.hazard, e);
    }

    // 獨立於 safeRead 的角色動畫時鐘，確保世界暫停時角色仍能流暢邁步／衝刺
    const pAnimElapsed = typeof animElapsed === "number" ? animElapsed : elapsed;
    // 7. 依腳底地面接觸點排序；北側角色被屋頂遮住，南側角色在屋前。
    const movement = move();
    const actors = [
      ...houses.filter(houseSeen).map(h => ({ house: h, y: h.y + 48 })),
      ...enemies.filter(e => nearView(e.x, e.y)).map(e => ({ enemy: e, y: e.y + (e.type === "boss" ? 44 : e.type === "mis" ? 27 : 19) })),
      ...LAMPS.filter(l => nearView(l.x, l.y)).map(l => ({ lamp: l, y: l.y + 8 })),
      { player: P, y: P.y },
      // Single continuous scenery pass at EVERY tilt. No cached↔live toggle.
      ...activeChunks.flatMap(chunk => [
        ...(STAGE.id === "sakura-pass" || !chunk.decor?.torii ? [] : [{torii:chunk,y:chunk.y+chunk.h/2+36}]),
        ...(STAGE.id === "sakura-pass" ? [] : (chunk.decor?.sakuraTrees||[])).map(tree=>({tree,y:tree.y})),
        ...(chunk.decor?.ancientSakura || []).map(tree => ({ ancient: tree, y: tree.y })),
        ...((STAGE.id === "sakura-pass" && chunk.decor?.stage3Props) || []).map(prop => ({ sakuraProp: prop, y: prop.y })),
        ...((STAGE.id === "rain-port" && chunk.decor?.port?.props) || []).map(prop => ({ port: prop, y: prop.y }))
      ]).filter(actor => actor.torii
        ? nearView(actor.torii.x+actor.torii.w/2,actor.y,140)
        : actor.ancient ? houseSeen(actor.ancient)
        : actor.port ? nearView(actor.port.x, actor.port.y, 160)
        : actor.sakuraProp ? nearView(actor.sakuraProp.x, actor.sakuraProp.y, 160)
        : nearView(actor.tree.x,actor.tree.y,140))
    ];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.torii || actor.tree || actor.ancient) RENDERER.drawDecorActor?.(actor,P.y);
      else if (actor.port) RENDERER.drawPortProp?.(actor.port, P.y);
      else if (actor.sakuraProp) RENDERER.drawSakuraProp?.(actor.sakuraProp, P.y);
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
} else if (actor.player) {
        // Draw player AND its orbit flames at the player's actual ground-contact Y
        // in the actor depth-sort pass. Previously, when fire was equipped,
        // the player was painted AFTER every building, floating in front of roofs.
        const effSpeed = getEffectiveMoveSpeed();
        const frontFireballs = [];
        RENDERER.drawPlayerShadow?.(P, pAnimElapsed, movement, effSpeed);

        if (WL.fire > 0) {
          const fireSpec = resolveAttackSpec("fire", WL.fire, getBuildState());
          const count = fireSpec.count;
          const rx = fireSpec.rx, ry = fireSpec.ry;
          const awaySlots = new Set(ghosts.filter(p => p.fireAttack && p.life > 0 && p.level === WL.fire).map(p => p.slot));
          for (let i = 0; i < count; i++) {
            if (awaySlots.has(i)) continue;
            const a = fAng + (i * 6.283) / count;
            const fx = P.x + Math.cos(a) * rx;
            const fy = P.y + Math.sin(a) * ry;
            const fireData = { x: fx, y: fy, ang: a, origin: P, orbitR: rx, orbitRy: ry, rx, ry, time: elapsed + i * 0.2, orbit: true };
            // Larger world Y is nearer to the camera (not farther).
            if (fy < P.y) upright(fx, fy, () => SKILLFX.paint(ctx, "fire", WL.fire, fireData));
            else frontFireballs.push({ fx, fy, fireData });
          }
        }

        upright(P.x, P.y, () => drawCargo());
        upright(P.x, P.y, () => RENDERER.drawPlayer(P, dashT > 0, P.inv, pAnimElapsed, movement, b.shield || 0, playerAttackPoseT > 0, playerHurtPoseT > 0, effSpeed));
        for (const fb of frontFireballs) {
          upright(fb.fx, fb.fy, () => SKILLFX.paint(ctx, "fire", WL.fire, fb.fireData));
        }
      }
    }

    // 8. Weapon projectiles (after depth-sorted actors).
    for (const q of proj) upright(q.x,q.y,()=>
      SKILLFX.paint(ctx, "boom", q.level??WL.boom, { x: q.x, y: q.y, spin: elapsed * (q.stuck ? 4 : 16), age:q.t, life:q.stuck ? 1 : q.life, exitAlpha:1 }));

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

    // 14. 飄字：受傷提示用墨邊。淡粉 Boss 出場台詞加黑墨描邊與局部暗底，避免被雨港深淺背景吃掉。
    for (const t of texts) {
      const injury = typeof t.v === "string" && /^(受創|妖火灼身)/.test(t.v);
      const bossLine = !injury && typeof t.v === "string" && /浪潮將吞噬|出現！/.test(t.v);
      ctx.save();
      ctx.globalAlpha = injury ? clamp(t.life * 1.15, 0, 1) : clamp(t.life, 0, 1);
      ctx.textAlign = "center";
      ctx.font = UI.readableFont(17, "bold");
      uprightHere(t.x,t.y);
      if (bossLine) {
        const half = Math.max(18, ctx.measureText(t.v).width) / 2 + 12;
        const top = t.y - 18;
        const bottom = t.y + 7;
        const plate = ctx.createLinearGradient(t.x, top, t.x, bottom);
        plate.addColorStop(0, "rgba(12, 8, 10, 0)");
        plate.addColorStop(0.22, "rgba(12, 8, 10, 0.46)");
        plate.addColorStop(0.78, "rgba(12, 8, 10, 0.46)");
        plate.addColorStop(1, "rgba(12, 8, 10, 0)");
        ctx.fillStyle = plate;
        ctx.fillRect(t.x - half, top, half * 2, bottom - top);
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#140c0e";
        ctx.lineWidth = 3.2;
        ctx.strokeText(t.v, t.x, t.y);
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 1.5;
        ctx.shadowOffsetY = 1;
      } else if (injury) {
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
          ctx.fillStyle=job.eliminatedIdx===i || job.wrong?.includes(i)?'#888899':'#161224';
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
        // 答錯時不標注當題中文釋義以防洩題
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
      // 飛行火球以核准 raster 為主體，不繪製橘圓、虛線或弧線替身。
      let art = null;
      const res = typeof window !== "undefined" ? window.STAGE_ART_RESOLVER : null;
      if (res && typeof res.getSharedArt === "function") {
        const meta = res.getSharedArt("skills", "fire", "dragon_fireball_l5");
        if (meta && meta.status === "APPROVED") {
          art = window.ART && (window.ART[meta.id] || window.ART.dragon_fireball_l5);
        }
      } else {
        art = window.ART?.dragon_fireball_l5;
      }
      if(art?.naturalWidth>0){
        ctx.drawImage(art,-72,-72,144,144);
      }
      ctx.restore();
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

    // 繪製地面融合繪馬
    if (fusionToken && window.FUSION && typeof window.FUSION.getState === "function") {
      const fState = window.FUSION.getState();
      if (fState.state === "ground") {
        upright(fusionToken.x, fusionToken.y, () => {
          ctx.save();
          ctx.fillStyle = "rgba(220, 160, 60, 0.95)";
          ctx.beginPath();
          ctx.moveTo(0, -18);
          ctx.lineTo(16, -6);
          ctx.lineTo(16, 16);
          ctx.lineTo(-16, 16);
          ctx.lineTo(-16, -6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#4a2a10";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#3a1505";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("合", 0, 4);
          ctx.restore();
        });
      }
    }

    // 融合圖已在地面層繪製，這裡不重畫，讓怪物／玩家／Boss 警示始終在上方。
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
    UI.selectSecretDetail?.(null);
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
    if (state === "charmswap") {
      e.preventDefault();
      if (e.repeat) return;
      if (action === "l" || e.code === "ArrowLeft") charmSwapIndex = (charmSwapIndex + CHARM_SLOT_MAX - 1) % CHARM_SLOT_MAX;
      else if (action === "r" || e.code === "ArrowRight") charmSwapIndex = (charmSwapIndex + 1) % CHARM_SLOT_MAX;
      else if (!e.repeat && "123".includes(e.key) && e.key.length === 1) resolveCharmSwap(+e.key - 1);
      else if (e.key === "Enter" || action === "interact") resolveCharmSwap("confirm");
      else if (e.code === "Escape" || action === "pause" || e.key === "Backspace") resolveCharmSwap("cancel");
      return;
    }
    if (action === "pause") {
      if (state === "codex") {
        state = codexBack;
        return;
      }
      if (state === "overworld" && e.key === "Escape") {
        requestOverworldExit();
        return;
      }
      if (state === "won") { activateMenu("world"); return; }
      if (state === "lost") { activateMenu("menu"); return; }
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
    if (state === "fusion") {
      if (e.code === 'Tab' || ['u','d','l','r'].includes(action) || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) {
          const back = e.code === 'Tab' ? (e.shiftKey ? -1 : 1) : (action === 'u' || action === 'l' || e.code === 'ArrowLeft') ? -1 : 1;
          fusionMoveFocus(back);
        }
      } else if (!e.repeat && (e.key === 'Enter' || action === 'interact' || e.code === 'Space')) {
        e.preventDefault();
        fusionActivateFocused();
      } else if (!e.repeat && (e.code === 'Escape' || e.key === 'Escape')) {
        e.preventDefault();
        fusionCancelPanel();
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
    if (e.code === 'KeyF' && !e.repeat && window.FUSION && typeof window.FUSION.getState === "function") {
      const fState = window.FUSION.getState();
      if (fState.state === "held") {
        e.preventDefault();
        if (openFusionPanel()) return;
      }
    }
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
    const cards = typeof UI.levelUpLayout === "function" ? UI.levelUpLayout(choices.length)?.cards : null;
    const count = choices.length;
    for (let i = 0; i < count; i++) {
      const rect = cards?.[i] || {x:card.x,y:card.y+i*(card.h+card.gap),w:card.w,h:card.h};
      if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
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
      for (const btn of UI.pauseButtons(pausePage)) {
        const x=btn.x ?? bx, w=btn.w ?? btnW, h=btn.h ?? btnH;
        if (hitButton(p, {x, y:btn.y, w, h})) {
          menuFocus = UI.pauseButtons(pausePage).findIndex(b=>b.id===btn.id);
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
      // 已移除「點邊緣 30px 即退出」：手機易誤觸，改只用返回鈕（與單字頁一致）。
      return;
    }
    if (state === "overworld") {
      const back = window.OVERWORLD.backButton();
      if (hitButton(p, back)) {
        requestOverworldExit();
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
    if (state === "charmswap") {
      for (const h of charmSwapHits) {
        if (p.x < h.x || p.x > h.x + h.w || p.y < h.y || p.y > h.y + h.h) continue;
        if (h.id === "swap_discard") resolveCharmSwap("discard");
        else if (h.id === "swap_0") resolveCharmSwap(0);
        else if (h.id === "swap_1") resolveCharmSwap(1);
        else if (h.id === "swap_2") resolveCharmSwap(2);
        return;
      }
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
    if (state === "fusion" && window.FUSION && typeof UI.fusionLayout === "function") {
      const model = window.FUSION.getViewModel ? window.FUSION.getViewModel() : {};
      const layout = UI.fusionLayout(null, model);
      if (layout && layout.buttons) {
        for (let i = 0; i < layout.buttons.length; i++) {
          const btn = layout.buttons[i];
          if (hitButton(p, btn)) {
            fusionPointerButton(btn, i);
            return;
          }
        }
      }
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
    if (state === "play" && window.FUSION && typeof window.FUSION.getState === "function") {
      const fState = window.FUSION.getState();
      if (fState.state === "held" && hit(p, btnFusionHeld)) {
        if (openFusionPanel()) return;
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
        : state === "pause" ? UI.pauseButtons(pausePage)
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
    fusionEffects = []; fusionEffects._idCounter = 0;
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
    const liveRun = state === "play" || state === "pause" || state === "levelup" || state === "fusion" || state === "charmswap"
      || (state === "codex" && (codexBack === "play" || codexBack === "pause" || codexBack === "levelup" || codexBack === "fusion"));
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
    // 面板背後的確認狀態沒了就回 play，避免 update 永遠不跑、整局卡在融合或換守。
    if (state === "charmswap" && !pendingCharmOffer) state = "play";
    if (state === "fusion") {
      const phase = window.FUSION && typeof window.FUSION.getState === "function" ? window.FUSION.getState().state : "";
      if (phase !== "confirming") state = "play";
    }
    if (state === "play") {
      update(dt, hitStopped);
    } else if (state === "levelup" || state === "fusion") {
      // 升級選卡與融合確認期間凍結燈油消耗與遊戲時間，給予玩家安心閱讀與思考時間
    } else if (state === "lampout") {
      updateLampSequence(dt);
    } else if (state === "victory") {
      updateVictorySequence(dt);
    } else if (state === "overworld") {
      window.OVERWORLD.update(overworld, dt);
      if (overworldNoticeT > 0) overworldNoticeT = Math.max(0, overworldNoticeT - dt);
    if (overworldExitArmT > 0) overworldExitArmT = Math.max(0, overworldExitArmT - dt);
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
    btnFusionHeld.x = btnE.x;
    btnFusionHeld.y = btnE.y - 85;
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
      if (state === "overworld" && overworldExitArmT > 0) {
        ctx.save();
        const msg = "再按一次返回主選單";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(msg).width + 36;
        ctx.globalAlpha = Math.min(1, overworldExitArmT / 0.4);
        ctx.fillStyle = "rgba(20, 10, 14, 0.85)";
        ctx.fillRect(W / 2 - tw / 2, H - 120, tw, 36);
        ctx.fillStyle = "#ffe9a0";
        ctx.fillText(msg, W / 2, H - 102);
        ctx.restore();
      }
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
        // 第2～8關：破曉且終王已倒，仍須送滿委託；常駐提示剩餘件數（勝利規則不變）。
        if (state === "play" && STAGE.id !== "night-town" && elapsed >= DAWN && finalBossDefeated && delivered < GOAL_DELIVERIES) {
          ctx.save();
          const msg = `破曉已至・還差 ${GOAL_DELIVERIES - delivered} 件委託`;
          ctx.font = "bold 18px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const tw = ctx.measureText(msg).width + 32;
          ctx.fillStyle = "rgba(20, 10, 14, 0.78)";
          ctx.fillRect(W / 2 - tw / 2, 96, tw, 32);
          ctx.fillStyle = "#ffd8a0";
          ctx.fillText(msg, W / 2, 112);
          ctx.restore();
        }
        if (typeof UI.drawCharmHud === "function") {
          UI.drawCharmHud(ctx, {
            charms: charmViewList(),
            maxSlots: CHARM_SLOT_MAX,
            pendingDrop: charmPendingView(),
            inputMode
          });
        }
        if (state === 'play') UI.drawButton(ctx, btnView,
          (window.VIEWPORT?.tiltTargetScale?.() ?? tiltK()) === 1 ? '2.5D' : '2D', {size: 13, quiet: true, scrollText: false});
        if (state === "play" && window.FUSION?.getState?.().state === "held") {
          const tag = UI.FUSION_REOPEN_BTN;
          if (tag) {
            btnFusionHeld.x = tag.x + tag.w / 2;
            btnFusionHeld.y = tag.y + tag.h / 2;
            btnFusionHeld.r = Math.min(24, tag.h / 2);
          }
          UI.drawFusionReopenButton?.(ctx);
        }
        if (surgeWarningT > 0) UI.drawSurgeWarning(ctx, surgeWarningT);
        if (state === "play") drawDragonHudOverlay(frameShakeOffset);
        if (titleCardT > 0 && state === "play") UI.drawTitleCard(ctx, STAGE, stageChapter(), titleCardT);
        const activeBoss = enemies.find(e => e.type === "boss" && e.hp > 0) || null;
        const sealFade = bossSealBreak?.boss === activeBoss ? Math.max(0,1-(performance.now()-bossSealBreak.at)/850) : 0;
        if (bossQ || activeBoss) UI.drawBossQuiz(ctx,bossQ,inputMode,activeBoss,sealFade);
        if (state === "levelup") UI.drawLevelUp(ctx, level + 1, choices, WL, WI, rerolls, now / 1000, levelupFocus, inputMode, awakeningState());
        if (state === "fusion" && window.FUSION && typeof UI.drawFusion === "function") {
          const model = window.FUSION.getViewModel ? window.FUSION.getViewModel() : {};
          UI.drawFusion(ctx, model, fusionFocus, inputMode);
        }
        if (state === "charmswap" && typeof UI.drawCharmSwap === "function") {
          const swapHits = UI.drawCharmSwap(ctx, {
            charms: charmViewList(),
            pending: charmPendingView(),
            selectedIndex: charmSwapIndex,
            inputMode
          });
          if (Array.isArray(swapHits)) charmSwapHits = swapHits;
        }
        if (state === "pause") {
          UI.drawPauseMenu(ctx, AUDIO.isMuted ? AUDIO.isMuted() : false, quitConfirm ? 0 : menuFocus, pausePage);
          if (quitConfirm) UI.drawExitConfirm(ctx, menuFocus, quitTarget);
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

  window.OMAMORI_CORE = {
    ART_KEY: CHARM_DROP_ART,
    NORMAL_CHANCE: CHARM_NORMAL_CHANCE,
    ELITE_CHANCE: CHARM_ELITE_CHANCE,
    DROP_CAP: CHARM_DROP_CAP,
    build: () => getBuildState(),
    drops: () => charmDrops.map(d => ({ id: d.id, charmId: d.charmId, x: d.x, y: d.y, life: d.life })),
    hudModel: () => ({
      charms: charmViewList(),
      maxSlots: CHARM_SLOT_MAX,
      pendingDrop: charmPendingView(),
      inputMode
    }),
    swapModel: () => ({
      charms: charmViewList(),
      pending: charmPendingView(),
      selectedIndex: charmSwapIndex,
      inputMode
    }),
    resolveSwap: action => resolveCharmSwap(action),
    paintDrops: () => {
      let painted = 0;
      for (const d of charmDrops) if (paintCharmDrop(d)) painted++;
      return painted;
    },
    effects: () => ({
      dmg: getEffectiveDmg(),
      speed: getEffectiveMoveSpeed(),
      waraji: (b.spd || 0) * 35,
      step: charmLevelOf("charm_step") * 28,
      magnet: getEffectiveMagnetRadius(),
      rate: getEffectiveRate(),
      reach: getEffectiveReachMultiplier(),
      guardMul: charmLevelOf("charm_guard") > 0 ? 1 - 0.10 * charmLevelOf("charm_guard") : 1
    }),
    effectsOf: buildState => ({
      dmg: getEffectiveDmg(buildState),
      speed: getEffectiveMoveSpeed(buildState),
      magnet: getEffectiveMagnetRadius(buildState),
      rate: getEffectiveRate(buildState),
      reach: getEffectiveReachMultiplier(buildState),
      step: charmLevelOf("charm_step", buildState) * 28,
      waraji: (b.spd || 0) * 35,
      guardMul: charmLevelOf("charm_guard", buildState) > 0
        ? 1 - 0.10 * charmLevelOf("charm_guard", buildState)
        : 1
    }),
    guardOilLoss: amount => charmGuardOilLoss(amount)
  };

  initFusionBridge();
  requestAnimationFrame(frame);
})();
