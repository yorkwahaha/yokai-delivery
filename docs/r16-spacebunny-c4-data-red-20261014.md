# R16 C4 純收藏套卡：資料面 RED 測試票

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜**RED 測試票，無 production 改動**
> 契約：`docs/c4-rewards-runtime-contract-20261014.md`（Codex 執行決策）
> 讀取範圍：`js/card-collection.js`／`js/card-delivery-bridge.js`／`js/card-gallery-model.js`
> **不讀 `js/game.js`**（Cursor 正在改）；不讀音訊／金鑰、不呼叫 TTS/API、無 git 寫入、無 Chrome
> 部署狀態：**未 Commit／未 Push／未 Deploy**

---

## 0. 結論

**C4 尚未實作，12 列 RED 是預期結果。這不是 C3 的產品 FAIL，也不是要求我現在去修。**

| 分類 | 數量 | 內容 |
| --- | --- | --- |
| **RED** | **12** | 套卡投影、最後一字補領、snapshot awards、持久化欄位、失敗/dup/Boss 不發獎、assisted、空包/decoy/NFC 去重、多包同發、reload 保留、舊檔補領、official/dev 隔離、storage 拒絕 |
| **PASS** | **2** | ①learning 鍵未被 record 寫入且內容不變（`xp/box` 保持）②真實內容計數 32／32／164 |
| FAIL | 0 | — |
| BLOCKED | 0 | — |

**讀檔前後 hash 完全一致**（本次測試未影響任何被讀檔案）：

```text
js/card-collection.js        9fe14e38a7e9dbe7f4b7f696f145ebf749aded6c9f0a25ad3507be564f456d2
js/card-delivery-bridge.js   fa281fbc42de9ad6e64f4feedca5e46f5dd40b255b1c2541c1b7231ab594f846
js/card-gallery-model.js     37d82cdf965793ca01449bfe3bf3d690d934b364a1165d8876ce66cd94b7f0f8
```

---

## 1. 現況量測（這是 RED 的根據）

| 公開可觀測項（契約第 15 行） | 現況 | 判定 |
| --- | --- | --- |
| `openCards(storage, loc, packs?)` 第三參數 | **只有 2 參數**（`openCards.length === 2`） | RED |
| `record()` 回傳 `newAwards: [packId…]` | **無此欄位**（回 `{state, applied, reason}`） | RED |
| `snapshot().awards` 為 boolean map | **無 `awards`** | RED |
| 持久化 JSON 的 `awards` 欄位 | **無**（只有 `v/marks/events`） | RED |
| 套卡資料投影 | `CARD_COLLECTION.completeSets` **與** `CARD_GALLERY.packSets` **都不存在** | RED |
| 事件種類 | `parseEvent` 只認 `kind === 'delivery'`，無 `assisted`／`boss` 區分 | RED |
| 內容基準 | `WORD_PACKS=32`、`PACK_ORDER=32`、`getAllWords()=164`、有效詞合計 164、`STAGES` 為 object、`stage.wordPacks` 為 array | **PASS**（歷史 21 已過時，本檔用 32／164） |

---

## 2. 12 列 RED 案例（全部走公開 API，人工 fixture）

所有印記都是**人工 fixture**（記憶體 storage），**不是自然遊玩收集**。事件形狀依 `parseEvent` 真契約：`{id, kind:'delivery', ok:boolean, jp, assisted?}`。

| # | 案例 | 實測 | 期望 |
| --- | --- | --- | --- |
| **R16-01** | 套卡資料投影存在且對應真 32 包／164 詞 | `completeSets`／`packSets` **都不存在** | 投影 API 回 32 組、詞合計 164 |
| **R16-02** | 最後一字 **3→4** 由真 `record` 成功觸發**單次** award | `newAwards = null` | 恰好 `[animals]` |
| **R16-02b** | `snapshot().awards` 為 boolean map | `undefined` | `{animals:true}` |
| **R16-02c** | awards 以**同卡鍵**持久化 | 存檔內 `awards = undefined` | 寫入 `yokai-delivery-cards-v1` 的 `awards` |
| **R16-03** | 失敗／duplicate／Boss **不發獎** | 三者 `newAwards` 皆 `null` | 三者皆空陣列 |
| **R16-04** | `assisted` 成功**應計入** | `newAwards = undefined`（印記已更新為 ねこ=4） | 成功即計入並計算達成 |
| **R16-05** | 空包不達成、decoy 排除、`が`／`が` NFC 去重 | 無投影 API，無法驗 | 空包 `total=0/complete=false`；干擾包 `total=1` |
| **R16-06** | 單次 record 的 `newAwards` 可含多包且**不重複** | `null` | 可多包、無重複 packId |
| **R16-07** | 下一次配送不重複發獎、**reload** 保留 awards | reload 後 `awards=undefined` | awards 保留、下次 `newAwards` 空 |
| **R16-08** | 舊檔已滿但無 awards → **下次成功配送補領** | `null` | 補領 `[animals]`，使用者不重做已滿卡 |
| **R16-09** | official／dev／`?dev` 隔離不互寫 | 跨鍵寫入 `false`（正確）但 `newAwards` 皆 `undefined` | 兩邊各自補領、互不污染 |
| **R16-12** | storage 拒絕**不阻斷**成功配送 | **`record` 中斷：`quota exceeded`** | 不中斷（契約第 7 行） |

---

## 3. 兩列 PASS（是「不能被 C4 弄壞」的不變量）

| # | 案例 | 實測 |
| --- | --- | --- |
| **R16-10** | record 不得動 learning 鍵、不得把 STORE 熟練 box 當印記 | 記一次成功配送後 `yokai-delivery-v1` **未被寫入**、內容 `{v:1,xp:123,box:{ねこ:4}}` **原封不動** |
| **R16-11** | 真實內容計數 | `WORD_PACKS=32`、`PACK_ORDER=32`、`getAllWords()=164`、有效詞（排除 decoy＋NFC 去重）合計 **164**、`STAGES` 為 object、`stage.wordPacks` 為 array |

---

## 4. 特別標記：storage 拒絕目前會中斷成功配送

這是**今天就存在的問題**，與 C4 是否實作無關：

```text
record(event)  →  storage.setItem(key, JSON.stringify(state))   ← 無 try/catch
storage.setItem 拋 quota →  例外直接往外冒，成功配送被中斷
```

- 違反契約第 7 行：「storage 拒絕仍不阻斷成功配送；保存狀態需如實回報或維持安全可玩，reload 顯示上次**真正成功保存**的結果，**不能以記憶體變化冒稱已持久化**」。
- 我把這列標 **RED 而非 FAIL**，因為契約要求 Cursor 先定義「拒絕時如何如實回報」的處理方式（回傳 reason？`persisted:false`？還是靜默保留記憶體狀態？），**我不硬編內部函式名或猜內部函式**。
- 若 Cursor 希望我固定其中一種語意，請在交付時明說（例如 `record` 回 `{applied:true, persisted:false}`），我再把 R16-12 從觀察列改成可斷言列。

---

## 5. 方法與邊界

- **只用公開 API**：`openCards`／`record`／`snapshot`／`wordKey`／`loadState`／`applyEvent` 加上內容資料。投影 API 以**發現**方式尋找（先 `completeSets` 再 `packSets`），不硬編。
- **第三參數可有可無**：`openWith()` 在傳 packs 時用三參數、不傳時用兩參數，用以驗「不改既有兩參數 caller 語意」。
- **記憶體 storage**：可觀察 `getItem/setItem` 呼叫與寫入鍵，驗隔離與 learning 鍵未被動。
- **不讀 js/game.js**：Cursor 正在改，讀它會得到不穩定基準。
- **hash 前後比對**：見第 0 節；若這些檔案在測試期間被改，本檔會記 `R16-99-hash-drift` FAIL 並標明結果不可信。
- **不涵蓋**：UI／Chrome、套卡插畫（WAITING_HUMAN）、音訊（凍結）、戰力數值（契約第 2 行禁止，本檔只驗資料面）、實體裝置。

---

## 6. 產出與重跑

```powershell
node tests/spacebunny-c4-rewards-independent.acceptance.cjs
```

| 產出 | 說明 |
| --- | --- |
| `tests/spacebunny-c4-rewards-independent.acceptance.cjs` | 12 列 RED 資料面案例（含 hash 前後比對） |
| `docs/r16-spacebunny-c4-data-red-20261014.md` | 本檔 |
| `artifacts/validation/spacebunny-r16-c4-20261014/evidence-red.json` | 逐列結果、公開 API 發現、hash 前後 |
| `artifacts/validation/spacebunny-r16-c4-20261014/qa-log-red.txt` | 本輪 RED 日誌 |

**下一張票**：C4 正式實作後重跑本檔（12 列應由 RED 轉綠），並另開 C4 UI 票；R15 的 C3 Chrome 驗收等 freeze 通知後執行。