# 第十六輪發布完成

1. 使用者授權提交部署後，保存發布前檢查並推送 master。正式部署 SHA：`13669f58d682293b9f7116949ff4ddda69b4b320`；本輪程式修正提交：`7196d0e921241e9a66e6d57f9eb9bafb4ad981e4`。
2. [Pages run 37184130455](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37184130455) headSha 符合部署 SHA，run 及所有 build／deploy／report-build-status jobs completed／success；公開 Git ref API 確認遠端 master 同 SHA。
3. [正式站](https://yorkwahaha.github.io/yokai-delivery/) 的 index.html 與 12 個 JS 全數 HTTP 200，13 檔 SHA-256 與部署 Git blob 全數一致。完整時間、SHA、run、jobs 與雜湊：`artifacts/validation/round16-deploy-proof.json`，verified=true。比對對象是 Git blob，不宣稱原始工作檔 CRLF／LF 位元組全數一致。
4. 發布前 129/129 測試、12 個 JS 語法及 git diff --check 通過，退出碼 0；輸出 `round16-release-tests.txt`。本輪發布沒有再修改程式或音檔。
5. 本次一起發布前輪 B10 寬螢幕／Boss 題框、B13 放棄確認，以及第十六輪 MP3 Web Audio 快取、當關語音預載、interrupted 恢復與雨夜港町平衡。舊報告「未部署」保留為修復完成當時的歷史狀態。
6. 第二關：生怪間隔倍率 0.95→1.15、普通敵速度 1.06→1、額外射手機率 0.08→0.02、Boss HP 倍率 1.08→1、XP 倍率 1.04→1、配送目標 7→6。第一關平衡、十分鐘流程、答題獎勵與熟練度規則未改。
7. 本次正式 HTTP 核對證明新程式已上線，沒有新增完整遊玩或真機證據。桌機冷載入／快取證據與 52 個音檔的內容核對見 AUDIO_BALANCE_ROUND16_2026-10-04.md；iPad 真機可靠度及第二關實際體感仍需使用者回驗。
8. 發布沒有啟動本機 server、修改視口或建立瀏覽器分頁。本發布報告及部署 proof 在部署後另作本機文件提交，不再次推送；之後較新本機 HEAD 不等於新的正式版本。

本次提交、推送、部署與正式內容核對完成；正式版本仍以上述部署 SHA 為準。
