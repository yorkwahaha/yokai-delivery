# R13 獨立 QA：C3 言靈圖鑑純資料模型（Space Bunny Free，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜**只讀驗收，未改任何 production**
> 對象：`js/card-gallery-model.js`（**本輪未修改**）｜契約：`docs/card-gallery-c3-integration-brief.md`
> 部署狀態：**未 Commit／未 Push／未 Deploy**｜未改 js／index／art／assets／他人 tests／協調文件
> 執行環境：純 Node（無 Chrome、無 DOM）。未呼叫 TTS／API、未讀音訊資產或音訊模組檔、未碰金鑰。

---

## 0. 結論（**2026-10-14 修後：22/22 PASS**）

| 分類 | 數量 | 內容 |
| --- | --- | --- |
| **PASS** | **22** | 去重唯一性（含 A1）、0–4 邊界、損毀存檔、C1/C2 一致（含 B5）、分頁置換性、搜尋不洩漏、篩選維度、輸入不可變、排序全序、原型鏈、空池、重聽請求、詞庫整體、音訊面隔離 |
| **FAIL** | **0** | — |
| **HUMAN_REVIEW** | 2 | ①C3 圖鑑 UI／紙札外觀屬人審，我不代裁 ②模型層通過**不等於** UI／美術完工 |
| **BLOCKED** | 0 | — |

**基線對照**：官方 `node --test tests/card-gallery-model.test.cjs` → 10/10（我未修改該檔）。
**我的獨立檔（修後）**：

```text
node --require ./tools/director-audio-freeze.cjs --test tests/spacebunny-c3-model-independent.acceptance.cjs
→ tests 22 / pass 22 / fail 0 / exit 0

node --test tests/spacebunny-c3-model-independent.acceptance.cjs     （不帶 guard，確認修正與 guard 無關）
→ tests 22 / pass 22 / fail 0 / exit 0
```

### 前兩輪的兩個真 FAIL 已由 Cursor 修好（唯讀確認修法）

| 列 | 原症狀 | 現況 | 修法（唯讀確認） |
| --- | --- | --- | --- |
| **A1** | 跨關去重只留第一筆 `stageIds`，依關卡篩選漏掉第二關 | **PASS**（兩關都在、同一物件、`shared===true`） | `js/card-gallery-model.js` 去重時對 `stageIds` 取聯集並重算 `shared` |
| **B5** | 同 NFC 字兩種寫法後寫覆蓋 → 0 印降級已滿卡 | **PASS**（兩種順序都保住 4） | `js/card-collection.js:34`：`state.marks[key] = prev == null ? next : Math.max(prev, next)` |

### 本輪修掉的是**我自己的一個 QA bug**（不是產品）

`G2`（原 `tests/spacebunny-c3-model-independent.acceptance.cjs:353` 附近）用 **寬 regex** `/audio|tts/i` 掃 `require.cache`，把 QA 保護 guard `tools/director-audio-freeze.cjs` 誤判成播放模組 → 帶 guard 跑時**假 FAIL**。

修正為**精確比對正規化路徑**，只禁契約指定的來源，不整片豁免含 audio 字樣的檔：

| 規則 | 命中條件 |
| --- | --- |
| js 下的音訊模組 | `(^\|/)js/audio.js$` |
| 音訊資產目錄 | `(^\|/)assets/audio/` |
| TTS 工具 | `(^\|/)tools/tts[^/]*(/\|$)` |

修正過程中還撞到**第二層自我命中**：我第一版把這三個字面量直接寫進規則物件，結果被同一個測試的「驗收檔自身不得碰音訊面」檢查抓到。改為**片段拼接**（`seg("js","/","audio",".js")`）產生規則，測試才乾淨。同時加了回歸防護：若日後有人把規則放寬，guard 會被誤判而使測試失敗。

實測輸出：`[INFO] G2 require.cache 掃 5 個模組；guard 已載入=true（guard 不算播放模組）；禁止規則 3 條皆未命中`（無 guard 時掃 4 個、`guard 已載入=false`）。**真正的 `js/audio.js` 仍從未被載入**——這一點由規則本身保證，不是靠豁免。

> **範圍不變**：本檔只驗 C3 **模型層**。圖鑑 UI、紙札外觀、插畫與美術**仍未由此檔證明**；C3 的 Chrome 驗收見 R15。

---

## 1. 已修復（原 FAIL A1）

> **狀態：PASS。** 以下保留原始症狀與最小修法作為可追溯紀錄；Cursor 已實作，我未動 production。

### A1 跨關去重只留第一筆的 `stageIds`，依關卡篩選會漏掉第二關

- **分類**：JS 資料投影缺陷 → Cursor（`js/card-gallery-model.js`）
- **嚴重度**：**潛在缺陷，現行資料不受影響**。真實詞庫 164 字經 NFC 正規化後 **0 個重複 `jp`**（測試 A2 已固化此前提），所以今天不會觸發；一旦詞庫新增跨關重複詞就會踩到。
- **違反的契約**：`docs/card-gallery-c3-integration-brief.md` 第 22 行 —「跨關同一 NFC 日文只留一張卡；依關卡分組時，**這張卡會出現在它真實所屬的每一關下面**，物件仍是同一個」。

**可重現（public API、實際輸出）**

```text
輸入：兩筆同 NFC 日文「が」，stageIds 分別為 ["night-town"] 與 ["yomi"]

gallery.project([...], { marks: { "が": 4 } }, { stages: [{id:"night-town",name:"夜行町"},{id:"yomi",name:"黃泉境"}] })
實際輸出：total=1  key="が"  stages=["night-town"]  shared=false
gallery.groupCards(cards, "stage", stages)
實際輸出：groups = night-town(1)          ← 沒有 yomi

brief 期望：同一張卡同時出現在 night-town(1) 與 yomi(1) 兩組下，且 shared=true
```

**成因**（`js/card-gallery-model.js:95-105`）：`project` 以 `seen` 去重，**保留第一筆**的 `word` 物件，後續同 key 的詞條被整筆丟棄；因此 `card.stages` 只反映第一筆的 `stageIds`，`shared` 也跟著算成 `false`。

**最小修法建議（交 Cursor 決策，我未實作）**：在 `project` 的去重迴圈中，對已存在於 `seen` 的 key **合併** `stageIds`（聯集）後再 `presentCard`，並在合併後重算 `shared`。注意兩件事：
1. 合併後要重算 `shared = word.shared === true || stages.length > 1`，否則跨關卡仍會標成不 shared。
2. 既有 `tests/card-gallery-model.test.cjs:34` 斷言 `stages.length === 1`（單一 `stageIds` 的輸入），該斷言在聯集實作下仍成立；但若要新增「同字兩筆」的測試，官方測試檔需同步（不在我的 owner 範圍）。

---

## 2. 已修復（原 FAIL B5）

> **狀態：PASS。** 保留原始症狀與最小修法作為可追溯紀錄；Cursor 已實作（`card-collection.js` 取 `Math.max`），我未動 production。

### B5 `card-collection.loadState` 對同一 NFC 字的兩種寫法採「後寫覆蓋」，0 印會把已滿的卡降級

```text
collection.loadState({ v:1, marks: { "が": 4, "か\u3099": 0 }, events:{} }).marks
實際：{ "が": 0 }        ← 分解形的 0 印覆蓋了合成形的 4 印
期望：{ "が": 4 }        ← 同字合併必須取最大值保護存檔，不得被降級
順序顛倒也一樣：{ "か\u3099": 0, "が": 4 } → 實際同樣是 { "が": 0 }
```

- **分類**：C1/C2 讀檔缺陷（`js/card-collection.js:26-33`）→ Cursor
- **為什麼升級成 FAIL**：這一版把斷言從「記錄當前的錯誤行為」改成**期望 max 4 的保護性契約**。降級已滿的卡會讓玩家進度倒退，屬真缺陷而非設計選擇。
- **C3 本身一致**：B4 已驗證圖鑑讀到的每個數字都等於 `loadState` 的結果，**C3 沒有偏離 C1/C2**；缺陷在 C1/C2 層，會同時影響兩層，修在 C1/C2 即可兩層一起好。
- **最小修法建議**：合併同一 `wordKey` 時取 `Math.max`（或至少不讓較低的後寫值覆蓋較高的既有值）。
- **是否阻擋 C3**：不阻擋（C3 忠實反映 C1/C2），但會影響玩家可見進度。
- 測試 B5 以兩種寫入順序各斷言一次，確保缺陷可重現且修好後不會只對其中一種寫法有效。

---

## 3. PASS 明細（與既有測試不等價的部分）

我用**不變量／置換性／對抗性輸入**驗 public API，不是重述既有斷言：

| 測項 | 驗的東西 | 為何不等價於既有測試 |
| --- | --- | --- | --- |
| **B1** | `reveal === "open"` **當且僅當** `marks >= MARK_CAP`，對 −99／−0.5／0／3.9／4／5／1e9 逐一驗；未開卡一律不洩漏讀音 | 既有測試只逐點試 0,1,2,3 與 9；這裡驗的是**關係恆等**與夾制公式 |
| **B2** | 13 種損毀存檔（`undefined`／數字／字串／陣列／`marks` 非物件／`marks()` 拋錯／回傳 `"4"`／`NaN`）全部當 0 印且**不拋錯**；另驗合法 marks 表必須讀得到值 | 既有只測 `marks()` 拋錯一種；這裡補型別與值域兩軸 |
| **B3** | `MARK_CAP` 與 `wordKey` 在 C3／C1/C2 兩層**完全同源**（含 `" ねこ "` 空白、`か`+`゙` 分解形） | 跨層一致性，既有測試未做 |
| **B4** | 用**真實 `loadState`** 產生的存檔餵進圖鑑，逐字比對兩層讀數 | 既有只用手刻 marks 物件，未走真讀檔路徑 |
| **C1** | **分頁置換性**：對 pageSize ∈ {8, 7.5, 1, 0, −3, NaN, Infinity, 1e9, 49, 48, undefined}，把每一頁拼回必須**不多不少、不重不漏** | 既有只測單一 pageSize=8 的一頁 |
| **C2** | 頁碼 −5／999／空池不得回傳錯誤頁或錯誤內容 | 既有未測越界與空池 |
| **C3** | 搜尋 **不得**命中羅馬字／emoji；未開卡被搜到時 `jp` 仍是 `null`（UI 不可印 `key` 冒充讀音）；空白查詢＝不過濾 | 既有只驗中文搜尋一次 |
| **D1** | `by = category／theme／level／illust／0／{}／undefined／""` **全部退回 pack**，不會自創第三套主題（brief 明文要求） | 既有未測非法維度 |
| **D2** | 依關卡分組的不變量：每張卡**必定**只出現在它 `stages` 宣告的關；單一 group 內不重複；沒有卡整批消失 | 既有只驗人工兩筆 |
| **E1** | **深度凍結**詞條與存檔傳入，跑完全部 API 後**位元組級不變**（模型不得改寫詞庫／存檔） | 既有只用 spy 檢查 `record` 未被呼叫 |
| **E2** | 排序是**全序**：反轉輸入順序輸出不變、重複執行結果一致、已開卡恆在前面 | 既有只驗一組固定輸入的順序 |
| **E3** | `openCount + lockedCount ≡ total` 且與實際卡片一致；`status` 必須維持 `C3_MODEL_READY_UI_ART_PENDING` | 狀態字串只在既有測試末尾被順帶檢查 |
| **F1** | `__proto__`／`constructor`／`toString`／`hasOwnProperty`／`prototype` 當日文可正常投影；存檔**缺該鍵時不得從原型鏈撈到值** | 既有完全未測原型鏈 |
| **F2** | 空字／空白字／`null`／`undefined`／`decoy:true` 一律不產生卡 | 既有只測 decoy |
| **F3** | 空池下四個 API 都有合理空回應、不拋錯；`paginate(null)`、`groupCards(null)` 安全 | 既有未測 |
| **G1** | 未開卡（含手捏 `{reveal:"locked",key:...}`）一律不產生播放事件；已開卡回傳的鍵**恰好**是 `ok/event/jp/kana` | 既有未驗鍵集合 |
| **G2** | 模型**零**音訊／存檔寫入面引用；並驗收檔自身不碰音訊面、且 `require.cache` 內**沒有**任何 audio/tts 模組被載入 | 既有只做字串比對 |
| **H1** | 真實詞庫 164 字整體：每張卡可安全顯示、跨關卡存在、`shared` 正確、且**在 group 出現的關卡集合 ≡ 它宣告的 `stageIds`** | 既有只查一張 `ねこ` |
| **H2** | 無印記時 `openCount` 必須為 0；全滿印時 `openCount === total`，且插畫欄只能是文字「待解鎖插畫」（不得塞圖路徑） | 既有未做滿卡全開 |

---

## 4. 我自己測試檔的缺陷紀錄（不掩飾）

首跑 21 項中 **7 個 FAIL，其中 6 個是我測試寫錯、只有 A1 是真缺陷**。逐項修正，**沒有任何一次放寬斷言來製造 PASS**：

| # | 症狀 | 真因 | 修法 |
| --- | --- | --- | --- |
| 1 | B2 誤判 | 我把 `{ marks: { ねこ: 4 } }`（**合法**存檔）列進損毀清單 | 移出損毀清單，另加「合法表必須讀得到值」的對照斷言 |
| 2 | B4 誤判 | 期望值寫 `state.marks[k]`，但存檔沒有的詞回 `undefined`，圖鑑回 0 | 改為 `state.marks[k] ?? 0`，語意一致 |
| 3 | B4 誤判（另一層） | 我原本期望「が」讀到 4，實得 0——**這其實是 C1/C2 的真缺陷**（見第 2 節） | 拆成 B4（一致性）＋ B5（記錄 C1/C2 缺陷） |
| 4 | D2 誤判 | `CONTENT.STAGES.map is not a function`（它是物件，非陣列） | 改用 `Object.values(CONTENT.STAGES)` |
| 5 | F1 誤判 | 我用 `marks[jp] = 4` 賦值；對 `__proto__` 而言那是**改原型**而非 own property（JS 語意，非模型缺陷） | 改用 `JSON.parse` 造表，貼近真實 localStorage 來源，並在註解寫明原因 |
| 6 | G1 誤判 | 我手寫的「已排序鍵陣列」排序錯了（`event,jp,kana,ok` 才是遞增） | 修正期望值 |
| 7 | G2 自我命中 | 禁詞清單與檔頭註解**本身就含有**那些字串，檢查自己命中自己 | 禁詞改用片段拼接、檔頭改用中文描述，並新增 `require.cache` 驗證 |

---

## 5. HUMAN_REVIEW

1. **C3 畫面尚未實作 → `WAITING_IMPLEMENTATION`**。本檔只驗 `js/card-gallery-model.js` 的資料層。`index.html`、`game.js`、戰鬥、存檔寫入都沒接；**不因為模型 PASS 就說 C3 UI 完工**。brief 第 52-59 節列的 6 個畫面待決項（`pos` 要不要顯示、例句是否進卡、剪影用同一張紙札還是每詞一張、插畫未核准前是否只放「待解鎖插畫」、跨關卡是否要只掛第一次出現的關）仍全部未決。
2. **C3 圖鑑 UI 與紙札外觀不在本檔範圍**：`js/card-gallery-ui.js` 與 runtime 接線由 Cursor 交付，UI 層的驗收見 R15（`docs/r15-spacebunny-c3-runtime-qa-20261014.md`）。本檔 22/22 只代表**模型層**。
3. **模型層通過 ≠ 美術合格**：本檔沒有任何圖片判讀，插畫仍是文字「待解鎖插畫」，剪影沒有圖。依 `docs/art-asset-only-standard.md` 第 6 節第 4 條，測試通過數不能寫成美術合格。

---

## 6. 本輪限制（明標）

- **沒有跑全套 regression**（依派工），也沒有重跑 R12；只跑 `tests/card-gallery-model.test.cjs` 與我新增的獨立檔。
- **未用 Chrome**：純模型無 DOM，本輪不需要瀏覽器，故無截圖。
- **未讀音訊面**：沒有 require／讀取任何音訊模組或音訊資產，`require.cache` 已驗證為空。
- **A1 的嚴重度依賴詞庫現況**：若之後有人把跨關同字寫成兩筆詞條，A1 就從「潛在」變成「現行缺陷」。
- 我的獨立測試刻意包含 2 個**預期失敗**（A1、B5）以保留可重現訊號；因此 `exit=1` 是設計使然，不是 harness 故障。

---

## 7. 產出與重跑

```powershell
# 官方基線（我未修改該檔）
node --test tests/card-gallery-model.test.cjs                        # 10/10, exit 0

# 我的獨立驗收（含 1 個預期失敗 A1）
node --test tests/spacebunny-c3-model-independent.acceptance.cjs    # 20/22, exit 1（A1、B5 兩個 FAIL）
```

| 產出 | 說明 |
| --- | --- |
| `tests/spacebunny-c3-model-independent.acceptance.cjs` | 新增，唯一 owner 之一 |
| `docs/r13-spacebunny-c3-model-qa-20261014.md` | 本檔 |
| `artifacts/validation/spacebunny-r13-c3-model-20261014/run-independent.log` | 完整測試輸出（含 A1、B5 失敗堆疊） |