// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;
// Bump when replacing audio assets so deployed browser caches fetch the new clips.
window.audioAsset = path => `${path}?v=20261003-3`;

const ASSET_NAMES = [
  "player", "player_walk1", "player_walk2", "ghost", "mis", "boss", "runner", "tank", "shooter", "cover",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground"
];
let loadedCount = 0;
const markSettled = () => {
  loadedCount++;
  if (loadedCount >= ASSET_NAMES.length) window.ART_READY = true;
};

ASSET_NAMES.forEach(n => {
  const img = new Image();
  img.onload = () => {
    ART[n] = img;
    markSettled();
  };
  img.onerror = () => {
    console.warn(`[Assets] 圖片 assets/img/${n}.png (或 .jpg) 載入失敗，將使用程式繪製備援。`);
    markSettled();
  };
  img.src = (n === "cover") ? "assets/img/cover.jpg" : "assets/img/" + n + ".png";
});

// BGM 背景音樂：遊戲與旅路地圖各自使用獨立循環曲。
// audio.js 會依畫面狀態切換，並在單字發音時暫時降低 BGM 音量。
const MUSIC_VOLUME = 0.27;
const configureMusic = audio => {
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = MUSIC_VOLUME;
  return audio;
};

window.BGM = null;
window.MAP_BGM = null;
try {
  const bgmAudio = configureMusic(new Audio(window.audioAsset("assets/audio/BGM.mp3")));
  bgmAudio.addEventListener("error", () => {
    const fallback = configureMusic(new Audio(window.audioAsset("assets/audio/bgm.mp3")));
    fallback.addEventListener("error", () => {
      window.BGM = null;
    }, { once: true });
    window.BGM = fallback;
  }, { once: true });
  window.BGM = bgmAudio;

  const mapAudio = configureMusic(new Audio(window.audioAsset("assets/audio/MAP.mp3")));
  mapAudio.addEventListener("error", () => {
    window.MAP_BGM = null;
  }, { once: true });
  window.MAP_BGM = mapAudio;
} catch (e) {
  console.log("[Audio] 未檢測到外部 BGM 音訊檔，將使用內建 Web Audio 和風程序化樂器合成。");
}
