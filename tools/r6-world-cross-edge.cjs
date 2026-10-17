#!/usr/bin/env node
/**
 * tools/r6-world-cross-edge.cjs
 * 量「世界座標裡真正相鄰」的四向接縫，而不是只量每張圖自己的 self-edge。
 * 相容候選只在 art/ 時標 CANDIDATE_NOT_WIRED，不讀作者的 compat_seam_metrics.json 當結果。
 * 不改 production JS、美術、音檔。
 *
 * 用法：node tools/r6-world-cross-edge.cjs
 * 退出碼：0 = 量測完成（可以是 REVIEW / BLOCKED）；2 = 量測失敗。
 * 退出碼 0 不是美術通過，也不是 cross-compat 已接入。
 */
'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const edge = require('./r6-ground-edge.cjs');
const { decodePNG } = require('./r6-png.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'validation', 'r6');
const PNG_DIR = path.join(OUT_DIR, 'world-cross-decode');
const REPORT = path.join(OUT_DIR, 'world-cross-edge.json');
const ENEMY_GATE = path.join(OUT_DIR, 'enemy-boss-gate.json');

const COMPAT = Object.freeze({
  stoneMaster: 'art/stage2-rain-port/scene/G_ground_stone_master.webp',
  stoneV1: 'art/stage2-rain-port/scene/G_ground_stone_compat_v1.webp',
  woodMaster: 'art/stage2-rain-port/scene/G_ground_wood_master.webp',
  woodV1: 'art/stage2-rain-port/scene/G_ground_wood_compat_v1.webp',
  woodV2: 'art/stage2-rain-port/scene/G_ground_wood_compat_v2.webp',
  transH: 'art/stage2-rain-port/scene/G_trans_stone_wood_h_compat.webp',
  transV: 'art/stage2-rain-port/scene/G_trans_stone_wood_v_compat.webp',
  harborPreview: 'art/stage2-rain-port/Preview_tiled_4x4_harbor_compat.webp',
  stonePreview: 'art/stage2-rain-port/Preview_tiled_4x4_stone_compat.webp',
});

const ENEMY = Object.freeze({
  minionIdle: 'art/stage2-rain-port/characters/E_shiome_idle_v1.png',
  minionAttack: 'art/stage2-rain-port/characters/E_shiome_attack_v1.png',
  bossIdle: 'art/stage2-rain-port/characters/B_ikari_idle_v1.png',
  bossAttack: 'art/stage2-rain-port/characters/B_ikari_attack_v1.png',
  minionIdleWebp: 'art/stage2-rain-port/characters/E_shiome_idle_v1.webp',
  minionAttackWebp: 'art/stage2-rain-port/characters/E_shiome_attack_v1.webp',
  bossIdleWebp: 'art/stage2-rain-port/characters/B_ikari_idle_v1.webp',
  bossAttackWebp: 'art/stage2-rain-port/characters/B_ikari_attack_v1.webp',
});

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function ffmpegBin() {
  const found = [];
  if (process.env.FFMPEG_PATH) found.push(process.env.FFMPEG_PATH);
  found.push('C:\\ffmpeg\\bin\\ffmpeg.exe', 'ffmpeg');
  for (const bin of found) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'pipe' });
      return bin;
    } catch {}
  }
  throw new Error('找不到 ffmpeg，無法把 webp 解成可量測的 PNG');
}

function decodeWebp(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`缺少圖片 ${rel}`);
  const webp = fs.readFileSync(abs);
  const hash = sha256(webp);
  const base = path.basename(rel, path.extname(rel));
  const pngPath = path.join(PNG_DIR, `${base}.png`);
  const side = path.join(PNG_DIR, `${base}.sha256`);
  fs.mkdirSync(PNG_DIR, { recursive: true });
  if (!(fs.existsSync(pngPath) && fs.existsSync(side) && fs.readFileSync(side, 'utf8').trim() === hash)) {
    execFileSync(ffmpegBin(), ['-y', '-i', abs, '-frames:v', '1', pngPath], { stdio: 'pipe' });
    fs.writeFileSync(side, hash);
  }
  return { rel, hash, bytes: webp.length, image: decodePNG(fs.readFileSync(pngPath), base) };
}

function decodeFile(rel) {
  if (rel.endsWith('.png')) {
    const abs = path.join(ROOT, rel);
    const buf = fs.readFileSync(abs);
    return { rel, hash: sha256(buf), bytes: buf.length, image: decodePNG(buf, path.basename(rel)) };
  }
  return decodeWebp(rel);
}

function round2(n) {
  return +n.toFixed(2);
}

function rowDelta(imgA, rowA, imgB, rowB) {
  const w = Math.min(imgA.width, imgB.width);
  const a = imgA.data;
  const b = imgB.data;
  let sum = 0;
  let max = 0;
  for (let x = 0; x < w; x++) {
    const ia = (rowA * imgA.width + x) * 4;
    const ib = (rowB * imgB.width + x) * 4;
    const d = (Math.abs(a[ia] - b[ib]) + Math.abs(a[ia + 1] - b[ib + 1]) + Math.abs(a[ia + 2] - b[ib + 2])) / 3;
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / w, max, samples: w };
}

function columnDelta(img, xLeft, xRight) {
  const h = img.height;
  const data = img.data;
  let sum = 0;
  let max = 0;
  for (let y = 0; y < h; y++) {
    const left = (y * img.width + xLeft) * 4;
    const right = (y * img.width + xRight) * 4;
    const d = (Math.abs(data[left] - data[right]) + Math.abs(data[left + 1] - data[right + 1]) + Math.abs(data[left + 2] - data[right + 2])) / 3;
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / h, max, samples: h };
}

function locate(worldY, size) {
  const tile = Math.floor(worldY / size);
  const local = worldY - tile * size;
  const row = Math.min(size - 1, Math.max(0, Math.floor(local)));
  return {
    tile,
    local: round2(local),
    row,
    interior: row > 0 && row < size - 1,
  };
}

/** 與 js/world.js、js/renderer.js 同一條岸線：奇數 cy，chunk 底往上 256。 */
function shoreGeometry(cy, spacingScaleY) {
  const chunkH = 600 * spacingScaleY;
  const chunkY = cy * chunkH;
  const hasShore = ((cy % 2) + 2) % 2 === 1;
  return {
    cy,
    spacingScaleY,
    chunkY,
    chunkH,
    hasShore,
    shoreTop: chunkY + chunkH - 256,
  };
}

function neighborPairs(cells) {
  const at = new Map(cells.map(cell => [`${cell.tx},${cell.ty}`, cell.role]));
  const pairs = [];
  for (const cell of cells) {
    const right = at.get(`${cell.tx + 1},${cell.ty}`);
    const below = at.get(`${cell.tx},${cell.ty + 1}`);
    if (right !== undefined) {
      pairs.push({
        dir: 'E',
        axis: 'horizontal',
        tx: cell.tx,
        ty: cell.ty,
        a: cell.role,
        b: right,
        label: cell.role === right ? 'SELF_EDGE' : 'CROSS_EDGE',
      });
    }
    if (below !== undefined) {
      pairs.push({
        dir: 'S',
        axis: 'vertical',
        tx: cell.tx,
        ty: cell.ty,
        a: cell.role,
        b: below,
        label: cell.role === below ? 'SELF_EDGE' : 'CROSS_EDGE',
      });
    }
  }
  return pairs;
}

function flatBlocks(img, block = 64) {
  let blocks = 0;
  let flat = 0;
  let considered = 0;
  const stds = [];
  for (let y = 0; y + block <= img.height; y += block) {
    for (let x = 0; x + block <= img.width; x += block) {
      blocks += 1;
      let opaque = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let yy = 0; yy < block; yy++) {
        for (let xx = 0; xx < block; xx++) {
          const i = ((y + yy) * img.width + (x + xx)) * 4;
          if (img.data[i + 3] < 16) continue;
          opaque += 1;
          sr += img.data[i];
          sg += img.data[i + 1];
          sb += img.data[i + 2];
        }
      }
      if (opaque < block * block * 0.2) continue;
      considered += 1;
      const mr = sr / opaque;
      const mg = sg / opaque;
      const mb = sb / opaque;
      let v = 0;
      for (let yy = 0; yy < block; yy++) {
        for (let xx = 0; xx < block; xx++) {
          const i = ((y + yy) * img.width + (x + xx)) * 4;
          if (img.data[i + 3] < 16) continue;
          v += (img.data[i] - mr) ** 2 + (img.data[i + 1] - mg) ** 2 + (img.data[i + 2] - mb) ** 2;
        }
      }
      const std = Math.sqrt(v / (3 * opaque));
      stds.push(std);
      if (std < 6) flat += 1;
    }
  }
  stds.sort((a, b) => a - b);
  const mid = stds.length ? stds[Math.floor(stds.length / 2)] : 0;
  return {
    block,
    blocks,
    considered,
    flat,
    flatRatio: considered ? flat / considered : 0,
    medianStd: round2(mid),
    largeFlatFill: considered > 0 && flat / considered > 0.5,
  };
}

function alphaStats(img) {
  const n = img.width * img.height;
  let transparent = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 16) transparent += 1;
  return { transparentRatio: round2(transparent / n), width: img.width, height: img.height };
}

function statOf(stat) {
  return { mean: round2(stat.mean), max: round2(stat.max), samples: stat.samples };
}

function directed(images, a, b, axis) {
  return { a, b, axis, ...statOf(edge.edgeMean(images[a].image, images[b].image, axis)) };
}

function previewBorders(img, tile) {
  if (img.width % tile || img.height % tile) {
    return { tile, note: `預覽不是 ${tile} 的整數倍`, horizontal: [], vertical: [] };
  }
  const horizontal = [];
  const vertical = [];
  for (let row = 1; row < img.height / tile; row++) {
    const y = row * tile;
    const delta = rowDelta(img, y - 1, img, y);
    horizontal.push({ y, ...statOf(delta) });
  }
  for (let col = 1; col < img.width / tile; col++) {
    const x = col * tile;
    vertical.push({ x, ...statOf(columnDelta(img, x - 1, x)) });
  }
  return { tile, horizontal, vertical };
}

function liveWorld(renderer) {
  const source = edge.extractFunction(renderer, 'portGroundPick');
  const pick = edge.compilePick(source)(edge.fakeArt([
    'stone', 'stoneVar1', 'stoneVar2', 'dock', 'woodVar1', 'woodVar2',
  ]));
  const stone = edge.gridOf(pick, 'stone', null, 0, 5, 0, 5);
  const wood = edge.gridOf(pick, 'wood', null, 0, 5, 0, 5);
  const pairs = [...neighborPairs(stone), ...neighborPairs(wood)];
  const cross = pairs.filter(pair => pair.label === 'CROSS_EDGE');
  return {
    sourceIgnoresCoordinates: !/\(\s*tx\s*,\s*ty\s*\)/.test(source),
    roles: {
      stone: [...new Set(stone.map(cell => cell.role))],
      wood: [...new Set(wood.map(cell => cell.role))],
    },
    neighborPairs: pairs.length,
    selfEdgePairs: pairs.filter(pair => pair.label === 'SELF_EDGE').length,
    crossMaterialTileEdges: cross.length,
    crossSample: cross.slice(0, 8),
    note: '母圖沒載入時 portGroundPick 忽略 tx、ty。四向都是同一張 var1，只能標 SELF_EDGE，不能算 cross-compat 通過。',
  };
}

function runtimeCompatPaths(assetsSrc) {
  const out = {};
  const re = /(stoneMaster|stoneCompat1|woodMaster|woodCompat1|woodCompat2|transHCompat|transVCompat):\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(assetsSrc))) out[match[1]] = match[2];
  return out;
}

function fileInfo(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return { rel, exists: false };
  const buf = fs.readFileSync(abs);
  return { rel, exists: true, bytes: buf.length, sha256: sha256(buf) };
}

/** 編譯 paintTerrainRegion 裡 compat 分支實際用 ty 選圖的那兩行。 */
function compileBand(renderer) {
  const start = renderer.indexOf('const band =');
  if (start < 0) return null;
  const imgAt = renderer.indexOf('const img =', start);
  const end = renderer.indexOf(';', imgAt);
  if (imgAt < 0 || end < 0) return null;
  const snippet = renderer.slice(start, end + 1);
  const script = new vm.Script(`${snippet}\nimg.role`);
  const art = {
    transHCompat: { role: 'transH', naturalWidth: 512 },
    woodMaster: { role: 'woodMaster', naturalWidth: 512 },
    stoneMaster: { role: 'stoneMaster', naturalWidth: 512 },
    stoneCompat1: { role: 'stoneV1', naturalWidth: 512 },
    woodCompat1: { role: 'woodV1', naturalWidth: 512 },
    woodCompat2: { role: 'woodV2', naturalWidth: 512 },
    transVCompat: { role: 'transV', naturalWidth: 512 },
  };
  return {
    snippet,
    roleAt(ty) {
      const sandbox = { ty, art };
      vm.createContext(sandbox);
      return script.runInContext(sandbox);
    },
  };
}

function intendedBand(renderer, images) {
  const band = compileBand(renderer);
  if (!band) return { parsed: false };
  const cells = [];
  for (let ty = -4; ty <= 11; ty++) {
    for (let tx = 0; tx <= 4; tx++) cells.push({ tx, ty, role: band.roleAt(ty) });
  }
  const pairs = neighborPairs(cells);
  const imageOf = {
    stoneMaster: images.stoneMaster.image,
    woodMaster: images.woodMaster.image,
    transH: images.transH.image,
    stoneV1: images.stoneV1.image,
    woodV1: images.woodV1.image,
    woodV2: images.woodV2.image,
    transV: images.transV.image,
  };
  const seen = new Set();
  const joints = [];
  for (const pair of pairs) {
    const key = `${pair.label}|${pair.a}|${pair.b}|${pair.axis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const imgA = imageOf[pair.a];
    const imgB = imageOf[pair.b];
    if (!imgA || !imgB) {
      joints.push({ label: pair.label, a: pair.a, b: pair.b, axis: pair.axis, missingImage: true });
      continue;
    }
    const stat = edge.edgeMean(imgA, imgB, pair.axis);
    joints.push({
      label: pair.label,
      a: pair.a,
      b: pair.b,
      axis: pair.axis,
      dir: pair.dir,
      ...statOf(stat),
      overThreshold: stat.mean > edge.THRESHOLD,
    });
  }
  const placed = [...new Set(cells.map(cell => cell.role))];
  return {
    parsed: true,
    snippet: band.snippet,
    pixelSource: 'art/r4 candidate。runtime 檔缺席時，這是程式打算相鄰的那幾張。',
    placed,
    cataloguedButNotPlaced: ['stoneV1', 'woodV1', 'woodV2', 'transV'].filter(role => !placed.includes(role)),
    joints,
    badCrossJoints: joints.filter(joint => joint.label === 'CROSS_EDGE' && joint.overThreshold),
    note: '水平鄰居在這個分支永遠是同一列的同一張圖。真正的跨素材只發生在上下列。',
  };
}

function shoreClip(stoneImg, woodImg) {
  const size = stoneImg.height;
  const samples = [];
  for (const spacingScaleY of [1, 1.2]) {
    const geo = shoreGeometry(1, spacingScaleY);
    const stoneAt = locate(geo.shoreTop - 0.5, size);
    const woodAt = locate(geo.shoreTop + 0.5, size);
    const swap = rowDelta(stoneImg, stoneAt.row, woodImg, woodAt.row);
    const stoneInternal = rowDelta(stoneImg, stoneAt.row, stoneImg, Math.min(size - 1, stoneAt.row + 1));
    const woodInternal = rowDelta(woodImg, Math.max(0, woodAt.row - 1), woodImg, woodAt.row);
    samples.push({
      ...geo,
      tileSize: size,
      stone: stoneAt,
      wood: woodAt,
      sameTileIndex: stoneAt.tile === woodAt.tile,
      materialSwap: statOf(swap),
      stoneNextRow: statOf(stoneInternal),
      woodPrevRow: statOf(woodInternal),
      straightCut: stoneAt.interior && woodAt.interior,
    });
  }
  return {
    formula: '奇數 chunk 的岸線在 chunk.y + chunk.h - 256。石畫到這條線之上，木棧從這條線往下裁切。比較的是這條世界 Y 兩側的貼圖列，不是貼圖外框。',
    samples,
  };
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function buildReport() {
  const renderer = readText('js/renderer.js');
  const assets = readText('js/assets.js');
  const game = readText('js/game.js');
  const bossAi = readText('js/boss-ai.js');
  const production = `${renderer}\n${assets}\n${game}\n${bossAi}`;
  const runtime = edge.measureImages();
  const stone = decodeWebp(edge.FILES.stoneVar1);
  const wood = decodeWebp(edge.FILES.woodVar1);
  const world = liveWorld(renderer);
  const shore = shoreClip(stone.image, wood.image);
  const tileEdgeShore = statOf(edge.edgeMean(stone.image, wood.image, 'vertical'));

  const compatImages = {};
  for (const [role, rel] of Object.entries(COMPAT)) compatImages[role] = decodeFile(rel);
  const runtimeHashes = new Set(Object.values(runtime.files).map(file => file.sha256));
  const compatFiles = {};
  for (const [role, decoded] of Object.entries(compatImages)) {
    compatFiles[role] = {
      rel: decoded.rel,
      sha256: decoded.hash,
      bytes: decoded.bytes,
      width: decoded.image.width,
      height: decoded.image.height,
      sameBytesAsRuntimeGround: runtimeHashes.has(decoded.hash),
    };
  }
  const familyPairs = [];
  for (const [a, b] of [['stoneMaster', 'stoneV1'], ['woodMaster', 'woodV1'], ['woodMaster', 'woodV2'], ['woodV1', 'woodV2']]) {
    for (const axis of ['horizontal', 'vertical']) {
      familyPairs.push(directed(compatImages, a, b, axis));
      familyPairs.push(directed(compatImages, b, a, axis));
    }
  }
  const designedTransitions = [
    directed(compatImages, 'stoneMaster', 'transH', 'vertical'),
    directed(compatImages, 'transH', 'woodMaster', 'vertical'),
    directed(compatImages, 'stoneMaster', 'transV', 'horizontal'),
    directed(compatImages, 'transV', 'woodMaster', 'horizontal'),
  ];
  const compatSelf = {};
  for (const role of ['stoneMaster', 'stoneV1', 'woodMaster', 'woodV1', 'woodV2', 'transH', 'transV']) {
    compatSelf[role] = {
      horizontal: statOf(edge.edgeMean(compatImages[role].image, compatImages[role].image, 'horizontal')),
      vertical: statOf(edge.edgeMean(compatImages[role].image, compatImages[role].image, 'vertical')),
    };
  }
  const familyBad = familyPairs.filter(pair => pair.mean > edge.THRESHOLD);
  const transitionBad = designedTransitions.filter(pair => pair.mean > edge.THRESHOLD);
  const paths = runtimeCompatPaths(assets);
  const artKey = {
    stoneMaster: 'stoneMaster', stoneCompat1: 'stoneV1', woodMaster: 'woodMaster',
    woodCompat1: 'woodV1', woodCompat2: 'woodV2', transHCompat: 'transH', transVCompat: 'transV',
  };
  const runtimeFiles = {};
  for (const [role, rel] of Object.entries(paths)) {
    const info = fileInfo(rel);
    const candidate = compatFiles[artKey[role]];
    info.matchesArtCandidate = !!(info.exists && candidate && info.sha256 === candidate.sha256);
    runtimeFiles[role] = info;
  }
  const runtimeReady = ['stoneMaster', 'woodMaster', 'transHCompat'].every(role => runtimeFiles[role] && runtimeFiles[role].exists);
  const sw = readText('service-worker.js');
  const missingFromServiceWorker = Object.values(paths).filter(rel => !sw.includes(rel));
  const band = intendedBand(renderer, compatImages);

  const procedural = [];
  for (const role of ['stoneV1', 'woodV1', 'woodV2', 'transH', 'harborPreview', 'stonePreview']) {
    const flat = flatBlocks(compatImages[role].image, role.endsWith('Preview') ? 128 : 64);
    procedural.push({ file: COMPAT[role], role, ...flat, transparentRatio: alphaStats(compatImages[role].image).transparentRatio });
  }

  const enemyFiles = {};
  const enemyProcedural = [];
  for (const [role, rel] of Object.entries(ENEMY)) {
    const decoded = decodeFile(rel);
    enemyFiles[role] = {
      rel,
      sha256: decoded.hash,
      bytes: decoded.bytes,
      ...alphaStats(decoded.image),
    };
    if (rel.endsWith('.png')) {
      const flat = flatBlocks(decoded.image, 32);
      enemyProcedural.push({ file: rel, role, ...flat });
    }
  }
  const enemyNamesInJs = /shiome|umibozu|ikari_umibozu|潮子|怒海坊主/.test(production);
  const usesSharedBoss = /window\.ART\.boss/.test(renderer);
  const enemyDirCount = fs.readdirSync(path.join(ROOT, 'art/stage2-rain-port/characters')).length;
  const meta = JSON.parse(readText('art/stage2-rain-port/enemies_metadata.json'));
  const metaKey = {
    minion_shiome_idle: 'minionIdleWebp',
    minion_shiome_attack: 'minionAttackWebp',
    boss_ikari_umibozu_idle: 'bossIdleWebp',
    boss_ikari_umibozu_attack: 'bossAttackWebp',
  };
  const metadataHashMatch = {};
  for (const [name, spec] of Object.entries(meta.sprites || {})) {
    const file = enemyFiles[metaKey[name]];
    metadataHashMatch[name] = !!(file && spec.sha256 === file.sha256);
  }

  const liveCrossCompatPass = false;
  const shoreIsInteriorCut = shore.samples.every(sample => sample.straightCut && sample.materialSwap.mean > edge.THRESHOLD);
  const badCross = band.badCrossJoints || [];
  const intendedStatus = !band.parsed ? 'BLOCKED' : badCross.length ? 'FAIL' : 'REVIEW_BY_HUMAN';
  const report = {
    tool: 'tools/r6-world-cross-edge.cjs',
    at: new Date().toISOString(),
    artApproved: false,
    liveCrossCompatPass,
    usedAuthorSeamJson: false,
    authorSeamJsonIgnored: 'art/stage2-rain-port/compat_seam_metrics.json',
    threshold: edge.THRESHOLD,
    formula: '(|dR|+|dG|+|dB|)/3 的平均。門檻 25 只用來標不相容，不用來宣布美術通過。',
    status: intendedStatus === 'FAIL' ? 'FAIL' : 'REVIEW_BY_HUMAN',
    liveFloor: runtimeReady ? 'COMPAT_BAND_IF_IMAGES_LOADED' : 'FALLBACK_VAR1_SHORE_CLIP',
    fallbackPick: world.crossMaterialTileEdges === 0 ? 'SELF_EDGE_ONLY' : 'CROSS_EDGE_PRESENT',
    world,
    runtimeVar1: {
      stone: { rel: stone.rel, sha256: stone.hash },
      wood: { rel: wood.rel, sha256: wood.hash },
      selfEdge: {
        stoneHorizontal: statOf(runtime.self.stoneVar1.horizontal),
        woodHorizontal: statOf(runtime.self.woodVar1.horizontal),
      },
    },
    shore,
    tileBorderShoreNotOnScreen: {
      pair: 'stoneVar1 底列對 woodVar1 頂列',
      ...tileEdgeShore,
      note: '這是兩張圖外框相貼的數字。現場岸線裁在貼圖內部，畫面上的直線不是這條外框。',
    },
    compat: {
      label: runtimeReady ? 'RUNTIME_FILES_PRESENT' : 'CODE_POINTS_AT_MISSING_FILES',
      runtimeReady,
      runtimeFiles,
      missingFromServiceWorker,
      serviceWorkerFix: missingFromServiceWorker.length
        ? '檔案放進 assets/img/rain-port/ 之後，Cursor 執行一次 node tools/build-media-cache.cjs。QA 不執行，這支會改 service-worker.js。'
        : null,
      files: compatFiles,
      familyPairs,
      designedTransitions,
      intendedBand: band,
      self: compatSelf,
      familyBad: familyBad.length,
      transitionBad: transitionBad.length,
      numericSeamStatus: badCross.length ? 'PLACED_JOINT_OVER_THRESHOLD' : 'PLACED_JOINTS_TIGHT_NOT_A_PASS',
      harborPreviewBorders: previewBorders(compatImages.harborPreview.image, 512),
      stonePreviewBorders: previewBorders(compatImages.stonePreview.image, 512),
      procedural,
      unusedVariantSeamsAreNotTheLiveJoint: true,
    },
    enemies: {
      conceptFiles: enemyDirCount,
      referencedByProductionJs: enemyNamesInJs,
      rendererStillDrawsSharedBoss: usesSharedBoss,
      metadataHashMatch,
      files: enemyFiles,
      procedural: enemyProcedural,
    },
    states: {
      liveScreen: 'REVIEW_BY_HUMAN',
      shoreStraightCut: shoreIsInteriorCut ? 'REVIEW_BY_HUMAN' : 'FAIL',
      intendedWorldCrossEdge: intendedStatus,
      runtimeCompatFiles: runtimeReady ? 'REVIEW_BY_HUMAN' : 'BLOCKED',
      enemyBoss: 'BLOCKED',
      artApproval: 'REVIEW_BY_HUMAN',
    },
  };

  const enemyGate = {
    at: report.at,
    status: 'REVIEW_BY_HUMAN',
    implementation: 'BLOCKED',
    artApproved: false,
    userApproved: false,
    wiredInRenderer: enemyNamesInJs,
    doNotPass: true,
    conceptsPresent: enemyDirCount > 0,
    files: Object.values(ENEMY),
    metadata: 'art/stage2-rain-port/enemies_metadata.json',
    metadataStatus: 'NEEDS_USER_VISUAL_APPROVAL',
    sharedBoss: usesSharedBoss,
    proceduralLargeFlatFill: enemyProcedural.some(item => item.largeFlatFill),
    note: '潮子小僧與怒海坊主只是候選圖。js 沒有這些名字，Boss 仍畫 window.ART.boss。使用者尚未核准，禁止當通過。',
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  fs.writeFileSync(ENEMY_GATE, JSON.stringify(enemyGate, null, 2));
  return report;
}

module.exports = {
  COMPAT,
  ENEMY,
  REPORT,
  ENEMY_GATE,
  buildReport,
  shoreGeometry,
  locate,
  rowDelta,
  flatBlocks,
};

if (require.main === module) {
  try {
    const report = buildReport();
    console.log(JSON.stringify({
      status: report.status,
      liveFloor: report.liveFloor,
      liveCrossCompatPass: report.liveCrossCompatPass,
      intended: report.states.intendedWorldCrossEdge,
      badCross: (report.compat.intendedBand.badCrossJoints || []).map(joint => ({
        a: joint.a, b: joint.b, axis: joint.axis, mean: joint.mean,
      })),
      placed: report.compat.intendedBand.placed,
      unused: report.compat.intendedBand.cataloguedButNotPlaced,
      runtimeReady: report.compat.runtimeReady,
      missingSw: report.compat.missingFromServiceWorker,
      shore: report.shore.samples.map(sample => ({
        spacing: sample.spacingScaleY,
        stoneRow: sample.stone.row,
        woodRow: sample.wood.row,
        interior: sample.straightCut,
        swap: sample.materialSwap.mean,
      })),
      compat: report.compat.label,
      compatFamilyBad: report.compat.familyBad,
      compatTransitionBad: report.compat.transitionBad,
      enemyWired: report.enemies.referencedByProductionJs,
      report: path.relative(ROOT, REPORT).replace(/\\/g, '/'),
    }, null, 2));
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(2);
  }
}
