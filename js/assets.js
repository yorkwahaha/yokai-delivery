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
// 第二階段正式場景圖獨立放置；舊版 PNG 僅在 WebP 無法解碼時備援。
const SCENERY_ASSET_KEYS = new Set([
  "house_shop", "house_tavern", "house_shrine", "prop_torii",
  "prop_sakura", "prop_lantern", "ground", "ground_dirt"
]);
// 第二刀：六類妖怪的靜態與動作素材共享木版畫色板；原 PNG 保留作備援。
const YOKAI_ASSET_KEYS = new Set([
  "ghost", "runner", "tank", "shooter", "mis", "boss",
  "ghost_motion_v1", "runner_motion_v1", "tank_motion_v1",
  "shooter_motion_v1", "mis_motion_v1", "boss_motion_v1"
]);
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
  img.src = SCENERY_ASSET_KEYS.has(n)
    ? `assets/img/scenery/${n}.webp?v=20261008-scene2`
    : YOKAI_ASSET_KEYS.has(n)
    ? `assets/img/yokai/${n}.webp?v=20261009-ink1`
    : `assets/img/${n}.webp${["cover","player_win_v1","player_kneel_v1"].includes(n)?"?v=20261010-character-set1":""}`;
}

// 休息立繪只會在打開暫停選單時下載，不佔遊戲首屏載入預算。
let pauseRestRequested = false;
window.loadPauseRestArt = function loadPauseRestArt() {
  if (pauseRestRequested || window.ART?.player_rest_v1) return;
  pauseRestRequested = true;
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => { window.ART.player_rest_v1 = img; };
  img.onerror = () => {
    console.warn("[Assets] 休息角色未載入，暫停畫面仍可正常使用。");
  };
  img.src = "assets/img/player_rest_v1.webp?v=20261010-character-set1";
};

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

function loadSkillVfxArt(key, file) {
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => { ART[key] = img; };
  img.onerror = () => {
    img.onerror = () => {
      console.warn(`[Assets] 技能特效素材 ${key} 載入失敗，將使用 Canvas 備援。`);
    };
    img.src = `assets/img/vfx/${key}.svg?v=20261007-vfx2`;
  };
  img.src = `assets/img/vfx/raster/${file}.webp?v=20261007-raster1`;
}

function loadDragonVfxArt() {
  for(const key of ["dragon_fireball_l5","dragon_burning_ground_l5"]) {
    const img=new Image();
    img.fetchPriority="low";img.decoding="async";
    img.onload=()=>{ ART[key]=img; };
    img.onerror=()=>{ console.warn("[Assets] Missing dragon art: "+key); };
    img.src="assets/img/vfx/raster/"+key+".webp?v=20261009-dragon1";
  }
}
const SKILL_LEVEL_FILES = Object.freeze({
  katana: Object.freeze(["katana_l1", "katana_l2", "katana_l3", "katana_l4", "katana_l5"]),
  barrier: Object.freeze(["barrier_l1", "barrier_l2", "barrier_l3", "barrier_l4", "barrier_l5"]),
  needle: Object.freeze(["needle_l1", "needle_l2", "needle_l3", "needle_l4", "needle_l5"]),
  boom: Object.freeze(["boom_l1", "boom_l2", "boom_l3", "boom_l4", "boom_l5"]),
  fire: Object.freeze(["fire_l1", "fire_l2", "fire_l3", "fire_l4", "fire_l5"]),
  thunder: Object.freeze(["thunder_l1", "thunder_l2", "thunder_l3", "thunder_l4", "thunder_l5"])
});
const SKILL_VARIANT_FILES = Object.freeze({
  fire: Object.freeze({
    orbit: Object.freeze(["fire_orbit_l1", "fire_orbit_l2", "fire_orbit_l3", "fire_orbit_l4", "fire_orbit_l5"]),
    attack: Object.freeze(["fire_attack_l1", "fire_attack_l2", "fire_attack_l3", "fire_attack_l4", "fire_attack_l5"]),
    dragon: Object.freeze([null, null, null, null, "fire_dragon_l5"])
  })
});
const skillLevelLoads = new Map();
const skillRank = level => Math.max(1, Math.min(5, Math.floor(level) || 1));
window.SKILL_LEVEL_FILES = SKILL_LEVEL_FILES;
window.SKILL_VARIANT_FILES = SKILL_VARIANT_FILES;
window.skillVfxKey = (id, level) => SKILL_LEVEL_FILES[id] ? id + "_l" + skillRank(level) : null;
window.skillVfxFile = (id, level) => SKILL_LEVEL_FILES[id]?.[skillRank(level) - 1] || null;
window.skillVfxArt = (id, level) => {
  const rank = skillRank(level), file = window.skillVfxFile(id, rank), key = window.skillVfxKey(id, rank);
  if (!file || !key) return null;
  const ready = ART[key];
  if (ready?.naturalWidth > 0 && ready?.naturalHeight > 0) return ready;
  if (skillLevelLoads.has(key)) return null;
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => { ART[key] = img; skillLevelLoads.set(key, "ready"); };
  img.onerror = () => { skillLevelLoads.set(key, "missing"); };
  skillLevelLoads.set(key, "loading");
  img.src = "assets/img/vfx/raster/" + file + ".webp?v=20261007-skilltiers1";
  return null;
};
window.skillVfxVariantKey = (id, variant, level) => SKILL_VARIANT_FILES[id]?.[variant]?.[skillRank(level) - 1] || null;
window.skillVfxVariantArt = (id, variant, level) => {
  const file = window.skillVfxVariantKey(id, variant, level), key = file;
  if (!file || !key) return null;
  const ready = ART[key];
  if (ready?.naturalWidth > 0 && ready?.naturalHeight > 0) return ready;
  if (skillLevelLoads.has(key)) return null;
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => { ART[key] = img; skillLevelLoads.set(key, "ready"); };
  img.onerror = () => { skillLevelLoads.set(key, "missing"); };
  skillLevelLoads.set(key, "loading");
  img.src = "assets/img/vfx/raster/" + file + ".webp?v=20261008-firevariants1";
  return null;
};

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
  loadSkillVfxArt("katana_wave_ukiyoe", "katana");
  loadSkillVfxArt("barrier_mandala_ukiyoe", "barrier_ground_45");
  loadSkillVfxArt("needle_hama_ukiyoe", "needle");
  loadSkillVfxArt("needle_ice_ukiyoe", "needle");
  loadSkillVfxArt("ofuda_ukiyoe", "ofuda");
  loadSkillVfxArt("taiji_ofuda_ukiyoe", "ofuda");
  loadSkillVfxArt("foxfire_ukiyoe", "foxfire");
  loadSkillVfxArt("foxfire_dragon_ukiyoe", "foxfire_dragon");
  loadDragonVfxArt();
  loadSkillVfxArt("thunder_ukiyoe", "thunder_strike");
  loadSkillVfxArt("thunder_drum_ukiyoe", "thunder_cloud_45");
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
