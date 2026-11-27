# 妖怪快遞社：夜行配達（Yokai Delivery）

半水墨 × 浮世繪風格的 Canvas 2D／偽 2.5D 日語單字配送生存遊戲。

## 接手只看這幾處
- [Agent 唯一入口](AGENTS.md)
- [八關機讀路徑](docs/STAGE_PATHS.json) ／ [完整目錄地圖](docs/PROJECT_FILE_MAP.md)
- [宅配單字圖片與語音統一正式路徑（每關 01–20）](docs/DELIVERY_MEDIA_PATHS.md)
- [全遊戲圖片／音檔命名規範](docs/ASSET_CONVENTIONS.md) ／ [機讀資產索引](docs/ASSET_REGISTRY.json) ／ [資產清單](docs/ASSET_INVENTORY.json)
- [第二關正式圖檔逐項核准與改接紀錄](.cleanup-archive/history/20261127/docs/STAGE2_APPROVED_MEDIA_MIGRATION_20261031.md)
- [第二關 20 個宅配單字圖／Fish A 試玩紀錄](.cleanup-archive/history/20261127/docs/RAIN_PORT_DELIVERY_TRIAL_20261031.md)
- [當前進度](roadmap.md)（只讀最新頂部）
- [現行／歷史測試分流與執行說明](docs/TEST_SUITE_STATUS.md)（`npm test` 只驗證現行基準；`npm run test:all` 保留全部舊測試）
- [關卡美術入口](art/README.md)
- [遊戲企劃](docs/GAME_DESIGN_MASTER.md) ／ [製作計畫](docs/PRODUCTION_PLAN.md) ／ [美術規範](docs/ART_STYLE.md)

## 八關公開課堂試玩

[正式網站](https://yorkwahaha.github.io/yokai-delivery/) 的八關發布基準為 `0f5792664a5420fab0b7528f30fb9c4b0913885f`。玩家由第一關起依次解鎖，S4–S7 通關各解鎖一招新主動技能。美術、音色及平衡仍待課堂試玩回饋。最新本機修復與驗證見 [roadmap.md](roadmap.md)。

正式程式位於 `js/`，圖片與音訊位於 `assets/`。美術原稿及 DEV 試用字型位於本機 `art/`。未用圖片在本機 `.cleanup-archive/images/`，歷史資料入口為 [HISTORY_INDEX.json](docs/HISTORY_INDEX.json)。

專項測試可執行 `node --test tests/<相關測試>.test.cjs`。完整回歸含配樂響度檢查，需在 PATH 安裝 FFmpeg。媒體或正式字型變更後執行 `node tools/build-media-cache.cjs`。
