#!/usr/bin/env node
/**
 * tools/r6-ground-edge.cjs — 雨港地面互貼邊守門
 *
 * 從 runtime webp 解像素，量相鄰貼圖的邊緣差。
 * 不讀 art/r4 的矩陣當結果。多變體混用時，單張 self-edge 再低也不通過。
 * 若實際渲染同一材質只鋪一張可自接的 var1，判 NOTE_VISIBLE_REPEAT，不判 FAIL。
 *
 * 用法：node tools/r6-ground-edge.cjs
 * 退出碼：0 = 非 FAIL（含待人工看的重複）；1 = 互貼或自接超過門檻；2 = 量測失敗。
 */
'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { decodePNG } = require('./r6-png.cjs');

const ROOT = path.resolve(__dirname, '..');
const THRESHOLD = 25;
const OUT_DIR = path.join(ROOT, 'artifacts', 'validation', 'r6');
const PNG_DIR = path.join(OUT_DIR, 'edge-decode');
const REPORT = path.join(OUT_DIR, 'ground-edge.json');

const FILES = Object.freeze({
  stone: 'assets/img/rain-port/ground_stone.webp',
  stoneVar1: 'assets/img/rain-port/ground_stone_var1.webp',
  stoneVar2: 'assets/img/rain-port/ground_stone_var2.webp',
  dock: 'assets/img/rain-port/ground_wood_dock.webp',
  woodVar1: 'assets/img/rain-port/ground_wood_dock_var1.webp',
  woodVar2: 'assets/img/rain-port/ground_wood_dock_var2.webp',
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
  const webp = fs.readFileSync(abs);
  const hash = sha256(webp);
  const base = path.basename(rel, '.webp');
  const pngPath = path.join(PNG_DIR, `${base}.png`);
  const side = path.join(PNG_DIR, `${base}.sha256`);
  fs.mkdirSync(PNG_DIR, { recursive: true });
  if (!(fs.existsSync(pngPath) && fs.existsSync(side) && fs.readFileSync(side, 'utf8').trim() === hash)) {
    execFileSync(ffmpegBin(), ['-y', '-i', abs, '-frames:v', '1', pngPath], { stdio: 'pipe' });
    fs.writeFileSync(side, hash);
  }
  return { rel, hash, image: decodePNG(fs.readFileSync(pngPath), base) };
}

/** 一條邊上每個像素的 (|dR|+|dG|+|dB|)/3，再取平均。 */
function edgeMean(left, right, axis) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`貼圖尺寸不一致 ${left.width}x${left.height} vs ${right.width}x${right.height}`);
  }
  const w = left.width;
  const h = left.height;
  const a = left.data;
  const b = right.data;
  let sum = 0;
  let max = 0;
  let n = 0;
  const take = (ia, ib) => {
    const d = (Math.abs(a[ia] - b[ib]) + Math.abs(a[ia + 1] - b[ib + 1]) + Math.abs(a[ia + 2] - b[ib + 2])) / 3;
    sum += d;
    n += 1;
    if (d > max) max = d;
  };
  if (axis === 'horizontal') {
    for (let y = 0; y < h; y++) take((y * w + (w - 1)) * 4, y * w * 4);
  } else if (axis === 'vertical') {
    for (let x = 0; x < w; x++) take(((h - 1) * w + x) * 4, x * 4);
  } else {
    throw new Error(`未知軸向 ${axis}`);
  }
  return { mean: sum / n, max, samples: n };
}

function pairKey(a, b, axis) {
  return `${a}|${b}|${axis}`;
}

function measureImages() {
  const decoded = {};
  for (const [role, rel] of Object.entries(FILES)) decoded[role] = decodeWebp(rel);
  const roles = Object.keys(FILES);
  const self = {};
  const cross = {};
  for (const role of roles) {
    self[role] = {
      horizontal: edgeMean(decoded[role].image, decoded[role].image, 'horizontal'),
      vertical: edgeMean(decoded[role].image, decoded[role].image, 'vertical'),
    };
  }
  for (const a of roles) {
    for (const b of roles) {
      if (a === b) continue;
      for (const axis of ['horizontal', 'vertical']) {
        cross[pairKey(a, b, axis)] = edgeMean(decoded[a].image, decoded[b].image, axis);
      }
    }
  }
  return {
    files: Object.fromEntries(roles.map(role => [role, { rel: decoded[role].rel, sha256: decoded[role].hash, width: decoded[role].image.width, height: decoded[role].image.height }])),
    self,
    cross,
  };
}

function familyOf(role) {
  if (role === 'stone' || role === 'stoneVar1' || role === 'stoneVar2') return 'stone';
  if (role === 'dock' || role === 'woodVar1' || role === 'woodVar2') return 'wood';
  return null;
}

function extractFunction(src, name) {
  const key = `function ${name}`;
  const start = src.indexOf(key);
  if (start < 0) throw new Error(`js/renderer.js 找不到 ${name}`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} 括號不完整`);
}

function compilePick(fnSource) {
  const script = new vm.Script(`${fnSource}\nportGroundPick`);
  return art => {
    const sandbox = { window: { PORT_ART: art } };
    vm.createContext(sandbox);
    return script.runInContext(sandbox);
  };
}

function fakeArt(roles) {
  const art = {};
  for (const role of roles) art[role] = { role, naturalWidth: 512, naturalHeight: 512, complete: true };
  return art;
}

function gridOf(pick, kind, art, x0, x1, y0, y1) {
  const choose = pick(kind);
  const cells = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const img = choose(tx, ty);
      cells.push({ tx, ty, role: img && img.role ? img.role : null });
    }
  }
  return cells;
}

function adjacentPairs(cells) {
  const at = new Map(cells.map(cell => [`${cell.tx},${cell.ty}`, cell.role]));
  const pairs = [];
  for (const cell of cells) {
    const right = at.get(`${cell.tx + 1},${cell.ty}`);
    const down = at.get(`${cell.tx},${cell.ty + 1}`);
    if (right !== undefined) pairs.push({ axis: 'horizontal', a: cell.role, b: right, tx: cell.tx, ty: cell.ty });
    if (down !== undefined) pairs.push({ axis: 'vertical', a: cell.role, b: down, tx: cell.tx, ty: cell.ty });
  }
  return pairs;
}

/**
 * 只把同一材質家族裡、兩張不同圖直接相鄰的邊拿來判。
 * 單張 self-edge 良好不能把這種混用改成通過。
 */
function judgeCells(cells, edges) {
  const roles = [...new Set(cells.map(cell => cell.role).filter(Boolean))];
  const mixed = [];
  for (const pair of adjacentPairs(cells)) {
    if (!pair.a || !pair.b || pair.a === pair.b) continue;
    if (familyOf(pair.a) !== familyOf(pair.b)) continue;
    const stat = edges.cross[pairKey(pair.a, pair.b, pair.axis)];
    mixed.push({ ...pair, mean: stat ? stat.mean : null });
  }
  const bad = mixed.filter(pair => pair.mean == null || pair.mean > THRESHOLD);
  if (bad.length) {
    const goodSelf = roles.filter(role => {
      const self = edges.self[role];
      return self && self.horizontal.mean <= THRESHOLD && self.vertical.mean <= THRESHOLD;
    });
    return {
      verdict: 'FAIL',
      code: 'MIXED_INCOMPATIBLE',
      roles,
      badCount: bad.length,
      sample: bad.slice(0, 8).map(pair => ({
        axis: pair.axis, a: pair.a, b: pair.b, tx: pair.tx, ty: pair.ty,
        mean: pair.mean == null ? null : +pair.mean.toFixed(2),
      })),
      goodSelfRoles: goodSelf,
      selfEdgeDoesNotPass: goodSelf.length > 0,
    };
  }
  const badSelf = roles.filter(role => {
    const self = edges.self[role];
    return !self || self.horizontal.mean > THRESHOLD || self.vertical.mean > THRESHOLD;
  });
  if (badSelf.length) {
    return { verdict: 'FAIL', code: 'SELF_EDGE_INCOMPATIBLE', roles, badSelf };
  }
  return {
    verdict: 'NOTE_VISIBLE_REPEAT',
    code: 'SINGLE_SEAMLESS_TILE',
    roles,
    notFail: true,
    humanReview: '同一材質只重複一張可自接的圖。數值接縫低於門檻，畫面仍會看出重複，必須人工看截圖。',
  };
}

function roundStat(stat) {
  return { mean: +stat.mean.toFixed(2), max: +stat.max.toFixed(1), samples: stat.samples };
}

function roundEdges(edges) {
  const self = {};
  for (const [role, axes] of Object.entries(edges.self)) {
    self[role] = { horizontal: roundStat(axes.horizontal), vertical: roundStat(axes.vertical) };
  }
  const cross = {};
  for (const [key, stat] of Object.entries(edges.cross)) cross[key] = roundStat(stat);
  return { files: edges.files, self, cross };
}

const LEGACY_MIX_SOURCE = `function portGroundPick(kind) {
  return (tx, ty) => {
    const art = window.PORT_ART || {};
    const set = kind === "wood"
      ? [art.dock, art.woodVar1, art.woodVar2]
      : [art.stone, art.stoneVar1, art.stoneVar2];
    const ready = set.filter(img => img && img.naturalWidth);
    if (!ready.length) return null;
    return ready[Math.abs(tx * 3 + ty * 5) % ready.length];
  };
}`;

const ORIGINAL_ONLY_SOURCE = `function portGroundPick(kind) {
  return () => {
    const art = window.PORT_ART || {};
    if (kind === "wood") return art.dock && art.dock.naturalWidth ? art.dock : null;
    return art.stone && art.stone.naturalWidth ? art.stone : null;
  };
}`;

function scanSource(fnSource, edges, artRoles) {
  const pick = compilePick(fnSource)(fakeArt(artRoles));
  const stone = gridOf(pick, 'stone', null, -2, 6, -2, 6);
  const wood = gridOf(pick, 'wood', null, -2, 6, -2, 6);
  return {
    stone: judgeCells(stone, edges),
    wood: judgeCells(wood, edges),
  };
}

function buildReport() {
  const rendererPath = path.join(ROOT, 'js', 'renderer.js');
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  const liveSource = extractFunction(renderer, 'portGroundPick');
  const edges = measureImages();
  const catalog = ['stone', 'stoneVar1', 'stoneVar2', 'dock', 'woodVar1', 'woodVar2'];
  const live = scanSource(liveSource, edges, catalog);
  const legacy = scanSource(LEGACY_MIX_SOURCE, edges, catalog);
  const originalOnly = scanSource(ORIGINAL_ONLY_SOURCE, edges, catalog);
  const rounded = roundEdges(edges);
  const shore = rounded.cross[pairKey('stoneVar1', 'woodVar1', 'vertical')];
  const verdicts = [live.stone.verdict, live.wood.verdict];
  const liveVerdict = verdicts.includes('FAIL') ? 'FAIL' : 'NOTE_VISIBLE_REPEAT';
  const report = {
    tool: 'tools/r6-ground-edge.cjs',
    at: new Date().toISOString(),
    formula: '相鄰邊每個像素 (|dR|+|dG|+|dB|)/3 的平均。horizontal＝左圖最右欄對右圖最左欄；vertical＝上圖最底列對下圖最頂列。',
    threshold: THRESHOLD,
    metricNote: '門檻 25 沿用不相容定義，但數值是這次從 runtime webp 重算的，不是讀取既有矩陣。',
    artApproved: false,
    files: rounded.files,
    self: rounded.self,
    namedPairs: {
      stoneVar1_stoneVar2_horizontal: rounded.cross[pairKey('stoneVar1', 'stoneVar2', 'horizontal')],
      stoneVar2_stoneVar1_horizontal: rounded.cross[pairKey('stoneVar2', 'stoneVar1', 'horizontal')],
      woodVar1_woodVar2_horizontal: rounded.cross[pairKey('woodVar1', 'woodVar2', 'horizontal')],
      woodVar2_woodVar1_horizontal: rounded.cross[pairKey('woodVar2', 'woodVar1', 'horizontal')],
      stone_self_horizontal: rounded.self.stone.horizontal,
      stone_self_vertical: rounded.self.stone.vertical,
      dock_self_horizontal: rounded.self.dock.horizontal,
      dock_self_vertical: rounded.self.dock.vertical,
      stoneVar1_self_horizontal: rounded.self.stoneVar1.horizontal,
      woodVar1_self_horizontal: rounded.self.woodVar1.horizontal,
    },
    shoreJoint: {
      pair: 'stoneVar1 bottom vs woodVar1 top',
      stat: shore,
      gate: 'HUMAN_REVIEW',
      note: '岸線是兩種材質相接，不是同一材質的 var1/var2 混用。單材質 var1 政策不因此判 FAIL。',
    },
    livePick: {
      verdict: liveVerdict,
      stone: live.stone,
      wood: live.wood,
      sourceSha256: sha256(liveSource),
    },
    policyChecks: {
      legacyMix: { stone: legacy.stone, wood: legacy.wood },
      originalOnly: { stone: originalOnly.stone, wood: originalOnly.wood },
    },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  return report;
}

module.exports = {
  THRESHOLD,
  FILES,
  edgeMean,
  pairKey,
  measureImages,
  extractFunction,
  compilePick,
  gridOf,
  judgeCells,
  scanSource,
  buildReport,
  LEGACY_MIX_SOURCE,
  ORIGINAL_ONLY_SOURCE,
  fakeArt,
};

if (require.main === module) {
  try {
    const report = buildReport();
    console.log(JSON.stringify({
      verdict: report.livePick.verdict,
      stone: report.livePick.stone.code,
      wood: report.livePick.wood.code,
      stoneVarCross: report.namedPairs.stoneVar1_stoneVar2_horizontal.mean,
      woodVarCross: report.namedPairs.woodVar1_woodVar2_horizontal.mean,
      legacyStone: report.policyChecks.legacyMix.stone.verdict,
      originalStone: report.policyChecks.originalOnly.stone.verdict,
      report: path.relative(ROOT, REPORT).replace(/\\/g, '/'),
    }, null, 2));
    process.exit(report.livePick.verdict === 'FAIL' ? 1 : 0);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exit(2);
  }
}
