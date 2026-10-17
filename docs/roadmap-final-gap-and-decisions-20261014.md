# Roadmap 成果、缺口與決策｜2026-10-14

給ChatGPT／使用者：**持續更新的交付報告，當前尚未全部結案。** 精確39項狀態以 [執行看板](roadmap-execution-board-20261014.md) 為準；下列「已完成」只指明列範圍，不放行美術或發布。

19:07最新增量：P4.2 cache已修、安全範圍703/703 PASS（2音訊suite＋1真音檔hash未跑，圖片hash另驗）。C1 NFC／C3跨關投影修妥，runtime＋R13重跑28/28。C3真UI已載入但 **NOT_DONE**：R15原23/12含harness誤報，run-full6 32PASS/0FAIL/3HUMAN/3BLOCKED；pause未測，手機滿卡擁擠／印記暗底與tabs擴張熱區和filter重疊1.85邏輯px是後續修復項。R16 C4 12RED/2PASS尚未實作；setItem quota中斷是現役真缺陷，已定persisted:false/storageError安全語義。最新工作以看板優先，下表舊過程保留可追溯、不可拿作當前結案。

Stage4已少量產出 ground／筍童子idle／竹影魅妖idle 及 `preview_stage4_core_trio_scene.png`；該圖是source-only美術合成，非實機／Chrome。整批 WAITING_HUMAN，不生attack、不接runtime；19:07 AGY僅Stage4。額度35%為使用者回報，非工具查證。Git與音訊禁令維持。

R15 done626已交卷解凍；Cursor627修真C3及storage安全。Space R17 prep遇Rate limit exceeded done631，不連續重試；已真正啟動獨立Codex QA `/root/c3_independent_qa`，新檔owner承接focused驗收，等Cursor交卷固定production。候選審圖入口另見 [清單](art-review-queue-20261014.md)。

## A. 已完成且有實際證據

| 範圍 | 可追溯證據 | 限制 |
|---|---|---|
| 正式協調接管 | AGENTS現行17:04、handoff頂部、看板39列；實際Herdr prompts seq584/585/589/591/592/595/596/598 | 不具平台餘額API；96%是使用者回報 |
| P4.2 根因／精確契約 | p42-stable-depth-camera-zoom-contract.md、reference module/math test；16純math＋6viewport=22PASS | 參考模型不接runtime，單靠它不是實裝 |
| P4.2 本機runtime＋獨立Chrome | Cursor done seq594，12自測圖；Codex target45PASS＋CTM7PASS。R14 done seq607，15技術/守門PASS、0產品FAIL、26真Chrome圖；Codex再核12bounds；float32回歸已修 | 4項HUMAN、預設Z=1；不代替真設備 |
| 音訊安全回歸保護 | tools/director-audio-freeze.cjs（開檔前阻擋）與2PASS，director-safe-regression.cjs精確selected/excluded清單；703/703 | 排除audio-events/boss-music兩suite及media-cache真音檔hash一項，非media-cache整檔；圖片hash另驗。不聲稱真發聲 |
| 第二關核准妖怪runtime | rework四張核准WebP、stage2-approved-enemies 11PASS；前輪R7真Chrome與R8卡牆/fallback修 | Stage2石木與整關美術未放行，部署BLOCKED |
| C1/C2 配送runtime | docs/card-collection-runtime-20261014.md、R12 runtime15PASS；NFC及stageIds已修後28/28 | C3已載入但可讀性／真pause路徑未結案，storage quota待修 |
| C3獨立發現問題 | R13模型22項20PASS/2FAIL，含NFC跨關丟stageIds／低值覆蓋高值 | 兩個可重現資料缺陷，不是美術判斷 |
| Stage4–8 生產規格準備 | art/stage4-bamboo-maze/production-contract.md及stage5–8各production-contract.md | 都是PROPOSAL，尚無正式完整圖集／新AIruntime |
| Stage4竹泥少量候選 | candidates/candidate_ground_bamboo_dirt.webp實檔83570 bytes、SHA8a37b36a…；preview_bamboo_dirt_2x2.png | 候選未核准。來源記錄由AGY提供，不據單次成功推定額度全面恢復 |
| 既有旅路／八關基本內容 | A0–A5.5各既有報告與程式，B1 164詞、B3劇情／Boss流程 | 歷史88/603等快照不等於最新回歸；第4–8關真圖未完成 |

## B. 還沒完成與阻塞

| 工作 | 精確狀態／下一步 |
|---|---|
| P4.2觀感收尾 | cache密度已Math.fround(L*D)、Z不參與cache，安全回歸703PASS。最終1.10/1.15及blurgrade人審仍OPEN，真機FPS未驗 |
| C3真正圖鑑UI | 已正式載入，仍NOT_DONE。R15真圖確認進度暗底／mobile疊字、有效熱區重疊；Cursor627/633修，Codex獨立QA已PREP_READY等正式freeze。G03真正scope、G06事件delta0、G07真pause與最新screenshots須補；R15最新9圖＋3舊錯setup圖，詳errata |
| C4收藏獎勵 | 真32包資料／滿印trigger／awards同鍵持久化尚未實作。quota安全修先進行，待驗；圖片待核准，不加戰力。R16 strict gate不得只exit0，須RED/FAIL/BLOCKED全0 |
| C5整合QA | UI／獎勵接線後驗save reload、存檔拒絕、event去重、dev隔離、長期抽詞與公式。R13可復用，避免等價重跑 |
| Stage1 P0 | R11 NOT_REPRODUCED、17PASS/0FAIL/2HUMAN；晚載/慢網和實體首幀尚無放行，不能宣稱使用者回報已修好 |
| Stage2石木交界 | 硬切仍存在，compat候選不等於核准。需要真正自然過渡與連續Chrome的人審；不重繪核准怪物 |
| Stage3 2D角落 | 原矩形拼片最新用户FAIL；自由2D terrain plan尚未正式核准接圖。優先完整透明自然石階decal，禁止兩方圖硬疊 |
| Stage3小怪／Boss | 只找到idle候選與明確「不可偷接未核准怪」紀錄；未見櫻小僧/花天狗人審批准，attack母版延伸與runtimeWAITING_HUMAN/ART |
| Stage4–8正式識別 | 地板、场景、三建築、裝飾、地標、專用minion/Boss idle/attack缺核准真圖；規格不算完成。新重大AI提案要人審；不能以8關基本工程勾真圖DONE |
| P7/A6/B5 | 實體手機/iPad/Xbox未有可操作設備，WAITING_DEVICE；桌機自然10min及全8關平衡另排，不拿快進/hook勝利假裝自然通關 |
| R1/R2／BGM/TTS | 使用者無限期音訊凍結：不讀／改audio/audio.js/tts，API/KEY不碰。正式發聲和各關曲目仍無放行 |
| D1–D3 | 技術完整回歸、全部人工/裝置門與再次發布授權未滿；未Commit／Push／Deploy。A5舊發布紀錄不能放行現役dirty |

## C. 必須由使用者決定／人審

| 決策 | 推薦選項與可審檔 |
|---|---|
| P4.2 最終Z | 先比較1.10與1.15；推薦1.10保留較多資訊，當前正式預設仍1。`artifacts/validation/p42-cursor-20261014/desktop-z1.10-25d.png`／`desktop-z1.15-25d.png`，tablet同名；獨立R14補證據後再選 |
| Stage3地板角落 | 推薦單張完整自然decal，先審既有junction-experiments/candidate_exp_b_shrine_courtyard_decal.png；alpha與地面融合尚待AGY核對，不直接接圖 |
| Stage3角色母版 | candidates/candidate_boss_hana_tengu_idle.png與小怪idle候選只供審；先定各一母版再同源改attack，不獨立兩次文生圖 |
| Stage4竹泥與Stage4–8新圖 | 先審Stage4的2×2竹泥預覽；之後每關少批母版/三建築，不批量未批准角色。偏暗、竹葉比例及重複紋理由使用者判斷 |
| Stage4–8重大技能 | 建議暫緩反向操控、遮題板假名、封衝刺、三連破盾；優先不破壞現役答題/操控流程的可躲預告技能。現有提案只WAITING_HUMAN |
| C3/C4插畫 | 推薦先用核准紙札＋中性文字，待詞卡/套卡插畫少量審稿後才接；不以emoji/幾何插畫補位 |
| Stage2潮波182–210區間 | R7觀測觸發210而有效射程182，現役未改；需另定縮觸發或延射程，不混進P4.2/C3，更不擅改共用無敵幀 |
| 音訊凍結 | 維持凍結；解凍必須使用者明確指示。Agent不為湊Roadmap呼叫TTS或換曲 |
| 真機驗證 | 請實際設備冷啟/旋轉/背景切回、操控/配送/Boss各跑；回報設備/OS/browser與影片。模擬viewport無法替代實際RAM/溫度/觸感/FPS |

## 接續點

R15已DONE，Cursor working633完成兩補修（disabled replay無副作用／pending存檔按storage identity隔離）後freeze；獨立Codex QA `/root/c3_independent_qa` PREP_READY，替代rate-limited Space done631。AGY done634，Stage4整批WAITING_HUMAN、已停止舊Stage2票。靜音預覽 `http://127.0.0.1:9400/index.html?dev=1&tilt=0.6&zoom=1.10` 已真啟動/HTTP驗證，選第三關才有zoom；8816已關閉。C3/C4工程與地板真機/美術門分開推進；保留原錯誤log，不承諾session結束後自發工作。
