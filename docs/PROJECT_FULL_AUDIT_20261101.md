# Yokai Delivery｜全專案健檢與第一、二關完成度稽核

> 稽核日期：2026-10-31（台灣時間；檔名按交接要求使用 20261101）。  
> **2026-10-31 最新產品決策覆蓋**：使用者已將融合系統暫時擱置，第一二關僅以六種既有主動技能通關（每局最多四槽）。本報告原先把「未開放融合」列 P1／B2 必修，是**決策前的歷史評估，不再適用**；詳見文末第 11 節。其餘原始測試與資產結果保留原樣以利追溯。


> 本機原專案：`I:\Projects\yokai-delivery`，`master` HEAD `a4aaa94`，檢查的是**現有大量未提交修改的工作樹**，不是已發布版本。  
> 方式：ChatGPT 透過 MCP1 直接讀取、搜尋、執行唯讀驗證與局部 Node 測試；**不改遊戲程式、素材或原有未提交檔案，不 commit、push、deploy、clean、reset、checkout 或 pull**。唯一新增項目為本報告。

## 1. 結論與證據分級

- **[實際驗證]**：本輪親自讀程式／檔案、執行工具或比對 SHA 得到的結果；**[程式碼推論]**：從分支推演，尚未正常遊玩驗證；**[需要玩家實測]**：視覺、聽覺、操作及真機完整局才能確認。測試 FAIL 只表示**契約不符**，不能自動等於生產 Bug。
- **P0**：本輪**沒有已確認的 P0 產品故障**；但沒有測完全遊戲，不代表不存在。**P1**：主要功能與正式完工阻礙。**P2**：局部行為、測試基線與資產一致性。**P3**：維護性、文件與低風險改善。
- **第一關夜行町**：20 張詞圖 + 20 段 Fish A 已核准、接線與詞序驗證；其他畫面、完整配送、Boss、融合與兩種裝置仍未完成使用者驗收，**不可宣告 100%**。
- **第二關雨夜港町**：17 張正式場景 + 4 張敵人／Boss 動作素材已做 canonical 接線；20 張詞圖與 20 段 Fish A 仍明確為 **IN_GAME_TRIAL_PENDING_USER_REVIEW**；3 組水王 Boss 特效仍為 **ART_CANDIDATE / BLOCKED**，**不可宣告 100%**。
- 最關鍵的**產品行為實證**：`js/fusion.js:252-265` 一般遊玩**不允許融合**，只有本機 `dev=1&fusionlab=1` 才啟用。雖然有十組配方和攻擊 consumer，這個門禁對「第一、二關融合玩法正式完工」構成 P1 阻礙。
- **不存在本輪可安全一鍵刪除的舊素材清單**。舊路徑有備援、候選、人審存證和現有使用者工作，不能只憑檔名或重複 hash 就刪。

## 2. Git 保護／模組盤點與測試結果

| 項目 | 本輪結果 |
|---|---|
| Git | HEAD `a4aaa94`，`master`，對 `origin/master` ahead 0 / behind 3，沒有進行任何同步 |
| Git dirty | `git status --porcelain -uall` **769 筆**：tracked 修改 **42**、tracked 刪除 **108**、untracked **619**、staged **0** |
| JS 語法 | `js/` 所有 **34 個 .js** 逐檔 `node --check`：**34 PASS / 0 FAIL** |
| 資產驗證 | `python tools/asset_registry.py --check`：**PASS 763 files / 141 aliases-copies**；沒有未登錄增減或缺／變動媒體 |
| 詞圖與詞序 | 第一、二關 **40/40 WebP** 由 sharp 成功解碼、均 **256×256、有 alpha**；圖音 manifest 的 01–20 項逐一等於 `js/delivery-lexicon.js` 同序日文詞；沒有查到兩關缺檔 |
| 前兩關聚焦測試 | 抽 12 個測試檔，**8 檔全通過、4 檔失敗**；紅測含融合 3/5 FAIL、融合系統 8/9 FAIL、升級 1/5 FAIL、Boss AI 11/11 FAIL |
| 其他跨系統抽查 | 額外 23 個測試檔，共 **281 PASS / 83 FAIL**；**不是全專案全部測試，也不是 83 個產品 Bug** |
| 未執行 | 正常完整遊玩、20 單配送、Playwright／Chrome、手機和平板實機、全套 npm test、正式八格（2 關 × 2 尺寸 × 2D/.60）、完整 Boss 視覺／發音審核、SW 快取重建 |

### 模組與責任

| 模組 | 用途 | 狀態／風險 |
|---|---|---|
| `js/game.js` 約 **8,922 行** | 關卡狀態、移動、碰撞、攻擊、升級、訂單、貨物、Boss、融合特效、結果、輸入 | 已實作但單檔過大，動多處容易引發回歸；**部分完成／真局待驗** |
| `js/ui.js` 約 **5,676 行** | HUD、升級／御守／結算、文字與控制面板 | 已實作；視覺與小螢幕可讀性待玩家驗收 |
| `js/renderer.js` 約 **5,634 行** | 地板／Y-sort／Canvas 2.5D、怪物、Boss 危險區、融合 VFX | 已實作；候選與安全退回分支多，須核對正常 URL 真 draw |
| `js/assets.js` 約 **3,105 行** | 圖音載入、stage runtime manifest、候選 gate、fallback、快取 | 正式＋舊版相容併存，**不能貿然砍掉** |
| `js/asset-paths.js` | 由 `tools/asset_registry.py` 生成之共通資產 alias | **唯一 alias 來源**；不得另外維護第二份手工映射 |
| `js/delivery-lexicon.js`、`delivery-media.js`、`delivery-icon-art.js`、`delivery-fish-audio.js` | 140 詞／前七關詞庫、01–20 圖音路由、試玩／批准隔離、日語 TTS 備援 | 第一關正式、第二關試玩，映射吻合 |
| `js/fusion.js`、`evolutions.js`、`skillfx.js` | 融合、覺醒及技能特效／狀態 | 有十配方但正常局 fusion 被 gate 關閉 |
| `js/boss-ai.js`、`world.js`、`config.js` | Boss 狀態機、區塊／建築碰撞、難度和 XP | 有程式；Boss Node 無 window 例外／XP 舊測試不吻合 |
| `js/audio.js`、`store.js`、`card-*.js`、`overworld*.js`、`controls.js` | BGM/SFX/TTS、存檔、圖鑑、世界地圖與輸入 | 已實作，有局部綠測；跨關、重啟、手機長時仍待驗 |

`game.js:8407-8436` 對畫面幀錯誤已有 catch／暫停／回復入口。`audio.js` 延遲 SFX 使用 epoch 與 BGM 淡出 token 保護；`game.js:7925-8381` 一次性初始化多個事件監聽，`delivery-icon-art.js` 使用 Map 快取。目前**沒有足夠證據判定重複監聽或記憶體洩漏**，需以多次開關卡、heap 與事件數實測。

## 3. 問題清單（P0／P1／P2／P3）

| ID／嚴重度 | 依據 | 問題、檔案位置、重現／原因 | 修復建議 |
|---|---|---|---|
| **P1-01 一般局融合入口未啟用** | **[實際驗證：功能門禁]** | `js/fusion.js:252-265` `isFusionEnabled()` 只接受本機 `?dev=1&fusionlab=1`，`:330-332` `onBossDeath` 在其他情況立刻 false。`tests/fusion-dual-realgame.test.cjs:249,362,548` 預期可觸發，現 3 個 FAIL。`fusion.js:7` 的舊註解仍說 `fusioncandidate/fusion`。這是刻意設計 gate，不是未定義變數。 | 將「何時在正常局開啟十融合」列作放行決策，按產品規格以單一 gate 安全開放，對正常局與 Fusion Lab 分開測 Lv5、繪馬、選擇、父技移除、傷害及重開。 |
| **P1-02 第二關水王特效未正式可用** | **[實際驗證：素材狀態；需要玩家實測畫面]** | `assets/img/runtime-art-manifest.json:507-560` `tide`、`tidalFan`、`rainVortex` 均為 `ART_CANDIDATE/BLOCKED`；`js/assets.js:1615-1629` 正常局 blocked，`js/renderer.js:3630-3730` 在 dev `bossart` gate 畫候選，否則用 ripple／幾何安全退回。 | 先讓玩家審三張水圖，才做 canonical 正式接線；同時逐招檢查 `slam/charge/ring/tide/fan/vortex` 外觀、預警、hitbox。**不把舊火焰仍顯示當作本輪已復現事實**。 |
| **P1-03 融合預警傷害時序疑點** | **[實際驗證：測試 FAIL；產品因果未定]** | `tests/system-a-fusion-playable.test.cjs:511` 預警前預期 HP 1000，實際 **990.4**；另有 `:413` 狐雷燈籠期待 3 實際 4、`:561` 雷符落點期待命中未命中。程式在 `js/game.js:4590-4840,6442-6810`。測試可能有其他攻擊或設計改過，未證實單一技能提前扣血。 | 隔離其他武器，逐幀記錄傷害來源／預警時戳／命中半徑；若**真的**預警前扣血，修產品並列 P1；若是測試假設不合時宜，更新 fixture。 |
| **P1-04 核心自然遊玩未獲放行** | **[需要玩家實測；非已證 Bug]** | `roadmap.md:3-14,83-96`、`docs/agent-handoff.md:15-21`：R20 夜行町可正常進關和屋前按 E 取件，直線自動導航被 house solid 擋導致配送0；R21 兩個 harness timeout，**不能判產品自然配送失敗**；第一、二關完整局、20 配送、Boss／結算未完成。 | 玩家正常繞路完整玩第一關，再玩第二關；工程端僅對實際回報且可復現缺陷做最小修。 |
| **P2-01 3 筆 Boss 水圖 SHA metadata 失準** | **[實際驗證]** | `js/assets.js:2312,2322,2332` 的 SHA 與實際 WebP 不符；實際檔案與 `assets/img/runtime-art-manifest.json` 一致。見下一節 SHA 表。 | 下批按權威 manifest 修 JS metadata，釐清 runtime 是否檢 SHA；不改圖片本體、不宣稱圖毀損。 |
| **P2-02 Boss AI 測試無 window** | **[實際驗證：Node 環境]** | `js/boss-ai.js:4` 定義 `root`，但 `:37,45` 直接讀 `window`；`node --test tests/v3-boss-ai.test.cjs` **11/11 FAIL**，先發生 `ReferenceError: window is not defined`。瀏覽器具 window，**未證瀏覽器 Boss 崩潰**。 | 使用現有 `root` 或注入 stage context，讓純 Node 能測；恢復衝刺穿牆、預警／safe lane、暫停與死亡測試。 |
| **P2-03 升級需求契約過時** | **[實際驗證：設定／舊測試衝突]** | `js/config.js:20-28` 第一關 normal 的 `xpNeedScale=0.9`、雨港 normal `0.8`；`tests/v3-growth-curve.test.cjs:26-41` 還期待 stage1 normal `0.75`，第一級實際要 **27 XP**、測試預期 **23**。該檔 4 PASS／1 FAIL；`v3-growth-accounting` 也有 1 FAIL。 | 先定當前難度標準與 6 次配送／25 次升級成本，再更新真 runtime assertion，不為過期值直接調難度。 |
| **P2-04 三組自測環境／mock 壞掉** | **[實際驗證]** | `tests/assets-loading.test.cjs:6-16` VM 只注入 Image/Audio/console，沒有 `fetch`，**23/23 FAIL**；`tests/r10-audio-bgm.test.cjs:207` `setMocks is not defined`，1 FAIL；`tests/fusion-replace-20261025.test.cjs:~207` `WL is not defined`，8 FAIL。 | 先修測試 mock／未定義 fixture，不因紅測就動正常瀏覽器的資產載入與音效引擎。 |
| **P2-05 舊地圖、場景和 UI 斷言漂移** | **[實際驗證：測試不符；產品待驗]** | `tests/content-world.test.cjs:78-124` 仍要求舊題包和 25 chunks/75 houses（7 PASS／5 FAIL）；`tests/r12-assets-loader.test.cjs:42-56` 期待舊 4 石地和 `USER_SELECTED_LIGHTWEIGHT`（4/2）；`tests/ui-readability.test.cjs` 以舊 UI 文本 regex 判定（39/11）；`tests/input-runtime.test.cjs` 含錯送、碰撞、凍結、HUD 等 130 PASS／31 FAIL。 | 將「明顯舊規格」與「可能產品退化」分流；對 input-runtime 的真行為小項逐一隔離重測，舊 UI regex 不可直接指揮重畫畫面。 |
| **P2-06 早期石地主 manifest 和現役泥土版不一致** | **[實際驗證：文件]** | `art/stage2-rain-port/manifest.json:8-17` 與 `manifest-dev-runtime.json:14-40` 仍描述 `g_stone_01..04`；正式 `assets/img/runtime-art-manifest.json:110-153` 四個角色均映到一張 `ground_mud_slab`，符合本次正式選擇。 | 在歷史 art 清單加 superseded 標記，**不改正式泥地、不刪原石地**；以 runtime manifest 為真正渲染來源。 |
| **P2-07 雨港有多組 candidate／legacy 路由** | **[實際驗證：程式存在；正常畫面待驗]** | `js/assets.js:2384-2475` 的 `RAIN_PORT_ASSETS/GROUND/CANDIDATE_ASSETS/SURFACE_CANDIDATE_ASSETS` 同時存在；後兩者在 `portCatalog()` 有條件加入，`js/renderer.js:695-990,1300,1808` 可畫。 | 以**普通 URL** 和 dev 旗標對照真 `Image.src/currentSrc`、`drawImage`；確認哪些是正常相容 fallback、哪些只供開發，才安全收斂。不能因路徑仍在就宣稱正式遊戲混圖。 |
| **P2-08 融合細項紅測未分類完成** | **[實際驗證：測試 FAIL；部分規格改動]** | `tests/system-a-fusion-playable.test.cjs` 9 項 8 FAIL，涵蓋 cooldown、TTL、圖像占位、傷害、繪馬；`tests/fusion-dual-realgame.test.cjs` 5 項 3 FAIL。`js/game.js:3408-3467` 勝利進場刻意保留飛出的攻擊特效 **1.5 秒**，老測 `:702` 卻要求勝利**立刻**清空；測試 `:750` 仍要求 TECH 占位文字。 | 將最新特效設計與「不再造成真傷害」分離，更新過期測試；只修隔離出來的真傷害／碰撞問題，不破壞勝利演出。 |
| **P3-01 程式碼集中且重複清理點多** | **[實際驗證]** | 4 大檔共約 23k 行；`game.js:2639,3386,3465,3794,8419` 有多次 `fusionEffects` 重置（啟動、死亡、勝利1.5秒、重置、錯誤回復用途不同）。 | 新修 Bug 時才抽純函式或單一 reset helper，先確認各分支的不同生命週期，**不做大型重構**。 |
| **P3-02 註解／版本 metadata 落後** | **[實際驗證]** | `js/fusion.js:7` 與 `:261-265` 門禁說法不同；部分 Stage2 art/source 文件仍留歷史路徑。 | 更新文件註記、統一權威 manifest，保留歷史追溯。 |
| **P3-03 行動端載入、FPS、記憶體資料不足** | **[程式碼推論／需要玩家實測]** | `js/assets.js` 異步載入、`delivery-icon-art.js:9,45-59` Map 快取、`service-worker.js` 版本更新、`game.js` input lifecycle。未測長局多次重開，不能判定有洩漏。 | 冷快取／弱網／DPR／tilt／頁面背景還原、跨關 5 次重開實測 heap、FPS、總下載量及音訊恢復。 |

**SHA256 不一致的確切實證**（左為實際 WebP 且與 runtime manifest 相同，右為 `js/assets.js` 舊值）：

| kind | 實際／runtime manifest | `js/assets.js` |
|---|---|---|
| tide | `db54ef1e0896d7a60cbec43239ac7ef910dc2d1f11c7dbd4200d5742489a899b` | `97d3ad48024a8cc5485a0b247eedb760bb2abc29aad304ab963498c160bf4cc4` |
| tidalFan | `05f063ac4ff595de1f5f1b50cebaa8614f23cd522145161fb5087175820819c0` | `b887523723d213d465ebdd2d01bde84f925e0635e7939b996c5248a5fd47317f` |
| rainVortex | `f3c65902f3f8f1e3e73345262d8e5ba9ce45d9900d9b501b8756a0416f294981` | `bc950af55b0b3ab4cef25d961f61da3ba9ee1520b2a8b3696c105b2e7bd5fe12` |

**限制**：以上 P1-03、P2-05、P2-08 的部分測試 RED 不是已經復現的正常遊戲錯誤；若缺少隔離證據，修復前必須重新證實根因。歷史 R21 測試走不過建築**不是**玩家必定走不過。

## 4. 第一關「夜行町」完成度

| 檢查子系統 | 狀態 | 放行缺口 |
|---|---|---|
| 地板、建物與道具 | **已整理路徑／視覺待驗** | 8 項場景／物件 canonical alias；`art/stage1-night-town/manifest.json` 的概念 preview 不是核准 runtime 圖。需看地面、Y-sort、建物遮擋、solid 可達性 |
| 12 張敵人圖、Boss 本體與攻擊 | **有正式接圖和程式／全戰待驗** | `renderer.js:3646-3650` 夜行町 Boss 專圖分支存在；需查各相預警／朝向、音效、命中與死亡 |
| 6 基礎技能、覺醒、10 融合、御守 | **部分完成** | 一般遊玩融合 gate 關閉，且測試存在 red；需 Lv1–5／Lv5 融合、御守持續、互斥與重開歸零 |
| HUD、UI、菜單、BGM、SFX | **部分完成／玩家待驗** | Boss 血條與題板、盾牌週期提示、字體對比、御守選擇時 BGM 不停止、手機手勢／排版 |
| 20 個單字 WebP | **正式批准且媒體檢驗 PASS** | `assets/img/delivery/night-town/01.webp…20.webp`，20 張有效，`manifest.json` 為 `APPROVED_BY_USER` |
| 20 個 Fish A MP3 | **正式批准、檔名／詞序檢驗 PASS** | `assets/audio/delivery/night-town/01.mp3…20.mp3`，`APPROVED_BY_USER`；Google／`ja-JP` TTS 後備有程式／測試，未本輪重新逐字耳聽 |
| 取件、答題、交貨、Boss、結算／重玩 | **正常完整局未經驗收** | R20 曾按 E 取件；R21 的 2 個 harness timeout 不證送貨壞；完整一局、錯送、升級、Boss 解封、存檔與重玩待玩家 |
| 效能、手機、平板 | **玩家待驗** | 首載冷快取、音訊解鎖、背景切換、FPS、透視 .60、觸控與螢幕旋轉 |

**第一關總判斷**：**未達正式完工 Gate**。素材中的單字圖音確已正式核准；剩餘最主要為融合正式入口、完整配送/Boss/結算、視覺與裝置適配。

## 5. 第二關「雨夜港町」完成度

| 檢查子系統 | 狀態 | 放行缺口 |
|---|---|---|
| 地板、接縫 | **已核准且已改統一路由** | 1 張正式泥地主地 + 3 張木板 + 1 張石木接縫，取代舊四石地；真畫面需看接縫、重複感、可走道路 |
| 建築／道具／海岸 | **已核准且已改統一路由** | 5 建築 + 5 道具 + 海面 + 海岸懸崖 = 12；需正常頁面 `drawImage` 真來源、前後遮擋與碰撞確認 |
| 怪物與水妖 Boss 本體 | **4 張正式圖已接** | 潮目小僧 idle/attack、水妖 idle/attack，足部錨點維持；動作播放、方向、尺寸、hitbox 玩家待驗 |
| Boss 3 水圖與標準招式 | **3 候選 BLOCKED；整體待驗** | `tide`、`tidalFan`、`rainVortex` 未正式放行；`slam/charge/ring` 是否仍誤用第一關火效、潮汐招範圍與警示，需正常局逐招看 |
| 20 個魚鮮單字 WebP | **已接本機試玩／未核准** | `assets/img/delivery/rain-port/01.webp…20.webp`；20/20 索引、透明與解碼 PASS，狀態 `IN_GAME_TRIAL_PENDING_USER_REVIEW`；玩家需審圖義與風格 |
| 20 段 Fish A MP3 | **已接本機試玩／未核准** | `assets/audio/delivery/rain-port/01.mp3…20.mp3`；20/20 日文詞序對應，狀態仍 `TRIAL`；玩家需逐字聽尤其魚名、重音與日語 TTS 備援 |
| 配送、Boss、融合、HUD、結算 | **共享主程式／正常完整局未驗** | 不能因第一關共用程式就視為第二關已通；港口障礙物、水面邊界、正常局融合、完整配送／結算都需要驗 |
| 手機、平板效能 | **玩家待驗** | 水面層、圖片大檔、載入順序、音訊恢復、DPR 與 tilt |

**與第一關額外差距**：第二關還多 **40 份詞圖音正式人工核准**、**3 張水王特效核准／正式接線**，以及泥木碼頭、海水和新建物之真視覺與 hitbox 驗收。**不能把第二關試玩路徑視為正式核准。**

## 6. 資產完整性、待清理與保留

`docs/ASSET_INVENTORY.json` 的 **763** 筆分類：

| 分類 | 數量 | 處置 |
|---|---:|---|
| canonical | **181** | 正式／共通資產，保留 |
| trial_pending_review | **40** | 第二關圖 20＋音20，**不升為 APPROVED** |
| legacy_alias_active | **96** | 已生效 alias，但原來源可能是 fallback／核對基準，**不刪** |
| legacy_source_pending_renderer | **45** | consumer 尚需確認，**不刪** |
| legacy_review_required | **61** | 人工用途與語意未定，**不刪** |
| legacy_unmigrated | **340** | 再分批查用法，**不批刪** |
| 合計 | **763** | 靜態驗證通過，但不等於人審完成 |

`docs/ASSET_CONVENTIONS.md` 記錄 **141 筆路徑映射，96 筆生效**（前輪 75＋第二關21）。第二關 17 scene + 4 敵人已對 SHA 證實；Boss 水效另屬 candidate。`js/asset-paths.js` 是**生成式 alias**，先搜尋 registry／權威 manifest 再修改 mapping。

**待核實可精簡項目**：早期石地主 doc 與進階 UI 測試 fixture、過時 `scratch`／`test-results`／遺留 `art` candidates；這是**待評估清單不是刪除授權**。不可清理 `AGENTS.md` 所要求保存的原始、測試紀錄、來源圖、音檔、既有 JS fallback 或 Git dirty。

## 7. 測試覆蓋缺口與程式精簡風險

**12 個聚焦檔中 8 檔全綠**：`asset-registry`、`delivery-media-routes`、`rain-port-delivery-trial`、`night-town-approved-fish`、`stage2-approved-media-routes`、`media-cache`、`audio-events`、`delivery-v3`。

**4 檔紅**：`fusion-dual-realgame` 2/5 PASS、`system-a-fusion-playable` 1/9 PASS、`v3-growth-curve` 4/5 PASS、`v3-boss-ai` 0/11 PASS。請先按上表分「功能門禁」、「舊斷言」、「未補 mock」、「需隔離實測」再修。

**額外 23 檔**總計 281 PASS／83 FAIL；其中 `input-runtime` 130／31、`assets-loading` 0／23、`fusion-replace` 0／8、`ui-readability` 39／11、`content-world` 7／5、`r12-assets-loader` 4／2、`r10-audio-bgm` 0／1；其餘包括控件、碰撞、遊戲平衡、Boss 戰音、舊路徑、卡片獎勵、音訊時序等多數局部通過。

**關鍵未測**：自然 20 配送、故意錯送與重新派單、Boss 六招逐個警示－命中－受擊、一般關卡 10 融合、御守疊加／掉落、難度曲線真實手感、長時間切關／存檔、首載／離線快取／行動裝置、圖片版面與語音音高、真實 FPS／記憶體。使用者實際遊玩優先於重建不可靠的長跑 QA。

| 精簡候選 | 路徑 | 風險／策略 |
|---|---|---|
| 更新陳舊註解和被替代 art manifest | `fusion.js:7`、`art/stage2-rain-port/*manifest*` | **低**；文檔修正，不動實物 |
| 修失效測試 VM/fixture | `tests/assets-loading`、`r10-audio-bgm`、`fusion-replace`、`v3-boss-ai` | **低～中**；先讓產品可被可靠測，再判產品 Bug |
| 修 XP／場景／UI 過期斷言 | `tests/v3-growth-curve`、`content-world`、`r12-assets-loader`、`ui-readability` | **中**；需要現行規格權威，勿藉修綠掩蓋真退化 |
| 合併雨港 dev candidate 判斷／alias | `assets.js:2384-2475`、`renderer.js` | **中～高**；先證普通 URL 真 draw 路由，舊兼容仍可能必要 |
| 統一重複的狀態重置 | `game.js:2639,3386,3465,3794,8419` | **中～高**；不同生命週期故意不同，不能簡單合併 |
| 把巨大檔案拆模組 | `game.js/ui.js/renderer.js/assets.js` | **高**；**本輪不重構**，後續每次修 Bug 只抽小段純函式 |

## 8. 下一輪 Roadmap（可獨立驗收小批）

| 順序 | 批次 | 工程目標與驗收門檻 | 玩家工作 |
|---|---|---|---|
| **1** | B1 真實測試基線 | 先修 `fetch/setMocks/WL/window` test fixture，確認現行 XP、泥地、UI 契約，分類 83 個紅測、留一份「真產品缺陷 vs 過時測試」清單；不動無關程式 | 無需完整局 |
| **2** | B2 核心融合與公平性 | 決定並安全開放一般局融合；檢查 10 組 Lv5→繪馬→確認→父技能停攻→新招扣血→暫停／死亡／重開；特別排除預警前傷害 | 正常第一關、第二關各測一次融合 |
| **3** | B3 第一關真局 Gate | 修使用者真的重現的取貨／配送／Boss／HUD／BGM 與結果保存問題，提交可玩本機 URL 和最短測法；**不再無止境修自動導航 harness** | 自然一局：進場→取送→Boss→結算→重玩 |
| **4** | B4 第二關水王和場景 | 待水圖人審，修 3 SHA metadata，批准後才換路由；普通 URL 測泥地、木棧道、海面、5 建物、5 物件、2 本體與水招命中；不可誤取第一關火圖 | 六招水 Boss、地面接縫和碰撞 |
| **5** | B5 雨港詞圖音核准 | 對照 20 詞審稿清單，玩家逐張圖、逐段 Fish A 試聽；只有玩家批准後調整 `APPROVED_BY_USER`，測 Google `ja-JP` 備援 | 明示核准／退回的詞項 |
| **6** | B6 雙關正式整合 | 第一二關共用程式做完整局、跨關重開、Boss、御守、技能、存檔、手機和平板、2D/.60、冷快取、音效與 FPS | 雙關最終實機驗收 |
| **7** | B7 無風險清理 | 45 pending renderer、61 review required 查引用、舊 fallback／檔案 SHA 與唯一性，再立清理提案，不先刪；測試修補與註解精簡 | 僅審有變動的正式素材 |
| **8（延後）** | 第三關 | 前兩關達 Gate 後才開始後續關卡正式圖音與玩法 | 逐關審美術 |

### 完工定義

必須同時達成：**正式圖音經玩家核准**、正常 URL 使用真正式檔、主要玩法與 Boss 戰可自然完成、融合／升級／御守等系統符合當前規格、音效與結算正常、桌機／手機沒有阻擋性缺陷、存檔與跨關重開可驗證。**所有待審或 NOT_RUN 都不能轉稱 PASS**。

## 9. 紀錄與重跑方式

來源：`AGENTS.md`、`README.md`、`roadmap.md`、`docs/agent-handoff.md`、`docs/ASSET_CONVENTIONS.md`、`docs/ASSET_REGISTRY.json`、`docs/ASSET_INVENTORY.json`、`docs/STAGE_PATHS.json`、`docs/DELIVERY_MEDIA_PATHS.md`、`docs/STAGE2_APPROVED_MEDIA_MIGRATION_20261031.md`、`docs/RAIN_PORT_DELIVERY_TRIAL_20261031.md`、`art/stage1-night-town/manifest.json`、`art/stage2-rain-port/manifest.json`、`art/stage2-rain-port/manifest-dev-runtime.json`、`assets/img/runtime-art-manifest.json`，以及上述原始 `js/`、`tests/`。

實際執行的主要命令：`git status --porcelain -uall`、逐檔 `node --check js/<module>.js`、`python tools/asset_registry.py --check`、`node --test tests/<testfile>.test.cjs`（12＋23 個聚焦檔逐檔測）、Node crypto SHA256 對照、sharp WebP 解碼與圖音 manifest 詞序檢查。以上檢查只證本機**本次**的程式與素材狀態；沒有替代正常玩家試玩。

**本輪沒有進行任何遊戲程式修復、人工美術核准、Git 提交或部署。**

---

## 10. B1 測試基線修復追記（2026-10-31；原始盤點快照保留）

> 此段為原稽核的後續修改紀錄。上方「僅新增報告／0/11 Boss」等數值描述的是**修復之前的快照**；請以本節的「修復後」驗證為準。均為本機工作樹，**未 commit / push / deploy**。

### B1 已修正（[實際驗證]）

| 檔案／範圍 | 原因與最小安全處置 | 本機重測 |
|---|---|---|
| `js/boss-ai.js` ＋ `tests/v3-boss-ai.test.cjs` | 原 Node require 無 `window`，將兩處全域參照統一改既有 `root`；舊測試的第三個 stage 引數不在實際 `start(e,p)` 契約中，改為設定 `e.stageId` | **11/11 PASS**（原 0/11） |
| `js/assets.js` ＋ `tests/assets-loading.test.cjs` | 原有 `ART_CANDIDATE` 水王圖片在正常模式預載（標題畫面本應只啟動封面），違反未核准圖僅 dev 預覽的註解與載入成本規則。恢復 **本機 DEV_MODE＋`bossart=1`** 才啟用的門禁；Node VM 補 `fetch` stub；旅路預載清單按現行封面＋7 圖修正測試計數 | **23/23 PASS**（原 0/23） |
| `tests/fusion-replace-20261025.test.cjs` | 舊測試在 VM 外複製 `WL` 等私有變數的假交易橋，造成全紅且不是測真流程。改從真 `game.js` 綁定的交易橋接器取得函式；以本機 `dev=1&fusionlab=1` 隔離測試、補 60 秒門檻；修正配方「妖刀＋狐火→墨焰斬」及非父技能投射物應保留等錯誤斷言 | **8/8 PASS**（原 0/8），僅 Node VM，不代表玩家實機融合已通 |
| `tests/v3-growth-curve.test.cjs` | 當前 `js/config.js` 之 night-town normal XP 門檻倍數 **0.90**，舊測試仍用 0.75。改逐級測 25 次，正常總 XP **1941**，hard **2156** | **5/5 PASS**（原 4/5） |
| `tests/r10-audio-bgm.test.cjs` | 移除不存在的 `setMocks`、修正對非 iterable 音軌做 spread、補獨立模擬的 frame stub | **獨立邏輯模擬 6/6 PASS**（Node 測試檔 1/1）；此檔內是複製的 BGM 邏輯，**不是**對正式 `audio.js` 的直接驗證 |

### 仍未放行／下一步（按風險）

1. **P1｜一般遊玩融合未開放**：`js/fusion.js` 仍限定 `dev=1&fusionlab=1`，本輪沒有改門禁。其他 `fusion-dual-realgame`、`system-a-fusion-playable` 等舊測試仍須逐條對照現行玩法與公平預警，不能用測試全綠代替實機判斷。下批 B2 才評估安全上線。
2. **P1｜第二關 Boss 水效果待審**：`slam/charge/ring/tide/tidalFan/rainVortex` 共用候選 raster，現已隔離於 `bossart=1` 本機預覽。**正常模式可能回到舊 VFX 備援**；這是避免未核准水圖誤接正式模式的暫時安全處置，**不等於水 Boss 已完成**，需玩家核准後再做正式新路由與視覺驗收。
3. **P2｜其餘舊紅測尚未全部回歸**：原 23 檔額外掃描 281 PASS／83 FAIL 為 B1 前歷史統計；目前已分別修通 `assets-loading`、`fusion-replace`、`r10-audio-bgm`，但其他檔尚未全面重測；不應把原 83 直接重算為零。XP 與地板路由現行規格應優先於未更新的字串／數量斷言。
4. **玩家待驗**：正常兩關完整配送、Boss 招式與危險區、音訊和 HUD、真手機／平板、所有美術與單字圖音批准狀態，**USER_PLAYTEST_PENDING**。不執行長時間自動化玩法 harness。

**本次修改範圍**：正式程式僅 `js/boss-ai.js`、`js/assets.js`；其餘僅五個明確指定測試檔與此報告。所有更動皆留在原有 dirty 工作樹。未刪素材、未改 TTS／BGM／金鑰、未更動一般模式融合門禁，未提交或部署。

**B1 收尾聯合回歸（[實際驗證]）**：8 個針對性 Node 測試檔聯跑 **56/56 PASS、0 FAIL**（Boss AI、資產載入、融合交易、成長、BGM 獨立模擬、第二關核准接圖、單字路由、第二關詞圖音試用）。`node --check js/assets.js`、`node --check js/boss-ai.js` 通過；`python tools/asset_registry.py --check` 為 **PASS 763 files / 141 aliases-copies**。此聯合回歸不涵蓋其他歷史紅測與玩家完整遊玩，故不改第一、二關正式驗收狀態。


## 11. 最新產品規格覆蓋：融合延期，六招完成前兩關（2026-10-31）

**[使用者決策]** 融合系統暫時擱置，日後重新審視設計，**不列入第一、二關完成度或 P1 阻礙**。舊第 1、3、4、7、8、10 節對「融合必須開放」「十融合驗收」「B2 下一輪開發」之文字僅代表決策前快照，均依本節更新，不安排新的融合功能、美術、平衡、UI 或完整測試。

**目前正式玩法**：六種基礎主動技能為 妖刀斬（`katana`）、淨化靈陣（`barrier`）、狐火炎（`fire`）、陰陽符（`boom`）、天狐雷（`thunder`）、天狐靈針（`needle`）；**六招為可選總池，每局最多四槽，保留 Lv1–5／覺醒／被動與御守**。`js/game.js` 的 `getEligibleChoices` 會排除 `fusion_`，`js/fusion.js` 一般模式仍關閉融合，僅本機 `dev=1&fusionlab=1` 可進入隔離測試。以上是**靜態程式核對**，不是本輪親玩結果。保留所有融合 registry、攻擊 consumer、素材、既有測試；不刪除、不接正式遊戲。

**修訂後的下一步優先序**：
1. 第一關 night-town 六招正常升級／覺醒、公平性、取件答題配送、Boss、御守、HUD、BGM、結算及重玩。
2. 第二關 rain-port 地板／木棧道／海岸／建築／敵人和水王正常圖片接線、Boss 招式、配送、結算及詞圖音審核；水王候選不得未經玩家核准轉正式。
3. 第一／二關真機與行動裝置、冷載入、跨關重玩、手感及視覺完整驗收，達成雙關 Gate。
4. 有依據的舊資產／測試清理與第三關後續；**融合設計重審獨立延期，不自動啟動**。

**變更界線**：只修正計畫、交接與評估優先序，未修改融合門禁或六招技能平衡，未刪除任何資產，未 commit／push／deploy。以前 B1 修通的融合測試可保留作封存基線，不代表應恢復開發。


## 12. B3 第一關雙 Boss 封印題目修復（2026-10-31）

**[已復現 P1 真產品程式錯誤，已修復]** `js/game.js` 的更新路徑原把 `bossQ` 永遠綁在 `enemies` 列表的**第一隻護盾 Boss**，而非玩家附近、正在提示題目的 Boss；`answerBoss` 也會錯用第一隻 Boss 校對答案。多隻 Boss 存活（舊王遠處／新王靠近）時，接近新王可能完全沒有封印題目；同屏雙王也可能對錯盾。

**最小修復**：讀題結界挑選 380px 範圍內**最近**且可讀題的 Boss，結界到期仍允許對近距離護盾 Boss 答題（不再暫停戰鬥），實際回答依 `e.quiz === bossQ` 鎖定同一個 Boss；舊單王探針保留同詞近距離備援。**沒有改 Boss 攻擊、HP、封印懲罰、六招傷害、音訊和美術，也沒有碰融合門禁**。

**可重現測試**：新增 `tests/b3-night-town-boss-quiz.test.cjs`；在修正前先跑到 **1 PASS／1 FAIL**（遠方 Boss 搶走近端 Boss 題目）。修後補上同屏雙王較近優先，三個回歸案 **3/3 PASS**；聯跑 Boss AI 11 項及 delivery media 7 項，**21/21 PASS**。另一舊 `agy-m1-contract` 靜態字串測試 **5/6**，唯一紅案要求已被新「天狐靈針 Lv5 八方輪射」取代的舊覺醒名稱，**不視為目前產品錯誤**。先前大批 M1/V3 紅案包含天亮必達600秒、舊 5 秒勝利演出、固定錯答6油、舊針追蹤等已過時契約，尚未逐條更新也不可直接宣稱其它產品有故障。

**限制與交付**：未實際操作瀏覽器完成一整局，第一關仍 **USER_PLAYTEST_PENDING**，不宣稱 Boss、交貨或結算視覺已全數驗收；本次未提交／部署，專案 dirty 工作樹維持保留。

**補充檢驗**：新增 `tests/b3-night-town-six-skills.test.cjs`，兩例驗證普通主動升級池只開六招、舊融合／Duo 不會出現、四槽限制，以及新局清除技能狀態，**2/2 PASS**。與新 Boss 封印回歸、`v3-boss-ai`、`delivery-v3` 聯跑 **23/23 PASS**；另測第一關核准的 20 圖音接線、御守 UI 與錯詞重現，三檔 **15/15 PASS**；本輪選定短程 Node 測試合計 **38/38 PASS**。這是工程測試，不是操作體驗／完整局通關。



