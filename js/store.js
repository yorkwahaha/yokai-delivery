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
  const journalSupported = typeof localStorage.key === "function"
    && typeof localStorage.length === "number";
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
  if (journalSupported) {
    try {
      if (localStorage.getItem(JOURNAL_BASE) === null) {
        localStorage.setItem(JOURNAL_BASE, localStorage.getItem(K) || JSON.stringify(fresh()));
      }
    } catch {}
  }
  const d = fresh();
  let raw = {};
  try {
    const r = JSON.parse((journalSupported && localStorage.getItem(JOURNAL_BASE)) || localStorage.getItem(K));
    if (isRecord(r)) raw = r;
  } catch {}

  d.best = count(raw.best);
  d.bestDel = count(raw.bestDel);
  for (const [jp, m] of entries(raw.m)) {
    if (!isRecord(m)) continue;
    d.m[jp] = {
      ok: count(m.ok), ng: count(m.ng), box: Math.min(4, count(m.box)),
      lastSeen: Math.min(Date.now(), count(m.lastSeen)),
      missBoost: Math.max(1, Math.min(2.5, typeof m.missBoost === "number" && Number.isFinite(m.missBoost) ? m.missBoost : 1))
    };
  }
  const progress = isRecord(raw.progress) ? raw.progress : {};
  for (const key of ["unlocked", "completed"]) {
    for (const [id, value] of entries(progress[key])) {
      if (value === true) d.progress[key][id] = true;
    }
  }
  for (const [id, stats] of entries(progress.stages)) {
    if (!isRecord(stats)) continue;
    d.progress.stages[id] = {
      bestScore: count(stats.bestScore), bestDeliveries: count(stats.bestDeliveries),
      clears: count(stats.clears), attempts: count(stats.attempts)
    };
  }

  const initialState = JSON.stringify(d);
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
    const signatures = new Map(), all = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(JOURNAL_PREFIX)) continue;
        const value = localStorage.getItem(key);
        signatures.set(key, value);
        const events = JSON.parse(value);
        if (Array.isArray(events)) {
          for (const item of events) {
            const event = decodeEvent(item, key);
            if (event) all.push(event);
          }
        }
      }
    } catch { return; }
    const changed = journalNeedsRefresh || signatures.size !== journalSignatures.size
      || [...signatures].some(([key, value]) => journalSignatures.get(key) !== value);
    if (!changed) return;
    journalSignatures = signatures;
    journalNeedsRefresh = false;
    // A pending debounced answer is still part of this tab's state.
    let persistedCount = 0;
    try { persistedCount = JSON.parse(signatures.get(journalKey) || "[]").length; } catch {}
    all.push(...ownEvents.slice(persistedCount));
    all.sort((a, b) => (count(a.at) - count(b.at))
      || String(a.tab || "").localeCompare(String(b.tab || ""))
      || count(a.seq) - count(b.seq));
    const base = JSON.parse(initialState);
    d.m = Object.assign(Object.create(null), base.m);
    d.best = base.best;
    d.bestDel = base.bestDel;
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

  let saveFailed = false;
  let saveTimer = null;
  const save = () => {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    try {
      if (journalSupported) {
        const payload = JSON.stringify(ownEvents.map(encodeEvent));
        localStorage.setItem(journalKey, payload);
        journalSignatures.set(journalKey, payload);
        // Refresh the readable v1 snapshot from all committed journals, not
        // from this tab's potentially older in-memory snapshot.
        syncJournal();
        if (ownEvents.length >= JOURNAL_SEGMENT_MAX) {
          journalKey = JOURNAL_PREFIX + tabId + ":" + (++journalSegment);
          ownEvents.length = 0;
        }
      }
      localStorage.setItem(K, JSON.stringify(d));
      saveFailed = false;
    }
    catch { saveFailed = true; }
  };
  // 答題類高頻寫入改 500ms 去抖；關卡開始/結算仍立即寫。flush() 立刻寫出待存資料。
  const flush = () => { if (saveTimer !== null) save(); };
  const saveSoon = () => {
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
      if (event.key?.startsWith(JOURNAL_PREFIX)) syncJournal();
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
    canSave: () => { flush(); return !saveFailed; },
    flush,
    data: d,
    get: jp => { syncJournal(); return get(jp); },
    getStageStats: id => { syncJournal(); return getStageStats(id); },
    isStageUnlocked,
    isStageCompleted,
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
