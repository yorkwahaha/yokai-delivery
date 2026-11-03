# Yokai Delivery：測試基準與歷史測試分流

2026-11-03 起，將已驗證對應現行正式遊戲的自動化測試與過往企劃／曾停止實作的規格區分。**這是兩個明確命名的驗證範圍，不是把失敗視為成功或刪掉舊測試。**

目前現行測試已擴充至 **85 份、601 項，601/601 通過**（2026-11-03 Windows 隔離工作樹執行 `npm test` 驗證）；歷史保留 **130 份**，可透過 `npm run test:all` 或 `npm run test:legacy` 明確執行。**這不是 215 份測試全部通過的宣稱。**

## 指令

- `npm test`（或 `npm run test:current`）：現行維護中的快速 Node 回歸。由 `tools/run-tests.cjs` 對目錄中可識別的模組化／稽核／遊戲核心測試與明列的 B14、媒體快取、配送字卡、靈針及 Lv5 符咒測試進行執行。
- `npm run test:all`：保留先前 `npm test` 對 `tests/*.test.cjs` 的完整 215 檔掃描，包含舊版融合、舊 UI 以及可能啟動瀏覽器或長流程的測試。**不是日常自動執行；只在明確授權深入診斷時使用。**
- `npm run test:legacy`：僅執行尚未遷移的歷史測試，現階段預期仍有失敗。
- `npm run test:list`：列出當前分類檔名及數量，不執行測試。

## 為何原本全套不是可靠的發布門禁

完整歷史資料夾約 1,601 個斷言。2026-11-03 清理前一次完整執行出現 495 項失敗，不能直接視作 495 個正式遊戲 Bug。已核對的典型成因：

1. `agy-m1-b/d/runtime/c/stage1-balance` 的舊 VM harness 未載入 `GAME_TUTORIAL_RULES`、`GAME_CATALOG` 等新模組。更新到正式模組後，才開始執行真實斷言；部分真實斷言仍跟舊規格衝突。
2. `agy-m1-d` 的變異卡上限三種、取消的 needle `mut_fan`、舊 Duo 進池等規格，與 2026-10-31 已定的六招、停用融合、每技能兩變異上限不同。保留原檔以供歷史查考，但不可因此將正式遊戲改回舊企劃。
3. `input-runtime` 部分聽題／付費提示、舊 2D／UI 數值期望不再成立。原測試仍在歷史集，勿將這類失敗當成新回歸。
4. `boom-lv5-motion` 原本因 `assets.js` 內新增的 manifest fetch 在 VM 無 stub 而整批報錯；補齊無網路 stub 後重新驗證現行 `skillfx.js` 的 0.12 秒放大峰值、0.30 秒收回和抖動時機，**23/23 通過**。
5. 部分舊測試需 Playwright／Chrome 或作者當年指定的手動美術圖，與現行「Agent 不自動長局試玩」規則不相容。

本輪另對 `agy-m1-b` 確認現行 Lv5 靈針從 0.05 秒開始每 0.05 秒射出一枚，回歸 **19/19**；`agy-m1-d`、`agy-m1-runtime`、`agy-m1-c`、`agy-m1-stage1-balance` 補上缺少的正式模組後，分別能執行 88、14、11、9 項真實斷言，仍有舊設計或待鑑別失敗，**均留在歷史清單**，不可因此修改正式平衡數值。針對 `input-runtime` 的模組載入實驗因使舊測試失敗增加而撤回，保留原本失敗供逐條核對。

### 本輪獨立驗證後重新提升的測試（24 份）

- 原有 **20 份測試**毋須修改任何斷言即可通過，包含 `controls`、`viewport`、`store-multi-tab`、`overworld-editor/facing`、`card-collection-c1c2`、`card-delivery-bridge`、`card-gallery-model/ui`、`card-rewards-runtime`、`audio-events`、`stage-release-status`、`stage2-approved-media-routes`、`stage2-nonmis-stuck-fallback`、`onmyo-vfx`、`font-subset`、`long-kana-display`、`r12-manifest-sentinel`、`r10-audio-bgm`、`r3-gamepause-wiring`。先各別執行，再併入一次全部現行測試。
- `card-gallery-runtime`：原本測試已淘汰的 2026-10-14 script key 以及已不在目前 140 詞字卡目錄裡的「ねこ／いぬ」。現從真實正式字卡目錄抽取兩詞測試 4/4 解鎖與 1/4 隱藏，保留跨分頁、返回不扣油、開發存檔隔離驗證，**6/6 PASS**。
- `content-world`：原測試以雨港與夜町一樣「25 個有效 chunk、每個 3 間屋」為前提，但現在雨港只有 15 個有效 chunk、港口 X 軸稀疏屋、其他 Y 列為場景。新測試繼續驗證夜町三屋、雨港 1–2 屋／空列及全部答題墊與鄰屋淨空，**12/12 PASS**。
- `overworld` 與 `overworld-eight-stage`：原測試強制兩個畫面左右瀏覽按鈕，與正式「可自由拖動、點節點」地圖相矛盾；改為斷言**不得渲染已移除箭頭**，並保留返回、出發、視窗延伸、節點命中與角色轉向等測試，合計 **21/21 PASS**。
- 另抽查 44 份未遷移檔案，發現 24 份仍失敗。這些失敗並未刪除或被默認為成功；個別分組需繼續釐清正式資產與歷史企劃的不一致。

### 獨立 Agent 指出的四組疑點與驗證

- `muse-boss-phone-read`：當 HUD host 僅傳入 `left/right/top/bottom`，沒有 `width/height` 時，Boss 題板誤用桌面寬度；UI 補上從邊界計算有效尺寸（正式 `VIEWPORT.hudBounds()` 本身有尺寸，常規路徑不變），手機五假名答題板 **1/1 PASS**。
- `b10-charm-ui`：原 HUD 將三枚御守水平排在提燈本體內。恢復獨立的提燈右側**垂直三格御守欄**，並驗證 640×360／844×390／1280×720 三種畫面不與提燈重疊，**7/7 PASS**；正式 BGM／戰鬥數值未改。
- `audio-flow-polish-r1`：Agent 擔心 Boss 音檔未解碼會導致長時間靜音。查核實際程式已保留原關卡 BGM 至 Boss `readyState>=2` 後才進行交叉淡入，並無直接證據證實該誤報。原測試的 mock 漏掉 `readyState`；補齊已載入狀態、另新增未解碼期間舊曲**不能被壓到零音量**的專門防護，**6/6 PASS**。不改音訊引擎或延遲值。
- `s2-published-release`：舊測試的字串檢查誤將明確受 `dev=1&stage=rain-port&s2ground=kit` 限制的開發預載視為正式玩家首頁預載；改為驗證完整 dev gate，並用現行 cache 版本取代廢棄的 20261024 固定版號，**10/10 PASS**。
- `js/ui.js` 有實際變更，首頁 UI loader 已更新版號。上述四組從 legacy 轉入現行維護，確保未來的 UI、BGM 與 S2 資產回歸能被 `npm test` 擷取。
- 第二位 Agent（Grok 4.7）針對 `agy-m1-d` 88 項與 `input-runtime` 161 項逐條調查，重現的失敗集中在已取消的三變異名額／共享扇形／Duo 卡入池／提示，以及舊測試滑鼠事件沒帶 canvas `target`、舊針折返距離和夜町／雨港早期數值。沒有從這兩檔**證實**新的正式玩法 Bug；它們仍在歷史清單，不可錯誤宣稱完工。
- Agent 另發現 `b3-night-town-boss-quiz`、`b3-night-town-six-skills` 共 **5/5 PASS**；第一位 Agent 提及的 `playtest-r8-ui` **3/3 PASS**。三檔經本輪獨立重跑後納入現行維護。

## 將歷史測試提升到現行維護範圍的條件

需確認：正式入口相依載入順序、當前需求／規格、有意義且未被篡改的斷言、非互動式測試能穩定執行。修正後先針對性跑綠，再加入 `tools/run-tests.cjs` 的明確檔名或可維護前綴；不要移除斷言來湊數。若發現實際正式遊戲 bug，優先獨立修正程式與補測。

本文件只說明**現行自動化基準**；畫面、BGM、手感與完整關卡仍須使用者親自試玩驗收。
