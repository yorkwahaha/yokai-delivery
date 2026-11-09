// Phase 8: pure mutation eligibility predicates.
// No reads of live build lists, changes to skills, or random selection.
window.GAME_BUILD_RULES = (() => {
  function getSkillMutations(skillId, list, mutationConfig) {
    if (!Array.isArray(list)) return [];
    return list.filter(id => {
      const cfg = mutationConfig[id];
      return !!cfg && cfg.skillId === skillId;
    });
  }
  function isMutationFamilyTaken(id, list, mutationConfig) {
    const family = mutationConfig[id]?.family;
    return !!family && list.some(other => mutationConfig[other]?.family === family);
  }
  function canAddMutation(id, list, mutationConfig, skillLevels, slotsPerSkill) {
    const cfg = mutationConfig[id];
    if (!cfg?.inPool || !Array.isArray(list) || list.includes(id)) return false;
    if (isMutationFamilyTaken(id, list, mutationConfig)) return false;
    return (skillLevels[cfg.skillId] || 0) > 0
      && getSkillMutations(cfg.skillId, list, mutationConfig).length < slotsPerSkill;
  }
  function createBuildState(weapons, levels, charms, mutations, duos, charmLevelOf) {
    const activeSkills = Object.keys(weapons).filter(k => (levels[k] || 0) > 0);
    return {
      schemaVersion: 1,
      activeSkills,
      WL: { ...levels },
      ownedActiveCount: activeSkills.length,
      charms: [...charms],
      charmLevels: Object.fromEntries(charms.map(id => [id, charmLevelOf(id)])),
      mutations: [...mutations],
      duos: [...duos]
    };
  }
  function weaponOfferKeys(weapons, levels, maxActive, seals, host) {
    const owned = Object.keys(weapons).filter(k => (levels[k] || 0) > 0);
    const canLearnNew = owned.length < maxActive;

    // 武器選項：未滿 4 槽位可學新武器，已滿 4 槽位僅允許升級持有武器
    const eligibleWeaponKeys = Object.keys(weapons).filter(k => {
      if (k.startsWith("fusion_")) return false; // 融合武器不可由普通升級抽取
      if (host.FUSION && typeof host.FUSION.isSkillConsumed === "function" && host.FUSION.isSkillConsumed(k)) return false;
      if ((levels[k] || 0) >= 5) return false;
      if (levels[k] === 0 && !canLearnNew) return false;
      return true;
    });
    const awakenKeys = Object.keys(weapons).filter(k => {
      if (k.startsWith("fusion_")) return false;
      if (host.FUSION && typeof host.FUSION.isSkillConsumed === "function" && host.FUSION.isSkillConsumed(k)) return false;
      // Ordinary Lv5 is now available in eligibleWeaponKeys. No seal cost.
      return false;
    });

    return {eligibleWeaponKeys, awakenKeys};
  }
  function duoOfferKeys(duoConfig, ownedDuos, levels) {
    const eligibleDuoKeys = Object.keys(duoConfig).filter(duoId => {
      const cfg = duoConfig[duoId];
      if (!cfg || !cfg.inPool) return false;
      if (ownedDuos.includes(duoId)) return false;
      return cfg.skillIds.every(s => (levels[s] || 0) >= 3);
    });

    return eligibleDuoKeys;
  }
  return Object.freeze({
    getSkillMutations, isMutationFamilyTaken, canAddMutation,
    createBuildState, weaponOfferKeys, duoOfferKeys
  });
})();
