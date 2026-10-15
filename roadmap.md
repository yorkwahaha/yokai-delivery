# Yokai Delivery — Roadmap／跨對話持續交接

## 2026-10-15 14:21｜使用者最新決策：先完成全部功能接線，再集中審核美術與語音（最高優先）

**本節覆蓋後文所有「等美術核准才能寫程式／八關接線受阻」的舊順序，舊內容僅作溯源。** 使用者授權把第一季八關**除正式美術圖、語音包外的所有線先接通**；到時再一次檢查各關圖檔。這不是授權自行核准圖檔、調整音訊或提前發行。

### 本輪真正的開發目標：八關功能接線完成（CODE_COMPLETE，非 ART_COMPLETE）

1. 八個 stageId 都必須走同一可執行資料導向路徑：關卡選擇／任務詞包／場景配置／地面與地標插槽／敵人生成與行為／Boss封印與出場／結算／解鎖／失敗／卡片收藏／保存與返回；這是唯一功能完成標準。已有八關流程9/9加速PASS，**不可當作所有資產插槽與獨特Boss都已接通**。
2. 依**實際存在的正式資產**建「八關 stageId→圖像插槽」映射和缺圖降級處理，至少涵蓋地面、場景、建築、裝飾、地標、專怪 idle/attack、Boss idle/attack、UI Boss 標識。插槽可先處於 WAITING_ART、用現役已存在的共用圖或清楚標明缺圖，**不准以新幾何／色塊冒充最終素材、不准將 art/ 未核准候選偷偷接 assets/img/ 生產環境**。把「引擎槽已可插」與「正式圖已核准接入」分別記錄。
3. 先實作數據與邏輯層面的八關差異化怪物／Boss（盡量重用現有追擊／投射／衝刺／預警行為骨架；不需要圖片就能測觸發與判定）。如涉及**全新未核准玩法**，僅留下不啟用的擴充槽與明確待決，不代使用者設計。
4. 第1–8關到站題目、長假名、Boss題板、HUD、圖鑑、結算在真頁面要能跨關正確帶入 stage metadata，不因圖片尚缺而卡死或存檔汙染；只修實際可復現的UI缺陷。
5. 「功能完成」的交付不是一篇報告或 N 個測試，而是**可本機試玩的八關、完整共用流程、每關可替換的 asset slot、清楚缺圖名單**。最多一個聚焦的跨關流程確認與必要真頁面截圖；加速模擬必標示，不能說是真機10分鐘。

### 功能先行的兩道里程碑（取代後文的美術→接線硬相依）

- **M1：CODE_COMPLETE / 所有八關的程式、資料、UI、敵人/Boss邏輯和圖像/語音介面就緒**。語音只保留既有呼叫路徑，不讀、不變更、不測真實語音；圖片只接現役核准素材或安全fallback，未核准候選仍隔離。由 Kilo 做功能整合、Muse 真頁UI與AGY資料/映射核對；Codex 一次性核對接線缺口。
- **M2：ART_AND_AUDIO_APPROVED / 使用者集中審圖、決定是否解凍語音**。在 M1 之後進行批次圖片核准→替換→自然遊玩／實機→發行驗收。沒有明確語音解凍就仍保持凍結；不能以 M1 作為部署許可。

### 明確分工與 writer 範圍

| Agent | 主工作 | 副工作 | 本輪獨占檔 |
|---|---|---|---|
| Kilo | 八關 runtime asset 插槽、按需載入與正式圖缺失 fallback；真正的專怪/Boss行為接線 | 八關本機可玩流程、解鎖、存檔與物件一致性 | js/assets.js、js/game.js、js/world.js、js/renderer.js、js/store.js 與 tests/kilo-* |
| AGY | 每關場景／詞包／敵人／Boss 資料配置與穩定 stageId，將已有內容對齊 Kilo 的既有API | 完整缺圖表、日後素材替換路徑（不生成或接候選） | js/words.js、js/story-dialogue.js、art/ 候選、必要新資料驗證檔 |
| Muse Spark | Stage1–8 Boss題板/任務牌/UI從 stage metadata 正確渲染 | 手機/平板跨關介面、字卡與結算；真Bug才修 | js/ui.js、js/card-gallery-ui.js 與 tests/muse-* |
| Codex | 簡短系統級統整：找出八關缺少的接線、對齊三Agent接口而**不搶檔** | 最後 M1 一次性整合驗收 | 只讀實際源碼；如需寫接口契約，寫一份小型共享規範而非大報告 |

**派工順序**：Kilo 先清點目前只載第1/2關地圖的 assets.js（loadStageMapArt(stageId) 尚有二選一映射），找出可用槽→先改 data-driven 8關 asset mapping；AGY 同時核對八關 visual/敵人/Boss metadata 及安全待圖索引，不覆寫Kilo介面；Muse 同時用真頁面核對 UI stage metadata。三者交付後 Codex 只做一次跨檔整合。優先修可玩性阻塞，禁止為了保持Working而累積小測試／報告／預覽。

**長期保護**：數百未提交變更不動；不得 git commit、push、deploy、reset、clean、checkout；音訊/TTS/BGM/API金鑰完全凍結；尚待審稿與源母版保持原樣，使用者到時集中決定。甘特圖日期為舊的條件式示意，應按本節的新「M1功能先行 → M2美術/語音」重新理解，不把美術核准當 M1 的阻塞。

## 2026-10-15 新版第一季製作總計畫（最高現行，覆蓋下面所有舊派工快照）

**請優先閱讀：[第一季遊戲企劃／工作包／Agent 分工／驗收基準](docs/season-one-master-plan.md)，以及 [可視化甘特圖](docs/season-one-production-gantt.html)。**
截至本次盤點：八關程式流程已具備；真正關鍵路徑是 Stage2 整關視審、Stage3/4/5/6 候選美術核准、Stage7/8 正式美術、獨有敵人／Boss 接線、自然局／實機／發行門。
下面的 2026-10-14／15 狀態日誌保留供追溯；其「最高現行／繼續監工／Grok優先／Kiro」等舊標籤皆不再構成派工指令。不要重跑已通過的測試或把候選美術當成整關完成。
新工作的順序與 Agent writer ownership 以製作總計畫第 6–9 節為準。音訊/TTS/BGM/API Key 凍結；不得擅自 Commit、Push、Deploy、Reset、Clean、Checkout。

## 2026-10-15 03:26 最新人審與美術整理（最高現行）

使用者命令持續派工，撤銷前輪「全受人審阻塞」結論。Stage2石木過渡v2為USER_APPROVED（僅此素材視覺，非整關／部署）；Stage1切鏡USER_REPORTED_VISUAL_OK（非跨裝置FPS）。Stage3巨石庭院＋神社候選構圖／貼花／預覽拒收，現役神樂殿／古櫻／三地面保留；Stage4黑暗竹泥／巨大落葉與組合預覽拒收，未判定妖怪母版保留。音訊164詞包繼續凍結；>5假名詞先非破壞UI分析。

AGY專責真正移轉art：每關art/stageN-name根恰characters/、scene/兩素材子目錄，Preview在根，ASCII snake_case／idle與E/B/G/H/O前綴；先mapping＋MD5/SHA256＋引用／拒收刪除清單。僅明確拒收、非現役且無runtime/test/docs引用候選可刪，證據文字保留manifest，核准／源母版／測試證據／未判定不刪。Grok隔離審查renderer比例／重複／遮擋與Stage2接線計劃；mapping完成後才分code引用writer。Codex做獨立QA與協調，不代AGY整理。357 dirty保護、Cursor禁用、Kiro429不反覆重試、音訊與Git禁令維持。票見[唯一master](docs/roadmap-execution-board-20261014.md)M15區。

執行增量：M15-02兩份技術／長假名分析已驗收；M15-03核心引用修正done78，root41項對應快照不變＋新增4檔語法通過，動態metadata引用另收尾。M15-04 Grok已實際working79接Stage2核准v2兩水平縫；AGY M15-01c working77收art/docs引用與metadata，194列全覆蓋、192保留列hash一致／47範圍外不變。Kiro idle21不重試429。最新票狀態以唯一master為準。

## 2026-10-15 01:51 復工／Codex 執行總監（最高現行）

使用者明確解除 10/14 23:03 停工閘門，授權 Codex w7:p1 自主分階段持續派工、獨立驗收與維護 [唯一 Project master／執行看板](docs/roadmap-execution-board-20261014.md)。Grok Build w7:p3（獨立服務 Grok 4.7 High）優先 coding；OpenCode w7:p2（Kiro Sonnet 4.5 High）獨立 QA／其次實作；AGY w7:p4（Gemini 3.8 Flash High）隔離美術規格。Grok 使用者回報剩 19%／約 23 小時重置，非工具實測；實際 rate limit 即停派，保留交接並確認 Kilo Gateway NVIDIA Nemotron 3 Ultra Free 真模型 ID／CLI 路由後接任，不混稱 Kiro Sonnet。

Cursor 全面停用 19 天，未經日後明確許可不恢復；禁 cursor／cursor-agent／Cursor 供應 Grok 路由。Space Bunny／Muse 待額度。覆蓋下方停工、Grok 不派、Kilo 退出及 Cursor 主寫歷史。保護復工實查 350 dirty；音訊／TTS／BGM／KEY 不讀不執行不改、未核准候選不接，真機／人審不假 PASS。未 Commit／未 Push／未 Deploy，禁 reset／clean／checkout。

復工證據：E22-05 停工前已修完且獨立 contrast 15 PASS，index／gallery UI SHA256 與報告完全一致，無需重做。C4 核心 24 PASS、C3 scoped 9 PASS 依相同快照復用；P0 仍 NOT_REPRODUCED／WAITING_DEVICE。首輪安排：Grok 修 R16 三處已定位 harness 缺陷及 strict 驗收；Kiro 做 C5 獨立整合 QA；AGY 整理既有候選與待審規格，不生圖。票狀態以唯一看板實查為準，不假設跨重啟常駐。

復工首輪已驗收：E15-01 Grok R16三根因＋多包補領假PASS修復，root獨立strict23 PASS；E15-05正負控制3 PASS並改唯一run輸出保留舊證據。Kiro C5資料面10 PASS已root重跑，其後實際429已停止retry並保留session，root接驗現役storageCases3 PASS、最新安全回歸731 PASS／0FAIL／0SKIP（排2音訊suite＋真音檔hash案例），9檔production hash不變。C5工程驗收完成，C3/C4藝術與真機另待。AGY清冊done22／62行、4主候選SHA與連結已核，候選未接線。Grok未遇rate limit，Kilo只核metadata不推理。無新核實產品缺陷；下一整合依賴人審／真機／正常實玩，不虛構派工。

## 2026-10-14 23:03 緊急停工／重開機（**目前最新、優先於下方所有持續派工規則**）

使用者命令現在全部 Agent 暫停，待使用者自行關閉 Herdr、重啟電腦。**在使用者重啟後再次明確允許前，禁止自動派工或執行任何工作**。Cursor 月額度約剩20%、重置約19天後，**立即停用且直到使用者日後許可不得使用**；替代團隊為 Codex 執行總監、OpenCode OmniRoute Kiro Sonnet 4.5、AGY、Kilo 的 Nemotron 3 Ultra Free。Space Bunny/Muse 額度耗盡、Vercel 已放棄。停工現場、角色/工作票/美術和音訊凍結、復工程序詳見 [重開機交接](docs/reboot-handoff-20261014.md)。下方任何舊「Codex持續派工」「Cursor主寫production」「Kilo退出」等規則均被本最新指示覆蓋。


## 2026-10-14 22:xx 現行恢復協調

Codex依使用者額度恢復授權重新自主調度與最終gate（取代20:11 owner）。337 dirty保護；C4現役已交9＋48 tests、Chrome，但獨立驗收未結案，R16-04／harness先分辨。Cursor舊High session短交接已派working661，production固定，之後保留舊session另開同High；AGY Stage2石木真圖候選已交WAITING_HUMAN，不重開或接圖；Space rate-limited保留，不重試，Sonnet4.5 via OmniRoute承接新owner獨立QA。C3／C4藝術與實體裝置仍OPEN，P0慢網／stage地板依真證據續排。音訊／金鑰與Git禁令維持。

## 2026-10-14 20:11 ChatGPT臨時接任總監｜Codex/Space額度阻塞

使用者最新指令：Codex 6.1 Sol 5小時額度用盡，暫停Codex，ChatGPT接手執行總監與其他Agent工作分配。Herdr實查 codex_lead done（終端明示 usage limit、約21:53可再試），space_bunny done（Rate limit exceeded），cursor與agy原先done。**這是目前有效owner與發派狀態，不依賴舊17:04 Codex長期總監歷史指令。**

- [x] ChatGPT直接執行R17 focused正式Node/真Chrome：node --require ./tools/director-audio-freeze.cjs tests/director-c3-focused.acceptance.cjs --frozen；**30 PASS、0 FAIL、3 HUMAN_REVIEW、0 BLOCKED**。Quota/Security storage及三視口的解卡隱私、44CSS熱區、禁止再聽事件0新增呼叫、真play→pause→圖鑑→pause、HUD和world回歸均有實證；test輸出 artifacts/validation/director-r17-c3-storage-20261014/run-2026-10-14T12-12-55-664Z。此驗收只代表該snapshot C3技術gate，仍需使用者觀感/真實裝置驗收，C3不可冒稱全藝術完成。原R17 PREP_READY描述已被真完成覆蓋。R15舊出界/暫停錯setup可依R17精準測試更正。
- [~] Cursor w5:p9（Grok4.7 High，**Fast禁止**）已真正交辦並working：C4完整正式runtime，獨占 js/card-collection.js/card-delivery-bridge.js/card-gallery-model.js/game.js與必要展示JS；將9項Cursor C4 test的8RED、R16 Space12RED轉綠，安全record persisted:false/storageError不回退，真32pack/164word、唯一獎勵、NFC/跨stage/official-dev隔離、舊檔補發、HUD純文字，無新未核准插畫。docs/card-rewards-runtime-20261014.md、artifacts/validation/c4-cursor-20261014；上下文先前73.8%，接近80%需安全交接同Grok模型新會話。
- [~] AGY w5:p5 Gemini3.8 Flash已真正交辦並working：第二關 rain-port 現役石板↔木棧道硬切的**新真圖候選**，只寫 art/r4/handpainted-candidates/stage2-ground-transition-next/**。圖片以原兩邊image-to-image參考小量生成、實際拼接與2D/0.60預覽、人審前不能接runtime，429單次停止；不重繪Stage2已核准Shiome/Ikari四圖。
- [!] Space Bunny w5:p4 額度暫不足，**不再投遞重複會失敗的agent任務**。C4必要Node測試及R17後續驗收暫由ChatGPT用音訊安全guard直接跑；等Space可用時再做真獨立Chrome/差異QA，不提前冒稱獨立PASS。
- [!] Codex w5:p8因usage limit暫停，不指派新票、不推測實際新配額。等恢復才考慮交還管理，ChatGPT現在負責獨占協調與里程碑證據。
- 未完成的Stage1 P0慢網/真機、Stage2石木硬邊視覺、Stage3石階角落/妖怪Boss人審、Stage4–8正式圖、C4 UI人審與真手機/平板測試仍在看板。音訊/TTS/BGM/API/KEY無期限凍結，不讀不改；**禁止Git reset/clean/checkout/commit/push/deploy**。圖片候選技術PASS不等於用戶藝術核准。


## 2026-10-14 19:07 現行 QA 收斂（下方舊快照保留）

接續實查：R15 done626已解凍，Cursor working627修真C3／quota儲存。Space R17 prep遇 `Rate limit exceeded` done631，停止重試，獨立Codex QA `/root/c3_independent_qa`承接新owner focused檔、等runtime交卷才Chrome。不改Space檔，不因QA模型受限讓runtime停工。

C3 **NOT_DONE**：R15原23PASS/12FAIL含全頁HUD／累計Audio、錯bounds/rounded scale及未真pause的harness問題；最新run-full6為32PASS/0FAIL/3HUMAN/3BLOCKED，freeze仍待Space交卷，pause路徑未測。Codex真圖發現印記落暗底／手機滿卡擁擠，交卷後Cursor修、Space focused驗，勿以0FAIL代替可讀性／美術PASS。C4 R16 12RED/2PASS是尚未實作，quota setItem中斷為真缺陷，契約已定persisted:false安全語义。安全回歸703/703，排除2音訊suite及1真音檔hash；圖片hash另驗。Cursor done622／Space working624／AGY working625但最新只Stage4候選、不新生圖或接runtime。35%為使用者回報非工具實測。部署／音訊凍結不變，逐項以[唯一看板](docs/roadmap-execution-board-20261014.md)更新。

## 2026-10-14 17:04 起現行執行協調

Codex執行總監自主調度Cursor production／AGY真圖候選／Space Bunny Free獨立QA，取代08:14 Sol待命規則；正式39項逐項證據／相依／下一步見 [唯一執行看板](docs/roadmap-execution-board-20261014.md)。歷史勾選不等於現況，最新拒收與人工／裝置門優先。**P4.2已正式接入且R14 done seq607：15技術/守門PASS、0產品FAIL、4HUMAN、26真Chrome圖；Codex45targeted＋7CTM、12bounds校準通過。** Cursor seq608修float32回歸並正式接C3資料/UI；Space seq609只準備R15、驗收等交卷freeze；AGY seq610最後此批Stage4 Boss idle母版候選，已有竹泥/筍童子idle仍待人審，不接runtime或生attack。C5 core長測70,000抽詞＋1000配送/重載/dev隔離2PASS；不代表UI後整合已驗。三者owner不重疊。靜音本機preview已啟動 `http://127.0.0.1:9400/index.html`，未部署。

可執行次序：P4.2正式實作→獨立Chrome→C3兩資料缺陷＋真UI→C4資料／觸發→C5獨立QA；並行Stage4–8契約／小批候選與地板阻塞清單。P0慢網／真機、Stage2石木、Stage3角落、新關美術、zoom預設、實體裝置與音訊凍結不得假勾DONE。額度96%為使用者回報；有效工作至約10%為偏好而非已測餘額。未Commit／未Push／未Deploy；所有音訊與TTS不讀不改。

以下16:xx及更早段落保留歷史；已被上述runtime派工及最新驗收範圍取代。

## 2026-10-14 16:xx P4.2：消除房屋呼吸式縮放＋2.5D鏡頭拉近評估

最新用戶體感：2.5D 第三關新增柔焦看得到，但角色上下移動時，畫面上方固定神社的尺寸會明顯突然放大/縮小，像呼吸動畫而非自然透視；使用者提議2.5D視角另外拉近1.10x～1.15x以改善空間層次。ChatGPT查證 js/renderer.js sceneryDepth(worldY,viewerY)：distance=max(0,viewerY-worldY)、smooth01(distance/520)、scale=1-0.12*t（enhanced 1-0.15*t）；玩家Y變就重新決定房屋尺寸，為可解釋根因。因而**先消除相對玩家Y驅動的房屋縮放，另將2.5D鏡頭獨立worldZoom實驗**，兩項不得混為一談。維持DPR/CSS viewport scale獨立、攝影機/玩家座標錨定、輸入逆轉換/觸控/HUD安全、Stage1/2及2D不變，初期建議zoom 1.10/1.15僅本機A/B；正式預設數值需實際截圖與用戶驗收才決定。

使用者同時更新Codex策略：Sol並非長期只待命，應實際有效利用5小時額度、希望每週期儘量使用至剩10%以下，但以**不中斷工作優先**，不可在不知真實剩餘時間/用量時虛構數字或為刷額度作無效工作。

- [~] **Codex w5:p8 已正式派工且Herdr確認working**：做P4.2關鍵鏡頭變換架構審查、消除動態屋尺寸方案與world zoom純數學模型/Node測試，僅新增 docs/p42-stable-depth-camera-zoom-contract.md、tests/p42-camera-zoom-math.test.cjs，必要獨立js/p42-camera-model.js；不碰正在由Space Bunny R12 QA測試的production。
- [x] **Space Bunny w5:p4 R12已完成獨立QA**：docs/r12-spacebunny-stage3-density-depth-qa-20261014.md；PASS24/FAIL0/HUMAN_REVIEW3/BLOCKED0，截圖16張。Stage3每chunk屋3→1、Stage1/2維持3、同一局切2D/2.5D世界/碰撞/配送不重抽；C1/C2 Node 15/15PASS；景深是否「夠有感」只給用戶判定。QA已done，production快照限制解除，但Codex P4.2架構契約尚working，Cursor應待該契約再開始改鏡頭，避免Zoom與輸入坐標錯位。
- [ ] **Cursor w5:p9 後續主實作**：待Space Bunny R12交卷/測試固定完成且Codex的P4.2契約結案後，再負責實作穩定大小與世界鏡頭zoom、安全Node及Chrome同位置A/B，絕不只將遊戲DOM CSS放大；正式art/TTS不動。
- AGY本輪已交R12視覺審核，但新遠山/前景圖片額度仍待；未有美術人審不進正式runtime。無commit/push/deploy/reset/clean/checkout。**目前P4.2尚未接入，不能讓使用者誤以為鏡頭1.10x已生效。**


## 2026-10-14 Stage3稀疏化與2.5D景深自測完成、R12獨立QA進行中

本輪Herdr先實查四位Agent皆idle，再派任務並確認Cursor w5:p9、Space Bunny w5:p4與AGY w5:p5均working，Codex w5:p8維持idle節約額度。

- [x] Cursor已交第三關本機程式自測報告 docs/stage3-density-depth-20261014.md。sakura-pass每chunk由3屋減到1屋，9x9抽樣243→81，第一二關與四至八關保持3屋；同一局2D/2.5D切換仍同世界房屋IDs/配送目標。Chrome桌機1280x800與平板模擬1194x834起點2D可見1屋、2.5D約2屋，移動視野最多3屋。未commit/push/deploy。
- [~] 2.5D景深程式自測：Stage3北方遠景建築約縮到88%、柔焦上限約2.6px、飽和度與對比適度降低，墨雲/薄霧/花瓣視差加強；本機 depth=off/enhanced供對照。未經使用者視覺核准與真機FPS，headless1秒7幀不代表實際FPS。
- [~] Space Bunny現正依已有R12 QA契約正式執行真Chrome/Node驗證，結果待 docs/r12-spacebunny-stage3-density-depth-qa-20261014.md 更新；此前0PASS/8BLOCKED只是Cursor工作中時的閘門，不能作為最後判定。
- [~] Cursor下一份為C3言靈圖鑑獨立資料ViewModel與Node測試，不修改現役game/world/renderer/index；C1/C2 runtime上一輪已有 docs/card-collection-runtime-20261014.md，C3尚未接runtime。
- [~] AGY只將新舊真Chrome截圖製成使用者比較圖與景深視覺報告，Gemini image gen依舊429，遠山新圖未產出/未核准/未接。不得拿程序圖冒充美術。
- Codex按需待命、Cursor Fast禁用、音訊TTS凍結、無commit/push/deploy。下一次需要使用者視覺審核同world位置2D/2.5D景深對照和屋密度；Stage3石階島交叉接縫仍FAIL，第一關P0與第二關石木硬切發行門仍未解除。


## 2026-10-14 16:01 Stage3 建築稀疏化與 2.5D 景深體感加強（使用者已授權）

使用者貼出當前第三關2D與2.5D實際遊玩截圖，明確確認「2.5D 幾乎感覺不到景深、房子密集像難民營」，希望山道建築數量砍至**約三分之一**，跑遠一些可接受。最新指示「可以，請下指令給agent們」允許在本機直接修改與測試；新美術候選仍需目視核准。**這是目前最新正式工作方向**，下方較早密集神社或已完成景深之敘述不代表本輪已通過人審。

ChatGPT已實際派工並看到Cursor/Space Bunny/AGY開始運作，Codex Sol依用量策略維持待命：
- [~] **Cursor w5:p9｜主實作**：只在第三關 sakura-pass 減少每chunk神社屋約3→1（原本約三分之一），世界座標/配送單/碰撞不因2D↔2.5D切換重生，校驗主線配送仍有足夠目的屋，其他關屋不改；2.5D近中遠景真正可見，遠景適度較小、低飽和、柔焦及有相機視差；前景角色、技能、選項文字、HUD保持清楚；同seed/相機的2D與2.5D桌機及平板**模擬**Chrome截圖，測FPS/回歸。僅本機改程式，新報告 docs/stage3-density-depth-20261014.md。現有C1/C2已交付不重做。
- [~] **AGY w5:p5｜美術候選/設計**：只在 art/stage3-sakura-pass/candidates/depth-v2/ 產出符合已核准半水墨/浮世繪的遠山林木/近景框景候選（若Gemini圖片額度恢復，極小批）；若429不重試、不用付費替代或程序幾何假圖，改交美術範圍/透視/尺度契約。候選在用戶人審前不得接正式runtime。神社原圖保留、不擅自增屋。
- [~] **Space Bunny Free w5:p4｜獨立QA**：先僅準備 docs/r12-spacebunny-stage3-density-depth-qa-20261014.md、artifacts/validation/spacebunny-r12-stage3-density-depth-20261014/ 內真Chrome對照驗收；等Cursor完成後才跑有版本意義的final測試。相同seed/camera/世界 houses IDs，房屋約1/3、配送與碰撞不破、景深可感與行動視口效能、Stage1/2隔離；實際效果仍留HUMAN_REVIEW。
- **限制**：Stage3石階島H/V交叉轉角仍人工不合格；現有場景地板不偷替換，未核准小妖/Boss不接；第一關P0及第二關石木硬切仍未關閉發行門。音訊/TTS凍結、Fast禁止、無Commit/Push/Deploy或reset/clean/checkout。

本輪需要使用者**下一次**審查的是修改前後同位置、同世界的2D/2.5D對照截圖及任何新遠景美術候選；目前無需為一般密度和參數再次批准。未完成實測前所有任務保持[~]，不能標DONE。


## 2026-10-14 14:41 Cursor 新會話接手與解除登入阻塞

使用者已手動重開 Cursor。Herdr 實查新會話 w5:p9（舊 w5:p6 已不存在），模型 Grok 4.7 High，沒有 Fast；ChatGPT 已真正交辦 C1/C2 本機runtime接線，對方開始讀 docs/card-collection-integration-brief.md 和實際 source，Herdr 狀態 working。新會話曾對安全診斷 herdr agent list 提示一次 shell permission，已允許該次診斷並恢復 working。較早記載 Cursor Authentication error、C1/C2完全阻塞屬舊 w5:p6 歷史，不再表示現在狀態。

已存在 js/card-collection.js、js/card-delivery-bridge.js（Node 16/16），但尚未證實正式 game.js/index.html 完工，也未部署。新 Cursor 先準備獨立 tests/card-delivery-runtime.test.cjs；Space Bunny w5:p4仍在做第一關 night-town P0 Chrome QA，固定版本期間不得擅改 production JS/index 造成快照污染；待 QA done 才接 makeOrder/resolve。C1/C2 仍標實作中，直到正式真遊戲測試PASS。Codex6.1Sol待命；不動美術與音訊/TTS、不commit/push/deploy/reset/clean/checkout。


## 2026-10-14 下一輪再派工：AGY 與 Space Bunny 執行中；Cursor 登入阻塞

使用者要求繼續派工作給閒置 Agent。Herdr 最先實查四位皆 idle。重新派工後實查：AGY w5:p5 **working**、Space Bunny Free w5:p4 **working**、Cursor w5:p6 **done 但失敗**（終端報 Authentication error，並非完成），Codex 6.1 Sol 維持 idle 節省額度。

- [~] **AGY 僅非生圖的美術企劃**：前輪 junction-experiments/README.md 曾回報 Gemini 生圖 429 RESOURCE_EXHAUSTED，故新輪不呼叫圖生API或重試。獨占新增 art/stage3-sakura-pass/scene_variants_design.md（降低同畫面5–6間完全相同神社的重複感）、art/stage4-bamboo-maze/production-contract.md（第四關竹影迷宮用無縫竹泥主地、透明竹道地景decals、3種建築與唯一角色母版的可驗收規格）。未有新正式圖片，**不代表第四關已完成**。
- [~] **Space Bunny Free 第一關地板P0獨立QA**：確認night-town 0/3/10秒冷啟、桌機/平板模擬、2D↔2.5D、跨chunk接縫與快取時序，獨占 docs/r11-spacebunny-stage1-floor-p0-qa-20261014.md 和自己新QA檔，不改 production 或現役音訊，未有實際結果之前P0仍BLOCKED。
- [!] **Cursor C1/C2正式遊戲接線：AUTH_BLOCKED**：前輪 js/card-collection.js + js/card-delivery-bridge.js 16/16 Node PASS，尚未接正式 makeOrder/resolve/store/index。本輪已給Cursor正式接線指令，但終端立即返回 Authentication error（登入驗證），因此尚未執行/不可勾已完成；需使用者在Cursor重新認證或恢復登入後再交辦，不為繞過問題啟用Fast，也不強迫Codex做例行程式接線。此輪接線應以修訂后的 docs/card-collection-integration-brief.md 作準，不能只改 STORE.pick 後備分支。
- [x] **第三關神社場景最新獨立QA前輪已完成**：docs/r10-spacebunny-stage3-scene-qa-20261014.md，主跑30PASS+破圖6PASS+晚載30PASS，0FAIL；但同畫面5–6間神社同圖高度重複、古櫻與答題板關係HUMAN_REVIEW。Stage3自由石階島角落仍BLOCKED；AGY Experiment B透明石階庭園decal候選僅待人審，未接遊戲。
- 本輪禁 commit/push/deploy/reset/clean/checkout；音訊/TTS凍結；無新使用者美術核准。Codex不為消耗額度接例行工作。


## 2026-10-14 最新盤點與第二輪派工：場景QA／地形交叉修復／圖鑑接線橋接

使用者要求核對上一輪Agent完成狀態並把閒置者交辦下一份工作。Herdr實查上一輪四位（Codex、Cursor、AGY、Space Bunny）均idle，**已重新派3份且Herdr agent list確認Cursor、AGY、Space Bunny均working；Codex保留idle節約5小時額度**。

### 上一輪真實結果
- [x] **Cursor Stage3場景建築本機接入**：神樂殿與妖櫻古木已在 assets/img/sakura-pass/ 正式runtime，原圖SHA一致；js/world.js/js/assets.js/js/renderer.js 等已接線，Chrome桌機1280x800/平板模擬1194x834的2D/2.5D均有drawImage及8張場景截圖，第一/二關無新兩圖。證據 docs/stage3-scene-buildings-20261014.md。未經新一輪Space Bunny獨立QA之前只能說Cursor自測PASS，不等於畫面最終核准。
- [!] **AGY Stage3 terrain-v2 2D自由轉角仍FAIL/BLOCKED**：corner-rework交付NW凸/凹兩張V3候選，但真拼排有約80px轉角線條錯位、石板造型不連續；直向與橫向各自可用，不等於2D島狀圖過關。詳 art/stage3-sakura-pass/corner_rework_readme.md；不得提前接任意自由島狀地形。現役三圖水平地板保持不變。

### 新一輪實際派工（進行中、非已完成）
- [~] **OpenCode Space Bunny Free** w5:p4：獨立實Chrome檢查Stage3神樂殿與古櫻接地/遮擋/配送互動/場景隔離，含2D與2.5D、桌機與平板模擬；只新增 docs/r10-spacebunny-stage3-scene-qa-20261014.md、artifacts/validation/spacebunny-r10-stage3-scene-20261014/** 等自己的QA。若FAIL再派Cursor修。
- [~] **AGY Gemini3.8 Flash** w5:p5：只在 art/stage3-sakura-pass/candidates/terrain-v2/junction-experiments/ 試用受控圖片參考/局部image-to-image固定四邊的1-2張真轉角，避免再次~80px錯位；若不成功可用真圖模型生成單一大面積透明石階島decal候選，先看拼接與真圖透明邊，不是程序繪圖；不足圖明確BLOCKED，不覆蓋舊圖、不進runtime。
- [~] **Cursor Grok4.7 High / Composer2.5（Fast禁用）** w5:p6：C1/C2圖鑑純資料橋接（只改獨立 js/card-collection.js、新 js/card-delivery-bridge.js、新 tests/card-delivery-bridge.test.cjs 與現有圖鑑brief）。修正前版錯誤fallback契約：現役makeOrder先study.pick，僅改STORE.pick不會真的落實C2固定動態配送權重；需定可用池權重與chosenWord完整物件、C1成功配送4枚印記/獨立存檔。**這輪不動現役 js/game.js/store.js/index/renderer/world**，保持Space Bunny QA快照，正式遊戲尚未啟用圖鑑。
- Codex 6.1 Sol仍待命。禁Fast、TTS及現役音檔不讀改，無commit/push/deploy/reset/clean/checkout；第一關P0、第二關石木硬邊、第三關2D轉角及美術人審仍BLOCKED。待AGY交可目視候選後請使用者審核。


## 2026-10-14 13:18 Stage3 轉角返工與建築接線

使用者正式指出水平/垂直接縫各自可接受，但神社石階島的交會轉角明顯呈現矩形補丁；最新要求直接轉告Agent並把第三關場景建築放進遊戲。2026-10-14 Herdr實查AGY w5:p5及Cursor w5:p6正在working，Space Bunny待獨立驗證，Codex6.1Sol待命。

- [~] AGY唯一owner art/stage3-sakura-pass/candidates/terrain-v2：補四個方向凸角、四個凹角、必要的交叉junction真手繪候選，提供之前FAIL對照與6x6神社石階島、2D/2.5D拼貼證據，不得用H/V矩形直接疊加或程序繪圖蒙混。新角落等待使用者目視核准才正式接入。
- [~] Cursor獨占production/js與runtime：將原始山道神樂殿 candidate_building_shrine_pavilion.webp 及妖櫻古木/封印石碑 candidate_landmark_corrupted_sakura.webp 原樣SHA核對複製至 assets/img/sakura-pass，僅sakura-pass載入、世界定位、遮擋排序/碰撞與交付UI安全、桌機/平板模擬2D/2.5D Chrome真驗證；夜行町與雨港不變。
- [ ] Space Bunny 等Cursor完成後獨立小範圍檢查建築可見性、渲染和關卡隔離；需要AGY完整角落與使用者目視確認後，才可啟動自由2D自然地形混鋪。現有可玩的三圖地面暫不替換。
- 不能順手接未核准的Stage3小怪/Boss，也不代表整關放行。禁止commit、push、deploy、reset、clean、checkout；TTS音檔永久凍結。


> **本檔是 Living Roadmap，供後續任何 Agent／新對話直接接手。**
>
> 最後更新：**2026-10-15 03:26 人審指令**｜Codex w7:p1總監；AGY w7:p4獨占art整理／mapping／拒稿清理；Grok Build w7:p3隔離技術審查、mapping後程式票；Kiro429保留、不重試，Cursor禁止。Stage2過渡v2 USER_APPROVED，Stage1切鏡 USER_REPORTED_VISUAL_OK；Stage3/4針對性拒稿重設。音訊/TTS/API/BGM/KEY凍結；未Commit／Push／Deploy。
>
> **所有 ChatGPT、Codex、Cursor、OpenCode、其他 Agent：接手先讀這份檔案，並核對原始碼與 Git。每完成一階段、需求更動或碰到問題，直接更新本檔進度與日誌，不用等整案完工，也不用讓使用者重貼對話。**

## 0. 更新規範／Agent 必讀

- **新 Agent 入口規範**：啟動或新對話接手時，**必先閱讀 [AGENTS.md](AGENTS.md)（協作通則）與 [docs/agent-handoff.md](docs/agent-handoff.md)（現場四 Agent 角色分工與最新現況）**，再以本檔對齊當前進度與任務邊界。
- 狀態：`[x]` 已完成且有驗證證據；`[~]` 進行中；`[ ]` 尚未開始；`[!]` 阻礙／待決策。
- **已定案的企劃 ≠ 已實作 ≠ 已測試 ≠ 已發布。** 請明確分別註記，沒驗證不要勾完成。
- 每輪開始：先看本檔的「目前階段／下一步／更新日誌」，再讀相關程式、查看 Git 工作樹；不能只照文件猜測當前線上版。
- 每完成一個階段：更新 checkbox、最後更新日期、當前階段、下一步，並在**更新日誌最上方**加一筆「日期／階段／實際成果與檔案／驗證／commit 或部署狀態」。
- **這份文件可隨時修改**。使用者更改主意、詞庫審核結果不同、技術限制改變構圖，都應註明新決策與理由，不要僵守過期內容。
- 保護未提交工作；未經本輪使用者指示，不擅自 commit、push、部署或覆蓋已有素材。
- 若只完成定位草稿、尚未經使用者確認，標 `[~]` 而不是 `[x]`；圖片生成完成也不代表美術驗收通過。
- **2026-10-13 美術硬性命令**：正式可見物只准手繪 PNG／WebP。程序幾何、色塊 fallback、測試通過數與檔案大小都不是美術合格。上一輪 R4 READY 作廢。細則見 [docs/art-asset-only-standard.md](docs/art-asset-only-standard.md)。
- **2026-10-13 關卡識別永久規則**：每關的地板、場景、建築、裝飾、地標、專用敵人、專屬 Boss 與配樂槽必須能分開。第二關的小怪與 Boss 要實作並驗收後才算完成，方案不算部署許可。配樂槽待使用者交付，同曲暫播不算最終驗收。細則見 [docs/stage-identity-standard.md](docs/stage-identity-standard.md)。
- 新對話只需說：「**請先讀專案的 AGENTS.md 與 docs/agent-handoff.md，依 roadmap.md 接續下一個待辦階段。**」

---

## 1. 第一季產品規格（**已定案的方向**）

**類型**：日文 N5 入門常用詞學習 × 生存戰鬥 × 配送；學生已學過五十音。不是保證通關就學完 JLPT N5。

**主線**：8 關、3 章；每關約 10 分鐘，一次全過的基本主線約 80 分鐘（不含重試）。

**雙進度線完全分離**：
- **爽快主線**：打怪、配送、補油、升級技能、解放奧義、Boss、解鎖劇情；**完全不用收集字卡也能通關**。
- **言靈圖鑑**：給喜愛探索與收集的玩家；收集單字卡及套卡、欣賞特殊插畫、練習發音；**不得影響關卡通關、不能提供戰鬥數值加成**。

**詞庫**：各關以常見且自然的主題字彙為主，不再限制六個詞；約 20–35 詞作為規劃參考，不硬湊也不設固定上限，玩家可反覆重玩而非一次記完。第一季全域收錄 **164 個獨立單字**（前 7 關 27/27/22/22/21/24/21 詞，第 8 關 yomi 為 164 詞全關綜合複習與個人錯題加權池），各關去重、近義詞無多重正解。

### 八關、三章、正式詞庫與場景

原始企劃階段前七關收錄位置曾估算為 **26+31+26+25+26+27+30 = 191**（此為未去重之歷史估算，已由定稿之 164 獨立詞庫取代，詳見 `docs/season-one-content.md`）。

| 章 | 關 | 名稱／程式 ID | 單字主題 | 詞數 | 地景／劇情 | 目前實作 |
|---|---:|---|---|---:|---|---|
| 1 夜行起點 | 1 | 夜行町 `night-town` | 人物、動物、住家、場所 | 27 | 暖色町屋與燈籠、神祕信件 | 已實裝（第 1 章短劇、戰鬥與地圖開放） |
| 1 | 2 | 雨夜港町 `rain-port` | 方位、天氣、交通 | 27 | 雨霧碼頭、迷失航路 | 已實裝（第 1 章短劇、戰鬥與地圖開放） |
| 1 | 3 | 妖櫻山道 `sakura-pass` | 自然、季節、時間、日期 | 22 | 櫻花、神社、破損封印 | 已實裝（第 1 章短劇、戰鬥與地圖開放） |
| 2 百鬼異變 | 4 | 竹影迷宮 `bamboo-maze` | 顏色、形容詞、數量 | 22 | 竹林、迷路妖術 | 已實裝（第 2 章短劇、戰鬥與地圖開放） |
| 2 | 5 | 百鬼京都 `hyakki-kyoto` | 食物、飲料、購物 | 21 | 古都五重塔、妖怪市集 | 已實裝（第 2 章短劇、戰鬥與地圖開放） |
| 2 | 6 | 雪燈山寺 `snow-temple` | 動作、移動、身體部位 | 24 | 雪山、古寺、異變真相 | 已實裝（第 2 章短劇、戰鬥與地圖開放） |
| 3 黃泉之門 | 7 | 幽世渡口 `spirit-ferry` | 感受、狀態、人物與常用表達 | 21 | 靈河、渡船、青色鬼火 | 已實裝（第 3 章短劇、戰鬥與地圖開放） |
| 3 | 8 | 黃泉境 `yomi` | 全關綜合複習及個人錯題 | 164 | 赤月、裂谷、妖城，完成最後配送 | 已實裝（第 3 章短劇、戰鬥與地圖開放） |

**識別狀態（2026-10-13）**：上表「已實裝」只表示詞庫、短劇與地圖入口在程式裡。第 1 關雛形已核准，地板拼接 P0 未過。第 2 關場景待美術驗收；專用小怪與專屬 Boss 尚未實作，【BLOCKED】等使用者核准造型，禁止批量生圖。第 3–8 關識別待設計。`bossTheme: "harbor"` 不是新 Boss sprite。配樂八關皆待使用者交付。

**敘事**：普通配送員因神祕信件／言靈混亂捲入異變，經人間近郊、百鬼領域到黃泉交還言靈。8 關完整接入 `js/story-dialogue.js` 三章短劇（開場、配送浮字、過關文案、Boss 稱號與登場介紹），故事透過輕量短對話、地景與 Boss 演出推動，不阻斷戰鬥操作。詞義重疊的近義詞已全數去重避免多重正解。

---

## 2. 言靈圖鑑規格（**設計定案；尚未實作**）

### 字卡解鎖

- 同一單字**成功配送 4 次**，每次獲得一枚言靈印記；4/4 解鎖正式單字卡。
- 配送已得印記**永久保存、失敗重來不清零**；護符重聽不算配送。
- 圖鑑可顯示未收集剪影、進度、日文／假名／繁中、發音和插畫。完成主題套卡（例如方向／天氣）可解鎖特殊收藏圖卡。
- 卡片解鎖時以輕量短提示顯示，別跳出大視窗打斷戰鬥；完整插畫放結算或圖鑑。
- 收藏卡不等於真正學會；若未來做熟練度應與 4/4 卡片收藏**分開**計算。
- 待 C1 決定：同一日文詞若跨關出現，單字卡唯一 ID 與印記的共用規則、舊存檔遷移。

### 配送任務動態機率（**數學規則已確認**）

僅影響**每關配送單字抽取**；Boss／護符聽音使用自己的規則。

設 N = 本關詞池數，C = 已完成卡數，U = N−C：

1. C=0（全未完成）或 U=0（全完成）：每詞等機率 **100% / N**。
2. C>0 且 U>0：每張已完成卡先保留 **1%** 基礎；每張未完成卡的出現率 `Pu = min(20%, (100% - C×1%) / U)`。
3. 超過未完成單卡 20% 上限的剩餘比例回流到已完成卡：`Pc = (100% - U×Pu) / C`。
4. **每次成功配送後立即重新計算**，影響下一次新產生的配送任務，**不必等開新關卡／新局**；不變更正在進行的任務。
5. 需處理總和 100%、浮點誤差、空詞池與不足五詞的例外，避免 20% 上限不可行。

**25 詞示例：**

| 已滿 C | 未滿 U | 未滿每張 | 已滿每張 |
|---:|---:|---:|---:|
| 0 | 25 | 4% | — |
| 3 | 22 | 約 4.41% | 1% |
| 20 | 5 | 16% | 1% |
| 21 | 4 | 19.75% | 1% |
| 22 | 3 | 20% | 約 1.82% |
| 23 | 2 | 20% | 約 2.61% |
| 24 | 1 | 20% | 約 3.33% |
| 25 | 0 | — | 4% |

**解釋**：「未滿少於四張時才有變動」具體是 25 詞示例中**開始啟動 20% 上限與回流**；平常每新增一張已滿卡，也會立即重算比例。不同詞數的上限門檻由公式決定，不得硬編碼 U<4。

---

## 3. 旅路地圖規格與真實程式狀態

### 已定案視覺規格

- 地圖是**Q 版水墨＋半浮世繪**，採**連續、可捲動的「地景式關卡」**，而不是八個硬畫出的圓平台或精細風景海報。
- **視覺母版：使用者之前提供的第二張設計圖**；留意這張圖未必有保存於專案內，新 Agent 如無法存取需找回原參考，不能只靠文字想像其風格。
- 以町屋、港口、櫻花山路、竹林、古都、雪寺、渡口、赤月妖城辨識八關。房屋略 Q 版誇張，遠景淡墨，色彩分區鮮明，但區域之間自然銜接。
- **純美術底圖禁止烘焙**文字、角色、UI、關卡名稱／編號、節點圓圈、鎖定標記、發光／虛線遊戲路線；這些必須由遊戲程式動態繪製。
- 允許自然的橋、步道、山徑，但必須與真實節點路線對得上；地標／名稱牌／角色的空間應避讓。
- **先確認構圖定位與多個局部視野，再生圖，再接入。** AI 圖片完成 ≠ 美術驗收通過；正式草圖需使用者確認。

### 原始碼現況（2026-10-13 更新）

- `js/overworld.js`：**3000×2200 世界地圖、900×600 基準視野**，共 17 個節點（8 個正式關卡節點＋9 個 waypoint）、16 條連續道路。原五個 ID 保留維持舊存檔。後 6 關節點已解除 `enterable:false` 封印（改為 `true`），由 `stage.implemented` 與 `STORE.isStageUnlocked` 正常守門。
- `js/words.js`：8 關皆已實裝（`implemented: true`），全域收錄 164 個獨立日文單詞（前 7 關 27/27/22/22/21/24/21 詞，第 8 關 yomi 為 164 詞全關綜合複習與錯題池）。全假名詞空漢字契約已確立，39 筆既有錄音重用、125 筆依賴 Web Speech API (TTS Fallback) 降級，詳見 `docs/season-one-content.md`。
- `js/config.js` 與各關 pacing：每關原則 600 秒、最低目標配送六次為基礎架構，Boss 約 180／360／480／540 秒；為奧義與補油實際配送可遠多於六次。全 8 關 10 分鐘自然平衡仍待實機測試。
- 地圖角色約 108px 高、關卡名稱牌約 208px 寬，並有固定底部操作／出發區。各關**900×600 局部視角**已避開互動元素。
- 新純場景背景 `overworld_approved_v2.webp`（4K/Q94）已正式接入，動態路線、名牌、角色與 UI 維持程式分層繪製。

### 八關構圖 V0（**歷史草案，非現役程式坐標**）

探索**約 3000×1600** 世界尺寸之歷史中心座標草案（保留作為企劃演進紀錄；現役程式坐標已由 A1 核准並於 A4/A5 落實為 3000×2200 正式路網，詳見 `docs/overworld-eight-stage-layout-v1.md` 與 `js/overworld-layout.js`）：

| 關卡 | 暫定 (X,Y) | 主景 |
|---|---|---|
| 1 夜行町 | (390,1180) | 暖金江戶町屋、燈籠 |
| 2 雨夜港町 | (730,1330) | 藍灰雨港、船與碼頭 |
| 3 妖櫻山道 | (1070,975) | 粉櫻、神社鳥居 |
| 4 竹影迷宮 | (1380,720) | 青綠竹林 |
| 5 百鬼京都 | (1710,955) | 五重塔、古都市集 |
| 6 雪燈山寺 | (2080,555) | 雪山寺院、石階 |
| 7 幽世渡口 | (2430,1040) | 靈河、渡船、鬼火 |
| 8 黃泉境 | (2770,375) | 赤月、裂谷、妖城 |

主線依 1→8 順序，但可保留不妨礙通關的景點支線。現役八關路線已定案落地於 `js/overworld.js`（17 節點、16 道路），以上座標僅為早期構思，**非當前程式座標**。

---

## 4. 實作路線與進度 Checklist

**目前開發進度：B1–B4 關卡 3–8 內容、164 詞庫、三章劇情、Boss 與 8 關地圖入口已實裝且本機自動驗收通過（OC 獨立全 8 關驗收 88/88 + Node 603/603 通過）；B5 詞池與錯題加權已驗，全 8 關 10min 自然平衡待測；P8 主觀視覺與手感已獲使用者試玩確認放行；P7 真機硬體量測數據（FPS/P95/RAM/溫度）及 TTS 實體發聲仍待補。** 既有 A1–A5 旅路地圖與互動 UI 已本機實作並已有 A5 上線紀錄；A6 實體裝置驗收與 P7 合併。旅路地圖規劃與接入證據保留於 `docs/overworld-eight-stage-layout-v1.md`、`docs/overworld-a5-integrated-report.md`。

### P｜Canvas 2D 偽 2.5D 完工優先關卡（主觀手感 P8 已放行，P7 數據待補）

> **技術決策**：只用方案 B／單一 Canvas 2D；本機選定 `tilt=0.60`、房屋 Y 間距 `1.20`，保留 2D ↔ 2.5D 的 0.8 秒平滑切換、`?tilt=1` 回退；`0.70` 僅供歷史對照。此處僅改戰鬥世界，不動純 2D 旅路地圖；**不得偷偷改傷害、命中、冷卻、怪物、移動、配送／升級平衡，不改 WebGL／雙畫布。**
>
> **開發順序現況**：2026-10-13 使用者另立「第一關地板拼接」為當前 P0，優先於把 R4 寫成可玩。P8 手感放行與 B 階段 88/88 仍是歷史紀錄，不能把程序幾何房子或拼接地板說成美術合格。P7 實體裝置數據仍待補。沒驗證標 `[~]` 或 `[!]`，不得誤標 `[x]`。未經授權不 Commit／Push／Deploy。

- [~] **P0 第一關地板拼接（切鏡使用者回報正常，真機另驗）**：2026-10-15 03:26 使用者親測2D↔2.5D「目前沒什麼問題」，記USER_REPORTED_VISUAL_OK。歷史初載／慢網／首幀與跨裝置FPS未因此全過；E22晚載NOT_REPRODUCED證據保留，不猜根因、不用色塊掩蓋。
- [x] **P0 傾角決策及動態對照基準**：0.60 已作為本機候選；`artifacts/validation/hd25d-motion/` 具 2D／0.70／0.60 的移動 12s、實戰 15s、壓力 12s，**9 支獨立 MP4＋3 支三欄比較 MP4**、`compare.html`／`results.json`／`verification.json`。既有影片驗證 12/12、當時 Node 538/538 通過且受控場景角色世界座標對齊；這不是目前版本的自然戰鬥或行動裝置效能驗收。
- [x] **P1 2.5D 基礎程式與安全回退**：現有 `viewport.js` 投影／`upright`／世界座標轉換、0.60+1.20 世界幾何、0.8 秒傾角過渡及反向切換、相機置中／地面快取／剔除、鳥居櫻樹單路徑、角色建築接地影和六角經驗珠直立已接入；全部仍須以 P6–P8 最新驗證確認。
- [~] **P2 六種技能空間分類及二次壓扁清理（已實作／本機驗證，真機待 P7，主觀視覺 P8 已確認）**：逐一測 `katana`／`barrier`／`needle`／`boom`／`fire`／`thunder`，Lv1–Lv5／MAX、持續領域、投射物、打擊、粒子與傷害數字；逐項盤點 `SQ`／`sy`／`vy`／`ellipse` 和 `FX.drawGround`／`SKILLFX`。地面技能只接受世界投影一次，御札／天雷柱／雷雲／刀氣等直立；動畫過場不變扁、不跳位、不重複疊圖；**不可把所有 `SQ` 一律替換或動命中判定**。靈陣、符咒、天狐雷已接圖，`tools/hd25d-agy-transform.cjs` headless CTM 幾何專項已驗證妖刀 6 角度旋轉對稱無剪切、地面粒子 netY=0.6000 幾何不變性；雷柱 Lv5 硬切接合修正與混技 tide 文字層真圖已確認有效，Lv3 貫穿雷柱實證；S10 固定時間事件影格已實拍通過（336 影格、五階×三 tilt、30 strike 正式雷柱 draw>0 全通過，OC seq126 獨立核對 `artifacts/validation/hd25d-integration/evidence/oc-seq126-final-verification.md`）；接圖與幾何專項不等於全階自然視覺放行，主觀視覺 P8 已獲使用者確認放行，真機硬體表現待 P7。
- [~] **P3 物件接地、遠近遮擋與文字分類（已實作／本機驗證，真機待 P7，主觀視覺 P8 已確認）**：逐型驗證主角、所有妖怪含 Boss／飛空型、町屋、石燈、鳥居、櫻樹、貨物、經驗珠、敵方火彈、妖刀與黑龍的世界腳底 pivot、獨立地面接觸陰影、Y 排序；處理假名／Boss 警告、頭頂名稱與徽章、浮動傷害及地面字，保持字形與相對角色高度，不能遮住選項或 HUD。潮來警示文字 netY=1.0000 經 CTM 驗證；Boss tracking marker draw 與 Boss 本體經 HTTP 記憶體注入受控 setter 獨立非零捕獲，以實測 shake Δ 比對確認兩者同幀使用相同 frameShakeOffset（相對漂移 ≤ 1e-5，Y 軸震動隨 k 縮放，幾何一致性成立但不可逕寫 PASS；螢幕邊界夾取、UI 遮擋與實戰動態待覆核）；靜態排序已確認但接地動態待驗證；主觀視覺 P8 已獲使用者確認放行，真機硬體表現待 P7。
- [~] **P4 夜戰、照明與景深整合（已實作／本機驗證，真機待 P7，主觀視覺 P8 已確認）**：校對主角／石燈光心、暖光池與 0.60 地面橢圓、油量與 `lampout`，夜霧、場景遠景柔焦、雷擊冷光與其他發光技能、黑龍和 Boss 題板的前後順序；鏡頭震動位置與世界使用同幀偏移。不要整屏閃白，保持假名與 HUD 清晰；主觀視覺 P8 已獲使用者確認放行，真機硬體表現待 P7。
- [~] **P5 正式素材透明度、視覺與載入容量（已實作／本機驗證，真機待 P7，主觀視覺 P8 已確認）**：已接入 9 張正式 WebP 素材（靈陣 2、符咒 3、天雷 4），容量合計 6,808,928 bytes，解碼 RGBA 記憶體估算約 32.34 MiB（明確標註為 RGBA 像素緩衝區估算，非 mobile GPU 實際佔用）；歷史條文曾要求缺圖程序回退；2026-10-13 起正式可見美術禁止色塊 fallback，以 `docs/art-asset-only-standard.md` 為準。其餘歷史要求仍在：各品質檔、lazyload 不拖首屏載入、下載頻寬與行動端 decode／GPU 記憶體尖峰、alpha 白邊／棋盤雜點（checkerboard noise）／雷柱雲接合平滑性等，均列為待真圖與真機覆核項目；主觀視覺 P8 已獲使用者確認放行，真機硬體表現待 P7。
- [~] **P6 Chrome 與 Node 完整回歸（以下為歷史PASS；現役P4.2回歸有2FAIL待修）**：Node 582/582 exit 0 全數通過；完整驗收 combined full（seq117: S1/S2/S4–S7/S9/S11 通過，僅 S8 基數誤植）+ 受影響階段獨立補測（seq126: S3/S8/S10 exit 0，800/800 檢查通過，主工具 `df4ae9...`）覆蓋 S1–S11；336 事件關鍵影格覆蓋三實測傾角（1.0, 0.6, 0.8 各 112 張）、五階齊備、30 strike draw>0、6 storm-child cloud==1；S8 刀氣 18 筆（3k×6angles）全部通過且 netY 偏差 ≤ 1.56e-8、ground netY=0.6000、tide 文字 netY=1.0000、Boss marker 三 k count 4 漂移 ≤ 1e-5；root 親看 latest Lv3 雷柱 .8、Lv2 barrier .6、Lv4 boom .8、混技手機 tide 字及 partial fallback 均已有真圖（721 張 PNG，`artifacts/validation/hd25d-integration/p6-canvas/png/`）；驗收期間 production 四檔（fx.js／game.js／renderer.js／skillfx.js）雜湊自 seq117 起未變（seq117–seq126 跑次 JS_STABLE；≠宣稱整輪渲染未改，P2–P5 已於本整合輪落地），本機 8788 HTTP 200 served SHA 全等 disk SHA；明列非 P7 實機（headless 尺寸不代表實機效能／觸控）。正式 combined 證據見 `artifacts/validation/hd25d-integration/evidence/oc-seq126-final-verification.md`。
- [ ] **P7 自然遊玩、手機與平板實機壓力／手感（未驗，數據待補）**：桌機 1280×800 與實體手機、平板橫向各試自然 10–20 分鐘，含百鬼夜行、Boss、技能堆疊、配送、油量／提燈熄滅；記錄 FPS、P95 幀時間、地圖重烘焙尖峰、錯誤、圖片下載量、RAM、溫度。桌機 FPS 不劣於基準 2、行動端約 30 FPS 為驗收**目標而非既有結果**。試跑 1.20 房屋間距對送貨路程、Y 移動視覺速度、生成與預警、觸控的影響；若要改玩法需另外說明。A6 真機驗收可合併，但不重做旅路地圖。
- [~] **P8 2.5D 整合收尾／使用者驗收關卡（歷史手感放行；最新景物縮放及地板範圍重新待審）**：使用者已實測目前試玩沒問題，P8 視覺手感正式放行；授權開啟 B 階段實作。P7 實機數據缺漏不捏造，後續待補。

**後續依序**：`P0 第一關地板拼接 [!]（連續畫面守門）` → `P1 正式畫面真圖守門（見標準檔第 7 節；舊的 P1 2.5D 程式項仍是歷史 [x]，不能冒充這一門）` → `R4 手繪重製（拒收，禁止 READY）` → `R1–R3、R5–R6 其餘待驗` → `P7 與 B5` → `C` → `D`。P8 手感放行與 B1–B4 自動驗收保留為歷史紀錄。

### A｜旅路地圖（主功能完成；A6 實機驗收併入 P7）
- [x] **A0 企劃方向定案**：八關、三章、Q 版水墨、地景式、互動與背景分層。僅規格確認，非美術完成。
- [x] **A1 八關定位構圖（使用者 2026-10-12 核准空間定位）**：提出 3000×1600 V1，配置八關＋九個道路 waypoint（保留四個舊 ID）、區域形狀、16 段主線道路、低干擾留白；交付 docs/overworld-eight-stage-layout-v1.html + .md。已驗證 HTML 內嵌 JS 語法與 8 關／17 節點資料。**空間定位已獲使用者核准**，跨裝置與正式美術仍需 A2/A3 驗證。
- [x] **A2 跨比例構圖與 HUD 幾何驗證（已完成）**：用真實 viewport.js 公式及 js/overworld.js HUD 幾何檢查 8 關×8 螢幕比例＝64 組；原 3000×1600＋固定 HUD 在直式有高度不足／重疊；3000×2200 地景可見範圍＋底部 HUD 對 bounds.bottom/right 定位方案 64/64 組通過幾何檢查。已產出可切換預覽、Node 可重跑驗證、Chrome headless 截圖與說明，見 docs/overworld-a2-validation-notes.md。**此項不等於真機或真正八關遊戲驗收；正式實作／真機檢查仍在 A5/A6。**
- [x] **A3 Q 版水墨純場景美術草稿（使用者已選定）**：使用者比較兩張生成稿後選定第二張 `霧嵐之境_櫻花雪域幻境地圖.png` 為純地景主背景，並核准之後的八關 UI 疊圖配置。`櫻花妖境八關地圖.png` 僅作 UI 疊圖參考，**不可直接當背景**。選定原圖已由使用者放進 Windows 專案 `artifacts/references/霧嵐之境_櫻花雪域幻境地圖.png`，並已製作 WebP。
- [x] **A4 正式背景接圖與直向延伸（本機驗證完成）**：使用者已將純場景 `artifacts/references/霧嵐之境_櫻花雪域幻境地圖.png` 放進專案，檔案 1672×941、3,867,162 bytes；執行 `python tools/prepare-approved-overworld.py` 生成 `assets/img/overworld_approved_v2.webp`，539,354 bytes（縮小 86.1%）及來源雜湊清單。`js/assets.js` 優先載入新圖、只在失敗時下載舊版 `overworld_ukiyoe_v3`；`js/overworld.js` 已優先繪製新圖，程式繪製的道路／角色／木牌／按鈕維持分層；更新 `index.html` 資產版本與 `service-worker.js` 圖片版本。**已更新至 527/527 全套測試通過；Chrome headless 本地 smoke 載入新圖成功，截圖 `artifacts/validation/overworld-a4-approved-night-town.png`**。**目前採 3000×2200 的世界座標，主圖按原生比例繪製約 3000×1688，南側以同一張圖的末段鏡像＋漸層霧景補足直式視野，不額外下載圖片；八個關卡沿核准的 A1 座標配置。已另以 Chrome 實際執行 `index.html` 的 390×844 手機直向主選單→旅路，確認橫向遮罩在選關時隱藏、WebP 真正載入；手機下載與幀率仍須 A6 真機量測。**
- [x] **A5 八關地圖與互動 UI 本機實裝**：17 個節點（8 正式關＋9 過渡點）、16 段連續道路，保留既有五關與四舊 waypoint 的 ID；新增三關詞庫佔位（implemented:false）；舊 STORE key 保留並依新 8 關順序解鎖。Canvas 動態繪製八關木牌、可遊玩／已通關朱印／封印、角色位移、選關資訊及出發／前往／返回按鈕。左右箭頭可鏡頭瀏覽尚未完成的關卡，但**不能越級旅行或進入 3–8 關**。已修正直向鏡頭及 HUD 跟隨可視底邊，並提高深色木牌文字對比。八關與手機／平板模擬截圖位於 `artifacts/validation/eight-stage-a5/`，`tests/overworld-eight-stage.test.cjs` 及全套 527/527 測試通過；真實 game.js 手機直向觸控測試亦通過。**是本機完整互動地圖，不是 3–8 關已可玩。**
- [x] **A5.1 旅路地圖可視化編輯器（2026-10-12 完成本機實作）**：新增 `開啟旅路地圖編輯器.cmd`，以 `node tools/map-editor-server.cjs --open` 啟動只綁定 127.0.0.1 的 `editor/overworld.html`。關卡路線點／地標圖示／名稱木牌三組座標與圖示比例、木牌寬度、背景縮放和平移皆可拖曳；提供 9 個路口、鏡頭安全框、滑輪檢視縮放、復原／重做、瀏覽器暫存、JSON 備份／匯入。點『套用至本機遊戲』後伺服器驗證座標及 17 IDs，直接更新 `js/overworld-layout.js`，正式 `index.html` 已載入該表且 `js/overworld.js` 直接讀取。**530/530 全套測試通過，Chrome 真實編輯器拖曳道路／地標、縮放背景、POST 儲存、Node 遊戲設定讀回通過**（`tools/map-editor-smoke.cjs`，測後還原原始設定；截圖 `artifacts/validation/map-editor-visual-smoke.png`）。操作見 `docs/overworld-editor-usage.md`。暫不 commit／deploy，用戶自行對位後再驗收。
- [x] **A5.3 旅路資訊板、木牌與按鈕文字視覺統一（2026-10-12）**：僅調整 `js/overworld.js` 與 `js/ui.js`（`drawButton` 新增僅旅路使用的 `mapTypography` opt-in），不改座標表及 4K 背景。淺和紙的中央資訊板以柔和放射米色提亮，不畫現代卡片邊框；主標題、關卡木牌用 `Kaisei Decol`／明朝後備＋深墨 `#39261d`、1.5px 淺米描邊，分數與操作說明用 `Noto Sans JP`／微軟正黑體＋深棕 `#53382a`、同描邊。紅色「出發」等按鈕使用暖白 `#fff0d7`＋深褐描邊；首頁與左右選關按鈕以深墨色書卷字融入和風底牌。按鈕原尺寸、命中區域、遊戲流程均不動。`index.html` 已更新 JS 版本，Chrome 真正 index.html 電腦及手機 Canvas 截圖分別在 `artifacts/validation/eight-stage-a5/map-typography-stage-board.png` 和 `map-typography-phone.png`；新增 `tests/overworld-typography.test.cjs` 二項樣式／封印斷言，重建媒體快取後 **532/532 全測試通過（循序）**，未部署。
- [x] **A5.5 旅路角色往返方向修復（2026-10-12）**：`js/overworld.js` 的原兩張走路素材是交替腳步姿勢，不是朝左／右兩個方向。現於 `createState` 記錄 `facing`，在 `moveTo` 的直接相鄰節點及多段路徑第一段、後續自動換段時都依目標 x 判斷朝向（左右，純垂直保留原方向），`drawMiniPlayer` 僅對左向進行 `ctx.scale(-1,1)` 水平鏡射；站定後保留最後朝向。**地圖座標、背景、UI、碰撞與角色站位皆不變**。新增 `tests/overworld-facing.test.cjs` 3 項測試（來回走、多段路徑、鏡頭瀏覽不瞬移），**537/537 全套循序測試通過**，真實 Chrome `index.html` 手機直向載入地圖通過。`index.html` 更新 `overworld.js` 快取版本；未提交／未部署。此階段標誌 **A5 旅路地圖介面本機開發完成**，不代表八關戰鬥內容或 A6 實機驗收已完成。
- [~] **A6 裝置驗收與上線（模擬及自動測試完成，真機／部署待辦）**：Chrome headless 測試八關 900×600，另有手機橫向 844×390、直向 390×844／360×800、平板 1194×834 的渲染截圖；全套 `npm test` 為 **527/527 通過**，新純背景約 527 KiB 且只下載一次，舊版僅載入失敗才備援。尚未拿使用者實體手機／平板測試觸控、效能及瀏覽器快取；**本輪無 commit、無 deploy**。

### B｜日文詞庫與故事（**B1–B4 本機自動驗收通過；B5 平衡待測**）
- [x] **B1 八關正式詞庫表（已實裝／本機自動驗收通過）**：全 8 關 164 詞（前 7 關 27/27/22/22/21/24/21，第 8 關 yomi 164 詞混合池），已逐詞列於 `docs/season-one-content.md`，符合 metadata 契約（自然假名詞 kanji 允許為空字串 `""`，排除中文字翻譯；各關去重、近義詞無多重正解；corpus 驗證 exit 0 通過）。
- [x] **B2 已有音檔／素材盤點（已實裝／本機自動驗收通過）**：39 筆既有實體錄音（`assets/audio/words/*.mp3`）100% 重用；125 筆缺新詞依賴瀏覽器 Web Speech API (TTS Fallback) 降級，已於 `docs/season-one-content.md` 明列；TTS 實體發聲效果待 P7 真機確認。
- [x] **B3 三章劇情與 Boss（已實裝／本機自動驗收通過）**：`js/story-dialogue.js` 提供三章進展（1–3 章 1、4–6 章 2、7–8 章 3），8 關 opening、delivery 浮字、clear 文案、BossTitle 與 BossIntro，無阻斷式彈窗，已由 `js/game.js` 與 `js/ui.js` 完整接入；OC 88/88 驗收全部無例外通過。
- [~] **B4 關卡 3–8 實裝（基本工程已驗；Stage3–8完整美術/专怪仍WAITING_ART／WAITING_HUMAN）**：8 關敵人配置、世界生成、各關 pacing 基礎數值、雷柱／落雷／雪景粒子（snow-temple）、Boss 出現與 radar 追蹤接入；`js/overworld.js` 後 6 關 node 解除 `enterable:false` 封印（改為 `true`），保持 17 節點 16 道路坐標與旅路介面，由 `stage.implemented` 與 `STORE.isStageUnlocked` 正常守門；OC 88/88 驗收通過（含 8 真 won、16 反向 play、8 STORE reload 一致、11 地圖入口及截圖無例外；Node 603/603 回歸通過）。
- [~] **B5 教學平衡與錯題複習（詞池與錯題優先已測，全 8 關 10min 自然平衡待測）**：第 8 關 yomi 整合前 7 關所有 21 個 pack 去重之 164 詞，支援 `STORE.createStudySession` 個人錯題加權；詞池與錯題加權優先機制已驗證，全 8 關約 10 分鐘自然平衡仍待實機測試調優。

### R｜試玩回饋與內容補完（ChatGPT 經 Herdr 派工；進行中／待驗，不可勾完成）

> **階段說明**：需求落盤之後，實作已由 **ChatGPT 透過 Herdr 派工**，不再寫成「等待使用者重啟後由 Codex 再指派」。下面狀態只採用前一輪已寫進 `docs/r6-test-report.md` 與 `docs/r1-media-inventory.md` 的查證，不把本輪其他 Agent 可能正在做的新成果預先勾完。既有 603/603 與 88/88 仍只是前版基線。C/D 維持未啟動。標記：`[~]` 進行中或待驗，`[ ]` 尚無實作可驗，都不是 `[x]`。

- [~] **R1 新單字正式語音包與單字圖補齊（待驗，不預勾）**：前一輪已產出 125 筆新音檔與 11 個長音別名（盤點見 `docs/r1-media-inventory.md`：39 既有＋125 新＋11 別名＝磁碟 175）。當時 `WORD_FILES` 仍只接 39 筆，136 個錄音未接線，158/164 缺圖；R6 因此有兩項 FAIL。其他 Agent 可能正在接線或補圖，這裡不改成完成。原需求仍在：盤點 164 詞與 39 既有實體錄音／125 TTS 備援之缺口（現有 B2 完成的是盤點與 TTS fallback，非新詞正式資源齊全）。分工由 AGY Gemini 主責語音與圖片生成整理，若失敗由 Cursor Grok-4.7 替補，最後由 Codex 候補。語音需先識別現有 39 筆之聲音來源、voice、語言、速度與聽感風格，優先尋找同系列並校驗日語讀音、音量平衡與前後靜音；若來源未知不承諾完全同 voice。逐詞建立音圖映射清單（抽象詞如方位、感受、日常表達採情境示意圖），生成正式資源與 fallback 回歸，確保既有資產與學習語意契約完整。
- [ ] **R2 平板音樂解鎖（Autoplay / User Gesture；真機未測，不預勾）**：前一輪 R6 標記 `NOT_TESTED_ON_DEVICE`。本輪沒有新的實機證據，也不把其他 Agent 尚未回報的改動寫成完成。平板與行動端瀏覽器通常需首次使用者手勢（user gesture，如點擊開始、選關等）才能解鎖音訊播放。目標為同次手勢啟動 BGM，不要求進入戰鬥後再額外點擊一次。核對載入中點擊、自背景切回、螢幕旋轉、首次啟動與重載等邊界。gamepad 輪詢按鍵在部分行動瀏覽器不保證能觸發 user activation。現有 `js/game.js` 的 `pointerdown` 已有 `AUDIO.init`、`js/audio.js` 已有 `AudioContext.resume`；記錄待真機核對，不承諾所有平板行為完全相同。（技術參考依據：[MDN Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)）
- [~] **R3 Xbox 藍牙手把平板震動（Gamepad Haptic Feedback；程式相容調整進行中，真機未測）**：本輪只改 `js/haptics.js`（dual-rumble 與 pulse fallback、Promise 拒絕、關開關與失焦／斷線停止、無 API 時降級）。沙箱契約 13/13、`node --check` exit 0、既有 controls 7/7；**沒有 iPad 或實體手把實測**，不得寫成通過。暫停清理與 `index.html` 快取 query 仍要 Cursor，見 `docs/r3-gamepad-validation.md`。前一輪 R6 仍是 `NOT_TESTED_ON_DEVICE`。原說明：既有實作已有 `vibrationActuator.playEffect('dual-rumble')` 與 pulse fallback，`index.html` 已載入且設定選單有震動開關、`js/game.js` 事件亦有呼叫；此為既有實作之相容性驗證與調整，非從零新功能。需詳細記錄平板 OS（iPadOS / Android）、瀏覽器（Safari / Chrome）、手把型號（Xbox Wireless Controller 藍牙）與連線方式。驗證重點：檢查真實 actuator、實體雙馬達（dual-rumble）、震動開關與斷線重連、暫停／切背景時的回饋清理；不支援時平穩降級。嚴格守門：不能拿 `navigator.vibrate`（機身震動）當手把成功；手把能操作不代表手把震動正常，未經實機測試前不得聲稱 iPad/Safari 或 Android/Chrome 已實測通過。（技術參考依據：[MDN GamepadHapticActuator playEffect API](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/playEffect)）
- [~] **R4 第二關 rain-port（石木過渡v2已核准／接線驗收中）**：2026-10-15 03:26 使用者核准新石板→木棧道v2對照視覺，記USER_APPROVED，此素材不再WAITING_HUMAN。四張rework角色已有核准及工程接線證據。AGY先做canonical路徑mapping與安全移轉，Grok審真布局需要的方向／邊與接線方案，再獨占runtime接入及新連續畫面驗收；不盲目重製多方向、不接未核准其他候選。2026-10-13拒收程序幾何版與整關／真機／部署門仍保留，單一過渡核准不代表整關放行。
- [~] **R5 符咒 boom／陰陽符改版（已有實作與 15/15 校準，平衡候選未定，不預勾）**：前一輪可觀察契約 R5-a–k 通過，校準正控制 15/15；`BOOM_FUSE = 1.5` 與 2 秒候選、半徑、震退、全傷係數都還沒試玩定案。15/15 不是平衡放行。獨立發射音效與爆炸音效。由原往返路徑改為單向射出後命中黏在敵人身上，隨目標移動，延遲 1.5 秒或 2 秒爆炸（兩方案待試玩平衡定案）。傷害機制：被貼目標承受符咒全額傷害；周邊小怪承受 20% 濺射傷害並震退；嚴格避免全傷目標重複計入濺射傷害，避免單符重複爆炸。邊界需於實作契約定案：目標死亡／離場時處理、Boss 護盾與震退抗性、多符黏貼疊爆順序、暫停與結算清理。數值平衡：升級數量、範圍、威力（Lv1–Lv5 / MAX）需兼顧實用性，不強到站樁無敵亦不弱到無選取價值，參數不得擅自寫成已定案。落實傷害、震退、音效（audio）、手感震動（haptics）事件驗證與跨技能回歸。
- [~] **R6 獨立驗收（OpenCode 守門；已校準，R1 仍有兩項 FAIL，不預勾）**：探針校準完成（正控制 15/15、7 種故障注入、負控制一致）。R1 音檔接線與單字圖兩項 FAIL；R2/R3 真機未測；前一輪 R4 無可驗收對象。R4 專項 19/19 與舊回歸 603/603 若曾通過，也只算程式契約。使用者已拒收 R4 程序幾何美術，禁止把這兩個數字寫成美術合格或 READY。R4 驗收改看連續截圖與四款真圖。校準通過不等於 R 階段驗收收斂。OpenCode 先確認實際測試目標；驗收腳本必須先在已知正確版本（known-good）上校準，再測試新需求，嚴禁盲信作者自稱 PASS。R1 逐詞檢查真正檔案載入、發聲與音圖語意；R4 截圖確認自然隨機雨景、碼頭地景與跨關保護；R5 驗證延遲時間、命中黏貼、周邊 20% AoE、震退、單次爆炸無重疊與多目標邊界；R2/R3 真機平板與 Xbox 手把在未獲實機前標記未測；結合 P7 真機硬體數據與 B5 全 8 關 10min 自然平衡調優。

### C｜言靈圖鑑（不影響主線；2026-10-14 執行稽核更新）
- [x] **C1 卡片 ID 與存檔設計**：現役NFC最大印記、跨關共享、普通/dev隔離已修；quota/security不throw、persisted:false、storage identity pending隔離及真module reload。E22 Codex重跑相關48/48及音訊排除安全719/719，證據見director-e22-20261014；本列資料存檔完成不代表新藝術核准。
- [x] **C2 動態出現率**：2.2節公式與正式makeOrder/delivery bridge已接；31項及獨立15項通過。C5仍須UI後持久化/機率整合驗收，不是全部圖鑑完成。
- [~] **C3 圖鑑 UI（待人審／真機）**：已真正載入入口/紙札/印記/篩選/分頁。R17實際30PASS/3HUMAN含privacy、pause、replay禁用；E22-05頁級contrast已修且獨立15PASS，10/15對最後快照9檔SHA全一致。新插畫與視覺人審仍OPEN。詞性/例句暫不顯示，音訊凍結不呼叫重聽/TTS，不拿技術PASS冒美術PASS。
- [~] **C4 套卡收藏獎勵（工程已驗／藝術待審）**：真32pack、單次trigger、awards持久化、HUD/圖鑑純文字已接；E22 core24與contrast15可依9/9相同SHA復用。E15 R16 strict23 PASS、正負控制3 PASS、最新安全731 PASS；新插畫WAITING_HUMAN，真機未驗，不假勾整體DONE。
- [x] **C5 公式／存檔測試（工程範圍）**：E15-02新資料面10 PASS、root現役storageCases3 PASS，最終安全731含真makeOrder／resolve／跨關／NFC／dev隔離／既有長測皆通過；E22真UI有效證據以9/9SHA一致復用。C3/C4藝術、正常遊玩與實體裝置另列，這不是全季或發佈放行。

### D｜第一季發行
- [ ] **D1 完整測試**：8 關、Boss、技能、油量、單字卡、舊存檔、各平台效能。
- [ ] **D2 玩家試玩調整**：爽快派與收集派都能獨立獲得好體驗。
- [ ] **D3 第一季部署**：條件授權，現況 BLOCKED。第一關地板拼接修好且 2D／2.5D 冷啟動跨設備驗證、第二關整組手繪美術經使用者視覺核准並接入且移除幾何假美術、第二關手繪小怪與專屬 Boss 已接入並通過自動與視覺驗收、QA 程式回歸與畫面審核 PASS，四項都完成後才允許 commit、push、deploy。方案與 `bossTheme` 不算。配樂未交付時紀錄要寫待交付，同曲暫播不算配樂驗收，不准替換現役曲。測試全綠不准提前。未過門上報 BLOCKED，由 ChatGPT 協調發佈。通過時記錄 commit SHA、版本與實機驗證。

---

## 2026-10-14 並行派工進度（Stage 3 美術／C1–C2 核心／既有 QA）

以下是 ChatGPT 透過 Herdr 已送出指令且確認 Agent 進入 working 的本輪任務，不代表交付完成；以新成果實際落盤和獨立驗證為準。**目前沒有新的使用者美術核准，也沒有 commit/push/deploy。**

- [~] **AGY（Gemini 3.8 Flash）Stage 3 美術候選**：專屬新目錄 art/stage3-sakura-pass/candidates/，先製作兩種地面材質與 2×2/4×4 拼接預覽、1 張神社山門建築、1 張地標裝飾、1 張小妖與 1 張 Boss 的 idle 形象母版（約六張）；先對齊第一關半水墨／半浮世繪真圖品質，Stage 3 全套仍須人工審核。避免上一輪 Stage 2 攻擊與待機不同角色：敵人母版未核准前不生 attack。若可用額度足夠，追加 Stage 4 竹影迷宮風格 brief；新圖片全為候選、不修改 runtime。遇到模型 429/配額限制即回報準確失敗並停止；由 ChatGPT 評估是否委託 Codex 檢查合法生圖替代，Codex 不是直接用程式畫圖。
- [~] **Cursor（Grok 4.7 High；Fast 禁用）言靈圖鑑 C1/C2 純資料原型**：只新增 js/card-collection.js、tests/card-collection-c1c2.test.cjs、docs/card-collection-integration-brief.md，完成成功配送四枚印記、存檔契約、去重、跨關唯一 ID、機率數學與獨立測試。**尚未接入 js/store.js/js/game.js 或正式 UI，不能勾選 C1/C2 完成**；避免在 Space Bunny QA 讀取現行生產程式期間改動正式檔。
- [~] **OpenCode Space Bunny Free 獨立 QA 持續進行**：第一／二關真 Chrome、Boss、初載拼接、2D–2.5D 和圖片版本回歸；獨占新增 QA 日誌／測試，正式結案前不宣稱 PASS。既有局部安全回歸 609/609 PASS 只作局部發現，不等於全數美術核准。
- [ ] **Codex 6.1 Sol 按需備援**：目前不派例行工作。僅跨模組重大整合／契約爭議／最終放行，或 AGY 圖生確實被阻塞且查明 Codex 有可用、獲授權的真實圖片生成路徑時才介入；不消耗額度做冗餘評估。
- **未變更**：第一關地板冷啟與切鏡 P0、第二關石木交界仍 BLOCKED，第三到八關目前缺獨立手繪的全套場景／妖怪／Boss，言靈圖鑑 UI/C3–C5 與全季 D1–D3 仍待完成。原音檔與 TTS 停用凍結。Grok Build 已由使用者關閉，毋須自動重啟。

## 2026-10-14 第三關地板自然分區與變體減重複（使用者最新批准）
**最新交付更新（同日）**：AGY 已產出 art/stage3-sakura-pass/candidates/terrain-v2/ 六款 PNG/WebP 候選（土路/石階各1款變體、反向水平、雙向垂直、外凸 NW 轉角）與4x4拼排/Before-After預覽，見 terrain_v2_manifest.json/README.md；全部待使用者目視核准。AGY 指出自由2D分區仍欠凹角及鞍形圖，禁止任意噪聲硬混貼。Cursor 已交付 js/sakura-terrain-plan.js、tests/sakura-terrain-plan.test.cjs、docs/stage3-terrain-v2-integration-contract.md，Node 3/3 PASS；128x128樣本土55.6%、石30.1%、過渡14.3%，但尚未接入正式runtime，原三張地板仍可玩。待審圖後再補角落、正式接線與獨立ChromeQA。無commit/push/deploy。



使用者在本機第三關試玩後確認：土石→櫻石**目前接縫看不太出來，品質可保留**，但石板、青苔、花瓣每512世界像素反覆出現，並質疑一直往東會永遠只剩石階。ChatGPT已說明正式程式目前固定 tx<3→土、tx=3→H水平過渡、tx>=4→石，並提出「山道60%、石階25%、天然過渡15%，新地板變體各2–3張、固定世界座標的大區域自然分佈」，使用者回覆「可以」授權下一輪。

- [~] **AGY（Gemini3.8 Flash，w5:p5）出 Terrain-v2 真圖候選**：新目錄 art/stage3-sakura-pass/candidates/terrain-v2/，優先手繪2張土路變體、2張石階變體，必須保留原已核准三圖不覆蓋；補真正上下V過渡、逆方向及角落/凹凸轉接圖（不可再拿旋轉後邊緣差35的V預覽冒充完成）。以4x4新舊交錯及2D/2.5D截圖、四向接邊契約驗證。圖片未經使用者確認不得進runtime。若429則如實BLOCKED並停止重試，不要使用程式幾何假圖。
- [~] **Cursor（Grok 4.7 High/Composer 2.5，Fast禁用，w5:p6）開發 deterministic 地區分布候選**：獨占新 js/sakura-terrain-plan.js、tests/sakura-terrain-plan.test.cjs、docs/stage3-terrain-v2-integration-contract.md。依世界X/Y與512px錨點形成會反覆出現的土石/石階自然區域；以低頻連續群集與四鄰角落mask分類，缺過渡素材不能硬切，含遠處負世界座標、地形比例與防重複回歸。**原遊戲renderer/assets/game/index皆不改**，必須等AGY真圖與使用者核准後才正式接線。
- [ ] **Runtime 接線／Chrome獨立QA**：AGY新增圖通過人審、全部必要邊與角素材兼容後，再交Cursor在第三關接入，Space Bunny限量覆核R9報告中的石階格線、X行進可見重新出土路、2D/2.5D、camera/chunk、自動測試與缺圖fallback。現在不宣稱已修復畫面重複率。
- Codex 6.1 Sol按需待命，不作例行計畫。第一關P0、第二關石木硬切仍BLOCKED。原有第三關水平過渡正式素材保留，沒有commit/push/deploy，沒有動音訊TTS。

## 2026-10-14 本機開發者選關模式完成（不影響正式存檔）

- [x] 僅本機 http://127.0.0.1:8788/?dev=1 顯示八關選單；?dev=1&stage=sakura-pass 預選第三關後按「直接進關」。免解鎖、可切第八關；正式站加參數不啟用。
- [x] 正式紀錄隔離：dev模式只讀寫 yokai-delivery-dev-v1，普通遊玩沿用 yokai-delivery-v1。Chrome真頁驗證正式鍵不變、第三關及第八關進入成功、非法Stage拒絕。此功能不解決換埠與不同hostname的跨origin瀏覽器存檔隔離。
- [x] 測試：獨立+progression+overworld Node 31/31 PASS；Chrome驗八關載入/跳關/正式存檔隔離/普通URL無浮窗/非法ID拒絕。見 docs/dev-stage-selector-20261014.md 與 artifacts/validation/codex-lead-20261014-cursor/dev-stage-chrome.json。仍不是地板美術放行。無commit/push/deploy，音訊TTS凍結。

## 2026-10-14 第三關水平地板正式接線實績（Cursor完成／Space Bunny獨立QA中）

- [x] **僅第三關 sakura-pass 土路→水平過渡→石階正式接入本機遊戲**：使用者已准許接線；Cursor 已完成三張素材原樣複製到 assets/img/sakura-pass/（SHA-256一致）；更新 js/assets.js lazyload、js/renderer.js 世界X絕對512px貼圖（tx<3泥路、tx=3水平過渡、tx>=4石階）、js/game.js 進關刷新、index.html JS版本、service-worker.js 三圖版本。報告 docs/stage3-ground-integrated-20261014.md。相關新契約及Renderer/Stage2測試 **53/53 PASS**（Cursor自測）；Chrome desktop1280×800與iPad **模擬**1194×834，各2D/2.5D初載與走過接縫截圖在 artifacts/validation/codex-lead-20261014-cursor/stage3-ground/。非真機驗證，不等於整關完成。
- [~] **Space Bunny 第三關地板窄範圍獨立QA**：Herdr已真派Space Bunny Free w5:p4 working；目標獨立驗證載入/切鏡/camera/tilt/跨關隔離、材質視覺人審；未交最終結果前不可預寫PASS。
- [!] **仍需美術修正**：AGY垂直T_V是旋轉預覽，edge差約35，未複製正式runtime；石階單材質自身512格線在Chrome仍可能可見（Cursor已回報，需人審／修素材），第一關P0、第二關石木硬切仍BLOCKED。第三關神社、古木、小怪、Boss亦尚未有本輪核准接線權限。無commit/push/deploy，音訊/TTS凍結。

## 2026-10-14 12:00 第三關地板過渡正式接線派工

使用者明確說「好 這次可以接了」，同意將第三關妖櫻山道的土石路→櫻瓣石階過渡素材接入本機遊戲。ChatGPT 已透過 Herdr 將 Cursor w5:p6 實際派工（working），AGY w5:p5 完成過渡圖交付文件中（working），Codex 待命不用。
- [~] **Stage3 水平地板過渡接線（本輪僅此範圍）**：山泥 dirt.webp、石階 steps.webp、transitions/candidate_trans_dirt_to_steps_h.webp 三張候選已存在；水平真Gemini圖生 T_H 兩側接縫 5.25／4.14，原硬切47.38。待 AGY 來源穩定，Cursor 原樣 SHA copy 到新 assets/img/sakura-pass/、只 stageId=sakura-pass lazyload、world-space 512網格、Chrome真截圖及無音檔安全Node驗證。未見 Cursor 最終實際改檔／測試前保持[~]，不得標[x]。
- [!] **垂直過渡 V 不接入**：AGY 揭露目前V由水平真圖旋轉成臨時preview、不是獨立母版，邊界34.93／35.02仍顯著（Gemini圖生子代理回報429）；待原生素材或確實可用的視覺修復。使用者批准接線不等於宣稱V合格。
- **範圍保護**：第三關神社、古木、小怪idle、花天狗idle/attack仍需各自美術審核，本次不擅接；第1/2關程式/外觀不變；音訊TTS凍結。禁止自行commit/push/deploy；第1關P0與第2關石木硬邊部署門仍BLOCKED，3–8關整體完成仍未達標。待Cursor完成後另由Space Bunny做限量獨立QA。

**2026-10-14 11:53 第三關地板新增美術必修項 [~]**：使用者已目視確認 mountain_dirt↔sakura_steps 直接硬切過於顯眼，明確同意讓 AGY 返工。AGY Herdr w5:p5 已實際派工且working；僅新增 art/stage3-sakura-pass/candidates/transitions/ 內2–4張真實手繪過渡圖與水平、垂直、2D/2.5D拼接預覽、manifest；原兩張512px地板不得覆蓋。**未獲使用者核准的過渡圖不得接正式runtime或解除Stage3美術BLOCKED**。Codex待命、音訊凍結、無commit/push/deploy。

## 2026-10-14 10:43 真實交付盤點

- [x] **Space Bunny R7 第二關獨立QA**：docs/r7-spacebunny-qa-20261014.md，實際真Chrome 66項PASS/0FAIL（另9 HUMAN_REVIEW），真時序冷啟動9組PASS（9 HUMAN_REVIEW）、189張截圖；39檔 Node 安全回歸609/609。第二關小怪/Boss實際生成、姿態、潮汐攻擊通過；第一關P0視覺判斷及第二關石木硬切仍BLOCKED。新發現：小怪可能卡屋後20秒、潮波觸發210>有效182、共享無敵導致貼身潮波被接觸傷害吃掉、建築遮擋等；非全部技術FAIL，詳原報告。
- [~] **Cursor C1/C2 核心獨立原型就緒**：js/card-collection.js + tests/card-collection-c1c2.test.cjs 6/6 PASS；尚未掛載STORE、game、index或實際配送，不能勾成C1/C2完成。後續接口設計缺口：js/game.js現有study.pick會先選詞／選不到直接return，純替換STORE.pick fallback不足以讓C2真實生效；pickDeliveryWord回傳jp字串，但chosenWord需詞物件，需實作前修正設計。
- [~] **AGY Stage3美術六項正式候選**：art/stage3-sakura-pass/candidates/ 有兩款512 tile、神社建築、妖櫻地標、櫻小僧idle、花天狗Boss idle，含scene_contact_sheet、4x4接縫、玩家比例圖；**未經使用者目視核准，不可接正式關卡**。兩種材質互接像素差47.38、需過渡或人工審美決策，單材質自接0不等於自然美術合格；Boss和小怪attack仍未生成（等母版批准）。第四關art/stage4-bamboo-maze/brief.md只有企劃。
- **Herdr實查**：Codex/Cursor/AGY/Space Bunny目前全部idle；Grok Build已由使用者手動關閉。Codex額度應用於重大契約或最終放行，不為日常交接啟動。
- **下輪**：先供使用者目視審核第三關contact sheet與scale及地板transition、決定潮波貼身傷害和遮擋提示；Cursor可獨立修敵人防卡死、正式sprite失敗fallback安全邏輯並加測，再讓Space Bunny回歸；C1/C2先改選詞契約再整合；第4–8關資產待後續批次。尚未Commit／Push／Deploy；音訊/TTS凍結。

## 5. 下一位接手者的優先任務

**第一優先：部署門現況 BLOCKED。不要因測試全綠而 commit／push／deploy。不要再標 R4 READY。**

**2026-10-15 最新排序與獨占：** 以頂部復工指令與 [唯一 Project master](docs/roadmap-execution-board-20261014.md) E15 票為準。Grok 正式 coding／Kiro 獨立 QA／AGY 隔離規格均已實際 working；Cursor 禁用。下面 10/14 分工保留為歷史，不再作啟動依據。

**2026-10-14 歷史排序與獨占（已被10/15覆蓋）：**

**代理替換更新：** `space_bunny` w5:p4 已由使用者直接派獨立 QA，Herdr working（seq456），不是 Done。Kilo／Nemotron 已退出、不再派工；Grok 儲備。Codex 本輪只維護協調；Cursor／AGY idle，保持 production／圖片各自獨占。Space Bunny 限寫 `docs/r7-spacebunny-qa-20261014.md`、`artifacts/validation/spacebunny-r7-20261014/**`，必要時新獨立 acceptance 檔。等具體 FAIL 證據後才交 Cursor 修復，不重派相同 QA。優先阻塞：**① 第一關 P0 冷啟動／切鏡拼接與人審 → ② 第二關石木硬邊／區塊交界 → ③ 整關視覺核准／跨實體設備**。目前沒有新 bug 定稿，不新增修復或重繪。

**更新：使用者已核准 `stage2-enemies/rework/` 四圖，以下初輪第 1 點已被正式接線與本機工程驗收取代。** AGY 停重繪並原樣複製 `assets/img/rain-port/enemies/`；Cursor 完成 spawn／AI／姿態／loader／圖片 cache；Codex 獨立新契約 11 項、targeted 86/86、回歸 613/613（排除 1 真音檔 hash 項、另驗圖片 188/188）、Chrome 4 組 PASS。地板仍 BLOCKED；角色不要求二次核准。下一步是地板／整關核准與跨實體設備，不是重畫已核准妖怪。最新證據見交接頂部與 `artifacts/validation/codex-stage2-enemies-20261014/QA.md`。

1. AGY `[~]`：潮目小僧／碇海坊主 idle-attack 不同角色返工；單母版參考編輯、少量新圖、alpha／錨點／前後與玩家同尺對比。既有 `stage2-enemies/rework/` 先追溯來源與誇大 PASS，不覆蓋；必要新增 `round2/`。所有候選待人審，不接遊戲。
2. Cursor `[~]`：compat 真圖／風格／石木交界審查，局部 `js/renderer.js`、`js/assets.js` 接線與 Chrome 連續截圖／stage1 P0；AGY 獨占圖片新增。cross-edge 數字不能當美術 PASS，手機 viewport 不能當真機驗證。
3. Codex：協調文件與獨立重點 QA；Grok 本輪凍結、Kilo 未派長任務。音訊／TTS／API KEY 保留不讀不用，164 詞整包無期限延後。
4. 妖怪母版／動作與第二關地板風格均待使用者核准；四項部署門維持，禁止發佈。額度偏好見 `AGENTS.md` 最新協調欄；配額數字只為使用者自述。

1. **2026-10-13 歷史檔案邊界（最新以上段及交接為準）**：
   - **Grok Build**：規範唯一寫入者。可寫 `AGENTS.md`、`docs/agent-handoff.md`、`roadmap.md`、`docs/art-asset-only-standard.md`、`docs/stage-identity-standard.md`。不改 `js/`、`tests/`、`assets/`、`index.html`。
   - **Cursor**：真圖路徑確認且另行授權後，才可改置圖。禁止幾何造型、色塊 fallback、程序敵人。暫停停震仍見 `docs/r3-gamepad-validation.md` §4。
   - **AGY**：手繪 PNG／WebP，含日後的專用敵人與 Boss。四款參考未落盤前只許另存新檔。禁止生成或替換 BGM。
   - **OpenCode**：`tests/`、`tools/r6-*`、`docs/r6-*`。測試通過不是美術合格，也不是部署許可。
   - **交叉檔案**：不准兩人同時改同一檔。
2. **既有驗收與待辦定位**：
   - 部署門四條件都未過，見 `docs/stage-identity-standard.md` 第 6 節。方案不算放行。
   - P0 地板拼接 `[!]`：還要加 2D／2.5D 冷啟動跨設備驗證。
   - 第二關識別：濕石港路、木棧、倉庫、魚舖、繫船柱、船、常夜燈、雨天仍待美術驗收。專用小怪與專屬 Boss 必須實作並驗收，現況 BLOCKED，先等使用者核准造型，禁止批量生圖。
   - 第 3–8 關識別全部待設計。配樂八關槽待使用者交付；暫播現役曲不算最終驗收，不准替換現役三檔。
   - P1 真圖守門仍見美術標準第 7 節。P8 手感放行是歷史紀錄。
   - P7 與 B5 保留待辦。
3. **Freeze 與授權邊界**：
   - 現況禁止 Commit、Push、Deploy。第 6 節四項都驗收通過後，才由 ChatGPT 協調發佈。配樂待交付不能寫成已驗收。
   - `sourcefreeze` 只是舊驗收基準，不得阻止已派工且不碰部署門的檔案工作。
   - C/D 階段保留規格，未另授權前不實作。


## 6. 更新日誌（最新一筆放最上方）

| 日期 | 階段 | 完成／變更／驗證證據 | Commit／部署 |
|---|---|---|---|
| 2026-10-15 | **復工接管／E15工程驗收／C5 [x]** | 更新AGENTS／roadmap／handoff與唯一master；Herdr真派Grok、Kiro、AGY並確認working。E22-05已在停工前完成，9檔SHA一致不重做。Grok修R16三根因＋多包假PASS，root strict23PASS；校準三情境3PASS且唯一run保護舊證據。Kiro新C5資料面10PASS，429停止後root接storage3PASS與安全731PASS／0FAIL／0SKIP（排2音訊suite＋真音檔hash）；prod未改。AGY清冊4主候選SHA／連結已核，未接未核准圖。Kilo真ID／Gateway metadata已核，未推理。P0真機、Stage2/3/4人審及正常實玩仍阻塞。證據：artifacts/validation/director-e15-20261015/。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-14 | **Space Bunny 接替 Kilo／Nemotron／獨立 QA [~]** | 使用者已真啟動 OpenCode `space_bunny` w5:p4 並派限範圍 QA；Codex 末查 working seq456，指定報告尚未落盤，Cursor／AGY idle。Grok 首查 idle、末次 list 未列出，保留儲備角色不派工、不沿用 pane。只局部更新本檔與交接頂部，保留歷史與前輪 11／86／613／28 截圖基線。第一關 P0、第二關石木硬邊、人審仍 OPEN／BLOCKED；等具體 FAIL 再派 Cursor，不重複派 QA／重繪，不派 Kilo 或 Grok。音訊／TTS 凍結。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-14 | **已核准妖怪正式接線／本機工程驗證 [x]，整關 [!]** | AGY 原樣複製四圖；Cursor 局部接 `js/assets.js`／`js/game.js`／`js/renderer.js`／`service-worker.js`：雨港普通 spawn 真 Shiome、鎖向預告／可躲單次 8 油潮波／冷卻，專屬終王兩姿態與 tide 同步，封印圈／shield idle 保留。Codex 新契約 11 項、targeted 86/86、guarded 回歸 613/613，exit 0（排除 1 真音檔 hash 項；另驗 188 圖片 hash）。Chrome 1280×800／1024×768、2D／2.5D 共 4 組、28 張 `final-visible-*`；真 scheduler 與答題，時間位置 hook 明示，不是 iPad 真機／自然通關。QA 鏡頭初輪誤判與 Cursor hash 音檔讀取疏漏均保留於 `QA.md`，無音訊修改／TTS／API。地板仍 BLOCKED，預覽 `http://127.0.0.1:9144/index.html` 靜音正常解鎖。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-14 | **rework 四圖使用者核准／正式敵人接線 [~]** | 角色特定美術閘門解除，原不一致圖仍拒收。Codex 真送 AGY 停重繪／round2；AGY 原樣複製四 WebP 到 `assets/img/rain-port/enemies/`，附 `runtime-manifest-20261014.json`，done。Cursor 保存地板 handoff、working 正式接線；Codex 新獨立測試 `tests/stage2-approved-enemies.test.cjs` 實跑 RED 7 項：1 pass／6 fail，exit 1，完整日志 `artifacts/validation/codex-stage2-enemies-20261014/targeted-red.log`。功能／Chrome 未驗收完成；地板仍 BLOCKED。音訊凍結，不讀真音檔、不呼叫 TTS/API。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-14 | **Codex 接管協調／初輪真正派工 [~]** | 先讀規範、交接與必要源檔，查看原四圖與既有 rework／compat 預覽。`herdr agent prompt` 真派 AGY w5:p5（working seq435）、Cursor w5:p6（working seq436），兩次 exit 0；Grok idle 未交辦、Kilo 未派工。AGY 補單母版來源、姿勢一致性／alpha／錨點／前後與玩家比例；Cursor 審地板真圖／風格、由 AGY 新增 runtime 圖，提供 Chrome 連續截圖與 stage1 P0。現有 rework 是派工前已存在，不歸本輪生成；「100% 一致／零跳動」待證。Codex 局部更新協調文件；妖怪與地板仍待使用者核准。音訊無期限凍結，API KEY 不讀不用；優先本期 Codex 至約剩 10% 為使用者額度偏好，未工具查證。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-13 | **部署門修訂：第二關敵人／Boss 須實作並驗收** | 只改 `docs/stage-identity-standard.md`、`AGENTS.md` 第 0A 節、`docs/agent-handoff.md`、本檔。刪掉「有方案即可部署」。第二關至少 1 個手繪小怪與 1 個手繪專屬 Boss 接入並通過自動／視覺驗收，才算完成與可發佈。沒圖則 BLOCKED，禁止批量生圖。配樂槽待使用者交付，同曲暫播不算最終驗收。未改 js／assets／tests。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-13 | **關卡識別永久規則／部署門 BLOCKED** | 只寫規範。新增 `docs/stage-identity-standard.md`，並更新 `AGENTS.md` 第 0A 節、`docs/art-asset-only-standard.md` 第 9 節、`docs/agent-handoff.md`、本檔。只讀證據：全關 Boss 畫 `ART.boss`；`bossTheme: "harbor"` 只影響稱號；tide 僅雨夜港町終王；配樂是 `BGM.mp3`、`MAP.mp3`、`BOSS.mp3` 三條全域曲。第 3–8 關識別標待設計。三條件未過，不准 commit／push／deploy。未改 js／assets／tests。 | **未 Commit／未 Push／未 Deploy（BLOCKED）** |
| 2026-10-13 | **美術硬性命令／R4 拒收 [!]／新 P0 地板拼接** | 使用者命令取代同日 R4 READY。只寫 `AGENTS.md` 第 0 節、`docs/art-asset-only-standard.md`、`docs/agent-handoff.md` 第 0 節、本檔。R4 改為【使用者明確拒收，原程式幾何版作廢、需真正重製手繪圖、不可再標 READY】。另立 P0：第一關地板初載／切鏡數秒才正常。四款參考路徑未落盤，不覆蓋 dirty 圖，不改 js／tests／assets／index。未跑測試、未看瀏覽器。 | **未 Commit／未 Push／未 Deploy** |
| 2026-10-13 | **R4 第二關最終整合盤點 [~]／READY、不勾完成** | 只更新本檔。唯讀核對世界、渲染、遊戲、資產載入、詞庫、`assets/img/rain-port/` 九張 WebP、`docs/r4-asset-manifest.md`。沒有會阻止第二關完工的程式缺陷：玩法鏈、港町疊圖、三層雨與貼地漣漪、Boss／配送／存檔、服務工作人員媒體快取都在。ChatGPT 確認 R4 19/19 與舊回歸 603/603；本輪未重跑、未看 Chrome 截圖。混合青石＋局部木碼頭仍是【可逆試玩候選】。Remaining 只剩使用者試玩與真機手感。先前「猜角色、9 失敗」作廢。 | **未 Commit／未 Push／未 Deploy** |
| 2026-10-13 | **R4 rain-port 可玩核查 [~]／未完成** | 只新增 `docs/r4-stage2-gameplay.md` 並更新本檔。Boss、故事、存檔沒有第二關缺漏，三個 js 未改。解鎖鏈、27 詞 MP3、終王潮汐、600 秒／6 配送有測試或腳本證據。混合青石主街＋局部木碼頭是【可逆試玩候選】，不是使用者定案；木碼頭 WebP 被載入器猜錯角色而沒配上。`node --test` 上述 6 個檔 87 項、通過 78、失敗 9（B1、B2、C1–C6、E2）。沒有真機、沒有自然通關。等 OC 覆核。 | **未 Commit／未 Push／未 Deploy** |
| 2026-10-13 | **R 派工更新 [~] / R3 手把震動相容 [~] 真機未測** | ChatGPT 經 Herdr 派工，roadmap 不再寫「等待 Codex 重新啟動」。前一輪查證維持：R5 實作與校準 15/15、平衡未定；R1 125 新音檔＋11 別名已產出，當時 136 未接線、158 缺圖；R6 已校準且 R1 兩 FAIL；R2/R3 真機未測；R4 僅概念稿。本輪只改 `js/haptics.js`（dual-rumble／pulse／拒絕／關開關與失焦斷線停止）、`docs/r3-gamepad-validation.md`、`roadmap.md`。`node --check` exit 0；沙箱契約 13/13；既有 `tests/controls.test.cjs` 7/7。沒有 iPad 或 Xbox 實測。暫停停震與 index query 留給 Cursor。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **R 階段需求落盤 [ ] / 試玩回饋與內容補完排程** | 依使用者指示完成 R1–R6 需求落盤（R1 音圖補齊、R2 平板音樂、R3 Xbox手把平板震動、R4 第二關港町美術與自然雨、R5 符咒黏貼延遲爆破、R6 獨立驗收），全項標記 [ ] 未開始；P8 放行有效，P7/B5 保留待辦；C/D 保持未啟動；既有 603/603 與 88/88 為舊版基線非 R 驗收。重啟後由 Codex 經 Herdr 指派檔案分工。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **交接文件落盤 [x] / 四 Agent 規範定案 / C/D 保持未啟動** | 根目錄新增 AGENTS.md（協作與接手通則）、docs/agent-handoff.md（Herdr 四角色分工、Cursor Fast 關閉指示、現況 baseline、校準備援路徑）；更新 README.md（八關現況與頂部交接連結）；同步 roadmap.md 第 0 節與 P2–P5 狀態對齊（P8 已確認、P7 待補、B 階段 88/88 pass）。言靈圖鑑 C1–C5 與發行 D1–D3 嚴格保持未啟動，等待後續任務授權。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **B1–B4 本機自動驗收通過 [x] / B5 平衡待測 [~] / P8 使用者放行 [x] / P7 待補 [ ]** | OC 獨立驗收 88/88 exit 0（8 真 won/finishDelta1/clears+1/下一關解鎖，16 反向 play+finish0，8 重載 STORE API/storedClears 一致，11 地圖 UI 入口及截圖相符零例外）；全套回歸 603/603 pass（0 fail, 0 skip）；root 親看 Snow/yomi 手機與 hyakki 桌機截圖；selftest 報錯 exit 1、known-good 校準 33/33 pass。報告見 `artifacts/validation/b-stage/oc-final-verification.md` 與 `final-frozen/*`。限制：P7 真機 FPS/P95/RAM/溫度與 TTS 實體發聲待補，全 8 關 10min 自然平衡待測。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **P8 放行 [x] / B1–B5 實裝完成 [~] / 待 OC 獨立驗收** | 使用者確認試玩沒問題，P8 視覺手感正式放行；授權開啟 B 階段。AGY 獨占完成：1. 8 關 164 詞庫（含 yomi 164 詞綜合複習池，全假名詞空漢字契約，盤點 `docs/season-one-content.md`）；2. `js/story-dialogue.js` 3 章短劇與 Boss 台詞，index/game/ui 真正接入且無阻斷彈窗；3. `js/overworld.js` 後 6 關節點解除 enterable:false（改為 true），17 節點 16 道路坐標與旅路介面原樣保留，解鎖鏈照舊；4. 勝利條件維持原 P 契約（hurt final + delivered >= GOAL 立即觸發，非 600s 硬性條件）；5. 驗證工具 `tools/verify-words-corpus.cjs` exit 0；全 suite 598 通過，OC `tests/b-stage-content.test.cjs` 因空漢字待 OC 修正。生產碼宣告 freeze。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **P6 自動驗收通過 [x] / P2–P5 本機驗證 [~] / P7–P8 未驗 [ ]** | Codex／Cursor／AGY／Opencode 2.5D 整合自動化階段驗收：Node 582/582 exit 0；P6 combined full（seq117 S1–S11 除 S8 門檻誤植）+ 受影響補測（seq126 `--only=S3,S8,S10` exit 0，800/800）= combined S1–S11；336 事件影格（五階×三 tilt、30 strike draw>0、6 storm-child cloud==1）、S8 刀氣 18 筆；721 張 PNG。驗收期間 production 四檔雜湊自 seq117 起未變（≠整輪渲染未改）。**定稿**見 `artifacts/validation/hd25d-integration/evidence/oc-seq126-final-verification.md`；早先「Lv1 fixed-age 待重拍／P6 未放行／production 4 檔未改」等敘述已由本定稿取代（`failure-evidence/` 保留）。 | **未 Commit／Push／Deploy** |
| 2026-10-13 | **P｜2.5D 優先排程 [~]** | 僅更新 `roadmap.md`：新增 P0–P8／Stage 2–4 的施工與驗收門檻，先關閉六技能、角色與文字、光照、素材容量、Chrome／Node、真機效能；P8 人工確認後才進關卡 B1–B5。保留 A5 發行紀錄、原 A–D 規劃與現有全部未提交成果。 | **僅文件修改，未 Commit／Push／Deploy** |
| 2026-10-12 | **A5 release [x] 正式上線** | 30 個相關檔案已選擇性提交；循序回歸 **537/537 通過**，Chrome 手機直向真實頁面通過。GitHub Pages build／deploy／report 三工作均 success；現場下載 `index.html`、旅路程式、節點配置與高解析地景的 SHA-256 全部符合 `4f2191b` Git 內容。大量未追蹤素材、驗證截圖及開發原稿留在本機未發布。**A6 真機試玩尚未驗收、3–8 關仍封印。** | 功能提交 `4f2191bf23373ace37d83a7ca3da1c45b67baab3`；[Pages run 38207637192](https://github.com/yorkwahaha/yokai-delivery/actions/runs/38207637192) **success** |
| 2026-10-12 | A5.5 [x] 角色左右轉向／往回走不倒退 | `js/overworld.js` 記錄移動朝向並按路線每段 x 位移更新；左移將相同腳步素材水平鏡射，右移恢復原向，停止後保留朝向；新增 `tests/overworld-facing.test.cjs` 3 項回歸，**537/537 全測試通過**，手機 Chrome 真實 `index.html` 地圖載入測試通過；背景／定位配置不動。A5 地圖介面本機完成，A6 真機／上線未完成 | 未提交／未部署 |
| 2026-10-12 | A5.4 [x] 旅路字體與對齊精修 | `← 首頁` 使用與地名一致的 Kaisei Decol 明朝標題字、深墨 #39261d／淺米白細描邊（`mapTypography:"title"`）；地名主字 16→15px、上移 2px，假名上移 4px，牌面不改；上方標題與副標、底部提示字上移 4px，◀ ▶ 只提高文字 4px（`visualOffsetY`），按鈕底圖與 hitbox 不變。限定 `js/overworld.js`、`js/ui.js` 的旅路 opt-in，`index.html` 腳本版本更新。修正一項舊測試誤以為轉檔來源 4K 必須存在的問題（正式 WebP 正常）。Chrome 實際主程式桌機 1500×900／手機直向 390×844 截圖：`artifacts/validation/eight-stage-a5/map-typography-alignment-v2-{desktop,phone}.png`；**534/534 回歸測試通過**。手動定位檔 `js/overworld-layout.js` SHA256 `315fe42e93dbcd2f6224d5751906099ba87f7dc158e9b5e3d579a0239bd432a6` 保持不變。 | 未提交／未部署 |
| 2026-10-12 | A5.3 [x] 旅路字體／描邊／底色對比優化 | 深墨字＋暖米白細描邊、和風明朝標題與木牌、可讀正文與紅色按鈕暖白字、紙面中央柔光；UI 變更只在旅路 opt-in，不改玩法／地圖定位；真實 Chrome 1500×900 與 390×844 畫面驗證；新增 2 項自動測試，重建快取後 **532/532 通過**。截圖於 `artifacts/validation/eight-stage-a5/map-typography-*.png` | 未提交／未部署 |
| 2026-10-12 | A5.2 4K 地景對位換圖 | 確認使用者放入 `assets/img/overworld_approved_v2_4k.webp` 實際為 3840×2161（標示 2160、只差一列），與舊 1672×941 圖的低頻像素相關性 0.9999；**構圖、座標無須重調**。保持 `js/overworld-layout.js` SHA256 `315fe42e93dbcd2f6224d5751906099ba87f7dc158e9b5e3d579a0239bd432a6` 完全未改。4K 以 WebP Q94 編碼至 `assets/img/overworld_approved_v2.webp`，2,084,884 bytes（比原始 8,191,352 bytes 少 74.5%，保留 3840×2161），更新快取版本及預設優先使用 4K。A6 真機仍待測試 | 未提交／未部署 |
| 2026-10-12 | A5.1 [x] 可視化地圖編輯器 | 追加 editor/overworld.html + js、tools/map-editor-server.cjs、`開啟旅路地圖編輯器.cmd`、正式 js/overworld-layout.js 資料來源、三層獨立定位與背景縮放；本機 Chrome 真正拖曳／儲存／遊戲程式讀回通過，530/530 全測試通過，見 docs/overworld-editor-usage.md | 未提交／未部署 |
| 2026-10-12 | A5 完整互動與手機直向入口驗證 | 修正原 `index.html` 直式全屏旋轉遮罩阻擋旅路的問題：主選單及地圖可直式操作，戰鬥仍要橫向。新增 3 項真實輸入測試；**527/527 全套通過**。CDP 用真正 `index.html` 通過手機 390×844 首頁→旅路並確認素材載入（`tools/overworld-live-page-smoke.cjs`）；完整交接在 `docs/overworld-a5-integrated-report.md` | 未提交／未部署 |
| 2026-10-12 | A4 [x]／A5 [x]／A6 [~] | 八關 17 節點 16 道路、動態木牌／封印／通關、關卡瀏覽箭頭與出發／前往、3–8 未實作封印、直向 3000×2200 補景與 HUD 貼邊皆已接入；當時 524/524 全測試通過（後續新增 3 項直向操作測試，現為 527/527），Chrome 八關及多尺寸截圖 `artifacts/validation/eight-stage-a5/`。真機觸控及線上版仍待驗收 | 未提交／未部署 |
| 2026-10-12 | A4 [~]／接圖第一步完成 | 選定 PNG 已到位，轉檔為約 527 KiB 的 WebP（-86.1%），更新 js/assets.js、js/overworld.js、index.html、tools/build-media-cache.cjs、service-worker.js 及資產／旅路測試；518/518 及 Chrome 真實圖片載入檢查通過；截圖 artifacts/validation/overworld-a4-approved-night-town.png。舊 5 關座標尚未對齊新圖，直向延伸尚未做 | 未提交／未部署 |
| 2026-10-12 | A3 [x]／A4 [!] | 使用者選定第二張純地景 `霧嵐之境_櫻花雪域幻境地圖.png`，八關木牌／虛線疊圖僅作對位參考。新建 tools/prepare-approved-overworld.py，Pillow WebP 驗證與拒用疊圖測試通過；Windows 專案尚無純地景來源 PNG，故尚未轉檔或接入 JS；請將原圖放進 artifacts/references | 未提交／未部署 |
| 2026-10-12 | A2 [x]／A3 [~] | 已完成 8 關×8 比例＝64 組幾何驗證，原直向 HUD 有碰撞／圖資高度不足；2200 高延伸＋底部 HUD 貼邊之方案 64/64 通過；產出 A2 比較頁、Node 測試 JSON、四張 Chrome 截圖與 A3 美術簡報；找回兩張舊設計圖的 ChatGPT 檔案，Windows 專案尚未取得原圖 | 未提交／未部署 |
| 2026-10-12 | A1 核准／A2 [~] | 使用者同意八關構圖定位；瀏覽器開啟 V1、核對原始碼名牌／角色／HUD，跨裝置實際測試未完成；見 docs/overworld-a2-validation-notes.md | 未提交／未部署 |
| 2026-10-12 | A1 草稿 [~] | 建立 docs/overworld-eight-stage-layout-v1.html 與 .md：3000×1600、8 正式關＋9 waypoint、16 段路、局部視野與 HUD 留白；Node 語法與資料結構基本檢查通過，尚待使用者審核 | 草稿未提交／未部署 |
| 2026-10-12 | Roadmap 建立 | 彙整八關主線、N5 主題詞、四次配送字卡、動態機率、Q 版地景母版及 A–D 工作階段；核對 `js/words.js`、`js/overworld.js`、`js/assets.js` 目前狀態 | **已提交 fa81c73**／未部署 |

> **更新範例**：`2026-10-13 | A1 [~] | 完成 eight-stage-layout-v1 草稿，900×600 局部視野尚待使用者確認 | 未提交／未部署`。
>
> **給未來所有 Agent：本檔可且應持續更新！每做完一階段就標記，不需等換對話；若發現本檔過期，請先驗證後直接修訂並註明原因。**
