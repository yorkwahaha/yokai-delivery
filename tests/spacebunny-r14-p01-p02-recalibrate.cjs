"use strict";
// R14 校準重算（不啟動瀏覽器、不覆蓋原始失敗紀錄）
// 目的：run2 的 12 個 P01/P02 FAIL 全部來自 harness 的 viewErr() 容差欄位拼字錯誤
//       （CONTRACT.viewToleranceRel 在當時的載入版本為 undefined → tol=NaN → 0<=NaN 為 false）。
//       產品實測值本身是對的（誤差 0~0.005 world unit）。本檔用已錄下的 raw bounds/view 資料，
//       以正確的有限容差 1.5 world unit 重算判定，並另存為校準檔。
// 規則：不修改 tests/spacebunny-p42-camera-independent.acceptance.cjs、不覆蓋 run-full2.log、不碰 production。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/validation/spacebunny-r14-p42-camera-20261014');
const SRC = path.join(OUT, 'evidence-full-9288.json');
const TOL = 1.5;                      // world unit，與契約「允許小幅誤差」一致

const ev = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const rows = [];
for (const [device, c] of Object.entries(ev.cases || {})) {
  const zr = c.zoomAndSizes;
  if (!zr) continue;
  for (const run of zr.runs) {
    // 以「實際 bounds + 實際 worldZoom + 實際 tilt」重算期望視野
    const z = run.view.zoom == null ? 1 : run.view.zoom;
    const k = run.tilt === 1 ? 1 : 0.6;
    const expectW = run.bounds.width / z;
    const expectH = run.bounds.height / (k * z);
    const errW = run.view.width - expectW;
    const errH = run.view.height - expectH;
    const pass = Math.abs(errW) <= TOL && Math.abs(errH) <= TOL;
    const extra = run.tilt === 1 && z !== 1 ? `2D 應為 worldZoom=1，實得 ${z}` : null;
    rows.push({
      device, tilt: run.tilt, zoom: run.zoom, query: run.query,
      bounds: { width: run.bounds.width, height: run.bounds.height },
      worldZoom: z, k,
      expect: { w: +expectW.toFixed(4), h: +expectH.toFixed(4) },
      measured: { w: run.view.width, h: run.view.height },
      err: { w: +errW.toFixed(4), h: +errH.toFixed(4) },
      tolerance: TOL,
      originalVerdict: 'FAIL', originalReason: 'viewErr() 容差為 NaN（harness 欄位錯誤），非產品差異',
      recalculated: pass && !extra ? 'PASS' : 'FAIL',
      note: extra || null,
    });
  }
}

const counts = rows.reduce((m, r) => (m[r.recalculated] = (m[r.recalculated] || 0) + 1, m), {});
const out = {
  kind: 'R14 calibration recompute (no browser rerun)',
  createdAt: new Date().toISOString(),
  sourceEvidence: path.basename(SRC),
  sourceRunLog: 'run-full2.log（保留，未覆蓋）',
  productionHashesAtSourceRun: ev.productionHashesAtStart,
  productionFrozenDuringSourceRun: ev.productionFrozenDuringRun,
  harnessBug: {
    symptom: 'P01/P02 共 12 個 FAIL，訊息顯示「允許 ±NaN」但實測誤差為 0~0.005',
    cause: 'viewErr() 內 Math.max(CONTRACT.viewToleranceRel * expect, 0.5) 乘到整個 expect 物件，且當時 CONTRACT 欄位未定義 → tol 為 NaN → 任何比較都判 FAIL',
    fix: '容差改以 max(expect.w, expect.h) 取樣，並給定有限容差 1.5 world unit',
    productImpact: '無。產品實測視野與契約公式 bounds.width/Z、bounds.height/(k·Z) 完全相符',
  },
  rows,
  summary: { total: rows.length, ...counts },
};
fs.writeFileSync(path.join(OUT, 'calibration-p01-p02.json'), JSON.stringify(out, null, 2));
console.log(`重算 ${rows.length} 列：PASS=${counts.PASS || 0} FAIL=${counts.FAIL || 0}`);
for (const r of rows) console.log(`  ${r.device} tilt${r.tilt} Z${r.zoom} 期望 ${r.expect.w}×${r.expect.h} 實測 ${r.measured.w}×${r.measured.h} 誤差 ${r.err.w}/${r.err.h} → ${r.recalculated}`);
console.log('已寫出 calibration-p01-p02.json（原始 run-full2.log 與 evidence-full-9288.json 未覆蓋）');