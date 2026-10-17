# Cursor production handoff（2026-10-14 22:xx）

Production 已凍結，等獨立 Sonnet QA。本檔不改現役程式。模型是 Grok 4.7 High。本回合沒有可讀的 context 百分比，不估額度。

未 Commit／未 Push／未 Deploy。

## C4 正式檔

- `js/card-collection.js`
- `js/card-delivery-bridge.js`
- `js/card-gallery-ui.js`（頁面中性字）
- `js/ui.js`（`收藏 n/32・包名 full/total`）
- `js/game.js`（`stampDeliveryCard`）
- `index.html` 上述快取為 `20261014-p42-c4`
- 證據：`docs/card-rewards-runtime-20261014.md`、`tests/card-rewards-runtime.test.cjs`、`artifacts/validation/c4-cursor-20261014/`

`js/card-gallery-model.js` 這輪沒有改。沒有新套卡圖。

## 最小 public hook

- `CARD_COLLECTION.completeSets(packs, marks)` → `{ id, name, total, full, complete }[]`。空包不完成。decoy 排除。NFC 同字一次。四印齊才 `complete`。
- `loadState`／`applyEvent`／bridge `copyState` 留下 `awards`。只有 `true` 算已獲獎。
- `CARD_DELIVERY.openCards(storage, loc, packs?)`。省略第三參數用真 `WORD_PACKS`。不靠 `openCards.length`。
- `record`：`applied`、`persisted`（`true`／`false`／未寫入為 `null`）、`storageError: { name, message }`、`newAwards: [packId...]`。失敗、重複、Boss 的 `newAwards` 是 `[]`。
- `snapshot().awards` 與正式鍵 `yokai-delivery-cards-v1`、dev 鍵 `yokai-delivery-dev-cards-v1` 的 JSON 是同一個 boolean map。學習鍵不動。
- 未寫入記憶用 `WeakMap`，鍵是 storage 物件。同頁同 storage 保留；另一個 storage 不看見。模組重載只讀磁碟。
- `stampDeliveryCard` 在 `newAwards` 非空時 `say("套卡已集齊・" + 真包名)`。`persisted === false` 另說尚未寫入。不加音效，不改油量、速度、座標。

## 測試與 Chrome

`node --test tests/card-rewards-runtime.test.cjs`：9 PASS／0 FAIL。

同輪 `card-collection-c1c2`、`card-delivery-bridge`、`card-delivery-runtime`、`card-gallery-runtime` 與上面 9 項合在一次命令裡是 **48 PASS／0 FAIL**。48 已含那 9 項，不要再加成 57。

Chrome 是注入印記，不是自然集齊。音訊 stub，音檔 204。沒有實體 iPad。

- `artifacts/validation/c4-cursor-20261014/award-1280x800-official.png`：正式鍵，`動物街 0/3`
- `artifacts/validation/c4-cursor-20261014/award-1194x834-dev.png`
- `artifacts/validation/c4-cursor-20261014/award-844x390-dev.png`：dev 鍵，`收藏 1/32・動物街 3/3`
- `artifacts/validation/c4-cursor-20261014/chrome.json`
- `artifacts/validation/c4-cursor-20261014/r16-strict-note.json`

## SHA-1 blob（`git hash-object`，只列 C4 相關）

| 檔 | blob |
|---|---|
| `js/card-collection.js` | `2d8e295d24ced3684b64dfcfb840d4ff18324cd0` |
| `js/card-delivery-bridge.js` | `6e2db9a4266d5e43e6227ca18f1f8facd2c0a4a3` |
| `js/card-gallery-ui.js` | `0c57ea1e9cd16ca515afeae37e931532e3344e59` |
| `js/game.js` | `68445fe56681f8471c4ca9db6618e32af015f3be` |
| `js/ui.js` | `863a04eb8996309058d98ddd1122454588089236` |
| `index.html` | `ad74d100d746eb5b75514115b31920c22751eb0b` |

## R16 harness（未改 Space 檔）

`tests/spacebunny-c4-rewards-independent.acceptance.cjs`

- **R16-04** 第 220–232 行。最小真包是 `animals`，3 個字。第 224 行把每個字設成 3 印，第 227 行只把 `words[0]`（ねこ）加成 4。事後印記是 `ねこ:4, いぬ:3, うさぎ:3`。套卡仍是 1/3，`newAwards` 為 `[]` 符合契約。第 228 行卻要求 `newAwards.length > 0`，所以這列維持 RED。
- **R16-00** 第 127 行把 `pass`／`red` 函式本身傳進 `rec`，沒有呼叫。欄位齊時狀態不是字串 `PASS`。
- **總結崩潰** 第 563–564 行讀 `newAwardsFieldPresent` 與 `snapshotAwardsFieldPresent`。這兩個 `const` 在第 125–126 行的 `cases()` 裡，`main()` 讀不到，丟出 `ReferenceError`，strict 總結沒寫完。

其餘 R16 資料列在該次 strict 跑裡是 PASS，含 quota、補領、正式／dev 隔離、第三參數。

## 仍未驗

實體 iPad。套卡插畫人審。Sonnet 獨立 QA 尚未跑。R16-04 沒有為了轉綠而提早發獎。
