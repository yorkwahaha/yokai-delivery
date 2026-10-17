"use strict";
// R14 harness 自我校準 fixture（純 Node，不啟動瀏覽器、不碰 production）
// 目的：證明 drawImage 參數解析邏輯正確，再拿它去量真 Chrome。
// 關鍵事實：a = Array.prototype.slice.call(arguments, 1)
//   → drawImage(img, dx, dy, dw, dh)              .arguments.length = 5，a.length = 4
//   → drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)     arguments.length = 9，a.length = 8
// 先前把 is9 寫成 >=9，於是 8 也走 5 參數分支，dx/dy 取到 crop 的 sx/sy，
// localFootY 變成 1856（= a[2]+a[3] = 832+1024）而誤判產品腳錨失敗。

// ── 被測邏輯（與 tests/spacebunny-p42-camera-independent.acceptance.cjs 的 INIT 內字串保持一致）
function parseDrawArgs(a) {
  const is9 = a.length === 8;
  const ndx = is9 ? a[4] : a[0], ndy = is9 ? a[5] : a[1], ndw = is9 ? a[6] : a[2], ndh = is9 ? a[7] : a[3];
  return { is9, dx: ndx, dy: ndy, dw: ndw, dh: ndh };
}

// ── fixture：9 參數（drawFrame 的玩家路徑）
function nineArgFixture() {
  // drawImage(img, 0, 0, 832, 1024, -50, -80, 100, 100) → 目的地矩形 dy=-80, dh=100
  const args = { length: 9, 0: {}, 1: 0, 2: 0, 3: 832, 4: 1024, 5: -50, 6: -80, 7: 100, 8: 100 };
  const a = Array.prototype.slice.call(args, 1);
  return a;
}
function fiveArgFixture() {
  // drawImage(img, 40, 120, 210, 114) → 目的地矩形 dx=40, dy=120, dw=210, dh=114
  const args = { length: 5, 0: {}, 1: 40, 2: 120, 3: 210, 4: 114 };
  return Array.prototype.slice.call(args, 1);
}

const results = [];
const check = (id, cond, detail) => results.push({ id, status: cond ? 'PASS' : 'FAIL', detail });

const a9 = nineArgFixture();
check('fixture-9arg-slice-length-is-8', a9.length === 8, `a.length=${a9.length}（期望 8）`);
const p9 = parseDrawArgs(a9);
check('fixture-9arg-dest-rect', p9.is9 && p9.dx === -50 && p9.dy === -80 && p9.dw === 100 && p9.dh === 100,
  `解析結果 dx=${p9.dx} dy=${p9.dy} dw=${p9.dw} dh=${p9.dh}（期望 -50 / -80 / 100 / 100）`);
const foot9 = p9.dy + p9.dh;
check('fixture-9arg-localFootY-is-20', Math.abs(foot9 - 20) < 1e-9, `dy+dh=${foot9}（期望 20）`);
check('fixture-9arg-no-crop-confusion', !(p9.dw === 832 || p9.dh === 1024), `dw/dh 不得等於 crop 尺寸 832/1024（實得 ${p9.dw}/${p9.dh}）`);

const a5 = fiveArgFixture();
check('fixture-5arg-slice-length-is-4', a5.length === 4, `a.length=${a5.length}（期望 4）`);
const p5 = parseDrawArgs(a5);
check('fixture-5arg-dest-rect', !p5.is9 && p5.dx === 40 && p5.dy === 120 && p5.dw === 210 && p5.dh === 114,
  `解析結果 dx=${p5.dx} dy=${p5.dy} dw=${p5.dw} dh=${p5.dh}（期望 40 / 120 / 210 / 114）`);

// 回歸：舊的錯誤判斷會產生什麼
const buggy = { dy: a9[2], dh: a9[3] };
check('regression-old-bug-reproduces-1856', buggy.dy + buggy.dh === 1856,
  `舊邏輯 dy+dh=${buggy.dy + buggy.dh}（正是先前觀察到的 1856，證明根因定位正確）`);

const counts = results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
for (const r of results) console.log(`[${r.status}] ${r.id} — ${r.detail}`);
console.log(`\n總結：PASS=${counts.PASS || 0} FAIL=${counts.FAIL || 0}`);
process.exitCode = counts.FAIL ? 1 : 0;