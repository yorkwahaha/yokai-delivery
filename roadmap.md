# Yokai Delivery — Roadmap／跨對話持續交接

## 唯一新方向／索引｜2026-10-16 Stage1-first

**使用者最新定案：先把第一關夜行町做成可完整重玩且精緻的 roguelike 垂直切片，再逐關擴充。** 其他關美術與單字聲包之後逐關替換，不阻塞第一關玩法深化。本節及三份權威文檔覆蓋下方所有過期派工、等待美術才能寫功能、額度／路由、舊 M1/M2 與 checkpoint 自動執行指令。

| 唯一現行權威 | 用途 |
|---|---|
| [GAME_DESIGN_MASTER](docs/GAME_DESIGN_MASTER.md) | 官方玩法、六御守／十變異／四 Duo、鏡頭／美術、API、成功指標與待審 |
| [PRODUCTION_PLAN](docs/PRODUCTION_PLAN.md) | M0→M6 的製作順序、相對 Sprint、owner、依賴與驗收 |
| 本 roadmap 頂部 | 已驗事實、待複核缺口、目前階段及下一張票 |

[AGENTS.md](AGENTS.md) 是短協作入口，由 Codex 與上列兩份新文檔一併獨占；其他 Agent 不修改這四檔。不掃全庫 docs/art；舊總計畫、甘特、執行看板與重啟交接按需作證據追溯，不能再各自成為派工來源。

### 2026-10-17 11:35｜Codex 額度暫停、臨時總監接管

**M1 IN_PROGRESS，Codex w7:p1 idle；最後5h額度約2%。** ChatGPT暫代總監，已建立每小時條件檢查：即時證實五小時額度回升至少80%、不撞writer後才交接回Codex，不提前喚醒。

- **AGY w7:p4／HOUSEKEEPING-P1**：使用者授權整理原約388筆dirty，限已驗證低風險、非敏感、非素材的QA工具／測試／非權威文件，分組白名單LOCAL commit。不可碰game/UI/STORE、四權威、音訊/KEY/env、未審藝術、未知檔，不可全庫stage/刪除；交付每筆hash與測試。
- **Grok w7:p7／E-R12.3**：舊340K/500K session保留，已以/new建新session 01a147f1-ccca-7071-881e-33b2292dbdf0，實測Grok4.7 high、4.5K起始；唯一js/ui.js＋tests/grok-m1-e-r12.test.cjs writer。修844×390真Chrome卡片截字／按鈕貼底，驗四Duo合法pair及mouse/touch/keyboard appliedId、levelup→play；不碰game/store。
- **Space Bunny w7:p5／E-R12.2-QA5**：唯讀交件，已驗真Chrome/CDP但發現手機文字像素裁切，鍵盤只移焦與重抽未套卡、套卡後play未斷言、summary缺exitCode/storeSHA，舊6/6非最終gate；R12.3停檔後再驗。
- **安全線／恢復**：原啟動HEAD 738e5aa，後續以實際git為準；M1整體未驗收、不進M2。保留所有dirty及音訊/KEY/母版凍結；禁push/deploy/reset/clean/checkout。Codex重置後核最新HEAD/agent交件/原RED→GREEN，再接回總監及M1-G真頁Gate。

### 現場狀態與重要已完成事實

| 項目 | 已有事實／證據來源 | 保留限制 |
|---|---|---|
| 八關詞庫／故事 | 164 unique words；前七關 27/27/22/22/21/24/21；S8 164 詞總複習。既有 `js/words.js`、`js/story-dialogue.js` 及 `docs/season-one-content.md` | 不刪長詞、不以新系統改 stageId／word ID，不表示正式聲包齊全 |
| 八關共用流程 | 使用者 2026-10-16 提供最新 55/55 targeted contracts 基線；較早 Kilo 交接記 13/13 S1–2、9/9 S3–8 加速流程 | 本輪未重跑；加速不是真人十分鐘、真機、所有 slot 或藝術封版 |
| 技能基線 | `js/game.js` 六招各五級、四主動含固定妖刀及現役 Lv5 特性 | 不被御守、變異或 Duo 取代；新 build 層尚待製作 |
| 收藏／保存 | C1/C2/C5 及 C4 工程已有歷史驗證，包含跨關唯一 ID、印記、機率、套卡冪等與 storage 錯誤處理 | C3/C4 視覺／實機另驗；收藏不得提供戰鬥數值或成為主線門檻 |
| 旅路／選關 | 八關入口、連續旅路及 dev 選關已有工程紀錄 | 正式／dev 保存隔離與後續新增解鎖仍須回歸 |
| 鏡頭基準 | Canvas2D tilt=.60、房屋 Y 1.20、2D 回退；S1 切鏡曾由使用者回報正常 | 不等於所有設備冷開／FPS 通過；P0 慢載現象曾 NOT_REPRODUCED，不能捏造新修復 |
| 已核准素材 | S1 現役風格基準；S2 石木 v2、Shiome／Ikari 指定 rework 圖已有核准記錄 | 單圖核准不等於整關；不得重生或覆蓋核准母版 |
| 本機 checkpoint | HEAD f175244（四權威文件），父52c9366/3bffe44/d7b4981 | 四個LOCAL，不重做/不reset；文件13權威連結/精確stage四檔/內容SHA一致/cached diff-check exit0，提交後index空、391 status entries保留，未push/deploy |

55/55 的精確測試命令、快照與產物由後續 owner 交接補齊；目前採「使用者提供的已完成基線」口徑，不虛構本輪獨立執行證據。其他歷史 PASS 僅對當時快照有效。

### Codex 已恢復總監／本輪唯一現行派工（2026-10-17）

**最新調度／2026-10-17 固定SHA收件與續派：M1 IN_PROGRESS，gate NOT_PASSED。** R14 runtime子票 TARGETED_PASS：固定game 99e374b1f681f20e／D 1f2c36a77972671c／runtime 9d4e073f9e89bab6，正式停寫/idle後Codex獨立D82–88＋runtime12 8/8、exit0；原雷紋Lv5+power/3敵2.24→2.2401反例GREEN，實扣2.240000000000009（容差1e-9）。額外stdout探針真投符→黏附→引信→餘燼，cast3符共享一次、出生life.8/delay.3、3敵各.216合計.648、第四/盾0、一次tick無狀態派生；真offer/apply(seed3)在途舊3符false/新3符true且只1處，兩命令exit0。受控VM/武器時鐘與fixture敵人，非Chrome/自然局/實體。驗收前後game/D/runtime SHA一致，scoped diff-check exit0。 E-R12 NOT_PASSED（Chrome證據）：UI 6593da982bf5644b／test 600d829c93829bd2，未重跑已知6/6。總監源碼核實harness只算scale/offset卻未套ctx transform，且body/canvas非真頁CSS；已實看chrome-mvbrzxpt/mp.png左裁字、tb.png溢出/scrollbars。logical card.x=-85/panel.x=-113不能單獨判正式UI裁切，須套真game變換。BROWSER_CAPTURED不代表BROWSER_VERIFIED，fixture非真offer/apply；退同票E-R12.1核真正卡/完整pair與before/after/限制、14CSS/44CSS/三視口bounds及觸控鍵盤真事件。 F-R1既有13/13保留，不重跑等價25/25；STORE5fe53548a3de8740。現場400 dirty全保護、音訊/KEY/env凍結，新LOCAL commit授權與既有兩筆checkpoint見下節，未push/deploy，不進M2。

### 2026-10-17 新授權：安全 LOCAL checkpoint（不 push／deploy）

使用者已授權分批本機提交已驗收成果，覆蓋下方歷史不 commit 條款。最新文件checkpoint HEAD `f175244`（Codex，僅四權威文件）；前三筆 `52c9366`／`3bffe44`／`d7b4981` 由使用者／MCP1完成，不重做。52c9366是contract＋E11兩測試（使用者與D/runtime合跑111/111，只stage兩檔）；3bffe44是guard＋自測（root本輪2/2 exit0）；d7b4981是STORE＋F-R1（使用者25/25、既有root13/13保留）。暫存區已核空；不是異地備份。

| 分組／status entries | 本輪處置／可提交條件 |
|---|---|
| 四權威文件 4 | Codex完成本次一致性／diff／連結檢查後同主題逐檔stage並local commit |
| production 6＋tests 62 | game/UI/G-R1/E12.x仍在工作或待QA；其他檔缺目前版本驗收，不按名稱/歷史PASS stage。正式停寫/固定SHA/必要契約GREEN後code＋tests成組 |
| 其他文件 76、工具 80、未知項 3 | 未逐項驗收，不因相似名稱批量提交；現役audio-freeze已在3bffe44，勿重複 |
| 凍結項 141 | 只作路徑盤點；音訊/TTS/KEY/env等不讀不stage |
| 素材項 23（含折疊art/） | 核准母版與未審候選均保護；未逐件核准分類，不以名稱判定安全，不stage |
| ignored 159 entries | 驗證原證據/衍生/歷史保留、不強制add、不清理；不是159個檔案的精確計數 |

以上是文件checkpoint前395個status entries（原397快照後52c9366提交兩測試）的路徑分類，含折疊目錄，不等於397件已審內容。每批只用 `git add -- 白名單`，先核 `git diff --cached --name-only`／`--check`、必要測試與HEAD，若混入未知暫存內容即停，不擅自清理他人index。禁止add ./-A/-u、reset/clean/checkout、push/deploy。

**新RED已固定版獨立重現：** 使用者MCP1整包TEST_EXIT=1後，AGY G-R1正式idle/停寫；game c39d10／C test e3756beb2fdff882固定，root `--test-name-pattern='M1-C-11'` exit1 at797、`'M1-B-12'` exit1 at769（皆audio-freeze）。C11同測試記憶體觀測實得eligible=[duo:duo_inkfire]、duos=[]，舊空池前提是假；原失敗保留，不改game藏卡。AGY G-R1.1獨占自身B/C修正合法池與反向；D/runtime多餘EOF空行由其僅清尾端，SHA將變且重驗。未GREEN不提交整包B/C/D/runtime/G為已驗。

| 現行Agent | 任務／寫檔權 | 實際狀態／交接規則 |
|---|---|---|
| Codex `w7:p1` | 總監／獨立QA／四權威文件 | working；native頁尾無本輪context/額度數值，記UNKNOWN，不沿用08:13舊快照、不重開session |
| AGY `w7:p4` | G-R1受控結算子票root4/4與原race反例已收；G-R1.1測試退修 | game c39d10b03ff8dc7e正式凍結；現只自身B/C/D/runtime/G tests，送票exit0/working且已見B/C讀檔。原B12/C11 focused各exit1，C11剩duo_inkfire，修真空池/負向/seed/持久race/EOF空白，不碰UI/STORE |
| Grok `w7:p7` | E12/E12.1證據NOT_PASSED→E12.2同票退修 | E12.1正式idle/test5eaa441f05fa771c；原Chrome tutorial:true教學遮罩且非法六主動fixture。E12.2已派exit0/working，限UI/自身E12測試/新run，先修教學/合法pair/真CDP與實繪量測；UI6593da982bf5644b，native321K/500K，不重開/換模型 |
| OpenCode／Muse（原`w7:p6`） | 暫停全部M1寫入與請求，原UI權交代理 | 最新agent list已無此pane，未重啟，不推定額度恢復；保留PAUSED。10/17 08:00預計恢復，不自動切回；Grok完成當票→Codex驗收→評估交回 |
| Space Bunny／OpenCode `w7:p5` | F-R2真幀保存邊界TARGETED_PASS／正式停檔idle | root獨立3案例stdin Node audio-freeze exit0，game c39/STORE5fe535/UI6593前後不變；failed won舊JSON不變/警告可見/reload未解鎖、lost不清關、dev won只dev key，均finish1次。受控終局fixture/VM，非Chrome/正常全局；暫待G/UI固定版新負向，不填busy |
| Muse Spark／原Kilo | Muse1.3 Free已下架（使用者確認）；原Kilo停用、不再參與 | F-Q2現由使用者選定Space Bunny接管；撤銷Muse候選WAITING_ROUTE_AUTH作為現行blocker，不再核路由／登入、不發Cloudflare或Muse請求、不恢復Nemotron |
| OpenCode Kiro（歷史`w7:p8`） | 無現役pane、舊F-Q2未交付且已停；本輪不參與 | 舊plan路由能回覆／讀檔但無QA結果，僅歷史，不再等待同模型執行agent決策。現行F-Q2是p5 Space Bunny全新明確接管，不能混作Kiro已成功或重試舊請求 |

OpenCode未交內容是M1-E新變異／四Duo的顯示、前後／條件／限制、長文／手機焦點與新build整合／教學；舊R9失敗已由AGY R9.1及Codex獨立6/6修復收件，**不再當成待重做票**。Grok唯讀校準曾混列舊R9缺口，首票須明確校正版本先後，再延續現役UI。卡片圖鑑僅保留角色範圍，非本票可隨意改寫白名單。音訊／KEY凍結，395筆原dirty保護，無提交部署。

E-R10命令阻塞已診斷：Grok擬用PowerShell將UI diff寫到白名單外 `I:\WinTemp\ui-focused.diff`，Codex檢視後拒絕，未批准always-approve，該turn取消；不是provider／額度錯誤。已送同票安全續行exit0、observed working：延續已讀上下文，改用內建read/search/edit，不寫未知暫存檔；若測試命令仍需審批，正式交精確安全命令與未測限制，由Codex執行QA，不原樣重試或讓UI實作空轉。交接後現場dirty396筆，保留既有未提交成果。

**E-R10實際驗收NOT_PASSED**：UI SHA256前16 `0943480b4990b7cb`／測試 `e0a01300c1d63a99`；交件所報40位雜湊非本輪SHA256口徑。Codex原測試4/4 exit0，但Duo雷紋陣fixture是 `barrier,needle`，正確應 `barrier,thunder`，額外獨立斷言exit1；映射斷言可用「或包含影響」逃過錯誤、所稱負向只是另一組正向，未證會抓錯。必要CSS字級應fontSize×scale，原測試只比logical；總監另測此受測VM案例桌機15.56／手機14.30／平板14.93CSS，僅此子案例可收，不是Chrome。摘要於test callback前寫死done:true／舊hash，重跑得到viewports空陣列；無真Chrome截圖／錯誤捕捉證據。總監驗收重跑因此覆寫原固定摘要，已從執行前完整讀值補存 `artifacts/validation/director-m1-e-r10-20261016/grok-delivery-summary-recovered.json`（明標欄位復原，非byte-identical備份／通過證據）；後續改獨立run目錄，不再覆寫舊證據。UI先停檔，Grok E-R10.1修真正契約／負向／摘要並補純UI真Chrome三視口；AGY D-R2繼續，不撞檔。

使用者最新明確指示「恢復遊戲總監、先驗 C-R1／E-R8，再持續完成 M1」，覆蓋下方 17:11 暫停／19:00 前不喚醒的歷史安排。Codex 已讀最新交接、實查四個現有 pane 與同一工作樹；沒有重啟禁用 Agent、切模型、提交或部署。**M1＝IN_PROGRESS；六御守／十變異／四 Duo／保存與重玩未全交齊。** 下方舊 R6 working／game 凍結與舊首波 Next 均僅對當時版本有效，以本節覆蓋。

| 狀態 | Owner／票 | 實際證據／下一步 |
|---|---|---|
| Done：M1-C-R1 三御守子交付 | AGY `w7:p4` | Codex 獨立 C 7/7、exit 0；game `51e67de5fcc628f5`。另以同一真 VM consumer 驗：power 針傷2.52→2.94、step .05秒位移11.5→12.9、gather距150吸附0→3.45且gem值5。六招基線／三變異疊加／快照／覺醒另4/4 PASS；非完整 C gate |
| Done：M1-E-R8 三御守顯示子交付 | Muse `w7:p6` | Codex 獨立6/6、exit0；新桌機／844×390／平板三圖已實看，證據 `artifacts/validation/muse-m1-r8-20261016/`。UI `e93c748e22d32b8a`；是 mock／fixture，空 console log 不列無錯誤，不當真御守 consumer gate |
| 已收件／未過：M1-C-R2 | AGY `w7:p4` | Codex獨立自身C **11/11、exit0**，語法／scoped diff PASS；game `0ffa53cd27aaf0c9`、測試 `f56692576471d29f`。額外真hurtPlayer負向 **exit1**：guard把0／.01／.05傷害都變.1，不能採認「未完成項無」，完整C未過 |
| Done：M1-C-R2.1 runtime修正子交付 | AGY `w7:p4` 正式停檔；game固定 `736e43d2e4132ffe` | Codex獨立C9／C11／B12／runtime12 **4/4、exit0**；原真hurtPlayer負向重現轉GREEN：0→0、.01→.009、.05→.045、.5→.45；無效輸入／盾／inv／浮字／非戰鬥耗油通過，語法／diff PASS。C測試 `afb24d44dbcabb3b`；完整C待真頁 |
| NOT_PASSED／M1-E-R9 | Muse `w7:p6` idle、rate limit，停檔不重試 | 實際 `artifacts/validation/muse-m1-r9-20261016/r9-summary.json` 為 `done:false`，缺 charms-3／full3-exhaust；空池證據仍有 mut_frost／mut_seek。numericDiff(BuildState／needleSpec) 不足證 step／gather／guard 真效果；五主動空池 setup 非合法 build。game／UI前後固定，pageErrors空；有404／vibrate警告，不稱console乾淨 |
| Done：M1-E-R9.1 真consumer子gate；C六御守可收 | AGY `w7:p4` 正式停檔，Codex獨立驗收 | harness `558f0e02f3a02ee1`、game／UI固定；Codex原斷言 **6/6、exit0**，`artifacts/validation/director-m1-r9-contract-20261016/` done:true。真選卡power／step／gather及效果2→2.2／23→25.8px／距150吸附false→true；合法四主動含妖刀全Lv5空池list:[]、revision／連按／重抽／覺醒正負／觸控／鍵盤通過。非自然局／非實機；整體E仍有D新卡與教學待驗 |
| 收件／NOT_PASSED：M1-D-R1 | AGY `w7:p4`，game `25eba8a13e6e24f0`、D測試 `a7fb345fced59798` | Codex新D **7/7 exit0**；容量、延遲側斬、基線與清理子案例有實作。但新增真consumer負向 **exit1**：同一已排入側斬在真applyChoice(passive:crit)升級後，傷害 .72→1.296，命中仍讀新b.crit，違反生成時快照；「未完成項無」不採認。AGY自報44/44非本輪獨立重跑 |
| Done：M1-D-R1.1 暴擊快照修正／crosscut runtime子交付 | AGY正式停檔，game `ef4b79cbdb56bc85`／D測試 `e2071d62a358a3cd` | Codex只跑新D8／9／10＋受影響runtime12 **4/4 exit0**，語法／scoped diff exit0；同原真applyChoice(crit)反例獨立重現GREEN：舊cc .72保持.72，新cc1.296。風刃快照、射程角度、盾／死亡與六招30組基線通過；不把自報10/10等價重跑或假稱真Chrome／完整D |
| Done：M1-D-R2 pulse runtime子交付 | game `84d954cb171c452a`／D測試 `f010f064fca52c63`，AGY正式停檔 | Codex新D11–16＋runtime12 **7/7 exit0**，語法／scoped diff exit0；雙脈衝半徑.85×、各.5傷、.18s延遲，Lv1 .24+.24=.48；Lv4 45+45=90且Boss免擊退，Lv5單一220/1.8s結界不重建。另真update pause/levelup凍結：hp99.76/delay.17均不變，恢復總傷.48/queue0。非真Chrome／自然局／完整D；74/74未等價重跑 |
| Done：M1-D-R3 branch runtime子交付 | game `dbee4d07bad862c3`／D測試 `f0519577ede39387`，AGY正式停檔 | Codex新D17–22＋runtime12 **7/7 exit0**，語法／scoped diff exit0；次級至多1敵／主雷25%／180×reach半徑／不再分支。額外真consumer：Lv5傷9.6×4＋2.4×1，其他鄰敵0，實際3storm＋3stormChild＋1branch；真offer只出branch→apply扣一次XP／重按拒絕／已選排池，未用setChoices。非Chrome／自然局／完整D；D22未真正測升級中途回寫，雷擊本為即時傷，不能冒稱飛行隔離 |
| NOT_PASSED：M1-D-R4 pierce | game `6f93c38b5e3299e3`／D測試 `c37900ce589276e0` | Codex新D23–28＋runtime12 **7/7 exit0**，語法／scoped diff exit0；但原測試把1→1.15→1.30→1→1當正確，違反各+15%／總增額30%。獨立同真consumer反例 **exit1**：基傷2.52，增額1.134（45%）>允許.756（30%），證據 `artifacts/validation/director-m1-d-r4-20261017/mvb7b10e/budget-counterexample.json`。首個複合shell最後check exit0不代表中途AssertionError通過；已分開重現並留獨立exit1，未以數量收件 |
| Done：M1-D-R4.1 pierce runtime修正 | game `1ab6695eea73bac2`／D測試 `a4efb0e38c3d4c2e` | Codex受影響D25–28 **4/4 exit0**，語法／scoped diff exit0。原五敵反例GREEN序列2.52/2.898/2.898/2.52/2.52，增額.756=.30×2.52。獨立fan6針30碰增額3.26592、Lv5 8針40碰14.112／11針55碰13.97088，均等於各cast快照針傷總和×.30，無額外hit事件、Lv5共享volley未重複。真offer僅passive:dmg→apply，舊針4.2336/4.86864/4.86864、新針5.292，未用setChoices。證據 `director-m1-d-r4-1-20261017/mvb7z13x/acceptance.json` 的2個已過案例及 `mvb7zz0n/acceptance.json` 的3個已過案例；前兩附加輪exit1為總監快取重建array／將Lv5曲線針放牆內，原失敗保留，不冒稱整輪PASS。逐敵放針位weapons(0)屬受控VM碰撞，不當自然飛行／Chrome。D27仍用敵數推基傷、D28仍setChoices，後續持久測試收斂；不影響此次獨立真consumer收件 |
| Done：M1-D-R5 return runtime子交付 | game `d2642de748ce92e9`／D測試 `f55db53e148441d7` | Codex新D29–34＋改D27/28＋runtime12 **9/9 exit0**，語法／scoped diff exit0。往返同Set／pierce預算不重置、單次轉回生成點、壽命不延長。額外開放場地VM真步進：Lv5 8／11針各折返1次，.65／.67秒消散≤原life.95，共享volley；`director-m1-d-r5-20261017/mvb8tb8m/acceptance.json` 保留兩個已過案例，該輪整體exit1因RNG.9999只抽seek/frost而未抽到return。改RNG0、不改production／setChoices，真offer return/frost→apply一次XP37、舊針不加return、新11針生效，`mvb8u195/true-offer.json` **exit0**。非Chrome／自然局／實機；D29仍手塞卡備援與D28未知charm_greed列R6收斂，不據此改寫完整M1 gate |
| NOT_PASSED：M1-D-R6 orbit | game `f899d815b5c74c3c`／D測試 `38575def268f82ad`；原票正式停檔 | Codex新D35–40＋修D28/29＋runtime12獨立9/9 exit0；但真dragonFireball producer→weapons反例exit1：groundTarget落地應[4.8,4.8]卻[14.4,4.8]，新增enemies.find把一隻濺射敵升為直擊。真正非ground接觸[14.4,4.8]須保留。證據 `artifacts/validation/director-m1-d-r6-20261017/mvb9t2xs/ground-impact-baseline.json` done:false，受控VM非自然局。D39錯oracle／D37同公式自比不得作無缺口證據 |
| Done：M1-D-R6.1 orbit／fire修正子票 | game `27f2efb6f6412d62`／D測試 `bc741015d8508a19`；AGY正式停檔且Herdr done | Codex新D37/39＋受影響runtime12 **3/3 exit0**，實際paint/play參數、真offer升級的球／焦土與六招30組通過。另真factory→weapons原反例GREEN：ground[4.8,4.8]、contact[14.4,4.8]；龍生成未吐球時真offer僅passive:dmg→apply後，舊三球14.4/4.8/2.16、新龍18/6/2.7，無setChoices。新增獨立證據 `artifacts/validation/director-m1-d-r6-1-20261017/mvbalygi/acceptance.json` done:true／exit0，非自然局／Chrome／實機；自報77/77未等價重跑 |
| NOT_PASSED：M1-D-R7 splitblast | game `947ea4dc802a44c3`／D `416725fe0ed9287c`／runtime `3f853934423b73ce`；AGY正式停檔 | Codex新D41–46＋runtime12 **7/7 exit0**，獨立語法／scoped diff exit0。但真weapons發射→黏附→fuse主爆以.05s步進，mainAt1.701當幀sb.delay=.13，主爆後.15s即多扣.66，應至少.18s；新queue被同幀整段dt提早扣。獨立反例 **exit1**，`artifacts/validation/director-m1-d-r7-20261017/mvbbbiuc/secondary-timing.json` done:false。D41手塞卡、D46手造符／手改dmg與變異，不能冒稱真路徑；所稱boom滿3排池只驗長度1，不採。自報60/60未等價重跑；受控VM非自然局／Chrome／實體 |
| Done：M1-D-R7.1 splitblast退修子票 | game `595132b1d389614f`／D `de8cbd3604043fcf`，正式停檔且Herdr done、前後SHA相符 | Codex新D41/43/46＋runtime12 **4/4 exit0**，獨立語法／scoped diff exit0。真offer/apply與武器producer、飛行/黏附/待發快照已核；原真投擲反例GREEN：.05步長主爆後.15無傷/.20次爆.66，另.033步長.165無傷/.198觸發且僅一次。合法四主動真offer splitblast XP100→70、連按不重扣。`artifacts/validation/director-m1-d-r7-1-20261017/mvbbup16/acceptance.json` done:true／exit0；自報60/60未等價重跑，受控VM非Chrome／自然局／實體 |
| Done：M1-D-R8 fan共享runtime子票 | game `c2851de81337e8d6`／D `27a91d91d64baf41`；AGY正式停檔且Herdr done | Codex新D47–52＋受影響B8/11/12＋runtime12 **10/10 exit0**，語法／scoped diff exit0。額外真producer Lv1–5 count3/4/5/6/4，各cast主爆全傷2.64/6.96/12.96/20.64/12、次爆.66/1.74/3.24/5.16/3，濺射亦守原基線及25%預算；為受控逐符碰撞擺位，不是自然散射全命中。`director-m1-d-r8-20261017/mvbcozy4/acceptance.json` 的5矩陣＋boom→真weapon needle→6針可收，但該輪exit1／done:false因總監固定RNG未抽boom；另 `mvbcpvgw` 保留新fixture未抽fan的失敗。改逐draw LCG只補反向真fan→weapon boom→3符，`mvbcqm01/reverse-inheritance.json` **exit0／done:true**，global fan一份。前兩輪不得稱全PASS；D48原直接改WL的持久測試及單持有繼承文案另列R9；非Chrome／自然局／實體 |
| Done：M1-D-R9 seek共享runtime子票 | game `00289586c95d8e7d`／D `1e7895d28f4833aa`；AGY正式停檔且Herdr done，前後SHA相符 | Codex新D53–58＋改D48＋B8/11/12＋runtime12 **11/11 exit0**，語法／scoped diff exit0；D48真武器卡繼承、共享說明及cast術語已收斂。額外真producer：.05s轉.21rad／移動22px／速度440／life正常扣；移除鎖定敵後解除，直接攔敵陣列iterator觀測1秒5次實際搜尋，時點.15/.35/.55/.75/.95相隔.20，不只讀searchCount。`artifacts/validation/director-m1-d-r9-20261017/mvbdksvv/acceptance.json` done:true／exit0；受控VM非Chrome／自然局／實體 |
| Done：M1-D-R10 frost共享runtime子票 | game `fb1d6cbfa0e040a0`／D `ba4b3ff54244bab7`；正式停檔且Herdr done、前後SHA相符 | Codex新D59–64＋受影響D41/B8/11/12/C11/runtime12 **12/12 exit0**，語法／scoped diff exit0。額外真產5符／受控碰撞Boss僅短凍.15、ready2s，真update.20s後解凍、免疫受傷不累寒，推進到2.2s可再凍／ready4.2；真主爆→次爆只扣.66且Boss cold維持1、不凍／無碎冰tag；真weapon boom選卡繼承fan+seek+frost，各技能3/3、拒pierce/return/splitblast，實際3符皆frost/tracking。`artifacts/validation/director-m1-d-r10-20261017/mvbe245v/acceptance.json` done:true／exit0，受控擺位／VM非Chrome／自然局／實體 |
| NOT_PASSED：M1-D-R11 雷紋陣 | game `29fafc30d0d4fe08`／D `072e82a02861febc`；正式停檔、SHA穩定、Herdr idle | Codex focused9/9 exit0，語法／scoped diff exit0；額外真落雷對vanish/done敵各扣5.4且仍排1衝擊；真佇列budget1.08落在兩離場敵與一有效敵各.36，另外兩有效敵零傷，違反未離場／3有效敵分攤。原獨立第3檢查因既有probe.setRngSeed作用域錯誤未完成，保留失敗；僅修該檢查的sandbox RNG後，確認beforeText/afterText均缺、exit1。證據 `artifacts/validation/director-m1-d-r11-20261017/mvbex0z7/`；受控VM，非Chrome／自然局／實體，不採認自報70/70即gate |
| Done：M1-D-R11.1 雷紋陣runtime退修子票 | game `2a91a460e1179430`／D `f7833b01397dcaf6`；停檔／idle、前後SHA相符 | Codex focused7/7、語法／scoped diff exit0。原A離場敵hp100/100、queue0；B損傷[0,0,.36,.36,.36,0]、總額1.08；全無效零傷／queue0。`artifacts/validation/director-m1-d-r11-1-20261017/mvbnh9cy/`acceptance.json的3個已過案例可收；該輪exit1是總監誤認applyChoice回傳boolean（實為ok物件），僅補第4案例true-choice-upgrade.json exit0：真Duo卡before/after、真passive:dmg升級、levelup凍結、舊budget1.08／新1.35、移動不改落點。未用setChoices；舊失敗保留，不冒稱首輪全PASS。D70直接呼叫startVictorySequence驗清理，不等於自然勝局；受控VM非Chrome／自然局／實體 |
| Done：M1-D-R12 寒封符runtime子票 | game b01a711fa06b3665／D f1fda65c50a1c824；正式停檔且Herdr idle，前後SHA一致 | CodexD71–76/runtime4/12共8/8、另受新Duo影響D65/B12/C11共3/3，合11/11 exit0；語法／diff0。額外記憶體VM真5符飛行黏附→原引信主爆，同cast僅1敵；Boss真update .05s由4px→3.6px、.15s後恢復4；普通freezeEnds仍.5、slowEnds.85、凍後.65倍／恢復5px。首附加probe把const solids重新賦值exit1（總監fixture錯誤），只修為solids.length=0後2案例exit0；開放場fixture／Boss AI step stub、真追擊consumer，非hazard整合或自然局。另真offer/apply寒封符舊3符無Duo、新Lv5+fan4符共享cast並觸發、pause/levelup期限不變、重開無繼承，exit0；D76標題稱update但原測試只查欄位，獨立動態證據補上，不冒稱原測完整 |
| NOT_PASSED：M1-D-R13 墨焰斬 | game3a3773bf987fa880／D3c52a9580fdc8a9e，正式停檔／Herdr done，SHA穩定 | CodexD77–82/runtime4/12共8/8、語法／scoped diff0；額外真火接觸打標→主斬與有效3敵／不附burn、真Duo選卡舊Lv5風刃不回寫／新刃6hit僅1痕／真被動升級預算不變的2案例exit0。但獨立sum斷言exit1：P100,100/kat3/fire3，真fire命中198,100後真主斬產budget.56；移玩家800,800、換3有效敵在舊點、推進weapons(.13)，HP實扣各.1867、總.5601000000000056 > .56+1e-9。這是量化超額.0001，不以浮點容差或測試自比PASS略過。D79/80/81/82標題覆蓋大於實測（缺Lv4/5標記、Lv5真consumer／cap／快照等），不得當全驗；受控VM，非Chrome/自然局/實體 |
| Done：M1-D-R13.1 墨焰預算退修子票 | 固定game e4304a75ac36d9db／D4c7dad3448dd1265；正式停檔且Herdr done、驗收前後固定SHA相符 | CodexD79–82＋runtime12共5/5 exit0。原真fire接觸→主斬.56→三敵總.5600000000000023，原反例GREEN；同一附加命令後半新雷紋2.24→2.2401反例exit1，不把整輪說PASS。另真Lv4/5遊戲producer＋真offer/apply：舊spirit/龍/3child false不打標、新來源打標deadline1，兩案例exit0，未手造ghost/shot。D79新增Lv5 direct/splash仍手塞shot，只是consumer組件；D82舊wave也手造，root另真producer證據補足，不能稱原測全自然生成。開放場/控制weapon時鐘，非自然局/Chrome/實體 |
| Done：M1-D-R14 runtime子票 | AGY交件，Codex獨立收件 | R14 runtime子票 TARGETED_PASS：固定game 99e374b1f681f20e／D 1f2c36a77972671c／runtime 9d4e073f9e89bab6，正式停寫/idle後Codex獨立D82–88＋runtime12 8/8、exit0；原雷紋Lv5+power/3敵2.24→2.2401反例GREEN，實扣2.240000000000009（容差1e-9）。額外stdout探針真投符→黏附→引信→餘燼，cast3符共享一次、出生life.8/delay.3、3敵各.216合計.648、第四/盾0、一次tick無狀態派生；真offer/apply(seed3)在途舊3符false/新3符true且只1處，兩命令exit0。受控VM/武器時鐘與fixture敵人，非Chrome/自然局/實體。驗收前後game/D/runtime SHA一致，scoped diff-check exit0。 |
| Done：M1-F-Q4 記憶體guard候選；正式F仍未修 | Space Bunny正式done，STORE/dev-mode/兩保存測試末次SHA一致；root4案例exit0 | 最小候選const s=count(Number(score)); const n=count(Number(deliveries));僅記憶體替換。Infinity保持40；字串50→50；70.9三層同70；MAX_SAFE+1三層同9007199254740991，lost不解鎖。不能把直接count(score)丟掉舊coercion當同案，不造空spells/首通API，不改重試clear或回滾語義；後續現已由使用者新授權改由Space Bunny F-R1正式接STORE單檔寫權，僅此新票撤銷舊唯讀限制 |
| Done：M1-F-Q3只讀audit子票；完整F未修 | STORE853d572f5b72905e／dev-modeba993004e1fbfcd9／progression f5000ef203c7ed1a／dev-test10bf715287fb96c3前後一致 | Space Bunny矩陣exit1、5個回歸缺口，已校正原G1/G2 P0與未知鍵主張。root另獨立VM斷言三事exit0：finish("Infinity","40",false)存best=null／重載0；MAX_SAFE+1記憶體9007199254740992／重載9007199254740991；win寫入拋錯記憶體已解鎖／canSave false、Map原字串不變、重載未解鎖。可收可重現audit，未證Infinity玩家可達、不宣稱崩潰；回滾／clear重試雙計是durability與後續契約，不捏造既有保證。新F-Q4只驗記憶體候選、不改檔 |
| Done／有缺口：M1-F-Q2唯讀收件 | Space Bunny正式done/idle，STORE853d572f5b72905e／progression f5000ef203c7ed1a／dev10bf715287fb96c3前後未變 | 實際工具執行可確認代理可用；自報16/16不等價全重跑。Codex focused「failed storage writes expose／real STORE keeps」2/2 exit0，另獨立VM種best40／stage best40後STORE.finish(night-town,Infinity,NaN,false)→JSON best及stage best=null，assert40失敗exit1；F gate未過。Q2聲稱未來新招無閘門/空授獎為P0不採：GDD基礎六招保持可用、七新招後續定案；schema與結算保存三態列真正後續缺口，不能直接複製任意未知子鍵。新F-Q3已派exit0／Herdr working，只讀精確負向／最小修正建議，不給production寫權 |
| Done：M1-E-R11 契約子票 | Grok `w7:p7` 正式done；測試 `ffcd9489bb4f3e76`，UI仍 `0943480b4990b7cb` | Codex audio guard獨立 `node --require ./tools/director-audio-freeze.cjs --test tests/grok-m1-e-r11.test.cjs` 3/3 exit0；四Duo正確pair／fan僅needle／錯pair負向。再只於記憶體將UI thunder映射needle，同原測試2/3 exit1，首例明報缺「影響：淨化靈陣・天狐雷」；證明能抓錯，未寫done摘要／假PNG。UI無本票改動；fixture忠實度子票，未驗真game、Chrome、自然局、實體，完整E未過 |
| NOT_PASSED：M1-E-R10.2 | Grok已停檔，UI仍 `0943480b4990b7cb`／測試 `2761c05c8a37b1da` | 仍全局文字互借、BASE六主動、meta/熱區負向與焦點樣式未驗；after寫死done:true並將所有case強制true。Codex記憶體注入首例受控失敗，**0/1 exit1仍done:true**，證據 `artifacts/validation/director-m1-e-r10-2-failure-20261017/mvb6o034/`；非等價PASS重跑。停止此修測路徑，Grok E-Q1僅保全拒收草稿並只讀核對實卡文案，UI寫權凍結；不切模型／不盲試，AGY核心路徑繼續 |
| Done：E-Q1保全／文案偏差核對 | Grok已停檔；Codex獨立核對保全SHA及3項實值 | `rejected-ui-contract.cjs.txt`保留原SHA、舊測試路徑已無檔，不是刪除成果。fixture fan「單發→五發」不代表真Lv1 raw3+3；seek「追蹤陰陽符／符咒」實際綁needle「靈針・引魂追跡」；crosscut「側斬延遲」不同實卡「妖刀・十字交斬」。這是fixture忠實性缺口，不據此改正式玩法／宣稱UI新修復；後續真UI整合須消費固定版實卡 |
| Done：Codex固定UI純Chrome子驗證 | UI `0943480b4990b7cb`，Grok E-R10.2仍另行寫契約測試 | 真Chrome1000×700／844×390／1024×640，crosscut＋frost雙卡與四Duo單卡共15個受控fixture案例；全文／字級／實測邊界／44CSS／雙卡焦點樣式可收，三張真PNG已實看。meta15.56／14.30／14.93CSS。證據 `artifacts/validation/director-m1-e-r10-chrome-20261017/2026-10-16T16-21-33-662Z/`；初輪exit1為總監探針誤判Chrome將700正規化bold及emblem沿用rect，原摘要保留；同批真trace修正分析 `reanalysis.json` exit0／15案例通過，非重跑Chrome。pageErrors空、伺服器未收到game/audio/SW路徑，保留favicon失敗／console記錄；不假稱真game事件、三卡全組合、Duo實戰、自然局或實機 |
| 未交付／請求中止：M1-F-Q1 | Kilo `w7:p5` 唯讀QA | 新QA票送入exit0、observed working，但多次間隔觀察只有供應商處理畫面，無首個工具動作／QA結果；已按介面兩次esc中止，不再重試／切模型。未取得本票Timeout／429訊息，不能推定具體錯誤碼；不列已恢復可用。F缺口由Codex收斂，後續交可用writer |
| Done：F既有保存基線核對；非完整F | Codex唯讀QA | audio guard下聚焦 `tests/progression.test.cjs`＋`tests/dev-stage-selector.test.cjs` **6/6 exit0**：真STORE正式/dev隔離、storage寫失敗/恢復、舊詞庫存檔、S1勝利解鎖S2、敗局不解鎖、壞容器保合法資料。未改store，首通冪等／新build與永久分離仍待與新組合整合驗收；不新增無consumer中途續局系統 |
| Next／Owner | AGY G-R1.1停寫→root原B12/C11/race/固定SHA/白空白QA；Grok E12.2真頁三視口；p5 F-R2已收→固定G/UI新版負向 | 通過後code＋配套tests同主題LOCAL小批，未綠不提交整包。下一G完整正常三build/全部Boss節點/真Chrome仍未驗，不以dmg35結算腳本冒充完整局；缺實體WAITING_DEVICE，M1仍IN_PROGRESS，不M2 |
| NOT_PASSED：M1-E-R12；E-R12.2已啟動 | Grok w7:p7，固定SHA與缺陷來源見頂部 | E-R12 NOT_PASSED（Chrome證據）：UI 6593da982bf5644b／test 600d829c93829bd2，未重跑已知6/6。總監源碼核實harness只算scale/offset卻未套ctx transform，且body/canvas非真頁CSS；已實看chrome-mvbrzxpt/mp.png左裁字、tb.png溢出/scrollbars。logical card.x=-85/panel.x=-113不能單獨判正式UI裁切，須套真game變換。BROWSER_CAPTURED不代表BROWSER_VERIFIED，fixture非真offer/apply；退同票E-R12.1核真正卡/完整pair與before/after/限制、14CSS/44CSS/三視口bounds及觸控鍵盤真事件。 正式卡必用runtime canonical ID/kana；只兩白名單與新run，保留舊截圖，不改game/store。 |
| Done：M1-F-R1 正式STORE guard子票 | Space Bunny p5正式停檔／Herdr done；STORE5fe53548a3de8740／test59459c054be4c5ba | 真磁碟STORE.finish兩行count(Number(...))，自報原RED9測5過4敗→GREEN9/9；Codex獨立node --require ./tools/director-audio-freeze.cjs --test tests/spacebunny-m1-f-r1.test.cjs新9/9，另progression/dev-stage-selector以「clearing night-town unlocks／a failed run records／real STORE keeps／failed storage writes expose」必要4/4，共13/13 exit0。原獨立VM種best40/stage40/del3後finish(Infinity,NaN,false)，記憶體/JSON/重載best皆40、stage40、del3、不解鎖且canSave true，exit0；syntax/scoped diff0。只收正式guard子票，完整F新build整合／UI結算／自然局／實體未驗，不以自報25/25重複重跑 |

E12.1正式拒收：test5eaa441f05fa771c、game-mvbtdjl8/game-sha.json載入/前後c39d10一致；chrome-error.txt原真Input RED，只有dt.png，before/after皆tutorial:true，root實看教學覆蓋。prep()六武器Lv3非法，不列正式build；未root等價重跑明知失敗Chrome。E12.2改真關教學/每Duo合法pair+katana/每種輸入分次offer/實際draw trace及三視口；不是已證production點擊缺陷。

F-R2保存邊界TARGETED_PASS：p5自報A/B與C分輪（總輪曾含harness失敗，未冒稱整輪全PASS）；正式停檔後root獨立同一stdin命令3案例exit0，actual weapon/update→victory/lampout→真frame演出won/lost→STORE.finish，每案finishCalls=1/storageAttempts=1。official失敗canSave=false、原JSON byte-identical、真game fillText有儲存失敗警告、reload不解鎖；official lost不清關、不存局內build；dev won使用真dev-mode先於store載入，只寫yokai-delivery-dev-v1，official原字串不變且dev重載completed=true。fixture預置6配送/低HP final Boss/合法build/受控時鐘，非完整配送/Boss/自然局/Chrome。game c39d10/store5fe535/UI6593da前後一致，不修改任何檔。下一p5待G/UI固定版有價值QA，未恢復其他模型。

G-R1受控結算子票TARGETED_PASS：game c39d10b03ff8dc7e、G test5ae2c605731cde7b，正式停檔/idle後root `node --require ./tools/director-audio-freeze.cjs --test tests/agy-m1-g.test.cjs` 4/4 exit0。額外原始99e374字節以記憶體移除兩guard還原且SHA完全一致，真武器殺final boss+待升XP，原state=levelup、新c39=victory，stdin探針exit0。只收結算consumer：腳本teleport、強制bossStage3/elapsed540、dmg35/補油/注XP與UIstub，非正常強度/完整首領節點/自然局/Chrome。G-R1.1須誠實更名/固定seed/持久race案例後收件，不先放行G整段。

G-Q4收件：只採事件門檻靜態診斷／VM受測案例，不採「production完全無缺陷」或「正式UI無levelUpLayout」。ui.js:2349定義/:3426匯出，舊input-runtime helper重建UI Proxy抹getter。root沿D sandbox保留真UI/真listener，offerUp 3卡/layout={x90,y68,w720,h155,gap4}，cooldown0時中心[450,145.5] pointerdown→play、level1→2、revision3→4，stdin Node audio-freeze命令exit0；非Chrome。已把正確getter/真事件/冷卻/ready診斷補給Grok同票，不以直接pickUp替代DOM輸入。p5停寫idle待固定新版再QA。

G/Chrome當前缺口：Grok真頁DOM事件未改state，尚未正式交付；總監已禁止用harness內直接pickUp補命中來宣稱真點擊PASS，要求CDP真滑鼠/觸控＋ready/cooldown/矩陣前後證據。G-Q4只讀協助診斷門檻，未判production缺陷。AGY G-R1首輪virtualNow及lampout時序為harness RED，仍同票修正，未收；總監已更正初票錯誤「10配送」：GDD§3＋words night-town goalDeliveries=6，由game消費，維持6成功配送＋終王死亡，不改規格湊PASS。

G-Q3子案例TARGETED_PASS：game99e374b1f681f20e固定，p5正式停檔/idle；root核實test真keydown確認/skip與教學計時，命令 `node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern='first-run tutorial freezes time|context lessons cover' tests/input-runtime.test.cjs` → 2/2、exit0。受控prepareOrder/atDestination/prepareBoss，非完整自然配送/Boss，不替代G-R1或Chrome。p5自報新增20斷言exit0只當交付證據，不冒稱root20/20；返回旅路重進僅STATIC。下一p5待固定G/UI版再新QA，零寫權。

G-Q2收件：p5原focused一測exit1、三輪probe均exit1（前兩harness錯，第三oracle錯），不記整輪PASS。root獨立單一stdout命令exit0：4主動Lv5/被動滿仍有合法卡，逐張真offer/apply共10張，最終3御守/6變異/1合法Duo、eligible0且play，level11→12/XP100000→99910只扣90。反向未耗池保持levelup。允許不同局取得四種Duo，不要求一局持六技能/四Duo；不擴欄位、不改他人舊input-runtime test，列fixture遷移待協調owner。

G-Q1收件限制：Space Bunny只讀STORE端probe 21/22、exit1，錯oracle已診斷，不能記整輪PASS或真game勝敗。靜態真game唯一結算四參數不傳build，start清三陣列；「手動STORE.data加鍵會序列化」無現役consumer證據，不作P0、不擴schema或要求使用者選擇。其input-runtime單項RED先交G-Q2判fixture；v3-boss-ai載入window未定義是harness限制，未判產品回歸。未重跑其多個舊suite，未採13/13舊流程當完整won證據。

R14可重現focused命令：

`node --require ./tools/director-audio-freeze.cjs --test --test-name-pattern='M1-D-(82|83|84|85|86|87|88) |M1-RUNTIME-12 ' tests/agy-m1-d.test.cjs tests/agy-m1-runtime.test.cjs` → 8/8、exit0。額外3例為`node --require ./tools/director-audio-freeze.cjs -` stdin探針，沿D sandbox前綴載入真game，只在記憶體增加clearSolids觀測；原預算、真cast時序、seed3真offer/getRevision/apply已記於上列輸出值，不新增root檔案。

最新現場／本輪增量：R14固定版獨立8/8＋3個stdout真consumer反例已綠、exit0；E12真Chrome證據未過，不接受fixture6/6替代真頁。AGY G-R1與Grok E12.1已實際送票working，Space Bunny G-Q1已交audit限制，G-Q2已派working且已工具動作，不重派舊QA。Codex只修改四權威，400 dirty保護，無部署；上下文/額度本輪無可讀數值，UNKNOWN。 G-Q2原RED已獨立證為過期fixture；p5 G-Q3已交並root獨立2/2收受測子案例，暫idle待固定G/UI版新負向；401 dirty，新增自身Gtest已授權，原400成果保護。

R9.1新增獨立視口證據：`artifacts/validation/director-m1-r9-independent-20261016/`，在記憶體為原harness加觀測、不改磁碟production／測試，記錄13次真offer的ready=true、draw/hit同源、卡片視口內及44CSS熱區、繪製/runtime焦點；三視口圖已實看。受測御守meta桌機約15.56／手機14.30CSS，平板該案例無增補meta；ArrowDown→focus1→ArrowUp→0→Enter真事件通過。此附加輪 **4/6 exit1** 的原因是總監觀測錯要求空池仍levelup，實際正確安全回play，保留失敗證據；另以不改原斷言、只轉存新目錄獨立執行原harness **6/6 exit0**，不可冒稱附加輪全PASS。pageErrors=[]／audioLeak200=[]，console仍有404／headless vibrate警告，不稱乾淨console。AGY自報37/37未由本輪等價重跑。

### 17:11 暫代總監／Codex 額度保護（2026-10-16，歷史紀錄）

使用者表示 Codex 五小時額度餘 9%，明確指示 Codex 暫停監督、19:00 後再恢復。17:11 現場 Herdr agent list：Codex w7:p1 idle（17:09 最近收尾），由 ChatGPT 暫代分工與驗收；未授權任何 Agent 宣告 M1 已完成。已安排 19:05 台灣時間再核對額度與工作樹，若可用才交回 Codex；此為預定安排，非已完成交接。

現階段沿用既有票：AGY w7:p4 正修 M1-A-R6.1 測試隔離與真正 won 流程，唯一 writer tests/agy-m1-runtime.test.cjs；Muse w7:p6 正排查 M1-E-R6 Chrome 真頁 consumer 測試逾時，唯一 writer tests/muse-m1-r6-chrome.test.cjs 與其證據；Kilo w7:p5 暫待機，不跨搶 AGY 現行 js/game.js。兩票均尚未收到新一輪可驗收交件；M1-A、M1-E 和完整 M1 均未通過 gate。

Codex 19:00 前不再派工或消耗額度；臨時管理只派不撞檔工作並要求真實測試證據。M1 尚缺六御守、十變異、四共鳴及完整重玩。自然局／真機未驗；Audio/TTS/BGM/KEY 凍結，保護 dirty 與核准美術，未授權 commit、push、deploy。

### 18:40 ChatGPT 暫代總監新驗收／M1-C 續派（2026-10-16）

- **M1-B-R2 驗收 TARGETED_PASS**：AGY 已停檔交件。ChatGPT 獨立以音訊凍結 guard 執行 agy-m1-b（12）＋agy-m1-runtime（14）＋v3-contract-gate（21）合計 **47/47 PASS、exit 0**，game.js syntax exit0、SHA256前16 B7B8EA655EE79CBA，scoped diff check 無錯。三變異經正式 getEligibleChoices→applyChoice→BuildState 真卡池，可用 revision、過期/連按/滿級/覺醒優先保護；不等於三變異實機真自然局全驗。
- **M1-E-R7 驗收 TARGETED_PASS**：Muse 新 muse-m1-mutation-cards（6）＋既有 muse-m1-choice-viewmodel（14）**20/20、exit 0**，ui.js syntax exit0、SHA E93C748E22D32B8A，桌機/手機/平板 mock 長字三卡契約通過；不把 mock 當真 R2 Chrome consumer。
- **新票 M1-C-R1：AGY w7:p4 working**，獨占 js/game.js＋tests/agy-m1-c.test.cjs，第一批三御守 charm_power / charm_step / charm_gather 真攻擊/移動/拾取 consumer 與三槽、資格、選卡、revision 負向；其餘三御守只有安全規格不進正式卡池，待 R2。
- **新票 M1-E-R8：Muse w7:p6 working**，獨占自己的 UI/fixture，為三御守增加桌機/手機/平板 mock 選卡顯示、限制和熱區聚焦測試；與 AGY 互不碰檔，完成後要等真 consumer 整合。
- Codex w7:p1 保留 5h 額度，19:00 前 idle；Kilo w7:p5 暫停避免逾時撞檔。兩張續票已由 Herdr 接受且再次觀測到 working。**完整 M1 仍 IN_PROGRESS**；六御守、十變異、四 Duo、十分鐘自然局/裝置均尚未完整驗收；不 commit/push/deploy，不解除音訊/金鑰凍結。

### 18:15 ChatGPT 臨時監工實驗收／續派（2026-10-16）
**最新驗收／續派（覆蓋本節早先 B-R1 working 狀態）**：AGY M1-B-R1 已正式交件停檔；ChatGPT 獨立以 audio-guard 重跑專屬7、runtime14、v3-contract21，合計 **42/42 PASS、exit 0**；game.js syntax exit0、SHA256 前16 **170C19554350821E**、scoped diff-check 通過。靈針三變異核心、Boss 抗凍、原六招基線屬 TARGETED_PASS；但現場 getEligibleChoices() 只有 weapon/passive，**玩家正常升級無法取得 mutation 卡**，不宣告完整 B 或 M1 gate。

已送兩張不撞檔續票，並觀察到 Herdr **AGY w7:p4 working：M1-B-R2**（只寫 game.js 與 agy-m1-b.test.cjs，補變異進三選一、applyChoice／revision 真接線）；**Muse w7:p6 working：M1-E-R7**（只寫 ui.js 與自己的 muse-m1 測試，以固定 mock 驗三變異卡的桌機／手機／平板顯示與操作，等 R2 收件後再驗真 consumer）。Kilo 暫停；Codex 19:00 前保留額度不喚醒。**M1 仍 IN_PROGRESS**，未 commit/push/deploy，音訊與金鑰凍結。



Codex 額度僅餘 9%，依使用者指示保持 `w7:p1` idle；19:00 前由 ChatGPT 暫代驗收與派工。現場四位 Agent 先均 idle，R6.1 與 R6 均已有正式交件，不再誤稱仍 working。

- **M1-A-R6.1（AGY）子 gate PASS**：獨立以音訊凍結 guard 執行 `tests/agy-m1-runtime.test.cjs`＋`tests/agy-m1-contract.test.cjs`，合計 **20/20、exit 0**；`js/game.js` SHA256 前16 `6cde3bf7aef4e25c`，六招 Lv1–5 三十組行為矩陣及自然 won 生命週期有測試；不是完整 M1-A 或 M1。
- **M1-E-R6（Muse）真 Chrome 子 gate PASS**：正式交件後由 ChatGPT 獨立重跑 `tests/muse-m1-r6-chrome.test.cjs` **8/8、exit 0**（CDP 真 offerUp→命中→applyChoice、桌機/844×390/1024×640、revision/重抽/空池/needle snapshot）；R5 `tests/muse-m1-choice-viewmodel.test.cjs` **14/14、exit 0**。`js/ui.js` SHA256 前16 `e93c748e22d32b8a`，`r6-summary.json` 的 `pageErrors=[]`、`blockedAudio=0`、`audioLeak200=[]`；console 有 favicon 404 與 headless vibrate 警告，未宣稱 console 完全乾淨。證據 `artifacts/validation/muse-m1-r6-20261016/`。**受控加速真瀏覽器 ≠ 自然十分鐘局、實體裝置或完整 M1-E 最終 gate**。
- **下一票 M1-B-R1 已送 AGY `w7:p4` 並觀察到 working**：僅 `js/game.js` 與 `tests/agy-m1-b.test.cjs`，先做靈針 `mut_fan`＋`mut_seek`＋`mut_frost` 真實可選、疊加、受限總傷與 Boss 抗凍；維持既有六招/Lv5/快照/生命週期，focused 測試後正式交件。Muse `js/ui.js`、Codex `roadmap.md` 均暫不交給其他 writer；Kilo 暫待機避免逾時與撞檔。這張票不代表三變異已完成。
- **後續**：收到 B-R1 實際交件才再驗收／決定下一票；M1 仍 `IN_PROGRESS`，六御守／其餘變異／四 Duo／三 build 自然局仍缺。無 commit、push、deploy；音訊／TTS／BGM／key 與核准圖凍結。19:05 另有條件式交回 Codex 的檢查安排，非已交回。
### M1 執行中／首波派票｜2026-10-16

**IN_PROGRESS；M1 gate 尚未通過。** 新會話明確授權 Herdr Codex 主導分工 M1→M6，覆蓋舊「不派工／只做文件」。主責技術方向、接口／依賴、QA gate 及唯一 roadmap；副責關鍵整合、風險／資源額度。Codex 仍只寫四份權威／入口文件，不搶 production writer。

**15:38 追問後處置：四人待機不是 M1 完成。** 現場複查 Kilo recent 有供應商 `A Timeout Occurred`；`game.js` SHA 仍 `a884811affddfcaa`，只有既有 Boss 接線差異，沒有新 build 核心。已中止 Kilo 殘留請求、撤回 M1-A-K；依最新調度授權，下一張 **M1-A-R1 改由現役 AGY** 獨占 `js/game.js`＋新 `tests/agy-m1-runtime.test.cjs`。先恢復核心真 consumer／接口，Muse 不平行空轉；沒有重試 429、切換模型或啟動禁用 Agent。

R1 搜尋邊界事件：AGY 一次全 `js/` 搜尋未排除凍結 `js/audio.js`；已制止並要求逐檔明列安全路徑，不補讀音訊、不稱整輪零凍結路徑讀取。詳見製作計畫，凍結限制未解除。

| 狀態 | Owner／工作 | 驗收證據／下一步 |
|---|---|---|
| Done：現場核實與送票 | Codex `w7:p1` | Windows Herdr `agent list` 核實四個現有 pane、同工作樹；`agent prompt` 三次提交退出碼 0。沒有重開額外 Agent；送票不代表實作完成 |
| 失敗／已撤回：M1-A-K | Kilo `w7:p5`，本票暫停寫入 | 供應商畫面 `A Timeout Occurred`；無核心交件、無 429 證據。請求已中止，不原樣重試；不與 AGY 撞 `game.js` |
| Done：M1-A-R1 最小核心子交付 | AGY `w7:p4`，暫時唯一 `js/game.js`＋`tests/agy-m1-runtime.test.cjs` writer | 真卡池／apply／revision、一次性舊 f、妖刀快照已接；Codex 獨立 **7＋21＝28/28、exit 0**，被動重複負向由失敗轉 PASS；game SHA `6f39c298c5c4a0d5`。其餘五招快照只 metadata，完整 M1-A／M1 未結案 |
| Done：M1-E-R2 接口預接子交付 | AGY `w7:p4`，game 單寫權持續；現行票見 R5 | Codex 已查 recent／實際 diff，獨立新增測試 **2/2、exit 0**；另以實際 pointerdown 驗新版重抽及 count 轉交 PASS。語法／scoped diff 檢查 PASS。game SHA `5b06e73101649adb`；只是命中接口通過，尚非 UI／M1 gate |
| 已收件／NOT_PASSED：M1-E-R3 | Muse `w7:p6`；同源 UI 有實際 diff，證據 `artifacts/validation/muse-m1-r3-20261016/` | Codex 獨立 A5／A7／B4＝**2/3、exit 1**；手機間距仍 18＜26、限制越卡，三圖已實看。fixture 手機仍 CSS 585×390／logicalW900，未進新增加寬分支；不接受「已全橫寬改善」說法。UI SHA `2b187627d3faee53`；不是 M1-E PASS |
| 已收手機案例；其餘未過：M1-E-R4 | Muse `w7:p6`；證據 `artifacts/validation/muse-m1-r4-20261016/` | Codex 獨立 UI **12/12、exit 0**，新三圖已實看；手機受測重疊／越卡修復，真 viewport.js＋等比 offset 分支已接。UI `83d4fe89877c2331`。另驗桌機必要 meta **12px＜14px，exit 1**；M1-E 未結案。空 console logs 不列無錯誤證據 |
| Done：M1-A-R5 靈針快照子交付；完整 A 未過 | AGY `w7:p4` 已正式交件並停檔 | Codex 新 10／11 兩測 **2/2、exit 0**；另實際命中驗升級後舊針傷害仍 **2.52**。game `6cde3bf7aef4e25c`、測試 `f0534fb3347d95dd`。六招只驗部分關鍵級數，非 Lv1–5 全矩陣；暫停／死亡未覆蓋，其餘四招 spec 仍 metadata |
| Done：M1-E-R5 文字／fixture 子交付；完整 E 待真路徑 | Muse `w7:p6`；證據 `artifacts/validation/muse-m1-r5-20261016/` | Codex 獨立 **14/14、exit 0**，三圖已實看；必要 meta 14px／受測 frost、Duo 全文及映射已收。UI `e93c748e22d32b8a`、測試 `b8d89fa921a5f0d8`。空 console／未保存 DOM 不算無錯誤，圖上 R4 舊標題待新證據正名；不是完整 M1-E |
| Done：M1-A-R6.1 六招基線／生命週期子 gate | AGY `w7:p4` 正式交件並停檔 | Codex 獨立 0／10／12／13 **4/4、exit 0**，三十組真 weapons 基線保留；宿主／雙 sandbox RNG 隔離、真 update→victory→frame→won 已驗。測試 `5549aabbcb756cf8`；lost／won 停止運算、start 清空，不假稱結算立即刪針。game／UI 凍結 SHA 不變 |
| 已派出／working：M1-E-R6 真 Chrome consumer | Muse `w7:p6`，**只寫自身 harness／證據**；`artifacts/validation/muse-m1-r6-20261016/` | 送票 exit 0、已觀察 working。固定上述 UI／game 版本，真 offerUp→事件→apply／play／攻擊、熱區／重抽／revision／空池與錯誤紀錄；受控注入／加速須標明，未驗自然局／真機 |
| Done：資料保護子交付；新 build 待契約 | AGY `w7:p4`；只新增 `tests/agy-m1-contract.test.cjs` | 自證常數／假 mock 經審查移除；Codex 讀實檔並獨立重跑 **6/6 PASS、exit 0**，含八關／164 字／故事與未知 ID 真 consumer 回落。六／十／四 runtime、Lv5 行為仍未驗 |
| 已交部分成果；M1-E gate 未過／P1 | Muse `w7:p6`；`js/ui.js`、`tests/muse-m1-*`，證據 `artifacts/validation/muse-m1-20261016/` | v1 文字欄位已接 UI；Codex 已實看桌機／844×390／平板三圖：手機標題／正文重疊、冰封限制越卡，桌機平板補充字偏小。正確負向獨立重跑 **9/10、exit 1**；B4 行距實際 18＜26。取代舊 10/10，不列 BROWSER_VERIFIED PASS |
| Next：完整新 build 整合 | AGY 暫代 runtime → Codex／Muse | R1 最小接口已交；御守／變異／Duo 尚未進池，先接 UI 同源配置，再依 B／C／D／F／G 逐票，不把資料／基線 PASS 當全 M1 |
| 未過：選卡整體驗收 | Muse R6 → Codex／AGY 整合 | R5 文字受測案例已收；Codex 已額外驗真 UI getter→game 手機卡片／間隙 consumer（VM PASS），仍不是 Chrome 真路徑。真事件／錯誤紀錄與基線缺口由 R6 補，不用空 log 或 idle 代替 |

首波票全文已送各 Herdr pane；範圍、接口與 QA 盤點合併維護於 [製作計畫首波派票／里程碑報告](docs/PRODUCTION_PLAN.md#6-首波已派票與里程碑報告2026-10-16)，不另增冗餘 docs。每個 M gate 必須同步 Herdr Codex 回覆及該節，列實際交付、驗證證據、限制與下一 owner，不以 Agent Idle 或測試數量結案。

R2 一次性 Herdr 完成回呼已實際送達 Codex，背景 exec session `19966` 最終 exit 0；Codex 因此讀交件、獨立驗收並派 R3，完整鏈已驗一次。後續回呼只用於具體當票的收件事件，不等於新授權／gate PASS，不輪詢／自動重試／回答審批，也不恢復舊常駐監工；後續使用者停止／改向優先。

R3 單次回呼已送達，背景 exec session `47191` final exit 0；Codex 已收件、判定 NOT_PASSED 並派 R4。回呼送達與 UI gate 分開記錄。

R4 單次回呼已送達，背景 exec session `31340` final exit 0；本輪已分級驗收並派兩張不撞檔的 R5。送達不等於整體 M1-E／M1 gate 通過。

R5 回呼：AGY `85693` 曾過早送達，當時未收件；之後 AGY 已送「正式交件並停檔」含 SHA／結果，本輪才實際分級驗收。Muse `50412` 亦已送達、final exit 0，本輪已收 R5。R6 不再對 AGY 掛同種 wait；兩人均已收到「真正完成驗證→停檔→送一次正式交件報告」要求，不以工具邊界的 done 當交付。

1. **Done／已修改／已檢查**：四份文件同步授權、主副責任、owner／gate、UI 契約；Muse 已修改 UI／fixture。文件本機連結、空白／衝突標記、diff 檢查 PASS。Codex 已獨立重跑 AGY **6/6**、既有 `v3-contract-gate` **21/21**、既有 `v3-ui` **13/13**（exit 0）；新 Muse fixture **9/10（exit 1、P1）**，均先 preload 音訊 guard；版本與限制記於製作計畫。Chrome 三圖已實看且 **新 UI NOT_PASSED**；未驗新 build、完整六招×五級、自然局／真機；歷史 55/55 未重跑。
2. **Next／A 基線已收、E 真頁進行中**：R5 靈針快照／UI 文字與 R6.1 六招基線／生命週期已驗收；其餘四招完整快照仍是後續 M1 缺口。Muse R6 已進入真頁選卡／鍵盤案例，尚未正式交件；不沿用先前 timeout 當目前結論。game／UI production 固定，AGY 有依賴地停檔，待 E 固定版收件／必要缺陷修正後派 B 第一張實作票；不跑全庫或 media-cache。
3. **Next／後續派票**：A 通過後 B 散射＋追蹤＋冰封／Boss 抗凍 → C 六御守 → D 十變異四 Duo → F 保存；Muse E 隨接口並行，最後 G 成功／失敗／重玩／返回／收藏及三種 build 真頁整合。未達前置 gate 不冒稱完成。
4. **後續 gate**：M2 圖片／鏡頭必要新圖為 `WAITING_HUMAN/ART`；M3 自然局與實體手機／平板＋手把為 `WAITING_DEVICE`；通過後才 M4 Stage2、M5 Stage3–8 逐關。M6 音訊／發布為 `WAITING_HUMAN`，不可由順序授權推定解凍或部署。
5. **保護**：八關 164 字、六招 Lv5、核准資產與全部 dirty 保留；音訊／TTS／BGM／KEY 不讀不改不測；不生圖或接未審素材，不 commit／push／deploy，不 reset／clean／checkout；429 不自動重試。

### 不可遺失的實作缺口

| 缺口 | 目前口徑 | 後續 owner／階段 |
|---|---|---|
| 資產 slot 的真 consumer | 曾見 renderer 讀 window 匯出不對應、通用 atlas 覆蓋專圖；地面仍讀 visual.ground，載入 scene 不等於實際擺圖。需複核現場，不能直接判已修 | Kilo／阻 S1 者優先，其他 M2／逐關 |
| Boss 差異 | bossTheme→AI 有接點，但 S3–7 曾與 S1 同招式池；主題字串不等於獨特行為 | Kilo＋AGY／M4–M5；M1 先處理 Boss 抗凍 |
| Stage8 collage hotfix | 使用者要求移除白／淡色矩形；僅透明花瓣／花／骨／石 props。開關旁路、cache、signed seed 與載入順序曾列風險，尚未由 Codex 結案 | Kilo 寫 runtime，Muse QA；隔離 dev，不搶 S1 主線 |
| 自然局與平衡 | 新六／十／四、約十分鐘 30 級、Boss 可行動、至少三種 build 尚待測；陰陽符 1.5／2 秒候選等舊平衡待決不偷定案 | Kilo＋使用者／M1–M3 |
| 長字／行動 UI | Muse 有長假名、結算、Boss 稱號工程與真 Chrome 視口證據；新選卡／新組合仍待驗 | Muse／M1–M3 |
| 真實裝置 | iPad／手機／Xbox 手把輸入、震動、FPS／P95 與自然局證據未齊 | 使用者＋Kilo／Muse／M3；不可稱真機 PASS |
| 新圖 | S3/4 針對性拒稿與現役需區分；S7/8 偏寫實候選待修；3×3 真無縫與整關人審未全齊 | AGY→使用者／M2、M4–M5 |
| 十三招解鎖算術 | 六招＋七次新解鎖＝十三；暫按 S1–7 首通，S8 獎勵待決；新七招內容未定案 | 使用者決策＋AGY／Kilo；不阻 M1 |
| 聲包／最終發布 | 正式聲包、配樂、人審、真機與發布授權未齊；既有盤點不等於可讀可測 | M6；未明確解凍不得動 |

### 舊入口完整備份與追溯

改寫前，兩個已追蹤檔的工作樹 blob 與 HEAD 完全相同，已以 `git hash-object` 對照 `git rev-parse HEAD:<path>` 確認；因此原文已完整保存在 Git，沒有未追蹤差異被截斷。本輪不另建備份檔或提交。

| 原檔 | 完整備份 commit | 原始 blob ID |
|---|---|---|
| AGENTS.md | `54a4690274e7dfca89c25eb1919b8c5e561696d4` | `318c3e328c6141b1a383d59ad43678b89f2ff79f` |
| roadmap.md | `54a4690274e7dfca89c25eb1919b8c5e561696d4` | `ac02e4002b9cc4299ac3b6ad204582c38d2db308` |

唯讀查原文可用 `git show 54a4690:AGENTS.md`、`git show 54a4690:roadmap.md` 或 `git show <blob ID>`；不使用 checkout／reset。完整舊文保留於上述 Git 版本；本頁僅保留必要事實、缺口與下方證據索引，移除過期派工原文。

---

## M0 已授權清理紀錄

主控回報已逐項檢核來源＋有效引用：刪除 `art/stage3-sakura-pass/Preview_*.webp` 32 張、約 33.3 MiB（PNG 母本保留），及 `docs/restart-handoff-20261015-*.md` 五份、約 18 KB。Codex 僅記錄，沒有執行刪除或另做全庫查核。

仍保留 Stage2 `*_v1`（`tools/r6-world-cross-edge.cjs` 有引用）與 Stage3 `O_shrine_courtyard_decal_exp_b.*`（`docs/art-review-queue-20261014.md` 有引用）。後續僅清可證廢棄且無有效引用的衍生檔／舊交接；保留現役、母版、受保護 QA、待審與狀態不明成果。

## 歷史追溯（非現行指令）

完整舊 roadmap 請按需用 `git show 54a4690:roadmap.md` 查看；舊 AGENTS 用 `git show 54a4690:AGENTS.md`。原文 commit／blob 已列於上表，不另建 archive。不得每輪掃描舊全文，亦不得恢復其中過期派工、模型路由、checkpoint 或發布指令；有用的已完成事實與尚未解決缺口已保留在本頁頂部。
