# 第六輪發布核對

1. 已提交並推送程式版本：54038b88777aa63ba3c84c682f539e3231f58c6d。
2. 已部署：[GitHub Pages run 37139120080](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37139120080)，headSha 對應上述提交，build／deploy 成功。
3. 正式站：[妖怪快遞社](https://yorkwahaha.github.io/yokai-delivery/)。index.html、js/game.js、js/store.js、js/ui.js 均 HTTP 200，SHA-256 與該提交的 Git blob 完全一致。逐檔證據：artifacts/validation/round6-deploy-proof.json。
4. 發布前再次執行 node --test tests/*.test.cjs（99 項全過）、所有正式 JS 的 node --check 與 git diff --check，退出碼 0。
5. 正式入口瀏覽器畫面正常，觀察期間 error 紀錄為空；截圖 round6-live-title.jpg。這不是正式站完整配送／Boss／十分鐘實玩證據。
6. PowerShell Invoke-WebRequest 初次 HTTP 檢查出現 Authentication failed，改用 Node fetch 成功。工作目錄檔案的 CRLF／LF 差異造成初次原始雜湊不一致，改與已發布提交的 Git blob 比對，四檔一致；沒有跳過驗證或停用 TLS 驗證。
7. 已推送第五輪教學與本輪修正，相較先前正式版本 a477119 累積七個提交；沒有只挑本輪而遺漏先前已完成的教學。
8. LEARNING_LOOP_ROUND6_2026-10-04.md 中「未推送／未部署」是當時本機完成狀態；本文件提供後續發布證據。此次發布後新增的報告、證據及接軌提示詞另作本機文件提交，不因文件 HEAD 較新而宣稱正式站已部署該文件提交。

保留未完成範圍：前一題 1.8 秒對照飄字與新題抽取的極短重疊窗口尚未遍歷；圖鑑查答案、三選一熟練度及 0.45 秒提交仍為現行取捨。真手機、真手把、完整十分鐘實玩及學習成效未驗證。
