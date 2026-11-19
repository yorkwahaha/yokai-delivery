// Illustrated rosters. The first Boss returns as the gatekeeper in wave three.
window.BOSS_ROSTER_TRIAL = (() => {
  const rosters = {
    "night-town": [
      { id: "stone-lion", title: "狛犬石將", height: 208, attacks: ["slam"] },
      { id: "lantern-monk", title: "燈籠法師", height: 222, attacks: ["charge", "slam"] },
      { id: "night-town-oni", title: "大妖鬼", height: 240 }
    ],
    "rain-port": [
      { id: "tide-crab", title: "潮甲蟹將", height: 208, attacks: ["tidalFan", "tide"] },
      { id: "shipwreck-princess", title: "沉舟幽姬", height: 232, attacks: ["rainVortex", "tidalFan", "tide"] },
      { id: "harbor-umibozu", title: "港霧大妖", height: 248 }
    ],
    "bamboo-maze": [
      { id: "bamboo-boar", title: "竹甲山豬", height: 206, attacks: ["bambooShoots", "bambooCut"] },
      { id: "ink-bamboo-witch", title: "墨竹鬼姬", height: 220, attacks: ["bambooCut", "bambooShoots", "bambooCut"] },
      { id: "bamboo-warden", title: "竹影魅妖" }
    ]
  };
  const waveOrder = [0, 1, 0, 2];
  const images = new Map();
  const frame = [0, 0, 640, 480, 320];
  function wave(stage, index) {
    return rosters[stage]?.[waveOrder[index]] ?? null;
  }

  function load(stage) {
    if (typeof window.Image !== "function") return;
    for (const boss of rosters[stage] || []) {
      if (!boss.height || images.has(boss.id)) continue;
      const poses = {};
      for (const pose of ["idle", "attack"]) {
        const image = new window.Image();
        image.decoding = "async";
        image.fetchPriority = "low";
        image.stageFrame = frame;
        image.rosterBossHeight = boss.height;
        image.src = `assets/img/enemies/${boss.id}/${boss.id}__sprite__${pose}.webp`;
        poses[pose] = image;
      }
      images.set(boss.id, poses);
    }
  }

  function sprite(enemy) {
    const poses = images.get(enemy.trialBoss?.id);
    if (!poses) return null;
    const windingUp = enemy.hazard?.phase === "telegraph" || enemy.hazard?.phase === "active";
    if (!enemy.shield && !enemy.dying && (windingUp || enemy.pose === "attack" || enemy.attackT > 0)
        && poses.attack.naturalWidth > 0) return poses.attack;
    return poses.idle.naturalWidth > 0 ? poses.idle : null;
  }

  return Object.freeze({ wave, load, sprite });
})();
