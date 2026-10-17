# P4.2 回歸：這一輪實際改了什麼（2026-10-14）

R14 仍在驗收，`js/renderer.js` 與其他 production 沒有改。

未 Commit／未 Push／未 Deploy。

## 已修的測試

只改 `tests/dev-stage-selector.test.cjs`。

原先用固定字串 `js/game.js?v=20261014-dev-stage1` 找 script，對不上現在的 `20261014-p42zoom1`。現在從 `index.html` 解析 `src="js/<file>.js?v=..."`。

仍要求：

- `dev-mode.js` 在 `store.js` 之前，`store.js` 在 `game.js` 之前
- 三支都有非空的 `?v=`
- `game.js` 的版本是 `20261014-p42` 開頭

## 命令

```text
node --test tests/dev-stage-selector.test.cjs
```

8 PASS / 0 FAIL / 0 SKIP。exit 0。duration 約 62 ms。

## 未修、等 R14 交卷

Codex `artifacts/validation/director-20261014/safe-regression.log`：673 項裡 671 PASS、2 FAIL。這一輪只清掉選關版本那一項。另一項仍在 `tests/renderer.test.cjs:335`。

測試把變換的 a 設成 float32 `1.2000000476837158`。地面快取密度現在是 `L*D`，1080×720 的 L 是精確 `1.2`，所以 blit 對不上。Node 已核對 `Math.fround(1.2)` 就是那個數。

待套用、現在沒改 renderer：`pixelScale = Math.fround((v.scale || 1) * (dpr || 1))`。不要改回 `getTransform().a`，因為那會把世界 zoom Z 乘進去。若仍差過 `1e-8`，下一變體只讓 `setTransform` 的 a/d 用同一個 `fround` 值。草案：`artifacts/validation/p42-cursor-20261014/NOT-APPLIED-renderer-cache-fround.md`。
