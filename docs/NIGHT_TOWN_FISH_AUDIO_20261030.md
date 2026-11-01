# Yokai Delivery｜夜行町正式宅配圖示與 Fish Audio 雙聲線試聽（2026-10-30）

> **2026-10-30 資產整理後路徑已更新**：本文保留生成與審核歷史；正式遊戲只讀 `assets/audio/delivery/night-town/01.mp3`～`20.mp3`，聲線 A；已核准圖片 `assets/img/delivery/night-town/`。舊試音移至 `art/audio/fish-night-town/archive/legacy/`。以 [統一媒體路徑規範](DELIVERY_MEDIA_PATHS.md) 為準。

## 本輪核准範圍
- 玩家已核准第一關「夜行町」20 件日系淡水墨 × 浮世繪單字物件。
- 20 個正式透明 WebP：`assets/img/delivery/night-town/01.webp` ～ `20.webp`，皆 256×256、約 144 KiB 總量。
- 素材對照與來源詳見 `assets/img/delivery/night-town/manifest.json`：六件來自 v4 選定、鉛筆來自 v3，其餘保留第一批核准原圖。
- `js/delivery-icon-art.js` 對第一關正式路徑直接載入，不需要 `?dev=1&deliveryArt=1`；其他未批准關卡仍保留預覽限制。
- 物件圖在 `js/ui.js` 的 `drawWordCue` 統一接入玩家身後貨物、委託提示、目的地及答題相關圖示。

## Fish Audio 雙聲線
- API：官方 `POST https://api.fish.audio/v1/tts`、`model: s2.1-pro`、`reference_id`。
- A 官方參考聲線：`97eda32449cf443bbc4b8782853ca554`
- B 官方參考聲線：`44b6e5eeab214296bcfd73e767225229`
- 夜行町同一組 20 個日語詞，每組 20 份 MP3，共 **40 份**。
- A：`assets/audio/fish/night-town/a/01.mp3` ～ `20.mp3`；B 類似，使用 `b/`。
- 試聽頁：`art/audio/fish-night-town/preview.html`，雙聲線逐詞比較，使用已生成檔案、不重複請求付費 API。
- 兩套已由 ffprobe 檢查：A 0.57–1.04 秒、B 0.71–1.51 秒。完整資料見 `assets/audio/fish/night-town/manifest.json`。
- 本機可重跑的生音腳本：`tools/generate_fish_nighttown.py`（只使用環境變數 `FISH_AUDIO_API_KEY` 或 `FISH_API_KEY`，不讀／不寫公開檔案內的 API Key；不會覆蓋成功生成的現有 MP3）。

## 遊戲播放策略
1. 默認：第一關用 Fish Audio **A** 聲線；網址加 `?fishVoice=b` 改 **B**，`?fishVoice=a` 改 **A**。
2. 使用者選擇存於該網站的 `localStorage`，直到改用其他聲線。
3. `?fishVoice=google` 強制第一關使用日語 TTS。
4. Fish 音檔下載、解碼或播放失敗：回落 `speechSynthesis` 日語（Chrome 有 Google 日本語聲線時優先選；否則裝置可用的 ja-JP 聲線）。
5. 其他關卡維持原有錄音與同樣的日語 TTS 後備。不同來源不會同時播放；保留原語音、音效與 BGM。
6. 新音檔採用 lazy-load，不在初始進遊戲時下載全部 40 份；只按選中的聲線載入需要的詞。

## 驗收與部署
- 新增 `tests/night-town-approved-fish.test.cjs`，確認正式圖路由、40 份音檔、兩聲線切換、失敗時 Google 日語 TTS、其他關卡不受影響。
- 目前未提交、未推送、未部署。玩家先在試聽頁比較 A/B 再選用正式主聲線。
- 當未來需要正式部署時，重新執行 `node tools/build-media-cache.cjs` 更新 Media SW 的 digest。**此輪保留當前 dirty `service-worker.js`，沒有覆蓋該檔案。**
