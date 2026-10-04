# 第十八輪發布完成

1. 使用者授權提交部署後，將 master 從 `13669f58d682293b9f7116949ff4ddda69b4b320` 快進推送至正式部署 SHA `8d46d7a9fc3ca9b2b0378fccdd0f9247f6314161`。本次一起發布第十七輪第二關雨景／確認缺陷修正與第十八輪手機 HUD 改善。
2. [Pages run 37187726897](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37187726897) headSha 等於部署 SHA，run 與 build／deploy／report-build-status 全部 completed／success；公開 Git ref API 核對遠端 master 同 SHA。
3. [手機測試連結](https://yorkwahaha.github.io/yokai-delivery/?v=8d46d7a) 可直接開啟新版本。HTML query 用於避開舊入口快取；UI script query 為 `20261004-7`，第十七輪其他改動的 script query 為 `20261004-6`。
4. 正式站 index.html＋12 個 JS 共 13 檔全部 HTTP 200，SHA-256 與部署 Git blob 全數一致，`round18-deploy-proof.json` verified=true。比對 Git blob，沒有拿工作檔 CRLF／LF 差異冒稱部署失敗或全工作檔位元組一致。
5. 發布前 `npm.cmd test` 149/149 PASS、全部 js/*.js 語法與 git diff --check 通過，退出碼 0；`artifacts/validation/round18-release-tests.txt`。沒有在發布階段新增玩法或修改資產。
6. 雨夜港町無櫻花／螢火蟲，雨線方向與運動一致；手機 HUD 油量數字／低油文字、技能標籤、被動溢出數量與 Boss 題框留白皆為本次正式內容。此前報告的「未部署」保留為當時的歷史狀態。
7. 本輪部署核對是正式 HTTP／版本證據，未新增實體手機或完整自然通關證據；使用者接著在手機連網回驗。沒有建立瀏覽器分頁或更改手機存檔。
8. 透過既有 Git 權限推送，公開 API 核對 Actions 與 Git ref；未使用失效的 gh token、未改憑證／全域 Git／TLS、未安裝軟體。臨時驗證腳本已清除。
9. 此發布報告、發布前測試輸出與正式站部署 proof 在部署後另作本機文件提交，不再次推送；較新的本機文件 HEAD 不代表正式站另一個版本。正式版本以上述 `8d46d7a9fc3ca9b2b0378fccdd0f9247f6314161` 為準。
