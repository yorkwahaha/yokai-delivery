# Agent 跨對話接手與協同運作手冊 (agent-handoff.md)

## 2026-10-15 03:26 最新執行／人審更新

使用者明確命令繼續派工；實查357 dirty，全部保護。Stage2石木過渡v2 USER_APPROVED（非整關／部署），Stage1切鏡 USER_REPORTED_VISUAL_OK（非跨設備FPS）；Stage3拒巨石庭院＋神社候選貼花／構圖／預覽，現役神樂殿／古櫻／三地面保留；Stage4拒黑暗竹泥／巨大落葉／組合預覽，其他怪物母版未判定保留。AGY獨占整理，不由Codex/Grok代做。

Herdr已真派：AGY w7:p4 working30 M15-01，獨占art候選移轉／metadata與docs/stage-art-path-migration-20261015.md、e15-agy清冊；先mapping／MD5／SHA256／引用／刪除清單，再實作淺層stageN根characters/scene兩素材子目錄、Preview根。僅明確拒收、非現役、引用安全解除者可刪，不刪核准／母版／測試證據／未判定。引用尚在code/tests者暫留舊來源，canonical同hash待Grok另票改引用再由AGY移除。Grok w7:p3 working31 M15-02，只新兩份m15技術審查／長假名doc，art及production不動；mapping後才分code writer。Kiro429不派、不重試，root接QA。音訊/TTS/BGM/API/KEY凍結、Cursor禁用、Git發布／破壞性命令禁止。唯一票源看master頂部M15區。

執行增量：M15-02兩份技術／長假名分析已驗收；M15-03核心引用修正done78，root41項對應快照不變＋新增4檔語法通過，動態metadata引用另收尾。M15-04 Grok已實際working79接Stage2核准v2兩水平縫；AGY M15-01c working77收art/docs引用與metadata，194列全覆蓋、192保留列hash一致／47範圍外不變。Kiro idle21不重試429。最新票狀態以唯一master為準。

## 2026-10-15 01:51 明確復工（最高現行）

使用者解除停工並授權 Codex w7:p1 持續總監派工／驗收。現場 w7:p3 獨立 Grok Build Grok4.7 High 優先 coding，w7:p2 Kiro Sonnet4.5 High 獨立 QA，w7:p4 AGY Gemini3.8 Flash High 隔離規格；唯一票源為 [Project master](roadmap-execution-board-20261014.md) E15 區。Cursor 全面禁用、Space／Muse 待額度；Grok 真 rate limit 才交接給已確認模型／路由的 Kilo Gateway NVIDIA Nemotron3 Ultra Free。

實查350 dirty。E22-05 已在停工前完成且獨立contrast15 PASS，現役兩檔 SHA 與 e22-codex-c4-focused-qa 報告一致；舊看板 working680 已過時，不重做。C4 core24／C3 scoped9 可按快照復用，P0 NOT_REPRODUCED／真機人審OPEN。首輪 E15-01 Grok 修 R16 三處 harness 根因、E15-02 Kiro 新獨立 C5 tests、E15-03 AGY 唯讀候選盤點。音訊／TTS／BGM／KEY 不讀不執行不改，不接未批准圖，不 commit／push／deploy／reset／clean／checkout，不宣稱跨重啟常駐。

本輪最終增量：E15-01 done23已root獨立strict23 PASS，R16-06不再接受空獎勵假PASS。E15-05返修done27，唯一run輸出保護舊證據，root語法exit0／校準3 PASS、原artifact drift0。Kiro新C5資料面10PASS已root重跑，兩fixture誤判已糾正；其後真429，double Esc停止retry、done21保留session。root現役storageCases3 PASS，最新安全731 PASS／0FAIL／0SKIP（兩音訊suite＋真音檔hash項排除），內含真makeOrder／resolve等；C5工程完成，藝術／真機不包括。AGY done22清冊62行，4主候選SHA／連結已核，仍人審待定。Kilo只核metadata：`kilo/nvidia/nemotron-3-ultra-550b-a55b:free`、Kilo Gateway、cost0，尚未推理／測額度。原生Chrome快照被工具因無法可靠判URL停止，無輸入，正常實玩仍BLOCKED。開工350／目前356筆status entries，prod9檔SHA不變；無核實新產品缺陷，後續生產整合依賴人審／裝置，不虛構任務或常駐。

## 2026-10-14 22:xx Codex恢復接任（歷史，10/15已接手）

使用者回報額度恢復，Codex重新獨占協調／roadmap／看板／最終gate，20:11暫行owner過期保留歷史。實查337 dirty；Cursor w5:p9 idle646已交C4 runtime9PASS＋相關48PASS但需獨立驗；AGY w5:p5 idle645已交Stage2過渡候選WAITING_HUMAN；Space w5:p4 idle631 Rate limit session保留不重試。新已驗可用Sonnet4.5 Kiro／OmniRoute為OpenCode w5:pD（初始cwd I:/Projects，QA票明確進本專案），只read-only／新QA檔。不使用其他Kilo pane。Cursor已實派短handoff working661，不能改production；交卷保留舊session後另開同High新session。R17需對現役C4快照核對、藝術仍OPEN；候選不接、音訊及Git凍結。

現行增量：C4共48項（已內含9），root重新48/48與安全719/719（排2音訊suite＋1真音檔hash、圖片hash另驗）；原703保留。Sonnet w5:pD working662獨立QA，production凍結。Cursor舊4f5d66cf…已ctrl+d正常退出且可resume、交接doc落盤，新bd0f346d…同grok-4.7-high啟動UI256K High，working667僅P0晚載Chrome新harness不改production。AGY working668新edge-rework受控一次真圖：原Stage2底邊接wood MAD57.06漏報，原圖片保留、font-tofu預覽待改；不接圖。C3/C4頁級收藏／hint深墨暗底真可讀性FAIL已交Sonnet核，不因field存在就PASS。

其後：AGY done673候選完成，root核頂6.00/底10.0664/LR4.7272、90730bytes/SHA8ba771c1…，仍WAITING_HUMAN不接。Sonnet Node18PASS hashStable，但Chrome14/16後22/8仍setup殘錯，root發現URL強制dev／double ?／未真start，不據此宣產品正常；429自動retry已esc中斷。已spawn獨立Codex `/root/e22_c4_focused_qa`，只新director-e22-c4-focused tests/docs/artifacts承接真Chrome；production固定，CursorP0唯讀、Space不重試。

最新接續：Codex獨立C4有效核心三view24/24，C3 scoped9/9＋3守門補證，重聽pointerdown/up0；僅page收藏/hint深墨暗底manualFAIL。Cursor E22-05 working680最小修card-gallery-ui/index，Root2個contrast RED test唯讀、完成要focused新圖。P0 E22-03 done679，11PASS/1HUMAN、NOT_REPRODUCED，不改renderer，首次floor圖片+400ms非首CPUdraw畫面，仍真機／人審OPEN。桌機正常10min UI嘗試browser chrome不可用（inventory僅MCP Apps），另列WAITING_DEVICE，不能用headless受控hook充正常實玩。

## 2026-10-14 20:11 ChatGPT臨時接任總監｜歷史，22:xx恢復已取代

使用者最新指令：Codex 6.1 Sol 5小時額度用盡，暫停Codex，ChatGPT接手執行總監與其他Agent工作分配。Herdr實查 codex_lead done（終端明示 usage limit、約21:53可再試），space_bunny done（Rate limit exceeded），cursor與agy原先done。**這是目前有效owner與發派狀態，不依賴舊17:04 Codex長期總監歷史指令。**

- [x] ChatGPT直接執行R17 focused正式Node/真Chrome：node --require ./tools/director-audio-freeze.cjs tests/director-c3-focused.acceptance.cjs --frozen；**30 PASS、0 FAIL、3 HUMAN_REVIEW、0 BLOCKED**。Quota/Security storage及三視口的解卡隱私、44CSS熱區、禁止再聽事件0新增呼叫、真play→pause→圖鑑→pause、HUD和world回歸均有實證；test輸出 artifacts/validation/director-r17-c3-storage-20261014/run-2026-10-14T12-12-55-664Z。此驗收只代表該snapshot C3技術gate，仍需使用者觀感/真實裝置驗收，C3不可冒稱全藝術完成。原R17 PREP_READY描述已被真完成覆蓋。R15舊出界/暫停錯setup可依R17精準測試更正。
- [~] Cursor w5:p9（Grok4.7 High，**Fast禁止**）已真正交辦並working：C4完整正式runtime，獨占 js/card-collection.js/card-delivery-bridge.js/card-gallery-model.js/game.js與必要展示JS；將9項Cursor C4 test的8RED、R16 Space12RED轉綠，安全record persisted:false/storageError不回退，真32pack/164word、唯一獎勵、NFC/跨stage/official-dev隔離、舊檔補發、HUD純文字，無新未核准插畫。docs/card-rewards-runtime-20261014.md、artifacts/validation/c4-cursor-20261014；上下文先前73.8%，接近80%需安全交接同Grok模型新會話。
- [~] AGY w5:p5 Gemini3.8 Flash已真正交辦並working：第二關 rain-port 現役石板↔木棧道硬切的**新真圖候選**，只寫 art/r4/handpainted-candidates/stage2-ground-transition-next/**。圖片以原兩邊image-to-image參考小量生成、實際拼接與2D/0.60預覽、人審前不能接runtime，429單次停止；不重繪Stage2已核准Shiome/Ikari四圖。
- [!] Space Bunny w5:p4 額度暫不足，**不再投遞重複會失敗的agent任務**。C4必要Node測試及R17後續驗收暫由ChatGPT用音訊安全guard直接跑；等Space可用時再做真獨立Chrome/差異QA，不提前冒稱獨立PASS。
- [!] Codex w5:p8因usage limit暫停，不指派新票、不推測實際新配額。等恢復才考慮交還管理，ChatGPT現在負責獨占協調與里程碑證據。
- 未完成的Stage1 P0慢網/真機、Stage2石木硬邊視覺、Stage3石階角落/妖怪Boss人審、Stage4–8正式圖、C4 UI人審與真手機/平板測試仍在看板。音訊/TTS/BGM/API/KEY無期限凍結，不讀不改；**禁止Git reset/clean/checkout/commit/push/deploy**。圖片候選技術PASS不等於用戶藝術核准。


## 19:07 QA追蹤／最新現行（取代下方途中快照）

**其後實查增量**：Space R15 done626已交卷，Cursor working627修C3真可讀／mobile有效熱區及storage safety。Space R17 prep working628後回 `Rate limit exceeded`、done631，停止重試；R16 strict/storage斷言部分落盤但未驗完。Codex已實際建立獨立QA `/root/c3_independent_qa`，只新增director R17 tests/docs/artifacts承接，等Cursordone再freeze真Chrome。AGY仍只Stage4 metadata，不生圖。不要以free QA受限停全部production，也不要重派Space耗失敗請求。

**R15證據補正**：目錄12圖≠最後12新圖；最新9張，另3張B-from-pause是19:03歷史錯setup圖，最後G07 BLOCKED根本未再拍B。G06 control29/replay2不證明事件0，game pointerdown早期AUDIO.init已補交Cursor；G03需真正draw scope。詳見r15-director-evidence-errata-20261014.md，以補正優先，不以舊圖偽稱pause已驗。

**現行執行增量**：Cursor done637兩補修完成，root targeted32/32，手機有效熱區已綠；R17獨立Codex已實際正式啟動Chrome＋storage QA、production再次凍結。Cursor working638只新增C4 prep test/docs/artifacts，不能改現役；等R17交卷才GO full C4。AGY done634／人審等待。C3仍NOT_DONE，full regression待新C4 RED→GREEN後，不因原703綠放行。

Herdr實查：Cursor w5:p9 done622；Space Bunny w5:p4 working624正收尾R15 frozen；AGY w5:p5 working625但最新已停止舊Stage2票、收斂Stage4候選，保留已產物；Codex w5:p8協調。R15原23PASS/12FAIL不是12真產品bug：全頁HUD文字與累計Audio、錯viewport bounds/rounded scale、未進pause分別修harness。最新run-full6 32PASS/0FAIL/3HUMAN/3BLOCKED、12圖、production hashes一致；pause未達仍未測，不能宣稱C3完成。Codex真圖仍見進度暗底及mobile滿卡擁擠，C3 **NOT_DONE**，交卷後派Cursor修真缺陷及setItem quota中斷，再Space focused驗。

R16 C4為12RED/2PASS未實作基線，不是C3 FAIL。契約已定 applied:true/persisted:false/storageError、當前bag保留去重、reload只读真已存結果；正式gate須RED/FAIL/BLOCKED全0，不因runner exit0假PASS。最新安全回歸703/703（排除2音訊suite＋1真音訊hash，圖片hash另驗）；NFC/stageIds已修、runtime＋R13重跑28/28。詳見唯一看板及c3-ui-accessibility-review-20261014.md。額度19:07使用者回報35%，未工具驗證。未Commit／Push／Deploy、音訊TTS/API/KEY凍結。

## 2026-10-14 17:04 起 Codex 執行總監／現行 owner

使用者授權 Codex 自主連續調度與最終檢验，取代08:14待命策略。唯一操作狀態見 [執行看板](roadmap-execution-board-20261014.md)；下方為保留的歷史快照，不可拿舊 PASS 覆蓋最新拒收。

| Agent／實查 pane | 現行範圍 | 真實派工證據 |
|---|---|---|
| Codex w5:p8 | 架構、看板／roadmap／handoff／AGENTS、重要 gate | P4.2參考契約與模型已落盤；16純數學＋6viewport=22/22 PASS |
| Cursor w5:p9 | P4.2 viewport/game/renderer、必要index版本與指定tests | Herdr prompt exit0、working seq589；正式runtime進行中 |
| AGY w5:p5 | art/stage4-bamboo-maze、stage5–8契約、新Stage3角落brief | 初派working seq584；候選交接與manifest數值不一致，返核working seq591；不接runtime |
| Space Bunny w5:p4 | 獨立新tests/docs/artifacts，不改production | R13 done seq590；Codex重跑32項31PASS/1FAIL。R14 P4.2 harness準備working seq592，正式Chrome等Cursor交卷freeze |

R13具體缺陷：跨NFC同詞去重丟後續stageIds；相鄰C1存檔NFC碰撞後寫低值會覆蓋高值。Cursor P4.2收尾後修兩項再做C3 UI；不打斷當前runtime、不派重複模型QA。R12 24PASS/0FAIL/3HUMAN與前輪11/86/613/28截圖是歷史基線，不能當新P4.2或美術驗收。

階段增量：P4.2 runtime Cursor seq594交卷，Codex45/45 targeted及7/7實際CTM契約通過；Space seq595獨立R14 frozen真Chrome仍working，harness誤把圖片尺寸除CTM/錯API已診斷，不據偽FAIL改產品。安全回歸671/673，dev query測試已修8/8，剩renderer float32密度對齊待QA交卷後修。Cursor seq601完成未載入C3 UI模組，8/8但尚非遊戲入口。Codex C5長測2/2（70,000抽詞＋1000配送/重載/dev隔離）。AGY seq602規格返核done，seq603小批Stage4唯一IDLE母版候選與C3/C4插畫brief working；候選不接runtime。8788 index實查HTTP200含P4.2版本，8816自測server已結束；不能拿已關閉8816作目前可玩URL。

**現行接續（取代上一段途中狀態）**：Space R14 seq607已DONE，15技術/守門PASS、0產品FAIL、4HUMAN、26真Chrome圖；Codex額外重算bounds12/12。Cursor seq608正式修float32＋R13兩缺陷並接C3真UI；Space seq609僅準備R15，等交卷再freeze。AGY筍童子idle已交（WebP12672bytes/SHA91c2a762…），seq610做最後一張Stage4 Boss idle母版候選，完成整批等人審、不得生attack／接runtime。C3 已載入，交付說明是 `docs/card-gallery-runtime-20261014.md`，不是舊的 staged 檔。C4 契約在 `docs/c4-rewards-runtime-contract-20261014.md`，本輪不接。靜音本機preview已啟動 `http://127.0.0.1:9400/index.html?dev=1&tilt=0.6&zoom=1.10`（選sakura-pass才有zoom）；audio.js為stub、音檔204/0bytes，不讀真音訊；不使用已關閉8816網址。

### C3 公共／私有接口（R15 照這個看，不要猜別名）

公共，掛在 `window`：

- `CARD_GALLERY`：`project(words, source, catalogs)`、`filterCards`、`paginate`、`groupCards`、`replayRequest`、`wordKey`。`STATUS` 仍是 `C3_MODEL_READY_UI_ART_PENDING`。沒有 `show`。
- `CARD_GALLERY_UI`：`visible`、`reduce(cards, state, action, viewport, catalogs)`、`draw(ctx, cards, state, hooks, viewport, catalogs)`、`hit`。`STATUS` 是 `C3_LOADED`。`state` 就是 `{ filter: { by: "all"|"stage"|"pack", id: null|字串 }, page }`。`action.type` 只有 `filter`、`cycle`、`page`、`back`、`close`。`reduce` 回傳的 `close: "pause"` 只表示離開圖鑑，遊戲把它改成 `codexBack`，不是叫玩家進入暫停。
- `CARD_DELIVERY.openCards(storage, location)` 回 `{ key, snapshot, marks, record, choose }`。正式鍵 `yokai-delivery-cards-v1`，dev 鍵 `yokai-delivery-dev-cards-v1`。
- `UI.wordGallery()` 回 `{ catalogs, source: { key, marks }, cards }`。`catalogs.stages` 來自 `Object.values(CONTENT.STAGES)`，`catalogs.packs` 來自 `Object.values(CONTENT.WORD_PACKS)`。`UI.wordGalleryViewport()` 是單字頁用的可視範圍。`UI.codexButtons(tab, page, wordCount, galleryState)` 的第四參就是上面的 `state`。單字頁按鈕 id：`cards`、`words`、`filter-stage`、`filter-pack`、`prev`、`next`、`back`、`replay`。篩選文字在按鈕的 `label`，例如 `關卡：夜行町`、`詞包：動物街`。
- `UI.drawCodex(ctx, STORE, ALL, tab, page, maskReadings, focus, galleryState)`。單字頁不讀 `STORE.box`。

私有，在 `game.js` 閉包裡，沒有掛到 `window`：`codexFilter`、`codexPage`、`codexTab`、`codexBack`、`wordCodexState()`、`applyWordCodex()`、`selectCodex(id)`。篩選的真狀態就是 `codexFilter`，不是 `filterState` 或 `galleryFilter`。

`menuButtons()` 只在選單、暫停、勝負結算、離開確認時有東西。圖鑑進行中它是 `null`，點擊不走這條。暫停裡的「單字圖鑑」id 是 `codex`，「秘術卡片」id 是 `cards`。選單右上角同名按鈕也是這兩個 id。`filter-stage` 不是暫停選單的項目。

`tools/c3-gallery-chrome.cjs` 只在測試 HTTP 注入 `window.__c3QA`，正式 `index.html` 沒有它。欄位是 `open`、`act(id)`、`draw`、`pause`、`elapsed`、`place`、`key`、`audio`、`take`。`act` 回 `{ state, back, tab, page, filter }`，`filter` 就是 `codexFilter`。

鏡頭：`runFrame` 在 `play`／`pause`／`levelup`，以及 `codexBack` 是這三個之一的圖鑑裡，tilt 或 zoom 有變就對玩家做雙軸 `reanchor`。從選單或旅路打開的圖鑑不錨定、不重建世界。玩家坐標、速度、spacing 沒改。

C4 尚未接。真詞包是 32 個 `WORD_PACKS`，不是舊的 21。`CONTENT.STAGES` 是 object，`stage.wordPacks` 是 array。

第一關P0 R11為NOT_REPRODUCED，慢網／首幀與實體設備仍未收斂；第二關石木硬邊待人審；Stage3自由2D石階矩形角落已被使用者拒收。Stage2四張核准妖怪不重生；Stage3神社／古櫻已核准保留，未找到Stage3妖怪核准則不能接。Zoom預設1，1.10／1.15待人審。語音／BGM/TTS/KEY凍結且不讀；未Commit／Push／Deploy，不reset／clean／checkout。額度96%為使用者自述，目標有效使用至約10%，非工具量測。

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


本文件專為多 Agent 協同、跨對話重開、Herdr 調度提供現場狀態。啟動時先讀 [AGENTS.md](../AGENTS.md) 第 0 與第 0A 節、[art-asset-only-standard.md](art-asset-only-standard.md)、[stage-identity-standard.md](stage-identity-standard.md)。若較早段落與這兩節衝突，以這兩節為準。

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

## 2026-10-14 Stage3 水平地板接線完成／獨立QA進行中

Cursor w5:p6 done，完成使用者授權的第三關**地板限定**正式本機接線，三張WebP SHA與AGY候選逐位元相同、第三關才lazyload、worldX每512px以A-H-B鋪設；相關新測試與回歸53/53 PASS，桌機與iPad模擬Chrome多視口截圖已落盤。詳 docs/stage3-ground-integrated-20261014.md。**這不是第三關整關美術完成**：V方向圖只是旋轉預覽、尚BLOCKED；石階單材質在Chrome可見512重複格線待人審；神社/古木/小怪/Boss尚待分別核准。第一關P0和第二關石木硬切不變。

Herdr已真派Space Bunny Free w5:p4進行窄範圍獨立QA（working），限新增docs/r9-spacebunny-stage3-ground-qa-20261014.md及artifacts/validation/spacebunny-r9-stage3-ground-20261014/**，不跑全609，不碰現役音訊，不能冒充真iPad。等它有可復現FAIL/HUMAN_REVIEW再派Cursor修。Codex 6.1 Sol仍待命不燒額度。禁止commit/push/deploy/reset/clean/checkout。

## 2026-10-14 12:00 第三關地板接線授權（實作中）

使用者允許這次地面正式接線；Herdr派Cursor w5:p6（working）進行Stage3 sakura-pass僅三張水平地板圖 world-anchored、lazyload與地面快取、2D/2.5D對照驗證。原AGY圖保留；ART只做bit-identical copy 到新runtime目錄。AGY w5:p5 正收尾過渡美術（working），其H真圖有效接縫差5.25/4.14；V圖是旋轉臨時預覽，縱向接縫35px仍BLOCKED，**不得接正式V**，圖生曾遇429。沒有給第三關小怪/Boss/建築整批美術核准；不偷接別的圖。Cursor交付後再由OpenCode限量獨立QA，Codex Sol待命。其他部署門、音訊凍結和未經授權不commit/push/deploy仍有效。未驗證本機成功前保持[~]。

## 2026-10-14 11:53 Stage3 地板自然過渡返工（最新狀態）

使用者看到art/stage3-sakura-pass/Preview_ground_dirt_vs_steps_seam.png直切明顯，已同意返工。ChatGPT已透過Herdr送出 AGY w5:p5 真正新任務並確認working。AGY唯一owner：新增art/stage3-sakura-pass/candidates/transitions/ 下2–4張由圖像模型生成的真過渡素材 PNG/WebP、接邊契約、水平/垂直/2D/2.5D實際拼排檢查圖及manifest；保留原兩地板與所有其他核准圖，無需Codex介入。新圖仍須用戶目視核准，不能只憑0px邊緣數值當完成；禁止在正式runtime接圖、commit/push/deploy、音訊改動。如AGY遇圖模額度上限應停下明確BLOCKED，不要用程序假圖替代。

## 2026-10-14 10:43 真實進度與待使用者決定事項

四位Agent全部idle。Space Bunny R7 QA 已完成（docs/r7-spacebunny-qa-20261014.md，66項Chrome PASS，9組冷啟動、609/609安全Node回歸、189 screenshots，保留人工審核／地板BLOCKED）；Cursor交付獨立card-collection C1/C2 核心6/6 test PASS，尚未接進遊戲。**Phase2缺陷提醒：現行makeOrder從study.pick先選詞，選不到又直接return，導致brief提議只替換STORE.pick分支會幾乎永遠無效；新函數回傳jp字串而chosenWord使用詞物件，需先更新契約。** AGY完成Stage3六項候選(art/stage3-sakura-pass/Preview_scene_contact_sheet.png)、兩地材質4x4預覽與玩家同尺對照；Stage4只有brief未生圖。全部圖片待使用者審核，特別是山泥路與石階材質互接像素差47.38、是否要專用轉接貼圖；小怪/Boss僅idle母版，attack待核准後從母版延伸。

下一輪技術票：Cursor主修雨港Shiome非mis卡死、Boss fallback別錯畫共通Boss，另對潮波有效182與觸發210差值提出受控修法；貼身共用P.inv是玩法決策先問使用者。再派Space Bunny限量回歸而非重跑全套，Codex繼續待命。第一關P0與第二關石木拼接美術仍BLOCKED；不動已核准怪物，不碰音訊；無commit/push/deploy。

## 2026-10-14 最新實際派工：後續美術／收藏核心／獨立 QA

使用者要求閒置 Agent 並行推進後續關卡的地板、房屋、敵人及 Roadmap，ChatGPT 已核對 Herdr 實際狀態並直接派工：AGY w5:p5 working，唯一新增 art/stage3-sakura-pass/candidates/、art/stage4-bamboo-maze/brief.md（有額度才做），先出 Stage3 六項候選與接縫拼貼真圖／Boss、小妖 idle 母版，全部尚待使用者核准。Cursor w5:p6 working，Grok 4.7 High，**禁止 Fast**，唯一寫入新獨立 card-collection.js、新測試及整合 brief，先完成 C1/C2 純資料核心，**不可碰 Space Bunny 驗收中的既有 production JS**；正式接線需待其 QA 凍結快照完成。Space Bunny w5:p4 仍 working，延續原 Chrome 真場景與地板 P0／Boss 回歸，不重派；Codex w5:p8 done 待命，不燒 6.1 Sol 例行任務。Grok Build 使用者已手動退出面板，不在 Herdr agent 清單中。

AGY 若遇到圖片模型 429、超額或未提供 image generation，先記錄確切狀況且停止重試。ChatGPT 先判斷 Codex 是否具備可用的外部真生圖工具，只有確實能接手才派 Codex；禁止用 Pillow/SVG/Canvas 生成幾何假圖、禁止擅用額外付費服務。所有 Stage3 圖為待審候選，禁止先接入正式關卡。Cursor 的 C1/C2 尚未進正式流程時不可勾 Roadmap 完成。所有人不得讀改音檔/TTS，不得自行 commit、push、deploy、reset、clean、checkout。

## 2026-10-14 08:14 最新指揮與用量政策（覆蓋下方歷史分工）

使用者已手動關閉 Grok Build 面板。Herdr 本輪確認 Codex（codex_lead w5:p8）待命、Cursor w5:p6 idle、AGY w5:p5 idle、Space Bunny w5:p4 **working**；Grok Build 不在清單中，Kilo 已退出。Pane ID 是當時現場資訊，未來須重新 list。

**ChatGPT 直接負責一般需求思考、任務切分、工具派工、進度追蹤和小型交接**；Codex 6.1 Sol **僅**重大架構、跨模組契約、疑難整合與最終放行才啟動；Cursor（Grok 4.7／Composer）主實作修復；AGY（Gemini 3.8 Flash）獨立模組／邊界定位／美術；OpenCode Space Bunny Free 獨立核心 QA／Chrome 真畫面與回歸。

**額度策略變更**：舊版「Codex 儘量用到只剩 10%」已作廢。依使用者回報 2026-10-14 08:14 Codex 五小時額度剩約 70%、12:22 重置；以節省高階模型用量、避免重複工作為優先，不為額度消耗而派事。Space Bunny 正在驗收第二關，未報具體 FAIL 前不讓 Cursor 盲修；Codex 不重跑同一組 QA。

現行地板兩關仍有 BLOCKED，TTS 與音訊凍結；使用者核准的第二關妖怪四圖與實作保留。禁止自行 commit、push、deploy、reset、clean、checkout。以下歷史段若有矛盾，以此節與根目錄 AGENTS.md 最新規則為準。

## 2026-10-14 最新協調：Space Bunny 接替 Kilo／Nemotron，獨立 QA 進行中

Herdr 實查：`space_bunny` w5:p4 **working**（seq456）；Kilo／Nemotron 已退出，不再派工。使用者已直接交辦 Space Bunny QA，Codex 本輪不重派或新增重複測試／重繪。工作四人加一位儲備如下；pane 仍須每次操作前查 list。

| Agent | 本輪實查狀態 | 責任／可寫範圍 |
|---|---|---|
| Codex `codex_lead` w5:p8 | working（本輪協調） | 本檔頂部、`roadmap.md` 活躍協調欄；排序阻塞，核對後續 QA，不碰 production／圖片／Space Bunny 檔案 |
| Cursor w5:p6 | idle | production owner；收到具體 FAIL 的重現／證據後才派修，不與 QA 同改檔 |
| AGY w5:p5 | idle | 圖片 owner；核准妖怪四圖保留，不重繪或生成 round2 |
| OpenCode `space_bunny` w5:p4 | **working，未完成** | 已派獨立 QA：只新增 `docs/r7-spacebunny-qa-20261014.md`、`artifacts/validation/spacebunny-r7-20261014/**`；必要時新 `tests/spacebunny-stage2-independent.acceptance.cjs`。模型由使用者回報終端已確認 Space Bunny Free Personal／OpenCode max，非額度工具查證 |
| Grok Build（首查 w5:p1） | 首查 idle；末次 list 未列出 | 僅保留儲備角色、未收到新任務；不推定目前 pane 或狀態，除非使用者明確指定，不交辦 |

1. **既有成果只是前輪基線：** 妖怪契約 11/11、Codex targeted 86/86、guarded 回歸 613/613（排除 1 真音檔 hash）、Chrome 28 張截圖；不能冒充 Space Bunny 新驗收或整關美術完成。
2. **下一步優先順序：** 第一關 P0 冷啟動／切鏡／2D–2.5D 拼接與人工畫面驗收仍 OPEN；第二關石木硬邊、橫縱交界／區塊交界仍 BLOCKED；接著整關視覺核准與跨實體設備。未有具體 QA FAIL 前只整理此清單，不新增 production 修復、重複 QA 或重繪。
3. **接報門檻：** 等 Space Bunny 明確 FAIL／PASS／HUMAN_REVIEW 矩陣與截圖／重現證據，再按單一 owner 派 Cursor 最小修復。末查仍 working，指定 QA 報告尚未落盤；不標 Done 或推定無 bug，不搶改其報告／測試。
4. **凍結不變：** 音檔、TTS、API KEY 保留不讀不用；沒有 commit／push／deploy／reset／clean／checkout。地板與第一關 P0 美術仍未解決，部署門仍【BLOCKED】。

## 2026-10-14 前輪記錄：rework 四張妖怪正式接線／本機工程驗收通過

使用者明確核准外部 Antigravity 生成的 `stage2-enemies/rework/` 四張 WebP，**取代下方初輪「妖怪待人審／禁止接遊戲」的特定閘門**。原版不一致圖仍拒收；地板、跨設備與整關部署門未解除。

1. **AGY 已真派工並完成圖片落盤。** Codex 經 Herdr `send-keys esc` 取消舊工作，再送最高優先停止重繪指令；AGY 已 done。四張核准 WebP 原樣複製到 `assets/img/rain-port/enemies/`，保留來源與 PNG。manifest：`assets/img/rain-port/enemies/runtime-manifest-20261014.json`。Shiome 畫布 250×220／runtime 錨點 (125,205)；Ikari 350×330／(175,320)，x 中心是定位契約。禁止任何 round2、生成、重繪或二次美術核准。
2. **Cursor 正式接線完成，Herdr done seq452；AGY done seq445。** 已保存 `artifacts/validation/codex-lead-20261014-cursor/floor-handoff.md`；這次敵人局部接線在 `js/assets.js`（獨立 `PORT_ENEMIES` loader）、`js/game.js`（普通波次 17% Shiome、0.62s 預告／短距離鎖向潮波／一次 8 油傷害／2.4s 冷卻、雨港終王 `umibozu` 與 tide pose）、`js/renderer.js`（錨點／兩姿態／shield idle／共用原封印圈）與 `service-worker.js` 四圖 revision。第一關走原圖／原 spawn；未修改 Boss AI、world 或 fx 來湊檔。AGY 唯一圖片 owner；Cursor 保持原模型／會話並完成 context compact。多餘 `?stage2shot=1` 手造敵人展示分支已移除，11 項與 syntax 通過；收尾 `stage2-close-handoff.md`。正式 QA 使用 HTTP-only hook 的真正 wave／Boss scheduler，不採手造實體。
3. **Codex 獨立 QA/TDD。** 唯一新測試 owner：`tests/stage2-approved-enemies.test.cjs`；QA 工具與證據 `artifacts/validation/codex-stage2-enemies-20261014/`。歷史 RED 7 項 1 pass／6 fail，已修至新契約 11 項 PASS；相關 targeted **86/86 PASS**，整體回歸 **613/613 PASS**（明確排除會讀真音檔的 1 個全媒體 hash 項，Node reported skip 0；另核對 188 張圖片 hash 全相符），均 exit 0。Chrome 桌機 1280×800／iPad 寬度 1024×768，各 2D／2.5D 共 4 組 PASS、28 張最終截圖；已人工看代表圖並驗變換後角色 bounds 在畫布內。證據與命令見 `QA.md`、`targeted-final-11.log`、`regression-final-11.log`、`chrome-evidence-final.json`。不是實體 iPad 或自然十分鐘通關；BGM／語音只 stub 驗呼叫，不驗發聲。
4. **接線必守：** 只影響 rain-port；小怪真正一般 spawn、短距離可躲潮波、穩定 attack hold；港町終王用專屬兩姿態與 tide 同步，封印解開才戰鬥，保留兩層封印、BGM 流程、答題、掉寶與十分鐘玩法；Chrome 桌機／iPad 寬度、2D／2.5D 逐項驗證，測試 hook 明示，不能聲稱 iPad 真機或自然通關。
5. **地板仍 BLOCKED。** Cursor 確認舊 compat 輪帶回接直切、垂直過渡未畫及 shore 布局被取代，保留 var1 安全路徑；石木交界硬切、風格仍待核准。Grok 凍結、Kilo 未派工；API KEY 未讀未用，無 TTS／API 呼叫或音訊修改。調度疏漏保留：Cursor 首次接線期間曾跑全媒體 hash 測試而間接讀音檔；Codex 已禁止重跑，後續 guarded QA 無真音檔讀取。沒有跑全媒體 builder。禁止 Commit／Push／Deploy、reset／clean／checkout。

本機預覽已啟動且 HTTP 200：`http://127.0.0.1:9144/index.html`（靜音、正常解鎖流程、無時間／生成 hook）。重啟命令 `node tools/qa-stage2-enemies.cjs --serve --port=9144`。最終預覽圖：`final-visible-desktop-25d-shiome-attack.png`、`final-visible-desktop-25d-boss-tide-active.png`、`final-visible-ipad-width-2d-boss-sealed.png`。初輪 `chrome-evidence.json` 因 QA 鏡頭錯誤已 INVALIDATED，原圖與日志保留，不能引用為可見證據。

## 2026-10-14 初輪歷史：Codex 正式接管（已被上節角色核准更新）

本節依使用者最新指令取代下方歷史 Grok 文件獨占／音訊派工；保留歷史，不代表美術核准或部署放行。

| 負責者 | 已執行與狀態證據 | 本輪檔案獨占／限制 |
|---|---|---|
| Codex `codex_lead` | Herdr 現場 w5:p8；接管 Grok 協調、重點 QA、交接維護 | 本檔、`roadmap.md`、`AGENTS.md` 協調欄；新增本輪 QA 證據，不搶 AGY 圖片或 Cursor 程式 |
| AGY | `herdr agent prompt w5:p5` 已送出，exit 0；Herdr 確認 working，state_change_seq 435 | `art/r4/handpainted-candidates/stage2-enemies/rework/` 新增返工／證據；地板 `stage2-refine/compat/` 與新 `assets/img/rain-port/compat-20261014/` 圖片。保留既有圖；不得改 js／tests／規範／音訊 |
| Cursor | `herdr agent prompt w5:p6` 已送出，exit 0；Herdr 確認 working，state_change_seq 436 | `js/renderer.js`、`js/assets.js` 地板局部接線；確有必要才改 `index.html` 並說明；新增 `artifacts/validation/codex-lead-20261014-cursor/`。不寫圖片、tests、規範或音訊 |
| Grok Build | w5:p1 idle；**本輪凍結，未派新任務** | 除非使用者明確指定，不再交辦 |
| Kilo | w5:p4 idle；本輪未派工 | 曾多次 upstream idle timeout，不依賴長任務；必要時只派短時間、限範圍 QA |

1. **妖怪第一優先 `[~]`／待人審。** 原四圖已逐張查看：Shiome 圓水滴頭／無足水尾／網衣與紙燈，attack 改成尖焰髮、不同臉與裝束；Boss attack 改成獠牙口，面罩、胸腹紋理、繩鏈與錨配置不同。已要求 AGY 各自以一張母版唯一延伸，參考圖／img2img／一致性編輯；只少量返工，圖模 429 即 BLOCKED。未核准圖不得接遊戲。
2. **現場差異須追溯。** 派工前已存在 `rework/README.md`、`rework_metadata.json`（自記 created_at `2026-10-14T07:22:00Z`）、四款 PNG/WebP 與比較圖；不能歸為本輪新生成。現有報告宣稱「100% 一致／零跳動」不足以放行：缺母版 hash／生成參考關係／明確 x-y 錨點，且部分動作描述與圖不符。AGY 須補來源與本輪檢核；若要再做只新增 `rework/round2/`，不覆蓋。兩組前後比較與玩家同尺圖須供人審。
3. **地板第二優先 `[~]`／待人審。** compat 路徑 `art/r4/handpainted-candidates/stage2-refine/compat/` 已存在；原 var1 安全回退解大縫、石木硬切為使用者回報。接手源檔已含 compat 載入鍵與過渡分支，不假稱尚未接線或本輪新增。預覽有規律重複／邊緣疊影待檢查；cross-edge 約 2–3 不等於美術合格。Cursor 先審真圖與風格，AGY 獨占新增 runtime 圖，完成確認後才接線；FAIL 時保留安全路徑。須 Chrome 連續截圖與 stage1 P0 冷啟動，逐項 PASS／FAIL／HUMAN_REVIEW；手機 viewport 不等於實體跨設備。
4. **音訊凍結。** 三組 Gemini Aoede／Leda 試音日語重音經使用者判定有問題；164 詞整包無期限延後。現役音訊、腳本與 API KEY 保留，不讀、不使用、不修改；BGM 不生成、不替換。
5. **額度與發佈。** 能力同樣適合時先用本期 Codex 到約剩 10% 再換其他付費 Agent，接近重置日優先即將到期額度，不為消耗而造任務。Grok 約剩 20%、Codex 已重置及上期約 65% 未用完僅使用者自述，未工具查證；查不到由使用者回報。部署門仍【BLOCKED】，**未 Commit／未 Push／未 Deploy**。

既有待審預覽：`rework/shiome_idle_vs_attack.png`、`rework/ikari_umibozu_idle_vs_attack.png`、`rework/stage2_rework_scale_comparison.png`（以上相對妖怪候選目錄）；地板 `stage2-refine/compat/tiled_preview_4x4_harbor_compat.webp`。目前是既有候選，非本輪完成或使用者核准。

**Codex 初輪獨立 QA：** 既有返工 8 檔尺寸／hash／bytes 與 metadata 相符、真 alpha（8/8 技術 PASS）；四組 PNG/WebP 的 alpha 與可見 RGB 一致。全透明像素中的 RGB 差異不影響可見轉檔結果。角色一致性與動作錨點仍 HUMAN_REVIEW。`node --check js/renderer.js`、`node --check js/assets.js`、三份協調文件 `git diff --check` 均 exit 0；這是當下靜態快照，不是 Cursor 完工驗收。本輪未跑程式回歸，Chrome／P0 尚未交回。證據：`artifacts/validation/codex-lead-20261014/sprite-technical-check.json`、`static-check.log`、`agent-state-before-cursor-note.json`。

---

## 0. 2026-10-13 使用者硬性命令（最高優先）

此節取代同日較早的「R4 READY」、第 3.3 節「本輪僅需求落盤、嚴禁實作」，以及「測試通過即可視為美術完成」。

### 0.1 禁令

- 使用者拒收截圖中的程序白色幾何房子與拼接地板。
- 正式可見的房屋、路面、道具、招牌底板、裝飾、UI 藝術主體、缺料替代物，禁止再用 Canvas／SVG／HTML／CSS 的矩形、多邊形、線條或形狀。
- 禁止 Pillow、JS、SVG 畫假手繪。程式只許 `drawImage`、裁切、縮放、壓縮、投影、2.5D、分層、碰撞、文字，以及雨水／火花粒子、不可見 debug 框。
- 缺圖時禁止色塊 fallback。
- 19/19、603/603、88/88、檔案大小都不是美術合格。R4 程序幾何版作廢，禁止再標 READY。
- 畫風：半水墨＋半浮世繪＋強墨線＋和紙木版質感，精細度對齊第一關町屋雛形。
- 不確定的需求、素材來源、破壞性替換：上報 `【BLOCKED: 精確問題／替代方案／建議】` 後停止該部分。
- 保護 dirty worktree。禁止 `git reset`、`git clean`、`git checkout`。
- **部署門現況 BLOCKED。** 第一關地板拼接修好且 2D／2.5D 冷啟動跨設備驗證、第二關整組手繪美術經使用者核准並接入並移除幾何假美術、第二關至少 1 個手繪小怪（不同追擊或攻擊）與 1 個手繪專屬 Boss（獨立技能／潮汐）已接入 game／assets／renderer／AI 且自動與視覺驗收通過、QA 程式回歸與畫面審核 PASS。四項都完成才允許 commit、push、deploy。方案、名稱、`bossTheme`、換血量不算。沒有造型核准前禁止批量生圖。測試全綠不能提前。未過門即停。到時由 ChatGPT 協調發佈。細則見 [stage-identity-standard.md](stage-identity-standard.md) 第 6 節。

四款已認可參考（港口倉庫、魚舖、濕石磚、濕木棧道）的實體路徑尚未落盤。`art/r4/handpainted-candidates/` 為空，倉庫沒有魚舖檔。詳見標準檔第 5 節的兩則 BLOCKED。確認前禁止覆蓋 `assets/` 與 `art/r4/`。

另立缺陷：第一關地板在初載與切鏡後會有數秒拼接不正常，其後才恢復。這是新的 P0，與已完成的「P0 傾角決策」不同。驗收看連續畫面。這項同時是部署門的第一條，現在未過。

### 0.1A 即將安排，尚未做

下列兩項是後續內容，不是已完成。是否在某一輪完整新增，看使用者的美術核准與資源。

- **第二關新敵人與專屬 Boss（完成條件是實作加驗收，不是有方案即可部署）。** 至少 1 個正式新增手繪小怪 sprite 與不同追擊或攻擊，以及 1 個手繪專屬 Boss sprite 與其獨立技能／潮汐，接入 game、assets、renderer、AI，並通過自動與視覺驗收，第二關才算完成。`js/words.js` 的 `bossTheme: "harbor"` 只影響稱號後備字。`js/renderer.js` 所有 Boss 仍畫 `window.ART.boss`。`js/boss-ai.js` 的 tide 只加在 `rain-port` 終王，沒有專屬圖。現況【BLOCKED】：沒有使用者核准的造型，禁止批量生圖。少量共通怪可以留。
- **每關獨立 BGM，待使用者交付。** 每關保留獨立槽、狀態待選。Agent 不准生成、不准替換 `assets/audio/BGM.mp3`、`MAP.mp3`、`BOSS.mp3`。現役是這三條全域曲，只作暫播；終王破封才混到 `BOSS.mp3`。同曲暫播不符合最終驗收。使用者未交檔前，部署紀錄要寫「配樂待使用者交付」。交檔後才接入該 `stageId` 槽。細節在標準檔第 4 節。

### 0.2 本輪四人檔案獨占

現場四人以當下 `herdr agent list` 為準，禁止沿用舊 paneID。歷史上的 Codex 協調角色見第 1 節；本輪規範不由 Codex 寫，也不必等 Codex 重啟。派工由 ChatGPT 經 Herdr。

| 誰 | 本輪可寫 | 禁止 |
|---|---|---|
| **Grok Build** | 規範唯一寫入者：`AGENTS.md`、`docs/agent-handoff.md`、`roadmap.md`、`docs/art-asset-only-standard.md`、`docs/stage-identity-standard.md` | `js/`、`tests/`、`assets/`、`index.html`，以及任何他人正在改的檔。部署門未過時不得 commit／push／deploy |
| **Cursor** | 真圖已有路徑且當輪另行授權之後，才可在 `js/`、`index.html` 做 `drawImage` 置圖、投影、分層、碰撞、文字。不得與他人同時改同一檔 | 規範文件、`tests/`、用幾何形狀補美術或敵人、色塊 fallback、未獲點名就覆蓋 `assets/`、自行配樂 |
| **AGY** | 使用者核准造型之後，才可做真正的手繪 PNG／WebP。路徑未確認前只許另存新檔，建議 `art/r4/handpainted-approved/`。敵人與 Boss 同樣要手繪，禁止程序幾何 | `js/`、規範文件、`tests/`、Pillow／JS／SVG 假手繪、覆蓋既有 dirty 圖、生成或替換 BGM、未核准造型就批量生圖 |
| **OpenCode** | `tests/`、`tools/r6-*`、`docs/r6-*` | 把測試通過寫成美術合格或部署許可；為了美術去改 `js/`、`assets/` 或規範文件 |

交叉規則：一人一個檔。服務失敗要換人時，先在交接裡寫原因，再動被授權的檔。

## 1. 現場四 Agent 角色分工 (Herdr Roles)

各 Agent 具備明確專業職責，**「先切分檔案責任再動工，不搞能力競賽」**：

| Agent | 核心職責 | 檔案與邊界規範 |
|---|---|---|
| **Codex** | 決策／協調／系統架構整合／最終驗收放行 | 負責跨模組規劃、契約審定，只進行重要決策指派與整合，並負責最終驗收放行。 |
| **Cursor** | 主實作（Primary Implementation） | 負責核心業務邏輯、演算法與系統主力開發。 |
| **AGY (Antigravity)** | 獨立模組／邊界控管／圖片優先 | 負責邊界模組隔離實作、素材處理、UI/視覺管線（圖片優先；若 AGY 圖片失敗，由 Cursor Grok 或 Codex 候補），以及主實作遇阻時之模組備援。 |
| **OpenCode (OC)** | 獨立測試／自動化驗收與守門 | 獨占驗收測試腳本、端對端 Headless 驗證、守護既有斷言與回歸測試。 |

> **協作準則**：現場所有 Agent 必須透過 Herdr 統一調度，嚴禁使用未註冊的合成替身。任何任務開始前，必須先在討論中明確宣告各自獨占之檔案與修改範圍，禁止多人同時修改同一檔案造成衝突。若因服務失敗啟用備援須明確說明原因，其他選模有變化亦須說明理由。

---

## 2. 模型選用與工具運作規範

### 2.1 Cursor 選模與參數
- **簡易任務（Simple）**：使用 `composer-2.5`。
- **複雜任務（Complex）**：使用 `grok-4.7`。
- **2026-10-13 最新指示（Fast 模式關閉與啟動步驟）**：
  - 若使用 `composer-2.5`，**必須關閉 Fast 模式**。
  - **投遞順序規範**：必須先啟動進入 CLI/pane（可用 `cursor-agent --model composer-2.5` 先啟動進入）、在介面實際核對並確認關閉 Fast 後，**再投遞任務內容**；嚴禁直接使用帶有完整任務提示詞的一行命令啟動後才查 Fast，以免在檢查前已預先以 Fast 模式開始推理。
  - **禁止捏造未確認參數**：不得捏造未經確認的 CLI 參數（如未核對的 `--fast=false` 等），維持原生 CLI 指令並於進入後在介面實際核對。
- **服務異常備援**：本輪 Cursor 曾遇 `ServiceUnavailable` 暫時異常，由 AGY 依授權暫代實作；此為暫時備援措施，下一輪接手不假定 Cursor 依然不可用。

### 2.2 OpenCode (OC) 選模
- 當次由 `Space` 切換至 `Muse` 係基於工具修復與代碼理解品質考量，**此為特定情境調整，非永久預設**。後續任務依實際表現與需求彈性選配。

### 2.3 Herdr 調度與生命週期
- 開啟新對話時，請透過 `herdr agent list` 完整命令重新動態發現與綁定 Agent，**嚴禁硬編碼或依賴舊對話的 paneID**。
- Herdr 指派任務後，**等待 Agent 達到 `idle` 或 `blocked` 狀態**再正式讀取結果，避免中途搶讀不完整狀態。

---

## 3. 當前專案工程現況（Current Baseline）

### 3.1 已達成狀態
- **P8 放行（僅手感歷史紀錄）**：偽 2.5D 手感曾經使用者試玩確認。2026-10-13 起，這項放行不能把程序幾何房子、拼接地板或 R4 READY 說成美術合格。
- **B1–B4 已完工**：
  - 8 關 164 詞庫（全假名詞空漢字契約，盤點於 [docs/season-one-content.md](season-one-content.md)）。
  - 39 筆既有實體 MP3 錄音 100% 重用，125 筆缺詞由 Web Speech API (TTS Fallback) 降級接管。
  - 3 章短劇台詞、BossTitle、戰鬥與故事浮字無阻斷接入。
  - Overworld 後 6 關解封（`enterable: true`），17 節點 16 道路保持原樣，解鎖鏈守門正常。
- **完整驗收證據**：
  - 全套 Node 回歸測試：**603/603 PASS**（0 fail, 0 skip）。
  - Chrome Headless 全 8 關驗收：**88/88 PASS**（8 真 won、16 反向 play、8 STORE reload 一致、11 地圖入口無例外）。
  - 校準用 known-good 2 關測試通過 33/33，selftest 檢測器確認真錯 exit 1。

### 3.2 待辦與限制（尚未完成項）
- **R 階段需求落盤（R1–R6，全項 [ ] 未開始）**：
  - **R1 新單字正式語音包與單字圖補齊**：盤點 164 詞與 39 現有錄音／125 TTS 缺口（現有 B2 僅完成盤點與 fallback，非正式資源齊備）。AGY Gemini 主責音圖，失敗 Cursor Grok-4.7 替補，最後 Codex；先識別現有 39 聲音來源／voice／語言／速度與聽感，校驗日語讀音、音量與前後靜音（未知來源不承諾完全同 voice）；逐詞音圖映射清單，抽象詞情境圖，生成正式資源＋fallback 回歸。
  - **R2 平板音樂解鎖**：首次觸碰開始／選關等 user gesture 同次啟動 BGM，不要求進遊戲再點一次；核對載入中點擊、背景回來、旋轉、首次啟動／重載邊界；gamepad 輪詢不保證 user activation；記錄待真機核對，不承諾所有平板行為完全相同（技術依據：MDN Autoplay Guide）。
  - **R3 Xbox 藍牙手把平板震動**：相容性驗證與調整（非新功能）；記錄平板 OS、瀏覽器、手把型號、連線方式；檢查真實 actuator、實體雙馬達、開關與斷線重連、暫停／背景清理；不能拿 navigator.vibrate 機身震動當手把成功；未經實測不得聲稱 iPad/Safari 或 Android/Chrome 已實測通過（技術依據：MDN GamepadHapticActuator playEffect API）。
  - **R4 第二關 rain-port（使用者明確拒收，程序幾何版作廢）**：不得再標 READY。截圖中的白色幾何房子與拼接地板拒收。須按 [art-asset-only-standard.md](art-asset-only-standard.md) 重製真正手繪圖。四款參考（港口倉庫、魚舖、濕石磚、濕木棧道）路徑未落盤，禁止覆蓋既有圖。19/19 與 603/603 不是美術合格。雨滴仍須自然、不預烘傾斜、並守手機容量；這些程式要求不推翻美術拒收。
  - **R5 符咒 boom／陰陽符改版**：獨立發射與爆炸音效；單向命中黏貼目標移動，延遲 1.5s 或 2s 爆炸（待試玩定案）；被貼目標全傷，周邊小怪 20% AoE 傷害＋震退；避免全傷目標重複濺射或單符重複爆炸；契約需定案目標死亡／離場、Boss 盾／抗性、多符疊爆、暫停結算清理；Lv1–Lv5/MAX 數值平衡兼顧實用性，參數不擅自寫定案；傷害／震退／音效／震動事件與跨技能回歸。
  - **R6 獨立驗收**：OpenCode 先確認實際測試目標，腳本先在 known-good 校準再跑新測，不信作者 PASS；R1 逐詞真檔載入發聲／音圖語意，R4 截圖自然雨＋碼頭＋跨關保護，R5 延遲／命中／20% AoE／震退／單次爆炸與多目標邊界，R2/R3 平板與 Xbox 標記未測直到真實設備；結合 P7 硬體數據與 B5 自然 10min 平衡。
- **既有驗收數據定位**：既有全套 Node 603/603 與 Chrome 88/88 僅為前一版本 baseline 證據，不可作為 R 新需求之驗收。
- **P7 待補**：桌機與行動實體裝置（FPS/P95/RAM/溫度）硬體數據尚未量測。
- **TTS 實體發聲待測**：125 筆 TTS 在實體手機環境之發聲品質與相容性待 P7 實聽。
- **B5 自然平衡待測**：yomi 164 詞池與錯題優先機制已於測試驗證，但全 8 關約 10 分鐘的自然戰鬥 pacing 仍待真人實機調優。

### 3.3 當前操作限制（重要）

- **2026-10-13 覆寫**：下面兩點「只做需求落盤、嚴禁實作」與「等 Codex 重啟再派工」是較早狀態。現在以第 0 節為準。Grok 本輪只寫規範。其他三人可做第 0.2 表內、且不重疊、不碰到兩則 BLOCKED 的工作。禁止 commit／push／deploy。
- **歷史任務狀態（已被第 0 節覆寫）**：當時僅進行需求落盤，嚴禁實作代碼、生成素材、執行測試或提交發布。
- **歷史指派（已被第 0.2 節覆寫，不要照這段再開工）**：使用者曾寫「重啟後由 Codex 統籌」。本輪檔案獨占以第 0.2 節為準：

  - **Cursor**：統一負責核心邏輯接入與 `js/game.js`（複雜任務使用 `grok-4.7`；簡易任務使用 `composer-2.5` 且必須確認 Fast 關閉、先開空 CLI 核對再投遞任務）。
  - **AGY (Gemini)**：獨占新音圖資產與清單（語音/圖片優先；若 AGY 圖片/音訊生成失敗，由 Cursor Grok-4.7 替補，最後由 Codex 候補）。
  - **OpenCode (OC)**：獨占 `tests/` 與獨立驗收腳本（腳本先在 known-good 校準再跑新測，不輕信作者自稱 PASS）。
  - **Codex**：負責契約審定、重要決策指派、架構整合與最終驗收放行。
  - **交叉檔案原則**：動工前必須先切分檔案所有權，嚴禁多人並行修改同一檔案。每次重新查詢現場 paneID；使用者只需將需求交給 Codex，由 Codex 統一指派四 Agent，無需使用者逐一交代。
- **嚴禁擅自啟動 C/D**：言靈圖鑑（C1–C5）與發行（D1–D3）保留既有企劃，尚未獲得明確授權前，**嚴禁自行推進或實作**。
- **嚴禁重做完工項**：不得任意改動或重構已驗收通過之 B1–B4 代碼與資產。
- **Freeze 與授權邊界**：嚴格維持未 Commit、Push、Deploy 邊界；但 `sourcefreeze` 僅為舊驗收基準，不得以此永久阻止重啟後獲得授權的 R 任務開發。

---

## 4. Git 工作樹、基準與校準環境

1. **Git HEAD 與 Working Tree 狀態**
   - 歷史 Git 提交（如 HEAD `796516...`）僅代表歷史上的驗收錨點。
   - 每次接手時，**必須以 `git status` 與 `git diff` 核對工作樹變更**。
   - **嚴禁因工作樹與歷史 HEAD hash 不符而擅自 `git checkout` 回退使用者的修改**！
   - 目前的 `sourcefreeze` 係為鎖定上一輪驗收成果之基準，而非永久禁止後續授權開發；新任務或明確問題回報可依既有授權直接定位修復，不需要反覆詢問批准。

2. **校準輸入（Calibration Inputs）與持久化備援**
   - 專案驗收工具 `--calib` 預設讀取 `$env:TEMP/yokai-b-20261013/calib-known-good` 中的 4 個基準輸入。
   - **Root Repo Durable 備份**：Root 已於倉庫完成持久化備份，包含兩個受保護 JSON（`protected-before-p.json`、`protected-before-b.json`）及 `known-good-p-before-b/` 目錄下的 4 個基準檔案（`game.js`、`ui.js`、`index.html`、`words.js`），各檔案 SHA-256 逐一相符並由 [backup-provenance.json](../artifacts/validation/agent-handoff/backup-provenance.json) 記錄產銷履歷；此處僅作歷史參考與復原備援，非新版全 dirty 列表。
   - **校準快照定位**：該舊 P 快照**僅供當輪驗收工具作歷史正確的 2 關校準輸入使用**，絕不替代新任務建立當前 8 關的程式基線。
   - 若 `%TEMP%` 遺失，請依 repo 備份將該 4 個校準檔案還原至工具期待之目錄（`$env:TEMP/yokai-b-20261013/calib-known-good`），**嚴禁回退 working tree、嚴禁修改驗收工具之期待 SHA、嚴禁將舊版 HEAD 的 game.js 誤當作 P 階段後的正確版**。

3. **本機預覽與伺服器**
   - 預覽伺服器請執行 `node tools/serve-tilt.cjs` 於本機 `http://127.0.0.1:8788` 啟動。
   - 本機伺服器僅供開發預覽，**無部署行為**。

---

## 5. 正式驗證報告與依據索引

接手者如需查閱各階段驗收依據，請參照下列相對路徑檔案：
- 總體專案規劃與進度日誌：[roadmap.md](../roadmap.md)
- 第一季八關 164 詞庫盤點表：[docs/season-one-content.md](season-one-content.md)
- B 階段凍結交付成果：[artifacts/validation/b-stage/final-frozen/](../artifacts/validation/b-stage/final-frozen/)
- B 階段 Root 整合驗收成果：[artifacts/validation/b-stage-root-integration.json](../artifacts/validation/b-stage-root-integration.json)
- P6 Canvas 偽 2.5D 自動化驗證定稿：[artifacts/validation/hd25d-integration/evidence/oc-seq126-final-verification.md](../artifacts/validation/hd25d-integration/evidence/oc-seq126-final-verification.md)
- 接手與校準備援目錄（由 Root 提供）：[artifacts/validation/agent-handoff/](../artifacts/validation/agent-handoff/)
