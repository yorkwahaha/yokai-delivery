// Phase18 original pure report logic, frozen before extraction.
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
