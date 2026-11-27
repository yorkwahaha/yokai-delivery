// Delivery media single source of truth: stages, per-word indexes, and approved production paths.
// Artwork and audio have independent approval and preview routes.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const kinds = Object.freeze({
    image: Object.freeze({folder: "img", ext: "webp"}),
    audio: Object.freeze({folder: "audio", ext: "mp3"})
  });
  const stageIds = Object.freeze((root.DELIVERY_LEXICON?.stages || []).slice(0, 7).map(stage => stage.id));
  // Different approval dates for image and audio are supported; do not implicitly publish candidate media.
  const approved = Object.freeze({
    image: new Set(["night-town", "rain-port", "sakura-pass", "bamboo-maze"]),
    audio: new Set(["night-town"])
  });
  const trial = Object.freeze({
    image: new Set(["hyakki-kyoto", "snow-temple", "spirit-ferry"]),
    audio: new Set(["rain-port", "sakura-pass", "bamboo-maze", "hyakki-kyoto", "snow-temple", "spirit-ferry"])
  });
  const devTrial = new Set();
  const wordIndex = new Map();
  for (const stage of (root.DELIVERY_LEXICON?.stages || []).slice(0, 7)) {
    stage.words.forEach((word, i) => wordIndex.set(word.jp, Object.freeze({stage: stage.id, index: i + 1})));
  }
  const indexName = index => String(index).padStart(2, "0");
  function pathFor(kind, stage, index) {
    const def = kinds[kind];
    if (!def || !stageIds.includes(stage)
      || !Number.isInteger(index) || index < 1 || index > 20) return null;
    const isLab = root.DEV_MODE?.isStageLab?.(root.location) === true;
    if (!(approved[kind].has(stage) || trial[kind].has(stage) || devTrial.has(stage) && isLab)) return null;
    if (stage === "bamboo-maze" && root.CONTENT?.getStage?.(stage)?.mapReleased !== true
      && !isLab) return null;
    return "assets/" + def.folder + "/delivery/" + stage + "/" + indexName(index) + "." + def.ext;
  }
  const entryFor = jp => wordIndex.get(jp) || null;
  const pathForWord = (kind, jp) => {
    const entry = entryFor(jp);
    return entry ? pathFor(kind, entry.stage, entry.index) : null;
  };
  root.DELIVERY_MEDIA = Object.freeze({
    stageIds, indexName, entryFor, pathFor, pathForWord,
    isApproved: (kind, stage) => !!approved[kind]?.has(stage),
    isTrial: (kind, stage) => !!kinds[kind] && (trial[kind].has(stage) || devTrial.has(stage))
  });
})();
