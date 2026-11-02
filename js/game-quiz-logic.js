// Pure Japanese answer-choice construction extracted from game.js (Phase 1).
// No access to player state, stage runtime, localStorage, DOM, or globals beyond window export.
window.GAME_QUIZ_LOGIC = (() => {
  const writtenLength = text => Array.from(String(text || "").normalize("NFC")).length;
  const kanaScript = text => {
    const chars = Array.from(String(text || ""));
    if (chars.length && chars.every(ch => /[ぁ-ゖー]/u.test(ch))) return "hiragana";
    if (chars.length && chars.every(ch => /[ァ-ヺー]/u.test(ch))) return "katakana";
    return "mixed";
  };
  function answerChoices(word, { districtWords, allWords, extraWords, shuffle }) {
    const seen = new Set([word.jp]), distractors = [];
    const targetLength = writtenLength(word.jp);
    const targetScript = kanaScript(word.jp);
    const source = [
      ...districtWords,
      ...allWords,
      ...extraWords
    ];
    const candidates = shuffle(source).filter(w => w && !seen.has(w.jp) && writtenLength(w.jp) === targetLength);
    const take = pool => {
      const w = pool.find(candidate => !seen.has(candidate.jp));
      if (!w) return false;
      seen.add(w.jp);
      distractors.push(w);
      return true;
    };

    // 優先保留一個同文字系的近似項，再混入另一文字系，避免字數或平／片假名成為答案提示。
    if (targetScript === "hiragana" || targetScript === "katakana") {
      take(candidates.filter(w => kanaScript(w.jp) === targetScript));
      take(candidates.filter(w => {
        const script = kanaScript(w.jp);
        return script !== targetScript && (script === "hiragana" || script === "katakana");
      }));
    }
    while (distractors.length < 2 && take(candidates)) {}
    if (distractors.length < 2) {
      // 未來詞包缺少同長度詞時仍使用真實且不重複的詞，不中斷當局。
      while (distractors.length < 2 && take(shuffle(source).filter(w => w && w.jp))) {}
    }
    return shuffle([word, ...distractors]);
  }
  return Object.freeze({ writtenLength, kanaScript, answerChoices });
})();
