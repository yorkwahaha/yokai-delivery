(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const STORE = (() => {
    const OFFICIAL_KEY = "yokai-delivery-v1";
    const K = root.DEV_MODE && typeof root.DEV_MODE.sessionKey === "function"
      ? root.DEV_MODE.sessionKey(root.location)
      : OFFICIAL_KEY;
  const WT = [6, 4, 2, 1, .5];
  // Keep existing progress entries untouched; insert the three new stage IDs.
  const NEXT_STAGE = {
    "night-town": "rain-port",
    "rain-port": "sakura-pass",
    "sakura-pass": "bamboo-maze",
    "bamboo-maze": "hyakki-kyoto",
    "hyakki-kyoto": "snow-temple",
    "snow-temple": "spirit-ferry",
    "spirit-ferry": "yomi"
  };
  const fresh = () => ({
    m: Object.create(null),
    best: 0,
    bestDel: 0,
    coins: 0,
    progress: {
      unlocked: Object.assign(Object.create(null), { "night-town": true }),
      completed: Object.create(null),
      stages: Object.create(null)
    }
  });

  const isRecord = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const entries = v => Object.entries(isRecord(v) ? v : {});
  const count = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(v))) : fallback;
  // Independent per-tab journals prevent a stale tab from destroying another's progress.
  // The legacy v1 snapshot remains as a migration base and K remains a readable projection.
  const JOURNAL_BASE = K + ":journal-base";
  const JOURNAL_PREFIX = K + ":journal:";
  let storage = null, journalSupported = false;
  try {
    storage = localStorage;
    journalSupported = typeof storage.key === "function" && typeof storage.length === "number";
  } catch {
    storage = null;
  }
  const tabId = root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`;
  // A journal is split into immutable, small per-tab segments. Never delete
  // someone else's segment: a suspended tab may still have unsaved events.
  const JOURNAL_SEGMENT_MAX = 256;
  let journalSegment = 0;
  let journalKey = JOURNAL_PREFIX + tabId + ":" + journalSegment;
  const ownEvents = [];
  let eventSequence = 0;
  let journalSignatures = new Map();
  let journalNeedsRefresh = false;
  // Immutable/unchanged segments are expensive to JSON.parse repeatedly when
  // a single active tab writes one more answer. Cache their decoded rows.
  // This reduces replay parsing without rewriting old storage or changing the
  // cross-tab ordering contract.
  let decodedJournalSegments = new Map();
  const DECODED_SEGMENT_CACHE_CAP = 24; // At most 6144 cached event rows on iPad.
  // Compact tuple format reduces localStorage usage without discarding
  // the event order required by recall/box calculations. Legacy object
  // journals remain readable.
  const encodeEvent = e => [e.type, e.at, e.seq, e.jp || e.stageId || null,
    e.correct === true ? 1 : 0, e.score ?? 0, e.deliveries ?? 0, e.won === true ? 1 : 0];
  const decodeEvent = (item, key) => {
    if (isRecord(item)) return item;
    if (!Array.isArray(item) || typeof item[0] !== "string") return null;
    const [type, at, seq, name, correct, score, deliveries, won] = item;
    const event = { type, at, seq, tab: key.slice(JOURNAL_PREFIX.length).split(":")[0] };
    if (type === "rec" || type === "assisted" || type === "recall") {
      event.jp = name; event.correct = correct === 1;
    } else {
      event.stageId = name; event.score = score; event.deliveries = deliveries; event.won = won === 1;
    }
    return event;
  };
  const decodeBaseline = text => {
    const state = fresh();
    let raw = {};
    try {
      const saved = JSON.parse(text);
      if (isRecord(saved)) raw = saved;
    } catch {}
    state.best = count(raw.best);
    state.bestDel = count(raw.bestDel);
    state.coins = count(raw.coins);
    for (const [jp, m] of entries(raw.m)) {
      if (!isRecord(m)) continue;
      state.m[jp] = {
        ok: count(m.ok), ng: count(m.ng), box: Math.min(4, count(m.box)),
        lastSeen: Math.min(Date.now(), count(m.lastSeen)),
        missBoost: Math.max(1, Math.min(2.5, typeof m.missBoost === "number" && Number.isFinite(m.missBoost) ? m.missBoost : 1))
      };
    }
    const progress = isRecord(raw.progress) ? raw.progress : {};
    for (const key of ["unlocked", "completed"]) {
      for (const [id, value] of entries(progress[key])) {
        if (value === true) state.progress[key][id] = true;
      }
    }
    for (const [id, stats] of entries(progress.stages)) {
      if (!isRecord(stats)) continue;
      state.progress.stages[id] = {
        bestScore: count(stats.bestScore), bestDeliveries: count(stats.bestDeliveries),
        clears: count(stats.clears), attempts: count(stats.attempts)
      };
    }
    return state;
  };
  let baselineText;
  try {
    baselineText = (journalSupported ? storage.getItem(JOURNAL_BASE) : null) ?? storage?.getItem(K);
  } catch {}
  const d = decodeBaseline(baselineText);
  let initialState = JSON.stringify(d);
  const ensureJournalBase = () => {
    let text = storage.getItem(JOURNAL_BASE);
    if (text === null) {
      const legacy = storage.getItem(K) || JSON.stringify(fresh());
      // A different tab may have created the base while we read the projection.
      text = storage.getItem(JOURNAL_BASE);
      if (text === null) {
        storage.setItem(JOURNAL_BASE, legacy);
        text = legacy;
      }
    }
    if (text !== baselineText) {
      baselineText = text;
      initialState = JSON.stringify(decodeBaseline(text));
      journalNeedsRefresh = true;
    }
  };
  if (journalSupported) {
    try { ensureJournalBase(); } catch {}
  }

  const applyJournalEvent = event => {
    if (!isRecord(event)) return;
    const id = typeof event.stageId === "string" ? event.stageId : null;
    const jp = typeof event.jp === "string" ? event.jp : null;
    if (event.type === "rec" && jp) {
      const m = get(jp);
      if (event.correct) {
        m.ok = count(m.ok + 1);
        m.box = Math.min(4, m.box + 1);
        m.lastSeen = count(event.at);
        m.missBoost = 1;
      } else {
        m.ng = count(m.ng + 1);
        m.box = Math.max(0, m.box - 1);
        m.missBoost = 2.5;
      }
    } else if ((event.type === "assisted" || event.type === "recall") && jp) {
      const m = get(jp);
      m.ok = count(m.ok + 1);
      m.lastSeen = count(event.at);
      if (event.type === "recall") m.missBoost = 1;
    } else if (event.type === "coins") {
      // Additive reward in the existing multi-tab journal; never overwrite a
      // different tab's currency from a stale localStorage snapshot.
      d.coins = count(d.coins + count(event.score));
    } else if (event.type === "complete" && id) {
      d.progress.completed[id] = true;
      d.progress.unlocked[id] = true;
      if (NEXT_STAGE[id]) d.progress.unlocked[NEXT_STAGE[id]] = true;
    } else if (event.type === "start" && id) {
      const stats = getStageStats(id);
      stats.attempts = count(stats.attempts + 1);
    } else if (event.type === "finish" && id) {
      const score = count(event.score), deliveries = count(event.deliveries);
      d.best = Math.max(d.best, score);
      d.bestDel = Math.max(d.bestDel, deliveries);
      const stats = getStageStats(id);
      stats.bestScore = Math.max(stats.bestScore, score);
      stats.bestDeliveries = Math.max(stats.bestDeliveries, deliveries);
      if (event.won) {
        stats.clears = count(stats.clears + 1);
        d.progress.completed[id] = true;
        d.progress.unlocked[id] = true;
        if (NEXT_STAGE[id]) d.progress.unlocked[NEXT_STAGE[id]] = true;
      }
    }
  };
  const syncJournal = () => {
    if (!journalSupported) return;
    const signatures = new Map();
    let changed = journalNeedsRefresh;
    try {
      // A future opt-in checkpoint/compaction can advance the migration base.
      // Existing open tabs must observe that BEFORE replaying remaining keys;
      // otherwise they could temporarily drop every folded answer.
      const currentBase = storage.getItem(JOURNAL_BASE);
      if (currentBase !== null && currentBase !== baselineText) {
        let parsed;
        try { parsed = JSON.parse(currentBase); } catch {}
        if (isRecord(parsed) && isRecord(parsed.m)) {
          baselineText = currentBase;
          initialState = JSON.stringify(decodeBaseline(currentBase));
          journalNeedsRefresh = changed = true;
        }
      }
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(JOURNAL_PREFIX)) continue;
        const value = storage.getItem(key);
        signatures.set(key, value);
        if (journalSignatures.get(key) !== value) changed = true;
      }
      if (storage.getItem(JOURNAL_BASE) !== currentBase) {
        journalNeedsRefresh = true;
        return;
      }
    } catch { return; }
    // Hot read path (overworld nodes call this often): do not parse or replay
    // any journal when the strings and this tab's pending events are unchanged.
    if (!changed && signatures.size === journalSignatures.size) return;
    const all = [];
    let persistedCount = 0;
    const nextDecoded = new Map();
    const keepSegment = (key, segment) => {
      for (const event of segment.events) all.push(event);
      if (key === journalKey) persistedCount = segment.rows;
      nextDecoded.set(key, segment);
      if (nextDecoded.size > DECODED_SEGMENT_CACHE_CAP)
        nextDecoded.delete(nextDecoded.keys().next().value);
    };
    for (const [key, value] of signatures) {
      const cached = decodedJournalSegments.get(key);
      if (cached?.raw === value) {
        keepSegment(key, cached);
        continue;
      }
      try {
        const events = JSON.parse(value);
        if (!Array.isArray(events)) continue;
        const decoded = [];
        for (const item of events) {
          const event = decodeEvent(item, key);
          if (event) decoded.push(event);
        }
        keepSegment(key, { raw: value, events: decoded, rows: events.length });
      } catch {
        // One damaged segment must not block progress from other tabs.
        // Preserve its key and raw value for later diagnostics/recovery.
        continue;
      }
    }
    decodedJournalSegments = nextDecoded;
    journalSignatures = signatures;
    journalNeedsRefresh = false;
    // A pending debounced answer is still part of this tab's state.
    for (let i = persistedCount; i < ownEvents.length; i++) all.push(ownEvents[i]);
    all.sort((a, b) => (count(a.at) - count(b.at))
      || String(a.tab || "").localeCompare(String(b.tab || ""))
      || count(a.seq) - count(b.seq));
    const base = JSON.parse(initialState);
    d.m = Object.assign(Object.create(null), base.m);
    d.best = base.best;
    d.bestDel = base.bestDel;
    d.coins = base.coins;
    d.progress = {
      unlocked: Object.assign(Object.create(null), base.progress.unlocked),
      completed: Object.assign(Object.create(null), base.progress.completed),
      stages: Object.assign(Object.create(null), base.progress.stages)
    };
    for (const event of all) applyJournalEvent(event);
  };
  const record = (type, fields) => {
    if (!journalSupported) return;
    ownEvents.push({ type, ...fields, at: Date.now(), tab: tabId, seq: ++eventSequence });
    journalNeedsRefresh = true;
  };

  let saveFailed = !storage;
  let savePending = false;
  let saveTimer = null;
  const save = () => {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    savePending = true;
    try {
      if (journalSupported) {
        // The projection must never be written before its immutable migration base.
        ensureJournalBase();
        while (ownEvents.length) {
          const count = Math.min(ownEvents.length, JOURNAL_SEGMENT_MAX);
          const payload = JSON.stringify(ownEvents.slice(0, count).map(encodeEvent));
          storage.setItem(journalKey, payload);
          journalSignatures.set(journalKey, payload);
          if (count < JOURNAL_SEGMENT_MAX) break;
          // Rotate only after the full segment reached storage. If a later
          // write fails, the remaining events still belong to the next key.
          ownEvents.splice(0, count);
          journalKey = JOURNAL_PREFIX + tabId + ":" + (++journalSegment);
        }
        // Refresh the readable v1 snapshot from all committed journals, not
        // from this tab's potentially older in-memory snapshot.
        syncJournal();
      }
      storage.setItem(K, JSON.stringify(d));
      saveFailed = false;
      savePending = false;
    }
    catch { saveFailed = true; }
  };
  // 答題類高頻寫入改 500ms 去抖；關卡開始/結算仍立即寫。flush() 立刻寫出待存資料。
  const flush = () => { if (savePending) save(); };
  const saveSoon = () => {
    savePending = true;
    // 沒有 pagehide/visibilitychange 可 flush 的環境（Node 測試等）維持同步寫入。
    if (!lifecycleFlush || typeof setTimeout !== "function") { save(); return; }
    if (ownEvents.length >= JOURNAL_SEGMENT_MAX) { save(); return; }
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => { saveTimer = null; save(); }, 500);
    if (saveTimer && typeof saveTimer.unref === "function") saveTimer.unref();
  };
  const lifecycleFlush = typeof root.addEventListener === "function"
    && typeof document !== "undefined" && !!document && typeof document.addEventListener === "function";
  if (lifecycleFlush) {
    root.addEventListener("pagehide", flush);
    root.addEventListener("storage", event => {
      if (event.key === JOURNAL_BASE || event.key?.startsWith(JOURNAL_PREFIX)) syncJournal();
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  }

  const get = jp => d.m[jp] || (d.m[jp] = { ok: 0, ng: 0, box: 0, lastSeen: 0, missBoost: 1 });

  const getStageStats = stageId => {
    const id = stageId || "night-town";
    return d.progress.stages[id] || (d.progress.stages[id] = {
      bestScore: 0,
      bestDeliveries: 0,
      clears: 0,
      attempts: 0
    });
  };

  const isStageUnlocked = stageId => { syncJournal(); return stageId === "night-town" || d.progress.unlocked[stageId] === true; };
  const isStageCompleted = stageId => { syncJournal(); return d.progress.completed[stageId] === true; };
  const skillClearStage = Object.freeze({ ink_trail: "night-town", seal_nail: "rain-port", shikigami: "sakura-pass" });
  function isActiveSkillUnlocked(skillId) {
    if (!Object.hasOwn(skillClearStage, skillId)) return false;
    if (skillId === "shikigami" && !root.DEV_MODE?.isShikigamiEnabled?.(root.location)) return false;
    const stageId = skillClearStage[skillId];
    // Explicit ephemeral Stage3 DEV preview; never alters official clears or
    // grants a persistent entitlement merely by selecting a stage.
    if(skillId==="seal_nail" && root.DEV_MODE?.isDevMode?.(root.location) &&
        root.DEV_MODE?.isSakuraPlaytest?.(root.location) &&
        /(?:^|[?&])sealTrial=1(?:&|$)/.test(String(root.location?.search||"")))return true;
    // Preserve both old legacy clear-count records and the modern completed map.
    // The entire STORE is isolated to its official/DEV key at initialization.
    return isStageCompleted(stageId) || getStageStats(stageId).clears > 0;
  }
  // This is presentation history, NOT a duplicate unlock flag. Entitlement is
  // derived only from the official stage-completion record above. The key uses
  // K, so DEV / Fusion Lab test storage cannot modify the official history.
  const INTRO_KEY = K + ":skill-introductions-v1";
  const experiencedInMemory = Object.create(null);
  let nextIntroductionInMemory = null;
  function experiencedSkills() {
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(INTRO_KEY) || "{}"); } catch {}
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  }
  function hasExperiencedSkill(id) {
    return experiencedInMemory[id] === true || experiencedSkills()[id] === true;
  }
  function markSkillExperienced(id) {
    if (!Object.hasOwn(skillClearStage, id) ||
        (id === "shikigami" && !isActiveSkillUnlocked(id))) return false;
    experiencedInMemory[id] = true;
    try { storage?.setItem(INTRO_KEY, JSON.stringify({...experiencedSkills(), [id]:true})); } catch {}
    return true;
  }
  const pendingIntroductions = () => Object.keys(skillClearStage)
    .filter(id => isActiveSkillUnlocked(id) && !hasExperiencedSkill(id));
  function pendingSkillIntroduction() {
    // Backward-compatible: older clears grant eligibility without replay.
    // First offer is stage-ordered; declined offers rotate to the end.
    const pending=pendingIntroductions();
    const preferred=nextIntroductionInMemory||experiencedSkills().nextIntroduction;
    return pending.includes(preferred)?preferred:(pending[0]||null);
  }
  function rotateSkillIntroduction(id) {
    const pending=pendingIntroductions();
    if(!pending.includes(id))return false;
    const next=pending.find(k=>k!==id)||id;
    nextIntroductionInMemory=next;
    try {storage?.setItem(INTRO_KEY,JSON.stringify({...experiencedSkills(),nextIntroduction:next}));} catch {}
    return true;
  }

  function completeStage(stageId) {
    if (!stageId) return;
    syncJournal();
    d.progress.completed[stageId] = true;
    d.progress.unlocked[stageId] = true;
    const next = NEXT_STAGE[stageId];
    if (next) d.progress.unlocked[next] = true;
    record("complete", { stageId });
    save();
  }

  let runRecallSeen = Object.create(null);

  function rec(jp, c) {
    syncJournal();
    const m = get(jp);
    if (c) {
      m.ok++;
      m.box = Math.min(4, m.box + 1);
      m.lastSeen = Date.now();
      m.missBoost = 1;
    } else {
      m.ng++;
      m.box = Math.max(0, m.box - 1);
      m.missBoost = 2.5;
    }
    record("rec", { jp, correct: !!c });
    saveSoon();
  }

  function recAssisted(jp) {
    syncJournal();
    const m = get(jp);
    m.ok++;
    m.lastSeen = Date.now();
    record("assisted", { jp });
    saveSoon();
  }

  function recRecall(wordOrJp, nowMs = Date.now()) {
    const jp = typeof wordOrJp === "string" ? wordOrJp : wordOrJp?.jp;
    if (!jp) return;
    syncJournal();
    const time = typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : Date.now();
    const last = runRecallSeen[jp];
    if (last != null && (time - last) < 30000) {
      const m = get(jp);
      m.ok++;
      m.lastSeen = Date.now();
      m.missBoost = 1;
      record("recall", { jp });
      saveSoon();
      return;
    }
    rec(jp, true);
    runRecallSeen[jp] = time;
  }

  function pickWord(all, rnd = Math.random) {
    syncJournal();
    if (!all || all.length === 0) return null;
    const now = Date.now();
    const w = all.map(x => {
      const m = get(x.jp);
      const ageHours = m.lastSeen ? (now - m.lastSeen) / (1000 * 3600) : 24;
      const decay = Math.min(2.5, 1 + ageHours * 0.1);
      const missMult = m.missBoost || 1;
      return WT[m.box] * decay * missMult;
    });
    const total = w.reduce((a, b) => a + b, 0);
    let r = (rnd ? rnd() : Math.random()) * (total || 1);
    for (let i = 0; i < all.length; i++) {
      r -= w[i];
      if (r <= 0) return all[i];
    }
    return all[all.length - 1];
  }

  function createStudySession(pool, random = Math.random) {
    syncJournal();
    const rawWords = Array.isArray(pool) ? pool.filter(w => w && w.jp) : [];
    const seenJp = new Set();
    const allWords = [];
    for (const w of rawWords) {
      if (!seenJp.has(w.jp)) {
        seenJp.add(w.jp);
        allWords.push(w);
      }
    }

    const scored = allWords.map(w => {
      const m = get(w.jp);
      const ageHours = m.lastSeen ? (Date.now() - m.lastSeen) / 3600000 : 24;
      const decay = Math.min(2.5, 1 + ageHours * 0.1);
      const score = WT[m.box] * decay * (m.missBoost || 1);
      return { w, score: score + (random ? random() : Math.random()) * 0.01 };
    }).sort((a, b) => b.score - a.score);
    const activePool = scored.slice(0, 8).map(x => x.w);
    const seenMap = new Map();
    const mistakeRecords = new Map(); // jp -> { word, dueAt, attemptsLeft: 2 }
    let lastPickedJp = null;

    return {
      seen(word) {
        if (word && word.jp) seenMap.set(word.jp, word);
      },
      seenWords() {
        return Array.from(seenMap.values());
      },
      mistake(word, elapsed = 0) {
        if (!word || !word.jp) return;
        const jp = word.jp;
        const due = (elapsed || 0) + 60 + (random ? random() : Math.random()) * 60;
        const record = mistakeRecords.get(jp);
        if (record) {
          record.dueAt = due;
        } else {
          mistakeRecords.set(jp, { word, dueAt: due, attemptsLeft: 2 });
        }
      },
      pick(elapsed = 0, exclude = []) {
        const excludeJps = new Set((exclude || []).map(w => typeof w === "string" ? w : w?.jp));
        for (const [jp, rec] of mistakeRecords.entries()) {
          if (rec.dueAt <= elapsed && rec.attemptsLeft > 0 && !excludeJps.has(jp) && jp !== lastPickedJp) {
            rec.attemptsLeft--;
            rec.dueAt = elapsed + 60 + (random ? random() : Math.random()) * 60;
            lastPickedJp = jp;
            return rec.word;
          }
        }

        const isCoolingDown = jp => {
          const rec = mistakeRecords.get(jp);
          return rec != null && elapsed < rec.dueAt;
        };

        let candidates = activePool.filter(w => !excludeJps.has(w.jp) && w.jp !== lastPickedJp && !isCoolingDown(w.jp));
        if (candidates.length === 0) {
          candidates = activePool.filter(w => !excludeJps.has(w.jp) && !isCoolingDown(w.jp));
        }
        if (candidates.length === 0) {
          return null;
        }

        const chosen = pickWord(candidates, random);
        if (chosen) lastPickedJp = chosen.jp;
        return chosen || null;
      }
    };
  }

  const api = {
    canSave: () => !saveFailed,
    flush,
    data: d,
    coinBalance: () => { syncJournal(); return d.coins; },
    awardCoins(amount) {
      const earned = Math.min(10000, count(amount));
      if (!earned) return 0;
      syncJournal();
      d.coins = count(d.coins + earned);
      record("coins", { score: earned });
      save();
      return earned;
    },
    get: jp => { syncJournal(); return get(jp); },
    getStageStats: id => { syncJournal(); return getStageStats(id); },
    isStageUnlocked,
    isStageCompleted,
    isActiveSkillUnlocked,
    pendingSkillIntroduction,
    rotateSkillIntroduction,
    markSkillExperienced,
    hasExperiencedSkill,
    completeStage,
    startRun(stageId = "night-town") {
      syncJournal();
      runRecallSeen = Object.create(null);
      const stats = getStageStats(stageId);
      stats.attempts = (stats.attempts || 0) + 1;
      record("start", { stageId });
      save();
    },
    rec,
    recAssisted,
    recRecall,
    createStudySession,
    pick: pickWord,
    finish(stageId, score, deliveries, won = false) {
      if (typeof stageId === "number") {
        won = false;
        deliveries = score;
        score = stageId;
        stageId = "night-town";
      }
      syncJournal();
      const s = count(Number(score));
      const n = count(Number(deliveries));
      if (s > d.best) d.best = s;
      if (n > d.bestDel) d.bestDel = n;

      const stats = getStageStats(stageId);
      if (s > (stats.bestScore || 0)) stats.bestScore = s;
      if (n > (stats.bestDeliveries || 0)) stats.bestDeliveries = n;
      if (won) {
        stats.clears = (stats.clears || 0) + 1;
        d.progress.completed[stageId] = true;
        d.progress.unlocked[stageId] = true;
        if (NEXT_STAGE[stageId]) d.progress.unlocked[NEXT_STAGE[stageId]] = true;
      }
      record("finish", { stageId, score: s, deliveries: n, won });
      save();
    }
  };

  syncJournal();
  root.STORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  return api;
  })();
})();
