# 妖怪快遞社：夜行配達（Yokai Delivery）

半水墨 × 浮世繪風格的 Canvas 2D／偽 2.5D 日語單字配送生存遊戲。

## 接手只看這幾處
- [Agent 唯一入口](AGENTS.md)
- [八關機讀路徑](docs/STAGE_PATHS.json) ／ [完整目錄地圖](docs/PROJECT_FILE_MAP.md)
- [宅配單字圖片與語音統一正式路徑（每關 01–20）](docs/DELIVERY_MEDIA_PATHS.md)
- [全遊戲圖片／音檔命名規範](docs/ASSET_CONVENTIONS.md) ／ [機讀資產索引](docs/ASSET_REGISTRY.json) ／ [資產清單](docs/ASSET_INVENTORY.json)
- [第二關正式圖檔逐項核准與改接紀錄](docs/STAGE2_APPROVED_MEDIA_MIGRATION_20261031.md)
- [第二關 20 個宅配單字圖／Fish A 試玩紀錄](docs/RAIN_PORT_DELIVERY_TRIAL_20261031.md)
- [當前進度](roadmap.md)（只讀最新頂部）
- [現行／歷史測試分流與執行說明](docs/TEST_SUITE_STATUS.md)（`npm test` 只驗證現行基準；`npm run test:all` 保留全部舊測試）
- [關卡美術入口](art/README.md)
- [遊戲企劃](docs/GAME_DESIGN_MASTER.md) ／ [製作計畫](docs/PRODUCTION_PLAN.md) ／ [美術規範](docs/ART_STYLE.md)

## 固定路徑
- **唯一開發工作樹：`I:/Projects/yokai-delivery/`**。2026-10-26 已移除兩份 10/23 舊備份／舊歸檔，以及乾淨的 10/24 發布 worktree；僅保留已核原始設定稿、縮小後冷備援與 Git 發布分支。詳見 [目錄整併收據](docs/cleanup/20261026-CONSOLIDATION.md)。
- js/：遊戲正式程式；assets/img/：遊戲正在下載的圖片；assets/audio/：音訊。
- art/stage1-night-town/ ～ art/stage8-yomi/：各關唯一美術原稿，統一 scene/、characters/、manifest.json、README.md；歷史素材見 art/archive/。
- tests/ 回歸測試；tools/ 建置腳本；scratch/ 臨時 QA；docs/archive/2026-10/ 歷史資料。

## 重要版本差異
正式網站 https://yorkwahaha.github.io/yokai-delivery/ 已部署 0e5875d（第二關新圖）。Git `release/s2-assets-20261024` 分支保存已發版 commit，**不再保留另一個平行實體工作樹**。I:/Projects/yokai-delivery 主工作樹仍含未提交 BOSS 等工程、Git HEAD 尚未合併公開提交；不得 reset、強制同步或用舊版覆蓋 dirty。第二關選定原稿在 art/stage2-rain-port/scene/ 與 characters/，已發布 22 個 runtime bundle 檔案與主專案 assets/img/rain-port/s2-production/ 位元內容完全相符。

專項 Node 測試：node --test tests/<相關測試>.test.cjs。需要更新媒體時才執行 node tools/build-media-cache.cjs；發版前實測網頁、手機與資產快取。
