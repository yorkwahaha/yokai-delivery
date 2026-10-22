# 妖怪快遞社｜官方製作計畫

### 2026-10-22｜S2新地表本機DEV候選已收／可開真頁，無縫未過

p2原票及計數最小退修後正式停寫，Herdr completion seq325。新gate `dev=1&stage=rain-port&s2ground=kit` 已接assets／renderer，4石／3木世界座標穩定混鋪，v01按實圖作橫界，h/c無合法位置不硬鋪。10圖全解碼／manifest SHA相符，31.72MiB冷載，原PNG／manifest及game／world／ui／index均不變。14張真混鋪／方向診斷與7張真頁PNG可開；有2D／.60、石木交界、真左右位移+368／−230、Canvas source證據、四負向頁0新圖request。該視野僅實見4石／wood02／03／v，wood01載入未觀察到；不以pick或loaded冒充draw。

收 **DEV_INTEGRATION_TECH_PASS_SCOPED**；root獨立8/8專測、真gate7案、真selector及tileImage非空繪製反例通過。接縫與重複 **TECH_QA_FAIL／WAITING_USER_REVIEW**，不ART_PASS、不投產、不代表自然局／實機／ABC整體通過。正式推薦URL **http://127.0.0.1:8895/index.html?dev=1&stage=rain-port&s2ground=kit**，rootHTTP200／listener PID52420且帶audio-freeze；舊8893 listener停止重啟命令被自動審核拒絕未執行，改新guarded端口、不藉Agent繞過。啟動命令、完整SHA／原圖保護與[收件證據](../scratch/s2-ground-kit/integrate-r1/SUMMARY.md)見[roadmap頂部](../roadmap.md)。無付費／生圖／Git發布，凍結區與dirty保留，Codex文件檢查後停寫。

### 2026-10-22｜S2真十圖已核／新DEV-only接入票真執行中

來源阻塞解除：root完整解碼`art/s2/`十張1254² RGB、逐筆SHA對manifest吻合，共31.72MiB；保留原manifest與候選未無縫狀態。舊preview／edge-qa stub不能算成果。空閒p2 MiniMax Free已接 **ART-S2DEV-INTEGRATE-R1 working seq294**，獨占assets／renderer、原preview工具、自身新test與scratch；p5工具ownership交回p2，p4不喚醒，game／world／ui／index保持凍結。只新`dev=1&stage=rain-port&s2ground=kit`可讀新4石／3木／3過渡，舊gate不混圖、無gate零新圖請求。

要求真CLI混鋪／接縫診斷及音訊阻斷Chrome兩鏡頭／短走動／network與drawImage證據、真可用listener URL；接縫可TECH_QA_FAIL但不自動ART_PASS，不改原圖／人審狀態／正式assets。**目前派工已確認，接線／preview／真頁仍待收件**；精確SHA與界線見[roadmap頂部](../roadmap.md)。無付費／生圖／Git發布，凍結區與dirty保護。

### 2026-10-22｜配送補正結清／受控技術範圍通過

08補正及新verifier／log SHA已由root核實，舊4f710d14 runtime確為GREEN／exit0，先前RED exit1敘述撤回；新結果是**歷史量測檔重評**的舊檔FAIL／exit1、最終檔PASS／exit0，root已guarded重跑並另核兩檔各20完成列，不冒稱重跑舊runtime。logs/02／06無exit marker，FINAL需與作者4/4、35/35及root前輪獨立4/4共同引用；原raw／07保留，以08與SUMMARY更正為準。game91f01255／world91aaca4b／test bf952a63均未變，收 **CONTROLLED_RUNTIME_PASS_SCOPED／EVIDENCE_CORRECTION_CLOSED**，無需再退補正或改production。

自然局／無候選動態路徑／舊#6同序號／實機與ABC最終整合仍未驗。C補件completion seq283、新地表工具done seq287各待獨立收件，不能以idle／done算PASS；art/s2仍缺，WAITING_SOURCE_FILES、未接新圖。Codex本次僅核證與文件diff檢查，不新派／付費／生圖／改JS／Git發布，凍結區及dirty保護，正式停寫；詳[roadmap頂部](../roadmap.md)。

### 2026-10-22｜配送受控機制收件／只退證據口徑補正

p2正式停寫done seq286，game固定 **91f01255cbff25d9**、world未改；root獨立guarded配送專測 **4/4 exit0**與前後SHA一致。作者最終35/35 log已核（配送4＋其他受影響31），不引用舊39/39。FINAL為20個真互動／正解／resolve的受控完成，下一取貨同屋與<=2屋列皆0/19、跨chunk／pin20/20；非自然走路，完全無候選路徑與舊#6同序號未動態覆核，UI同期漂移，不能當ABC最終整合。game／world本次正式凍結。

root發現名為RED的舊JSON實際verdict GREEN、log EXIT_CODE=0，與摘要／07的RED exit1不符；收 **CONTROLLED_RUNTIME_PASS／EVIDENCE_CORRECTION_PENDING**，只一次退p2自有文件／新更正證據，真working seq288，不授runtime寫權、不重跑長局，保留原raw與log。p4 C done seq283尚未root獨立收；p5 ART-S2DEV前置working seq285僅寫新工具／scratch，art/s2仍缺，WAITING_SOURCE_FILES，未接遊戲。文件補正及C獨立收完才排有界固定版ABC；自然局／實機仍待驗。詳[roadmap頂部](../roadmap.md)，Codex未改production／付費／發布，凍結區與dirty保護。

### 2026-10-22｜S2新十張地表第一階段已派／來源未到，不等於接圖完成

新批4石／3木／3石木過渡預期在`art/s2/`，1254² RGB與完整SHA待真manifest核驗，狀態ART_CANDIDATE_NOT_SEAMLESS。現查該目錄、根目錄ZIP及Downloads同名ZIP皆未到，**WAITING_SOURCE_FILES**；使用者下載`YokaiDelivery_S2_Ground_Candidates.zip`解壓至專案根即可。ZIP交接SHA與精確十檔見[roadmap頂部](../roadmap.md)，本機尚未驗證，不能用舊V3／MethodB補位或假稱匯入成功。

p5確認原idle且無製作子程序後，已用現有Nemotron免費route接新 **ART-S2DEV-PREP-R1 working seq285**；只寫新`tools/s2-ground-preview.cjs`與`scratch/s2-ground-kit/**`，作缺圖明確WAITING_SOURCE的來源檢查／混鋪及邊界composition QA工具與契約，未改runtime。p2 game／world仍working seq281不打斷；p4 C done seq283但尚未獨立收件，UI／test不動。assets／renderer現有gate與canonical單材流程已唯讀盤點，新4/3/3及c過渡尚無runtime映射。**只有真派工回執，工具成果未收、圖片未到、接線及真遊戲未驗**。

待真圖／manifest核驗且p2停寫固定SHA，另確認assets／renderer無writer並明確授權後才派隔離dev gate接入，保留無dev預設／現有建物道具與舊圖。自鋪／任意混鋪、3×3／6×6／10×10、2D／.60真走動須分別驗收，僅ART_FAIL或WAITING_USER_REVIEW，不自動ART_PASS。禁止付費／生圖／Git發布及音訊KEY／SW／正式圖變動；本輪總監文件diff檢查後停寫，不建常駐監控。

### 2026-10-22｜C-R2已獨立收件／UI與配送隔離續作

root核R2六筆SHA、16張PNG並親看直屏卡片：**C-F2結算安全字框單項PASS**；C-F1原重抽重疊已消除，但18.4／23.83 CSS與卡內文字溢出為新退修，C整體仍RETURN_REQUIRED，15/15不能作44 CSS證據。融合focus／inputMode保持PARTIAL；既有直屏指標限制與圖鑑導覽LOW不混修。game4f710d14只是QA時未漂移的工作版，不是ABC固定整合版。

p2 QA已停並核done seq279，才交接角色：原owner p4 `SYS-C-MINIMAL-RETURN-R2` **working seq280**，只寫ui／自身test與新證據；免費MiniMax p2承接**原配送票** **working seq281**，唯一game／world與自身新測試／delivery-minimax-r1證據。p5 writer已撤、維持idle，不重試timeout。保留非debug成果與C-F2，UI須同時44 CSS／不重疊／說明可讀，配送須真完成20單consumer與跨chunk／不同屋／距離及#6負向、必要Stage1 Hard／Boss／A融合回歸；不得改oracle造綠。只有續派回執，尚無新PASS。兩票固定停寫後才安排ABC有界真頁整合，舊39/39不適用；自然局WAITING_USER、實機WAITING_DEVICE。詳[roadmap頂部](../roadmap.md)，無production改動／付費／生圖／Git發布，凍結區與dirty保護，Codex本次停寫。

### 2026-10-22早｜NONART-RESUME-DIRECTOR-R2現況與owner關卡

本次實查：p5 idle seq274，末屏Upstream idle timeout、delivery-r1無SUMMARY，game仍有兩處臨時debug鉤子，**配送不收件**。核p5 CLI程序樹只有Node／Kilo、無活躍delivery腳本或寫檔子程序後，正式收回其game／world writer；保留全部dirty及非debug候選，不回退、不盲試同provider。當前game SHA `4f710d14788e7615`、world `91aaca4b062044f2`，完整checkpoint見[roadmap頂部](../roadmap.md)。舊game96b2c375與39/39不證新版本。

p4補件已交、idle／completion seq272；15/15不能取代可及性驗收，摘要自述直屏卡高18.4／23.8 CSS。p2既有 `SYS-C-POSTRETURN-ACCESSIBILITY-QA-R2` 真working seq275，尚無SUMMARY；QA停寫／固定SHA／真反例前不讓p4動UI，不重派。若QA證實regression，再一次退p4最小補件；p2釋出QA角色後才優先考慮同一已證免費MiniMax route承接配送唯一writer，現在尚未授權／派出配送新writer。

配送續票須清理debug鉤子、保留其他成果，單seed真consumer先通，再交20個完成配送的距離／不同屋／跨chunk可達與負向、配送#6及Stage1 Hard／Boss／A融合受影響回歸，不改oracle造綠。等game／world與UI最終固定才派有界ABC真頁／十融合／Normal Hard Boss／2D .60驗收；自然十分鐘WAITING_USER、實體device／gamepad／FPS WAITING_DEVICE。本輪僅接管與文件diff檢查，無production修改、無重派或付費／生圖／Git發布，音訊KEY／SW／正式圖凍結，正式停寫。

### 2026-10-22｜C獨立QA已收／最小退修進行中，ABC整合未放行

C為 **RETURN_REQUIRED**：root核9筆SHA與24張PNG，親看升級卡／重抽重疊；原契約13/13不覆蓋這個HIGH。C-F1卡片footer重疊與C-F2結算文字安全區不足已一次退原owner p4，`SYS-C-MINIMAL-RETURN-R1`真working seq267，只改ui／自有test與自身摘要／新證據，不重做融合UI。圖鑑導覽<44 CSS為既有LOW另列，完整融合文案／焦點／inputMode及真機仍未全驗。四視口兩鏡頭及刻意404／壞體fallback是受控證據，不代表C整體PASS。p2已正式交件停寫，可見狀態仍seq261，未虛構done。

p5配送票原blocked seq264是工具Permission required，非已證quota；總監未批准未完整審查命令，退出後核done seq269，再向同一owner續接原票，改單一固定seed的受控probe，真working seq270。未換模型／第二writer，game／world仍獨占；只有續作回執、成果未收。等p5及C補件各自固定SHA正式交件後才排ABC真頁整合／Stage1 Hard與Boss短回歸，不借用舊39/39。證據與精確範圍見[roadmap頂部](../roadmap.md)，無付費／生圖／Git發布／凍結區變更。

### 2026-10-22｜非美術工程接管（SYS-NONART-DIRECTOR-R1）

已真核既有票：p5 `S2-DELIVERY-DISTANCE-R1` **working seq260**，獨占game／world及自身新測試／證據；p2 `SYS-C-INDEPENDENT-QA-R1` **working seq261**，只寫自己的20261022 QA目錄。兩票成果未收，本輪未重派。C原owner p4 idle seq253，C SUMMARY已正式停寫但尚未獨立QA；等p2固定SHA與反例，必要時才交p4一次最小補件。A+B+C真頁整合／Stage1 Hard與Boss短程回歸須等p5 game固定版，若C退修再等C固定版，不沿用舊39/39或A舊Chrome作新版本PASS。

已知非美術欠帳與owner／gate見[roadmap頂部](../roadmap.md)：C窄屏與fallback獨立驗收、雨港取貨距離與配送#6分別覆核、固定版ABC整合、正常六配送／Lv5／融合可達性、既有學習收藏存檔解鎖及build生命週期整合覆蓋。可自動短測與自然約10分鐘／手感分開，後者WAITING_USER_PLAYTEST；手機平板／實體手把／裝置FPS為WAITING_DEVICE。不是宣告這些既有系統未實作，也不因美術未核准停止獨立系統工作。Codex本輪只文件交接與diff檢查，無新票、無production修改／付費／生圖／發布；音訊、KEY、SW及全部dirty保護，正式停寫。

### 2026-10-21｜美術待審期間系統三線並行（最新使用者授權）

**SYS-A/B獨立收件**：MiniMax Free `wC:p2 done seq258`，A五筆SHA與摘要／Chrome一致，game固定 `96b2c375f802b617`、B config `7f46bd90213559a5`。A9/9、B5/5、既有consumer8/8及B runtime探針exit0，收A已測固定版技術範圍與B resolver真runtime整合；產品bug未發現。舊B39/39僅 **PRE_A_FINAL_BUILD**，不能引用為最終A回歸。Chrome僅8案例／5配方，窄屏一案、2D兩案；不涵蓋C最新UI、真頁Boss／per-cast去重、自然局或實機。C待獨立收件，三線未全完；詳roadmap頂部與root-ab-receipt。LOW建議留待原owner後續，本輪不追加派工。

本票覆蓋下方舊「只做Batch1A／production凍結」工作快照，音訊與Git發布保護不變。A `wC:p5`（game／fusion／renderer）補十組合技的可玩閉環；B `wC:p2`（config／boss-ai／words僅pacing）做保留預設的難度節奏框架與量測；C `wC:p4`（ui／assets／controls／viewport／dev-mode／card-gallery-ui／必要index UI）做HUD、行動端與缺圖fallback。初派皆DeepSeek V4.1 Flash Free（歷史working seq224／225／226）；額度耗盡後A/C安全轉交Kilo Nemotron free，B已收件，MiniMax Free完成獨立QA；精確檔案白名單、B→A resolver接口、驗收與來源SHA基線見roadmap頂部。Codex只一次性派工／去重／必要收件，不高頻監工、不跨寫production；三線尚未完工，不以working或舊PASS結案。美術未審不接production、不新增付費圖像／模型呼叫，不動音訊TTSBGM／KEY；禁stage／commit／push／deploy／reset／clean／checkout。正式停寫交件後才獨立核變更檔、本機證據、真阻塞與下一步。

### 2026-10-20｜Batch1A 無付費前置／現場 w9（最新票）

Codex `w9:p1` 唯一總監與 roadmap writer；OpenCode `w9:p2` 唯一橋接器及本票新增檔 writer，已正式停寫 done seq15。八份完整三聯 prompt、精確八 PNG／八 JSON 白名單與成本／來源資料已交；root 最終固定版真 dry-run 16次 exit0、focused 6/6 exit0、嚴格 JSON／路徑／SHA 檢查 PASS，僅收 **PREP_PASS**。交件入口 [README](../scratch/batch1a-nb21-prep-20261020/README.md)，prompt 在 `art/batch1a-nb21-prep-20261020/`；1K／2K 八張含輸入預留估算 US$0.4288／US$0.5632，實際帳單 null。AGY `w9:p4`／Kilo `w9:p3` 待 B 圖前 idle；舊 w7／舊票不恢復。卡點 **A_SOURCE_PENDING_IMPORT／WAITING_BUDGET**，無 B 圖／ART_PASS。禁止 execute、付費旗標、金鑰／配額試探與挪用 M2-FUSION US$3，原 ledger 不動；候選不接 production。禁 stage／提交／發布及 dirty 破壞，音訊與核准圖保護；固定 SHA、首輪 RED 修正及證據見 roadmap 頂部。

### 2026-10-20｜F1-A首交未過：真收益與Chrome覆蓋同票補件

game bb7f3d84固定版root獨立11/11 exit0收受控交易閉環，但同seed真30秒update量出父技約15.25DPS/合武3.30DPS（Boss對照14.85/3.30），與交件35–40DPS不符，不能收為有感融合。只退AGY局部fusion收益校準/真上限與原Chrome未實跑touch/兩視角/虛擬按鍵的覆蓋證據，不改BossHP/全局平衡、不重造引擎、不擴B/F2；F0架構PASS維持。原始curve/圖/命令與SHA詳roadmap頂部，候選美術/自然局/真機仍待驗，配送#6獨立RED，禁提交部署。

### 2026-10-20｜FUSION F0架構Gate PASS／F1-A真墨焰斬續作

固定game fad25735/fusion fff43383/index c74327c0，root runtime8/8 exit0、原query/revision兩負向轉GREEN且stale commit0；renderer/UI契約與44.2CSS先前已收，F0架構/狀態/測試分配Gate通過。可達性非此PASS：兩印記6配送、A9/B10選卡，6–8分鐘目標仍F3待實證。AGY唯一runtime與必要渲染/UI整合writer續F1-A真掉落/互動/母技停攻/獨立扇斬焦地/槽釋出與有限DPS/短Chrome；A收後才B，候選藝術WAITING_ART，配送#6 RED獨立保留。其他provider停用，禁提交部署/dirty破壞，詳SHA/log/限制見roadmap頂端。

### 2026-10-20｜合技F0／F1-A已實際啟動（USER_APPROVED，本機候選）

F0新固定runtime d2c7ed3b/b6cfa080 root8/8 exit0收橋接/交易/真補償子項；精確query近似鍵值誤啟用與過期revision仍commit兩個獨立反例exit1，僅同票交AGY最小修，F0 Gate未過。兩枚覺醒印記至少6配送（交件2配送文字錯誤已訂），6–8分鐘可達待F3，不私改Stage1/全域印記。F1-A真攻擊/Chrome仍待整合、不擴B/F2；證據/owner見roadmap。

最新owner覆蓋：UI c3919fa6 root8/8及44.2CSS反例exit0已收元件。Kilo F0遇Upstream idle timeout，確認停寫且game2799b1ca/fusion98ac24e8/indexee920afe不變後撤其writer；AGY已全檔停寫，接唯一game/fusion/必要index與自有runtime tests修F0 bridge/交易。renderer/assets/ui暫固定，Space Bunny unavailable不重試、不換模；F0/F1-A真Gate仍待引擎/可達性短證據。原hunk/dirty與Git/音訊禁令不變。

UI268fb01a root專項8/8 exit0已核資料/繪製契約，但手機42.25CSS熱區未達44，AGY僅補此原票。Kilo引擎檔已建立，root載入fusion98ac24e8語法exit1且跨檔私有state尚無bridge，已原票最小退修/要求真runtime測試與可達性短數據，未採其口頭F0 PASS。renderer/UI元件測試不等於融合交易Gate，不B/F2、不重跑88suite；證據/精確API與SHA見roadmap。

AGY renderer518c5cbc/assets99a79539元件已固定，root focused8/8 exit0收接口與墨焰斬渲染原型；不含真gameplay/融合交易或美術核准，程序候選WAITING_ART。AGY按原分工串行轉唯一UI writer；Kilo仍實際實作game/fusion，未正式交件。F0可達性/真交易consumer與UI待收，尚不標F0或F1-A Gate PASS；詳SHA/證據/接口payload見roadmap頂端，不開B/F2或重跑88suite。

依[FUSION_SYSTEM_PLAN](FUSION_SYSTEM_PLAN.md)循F0→F1-A墨焰斬→F1-B雷紋陣→F2→F3；Kilo seq2303獨占game/fusion與必要index載入，AGY seq2304獨占renderer/assets元件，停寫後串行接ui。Space Bunny provider unavailable未啟動/未動檔，不重試/換高價模型，已撤writer。Codex只決策/收件/唯一roadmap。F0架構/狀態/測試分配已落roadmap頂端，整體Gate仍待兩線接口與6–8分鐘可達性短數據；非衝突原型可並行，不虛報可玩PASS。來源變異完整保存＋每次融合一次免費非變異強化（有投入時），須測重複/失敗/空池不吞；兩母Lv5真正退出攻擊與欄位、淨釋1槽，一局一次。真印記規則需6配送，A最低9選卡/B10選卡，時間目標未驗不作弊宣稱。保護當前Stage2 XP80%/3XP/180吸取/Hard怪與王300/650/900/1400、Stage1/Hard、既有畫面/卡片/音訊；配送#6 RED獨立欠帳F3列入。禁止任何Git提交/部署與dirty破壞，HEAD e0278e5；未核VFX候選WAITING_ART。

### 2026-10-19｜16:02六項P1最新優先：三線本機實作

18:01續收僅#6：Kilo新版game a7cfdc4c確有雨港長距離分支。root真interact/resolve完成20個唯一事件、delivered20/跨chunk pin/答案Y通過；取送X中位1416、下取895，下取5/19同屋、合計13/19僅0–2中間屋列，**consumer exit1，仍未過#6**。同票只退雨港下一取貨/排隊訂單/無候選保底，重用root真20單helper。1–5沿已收結果不重跑；原始JSON、owner與限制見roadmap頂部，無長局/提交/發布。

最新續收：#3 UI固定ce8c0d6b已收，原點/16條圖鑑/短句幾何root先前真Chrome1/1、最終淡金小hunk語法exit0與目視可辨，Space Bunny停寫。#4/#5 Kilo game4ab52886 root精確Normal/Hard/Stage1/怪池/掉落5/5 exit0；#6實體makeOrder未落雨港新策略、舊20單測錯stage world並未完成訂單，已同票只退路由/真20單consumer。前票狐火深度/Boss新招真Chrome仍待整合不假PASS。詳證據及目前assets4eebf31f見roadmap；禁Git發布。

收件增量：AGY雨/北景固定renderer bc226532、assets6baf5f9c、640高山壁3f0de968，root專項4/4 exit0、更新真圖已看，#1/#2技術收件但新材質仍WAITING_ART。UI79b35e68原點修復、16條圖鑑與短句/同CTM圖示root真Chrome1/1 exit0；只餘深底圖鑑墨色過暗，同票最小配色補件，未全收#3。Kilo難度/20單配送未交件不算PASS。原始log與owner見roadmap頂部，不長局、不提交/部署。

使用者推翻前版Normal折衷：雨港回原Hard基底，僅小怪HP/速各.80、前三王.5/終王.65（150/325/60/910）；其餘Hard節奏/成長/XP原值，Hard快照/Stage1不動，低HP shiome唯一遠程例外保留。Kilo seq2263獨占game/world/boss-ai做此數值及4–7屋為主、3–8屋變化的跨chunk真配送/20單驗收；AGY seq2262獨占renderer/assets做海陸雨方向及北景黑帶；Space Bunny seq2264獨占ui做所有變異單句＋共用圖示/手機真頁。均已Herdr working，未交件未PASS；先前狐火/Boss seq2260已停寫修補保留，整合只在三線固定後短測。詳owner/門檻見roadmap頂部。無提交/發布授權，e0278e5不動；候選美術仍待審、A/B已批准。

### 2026-10-19｜Stage2 狐火／港灣Boss／Normal原票續收中（本機）

**13:50續收更新**：Kilo已正式停寫交件，root固定game60d6005a/boss7dbaf6ed做真VM及真Chrome，**整合NOT_PASSED**：狐火Lv3/5兩mode引用未定義movement且玩家重畫；Boss真step未消費新增rain-port招池；surgePacing2.0偏離保留2.2。已同票最小退Kilo，實際working seq2254；renderer45f2f04b仍AGY停寫。Normal/Hard/Stage1/遠程掉落5/5 exit0僅收該子範圍；6/8/9.5分鐘各30秒一般生成樣本敵20/33/39、平均HP4.73/5.87/5.71，未含surge/Boss，尚非動態可控壓力完整窗口PASS。詳細原始證據/限制見roadmap頂部。無新功能/長局/提交發布，e0278e5不動。

AGY renderer接口已停寫，45f2f04b／assets dc7141aa；root聚焦4/4 exit0，真fireSpec必傳、前後pass子契約已收，展示fixture不等於gameplay。Kilo仍唯一game/world/boss-ai writer，Herdr done回呼未伴正式交件；root已同票指出狐火movement作用域/玩家重畫與Stage2新招producer限定缺口，等待其最小修正及真consumer交付。Normal沿HP.65/speed.88/growth.45/cap65/surge.65/XP.70、Boss210/455/84/980；Hard/Stage1不變。最終僅必要短VM、6/8/9.5分鐘受控壓力樣本與真Chrome，不跑長局；目前整票IN_PROGRESS，藝術/自然局限制見roadmap。禁提交/推送/部署，線上e0278e5不動。

### 2026-10-18｜Stage2 橫向港口本機可玩版已收

Kilo game/world、AGY renderer已停寫，Space Bunny唯讀短QA已收。固定game d7de8313／world f13312fc／renderer e2f0bb8e；root world5/5＋scene/renderer/朝向/景深53/53 exit0，真Chrome短程exit0驗開局能動、Y180..780／任意X邊界、24次真生成出界0、實際配送答題點出界0、回第一關無runBounds殘留。renderer已有北建築／中石木／南港船層；缺連續海圖與構圖人審保留WAITING_ART，兩張石板候選不映射正式。詳roadmap頂部與scratch/spacebunny-m2-port-q/；未跑長局/真機，不宣稱美術封版。所有writer停檔，本輪無commit/push/deploy，HEAD e0278e5/index空，Stage8/其他dirty/音訊保護。

### 2026-10-18｜M2-Hotfix IN_PROGRESS（本機，禁止發布）

**A/K程式已收；V3已匯入，夜雨候選對照進行中／WAITING_ART。** 線上M1.1 e0278e5不動；本輪禁commit/push/deploy，Stage8／既有dirty／音訊／KEY保護。

1. **AGY景深A已停檔收件**：renderer原快照F342279B；root 59/59 exit0、音訊凍結真Chrome同場景2D/.60短幀exit0，已看立面高度/接地差異。證據 scratch/m2-hotfix-20261018/，不等同Hades真3D或美術封版。
2. **Kilo Phase1真consumer已驗**：game保留原house bounds/detour，world無diff；以現有WORLD.lamps腳底(l.y+8、畫寬44)加solid，未虛構港口燈籠。root真Chrome actual spawnEnemy負向無solid會生於燈腳，正式版避開；真shiome update左右移動、玩家翻面不改敵方向、凍結保持末方向，exit0。證據 scratch/m2-hotfix-runtime-20261018/runtime-proof.json；其舊VM自驗/弱繪製測試不列PASS。
3. **Kilo Phase2退修與交接**：root真Canvas發現shiome原素材朝左，現鏡像對映相反。Kilo供應商曾Upstream idle timeout exceeded；Herdr誤報idle(seq2111)，visible核實其仍在處理queued票並已寫nativeFacing。root在該patch完成後esc安全停止、visible確認interrupted，保留成果；AGY現唯一renderer writer，核現有hunk並補自身真transform斷言，不重試Kilo。game/world凍結。AGY已正式停檔，root獨立48/48 exit0(新朝向6＋depth4＋renderer38)，真Chrome真素材Canvas左右鏡像/玩家位置不干擾/時序變形/腳點固定exit0，已看正確向右畫面。最終game 9e09829abc811d51、renderer 7c9e3a2f0803a950；證據 scratch/m2-hotfix-final-20261018/。語法check皆exit0；diff-check exit2僅renderer四行尾空白，列P2。既有Stage8 dirty不動。
4. **V3取消待匯入阻塞**：使用者提供Cherry Studio來源，mcp1匯入 assets/img/rain-port/ground_stone_nano_v3_candidate.jpg，1024²、931178 bytes，root SHA256=24b6b5ae4910f9c4f10550d08e2df3da6c4a95bf3100f6cc2206909052f0329d。已看art/review/rain-port-v3/原亮度與bright10的3×3；使用者接縫量測左右8.26/上下15.13、內部約7.6，橫向接縫仍需真場景看。**WAITING_ART**：候選不映射正式、不覆蓋ground_stone*.webp；AGY完成K-FIX停檔後串行做D原亮度/+10%真雨夜短幀，只寫scratch。來源舊沙盒限制已過期，不再列阻塞。

驗收限制：目前均受控短幀/真Canvas，非自然局/實體裝置。HEAD隔離預覽出現既有Stage2可選prop/ground URL 404，無pageErrors/音訊讀取，未擅接未核素材；K-FIX與候選夜雨對照尚未收，不宣稱整票完成。OpenCode額度耗盡idle，無新派工。

### 2026-10-18｜M2 TECH_COMPLETE（本機收件，未發布）

使用者已允許M2與M1真人試玩並行；線上仍為M1.1 **e0278e5**。本輪M2不commit/push/deploy，index空、所有Stage8／既有dirty／音訊／KEY保留。新M1實玩bug優先hotfix；不自動進M3。

| 包 | 實際收件／owner |
|---|---|
| A 圖片FX | AGY：核准Lv5刀芒圖片scale 1.00→1.25、現有螢火輔助粒子雙層；新增程序主刀芒已撤回，其餘五技能沿用既有圖消費。 |
| B 接地／鏡頭 | AGY：怪物腳底與排序／陰影對齊、房屋陰影按寬度、地板快取底色；2D／.60短幀已看，Stage8從預覽排除、原dirty保留。 |
| C 可讀性 | Kilo先清重複錯文案；工具反覆確認與跨寫測試後停檔撤權，AGY接唯一UI收尾：保留正確fan玩家短文案、crosscut60%、原seek回落與M1.1 HUD；E11/E12跨寫已精確撤回，原斷言保留。 |
| D 圖對照 | Codex純唯讀：實際核准ground/ground_dirt各3×3、三町屋／角色透明邊與真場景比例；無新圖核准，候選不接正式。 |

獨立驗證：A4＋B3＋renderer38＝45/45 exit0；六技能圖片消費focused2/2 exit0；真Chrome啟動／圖片就緒／實際幀／2D→.60／刀芒短幀 exit0，pageErrors/audioLeak0（favicon404非阻塞）。最終renderer SHA **c468b949596f5748**、UI **2ccfa93f26e57840**。證據與命令：scratch/m2-director-20261018/final-receipt.json、ab-tests.log、start-proof.json、art-proof.json；截圖在 start-proof 所列dir。

**不是全測試綠或藝術封版。** C原Chrome專項exit1因取錯scale鍵成NaN；僅暫存副本修正取值、保留斷言後exit1：手機卡內墨底餘裕約1px未達6px，未越框，列P2；未重跑完整三視口／真機。P2另有地面重複節奏、大扇面佔位與舊raw文案oracle待同步，下一程式owner AGY；不為此擴大本輪。P1／WAITING_HUMAN：使用者看M2首批畫面；新母版／候選仍WAITING_ART，缺新圖不阻現役圖技術收件；裝置／自然局維持M1/M3未驗。AGY與Kilo均已停寫，不恢復其他耗盡Agent。無新的M2發布授權，先留本機。

### 2026-10-18 11:08｜最新覆蓋：M2與M1真人試玩並行

使用者已允許M2開始規劃＋實作，覆蓋下方完整M1 gate前禁止M2的舊限制；M1自然局／裝置仍未完，與M2視覺工程分開驗收。
- M2-B／AGY w7:p4：唯一renderer.js、必要viewport.js及自身visual test writer；首關投影／陰影／接地／遮擋sort／切鏡取1–3個可見修正，保護Stage8 DEV preview既有dirty、不提交。
- M2-C／Space Bunny/OpenCode w7:p5：唯一ui.js及自身M2 UI test writer；HUD／選卡／Boss預警可讀性取1–3個可見修正，M1五P0不退化。兩票由使用者已派，僅短測，正式交件後Codex最小收件。
- 次序：M2-B正式停檔→同AGY writer串行M2-A圖片FX；M2-D先用既有3×3／透明邊／核准清單證據，必要時一次純唯讀票。不恢復Kilo供應商盲試，不接未核圖／音檔。
- Codex低額度僅決策／writer權／最終收件，本次記錄後停工保額度。M2不push/deploy，等使用者M1試玩及M2首批畫面審視；dirty、audio、KEY/env、未審art與既有index全保護。

## 1. 唯一製作順序與放行口徑

**M0 文件與安全整理 → M1 夜行町 roguelike 垂直切片 → M2 2D／2.5D 與圖片 FX 精修 → M3 手機／平板＋手把十分鐘驗證 → M4 第二關 → M5 第三至八關逐關替圖與內容 → M6 音訊人審與發布。**

本文件的 M1/M2 是新里程碑，覆蓋舊文件的「八關 CODE_COMPLETE／ART_AND_AUDIO_APPROVED」同名定義。八關既有流程是保護基線，不是當前主要開發順序；不重寫八套引擎。M1 不等新美術或語音，不代表可跳過 M2/M3/M6。

優先度：P0＝資料安全、可玩阻塞、Lv5 回歸、音訊／候選越界；P1＝本階段必要交付；P2＝不影響本階段的擴充／潤飾。工作中發現 P0 先停受影響部分，其他已授權且不撞檔的工作繼續。

成果必須分開標記：`DESIGNED`、`MODIFIED`、`STATIC_PASS`、`TARGETED_PASS`、`BROWSER_VERIFIED`、`PLAYER_VALIDATED`、`DEVICE_VERIFIED`、`ART_APPROVED`、`RELEASE_APPROVED`。加速、視口模擬、自然遊玩、人審與部署不能互代；沒有執行證據就標 `NOT_RUN` 或對應 WAITING。

### 2026-10-18 10:57｜實際發版取捨／Codex唯一主控

Stage1 MVP DEPLOYED，完整M1仍IN_PROGRESS、不M2。五P0與normal/hard XP契約已短測，真Chrome三尺寸／8視口卡片及固定HEAD資源進關受測；不以完整自然局／真機作今日MVP發布前置。使用者明確授權現在精確commit＋push＋Pages上線，由使用者真人實玩後迭代。
Codex負責發布；AGY REL-Q1短QA與Space Bunny REL-Q2資源唯讀QA已交件停檔，Cursor/Sonnet月額度耗盡不再依賴，Kilo/Grok不啟用。game ab659eca／UI ac574c33，候選runtime199/199、working短回歸263/263、combat+normal98/98 exit0；候選Chrome關教學後首關時間推進。未完為自然三Build、實機及後續平衡，保留NOT_RUN/WAITING_DEVICE，不冒稱全M1 PASS。程式提交9e9fbb7已push；Pages run39091959639 build/deploy success，10:59台灣時間線上index＋9關鍵JS共10/10 blob SHA一致。試玩 https://yorkwahaha.github.io/yokai-delivery/?v=9e9fbb7 。下一owner使用者實玩，Codex依實際阻塞再派修，不啟動M2。

### 2026-10-18 最新M1發布票（覆蓋下方舊長局與禁發布快照）

使用者明確授權中午12:00台灣時間前推進M1提交部署；先完成五P0及相關回歸/必要瀏覽器，未GREEN不發布。不反覆跑十分鐘局，正常實玩由使用者負責，受控短測不冒稱自然局或實體驗證；M2仍暫停。

| P0 | 單writer | 驗收 |
|---|---|---|
| Boss血量／勝利門檻 | AGY game | 真spawn HP150/325/60/910；其他關不變；零配送dawn＋終王死才勝、活Boss/pre-dawn負向 |
| 修行選卡 | Space Bunny UI（Kilo overloaded停寫後移交） | 真效果短文案、無標題/假名/邊框重疊、三卡緊湊；1000×700／844×390／1024×640真字框/截圖/點按 |
| 勝利唯一按鈕 | AGY consumer＋Space Bunny UI | UI.endScreenButtons(state)同源，won只world可見/可按且真回旅路；lost三主鈕保留 |
| 實際通關時間 | AGY快照＋Space Bunny顯示 | summary.elapsedSeconds來自戰鬥elapsed，非performance/DAWN上限；MM:SS，pause不增 |
| 發布gate | Codex | 正式停寫SHA、獨立原負向/短consumer/受影響回歸/三視口→白名單同主題commit→push→GitHub Pages＋線上程式版本核對 |

現HEAD ca3b68a、index空；game5b8f6d23已有前兩項未驗修改，UI1d8fcbc8尚未改，STORE5fe53548凍結。Kilo現役新票仍NVIDIA overloaded，CLI自動重試已Ctrl+c停止done seq1864；無模型替換。Grok額度不足停用。AGY空檔僅可在總監給定已驗/停寫白名單後LOCAL批次提交，不能與總監並行操作index。音訊KEYenv/未核准素材不讀、不提交；發布沿用遠端master GitHub Pages，不跑會讀音訊的本機打包。

## 2. Owner、寫入範圍與交接

**2026-10-17 Codex正式接回，覆蓋下方歷史票快照：** HEAD14cec7a、index空；M1仍IN_PROGRESS，不進M2。AGY唯一game.js＋自身G tests，主票G-R3正常參數約600秒三build、6配送／2封印／四Boss、勝敗重玩與返回旅路真重進、正式/dev及終王pending-XP；不以跳時／dmg35腳本當正常局。Grok E12.3已停寫，UI1d8fcbc803a53568／test4966014d07774699由root固定版真Chrome獨立QA中。Space Bunny唯讀核E12.3及G原負向，不重複root Browser、不碰production／四權威。Codex只四權威＋QA＋安全LOCAL統籌；Git整理限主線空檔，GREEN同類可集中提交，不push/deploy。可銜接證據／驗收狀態以roadmap最新節為準。

**本輪E12.3子gate已收**：root固定上述SHA獨立6/6 exit0，三視口28次真CDP輸入各appliedId符合、回play，寒封符真字框／14CSS／44CSS／教學遮罩負向與三PNG受測通過；證據`grok-m1-e-r12-20261017/game-mvbz0rhy/`。受控offer／非自然／WAITING_DEVICE，完整console error與其他Duo逐卡像素全文及完整G留下一票，不以6/6放行M1。LOCAL checkpoint前cached diff-check發現test末尾空行exit2，由Grok僅白空白修整再root核對。

**G整合子gate報告（2026-10-17）**：G-UI-R1 root新增focused1/1 exit0，固定game c39／UI1d8fcb／E12test1735f6bf，三視口受控結算→真CDP旅路重進，各starts+1/finishes不重複、build清空、配送1筆與選卡play；其餘Duo×視口9字框0違規，root實看5張，證據`gr1-mvbzobg1/`。Runtime console error/exception0，未接Log domain。Q7舊seed reload前提退修後，test b900ef6b root DEV focused1/1 exit0，實際含dev/正式兩key的storage重載、正式JSON不變且不冒認dev完成。只收受控consumer，非正常三build完整長局／自然局／實機。AGY G-R3繼續，Grok下一票首build真頁，p5待固定版獨立QA，M1 IN_PROGRESS，不M2。

**G-R3.2里程碑子票／TARGETED_PASS**：game c39／UI1d8／STORE5fe不變，G test e063838f正式停寫後root三Build **3/3 exit0（111.82秒）**，省Boss0真記憶體反例patched1/ran1 **exit1**；exact4／正常HP／死亡／六配送／兩印／保存重進受測通過。新req日誌正確、唯一runId保留原證據；root配方`agy-m1-g-r3-20261017/run-mvc1eo2h-15584/builds.json` SHA451df0c7bedcdd69，等級33/39/38，局內580.45/577.10/565.35秒。此為注入XP/指定卡/位置控制VM，不是正常取得／真Chrome／自然局。Q9 root另exit0只重現needle2+fan終局score一次400，該helper有跳時/dmg35/可補油，未窮舉／油量無判別力，不據此改game或泛稱去重已過。M1仍IN_PROGRESS。

**下一主票M1-G-C1／Space Bunny**：只新tests/spacebunny-m1-g-chrome.test.cjs及自身唯一run證據，production／他人test／四權威凍結；真頁三Build、單一frame時鐘、正常XP與實際offer/有限重抽、真CDP套卡／配送／四Boss／結算／旅路重進。VM配方作優先順序參考，不能以XP注入/免費指定卡取代M1條件2；只完成clock或受控接線則fullRun=false，保留真失敗待診斷。AGY停寫，Grok8%保額度、不換模型。尚未驗完整Chrome、不M2／不發布，實體WAITING_DEVICE；Git只停檔GREEN同主題LOCAL。

**C1最新收件NOT_COMPLETE／C1.2同票退修working**：C1.1 test5dd38b11eb0c769c兩次focused約10.47秒exit1 Runtime.evaluate deadline，root真Chrome1.11秒獨立重現withPage在回傳ctx前finally已關WS/Chrome：closed=true/readyState3，後續evaluate必timeout；根因為測試生命週期，非Fetch/preload或產品錯誤。p5只改同test，把情境置於callback內、驗成功/throw清理，再≤120秒一配送/正常XP真offer→CDP套卡閉環，fullRun=false，不當三Build或M1完成。AGY N1已正式停寫，未交正常XP完整局；root由575420f helper移除兩處oil_heal注XP且禁setter，seed777/LCG政策實跑93.25局內秒lampout、Lv3/2配送/0封印/0Boss、exit1，僅政策失敗診斷，無production缺陷證明，不改數值。game c39/UI1d8/STORE5fe/G e063固定；C1未GREEN不stage，本輪無新LOCAL，M1 IN_PROGRESS，詳證與下一owner見roadmap頂部。

以下是責任配置，不是自動啟動 Agent 的授權。一次只給每人一個主工作與一個可選備用工作；一檔一 writer，開始前核對當前 owner，不沿用重啟前 pane 狀態。

| Owner | 主責 | 寫入範圍／交接要求 |
|---|---|---|
| Codex | 主：技術方向、接口／依賴、QA gate、唯一 roadmap；副：關鍵整合與風險／資源額度 | 獨占 `docs/GAME_DESIGN_MASTER.md`、`docs/PRODUCTION_PLAN.md`、`roadmap.md`、`AGENTS.md`；不搶 production writer；各 M gate 在 Herdr 回覆及本文件末段報告 |
| 原Kilo（停用） | 不再參與；其歷史production範圍不自動恢復 | 原w7:p5已由使用者改為Space Bunny；js/game.js及自身D/runtime現由AGY獨占，其他production修改仍須總監明確指定writer |
| Space Bunny／OpenCode | C1 NOT_COMPLETE，C1.2同票退修working | 唯一tests/spacebunny-m1-g-chrome.test.cjs及新run證據；先修withPage回傳前finally提前關閉WS，再驗分段ready/短deadline/退出/一配送與正常XP真CDP選卡，fullRun=false；不改production／四權威／他人test |
| AGY | R3.2已收；N1診斷正式停寫 | game c39/G e063凍結。未交正常XP完整局，root替代政策在93.25秒lampout，僅政策診斷；無真runtime RED不派數值修補，暫idle等固定Chrome結果 |
| Grok（現役UI writer） | R1已收；R2僅clock接線，DEPENDENCY_WAIT／weekly剩8% | 唯一ui.js/E12測試owner，已停寫保額度；R2四幀接線root1/1但fullRun=false，尚無完整局。依AGY固定配方評估現役p5自有QA test承接，不跨writer／換模型 |
| 使用者 | 新美術／聲音／重大內容與平衡取捨、實機協助、發布決策 | 人審特定版本；未回覆不視為核准；外部 ComfyUI 由使用者自行操作 |

新增 production 檔、`index.html`、service worker 或其他人測試若確有必要，先指定 writer 與交接範圍；不因一般重構順手改。歷史Kiro／Kilo／Cursor派工不可自行恢復；最新現役為AGY G-R1、Grok E12.1與Space Bunny G-Q1唯讀QA，各一主票，狀態見roadmap頂部。Muse Spark候選已取消，不再等待舊路由決策；不擴張或切換其他模型。

**現行暫時交接（2026-10-16 15:38 追問後）：** Kilo 的 Nemotron 首票出現 `A Timeout Occurred`，沒有 M1-A 核心交件；已中止該請求並撤回 M1-A-K。依使用者最新工程調度授權，M1-A-R1 由已成功交件的現役 AGY 承接，獨占 `js/game.js` 與新 `tests/agy-m1-runtime.test.cjs`；Kilo 不寫該檔，AGY 暫停詞庫／故事／素材工作。其他檔不移交，Codex 不改 production。M1-A-R1 驗收及明確交還之前，原 writer 不自動恢復。

交卷最少包含：改動白名單、真實 consumer／玩家可見結果、受影響 focused 結果、未驗項與下一 owner。沒有新缺陷不重跑已等價 PASS，不堆報告、預覽或全庫測試維持 working。

## 3. 相對 Sprint 甘特資料

Sprint 為團隊完成一批可驗收交付的相對單位，**沒有指定天數、起訖日期或交期承諾**。S0 是文件與安全基線；後續序號表示建議順序。圖審、設備或樣本未到時，相關列順延；不得把等待時間寫成完成。

| 階段 | 起點 | 規劃長度 | 前置 gate | 可並行工作 | 退出標準 |
|---|---:|---:|---|---|---|
| M0 文件／安全整理 | S0 | 1 個單位 | 本次使用者指示 | owner 確認與只讀基線 | 三份權威文檔一致、AGENTS 精簡、歷史可追 |
| M1 Stage1 垂直切片 | S1 | 3 個單位 | M0 | AGY 資料核對、Muse 使用 fixture 做選卡 | 六御守／十變異／四 Duo 真接線、Lv5 不退化、S1 可重玩 |
| M2 圖片 FX／鏡頭精修 | M1通過後 | 2 個單位 | 完整 M1 gate | 最新指示：M1完整驗收前不進入M2 | 2D／0.60 可讀、圖片 FX、透明邊、3×3 地面及人審狀態 |
| M3 自然局／裝置驗證 | S5 | 1 個以上單位 | M1＋M2 必要畫面 | 無設備先做桌機真人局及 UI 修正 | 代表 build 自然局與指定實機＋手把證據 |
| M4 Stage2 | S6 | 2 個以上單位 | Stage1 M3 gate | 可早做現役素材清單，不能提前大量擴內容 | 第二關一個完整關卡包通過 |
| M5 Stage3–8 | S8 | 每關 2 個以上單位，合計至少 12 | M4；逐關接前一包 | 只預備下一關資料／候選；不多關同時寫引擎 | 六個關卡包各自圖審、流程、行為、自然局驗收 |
| M6 音訊／發布 | S20 之後 | 依解凍與人審，長度未定 | M3–M5＋明確音訊解凍 | 解凍前只列待交付狀態，不讀聲檔 | 發行回歸、人審、真機與明確發布許可 |

甘特匯入用相對依賴：`M0→M1-A→M1-B→M1-D`；`M1-A→M1-C／E／F`；`M1-B～F→M1-G`；`完整M1→M2→M3→M4→M5-S3→M5-S4→M5-S5→M5-S6→M5-S7→M5-S8→M6`。最新使用者指示覆蓋舊M1/M2重疊安排；同檔工作串行。

若某關美術待審，不偷換順序宣告該關完成：先完成該包安全邏輯與現役回落，標 WAITING_ART；必要時只預備下一關資料。Stage1 不被其他關的 WAITING_ART／AUDIO 阻塞。

## M0：文件、安全與最小整理

| 工作包 | 優先度／owner | 產物與驗收 |
|---|---|---|
| M0-A 正式方向 | P1／Codex | 完成本企劃與製作計畫；roadmap 頂部唯一方向；AGENTS 100–160 行 |
| M0-B 可追溯入口 | P0／Codex | 記錄舊 AGENTS／roadmap 的 commit 與 blob ID；確認是否有未入 Git 的差異，禁止覆蓋 |
| M0-C 安全工作面 | P0／各 owner | 核對 writer、改動範圍、dirty 與音訊凍結；後續測試先讀檔前阻擋 |
| M0-D 缺口分流 | P1／Codex＋Kilo | 將阻塞 S1 的 consumer／存檔／輸入問題排前；S8 dev collage 作隔離缺口保留，不借機升正式 |

「清理」僅清除可證明廢棄且無有效引用的衍生檔、舊交接；保留現役、母版、受保護 QA、尚待審及狀態不明的成果。刪除前須核對來源、有效引用與授權範圍，不以目錄或副檔名批次推定可刪；不清空 docs/art，不做全庫整理。M0 文件完成不表示遊戲功能已修改。

主控回報已依來源＋引用檢核刪除 Stage3 `Preview_*.webp` 32 張（約 33.3 MiB，PNG 母本保留）與 `docs/restart-handoff-20261015-*.md` 五份（約 18 KB）。Stage2 `*_v1` 仍被 `tools/r6-world-cross-edge.cjs` 引用、Stage3 `O_shrine_courtyard_decal_exp_b.*` 仍被 `docs/art-review-queue-20261014.md` 引用，均保留；此處記錄主控交付，非 Codex 另行刪除或全庫獨立重驗。

## M1：Stage1 roguelike 垂直切片

M1 的最終交付是一個可以本機連續重玩夜行町、選出不同 build 並完成配送／Boss／結算的版本；不是只交規格、靜態資料或測試數字。沿用核准現役美術及既有語音 stub，不等待後續關圖片與聲包。

| 工作包 | 優先度／owner | 前置 | 可驗收交付 |
|---|---|---|---|
| M1-A 六招與接口基線 | P0／AGY 暫代 runtime（R1），Codex 驗收；Muse 待交接 | M0 | 鎖六招 Lv1–Lv5、四主動含妖刀、現役覺醒規則；最小 BuildState／有效選卡／攻擊快照接口，無變異基線不變 |
| M1-B 最小組合實證 | P1／AGY runtime＋Muse 各自獨占檔 | M1-A | 靈針散射＋追蹤＋冰封同時有效；Boss 抗凍；選卡顯示正確、重按不重複套用 |
| M1-C 六御守 | P1／AGY runtime、Codex gate、Muse 顯示 | M1-A | 六種作用、最多三裝、無重複／滿槽死卡；既有被動與御守計算不重複 |
| M1-D 十變異／四 Duo | P1／AGY runtime，Muse 顯示 | M1-B | 依官方企劃表製作；資格、單層派生、傷害預算、PvE 狀態清理完整；不擴成十三招全量 |
| M1-E 選卡與教學 | P1／Grok UI，AGY runtime接口 | M1-A，後隨 B–D | 分類、前後差異、條件、焦點及長字可讀；真頁空池與選卡；首次配送／封印短教學 |
| M1-F 保存與解鎖骨架 | P0／Space Bunny唯讀QA，AGY真game結算consumer，Codex gate | M1-A | dev／正式隔離、舊檔安全遷移、首通冪等；局內build不永久化，六基礎招可用，新招只留槽；STORE修改另明確派票 |
| M1-G 重玩整合 | P1／AGY runtime、Grok真Chrome UI、Space Bunny邊界QA，Codex gate | B–F | 三不同合法build的S1真頁成功/失敗/重開/返回/收藏/配送/封印/Boss/結算；受控與自然局分列，受影響八關契約 |

M1-B 是第一個玩家可觀察的原型；B–D 可以迭代交付，但最終 M1 退出必須滿足六御守、十變異、四 Duo。每個 build 效果必須有 runtime consumer，不能以未啟用資料表充數。

**M1 接受條件：**

1. 無變異時六招五級與現役 Lv5 特性通過相關既有契約；妖刀固定、主動最多四欄、御守最多三欄。
2. 至少三種可區分且不依賴指定掉落的 build 能在真頁進行 S1；包含三變異疊加案例、至少一個共鳴可觀察案例。
3. 十變異與四 Duo 各有有效觸發／負向／生命週期驗證；不要求在同一局集滿全部內容。
4. Boss 有可執行的抗凍／恢復路徑；投射、殉爆、餘燼不無限派生，封印與死亡結算不被跳過。
5. 資格卡池、空池、滿欄、滿級、快速連按及暫停／結算清理不軟鎖；不用未解鎖技能也能通關。
6. 勝敗保存、四印記字卡與正式/dev 隔離不退化；存檔失敗不假報已保存。
7. 真頁證據與 targeted 結果有對應版本；加速明標，不宣稱自然十分鐘或真機。

M1 不要求新圖、新音訊、新十三招全部到位或八關正式美術；UI 可用現役核准底板、文字與圖示。發現 Lv5 需大幅重設才可相容時，先提出具體衝突及最小方案，不暗改既有能力。

## M2：2D／2.5D 與圖片 FX 精修

| 工作包 | 優先度／owner | 驗收 |
|---|---|---|
| M2-A 圖片表現 | P1／Kilo runtime、AGY 素材狀態 | 用已核准圖／透明 sprite 序列／貼圖粒子表現攻擊與命中；墨色塊粗筆觸、自然低對比，無幾何假素材 |
| M2-B 鏡頭／地景 | P1／Kilo | tilt .60、housing Y 1.20、2D 回退、腳底與 Y 排序；首幀、移動、切鏡不漂移／露縫 |
| M2-C 可讀 UI | P1／Muse | 選卡效果、長假名、Boss 預警、油量、配送與圖鑑不被 FX／房屋遮住；手把焦點可見 |
| M2-D 圖審 | P1／AGY→使用者 | 新地面真 3×3、透明邊、角色／房屋比例、實際場景對照；候選／核准分列 |

舊核准圖可支撐 M2 技術精修；需要全新藝術母版的項目單獨標 WAITING_ART，不能自動生成或接候選。使用者未核新圖前，不把「暫用回落」寫成最終藝術封版。Stage1 美術 gate 不等待 Stage7/8。

## M3：手機／平板＋手把十分鐘驗證

1. Kilo 先做桌機至少三局不同 build 的自然流程觀察，記錄局內／牆鐘時間、等級、配送、Boss、死因與代表峰值；受控腳本長跑另列，不能冒充真人。
2. Muse 核查手機橫式、平板與手把選卡／題板／圖鑑／結算，旋轉、失焦、背景回來與輸入切換不誤觸。
3. 使用者設備執行實體手機／平板＋實體手把核心路徑；記錄 OS、瀏覽器、型號、連線與實際能力。沒有裝置就 WAITING_DEVICE，不替它打勾。
4. Kilo 量 frame time／P95、物件與記憶體趨勢；初始目標接近 60 FPS、P95 20 ms，超標先剖析；任何降級需明列決策。
5. 約十分鐘 27–33 級作初始觀測目標，檢查 30 級附近是否有足夠選擇與爽感。不得以提高怪量、XP 或傷害硬湊 PASS。
6. 聚焦修復重玩軟鎖、控制失效、永久冰封、讀題計時、長字／焦點、嚴重卡頓。改後只重驗受影響路徑。

退出要求：至少三個代表 build 的桌機自然局記錄、一份指定實體行動裝置與手把走查、無未解決 P0；P1 與裝置限制明列處置。若完整目標設備尚缺，M3 不結案，後續可只做已授權資料預備。音訊仍不讀不測，實機無聲驗證只覆蓋遊戲與輸入。

## M4：第二關完整關卡包

沿用 Stage1 已驗證系統，不複製 game。Kilo 主接 rain-port 地景、專怪與潮汐 Boss，AGY 核正式素材／27 詞／故事／解鎖，Muse 核雨霧對比、Boss 題板與行動端。

1. 盤點已核准石木 v2 與 Shiome／Ikari 圖的精確版本；單圖核准不等於整關核准，不重繪已核准母版。
2. 查 stageId→loader→renderer 實際 consumer；專屬 idle／attack 不被共用 atlas 蓋掉，地面與地標替換有對應顯示。
3. 各關有獨立地面／場景／建築／裝飾／地標及一名專怪與專屬 Boss 的可讀行為，不能只改數值／顏色／稱號。
4. 按首通解鎖規劃製作對應新妖術，名稱／招式另定案後才擴；未解鎖玩家仍可完成第二關。遷移不重複發獎。
5. 完成 2D／0.60 真頁、3×3 與接縫、人審、約十分鐘自然局、結算／收藏／返回與受影響裝置核對。

缺某圖／行為則標對應 WAITING，不抹除既有可玩基線、不把回落圖當關卡識別已完成。此階段不解凍語音。

## M5：第三至八關逐關替圖與內容

| 子包／相對 Sprint | 素材與資料重點 | 主要風險 |
|---|---|---|
| M5-S3／S8–S9 | 妖櫻山道、22 詞、神社／古櫻、專怪與 Boss | 舊拒稿與現役核准圖不可混淆；地面接邊、房屋體積 |
| M5-S4／S10–S11 | 竹影迷宮、22 詞、暖亮竹地、專怪與 Boss | 暗泥／巨大落葉拒稿不可回流；遮擋與辨路 |
| M5-S5／S12–S13 | 百鬼京都、21 詞、町屋市集、專怪與 Boss | 物件密度、腳底排序與手機可讀 |
| M5-S6／S14–S15 | 雪燈山寺、24 詞、雪寺與專怪／Boss | 雪 FX 遮擋、背景／預警對比、低階裝置 |
| M5-S7／S16–S17 | 幽世渡口、21 詞、渡船／靈河、專怪／Boss | 偏寫實候選重審、不可用色調冒充新關 |
| M5-S8／S18–S19 | 黃泉境、164 詞複習、終章、專怪／Boss | 骨花白底拼貼、終局獎勵、錯題加權與多招峰值 |

每包固定順序：資料與缺口確認→使用者核准該版圖／新招→Kilo 同一套接口接入→Muse 真頁走查→自然局／保存→Codex 在必要整合 gate 核對。未核准的新招／圖不接正式；既有邏輯可用核准回落先驗。

每包 DoD：正確詞池／故事、可玩勝敗與重玩、專怪及 Boss 真正差異、五類地景槽與正式素材、長字／HUD／圖鑑／結算、3×3／切鏡、人審、自然局與受影響實機結果。分開記 ENGINE_READY、WAITING_ART、ART_APPROVED 與 DEVICE_VERIFIED，不用「關卡 done」隱藏缺口。

新妖術總量以十三招為上限，七次首通解鎖；具體映射與第八關獎勵需決策。先做每招 Lv1–Lv5、四欄資格、變異相容與解鎖回歸，再移向下一招，不一次新增七招尚無 consumer 的資料。

## M6：音訊人審、發行回歸與部署

本階段啟動音訊工作必須取得使用者**明確解凍範圍**，包含准讀、准測、准改或准生成哪些內容；舊聲包、TTS 與 BGM 禁令不因走到 M6 自動失效。

1. 解凍前僅保留既有呼叫與 stub，不讀音檔、不執行 TTS、不讀 KEY、不呼叫外部 API、不更新包含聲檔 hash 的快取建置工具。
2. 解凍後依使用者核定流程逐關處理詞音、讀音／音量／停頓、BGM 與素材授權；每批先聽審再正式接線，不自行整包生成或換曲。
3. Kilo 主做發行回歸、Muse UI／裝置、AGY 內容／核准清單；Codex 一次整合 gate。保護舊檔、八關、十三招實際狀態、圖像、輸入、下載／快取、收藏與終章。
4. 所有 P0 清零，待審／未測／降級有明確處置，使用者再決定是否授權 commit、push、deploy；三者分別判斷，不沿用歷史 checkpoint 自動執行。
5. 真正授權後才逐檔白名單 stage／檢查差異；不收音訊、KEY、候選或私人資料，除非使用者另行明確變更相應禁令。發布記錄實際 commit、版本與正式頁驗證。

本輪無 commit／push／deploy。M1、55/55、圖檔可解碼、手機視口截圖或本機 checkpoint 均不是發布許可。

## 4. 跨階段 QA 最小矩陣

| 類別 | 必驗案例 | 主要 owner／gate |
|---|---|---|
| 基線 | 六招五級、妖刀固定、四主動、舊覺醒、六配送＋終王 | Kilo／M1-A、G |
| 新 build | 三御守、十變異、四 Duo、空池／未解鎖／重複點擊 | Kilo＋Muse／M1 |
| 組合與狀態 | 散射＋追蹤＋冰封、Lv5、Boss 抗性、單層次爆／共鳴、死亡與退出 | Kilo／M1 |
| 圖像 consumer | loader→選圖→atlas／frame→drawImage，地面／地標／Boss／UI | Kilo＋AGY＋Muse／M2、逐關 |
| 存檔 | 舊欄缺失、未知 ID、storage 拒絕、首通冪等、失敗不解鎖、dev 隔離 | Kilo／M1、M4–M6 |
| 學習 | 單一正解、長假名、安心讀題、錯題、四印記、收藏不加戰力 | AGY＋Muse／M1、逐關 |
| 畫面與裝置 | 2D／.60、3×3、透明邊、焦點、手把斷線、旋轉、加速／自然／真機證據區分 | Muse＋Kilo＋使用者／M2–M3 |

測試前確認不讀凍結檔；HTTP 在讀檔前 stub `js/audio.js` 並阻擋聲檔／TTS／外部 API。既有工具若做不到先修測試邊界，不能用瀏覽器靜音代替凍結。不為文件改版跑功能大測試。

## 5. 生產風險與升級規則

| 風險 | 早期訊號 | 最小處置／owner |
|---|---|---|
| 範圍膨脹 | M1 同時開十三招、八關圖或新引擎 | 回到六／十／四及一關可重玩／Codex |
| 高倍率／永久冰封 | 同組合免走位、Boss 無法出招、投射數爆增 | 命中與派生預算、抗性與上限；量測後調單一主因／Kilo |
| UI 與 runtime 分叉 | 卡面效果與實際不符、條件已滿仍不能選 | 共用 choice view model／Kilo＋Muse |
| 素材假核准 | 候選直接改正式路徑、白底圖降透明度繼續用 | 停受影響接圖，回核准 fallback；保留原稿／AGY＋Kilo |
| 進度誤報 | 55/55／加速／手機視口當真機或美術完成 | 退回正確證據等級，不重做無關項／Codex |
| writer 衝突／dirty 遺失 | 同檔多 Agent、批次 stage、歷史檔覆蓋新成果 | 暫停該檔、確認 owner；不 reset／clean／checkout／各 owner |
| 設備與審稿延遲 | 無真機、圖未核、聲音未解凍 | 明列 WAITING，繼續安全獨立項，不造假日期／協調者 |

同一阻塞最多三種實質不同方法；缺權限、輸入或外部條件提早回報。保留命令、退出碼與錯誤；不原樣盲試、不吞錯、不擴大安裝或改全域環境。

## 6. 首波已派票與里程碑報告｜2026-10-16

### Codex 恢復後的現行交接／C-R2、E-R9

最新使用者指示已恢復 Codex 總監工作，覆蓋 roadmap 的歷史額度暫停安排。已讀暫代總監最新交接與 Herdr 現場，AGY／Muse C-R1／E-R8 均有正式交件；Kilo 仍暫停。以下舊首波 working／game 凍結及尾部 R6 報告是版本歷史，**本節現行表與最新里程碑報告優先**。

**最新穩定checkpoint／F子gate：** f175244已LOCAL提交四權威文件（13連結、精確四檔stage/cached check0），index空、391 status entries保護。F-R2 root獨立真幀3案例exit0，保存失敗警告/原JSON/重載、lost不清關、dev正式隔離已收受控VM子gate，非Chrome/完整G；p5待固定G/UI新負向。其餘G-R1.1/E12.2仍working，不stage其檔。

**最新Git授權／待驗：** 使用者2026-10-17允許安全LOCAL commit，push/deploy仍禁止；d7b4981（STORE/F-R1）、3bffe44（guard/test）、52c9366（contract/E11兩tests）已在HEAD歷史、不重做。四權威本次更新完成後同組checkpoint；production/test須正式停寫＋固定SHA＋獨立GREEN再白名單小批提交。新使用者MCP1整包測試exit1，C:797 expected play/actual levelup，root固定game c39與C e375後focused C11/B12各exit1，C11實測剩duo_inkfire屬舊池前提，G-R1.1僅修自身測試，不把整包提交為PASS。G-R1 game新c39d10兩處狀態守衛已root原99e374反例→新victory及4/4驗綠，只收受控結算子票（teleport/跳終王/dmg35/UIstub），完整G未過；E12.1真CDP RED因tutorial:true與六主動fixture，E12.2同票退修。盤點分組與保留原因見roadmap，395 dirty/159 ignored entries不等於安全白名單；不讀改凍結項或刪檔。

**最新人力／驗收（2026-10-17）：** R14 runtime子票 TARGETED_PASS：固定game 99e374b1f681f20e／D 1f2c36a77972671c／runtime 9d4e073f9e89bab6，正式停寫/idle後Codex獨立D82–88＋runtime12 8/8、exit0；原雷紋Lv5+power/3敵2.24→2.2401反例GREEN，實扣2.240000000000009（容差1e-9）。額外stdout探針真投符→黏附→引信→餘燼，cast3符共享一次、出生life.8/delay.3、3敵各.216合計.648、第四/盾0、一次tick無狀態派生；真offer/apply(seed3)在途舊3符false/新3符true且只1處，兩命令exit0。受控VM/武器時鐘與fixture敵人，非Chrome/自然局/實體。驗收前後game/D/runtime SHA一致，scoped diff-check exit0。 E-R12 NOT_PASSED（Chrome證據）：UI 6593da982bf5644b／test 600d829c93829bd2，未重跑已知6/6。總監源碼核實harness只算scale/offset卻未套ctx transform，且body/canvas非真頁CSS；已實看chrome-mvbrzxpt/mp.png左裁字、tb.png溢出/scrollbars。logical card.x=-85/panel.x=-113不能單獨判正式UI裁切，須套真game變換。BROWSER_CAPTURED不代表BROWSER_VERIFIED，fixture非真offer/apply；退同票E-R12.1核真正卡/完整pair與before/after/限制、14CSS/44CSS/三視口bounds及觸控鍵盤真事件。 AGY G-R1與Grok E12.1送票exit0/working且真工具動作；Space Bunny G-Q1僅audit交件/probe exit1為錯oracle，真結算未測併AGY；Q2舊空池fixture已由root真offer耗盡/90XP/play exit0獨立確認，G-Q3首局教學正式停檔/idle，root獨立事件源碼與focused2/2 exit0，非Chrome/完整G，G-Q4已交，root否定UI缺getter主張，真UI/game VM事件exit0；p5 idle待固定新版本再QA。F-R1既有13/13不重跑，STORE5fe53548a3de8740；400 dirty保護。M1 IN_PROGRESS，不進M2，無提交部署。

E-R10途中Grok命令擬寫白名單外 `I:\WinTemp\ui-focused.diff`，Codex實際展開審閱後拒絕，turn取消（未開always-approve，非模型故障）。已派同票續行並觀察working，內建file read/search/edit完成UI與新測試；命令若仍需審批則正式列未執行與精確安全命令交Codex QA，不重複卡關、不讓代理冒稱PASS。原500K／非fast及一檔一writer不變。

| 票／Owner | 結果／證據 | 缺口／下一步 |
|---|---|---|
| E-R10／Grok Build，收件NOT_PASSED | UI SHA256 `0943480b4990b7cb`／測試 `e0a01300c1d63a99`；Codex原4/4 exit0，但獨立thundercircle映射負向exit1 | 雷紋陣錯映射barrier+needle，WI無thunder；原斷言只查katana/fire或任意「影響」，負向並未真正製造失敗。字級只比logical，44CSS／焦點未真驗；摘要測試前寫死done:true/舊hash，非可追溯結果。無Chrome三圖；E-R10.1修正後再收 |
| E-R10.1／Grok，NOT_PASSED | UI `0943480b4990b7cb`、UI測試 `532c4dfe264d85df`、Chrome草稿 `d4c613a89485bcb3` | 實查12-byte假PNG、cdpCommand回null、ready/errors硬編碼且載index/game；不是Chrome驗證。CJS仍六主動fixture、吞負向錯誤、allPassed恆true並覆寫舊摘要；Codex未執行此草稿，保留拒收證據 |
| E-R10.2／Grok，NOT_PASSED | UI不變 `0943480b4990b7cb`；測試 `2761c05c8a37b1da` | after仍done=true、全case強制true；Codex只在記憶體注入首測失敗，0/1 exit1卻done:true，證據 `director-m1-e-r10-2-failure-20261017/mvb6o034/`。仍六主動fixture／全局flat／缺font/熱區負向及焦點樣式。停止同路徑重試，不將自報4/4等價重跑或列可收 |
| E-Q1／Grok，已停檔／保全及偏差獨立核對 | 凍結UI與測試內容寫權；只保全自身拒收測試至R10.2 artifact，之後只讀核對六張實卡與fixture | 拒收測試已移出runner、SHA仍2761c05c8a37b1da，UI不變。Codex獨立確認fixture fan五發／seek陰陽符／crosscut名稱與實卡不符，屬fixture忠實性缺口；不據此改正式玩法。Grok暫待AGY固定版後真UI票，不再修同失敗路徑；500K非fast，AGY核心工作持續 |
| Codex固定UI Chrome／受測子案例可收 | UI `0943480b4990b7cb`；`director-m1-e-r10-chrome-20261017/2026-10-16T16-21-33-662Z/` | 真三視口crosscut/frost雙卡＋四Duo單卡共15fixture案例、真PNG已實看，meta15.56/14.30/14.93CSS、全文/邊界/44CSS/雙焦點樣式通過。原probe exit1誤判font700→bold及沿用rect，保留原錯誤；同批trace重新分析exit0，非重跑。不是三卡全組合／真game事件／Duo實戰或自然局／裝置；Grok契約票仍待收 |
| C-R1／AGY | Codex C測試7/7 PASS、exit0；game `51e67de5fcc628f5`。獨立真 needle碰撞2.52→2.94、update位移11.5→12.9／.05s、gem距150吸附0→3.45且值5，均exit0 | 第一批power／step／gather已收；原測試多為helper，後續C-R2補持久真consumer對照；其餘3御守仍inPool=false，完整C未過 |
| E-R8／Muse | Codex自身6/6 PASS、exit0，UI `e93c748e22d32b8a`；新3圖已實看，`artifacts/validation/muse-m1-r8-20261016/` | mock／fixture顯示子交付已收，不是新build真頁；console檔0 bytes不列無錯誤。R9待固定C-R2版本驗正常選卡／真效果 |
| C-R2／AGY，已交件／NOT_PASSED | Codex自身C測試 **11/11、exit0**；game `0ffa53cd27aaf0c9`、測試 `f56692576471d29f`，語法／diff檢查PASS | 額外真hurtPlayer負向exit1：guard把0／.01／.05都提升至.1，.5→.45才正確；「未完成項無」不採認，完整C gate未過 |
| C-R2.1／AGY，runtime修正已收、停檔 | game `736e43d2e4132ffe`、C測試 `afb24d44dbcabb3b`；Codex新增聚焦4/4、exit0，語法／diff PASS | 真減傷對照與無效輸入／盾／inv／妖火浮字7.2／非戰鬥耗油已驗；原失敗負向獨立重現GREEN。局部修正已收，完整C gate待固定版Chrome |
| E-R9／Muse，NOT_PASSED／供應商rate limit | 固定game `736e43d2e4132ffe`／UI `e93c748e22d32b8a`；實際r9-summary.json `done:false`，只setup／mobile-touch／tablet-key，缺三御守與空池案例 | 舊空池仍含mut_frost／mut_seek；五主動setup不合法；numericDiff不能代替step／gather／guard真consumer。pageErrors空、有404／vibrate警告，非乾淨console。Muse停檔不盲重試 |
| E-R9.1／AGY，真consumer子gate已收 | harness `558f0e02f3a02ee1`；Codex原斷言獨立 **6/6 exit0**，`artifacts/validation/director-m1-r9-contract-20261016/` done:true，game／UI固定 | 真事件3御守＋實傷2→2.2／位移23→25.8／距150吸附false→true、合法四主動空池0與續行、revision／連按／重抽／覺醒／觸控／鍵盤已驗。六御守C子gate可收；整體E尚有D新卡與教學 |
| D-R1／AGY，收件NOT_PASSED | game `25eba8a13e6e24f0`／D測試 `a7fb345fced59798`；Codex新D **7/7 exit0**，非獨立重跑其自報44/44 | 另真weapons→排入側斬→真applyChoice(passive:crit)→weapons，舊側斬實傷.72→1.296，快照隔離負向 **exit1**，不可採認未完成項無。第一次直接改b.crit負向亦exit1；初版真卡probe因固定RNG未抽到crit而TypeError，經合法耗盡其他被動setup後真卡負向成立，錯誤保留 |
| D-R1.1／AGY，TARGETED_PASS／已收 | game `ef4b79cbdb56bc85`／D測試 `e2071d62a358a3cd`；Codex `--test-name-pattern='M1-D-(8\|9\|10) \|M1-RUNTIME-12 '` 對D／runtime **4/4 exit0**，語法／scoped diff exit0 | 真crit卡原反例重現GREEN：舊cc .72→.72，新攻擊1.296；新持久D8實測、風刃快照／邊界／盾死／六招30組基線已驗。AGY自報10/10未等價重跑，非真Chrome／整體D gate |
| D-R2／AGY，TARGETED_PASS／已收 | game `84d954cb171c452a`／D測試 `f010f064fca52c63`；Codex新D11–16＋runtime12 **7/7 exit0**，語法／scoped diff exit0 | 真池、兩小脈衝.85半徑/各.5傷/.18延遲，Lv1總.48；Lv4擊退45+45=90/Boss免疫，Lv5單結界220/1.8s不重建。額外update pause/levelup hp99.76/delay.17凍結、恢復傷.48/queue0，exit0。74/74自報未重跑，非完整D或真Chrome |
| D-R3／AGY，TARGETED_PASS／已收 | game `dbee4d07bad862c3`／D測試 `f0519577ede39387`；新D17–22＋runtime12獨立7/7 exit0，語法／scoped diff exit0 | 真25%次雷、180×reach搜尋、不再分支／不控Boss；額外真Lv5 3storm/3stormChild/1branch、4敵各9.6＋1敵2.4、其他0；合法真offer→apply一次XP／連按拒絕／排池通過，未用setChoices。非Chrome／自然局／完整D |
| D-R4／AGY，NOT_PASSED | game `6f93c38b5e3299e3`／D測試 `c37900ce589276e0`；Codex新D23–28＋runtime12獨立7/7 exit0，語法／scoped diff exit0 | 真consumer反例exit1：針傷2.52，序列2.52/2.898/3.276/2.52/2.52，總增額1.134=45%而非上限.756=30%。測試自身oracle把第3敵+30%當正確；證據 `director-m1-d-r4-20261017/mvb7b10e/budget-counterexample.json`。先前複合shell的最後exit0不掩蓋中途負向失敗，另獨立命令exit1留證 |
| D-R4.1／AGY，TARGETED_PASS／已收 | game `1ab6695eea73bac2`／D測試 `a4efb0e38c3d4c2e`；Codex受影響D25–28獨立4/4 exit0，語法／scoped diff exit0 | 原反例GREEN，2.52/2.898/2.898/2.52/2.52，增額.756=30%。獨立真逐針碰撞fan6增額3.26592、Lv5 8／11針14.112／13.97088均等於sum(snapshotDamage)×.30；真offer只passive:dmg→apply，舊針4.2336/4.86864/4.86864，新針5.292，不用setChoices。證據 `director-m1-d-r4-1-20261017/mvb7z13x/acceptance.json` 的2個已過觀測＋`mvb7zz0n/acceptance.json` 的3個已過觀測。前兩附加輪exit1為總監快取重建array／Lv5生於牆內，失敗保留，不冒稱整輪全綠；weapons(0)隔離碰撞非自然飛行／Chrome。持久D27對帳及D28手塞卡仍待R5收斂 |
| D-R5／AGY，TARGETED_PASS／已收 | game `d2642de748ce92e9`／D測試 `f55db53e148441d7`；新D29–34＋改D27/28＋runtime12獨立9/9 exit0，語法／scoped diff exit0 | 單次折返／同Set及pierce預算／壽命上界已接。額外清solids的受控VM真步進Lv5 8/11針各折返一次，.65/.67s消散≤.95；首附加輪2個已過案例保留在 `director-m1-d-r5-20261017/mvb8tb8m/acceptance.json`，整輪exit1是固定RNG未抽return。改RNG0後合法真offer→apply，XP37一次、舊針不回寫／新11針生效，`mvb8u195/true-offer.json` exit0；未用setChoices，非Chrome／自然局／實機。D29塞卡備援／D28未知御守仍列R6修測試，不假稱已無缺口 |
| D-R6／AGY，NOT_PASSED | game `f899d815b5c74c3c`／D測試 `38575def268f82ad`；Codex focused D28/29/35–40＋runtime12獨立9/9 exit0 | 真dragonFireball→weapons額外負向exit1：groundTarget應[4.8,4.8]卻[14.4,4.8]，新增fallback把落地濺射升為直擊；真正contact[14.4,4.8]須保留。證據 `director-m1-d-r6-20261017/mvb9t2xs/ground-impact-baseline.json` done:false。D39錯oracle及D37同義公式不算充分證據；受控VM非自然局 |
| D-R6.1／AGY，TARGETED_PASS／已收 | game `27f2efb6f6412d62`／D `bc741015d8508a19`；Codex新D37/39＋runtime12獨立3/3 exit0 | 實際paint/play參數與真offer球/焦土升級隔離通過。原ground/contact反例GREEN為[4.8,4.8]/[14.4,4.8]；再真offer僅passive:dmg→apply於龍生成未吐球，舊三球14.4/4.8/2.16、新龍18/6/2.7，無setChoices。`director-m1-d-r6-1-20261017/mvbalygi/acceptance.json` done:true／exit0；受控VM，非Chrome／自然局／實機；自報77/77未等價重跑 |
| D-R7／AGY，NOT_PASSED | game `947ea4dc802a44c3`／D `416725fe0ed9287c`／runtime `3f853934423b73ce`；Codex新D41–46＋runtime12獨立7/7 exit0，語法／scoped diff exit0 | 真發射→黏附→fuse主爆反例exit1：.05步長，主爆當幀新次爆delay已.13，主爆後.15秒額外扣.66，早於規格.18秒。證據 `director-m1-d-r7-20261017/mvbbbiuc/secondary-timing.json` done:false。D41手塞卡、D46手造符／改dmg與變異不算真選卡發射；滿3容量宣稱僅assert長度1不採。自報60/60未等價重跑，受控VM非自然局／Chrome／實體 |
| D-R7.1／AGY，TARGETED_PASS／已收 | game `595132b1d389614f`／D `de8cbd3604043fcf`；Codex新D41/43/46＋runtime12獨立4/4 exit0，語法／scoped diff exit0 | 真offer/apply與真發射隔離已核。原時序反例GREEN：.05步長.15無傷/.20次爆.66，另.033步長.165無傷/.198次爆且僅一次；合法四主動真offer XP100→70、連按不重扣。`director-m1-d-r7-1-20261017/mvbbup16/acceptance.json` done:true／exit0。自報60/60未等價重跑，受控VM非Chrome／自然局／實體 |
| D-R8／AGY，TARGETED_PASS runtime子票 | game `c2851de81337e8d6`／D `27a91d91d64baf41`；Codex新D47–52＋B8/11/12＋runtime12獨立10/10 exit0，語法／scoped diff exit0 | 實際producer Lv1–5多符同敵受控擺位對帳，全傷／濺射守原cast基線，次爆分攤後25%且.18s不提前。`director-m1-d-r8-20261017/mvbcozy4/acceptance.json` 保留5矩陣與boom→真weapon needle→6針成功，但整輪exit1因RNG未抽boom；`mvbcpvgw` 另留fixture未抽fan失敗，不稱全PASS。只補反向LCG真fan→weapon boom→3符，`mvbcqm01/reverse-inheritance.json` exit0／done:true，全局fan一份。D48原直接改WL及單持有繼承文案待R9收斂；非Chrome／自然局／實體 |
| D-R9／AGY，TARGETED_PASS runtime子票 | game `00289586c95d8e7d`／D `1e7895d28f4833aa`；Codex新D53–58＋改D48＋B8/11/12＋runtime12獨立11/11 exit0，語法／scoped diff exit0 | 額外真producer .05s轉.21rad、位移22px、速度440、life正常扣，移除目標後解除鎖定。直接攔敵陣列iterator，1s實際搜尋5次相隔.20，而非僅讀searchCount；`director-m1-d-r9-20261017/mvbdksvv/acceptance.json` done:true／exit0。R8持久真武器繼承與單持有共享說明已收斂；受控VM非Chrome／自然局／實體 |
| D-R10／AGY，TARGETED_PASS runtime子票 | game `fb1d6cbfa0e040a0`／D `ba4b3ff54244bab7`；Codex新D59–64＋D41/B8/11/12/C11/runtime12獨立12/12 exit0，語法／scoped diff exit0 | 額外真產5符Boss只凍.15、2s免疫，真update.20s解凍／免疫受傷不疊冷／2.2s後再凍ready4.2；真主次爆次爆傷.66、冷維持1／無碎冰；真weapon boom繼承3共享且兩技能3槽滿、拒第4，實際3符皆frost/tracking。`director-m1-d-r10-20261017/mvbe245v/acceptance.json` done:true／exit0；受控擺位VM非Chrome／自然局／實體 |
| D-R11.1／AGY，runtime子票TARGETED_PASS；D-R12已派working | 固定game2a91a460e1179430／Df7833b01397dcaf6；Codex7/7、語法／diff0，獨立證據見roadmap | 原A/B離場反例GREEN與全無效零傷；真offer/apply前後欄位、真被動升級、levelup凍結／舊新budget1.08/1.35已驗。首附加輪總監回傳型別oracle錯誤保留，僅補第4案例exit0。下一寒封符按GDD限定同cast1敵／每敵2s／不改冰封，正式停檔才驗；真Chrome／自然局／實體NOT_RUN |
| D-R12／AGY，runtime TARGETED_PASS；R13已派working | 固定game b01a711fa06b3665／D f1fda65c50a1c824；focused11/11、語法／diff0，stdout獨立consumer證據見roadmap | 真投符黏附引信／cast1敵、Boss3.6→4px與普通凍後.65倍、真Duo選卡舊符無效／新Lv5fan4符共享、重開無繼承；受控VM，不是真Chrome／自然局／實體。R13只墨焰斬，GDD5.3設明限額，不啟用最後餘燼符 |
| D-R13.1／AGY，墨焰runtime TARGETED_PASS；R14已派working | 固定game e4304a75ac36d9db／D4c7dad3448dd1265，focused5/5／原.56總預算GREEN／真Lv4/5來源快照exit0 | 新雷紋Lv5+power/3敵2.24→2.2401同類分攤仍RED，R14先最小共同預算修正再最後餘燼符；完整D/真UI/自然局/實機未驗，不把手造consumer測試稱真producer |
| F-Q4／Space Bunny，MEMORY_CANDIDATE_ACCEPTED；正式F未修 | root四個候選三層數值案例exit0；STORE853d572f5b72905e未改、最新108.4K(10%) | count(Number(score))/count(Number(deliveries))兩行候選已驗，保留字串coercion與同源cap；現由新授權Space Bunny F-R1接STORE正式修正／自身單一新測試，不把候選GREEN當落盤修復，不派冗餘只讀PASS |
| E-R12／Grok NOT_PASSED，E12.2 working | UI6593da982bf5644b/test600d829c93829bd2固定驗收 | 原Chrome fixture未transform、手機裁字；修真game變換/卡資料/三視口點擊與字級/熱區證據，未宣稱真頁已過 |
| F-R1／Space Bunny，正式guard子票TARGETED_PASS／停寫 | STORE5fe53548a3de8740/test59459c054be4c5ba，真磁碟兩行，正式done | Codex新測9/9＋既有必要4/4共13/13 exit0，原finish(Infinity,NaN,false)三層保best40/stage40/del3、不解鎖/canSave true，syntax/scoped diff0。有限整數/cap/字串/legacy簽章/dev/寫失敗不變量已驗；非真瀏覽器/自然局/實機，不放行完整F或M1，未自行加票 |
| E-R11／Grok，TARGETED_PASS契約子票 | 測試 `ffcd9489bb4f3e76`，UI仍 `0943480b4990b7cb`；Codex guard下獨立3/3 exit0 | 四Duo正確pair、fan僅needle、錯pair負向。獨立記憶體把UI thunder→needle後2/3 exit1且明報缺天狐雷，沒有改production／假done摘要。UI無本票變更，真game／Chrome／自然局／實體NOT_RUN，完整E未過；Grok停檔不重派 |
| F-Q2／Space Bunny，工具QA已收；F未過、F-Q3已派working | 正式done→idle，原只讀SHA未變、最後68.6K(7%)；自報16/16，Codex必要2/2 exit0 | 獨立STORE.finish(Infinity,NaN,false)讓舊best40與stage best40存null，exit1；新增F-Q3只讀有限數值／storage回滾矩陣與修正建議，無寫權、不重複F-Q2。原G1/G2 P0分級不採，六招本來全可用、七新招未定；不為無內容建立空獎勵API |
| 舊F-Q2／Kiro與Muse候選，已停不參與 | Kiro舊plan路由無QA、目前無pane；Muse Spark1.3 Free使用者確認下架；原Kilo停用 | 最新使用者Space Bunny接管覆蓋舊WAITING_ROUTE_AUTH／等待Kiro模式決策，不重試舊請求、不發Cloudflare或其他模型；不能混記為Kiro或Muse成功 |
| E-Q2／Grok，已停檔／部分診斷可採 | 已依Herdr fallback讀回 `artifacts/validation/grok-m1-e-q2-20261017/result.md`，唯一交件文件，UI不變 | needle單一skillId鎖定與flat ID可沿用可採；其容量例「已持fan後再選fan／後拿boom仍0」混淆去重與繼承，不採。Codex已在GDD §5.2獨立收斂：單全局ID作用所有已持有適用技能、後拿技能繼承、所有受影響技能均有容量才進池；例needle fan+seek+pierce滿3／boom2時frost排池。非runtime交付，Grok暫待固定版，停止同分析重試 |
| F-Q1／Kilo，未交付／請求中止 | 唯讀QA送票exit0、observed working後，間隔觀察仍無首個工具動作／QA產出；依介面兩次esc中止，未寫檔 | 本票未見具體Timeout／429碼，不捏造錯誤；可用性未恢復、不重試／換模型。後續F最小票由Codex收斂並移交可用writer |
| F保存基線／Codex唯讀QA，TARGETED_PASS | `node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern='failed storage writes\|legacy save data\|clearing night-town\|a failed run\|malformed save containers\|real STORE keeps' tests/progression.test.cjs tests/dev-stage-selector.test.cjs` **6/6 exit0** | 真STORE正式/dev隔離、storage失敗/恢復、舊檔、勝敗解鎖與壞容器保護通過。store未改，不等於完整F；新build／永久分離、首通冪等與後續真頁整合仍待驗。不做中途整局保存 |

新增獨立回歸：`node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern='M1-RUNTIME-12 |M1-B-(4|5|12) ' tests/agy-m1-runtime.test.cjs tests/agy-m1-b.test.cjs` **4/4、exit0**，驗C-R1變動影響的六招基線／三變異／快照／覺醒；語法／scoped diff檢查exit0。未重跑未受影響的21／55等價PASS。暫代總監B-R2 47/47與E-R7 20/20、R6 Chrome8/8屬既有版本交接證據，不改寫成本輪執行。

新增C-R2獨立證據：`node --require ./tools/director-audio-freeze.cjs --test tests/agy-m1-c.test.cjs` **11/11、exit0**。另從同一loader直接呼叫真hurtPlayer：輸入0／.01／.05／.5，無guard實扣0／.01／.05／.5，有guard卻扣.1／.1／.1／.45；「guard不得增傷或造傷」斷言 **exit1**。不是以helper或自造傷害模型推論。R9準備稿未執行真Chrome，不把node --check或寫了標題算驗收。

新增C-R2.1獨立證據：`node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern='M1-C-9 |M1-C-11 |M1-RUNTIME-12 |M1-B-12 ' tests/agy-m1-c.test.cjs tests/agy-m1-runtime.test.cjs tests/agy-m1-b.test.cjs` **4/4、exit0**，涵蓋新減傷／浮字與受影響空池／真六招基線。另沿原C-R2失敗腳本重現真hurtPlayer，guard實扣0／.009／.045／.45，皆不大於無guard且正傷仍正，**exit0**；沒有把AGY自報37/37當成本輪獨立重跑。

**最新里程碑報告（2026-10-17）：M1 IN_PROGRESS，gate NOT_PASSED。** R14 runtime子票固定版已獨立8/8＋原雷紋反例/真餘燼cast及真offer升級隔離exit0；不等於D/E整段通過。E12 Chrome截圖證據因座標harness不忠實拒收，E12.2同票已派working；AGY G-R1三build真流程與Space Bunny G-Q3受測教學子案例2/2已收，G-Q4部分診斷已交，p5暫idle待固定G/UI版新負向，Q1真結算段併AGY，不撞檔。F-R1既有13/13保留，詳細命令/SHA/證據見roadmap頂部。缺三build完整真Chrome、自然局/實體與教學/結算整合，仍待交；WAITING_DEVICE，不發布、不M2。Codex額度/context本輪數值UNKNOWN，不用舊快照或重開。

### 以下為首波版本歷史

**M1＝IN_PROGRESS，gate＝NOT_PASSED。** Herdr `agent list` 已核實四個現有 pane 及同一工作樹，三張票均經 `agent prompt` 提交；提交成功只代表送入，不代表開始或完成。沒有新增 Agent、production 模組或報告文件。

| 票／owner | 主交付與首波寫檔白名單 | 依賴／回報證據 |
|---|---|---|
| M1-A-K／Kilo `w7:p5`，**已撤回** | 原核心票未交付，寫入權暫停 | 本輪 recent 實查供應商 `A Timeout Occurred`，無 429 證據；已中止殘留請求。game SHA 仍 `a884811affddfcaa`，只有既有 Boss 接線差異；沒有 BuildState／卡池／applyChoice／revision／attackSpec |
| M1-A-R1／AGY `w7:p4`，最小核心子交付已收 | `js/game.js`＋`tests/agy-m1-runtime.test.cjs`；卡池／apply／revision 與妖刀快照真 consumer | Codex 獨立重跑新 runtime 7/7＋舊契約 21/21＝28/28、exit 0；重複被動 callback 修前真實負向 exit 1、修後獨立重現 PASS。非完整六招行為矩陣，不是 M1 或整體 M1-A 結案 |
| M1-E-R2／AGY `w7:p4`，子交付已收 | 同兩檔預接可選 `UI.levelUpLayout(count)`；舊 UI 未提供時維持舊座標 | Codex 已查 recent／實際 diff，獨立新增 8／9 兩測 **2/2、exit 0**，另驗新版重抽真 pointerdown＋count 轉交 PASS；語法／scoped diff 檢查 PASS。game `5b06e73101649adb`，測試 `bfa45803c3698500`；現行 game 工作轉 R5 |
| M1-E-R3／Muse `w7:p6`，NOT_PASSED／P1 | `js/ui.js`、`tests/muse-m1-*`；證據 `artifacts/validation/muse-m1-r3-20261016/` 保留 | 已核 recent／實際 diff／三圖；同源 getter＋draw 有交付，但 Codex 獨立 A5／A7／B4＝**2/3、exit 1**，間距仍 18＜26。手機 fixture 固定 CSS585×390、logicalW900，未測到加寬分支；「全橫寬改善」不成立。限制／主效果省略與小字仍未過 |
| M1-E-R4／Muse `w7:p6`，手機案例已收；E 未過 | UI／自身測試；證據 `artifacts/validation/muse-m1-r4-20261016/` | Codex 獨立 **12/12、exit 0**、語法／diff 檢查 PASS，新三圖已實看；手機原重疊／越卡受測案例修復，fixture 真 viewport.js／offset 已接。另測桌機必要 meta=[12,12,12]＜14 CSS px，**exit 1**；整體 E 仍未過，空 console 檔不當無錯誤 |
| M1-A-R5／AGY `w7:p4`，快照子交付已收；A 未過 | `js/game.js`＋自身 runtime 測試；已正式交件並停檔 | Codex 新 10／11 兩測 **2/2、exit 0**；另實際碰撞驗升級後舊針仍傷害 2.52 PASS。game `6cde3bf7aef4e25c`、測試 `f0534fb3347d95dd`。測試10僅 katana5／barrier5／fire4,5／boom1／thunder3,5／needle5，非全級矩陣；11只驗重開，未覆蓋暫停／死亡。其餘四招 spec 仍 metadata |
| M1-E-R5／Muse `w7:p6`，文字／fixture 子交付已收 | UI／自身測試；證據 `artifacts/validation/muse-m1-r5-20261016/` | Codex **14/14、exit 0**，三圖已實看；必要 meta 14px、受測全文／Duo 映射通過。UI `e93c748e22d32b8a`、測試 `b8d89fa921a5f0d8`。空 console、未保存可核 DOM 仍不當無錯誤；圖上 R4 標題為次要證據標記問題，E 真 game 路徑未完成 |
| M1-A-R6／AGY `w7:p4`，原版矩陣證據 | 只改自身測試，production 未變 | 原 SHA `7cc15077d7b74de9`，Codex 新3/3、exit 0；三十組有真 weapons 觀測，但 RNG／手動 won 瑕疵未收，後續由 R6.1 修正，不回填原版全 PASS |
| M1-A-R6.1／AGY `w7:p4`，基線／生命週期子 gate 已收、停檔 | 只改自身測試，局部驗收修正 | Codex 獨立0／10／12／13 **4/4、exit 0**，測試 `5549aabbcb756cf8`；宿主／雙 sandbox RNG 隔離及真 update→victory→frame→won 已核。lost／won 凍結不傷敵、start 清空精確成立；game／UI SHA 不變。其餘四招完整 attack spec／新 build 仍屬後續 M1 工作 |
| M1-E-R6／Muse `w7:p6`，已派出／working | **只寫自身 Chrome harness／證據**；`artifacts/validation/muse-m1-r6-20261016/` | 送票 exit 0、已觀察 working。固定上述 UI／game SHA，真 offerUp→事件→apply／play／攻擊、重抽／revision／空池／1–3卡、鍵盤／觸控、真三視口及可核 ready／錯誤 JSON。測試端注入明標受控加速，不改磁碟 production，不是假 choices fixture／自然局／真機 |
| M1-A-DATA／AGY `w7:p4` | 六／十／四 stable ID、技能適用與文案核對；真 CONTENT／STORY 資料保護；只新增 `tests/agy-m1-contract.test.cjs` | 審查已刪自抄常數／自造 mock PASS；Codex 獨立重跑 6/6、exit 0。詞庫／故事不變量及未知 ID 回落通過；名稱存在檢查不算 Lv5 行為，仍待 runtime 契約 |
| M1-A-UI／Muse `w7:p6`，先前版本證據 | `drawLevelUp` 消費契約、fixture 與焦點／長文；證據 `artifacts/validation/muse-m1-20261016/` | 真 Chrome 三圖已實看；Codex 判 **NOT_PASSED／P1**：手機重疊／越卡，桌機平板補充字偏小。修正負向後 Codex 獨立重跑 **9/10、exit 1**；B4 真實 RED。R2 依賴現已解除，改由 R3 修正；M1-E 未結案 |

首波接口約束：沿用 `offerUp/pickUp/choices` 與既有 `id/type/n/s/cat/levelText/lv/d`。資格、傷害、扣 XP／印記與保存只在 runtime 判定；舊 `f` 若保留也走唯一驗證。choice revision 在重抽、套用、重開後失效；未有 consumer 的新效果不得進正式卡池。新資料模組、store／Boss 擴檔先交接，不跨 writer。

**總監鎖定 UI 文字接口 v1**：保持 `UI.drawLevelUp` 簽名不變，choices 上新增下列可選欄位；舊卡缺欄沿用現有 `d/levelText`，不顯示 undefined。現行 runtime writer 提供內容與規則，Muse 只渲染；R5 靈針快照／UI 文字子交付已收。R6 production 暫停寫入，AGY 只補基線測試，Muse 只做真 Chrome consumer harness／證據；完整 A／E 仍待驗，不加美術或重跑等價 PASS。

| 欄位 | 型別／語義 |
|---|---|
| `type` | 沿用 `weapon/passive`，新增 `charm/mutation/duo`；須有文字分類，不只靠顏色 |
| `skillIds` | 技能 ID 陣列；只由 `WI` 取現役技能顯示名，不判斷資格；通用御守可空陣列 |
| `beforeText`、`afterText` | 字串，runtime 已算好的現在／取得後描述；缺任一端時安全顯示已有內容，不自行補數值 |
| `requirementText` | 字串，已合格卡的取得條件說明；不把未合格死卡放進三選一 |
| `limitText` | 字串，Boss 抗性、數量／派生上限等限制說明 |

主效果與前後差異避免重複堆字；重要條件／限制不得以截字、水平壓縮或只靠顏色遺失。Muse 用同一 fixture 驗真實新增欄位落字及舊卡相容，再做讀前 stub 的 Chrome 選卡視口驗證；這仍不代表新 build runtime 已可玩。

R1 確切接口（皆為 game 閉包內函式，無新增全域模組）：`getBuildState()` 從 WL 取 activeSkills ID 陣列、其餘 charm／mutation／duo 先空；`getEligibleChoices()` 產出當期最多三張合法卡，`choiceId/revision/ok/f` 保留舊 n/d 等欄位；`applyChoice(id,revision)` 嚴格拒絕缺失／過期 revision，只有成功才扣 XP／印與升級；`pickUp` 消費同一函式。舊 f 為一次性效果相容入口，不結算 XP，重抽／重開／成功後失效。`resolveAttackSpec` 目前只有妖刀完整參數消費，由 weapons→風刃保存傷害／射程快照；其他五招返回 metadata，不算完整攻擊快照。舊卡暫不輸出新增文字欄位，避免觸發尚未修好的 UI P1。

R2 共用顯示／命中契約：`UI.levelUpLayout(count)` 讀當前 VIEWPORT，回傳 `{card:{x,y,w,h,gap}, reroll:{x,y,w,h}}`，可另帶 UI 自用 panel／header／footer。game 只消費 card、reroll；Muse 的 drawLevelUp 也消費同一函式。R2 先接 getter 不存在時的現役 fallback（card=90/176/720/108/gap14、重抽沿用 UI.REROLL_BTN），不新增開關或改當前畫面；Muse 接手後提供 getter 與繪製，一次啟用同源配置。

R4 調度決定：getter 存在時 **不要求維持 720×108 基準**，Muse 可局部重排 panel／抬頭／摘要、card.y／h／gap、footer／reroll，仍用同一既有結構；缺 getter 的 game fallback 不動。不因卡片上移而縮掉重要文案。844×390 應 scale=.65、logicalW≈1298.46、offsetX≈199.23、bounds.left≈−199.23；fixture 載真 viewport.js 並按 game 等比變換，或精確鏡像並輸出實值。必要正文／條件／限制以約 14 CSS px 起驗、標題／正文按實際字級 advance 分離，重抽至少 44 CSS px 且命中擴展不侵入卡片。

| 首波 QA | 執行 owner／證據要求 |
|---|---|
| 無變異六招五級、Lv5／覺醒印、四主動含妖刀 | Kilo；既有 `v3-contract-gate`、`boom-behavior` 等按變更聚焦，記命令、退出碼、實際基線與負向結果 |
| 未解鎖／滿欄滿級／去重／空池、過期 revision、快速確認與重抽 | Kilo runtime＋Muse UI fixture；重複確認不能重扣 XP／印或重套效果 |
| 攻擊快照與生命週期 | Kilo；生成後升級不回寫、暫停／死亡／重開不殘留；B 再補 Lv5 三變異疊加與 Boss 抗凍 |
| 八關詞庫與故事、受影響流程 | AGY 真資料不變量；Kilo 必要時重跑 `kilo-stage-flow`／`kilo-stage3-8-flow`；歷史 55/55 不作本輪 PASS |
| 真 Chrome consumer | Muse；桌機、844×390／平板視口、焦點、長文、console／pageerror 與截圖；B 後觀察選卡到攻擊結果，不以 fixture 代替 |

Node 逐檔白名單命令使用 `node --require ./tools/director-audio-freeze.cjs --test <files>`；不得全庫 `npm test` 或 media-cache 建置。Chrome 使用既有 `tools/director-preview.cjs`，讀檔前 stub `audio.js` 並阻擋音檔；靜音不算隔離。現有 guard 不涵蓋所有凍結目錄，仍須遵守不碰 `art/audio/**`／KEY 的白名單範圍。

本輪 Codex 獨立執行證據（SHA-256 前 16 碼識別工作樹版本，非 commit）：

| 命令（均先 `node --require ./tools/director-audio-freeze.cjs`） | 結果／版本與限制 |
|---|---|
| `--test tests/agy-m1-contract.test.cjs` | 6/6 PASS，exit 0；測試 `ae17f6c1bd73654e`，words `065f452dabb20e55`、story `d2a7891def97a960`；六／十／四 runtime 尚未驗 |
| `--test tests/v3-contract-gate.test.cjs` | 21/21 PASS，exit 0；測試 `55ebf4b97bb5e913`、game `a884811affddfcaa`；配送／覺醒／讀題與部分 Lv5 邊界基線，不是六招×五級全覆蓋，也不是新 M1 gate |
| `--test tests/v3-ui.test.cjs` | 13/13 PASS，exit 0；測試 `15ce48f32bed2196`、UI 當時快照 `1f255ff843d26fa1`；既有 HUD／覺醒／題板／結算回歸，不證明新選卡可讀或新 build 可玩 |
| `--test tests/muse-m1-choice-viewmodel.test.cjs` | **9/10、exit 1**；測試 `195d4c618fae2153`、UI `1f255ff843d26fa1`。B4 失敗：手機標題／正文行距實際 18、需至少 26；與 `shot-mp.png` 重疊／越卡一致。先前 10/10 被此正確負向取代，不列全 PASS |
| `--test tests/agy-m1-runtime.test.cjs tests/v3-contract-gate.test.cjs`（R1 新交付） | **28/28 PASS、exit 0**；game `6f39c298c5c4a0d5`、新測試 `f8b4fc2cc0a6bdf1`。包含舊 f 過期／一次性、revision、空池與妖刀真 consumer。另以同一 VM loader 獨立重現被動 f：修前 true/true 且再次改值（exit 1），修後 true/false、不再改值（exit 0）。語法／diff 檢查 PASS；沒有執行新 Chrome／自然局／真機 |
| `--test --test-name-pattern='M1-RUNTIME-(8\|9) ' tests/agy-m1-runtime.test.cjs`（R2 新增） | Codex 獨立 **2/2 PASS、exit 0**；game `5b06e73101649adb`、測試 `bfa45803c3698500`。缺 getter 回落、改座標後真 pointerdown／pointermove、舊熱區負向。另用同一 VM loader 注入新配置，驗新版重抽實際事件扣次數／推 revision、count 正確轉交，exit 0。未重跑等價 R1／21 契約；AGY 自報 9/9＋21/21 僅作交件紀錄 |
| `--test --test-name-pattern='^(A5\|A7\|B4)\.' tests/muse-m1-choice-viewmodel.test.cjs`（R3 收件） | Codex 獨立 **2/3、exit 1**：A5／A7 PASS、B4 間距 18＜26 RED。UI `2b187627d3faee53`、測試 `94da59e8ebd7661d`、fixture `5f236134a63ef3ad`；語法／scoped diff 檢查 PASS。Muse 自報全檔 10/11、exit 1，不冒稱全綠。新增三圖已實看但手機未進加寬分支；無自然局／真機結果 |
| `--test tests/muse-m1-choice-viewmodel.test.cjs`（R4） | Codex 獨立 **12/12 PASS、exit 0**，UI `83d4fe89877c2331`、測試 `6fc8875148ec47cb`；B4／B5 手機 glyph／長卡／Duo 受測案例轉綠，語法／diff 檢查 PASS。三圖已實看、fixture 真 viewport／等比 offset 源碼已核。沒有真 game／自然局／實體裝置結果 |
| R4 同一測試 loader 的獨立字級斷言（`node --require ./tools/director-audio-freeze.cjs -`） | `loadUI(900,600)` 真 drawLevelUp 的 fillText traces，三張含「限制：」必要 meta 實際 `[12,12,12]`；要求≥14 CSS px，**exit 1**。現有 12/12 未涵蓋此缺口，不能用全綠宣稱 E gate；已交 Muse R5 補負向與源碼 |
| `--test tests/muse-m1-choice-viewmodel.test.cjs`（R5） | Codex **14/14 PASS、exit 0**；UI `e93c748e22d32b8a`、測試 `b8d89fa921a5f0d8`。新增 C1／C2 補三視口必要字級、受測 frost／Duo 各字段全文與真名稱；字級改變換行，故驗此檔受影響案例。三圖已實看；非真 game 路徑／自然局／真機 |
| `--test --test-name-pattern='M1-RUNTIME-(10\|11) ' tests/agy-m1-runtime.test.cjs`（R5） | Codex 新增 **2/2 PASS、exit 0**；game `6cde3bf7aef4e25c`、測試 `f0534fb3347d95dd`。有實際 weapons 邊界與 needle 生成／去重／重開；未涵蓋六招全級／暫停／死亡。未重跑舊 R1／21 等價 PASS；AGY 自報 11/11＋21/21 僅作紀錄 |
| R5 同一 runtime VM loader 的獨立碰撞／同源 consumer 斷言 | 發射後提高 b.dmg 並把技能升 Lv3，再讓舊針真碰撞，實際傷害 **2.519999999999982≈2.52**、exit 0，確認不是碰撞時再乘新 b.dmg；另實際 UI getter＋game 手機卡片／間隙命中 PASS。這是 VM consumer，**不是 Chrome 整合** |
| `--test --test-name-pattern='M1-RUNTIME-(10\|12\|13) ' tests/agy-m1-runtime.test.cjs`（R6） | Codex **3/3、exit 0**，測試 `7cc15077d7b74de9`；game／UI 仍 `6cde3bf7aef4e25c`／`e93c748e22d32b8a`。已核三十組真 weapons／固定係數，pause／levelup／lost／start 有真 update/frame 路徑。RNG 共用宿主、won 被 setState 強制，需 R6.1 修正後收生命週期完整結論；不重跑舊21等價 PASS |
| `--test --test-name-pattern='M1-RUNTIME-(0\|10\|12\|13) ' tests/agy-m1-runtime.test.cjs`（R6.1） | Codex **4/4、exit 0**，測試 `5549aabbcb756cf8`；只驗新 RNG 隔離及受影響基線／自然勝利。已讀真條件 delivered10＋finalBossDefeated→update 觸發 victory、110 個50ms frame→自然 won，無手動 setState(won)。lost／won 保留陣列但停止運算，start 重開清空，無幽靈傷害；production game／UI SHA 不變，非自然完整局或真機 |

測試盤點補充：`boom-behavior` 多項自行模擬投射邏輯，不能單獨證明 game 真 consumer；`kilo-b5-balance` 仍含舊 Lv36–40 目標，不能覆蓋 GDD 的 27–33 觀測方向。首波不改這些他人舊測試，以新 Kilo runtime 契約補必要缺口。AGY 已核現役 `UP.dmg/rate/spd/dash/mag/shield` 與五御守有重疊，reach 無通用 UP 對應；C 必須集中計算、保留既有上限／護盾順序，不另套一次倍率。

**M1-E 可讀性審查（Codex，game-ui-accessibility-reviewer，R5 收件）：** 初版／R3／R4 證據保留；新 `muse-m1-r5-20261016/shot-dt.png`、`shot-mp.png`、`shot-tb.png` 已實看。手機真 viewport／等比配置沿用 R4，R5 桌機／平板補充字加大且受測內容未見重疊／越卡；仍為受控 UI fixture，非真 game 選卡路徑。

| 審查項 | 判定／處置 |
|---|---|
| 阻塞／重大問題 | R5 必要 meta 14px、受測全文／Duo 映射已收，三圖未見原 P1；仍缺真 Chrome game 選卡／攻擊事件與可核錯誤證據，整體 E 未結案。AGY 六招全級／生命週期另有缺口，不能以 fixture 綠燈跳過 |
| 次要問題與證據限制 | 框線＋圓點焦點、文字分類已觀察；假名偏小、實體手把未驗。R5 圖片仍掛 R4 舊標題，空 console 檔不作無錯誤；Muse 回報 #err／IMG／DRAWN／VP，但未持久保存可核 DOM。R6 須留固定版本／事件／錯誤 JSON，不能把截圖成功當無錯誤 |
| 建議修正 | Muse R6 在固定 production 版本的真 Chrome game 消費 offerUp／apply／pointer／鍵盤／重抽，保存小型結果與錯誤；AGY R6 只補自身基線測試。缺陷先報，協調後才串行修 production |
| 視覺風險 | 任意擴框或新增程序面板會破壞核准風格；移動卡片卻不改 game 熱區會誤選。只以核准圖切片與文字局部調整 |
| 建議折衷 | 保留 R4 重排及現役核准底板，僅調必要文字與驗證；不擴成新 UI 系統、不降低必要字級或丟獨有語義。Muse 只改 UI，AGY 只改 game；兩票穩定後真頁整合 |
| 接受標準 | 真 Chrome 桌機／手機／平板必要文字不漏、不重疊、不越卡；字級可讀、44 CSS px 操作與焦點維持；繪製／點擊共用配置，錯誤紀錄與版本有證據。再驗選卡到真 runtime；缺實機仍 WAITING_DEVICE |

目前 runtime 路徑依使用者 15:38 追問授權改派 AGY，沒有切換模型、增加 Agent 或擅選付費服務。Kilo 不盲重試。R6.1 基線／生命週期子 gate 已收，AGY 停檔保護固定版本。Muse R6 在先前 setup timeout 診斷後已進入真頁選卡／鍵盤測試，尚未正式交件，不先宣稱 Chrome PASS。Codex 已送 profile／CDP 錯誤／真 artPending 建議，未越 writer 代改；production 仍固定。

R1 審查中的邊界事件：AGY 執行一次 `rg -n "skillIds" js/`，未排除凍結的 `js/audio.js`，不符合唯讀禁令；Codex 已立即要求停止目錄掃描、後續只明列安全檔案，不補讀／hash 音訊查證。沒有音檔讀取、修改或外部音訊呼叫的交付證據，但不能因此宣稱整輪零凍結路徑讀取；禁令持續有效，此事件不作為音訊功能驗證。

R2 **一次性** Herdr 完成回呼已實際送達：`agent wait w7:p4` 成功 settled 後向 Codex `w7:p1` 提交收件事件，背景 exec session `19966` 已 final exit 0；本輪已完成「讀交件→獨立驗收→交 Muse→更新 roadmap」，完整鏈驗一次。後續僅對具體當票掛一次有界回呼，不輪詢、不重試失敗、不自動回答審批、不授權發布；非恢復舊常駐監工／checkpoint。回呼不是新增使用者授權，後續停止或改向優先。

R3 單次回呼已送達，背景 exec session `47191` final exit 0；Codex 已核 recent／diff／focused／三圖，判 NOT_PASSED 並派 R4。回呼鏈成功不等於 UI gate 通過。

R4 單次回呼已送達，背景 exec session `31340` final exit 0；Codex 已核 recent／實際交付／12 測／三圖及額外字級負向，分級收件後派兩張 R5。沿用停止／改向優先及不重試／不代答審批邊界；回呼不是 gate PASS。

R5 收件機制風險實證：AGY `85693` final exit 0、捕捉到 done／completion168，回呼送達時現場已 working／seq169、仍 Editing，game／測試檔正在變動，沒有正式報告；這次**只是過早通知，不是交件**。Codex 未驗收／未重派／未在變動檔上重跑測試。`agent wait --help` 證實預設匹配 idle／done／blocked，無正式交件語義；不再對 AGY 盲重掛。已送一次機制補充，要求真正 focused 完成後停止寫檔，再由 AGY 向 Codex 提交一次「M1-A-R5正式交件並停檔」及版本／結果；原票繼續、不新增範圍。

R5 後續已收到 AGY「正式交件並停檔」含 SHA／結果；Muse `50412` 也已回呼、final exit 0，本輪才核差異並分級收件。R6 兩人均已收到「真正驗證完→停檔→送一次正式交件及版本／結果」要求；不重掛會過早觸發的 AGY wait，不以回呼新增授權，停止／改向優先。

下一 gate：M1-A 實際交付＋契約／基線與接口交接驗證後，依序派 B（三變異疊加）、C（六御守）、D（十變異四 Duo）、F（保存），Muse E 持續隨接口整合，最後 G 一次重玩 gate。M1 最終仍要求至少三種 build 真頁路徑及約十分鐘完整流程；自然真人三局與實體裝置依 M3 單列，不互代。

里程碑報告：**R6.1 六招基線／生命週期子 gate TARGETED_PASS（Codex 4/4、exit 0）**，RNG 隔離／自然 won 證據已補，game／UI production SHA 維持凍結。R5 靈針快照／UI 文字保留已收結果。**Muse R6 真 Chrome 整合仍進行中**；AGY 有依賴地停檔，固定版收件後即接 B 靈針散射→追蹤→冰封漸進實作，不把 idle 當完成。其餘四招完整快照、六御守／十變異／四 Duo／保存與重玩尚待製作，**M1 IN_PROGRESS，M1–M6 均未結案**。未驗自然局／實體裝置、未部署，音訊凍結持續。
