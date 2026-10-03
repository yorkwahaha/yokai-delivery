# 首頁載入與第一關地板

提交前狀態：已修改、已靜態檢查、44 項測試通過，本機 Chrome 功能與畫面驗證通過。本次包含前一輪六項 UI／暫停修正；正式部署結果另以 GitHub Pages 工作流程與正式站驗證為準。

## 載入原因與修正

1. 原首頁同時請求 17 張美術、2 首 BGM 與 39 個單字音訊，首頁圖排在角色／敵人之後。這些請求競爭冷快取頻寬。
2. 首頁改為只載入 cover.webp，HTML 提前 preload 並設定 high fetch priority；進入旅路或直接開始遊戲後才載入遊戲圖片，重複呼叫不會重複下載。
3. 音樂與單字音訊 preload 改為 none，實際播放才下載；Google Fonts 樣式非阻塞載入，連線慢時先使用備用字型。
4. 執行時圖片全面使用 WebP；WebP 失敗會重試原 PNG／JPG。原圖全部保留，未更動尺寸。
5. 角色、物件與原地板使用無損 WebP，包含透明像素 RGB 的 exact 模式；16 張轉換後 RGBA 位元逐像素比對完全相同。首頁使用 quality 86 有損 WebP，人工檢查正式渲染品質。
6. 原 17 張執行時圖片合計 3,866,356 bytes，WebP 版本合計 2,118,514 bytes，減少 45.2%。封面 1,118,670 → 272,864 bytes，減少 75.6%。未將不用於遊戲的原始步行 spritesheet 另外轉檔。
7. 程式版本更新為 20261003-5；未更動音訊內容與既有音訊快取版本，避免無必要的重抓音樂。

## 第一關地板

1. night-town 使用新增的 ground_dirt.webp；512×512、36,850 bytes。ground_dirt.png 保存對應 PNG，ground.png 與 ground.webp 保留原碎石圖，rain-port 維持原地板。
2. 地板 pattern 快取依圖片更新，避免切換關卡後仍使用上一關紋理。第一關道路邊緣改為較淡的土色。
3. 以內建 imagegen 工具生成，最終素材保存在 assets/img/ground_dirt.png 與 assets/img/ground_dirt.webp。

生成提示詞：

> Create a square seamless repeatable terrain texture for a top-down hand-painted Japanese yokai night delivery game. 1024x1024 square bitmap, opaque. Straight overhead orthographic view, flat even diffuse lighting, no perspective. Simple quiet packed earthen ground, warm muted brown soil, subtle fine soil grain and very low contrast broad natural variation. Only a few small sparse irregular patches of short muted olive green grass, around 8-12 percent coverage, unobtrusive and evenly distributed. The ground must read primarily as plain smooth dirt, playable and visually calm under characters and UI. Perfectly tileable all four edges, no central path or border, no horizon. No rocks, no cobblestones, no gravel, no paving, no flowers, no props, no objects, no text, no strong outlines, no dramatic shadows, no vignette. Soft painterly 2D game background with restrained detail, suitable for repetition across a large map.

## 驗證

1. node --test tests/*.test.cjs：44 項通過。新增首頁優先載入、延後遊戲圖與音樂、重複呼叫及 WebP／原圖皆失敗的備援測試。
2. 所有 js/*.js 通過 node --check；git diff --check 通過。
3. Chrome 冷快取、80ms 模擬延遲、750,000 bytes/s（約 6Mbps）、字型請求固定為空 CSS：本機單次對照首頁圖可用時間 6,709.9 → 966.6 ms；首頁請求 72 → 15，音訊請求 41 → 0。這是控制條件的本機比較，不代表每位使用者的實際連線。
4. 改版前正式站同條件單次量測為 9,641.5 ms、72 個請求、41 個音訊請求；正式站改版後量測於部署完成後另存 loading-remote-after.json。
5. 瀏覽器驗證首次單字播放確實下載 kasa.mp3；字型服務延遲 4 秒時，首頁與封面仍在字型回應前可用。
6. 瀏覽器實際依序切換 night-town → rain-port → night-town，pattern 對應 ground_dirt.webp → ground.webp → ground_dirt.webp，無 JavaScript 例外。
7. 桌機 1884×869、手機橫向 844×390 實際截圖人工檢查：新地板、首頁、HUD 及按鈕正常。未完成實體手機或弱網長時間遊玩測試。
8. 容量、載入測量與功能證據保存於 artifacts/validation/image-compression.json、loading-*.json、terrain-runtime.json 及對應 JPG。
