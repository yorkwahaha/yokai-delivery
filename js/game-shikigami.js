// Ninth active skill: 式神・召喚 / shikigami. Coordinates use world space.
window.GAME_SHIKIGAMI = (() => {
  "use strict";
  const TIERS = Object.freeze([
    { maxHp: 42, life: 11, cooldown: 19, speed: 185, attackInterval: 1.50, factor: 1.20, aggroCap: 1, aggroChance: 0.30 },
    { maxHp: 60, life: 13, cooldown: 18, speed: 200, attackInterval: 1.32, factor: 1.55, aggroCap: 2, aggroChance: 0.35 },
    { maxHp: 80, life: 15, cooldown: 17, speed: 215, attackInterval: 1.12, factor: 1.90, aggroCap: 2, aggroChance: 0.42 },
    { maxHp: 105, life: 17, cooldown: 16, speed: 230, attackInterval: 0.93, factor: 2.25, aggroCap: 3, aggroChance: 0.48 },
    { maxHp: 135, life: 19, cooldown: 15, speed: 245, attackInterval: 0.76, factor: 2.65, aggroCap: 3, aggroChance: 0.55 }
  ]);
  const SPECIES = Object.freeze(["fox", "hound", "crow"]);
  const BOSS_DAMAGE_MULTIPLIER = 0.42;
  const MAX_FOLLOW_DISTANCE = 210;
  const AGGRO_RANGE = 180;
  const SCAN_LIMIT = 128;
  const BODY_RADIUS = 15;
  const MOVE_STEP = 8;
  const houndPath = (pose, frame) => `assets/img/characters/shikigami/shikigami__sprite__hound-${pose}__f0${frame}.webp`;
  const CARD_ART_PATH = houndPath("idle", 1);
  const CARD = Object.freeze({ id: "shikigami", jp: "しきがみ・しょうかん",
    zh: "式神・召喚", type: "active", category: "召喚夥伴", artPath: CARD_ART_PATH,
    desc: "召喚跟隨你的式神，自動追擊妖怪並吸引部分小怪。式神有自己的生命，Boss 不會被吸引。" });
  const UPGRADES = Object.freeze([
    "召喚式神自動攻擊與吸引至多 1 隻小怪。生命 42，最多停留 11 秒",
    "生命 60，最多停留 13 秒。攻擊更快，至多吸引 2 隻小怪",
    "生命 80，最多停留 15 秒。提升攻擊速度與傷害",
    "生命 105，最多停留 17 秒。至多吸引 3 隻小怪",
    "生命 135，最多停留 19 秒。提高攻速與傷害，召喚間隔縮短至 15 秒"
  ]);
  const ART_PATHS = Object.freeze({
    fox: "assets/img/vfx/skills/shikigami/shikigami__fox.webp",
    hound: CARD_ART_PATH,
    crow: "assets/img/vfx/skills/shikigami/shikigami__crow.webp",
    attack: "assets/img/vfx/skills/shikigami/shikigami__attack.webp",
    vanish: "assets/img/vfx/skills/shikigami/shikigami__vanish.webp"
  });
  const SFX_PATHS = Object.freeze({
    summon: "assets/audio/sfx/skills/shikigami/shikigami__summon.mp3",
    attack: "assets/audio/sfx/skills/shikigami/shikigami__attack.mp3",
    hurt: "assets/audio/sfx/skills/shikigami/shikigami__hurt.mp3",
    vanish: "assets/audio/sfx/skills/shikigami/shikigami__vanish.mp3"
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const targetable = e => !!e && e.hp > 0 && !e.dying && !e.vanish &&
    !e.done && !e.shield && !e.invulnerable && !e.untargetable;
  function pathBlocked(from, to, blocked, radius) {
    if (!blocked) return false;
    const steps = Math.ceil(distance(from, to) / MOVE_STEP);
    for (let i = 1; i <= steps; i++)
      if (blocked(from.x + (to.x - from.x) * i / steps,
          from.y + (to.y - from.y) * i / steps, radius)) return true;
    return false;
  }
  function loadArt(species) {
    if (typeof window.Image !== "function") return {};
    const load = path => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = path;
      return image;
    };
    if (species === "hound") {
      const frames = pose => [1, 2, 3, 4].map(n => load(houndPath(pose, n)));
      return { hound: load(ART_PATHS.hound), run: frames("run"), bite: frames("attack") };
    }
    return Object.fromEntries([species, "attack", "vanish"].map(key => [key, load(ART_PATHS[key])]));
  }
  function spec(level, effectiveDamage = 1) {
    const lv = Math.max(1, Math.min(5, Math.floor(Number(level) || 1)));
    return { ...TIERS[lv - 1], level: lv, damage: TIERS[lv - 1].factor * effectiveDamage,
      attackRange: 38, seekRange: 195, followRadius: 48,
      maxFollowDistance: MAX_FOLLOW_DISTANCE, aggroRange: AGGRO_RANGE,
      bossMultiplier: BOSS_DAMAGE_MULTIPLIER, maxAllies: 1,
      maxEnemyScan: SCAN_LIMIT,
      cadenceEligible: false, critEligible: false, reachEligible: false };
  }
  function create({ species = "fox", random = Math.random } = {}) {
    const kind = SPECIES.includes(species) ? species : "fox";
    let ally = null, effect = null, cooldown = 0, paused = false, aggroTimer = 0, attackTimer = 0;
    let lastLevel = 0;
    const taunted = new Set();
    const validTaunt = (enemy, player) => targetable(enemy) && enemy.type !== "boss"
      && !(enemy.confusedT > 0) && ally && ally.hp > 0
      && distance(ally, player) <= MAX_FOLLOW_DISTANCE && distance(enemy, ally) <= AGGRO_RANGE
      && distance(enemy, player) <= MAX_FOLLOW_DISTANCE + AGGRO_RANGE;
    function dismiss(event, onEvent) {
      if (!ally) return;
      effect = { x: ally.x, y: ally.y, facing: ally.facing, kind: "vanish", life: .3 };
      ally = null;
      taunted.clear();
      onEvent?.(event, kind);
    }
    function reset() {
      ally = null; effect = null; cooldown = 0; paused = false; lastLevel = 0;
      attackTimer = 0; aggroTimer = 0; taunted.clear();
    }
    function suspend() { paused = true; }
    function resume() { paused = false; }
    function summon(player, cfg, blocked, onEvent) {
      // Never spawn a companion inside an obstacle. No fake collider is used.
      const spots = [[-30, 28], [30, 28], [-28, -26], [28, -26], [0, 0]];
      const offset = spots.find(([dx, dy]) => {
        const point = { x: player.x + dx, y: player.y + dy };
        return !blocked?.(point.x, point.y, BODY_RADIUS) && !pathBlocked(player, point, blocked, BODY_RADIUS);
      });
      if (!offset) return;
      ally = { x: player.x + offset[0], y: player.y + offset[1], hp: cfg.maxHp,
        maxHp: cfg.maxHp, life: cfg.life, maxLife: cfg.life, facing: 1,
        invulnerable: 0, species: kind, walkTime: 0, biteRemaining: 0 };
      cooldown = cfg.cooldown;
      attackTimer = 0.25;
      aggroTimer = 0;
      onEvent?.("summon", kind);
    }
    function moveTowards(point, dt, speed, blocked, player) {
      const dx = point.x - ally.x, dy = point.y - ally.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) return;
      const step = Math.min(speed * Math.min(dt, .25), d);
      const angle = Math.atan2(dy, dx);
      const side = ally.detourSide || 1;
      for (let left = step; left > .01; left -= MOVE_STEP) {
        const length = Math.min(left, MOVE_STEP);
        const cap = Math.max(MAX_FOLLOW_DISTANCE, distance(ally, player));
        const offsets = [0, side * .8, -side * .8, side * 1.6, -side * 1.6];
        for (const offset of offsets) {
          const vx = Math.cos(angle + offset) * length;
          const x = ally.x + vx, y = ally.y + Math.sin(angle + offset) * length;
          if (Math.hypot(x - player.x, y - player.y) > cap ||
              blocked?.(x, y, BODY_RADIUS)) continue;
          ally.x = x; ally.y = y;
          if (offset) ally.detourSide = Math.sign(offset);
          if (Math.abs(vx) >= .2) ally.facing = Math.sign(vx);
          break;
        }
      }
    }
    function nearestEnemy(enemies, player, cfg) {
      let target = null, best = cfg.seekRange;
      for (let i = 0; i < Math.min(SCAN_LIMIT, enemies.length); i++) {
        const e = enemies[i];
        if (!targetable(e) || distance(e, player) > MAX_FOLLOW_DISTANCE + cfg.attackRange + (e.r || 0)) continue;
        const d = distance(e, ally);
        if (d < best) { best = d; target = e; }
      }
      return target;
    }
    function refreshAggro(enemies, player, cfg, dt) {
      for (const enemy of taunted.keys())
        if (!validTaunt(enemy, player) || !enemies.includes(enemy)) taunted.delete(enemy);
      aggroTimer -= dt;
      if (aggroTimer > 0) return;
      aggroTimer = 0.8;
      for (let i = 0; i < Math.min(SCAN_LIMIT, enemies.length) && taunted.size < cfg.aggroCap; i++) {
        const enemy = enemies[i];
        if (!taunted.has(enemy) && validTaunt(enemy, player) && random() < cfg.aggroChance)
          taunted.add(enemy);
      }
    }
    function tick({ dt, level = 0, player, enemies = [], effectiveDamage = 1,
      blocked, hit, onEvent } = {}) {
      if (!(dt > 0) || !player || paused) return;
      if (effect && (effect.life -= dt) <= 0) effect = null;
      if (!(level > 0)) { dismiss("vanish", onEvent); return; }
      const cfg = spec(level, effectiveDamage);
      if (lastLevel > 0 && cfg.level > lastLevel) {
        const previous = TIERS[lastLevel - 1];
        cooldown = Math.max(0, cooldown - (previous.cooldown - cfg.cooldown));
        attackTimer = Math.min(attackTimer, cfg.attackInterval);
        if (ally) {
          ally.hp += cfg.maxHp - ally.maxHp;
          ally.maxHp = cfg.maxHp;
          ally.life += cfg.life - ally.maxLife;
          ally.maxLife = cfg.life;
        }
      }
      lastLevel = cfg.level;
      cooldown = Math.max(0, cooldown - dt);
      if (!ally && cooldown === 0) summon(player, cfg, blocked, onEvent);
      if (!ally) return;
      ally.life -= dt;
      ally.invulnerable = Math.max(0, ally.invulnerable - dt);
      if (ally.life <= 0 || ally.hp <= 0) {
        dismiss(ally.hp <= 0 ? "death" : "expire", onEvent);
        return;
      }
      const separation = distance(player, ally);
      const target = separation > MAX_FOLLOW_DISTANCE ? null : nearestEnemy(enemies, player, cfg);
      const oldX = ally.x, oldY = ally.y;
      if (separation > MAX_FOLLOW_DISTANCE) {
        moveTowards(player, dt, cfg.speed * 1.85, blocked, player);
      } else if (target && distance(target, ally) > cfg.attackRange + (target.r || 0)) {
        moveTowards(target, dt, cfg.speed, blocked, player);
      } else if (!target && separation > cfg.followRadius) {
        moveTowards({x: player.x - 30, y: player.y + 20}, dt, cfg.speed, blocked, player);
      }
      ally.walkTime = ally.x !== oldX || ally.y !== oldY ? ally.walkTime + dt : 0;
      ally.biteRemaining = Math.max(0, ally.biteRemaining - dt);
      attackTimer = Math.max(0, attackTimer - dt);
      // Normal attack cadence, never loop through missed frames or burst.
      if (target && targetable(target) && attackTimer === 0 &&
        distance(target, ally) <= cfg.attackRange + (target.r || 0) &&
        !pathBlocked(ally, target, blocked, 3)) {
        attackTimer = cfg.attackInterval;
        ally.biteRemaining = .36;
        effect = { x: target.x, y: target.y, facing: ally.facing, kind: "attack", life: .2 };
        hit?.(target, cfg.damage * (target.type === "boss" ? BOSS_DAMAGE_MULTIPLIER : 1), "shikigami");
        // A finishing blow can synchronously end the run and reset this controller.
        if (!ally) return;
        onEvent?.("attack", kind);
      }
      refreshAggro(enemies, player, cfg, dt);
    }
    // Respect an existing confusion target and never redirect a boss.
    function targetForEnemy(enemy, player, existingAim = player) {
      if (paused || existingAim !== player || !ally ||
        !taunted.has(enemy) || !validTaunt(enemy, player)) return existingAim;
      return ally; // Enemy movement and projectiles can use this world-space body.
    }
    // The consumer calls this only after a confirmed enemy contact/projectile
    // collision. Ranged bullets can originate beyond melee distance.
    function receiveEnemyAttack(enemy, damage, onEvent, { projectile = false, target } = {}) {
      if (paused || !ally || enemy?.type === "boss") return false;
      if (projectile && target) {
        if (ally !== target) return false;
      } else if (!taunted.has(enemy) || !targetable(enemy) ||
          (!projectile && distance(enemy, ally) > 55)) return false;
      if (ally.invulnerable > 0) return true; // Attack is still diverted.
      ally.hp = Math.max(0, ally.hp - Math.max(0, Number(damage) || 0));
      ally.invulnerable = 0.4;
      onEvent?.("hurt", kind);
      if (ally.hp === 0) dismiss("death", onEvent);
      return true;
    }
    function stepProjectile(bullet, previous, blocked, onEvent) {
      if (!ally || bullet.target !== ally) return true;
      const steps = Math.max(1, Math.ceil(distance(previous, bullet) / MOVE_STEP));
      for (let i = 1; i <= steps; i++) {
        const point = { x: previous.x + (bullet.x - previous.x) * i / steps,
          y: previous.y + (bullet.y - previous.y) * i / steps };
        if (blocked?.(point.x, point.y, 8)) return true;
        if (distance(ally, point) >= BODY_RADIUS + 5) continue;
        receiveEnemyAttack(bullet.shooter, 8, onEvent, { projectile: true, target: ally });
        return true;
      }
      return false;
    }
    function paint(ctx, art = {}, opacity = 1, pose = ally) {
      if (!pose) return;
      let sprite = art[pose.kind || kind];
      const houndBody = kind === "hound" && !pose.kind && art.run;
      if (houndBody) {
        const frame = pose.biteRemaining > 0
          ? art.bite[Math.min(3, Math.floor((.36 - pose.biteRemaining) / .09))]
          : pose.walkTime > 0 ? art.run[Math.floor(pose.walkTime * 11) % 4] : null;
        if (frame?.naturalWidth) sprite = frame;
      }
      if (!(sprite?.naturalWidth > 0 && sprite.naturalHeight > 0)) return;
      ctx.save();
      ctx.globalAlpha *= opacity * Math.min(1, pose.life / (pose.kind ? .15 : .4));
      ctx.translate(pose.x, pose.y);
      ctx.scale(pose.facing < 0 ? -1 : 1, 1);
      if (houndBody) {
        const width = 112, scale = width / 512;
        ctx.drawImage(sprite, -256 * scale, -320 * scale, width, 352 * scale);
      } else {
        const width = kind === "crow" ? 78 : 94, height = kind === "crow" ? 68 : 82;
        ctx.drawImage(sprite, -width / 2, -height + 18, width, height);
      }
      ctx.restore();
    }
    function snapshot() {
      return { active: !!ally, species: kind, hp: ally?.hp || 0, maxHp: ally?.maxHp || 0,
        remaining: ally?.life || 0, cooldown, aggroCount: taunted.size,
        position: ally ? [ally.x, ally.y] : null };
    }
    return Object.freeze({
      tick, targetForEnemy, receiveEnemyAttack, suspend, resume, reset,
      stepProjectile, paint, snapshot, body: () => ally, effect: () => effect, species: kind
    });
  }
  return Object.freeze({ spec, create, loadArt, SPECIES, ART_PATHS, SFX_PATHS, CARD_ART_PATH, CARD, UPGRADES });
})();
