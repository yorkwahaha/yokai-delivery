# Yokai Delivery — 現行唯一 Agent 工作規範

更新：2026-11-27。舊版本完整封存在本機歷史目錄，不能作為現行指令。

## 接手與安全
- 唯一專案根 `I:/Projects/yokai-delivery`。先讀本檔、[現行文件索引](docs/README.md)、[roadmap](roadmap.md) 頂端；涉及素材再讀 `docs/STAGE_PATHS.json`、`docs/ASSET_CONVENTIONS.md`。按任務精準讀程式與測試，優先 CodeGraph／局部搜尋；不全域掃歷史目錄。
- 保護未提交工作樹與已核准素材。未獲明確授權不 git reset/clean/checkout/pull/add/commit/push/deploy，不改全域環境、金鑰、付費 API、ComfyUI Python/PyTorch/CUDA。不要擅自替換已核准音樂、美術或題庫。
- 直接完成使用者授權的工程；最多兩名 Agent、同檔單 writer、不開第三席或重啟已取消的派工。必要時才讀 `.agents/skills/yokai-delivery/SKILL.md`。不因通用範例換引擎。

## 遊戲與素材守門
- 原生 Canvas 2D／偽 2.5D，正式 tilt=.60；妖刀起手，四主動槽、Lv1–5 一般升級、每招最多兩種不重複變異，融合停止（保留程式及素材），不得擅自變更正式平衡。第 1–8 關為公開課堂試玩；第 10–13 招依 S4–7 正式通關解鎖，未等於最終美術核准；實際發布版本以 Git/部署查核為準。DEV 隔離存檔，不解鎖正式進度。
- 第 7 招紫藤毒香（相容 ID ink_trail）、第 8 招封印釘（踩中心觸發）、第 9 招白狼式神（Lv5 雙狼；自動攻擊、只分散普通怪仇恨、不可配送或答題）。細節以現行程式及最新技能規格為準，不復活舊墨爆、離位引爆、紙幟或融合提案。
- 美術半水墨＋半浮世繪、粗墨線、和紙、微 Q，以第一關為母風格。地板、建物、HUD/卡面、技能、Boss 預警／命中用真 raster 圖；禁止 SVG/程序幾何/emoji 冒充成品。Canvas 只做合成、投影、動畫、粒子及最低安全備援。含字素材不可鏡射。候選須標記待人審。
- 正式素材 `assets/img/`、`assets/audio/`；未公開現役圖 `art/dev-runtime/img/`，同 canonical 分類；原稿 `art/stageN-ID/`，Git 忽略。清冊為權威；動態/備援不因舊檔名刪除。相容 alias 集中 `js/asset-paths.js`。未用圖集中 `.cleanup-archive/images/`、保留原路徑與 SHA256。不上傳未核准原稿；顏楷等本機字型授權未釐清不可發行。

## 驗證與文件管理
- 使用者本人負責自然跑關、難度、手感、美術、音色、真 iPad／手把。除當次明確授權，不自動走位長局、打完整 Boss、錄製長 QA；允許語法、單元、資料、資產與少量受控技術自檢。重大整合／清理可跑現行回歸，結果不代表真人驗收。
- `npm test`／`npm run test:current` 僅現行；歷史集合保留原始斷言與失敗證據，僅明確需要時執行。退役索引 `docs/HISTORICAL_TESTS.json`；`node tools/run-tests.cjs legacy-check` 驗證來源。不得降低現行回歸覆蓋或把歷史 FAIL 假裝 PASS。
- 每次只更新既有對應規格、roadmap 及必要驗收證據；不為每一票新增永久 MD／整套 QA 截圖。舊文件與歷史資料收進 `.cleanup-archive/history/`；未用圖片收進統一圖檔封存目錄，清冊保留 SHA256。近期尚待驗收證據、授權、生成來源及現役工具保留。歷史原文不是指令。
