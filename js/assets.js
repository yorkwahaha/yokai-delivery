// 素材載入：高解析度手繪風格資產與音訊載入
window.ART = {};
window.ART_READY = false;
window.MAP_ART_READY = false;
window.ART_PROGRESS = { settled: 0, total: 1, failed: 0 };
// Bump when replacing audio assets so deployed browser caches fetch the new clips.
window.audioAsset = path => `${path}?v=20261018-m11-voice`;

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
const OVERWORLD_MAP_ASSET_NAMES = ["player", "overworld_approved_v2", "prop_sakura", "prop_torii", "map_night_town_v1", "map_rain_port_v1", "house_tavern"];
const STAGE_MAP_ASSET_NAMES = ["map_night_town_v1", "map_rain_port_v1"];
const MAP_ASSET_NAMES = [...OVERWORLD_MAP_ASSET_NAMES, ...STAGE_MAP_ASSET_NAMES];
const CORE_ASSET_NAMES = ["player", "ghost", "mis", "boss", "runner", "tank", "shooter",
  "house_shop", "house_shrine", "house_tavern", "prop_torii", "prop_lantern", "prop_sakura", "ground", "ground_dirt"];
const HUD_ASSET_NAMES = ["hud_lantern_oil", "hud_radar_frame", "hud_omamori_hint_listen", "hud_skill_fan"];

// 八關資產插槽定義（資料導向，審圖通過後只要換映射即可，不改引擎）
// 每關包含：地面、場景/建築/裝飾/地標、專屬敵人 idle/attack、Boss idle/attack
// 缺圖時回落現役共用資產，標記 WAITING_ART；未核准候選不接 production
// DEV-ONLY: Stage8 preview toggle - enabled via ?dev=1&stage8preview=1 or window.STAGE8_PREVIEW = true
const STAGE8_PREVIEW_ENABLED = false; // Old Stage8 image previews purged; new art must be reviewed first.

// Stage8 preview asset keys (ONLY clean isolated props from connected-component extraction)
// Ground tiles and path tiles DISABLED - they were rectangular artifacts
// Source: irregular 1448x1086 sprite sheet -> connected components -> clean_prop_*
const STAGE8_PREVIEW_KEYS = Object.freeze({
  // Clean isolated props (47 items from connected-component extraction in sliced_v2/)
  // Each is a genuinely isolated flower stalk, bone fragment, or rock with transparent borders
  props: [
    "stage8_clean_prop_0", "stage8_clean_prop_1", "stage8_clean_prop_2", "stage8_clean_prop_3",
    "stage8_clean_prop_4", "stage8_clean_prop_5", "stage8_clean_prop_6", "stage8_clean_prop_7",
    "stage8_clean_prop_8", "stage8_clean_prop_9", "stage8_clean_prop_10", "stage8_clean_prop_11",
    "stage8_clean_prop_12", "stage8_clean_prop_13", "stage8_clean_prop_14", "stage8_clean_prop_15",
    "stage8_clean_prop_16", "stage8_clean_prop_17", "stage8_clean_prop_18", "stage8_clean_prop_19",
    "stage8_clean_prop_20", "stage8_clean_prop_21", "stage8_clean_prop_22", "stage8_clean_prop_23",
    "stage8_clean_prop_24", "stage8_clean_prop_25", "stage8_clean_prop_26", "stage8_clean_prop_27",
    "stage8_clean_prop_28", "stage8_clean_prop_29", "stage8_clean_prop_30", "stage8_clean_prop_31",
    "stage8_clean_prop_32", "stage8_clean_prop_33", "stage8_clean_prop_34", "stage8_clean_prop_35",
    "stage8_clean_prop_36", "stage8_clean_prop_37", "stage8_clean_prop_38", "stage8_clean_prop_39",
    "stage8_clean_prop_40", "stage8_clean_prop_41", "stage8_clean_prop_42", "stage8_clean_prop_43",
    "stage8_clean_prop_44", "stage8_clean_prop_45", "stage8_clean_prop_46"
  ]
});

// Expose to window for renderer access
if (typeof window !== "undefined") {
  window.STAGE8_PREVIEW_ENABLED = STAGE8_PREVIEW_ENABLED;
  window.STAGE8_PREVIEW_KEYS = STAGE8_PREVIEW_KEYS;
}

// DEV-ONLY: Stage2 Rain-Port candidate building preview toggle
// Strictly requires URL query: dev=1 && portartcandidate=1
const isPortArtCandidateEnabled = () => false; // Retired 2026-10-24 rejected candidate art URLs.

const PORT_CANDIDATE_KEYS = Object.freeze({
  fishWorkshop: "port_fish_workshop_candidate",
  weatheredWarehouse: "port_weathered_warehouse_candidate"
});

const PORT_CANDIDATE_METADATA = Object.freeze({
  weatheredWarehouse: Object.freeze({
    priority: "B",
    targetType: "port_warehouse",
    rawFile: "assets/img/rain-port/port_weathered_warehouse_candidate.png",
    rawSha256: "ec233e79a340a96be529b9be5e25fa4987244cd4deb11d6f99d2a2f0ff7153e0",
    rawBytes: 2449956,
    cutoutFile: "assets/img/rain-port/port_weathered_warehouse_cutout_candidate.png",
    cutoutSha256: "60efbd17fa869e9a4986f85020d40514ffb3b22c6d6c3c4a99de3b8e20c82139",
    cutoutBytes: 2343526,
    footprintW: 187,
    footpointDy: 48,
    shadowRx: 82,
    shadowRy: 16,
    bbox: Object.freeze({ minX: 13, maxX: 1239, minY: 130, maxY: 1148, opaqueW: 1227, opaqueH: 1019 }),
    sourceRect: Object.freeze({ sx: 13, sy: 130, sw: 1227, sh: 1019 }),
    footRatio: 1148 / 1254,
    status: "USER_APPROVED"
  }),
  fishWorkshop: Object.freeze({
    priority: "A",
    targetType: "port_fishmonger",
    rawFile: "assets/img/rain-port/port_fish_workshop_candidate.png",
    rawSha256: "c4dead2f405398cd7aaa552622d4ab49529f0b1544f0add94abda2a0c18c1f1b",
    rawBytes: 2367762,
    cutoutFile: "assets/img/rain-port/port_fish_workshop_cutout_candidate.png",
    cutoutSha256: "065fb9907ee5a6317254f31bc71e06d3e51dfedcf7f1da6a9bf4147feabd9b46",
    cutoutBytes: 1956641,
    footprintW: 201,
    footpointDy: 48,
    shadowRx: 88,
    shadowRy: 16,
    sign: "魚市工坊",
    bbox: Object.freeze({ minX: 17, maxX: 1236, minY: 181, maxY: 1103, opaqueW: 1220, opaqueH: 923 }),
    sourceRect: Object.freeze({ sx: 17, sy: 181, sw: 1221, sh: 923 }),
    footRatio: 1103 / 1254,
    status: "USER_APPROVED"
  })
});

// DEV-ONLY: Stage2 Rain-Port candidate surface (V3 stone & harbor sea) preview toggle
// Strictly requires URL query: dev=1 && (portsurfacecandidate=1 || surfacecandidate=1)
const isPortSurfaceCandidateEnabled = () => false; // Retired 2026-10-24 rejected candidate art URLs.

const PORT_SURFACE_CANDIDATE_METADATA = Object.freeze({
  stoneV3: Object.freeze({
    role: "stoneV3",
    targetType: "ground_stone",
    purpose: "central_walkable_stone",
    rawFile: "assets/img/rain-port/ground_stone_nano_v3_candidate.jpg",
    file: "assets/img/rain-port/ground_stone_nano_v3_seamless.png",
    w: 1024,
    h: 1024,
    status: "CANDIDATE_PREVIEW"
  }),
  harborSea: Object.freeze({
    role: "harborSea",
    targetType: "sea_surface",
    purpose: "southern_impassable_sea_bg",
    rawFile: "assets/img/rain-port/port_harbor_sea_candidate.png",
    file: "assets/img/rain-port/port_harbor_sea_norain_candidate.png",
    fallbackFile: "assets/img/rain-port/port_harbor_sea_surface.png",
    w: 1024,
    h: 600,
    status: "CANDIDATE_PREVIEW"
  }),
  stoneReflection: Object.freeze({
    role: "stoneReflection",
    targetType: "ground_accent",
    purpose: "sparse_local_accent",
    rawFile: "assets/img/rain-port/ground_stone_reflection_candidate.jpg",
    file: "assets/img/rain-port/ground_stone_reflection_candidate.jpg",
    w: 1024,
    h: 1024,
    status: "CANDIDATE_PREVIEW"
  }),
  stoneWoodTransition: Object.freeze({
    role: "stoneWoodTransition",
    targetType: "ground_transition",
    purpose: "stone_to_wood_dock_seam",
    rawFile: "assets/img/rain-port/ground_trans_stone_wood_candidate.png",
    file: "assets/img/rain-port/ground_trans_stone_wood_candidate.png",
    w: 1024,
    h: 512,
    status: "CANDIDATE_PREVIEW"
  }),
  northCliff: Object.freeze({
    role: "northCliff",
    targetType: "mountain_cliff",
    purpose: "northern_backdrop_mountain_cliff",
    rawFile: "assets/img/rain-port/port_north_cliff_candidate.png",
    file: "assets/img/rain-port/port_north_cliff_candidate.png",
    w: 1024,
    h: 480,
    status: "CANDIDATE_PREVIEW"
  })
});

if (typeof window !== "undefined") {
  window.isPortArtCandidateEnabled = isPortArtCandidateEnabled;
  window.PORT_ART_CANDIDATE_ENABLED = isPortArtCandidateEnabled();
  window.PORT_CANDIDATE_KEYS = PORT_CANDIDATE_KEYS;
  window.PORT_CANDIDATE_METADATA = PORT_CANDIDATE_METADATA;
  window.isPortSurfaceCandidateEnabled = isPortSurfaceCandidateEnabled;
  window.PORT_SURFACE_CANDIDATE_ENABLED = isPortSurfaceCandidateEnabled();
  window.PORT_SURFACE_CANDIDATE_METADATA = PORT_SURFACE_CANDIDATE_METADATA;
}

// DEV-ONLY: Stage2 Rain-Port S2 Production Art integration toggle
// Strictly requires URL query: dev=1 && stage=rain-port && s2artprod=1
const isS2ArtProdEnabled = () => {
  try {
    const raw = String(typeof window !== "undefined" && window.location?.search || "");
    const hasDev = typeof window !== "undefined" && window.DEV_MODE?.isDevMode?.(window.location) === true;
    const isLegacy = hasDev && /(?:^|[?&])s2legacy=1(?=[&#]|$)/.test(raw);
    if (isLegacy) return false;
    let stage = "";
    if (typeof STAGE_ART_RESOLVER !== "undefined" && typeof STAGE_ART_RESOLVER.getCurrentStage === "function") {
      stage = STAGE_ART_RESOLVER.getCurrentStage();
    } else if (typeof window !== "undefined") {
      stage = window.__ACTIVE_STAGE || window.__CURRENT_STAGE || window.STAGE?.id || "";
    }
    // Active runtime stage wins over the initial URL and test flags.
    // Never leak the port terrain/buildings into a stage selected via the map.
    return stage === "rain-port";
  } catch { return false; }
};

// 共通技能/HUD 的 manifest 不得被 S2 場景旗標擋住，S1 也使用同一來源。
let runtimeManifestPromise = null;
window.loadRuntimeArtManifest = () => {
  if (!runtimeManifestPromise) runtimeManifestPromise = fetch('assets/img/runtime-art-manifest.json?v=20261027-s2-mud-slab2')
    .then(res => { if (!res.ok) throw Error(`MANIFEST_HTTP_${res.status}`); return res.json(); })
    .then(manifest => { window.__RUNTIME_MANIFEST = manifest; return manifest; })
    .catch(error => {
      console.error('[Assets] Shared manifest:', error.message);
      // Network error must not poison this tab for the remainder of the session.
      runtimeManifestPromise = null;
      return null;
    });
  return runtimeManifestPromise;
};
window.loadRuntimeArtManifest();

// S2 場景仍獨立按原入口載入，只共用上面的 manifest 請求。
async function loadS2ArtProdManifest() {
  if (!isS2ArtProdEnabled()) return null;
  // Unified runtime art manifest serves as authoritative single data source
  const unifiedManifestUrl = 'assets/img/runtime-art-manifest.json?v=20261027-s2-mud-slab2';

  try {
    const manifest = await window.loadRuntimeArtManifest();
    if (!manifest) throw Error('MANIFEST_UNAVAILABLE');
    manifest._sourceUrl = unifiedManifestUrl;
    if (typeof window !== "undefined") {
      window.__RUNTIME_MANIFEST = manifest;
    }
    if (typeof STAGE_ART_RESOLVER !== "undefined" && typeof STAGE_ART_RESOLVER.setManifestData === "function") {
      STAGE_ART_RESOLVER.setManifestData(manifest);
    }
    const s2Stage = manifest.stages?.['rain-port'] || manifest;
    return {
      ...s2Stage,
      _sourceUrl: unifiedManifestUrl,
      tiles: s2Stage.tiles || {},
      buildings: s2Stage.buildings || [],
      props: s2Stage.props || [],
      environment: s2Stage.environment || []
    };
  } catch (e) {
    console.error('[S2-ART] Failed to fetch Nano manifest:', e.message);
    return null;
  }
}

// S2 Production Art asset cache
const S2_ART_PROD_CACHE = {
  tiles: { stoneVariants: [], woodVariants: [], transitions: { h: [], v: [] } },
  buildings: [],
  props: [],
  environment: [],
  manifest: null,
  loaded: false,
  loadError: null
};

let s2ArtProdLoadingPromise = null;

async function loadS2ArtProdAssets() {
  if (!isS2ArtProdEnabled()) return;
  if (S2_ART_PROD_CACHE.loaded && !S2_ART_PROD_CACHE.loadError) return;
  if (s2ArtProdLoadingPromise) return s2ArtProdLoadingPromise;

  s2ArtProdLoadingPromise = (async () => {
    try {
      const manifest = await loadS2ArtProdManifest();
      if (!manifest) {
        S2_ART_PROD_CACHE.loadError = 'MANIFEST_FETCH_FAILED';
        console.error('[S2-ART] Failed to fetch asset-manifest.json');
        return;
      }

      // Support both v1.3.0-nano (usable_runtime_tiles) and legacy v1.2/v1.0
      const runtimeTiles = manifest.tiles?.usable_runtime_tiles || manifest.tiles || {};
      const stoneVariants = Array.isArray(runtimeTiles.stoneVariants) ? runtimeTiles.stoneVariants : [];
      const woodVariants = Array.isArray(runtimeTiles.woodVariants) ? runtimeTiles.woodVariants : [];
      const transitions = runtimeTiles.transitions || {};
      S2_ART_PROD_CACHE.manifest = manifest;
      S2_ART_PROD_CACHE.tiles = { stoneVariants, woodVariants, transitions: {
        h: Array.isArray(transitions.h) ? transitions.h : [],
        v: Array.isArray(transitions.v) ? transitions.v : []
      } };
      S2_ART_PROD_CACHE.buildings = Array.isArray(manifest.buildings) ? manifest.buildings : [];
      S2_ART_PROD_CACHE.props = Array.isArray(manifest.props) ? manifest.props : [];
      S2_ART_PROD_CACHE.environment = Array.isArray(manifest.environment) ? manifest.environment : [];
      if (!stoneVariants.length || !woodVariants.length) {
        S2_ART_PROD_CACHE.loadError = 'INVALID_MANIFEST_NO_RUNTIME_TILES';
        console.error('[S2-ART] Missing usable stone/wood runtime tiles');
        return;
      }

      // Load all tile images (prefer WebP, fallback to PNG)
      const loadImage = (urlWebp, urlPng) => new Promise((resolve) => {
        if (!urlWebp && !urlPng) return resolve({ img: null, ok: false });
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve({ img, ok: true });
        img.onerror = () => {
          if (!urlPng || urlPng === urlWebp) return resolve({ img: null, ok: false });
          const img2 = new Image();
          img2.decoding = "async";
          img2.onload = () => resolve({ img: img2, ok: true });
          img2.onerror = () => resolve({ img: null, ok: false });
          img2.src = urlPng;
        };
        img.src = urlWebp || urlPng;
      });

      let anyLoaded = false;
      // Load stone variants
      for (const tile of S2_ART_PROD_CACHE.tiles.stoneVariants) {
        const srcWebp = tile.path_webp || (tile.path && tile.path.endsWith('.webp') ? tile.path : null) || tile.path;
        const srcPng = tile.path_png || (tile.path && tile.path.endsWith('.png') ? tile.path : null);
        if (tile._loaded && tile._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          tile._img = result.img;
          tile._loaded = result.ok;
          if (result.ok) anyLoaded = true;
        }
      }
      // Load wood variants
      for (const tile of S2_ART_PROD_CACHE.tiles.woodVariants) {
        const srcWebp = tile.path_webp || (tile.path && tile.path.endsWith('.webp') ? tile.path : null) || tile.path;
        const srcPng = tile.path_png || (tile.path && tile.path.endsWith('.png') ? tile.path : null);
        if (tile._loaded && tile._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          tile._img = result.img;
          tile._loaded = result.ok;
          if (result.ok) anyLoaded = true;
        }
      }
      // Load transitions H
      for (const tile of S2_ART_PROD_CACHE.tiles.transitions.h) {
        const srcWebp = tile.path_webp || (tile.path && tile.path.endsWith('.webp') ? tile.path : null) || tile.path;
        const srcPng = tile.path_png || (tile.path && tile.path.endsWith('.png') ? tile.path : null);
        if (tile._loaded && tile._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          tile._img = result.img;
          tile._loaded = result.ok;
          if (result.ok) anyLoaded = true;
        }
      }
      // Load transitions V
      for (const tile of S2_ART_PROD_CACHE.tiles.transitions.v) {
        const srcWebp = tile.path_webp || (tile.path && tile.path.endsWith('.webp') ? tile.path : null) || tile.path;
        const srcPng = tile.path_png || (tile.path && tile.path.endsWith('.png') ? tile.path : null);
        if (tile._loaded && tile._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          tile._img = result.img;
          tile._loaded = result.ok;
          if (result.ok) anyLoaded = true;
        }
      }
      // Load buildings
      for (const bld of S2_ART_PROD_CACHE.buildings) {
        const srcWebp = bld.path_webp || (bld.path && bld.path.endsWith('.webp') ? bld.path : null) || bld.path;
        const srcPng = bld.path_png || (bld.path && bld.path.endsWith('.png') ? bld.path : null);
        if (bld._loaded && bld._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          bld._img = result.img;
          bld._loaded = result.ok;
          if (result.ok) {
            anyLoaded = true;
            if (typeof window !== "undefined" && window.PORT_ART) {
              if (bld.id === 'building_port_warehouse') {
                window.PORT_ART.warehouse = result.img;
                window.PORT_ART.weatheredWarehouse = result.img;
                if (window.PORT_ART_STATUS) {
                  window.PORT_ART_STATUS.warehouse = "ready";
                  window.PORT_ART_STATUS.weatheredWarehouse = "ready";
                }
              } else if (bld.id === 'building_fish_workshop') {
                window.PORT_ART.fishmonger = result.img;
                window.PORT_ART.fishWorkshop = result.img;
                if (window.PORT_ART_STATUS) {
                  window.PORT_ART_STATUS.fishmonger = "ready";
                  window.PORT_ART_STATUS.fishWorkshop = "ready";
                }
              } else if (bld.id === 'building_port_tavern') {
                window.PORT_ART.portTavern = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.portTavern = "ready";
              } else if (bld.id === 'building_wharf_shop') {
                window.PORT_ART.wharfShop = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.wharfShop = "ready";
              } else if (bld.id === 'building_port_teahouse') {
                window.PORT_ART.portTeahouse = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.portTeahouse = "ready";
              }
            }
          }
        }
      }
      // Load props
      for (const prop of S2_ART_PROD_CACHE.props) {
        const srcWebp = prop.path_webp || (prop.path && prop.path.endsWith('.webp') ? prop.path : null) || prop.path;
        const srcPng = prop.path_png || (prop.path && prop.path.endsWith('.png') ? prop.path : null);
        if (prop._loaded && prop._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          prop._img = result.img;
          prop._loaded = result.ok;
          if (result.ok) {
            anyLoaded = true;
            if (typeof window !== "undefined" && window.PORT_ART) {
              if (prop.id === 'prop_anchor_gear') {
                window.PORT_ART.anchor = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.anchor = "ready";
              } else if (prop.id === 'prop_cargo_crates') {
                window.PORT_ART.crate = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.crate = "ready";
              } else if (prop.id === 'prop_mooring_post') {
                window.PORT_ART.mooring = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.mooring = "ready";
              } else if (prop.id === 'prop_port_boat') {
                window.PORT_ART.boat = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.boat = "ready";
              } else if (prop.id === 'prop_port_lighthouse') {
                window.PORT_ART.lighthouse = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.lighthouse = "ready";
              }
            }
          }
        }
      }
      // Load environment (sea, cliff)
      for (const env of S2_ART_PROD_CACHE.environment) {
        const srcWebp = env.path_webp || (env.path && env.path.endsWith('.webp') ? env.path : null) || env.path;
        const srcPng = env.path_png || (env.path && env.path.endsWith('.png') ? env.path : null);
        if (env._loaded && env._img?.naturalWidth) { anyLoaded = true; continue; }
        if (srcWebp || srcPng) {
          const result = await loadImage(srcWebp, srcPng);
          env._img = result.img;
          env._loaded = result.ok;
          if (result.ok) {
            anyLoaded = true;
            if (typeof window !== "undefined" && window.PORT_ART) {
              if (env.id === 'surface_sea_canonical') {
                window.PORT_ART.coastSea = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.coastSea = "ready";
              } else if (env.id === 'cliff_north_rock') {
                window.PORT_ART.coastCliff = result.img;
                if (window.PORT_ART_STATUS) window.PORT_ART_STATUS.coastCliff = "ready";
              }
            }
          }
        }
      }

      const allParts = [
        ...S2_ART_PROD_CACHE.tiles.stoneVariants, ...S2_ART_PROD_CACHE.tiles.woodVariants,
        ...S2_ART_PROD_CACHE.tiles.transitions.h, ...S2_ART_PROD_CACHE.tiles.transitions.v,
        ...S2_ART_PROD_CACHE.buildings, ...S2_ART_PROD_CACHE.props, ...S2_ART_PROD_CACHE.environment
      ];
      const missingParts = allParts.filter(entry => !entry._loaded || !entry._img?.naturalWidth);
      S2_ART_PROD_CACHE.loaded = allParts.some(entry => entry._loaded && entry._img?.naturalWidth);
      S2_ART_PROD_CACHE.loadError = missingParts.length ? 'PARTIAL_ASSETS_MISSING_' + missingParts.length : null;
      try { window.RENDERER?.invalidateGroundCache?.(); } catch {}
      if (!S2_ART_PROD_CACHE.loaded) {
        S2_ART_PROD_CACHE.loadError = 'NO_TILES_LOADED';
        console.error('[S2-ART] No tiles loaded successfully');
      } else {
        console.log('[S2-ART] Assets loaded:', {
          stone: S2_ART_PROD_CACHE.tiles.stoneVariants.filter(t => t._loaded).length,
          wood: S2_ART_PROD_CACHE.tiles.woodVariants.filter(t => t._loaded).length,
          transH: S2_ART_PROD_CACHE.tiles.transitions.h.filter(t => t._loaded).length,
          transV: S2_ART_PROD_CACHE.tiles.transitions.v.filter(t => t._loaded).length,
          buildings: S2_ART_PROD_CACHE.buildings.filter(b => b._loaded).length,
          props: S2_ART_PROD_CACHE.props.filter(p => p._loaded).length
        });
      }
    } finally {
      s2ArtProdLoadingPromise = null;
    }
  })();

  return s2ArtProdLoadingPromise;
}

// Reset S2 cache when leaving rain-port or restarting
function resetS2ArtProdCache() {
  s2ArtProdLoadingPromise = null;
  S2_ART_PROD_CACHE.tiles = { stoneVariants: [], woodVariants: [], transitions: { h: [], v: [] } };
  S2_ART_PROD_CACHE.buildings = [];
  S2_ART_PROD_CACHE.props = [];
  S2_ART_PROD_CACHE.manifest = null;
  S2_ART_PROD_CACHE.loaded = false;
  S2_ART_PROD_CACHE.loadError = null;
}

function getS2StoneTiles() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const tiles = S2_ART_PROD_CACHE.tiles.stoneVariants.filter(t => t._loaded && t._img?.naturalWidth);
  if (!tiles.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2StoneTiles empty:', S2_ART_PROD_CACHE.loadError);
  return tiles.length ? tiles : null;
}

function getS2WoodTiles() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const tiles = S2_ART_PROD_CACHE.tiles.woodVariants.filter(t => t._loaded && t._img?.naturalWidth);
  if (!tiles.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2WoodTiles empty:', S2_ART_PROD_CACHE.loadError);
  return tiles.length ? tiles : null;
}

function getS2TransitionsH() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const tiles = S2_ART_PROD_CACHE.tiles.transitions.h.filter(t => t._loaded && t._img?.naturalWidth);
  if (!tiles.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2TransitionsH empty:', S2_ART_PROD_CACHE.loadError);
  return tiles.length ? tiles : null;
}

function getS2TransitionsV() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const tiles = S2_ART_PROD_CACHE.tiles.transitions.v.filter(t => t._loaded && t._img?.naturalWidth);
  if (!tiles.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2TransitionsV empty:', S2_ART_PROD_CACHE.loadError);
  return tiles.length ? tiles : null;
}

function getS2Buildings() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const blds = S2_ART_PROD_CACHE.buildings.filter(b => b._loaded && b._img?.naturalWidth);
  if (!blds.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2Buildings empty:', S2_ART_PROD_CACHE.loadError);
  return blds.length ? blds : null;
}

function getS2Props() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const props = S2_ART_PROD_CACHE.props.filter(p => p._loaded && p._img?.naturalWidth);
  if (!props.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2Props empty:', S2_ART_PROD_CACHE.loadError);
  return props.length ? props : null;
}

function getS2Environment() {
  if (!isS2ArtProdEnabled() || !S2_ART_PROD_CACHE.loaded) return null;
  const env = S2_ART_PROD_CACHE.environment?.filter(e => e._loaded && e._img?.naturalWidth) || [];
  if (!env.length && S2_ART_PROD_CACHE.loadError) console.warn('[S2-ART] getS2Environment empty:', S2_ART_PROD_CACHE.loadError);
  return env.length ? env : null;
}

// DEV-ONLY: Stage2 selected source kit in art/stage2-rain-port/scene/ (4 stone + 3 wood + 1 transition)
// Strictly requires URL query: dev=1 && stage=rain-port && s2ground=kit
// Isolated from the older s2artprod / portsurfacecandidate gates: those keep their own art.
const isS2GroundKitEnabled = () => {
  try {
    const raw = String(typeof window !== "undefined" && window.location?.search || "");
    const hasDev = typeof window !== "undefined" && window.DEV_MODE?.isDevMode?.(window.location) === true;
    const isLegacy = hasDev && /(?:^|[?&])s2legacy=1(?=[&#]|$)/.test(raw);
    if (isLegacy) return false;
    let stage = "";
    if (typeof STAGE_ART_RESOLVER !== "undefined" && typeof STAGE_ART_RESOLVER.getCurrentStage === "function") {
      stage = STAGE_ART_RESOLVER.getCurrentStage();
    } else if (typeof window !== "undefined") {
      stage = window.__ACTIVE_STAGE || window.__CURRENT_STAGE || window.STAGE?.id || "";
    }
    // Unapproved ground-kit sources live in ignored art/ and must NEVER be
    // requested by a normal player. The published scene uses S2 production WebP.
    return hasDev && stage === "rain-port" && /(?:^|[?&])s2ground=kit(?=[&#]|$)/.test(raw);
  } catch { return false; }
};

// DEV-ONLY A/B: WebP candidate variant of the SAME eight selected ground-kit slots.
// Strictly requires URL query: dev=1 && stage=rain-port && s2ground=kit && s2webp=1
// Without s2webp=1 the PNG sources in art/stage2-rain-port/scene/ are loaded exactly as before, so the
// existing kit URL keeps its bytes and the two variants are never mixed in one page.
// These WebP files are ART_CANDIDATE / WAITING_USER_REVIEW and live outside the
// production asset tree; this switch exists only for the local A/B comparison.
const isS2GroundKitWebPEnabled = () => true;

// Observed orientation is taken from the IMAGES, not from the file-name letters:
//   t_stone_wood_v01.png -> stone TOP / wood BOTTOM, horizontal junction
//   t_stone_wood_h01.png -> stone UPPER-LEFT / wood LOWER-RIGHT, diagonal junction
//   t_stone_wood_c01.png -> stone LEFT / wood RIGHT, vertical straight boundary
const S2_GROUND_KIT_SPECS = Object.freeze([
  Object.freeze({ id: 'g_stone_01', file: 'g_stone_01.png', group: 'stone', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_stone_02', file: 'g_stone_02.png', group: 'stone', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_stone_03', file: 'g_stone_03.png', group: 'stone', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_stone_04', file: 'g_stone_04.png', group: 'stone', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_wood_01', file: 'g_wood_01.png', group: 'wood', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_wood_02', file: 'g_wood_02.png', group: 'wood', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 'g_wood_03', file: 'g_wood_03.png', group: 'wood', observedOrientation: 'n/a-ground' }),
  Object.freeze({ id: 't_stone_wood_v01', file: 't_stone_wood_v01.png', group: 'transition', observedOrientation: 'horizontal' })
]);

// Where the retained transition is used in the CURRENT rain-port world layout.
// The world has one full-width horizontal stone/wood seam (dockSeamY). It has no diagonal
// stone/wood junction and no stone/wood corner, so those two are never forced into the scene.
const S2_GROUND_KIT_PLACEMENT = Object.freeze({
  't_stone_wood_v01': Object.freeze({ role: 'horizontal', use: 'dockSeamY horizontal seam', state: 'USED' }),
  't_stone_wood_h01': Object.freeze({ role: 'diagonal', use: 'none in this world layout', state: 'SKIPPED_ORIENTATION_MISMATCH' }),
  't_stone_wood_c01': Object.freeze({ role: 'vertical', use: 'none in this world layout', state: 'SKIPPED_NO_VALID_CORNER' })
});

// Source reference: art/stage2-rain-port/manifest-dev-runtime.json
// const S2_GROUND_KIT_BASE = 'art/stage2-rain-port/scene/';
const S2_GROUND_KIT_BASE = 'assets/img/rain-port/s2-production/';
// A/B-only source of the same ten slots in WebP. Still a candidate set: nothing here
// promotes it to a production asset and no production path may read it.
const S2_GROUND_KIT_WEBP_BASE = 'assets/img/rain-port/s2-production/';
const S2_GROUND_KIT_CACHE = {
  enabled: false, webp: false, started: false, loaded: false, loadError: null,
  items: [], stone: [], wood: [],
  transitions: { horizontal: null, diagonal: null, vertical: null },
  requests: [], loadedCount: 0, total: 0, bytes: 0, startedAt: 0, finishedAt: 0, loadMs: 0
};

async function loadS2GroundKit() {
  const cache = S2_GROUND_KIT_CACHE;
  cache.enabled = isS2GroundKitEnabled();
  if (!cache.enabled || cache.started) return cache;
  cache.started = true;
  cache.startedAt = Date.now();
  // Exactly one source per run: the PNG pack (default) OR the WebP pack (s2webp=1 only).
  // The two packs are never requested together.
  const webp = isS2GroundKitWebPEnabled();
  cache.webp = webp;
  const base = webp ? S2_GROUND_KIT_WEBP_BASE : S2_GROUND_KIT_BASE;
  for (const spec of S2_GROUND_KIT_SPECS) {
    const requestedFile = webp ? spec.file.replace(/\.png$/, '.webp') : spec.file;
    const url = base + requestedFile;
    cache.requests.push(url);
    const item = { ...spec, requestedFile, url, _img: null, _loaded: false, _error: null, naturalWidth: 0, naturalHeight: 0 };
    cache.items.push(item);
    const img = new Image();
    img.decoding = 'async';
    const ok = await new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    item._img = ok ? img : null;
    item._loaded = !!ok;
    // Mark the image so the renderer can count REAL paint calls for it (a pick/size-sample
    // must never count as a draw).
    if (item._img) item._img.__s2KitId = item.id;
    item.naturalWidth = ok ? (img.naturalWidth || 0) : 0;
    item.naturalHeight = ok ? (img.naturalHeight || 0) : 0;
    if (!ok) item._error = 'LOAD_FAILED';
    if (ok) cache.loadedCount++;
    if (spec.group === 'stone') cache.stone.push(item);
    else if (spec.group === 'wood') cache.wood.push(item);
    else {
      const role = spec.observedOrientation;
      if (role === 'horizontal') cache.transitions.horizontal = item;
      else if (role === 'diagonal') cache.transitions.diagonal = item;
      else if (role === 'vertical') cache.transitions.vertical = item;
    }
  }
  cache.total = S2_GROUND_KIT_SPECS.length;
  cache.loaded = cache.loadedCount > 0;
  cache.loadError = cache.loadedCount === cache.total ? null : `LOADED_${cache.loadedCount}_OF_${cache.total}`;
  cache.finishedAt = Date.now();
  cache.loadMs = cache.finishedAt - cache.startedAt;
  // The terrain cache must be invalidated once the (async) kit images exist, otherwise the
  // page would keep showing the legacy fallback tiles.
  try { window.RENDERER?.invalidateGroundCache?.(); } catch { /* renderer not ready yet */ }
  return cache;
}

if (typeof window !== "undefined") {
  window.isS2GroundKitEnabled = isS2GroundKitEnabled;
  window.S2_GROUND_KIT_ENABLED = isS2GroundKitEnabled();
  window.isS2GroundKitWebPEnabled = isS2GroundKitWebPEnabled;
  window.S2_GROUND_KIT_WEBP_ENABLED = isS2GroundKitWebPEnabled();
  window.S2_GROUND_KIT_SPECS = S2_GROUND_KIT_SPECS;
  window.S2_GROUND_KIT_PLACEMENT = S2_GROUND_KIT_PLACEMENT;
  window.S2_GROUND_KIT_CACHE = S2_GROUND_KIT_CACHE;
  S2_GROUND_KIT_CACHE.enabled = window.S2_GROUND_KIT_ENABLED;
  S2_GROUND_KIT_CACHE.webp = window.S2_GROUND_KIT_WEBP_ENABLED;
  window.loadS2GroundKit = loadS2GroundKit;
  window.getS2GroundKit = () => (S2_GROUND_KIT_CACHE.loaded ? S2_GROUND_KIT_CACHE : null);
  // dev-only readable evidence (no game/UI surface is touched)
  window.__S2_GROUND_KIT_EVIDENCE = () => ({
    enabled: S2_GROUND_KIT_CACHE.enabled,
    webp: S2_GROUND_KIT_CACHE.webp,
    webpGate: isS2GroundKitWebPEnabled(),
    started: S2_GROUND_KIT_CACHE.started,
    loaded: S2_GROUND_KIT_CACHE.loaded,
    loadError: S2_GROUND_KIT_CACHE.loadError,
    loadedCount: S2_GROUND_KIT_CACHE.loadedCount,
    total: S2_GROUND_KIT_CACHE.total,
    loadMs: S2_GROUND_KIT_CACHE.loadMs,
    requests: S2_GROUND_KIT_CACHE.requests.slice(),
    items: S2_GROUND_KIT_CACHE.items.map(i => ({
      id: i.id, file: i.file, requestedFile: i.requestedFile, url: i.url, group: i.group,
      observedOrientation: i.observedOrientation,
      loaded: i._loaded, error: i._error,
      naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight
    })),
    placement: S2_GROUND_KIT_PLACEMENT
  });
  if (S2_GROUND_KIT_CACHE.enabled) {
    // Only the strict dev gate starts this loader; without it no kit image is requested.
    loadS2GroundKit();
  }
}

if (typeof window !== "undefined") {
  window.isS2ArtProdEnabled = isS2ArtProdEnabled;
  window.S2_ART_PROD_ENABLED = isS2ArtProdEnabled();
  window.loadS2ArtProdAssets = loadS2ArtProdAssets;
  window.loadS2ArtProdManifest = loadS2ArtProdManifest;
  window.resetS2ArtProdCache = resetS2ArtProdCache;
  window.getS2StoneTiles = getS2StoneTiles;
  window.getS2WoodTiles = getS2WoodTiles;
  window.getS2TransitionsH = getS2TransitionsH;
  window.getS2TransitionsV = getS2TransitionsV;
  window.getS2Buildings = getS2Buildings;
  window.getS2Props = getS2Props;
  window.getS2Environment = getS2Environment;
  window.S2_ART_PROD_CACHE = S2_ART_PROD_CACHE;
}

// DEV-ONLY: Fusion Collab Candidate preview toggle (墨焰斬、雷紋陣原型)
// Strictly requires URL query: dev=1 && (fusioncandidate=1 || fusion=1) or window.FUSION_CANDIDATE_ENABLED = true
const isFusionCandidateEnabled = () => {
  // Candidate art is local-only, using the same guard as dev save isolation.
  const safeDev = typeof window !== "undefined" && window.DEV_MODE?.isDevMode?.(window.location) === true;
  if (!safeDev) return false;
  if (window.FUSION_CANDIDATE_ENABLED === true) return true;
  try {
    const raw = String(typeof window !== "undefined" && window.location?.search || "");
    const hasDev = window.DEV_MODE?.isDevMode?.(window.location) === true;
    const hasCandidate = /(?:^|[?&])(?:fusioncandidate|fusion)=1(?=[&#]|$)/.test(raw);
    return hasDev && hasCandidate;
  } catch { return false; }
};

// F1-A-ART-COMPARE: 取得候選美術模式 (banana | gpt | legacy)
// 僅在精確 dev=1 & (fusioncandidate=1 || fusion=1) 時有效；正常遊戲一律 legacy
const getFusionArtMode = () => {
  if (!isFusionCandidateEnabled()) return "legacy";
  try {
    const raw = String(typeof window !== "undefined" && window.location?.search || "");
    const match = /(?:^|[?&])fusionart=(banana|gpt|legacy)(?=[&#]|$)/i.exec(raw);
    return match ? match[1].toLowerCase() : "legacy";
  } catch {
    return "legacy";
  }
};

const FUSION_ART_CANDIDATE_CONFIG = Object.freeze({
  banana: Object.freeze({
    id: "banana",
    label: "Nano Banana 2.1",
    // 獨立 alpha 候選檔（去背透明 WebP，matte-eval 實測邊框 0%、深墨保留 98.71% -> USABLE_CANDIDATE）
    alphaFile: "art/fusion/candidates/fusion_inkblade/banana_inkblade_alpha_candidate_v01.webp",
    alphaFallbackFile: "art/fusion/candidates/fusion_inkblade/main_alpha_candidate_v01.webp",
    // 來源原始圖（注意：main_v01.png 帶有實心矩形背景，無 alpha，不可直接當遊戲透明貼圖）
    rawFile: "art/fusion/candidates/fusion_inkblade/main_v01.png",
    hasAlpha: true,
    usable: true,
    status: "USABLE_CANDIDATE"
  }),
  gpt: Object.freeze({
    id: "gpt",
    label: "GPT Image",
    // 獨立 alpha 候選檔（matte-eval 實測殘留 21.42% 和紙底與邊框暗暈 -> NOT_USABLE，嚴禁當戰鬥貼圖）
    alphaFile: "art/fusion/candidates/fusion_inkblade/gpt_inkblade_alpha_candidate_v01.webp",
    alphaFallbackFile: "art/fusion/candidates/fusion_inkblade/gpt_inkblade_alpha_candidate_v01.png",
    // 來源原始圖（已在 Windows 到位，確認存在；但有紙底米白/半透明背景，未去背不可直接當遊戲貼圖）
    rawFile: "art/fusion/candidates/fusion_inkblade/gpt_inkblade_original_v01.png",
    hasAlpha: false,
    usable: false,
    status: "NOT_USABLE_WAITING_CUTOUT"
  })
});

const FUSION_VFX_KEYS = Object.freeze({
  fusion_inkblade: "fusion_inkblade_arc",
  fusion_slashwheel: "fusion_slashwheel_arc",
  fusion_foxiai: "fusion_foxiai_arc",
  fusion_exorcistblade: "fusion_exorcistblade_arc",
  fusion_foxfirebarrier: "fusion_foxfirebarrier_ward",
  fusion_foxthunderlantern: "fusion_foxthunderlantern_sigil",
  fusion_flamefestival: "fusion_flamefestival_fire",
  fusion_thundercircle: "fusion_thundercircle_mark",
  fusion_exorcistseal: "fusion_exorcistseal_array",
  fusion_thundertalisman: "fusion_thundertalisman_strike"
});

const FUSION_VFX_METADATA = Object.freeze({
  fusion_inkblade: Object.freeze({
    id: "fusion_inkblade",
    name: "墨焰斬",
    parents: Object.freeze(["katana", "fire"]),
    candidateAssetKey: "fusion_inkblade_arc",
    file: "assets/img/vfx/fusion/inkblade_main.webp",
    status: "WAITING_ART",
    fallback: "procedural_ukiyoe_ink"
  }),
  fusion_slashwheel: Object.freeze({
    id: "fusion_slashwheel",
    name: "斬界輪",
    parents: Object.freeze(["katana", "barrier"]),
    candidateAssetKey: "fusion_slashwheel_arc",
    file: "assets/img/vfx/fusion/recipes/fusion_slashwheel/main_alpha_candidate_v02.webp",
    status: "WAITING_IMPLEMENTATION",
    fallback: "none"
  }),
  fusion_foxiai: Object.freeze({
    id: "fusion_foxiai",
    name: "雷狐居合",
    parents: Object.freeze(["katana", "thunder"]),
    candidateAssetKey: "fusion_foxiai_arc",
    file: "assets/img/vfx/fusion/recipes/fusion_foxiai/main_alpha_candidate_v02.webp",
    status: "ART_CANDIDATE",
    fallback: "tech_placeholder"
  }),
  fusion_exorcistblade: Object.freeze({
    id: "fusion_exorcistblade",
    name: "退魔符刃",
    parents: Object.freeze(["katana", "boom"]),
    candidateAssetKey: "fusion_exorcistblade_arc",
    file: "assets/img/vfx/fusion/recipes/fusion_exorcistblade/main_alpha_candidate_v02.webp",
    status: "ART_CANDIDATE",
    fallback: "tech_placeholder"
  }),
  fusion_foxfirebarrier: Object.freeze({
    id: "fusion_foxfirebarrier",
    name: "妖火結界",
    parents: Object.freeze(["fire", "barrier"]),
    candidateAssetKey: "fusion_foxfirebarrier_ward",
    file: "assets/img/vfx/fusion/recipes/fusion_foxfirebarrier/main_alpha_candidate_v02.webp",
    status: "ART_CANDIDATE",
    fallback: "tech_placeholder"
  }),
  fusion_foxthunderlantern: Object.freeze({
    id: "fusion_foxthunderlantern",
    name: "狐雷天燈",
    parents: Object.freeze(["fire", "thunder"]),
    candidateAssetKey: "fusion_foxthunderlantern_sigil",
    file: "assets/img/vfx/fusion/recipes/fusion_foxthunderlantern/main_alpha_candidate_v02.webp",
    status: "WAITING_IMPLEMENTATION",
    fallback: "none"
  }),
  fusion_flamefestival: Object.freeze({
    id: "fusion_flamefestival",
    name: "炎符祭",
    parents: Object.freeze(["fire", "boom"]),
    candidateAssetKey: "fusion_flamefestival_fire",
    file: "assets/img/vfx/fusion/recipes/fusion_flamefestival/main_alpha_candidate_v02.webp",
    status: "WAITING_IMPLEMENTATION",
    fallback: "none"
  }),
  fusion_thundercircle: Object.freeze({
    id: "fusion_thundercircle",
    name: "雷陣封界",
    parents: Object.freeze(["barrier", "thunder"]),
    candidateAssetKey: "fusion_thundercircle_mark",
    file: "assets/img/vfx/fusion/recipes/fusion_thundercircle/main_alpha_candidate_v02.webp",
    status: "WAITING_ART",
    fallback: "procedural_thunder_seal"
  }),
  fusion_exorcistseal: Object.freeze({
    id: "fusion_exorcistseal",
    name: "退魔封陣",
    parents: Object.freeze(["barrier", "boom"]),
    candidateAssetKey: "fusion_exorcistseal_array",
    file: "assets/img/vfx/fusion/recipes/fusion_exorcistseal/main_alpha_candidate_v02.webp",
    status: "ART_CANDIDATE",
    fallback: "tech_placeholder"
  }),
  fusion_thundertalisman: Object.freeze({
    id: "fusion_thundertalisman",
    name: "雷符神罰",
    parents: Object.freeze(["thunder", "boom"]),
    candidateAssetKey: "fusion_thundertalisman_strike",
    file: "assets/img/vfx/fusion/recipes/fusion_thundertalisman/main_alpha_candidate_v02.webp",
    status: "WAITING_IMPLEMENTATION",
    fallback: "none"
  })
});

// ============================================================================
// M2-FUSION-ART-BIND-R1：十招真圖 phase 綁定（DEV-ONLY 嚴格門檻）
//
// 生效 URL（缺一不可、參數順序無關）：
//   ?dev=1&stage=rain-port&fusioncandidate=1&fusionart=banana
// 其他任何情況（正常模式／無 dev／錯 stage／無 fusioncandidate／非 banana）
// 一律不下載、不使用這套候選資產。
// 這裡刻意不看 window.FUSION_CANDIDATE_ENABLED：單一旗標不得繞過 dev 門檻。
//
// phase 定義：
//   main   招式主體（直立，隨攻擊角旋轉）
//   hit    命中／爆點（直立，貼命中位置）
//   ground 地面投影（世界座標，素材自帶透視比例）
//   icon   識別徽章（小圖，直立）
//
// 候選圖留在 art/fusion/candidates/ 原位，不搬進 assets/img/vfx/fusion。
// 未經使用者 ART_PASS 前一律視為 ART_CANDIDATE / WAITING_ART，
// 不得覆蓋正式資產、不得當成已核准美術。
// ============================================================================

// 每個 phase 的來源（真檔 sha256 + alpha 內容框，供裁切定位用）
const FUSION_ART_BIND_SOURCES = Object.freeze({
  fusion_inkblade: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/inkblade_main.webp",
      sha256: "1ecb4a7573470359c010555db215dd017f0aebe4954340b9915534bffd8a6f14",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([0, 37, 1264, 848])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/inkblade_hit.webp",
      sha256: "677f9fe9bc0f6b28a2ff9f136efb4a3bec353741dd25d47d27236abdb226a9ca",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([253, 120, 994, 747])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/inkblade_ground.webp",
      sha256: "5fc1abda8fe7a335b136f9c0f3e076b8356d5d3c2c4cd2550d04e008757eefdd",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([78, 310, 1177, 562])
    }),
    icon: null
  }),
  fusion_slashwheel: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_slashwheel/main_alpha_candidate_v02.webp",
      sha256: "912268eeebf114b4f5622d6deef2818e7a0c99abc9004cd9d53dfbd382673c38",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([201, 63, 1072, 779])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_slashwheel/main_alpha_candidate_v02.webp",
      sha256: "912268eeebf114b4f5622d6deef2818e7a0c99abc9004cd9d53dfbd382673c38",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([201, 63, 1072, 779])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_slashwheel/main_alpha_candidate_v02.webp",
      sha256: "912268eeebf114b4f5622d6deef2818e7a0c99abc9004cd9d53dfbd382673c38",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([201, 63, 1072, 779])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_slashwheel/main_alpha_candidate_v02.webp",
      sha256: "912268eeebf114b4f5622d6deef2818e7a0c99abc9004cd9d53dfbd382673c38",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([504, 296, 760, 552])
    })
  }),
  fusion_foxiai: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxiai/main_alpha_candidate_v02.webp",
      sha256: "9e84e1dd4e24dde5a99b7e4fd454fe871ffd770ceefba05aa3bf7ca1a5599d38",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([92, 141, 1208, 726])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxiai/hit_alpha_candidate_v01.webp",
      sha256: "f55f0aa2fa501fc3bb400ce71a6ade585de83f3141b8239438d8746059f72365",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([308, 160, 953, 694])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxiai/ground_alpha_candidate_v01.webp",
      sha256: "2cab06fa5fe89caa477028320dffde6774dacc27e51f3d11317780169fea253a",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([60, 352, 1160, 494])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxiai/icon_alpha_candidate_v01.webp",
      sha256: "a5c3b7648ed1fae307d1098241bea4be1cb71c76b8b009b23de16ddbbb6b3320",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([334, 134, 918, 720])
    })
  }),
  fusion_exorcistblade: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistblade/main_alpha_candidate_v02.webp",
      sha256: "7d634b81af6f066de5412c2f1cf264efdd3b1dc885d152a4925307f5bda01dbd",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([139, 166, 1181, 640])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistblade/hit_alpha_candidate_v01.webp",
      sha256: "5f676cf6c71300431618dbb8671026e54384d0f47a1731fb7165dd7b4d4b4238",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([227, 116, 1042, 734])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistblade/ground_alpha_candidate_v01.webp",
      sha256: "cbaf8b871aea41cef38e8fe3499756a783f7c4dbbde2d27b8cbf57e990f1bfaa",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([40, 132, 1202, 694])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistblade/icon_alpha_candidate_v01.webp",
      sha256: "c1865f590b7dd1c25fa15cb450c24a7d61073ed29f56c9d0020a910e62f8e020",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([367, 158, 891, 693])
    })
  }),
  fusion_foxfirebarrier: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxfirebarrier/main_alpha_candidate_v02.webp",
      sha256: "cda1c296ebe4cb5abf93945cf2aba8df9a0ce75c8609b4e0bd015baa5105bc92",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([186, 109, 1066, 699])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxfirebarrier/hit_alpha_candidate_v01.webp",
      sha256: "6b20717830c80bfbccd0538523c36aa6efa50d52ab4e54628cde139bd717d43b",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([302, 137, 980, 706])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxfirebarrier/ground_alpha_candidate_v01.webp",
      sha256: "ddfbcc43e47499bca05d80d8ddae9f25e0d218f6c4db281a9fc3c1886c1ce9c6",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([131, 188, 1129, 670])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxfirebarrier/icon_alpha_candidate_v01.webp",
      sha256: "6dfd62ab2f2d37cde977d745ddd6b5796af041c8cda909a74ecee4750ee36920",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([334, 108, 932, 740])
    })
  }),
  fusion_foxthunderlantern: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxthunderlantern/main_alpha_candidate_v02.webp",
      sha256: "34e3f654ce0a3de8c088d80b47d1e14011f8e660158b04b8d764480d792937fe",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([264, 32, 1100, 796])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxthunderlantern/main_alpha_candidate_v02.webp",
      sha256: "34e3f654ce0a3de8c088d80b47d1e14011f8e660158b04b8d764480d792937fe",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([264, 32, 1100, 796])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxthunderlantern/main_alpha_candidate_v02.webp",
      sha256: "34e3f654ce0a3de8c088d80b47d1e14011f8e660158b04b8d764480d792937fe",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([264, 32, 1100, 796])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_foxthunderlantern/main_alpha_candidate_v02.webp",
      sha256: "34e3f654ce0a3de8c088d80b47d1e14011f8e660158b04b8d764480d792937fe",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([504, 296, 760, 552])
    })
  }),
  fusion_flamefestival: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_flamefestival/main_alpha_candidate_v02.webp",
      sha256: "68bfe9465b52fd5ff5cea0ac1a088c05d1afe82e458bfa7fc746b08a33d696c8",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([125, 34, 1164, 810])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_flamefestival/main_alpha_candidate_v02.webp",
      sha256: "68bfe9465b52fd5ff5cea0ac1a088c05d1afe82e458bfa7fc746b08a33d696c8",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([125, 34, 1164, 810])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_flamefestival/main_alpha_candidate_v02.webp",
      sha256: "68bfe9465b52fd5ff5cea0ac1a088c05d1afe82e458bfa7fc746b08a33d696c8",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([125, 34, 1164, 810])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_flamefestival/main_alpha_candidate_v02.webp",
      sha256: "68bfe9465b52fd5ff5cea0ac1a088c05d1afe82e458bfa7fc746b08a33d696c8",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([504, 296, 760, 552])
    })
  }),
  fusion_thundercircle: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundercircle/main_alpha_candidate_v02.webp",
      sha256: "8ac610ce2c92d71512e2f5cd4f4bee1cf8c398e9852ceed8a9ea5b4913987999",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([68, 82, 1197, 797])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundercircle/main_alpha_candidate_v02.webp",
      sha256: "8ac610ce2c92d71512e2f5cd4f4bee1cf8c398e9852ceed8a9ea5b4913987999",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([68, 82, 1197, 797])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundercircle/main_alpha_candidate_v02.webp",
      sha256: "8ac610ce2c92d71512e2f5cd4f4bee1cf8c398e9852ceed8a9ea5b4913987999",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([68, 82, 1197, 797])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundercircle/main_alpha_candidate_v02.webp",
      sha256: "8ac610ce2c92d71512e2f5cd4f4bee1cf8c398e9852ceed8a9ea5b4913987999",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([504, 296, 760, 552])
    })
  }),
  fusion_exorcistseal: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistseal/main_alpha_candidate_v02.webp",
      sha256: "95fc2373e064b8924b6fb10de62b17aaa83a2fedf1503370fb40741752550ff4",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([68, 45, 1194, 804])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistseal/hit_alpha_candidate_v01.webp",
      sha256: "9f8fd2fbe6770f23e9f9de7fbb139475026f5bff7a4d32024e1e21e42cc3fa12",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([138, 55, 1146, 793])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistseal/ground_alpha_candidate_v01.webp",
      sha256: "ce1ad08ec8a60ccde92f3fe98a736971b42d46a684ab5b5a13147a60833a9d3d",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([72, 128, 1176, 760])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_exorcistseal/icon_alpha_candidate_v01.webp",
      sha256: "cd36d26c4545dc6d3d890b72e1ebf209bf21db61bba09ecb499076a790620c64",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([274, 136, 971, 720])
    })
  }),
  fusion_thundertalisman: Object.freeze({
    main: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundertalisman/main_alpha_candidate_v02.webp",
      sha256: "d703e9980f9f96728e1671549d4d3690c4fc81bfe1db9e842ad30604d1c2f390",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([288, 1, 1023, 798])
    }),
    hit: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundertalisman/main_alpha_candidate_v02.webp",
      sha256: "d703e9980f9f96728e1671549d4d3690c4fc81bfe1db9e842ad30604d1c2f390",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([288, 1, 1023, 798])
    }),
    ground: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundertalisman/main_alpha_candidate_v02.webp",
      sha256: "d703e9980f9f96728e1671549d4d3690c4fc81bfe1db9e842ad30604d1c2f390",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([288, 1, 1023, 798])
    }),
    icon: Object.freeze({
      file: "assets/img/vfx/fusion/recipes/fusion_thundertalisman/main_alpha_candidate_v02.webp",
      sha256: "d703e9980f9f96728e1671549d4d3690c4fc81bfe1db9e842ad30604d1c2f390",
      size: Object.freeze([1264, 848]),
      bbox: Object.freeze([504, 296, 760, 552])
    })
  })
});

const FUSION_ART_BIND_PHASES = Object.freeze(["main", "hit", "ground", "icon"]);

// 融合候選圖僅供 dev 預覽，不應因關卡不同而有不同啟用條件。
// 共用同一組 phase 來源；正式模式維持既有核准素材與 fallback。
const isFusionArtBindEnabled = (kind = null) => {
  // Ten fusion recipes share stage-independent packaged WebP sources.
  if (kind == null || FUSION_ART_BIND_SOURCES[kind]) return true;
  try {
    const raw = String(typeof window !== "undefined" && window.location?.search || "");
    const hasDev = window.DEV_MODE?.isDevMode?.(window.location) === true;
    const hasCandidate = /(?:^|[?&])(?:fusioncandidate|fusion)=1(?=[&#]|$)/.test(raw);
    const hasBanana = /(?:^|[?&])fusionart=banana(?=[&#]|$)/i.test(raw);
    const explicitOtherStyle = /(?:^|[?&])fusionart=(?:legacy|gpt)(?=[&#]|$)/i.test(raw);
    // Stage 1's previous dev default now applies to ALL stages.
    // Explicit fusioncandidate=1 still requires fusionart=banana.
    return hasDev && !explicitOtherStyle && (!hasCandidate || hasBanana);
  } catch { return false; }
};

// 執行期狀態（window.FUSION_ART_BIND）
// images[kind][phase] = HTMLImageElement；status[kind][phase] = idle|loading|ready|ready_fallback|missing
const FUSION_ART_BIND = { images: {}, status: {}, requests: [] };

// 解析某招某 phase 的實際來源；icon 缺檔時以 main 作臨時 DEV_ICON_FALLBACK（必標 WAITING_ART）。
function getFusionArtBindDef(kind, phase) {
  const table = FUSION_ART_BIND_SOURCES[kind];
  if (!table) return null;
  let def = table[phase] || null;
  let fallback = false;
  if (!def && phase === "icon") {
    def = table.main || null;
    fallback = !!def;
  }
  if (!def) return null;
  return {
    file: def.file,
    sha256: def.sha256,
    size: def.size,
    bbox: def.bbox,
    fallback
  };
}

// 載入單一 phase 圖（缺檔 → status missing，不崩潰；重複呼叫不會重複請求）
function loadFusionPhaseArt(kind, phase, forceRetry = false) {
  if (typeof window === "undefined") return null;
  if (!isFusionArtBindEnabled(kind)) return null;
  if (!kind || !FUSION_ART_BIND_PHASES.includes(phase)) return null;
  const def = getFusionArtBindDef(kind, phase);
  if (!def) return null;

  const store = window.FUSION_ART_BIND;
  store.images[kind] = store.images[kind] || {};
  store.status[kind] = store.status[kind] || {};
  const cur = store.status[kind][phase];
  if (!forceRetry && (cur === "ready" || cur === "ready_fallback" || cur === "loading")) {
    return store.images[kind][phase] || null;
  }
  if (!forceRetry && cur === "missing") return null;

  store.status[kind][phase] = "loading";
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      store.images[kind][phase] = img;
      store.status[kind][phase] = def.fallback ? "ready_fallback" : "ready";
    } else {
      store.images[kind][phase] = null;
      store.status[kind][phase] = "missing";
    }
  };
  img.onerror = () => {
    store.images[kind][phase] = null;
    store.status[kind][phase] = "missing";
  };
  if (!store.requests.includes(def.file)) store.requests.push(def.file);
  img.src = def.file + "?v=20261027-runtimefusion2";
  return null;
}

// Only prime the selected fusion's actual image phases when acquired; do not preload all ten recipes.
function prefetchFusionArt(kind) {
  if (!isFusionArtBindEnabled(kind) || !FUSION_ART_BIND_SOURCES[kind]) return;
  for (const phase of ["main", "hit", "ground"]) loadFusionPhaseArt(kind, phase);
}

// 取圖：已就緒回傳 Image，否則觸發載入並回 null（不阻塞、不丟錯）
function getFusionPhaseArt(kind, phase) {
  if (typeof window === "undefined") return null;
  if (!isFusionArtBindEnabled(kind)) return null;
  const img = window.FUSION_ART_BIND?.images?.[kind]?.[phase];
  if (img && img.naturalWidth > 0) return img;
  loadFusionPhaseArt(kind, phase);
  return null;
}

// 一次載入十招全部 phase（缺檔者標 missing／absent，不影響其他 phase）
function loadFusionArtBind(forceRetry = false) {
  if (typeof window === "undefined") return;
  // Defer all-asset diagnostic reload; individual fusions prefetch on acquire.
  if (!forceRetry) return;
  for (const kind of Object.keys(FUSION_ART_BIND_SOURCES)) {
    for (const phase of FUSION_ART_BIND_PHASES) {
      loadFusionPhaseArt(kind, phase, forceRetry);
    }
  }
}

// 給測試與報告用的真實綁定狀態（不是 metadata 宣稱，是實際載入結果）
function getFusionArtBindReport() {
  const kinds = {};
  for (const [kind, table] of Object.entries(FUSION_ART_BIND_SOURCES)) {
    const phases = {};
    for (const phase of FUSION_ART_BIND_PHASES) {
      const def = getFusionArtBindDef(kind, phase);
      const status = window.FUSION_ART_BIND?.status?.[kind]?.[phase] || "idle";
      phases[phase] = {
        file: def ? def.file : null,
        sha256: def ? def.sha256 : null,
        defined: !!def,
        exists: status === "ready" || status === "ready_fallback",
        approval: "ART_CANDIDATE",
        aliasOf: phase !== "main" && def?.file === table.main?.file ? "main" : null,
        needsPhaseArt: phase !== "main" && (!def || def.fallback || def.file === table.main?.file),
        fallback: !!(def && def.fallback),
        status,
        naturalWidth: window.FUSION_ART_BIND?.images?.[kind]?.[phase]?.naturalWidth || 0,
        naturalHeight: window.FUSION_ART_BIND?.images?.[kind]?.[phase]?.naturalHeight || 0
      };
    }
    kinds[kind] = phases;
  }
  return {
    enabled: Object.keys(FUSION_ART_BIND_SOURCES).every(kind => isFusionArtBindEnabled(kind)),
    requests: (window.FUSION_ART_BIND?.requests || []).slice(),
    kinds
  };
}

// 全域候選圖檔與狀態管理
if (typeof window !== "undefined") {
  window.isFusionCandidateEnabled = isFusionCandidateEnabled;
  window.FUSION_CANDIDATE_ENABLED = isFusionCandidateEnabled();
  window.getFusionArtMode = getFusionArtMode;
  window.FUSION_ART_CANDIDATE_CONFIG = FUSION_ART_CANDIDATE_CONFIG;
  window.FUSION_VFX_KEYS = FUSION_VFX_KEYS;
  window.FUSION_VFX_METADATA = FUSION_VFX_METADATA;
  window.FUSION_ART = window.FUSION_ART || {};
  window.FUSION_ART_STATUS = window.FUSION_ART_STATUS || {
    mode: getFusionArtMode(),
    banana: "unloaded",
    gpt: "unloaded",
    legacy: "ready"
  };
  // M2-FUSION-ART-BIND-R1
  window.isFusionArtBindEnabled = isFusionArtBindEnabled;
  window.FUSION_ART_BIND_ENABLED = Object.keys(FUSION_ART_BIND_SOURCES).every(kind => isFusionArtBindEnabled(kind));
  window.FUSION_ART_BIND_SOURCES = FUSION_ART_BIND_SOURCES;
  window.FUSION_ART_BIND_PHASES = FUSION_ART_BIND_PHASES;
  window.FUSION_ART_BIND = window.FUSION_ART_BIND || FUSION_ART_BIND;
  window.loadFusionPhaseArt = loadFusionPhaseArt;
  window.prefetchFusionArt = prefetchFusionArt;
  window.getFusionPhaseArt = getFusionPhaseArt;
  window.loadFusionArtBind = loadFusionArtBind;
  window.getFusionArtBindDef = getFusionArtBindDef;
  window.getFusionArtBindReport = getFusionArtBindReport;
}

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
    ground: "ground_stone",
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
    scene: ["house_shrine", "prop_sakura"],
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
    ground: STAGE8_PREVIEW_ENABLED ? "ground" : "ground",  // Use approved fallback as base
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
if (typeof window !== "undefined") window.STAGE_ASSET_SLOTS = STAGE_ASSET_SLOTS;

// ============================================================================
// STAGE_ART_RESOLVER — Authoritative single-source stage art resolver contract
// Authority: docs/STAGE_PATHS.json, assets/img/runtime-art-manifest.json
// ============================================================================
const STAGE_ART_RESOLVER = Object.freeze({
  manifestUrl: "assets/img/runtime-art-manifest.json",
  approvedStages: Object.freeze(["night-town", "rain-port"]),
  setManifestData(data) {
    if (typeof window !== "undefined") window.__RUNTIME_MANIFEST = data;
  },

  getManifestData() {
    if (typeof window !== "undefined" && window.__RUNTIME_MANIFEST) {
      return window.__RUNTIME_MANIFEST;
    }
    if (typeof require === "function") {
      try {
        const fsMod = require("node:fs");
        const pathMod = require("node:path");
        const p = pathMod.resolve(process.cwd(), "assets/img/runtime-art-manifest.json");
        if (fsMod.existsSync(p)) {
          const parsed = JSON.parse(fsMod.readFileSync(p, "utf8"));
          if (typeof window !== "undefined") window.__RUNTIME_MANIFEST = parsed;
          return parsed;
        }
      } catch {}
    }
    return null;
  },

  _findInManifest(stageId, key) {
    const manifest = this.getManifestData();
    if (!manifest || !manifest.stages) return null;
    const stage = manifest.stages[stageId];
    if (!stage) return null;

    if (stage.assets && stage.assets[key]) {
      return stage.assets[key];
    }
    if (stage.tiles) {
      if (Array.isArray(stage.tiles.stoneVariants)) {
        const item = stage.tiles.stoneVariants.find(x => x.id === key);
        if (item) return item;
      }
      if (Array.isArray(stage.tiles.woodVariants)) {
        const item = stage.tiles.woodVariants.find(x => x.id === key);
        if (item) return item;
      }
      if (stage.tiles.transitions) {
        if (Array.isArray(stage.tiles.transitions.h)) {
          const item = stage.tiles.transitions.h.find(x => x.id === key);
          if (item) return item;
        }
        if (Array.isArray(stage.tiles.transitions.v)) {
          const item = stage.tiles.transitions.v.find(x => x.id === key);
          if (item) return item;
        }
      }
    }
    if (Array.isArray(stage.buildings)) {
      const item = stage.buildings.find(x => x.id === key);
      if (item) return item;
    }
    if (Array.isArray(stage.props)) {
      const item = stage.props.find(x => x.id === key);
      if (item) return item;
    }
    if (Array.isArray(stage.environment)) {
      const item = stage.environment.find(x => x.id === key);
      if (item) return item;
    }
    return null;
  },

  setActiveStage(stageId) {
    if (stageId) {
      if (typeof currentActiveStage !== "undefined") currentActiveStage = stageId;
      if (typeof window !== "undefined") window.__ACTIVE_STAGE = stageId;
    }
  },

  getCurrentStage() {
    if (typeof window !== "undefined") {
      if (window.__ACTIVE_STAGE) return window.__ACTIVE_STAGE;
      if (window.STAGE?.id) return window.STAGE.id;
      if (window.__CURRENT_STAGE) return window.__CURRENT_STAGE;
      // Before game initialization, honor the requested starting stage only.
      const raw = String(window.location?.search || "");
      const match = raw.match(/(?:^|[?&])stage=([^&#]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return (typeof currentActiveStage !== "undefined" ? currentActiveStage : "night-town");
  },

  isStageApproved(stageId) {
    return stageId === "night-town" || stageId === "rain-port";
  },

  getStageStatus(stageId) {
    const sId = stageId || this.getCurrentStage();
    if (sId === "night-town") {
      return Object.freeze({
        stageId: "night-town",
        status: "APPROVED",
        requiresDevFlags: false,
        source: "assets/img/scenery/",
        artStatus: "APPROVED",
        autoPass: true
      });
    }
    if (sId === "rain-port") {
      const raw = typeof window !== "undefined" ? String(window.location?.search || "") : "";
      const hasDev = /(?:^|[?&])dev=1(?=[&#]|$)/.test(raw);
      const isLegacy = hasDev && /(?:^|[?&])s2legacy=1(?=[&#]|$)/.test(raw);
      return Object.freeze({
        stageId: "rain-port",
        status: "APPROVED",
        requiresDevFlags: false,
        source: isLegacy ? "assets/img/rain-port/" : "assets/img/rain-port/s2-production/",
        artStatus: isLegacy ? "LEGACY_FALLBACK" : "APPROVED",
        s2ArtProdEnabled: isS2ArtProdEnabled(),
        s2GroundKitEnabled: isS2GroundKitEnabled(),
        autoPass: !isLegacy
      });
    }
    if (sId === "sakura-pass") {
      return Object.freeze({
        stageId: "sakura-pass",
        status: "BLOCKED",
        requiresDevFlags: false,
        source: null,
        artStatus: "STYLE_REFERENCE_ONLY",
        reason: "Assets purged 2026-10-24; new candidate awaiting approval; runtime unestablished",
        fallbackStage: "night-town",
        autoPass: false
      });
    }
    return Object.freeze({
      stageId: sId,
      status: "BLOCKED",
      requiresDevFlags: false,
      source: null,
      artStatus: "REFERENCE_ONLY_RESET_20261024",
      reason: "Stage art unestablished or purged",
      fallbackStage: "night-town",
      autoPass: false
    });
  },

  resolveBossHazardArt(kind) {
    const isWater = kind === "tide" || kind === "tidalFan" || kind === "rainVortex";
    const devGateActive = isBossHazardArtEnabled();
    const def = BOSS_HAZARD_ART_DEFS[kind] || null;
    if (isWater) {
      return Object.freeze({
        kind,
        status: devGateActive ? "DEV_CANDIDATE" : "BLOCKED",
        artStatus: "ART_CANDIDATE",
        blocked: !devGateActive,
        source: devGateActive ? (def?.source || null) : null,
        autoPass: false,
        reviewPending: true,
        limitations: def?.limitations || [],
        img: devGateActive ? (window.BOSS_HAZARD_ART_IMG?.[kind] || null) : null
      });
    }
    return Object.freeze({
      kind,
      status: devGateActive ? "DEV_CANDIDATE" : "DEFAULT_VFX",
      artStatus: def?.status || "DEFAULT_VFX",
      blocked: false,
      source: def?.source || null,
      autoPass: false,
      img: window.BOSS_HAZARD_ART_IMG?.[kind] || null
    });
  },

  resolveStageArt(stageId, category, key) {
    const sId = stageId || this.getCurrentStage();
    if (sId === "night-town") {
      const entry = this._findInManifest("night-town", key);
      if (!entry) {
        return Object.freeze({
          stageId: "night-town",
          key,
          category: category || "unknown",
          path: null,
          status: "MISSING",
          artStatus: "KEY_NOT_IN_MANIFEST",
          isFallback: false,
          error: `Asset ${key} not in night-town manifest`
        });
      }
      return Object.freeze({
        stageId: "night-town",
        key,
        category: category || entry.category || "scenery",
        path: entry.path,
        status: entry.status || "APPROVED",
        sourceStatus: entry.source_status || "RUNTIME_ACTIVE",
        runtimeStatus: entry.runtime_status || "APPROVED_RUNTIME",
        isFallback: false
      });
    }
    if (sId === "rain-port") {
      const raw = typeof window !== "undefined" ? String(window.location?.search || "") : "";
      const hasDev = /(?:^|[?&])dev=1(?=[&#]|$)/.test(raw);
      const isLegacy = hasDev && /(?:^|[?&])s2legacy=1(?=[&#]|$)/.test(raw);
      if (isLegacy) {
        return Object.freeze({
          stageId: "rain-port",
          key,
          category: category || "legacy",
          path: `assets/img/rain-port/${key}.webp?v=20261013-rain-port2`,
          status: "LEGACY_FALLBACK",
          isFallback: true
        });
      }
      // Query authoritative manifest directly
      const entry = this._findInManifest("rain-port", key);
      if (!entry) {
        return Object.freeze({
          stageId: "rain-port",
          key,
          category: category || "unknown",
          path: null,
          status: "MISSING",
          artStatus: "KEY_NOT_IN_MANIFEST",
          isFallback: false,
          error: `Asset ${key} not in rain-port manifest`
        });
      }
      return Object.freeze({
        stageId: "rain-port",
        key,
        category: category || entry.category,
        path: entry.path,
        status: entry.status === "APPROVED_RUNTIME" ? "APPROVED" : (entry.status || "APPROVED"),
        sourceStatus: entry.source_status,
        runtimeStatus: entry.runtime_status,
        isFallback: false
      });
    }
    if (sId === "sakura-pass") {
      return Object.freeze({
        stageId: "sakura-pass",
        key,
        category: category || "placeholder",
        path: `assets/img/scenery/${key === "ground" ? "ground_dirt" : key}.webp`,
        status: "BLOCKED",
        artStatus: "STYLE_REFERENCE_ONLY",
        reason: "Assets purged 2026-10-24; new candidate awaiting approval; runtime unestablished",
        isFallback: true,
        fallbackStage: "night-town"
      });
    }
    return Object.freeze({
      stageId: sId,
      key,
      category: category || "unknown",
      path: null,
      status: "BLOCKED",
      artStatus: "REFERENCE_ONLY_RESET_20261024",
      isFallback: true,
      fallbackStage: "night-town"
    });
  },

  resolveSharedArt(category, key, subKey) {
    const manifest = this.getManifestData();
    const cat = String(category || "").toLowerCase();

    // 1. Shared Skills
    if (cat === "skill" || cat === "skills" || cat === "shared_skills") {
      const skills = manifest?.shared_skills;
      if (!skills) {
        return Object.freeze({ category: "skills", key, path: null, status: "MANIFEST_UNAVAILABLE", isFallback: false });
      }
      const skill = skills[key];
      if (!skill) {
        return Object.freeze({ category: "skills", key, path: null, status: "MISSING", artStatus: "KEY_NOT_IN_MANIFEST", isFallback: false, error: `Skill ${key} not in shared manifest` });
      }
      let item = null;
      if (skill.levels && subKey && skill.levels[String(subKey)]) {
        item = skill.levels[String(subKey)];
      } else if (skill.variants) {
        if (typeof subKey === "string" && skill.variants[subKey]) {
          item = skill.variants[subKey];
        } else {
          for (const vGroup of Object.values(skill.variants)) {
            if (vGroup[subKey]) { item = vGroup[subKey]; break; }
          }
        }
      } else if (skill.tiers && subKey && skill.tiers[subKey]) {
        item = skill.tiers[subKey];
      } else if (skill.raster && subKey && skill.raster[subKey]) {
        item = skill.raster[subKey];
      } else if (skill.raster && !subKey && skill.raster.main) {
        item = skill.raster.main;
      } else if (!subKey && skill.levels && skill.levels["1"]) {
        item = skill.levels["1"];
      }
      if (item) {
        return Object.freeze({
          category: "skills",
          skillId: key,
          subKey: subKey || null,
          id: item.id || key,
          path: item.path,
          bytes: item.bytes,
          sha256: item.sha256,
          status: item.status || "APPROVED",
          runtimeStatus: "APPROVED_RUNTIME",
          isFallback: false
        });
      }
      return Object.freeze({
        category: "skills",
        skillId: key,
        subKey,
        path: null,
        status: "MISSING_VARIANT",
        error: `Variant ${subKey} for skill ${key} not found in manifest`
      });
    }

    // 2. Shared Actors
    if (cat === "actor" || cat === "actors" || cat === "shared_actors" || cat === "player" || cat === "enemy" || cat === "enemies") {
      const actors = manifest?.shared_actors;
      if (!actors) return Object.freeze({ category: "actors", key, path: null, status: "MANIFEST_UNAVAILABLE" });

      if (cat === "player" || key === "player") {
        const pActions = actors.player?.actions || {};
        const actKey = (cat === "player" ? key : subKey) || "base";
        const entry = pActions[actKey] || (actKey === "player" ? pActions.base : null);
        if (entry) {
          return Object.freeze({
            category: "actors",
            subCategory: "player",
            action: actKey,
            id: entry.id,
            path: entry.path,
            bytes: entry.bytes,
            sha256: entry.sha256,
            status: entry.status || "APPROVED",
            runtimeStatus: "APPROVED_RUNTIME",
            isFallback: false
          });
        }
        return Object.freeze({ category: "actors", subCategory: "player", action: actKey, path: null, status: "MISSING", error: `Player action ${actKey} not in manifest` });
      }

      if (cat === "enemy" || cat === "enemies" || key === "enemies") {
        const stageId = (cat === "enemy" || cat === "enemies") ? key : (subKey || "night-town");
        const enemyType = subKey || key;
        const eGroup = actors.enemies?.[stageId] || {};
        if (typeof enemyType === "string" && eGroup[enemyType]) {
          const entry = eGroup[enemyType];
          return Object.freeze({
            category: "actors",
            subCategory: "enemies",
            stageId,
            enemyType,
            idle: entry.idle,
            attack: entry.attack,
            status: entry.status || "APPROVED",
            runtimeStatus: "APPROVED_RUNTIME",
            isFallback: false
          });
        }
        return Object.freeze({ category: "actors", subCategory: "enemies", stageId, enemyType, path: null, status: "MISSING", error: `Enemy ${enemyType} for ${stageId} not in manifest` });
      }
    }

    // 3. Shared HUD
    if (cat === "hud" || cat === "ui" || cat === "shared_hud") {
      const hud = manifest?.shared_hud;
      if (!hud) return Object.freeze({ category: "hud", key, path: null, status: "MANIFEST_UNAVAILABLE" });

      let entry = null;
      let subCat = "core";
      if (subKey && hud[key] && hud[key][subKey]) {
        entry = hud[key][subKey];
        subCat = key;
      } else {
        for (const [sec, items] of Object.entries(hud)) {
          if (items[key]) {
            entry = items[key];
            subCat = sec;
            break;
          }
          for (const it of Object.values(items)) {
            if (it && (it.id === key || it.charmId === key || it.passiveId === key)) {
              entry = it;
              subCat = sec;
              break;
            }
          }
          if (entry) break;
        }
      }
      if (entry) {
        return Object.freeze({
          category: "hud",
          subCategory: subCat,
          key: subKey || key,
          id: entry.id || key,
          path: entry.path,
          bytes: entry.bytes,
          sha256: entry.sha256,
          status: entry.status || "APPROVED",
          runtimeStatus: "APPROVED_RUNTIME",
          isFallback: false
        });
      }
      return Object.freeze({ category: "hud", key, path: null, status: "MISSING", error: `HUD asset ${key} not in manifest` });
    }

    // 4. Fusion Candidates
    if (cat === "fusion" || cat === "fusion_candidates") {
      const fusions = manifest?.fusion_candidates;
      if (!fusions) return Object.freeze({ category: "fusion", key, path: null, status: "MANIFEST_UNAVAILABLE" });
      const fDef = fusions[key];
      if (!fDef) {
        return Object.freeze({ category: "fusion", recipeId: key, path: null, status: "MISSING", error: `Fusion ${key} not in manifest` });
      }
      const phase = subKey || "main";
      const pEntry = fDef.phases?.[phase];
      const isDevActive = typeof isFusionArtBindEnabled === "function" ? isFusionArtBindEnabled() : false;

      if (!pEntry) {
        return Object.freeze({
          category: "fusion",
          recipeId: key,
          phase,
          path: null,
          status: "MISSING_PHASE",
          blocked: true,
          fallback: fDef.fallback || "procedural_vector_emblem"
        });
      }

      if (isDevActive) {
        return Object.freeze({
          category: "fusion",
          recipeId: key,
          phase,
          name: fDef.name,
          parents: fDef.parents,
          aliasOf: pEntry.alias_of || null,
          candidateSource: pEntry.candidate_source,
          bytes: pEntry.bytes,
          sha256: pEntry.sha256,
          size: pEntry.size,
          bbox: pEntry.bbox,
          path: null,
          status: "DEV_CANDIDATE",
          artStatus: "ART_CANDIDATE",
          reviewStatus: "APPROVAL_PENDING",
          blocked: false,
          fallback: fDef.fallback || "procedural_vector_emblem"
        });
      }

      return Object.freeze({
        category: "fusion",
        recipeId: key,
        phase,
        name: fDef.name,
        parents: fDef.parents,
        aliasOf: pEntry.alias_of || null,
        candidateSource: null,
        path: null,
        status: "BLOCKED",
        artStatus: "ART_CANDIDATE",
        reviewStatus: "APPROVAL_PENDING",
        blocked: true,
        reason: "Fusion art is unapproved candidate; formal runtime URL not established",
        fallback: fDef.fallback || "procedural_vector_emblem"
      });
    }

    return Object.freeze({ category, key, path: null, status: "UNKNOWN_CATEGORY", isFallback: false });
  },

  getSharedArt(category, key, subKey) {
    return this.resolveSharedArt(category, key, subKey);
  }

});

if (typeof window !== "undefined") {
  window.STAGE_ART_RESOLVER = STAGE_ART_RESOLVER;
}


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
// One manifest resolver for BOTH combat renderers and UI cards.
window.sharedSkillRuntimePath = (id, phase = "main", level = 1) => {
  const skill = window.__RUNTIME_MANIFEST?.shared_skills?.[id];
  if (!skill) return null;
  const lv = String(Math.max(1, Math.min(5, Math.floor(level) || 1)));
  if (id === "katana") return skill.levels?.[lv]?.path || null;
  if (id === "fire") {
    const variant = skill.variants?.[phase];
    // Dragon phase uses a named Lv5 record unlike orbit/attack numeric tiers.
    const entry = variant?.[lv] || (phase === "dragon" && lv === "5" ? variant?.fire_dragon_l5 : null);
    return entry?.path || null;
  }
  if (id === "barrier") return skill.tiers?.[phase === "max" ? "core_lv5" : "core_main"]?.path || null;
  if (id === "boom" || id === "thunder" || id === "needle")
    return skill.raster?.[phase]?.path || null;
  return null;
};
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
  img.onerror = () => {
    skillLevelLoads.set(key, "missing"); markSettled(key, true);
    console.warn('[Assets] Skill raster unavailable:', key, img.src);
  };
  skillLevelLoads.set(key, "loading");
  const katana = /^katana_l([1-5])$/.exec(file);
  const fire = /^fire_(orbit|attack|dragon)_l([1-5])$/.exec(file);
  const canonical = katana ? window.sharedSkillRuntimePath("katana", "main", Number(katana[1]))
    : fire ? window.sharedSkillRuntimePath("fire", fire[1], Number(fire[2]))
    : file === "needle" ? window.sharedSkillRuntimePath("needle", "main", 1) : null;
  img.src = (canonical || "assets/img/vfx/raster/" + file + ".webp") + "?v=" + version;
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
  const phase = key === "barrier_core_lv5" ? "max" : "main";
  img.src = (window.sharedSkillRuntimePath("barrier", phase) || BARRIER_RASTER_FILES[key]) + "?v=20261027-unified-skill1";
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
  img.src = (window.sharedSkillRuntimePath("boom", kind) || path) + "?v=20261027-unified-skill1";
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
 img.src=(window.sharedSkillRuntimePath("thunder", kind) || "assets/img/vfx/"+file)+"?v=20261027-unified-skill1";
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
// BOSS-IMAGE-PROD-R2：跨關 Boss hazard 圖片技術候選。
// 獨立 DEV gate：dev=1 && bossart=1；不借用 rain-port / fusion 的 gate。
// 全部來源皆為既有手繪 raster 的 ART_CANDIDATE；未經使用者 ART_PASS 不得升正式。
// BOSS 危險圖片契約：
// - defs=BOSS_HAZARD_ART：危險圖片定義（slam/charge/ring/tide）
// - 圖片=BOSS_HAZARD_ART_IMG：渲染用的圖片實例
// - gate=isBossHazardArtEnabled dev=1&bossart=1：僅在 URL 參數 dev=1&bossart=1 時啟用
window.BOSS_HAZARD_ART_IMG = {};
window.BOSS_HAZARD_ART_STATUS = {};
const BOSS_HAZARD_ART_DEFS = Object.freeze({
  slam: Object.freeze({
    source: "assets/img/vfx/raster/dragon_burning_ground_l5.webp",
    bbox: Object.freeze([10, 53, 631, 583]),
    width: 640, height: 640,
    status: "ART_CANDIDATE",
    note: "火裂地；slam 主體候選"
  }),
  charge: Object.freeze({
    source: "assets/img/vfx/raster/dragon_fireball_l5.webp",
    bbox: Object.freeze([18, 77, 498, 445]),
    width: 512, height: 512,
    status: "ART_CANDIDATE",
    note: "火球尾流；charge 方向帶候選"
  }),
  ring: Object.freeze({
    source: "assets/img/vfx/raster/katana_l5.webp",
    bbox: Object.freeze([21, 117, 1250, 1131]),
    width: 1254, height: 1254,
    status: "ART_CANDIDATE",
    note: "金墨月牙；ring 帶內多向旋轉複用，避免單向只覆蓋右側"
  }),
  tide: Object.freeze({
    source: "assets/img/vfx/boss-water-r8/tide_v03.webp",
    bbox: Object.freeze([0, 117, 1254, 1061]),
    width: 1254, height: 1254,
    sha256: "97d3ad48024a8cc5485a0b247eedb760bb2abc29aad304ab963498c160bf4cc4",
    provenance: "assets/img/vfx/boss-water-r8/tide_v03.png",
    status: "ART_CANDIDATE",
    note: "潮汐浪帶；Two-Bank裁切 left[0..559] right[737..1254]，中央25px α=0走廊非動態safeOffset依據",
    limitations: ["VISIBLE_MARGIN_2PX", "CORRIDOR_25PX_ALPHA0", "LOW_ALPHA_FRINGE_178PX", "USER_ART_REVIEW_PENDING"]
  }),
  tidalFan: Object.freeze({
    source: "assets/img/vfx/boss-water-r8/tidalFan_v01.webp",
    bbox: Object.freeze([12, 164, 1247, 1118]),
    width: 1254, height: 1254,
    sha256: "b887523723d213d465ebdd2d01bde84f925e0635e7939b996c5248a5fd47317f",
    provenance: "assets/img/vfx/boss-water-r8/tidalFan_v01.png",
    status: "ART_CANDIDATE",
    note: "潮汐扇面；源圖160度需裁切至判定120度(±PI/3)，apex(617,1117) reach 971px",
    limitations: ["VISIBLE_MARGIN_7PX", "SOURCE_160DEG_VS_HITBOX_120DEG", "EDGE_TOUCHES_LEFT_RIGHT_BOTTOM", "USER_ART_REVIEW_PENDING"]
  }),
  rainVortex: Object.freeze({
    source: "assets/img/vfx/boss-water-r8/rainVortex_v01.webp",
    bbox: Object.freeze([37, 39, 1226, 1227]),
    width: 1254, height: 1254,
    sha256: "bc950af55b0b3ab4cef25d961f61da3ba9ee1520b2a8b3696c105b2e7bd5fe12",
    provenance: "assets/img/vfx/boss-water-r8/rainVortex_v01.png",
    status: "ART_CANDIDATE",
    note: "雨夜渦流；地面漩渦需tilt=0.60投影、水柱billboard直立，整圖含地面+水柱需分層",
    limitations: ["VISIBLE_MARGIN_27PX", "COMBINED_GROUND_AND_COLUMN", "TEST_PLAN_PENDING_PERSPECTIVE", "USER_ART_REVIEW_PENDING"]
  })
});
window.BOSS_HAZARD_ART = BOSS_HAZARD_ART_DEFS;
window.BOSS_HAZARD_ART_MISSING = Object.freeze({
  // tide, tidalFan, rainVortex now have DEV candidates in boss-water-r8/
  // Status: ART_CANDIDATE with TECH_LIMITATIONS, USER_ART_REVIEW_PENDING
});
const isBossHazardArtEnabled = () => {
  const search = typeof window !== "undefined" && window.location
    ? String(window.location.search || "")
    : "";
  // Prefer shipped PNG/WebP boss spells in normal play, all stages.
  // Local bossart=0 remains a diagnostic-only legacy comparison.
  const disableForLocalDebug = window.DEV_MODE?.isDevMode?.(window.location) === true
    && /(?:^|[?&])bossart=0(?=[&#]|$)/.test(search);
  return !disableForLocalDebug;
};
window.isBossHazardArtEnabled = isBossHazardArtEnabled;
window.BOSS_HAZARD_ART_ENABLED = isBossHazardArtEnabled();
const bossHazardArtRequested = new Set();
function loadBossHazardArt() {
  if (!isBossHazardArtEnabled() || typeof Image !== "function") return;
  for (const [kind, def] of Object.entries(BOSS_HAZARD_ART_DEFS)) {
    if (bossHazardArtRequested.has(kind)) continue;
    bossHazardArtRequested.add(kind);
    window.BOSS_HAZARD_ART_STATUS[kind] = "loading";
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      window.BOSS_HAZARD_ART_IMG[kind] = img;
      window.BOSS_HAZARD_ART_STATUS[kind] = "ready";
    };
    img.onerror = () => { window.BOSS_HAZARD_ART_STATUS[kind] = "error"; };
    img.src = `${def.source}?v=20261027-runtimeboss2`;
  }
}
window.refreshBossHazardArt = loadBossHazardArt;
if (isBossHazardArtEnabled()) loadBossHazardArt();

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
const RAIN_PORT_CANDIDATE_ASSETS = Object.freeze({
  fishWorkshop: "assets/img/rain-port/port_fish_workshop_cutout_candidate.png",
  weatheredWarehouse: "assets/img/rain-port/port_weathered_warehouse_cutout_candidate.png"
});
const RAIN_PORT_SURFACE_CANDIDATE_ASSETS = Object.freeze({
  stoneV3: "assets/img/rain-port/ground_stone_nano_v3_seamless.png",
  stoneReflection: "assets/img/rain-port/ground_stone_reflection_candidate.jpg",
  harborSea: "assets/img/rain-port/port_harbor_sea_norain_candidate.png",
  stoneWoodTransition: "assets/img/rain-port/ground_trans_stone_wood_candidate.png",
  northCliff: "assets/img/rain-port/port_north_cliff_candidate.png"
});
// DEV-ONLY: Stage2 Rain-Port coast kit (dev=1 && stage=rain-port && s2ground=kit).
// Only the two backdrop images the kit actually paints:
//   coastSea   = real ukiyo-e sea texture (tileable, 512x512 webp)
//   coastCliff = bright RGBA rock with wave foam at its base (shoreline scenery object)
// The old portsurfacecandidate set (stoneV3 / stoneReflection / legacy transition / dark
// north cliff silhouette) stays exclusive to that older gate, so the kit never downloads
// three images it does not paint.
const RAIN_PORT_COAST_KIT_ASSETS = Object.freeze({
  coastSea: "assets/img/rain-port/s2-production/environment/surface_sea_canonical.webp",
  coastCliff: "assets/img/rain-port/s2-production/environment/cliff_north_rock.webp"
});
const COAST_KIT_ROLES = new Set(Object.keys(RAIN_PORT_COAST_KIT_ASSETS));
const portCatalog = () => ({
  ...RAIN_PORT_ASSETS,
  ...RAIN_PORT_FISH,
  ...RAIN_PORT_GROUND,
  ...(isPortArtCandidateEnabled() ? RAIN_PORT_CANDIDATE_ASSETS : {}),
  ...(isPortSurfaceCandidateEnabled() ? RAIN_PORT_SURFACE_CANDIDATE_ASSETS : {}),
  ...(window.isS2GroundKitEnabled?.() ? RAIN_PORT_COAST_KIT_ASSETS : {})
});
const portRequested = new Set();
function loadPortSprites(roles) {
  if (typeof Image !== "function") return;
  const table = portCatalog();
  for (const role of roles || Object.keys(table)) {
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
      // Coast kit images arrive async: the terrain cache must be invalidated, otherwise the
      // port keeps showing the pre-artwork dark bands until something else forces a rebuild.
      if (COAST_KIT_ROLES.has(role)) {
        try { window.RENDERER?.invalidateGroundCache?.(); } catch { /* renderer not ready yet */ }
      }
    };
    img.onerror = () => {
      window.PORT_ART_STATUS[role] = "error";
      if (role in RAIN_PORT_CANDIDATE_ASSETS) {
        window.PORT_ART_STATUS[role] = "missing";
        const st = window.STAGE_ART_STATUS?.["rain-port"];
        if (st) {
          const candidateKey = role === "fishWorkshop" ? "port_fish_workshop_candidate" : "port_weathered_warehouse_candidate";
          if (!st.missing.includes(candidateKey)) st.missing.push(candidateKey);
          const fbKey = role === "fishWorkshop" ? "port_fishmonger" : "port_warehouse";
          if (!st.fallback.some(f => f.key === candidateKey)) st.fallback.push({ key: candidateKey, fallback: fbKey });
        }
      }
    };
    img.src = `${url}?v=20261019-candidate1`;
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
window.refreshPortArt = (force = false) => {
  if (force) {
    portRequested.clear();
  }
  loadPortSprites(Object.keys(portCatalog()));
  loadPortEnemies();
};

// DEV-ONLY readable evidence for the coast kit (network + decode, not draw counts).
// Draw counts live in the renderer (window.RENDERER.s2CoastDrawEvidence).
if (typeof window !== "undefined") {
  window.__S2_COAST_KIT_EVIDENCE = () => ({
    enabled: !!window.isS2GroundKitEnabled?.(),
    roles: Object.entries(RAIN_PORT_COAST_KIT_ASSETS).map(([role, file]) => {
      const img = window.PORT_ART?.[role];
      return {
        role,
        file,
        status: window.PORT_ART_STATUS?.[role] || "not_requested",
        loaded: !!img?.naturalWidth,
        w: img?.naturalWidth || 0,
        h: img?.naturalHeight || 0,
        src: img?.currentSrc || img?.src || null
      };
    })
  });
}

// Stage 3 terrain uses ONE dirt base + independent transparent stone-path sprites.
// Stone paths are scene decals: never repeat a complete masonry texture as ground.
// Candidates remain local-preview only until art sign-off / runtime import.
window.SAKURA_ART = {};
window.SAKURA_ART_STATUS = {};
const SAKURA_GROUND_ASSETS = Object.freeze({
  dirt: "assets/img/sakura-pass/s3_dirt.webp",
  stoneStraight: "assets/img/sakura-pass/s3_stone_straight.webp",
  stoneLeft: "assets/img/sakura-pass/s3_stone_left.webp",
  stoneRight: "assets/img/sakura-pass/s3_stone_right.webp",
  stoneBroken: "assets/img/sakura-pass/s3_stone_broken.webp",
  stoneSparse: "assets/img/sakura-pass/s3_stone_sparse.webp",
  stoneMixed: "assets/img/sakura-pass/s3_stone_mixed.webp"
});
// Never attempt unapproved/absent candidates on a normal game entry.
window.isSakuraCandidateEnabled = () => {
  if (!window.DEV_MODE?.isDevMode?.(window.location)) return false;
  return new URLSearchParams(window.location?.search || "").get("s3art") === "1";
};
const sakuraRequested = new Set();
window.refreshSakuraArt = () => {
  if (typeof Image !== "function") return;
  if (!window.isSakuraCandidateEnabled()) {
    if (!sakuraRequested.has("dirt")) {
      sakuraRequested.add("dirt");
      const fallback = new Image();
      fallback.onload = () => {
        window.SAKURA_ART.dirt = fallback;
        window.SAKURA_ART_STATUS.dirt = "fallback_stage1_dirt";
      };
      fallback.src = "assets/img/scenery/ground_dirt.webp";
    }
    return;
  }
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
    img.onerror = () => {
      window.SAKURA_ART_STATUS[role] = "candidate_not_imported";
      if (role !== "dirt") return; // no fake stone ground from another stage
      const fallback = new Image();
      fallback.onload = () => {
        window.SAKURA_ART.dirt = fallback;
        window.SAKURA_ART_STATUS.dirt = "fallback_stage1_dirt";
      };
      fallback.src = "assets/img/scenery/ground_dirt.webp";
    };
    img.src = `${url}?v=20261027-s3-decal1`;
  }
};
// Candidate scenery names are shared by all Stage3 consumers, but missing candidates
// keep existing approved placeholder scenery (no unreviewed image is published).
const SAKURA_SCENE_ASSETS = Object.freeze({
  pavilion: "assets/img/sakura-pass/s3_shrine_hall.webp",
  teaHouse: "assets/img/sakura-pass/s3_tea_house.webp",
  mountainHouse: "assets/img/sakura-pass/s3_mountain_house.webp",
  storehouse: "assets/img/sakura-pass/s3_storage_hut.webp",
  worshipHall: "assets/img/sakura-pass/s3_worship_hall.webp",
  stoneLantern: "assets/img/sakura-pass/s3_stone_lantern.webp",
  torii: "assets/img/sakura-pass/s3_torii_large.webp",
  fence: "assets/img/sakura-pass/s3_wood_fence.webp",
  marker: "assets/img/sakura-pass/s3_stone_marker.webp",
  mossRocks: "assets/img/sakura-pass/s3_moss_rocks.webp",
  ancientSakura: "assets/img/scenery/prop_sakura.webp"
});
const sakuraSceneRequested = new Set();
window.refreshSakuraScene = () => {
  if (typeof Image !== "function") return;
  if (!window.isSakuraCandidateEnabled()) {
    if (!sakuraSceneRequested.has("pavilion")) {
      sakuraSceneRequested.add("pavilion");
      const fallback = new Image();
      fallback.onload = () => {
        window.SAKURA_ART.pavilion = fallback;
        window.SAKURA_ART_STATUS.pavilion = "fallback_stage1_pavilion";
      };
      fallback.src = "assets/img/scenery/house_shrine.webp";
    }
    return;
  }
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
    img.onerror = () => {
      window.SAKURA_ART_STATUS[role] = "candidate_not_imported";
      if (role !== "pavilion") return;
      const fallback = new Image();
      fallback.onload = () => {
        window.SAKURA_ART.pavilion = fallback;
        window.SAKURA_ART_STATUS.pavilion = "fallback_stage1_pavilion";
      };
      fallback.src = "assets/img/scenery/house_shrine.webp";
    };
    img.src = `${url}?v=20261027-s3-buildings1`;
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
window.loadStageAssets = loadStageAssets;

// 載入特定關卡的場景、轉場、專屬敵人/Boss 資產
// 缺圖回落現役共用資產，標記 WAITING_ART；不阻塞遊戲進場
function loadStageAssets(stageId) {
  // Shared player action and skill art never originate from a stage-specific directory.
  window.SPRITECOOK_DEV?.load?.();
  // Fusion previews load their phases only when shown/cast, avoiding 40 initial image requests.
  if (stageId) {
    if (typeof window !== "undefined") window.__ACTIVE_STAGE = stageId;
    if (typeof STAGE_ART_RESOLVER !== "undefined" && STAGE_ART_RESOLVER.setActiveStage) {
      STAGE_ART_RESOLVER.setActiveStage(stageId);
    }
  }
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
    const isPort = stageId === "rain-port" && (
      key.startsWith("ground_") || key.startsWith("port_") || key.startsWith("prop_") || key.startsWith("vfx_")
    );
    const isScene = SCENERY_ASSET_KEYS.has(key);
    const isYokai = YOKAI_ASSET_KEYS.has(key);
    img.src = isPort
      ? `assets/img/rain-port/${key}.webp?v=20261013-rain-port2`
      : isScene
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

  if (stageId === "rain-port") {
    if (typeof window !== "undefined" && window.isS2ArtProdEnabled?.() && window.loadS2ArtProdAssets) void window.loadS2ArtProdAssets();
    if (window.isS2GroundKitEnabled?.()) void window.loadS2GroundKit?.();
    if (typeof window !== "undefined" && window.refreshPortArt) window.refreshPortArt();
    // The approved production manifest already contains cliff_north_rock.
    // Do not unconditionally report the old mountain_cliff as missing.
    if (isPortArtCandidateEnabled()) {
      if (!window.PORT_ART?.fishWorkshop?.naturalWidth && !status.missing.includes("port_fish_workshop_candidate")) {
        status.missing.push("port_fish_workshop_candidate");
      }
      if (!window.PORT_ART?.weatheredWarehouse?.naturalWidth && !status.missing.includes("port_weathered_warehouse_candidate")) {
        status.missing.push("port_weathered_warehouse_candidate");
      }
    }
    if (isPortSurfaceCandidateEnabled()) {
      if (!window.PORT_ART?.stoneV3?.naturalWidth && !status.missing.includes("ground_stone_nano_v3_seamless")) {
        status.missing.push("ground_stone_nano_v3_seamless");
      }
      if (!window.PORT_ART?.harborSea?.naturalWidth && !status.missing.includes("port_harbor_sea_surface")) {
        status.missing.push("port_harbor_sea_surface");
      }
    }
    if (isFusionCandidateEnabled()) {
      loadFusionCandidateArt();
      if (!status.missing.includes("fusion_inkblade_arc")) status.missing.push("fusion_inkblade_arc");
      if (!status.missing.includes("fusion_thundercircle_mark")) status.missing.push("fusion_thundercircle_mark");
    }
  }

  // Stage8 preview: load preview assets from art/ candidate (not production assets/img/)
  // Only runs when STAGE8_PREVIEW_ENABLED and asset file exists
  if (STAGE8_PREVIEW_ENABLED && stageId === "yomi") {
    loadStage8PreviewAssets(status);
  }
}

// F1-A-ART-COMPARE: 延遲載入合技美術候選檔 (banana | gpt | legacy)
// 規則：僅在精確 isFusionCandidateEnabled() 為 true 且 mode !== "legacy" 時執行延遲載入
// 正常遊戲不進行任何合技候選圖請求；無圖或無 alpha 檔時安全回落 legacy
function loadFusionCandidateArt(forceRetry = false) {
  if (typeof window === "undefined") return;
  const mode = getFusionArtMode();
  if (!window.FUSION_ART_STATUS) {
    window.FUSION_ART_STATUS = { mode: "legacy", banana: "unloaded", gpt: "unloaded", legacy: "ready" };
  }
  window.FUSION_ART_STATUS.mode = mode;
  if (mode === "legacy" || !isFusionCandidateEnabled()) {
    return;
  }

  if (mode === "banana") {
    if (!forceRetry && (window.FUSION_ART_STATUS.banana === "ready" || window.FUSION_ART_STATUS.banana === "loading")) return;
    window.FUSION_ART_STATUS.banana = "loading";
    const cfg = FUSION_ART_CANDIDATE_CONFIG.banana;
    // 優先載入透明 alpha 候選檔 (banana_inkblade_alpha_candidate_v01.webp / main_alpha_candidate_v01.webp)
    const tryAlpha = (srcPath, fallbackFn) => {
      const alphaImg = new Image();
      alphaImg.decoding = "async";
      alphaImg.onload = () => {
        if (alphaImg.naturalWidth > 0 && alphaImg.naturalHeight > 0) {
          window.FUSION_ART.banana = alphaImg;
          window.FUSION_ART_STATUS.banana = "ready";
        } else {
          fallbackFn();
        }
      };
      alphaImg.onerror = () => {
        fallbackFn();
      };
      alphaImg.src = srcPath + "?v=dev-cand";
    };

    tryAlpha(cfg.alphaFile, () => {
      if (cfg.alphaFallbackFile && cfg.alphaFallbackFile !== cfg.alphaFile) {
        tryAlpha(cfg.alphaFallbackFile, checkBananaRawFallback);
      } else {
        checkBananaRawFallback();
      }
    });

    function checkBananaRawFallback() {
      // 檢查原始圖 main_v01.png。
      // 【真圖規範】：main_v01.png 帶有實心矩形背景，無 alpha；不可直接當透明遊戲貼圖！
      // 僅標記 waiting_alpha，保持 FUSION_ART.banana = null，安全回落 legacy。
      const rawImg = new Image();
      rawImg.decoding = "async";
      rawImg.onload = () => {
        window.FUSION_ART_STATUS.banana = "waiting_alpha";
        window.FUSION_ART.banana = null;
      };
      rawImg.onerror = () => {
        window.FUSION_ART_STATUS.banana = "missing";
        window.FUSION_ART.banana = null;
      };
      rawImg.src = cfg.rawFile + "?v=dev-cand";
    }
  } else if (mode === "gpt") {
    if (!forceRetry && (window.FUSION_ART_STATUS.gpt === "waiting_alpha" || window.FUSION_ART_STATUS.gpt === "loading")) return;
    window.FUSION_ART_STATUS.gpt = "loading";
    const cfg = FUSION_ART_CANDIDATE_CONFIG.gpt;

    // 【品質 Gate 阻塞】：matte-eval 實測 GPT alpha 殘留 21.42% 紙底／暗角，評定 NOT_USABLE。
    // GPT 原始圖已由本機離線檢查，禁止為了檢查存在而下載 3.4MB 帶紙底原圖。
    // 無可用 cutout 時立即標記 waiting_alpha，安全回落 legacy；不動用使用者流量。
    if (!cfg.usable) {
      window.FUSION_ART_STATUS.gpt = "waiting_alpha";
      window.FUSION_ART.gpt = null;
      return;
    }

    // 若未來品質 Gate 重新通過 (cfg.usable === true)
    const alphaImg = new Image();
    alphaImg.decoding = "async";
    alphaImg.onload = () => {
      if (alphaImg.naturalWidth > 0 && alphaImg.naturalHeight > 0) {
        window.FUSION_ART.gpt = alphaImg;
        window.FUSION_ART_STATUS.gpt = "ready";
      } else {
        checkGptRawFallback();
      }
    };
    alphaImg.onerror = () => {
      checkGptRawFallback();
    };
    alphaImg.src = cfg.alphaFile + "?v=dev-cand";

    function checkGptRawFallback() {
      const rawImg = new Image();
      rawImg.decoding = "async";
      rawImg.onload = () => {
        window.FUSION_ART_STATUS.gpt = "waiting_alpha";
        window.FUSION_ART.gpt = null;
      };
      rawImg.onerror = () => {
        window.FUSION_ART_STATUS.gpt = "missing";
        window.FUSION_ART.gpt = null;
      };
      rawImg.src = cfg.rawFile + "?v=dev-cand";
    }
  }
}

// M2-FUSION: 通用合技候選貼圖延遲載入 (art/fusion/candidates/<id>/main_alpha_candidate_v01.webp)
// 規則：僅在 isFusionCandidateEnabled() 為 true 時載入；缺圖安全標記 missing / null，不崩潰
function loadFusionKindArt(kind) {
  if (typeof window === "undefined" || !isFusionCandidateEnabled()) return null;
  if (!kind || typeof kind !== "string") return null;
  if (kind === "fusion_inkblade") {
    loadFusionCandidateArt();
    const mode = getFusionArtMode();
    return window.FUSION_ART?.[mode] || null;
  }
  if (!window.FUSION_ART) window.FUSION_ART = {};
  if (!window.FUSION_ART_STATUS) window.FUSION_ART_STATUS = {};

  if (window.FUSION_ART[kind] && window.FUSION_ART[kind].naturalWidth > 0) {
    return window.FUSION_ART[kind];
  }
  if (window.FUSION_ART_STATUS[kind] === "loading" || window.FUSION_ART_STATUS[kind] === "missing") {
    return null;
  }

  window.FUSION_ART_STATUS[kind] = "loading";
  const candidatePath = "art/fusion/candidates/" + kind + "/main_alpha_candidate_v02.webp";
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      window.FUSION_ART[kind] = img;
      window.FUSION_ART_STATUS[kind] = "ready";
    } else {
      window.FUSION_ART[kind] = null;
      window.FUSION_ART_STATUS[kind] = "missing";
    }
  };
  img.onerror = () => {
    window.FUSION_ART[kind] = null;
    window.FUSION_ART_STATUS[kind] = "missing";
  };
  img.src = candidatePath + "?v=dev-cand-v02";
  return null;
}

if (typeof window !== "undefined") {
  window.loadFusionCandidateArt = loadFusionCandidateArt;
  window.loadFusionKindArt = loadFusionKindArt;
}

// Load Stage8 preview assets from art/stage8-yomi/sliced_v2/ (connected-component extracted clean props)
// Source: irregular 1448x1086 sprite sheet -> 357 connected components -> 47 clean isolated props
// Ground tiles and path tiles DISABLED (were rectangular artifacts with pale soil borders)
// Falls back gracefully when extracted files are absent
function loadStage8PreviewAssets(status) {
  const keys = STAGE8_PREVIEW_KEYS;
  const basePath = "art/stage8-yomi/sliced_v2/";

  const tryLoadPreview = (key, filename) => {
    if (!key || requestedArt.has(key)) return;
    const img = new Image();
    img.fetchPriority = "low";
    img.decoding = "async";
    img.onload = () => {
      // Accept any valid dimensions - these are individual extracted clean props
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        ART[key] = img;
        markSettled(key);
        status.loaded.push(key);
      } else {
        console.warn(`[Stage8 Preview] ${key} has invalid dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
        status.missing.push(key);
        markSettled(key, true);
      }
    };
    img.onerror = () => {
      console.warn(`[Stage8 Preview] Failed to load ${key} from ${basePath}${filename}`);
      status.missing.push(key);
      markSettled(key, true);
    };
    requestedArt.add(key);
    // Load from art/ candidate sliced_v2 directory, NOT production assets/img/
    img.src = `${basePath}${filename}?v=dev-preview`;
  };

  // Load ONLY clean isolated props (47 items) - NO ground tiles, NO path tiles
  keys.props.forEach((key, i) => {
    tryLoadPreview(key, `clean_prop_${i}.png`);
  });
}
// 旅路角色採用新圖，但保持地圖進入速度；只在實際繪圖時背景下載。
let mapPlayerRequested = false;
window.loadMapPlayerArt = () => {
  if (mapPlayerRequested) return;
  mapPlayerRequested = true;
  window.SPRITECOOK_DEV?.load?.();
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
  window.SPRITECOOK_DEV?.load?.();
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
