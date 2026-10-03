# 第九輪發布核對

1. 已推送並部署提交 `833972ddeb1c4cd9e1b41586a2a3662bd9f7403d`。第九輪自然報告／證據提交為 `fcb84defc8f62ddb0a6320202c2e2755ecd46eb4`，發布前另提交 `round9-release-tests.txt`。相對上次部署 `d63a98947a0968c776ce34bc36d573d3db2a0a69`，此次包含發布後第七輪文件、第八輪自然閉環、第九輪自然嘗試與證據，沒有改正式程式。正式程式修正仍為 `b026c9fc33b79b61589bd90cbffee5c20d0bbcd1`。
2. [GitHub Pages run 37144569464](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37144569464) 的 headSha 為 `833972d`，build、deploy、report-build-status 均 completed／success。GitHub ref API 確認遠端 master 同 SHA。沿用既有 Pages workflow，沒有新增發布設定。
3. [正式站](https://yorkwahaha.github.io/yokai-delivery/) 的 index.html、js/game.js、js/store.js、js/ui.js 均 HTTP 200，SHA-256 與 `833972d` 的 Git blob 一致；核對時間為臺灣時間 2026-10-04 02:34:50。完整 SHA／run／jobs／遠端及檔案雜湊證據為 `artifacts/validation/round9-deploy-proof.json`，verified=true。
4. 發布前 `node --test tests/*.test.cjs`：109/109 通過、退出碼 0；12 個正式 JS 的 `node --check` 與 `git diff --check` 通過。輸出 `artifacts/validation/round9-release-tests.txt`；本輪先前自然嘗試後亦有獨立的 `round9-tests.txt`。
5. 正式入口以內建瀏覽器 1280×720 核對，首頁正常；截圖 `round9-live-title.png`，所取 error 紀錄 `round9-live-errors.json` 為空。這只是正式入口檢查，沒有新增正式站配送／Boss／真機／十分鐘實玩證據。正式 origin 首頁顯示最高分與配送 0，和 localhost 的自然存檔分開，不注入或同步存檔。
6. 本機 Git 內容相對部署的 index.html／js 無差異，不代表工作檔原始位元組 SHA-256 全數相同。第八輪 `round8-local-program-proof.json` 仍記錄 7 個工作檔混合 CRLF/LF，入口與 12 JS 統一 LF 後才全數與當時部署 blob 一致。本輪正式雜湊核對以部署 Git blob 為準。
7. 第九輪自然成果仍是 A 雨傘／花配送與縮地瞬步升級、最後觀察約 119 秒；A 結算缺失，不能用最後觀察值冒充。B 約 116 秒敗北結算為 15 分／送達 0／誤配 0。兩局沒有自然 Boss；詳細界線見 `LEARNING_BOSS_ATTEMPT_ROUND9_2026-10-04.md`。第八輪已完成的一條跨局自然答回閉環仍有效，不能因第九輪失敗抹除。
8. 第九輪報告中的「未推送／未部署」保留為自然驗證完成時的歷史狀態，本文件記錄後續授權發布。本次部署完成後才新增本文件、`NEXT_CHAT_ROUND10_PROMPT.md`、部署雜湊及正式入口證據，另作本機文件提交，不再推送。後續較新的本機 HEAD 不等於正式部署 SHA；下一輪需先現查 Git。
9. 正式驗證分頁已關閉、視口 override 已還原；自然驗證 server 8788 已在前段停止並由 Node TCP `ECONNREFUSED` 確認。沒有安裝軟體、改全域 Git／TLS 或新增診斷介面。

下一輪仍優先補自然 Boss 可達與抽詞允許的輔助順序／離場重入證據，先改善實際 UI 路線與操作批次，不擅改平衡。自然 1.8 秒同字重疊、回饋輔助新規則、結算截斷說明與圖鑑歷史功能仍未完成／未選定。這次發布授權已完成，不延伸成下一輪自動發布。
