# 夜行町／第一關：Fish Audio A 聲線＋常用漢字版（2026-10-30）

> **2026-10-30 資產整理後路徑已更新**：本文保留生成與審核歷史；正式遊戲只讀 `assets/audio/delivery/night-town/01.mp3`～`20.mp3`，聲線 A；已核准圖片 `assets/img/delivery/night-town/`。舊試音移至 `art/audio/fish-night-town/archive/legacy/`。以 [統一媒體路徑規範](DELIVERY_MEDIA_PATHS.md) 為準。

## 目前已完成（本機）

- 使用者選定：官方 A 聲線 `97eda32449cf443bbc4b8782853ca554`，漢字優先，**不要冷僻漢字、不要 pitch 或情緒標記**。第二至第七關原本語音不動。
- **官方免費模型**：Fish Audio `s2.1-pro-free`，官方公告免費到 2026-11-30（公平使用政策限制、無 SLA）；官方公告：https://fish.audio/zh-CN/blog/s2-1-pro-free-api/，價格表：https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits 。上一輪舊腳本用的 `s2.1-pro` 是**付費** ID，不能假設已執行請求免費，實際帳單須自行在 Fish 帳戶核查。
- 先以免費 API 實際生成「はさみ」測通，回應 HTTP 200；之後用同一免費模型補齊 20 詞。後續舊 Fish 生成工具的 MODEL 預設也全部改成 `s2.1-pro-free`，防止誤送付費模型。
- 新錄音：`assets/audio/fish/night-town/a-kanji/01.mp3` ～ `20.mp3`（共 20 份），`manifest.json` 記載每個實際輸入和免費 model ID，`preview.html` 可本機開啟逐字試聽。
- 文字策略：使用 `js/delivery-lexicon.js` 的 `kanji` 欄位，**例外** `はさみ` 不用「鋏」，`せっけん` 不用「石鹸」；無漢字的外來語（コップ、ノート、タオル）維持片假名。API `language: ja-JP` 只供文字正規化，不保證模型一定選對日語發音。
- 所有 20 個 MP3 已由 ffprobe 驗證可解碼，時長約 0.47～0.89 秒。**機器驗證不代表日語高低音一定正確，仍須使用者試聽。**
- `js/delivery-fish-audio.js` 的 `fishVoice=a`（及未指定參數的預設）現轉到 `a-kanji/`；重設聲線偏好鍵為 v2，避免上一輪使用者選過 B 而影響新的統一 A 預設。舊 B 仍保留在獨立資料夾供手動比較，臨時 A/C 漢字版本仍可在本機以參數選用。
- 檔案載入或播放失敗仍依 `js/audio.js` 回退到瀏覽器日語 TTS；Chrome 有 Google 日本語聲線時優先。其他關卡老錄音不受影響。
- 新生成腳本 `tools/generate_fish_nighttown_a_common_kanji_free.py` **硬編免費 model ID**，不會默默回退到付費 ID，API key 只從環境變數讀取。
- 43 項相關測試通過。尚未 commit、push 或 deploy，沒有動已批准 icon 或其他待審圖。
- **使用者已再次核准並要求正式接入（2026-10-30）**：新 A 常用漢字版為第一關正式預設語音，不需 URL 試聽參數；`js/audio.js` 使用 `js/delivery-fish-audio.js` 對應這 20 份正式 MP3，Google 日本語與裝置日語 TTS 是音訊失敗後備。保留舊 A/B/C 音檔作歷史備份。
- 已執行 `node tools/build-media-cache.cjs`，更新 `service-worker.js` 的媒體修訂指紋（617 筆），正式第一關 20 個 MP3 與 20 張已核准 icon 的 40 筆 digest 全部確認與磁碟檔一致。新音訊會依需下載，沒有首屏整批預載。
- **正式素材接線完成，仍未提交、推送、部署；** 目前只有本機版本生效。新增 `tests/media-cache.test.cjs` 驗證；相關 49 項測試全數通過。
