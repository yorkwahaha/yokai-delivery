# 真機待驗短清單｜P0／P7／A6／R3／B5

目前 WAITING_DEVICE；桌面 Chrome 的1194×834 viewport不算iPad。此表供使用者實測，沒有代填結果。**音訊／TTS維持凍結**：使用主管提供的音訊stub測試網址，不能用這輪測BGM解鎖或發聲，也不要求讀音檔。

| 項目 | 最短實測步驟 | 要回報的證據 |
|---|---|---|
| 第一關P0 | 清此站點cache後冷啟night-town，從按出發前錄影，立刻上下左右走，2D↔2.5D；另在慢網重做 | 首5秒連續影片、是否先錯後對、設備/OS/browser、網路條件 |
| UI/觸控 | 橫向進圖鑑，關卡/詞包/翻頁/返回；配送答案/衝刺/暫停；旋轉後再返回橫向 | 漏點/誤點/遮字的截圖，實際手指手感；不同於模擬viewport |
| 背景切回 | 戰鬥暫停→切別app→返回；配送讀題期間重做 | 不瞬間跳時、不掉單、不誤恢復戰鬥；有問題錄影 |
| 正常10分鐘 | 正常時間與輸入玩一局，不改elapsed/HP/世界；可選一關先試 | 真實牆鐘與局內elapsed分開記；結果/配送數/Boss、死因或卡住位置，不能以hook勝利替代 |
| 效能 | 同一次正常局記frame時間與可取得的memory，百鬼/多技能/Boss時段各一段 | FPS/P95採實際量測工具與採樣數；無工具填未量測，不猜RAM/GPU/溫度 |
| 下載 | 首次開啟與再次開啟各記本地DevTools可取得的圖片傳輸/解碼情況 | cold/warm、設備、bytes/耗時；壓縮大小不是實機GPU占用 |
| Xbox震動 | 實體Xbox藍牙接tablet，開/關震動、受擊/衝刺、暫停/失焦/斷線重連 | 型號/OS/browser、雙馬達是否真的動；只會移動或手機navigator.vibrate不能填PASS |

判定：每列 PASS／FAIL／NOT_TESTED，主觀藝術仍 HUMAN_REVIEW。B5全8關自然平衡需逐關記，不因單關一次成功全勾完成。重大玩法/美術及部署需另行授權，未Commit／Push／Deploy。

## E22 桌機正常實玩工具缺口

Browser inventory 只有 Codex MCP Apps；`cua.createBrowserTab("chrome", "about:blank", { sessionName: "🎮 Yokai 桌機實玩" })` 回 `Browser is not available: chrome`。本輪能跑 stdlib/CDP headless 真 Chrome 受控驗收，但未有連接的可互動 Chrome，不能冒稱桌機10分鐘正常遊玩或自然通關。實體iPad/Xbox仍WAITING_DEVICE。可由使用者依下列方法實測，或提供已連接的瀏覽器控制面；不為QA安裝系統軟體／改全域環境。音訊保持靜音stub，不測BGM/TTS。
