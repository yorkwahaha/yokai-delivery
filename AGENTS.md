# Yokai Delivery — Agent 唯一現行工作入口（2026-10-26）

## ★ 2026-10-31｜正式美術必須是真圖片：不可把程序特效當成完稿

**核心遊戲視覺（護盾、Boss 預警／命中、技能主圖、地板與建築）應使用 ComfyUI 生成並審核的 raster WebP／PNG，禁止以 Canvas 繪製、SVG、簡單幾何或 emoji 冒充正式完稿。** Canvas 僅承擔圖片座標、縮放、逐格播放、物理對齊與載入失敗時的最低限度安全提示。生成圖先列 `ART_CANDIDATE_USER_REVIEW_PENDING`，可本機實機試圖，未經使用者審核不得提升為線上正式素材。畫面盡量無文字，含文字的盾牌/UI 必須不隨角色朝向鏡射。保留原始生圖與舊素材供回退。本規則優先於歷史 Canvas／SVG 代打。



## ★ 2026-10-31｜六招主動技能定案（覆蓋舊融合交辦）

**融合系統暫停、設計重審無排程。** 第一／二關只交付六招主動技能（katana、barrier、fire、boom、thunder、needle），每局最多 4 個主動技能槽照舊；正常升級／Lv5 覺醒／被動／御守維持。所有歷史「融合 10 組通關／Boss 掉繪馬／融合替換／開放一般局融合」任務從當前 Gate 移除；以六招的公平性、Boss、配送、場景接圖與雙關真可玩為先。

目前正常模式的融合門禁已在 `js/fusion.js` 關閉、普通升級池 `js/game.js` 排除 `fusion_`；保留既有融合程式／素材／測試，**不刪除、不啟用正式模式、不修改配方設計**。本段優先於下方 2026-10-26 歷史交接與十融合要求；不得因此對六招的正常玩法增設新限制。



**★ 2026-10-31 全遊戲素材路徑新規（必讀）：**正式圖片與音檔的分類、命名、核准狀態及安全遷移一律遵守 [docs/ASSET_CONVENTIONS.md](docs/ASSET_CONVENTIONS.md) 和機讀 [docs/ASSET_REGISTRY.json](docs/ASSET_REGISTRY.json)。動到素材前先執行 `python tools/asset_registry.py --check`，不可在正式路徑新增 `candidate/final2/seed/模型名`，不可直接刪除既有 assets；舊路徑相容使用 `js/asset-paths.js`，不可自行多寫另一組路徑。未完全遷移的圖片／音檔依 `docs/ASSET_INVENTORY.json` 保留，必須確認實際接線再轉換。此次更新只規範圖音檔，不改既有 AGENTS 人員與實機測試規則。

**最新暫時分工：Codex 80%主力遊戲邏輯，AGY 20%只做 ui.js 三直卡/日文字體微收尾與必要 renderer 字型接線；兩者停筆交權後才接同檔。**
**最多兩席；不新增管理/QA支線，僅語法與最窄局部單元自檢，遊戲與畫面由使用者親玩，交付標 USER_PLAYTEST_PENDING。**

## ★ 2026-10-26 最新規則：實機遊玩與主觀驗收由使用者本人負責（高於以下舊測試流程）

**Agent 的日常任務是寫程式、修程式、接圖片、修 UI、提供可玩的本機入口與精簡變更說明；玩家實際跑關、體驗、操作、難度／美術／手感評價及正式遊玩回饋一律由使用者親自做。除非使用者在新指令中特別要求 Agent 自己操作遊戲，不得自行跑長時間流程測試。**

- **禁止預設的 Agent 遊玩自動化**：不要開 Playwright／Chrome 去自動模擬玩家走路、取送貨20次、升級整局、打 Boss 全流程、完成八格視口、錄製長時間試玩，也不要再反覆修這些遊玩 harness。Codex 亦不自行做此類遊玩驗收。以前 R20／R21 長流程測試工單全部停止。
- **允許的輕量技術自檢**：修改檔案後可執行 node --check、必要的針對性單元測試、資料格式／資源路徑／檔案存在檢查、少量非互動式程式驗證。不要為每次小修改跑完整整合測試或專門建立新 QA framework。若程式本身無法啟動，可做最小診斷到可供使用者試玩，不等於 Agent 可自行完整跑關。
- **交付方式**：AGY 連續修好可明確從程式判定的功能後，提供現有本機 dev 試玩 URL／關卡切換方式，以及「改了什麼／這次請使用者驗哪兩三件／已知未解」的短回報。**沒有使用者試玩通過就標待使用者驗收，不把 Node PASS 說成手感、畫面或全關卡 PASS。**
- **回饋回路**：使用者試玩後提出畫面、操作或 BUG 反饋 → AGY 直接修改 → 做必要快速自檢 → 再交使用者試玩。Codex 只在重大技術障礙／程式碼安全或使用者明確指示時協助，不自行跑關驗收。不要因「未完成正式八格／20 配送」而卡住功能實作和交付。
- **例外必須當次明確授權**：只有使用者清楚說「讓 Agent 實際跑流程／自己操作遊戲」及範圍時，才可按授權做該類測試；既有舊交辦中的 Chrome／長局驗收描述不算授權續做。不得開第三 Agent 代跑。

---

## ★ 2026-10-26 雙 Agent 新制度（最高優先，覆蓋 R12～R21 舊多人分工）

**僅 AGY（Antigravity）主力開發 + Codex 按需技術總監／階段驗收。整個專案同時最多兩名 Agent 工作。** 本節為使用者新核准規範，舊單檔 writer／四 Agent 派工規則與本節衝突者即失效，但過往測試證據仍保留，不得自動復活舊工單。

1. **AGY 直接實作**：主要負責第一、二關的程式、場景接圖、錯誤修復、測試及可玩交付。完成當前核准工作所必需的 game／world／renderer／assets／ui 等多個程式檔案可以自行連續改；不必每換一個檔案又向 Codex 請權。以「發現問題 → 修正 → 最窄回歸 → 續做」取代層層 QA 派工；改重要功能前記一次檔案版本，不准無視已存在變更或多人同檔搶寫。
2. **Codex 按需總監**：只負責開局交接與重大決策、真正卡關支援、第一／二關可玩里程碑各一次必要驗收及精簡更新 roadmap。不要持續派微票、重複盤點和重跑受控假測試；AGY 能自行完成的問題不要中斷。原則上不與 AGY 同時修改同一生產檔；若無介入必要，可待命，無須長時間雙開。
3. **額度備援僅替換**：AGY 額度耗盡／服務故障時，先確認停筆、留當前狀態，再由 Cursor 優先、Grok Build 次之**選一位**替換 AGY，不開第三席。Codex 額度耗盡時 AGY 可單獨工作。OpenCode、Kilo 及本機 Ollama/Qwen 不再列入日常自動派工（可以保留安裝，不主動啟動工作）。
4. **以兩關真可玩為里程碑**：先 night-town 正常進關、取貨、答題完成配送、六招主動技能／覺醒／御守、Boss、結算與重玩；再 rain-port 正式地板、建築、海面與碼頭、敵人、配送、Boss、結算與重玩。完成一關再由 Codex 驗收一輪，不能拿圖片存在、程式函式存在、stub 或 QA 腳本失敗直接宣稱遊戲通過／故障。完整八格正式回歸須固定同版、原始網路／圖片／遊戲證據與真畫面才可標 PASS。
5. **簡化工作入口**：只讀本 AGENTS.md 最新段、docs/agent-handoff.md 最新交接卡、roadmap.md 頂端里程碑。舊 R20/R21 收據僅在追究具體根因時精準閱讀；不應每輪重讀全部長文、掃描整個 scratch 或再建一堆 rNN 任務管理檔。
6. **檔案管理與清理**：scratch/、test-results/ 優先留必要的近期回歸證據，重複且可重建的 Chrome profile／快取／截圖可列候選；tests/ 正式可重跑測試、tools/ 被引用工具必須保留。先查檔案來源、實際引用、最後使用、是否有未驗收證據，才提出保留／整併／清除；**未確認用途不得刪除**。不再建立額外專案根、大型工作樹副本或永久的整包 QA 測試輸出。
7. **安全不可破壞**：唯一專案根 I:\Projects\yokai-delivery；保護目前未提交的 dirty 工作樹、正式發布 0e5875d／e0278e5、9455 正常可玩服務、已有核准 WebP 與音訊。無使用者額外明確指示不得 git reset／clean／checkout／pull／add／commit／push／deploy，或付費生圖、修改金鑰／TTS／BGM、刪除未知檔案。禁止 SVG／程序幾何代替正式地板、建物、主技能／Boss 圖；新候選需人審。
8. **最新 QA 真相**：R20 第一關曾正常進關／取件但送貨0；R21 自動測試改路線後兩次 timeout，屬 HARNESS_EXCEPTION，**沒有證明玩家不能送貨**。歷史七條 404 沒有 URL，待正常操作記到真 URL 再定位。第二關完整自然配送、Boss 六招、裝置與正式畫面驗收仍未完成；十融合實戰已依 2026-10-31 決策擱置、不屬當前 Gate。R20 技能卡短文案修正經12項 UI 測試，不代表新卷軸美術已完工。

**交付節奏：AGY 持續完成第一關，再完成第二關；Codex 各里程碑才集中驗收。整合缺陷由主力直接修，不為管理 Agent 而管理 Agent。**

---


**2026-10-26 重複根目錄與過期瀏覽器設定檔清理已完成；遊戲本體 F1/F2 的驗收與修復仍未完成。** 現役工作以 AGENTS.md 最新雙 Agent 規範與 docs/agent-handoff.md 最新交接為準，不因「清理完成」推論所有 Agent 可同時搶寫。舊模型額度、Agent pane 與多輪派工不具新任務效力；完整歷史放 docs/archive/2026-10/old-entrypoints/AGENTS.md。

## 單一專案與歷史資料守門（2026-10-26）
- 唯一開發工作根目錄：`I:\Projects\yokai-delivery`。禁止自動掃描或重新建立 `I:\Projects\yokai-delivery-*-20261023` 舊備份／舊歸檔；原始設定稿已收斂在 `docs/archive/2026-10/original-stage-concepts/`，僅追溯才讀。
- 已發布的雨港版留在 Git commit `0e5875d`／branch `release/s2-assets-20261024`；不得用舊工作樹覆蓋主開發 dirty，也不得視本機 `HEAD a4aaa94` 已包含這次提交。
- `artifacts/validation/` 與 `scratch/` 是歷史執行／QA 證據，不是正式素材搜尋路徑；平常先讀 `roadmap.md` 頂端、`docs/STAGE_PATHS.json`、當輪 QA receipt，**禁止不加路徑限制全域搜尋／全部重跑舊測試**。新 QA browser profile 僅暫存，跑完應清除；正式圖片只能從 `assets/img/` 與各關唯一 `art/stageN-ID/` 核准的來源選。

## 每次接任務的最短讀法
1. 讀本檔，再讀 docs/STAGE_PATHS.json（八關唯一來源，機讀且很短）；需要目錄細節才讀 docs/PROJECT_FILE_MAP.md。
2. 只讀 roadmap.md 開頭的現況；相關功能才讀 docs/GAME_DESIGN_MASTER.md、docs/PRODUCTION_PLAN.md 與對應測試。
3. 所有美術都比照第一關，用 art/stageN-<stage-id>/scene/ 與 characters/，manifest.json 列出實際存在圖片，**不開 art/sN 或日期模型批次平行目錄**。
4. 引擎正式素材一律 assets/img/；共通 UI/VFX/單字/音訊不複製進 stage。art/ 是原稿，Git 忽略，不能當線上 URL。

## 已完成清理
- 第一、二關保留已選用圖；第三至八關的歷史美術已刪除，僅留 manifest 的少量 STYLE_REFERENCE_ONLY 參考圖與 Stage3 本次新候選，尚未獲准正式使用。
- 退件圖片刪除清單 art/archive/2026-10-24/ART_PURGE_RESULT.json；已結案文件 docs/archive/2026-10/。除追索舊證據外，不應掃描 archive。
- 第二關現行原稿集中 art/stage2-rain-port/scene/ 與 characters/；開發測試使用 manifest-dev-runtime.json。正式網站第二關素材在 assets/img/rain-port/s2-production/。

## 禁止與守門
- 本機主工作樹有未提交的 BOSS / roadmap 修改、且目前落後線上主分支 0e5875d。**禁止 git reset --hard、git clean、強制 checkout/pull、git add -A、擅自 commit/push/deploy**。單 writer、先查 Herdr 即時 pane 狀態。
- 音訊、TTS、BGM、API key、認證資訊不得隨便碰；媒體快取或程式變更必須另行 QA。
- 美術半水墨＋半浮世繪＋粗墨線＋和紙質感＋微 Q；禁止幾何程序繪圖替代地板/建築/主技能真圖。2.5D tilt=.60 由渲染器負責。
- 未獲使用者核准的新候選不得接正式網站；不得擅自呼叫付費圖像 API。
- 當次使用者指示優先；舊 QA、已撤派工、歷史備註都不是當前工作指令。

## GameDev Agent Skills（2026-10-25）
- 本專案第三方遊戲開發技能入口：`.agents/skills/yokai-delivery/SKILL.md`；已安裝 `router`、`create-game-assets`、`game-ui-ux`、`performance-optimization`、`camera-systems`、`game-feel`、`level-design`、`audio-design`。依任務選讀，專案規則優先。
- 原生 Canvas 2D／偽 2.5D 為已知架構；不得因 Router 或通用範例換引擎。禁止用 SVG／程序幾何取代正式美術。
- 第一至第三關的新圖目前由 ChatGPT 協作生圖、使用者審核；舊 Nano Banana 2.1 生圖派送／預算上限不再約束新工作。素材核准、接圖與部署守門仍有效。
