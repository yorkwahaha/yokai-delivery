// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;
window.MAP_ART_READY = false;
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
const MAP_ASSET_NAMES = ["player", "map_night_town_v1", "map_rain_port_v1", "overworld_night_v2", "prop_sakura", "prop_torii"];
const CORE_ASSET_NAMES = ["player", "ghost", "mis", "boss", "runner", "tank", "shooter",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground", "ground_dirt"];
const HUD_ASSET_NAMES = ["hud_lantern_oil", "hud_radar_frame", "hud_omamori_hint_listen", "hud_skill_fan"];
const requestedArt = new Set(), settledArt = new Set(), failedArt = new Set();
let gameArtStarted = false, mapArtStarted = false, coreArtStarted = false;
let progressNames = ["cover"], backgroundKey = null, backgroundVfxStarted = false;
const backgroundNames = GAME_ASSET_NAMES.filter(key => !CORE_ASSET_NAMES.includes(key));
const requestArt = key => {
  if (requestedArt.has(key)) return false;
  requestedArt.add(key);
  return true;
};
const updateReadiness = () => {
  window.ART_PROGRESS = {total:progressNames.length,settled:progressNames.filter(key=>settledArt.has(key)).length,
    failed:progressNames.filter(key=>failedArt.has(key)).length};
  window.MAP_ART_READY = ["cover", ...MAP_ASSET_NAMES].every(key => settledArt.has(key));
  window.ART_READY = gameArtStarted && ["cover", ...CORE_ASSET_NAMES, ...HUD_ASSET_NAMES].every(key=>settledArt.has(key));
};
const markSettled = (key, failed = false) => {
  if (settledArt.has(key)) return;
  settledArt.add(key);
  if (failed) failedArt.add(key);
  if (key === backgroundKey) backgroundKey = null;
  updateReadiness();
  if (mapArtStarted && window.MAP_ART_READY) preloadCoreArt();
  loadBackgroundArt();
};

function loadArt(n, priority = "high") {
  if (!requestArt(n)) return;
  const img = new Image();
  img.fetchPriority = priority;
  img.decoding = "async";
  img.onload = () => {
    ART[n] = img;
    markSettled(n);
    if (n === "cover" && !gameArtStarted && !mapArtStarted) window.loadMapArt();
  };
  img.onerror = () => {
    img.onerror = () => {
      console.warn(`[Assets] 圖片 ${n} 載入失敗，將使用程式繪製備援。`);
      markSettled(n, true);
    };
    img.src = `assets/img/${n}.${n === "cover" ? "jpg" : "png"}`;
  };
  img.src = SCENERY_ASSET_KEYS.has(n)
    ? `assets/img/scenery/${n}.webp?v=20261010-loading3`
    : YOKAI_ASSET_KEYS.has(n)
    ? `assets/img/yokai/${n}.webp?v=20261010-loading2`
    : `assets/img/${n}.webp?v=${["cover","player_win_v1","player_kneel_v1"].includes(n)?"20261010-character-set1":n.startsWith('map_')?"20261010-loading3":"20261010-loading2"}`;
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

function loadHudArt(key) {
  if (!requestArt(key)) return;
  const img = new Image();
  img.fetchPriority = 'high';
  img.decoding = 'async';
  img.onload = () => { ART[key] = img; markSettled(key); };
  img.onerror = () => {
    img.onerror = () => { console.warn(`[Assets] ${key} 載入失敗。`); markSettled(key, true); };
    img.src = `assets/img/ui/${key}.png`;
  };
  img.src = `assets/img/ui/${key}.webp?v=20261010-loading3`;
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
  img.fetchPriority = id === "katana" && rank === 1 ? "high" : "low";
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

// 封面完成才準備旅路；旅路完成後預先下載開局正式美術。
loadArt("cover");
window.loadMapArt = () => {
  mapArtStarted = true;
  progressNames = ["cover", ...MAP_ASSET_NAMES];
  MAP_ASSET_NAMES.forEach(key=>loadArt(key));
  updateReadiness();
  if (window.MAP_ART_READY) preloadCoreArt();
};
function preloadCoreArt() {
  if (coreArtStarted) return;
  coreArtStarted = true;
  HUD_ASSET_NAMES.forEach(loadHudArt);
  CORE_ASSET_NAMES.forEach(key=>loadArt(key));
  window.skillVfxArt("katana", 1);
}
window.loadGameArt = () => {
  gameArtStarted = true;
  progressNames = ["cover", ...CORE_ASSET_NAMES, ...HUD_ASSET_NAMES];
  preloadCoreArt();
  updateReadiness();
  loadBackgroundArt();
};
function loadBackgroundArt() {
  if (!window.ART_READY || backgroundKey) return;
  // 動作與結果圖不擋開局，仍有正式靜態角色；背景每次只下載一張。
  while (backgroundNames.length && requestedArt.has(backgroundNames[0])) backgroundNames.shift();
  if (backgroundNames.length) {
    backgroundKey = backgroundNames.shift();
    loadArt(backgroundKey, "low");
    return;
  }
  if (backgroundVfxStarted) return;
  backgroundVfxStarted = true;
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
}

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
