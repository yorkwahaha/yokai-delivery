// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;
window.ART_PROGRESS = { settled: 0, total: 1, failed: 0 };
// Bump when replacing audio assets so deployed browser caches fetch the new clips.
window.audioAsset = path => `${path}?v=20261003-3`;

const GAME_ASSET_NAMES = [
  "player", "player_walk1", "player_walk2", "ghost", "mis", "boss", "runner", "tank", "shooter",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground", "ground_dirt",
  "ghost_motion_v1", "runner_motion_v1", "boss_motion_v1", "mis_motion_v1", "tank_motion_v1", "shooter_motion_v1",
  "player_dash_v1", "player_win_v1", "player_kneel_v1", "map_night_town_v1", "map_rain_port_v1", "overworld_night_v2"
];
let loadedCount = 0;
const markSettled = (failed = false) => {
  loadedCount++;
  window.ART_PROGRESS.settled = loadedCount;
  if (failed) window.ART_PROGRESS.failed++;
  if (loadedCount >= GAME_ASSET_NAMES.length + 1) window.ART_READY = true;
};

function loadArt(n) {
  const img = new Image();
  img.fetchPriority = n === "cover" ? "high" : "low";
  img.decoding = "async";
  img.onload = () => {
    ART[n] = img;
    markSettled();
  };
  img.onerror = () => {
    img.onerror = () => {
      console.warn(`[Assets] 圖片 ${n} 載入失敗，將使用程式繪製備援。`);
      markSettled(true);
    };
    img.src = `assets/img/${n}.${n === "cover" ? "jpg" : "png"}`;
  };
  img.src = `assets/img/${n}.webp`;
}

function loadHudLanternArt() {
  const img = new Image();
  img.fetchPriority = "high";
  img.decoding = "async";
  img.onload = () => { ART.hud_lantern_oil = img; };
  img.onerror = () => {
    console.warn("[Assets] HUD 燈籠素材載入失敗，將使用程式繪製備援。");
  };
  img.src = "assets/img/ui/hud_lantern_oil.png";
}

function loadHudRadarArt() {
  const img = new Image();
  img.fetchPriority = "high";
  img.decoding = "async";
  img.onload = () => { ART.hud_radar_frame = img; };
  img.onerror = () => {
    console.warn("[Assets] HUD 雷達外框素材載入失敗，將使用程式繪製備援。");
  };
  img.src = "assets/img/ui/hud_radar_frame.png?v=20261006-radar2";
}

function loadHudOmamoriArt() {
  const img = new Image();
  img.fetchPriority = "high";
  img.decoding = "async";
  img.onload = () => { ART.hud_omamori_hint_listen = img; };
  img.onerror = () => {
    console.warn("[Assets] HUD 御守素材載入失敗，將使用程式繪製備援。");
  };
  img.src = "assets/img/ui/hud_omamori_hint_listen.png?v=20261006-omamori1";
}

function loadHudSkillFanArt() {
  const img = new Image();
  img.fetchPriority = "high";
  img.decoding = "async";
  img.onload = () => { ART.hud_skill_fan = img; };
  img.onerror = () => {
    console.warn("[Assets] HUD 摺扇素材載入失敗，將使用程式繪製備援。");
  };
  img.src = "assets/img/ui/hud_skill_fan.png?v=20261006-fan1";
}

// 首頁只載入封面；進入旅路或遊戲才下載角色、敵人與場景。
loadArt("cover");
let gameArtStarted = false;
window.loadGameArt = () => {
  if (gameArtStarted) return;
  gameArtStarted = true;
  window.ART_PROGRESS.total = GAME_ASSET_NAMES.length + 1;
  loadHudLanternArt();
  loadHudRadarArt();
  loadHudOmamoriArt();
  loadHudSkillFanArt();
  GAME_ASSET_NAMES.forEach(loadArt);
};

// BGM 背景音樂：遊戲與旅路地圖各自使用獨立循環曲。
// audio.js 會依畫面狀態切換，並在單字發音時暫時降低 BGM 音量。
const MUSIC_VOLUME = 0.27;
const configureMusic = audio => {
  audio.loop = true;
  audio.preload = "none";
  audio.volume = MUSIC_VOLUME;
  return audio;
};

window.BGM = null;
window.MAP_BGM = null;
try {
  const bgmAudio = configureMusic(new Audio(window.audioAsset("assets/audio/BGM.mp3")));
  bgmAudio.addEventListener("error", () => {
    window.BGM = null;
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
