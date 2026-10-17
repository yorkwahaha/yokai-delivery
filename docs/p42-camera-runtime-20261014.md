# P4.2 世界相機 runtime（2026-10-14）

狀態：本機已接上。預設 zoom 是 1，1.10／1.15 仍 **WAITING_HUMAN**。不是美術 PASS，也不是真 iPad。

未 Commit／未 Push／未 Deploy。production 寫入停在這裡，等 Space Bunny 獨立驗收。

## 改了什麼

景物深度的 `scale` 改成恆為 1。blur 與 grade 還在，房屋和古櫻不再因為玩家往北走而自己變小。

第三關 `sakura-pass` 的 2.5D 另有 `worldZoom`。loopback 只接受 `?zoom=1`、`1.10`、`1.15`（`1.1` 同 1.10）。公開網址忽略 query。2D 與其他關是 1。拉近在世界 CTM：`translate(中心); scale(Z,Z); translate(-中心)` 再接原來的 tilt。不是 CSS 放大。鏡頭切換用雙軸 reanchor，shake 不寫進相機。

地面快取密度用 `L * D`，不用含 Z 的 `getTransform().a`。覆蓋範圍用 Z=1 的視野，所以 zoom 動畫不會每幀重建快取。spawn 半徑也用 Z=1 的視野。世界座標、碰撞、速度、配送沒改。

## 檔案

- `js/viewport.js`
- `js/game.js`
- `js/renderer.js`
- `index.html`（三支 script 版本 `20261014-p42zoom1`）
- `tests/p42-camera-runtime.test.cjs`
- `tests/stage3-house-density-depth.test.cjs`（遠房寬度改為同一 Z 下恆定）
- `tools/p42-camera-chrome.cjs`
- `artifacts/validation/p42-cursor-20261014/**`

沒有改 `world.js`、`js/p42-camera-model.js`、音訊、圖片、C3。

## 命令

```text
node --test tests/viewport.test.cjs tests/p42-camera-runtime.test.cjs tests/p42-camera-zoom-math.test.cjs tests/stage3-house-density-depth.test.cjs tests/stage3-shrine-buildings.test.cjs
```

34 PASS / 0 FAIL / 0 SKIP。其中參考數學與既有 viewport 仍是 22/22。exit 0。

```text
node tools/p42-camera-chrome.cjs
```

exit 0。URL：`http://127.0.0.1:8816/index.html?dev=1&tilt=1&zoom=1.15`

桌機 1280×800、平板視窗 1194×834，各有 2D／2.5D 與 Z=1／1.10／1.15，共 12 張。神社 `drawImage` 寬度都是 210。往北連走四步仍是 210。2.5D 探針 blur 約 2.51、grade 約 0.98、scale 1。切到夜行町後 zoom 為 1。地面快取在移動時 1 次變成 2 次，不是每幀重建。mp3 讀取 0。

截圖：`desktop-z1-2d.png`、`desktop-z1-25d.png`、`desktop-z1.10-2d.png`、`desktop-z1.10-25d.png`、`desktop-z1.15-2d.png`、`desktop-z1.15-25d.png`，tablet 同名六張。

## 風險

- 1.10／1.15 的觀感、15% 重採樣、字體與地板仍待人看。
- headless 幀數沒有拿來當 FPS。1194×834 不是實機。
- 屋頂 culling 用 overhang 擴大繪製範圍，碰撞盒沒變。Chrome 沒有量到裁切，仍建議獨立 QA 看角落。
- `tests/spacebunny-stage3-density-depth.acceptance.cjs` 的遠近銳度比較沒改。那是模糊，不是舊的 0.9 縮放。
