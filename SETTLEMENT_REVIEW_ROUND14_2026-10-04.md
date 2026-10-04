# 第十四輪：結算錯字總數與截斷說明

修正結算只顯示五個不同錯字卻沒有揭露總數的資訊缺口。保留原本去重與前五字顯示順序：一至五字顯示「今夜記錯的字：共 N 字」，超過五字增加「僅顯示前 5 字」。配送與 Boss 錯題共同去重；重複錯同字不增加不同錯字總數。零錯字沿用原說明，不改誤配件數或學習／平衡規則。

## 驗證

1. 基準 `f167846d2ad40280830becee57dd310c1a38ba59`，起始工作樹乾淨。
2. RED `f291880`：新增結算 0／1／5／7 字、重複詞、勝敗狀態、844／1920 寬度測試，原程式因缺少總數標題失敗，退出碼 1；`artifacts/validation/round14-settlement-red.txt`。
3. GREEN：只修改 `js/ui.js` 的總數與說明、`index.html` 的 UI 快取版本 `20261004-3`，同步原測試的舊標題斷言。全套 117/117 通過，退出碼 0；`round14-settlement-tests.txt`。12 個正式 JS 語法及 diff 檢查通過。
4. 受控瀏覽器直接呼叫正式 UI.drawEndScreen，七個不同錯字加一個重複詞：1920×1080、844×390 均完整顯示總數／截斷提示及五字，未見文字溢出。圖片 `round14-settlement-desktop.png`、`round14-settlement-mobile.png`。這是結算渲染證據，不是完整遊玩或真手機。
5. 預覽入口不載入 game／store，不讀寫自然存檔。第一次預覽 canvas ID 與正式 game ID 不一致，導致未套用正確手機字級；修正 fixture 後才保存最終圖片。觀察到的 error 記錄為空：`round14-settlement-browser-errors.json`，不代表全路徑無錯誤。
6. 臨時預覽入口已移除、分頁關閉、視口 reset；server Ctrl+C 退出碼 1，獨立 TCP ECONNREFUSED 退出碼 0。

## 發布

使用者已授權本輪提交並部署。此文件記錄發布前結果；部署 SHA、Pages run、遠端分支及正式檔案雜湊核對完成後，另存 `RELEASE_ROUND14_2026-10-04.md` 與 `round14-deploy-proof.json`。發布後本機文件提交不等於正式部署 SHA。

GitHub CLI 預設 token 驗證失敗，Pages API 404；未更改憑證或全域設定。一般 sandbox Git 連線出現 SEC_E_NO_CREDENTIALS；使用已授權的使用者權限後 ls-remote 成功，原遠端 master 為 `833972ddeb1c4cd9e1b41586a2a3662bd9f7403d`。Actions 與正式內容將由公開 HTTP API 獨立核對。
