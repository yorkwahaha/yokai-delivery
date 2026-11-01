// 宅配貨物共通圖片路由：正式核准圖優先；本機 dev 可預覽未核准的水墨候選。
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const DEFAULT_WORD_ART = Object.freeze({
    "ほん":"hon","さかな":"sakana","たこ":"tako","おにぎり":"onigiri",
    "さくら":"sakura","はな":"sakura","かさ":"kasa",
    "おちゃ":"ocha","ふね":"fune","りんご":"ringo"
  });
  const imageCache = new Map();
  const REPAINTED_NIGHT = new Set(["しんぶん","えんぴつ","けしゴム","じょうぎ","かみ","はブラシ","せっけん"]);
  const REPAINTED_NIGHT_V4 = new Set(["しんぶん","けしゴム","じょうぎ","かみ","はブラシ","せっけん"]);
  const REPAINTED_PORT = new Set(["さかな","さけ","まぐろ","さば","たい","いか","かい","すし","さしみ","やきざかな","おにぎり","てんぷら"]);
  const stageWords = new Map();
  for (const stage of root.DELIVERY_LEXICON?.stages || []) {
    stage.words.forEach((w,i) => stageWords.set(stage.id+"|"+w.jp,{stage:stage.id,index:i+1}));
  }
  const devEnabled = () => {
    const loc = root.location;
    if (!loc || !root.DEV_MODE?.isDevMode?.(loc)) return false;
    try {return new URLSearchParams(loc.search).get("deliveryArt") === "1"; }
    catch (_) {return false;}
  };
  function pathFor(word) {
    if (!word || !word.jp) return null;
    const originalStage = word.packId?.match(/^delivery-(.+)-\d+$/)?.[1];
    const entry = stageWords.get(originalStage+"|"+word.jp);
    // Only the shared delivery-media registry can authorize a production art path.
    const approved = root.DELIVERY_MEDIA?.pathFor?.("image", entry?.stage, entry?.index);
    if (approved) return approved;
    if (devEnabled()) {
      if (entry) {
        const latest = (entry.stage === "night-town" && REPAINTED_NIGHT.has(word.jp)) ||
          (entry.stage === "rain-port" && REPAINTED_PORT.has(word.jp));
        const preservedCleanPort = entry.stage === "rain-port" && !latest;
        const folder = entry.stage === "night-town" && REPAINTED_NIGHT_V4.has(word.jp)
          ? "rerender-original-style-v4/selected/"
          : latest ? "rerender-original-style-v3/" : preservedCleanPort ? "rerender-qwen-v2/" : "";
        return "art/delivery-icons/"+entry.stage+"/"+folder+
          String(entry.index).padStart(2,"0")+"_"+encodeURIComponent(word.jp)+"_candidate.webp";
      }
    }
    const filename = DEFAULT_WORD_ART[word.jp];
    return filename ? "assets/img/words/"+filename+".webp" : null;
  }
  function imageFor(word) {
    const path = pathFor(word);
    if (!path || typeof root.Image !== "function") return null;
    let entry = imageCache.get(path);
    if (!entry) {
      const image = new root.Image();
      entry = {image,ready:false,failed:false};
      imageCache.set(path,entry);
      image.onload = () => { entry.ready = image.naturalWidth > 0; };
      image.onerror = () => { entry.failed = true; };
      image.decoding = "async";
      image.src = path;
    }
    return entry.ready ? entry.image : null;
  }
  root.DELIVERY_ICON_ART = Object.freeze({imageFor,pathFor,devEnabled});
})();
