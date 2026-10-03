# 第七輪發布核對

1. 已推送並部署提交：`d63a98947a0968c776ce34bc36d573d3db2a0a69`。其中正式程式修正提交為 `b026c9fc33b79b61589bd90cbffee5c20d0bbcd1`；`d63a989` 補上報告、新 Boss 抽題時序測試與最終測試證據，沒有再改正式程式。
2. [GitHub Pages run 37141523051](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37141523051) 的 headSha 對應上述提交，build、deploy、report-build-status 全部成功。遠端 master 亦透過 GitHub ref API 核對為該 SHA。
3. [正式站](https://yorkwahaha.github.io/yokai-delivery/) 的 index.html、js/game.js、js/store.js、js/ui.js 均 HTTP 200，SHA-256 與該提交的 Git blob 一致；比對時間為臺灣時間 2026-10-04 01:44:20。證據：`artifacts/validation/round7-deploy-proof.json`。
4. 發布前重跑 `node --test tests/*.test.cjs`：109/109 通過，退出碼 0；12 個正式 JS 的 `node --check` 與 `git diff --check` 退出碼均為 0。測試輸出：`artifacts/validation/round7-release-tests.txt`。
5. 正式入口 1280×720 瀏覽器畫面正常，觀察期間 error 紀錄為空；`round7-live-title.png`、`round7-live-errors.json`。這只是正式入口核對，沒有新增正式站自然配送、Boss 戰、真機或十分鐘實玩證據。
6. 相較前次正式版本 `54038b8`，此次推送包含第六輪發布後文件，以及第七輪三個 RED checkpoints、GREEN 修正與最終報告／109 項測試證據，沒有只挑部分提交。
7. GitHub Pages 設定 API 回覆 404；本機沒有 `.github/workflows`。以既有 dynamic `pages-build-deployment` run、headSha、各 job 結果與正式檔案核對確認發布，不新增發布設定。一般 sandbox 的 `git ls-remote` 曾遇到 `SEC_E_NO_CREDENTIALS`，改用已可用的 GitHub ref API；推送本身在授權的提升權限環境成功，未停用 TLS 驗證。
8. 此次發布完成後才新增本文件、部署證據、正式入口截圖及 `NEXT_CHAT_ROUND8_PROMPT.md`，另作本機文件提交，未再推送。後續本機 HEAD 較新，不代表正式站部署了該文件提交。

第七輪報告中的「未推送／未部署」保留為當時完成狀態；本文件提供後續發布證據。保留未完成：自然答回、完整自然學習閉環、自然 Boss 戰、真手機／觸控、真手把及完整十分鐘實玩。可見回饋與同字待答的學習規則、結算前五字說明／完整回顧、圖鑑錯題計數／篩選均未擅自實作。
