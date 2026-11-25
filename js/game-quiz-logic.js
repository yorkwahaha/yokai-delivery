// Pure Japanese answer-choice construction extracted from game.js (Phase 1).
// No access to player state, stage runtime, localStorage, DOM, or globals beyond window export.
window.GAME_QUIZ_LOGIC = (() => {
  const writtenLength = text => Array.from(String(text || "").normalize("NFC")).length;
  const kanaScript = text => {
    const chars = Array.from(String(text || "").normalize("NFC"));
    if (chars.length && chars.every(ch => /[ぁ-ゖー]/u.test(ch))) return "hiragana";
    if (chars.length && chars.every(ch => /[ァ-ヺー]/u.test(ch))) return "katakana";
    return "mixed";
  };
  const kanaMarks = text => [
    /ー/u.test(text),
    /[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]/u.test(text),
    /[\u3099\u309a]/u.test(text.normalize("NFD"))
  ].join("/");
  function answerChoices(word, { districtWords, allWords, extraWords, shuffle, previous }) {
    const seen = new Set([word.jp.normalize("NFC")]);
    const distractors = [];
    const targetLength = writtenLength(word.jp);
    const targetScript = kanaScript(word.jp);
    const targetMarks = kanaMarks(word.jp);
    const sameMarks = [], differentMarks = [], sameScript = [], sameLength = [], other = [];
    for (const w of [...districtWords,...allWords,...extraWords]) {
      if (!w?.jp || (word.zh && w.zh === word.zh)) continue;
      const jp = w.jp.normalize("NFC");
      if (seen.has(jp)) continue;
      seen.add(jp);
      const matchingLength = writtenLength(jp) === targetLength;
      if (kanaScript(jp) === targetScript) {
        if (!matchingLength) sameScript.push(w);
        else (kanaMarks(jp) === targetMarks ? sameMarks : differentMarks).push(w);
      } else {
        (matchingLength ? sameLength : other).push(w);
      }
    }
    // All released prompts have enough exact matches. Sparse future packs
    // still get real, unique choices with same-script words used first.
    for (const pool of [sameMarks,differentMarks,sameScript,sameLength,other]) {
      if (distractors.length === 2) break;
      if (!pool.length) continue;
      const draw = shuffle(pool);
      if (!distractors.length && draw.length >= 3 && previous?.includes(draw[0].jp) && previous.includes(draw[1].jp)) {
        draw[1] = draw[2];
      }
      distractors.push(...draw.slice(0,2-distractors.length));
    }
    return shuffle([word, ...distractors]);
  }
  return Object.freeze({ writtenLength, kanaScript, answerChoices });
})();
