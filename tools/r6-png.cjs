/**
 * tools/r6-png.cjs — R6 專用最小 PNG 解碼／取樣工具（OpenCode 獨占）
 *
 * 只用 Node 內建模組（zlib），不引入外部相依。
 * 用途：把 Chrome 截圖解回像素，做「拼接週期」「接縫」「跨秒穩定度」
 * 等量測。這些量測只用來**偵測違規**；美術是否達標一律交人工審。
 */
'use strict';

const zlib = require('node:zlib');

/** 解碼 8-bit PNG。回傳 {width,height,channels,data(packed RGBA)} */
function decodePNG(buf, label = 'png') {
  if (!(buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47)) throw new Error(`${label} 不是 PNG`);
  let off = 8, width = 0, height = 0, colorType = 6, interlace = 0, bitDepth = 8;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (interlace !== 0) throw new Error(`${label} 是交錯 PNG，不支援`);
  if (bitDepth !== 8) throw new Error(`${label} bitDepth=${bitDepth}，只支援 8-bit（截圖本來就是 8-bit）`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!ch) throw new Error(`${label} colorType=${colorType}（含調色盤）不支援`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  // 轉成 RGBA 平鋪，方便取樣
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * ch, d = i * 4;
    if (ch === 1) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255; }
    else if (ch === 2) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1]; }
    else if (ch === 3) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255; }
    else { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = out[s + 3]; }
  }
  return { width, height, data: rgba };
}

const lum = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
};

/**
 * 水平自相關：找出「整條畫面以多少像素為週期重複」。
 * 回傳 {period, score, runnerUp}；score 越小代表越像重複貼圖。
 */
function horizontalPeriodicity(img, band, { minShift = 8, maxShift = 400, step = 1 } = {}) {
  const { x0, x1, y0, y1 } = band;
  const scores = [];
  for (let s = minShift; s <= Math.min(maxShift, Math.floor((x1 - x0) / 2)); s += step) {
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x + s < x1; x += 2) {
        sum += Math.abs(lum(img, x, y) - lum(img, x + s, y)); n++;
      }
    }
    scores.push({ shift: s, mean: n ? sum / n : 255 });
  }
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => a.mean - b.mean);
  return { period: sorted[0].shift, score: sorted[0].mean, runnerUp: sorted[1] || null, samples: scores.length };
}

/**
 * 垂直接縫掃描：逐列算相鄰兩列平均亮度差，取前幾個尖峰。
 * 尖峰＝畫面上有一條水平硬邊（拼接／快取邊界）。
 */
function verticalSeams(img, band, { topK = 5 } = {}) {
  const { x0, x1, y0, y1 } = band;
  const rows = [];
  for (let y = y0; y + 1 < y1; y++) {
    let sum = 0, n = 0;
    for (let x = x0; x < x1; x += 2) { sum += Math.abs(lum(img, x, y) - lum(img, x, y + 1)); n++; }
    rows.push({ y, mean: n ? sum / n : 0 });
  }
  const mean = rows.reduce((s, r) => s + r.mean, 0) / (rows.length || 1);
  const peaks = [...rows].sort((a, b) => b.mean - a.mean).slice(0, topK)
    .map(r => ({ y: r.y, mean: +r.mean.toFixed(2), ratio: +(r.mean / (mean || 1)).toFixed(2) }));
  return { rows: rows.length, avgRowDiff: +mean.toFixed(3), peaks };
}

/**
 * 兩張圖在指定區塊的平均亮度差（跨秒穩定度 / 視角切換量測）。
 */
function regionDiff(a, b, band) {
  const { x0, x1, y0, y1 } = band;
  let sum = 0, n = 0, max = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.abs(lum(a, x, y) - lum(b, x, y));
      sum += d; n++; if (d > max) max = d;
    }
  }
  return { mean: +(n ? sum / n : 0).toFixed(3), max: +max.toFixed(1), samples: n };
}

/** 高頻能量（相鄰像素差的平均），用於 DPR／縮放品質量測 */
function highFrequencyEnergy(img, band) {
  const { x0, x1, y0, y1 } = band;
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x + 1 < x1; x++) { sum += Math.abs(lum(img, x, y) - lum(img, x + 1, y)); n++; }
  }
  return +(n ? sum / n : 0).toFixed(3);
}

module.exports = { decodePNG, lum, horizontalPeriodicity, verticalSeams, regionDiff, highFrequencyEnergy };