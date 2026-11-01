// Approved delivery voice playback route. Providers/voices remain metadata, never runtime filenames.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  // The user chose the A recording; retired B/C trial variants remain in the review archive.
  const KEY = "yokai-delivery-fish-voice-v3";
  const VOICE_IDS = Object.freeze({a: "97eda32449cf443bbc4b8782853ca554"});
  let cached = null;
  function selectedVoice() {
    try {
      const param = new URLSearchParams(root.location?.search || "").get("fishVoice");
      if (param === "google" || param === "a") {
        cached = param;
        try {root.localStorage?.setItem(KEY, param);} catch (_) {}
        return param;
      }
    } catch (_) {}
    try {
      const saved = root.localStorage?.getItem(KEY);
      if (saved === "a" || saved === "google") return saved;
    } catch (_) {}
    return cached || "a";
  }
  function pathFor(jp) {
    if (selectedVoice() === "google") return null;
    // No staging or provider-specific folders are ever returned to the game.
    return root.DELIVERY_MEDIA?.pathForWord?.("audio", jp) || null;
  }
  function forceJapaneseTTS(jp) {
    return !!root.DELIVERY_MEDIA?.pathForWord?.("audio", jp) && selectedVoice() === "google";
  }
  root.DELIVERY_FISH_AUDIO = Object.freeze({
    selectedVoice, pathFor, forceJapaneseTTS, voiceIds: VOICE_IDS,
    availableWords: () => (root.DELIVERY_LEXICON?.stages || [])
      .flatMap(stage => stage.words.map(word => word.jp))
      .filter(jp => !!root.DELIVERY_MEDIA?.pathForWord?.("audio", jp))
  });
})();
