# 第十六輪：iPad 間歇失聲排查／雨夜港町平衡調整

基準 `ad46fdd3cf7693a06bee3a61a8a3037ac8ae3182`，起始工作樹乾淨。使用者回報 iPad 的戰鬥音效與單字語音時有時無，初期嚴重、數分鐘後改善；第二關即使日文熟悉，三次仍未通過。本輪局部修正音訊播放與第二關設定，不重新做美術／完整自然遊玩。

## 音訊結論、修正與證據

1. **未發現缺檔**：正式站 39 個單字 MP3、13 個實體 SFX 都 HTTP 200，SHA-256 與本機一致；`artifacts/validation/round16-audio-file-proof.json`。六種其他 SFX 仍直接合成，不誤列為缺檔。
2. **確定的程式缺口**：AudioContext 只恢復 suspended，未處理 interrupted；MP3 NotAllowedError 直接無聲返回；已知詞的播放拒絕也只收尾，且各詞獨立媒體元素、初次使用才下載。這些與回報相容，但沒有 iPad 真機紀錄可認定為其全部根因。
3. 預錄單字與 SFX 優先改由 fetch／decodeAudioData 快取，再從使用者手勢已初始化的 Web Audio context 播放，避免每次新媒體元素播放授權。start 預載當關語音與 13 個 SFX，四個 worker，優先當關語音。保留不支援／下載解碼失敗時的原媒體備援，沒有改音檔或換聲線。
4. interrupted 也呼叫 resume；媒體 SFX 政策拒絕可轉合成，但不永久標示 MP3 壞檔。只對真正不支援／解碼錯誤沿用原失效標記；AbortError 不補播取消事件。
5. 暫停到背景／靜音停止所有 buffer source，取消晚到的非當前播放；同詞重播也停止舊語音。晚到下載、被替換語音與解碼不會在恢復後突然補播。
6. 桌機真瀏覽器、獨立 8791 origin、沒有存檔：冷載入兩詞＋13 SFX，15 次下載／15 次解碼，雨詞與衝刺啟動兩個真 source；重播啟動次數 2→4，下載／解碼仍 15，HTMLMediaElement.play 次數為 0。`round16-browser-audio-proof.json` verified=true，畫面 `round16-browser-audio.png`。這是解碼／播放啟動證據，不是 iPad 聽感或真機可靠度保證。
7. BGM 仍用原媒體元素，本輪未量測其 iPad 播放可靠度。其他裝置的音量、Safari 系統靜音及裝置喇叭也未驗證。

平台參考：[WebKit 媒體播放政策](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)、[MDN AudioContext interrupted／iOS Safari 恢復](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)。來源支援平台行為，不替代本遊戲真機證據。

## 第二關調整

第一關全部保持原設定；一般／輔助配送 50 分／28 油及 25 分／10 油、熟練度、0.45 秒提交均未改。第二關保留十分鐘、三隻 Boss 的 210／420／590 秒排程、雨霧與詞庫、百鬼排程及接觸／彈丸傷害。

| 雨夜港町設定 | 原值 | 本輪 |
| --- | --- | --- |
| 生怪間隔倍率 | 0.95 | 1.15（同時刻需求速率下降約 17.4%） |
| 一般敵人速度倍率 | 1.06 | 1.00 |
| 額外射手機率 | 0.08 | 0.02 |
| Boss HP 倍率 | 1.08 | 1.00 |
| 升級 XP 倍率 | 1.04 | 1.00 |
| 通關配送件數 | 7 | 6 |

受控真正 spawnEnemy、300 秒、100 個固定等距亂數樣本：第一關射手 14、第二關 16（舊設定在相同條件為 22）；一般鬼速度兩關均 85.75。第一級升級 XP=30、第二關有效生怪間隔 1.311 秒（舊 1.083），首個真排程 Boss HP=33。結果在 `round16-tests.txt` 的 runtime-stage-pressure 診斷。

`round16-balance-proof.json` 從基準 Git blob 讀原設定後比較：理論十分鐘普通生怪需求 2602→2145。此為排程需求，**不計活敵上限、百鬼、實際擊殺、路線、玩家升級或通關率**，不可稱畫面同時有兩千敵人或已證明玩家必能通關。此輪降低疊加壓力，後續仍以實際體感校準，不宣稱三局實玩平衡測量完成。

## RED／GREEN、檢查與收尾

- RED checkpoint `e7a945b`，五項失敗：interrupted 恢復、政策拒絕補音、冷語音快取、晚到播放取消、第二關較溫和設定；`round16-red.txt` 退出碼 1。快取相關 RED 屬新增播放路徑需求，不把缺少 fixture 載入接口說成原產品 TypeError。
- 初次 GREEN fixture 缺 suspend 方法，補齊真 AudioContext API 後通過；該 TypeError 不算產品缺陷。
- 已修改：audio.js、game.js 的當關預載呼叫、words.js 第二關設定、入口 query `20261004-5`、相關測試與證據。音檔內容／音檔版本不變。
- 已靜態檢查：12 個正式 JS 語法與 git diff --check 通過。
- 已測試：全套 129/129、退出碼 0；新增七項測試。`round16-tests.txt`，初段局部輸出 `round16-focused-tests.txt` 保留首次 fixture 失敗，最終以全套 GREEN 為準。未量測全專案覆蓋率。
- 瀏覽器觀察到 error 為空，`round16-browser-errors.json`，不代表全路徑零錯誤。臨時音訊入口已移除、分頁關閉、source 已停止；server Ctrl+C 退出碼 1，另以 TCP ECONNREFUSED 退出碼 0 確認 8791 停止。本輪未設定視口 override。
- 已部署：本輪無，沒有推送。上一輪核對正式版仍為 `25a6f80`；本輪正式 HTTP 核對的是未改的 52 個音檔，不是新程式已上線的宣稱。

**尚未完成**：iPad 真機／瀏覽器版本確認、冷啟動及切回前景實測、第二關實際通關率與玩家體感。不要將桌機 Web Audio 檢查當作已證明 iPad 完全不再失聲。
