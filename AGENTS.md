# AGENTS.md — 妖怪快遞社正式協作入口

版本：2026-10-17；使用者最新方向：Stage1-first。
本入口取代所有歷史派工、模型路由、常駐監工及 checkpoint 自動執行條款。
2026-10-16 新會話已明確授權 Herdr Codex 總監派工製作 M1→M6；覆蓋舊「只做文件／不派工」。Codex 自身仍只寫下列四份文件，production 由各 writer 實作；音訊凍結；2026-10-17使用者最新授權僅安全LOCAL commit，由Codex依第5節統籌，禁止push／deploy。

## 1. 先讀短入口，不掃全庫

1. 先讀本檔，確認使用者這一輪的實際授權與 writer。
2. 讀 [官方遊戲企劃](docs/GAME_DESIGN_MASTER.md) 的相關規格。
3. 讀 [官方製作計畫](docs/PRODUCTION_PLAN.md) 的目前階段與驗收。
4. 讀 [roadmap](roadmap.md) 頂部現況，舊歷史按需追查。
5. 只讀任務相關源碼與測試；不用掃整個 docs/ 或 art/。
6. 涉及圖像須讀 [真圖規範](docs/art-asset-only-standard.md)。
7. 涉及跨關須讀 [關卡識別規範](docs/stage-identity-standard.md)。
8. 啟動／預覽問題先看 README、package.json 與既有 scripts。

## 2. 唯一權威與衝突順序

- 使用者最新明確指示優先於任何文件與舊對話快照。
- GAME_DESIGN_MASTER 定義產品；PRODUCTION_PLAN 定義順序／owner／gate。
- roadmap 頂部記錄已驗事實、缺口與下一工作，不能用狀態改寫產品規格。
- 三份是唯一現行權威；本檔是其安全與協作入口。
- 舊 season-one-master-plan、甘特、執行板、交接只供證據與歷史追溯。
- 舊文中的「最高現行」「復工」「等待審圖」「自動派工」均非新授權。
- 真圖／識別規範中的保護有效；舊 owner、舊排序／發布條款由新指示覆蓋。
- 不把過期假設、模型額度、pane ID 或歷史 PASS 當成現場實查。

## 3. 現行產品與製作順序

- 第一關 night-town 先成為可完整重玩且精緻的垂直切片。
- 融合 Hades 第一代斜角鏡頭／技能組合／節奏與 VS 自動攻擊／短局升級。
- 沿用 Canvas2D、tilt .60、房屋 Y 1.20、四主動含固定妖刀。
- 保護六招各五級與現有 Lv5，先做六御守／十變異／四共鳴測試原型。
- 御守最多三裝；散射＋追蹤＋冰封可疊，Boss 抗凍、派生受限。
- 之後首通解鎖新妖術擴至十三招；數量與終章獎勵待決詳見企劃。
- N5 五十音已會者；取件／答題／送貨／封印／收藏，收藏不加戰力。
- 八關 164 unique words；前七關 27/27/22/22/21/24/21，第八關總複習。
- 八關約十分鐘共用流程及 55/55 targeted 是既有基線，不是本輪新驗收。
- M0 文件→M1 Stage1 build→M2 圖片／鏡頭→M3 自然局／真機手把。
- 再 M4 Stage2→M5 Stage3–8 逐關替圖與內容→M6 音訊審核／發布。
- 新 M1 不等其他關美術或聲包，舊八關 M1/M2 同名定義作廢。

## 4. Writer 與任務邊界

| Owner | 獨占／主要範圍 |
|---|---|
| Codex | docs/GAME_DESIGN_MASTER.md、docs/PRODUCTION_PLAN.md、roadmap.md、AGENTS.md |
| 原Kilo（停用、不再參與） | 舊production owner表由現行暫時writer覆蓋；w7:p5已由使用者親自改為Space Bunny，禁止恢復Nemotron |
| Space Bunny／OpenCode（使用者指定） | w7:p5現F-R2唯讀真幀保存失敗/dev隔離QA，零檔案寫權；Q1–4已交診斷/受測子案例。STORE5fe53548a3de8740，不碰game/UI/四權威或他人動態test |
| AGY | w7:p4唯一runtime owner；現G-R1.1僅自身B/C/D/runtime/G tests writer，game.js凍結c39d10b03ff8dc7e，不動UI/STORE；C11/B12池前提與可重現回歸修正，正式停檔再QA |
| 舊Muse／OpenCode UI（暫停） | 原UI範圍由Grok持有；不自動切回。與現行Space Bunny/OpenCode唯讀F-Q2是不同角色 |
| Grok（現役UI writer） | w7:p7 E-R12.2同票退修，限js/ui.js＋tests/grok-m1-e-r12.test.cjs及自身新run；先修教學遮罩/合法pair/真CDP輸入/實繪量測，不改game/store |

- **現行暫時 owner（2026-10-17）**：R14原固定版runtime子票已收；G-R1新game c39d10b03ff8dc7e，root獨立4/4及原99e374→levelup/新c39→victory真武器反例GREEN，只收受控結算子票（teleport/時鐘跳轉/dmg35/UIstub），非正常三build完整局。B12/C11固定版focused各exit1，C11實得duo_inkfire仍可選；AGY G-R1.1只修自身測試、game凍結。Grok E12.1真CDP受教學遮罩/非法六主動fixture拒收，E12.2同票working。Space Bunny F-R2唯讀結算失敗/dev整合working。其他Agent停用；Codex四權威/QA/LOCAL提交統籌，M1 IN_PROGRESS，不M2。
- **本輪派工與保護**：各一主票，game/UI一檔一writer；G-Q3只讀，不另造重複suite。正式停檔後固定SHA/原負向/真consumer獨立收件，不以idle或測試數結案。429/Timeout/登入錯誤停且診斷，不盲試；音訊/KEY/env/核准資產與400 dirty保護，LOCAL commit依第5節，禁push/deploy。
- 一檔一 writer；新增檔／index／SW／既有他人測試須先協調 owner。
- Codex 做接口與最終整合，不搶三實作者 production 檔。
- Codex 主責技術方向、接口／依賴、QA gate 與唯一 roadmap；副責關鍵整合、風險／資源額度。各 M gate 必須在 Herdr 回覆及製作計畫的里程碑報告留下證據。
- 現行票與狀態見 roadmap 頂部；M1-A 依上列暫時 owner 先交 runtime，Muse 待接口後續接；不把已送票或 Idle 當完工。
- 生圖、外部 ComfyUI、音訊、發布不因角色名稱自動獲授權。
- 不自行恢復 Cursor／Kiro／Kilo／舊Muse，不改現役模型/session；Space Bunny Free Personal/max與Grok4.7 high/500K延續現役。Codex本輪native無額度/context數值，UNKNOWN；不引用歷史快照當現值。
- 使用者只要建議／唯讀時，不修改、不啟動 Agent、不擴張任務。
- 每人一個主工作與可選備用；沒有有價值工作可誠實 idle。
- 使用 Herdr 前先查當前 agent list；重啟不代表舊 writer 仍 working。

## 5. Git 與大量 dirty 保護

- 保護 350+ dirty 成果；數量隨現場變動，不是安全提交白名單。
- 禁 reset、clean、checkout 及任何會清除／覆蓋 dirty 的操作。
- 不刪未知檔、不覆寫他人候選、母版、測試證據或正在修改的檔。
- 經授權僅清可證廢棄且無有效引用的衍生檔／舊交接，保留現役／母版／QA／待審。
- **2026-10-17 使用者最新授權取代舊不 commit 條款：允許安全 LOCAL commit，禁止 push／deploy。** 僅 Codex 統籌提交，不打斷現役 writer；其他 Agent 不自行 stage／commit。
- 僅正式停檔、SHA 固定、獨立 QA 通過的 code＋配套 tests 同主題小批提交；四權威文件本次更新完成後可同組提交。未 GREEN 的整包契約、正在改的 game／UI／G-R1／E12.x 不提交。
- 已有 LOCAL commits：d7b4981（STORE＋F-R1 test）、3bffe44（audio-freeze guard＋自測）、52c9366（M1 contract＋E11 tests）；不得重複 stage。HEAD 已非 54a4690。新授權不等於所有 dirty 可提交。
- 歷史 checkpoint 政策不自動執行；未來須依最新明確授權判斷。
- 即使另獲提交許可也禁 add -A、add .、add -u 等全庫 stage。
- 只能逐檔白名單 add，檢查 staged 清單、cached diff 與 diff --check。
- 不提交 KEY、環境檔、音訊、核准母版、未審 art、巨大候選、私人資料、ignored 證據或暫存產物；只盤點凍結項路徑，不讀其內容。
- 已追蹤舊入口備份 commit／blob 在 roadmap；可用 git show 唯讀追溯。
- 本機 commit 不是異地備份；Push 與 Deploy 各需明確授權。

## 6. 音訊與外部服務凍結

- 不讀、不改、不測 assets/audio/**、art/audio/**、js/audio.js。
- 不讀／執行 tools/tts*、TTS、BGM 或 API_KEY／金鑰／環境機密。
- 不生成語音／配樂、不換曲、不呼叫 TTS／外部模型 API。
- 保留既有呼叫介面；測試須在讀檔前 stub／阻擋凍結路徑。
- `rg`／shell 讀取也須逐檔明列安全路徑；禁止掃整個 `js/` 而包含 `js/audio.js`。Node preload guard 不能替 shell 搜尋作保證。
- 瀏覽器靜音不等於未讀檔；禁用會讀聲檔的 hash／快取建置流程。
- M6 也不自動解凍，必須由使用者明確指定解凍範圍。

## 7. 真圖、人審與安全回落

- 第一關核准微 Q 比例、和紙水墨半浮世繪木版與粗墨線是基準。
- 正式可見藝術主體用核准 PNG／WebP，透明 sprite 序列與貼圖粒子。
- 禁程序矩形、多邊形、色塊、SVG 冒充房屋、地面、角色、UI 藝術。
- 文字、碰撞、預設隱藏 debug 與真正輔助粒子仍屬程式職責。
- 墨色塊／粗筆觸是圖片風格，不是偷渡程序假素材的例外。
- 新地面需實際 3×3 無縫拼接、遊戲移動與 2D／.60 人審。
- 缺圖沿用現役核准回落；沒有安全圖就略過／顯示必要載入狀態。
- art/ 未核准候選不得複製或映射進 assets/img/ production。
- 槽位已接、檔案存在、可解碼、測試 PASS 都不等於美術核准。
- Stage8 試貼限本機 dev=1＋stage8preview=1＋yomi，透明單體 props。
- 禁白底矩形拼貼、全域開關旁路；不得影響 Stage1–7 或升格正式。
- 使用者核准只適用明確版本／範圍；組合拒收不等於每個組件拒收。

## 8. 執行、驗證與錯誤

- 已授權且不撞檔的工作持續完成；有依賴的路徑停下，獨立路徑繼續。
- 搜尋先用 rg，限相關範圍；不整份 dump 大檔、不重複讀舊證據。
- 優先局部修改與現有接口，不重建引擎、不加無 consumer 的平行資料。
- 適量 focused 驗證、負向案例與真頁 consumer；不靠測試數量交差。
- 改文件只做連結／一致性／diff 檢查，不跑遊戲大測試。
- 新組合需測 Lv5、Boss 抗性、去重／派生、暫停死亡清理與選卡空池。
- 真頁視口、加速模擬、自然局、實體裝置及人審分開記錄。
- 55/55 或其他歷史 PASS 不等於真機、自然十分鐘、M2 或發布完成。
- 缺真機列 WAITING_DEVICE，缺核准列 WAITING_HUMAN／ART，不假 PASS。
- 同阻塞最多三種實質方法；重試先診斷，保留命令／退出碼／錯誤。
- 不吞錯、不原樣盲試；缺權限／輸入／外部條件提早回報。
- 不裝系統級軟體、全域 CLI 或更動全域環境。

## 9. 簡潔回報與交接

- 繁體中文，成果／阻塞優先，省客套與重複背景，不虛構時間。
- 步驟用編號、比較用表格；進度只報增量。
- 分列已修改、靜態、測試、部署；未執行就寫未執行。
- 說明玩家可見結果、證據、未驗限制、下一 owner；不寫長監工日誌。
- 新交接只讀當前入口與相關任務，不按歷史「最高現行」重新派工。
- 發現企劃衝突只列最小決策與受影響範圍；不要停止所有無關工作。
- 里程碑以可重玩成果與明確 gate 判定，不以 Agent working 或測試數判定。
