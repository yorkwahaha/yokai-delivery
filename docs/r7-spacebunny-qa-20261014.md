# R7 獨立 QA：第二關雨夜港町 妖怪／終王（Space Bunny，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4），獨立測試／回歸／真 Chrome 實測
> 協調：ChatGPT 日程總協調｜production JS：Cursor（w5:p6）｜圖片：AGY（w5:p5）｜架構爭議才動 Codex `codex_lead`（w5:p8）｜Grok 已退出
> 本輪**不採用** Codex 先前的 86/86、613/613 與 28 張截圖作為我的 QA 結果；下列數字全部由本輪自己的 harness 重跑產生。
> 部署狀態：**未 Commit／未 Push／未 Deploy**（部署門未過，見 §6）

## 本輪總結（先看這裡）

| 階段 | PASS | FAIL | HUMAN_REVIEW | BLOCKED |
| --- | --- | --- | --- | --- |
| 靜態／離線（S1–S7） | 6 | 0 | 3 | 1 |
| 真 Chrome 決定性案例（4 視口 × A/B/C 共 19 項） | 66 | **0** | 9 | 0 |
| 真實時序冷啟動（9 組） | 9 | 0 | 9 | 0 |
| 工具鏈守門（F1–F4） | 2 | 0 | 2 | 0 |
| Node 回歸（39 檔，排除讀音檔那一項） | **609/609** | 0 | 0 | — |

真截圖 189 張，全部在 `artifacts/validation/spacebunny-r7-20261014/`。
**第二關妖怪與終王的程式／畫面接線全數通過；仍 BLOCKED 的是地板與美術人審，不是接線。**

---

## 0. 邊界與工具鏈

| 項目 | 內容 |
| --- | --- |
| 唯一新增檔 | `tests/spacebunny-stage2-independent.acceptance.cjs`、`docs/r7-spacebunny-qa-20261014.md`、`artifacts/validation/spacebunny-r7-20261014/` |
| 未動檔 | 所有 `js/`、既有 `tests/`、`assets/`、`index.html`、`service-worker.js`、`roadmap.md`、`AGENTS.md`、`docs/agent-handoff.md` |
| 觀測方式 | 只在 HTTP 回應層注入 `window.__sbQA` 觀測 hook（存在瀏覽器記憶體），磁碟檔案零改動；production 的生成、AI、結算流程全程真跑 |
| 瀏覽器 | 真 Chrome headless（CDP，`C:/Program Files/Google/Chrome/Application/chrome.exe`） |
| 音訊 | `/assets/audio/*` 一律 204 空回應、`js/audio.js` 以靜音 stub 回應；**零位元組讀取、零 TTS／API 呼叫**；不重跑會讀真音檔的 `tests/media-cache.test.cjs` |
| 伺服器 | 自架 `127.0.0.1:9184／9186`（Codex 的 9144 預覽伺服器保持原樣未動） |
| 禁止動作 | 未 commit／push／deploy；未執行 `git reset/clean/checkout`；未 kill 他人程序 |
| 視口 | 桌機 1280×800（2D／2.5D）、iPad **模擬** 1194×834、1024×768；**不得宣稱真 iPad** |

重跑指令：

```
node tests/spacebunny-stage2-independent.acceptance.cjs --phase=static
node tests/spacebunny-stage2-independent.acceptance.cjs --phase=det --port=9186
node tests/spacebunny-stage2-independent.acceptance.cjs --phase=rt   --port=9186
node tests/spacebunny-stage2-independent.acceptance.cjs --phase=all  --port=9186
node tests/spacebunny-stage2-independent.acceptance.cjs --phase=det --port=9186 --only="desktop-1280x800-2d"
```

證據檔：`evidence-static.json`／`evidence-det.json`／`evidence-rt.json`／`evidence-all.json`、`qa-log-*.txt`、`run-*-console.log`、`sb-*.png`（真截圖）、`geometry-census.json`、`regression-excluding-media-hash.log`。

---

## 1. 靜態／離線（已完成）

| 編號 | 項目 | 結果 | 證據 |
| --- | --- | --- | --- |
| S1 | 四張核准 WebP 與 manifest 一致 | **PASS** | 4/4 `sha256`＋`bytes` 相符；且與來源候選 `art/r4/handpainted-candidates/stage2-enemies/rework/*.webp` **位元組完全相同**（未二次加工） |
| S2 | service-worker media revision | **PASS** | 4/4 revision 等於檔案 sha256 前綴（24 碼），離線快取不會拿到舊圖 |
| S3 | PORT_ENEMIES 載入器契約 | **PASS** | 獨立命名空間、4 角色、`?v=20261014-stage2-enemies1`、`PORT_ENEMY_STATUS` ready/error 可觀測 |
| S3b | manifest 與程式角色命名不一致 | **HUMAN_REVIEW** | manifest 用 `minion_shiome_idle`／`boss_ikari_umibozu_idle`，程式用 `shiomeIdle`／`bossIdle`；同一批圖兩套命名 |
| S4 | 第二關角色本體純圖 | **PASS** | `drawStage2Actor` 只有 `drawImage`（drawImage=1、fillRect=0、arc=0） |
| S4b | 程序幾何殘留（保留原有 RED） | **HUMAN_REVIEW** | 見 §5 |
| S5 | 關卡識別守衛 | **PASS** | 生成帶、`umibozu` 旗標、姿態切換皆以 `STAGE.id === "rain-port"` 守衛；第一關完全不引用 `PORT_ENEMIES` |
| S5b | 共通 Boss fallback（保留 RED） | **HUMAN_REVIEW** | 見 §5 |
| S6 | 潮目小僧數值契約 | **PASS** | `h.t >= 0.62` 鎖向預告、`damage: 8`、`h.hit` 單次守衛、`e.shiomeCd = 2.4`、17%（0.55–0.72）幽靈帶、`shiomeHold` 施法期間站定 |
| S7 | 第二關石→木交界 | **BLOCKED** | 過渡圖在 catalog 但 `portGroundPick()` 完全沒選用（靜態實測 `transUsed=false`）→ 硬切仍在 |

人工看過四張圖（非數字判定）：Shiome idle／attack 同母版（圓水滴頭、無足水尾、網衣紙燈；attack 加尖焰髮與潮浪手勢）；Ikari Umibozu idle／attack 同角色（面具、繩鏈、鏽蝕船錨、水浪下身；attack 獠牙握錨擊水）。四張皆手繪點描水墨，非程序幾何，與第一關町屋同一美術語彙。**此項不等於整關美術核准。**

---

## 2. 真 Chrome 決定性案例（`--phase=det`）

四個視口：桌機 1280×800 2D／2.5D、iPad 模擬 1194×834 2D、1024×768 2D。每個視口都跑 A（潮目小僧）、B（終王）、C（第一關回歸）三組。

| 編號 | 驗收點 | 結果 | 實測 |
| --- | --- | --- | --- |
| A1 | 一般波次真生成潮目小僧 | **PASS 4/4** | 幽靈帶 17%（`hp=3`），生成點在視野外 430–800px，由真 chase 逼近；全程未改任何敵人欄位 |
| A2 | 待機姿態確實可見 | **PASS 4/4** | 待機 `minion_shiome_idle.webp` 落在畫布內；用「抑制重畫＋像素差分」證明像素真的在畫面上（sprite 區 8.8–23.7% vs 對照區 0.0–2.8%）。跨多輪量測曾抓到小怪被港町倉庫整個蓋住的畫面（差分 0.17%），已列為 §5-7 發現 |
| A3 | 姿態 idle→attack→idle 與 0.62s 預告 | **PASS 4/4** | 多數波次實測 0.63–0.67s（取樣粒度 0.02s ＋繪圖幀偏移，允許 ±0.06s）；姿態序列 `idle → attack:telegraph → idle → attack:telegraph → …`，預告期間敵人站定不追擊 |
| A4 | 攻擊姿態確實畫出來 | **PASS 4/4** | telegraph 與 active 都畫 `minion_shiome_attack.webp`，strike 幀畫布內可見、未被景物圖遮擋 |
| A5 | 潮波只扣一次 8 油 | **PASS／HUMAN_REVIEW** | 可歸因波次全部恰好一次 `8.009`（8 油＋0.009 燈油自然消耗），**全部波次沒有任何一次第二次 8 油**；無歸因的波已逐條分辨原因（潮波自然落空 minDist>26px／共用無敵幀先被其他怪吃掉），列人審 |
| A5b | 射程外自然落空 | **HUMAN_REVIEW** | 鎖定距離 182–210px 的波必定落空（射程 156＋半徑 26 < 鎖定距離），實測量到 d=209.4 |
| A6 | 2.4s 冷卻 | **PASS／HUMAN_REVIEW** | 單一小怪的波次實測 2.4s；多隻小怪同時在場的波次量到 1.82／3.58s（下一個 telegraph 可能屬於另一隻，無法歸因） |
| A7 | 0.62s 預告可閃避 | **PASS 3/4 + HUMAN_REVIEW 1** | 預告瞬間垂直離開鎖定線 240px 後，潮波完全落空（0 次可歸因 8 油傷害，潮波最近 94–209px）；一個視口因同時有多隻小怪而無法歸因 |
| A8 | 第二關不錯畫共通 Boss | **PASS 4/4** | 整段小怪流程 `window.ART.boss` 被畫 **0 次** |
| B1 | 真排程生成專屬終王 | **PASS 4/4** | 真 `bossBlueprint(3)`／spawn／wait 條件／`umibozu=true, final=true, shield=true, bossIndex=3`；只推進時鐘，未手造實體 |
| B2 | 封印期間 idle＋Ikari 圖 | **PASS 4/4** | 封印期 pose=idle、畫的是 `boss_ikari_umibozu_idle.webp` 且畫布內可見、0 次共通 Boss 圖 |
| B3 | 真結界作答破封 | **PASS 4/4** | 走真 `bossQ`／`answerBoss`；Audio 只記錄到 `startBossMusic` 呼叫，未發聲、未讀音檔 |
| B4 | tide telegraph/active 切 attack | **PASS 4/4** | 潮汐 telegraph 起 pose 即 `attack`，active 期間畫 `boss_ikari_umibozu_attack.webp`（可見、未遮擋） |
| B5 | recovery 回 idle | **PASS 4/4** | hazard 清空後 pose 回 `idle` 並畫回 idle 圖 |
| B6 | Boss UI 不遮擋終王 | **PASS 4/4** | 用 production `UI.bossQuizLayout()` 取真版面，終王 sprite 與答題板／血條重疊面積 **0px²** |
| B7 | 全場無錯畫共通 Boss | **PASS 4/4** | 整場終王戰 `window.ART.boss` 被畫 **0 次**（PORT_ENEMIES 四圖 ready 時 fallback 不會觸發） |
| C1 | 第一關完全不產港口怪 | **PASS 4/4** | 200 秒模擬波次共現 ghost／runner／boss，潮目小僧 **0**、umibozu **0** |
| C2 | 第一關 Boss 仍是原本圖 | **PASS 4/4** | 畫的是原本 `boss.webp`，全程 0 次引用 rain-port 美術 |

### 量測方法揭露（harness 做了什麼、沒做什麼）

- **完全沒動**：敵人欄位（位置／血量／速度／冷卻）、波次排程、BOSS_AI、結算、答題、掉寶。
- **只動玩家位置**：三種情況會把玩家搬到指定座標，全部揭露——① 貼身時量不到 8 油 → 放到鎖定角線 120px；② 閃避測試 → 垂直拉離 240px；③ 封印中的終王在 380px 停住不動、玩家不動就看不到它 → 走到它面前 220px（真實玩法也是玩家自己走過去）。
- **量測窗之外**維持玩家無敵並補滿燈油（燈油每場自然消耗 0.43/秒，長模擬會進入 `lampout` 凍結）；進入升級選卡時自動用 production `pickUp(0)` 選第一張，否則 `update` 提前返回會讓後續生成／招式全都不發生。
- **傷害歸因**：逐 0.02s 格計算扣油量並分類（潮波 8／接觸 10／坦克 18／燈油消耗 0.0086），8 油只有在「被追蹤那隻小怪的潮波距離 < 40px」時才算潮波傷害，避免混到其他怪。

---

## 3. 真實時序冷啟動回歸（`--phase=rt`）

真 rAF、真实時間、每組 9 個冷啟動取樣點（0／150／300／600ms／1／2／3／5／10 秒）＋切鏡（把玩家搬到另一個 chunk）後 8 個取樣點，共 9 組（night-town 與 rain-port × 桌機 2D／2.5D、iPad 模擬 1194×834、1024×768）。

| 項目 | 結果 | 實測 |
| --- | --- | --- |
| 每個取樣窗都有真圖片 draw | **PASS 9/9** | 每窗 `img>0`（最少 106 次／窗），沒有任何空白或全幾何畫面 |
| 無白色幾何房子／地板 | **PASS 9/9** | `whiteRatio` 最高 0.0036 < 0.01；`flatGrayRatio` 最高 0.0072 |
| 未上色（背景色）比例 | **HUMAN_REVIEW 9/9** | 前 600ms 最高 66–80%，1 秒後收斂到 5.2–13%。**我人工看過 0ms 與 1000ms 截圖：高比例來自「第二關／夜行町」標題卡的整體壓暗，不是地板沒畫**；標題卡退場後地板已完整（石板＋ dirt path＋櫻花瓣＋町屋圖），切鏡後 150ms 也沒有拼接斷裂 |
| Chrome 未捕捉例外 | **PASS** | 9 組全程 0 例外 |

> **重要**：以上像素統計只能量化「未上色區域」，**無法判定地板拼接是否美觀**。第一關 P0（初載／切鏡地板）**維持 BLOCKED**，本報告不解除 AGENTS.md 部署門第 1 條。

---

## 4. 獨立回歸（Node）

```
node --test tests/*.test.cjs（排除 tests/media-cache.test.cjs，該檔會讀真音檔）
→ tests 39 files / pass 609 / fail 0 / skipped 0 / exit 0（26.7s）
```

日誌：`artifacts/validation/spacebunny-r7-20261014/regression-excluding-media-hash.log`。
**這是程式回歸，不是美術合格，也不是部署許可。**

---

## 5. 保留的既有 RED 與新發現（不自行修改）

1. **`js/renderer.js:953-982` `drawSpiritGem` 魂玉仍是程序多邊形**（五邊形＋白高光＋橢圓光暈，無 `drawImage`）。依 AGENTS.md 第 0 節第 1 條「道具必須是真圖」，這是跨關卡既有 RED。建議：AGY 出手繪魂玉 sprite，Cursor 改 `drawImage`；需使用者先核准造型。
2. **`js/renderer.js:777-802` `drawBossSeal`**：終王封印圈（虛線圓）＋和紙家紋為程序幾何（第二關沿用既有結界視覺）。
3. **`js/game.js:2519 drawShiomeWave`／`js/game.js:2533 drawBossHazard`**：潮波與潮汐預告為程序幾何（線／弧／半透明帶），屬招式提示類。
4. **`js/renderer.js:769` fallback**：核准圖未載入完成時會改畫 `window.ART.boss`。本輪全程 0 次觸發（PORT_ENEMIES 四圖皆 ready），但路徑仍在。
5. **第二關石→木硬切**：過渡圖 `ground_trans_stone_wood_h/v` 在 catalog 但 `portGroundPick()` 沒用，持續 BLOCKED。
6. **新發現（待 Cursor／使用者判斷）**：
   - **小怪可能卡在建築死角**：`mis` 類型有 2.5 秒防卡死邏輯，其他類型（含潮目小僧）沒有。實測有出生點 20 秒內走不近玩家（最後距離 233px）。
   - **潮波射程 156＋半徑 26＝182 < 觸發距離 210**：鎖定距離落在 182–210px 的潮波必定落空，等於貼到 200px 內的小怪第一次出手無效。建議對齊兩個數值。
   - **貼身時潮波會被共用無敵幀吃掉**：小怪貼到 25px 內時接觸傷害（10 油）會觸發 `P.inv=1`，隨後潮波的 8 油被同一段無敵吃掉，玩家實際只掉 10 而非 18。屬設計後果，是否要分開計請使用者定。
7. **潮目小僧可能被建築完全遮住**：跨多輪量測曾抓到小怪停在「港町倉庫」正後方的畫面——`drawImage` 有呼叫且在畫布內，但抑制重畫後像素幾乎沒變（0.17%），代表玩家實際看不到待機圖；同型情況下攻擊幀也會被倉庫壓住。2.5D 深度排序本身合理，但建議人審：是否要讓小怪在建築後仍保留輪廓提示（描邊／影子／提示圖）。

---

## 6. 結論

- 第二關妖怪接線在**程式與畫面層**全部通過：真生成、真姿態、真 8 油單次傷害、真 2.4s 冷卻、真可閃避、真排程終王、封印 idle、潮汐 attack、recovery idle、Boss UI 0 重疊、0 次錯畫共通 Boss、第一關 0 港口怪且 Boss 仍舊圖。4 個視口一致。
- **仍然 BLOCKED／不可放行**：第二關石→木硬切（部署門第 2 條）、第一關 P0 地板（部署門第 1 條）、每關配樂待使用者交付、魂玉等程序幾何美術 RED。
- 部署門四項仍未全部滿足 → **未 Commit／未 Push／未 Deploy**，由 ChatGPT 協調發佈。
- iPad 兩組視口都是桌面模擬，**不可宣稱真機通過**。

### 建議修訂（依 owner）

| # | 建議 | 建議 owner |
| --- | --- | --- |
| 1 | `drawStage2Actor` 的共通 Boss fallback 改成「載入完成前不畫」 | Cursor |
| 2 | 非 `mis` 類型補通用防卡死（至少潮目小僧） | Cursor |
| 3 | 潮波射程與觸發距離對齊（182 vs 210），或提高觸發距離下限 | Cursor ＋使用者定調 |
| 4 | 貼身接觸傷害是否應吃掉潮波傷害（共用 `P.inv`） | 使用者定調 → Cursor |
| 5 | manifest 角色命名與 `PORT_ENEMY_ASSETS` 統一 | AGY |
| 6 | 魂玉改手繪 sprite（需先核准造型） | 使用者核准 → AGY → Cursor |
| 7 | 地板 compat 過渡圖接線或明文撤掉過渡圖（維持 BLOCKED） | Cursor |
| 8 | 把「潮波 8 油單次／2.4s 冷卻／終王 pose 切換／0 次錯畫共通 Boss」固化成常駐測試 | OpenCode（我）可另開小單 |
| 9 | 小怪被建築完全遮住時是否要加輪廓／提示（可讀性） | Cursor ＋使用者定調 |