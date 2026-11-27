# 現行測試與歷史退役

2026-11-28｜全技能第一關開放：200 檔、1,374 項，**1,373 PASS／0 FAIL／1 既有 TODO**，0 跳過。`tests/public-release-contract.test.cjs` 新增 128 固定種子的正式第一關實際抽卡與習得驗證；十二個未持有技能均可出現及習得。正式同權重、無強制介紹／保底、四槽與 DEV 隔離均驗證。舊規格測試調整為現行契約或隔離 DEV 測試，保留原權重及四槽斷言。素材清冊、83 歷史來源驗證及 diff check 通過。

2026-11-28｜Neon 八關本機修復完整回歸，`npm run test:current` 退出碼 0，200 份測試、**1,372 PASS／0 FAIL／1 既有 TODO**，共 1,373 項，0 跳過。

- `tests/public-release-contract.test.cjs` 驗證公開 hostname、式神圖、正式解鎖介紹與既有保底、八關媒體路徑、BGM 增益與音訊生命週期。響度檢查使用系統 PATH 中既有的 `ffmpeg`。`tests/progression.test.cjs` 擴充遷移案例。
- `node tools/run-tests.cjs legacy-check` 通過，83 份退役檔案已核驗。素材登錄已驗 1,723 個本機媒體與 151 個映射，4 個歷史選用原稿依規則缺席。1,720 筆 SW 修訂雜湊與 Git 追蹤均一致。
- Chrome／Windows WebKit 公開 hostname 八關受控載入與零私有請求驗證通過，Chrome 實測 MP3 Range 與正式字型快取。Windows WebKit 未提供 AudioContext。實體 iPad 音訊、瀏覽器實際記憶體與真人自然試玩仍待驗。 [測試及資源數據](NEON_PUBLIC_RELEASE_AUDIT_20261128.md#七本機修復與驗證2026-11-28)

ChatGPT 獨立複查同樣取得 1,372 PASS／0 FAIL／1 TODO，Chrome 公開 hostname 受控驗證 970 筆請求零缺檔、零 console error、零私有路徑，素材及 SW 雜湊一致。使用者已授權發布修復版。

2026-11-27｜整理後完整現行回歸：1,360 PASS／0 FAIL／1 既有 TODO，共 1,361 項，退出碼 0。

基準：整理前 197 個現行測試文件，1,344 PASS／0 FAIL／1 既有 TODO。新增納管 phase-f3-audio-20261127 與 ink-variants-seal-nail-20261117，獨立 15/15 PASS；退役後 199 現行、83 歷史（共 282 原測試，無斷言丟失）。歷史稽核新增一項保護現行清單及檔案雜湊的測試。

- npm test／npm run test:current：現行集合。
- node tools/run-tests.cjs list：現行及歷史清單。
- node tools/run-tests.cjs legacy-check：驗證全部退役原始檔的 SHA256。
- npm run test:legacy／test:all：明確選擇後從本機封存或已釘住的 Git revision 復原原始路徑、跑完清理暫時副本；若無來源或雜湊不合則失敗，不跳過。歷史夾具可能因早期清理缺失或規格更替仍 FAIL，非現行發布 Gate。
- TEST_TRIAGE_20261104.json 保留原 130 檔、974 斷言、366 失敗的真實歷史；HISTORICAL_TESTS.json 記錄退役位置、原始雜湊及現行基準。不可刪除或放寬測試來報綠。
- 實體 iPad、真人自然局、美術、音色與操作由使用者驗收，不以自動化 PASS 替代。
