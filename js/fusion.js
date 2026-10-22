(() => {
  "use strict";

  // ============================================================================
  // FUSION SYSTEM CORE (F0: API/State Machine/Atomic Transaction)
  // ============================================================================
  // 嚴格僅在 rain-port Normal、dev=1 & (fusioncandidate=1 | fusion=1) 時啟用。
  // 依賴注入 bridge 與 game.js 串接，不依賴不可見的全域變數。
  // ============================================================================

  // 融合配方表（10 組：#1-#10）
  // implemented: true = 引擎已有攻擊實作；enabled = 列入 eligible 選單
  // enabled=false / WAITING_IMPLEMENTATION = 僅保留規格，不進 eligible
  // ============================================================================
  const FUSION_RECIPES = Object.freeze({
    // #1 fusion_inkblade (F1-A 基線) - 妖刀 + 狐火
    fusion_inkblade: {
      id: "fusion_inkblade",
      name: "奧義・墨焰斬",
      nameJp: "ぼくえんざん",
      parents: ["katana", "fire"],
      category: "fusion",
      description: "大型扇形墨焰斬，命中留下短暫地面灼燒；妖刀與狐火共鳴覺醒",
      baseDamage: 2.5,
      cooldown: 1.8,
      vfx: "fusion_inkblade",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true
    },
    // #2 fusion_slashwheel - 妖刀 + 靈陣
    fusion_slashwheel: {
      id: "fusion_slashwheel",
      name: "奧義・斬界輪",
      nameJp: "ざんかいりん",
      parents: ["katana", "barrier"],
      category: "fusion",
      description: "高速旋轉斬擊環，內外雙環各自判定命中，短暫留存切割痕",
      baseDamage: 2.0,
      cooldown: 2.0,
      vfx: "fusion_slashwheel",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #3 fusion_foxiai - 妖刀 + 天狐雷（P1-B 優先）
    fusion_foxiai: {
      id: "fusion_foxiai",
      name: "奧義・雷狐居合",
      nameJp: "らいこいあい",
      parents: ["katana", "thunder"],
      category: "fusion",
      description: "短預警後前向線性雷斬，穿過有限目標，每 cast 同敵一次",
      baseDamage: 2.5,
      cooldown: 1.6,
      vfx: "fusion_foxiai",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #4 fusion_exorcistblade - 妖刀 + 陰陽符（P1-B 優先）
    fusion_exorcistblade: {
      id: "fusion_exorcistblade",
      name: "奧義・退魔符刃",
      nameJp: "たいまふとう",
      parents: ["katana", "boom"],
      category: "fusion",
      description: "前向刀斬附符印、有限延遲符爆，命中/延遲快照獨立且不再 spawn 父 boom",
      baseDamage: 2.2,
      cooldown: 1.7,
      vfx: "fusion_exorcistblade",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #5 fusion_foxfirebarrier - 狐火 + 靈陣（P1-B 優先）
    fusion_foxfirebarrier: {
      id: "fusion_foxfirebarrier",
      name: "奧義・妖火結界",
      nameJp: "ようかけっかい",
      parents: ["fire", "barrier"],
      category: "fusion",
      description: "施放點短時燃燒結界、有限週期脈衝/首碰擊退，max1 存續域",
      baseDamage: 1.8,
      cooldown: 2.5,
      vfx: "fusion_foxfirebarrier",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #6 fusion_foxthunderlantern - 狐火 + 天狐雷
    fusion_foxthunderlantern: {
      id: "fusion_foxthunderlantern",
      name: "奧義・狐雷天燈",
      nameJp: "こらいてんとう",
      parents: ["fire", "thunder"],
      category: "fusion",
      description: "空中召喚多枚雷光燈籠、定點落雷/留燼，有限脈衝/落點預警",
      baseDamage: 2.0,
      cooldown: 2.4,
      vfx: "fusion_foxthunderlantern",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #7 fusion_flamefestival - 狐火 + 陰陽符
    fusion_flamefestival: {
      id: "fusion_flamefestival",
      name: "奧義・炎符祭",
      nameJp: "えんぷさい",
      parents: ["fire", "boom"],
      category: "fusion",
      description: "多枚火符交錯軌跡、交錯引爆、落點留燼，有限脈衝/派生上限",
      baseDamage: 2.0,
      cooldown: 2.2,
      vfx: "fusion_flamefestival",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #8 fusion_thundercircle (原有 ID，改顯示名) - 靈陣 + 天狐雷
    fusion_thundercircle: {
      id: "fusion_thundercircle",
      name: "奧義・雷陣封界",
      nameJp: "らいじんふうかい",
      parents: ["barrier", "thunder"],
      category: "fusion",
      description: "大型陣域脈衝定點引雷，在陣域內有節奏地多次擊中並可閃避警示；靈陣與天狐雷共鳴覺醒",
      baseDamage: 2.0,
      cooldown: 2.2,
      vfx: "fusion_thundercircle",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      // 沿用既有 ID／parents 與雷陣封界顯示名；game.js 已有可驗證的
      // fusion_thundercircle consumer（陣域脈衝＋定點警示落雷），故可進 eligible。
      status: "TECH_PENDING"
    },
    // #9 fusion_exorcistseal (P1-B 優先) - 靈陣 + 陰陽符
    fusion_exorcistseal: {
      id: "fusion_exorcistseal",
      name: "奧義・退魔封陣",
      nameJp: "たいまふうじん",
      parents: ["barrier", "boom"],
      category: "fusion",
      description: "前方/目標落點預警後有限多段封印符爆陣，固定落點/有限脈衝，Boss 不能永久控",
      baseDamage: 2.2,
      cooldown: 2.0,
      vfx: "fusion_exorcistseal",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    },
    // #10 fusion_thundertalisman - 天狐雷 + 陰陽符
    fusion_thundertalisman: {
      id: "fusion_thundertalisman",
      name: "奧義・雷符神罰",
      nameJp: "らいふしんばつ",
      parents: ["thunder", "boom"],
      category: "fusion",
      description: "多枚雷符空中交錯、定點落雷/留燼，有限脈衝/落點預警",
      baseDamage: 2.2,
      cooldown: 2.4,
      vfx: "fusion_thundertalisman",
      slotDelta: -1,
      oncePerRun: true,
      implemented: true,
      enabled: true,
      status: "TECH_PENDING"
    }
  });

  // 狀態機狀態
  const FUSION_STATE = Object.freeze({
    IDLE: "idle",                    // 閒置：未達條件
    PENDING_TALISMAN: "pending",     // 待領繪馬：Boss 擊殺後時間達標但雙招未滿 Lv5
    GROUND: "ground",                // 繪馬在地上：已具資格，等待玩家拾取/互動
    TALISMAN_HELD: "held",           // 持有繪馬：玩家已持有，隨時可開確認窗
    CONFIRMING: "confirming",        // 確認畫面開啟中
    EXECUTING: "executing",          // 執行原子交易中
    FUSED: "fused",                  // 融合完成：新武器已裝備，槽位淨釋 1
    DISABLED: "disabled"             // 未開啟 / 非此關 / 本局已結束
  });

  // 內部私有 Bridge（由 game.js 注入）
  let gameBridge = null;

  // 融合引擎狀態
  let fusionState = {
    state: FUSION_STATE.DISABLED,
    pendingRecipe: null,             // 待融合的配方 ID
    consumedParents: [],             // 已消耗的父技能 ID
    fusedWeapon: null,               // 已融合的新武器 ID
    talismanDropped: false,          // 本局是否已拾取/持有繪馬
    talismanEligible: false,         // 是否具備資格
    talismanEligibleSince: 0,        // 資格產生時間
    sourceMutationIds: [],           // 吸收的父技變異快照
    pendingCompensation: false,      // 是否有待領取的免費非變異強化補償
    runEpoch: 0,                     // 本局唯一標識（防止陳舊交易）
    revision: 0,                     // 狀態修訂號（供 UI 同步）
    selectedRecipeId: null           // UI 當前選中的配方 ID
  };

  // 融合配方反查：父技能對 -> 配方 ID
  const RECIPE_BY_PARENTS = (() => {
    const map = {};
    for (const [id, recipe] of Object.entries(FUSION_RECIPES)) {
      const [a, b] = [...recipe.parents].sort();
      map[`${a},${b}`] = id;
    }
    return Object.freeze(map);
  })();

  // 查詢特定父技能對的配方
  function findRecipeForSkills(skillA, skillB) {
    if (!skillA || !skillB) return null;
    const [a, b] = [skillA, skillB].sort();
    const id = RECIPE_BY_PARENTS[`${a},${b}`];
    return id ? FUSION_RECIPES[id] : null;
  }

  // 取得所有已實作、啟用且雙父技達 Lv5 的配方（供 UI 選單）
  // 未實作 meta（#2/#6/#7/#8/#10）不得進 eligible，也不得吞繪馬。
  function getEligibleRecipes(buildState) {
    const build = buildState || (gameBridge && typeof gameBridge.getBuildState === "function"
      ? gameBridge.getBuildState()
      : null);
    const wl = build && build.WL ? build.WL : null;
    if (!wl) return [];
    return Object.values(FUSION_RECIPES).filter(r =>
      r.implemented && r.enabled && r.parents.every(p => (wl[p] || 0) >= 5)
    );
  }

  // 開發旗標與關卡嚴格檢查
  function isFusionEnabled() {
    if (!gameBridge) return false;
    const env = typeof gameBridge.getEnv === "function" ? gameBridge.getEnv() : null;
    if (!env) return false;
    const search = env.search != null ? env.search : ((typeof window !== "undefined" && window.location?.search) || "");
    let params;
    try {
      const searchStr = typeof search === "string" ? (search.startsWith("?") ? search.slice(1) : search) : "";
      params = new URLSearchParams(searchStr);
    } catch (_) {
      return false;
    }
    const hasDev = params.get("dev") === "1";
    const hasCandidate = params.get("fusioncandidate") === "1" || params.get("fusion") === "1";
    return hasDev && hasCandidate && env.stageId === "rain-port" && !!env.isRainPortNormal;
  }

  // 綁定 game.js 橋接器
  function bindGame(bridge) {
    if (!bridge || typeof bridge !== "object") {
      gameBridge = null;
      fusionState.state = FUSION_STATE.DISABLED;
      return false;
    }
    gameBridge = bridge;
    if (isFusionEnabled()) {
      if (fusionState.state === FUSION_STATE.DISABLED) {
        fusionState.state = FUSION_STATE.IDLE;
      }
    } else {
      fusionState.state = FUSION_STATE.DISABLED;
    }
    return true;
  }

  // 檢查是否符合融合條件：兩個 Lv5 主動技能
  function checkFusionEligibility() {
    if (!isFusionEnabled()) return { ok: false, reason: "not_enabled" };
    if (fusionState.state === FUSION_STATE.FUSED) {
      return { ok: false, reason: "already_fused" };
    }
    if (!gameBridge || typeof gameBridge.getBuildState !== "function") {
      return { ok: false, reason: "no_bridge" };
    }

    const build = gameBridge.getBuildState();
    const wl = build?.WL || {};

    // 取得所有達到 Lv5 的技能
    const lv5Skills = Object.keys(wl).filter(k => wl[k] === 5);
    if (lv5Skills.length < 2) {
      return { ok: false, reason: "need_two_lv5", lv5Count: lv5Skills.length };
    }

    // 檢查是否有符合「已實作且啟用」配方的組合；未實作 meta 不得吞資格。
    const candidates = [];
    for (let i = 0; i < lv5Skills.length; i++) {
      for (let j = i + 1; j < lv5Skills.length; j++) {
        const recipe = findRecipeForSkills(lv5Skills[i], lv5Skills[j]);
        if (recipe && recipe.implemented && recipe.enabled && !candidates.includes(recipe.id)) {
          candidates.push(recipe.id);
        }
      }
    }

    if (candidates.length === 0) {
      return { ok: false, reason: "no_implemented_recipe", lv5Skills };
    }

    return { ok: true, candidates };
  }

  // Boss 擊殺事件監聽
  function onBossDeath(boss) {
    if (!isFusionEnabled()) return false;
    // 每局限掉落一次資格
    if (fusionState.talismanEligible || fusionState.talismanDropped || fusionState.state === FUSION_STATE.FUSED) {
      return false;
    }

    const env = gameBridge?.getEnv?.() || {};
    const elapsed = Number(env.elapsed || 0);

    // 必須 >= 360 秒（6 分鐘）
    if (elapsed < 360) {
      return false;
    }

    const eligible = checkFusionEligibility();
    fusionState.talismanEligible = true;
    fusionState.talismanEligibleSince = elapsed;

    if (eligible.ok) {
      // 雙 Lv5 已齊備：直接落於地面供拾取或持裝
      fusionState.pendingRecipe = eligible.candidates[0];
      fusionState.selectedRecipeId = eligible.candidates[0];
      fusionState.state = FUSION_STATE.GROUND;
      fusionState.revision++;
      if (typeof gameBridge.spawnGroundToken === "function") {
        gameBridge.spawnGroundToken(boss?.x, boss?.y);
      }
      return true;
    } else {
      // 雙 Lv5 尚未達成：記錄 pending 資格，後續升級補發
      fusionState.state = FUSION_STATE.PENDING_TALISMAN;
      fusionState.revision++;
      return true;
    }
  }

  // 技能升級事件監聽（供待領資格補發）
  function onWeaponLevelUp() {
    if (!isFusionEnabled()) return false;
    if (fusionState.state !== FUSION_STATE.PENDING_TALISMAN) return false;

    const eligible = checkFusionEligibility();
    if (eligible.ok) {
      fusionState.pendingRecipe = eligible.candidates[0];
      fusionState.selectedRecipeId = eligible.candidates[0];
      fusionState.state = FUSION_STATE.GROUND;
      fusionState.revision++;
      if (typeof gameBridge.spawnGroundToken === "function") {
        gameBridge.spawnGroundToken();
      }
      return true;
    }
    return false;
  }

  // 拾取繪馬
  function pickupTalisman() {
    if (fusionState.state !== FUSION_STATE.GROUND) return false;
    fusionState.talismanDropped = true;
    fusionState.state = FUSION_STATE.TALISMAN_HELD;
    fusionState.revision++;
    return true;
  }

  // 配方是否為當前 build 的合法合武（雙父技 Lv5、已實作、已啟用）
  function isRecipeLegalForBuild(recipe, build) {
    if (!recipe || !recipe.implemented || !recipe.enabled) return false;
    const wl = build && build.WL ? build.WL : null;
    if (!wl) return false;
    return recipe.parents.every(p => (wl[p] || 0) >= 5);
  }

  // 開啟融合確認面板
  function openFusionConfirm(recipeId) {
    if (fusionState.state !== FUSION_STATE.TALISMAN_HELD && fusionState.state !== FUSION_STATE.GROUND) {
      return false;
    }
    if (!gameBridge || typeof gameBridge.getBuildState !== "function") return false;
    const build = gameBridge.getBuildState();
    const eligible = getEligibleRecipes(build);

    let targetId = recipeId || fusionState.selectedRecipeId || fusionState.pendingRecipe;
    let recipe = targetId ? FUSION_RECIPES[targetId] : null;
    if (recipeId && !isRecipeLegalForBuild(recipe, build)) {
      return false;
    }
    if (!isRecipeLegalForBuild(recipe, build)) {
      recipe = eligible[0] || null;
      targetId = recipe ? recipe.id : null;
    }
    if (!recipe) return false;

    // 拾取後轉為 held
    fusionState.talismanDropped = true;
    fusionState.pendingRecipe = targetId;
    fusionState.selectedRecipeId = targetId;
    fusionState.state = FUSION_STATE.CONFIRMING;
    fusionState.revision++;
    return true;
  }

  // UI 選擇特定配方（不交易，只是預覽/選定）
  // expectedEpoch / expectedRevision 為 UI 開啟面板時取得的版本；不合法或過期零扣。
  function selectRecipe(recipeId, expectedEpoch, expectedRevision) {
    if (fusionState.state !== FUSION_STATE.CONFIRMING) {
      return { ok: false, reason: "not_confirming" };
    }
    if (expectedEpoch != null && expectedEpoch !== fusionState.runEpoch) {
      return { ok: false, reason: "stale_epoch" };
    }
    if (expectedRevision != null && expectedRevision !== fusionState.revision) {
      return { ok: false, reason: "stale_revision" };
    }
    const recipe = FUSION_RECIPES[recipeId];
    if (!recipe) return { ok: false, reason: "invalid_recipe" };
    if (!recipe.implemented || !recipe.enabled) {
      return { ok: false, reason: "not_available" };
    }
    if (!gameBridge || typeof gameBridge.getBuildState !== "function") {
      return { ok: false, reason: "no_bridge" };
    }
    const build = gameBridge.getBuildState();
    if (!isRecipeLegalForBuild(recipe, build)) {
      const missing = recipe.parents.find(p => ((build?.WL || {})[p] || 0) < 5);
      return { ok: false, reason: "parent_not_lv5", parent: missing };
    }
    if (fusionState.selectedRecipeId === recipeId && fusionState.pendingRecipe === recipeId) {
      return { ok: true, unchanged: true, recipeId };
    }
    fusionState.selectedRecipeId = recipeId;
    fusionState.pendingRecipe = recipeId;
    fusionState.revision++;
    return { ok: true, recipeId };
  }

  // 取消/稍後再議（0 扣除、繪馬保持持有）
  function cancelFusion() {
    if (fusionState.state !== FUSION_STATE.CONFIRMING) return false;
    fusionState.state = FUSION_STATE.TALISMAN_HELD;
    fusionState.revision++;
    return true;
  }

  function deferFusion() {
    return cancelFusion();
  }

  // 原子性確認融合交易
  function executeFusion(recipeId, expectedEpoch, expectedRevision) {
    if (fusionState.state !== FUSION_STATE.CONFIRMING) {
      return { ok: false, reason: "not_confirming" };
    }

    // 驗證 Epoch（防陳舊重入）
    if (expectedEpoch != null && expectedEpoch !== fusionState.runEpoch) {
      return { ok: false, reason: "stale_epoch" };
    }

    // 驗證 Revision（防陳舊視窗請求、稍後再議重開舊 Request）
    if (expectedRevision != null && expectedRevision !== fusionState.revision) {
      return { ok: false, reason: "stale_revision" };
    }

    // 驗證尚未融合
    if (fusionState.fusedWeapon !== null || fusionState.state === FUSION_STATE.FUSED) {
      return { ok: false, reason: "already_fused" };
    }

    const targetId = recipeId || fusionState.selectedRecipeId || fusionState.pendingRecipe;
    const recipe = FUSION_RECIPES[targetId];
    if (!recipe) {
      return { ok: false, reason: "invalid_recipe" };
    }
    if (!recipe.implemented || !recipe.enabled) {
      return { ok: false, reason: "not_available" };
    }

    if (!gameBridge || typeof gameBridge.getBuildState !== "function" || typeof gameBridge.commitTransaction !== "function") {
      return { ok: false, reason: "bridge_unavailable" };
    }

    const build = gameBridge.getBuildState();
    const wl = build?.WL || {};

    // 雙重檢查：父技能仍在 Lv5，配方仍屬當前合法 eligible
    if (!isRecipeLegalForBuild(recipe, build)) {
      const parent = recipe.parents.find(p => (wl[p] || 0) < 5);
      return { ok: false, reason: "parent_not_lv5", parent, level: wl[parent] };
    }

    // 檢查槽位：持有數 >= 2
    const ownedCount = typeof build.ownedActiveCount === "number"
      ? build.ownedActiveCount
      : Object.keys(wl).filter(k => (wl[k] || 0) > 0).length;
    if (ownedCount < 2) {
      return { ok: false, reason: "not_enough_slots" };
    }

    // 進入執行態
    fusionState.state = FUSION_STATE.EXECUTING;
    fusionState.revision++;

    // 收集來源變異快照
    const sourceMutationIds = [];
    if (typeof gameBridge.getSkillMutations === "function") {
      for (const p of recipe.parents) {
        const muts = gameBridge.getSkillMutations(p) || [];
        for (const m of muts) {
          if (!sourceMutationIds.includes(m)) sourceMutationIds.push(m);
        }
      }
    }
    const grantCompensation = sourceMutationIds.length > 0;

    // 執行 commit
    const commitResult = gameBridge.commitTransaction({
      recipe,
      parents: [...recipe.parents],
      fusionWeaponId: recipe.id,
      sourceMutationIds: [...sourceMutationIds],
      grantCompensation
    });

    if (!commitResult || !commitResult.ok) {
      // 失敗回滾
      fusionState.state = FUSION_STATE.CONFIRMING;
      fusionState.revision++;
      return { ok: false, reason: commitResult?.error || "commit_failed" };
    }

    // 成功完成
    fusionState.fusedWeapon = recipe.id;
    fusionState.consumedParents = [...recipe.parents];
    fusionState.sourceMutationIds = [...sourceMutationIds];
    fusionState.pendingCompensation = grantCompensation;
    fusionState.state = FUSION_STATE.FUSED;
    fusionState.pendingRecipe = null;
    fusionState.revision++;

    return {
      ok: true,
      fusedWeapon: recipe.id,
      releasedSlots: 1,
      grantCompensation,
      sourceMutationIds: [...sourceMutationIds]
    };
  }

  // 領取變異補償（1 次免費非變異升級選擇）
  function consumeCompensation() {
    if (!fusionState.pendingCompensation) return false;
    fusionState.pendingCompensation = false;
    if (typeof gameBridge?.openUpgradeChoice === "function") {
      gameBridge.openUpgradeChoice({ freeNonMutation: true });
    }
    return true;
  }

  // 技能是否已被融合消耗（禁止再次進池）
  function isSkillConsumed(skillId) {
    return fusionState.consumedParents.includes(skillId);
  }

  // 取得完整狀態（只讀快照）
  function getFusionState() {
    const isEn = isFusionEnabled();
    return {
      state: isEn ? fusionState.state : FUSION_STATE.DISABLED,
      isEnabled: isEn,
      pendingRecipe: fusionState.pendingRecipe,
      consumedParents: [...fusionState.consumedParents],
      fusedWeapon: fusionState.fusedWeapon,
      talismanDropped: fusionState.talismanDropped,
      talismanEligible: fusionState.talismanEligible,
      talismanEligibleSince: fusionState.talismanEligibleSince,
      sourceMutationIds: [...fusionState.sourceMutationIds],
      pendingCompensation: fusionState.pendingCompensation,
      runEpoch: fusionState.runEpoch,
      revision: fusionState.revision,
      recipes: FUSION_RECIPES,
      selectedRecipeId: fusionState.selectedRecipeId
    };
  }

  // 收集指定配方兩父技的變異快照
  function collectRecipeMutations(recipe) {
    const out = [];
    if (!recipe || typeof gameBridge?.getSkillMutations !== "function") return out;
    for (const p of recipe.parents) {
      const muts = gameBridge.getSkillMutations(p) || [];
      for (const m of muts) {
        if (!out.includes(m)) out.push(m);
      }
    }
    return out;
  }

  // 取得供 UI.drawFusion 使用的 ViewModel 規格
  function getViewModel() {
    const s = getFusionState();
    const build = gameBridge?.getBuildState?.() || { WL: {}, ownedActiveCount: 0 };
    const eligible = getEligibleRecipes(build);
    const eligibleIds = new Set(eligible.map(r => r.id));

    // selectedRecipeId 來自 UI.selectRecipe；失效時回落到目前第一個合法配方。
    let targetRecipeId = s.selectedRecipeId || s.pendingRecipe;
    if (!targetRecipeId || !eligibleIds.has(targetRecipeId)) {
      targetRecipeId = eligible[0]?.id || (FUSION_RECIPES.fusion_inkblade ? "fusion_inkblade" : null);
    }
    const recipe = FUSION_RECIPES[targetRecipeId] || FUSION_RECIPES.fusion_inkblade;
    if (!recipe) return {};

    const owned = typeof build.ownedActiveCount === "number"
      ? build.ownedActiveCount
      : Object.keys(build.WL || {}).filter(k => (build.WL[k] || 0) > 0).length;
    const slotBefore = owned || 0;
    const slotAfter = Math.max(1, slotBefore + (recipe.slotDelta || -1));

    let sourceMutationIds = [...s.sourceMutationIds];
    if (sourceMutationIds.length === 0) sourceMutationIds = collectRecipeMutations(recipe);

    const hasMutations = sourceMutationIds.length > 0;
    const compensationText = hasMutations
      ? "來源變異化為靈息：融合後補償 1 次免費非變異強化選擇"
      : "";

    const eligibleRecipes = eligible.map(r => ({
      id: r.id,
      name: r.name,
      nameJp: r.nameJp,
      parents: [...r.parents],
      desc: r.description,
      sourceMutationIds: collectRecipeMutations(r)
    }));

    return {
      recipe: {
        id: recipe.id,
        name: recipe.name,
        nameJp: recipe.nameJp,
        parents: [...recipe.parents],
        desc: recipe.description,
        sourceMutationIds: [...sourceMutationIds]
      },
      slotBefore,
      slotAfter,
      sourceMutationIds,
      compensationText,
      ruleText: "每局限融合 1 次 · 稍後再議不扣繪馬 · 兩母技融合後自此退場",
      // 供 UI 選單的所有合法、已實作且雙父技 Lv5 配方
      eligibleRecipes,
      selectedRecipeId: eligibleIds.has(recipe.id) ? recipe.id : (eligible[0]?.id || recipe.id)
    };
  }

  // 重置（新局/重開）
  function resetFusionState(epoch) {
    const numericEpoch = Number(epoch);
    const newEpoch = Number.isFinite(numericEpoch)
      ? numericEpoch
      : (Number(fusionState.runEpoch) || 0) + 1;
    fusionState = {
      state: isFusionEnabled() ? FUSION_STATE.IDLE : FUSION_STATE.DISABLED,
      pendingRecipe: null,
      consumedParents: [],
      fusedWeapon: null,
      talismanDropped: false,
      talismanEligible: false,
      talismanEligibleSince: 0,
      sourceMutationIds: [],
      pendingCompensation: false,
      runEpoch: newEpoch,
      revision: 0,
      selectedRecipeId: null
    };
  }

  // 匯出 API
  const FUSION_API = Object.freeze({
    // 依賴注入
    bindGame,

    // 狀態查詢
    getState: getFusionState,
    getViewModel,
    isEnabled: isFusionEnabled,
    checkEligibility: checkFusionEligibility,
    isSkillConsumed,
    getEligibleRecipes,
    selectRecipe,

    // 生命週期與事件
    onBossDeath,
    onWeaponLevelUp,
    pickupTalisman,
    openFusionConfirm,
    executeFusion,
    cancelFusion,
    deferFusion,
    consumeCompensation,
    reset: resetFusionState,

    // 常數
    RECIPES: FUSION_RECIPES,
    STATES: FUSION_STATE,
    MAX_FUSIONS_PER_RUN: 1
  });

  // 掛載到全域環境
  const rootObj = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
  if (rootObj) {
    rootObj.FUSION = FUSION_API;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FUSION_API;
  }
})();