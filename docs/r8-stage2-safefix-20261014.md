# R8 雨港兩項技術修（2026-10-14）

狀態：程式修復已用 Node 重現並通過。不是 iPad 真機，也不是美術人審。潮波 210／182、貼身共用 `P.inv`、建築後輪廓，這三項沒有改。

## 改了什麼

1. `js/game.js` 追擊：非 Boss、非 `mis` 的小怪（含潮目）若直追被房屋擋住超過 0.45 秒，就沿牆側移，最多約 1.6 秒；主軸一旦能往玩家走就恢復直追。每步仍走 `blocked()`，位移不超過原本一步，不穿牆、不瞬移。`mis` 仍用原本 2.5 秒換位。封印 Boss 不走這條側移。
2. `js/renderer.js` `drawStage2Actor`：雨港終王核准圖還沒載入時不畫本體，也不再畫 `window.ART.boss` 或幾何假身體。封印圈與家紋仍畫。圖載入後才 `drawImage`。第一關大妖鬼仍走原本的共通 Boss 圖。

`index.html` 只改兩條 script 查詢字串，讓瀏覽器不要沿用舊的 `game.js`／`renderer.js`：`?v=20261014-r8-safefix`。沒有改 service worker，也沒有讀音檔。

## 刻意沒動

- 潮波觸發 210、射程 156、命中半徑 26。
- 貼身接觸與潮波共用 `P.inv`。
- 小怪被倉庫擋住時不加輪廓。
- 石木硬切、第三關美術、C1／C2 卡片模組、音訊／TTS。

## 測試

原先失敗（exit 1）：`artifacts/validation/codex-lead-20261014-cursor/stage2-safefix-red.log`。潮目貼在房屋南緣 4 秒，橫向位移 0，距離 233→230。缺圖時 `drawImage` 畫到共通 Boss。

修復後：

- `node --check js/game.js`、`node --check js/renderer.js`：exit 0
- `node --test tests/stage2-nonmis-stuck-fallback.test.cjs`：3 過、0 敗，exit 0。日志 `stage2-safefix-green.log`
- `node --test tests/stage2-approved-enemies.test.cjs tests/renderer.test.cjs`：49 過、0 敗，exit 0。其中核准敵人 11 項仍在。日志 `stage2-safefix-related.log`

沒有跑會讀真音檔的全媒體 hash。本輪沒有新的 Chrome 截圖；請 Space Bunny 做小範圍覆核即可。

未 commit、未 push、未 deploy。
