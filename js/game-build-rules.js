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
  return Object.freeze({ getSkillMutations, isMutationFamilyTaken, canAddMutation, createBuildState });
})();
