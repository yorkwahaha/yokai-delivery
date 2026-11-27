window.LATE_STAGE_ART = (() => {
  const sets = {
    "spirit-ferry": {
      prefix: "ferry",
      props: ["ticket-pavilion", "gate", "covered-ferry", "lantern-post", "empty-boat", "river-shrine",
        "pier-roof", "cargo-barrels", "bollards", "parcels", "reeds", "shore-ridge", "spirit-lantern",
        "plank-stack", "waymarker", "postal-shop", "boathouse", "dockside-inn", "shrine-gate", "caged-lamp", "rope",
        "sandals", "bench", "floating-deck", "dock-junction"],
      houses: { ferry_ticket: ["ticket-pavilion", 172], ferry_mail: ["postal-shop", 169], ferry_shelter: ["river-shrine", 151],
        ferry_boathouse: ["boathouse", 165], ferry_inn: ["dockside-inn", 174] },
      mobs: [["paper-passenger", 68], ["shadow-kappa", 79], ["drowned-turtle", 108], ["boat-mail-spirit", 83]],
      bosses: [
        ["shore-lion", "靈河鎮岸獅", 213, "soul-splash"],
        ["drowned-maiden", "水鏡巫女", 234, "spirit-tide"],
        ["bell-oni", "沉鐘鬼將", 236, "soul-splash"],
        ["ferryman", "幽冥渡船使", 258, "oar-sweep"]
      ]
    },
    yomi: {
      prefix: "yomi",
      props: ["torii", "palace", "basalt-spire", "pavilion", "stone-bridge", "altar", "lantern-post", "jizo",
        "spider-lilies", "boulder", "broken-flagstone", "brazier", "moon", "palace-wall", "stair-gate",
        "cliff-ledge", "bell-tower", "fallen-torii"],
      houses: { yomi_pavilion: ["pavilion", 163], yomi_palace: ["palace", 200] },
      mobs: [["ember-ghost", 66], ["scarlet-runner", 77], ["basalt-oni", 109], ["gate-priest", 86]],
      bosses: [
        ["grave-samurai", "冥門骸武者", 231, "cinder-burst"],
        ["cinder-priestess", "灰火祭姬", 235, "fault-line"],
        ["grave-serpent", "玄巖墓蛇", 239, "cinder-burst"],
        ["word-soul-core", "黃泉邪神・言靈之核", 276, "eclipse"]
      ]
    }
  };
  const kindIndex = { ghost: 0, runner: 1, tank: 2, shooter: 3 };
  const makeArt = (stage, spec) => {
    const { prefix, props, houses, mobs } = spec;
    const roster = spec.bosses.map(([role, title, height, attack]) =>
      Object.freeze({ id: `${prefix}-${role}`, title, height, attack }));
    const images = new Map();
    let terrainRevision = 0;
    function load() {
      if (images.size || typeof Image !== "function") return;
      function request(key, path, height, root = "assets/img/") {
        const image = new Image();
        image.decoding = "async";
        if (height) {
          image.stageFrame = [0, 0, 384, 360, 192];
          image.stageSpriteHeight = height;
        }
        images.set(key, image);
        if (path.startsWith(`stages/${stage}/`)) image.onload = () => {
          if (images.get(key) === image) terrainRevision++;
        };
        image.src = root + path + ".webp";
      }
      for (const role of props) request(role, `stages/${stage}/scene/${stage}__${role}`);
      for (let i = 0; i < 6; i++) request(`ground-${i}`, `stages/${stage}/tiles/${stage}__ground-${i}`);
      const actors = [...mobs.map(([role, height]) => [`${prefix}-${role}`, height]),
        ...roster.map(({ id, height }) => [id, height])];
      for (const [id, height] of actors) for (const pose of ["idle", "windup", "action"])
        request(`${id}:${pose}`, `enemies/${id}/${id}__sprite__${pose}`, height);
      for (const attack of new Set(roster.map(boss => boss.attack))) for (const phase of ["warning", "impact"])
        request(`${attack}:${phase}`, `vfx/enemies/${prefix}-${attack}/${prefix}-${attack}__${stage === "yomi" && attack === "cinder-burst" ? "base-" : ""}${phase}`);
      if (stage === "yomi") for (const phase of ["warning", "impact"])
        request(`heavy-slash:${phase}`, `vfx/enemies/yomi-heavy-slash/yomi-heavy-slash__${phase}`);
      if (stage === "yomi") for (const phase of ["warning", "impact"])
        request(`grave-serpent:${phase}`, `yomi-cinder-burst__${phase}`, 0, "assets/img/vfx/enemies/yomi-cinder-burst/");
      if (stage === "spirit-ferry") request("mud-pool", "vfx/enemies/ferry-mud-pool/ferry-mud-pool__impact");
      request("projectile", `vfx/enemies/${prefix}-shooter/${prefix}-shooter__projectile`);
      request("arrival", `vfx/enemies/${prefix}-boss/${prefix}-boss__arrival`);
    }
    const image = role => {
      const loaded = images.get(role);
      return loaded?.naturalWidth ? loaded : null;
    };
    function monster(enemy, elapsed, motion) {
      const mob = mobs[kindIndex[enemy.type]];
      const id = enemy.trialBoss?.id || (mob && `${prefix}-${mob[0]}`);
      if (!id) return null;
      let pose = "idle";
      if (!enemy.shield && !enemy.dying && !enemy.revealT && !(enemy.freezeT > 0)) {
        if (enemy.hazard?.phase === "active" || enemy.attackT > 0) pose = "action";
        else if (enemy.hazard?.phase === "telegraph" || enemy.lateShotWindup ||
          (motion && enemy.walking && Math.floor(elapsed * 7) % 2)) pose = "windup";
      }
      return image(`${id}:${pose}`) || image(`${id}:idle`);
    }
    return Object.freeze({
      load, unload: () => { images.clear(); terrainRevision = 0; }, image, monster,
      house: type => houses[type],
      bossWave: index => roster[index] || null,
      hazardImage: (owner, phase, hazard) => {
        const lane = hazard?.lanes?.[hazard.index];
        const heavySlash = stage === "yomi" && owner?.trialBoss?.id === "yomi-grave-samurai" &&
          hazard?.art === "cinder-burst" && lane?.round === false && lane.rx !== lane.ry;
        const state = phase === "telegraph" ? "warning" : "impact";
        const role = heavySlash ? "heavy-slash" : hazard?.art || owner?.trialBoss?.attack;
        if (stage === "yomi" && owner?.trialBoss?.id === "yomi-grave-serpent" && role === "cinder-burst")
          return image(`grave-serpent:${state}`) || image(`cinder-burst:${state}`);
        return image(`${role}:${state}`);
      },
      pending: () => ["ground-0", props[0], props[1]].some(role => images.get(role)?.complete === false),
      terrain: variant => image(`ground-${variant}`) || image("ground-0"),
      terrainStamp: () => terrainRevision
    });
  };
  const art = Object.fromEntries(Object.entries(sets).map(([stage, spec]) => [stage, makeArt(stage, spec)]));
  return Object.freeze({ forStage: stage => art[stage] });
})();
