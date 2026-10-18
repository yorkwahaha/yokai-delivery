// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;
window.MAP_ART_READY = false;
window.ART_PROGRESS = { settled: 0, total: 1, failed: 0 };
// Bump when replacing audio assets so deployed browser caches fetch the new clips.
window.audioAsset = path => `${path}?v=${path.startsWith("assets/audio/words/") ? "20261018-m11-voice" : "20261013-boss-mobile2"}`;

const GAME_ASSET_NAMES = [
  "player", "player_walk1", "player_walk2",
  "player_idle_v2", "player_walk_left_v2", "player_walk_right_v2", "player_dash_v2", "player_hurt_v2", "player_attack_v2",
  "ghost", "mis", "boss", "runner", "tank", "shooter",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground", "ground_dirt",
  "ghost_motion_v1", "runner_motion_v1", "boss_motion_v1", "mis_motion_v1", "tank_motion_v1", "shooter_motion_v1",
  "player_dash_v1", "player_win_v1", "player_kneel_v1", "map_night_town_v1", "map_rain_port_v1", "overworld_approved_v2"
];
// 新版主角動作圖皆為非關卡必要資產：進入遊戲後背景預載，舊版 Sprite 可即時備援。
const PLAYER_ACTION_ART = Object.freeze([
  "player_idle_v2", "player_walk_left_v2", "player_walk_right_v2", "player_dash_v2",
  "player_hurt_v2", "player_attack_v2"
]);
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
// A4 選定純地景版優先下載；舊版只在失敗時啟動備援，避免平板手機同時下載兩張大地圖。
// 僅旅路地圖所需資產：overworld 地圖 + 玩家 + 共用道具。關卡地圖在 start() 時再載。
const OVERWORLD_MAP_ASSET_NAMES = ["player", "overworld_approved_v2", "prop_sakura", "prop_torii"];
const STAGE_MAP_ASSET_NAMES = ["map_night_town_v1", "map_rain_port_v1"];
const MAP_ASSET_NAMES = [...OVERWORLD_MAP_ASSET_NAMES, ...STAGE_MAP_ASSET_NAMES];
const CORE_ASSET_NAMES = ["player", "ghost", "mis", "boss", "runner", "tank", "shooter",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground", "ground_dirt"];
const HUD_ASSET_NAMES = ["hud_lantern_oil", "hud_radar_frame", "hud_omamori_hint_listen", "hud_skill_fan"];

// 八關資產插槽定義（資料導向，審圖通過後只要換映射即可，不改引擎）
// 每關包含：地面、場景/建築/裝飾/地標、專屬敵人 idle/attack、Boss idle/attack
// 缺圖時回落現役共用資產，標記 WAITING_ART；未核准候選不接 production
const STAGE_ASSET_SLOTS = Object.freeze({
  "night-town": Object.freeze({
    map: "map_night_town_v1",
    ground: "ground_dirt",
    scene: ["house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura"],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "rain-port": Object.freeze({
    map: "map_rain_port_v1",
    ground: "ground",
    scene: ["port_warehouse", "prop_mooring_post", "prop_port_lighthouse", "prop_cargo_crates", "prop_port_boat", "prop_anchor_gear", "vfx_rain_splash_ripple"],
    trans: ["ground_stone_wood_transition_v2", "ground_trans_stone_wood_h", "ground_trans_stone_wood_v", "ground_stone_var1", "ground_stone_var2", "ground_wood_dock_var1", "ground_wood_dock_var2"],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      shiome: { idle: "minion_shiome_idle", attack: "minion_shiome_attack" },
      boss: { idle: "boss_ikari_umibozu_idle", attack: "boss_ikari_umibozu_attack" }
    }
  }),
  "sakura-pass": Object.freeze({
    map: "map_sakura_pass_v1",
    ground: "ground_dirt",
    scene: ["shrine_pavilion", "landmark_corrupted_sakura"],
    trans: ["ground_trans_dirt_to_steps_h", "ground_sakura_steps"],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "bamboo-maze": Object.freeze({
    map: "map_bamboo_maze_v1",
    ground: "ground",
    scene: [],
    trans: [],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "hyakki-kyoto": Object.freeze({
    map: "map_hyakki_kyoto_v1",
    ground: "ground_dirt",
    scene: [],
    trans: [],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "snow-temple": Object.freeze({
    map: "map_snow_temple_v1",
    ground: "ground",
    scene: [],
    trans: [],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "spirit-ferry": Object.freeze({
    map: "map_spirit_ferry_v1",
    ground: "ground_dirt",
    scene: [],
    trans: [],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  }),
  "yomi": Object.freeze({
    map: "map_yomi_v1",
    ground: "ground",
    scene: [],
    trans: [],
    enemy: {
      ghost: { idle: "ghost", attack: "ghost_motion_v1" },
      runner: { idle: "runner", attack: "runner_motion_v1" },
      tank: { idle: "tank", attack: "tank_motion_v1" },
      shooter: { idle: "shooter", attack: "shooter_motion_v1" },
      mis: { idle: "mis", attack: "mis_motion_v1" },
      boss: { idle: "boss", attack: "boss_motion_v1" }
    }
  })
});

// 追蹤各關 WAITING_ART 狀態（供外部查詢）
window.STAGE_ART_STATUS = {};

const requestedArt = new Set(), settledArt = new Set(), failedArt = new Set();
let gameArtStarted = false, mapArtStarted = false, coreArtStarted = false;
let progressNames = ["cover"], backgroundKey = null;
const activeSkillArt = new Map([["katana", ["katana_l1"]]]);
const gameAssetNames = () => ["cover", ...CORE_ASSET_NAMES, ...HUD_ASSET_NAMES, ...new Set([...activeSkillArt.values()].flat())];
const backgroundNames = GAME_ASSET_NAMES.filter(key => !CORE_ASSET_NAMES.includes(key));
const requestArt = key => {
  if (requestedArt.has(key)) return false;
  requestedArt.add(key);
  return true;
};
const updateReadiness = () => {
  window.ART_PROGRESS = {total:progressNames.length,settled:progressNames.filter(key=>settledArt.has(key)).length,
    failed:progressNames.filter(key=>failedArt.has(key)).length};
  window.MAP_ART_READY = ["cover", ...OVERWORLD_MAP_ASSET_NAMES].every(key => settledArt.has(key));
  window.ART_READY = gameArtStarted && gameAssetNames().every(key=>settledArt.has(key));
};
const markSettled = (key, failed = false) => {
  if (settledArt.has(key)) return;
  settledArt.add(key);
  if (failed) failedArt.add(key);
  if (key === backgroundKey) backgroundKey = null;
  updateReadiness();
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
    if (n === "overworld_approved_v2") {
      console.warn("[Assets] 新旅路地圖無法下載，使用舊版地圖備援。");
      markSettled(n, true);
      loadArt("overworld_ukiyoe_v3", "low");
      return;
    }
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
    : `assets/img/${n}.webp?v=${PLAYER_ACTION_ART.includes(n)?"20261011-character-v3":["cover","player_win_v1","player_kneel_v1"].includes(n)?"20261010-character-set1":n==="overworld_approved_v2"?"20261012-approved-v2-4k":n==="overworld_ukiyoe_v3"?"20261011-ukiyoe-v3":n.startsWith('map_')?"20261010-loading3":"20261010-loading2"}`;
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
const SKILL_LEVEL_FILES = Object.freeze({
  katana: Object.freeze(["katana_l1", "katana_l2", "katana_l3", "katana_l4", "katana_l5"]),
  barrier: Object.freeze(Array(5).fill("barrier_ground_45")),
  needle: Object.freeze(Array(5).fill("needle")),
  boom: Object.freeze(Array(5).fill("ofuda")),
  fire: Object.freeze(["fire_orbit_l1", "fire_orbit_l2", "fire_orbit_l3", "fire_orbit_l4", "fire_orbit_l5"]),
  thunder: Object.freeze(["thunder_strike", "thunder_strike", "thunder_strike", "thunder_strike", "thunder_cloud_45"])
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
window.skillVfxKey = (id, level) => SKILL_LEVEL_FILES[id]?.[skillRank(level) - 1] || null;
window.skillVfxFile = (id, level) => SKILL_LEVEL_FILES[id]?.[skillRank(level) - 1] || null;
function loadSkillImage(key, file, version) {
  if (!file || !key) return null;
  const ready = ART[key];
  if (ready?.naturalWidth > 0 && ready?.naturalHeight > 0) return ready;
  if (skillLevelLoads.has(key)) return null;
  const img = new Image();
  img.fetchPriority = "high";
  img.decoding = "async";
  img.onload = () => { ART[key] = img; skillLevelLoads.set(key, "ready"); markSettled(key); };
  img.onerror = () => { skillLevelLoads.set(key, "missing"); markSettled(key, true); };
  skillLevelLoads.set(key, "loading");
  img.src = "assets/img/vfx/raster/" + file + ".webp?v=" + version;
  return null;
}
window.skillVfxArt = (id, level) => loadSkillImage(window.skillVfxKey(id, level), window.skillVfxFile(id, level), "20261007-skilltiers1");
// Barrier images remain on-demand: neither image belongs to first-screen assets.
const BARRIER_RASTER_FILES = Object.freeze({
  barrier_core_main: "assets/img/vfx/purification_array_vfx.webp?v=20261012-barrier-tiers1",
  barrier_core_lv5: "assets/img/vfx/purification_array_lv5_vfx.webp?v=20261012-barrier-tiers1"
});
const BARRIER_ART_TIERS = Object.freeze([
  Object.freeze({artKey:"barrier_core_main",scale:0.72,alpha:0.30}),
  Object.freeze({artKey:"barrier_core_main",scale:0.86,alpha:0.50}),
  Object.freeze({artKey:"barrier_core_main",scale:1.00,alpha:0.75}),
  Object.freeze({artKey:"barrier_core_main",scale:1.12,alpha:0.90}),
  Object.freeze({artKey:"barrier_core_lv5",scale:1.18,alpha:0.90})
]);
window.BARRIER_ART_TIERS = BARRIER_ART_TIERS;
window.barrierArtTier = level => BARRIER_ART_TIERS[skillRank(level)-1];
const barrierRasterRequested = new Set();
function requestBarrierRaster(key) {
  const cached = ART[key];
  if (cached?.naturalWidth > 0 && cached?.naturalHeight > 0) return cached;
  if (barrierRasterRequested.has(key)) return null;
  barrierRasterRequested.add(key);
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => {
    // Reject opaque poster-style images; retain the regular/legacy fallback.
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 16;
      const ctx = probe.getContext("2d", {willReadFrequently:true});
      if (!ctx || !img.naturalWidth || !img.naturalHeight) throw Error("invalid image");
      ctx.drawImage(img, 0, 0, 16, 16);
      const rgba = ctx.getImageData(0, 0, 16, 16).data;
      if ([0,15,240,255].every(i => rgba[i*4+3] >= 250))
        throw Error("corners are opaque; transparency required");
      ART[key] = img;
    } catch (error) {
      console.warn("[Assets] Barrier image not accepted; retaining fallback:", key, error.message);
    }
  };
  img.onerror = () => console.warn("[Assets] Barrier image unavailable; retaining fallback:", key);
  img.src = BARRIER_RASTER_FILES[key];
  return null;
}
// Lv5 requests its own artwork and can use the normal image until it is ready.
// If both fail, callers retain their earlier hand-painted fallback.
window.barrierCoreArt = (level=1) => {
  const normal = requestBarrierRaster("barrier_core_main");
  const key = window.barrierArtTier(level).artKey;
  return key === "barrier_core_main" ? normal : requestBarrierRaster(key) || normal;
};

// Lazy on-demand Ofuda art, independent of cover/map/first-play readiness.
const OFUDA_RASTER_FILES = Object.freeze({
  main: "assets/img/vfx/ofuda_projectile.webp?v=20261012-ofuda-raster1",
  hit: "assets/img/vfx/ofuda_hit_burst.webp?v=20261012-ofuda-raster1",
  max: "assets/img/vfx/ofuda_max_burst.webp?v=20261012-ofuda-raster1"
});
const OFUDA_RASTER_KEYS = Object.freeze({
  main: "ofuda_raster_main", hit: "ofuda_raster_hit", max: "ofuda_raster_max"
});
const ofudaRasterRequested = new Set();
window.ofudaRasterArt = kind => {
  const key = OFUDA_RASTER_KEYS[kind], path = OFUDA_RASTER_FILES[kind];
  if (!key || !path) return null;
  const cached = ART[key];
  if (cached?.naturalWidth > 0 && cached?.naturalHeight > 0) return cached;
  if (ofudaRasterRequested.has(key)) return null;
  ofudaRasterRequested.add(key);
  const img = new Image();
  img.fetchPriority = "low";
  img.decoding = "async";
  img.onload = () => {
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 16;
      const ctx = probe.getContext("2d", {willReadFrequently:true});
      if (!ctx || !img.naturalWidth || !img.naturalHeight) throw Error("invalid image");
      ctx.drawImage(img, 0, 0, 16, 16);
      const rgba = ctx.getImageData(0, 0, 16, 16).data;
      if ([0,15,240,255].every(i => rgba[i*4+3] >= 250))
        throw Error("opaque background");
      ART[key] = img;
    } catch(error) {
      console.warn("[Assets] Ofuda image rejected, retaining legacy art:", kind, error.message);
    }
  };
  img.onerror = () => console.warn("[Assets] Ofuda image unavailable, retaining legacy art:", kind);
  img.src = path;
  return null;
};

// On-demand thunder PNGs; excluded from cover/map/core readiness.
const THUNDER_PNGS=Object.freeze({
 cloud:"thunder_cloud_vfx.webp",mark:"thunder_sigil_vfx.webp",
 strike:"thunder_strike_vfx.webp",max:"thunder_strike_lv5_vfx.webp"
});
const thunderRequests=new Set();
window.thunderRasterArt=kind=>{
 const file=THUNDER_PNGS[kind],key="thunder_raster_"+kind;
 if(!file)return null;
 if(ART[key]?.naturalWidth>0&&ART[key]?.naturalHeight>0)return ART[key];
 if(thunderRequests.has(kind))return null;
 thunderRequests.add(kind);
 const img=new Image();img.decoding="async";img.fetchPriority="low";
 img.onload=()=>{
  try{
   if(!img.naturalWidth||!img.naturalHeight)throw Error("invalid dimensions");
   const c=document.createElement("canvas");c.width=c.height=32;
   const g=c.getContext("2d",{willReadFrequently:true});
   if(!g)throw Error("no image canvas");
   g.clearRect(0,0,32,32);g.drawImage(img,0,0,32,32);
   const data=g.getImageData(0,0,32,32).data;
   let corners=0,border=0,total=0;
   for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const a=data[(y*32+x)*4+3];
    if((x<3||x>28)&&(y<3||y>28)&&a>220)corners++;
    if(x<2||x>29||y<2||y>29){total++;if(a>180)border++;}
   }
   // Reject pasted poster/checkerboard backgrounds; never show opaque squares.
   if(corners>18||border>total*.55)throw Error("opaque or noisy image margins");
   ART[key]=img;
  }catch(e){console.warn("[Assets] Thunder raster rejected; fallback:",kind,e.message);}
 };
 img.onerror=()=>console.warn("[Assets] Thunder raster missing; fallback:",kind);
 img.src="assets/img/vfx/"+file+"?v=20261012-thunder-raster1";
 return null;
};

window.skillVfxVariantKey = (id, variant, level) => SKILL_VARIANT_FILES[id]?.[variant]?.[skillRank(level) - 1] || null;
window.skillVfxVariantArt = (id, variant, level) => {
  const file = window.skillVfxVariantKey(id, variant, level);
  return loadSkillImage(file, file, "20261008-firevariants1");
};

window.prepareSkillArt = (id, level) => {
  const rank = skillRank(level), key = window.skillVfxKey(id, rank);
  if (!key) return [];
  const keys = [key];window.skillVfxArt(id, rank);
  if (id === "barrier") window.barrierCoreArt?.(rank);
  if (id === "boom") { window.ofudaRasterArt?.("main"); window.ofudaRasterArt?.(rank===5?"max":"hit"); }
  if (id === 'thunder' && rank === 5) {keys.push(window.skillVfxKey(id,4));window.skillVfxArt(id,4);}
  if(id==="thunder")for(const kind of ["cloud","mark",rank===5?"max":"strike"])window.thunderRasterArt?.(kind);
  if (id === 'fire') {
    const variants = ['orbit', ...(rank>=4?['attack']:[]), ...(rank===5?['dragon']:[])];
    for(const variant of variants){keys.push(window.skillVfxVariantKey(id,variant,rank));window.skillVfxVariantArt(id,variant,rank);}
    if(rank===5) for(const file of ['dragon_fireball_l5','dragon_burning_ground_l5']) {keys.push(file);loadSkillImage(file,file,'20261009-dragon1');}
  }
  return [...new Set(keys)];
};
window.useSkillArt = (id, level) => {
  const keys = window.prepareSkillArt(id, level);
  if (!keys.length) return;
  activeSkillArt.set(id,keys);
  if (gameArtStarted) progressNames = gameAssetNames();
  updateReadiness();
};

// 雨夜港町固定檔名。不從清單說明文字猜角色。四張核准圖與道具都走 runtime 目錄，進關才載。
// M15-03 來源註記。下面的 assets/img URL 不變，不載 E_/B_/G_/H_/O_ 檔名。
// 位元組已與 canonical 相同：G_ground_stone、G_ground_wood_dock、H_port_warehouse、H_fishmonger、
// O_prop_mooring_post、O_prop_port_lighthouse、O_prop_cargo_crates、O_prop_port_boat
// （art/stage2-rain-port/scene/）。O_prop_anchor_gear 與現役 prop_anchor_gear.webp 位元組不同，URL 不改。
// 核准 v2 runtime 是 ground_stone_wood_transition_v2.webp，位元組與
// art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp 相同，不覆蓋舊過渡圖。
window.PORT_ART = {};
window.PORT_ART_STATUS = {};
const RAIN_PORT_ASSETS = Object.freeze({
  stone: "assets/img/rain-port/ground_stone.webp",
  dock: "assets/img/rain-port/ground_wood_dock.webp",
  warehouse: "assets/img/rain-port/port_warehouse.webp",
  mooring: "assets/img/rain-port/prop_mooring_post.webp",
  beacon: "assets/img/rain-port/prop_port_lighthouse.webp",
  crate: "assets/img/rain-port/prop_cargo_crates.webp",
  boat: "assets/img/rain-port/prop_port_boat.webp",
  anchor: "assets/img/rain-port/prop_anchor_gear.webp",
  ripple: "assets/img/rain-port/vfx_rain_splash_ripple.webp"
});
const RAIN_PORT_FISH = Object.freeze({
  fishmonger: "assets/img/rain-port/port_fishmonger.webp"
});
const RAIN_PORT_GROUND = Object.freeze({
  stoneVar1: "assets/img/rain-port/ground_stone_var1.webp",
  stoneVar2: "assets/img/rain-port/ground_stone_var2.webp",
  woodVar1: "assets/img/rain-port/ground_wood_dock_var1.webp",
  woodVar2: "assets/img/rain-port/ground_wood_dock_var2.webp",
  transH: "assets/img/rain-port/ground_trans_stone_wood_h.webp",
  transV: "assets/img/rain-port/ground_trans_stone_wood_v.webp",
  stoneWoodV2: "assets/img/rain-port/ground_stone_wood_transition_v2.webp"
});
const portCatalog = () => ({ ...RAIN_PORT_ASSETS, ...RAIN_PORT_FISH, ...RAIN_PORT_GROUND });
const portRequested = new Set();
function loadPortSprites(roles) {
  if (typeof Image !== "function") return;
  const table = portCatalog();
  for (const role of roles || Object.keys(RAIN_PORT_ASSETS)) {
    const url = table[role];
    if (!url || portRequested.has(role)) continue;
    portRequested.add(role);
    window.PORT_ART_STATUS[role] = "loading";
    const img = new Image();
    if (img.dataset) img.dataset.url = url;
    img.fetchPriority = "low";
    img.decoding = "async";
    img.onload = () => {
      window.PORT_ART[role] = img;
      window.PORT_ART_STATUS[role] = "ready";
    };
    img.onerror = () => {
      window.PORT_ART_STATUS[role] = "error";
    };
    img.src = `${url}?v=20261013-rain-port2`;
  }
}
window.PORT_ENEMIES = {};
window.PORT_ENEMY_STATUS = {};
// Canonical：art/stage2-rain-port/characters/ 的 E_shiome_idle、E_shiome_attack、B_ikari_idle、B_ikari_attack。runtime 檔名維持舊名。
const PORT_ENEMY_ASSETS = Object.freeze({
  shiomeIdle: "assets/img/rain-port/enemies/minion_shiome_idle.webp",
  shiomeAttack: "assets/img/rain-port/enemies/minion_shiome_attack.webp",
  bossIdle: "assets/img/rain-port/enemies/boss_ikari_umibozu_idle.webp",
  bossAttack: "assets/img/rain-port/enemies/boss_ikari_umibozu_attack.webp"
});
const portEnemyRequested = new Set();
function loadPortEnemies() {
  if (typeof Image !== "function") return;
  for (const role of Object.keys(PORT_ENEMY_ASSETS)) {
    const url = PORT_ENEMY_ASSETS[role];
    if (portEnemyRequested.has(role)) continue;
    portEnemyRequested.add(role);
    window.PORT_ENEMY_STATUS[role] = "loading";
    const img = new Image();
    if (img.dataset) img.dataset.url = url;
    img.decoding = "async";
    img.onload = () => {
      window.PORT_ENEMIES[role] = img;
      window.PORT_ENEMY_STATUS[role] = "ready";
    };
    img.onerror = () => { window.PORT_ENEMY_STATUS[role] = "error"; };
    img.src = `${url}?v=20261014-stage2-enemies1`;
  }
}
window.refreshPortArt = () => {
  loadPortSprites(Object.keys(portCatalog()));
  loadPortEnemies();
};

// 妖櫻山道只在進關時載三張地面。直向過渡未核准，不在這張表。
// Canonical：art/stage3-sakura-pass/scene/ 的 G_mountain_dirt、G_trans_dirt_to_steps_h、G_sakura_steps。loader URL 不變。
window.SAKURA_ART = {};
window.SAKURA_ART_STATUS = {};
const SAKURA_GROUND_ASSETS = Object.freeze({
  dirt: "assets/img/sakura-pass/ground_mountain_dirt.webp",
  transH: "assets/img/sakura-pass/ground_trans_dirt_to_steps_h.webp",
  steps: "assets/img/sakura-pass/ground_sakura_steps.webp"
});
const sakuraRequested = new Set();
window.refreshSakuraArt = () => {
  if (typeof Image !== "function") return;
  for (const role of Object.keys(SAKURA_GROUND_ASSETS)) {
    const url = SAKURA_GROUND_ASSETS[role];
    if (sakuraRequested.has(role)) continue;
    sakuraRequested.add(role);
    window.SAKURA_ART_STATUS[role] = "loading";
    const img = new Image();
    if (img.dataset) img.dataset.url = url;
    img.decoding = "async";
    img.onload = () => {
      window.SAKURA_ART[role] = img;
      window.SAKURA_ART_STATUS[role] = "ready";
    };
    img.onerror = () => { window.SAKURA_ART_STATUS[role] = "error"; };
    img.src = `${url}?v=20261014-sakura-ground1`;
  }
};
// Canonical：H_shrine_pavilion、O_corrupted_sakura。loader URL 仍是 shrine_pavilion 與 landmark_corrupted_sakura。
const SAKURA_SCENE_ASSETS = Object.freeze({
  pavilion: "assets/img/sakura-pass/shrine_pavilion.webp",
  ancientSakura: "assets/img/sakura-pass/landmark_corrupted_sakura.webp"
});
const sakuraSceneRequested = new Set();
window.refreshSakuraScene = () => {
  if (typeof Image !== "function") return;
  for (const role of Object.keys(SAKURA_SCENE_ASSETS)) {
    const url = SAKURA_SCENE_ASSETS[role];
    if (sakuraSceneRequested.has(role)) continue;
    sakuraSceneRequested.add(role);
    window.SAKURA_ART_STATUS[role] = "loading";
    const img = new Image();
    if (img.dataset) img.dataset.url = url;
    img.decoding = "async";
    img.onload = () => {
      window.SAKURA_ART[role] = img;
      window.SAKURA_ART_STATUS[role] = "ready";
    };
    img.onerror = () => { window.SAKURA_ART_STATUS[role] = "error"; };
    img.src = `${url}?v=20261014-sakura-scene1`;
  }
};

// 封面完成才準備旅路；旅路只載 overworld 地圖與共用道具。關卡地圖在 start() 時再載。
// 核心遊戲美術（妖怪、町屋、地面）延遲到 loadGameArt() 才預載，避免首屏多載。
loadArt("cover");
window.loadMapArt = () => {
  mapArtStarted = true;
  progressNames = ["cover", ...OVERWORLD_MAP_ASSET_NAMES];
  OVERWORLD_MAP_ASSET_NAMES.forEach(key=>loadArt(key));
  updateReadiness();
  // 不在這裡呼叫 preloadCoreArt()，改由 loadGameArt() 觸發
};
window.loadStageMapArt = (stageId) => {
  const slots = STAGE_ASSET_SLOTS[stageId];
  if (!slots) {
    console.warn(`[Assets] Unknown stageId: ${stageId}, falling back to night-town`);
    loadStageAssets("night-town");
    return;
  }
  // 由 loadStageAssets 統一處理 map 載入與 fallback，避免重複請求與漏掉 fallback
  loadStageAssets(stageId);
};

// 載入特定關卡的場景、轉場、專屬敵人/Boss 資產
// 缺圖回落現役共用資產，標記 WAITING_ART；不阻塞遊戲進場
function loadStageAssets(stageId) {
  const slots = STAGE_ASSET_SLOTS[stageId];
  if (!slots) return;

  const status = { missing: [], loaded: [], fallback: [] };
  window.STAGE_ART_STATUS[stageId] = status;

  // 輔助：嘗試載入，失敗則回落並標記
  const tryLoad = (key, fallbackKey = null, isCritical = false) => {
    if (!key || requestedArt.has(key)) return true;
    const img = new Image();
    img.fetchPriority = isCritical ? "high" : "low";
    img.decoding = "async";
    img.onload = () => {
      ART[key] = img;
      markSettled(key);
      status.loaded.push(key);
    };
    img.onerror = () => {
      if (fallbackKey && ART[fallbackKey]?.naturalWidth > 0) {
        ART[key] = ART[fallbackKey];
        status.fallback.push({ key, fallback: fallbackKey });
        markSettled(key, true);
      } else {
        status.missing.push(key);
        markSettled(key, true);
      }
    };
    requestedArt.add(key);
    const isScene = SCENERY_ASSET_KEYS.has(key);
    const isYokai = YOKAI_ASSET_KEYS.has(key);
    img.src = isScene
      ? `assets/img/scenery/${key}.webp?v=20261010-loading3`
      : isYokai
        ? `assets/img/yokai/${key}.webp?v=20261010-loading2`
        : `assets/img/${key}.webp?v=20261010-loading2`;
    return false;
  };

  // 關卡地圖（若不存在則回落到 night-town 或 rain-port）
  const mapKey = slots.map;
  if (mapKey) {
    // 若已請求且已完成，直接使用
    if (requestedArt.has(mapKey) && settledArt.has(mapKey)) {
      status.loaded.push(mapKey);
    } else if (!requestedArt.has(mapKey)) {
      // 首次請求：載入並設定 fallback
      const img = new Image();
      img.fetchPriority = "high";
      img.decoding = "async";
      img.onload = () => {
        ART[mapKey] = img;
        markSettled(mapKey);
        status.loaded.push(mapKey);
      };
      img.onerror = () => {
        // Map 不存在時，回落到 night-town（已存在）
        const fallbackMap = "map_night_town_v1";
        if (ART[fallbackMap]?.naturalWidth > 0) {
          ART[mapKey] = ART[fallbackMap];
          status.fallback.push({ key: mapKey, fallback: fallbackMap });
          markSettled(mapKey, true);
        } else {
          status.missing.push(mapKey);
          markSettled(mapKey, true);
        }
      };
      requestedArt.add(mapKey);
      img.src = `assets/img/${mapKey}.webp?v=20261010-loading3`;
    } else {
      // 已請求但尚未完成：等待現有載入完成，完成後檢查是否需要 fallback
      // 這裡不重複請求，依賴現有的 onerror 處理
      // 若現有載入失敗且未設定 fallback，這裡無法補救，但正常情況下 onerror 已處理
    }
  }

  // 地面
  tryLoad(slots.ground);

  // 場景/建築/裝飾/地標
  (slots.scene || []).forEach(key => tryLoad(key));

  // 轉場
  (slots.trans || []).forEach(key => tryLoad(key));

  // 專屬敵人 idle/attack
  if (slots.enemy) {
    for (const [enemyType, arts] of Object.entries(slots.enemy)) {
      // 雨港專用敵人由 PORT_ENEMIES loader 處理，跳過通用載入
      if (stageId === "rain-port" && (enemyType === "shiome" || enemyType === "boss")) {
        continue;
      }
      if (arts.idle) tryLoad(arts.idle, enemyType === "boss" ? "boss" : enemyType);
      if (arts.attack) tryLoad(arts.attack, arts.idle || (enemyType === "boss" ? "boss" : enemyType));
    }
  }
}
// 旅路角色採用新圖，但保持地圖進入速度；只在實際繪圖時背景下載。
let mapPlayerRequested = false;
window.loadMapPlayerArt = () => {
  if (mapPlayerRequested) return;
  mapPlayerRequested = true;
  PLAYER_ACTION_ART.slice(0,3).forEach(key=>loadArt(key,"low"));
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
  activeSkillArt.clear();activeSkillArt.set('katana',['katana_l1']);
  progressNames = gameAssetNames();
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
window.BOSS_BGM = null;
try {
  const bgmAudio = configureMusic(new Audio(window.audioAsset("assets/audio/BGM.mp3")));
  bgmAudio.addEventListener("error", () => {
    window.BGM = null;
  }, { once: true });
  window.BGM = bgmAudio;

  // Final boss music is lazy: audio.preload = 'none' until the last seal falls.
  const bossAudio = configureMusic(new Audio());
  bossAudio.src = window.audioAsset("assets/audio/BOSS.mp3");
  bossAudio.addEventListener("error", () => { window.BOSS_BGM = null; }, { once: true });
  window.BOSS_BGM = bossAudio;

  const mapAudio = configureMusic(new Audio(window.audioAsset("assets/audio/MAP.mp3")));
  mapAudio.addEventListener("error", () => {
    window.MAP_BGM = null;
  }, { once: true });
  window.MAP_BGM = mapAudio;
} catch (e) {
  console.log("[Audio] 未檢測到外部 BGM 音訊檔，將使用內建 Web Audio 和風程序化樂器合成。");
}
