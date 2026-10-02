// 詞彙熟練度與進度存檔（localStorage）：答對升星、答錯降星；同時保存關卡解鎖與各關最佳成績。
window.STORE = (() => {
  const K = "yokai-delivery-v1";
  const WT = [6, 4, 2, 1, .5];
  const NEXT_STAGE = {
    "night-town": "rain-port",
    "rain-port": "sakura-pass",
    "sakura-pass": "hyakki-kyoto",
    "hyakki-kyoto": "yomi"
  };

  const fresh = () => ({
    m: {},
    best: 0,
    bestDel: 0,
    progress: {
      unlocked: { "night-town": true },
      completed: {},
      stages: {}
    }
  });

  let d = fresh();
  try {
    const r = JSON.parse(localStorage.getItem(K));
    if (r && r.m) d = r;
  } catch {}

  d.m ||= {};
  d.best ||= 0;
  d.bestDel ||= 0;
  d.progress ||= {};
  d.progress.unlocked ||= {};
  d.progress.completed ||= {};
  d.progress.stages ||= {};
  d.progress.unlocked["night-town"] = true;

  const save = () => {
    try { localStorage.setItem(K, JSON.stringify(d)); } catch {}
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

  const isStageUnlocked = stageId => stageId === "night-town" || !!d.progress.unlocked[stageId];
  const isStageCompleted = stageId => !!d.progress.completed[stageId];

  function completeStage(stageId) {
    if (!stageId) return;
    d.progress.completed[stageId] = true;
    d.progress.unlocked[stageId] = true;
    const next = NEXT_STAGE[stageId];
    if (next) d.progress.unlocked[next] = true;
    save();
  }

  return {
    data: d,
    get,
    getStageStats,
    isStageUnlocked,
    isStageCompleted,
    completeStage,
    startRun(stageId = "night-town") {
      Object.values(d.m).forEach(m => { m.missBoost = 1; });
      const stats = getStageStats(stageId);
      stats.attempts = (stats.attempts || 0) + 1;
      save();
    },
    rec(jp, c) {
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
    },
    recAssisted(jp) {
      const m = get(jp);
      m.ok++;
      m.lastSeen = Date.now();
      m.missBoost = 1;
      save();
    },
    pick(all) {
      if (!all || all.length === 0) return null;
      const now = Date.now();
      const w = all.map(x => {
        const m = get(x.jp);
        const ageHours = m.lastSeen ? (now - m.lastSeen) / (1000 * 3600) : 24;
        const decay = Math.min(2.5, 1 + ageHours * 0.1);
        const missMult = m.missBoost || 1;
        return WT[m.box] * decay * missMult;
      });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < all.length; i++) {
        r -= w[i];
        if (r <= 0) return all[i];
      }
      return all[all.length - 1];
    },
    finish(stageId, score, deliveries, won = false) {
      // 舊呼叫相容：finish(score, deliveries)
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
})();
