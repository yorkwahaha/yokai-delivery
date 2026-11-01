# 第二關雨夜港町｜貨物單字圖與 A 聲線試玩（2026-10-31）

## 實作結果

- 嚴格使用 `js/delivery-lexicon.js` 第二關完整 **20 詞**，不是之前對話摘要的 12 詞。
- **20 個透明 WebP icon**：使用已生成的原畫候選，12 個使用 `art/delivery-icons/rain-port/rerender-original-style-v3/`，另外 8 個使用 `rerender-qwen-v2/`（編號 06、07、09、10、12、13、14、19）。本輪做複核與拷貝，沒有重新呼叫圖片生成模型。每個 256×256 RGBA，透明邊緣、檔名與題庫對照正確。
- **20 個 Fish Audio A MP3**：本輪使用免費 API `s2.1-pro-free`、A voice `97eda32449cf443bbc4b8782853ca554`、`language:ja-JP`（只控制正規化）、無 pitch。偏罕見魚種漢字改用假名：`まぐろ、さば、うなぎ、たこ、いか` 等；其餘採自然日文常用漢字，如 `魚、鮭、鯛、海老、蟹、貝、海苔、昆布、寿司、刺身、焼き魚、味噌汁`。生成來源備份 `art/audio/fish-rain-port/a-common-ja/`。
- 正式遊戲**試玩**路徑（與第一關相同規則）：`assets/img/delivery/rain-port/01.webp…20.webp`，`assets/audio/delivery/rain-port/01.mp3…20.mp3`。同號對應同一字，來源 SHA256 記在各自的 `manifest.json`，沒有覆蓋原始版本。
- **狀態為 `IN_GAME_TRIAL_PENDING_USER_REVIEW`，不是 `APPROVED_BY_USER`。** 使用者已要求直接接進本機遊戲供試玩，但尚未逐張核准圖片、逐字確認魚類日語發音。故 `js/delivery-media.js` 將第二關放入獨立的 `trial` 集合；第一關維持 `approved`，第三關以後仍不提供正式素材路徑。
- `js/delivery-icon-art.js` 和 `js/delivery-fish-audio.js` 原本已呼叫共用媒體路由，直接將第二關新圖音接入 UI 與語音播放；音檔失敗仍走 Google 日本語／裝置 `ja-JP` TTS。
- 獨立預覽：`art/delivery-icons/rain-port/preview.html`。離線開啟可看 20 張圖及逐字試聽，**沒有 API 呼叫費用**。
- 音檔 ffprobe 可解碼、0.470～1.097 秒。這只能檢查格式，不保證高低音正確，請特別聽「さけ（鮭）」「たい（鯛）」「かに（蟹）」「かい（貝）」。
- `tests/rain-port-delivery-trial.test.cjs` 新增索引、格式、路徑、圖示、音訊回退與預覽頁測試；回歸測試已通過。素材清單 `docs/ASSET_INVENTORY.json` 與 Service Worker 快取重建。

## 玩家試玩重點

1. 第一關仍用核准的夜行町 20 圖 + A 聲線；不能被第二關索引污染。
2. 第二關抽到魚、鮭、鮪、鯖、鯛、章魚、海苔、海帶芽、生魚片等時，貨物圖應與中文提示同樣明確、保持透明、不被背景吃掉。
3. 第二關日文發音是否正確、重音是否飄、是否出現中文發音或念成別的魚。
4. 網路不佳時音檔若失效，應回到日文 TTS。
5. 第二關場景／Boss 圖音（前一輪已整理）保持不變，這輪只做宅配貨物圖音。

**尚未 commit／push／deploy，使用者本機試玩後再確定正式核准與否。**
