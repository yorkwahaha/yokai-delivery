# AGENTS.md — 專案協作與接手通用規範

## 2026-10-15｜使用者授權本機 Checkpoint Commit（取代舊禁止 commit 條款）

使用者已明確同意：每完成且驗證通過一個重要里程碑，自動建立一次本機 Git Checkpoint Commit；沒有授權 Push 或 Deploy。
- 有 Agent 正修改的檔案不可提交，待它交卷且相關測試確認後再提交。
- 嚴禁全庫 stage（add -A / add . / add -u）；必須逐檔白名單 git add -- 並檢查 staged 檔案、git diff --cached --check。
- 絕不提交音訊及語音素材（assets/audio、art/audio、js/audio.js），也不提交金鑰、環境檔、暫存截圖、拒稿、未核准 art 候選、個人機密。
- 只收已驗證功能程式、必要來源與已核准的正式生產圖，核准狀態不明即排除。
- 記錄 commit hash、已提交範圍與仍未提交的項目。本機 commit 不是異地備份，遠端 Push 仍須另行批准。
- 繼續禁止 reset / clean / checkout / 任何會清除 dirty 工作樹的操作。

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

## 2026-10-15 現行執行入口（優先於下面舊 AGENTS 工作紀錄）

**本次唯一本季派工來源：[第一季製作總計畫](docs/season-one-master-plan.md)／[甘特圖](docs/season-one-production-gantt.html)。** 每輪先選其第7節最接近「八關完成」的未完成交付物，而不是按歷史監工紀錄重新做測試。
**目前角色**：AGY＝美術和詞庫故事資料；Kilo＝關卡玩法、資產正式接線和 Boss；OpenCode Muse Spark Free＝UI和行動端；Codex＝稀少額度、重大決策和最終整合。Kiro/Grok/Cursor 本輪不派。
**完成定義**：程式 PASS≠正式美術核准≠10分鐘自然遊玩≠真機≠部署。未核准稿只在 art 候選區、不准接正式遊戲。原數百筆 dirty 差異保持；Audio、TTS、BGM、API/KEY 不讀不改；未獲授權不 commit／push／deploy／reset／clean／checkout。
下面的「最高現行」與舊 Agent 路由記載均為歷史，不可蓋過這份最新工作基準。Codex 不常駐監工，不再做商業級多 Agent 管理系統。

## 2026-10-15 03:26 人審更新／持續執行（最高現行）

使用者明確解除「等待美術人審所以無法派工」的舊結論，Codex w7:p1 繼續總監派工／獨立驗收。實查357 dirty（前輪356），所有既有差異保護，音訊／TTS／API／BGM／KEY不讀不改，不 commit／push／deploy／reset／clean／checkout，Cursor禁止。Kiro近期429不反覆重試；Grok獨立Build優先，備援精確模型僅 `kilo/nvidia/nemotron-3-ultra-550b-a55b:free`。

- Stage2石板→木棧道過渡v2：USER_APPROVED（對照視覺通過），此素材不再WAITING_HUMAN；衍生方向、runtime接線與整關驗收仍須另驗，非發行許可。
- Stage3：拒收巨石庭院＋神社的候選構圖／貼花／預覽（巨石比例、屋缺體積、地表規則重複）。重設合理角色／屋／石比例、2.5D神社體積與非規則無縫地表。禁止擴大拒收到現役神樂殿、古櫻或三張現役地面；未核准新稿不接runtime。
- Stage4：拒收黑暗竹泥底地、角色高度巨大落葉與其組合預覽；重設明亮地面、小葉／稀疏點綴、半水墨＋半浮世繪木版。其他怪物母版仍未判定，不能錯標拒收／批准。
- Stage1切鏡：USER_REPORTED_VISUAL_OK（使用者親測目前沒什麼問題），非跨裝置FPS全過。164詞語音包仍凍結；超過5假名詞先做非破壞UI／詞庫體感分析，不刪詞。
- **AGY專責整理與拒稿清理**：獨占art候選舊路徑移轉／每關根恰兩素材子目錄characters、scene，Preview直接根目錄；ASCII snake_case與正確idle，E_/B_/G_/H_/O_/Preview_前綴。先建立docs/stage-art-path-migration-20261015.md的old→new／MD5／SHA256／引用／刪除清單，再安全實作。不得交Codex／Grok做美術整理。
- 刪除僅限已確定人審拒收、非現役且沒有runtime／test／docs引用的候選；合成被拒不代表每個組件拒收。保留核准稿、現役、源母版、測試證據、未判定資產；必要拒收證據文字存manifest。引用未解決的來源暫保留，先完成可安全移轉部分，不用深層rejected資料夾。
- Grok不碰art，先做Stage3/4比例／地表／遮擋審查與Stage2接線計劃；任何code／tests／loader路徑變更必須等AGY mapping及writer交接。具體票與owner見唯一執行看板M15區。

執行增量：M15-02兩份技術／長假名分析已驗收；M15-03核心引用修正done78，root41項對應快照不變＋新增4檔語法通過，動態metadata引用另收尾。M15-04 Grok已實際working79接Stage2核准v2兩水平縫；AGY M15-01c working77收art/docs引用與metadata，194列全覆蓋、192保留列hash一致／47範圍外不變。Kiro idle21不重試429。最新票狀態以唯一master為準。

## 2026-10-15 01:51 明確復工／最高現行指示

使用者確認 Windows 已重啟、WebCodex/Herdr 已連線，正式解除 10/14 23:03 停工閘門。Codex w7:p1（GPT-6.1 Sol High）接任執行總監，自主依 roadmap 分階段派工、獨立驗收與維護唯一 Project master：[執行看板](docs/roadmap-execution-board-20261014.md)。此指令覆蓋所有歷史「停工」「Grok 不派」「Kilo 退出」「Cursor 主寫」規則。不得假設跨重啟常駐。

- Grok Build w7:p3：獨立 Grok Build 服務，實查 UI Grok 4.7 High，優先正式 coding／修 bug／整合。使用者回報月額度剩 19%、約 23 小時後重置，非工具實測；有效工作優先，不刷額度。實際 rate limit 後立即停派，先保留進度／釋放 writer，再由核實模型及路由的 Kilo Gateway NVIDIA Nemotron 3 Ultra Free 接票。
- OpenCode w7:p2：實查 UI sonnet-4.5 Kiro High，獨立 QA／其次隔離實作；不得與 Grok 同檔 writer，不得混稱 Nemotron。
- AGY w7:p4：實查 Gemini 3.8 Flash High，美術提案或隔離規格；核准圖不重生，未核准候選不接 production。
- Cursor 全面停用 19 天，且未經使用者日後明確許可不自動恢復。不得啟動 cursor／cursor-agent、Cursor Grok 路由或派任務。Space Bunny／Muse 待額度。
- 復工實查 350 筆 Git dirty，保留所有既有成果。不 reset／clean／checkout／覆蓋同名產物；未授權 commit／push／deploy。
- 音訊／TTS／BGM／KEY 完全凍結，不讀、不執行、不修改；QA 必須在讀檔前 stub／阻擋。實體 iPad／Xbox、藝術人審不得假 PASS。
- E22-05 已於停工前交付，獨立 contrast 15 PASS；現役 index／gallery UI SHA256 與報告一致，不重做。C4 核心 24 PASS 可依快照復用；P0 僅 NOT_REPRODUCED、真機／人審仍 OPEN。每次 Herdr 操作前查 agent list。
- 復工首輪驗收：Grok E15-01／05 已交且 root 獨立 strict23 PASS／校準3 PASS，Kiro新C5資料面10 PASS由root重跑並接現役storage3 PASS、安全731 PASS（排除音訊範圍）；C5僅工程範圍完成。Kiro遇真429已停止自動retry保留session；AGY清冊done／候選仍待人審。Production 9檔SHA不變；沒有已核新產品缺陷，不為額度發明改動。最新證據與後續人審／裝置阻塞只看唯一master。

## 2026-10-14 23:03 緊急停工／重開機（**目前最新、優先於下方所有持續派工規則**）

使用者命令現在全部 Agent 暫停，待使用者自行關閉 Herdr、重啟電腦。**在使用者重啟後再次明確允許前，禁止自動派工或執行任何工作**。Cursor 月額度約剩20%、重置約19天後，**立即停用且直到使用者日後許可不得使用**；替代團隊為 Codex 執行總監、OpenCode OmniRoute Kiro Sonnet 4.5、AGY、Kilo 的 Nemotron 3 Ultra Free。Space Bunny/Muse 額度耗盡、Vercel 已放棄。停工現場、角色/工作票/美術和音訊凍結、復工程序詳見 [重開機交接](docs/reboot-handoff-20261014.md)。下方任何舊「Codex持續派工」「Cursor主寫production」「Kilo退出」等規則均被本最新指示覆蓋。


## 2026-10-14 22:xx Codex 恢復執行總監（最高現行協調指令）

使用者告知五小時額度已恢復；未經API查證，不猜數值。Codex自主連續派工／稽核／最終gate，獨占roadmap、execution board、handoff及本協調欄；取代20:11 ChatGPT暫行owner與舊待命規則。Cursor production用同Grok4.7 High（Fast禁），先短交接、保留舊session再安全開新；AGY已交候選、未有新票不用重開或重生圖。Space Bunny Rate limit保留閒置session、不重試；使用者明確授權已可用Sonnet4.5 via OmniRoute獨立read-only／新tests QA，其他舊Kilo/Nemotron/Grok Build不派任務。每操作查Herdr list，production QA固定快照、一檔一writer。C4 runtime已交但未獨立結案、R16疑harness須判根因；C3/R17技術PASS不等於藝術核准。音訊/音檔/audio.js/TTS/BGM/API Key不讀不改；未核准候選不接runtime；無commit/push/deploy/reset/clean/checkout，保護dirty成果。

本文件定義所有 AI Agent（Codex、Cursor、AGY、OpenCode、Grok 等）參與《妖怪快遞社》開發時的專案規範，最新使用者指示優先。跨對話重開或接手任務時，**必先閱讀本檔、 [docs/art-asset-only-standard.md](docs/art-asset-only-standard.md)、 [docs/stage-identity-standard.md](docs/stage-identity-standard.md) 與 [docs/agent-handoff.md](docs/agent-handoff.md)**。

## 2026-10-14 17:04 執行總監授權（現行，使用者最新指令）

- ChatGPT 為大主管；**Codex 6.1 Sol `codex_lead` 自主調度、決策、重要整合與最終檢驗**，逐階段推進 roadmap，不必等每張票。此授權取代下方 08:14 的 Sol 待命／日常只由 ChatGPT 調度規則。
- Codex 獨占 `AGENTS.md` 協調欄、`docs/agent-handoff.md`、`roadmap.md`、[執行看板](docs/roadmap-execution-board-20261014.md)。第0節歷史 Grok-only owner 已過期；其餘真圖、使用者人審與部署門維持。
- Cursor 主寫 production，只用 Grok 4.7 High／Composer2.5，Fast 禁用；AGY 獨占候選圖片／美術契約；Space Bunny Free 獨立 QA、不改 production。Grok／Kilo／Nemotron 已退出，不重啟或派工。每次 Herdr 操作先查 agent list。
- 額度17:04回報96%、19:07更新35%均為使用者回報，不是工具實測；允許充分有效使用到約10%以下，以工作不中斷與正確性優先，不猜精確餘額、不刷額度。
- 19:07現行：AGY僅改Stage4候選；Space R15 frozen QA收尾後才解production，Cursor修經核實產品缺陷／C4安全儲存，Space focused重驗。C3維持NOT_DONE；R15 harness誤報、R16未實作RED、美術人審分開記錄。
- **音訊凍結：不讀／改 `assets/audio/**`、`js/audio.js`、`tools/tts*`，不讀金鑰、不呼叫 TTS/API、不換 BGM。** QA HTTP 在讀檔之前 stub／阻擋音訊；回歸排除會讀凍結檔的項目並列明範圍。
- Dirty 成果與核准圖保護；未經使用者再次明確批准，不 commit／push／deploy，不 reset／clean／checkout。一般安全可逆實作直接派工；重大玩法／新美術／實體裝置缺口記 WAITING_HUMAN／WAITING_DEVICE，其他路徑繼續。

## 2026-10-14 08:14 Agent 職責與額度規則（歷史；已由17:04取代）

使用者最新決策：優先工作效率／正確性／Codex 五小時額度平衡；**撤銷舊「Codex 額度用至約 10% 再換」原則**。分工：

- **ChatGPT：日常總協調與思考決策**：評估需求、拆票、檔案 owner、防重複派工、輕量交接、讀 QA；可直接處理的事不要再讓 Codex 重想一次。
- **Codex 6.1 Sol（codex_lead）：只在重要時啟動**：架構方案、跨模組契約／重大整合爭議、複雜疑難、最終整合與發行風險放行。例行修改、一般文件、常規 QA、單一小 bug 不動用它。最終發布需使用者同意。
- **Cursor（Grok 4.7 或 Composer 依任務選用）：主實作與修復**。上下文快滿，先做完當輪、寫小交接再開同模型新對話；不必直接換付費模型。
- **AGY（Gemini 3.8 Flash）：獨立模組、邊界分析、問題定位與美術圖像生成**。遵守圖片獨占與使用者核准閘門，不重繪已核准怪物。
- **OpenCode（Space Bunny Free Personal）：獨立測試、核心驗收、回歸、真 Chrome 實測**，輸出可重現的問題後才派 Cursor 修。避免重跑已有等價驗收。
- **Grok Build：使用者已手動退出並關閉面板**，不能推定仍在 Herdr，也不自行重新啟動；Kilo／Nemotron 3 Ultra 已由 Space Bunny 取代。

額度（**使用者回報，非 API 實測**）：2026-10-14 08:14 Codex 五小時窗口剩約 70%，預計當地時間 12:22 重置。不得為燒完額度發明任務，也不要宣稱可讀取所有平台的餘額。每輪派工前先確認 Herdr agent list、正在工作的 owner 與可重用的既有結果，節省大型模型上下文。

其他約束不變：第一關 P0 初載地板和第二關石木交界仍 BLOCKED，怪物四張核准版不重繪，語音包凍結；未經授權不 commit／push／deploy，也不 reset／clean／checkout。

## 2026-10-14 協調權更新（使用者最新指令）

- **Grok → Codex `codex_lead` 接管協調與重點 QA。** 本輪 Grok Build 凍結，不再派工，除非使用者明確指定。Codex 可局部更新本檔協調欄、`docs/agent-handoff.md`、`roadmap.md`；取代下方歷史「規範只由 Grok 寫入」，其餘美術／部署門不變。
- 每次 Herdr 操作前重新 `herdr agent list`。2026-10-14 初輪已實際派工：AGY 妖怪母版一致性返工，Cursor 第二關 compat 地板審查／接線／Chrome 連續截圖與第一關 P0；兩者均由 Herdr 確認進入 working。最新狀態與檔案獨占見交接文件。
- **音訊無期限凍結。** 使用者拒收三組 Gemini Aoede／Leda 日語重音；164 詞整包延後。保留現役音訊、TTS 腳本與 API KEY，不讀、不使用、不修改；不生成／替換 BGM。
- **2026-10-14 最新核准：** 使用者核准 `art/r4/handpainted-candidates/stage2-enemies/rework/` 的 Shiome／Ikari 四張 idle／attack WebP 正式接遊戲；這四圖的角色美術閘門已解除，無需二次核准。原上層不一致圖仍拒收。AGY 停止所有重生圖／round2／新美術評審，只原樣複製至 `assets/img/rain-port/enemies/` 並記錄 manifest；Cursor 地板收尾後獨占敵人／Boss JS 接線，Codex 獨占獨立測試與 QA。地板 compat 仍待人審，妖怪核准不等於整關核准。
- **額度偏好：** 能力同樣適合時優先本期 Codex 至約剩 10% 再換其他付費 Agent，接近重置日優先即將到期額度；不做無意義工作。Grok 約剩 20%、Codex 已重置及上期約 65% 未用完，皆為使用者自述，未經工具查證；無法查額度時由使用者回報。
- **未 Commit／未 Push／未 Deploy。** 不覆蓋核准圖或其他人的 dirty 成果；仍受第 0／0A 節部署門限制。

---

## 0. 美術硬性命令（2026-10-13，最高優先，取代同日較早的 R4 READY）

使用者明確拒收截圖中的程序白色幾何房子與拼接地板。正式目標是與已核准第一關雛形同等精細的真實手繪 PNG／WebP。畫風為半水墨、半浮世繪、強墨線、和紙木版質感。細節、八條標準、P0／P1 守門與參考圖缺口見 [docs/art-asset-only-standard.md](docs/art-asset-only-standard.md)。本節與該檔衝突時，以使用者當輪原文為準；與較早的 R4 READY、測試通過數、檔案大小結論衝突時，以本節為準。

1. **正式可見物必須是真圖。** 房屋、路面、道具、招牌底板、裝飾、UI 藝術主體，以及缺圖時玩家看得到的替代物，全部使用手繪 PNG 或 WebP。禁止用 Canvas、SVG、HTML、CSS 的矩形、多邊形、線條或形狀代替這些美術。
2. **圖由繪圖產出，程式只負責擺圖。** 允許 `drawImage`、裁切、縮放、壓縮、投影、2.5D、分層、碰撞、文字排版。允許雨水、火花這類真正的輔助粒子。允許預設不可見的 debug 框。禁止用 Pillow、JS、SVG 畫出假裝手繪的素材。
3. **沿用已核准第一關的視角、比例、墨線與質感。** 精細度以現役町屋雛形為下限：`assets/img/house_shop.png`、`house_tavern.png`、`house_shrine.png` 與 `assets/img/scenery/` 同名 WebP。旅路已核准背景 `assets/img/overworld_approved_v2.webp` 不在這條命令裡重製。
4. **缺圖不得用色塊、幾何房子或木板線偷渡。** 圖還沒到就不要畫那件正式美術；可留空或停在載入，不可補一塊玩家看得見的假房子或假地板。
5. **粒子、文字、碰撞與隱藏 debug 維持程式職責。** 這四類不是本禁令要改成貼圖的對象。
6. **美術合格只認圖片級人工審與連續截圖。** `tests/r4-rain-port.acceptance.cjs` 的 19/19、全套 603/603、WebP 檔頭合法、位元組大小，都不能寫成美術合格。上一輪 R4 READY 作廢。
7. **不確定就停該部分並上報。** 需求、素材來源或破壞性替換不清楚時，回報 `【BLOCKED: 精確問題／替代方案／建議】` 給 ChatGPT／使用者，然後停止該部分。其餘已經明確、且不改到他人檔案的工作繼續做。
8. **檔案不重疊。** 其他人同時在改的檔一律不動。規範只由 Grok 寫入：`AGENTS.md`、`docs/agent-handoff.md`、`roadmap.md`、`docs/art-asset-only-standard.md`、`docs/stage-identity-standard.md`。禁止去改 `js/`、`tests/`、`assets/`、`index.html`。禁止 `git reset`、`git clean`、`git checkout`。commit、push、deploy 只在下方部署門全部通過、且由 ChatGPT 協調發佈時才允許；現在未過門，禁止執行。

使用者已點名四款高精度參考：港口倉庫、魚舖、濕石磚、濕木棧道。2026-10-13 盤點時，`art/r4/handpainted-candidates/` 是空目錄，倉庫裡沒有名為魚舖的圖。既有 `art/r4/` 與 `assets/img/rain-port/` 不得自行升格成這四款認可稿。在路徑確認前，禁止刪除或覆蓋這些 dirty 圖。

## 0A. 關卡識別與部署門（2026-10-13 永久規則）

每一關都要有自己的地板材質、整體場景、建築物、裝飾品、辨識地標，以及使用者另外挑選的配樂。關卡之間不得只換色調或詞庫，也不得共用完全相同的敵人組合與同一張 Boss 外觀、同一套技能。每關要有新敵人與專屬 Boss：手繪 sprite、看得懂的輪廓、至少一個不是改數值的行為。共通怪可以留一部分。敵人與 Boss 禁止用程序幾何圖省美術。Agent 禁止生成或換掉現有 BGM。矩陣、`bossTheme: "harbor"` 的證據、配樂預留與驗收門檻見 [docs/stage-identity-standard.md](docs/stage-identity-standard.md)。

**部署門（條件授權，現況 BLOCKED）**：下面四項都要實作完成並驗收通過，才允許 commit、push、deploy。測試全綠不能提前。需求方案、名稱、`bossTheme`、換血量不算放行。

1. 第一關初始地板拼接已修好，而且 2D 與 2.5D 的冷啟動已在跨設備驗證。
2. 第二關整組手繪美術經使用者視覺核准、已實際接入，幾何假美術已從正式畫面移除。
3. 第二關至少 1 個正式新增的手繪小怪 sprite，追擊或攻擊與共通怪不同；以及 1 個手繪專屬 Boss sprite，含獨立技能與潮汐攻擊。兩者都要接入 game、assets、renderer、AI，並通過自動與視覺驗收。沒有圖時這項 BLOCKED，先請使用者核准造型，禁止批量生圖。少量共通怪可以留。
4. QA 的程式回歸與畫面審核都 PASS。

未過門就上報 `【BLOCKED】`，停止發佈。到時由 ChatGPT 協調發佈，Agent 不自行 commit。每關配樂槽保留待選；使用者未交付前不准替換現役曲，暫播同曲不算最終驗收，部署紀錄要寫待交付。第 3–8 關的識別仍是待設計，不得寫成已完成。

## 1. 核心工作守則

1. **繁體中文溝通與阻塞優先**
   - 成果回報、架構分析與問題陳述一律使用繁體中文。
   - 若遇到阻礙（阻塞／失敗／例外），對外回報時必須優先說明具體原因與最小修復建議之必要摘要；原始指令、退出碼、錯誤訊息與完整 stack trace 應存入 log 或診斷檔案備查，勿對外大量 dump stack，亦不得隱瞞或跳過。

2. **搜尋以 `rg` 優先**
   - 查找程式碼、關鍵字或 symbol 時，優先使用 `rg` (ripgrep) 進行精確定位，避免盲目全文 dump 或過度讀取不相關檔案。

3. **啟動前必讀順序**
   - 每位 Agent 啟動或切換任務時，必須先依序閱讀：
     1. [AGENTS.md](AGENTS.md)（本通則；第 0 節與第 0A 節優先於較早結論）
     2. [docs/art-asset-only-standard.md](docs/art-asset-only-standard.md)（正式畫面只准真圖）
     3. [docs/stage-identity-standard.md](docs/stage-identity-standard.md)（每關識別、敵人、Boss、配樂與部署門）
     4. [docs/agent-handoff.md](docs/agent-handoff.md)（現場分工、禁令與最新現況）
     5. [README.md](README.md)（專案概述與環境）
     6. [roadmap.md](roadmap.md)（當前工作、階段閘門與更新日誌）
     7. 相關功能的既有測試（如 `tests/*.test.cjs`），明確既有契約再動工。測試通過不是美術合格，也不是部署許可。

4. **保護無關 Dirty 成果**
   - 嚴禁擅自 `git checkout .`、`git reset --hard`、`git clean` 或覆蓋未經授權修改之檔案。
   - 本地工作樹含有其他 Agent 與使用者的未提交產物，修改僅限於目前明確授權的檔案邊界；非授權檔案一律視為受保護資產。

5. **授權範圍內持續推進**
   - 在已獲明確授權的任務範圍內自主執行並解決問題，無需為了每一個瑣碎步驟反覆暫停詢問。
   - 遇邊界不清、需求衝突或涉及破壞性變更時，才暫停確認。

6. **同一阻塞至多 3 種實質方法且保留 Error**
   - 若指令或測試失敗，嚴禁重複使用同一指令或僅換 escaping 盲試。
   - 同一阻塞最多嘗試 **3 種實質不同** 的排查／修復方案。
   - 必須完整保留原始錯誤訊息、stack trace 與執行 log，不得以 `try/catch` 吞掉錯誤或將 catch 後的正常 exit 誤判為 pass。

7. **成果分級回報架構**
   - 回報結果時必須清晰分級：
     - **已修改（Modified）**：實際變動的檔案路徑、行號與關鍵 diff。
     - **靜態（Static Analysis / Lint）**：語法檢查、型別／欄位 contract 核對。
     - **測試（Verification / Tests）**：Node 測試 pass/fail/skip 數據、Chrome Headless 或專項驗收結果。這些數字不是美術合格。
     - **部署（Deployment Status）**：未過 [docs/stage-identity-standard.md](docs/stage-identity-standard.md) 的部署門時，必須寫「未 Commit／未 Push／未 Deploy」。測試全綠不是發佈許可。

8. **跨對話接手必讀交接文件**
   - 新開對話、切換模型或由 Herdr 重新調度時，必須先讀取 [docs/agent-handoff.md](docs/agent-handoff.md)，核對當前現場狀態，不得自行猜測線上版或歷史版本。

9. **禁止安裝系統軟體或改動全域環境**
   - 嚴禁擅自安裝系統級軟體、全域 CLI 套件或修改作業系統全域環境設定；所有相依與執行環境限於專案既有配置。
