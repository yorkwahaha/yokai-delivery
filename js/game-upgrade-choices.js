// Phase17: original three-card upgrade pool assembly; RNG source and card callbacks stay in game.js.
window.GAME_UPGRADE_CHOICES = (() => {
  // Rank-aware, soft catch-up weights. A newly available active skill should
  // be much easier to SEE than the 3rd/4th/5th level of an already-owned one.
  // No Lv5 hard lock: once all four slots are filled, ranking is relative to
  // the least-developed equipped skill; if ranks converge, odds equalize.
  const EARLY_RANK_WEIGHTS = Object.freeze([2.4, 1, 0.48, 0.21, 0.09]);
  const EQUIPPED_GAP_WEIGHTS = Object.freeze([1, 0.5, 0.22, 0.09, 0.04]);
  function weaponOfferWeight(skillId, levels, maxActive = 4) {
    const current = Math.max(0, Math.min(5, Number(levels?.[skillId]) || 0));
    if (current >= 5) return 0;
    const owned = Object.values(levels || {}).filter(v => Number(v) > 0).map(Number);
    if (owned.length < maxActive) return EARLY_RANK_WEIGHTS[current];
    if (current === 0) return 0;
    const weakest = Math.min(...owned);
    const gap = Math.max(0, Math.min(4, current - weakest));
    return EQUIPPED_GAP_WEIGHTS[gap];
  }
  // Weighted random permutation without replacement. The existing Phase17
  // 3-card assembler still owns category ratios, mutation pairing and rerolls.
  // RNG is injected by game.js, so the module is side-effect-free and testable.
  function orderWeapons(keys, levels, maxActive, random) {
    const pending = [...keys];
    const output = [];
    while (pending.length > 0) {
      const weights = pending.map(key => weaponOfferWeight(key, levels, maxActive));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (!(total > 0)) {
        output.push(...pending);
        break;
      }
      const u = Math.max(0, Math.min(1 - Number.EPSILON,
        typeof random === "function" ? random() : 0.5));
      let ticket = u * total;
      let chosen = weights.length - 1;
      for (let i = 0; i < weights.length; i++) {
        ticket -= weights[i];
        if (ticket < 0) { chosen = i; break; }
      }
      output.push(pending.splice(chosen, 1)[0]);
    }
    return output;
  }
  // Exclude weapons chosen during the last two ACCEPTED upgrades when other
  // weapons can progress. Rerolls do not advance this history.
  // Keep at least two weapon candidates where possible; when the pool shrinks,
  // relax older picks first, then the latest pick as a scarcity fallback.
  function weaponsAfterRecentPicks(keys, recentPicks = []) {
    const candidates = [...keys];
    if (candidates.length <= 1) return candidates;
    const recent = Array.isArray(recentPicks) ? recentPicks.slice(-2) : [];
    const fresh = candidates.filter(key => !recent.includes(key));
    if (fresh.length >= 2) return fresh;
    const latest = recent[recent.length - 1];
    const alternatives = candidates.filter(key => key !== latest);
    return alternatives.length >= 2 ? alternatives : candidates;
  }
function assemble(awakenCard, fc, wc, cc, dc, pc, mc, shuffle) {
    let result = [];
    if (awakenCard) {
      const restPool = shuffle([...fc, ...wc.slice(0, 2), ...cc.slice(0, 2), ...dc.slice(0, 2), ...pc.slice(0, 2)]);
      const rest = mc.length > 0
        ? [...restPool.slice(0, Math.max(0, 2 - mc.length)), ...mc.slice(0, 2)]
        : restPool.slice(0, 2);
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
      const baseChoices = shuffle(pool).slice(0, 3);
      result = mc.length > 0
        ? [...baseChoices.slice(0, Math.max(0, 3 - mc.length)), ...mc.slice(0, 2)]
        : baseChoices;
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
  // Optional guarantees only. The baseline assemble() (and its RNG/order)
  // remains unchanged for all existing six-skill and mutation scenarios.
  function withGuarantees(offered, forced, fallback, pairedMutations = false) {
    const priority = forced.filter(Boolean);
    if (!priority.length) return offered;
    const unique = new Set(priority.map(c => c.choiceId));
    const hasPairConflict = pairedMutations && priority.length > 1;
    const candidates = [...offered, ...fallback].filter(c =>
      c && !unique.has(c.choiceId) && !(hasPairConflict && c.type === "mutation"));
    const result = [...priority];
    for (const c of candidates) {
      if (result.length >= 3) break;
      if (result.some(p => p.choiceId === c.choiceId)) continue;
      if (c.type === "mutation" && pairedMutations) {
        const pair = candidates.filter(x => x.type === "mutation");
        if (pair.length > 1) {
          if (result.length > 1) continue; // never split two mutually exclusive cards
          for (const item of pair.slice(0,2)) result.push(item);
          break;
        }
      }
      result.push(c);
    }
    return result.slice(0,3);
  }
  // Reward-skill visibility is independent of rank weights. Four previous
  // missed normal offers make the fifth eligible for a reserved slot.
  const NEW_SKILL_MISS_LIMIT = 5;
  function withNewSkillVisibility(offered, candidates, misses, normalOffer, protectedCards = []) {
    if (!normalOffer || !candidates.length) return offered;
    const visible = new Set(offered.map(c => c.choiceId));
    const due = candidates.filter(c => !visible.has(c.choiceId) &&
      (misses[c.id] || 0) >= NEW_SKILL_MISS_LIMIT - 1)
      .sort((a, b) => (misses[b.id] || 0) - (misses[a.id] || 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!due.length) return offered;
    const protectedIds = new Set(protectedCards.filter(Boolean).map(c => c.choiceId));
    // Never break a mutation pair or replace a charm, introduction or
    // another visible reward skill. If all three are reserved, defer.
    const rewardIds = new Set(candidates.map(c => c.choiceId));
    const result = [...offered];
    if (result.length < 3) result.push(due[0]);
    else {
      const i = result.findIndex(c => c.type !== "mutation" && c.type !== "charm" &&
        c.type !== "fusion" && !protectedIds.has(c.choiceId) && !rewardIds.has(c.choiceId));
      if (i >= 0) result[i] = due[0];
    }
    return result;
  }
  function recordNewSkillVisibility(misses, candidates, offered, normalOffer) {
    const eligible = new Set(candidates.map(c => c.id));
    for (const id of Object.keys(misses)) if (!eligible.has(id)) delete misses[id];
    const visible = new Set(offered.map(c => c.choiceId));
    for (const card of candidates) {
      if (visible.has(card.choiceId)) misses[card.id] = 0;
      else if (normalOffer) misses[card.id] = (misses[card.id] || 0) + 1;
    }
  }
  return Object.freeze({ assemble, withGuarantees, weaponOfferWeight, orderWeapons, weaponsAfterRecentPicks,
    withNewSkillVisibility, recordNewSkillVisibility, NEW_SKILL_MISS_LIMIT });
})();
