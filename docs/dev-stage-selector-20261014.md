# 本機開發選關（2026-10-14）

狀態：**READY_LOCAL_ONLY**。只在本機 loopback 且 `?dev=1` 時可用。不是線上功能，GitHub Pages 或其他外網加上 `?dev=1` 不會出現選關，也不會繞過解鎖。

## 現在就能開

1. 用已經在聽的 `http://127.0.0.1:8788/`，不要再綁一次埠。
2. 選關面板：`http://127.0.0.1:8788/?dev=1`
3. 預選第三關：`http://127.0.0.1:8788/?dev=1&stage=sakura-pass`

操作：點上方「開發選關」展開，選關，再點「直接進關」。不會自動開局，避免沒點一下就搶音訊。浮窗在畫面上方中央，可再點一次收合。註記是「開發測試，不寫入正式進度」。

`localhost`、`127.0.0.1`、`[::1]` 的存檔互不通用，換埠也一樣。這是瀏覽器來源隔離，開發模式沒有把正式進度抄來抄去。

## 存檔

開發模式讀寫 `yokai-delivery-dev-v1`。正式鍵 `yokai-delivery-v1` 不讀、不寫。沒有 `?dev=1` 時仍只用正式鍵。未知關卡代號不會進夜行町。

## 測試

`node --test tests/dev-stage-selector.test.cjs tests/progression.test.cjs tests/overworld.test.cjs`：31 過、0 敗，exit 0。其中開發選關 8 項。日志 `artifacts/validation/codex-lead-20261014-cursor/dev-stage-selector.log`。沒有讀音檔，也沒有跑全媒體 hash。

Chrome headless 對 `http://127.0.0.1:8788/`（音訊網址已擋）：`artifacts/validation/codex-lead-20261014-cursor/dev-stage-chrome.json`。

- `?dev=1&stage=sakura-pass`：選單 8 關，預選第三關，停在主選單。點「直接進關」後 `devStage` 為 `sakura-pass`，畫面進入對局。
- 同一頁再選第八關 `yomi`，`devStage` 改為 `yomi`。
- 正式鍵維持測試前寫入的 `best: 41`、`ねこ.ok: 2`。
- 沒有 `?dev=1` 的首頁沒有浮窗。
- `?dev=1&stage=not-a-stage` 顯示不能進，點按鈕仍停在主選單。

`index.html` 在 `store.js` 之前載入 `js/dev-mode.js?v=20261014-dev-stage1`，`store.js` 與 `game.js` 用同一查詢字串。

未 commit、未 push、未 deploy。第三關地板與 Space Bunny 的測試沒有改。
