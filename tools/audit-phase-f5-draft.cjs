"use strict";
const assert = require("node:assert/strict");
const { loadGame } = require("../tests/helpers/game-runtime.cjs");
const expansion = require("../js/game-skill-expansion.js");

const seeds = Number(process.argv[2] || 1000);
assert.ok(Number.isInteger(seeds) && seeds > 0);
const currency = "coins";
const cap = 4;
const opens = ["night-town", "rain-port", "sakura-pass"];
const result = {};
for (const arm of ["current", "guided"]) {
  const shown = Object.fromEntries(expansion.ids.map(id => [id, 0]));
  const first = {...shown}, acquired = {...shown};
  let small = 0, empty = 0, repeat = 0, rankPicks = 0, coins = 0, maxSlots = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const search = "?dev=1&skillLab=expansion" + (arm === "guided" ? "&draft=guided" : "");
    const game = loadGame({seed,location:{hostname:"127.0.0.1",search}});
    for (const stage of opens) game.store().finish(stage,100,6,true);
    for (const id of ["ink_trail","seal_nail","shikigami"]) game.store().markSkillExperienced(id);
    game.startRun("night-town");
    game.stopSpawns();
    const seen = new Set(), taken = new Set();
    let lastRank = null;
    const bias = expansion.randomFor(seed*31517);
    for (let round=0; round<20; round++) {
      game.offerUp();
      const cards = game.currentChoices();
      const ranks = game.combatPhase().selectedWeaponLevels;
      const owned = Object.values(ranks).filter(rank=>rank>0).length;
      maxSlots = Math.max(maxSlots,owned);
      assert.ok(owned<=cap);
      assert.equal(new Set(cards.map(c=>c.choiceId)).size,cards.length);
      if (!cards.length) {empty++;break;}
      if (cards.length<3) small++;
      if (cards.some(c=>c.type===currency)) coins++;
      for (const c of cards) {
        if (c.type!=="weapon") continue;
        const rank = ranks[c.id] || 0;
        assert.ok(rank<5 && c.lv===rank+1 && (owned<cap || rank>0),c.choiceId);
        if (expansion.ids.includes(c.id) && rank===0) {
          seen.add(c.id);
          if (round===0) first[c.id]++;
        }
      }
      // Deterministic player policy prefers a weapon when present, then chooses
      // uniformly among that subset. This audit measures that policy and seed.
      const weapons = cards.map((card,i)=>card.type==="weapon"?i:-1).filter(i=>i>=0);
      const i = weapons.length ? weapons[Math.floor(bias()*weapons.length)] : Math.floor(bias()*cards.length);
      const selected = cards[i];
      if (selected.type==="weapon" && (ranks[selected.id]||0)>0) {
        rankPicks++;
        if (lastRank===selected.id) repeat++;
        lastRank=selected.id;
      } else lastRank=null;
      if (selected.type==="weapon" && expansion.ids.includes(selected.id)) taken.add(selected.id);
      game.finishDraftImmediately();
      assert.ok(game.takeLevelUpChoice(i).ok,selected.choiceId);
    }
    for (const id of seen) shown[id]++;
    for (const id of taken) acquired[id]++;
  }
  assert.equal(empty,0);
  result[arm] = {seeds,offersPerSeed:20,first,shown,acquired,repeat,rankPicks,small,empty,coins,maxSlots};
}
console.log(JSON.stringify(result,null,2));
