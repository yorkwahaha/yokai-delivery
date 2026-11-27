(() => {
  "use strict";

  function projectBuild(build, rules) {
    const {weapons, mutations, maxActive, maxRank, mutationSlots, canAdd, canLearn, passives} = rules;
    const bySkill = new Map();
    for (const [id, mutation] of Object.entries(mutations)) {
      if (!bySkill.has(mutation.skillId)) bySkill.set(mutation.skillId, []);
      bySkill.get(mutation.skillId).push(id);
    }
    const slots = build.activeSkills.slice(0, maxActive).map(id => {
      const options = bySkill.get(id) || [];
      const owned = build.mutations.filter(key => options.includes(key));
      const capacity = Math.max(owned.length, Math.min(mutationSlots, options.filter(key => mutations[key].inPool).length));
      return {id, rank: build.WL[id], capacity, owned,
        candidates: owned.length < capacity ? options.filter(key => !owned.includes(key) && canAdd(key)) : []};
    });
    const empty = maxActive - slots.length;
    const possible = Object.keys(weapons)
      .filter(id => !build.activeSkills.includes(id) && canLearn(id))
      .map(id => Math.min(mutationSlots, (bySkill.get(id) || []).filter(key => mutations[key].inPool).length))
      .sort((a, b) => b - a);
    const sum = (rows, value) => rows.reduce((count, row) => count + value(row), 0);
    const summary = {
      active: slots.length, full: slots.filter(slot => slot.rank >= maxRank).length, activeMax: maxActive,
      mutations: sum(slots, slot => slot.owned.length),
      mutationMax: sum(slots, slot => slot.capacity) + sum(possible.slice(0, empty), n => n)
    };
    return {slots: slots.concat(Array(empty).fill(null)), summary, maxRank, passives,
      charms: build.charms.map(id => ({id, count: build.charmLevels[id]}))};
  }

  function wordPage(cards, filter, page, size) {
    const matches = cards.filter(card => (!filter.stage || card.stages.includes(filter.stage)) &&
      (!filter.pack || card.packId === filter.pack));
    const pageCount = Math.max(1, Math.ceil(matches.length / size));
    const index = Math.max(0, Math.min(pageCount - 1, page));
    return {page: index, pageCount, count: matches.length,
      opened: matches.filter(card => card.reveal === "open").length,
      cards: matches.slice(index * size, (index + 1) * size)};
  }

  function spatialTarget(source, choices, direction) {
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "left" || direction === "up" ? -1 : 1;
    const center = rect => [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const [x, y] = center(source);
    let best = -1, bestScore = Infinity;
    choices.forEach((rect, index) => {
      const [a, b] = center(rect);
      const dx = a - x, dy = b - y;
      const forward = (horizontal ? dx : dy) * sign;
      if (forward < 2) return;
      const side = Math.abs(horizontal ? dy : dx);
      const breadth = horizontal ? Math.min(source.height, rect.height) : Math.min(source.width, rect.width);
      const score = forward + side * (side <= breadth / 2 ? 0.25 : 3);
      if (score < bestScore) { bestScore = score; best = index; }
    });
    return best;
  }

  const api = Object.freeze({projectBuild, wordPage, spatialTarget});
  if (typeof module === "object" && module.exports) module.exports = api;
  else window.COMPENDIUM_MODEL = api;
})();
