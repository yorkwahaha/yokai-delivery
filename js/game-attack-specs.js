// Phase 12: exact extracted attack specifications for active and legacy fusion skills.
// Runtime build values and evolution helpers are explicitly supplied by game.js.
// No gameplay state mutation, weapon casting, random draw, or asset loading here.
window.GAME_ATTACK_SPECS = (() => {
  function resolveAttackSpec(skillId, lvl, buildState, options = {}, deps) {
    const {WL, W, b, buildMutations, buildDuos, getEffectiveRate,
      getEffectiveDmg, getEffectiveReachMultiplier, EVOLUTIONS} = deps;
    const level = typeof lvl === "number" ? lvl : (WL[skillId] || 0);
    const baseRate = getEffectiveRate(buildState);
    const baseDmg = getEffectiveDmg(buildState);
    const reachMult = getEffectiveReachMultiplier(buildState);
    if (skillId === "katana") {
      const baseReach = 145 + (level - 1) * 16;
      const mutations = (buildState && Array.isArray(buildState.mutations)) ? buildState.mutations : buildMutations;
      const hasCharge = mutations.includes("mut_iaicharge");
      const hasBreak = mutations.includes("mut_armorbreak");
      const hasLongblade = mutations.includes("mut_longblade");
      const reach = level === 5 ? baseReach : Math.round(baseReach * reachMult * (hasLongblade ? 1.23 : 1));
      const swingReach = level === 5 ? (hasLongblade ? 900 : 720) : reach * 0.85;
      const cooldown = Math.max(0.6, 0.72 - baseRate * 0.13) + (hasCharge ? 0.16 : 0);
      const slashDmg = (baseDmg + (level - 1) * 0.8) * (hasCharge ? 1.24 : 1);
      const windDmg = (baseDmg + 3.2) * 1.15 * (hasCharge ? 1.24 : 1);
      const hasCrosscut = mutations.includes("mut_crosscut");
      const crosscutDmg = Number((slashDmg * 0.60).toFixed(2));
      const crosscutReach = level === 5 ? (hasLongblade ? 270 : 220) : Math.round(reach * 0.90);
      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoInkfire = duos.includes("duo_inkfire");
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + critLvl * 0.15);
      return {
        skillId: "katana",
        level,
        isAwakened: level === 5,
        reach,
        swingReach,
        arc: 1.22,
        cooldown,
        slashDmg,
        windDmg,
        maxTravel: hasLongblade ? 900 : 720,
        pierceLimit: 6,
        pierceScaleAfterThree: 0.75,
        source: (hasCrosscut || hasCharge || hasBreak || hasLongblade) ? "mutation" : (hasDuoInkfire ? "duo" : "base"),
        derivationDepth: 0,
        hasCrosscut,
        hasCharge, hasBreak, hasLongblade,
        armoredDamageMultiplier: hasBreak ? 1.30 : 1,
        bossDamageMultiplier: hasBreak ? 1.20 : 1,
        crosscutDelay: 0.16,
        crosscutDmg,
        crosscutReach,
        crosscutArc: 1.15,
        crosscutAngleOffset: Math.PI * 0.42,
        hasDuoInkfire,
        duoInkfire: hasDuoInkfire ? { delay: 0.12, radius: 56, budgetRate: 0.20, maxTargets: 3 } : null,
        critLvl,
        critChance,
        critMult: 1.8
      };
    }
    if (skillId === "needle") {
      const isAwakened = level === 5;
      const needleFloor = 0.45;
      // Lv5: eight shots over 0.4s, THEN a full 1.0s base cooldown.
      // Charm cadence still applies to the cooldown, not the firing interval.
      const cooldown = isAwakened ? Math.max(0.45, 1.0 - baseRate * 0.1)
        : Math.max(needleFloor, 1.25 - level * 0.16 - baseRate * 0.1);
      const rawCount = EVOLUTIONS?.needleCount ? EVOLUTIONS.needleCount(level) : [3, 5, 7, 8, 8][Math.max(0, Math.min(4, level - 1))];
      const speed = 640;
      // Lv3: 90-degree fan; Lv4: 120-degree fan.
      // Lv5 uses eight evenly spaced 360-degree headings in game.js.
      const rawSpread = isAwakened ? Math.PI * 2
        : level === 4 ? Math.PI * 2 / 3
        : level === 3 ? Math.PI / 2 : 0.45;
      const rawLife = isAwakened ? 0.95 : 0.65;
      const life = Number((rawLife * reachMult).toFixed(4));
      const range = Math.round(440 * reachMult);
      const rawBaseDamage = isAwakened ? 3.9 : (1.4 + level * 0.7);

      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : (buildMutations || []);
      const hasSeek = mutations.includes("mut_seek");
      const hasFrost = mutations.includes("mut_frost");
      const hasPierce = mutations.includes("mut_pierce");
      const hasReturn = mutations.includes("mut_return");

      const count = rawCount;
      const spread = rawSpread;
      const baseDamage = Number(rawBaseDamage.toFixed(4));
      const damage = baseDamage * baseDmg;

      const tracking = hasSeek;
      const turnRate = hasSeek ? (isAwakened ? 4.8 : 4.2) : 0;
      const seekRange = Math.round(480 * reachMult);
      const frost = hasFrost;

      const pierceBonusScale = hasPierce ? 0.15 : 0;
      const maxPierceBonusHits = hasPierce ? 2 : 0;
      const pierceBonusMax = hasPierce ? 0.30 : 0;

      // Direction-specific viewport edge distance is resolved per fired needle.
      // This is the minimum reference for UI/spec consumers (old 220px removed).
      const returnDistance = hasReturn ? Math.round(W * 0.5 * 0.72) : 0;

      const spec = {
        skillId: "needle",
        level,
        isAwakened,
        radialVolley: isAwakened,
        volleyInterval: isAwakened ? 0.05 : 0,
        source: mutations.length > 0 ? "mutation" : "base",
        count,
        speed,
        spread,
        life,
        range,
        cooldown,
        baseDamage,
        damage,
        tracking,
        frost,
        hasPierce,
        pierceBonusScale,
        maxPierceBonusHits,
        pierceBonusMax,
        hasReturn,
        returnDistance,
        derivation: "none"
      };

      if (hasSeek) {
        spec.seek = true;
        spec.turnRate = turnRate;
        spec.seekRange = seekRange;
      }
      if (hasFrost) {
        spec.frostThreshold = 1;
        spec.bossFrostThreshold = 3;
      }
      if (hasPierce) {
        spec.pierce = true;
        spec.pierceBonusScale = pierceBonusScale;
        spec.maxPierceBonusHits = maxPierceBonusHits;
        spec.pierceBonusMax = pierceBonusMax;
      }
      if (hasReturn) {
        spec.return = true;
        spec.returnDistance = returnDistance;
      }
      if (mutations.length > 0) {
        spec.mutations = [...mutations];
      }
      return spec;
    }
    if (skillId === "barrier") {
      const isAwakened = level === 5;
      const cooldown = isAwakened
        // Awakened casts must not become slower than Lv4, and cadence
        // charms / passive rate must remain effective after awakening.
        ? Math.max(1.2, 1.5 - baseRate * 0.2)
        : Math.max(1.2, 3.2 - level * 0.42 - baseRate * 0.2);
      const baseRadius = isAwakened
        // Use the same reach scaling as Lv1-4 so Lv5 never shrinks on upgrade.
        ? Math.round(290 * reachMult)
        : Math.round((140 + level * 28) * reachMult);
      const baseDamage = isAwakened
        ? (2.0 + level * 1.1) * baseDmg * 0.5
        : (baseDmg + (level - 1) * 0.8) * 0.4;
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasPulse = mutations.includes("mut_pulse");
      const hasBind = mutations.includes("mut_bindseal");
      const hasWide = mutations.includes("mut_widecircle");
      const hasRepulse = mutations.includes("mut_repulse");
      const pulseCount = hasPulse ? 2 : 1;
      const pulseDelay = 0.18;
      const pulseScale = hasPulse ? 0.65 : 1.0;
      const radius = Math.round(baseRadius * (hasWide ? 1.22 : 1));
      const damage = Number((baseDamage * pulseScale * (hasWide ? 0.88 : 1)).toFixed(4));
      const fullKnockback = level >= 4 ? 50 + level * 10 : 0;
      const knockback = Math.round((hasPulse ? fullKnockback * 0.50 : fullKnockback) * (hasRepulse ? 1.6 : 1)) || (hasRepulse ? 42 : 0);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.15 + critLvl * 0.10);
      const sanctuary = isAwakened ? { duration: 1.8, radius } : null;

      return {
        skillId: "barrier",
        level,
        isAwakened,
        source: (hasPulse || hasBind || hasWide || hasRepulse) ? "mutation" : "base",
        derivationDepth: 0,
        cooldown,
        baseRadius,
        radius,
        baseDamage,
        damage,
        hasPulse,
        hasBind, hasWide, hasRepulse,
        slowDuration: hasBind ? 0.72 : 0,
        pulseCount,
        pulseDelay,
        pulseScale,
        pulseRadius: radius,
        knockback,
        fullKnockback,
        critLvl,
        critChance,
        critMult: 1.8,
        sanctuary
      };
    }
    if (skillId === "thunder") {
      const isAwakened = level === 5;
      const baseCooldown = isAwakened
        ? 2.4
        : level === 4
          ? 2.0
          : Math.max(2.0, Number((2.6 - level * 0.35).toFixed(2)));
      const mutations = (buildState && Array.isArray(buildState.mutations)) ? buildState.mutations : buildMutations;
      const hasFocus = mutations.includes("mut_thunderfocus");
      const hasStun = mutations.includes("mut_thunderstun");
      const hasOverload = mutations.includes("mut_thunderoverload");
      const cooldown = Number((baseCooldown * (hasOverload ? 1.25 : 1)).toFixed(4));
      const mult = level === 1 ? 2.0 : level === 2 ? 3.0 : level === 3 ? 4.5 : level === 4 ? 6.0 : 8.0;
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const rawRadius = level >= 4 ? 450 : (110 + Math.min(level, 3) * 80);
      const radius = Math.round(rawRadius * reachMult);
      const rawTargetCount = level === 4 ? 3 : (level === 5 ? 3 : level);
      const targetCount = Math.max(1, rawTargetCount - (hasFocus ? 1 : 0));
      const damage = Number((mult * baseDmg * (hasFocus ? 1.30 : 1) * (hasOverload ? 1.35 : 1)).toFixed(4));
      const cloudRadius = 90;

      const hasBranch = mutations.includes("mut_branch");
      const branchCount = hasBranch ? 1 : 0;
      const branchScale = 0.25;
      const branchDamage = Number((damage * branchScale).toFixed(4));
      const branchRadius = Math.round(180 * reachMult);

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : buildDuos;
      const hasDuoThundercircle = duos.includes("duo_thundercircle");

      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + critLvl * 0.15);

      return {
        skillId: "thunder",
        level,
        isAwakened,
        source: (hasBranch || hasFocus || hasStun || hasOverload) ? "mutation" : (hasDuoThundercircle ? "duo" : "base"),
        derivationDepth: 0,
        cooldown,
        mult,
        baseDamage: damage,
        damage,
        radius,
        targetCount,
        hasBranch, hasFocus, hasStun, hasOverload,
        slowDuration: hasStun ? 0.55 : 0,
        bossSlowDuration: hasStun ? 0.18 : 0,
        branchCount,
        branchScale,
        branchDamage,
        branchRadius,
        cloudRadius,
        hasDuoThundercircle,
        duoThundercircle: hasDuoThundercircle ? { delay: 0.12, radius: 64, budgetRate: 0.20, maxTargets: 3 } : null,
        critLvl,
        critChance,
        critMult: 1.8
      };
    }
    if (skillId === "fire") {
      const isAwakened = level === 5;
      const count = EVOLUTIONS?.fireCount ? EVOLUTIONS.fireCount(level) : [1, 2, 3, 3, 3][Math.max(0, Math.min(4, level - 1))];
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasOrbit = mutations.includes("mut_orbit");
      const hasRapid = mutations.includes("mut_rapidfire");
      const hasFlamebind = mutations.includes("mut_flamebind");
      const hasFury = mutations.includes("mut_furyfire");
      const rx = hasOrbit ? 126 : 98;
      const ry = hasOrbit ? 78 : 98;
      const angularSpeed = 2.8 * (hasRapid ? 1.40 : 1);
      const hitInterval = 0.42 * (hasRapid ? 0.85 : 1);
      const contactDamage = Number(((1.2 + level * 0.6) * baseDmg * (hasOrbit ? 1.20 : 1) * (hasFury ? 1.25 : 1)).toFixed(4));
      const attackCount = EVOLUTIONS?.fireAttackCount ? EVOLUTIONS.fireAttackCount(level) : [0, 0, 0, 1, 0][Math.max(0, Math.min(4, level - 1))];
      const spiritDamage = Number(((2.1 + (level || 1) * 0.9) * baseDmg).toFixed(4));
      const spiritCooldown = EVOLUTIONS?.fireAttackCooldown ? EVOLUTIONS.fireAttackCooldown(level) : [2.5, 2.2, 1.9, 1.55, 1.05][Math.max(0, Math.min(4, level - 1))];
      const cooldown = isAwakened ? 7.2 : spiritCooldown;
      const dragonDirectDmg = Number((12 * baseDmg * (hasOrbit ? 1.15 : 1)).toFixed(4));
      const dragonSplashDmg = Number((4 * baseDmg * (hasOrbit ? 1.15 : 1)).toFixed(4));
      const dragonScorchDmg = Number((1.8 * baseDmg * (hasOrbit ? 1.15 : 1) * (hasFury ? 1.15 : 1)).toFixed(4));
      const scorchDuration = 5;
      const scorchRadius = 140;

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoInkfire = duos.includes("duo_inkfire");
      const hasDuoCinderseal = duos.includes("duo_cinderseal");

      return {
        skillId: "fire",
        level,
        isAwakened,
        source: (hasOrbit || hasRapid || hasFlamebind || hasFury) ? "mutation" : ((hasDuoInkfire || hasDuoCinderseal) ? "duo" : "base"),
        derivationDepth: 0,
        count,
        hasOrbit, hasRapid, hasFlamebind, hasFury,
        slowDuration: hasFlamebind ? 0.65 : 0,
        hasDuoInkfire,
        hasDuoCinderseal,
        rx,
        ry,
        angularSpeed,
        hitInterval,
        contactDamage,
        attackCount,
        spiritDamage,
        spiritCooldown,
        cooldown,
        dragonDirectDmg,
        dragonSplashDmg,
        dragonScorchDmg,
        scorchDuration,
        scorchRadius
      };
    }
    if (skillId === "boom") {
      const isAwakened = level === 5;
      const baseCount = EVOLUTIONS?.boomCount ? EVOLUTIONS.boomCount(level) : [1, 2, 3, 4, 2][Math.max(0, Math.min(4, level - 1))];
      const cooldown = isAwakened ? 1.6 : Number((2.0 - level * 0.24).toFixed(2));
      const speed = 880;
      const life = 1.4;
      const fuse = 1.5;
      const spread = level >= 4 ? 0.28 : 0.32;
      // The original 610px Lv5 diameter blocked too much of the game.
      // Half the blast diameter, preserving full AoE damage for every target.
      const baseRadius = [78, 92, 108, 122, 153][Math.max(0, Math.min(4, level - 1))];
      const radius = Math.round(baseRadius * reachMult);
      const rawDamage = 1.5 + level * 0.7;
      const baseDamage = Number((rawDamage * baseDmg).toFixed(4));
      const splashScale = isAwakened ? 1.0 : 0.20;
      const baseSplashDamage = Number((baseDamage * splashScale).toFixed(4));
      const knockback = 72;

      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : (buildMutations || []);
      const hasFan = mutations.includes("mut_boom_fan");
      const hasSplitblast = mutations.includes("mut_splitblast");
      const hasSeek = mutations.includes("mut_boom_seek");
      const hasFrost = mutations.includes("mut_boom_frost");
      const tracking = hasSeek;
      const turnRate = hasSeek ? 4.2 : 0;
      const seekRange = Math.round(480 * reachMult);
      const frost = hasFrost;
      const frostThreshold = 1;
      const bossFrostThreshold = 3;

      const count = hasFan ? Math.min(6, baseCount + 2) : baseCount;
      const damage = hasFan ? ((baseDamage * baseCount * 1.20) / count) : baseDamage;
      const splashDamage = hasFan ? ((baseSplashDamage * baseCount * 1.20) / count) : baseSplashDamage;

      const splitblastDelay = 0.18;
      const splitblastRadiusScale = 0.55;
      const splitblastRadius = hasSplitblast ? Math.round(radius * splitblastRadiusScale) : 0;
      const splitblastDirectScale = 0.25;
      const splitblastSplashScale = 0.25;
      const splitblastDirectDamage = hasSplitblast
        ? (hasFan ? (damage * splitblastDirectScale) : Number((damage * splitblastDirectScale).toFixed(4)))
        : 0;
      const splitblastSplashDamage = hasSplitblast
        ? (hasFan ? (splashDamage * splitblastSplashScale) : Number((splashDamage * splitblastSplashScale).toFixed(4)))
        : 0;

      const duos = (buildState && Array.isArray(buildState.duos))
        ? buildState.duos
        : (buildDuos || []);
      const hasDuoFrostseal = duos.includes("duo_frostseal");
      const hasDuoCinderseal = duos.includes("duo_cinderseal");

      return {
        skillId: "boom",
        level,
        isAwakened,
        source: (hasFan || hasSplitblast || hasSeek || hasFrost) ? "mutation" : ((hasDuoFrostseal || hasDuoCinderseal) ? "duo" : "base"),
        derivationDepth: 0,
        baseCount,
        count,
        cooldown,
        speed,
        life,
        fuse,
        spread,
        baseRadius,
        radius,
        baseDamage: rawDamage,
        damage,
        splashScale,
        splashDamage,
        knockback,
        hasFan,
        fan: hasFan,
        hasSplitblast,
        splitblastDelay,
        splitblastRadiusScale,
        splitblastRadius,
        splitblastDirectScale,
        splitblastSplashScale,
        splitblastDirectDamage,
        splitblastSplashDamage,
        hasSeek,
        seek: hasSeek,
        tracking,
        turnRate,
        seekRange,
        hasFrost,
        frost,
        frostThreshold,
        bossFrostThreshold,
        hasDuoFrostseal,
        duoFrostseal: hasDuoFrostseal ? { slowDuration: 0.35, slowMult: 0.65, bossSlowDuration: 0.15, bossSlowMult: 0.90, immuneDuration: 2.0 } : null,
        hasDuoCinderseal,
        duoCinderseal: hasDuoCinderseal ? { delay: 0.3, radius: 64, life: 0.8, budgetRate: 0.15, maxTargets: 3 } : null,
        mutations: [...mutations]
      };
    }
    // 融合武器：墨焰斬
    if (skillId === "fusion_inkblade") {
      const isAwakened = true; // 融合武器即為覺醒狀態
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const baseReach = 280;
      const reach = Math.round(baseReach * reachMult);
      // Lv5 妖刀＋狐火的融合不應比原妖刀明顯變慢或變弱。
      const cooldown = 0.70;
      const slashDmg = Number((baseDmg * 6.5).toFixed(2));
      const mutations = (buildState && Array.isArray(buildState.mutations))
        ? buildState.mutations
        : buildMutations;
      const hasCrosscut = mutations.includes("mut_crosscut");
      const crosscutDmg = Number((baseDmg * 1.5).toFixed(2));
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + (buildState?.passives?.crit ?? b.crit ?? 0) * 0.15);
      return {
        skillId: "fusion_inkblade",
        level: 1,
        isAwakened: true,
        reach,
        cooldown,
        slashDmg,
        arc: 2.0, // 114.6度扇形 (2.0 rad)
        maxTargets: 7,
        scorchDuration: 2.5,
        scorchRadius: 80,
        critChance,
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷狐居合
    if (skillId === "fusion_foxiai") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxiai",
        level: 1,
        isAwakened: true,
        reach: Math.round(360 * reachMult),
        hitWidth: 64,
        cooldown: 1.6,
        warn: 0.18,
        damage: Number((baseDmg * 21).toFixed(2)),
        maxTargets: 4,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：退魔符刃
    if (skillId === "fusion_exorcistblade") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_exorcistblade",
        level: 1,
        isAwakened: true,
        reach: Math.round(240 * reachMult),
        arc: 1.6,
        cooldown: 1.7,
        warn: 0.1,
        slashDmg: Number((baseDmg * 14).toFixed(2)),
        burstDmg: Number((baseDmg * 8).toFixed(2)),
        burstRadius: 72,
        markDelay: 0.28,
        maxTargets: 4,
        burstMaxTargets: 3,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：妖火結界
    if (skillId === "fusion_foxfirebarrier") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxfirebarrier",
        level: 1,
        isAwakened: true,
        radius: Math.round(150 * reachMult),
        cooldown: 2.5,
        warn: 0.12,
        duration: 1.75,
        pulses: 4,
        pulseInterval: 0.35,
        firstPulse: 0.12,
        damage: Number((baseDmg * 8).toFixed(2)),
        maxTargets: 6,
        knockback: 70,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：退魔封陣
    if (skillId === "fusion_exorcistseal") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_exorcistseal",
        level: 1,
        isAwakened: true,
        castRange: Math.round(190 * reachMult),
        radius: Math.round(110 * reachMult),
        cooldown: 2.0,
        warn: 0.35,
        duration: 1.15,
        pulses: 4,
        pulseInterval: 0.15,
        firstPulse: 0.35,
        damage: Number((baseDmg * 7.5).toFixed(2)),
        maxTargets: 6,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：斬界輪（妖刀＋靈陣）
    if (skillId === "fusion_slashwheel") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_slashwheel",
        level: 1,
        isAwakened: true,
        cooldown: 1.65,
        expandTime: 0.45,
        radius: Math.round(320 * reachMult),
        bands: [
          { at: Math.round(150 * reachMult), damage: Number((baseDmg * 9).toFixed(2)), maxTargets: 5 },
          { at: Math.round(320 * reachMult), damage: Number((baseDmg * 6.5).toFixed(2)), maxTargets: 5 }
        ],
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：狐雷天燈（狐火＋天狐雷）
    if (skillId === "fusion_foxthunderlantern") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_foxthunderlantern",
        level: 1,
        isAwakened: true,
        cooldown: 1.65,
        count: 4,
        lockRange: Math.round(390 * reachMult),
        strikeRadius: 82,
        warn: 0.12,
        damage: Number((baseDmg * 12).toFixed(2)),
        maxTargets: 4,
        splashScale: 0.65,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：炎符祭（狐火＋陰陽符）
    if (skillId === "fusion_flamefestival") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      return {
        skillId: "fusion_flamefestival",
        level: 1,
        isAwakened: true,
        cooldown: 2.2,
        count: 4,
        range: Math.round(320 * reachMult),
        landRadius: 62,
        damage: Number((baseDmg * 7).toFixed(2)),
        maxTargets: 3,
        warn: 0.18,
        emberTicks: 2,
        emberInterval: 0.35,
        emberRadius: 48,
        emberDamage: Number((baseDmg * 3).toFixed(2)),
        emberMaxTargets: 2,
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷符神罰（天狐雷＋陰陽符）
    // 新機制：一個主 AOE 爆炸（五枚雷符落定各自判定），每個被命中的敵人額外再受一次「既有天狐雷判定」傷害
    if (skillId === "fusion_thundertalisman") {
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      // 計算「既有天狐雷」單次傷害：覺醒等級用 8.0 倍率
      const thunderMult = 8.0;
      const thunderDamage = Number((thunderMult * baseDmg).toFixed(4));
      return {
        skillId: "fusion_thundertalisman",
        level: 1,
        isAwakened: true,
        cooldown: 2.4,
        count: 5,
        range: Math.round(300 * reachMult),
        strikeRadius: 70,
        warn: 0.36,
        damage: Number((baseDmg * 6.5).toFixed(2)), // 主爆炸傷害
        maxTargets: 4,
        // 新：每名命中敵人額外承受一次天狐雷傷害（去重、Boss倍率、不無限連鎖）
        thunderTickDamage: thunderDamage,
        thunderTickRadius: Math.round(450 * reachMult), // 天狐雷覺醒半徑
        thunderTickBossScale: 0.5, // Boss 承受天狐雷傷害的倍率
        critChance: Math.min(0.5, 0.2 + critLvl * 0.15),
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    // 融合武器：雷陣封界（靈陣＋天狐雷；陣域脈衝＋定點警示落雷）
    if (skillId === "fusion_thundercircle") {
      const isAwakened = true;
      const baseDmg = getEffectiveDmg(buildState);
      const reachMult = getEffectiveReachMultiplier(buildState);
      const cooldown = 1.65;
      const radius = Math.round(265 * getEffectiveReachMultiplier(buildState));
      const pulseInterval = 0.42;
      const pulseCount = 4;
      const pulseDamage = baseDmg * 4.0;
      const pulseRadius = 104;
      const critLvl = typeof options.critLvl === "number"
        ? options.critLvl
        : (buildState?.passives?.crit ?? b.crit ?? 0);
      const critChance = Math.min(0.5, 0.2 + (buildState?.passives?.crit ?? b.crit ?? 0) * 0.15);
      return {
        skillId: "fusion_thundercircle",
        level: 1,
        isAwakened: true,
        cooldown,
        radius,
        pulseInterval,
        pulseCount,
        pulseDamage,
        pulseRadius,
        pulseWarning: 0.12, // 首波雷擊同步視覺，避免原本 0.5 + 0.6 秒的空窗
        critChance,
        critMult: 1.8,
        source: "fusion",
        derivationDepth: 0
      };
    }
    return {
      skillId,
      level,
      isAwakened: level === 5,
      source: "base"
    };
  }

  return Object.freeze({ resolveAttackSpec });
})();
