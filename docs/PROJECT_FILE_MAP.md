# 專案檔案地圖

2026-11-27｜唯一根 I:/Projects/yokai-delivery。精確八關路徑以 STAGE_PATHS.json 為準。

| 路徑 | 用途 |
| --- | --- |
| js/、index.html、service-worker.js | 正式遊戲程式及快取 |
| assets/img/、assets/audio/、assets/fonts/ | 正式媒體及已登錄備援 |
| art/dev-runtime/img/ | 私有 DEV 現役圖片，Git 忽略 |
| art/stageN-ID/ | 原畫、生成來源、manifest，不直接新增 runtime 圖 |
| art/audio/、art/skill-expansion-10-13/ | 現行 DEV 音訊／技能候選及來源 |
| docs/ | 現行規格、機讀清冊、集中試玩頁 |
| tests/ | 現行測試、共用夾具及少量獨立工具 |
| tools/ | 現行生成、驗證與服務工具 |
| scratch/、artifacts/ | 近期驗收／仍被依賴的輸出，非正式素材根 |
| .cleanup-archive/images/ | 所有退役圖片，Git 忽略，保留原相對路徑 |
| .cleanup-archive/history/ | 歷史文件、測試及證據，Git 忽略 |

正式及 DEV 根下採同類別：stages/<stage-id>/{scene,tiles,props,objects}/、enemies/<id>/、vfx/enemies/<id>/、delivery/<stage-id>/。前四關尚存歷史別名及 fallback；不能因 canonical 規格而直接移除舊實體。S5–8 已採 DEV canonical 目錄。共通 UI／技能／音訊不複製成八套。原始資料與退役路徑查 HISTORY_INDEX.json；現役清冊查 ASSET_REGISTRY.json、ASSET_INVENTORY.json、各關 manifest。
