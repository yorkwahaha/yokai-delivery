// Exact previous tutorial initialization from phase 19.
  const tutorialIds = ['pickup', 'delivery', 'dash', 'boss'];
  const tutorialKey = (id, stageId = STAGE.id) =>
    id === 'delivery' || id === 'boss' ? `${stageId}:${id}` : id;
  const tutorialKeys = new Set(tutorialIds.flatMap(id =>
    [id, ...Object.keys(window.CONTENT.STAGES).map(stageId => tutorialKey(id, stageId))]));
  let tutorial = null, tutorialSeen = new Set(), tutorialSkipped = false;
  let inputMode = touch ? 'touch' : 'keyboard';
  try {
    const saved = JSON.parse(localStorage.getItem('yokai-tutorial-v1'));
    tutorialSkipped = saved === 'skip';
    // 舊版未分關的讀題紀錄保留給夜行町；雨港首次仍需交代不同規則。
    if (Array.isArray(saved)) tutorialSeen = new Set(saved.filter(id => tutorialKeys.has(id))
      .map(id => tutorialIds.includes(id) ? tutorialKey(id, 'night-town') : id));
  } catch {}

this.tutorialSnapshot = () => ({ids:[...tutorialIds],keys:[...tutorialKeys],seen:[...tutorialSeen],skipped:tutorialSkipped});
