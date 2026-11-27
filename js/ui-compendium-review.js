(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  if (params.get("compendiumReview") !== "1" || !window.DEV_MODE?.isStageLab(location)) return;

  const fixtures = {
    A: {label:"開局", levels:{katana:1}, mutations:[]},
    B: {label:"四招修行", levels:{katana:4, barrier:2, fire:3, needle:1},
      mutations:["mut_crosscut", "mut_pulse", "mut_frost"]},
    C: {label:"四招滿級", levels:{katana:5, barrier:5, boom:5, thunder:5},
      mutations:["mut_longblade", "mut_crosscut", "mut_bindseal", "mut_widecircle", "mut_boom_seek", "mut_branch"]},
    D: {label:"後期秘術", levels:{katana:2, ink_trail:4, seal_nail:5, shikigami:5},
      mutations:["mut_ink_echo", "mut_seal_nail_near", "mut_seal_nail_swift", "mut_shikigami_fang", "mut_shikigami_guard"]},
    E: {label:"被動與御守", levels:{katana:5, fire:4, barrier:3, needle:2},
      mutations:["mut_orbit", "mut_furyfire", "mut_seek", "mut_pierce", "mut_repulse"],
      passives:{shield:3, oil_max:2, dmg:3, rate:1, crit:2, spd:2, dash:1, mag:2, oil_heal:1},
      charms:{charm_cadence:3, charm_reach:2, charm_guard:1}}
  };
  const labels = Object.fromEntries(Object.entries(fixtures).map(([key, row]) => [key, key + " " + row.label]));
  const stages = window.DELIVERY_LEXICON.stages.slice(0, 7);
  const marks = Object.fromEntries(stages.flatMap((stage, i) =>
    stage.words.slice(0, i === 0 ? 7 : 5).map((word, j) => [word.jp, j === 0 && i > 0 ? 2 : 4])));
  const initial = params.get("fixture")?.toUpperCase();
  const tab = params.get("compendiumTab");
  window.COMPENDIUM_REVIEW = Object.freeze({
    initial: Object.hasOwn(fixtures, initial) ? initial : "A",
    tab: ["cards", "words", "build"].includes(tab) ? tab : "build",
    labels, marks,
    fixture: id => fixtures[id]
  });
})();
