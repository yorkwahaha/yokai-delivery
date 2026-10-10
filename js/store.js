(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const STORE = (() => {
    const K = "yokai-delivery-v1";
  const WT = [6, 4, 2, 1, .5];
  const NEXT_STAGE = {
    "night-town": "rain-port",
    "rain-port": "sakura-pass",
    "sakura-pass": "hyakki-kyoto",
    "hyakki-kyoto": "yomi"
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
  const d = fresh();
  let raw = {};
  try {
    const r = JSON.parse(localStorage.getItem(K));
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

  let saveFailed = false;
  const save = () => {
    try { localStorage.setItem(K, JSON.stringify(d)); saveFailed = false; }
    catch { saveFailed = true; }
  };

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

  const isStageUnlocked = stageId => stageId === "night-town" || d.progress.unlocked[stageId] === true;
  const isStageCompleted = stageId => d.progress.completed[stageId] === true;

  function completeStage(stageId) {
    if (!stageId) return;
    d.progress.completed[stageId] = true;
    d.progress.unlocked[stageId] = true;
    const next = NEXT_STAGE[stageId];
    if (next) d.progress.unlocked[next] = true;
    save();
  }

  let runRecallSeen = Object.create(null);

  function rec(jp, c) {
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
    save();
  }

  function recAssisted(jp) {
    const m = get(jp);
    m.ok++;
    m.lastSeen = Date.now();
    save();
  }

  function recRecall(wordOrJp, nowMs = Date.now()) {
    const jp = typeof wordOrJp === "string" ? wordOrJp : wordOrJp?.jp;
    if (!jp) return;
    const time = typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : Date.now();
    const last = runRecallSeen[jp];
    if (last != null && (time - last) < 30000) {
      const m = get(jp);
      m.ok++;
      m.lastSeen = Date.now();
      m.missBoost = 1;
      save();
      return;
    }
    rec(jp, true);
    runRecallSeen[jp] = time;
  }

  function pickWord(all, rnd = Math.random) {
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
    data: d,
    get,
    getStageStats,
    isStageUnlocked,
    isStageCompleted,
    completeStage,
    startRun(stageId = "night-town") {
      runRecallSeen = Object.create(null);
      const stats = getStageStats(stageId);
      stats.attempts = (stats.attempts || 0) + 1;
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
      const s = Number(score) || 0;
      const n = Number(deliveries) || 0;
      if (s > d.best) d.best = s;
      if (n > d.bestDel) d.bestDel = n;

      const stats = getStageStats(stageId);
      if (s > (stats.bestScore || 0)) stats.bestScore = s;
      if (n > (stats.bestDeliveries || 0)) stats.bestDeliveries = n;
      if (won) {
        stats.clears = (stats.clears || 0) + 1;
        completeStage(stageId);
      } else {
        save();
      }
    }
  };

  root.STORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  return api;
  })();
})();
