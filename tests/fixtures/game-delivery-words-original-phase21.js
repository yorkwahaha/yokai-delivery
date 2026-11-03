// Exact pre-phase21 selection behavior preserved as executable reference.
function oldExcludedWordSets(enemies, orders, job) {
    const livingMisWords = new Set(enemies.filter(e => e.hp > 0 && e.type === "mis" && e.w).map(e => e.w.jp));

    // 2. 當前委託欄與手上包裹已佔用的詞
    const activeOrderWords = new Set(orders.map(o => o.word.jp));
    if (job && job.word) activeOrderWords.add(job.word.jp);
  return {livingMisWords, activeOrderWords};
}
function oldPriorityMissedWords(ALL, STORE, livingMisWords, activeOrderWords) {
      const priorityMissed = ALL.filter(w => {
        const m = STORE.get(w.jp);
        return (m.missBoost || 1) > 1 && !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp);
      });
  return priorityMissed;
}
function oldFallbackWordPool(ALL, livingMisWords, activeOrderWords) {
        let pool = ALL.filter(w => !livingMisWords.has(w.jp) && !activeOrderWords.has(w.jp));
        if (pool.length === 0) pool = ALL.filter(w => !livingMisWords.has(w.jp));
        if (pool.length === 0) pool = ALL;
  return pool;
}
