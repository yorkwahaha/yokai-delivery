// Phase20: tutorial stage-key and legacy persistence migration rules.
// No storage access or changes to tutorial flow/visibility.
window.GAME_TUTORIAL_RULES = (() => {
  function tutorialIds() { return ['pickup', 'delivery', 'dash', 'boss']; }
  function tutorialKey(id, stageId) {
    return id === 'delivery' || id === 'boss' ? `${stageId}:${id}` : id;
  }
  function acceptedKeys(ids, stages, key) {
    return new Set(ids.flatMap(id =>
      [id, ...Object.keys(stages).map(stageId => key(id, stageId))]));
  }
  function seenFromSaved(saved, ids, keys, key) {
    return new Set(saved.filter(id => keys.has(id))
      .map(id => ids.includes(id) ? key(id, 'night-town') : id));
  }
  return Object.freeze({ tutorialIds, tutorialKey, acceptedKeys, seenFromSaved });
})();
