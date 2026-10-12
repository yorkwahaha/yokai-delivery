# Yokai Delivery — 八關旅路完整接入驗證（A4／A5）

**本機接入日期：2026-10-12。狀態：八關地圖介面／互動可用，A6 線上與實機驗收待完成；未 Commit／未部署。**

## 接入成果

- **選定的第二張純場景圖**：`artifacts/references/霧嵐之境_櫻花雪域幻境地圖.png` → `assets/img/overworld_approved_v2.webp`，約 539 KB（減少 86.1%），絕不使用烘焙木牌／角色 UI 的疊圖作背景。
- **世界尺寸**：3000×2200。圖片依原本 1672×941 的長寬比繪製為約 3000×1688；南側採同圖末段的鏡像＋透明霧化過渡，滿足手機直向的 900×2000 視野、不額外下載南側素材。
- **8 個正式關卡＋9 個道路轉折點，共 17 節點、16 段連續主路**，採 A1 使用者已核准的世界座標。全部由 `js/overworld.js` 即時繪製木牌、地標、選取光圈、封印、配達完成朱印與玩家走路動畫；道路為較低對比的墨色細虛線。保留原本 5 個關卡 ID、4 個舊 waypoint ID。
- 新的 `bamboo-maze`、`snow-temple`、`spirit-ferry` 在 `js/words.js` 只有 `implemented:false` 的佔位，沒有接入假詞庫；其他既有第 3／5／8 關也保留未實作。只有夜行町、雨夜港町仍可進入實際遊戲，後六關可展示、不可遊玩。
- **控制與狀態**：點擊關卡木牌／其名稱可選關；點擊鎖定關卡只切換攝影機供欣賞，並顯示封印；固定 ◀ ▶ 鏡頭瀏覽八關，不會讓角色瞬間跨關。已解鎖的其他關卡顯示「前往」，會先沿路移動；到達後顯示「出發」。首頁、分數、通關狀態及地圖角色不受影響。
- **移動端**：依實際 `VIEWPORT.bounds()` 動態擺放左右箭頭、底部資訊、前往／出發按鈕；直向選關不再被「橫向遊玩」整頁遮罩攔住。主選單也可在直向觸控並進入地圖，真正戰鬥仍保留必須橫向的原本規範。
- **進度與備援**：`js/store.js` 仍沿用原保存鍵 `yokai-delivery-v1` 與先前的進度紀錄結構，依八關主線插入新章節；新背景正常時只下載 WebP，下載失敗才使用舊地圖。
- **上線快取**：`index.html` 已為修改過的 JS 更新版本查詢參數，`tools/build-media-cache.cjs` 與生成的 `service-worker.js` 已包含新 WebP 的媒體內容雜湊。

## 驗證證據（可重跑）

1. `npm test` — **527/527 通過**（既有遊戲／存檔／字庫／資產測試，以及新 8 關、封印、攝影機、橫直操作）。
2. `node tools/overworld-device-smoke.cjs` — 真正 Chrome CDP 裝置比例模擬 **12/12 通過**：八關各 900×600；手機橫向 844×390，平板橫向 1194×834，手機直向 390×844，小手機直向 360×800。它們是模擬裝置視野，**不是實體裝置測試**。截圖：`artifacts/validation/eight-stage-a5/*-cdp-*.png`。
3. `node tools/overworld-live-page-smoke.cjs` — 使用**真正的 index.html** 在本機 HTTP 開啟，Chrome 模擬 390×844：證實直向主選單顯示而不受橫向遮罩擋住、Enter 可進入旅路、選定地圖 WebP 與 MAP_ART_READY 已載入、進地圖後橫向遮罩仍不會擋操作；截圖 `artifacts/validation/eight-stage-a5/real-app-phone-portrait.png`。
4. `node --test tests/overworld-eight-stage.test.cjs` — 錨點、16 段路、未開放鎖定、前兩關保護、跨關瀏覽不瞬移、直向動態按鈕、名牌點選與背景延伸。
5. `node --test --test-name-pattern 'portrait map|portrait main menu' tests/input-runtime.test.cjs` — 實際 `game.js` 事件驗證主選單直向進地圖、直向點箭頭與「前往／出發」、不能進入封印關卡。
6. `artifacts/validation/overworld-eight-stage-integration.html` 是**獨立的 Canvas 地圖視覺測試頁**（不是最終程式），可用 `?stage=yomi` 等參數選地景，也會實際載入程式地圖與圖片。

## 已知限制與接下來的工作

- 這是**旅路地圖完整互動層接入**，不是日文教材／八關戰鬥內容全部完成；第 3–8 關依 Roadmap 的 B 階段另行實作。
- **A6 仍待真實手機、平板試玩**：實際瀏覽器下載速度、畫面主景／關卡間距、觸控面積、遊戲主線第 1–2 關進出、實際裝置 FPS，以及過度細節處的木牌位置。取得試玩回饋後再微調。
- 地圖南端鏡像＋漸層霧區是性能優先的低成本暫行延伸，不是重新生成過的一張 Q 版水墨南側美術；若實機可見拼接痕跡，下一輪 A6 以局部霧與水墨遠景修飾。
- **未 Commit、未 Push、未 Deploy**。保留專案內其他工作樹修改與之前的使用者素材。

**後續接手**：先讀 `roadmap.md`，本文件，再執行完整測試與實機試玩；無須重做 A1/A3 或重新生圖。更新當前 Roadmap 里程碑與日誌。
