# M15-04 Stage2 石木 v2 接線

票號 M15-04。接的是已核准 `G_stone_wood_transition_v2.webp`，不是整關美術或部署批准。Chrome 連續 24 張由 Codex 用 `artifacts/validation/director-m15-20261015/m15-port-browser.cjs` 另驗。本票沒有跑該腳本，也沒有讀音訊或跑 media builder。

## 改動

- 新 runtime：`assets/img/rain-port/ground_stone_wood_transition_v2.webp`，與來源位元組相同，SHA-256 `8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215`，90730 bytes。未覆蓋舊圖。
- `js/assets.js`：`portCatalog` 角色 `stoneWoodV2` 載入上述 URL。舊 URL 不變。
- `js/renderer.js`：岸塊底材畫完後貼兩條水平縫。縫 A 在 `chunk.y + chunk.h - 256`，原方向。縫 B 在 `chunk.y + chunk.h`，以縫為軸 `scale(1, -1)`。世界 X 仍按 512 相位。`naturalWidth` 為 0 則不貼，硬界留著。`portStamp` 加入 `stoneWoodV2`，晚載刷新一次。
- `index.html`：只改 `assets.js` 與 `renderer.js` 為 `?v=20261015-port-v2`。
- `service-worker.js`：只新增一筆 `"assets/img/rain-port/ground_stone_wood_transition_v2.webp": "8ba771c198b48fb601cfc389"`。相對 `m04-before` 快照，新增 1 行、刪除 0 行，音訊字串無增刪。

`js/game.js`、`js/world.js`、`js/ui.js`、`js/viewport.js`、`js/words.js` 與開工快照 SHA 相同。

## 裁切

512×512、不透明。列 0–252 與 `ground_stone_var1.webp` 同行（MAD ≤ 12）。木面約自列 325 回到 `ground_wood_dock_var1.webp`。裁列 253–324（72 列）。這 72 列的冷暖色在裁內第 18 列、絕對列 271 由冷轉暖，該列放在縫上：北 18、南 54。沒有整張蓋地。

縫 Y 對 512 的餘數在 tilt 0.6 是 160、tilt 1 是 432。同一張圖不能同時讓裁邊等於底材的 `worldY % 512`。裁邊用混合帶本身，不把錯相位的石／木再鋪一層。

垂直翻轉後仍是同一條木紋與石塊，木在北、石在南。預覽：`artifacts/validation/grok-m15-port-runtime-20261015/seam-crop-unflipped.png`、`seam-crop-flipped.png`。列數據在同目錄 `seam-measure.json`、`seam-crop.json`。

## 命令

| 命令 | 結果 |
| --- | --- |
| 改碼前 root `m15-port-independent.test.cjs` | exit 1；7 項，pass 2，fail 5。log：`artifacts/validation/grok-m15-port-runtime-20261015/port-red-confirm.log`。未覆蓋 `port-before-red.log` |
| `node --check` renderer.js、assets.js、新測試 | exit 0 |
| `tests/m15-port-transition.test.cjs` | exit 0；7 pass / 0 fail |
| root 獨立測試 + `assets-loading.test.cjs` + `director-media-image-revisions.test.cjs` | exit 0；31 pass / 0 fail |
| `tests/renderer.test.cjs` | exit 0；38 pass / 0 fail |

以上 Node 都加 `--require ./tools/director-audio-freeze.cjs`。

## Hash

| 檔 | 改前 | 改後 |
| --- | --- | --- |
| js/renderer.js | bb495724c1cf26b8… | 201a8ee9ba52fd5c… |
| js/assets.js | bb9763d6610621fa… | 68bae9e4d8fb6c11… |
| index.html | 92fb3058161665d4… | 41b2c26ef1e0f80a… |
| service-worker.js | bb01fd36b5afb99e… | 23cccbf82df02176… |
| 新 webp | （無） | 8ba771c198b48fb6… |

## 缺口

- 遊戲內連續截圖、tilt 0.6／`?tilt=1`、桌面與窄視口，交給 Codex 現成腳本。本票的兩張圖只是裁帶預覽，不是入鏡畫面。
- 受控 Chrome 不是人審、不是真機。部署門仍 BLOCKED。
- 直縫、角、`transV`、兩張 var2 仍不畫。

未 Commit／未 Push／未 Deploy。
