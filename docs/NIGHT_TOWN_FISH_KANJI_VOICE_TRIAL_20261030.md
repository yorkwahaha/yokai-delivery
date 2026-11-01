# 夜行町 Fish Audio 漢字版聲線比較（2026-10-30）

> **2026-10-30 資產整理後路徑已更新**：本文保留生成與審核歷史；正式遊戲只讀 `assets/audio/delivery/night-town/01.mp3`～`20.mp3`，聲線 A；已核准圖片 `assets/img/delivery/night-town/`。舊試音移至 `art/audio/fish-night-town/archive/legacy/`。以 [統一媒體路徑規範](DELIVERY_MEDIA_PATHS.md) 為準。

使用者確認 Fish Audio 單詞若只給假名，日語重音容易漂移；用漢字的「皿」「箸」「歯ブラシ」更準。原聲線 B（`44b6e5eeab214296bcfd73e767225229`）偏高尖銳，不利初學者辨聽；此輪試用新聲線 `1ec6c6ee0833469e9f172dfc018dda1a`。

## 已生成
- 使用原先的 Fish Audio `s2.1-pro`，相同設定 `format=mp3`、`latency=balanced`，環境變數 API Key，絕不存於前端。
- 第一關 20 詞 × 兩套漢字輸入版：
  - A：`97eda32449cf443bbc4b8782853ca554`
  - 新 C（原 B 替換候選）：`1ec6c6ee0833469e9f172dfc018dda1a`
- 輸入：優先 `js/delivery-lexicon.js` 的 `kanji`；標準片假名外來語保持「コップ」「ノート」「タオル」，而「はさみ」額外測試漢字 `鋏`（必須人工確認發音）。
- 40 個 MP3 全部存於 `art/audio/fish-night-town/kanji-voices/{a,c}/01.mp3` ～ `20.mp3`；`manifest.json` 包含輸入文本及各筆生成結果。
- 新聲線 `紙` 的第一個生成結果長達 10.71 秒，已另存 `c/16_rejected_take1_long.mp3` 不使用；重抽後 0.99 秒。正式 40 個候選皆在 0.52～1.65 秒。
- 獨立試聽：`art/audio/fish-night-town/kanji-voices/preview.html`，`file://` 本機打開可用，並逐字對照 A 與新 C。只播放已合成音檔，不再消耗 API。
- 遊戲內臨時測試：原本的 `?fishVoice=a`、`?fishVoice=b`、`?fishVoice=google` 不變；本機遊戲網址後加 `?fishVoice=kanji-a` 或 `?fishVoice=kanji-c`，分別載入漢字版 A/C 試音。**這兩組臨時選項不寫入長期聲線偏好**；移除參數即回原先設定。播放失敗由 `js/audio.js` 回退日語瀏覽器 TTS，Chrome 有 Google 日語聲線時優先。
- 為避免未核准前取代現有語音，`assets/audio/fish/night-town/a,b/` 40 個現有音檔、`js/delivery-fish-audio.js` 預設選擇及原先 TTS 邏輯均保留。
- `tests/night-town-kanji-fish-voices.test.cjs` 保障 40 筆輸入、檔案、索引和不覆蓋老聲線；相關 41 項測試通過。

**尚待使用者試聽確認高低音、清晰度及「鋏」是否被念成はさみ。不提交、不推送、不部署。**
