# 2026-10-26｜Yokai Delivery 單根目錄整併與安全清理收據

狀態：**HOUSEKEEPING PASS**／**遊戲 F1-F4 NOT PASSED**。僅允許清理已退役平行目錄、日期快照及可再生的測試 profile，不碰目前 Agent 正在開發的正式 source。

## 清理前四個根目錄

| 舊路徑 | 檔案掃描／容量（不含 node_modules/.git） | 處理 |
|---|---:|---|
| `I:/Projects/yokai-delivery` | 305,763／20,875.69 MiB | 唯一開發工作樹，**保留**；其內只清過期測試 Chrome profile 與確認退役 stash |
| `I:/Projects/yokai-delivery-backup-20261023` | 232,197／17,766.89 MiB | 無 .git 的過時全量備份，已保留救援包、設定稿後刪除 |
| `I:/Projects/yokai-delivery-archive-20261023` | 12,870／939.21 MiB | 過時舊歸檔，已保留最早構想圖、歷史核心文件後刪除 |
| `I:/Projects/yokai-delivery-release-s2-20261024` | 964／99.39 MiB | Git clean 工作樹，正式 `git worktree remove`，**branch 與 0e5875d commit 未刪** |

### 根目錄最終狀況

- `I:/Projects/` 下以 yokai-delivery 開頭只剩 `yokai-delivery` 一個目錄；Git worktree list 亦只有這個主根。
- **沒有**使用 reset、clean、hard checkout 或以備份覆寫現役程式；Git `master` 仍 `a4aaa94`、dirty 188 條觀測，衝突 0。正式已發版提交是 `0e5875d`，branch `release/s2-assets-20261024` 可重建其工作樹。**Git 分支尚未合併**；因現役未提交大量修改，必須另開受控合併任務。
- 當前雨港正式 bundle `assets/img/rain-port/s2-production/` 22/22 檔的 Git blob 與已發版 branch 逐檔相同。主工作樹的其它 JS 是仍在變動的開發版本，不假稱全部已符合最終版。

## 實際刪除

1. `artifacts/validation/` 和 `scratch/` 中 2026-10-26 之前已停用、明確命名的 `chrome-profile*` 等瀏覽器測試 profile：**72 目錄、50,090 個檔案、3,673.46 MiB**（逐項以 [瀏覽器資料刪除報告](20261026-browser-profile-purge.json) 為準）。未碰當日 R17 Chrome profile 或測試收據。
   - 第二輪精準補掃 Chrome user-data 中的可再生 `Cache`、`Code Cache`、`GPUCache`、`Service Worker`、`DawnCache`、`ShaderCache` 等資料；僅鎖定有 `Local State` 的舊 QA 測試 profile、最後使用日期早於 2026-10-26：**另刪除 2,586 個快取子目錄、30,735 個快取檔、3,292.57 MiB，失敗 0**。不刪同層截圖、result.json、QA scripts 或當日測試資料。明細 [Chrome Cache 清理](20261026-chrome-cache-purge.json)。
2. `.cleanup-archive/2026-10-10` 已於先前清理判定廢棄的 355 檔：**56.82 MiB**；來源列表 `artifacts/validation/cleanup-manifest.json` 保留。
3. 兩個 10/23 平行非 Git 快照（合計約18,706.10 MiB）、10/24 clean 發布 worktree（約99.39 MiB）。

這些容量是原始檔案大小估算，不能直接視作實際 NTFS 可用空間增量；可用空間需另以磁碟查詢確認。

## 保留的唯一需要回溯內容

- **原始美術設定**：`docs/archive/2026-10/original-stage-concepts/stage3..stage8_floor_first_design_20261020.png` 六張，共41.93 MiB；另保留兩份舊 kirigane 文件，合計八筆43.07 MiB。SHA 詳 [原始設定保存清單](20261026-original-setting-preservation.json)。這些都是 `ORIGINAL_UNAPPROVED_CONCEPT`，不可擅接正式 runtime；Stage4–8 現有 `art/stageN` 少量 STYLE_REFERENCE_ONLY 仍在。
- **舊程式追溯**：`.cleanup-archive/legacy-source-recovery-20261023.zip`，來源 10/23 的 js/docs/tests/tools 共 498 檔，未壓縮約10.67 MiB→壓縮3.50 MiB，SHA-256 `20eadcbc71582065d811cce40ebc50107322df214dd7f9deeab4b2314670202b`。不是日常可執行分支，僅備援。
- **正式場景與執行主線**：`art/stage1-night-town/`、`art/stage2-rain-port/` 與 `assets/img/`、`assets/audio/` 保持；`docs/STAGE_PATHS.json` 現為唯一現行路徑索引。
- **關鍵 QA 收據**：`scratch/r12-director/`、`roadmap.md`、`artifacts/validation/` 的其餘歷史驗證證據及未清楚歸類的衍生資料，沒有整包刪除，以免破壞 QA 可追溯性。

## 驗收證據／工作規則

- 檔案結構驗證：唯一同名前綴根目錄、Git worktrees 僅主目錄、release branch 在；原始六概念圖與五份機讀刪除收據存在；`docs/STAGE_PATHS.json` JSON 可正常解析；git conflict 0。
- `node --check js/ui.js`、`js/game.js`、`js/assets.js`、`js/renderer.js` 全部 exit0；22/22 雨港已發版正式圖片檔案的 SHA1 Git blob 相同。
- 後續 Agent **不要**讀 `backup/archive/release` 旁支舊路徑，也不要全域搜尋 `scratch`／`artifacts/validation`；先依 `AGENTS.md` → `docs/STAGE_PATHS.json` → `roadmap.md` 最新段 → 本次階段 QA receipt。
- 現有 R17C F1 loader、兩關 Boss/融合/配送與 F4 full8 仍有實際阻塞。**本次只證目錄精簡完成，不代表第一、二關完成可玩、正式版已部署或 Git 所有功能合併。**
- 本輪不 commit/push/deploy，不觸及音訊或付費圖像 API，未修改任何 production JS。

## 原始機讀證據

[Chrome Profile 清理](20261026-browser-profile-purge.json) ／ [Chrome Cache 清理](20261026-chrome-cache-purge.json) ／ [原始設定稿備份](20261026-original-setting-preservation.json) ／ [救援 Zip SHA](20261026-legacy-code-recovery.json) ／ [舊 Archive 刪除](20261026-retired-archive-root.json) ／ [舊 Backup 刪除](20261026-retired-backup-root.json) ／ [10/10 舊 stash 刪除](20261026-retired-cleanup-stash.json)
