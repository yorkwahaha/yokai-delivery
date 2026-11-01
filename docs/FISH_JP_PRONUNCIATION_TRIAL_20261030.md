# 夜行町 Fish Audio 日語讀音與聲線活力測試（2026-10-30）

## 問題
- 使用者實聽指出部分孤立漢字單字被念成中文，A 與 C 的「はさみ」均念錯；C 聲線偏嬌弱，和原始官方聲線活潑形象不符。
- 舊腳本使用 `s2.1-pro`，發音欄位只有文字、參考聲線 ID、格式、延遲設定，**未送 `language`**。
- Fish Audio 官方 `language: "ja-JP"` 只調整數字/符號等文字正規化與時間對齊，**不會傳入語音模型控制語言或改變口音**。不能稱作「強制日文」。
- 官方另提供日語 `<|phoneme_start|>...<|phoneme_end|>` 語音及音高控制、S2 `[happy]`、`[excited]` 語氣標記。參考：
  - https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
  - https://docs.fish.audio/developer-guide/core-features/fine-grained-control/japanese
  - https://docs.fish.audio/developer-guide/core-features/emotions

## 小規模試驗
- 執行腳本：`tools/fish_japanese_phoneme_trial.py`，不接入正式音訊，僅寫入 `art/audio/fish-night-town/ja-phoneme-trial/`。
- 兩組原聲線：A `97eda32449cf443bbc4b8782853ca554`、C `1ec6c6ee0833469e9f172dfc018dda1a`。
- 對照主題：
  - はさみ：假名、音素 `ha0sa1mi1`、句子 `このはさみを使います。`；C 另有 `[happy]` 和 `[excited]` 搭配音素版本。
  - 箸：漢字、音素 `ha1shi0`；C 加 `[happy]` 搭配音素。
  - 皿：漢字、音素 `sa0ra1`。
  - 紙：漢字、句子 `この紙を使います。`。
- 音高採東京式作測試：はさみ尾高型 [3]；箸頭高型 [1]；皿平板 [0]。請使用者依教材/標準音調實聽確認。標記無法保證模型每次完美遵循。
- 試驗請求採 `model: s2.1-pro`、`language: ja-JP`（只有正規化意義）、`latency: normal`、`temperature: 0.7`，C 情緒測試用 0.82。
- 共 **21 段** MP3，ffprobe 全部成功，長度 0.47～1.78 秒；原音檔與遊戲設定完全未改。
- 本機離線試聽頁：`art/audio/fish-night-town/ja-phoneme-trial/preview.html`。使用者挑選清楚的單字和語氣後，才考慮正式批量更新和/或人工校驗完整詞庫。

**不提交、不推送、不部署；正式遊戲仍然是之前的 A/B 版本，Google 日語 TTS 回退維持現狀。**
