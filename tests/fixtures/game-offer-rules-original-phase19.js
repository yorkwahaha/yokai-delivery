// Frozen pre-extraction offer pool logic.
function oldWeaponOfferKeys(WI,WL,MAX_ACTIVE_WEAPONS,seals,window) {
    const owned = Object.keys(WI).filter(k => (WL[k] || 0) > 0);
    const canLearnNew = owned.length < MAX_ACTIVE_WEAPONS;

    // 武器選項：未滿 4 槽位可學新武器，已滿 4 槽位僅允許升級持有武器
    const eligibleWeaponKeys = Object.keys(WI).filter(k => {
      if (k.startsWith("fusion_")) return false; // 融合武器不可由普通升級抽取
      if (window.FUSION && typeof window.FUSION.isSkillConsumed === "function" && window.FUSION.isSkillConsumed(k)) return false;
      if ((WL[k] || 0) >= 4) return false;
      if (WL[k] === 0 && !canLearnNew) return false;
      return true;
    });
    const awakenKeys = Object.keys(WI).filter(k => {
      if (k.startsWith("fusion_")) return false;
      if (window.FUSION && typeof window.FUSION.isSkillConsumed === "function" && window.FUSION.isSkillConsumed(k)) return false;
      return WL[k] === 4 && seals > 0;
    });

    return {eligibleWeaponKeys, awakenKeys};
}
function oldDuoOfferKeys(DUO_CONFIG,buildDuos,WL) {
    const eligibleDuoKeys = Object.keys(DUO_CONFIG).filter(duoId => {
      const cfg = DUO_CONFIG[duoId];
      if (!cfg || !cfg.inPool) return false;
      if (buildDuos.includes(duoId)) return false;
      return cfg.skillIds.every(s => (WL[s] || 0) >= 3);
    });

    return eligibleDuoKeys;
}
