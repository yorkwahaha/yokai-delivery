# 2026-10-24 專案資料夾大掃除：交接報告

## 使用者統一原則
第一、二關只保留已採用畫風／正式來源；第三至八關只留少量整體形象參考，不沿用舊圖。各關比照 Stage1，只有 art/stageN-ID/{scene,characters} + manifest.json + README.md，不再新增 art/sN 或日期批次深層資料夾。歷史文件及 QA 原始路徑建立映射，Agent 不掃 archive。

## 實際處理
| 類別 | 已完成 |
|---|---|
| art/ 舊關卡圖片 | 永久刪除 **567 張**，約 620 MB，逐張 SHA 刪除報告 art/archive/2026-10-24/ART_PURGE_RESULT.json（**未另備份，不保證可恢復**） |
| Stage2 唯一來源 | 從 art/s2 與舊 Nano 長目錄搬移 **32 張**保留原始 PNG/WebP 到 art/stage2-rain-port/scene/，加上 8 張 approved Stage2 enemy/Boss 在 characters/；dev 來源 manifest-dev-runtime.json。移動 SHA 見 STAGE2_SOURCE_MOVE.json |
| Stage3 舊 runtime | 本機 assets/img/sakura-pass/ 5 張 tracked WebP 已刪除，Stage3 在 JS 暫改為借用 Stage1 合格真圖作 fallback。記錄 STAGE3_RUNTIME_PURGE.json；尚未部署 |
| Stage2/8 rejected DEV images | 刪除 ignored 12 張、18.91 MB，禁用已退役的 S2 舊候選與 Stage8 DEV image gate |
| 舊 QA 圖 | scratch 中 202 張 S2/S3 過期圖片、455.61 MB 刪除；23 個關卡歷史票資料夾移 scratch/archive/2026-10/，保留 S2 WebP DEV 實際使用的 8 張候選 |
| 遞迴專案快照 | scratch/boss-image-qa-r1 兩份 recursive 整庫 baseline 已刪除；前後同排除 Chrome Profile 條件，scratch 約 31.27 GB → 1.82 GB，約 **29.45 GB** 的快照資料不再佔用；QA 腳本／資料仍在 |
| Chromium 產生的 QA Profile | 16 個已確認無正在使用程序的 scratch 專用 headless Chrome profile 已清除 |
| 過期文件 | 61 份零直接 code/test/tool/入口引用的已結案文件移至 docs/archive/2026-10/，根層目前 29 份（含新索引與清理報告）。 |
| 一次性工具 | 40 支零直接現行引用的舊生圖／QA 腳本移 tools/archive/2026-10/，根層還有 65 支 |
| 指令入口 | AGENTS.md、README.md、docs/PROJECT_FILE_MAP.md、docs/STAGE_PATHS.json、art/README.md、docs/ART_CLEANUP.md 更新成精簡唯一入口，原版保存在 docs/archive/2026-10/old-entrypoints/ |

## 目前每關原稿圖片數
- S1: 2（scene 正式來源及一張 3×3 拼接參考）；已清除 9 張舊 QA／UI 截圖，另外 2 張移至 docs/archive/2026-10/visual-evidence/。
- S2: 40（scene 32 + characters 8）。manifest 見各關目錄。
- S3: 3（含 10/24 g_dirt_01.png 未核准候選）。
- S4: 3；S5: 1；S6: 1；S7: 0；S8: 3（均不是正式遊戲圖）。

## 完整回歸狀態
- 新建的 stage-art-reset-20261024 / 更新的 s2-ground-kit-contract / media-cache / Kilo 港町 renderer/boundary **專項測試通過**。
- 2026-10-24 整庫 npm test **RED / exit=1**，部分 M1、難度、UI、BOSS 委派、固定 SHA/舊映射測試失敗；並未證明這些問題全部是此次清理造成，也未做相對清理前綠燈基線的逐案差分。恢復遊戲開發或提交發布之前應逐案分類與修復，不得稱全量 QA PASS。

## 重要版本與風險
- 現網 GitHub Pages master **0e5875d** 的第二關新版已發布；本機 I:/Projects/yokai-delivery master 仍在 a4aaa94，保有未提交的 BOSS / roadmap，**不可 git reset/clean/force pull**。此次大掃除沒有 commit/push/deploy，也沒有修改線上網站。
- 已刪除的 3–8 關 Art Git 忽略且非備份；只有 manifest 所列參考圖存在；沒有參考圖的 S7 需要重新出圖。
- 依先刪圖再更新 SW media revision 的流程執行 node tools/build-media-cache.cjs，現在新版媒體總計 **423** 個檔，專項 media-cache 測試通過。
- 舊歷史 tests/assertions 不一定適用新資料夾契約；已更新 s2-ground-kit-contract.test.cjs，兩個舊 Stage3 地板／密度測試移 tests/archive/2026-10/，新增 stage-art-reset-20261024.test.cjs。
- Stage2 主工作樹與公開 release worktree 分岔仍需在 Codex / 單 writer 復工前安全整合；不要因為本機沒有正式 WebP 發版包就重生另一套候選。
- 仍在使用的 Stage1/2 共享資產、音訊、keys、BOSS 開發源碼均保留。
