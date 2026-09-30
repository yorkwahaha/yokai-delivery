// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;

const ASSET_NAMES = ["player", "ghost", "mis", "boss", "runner", "tank", "shooter", "cover"];
let loadedCount = 0;

ASSET_NAMES.forEach(n => {
  const img = new Image();
  img.onload = () => {
    ART[n] = img;
    loadedCount++;
    if (loadedCount >= ASSET_NAMES.length) {
      window.ART_READY = true;
    }
  };
  img.onerror = () => {
    console.warn(`[Assets] 圖片 assets/img/${n}.png (或 .jpg) 載入失敗，將使用高品質程式程序化繪製備援。`);
  };
  img.src = (n === "cover") ? "assets/img/cover.jpg" : "assets/img/" + n + ".png";
});

window.BGM = null;
try {
  const bgmAudio = new Audio("assets/audio/bgm.mp3");
  bgmAudio.loop = true;
  bgmAudio.volume = 0.45;
  bgmAudio.addEventListener("canplaythrough", () => {
    window.BGM = bgmAudio;
  }, { once: true });
} catch (e) {
  // 自動退回 Web Audio 程序化音樂
}
