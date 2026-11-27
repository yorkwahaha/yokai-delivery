# 現行測試與歷史退役

2026-11-27｜整理後完整現行回歸：1,360 PASS／0 FAIL／1 既有 TODO，共 1,361 項，退出碼 0。

基準：整理前 197 個現行測試文件，1,344 PASS／0 FAIL／1 既有 TODO。新增納管 phase-f3-audio-20261127 與 ink-variants-seal-nail-20261117，獨立 15/15 PASS；退役後 199 現行、83 歷史（共 282 原測試，無斷言丟失）。歷史稽核新增一項保護現行清單及檔案雜湊的測試。

- npm test／npm run test:current：現行集合。
- node tools/run-tests.cjs list：現行及歷史清單。
- node tools/run-tests.cjs legacy-check：驗證全部退役原始檔的 SHA256。
- npm run test:legacy／test:all：明確選擇後從本機封存或已釘住的 Git revision 復原原始路徑、跑完清理暫時副本；若無來源或雜湊不合則失敗，不跳過。歷史夾具可能因早期清理缺失或規格更替仍 FAIL，非現行發布 Gate。
- TEST_TRIAGE_20261104.json 保留原 130 檔、974 斷言、366 失敗的真實歷史；HISTORICAL_TESTS.json 記錄退役位置、原始雜湊及現行基準。不可刪除或放寬測試來報綠。
- 實體 iPad、真人自然局、美術、音色與操作由使用者驗收，不以自動化 PASS 替代。
