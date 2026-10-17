# C4 套卡 runtime（2026-10-14）

狀態：**RUNTIME**。R17 放行後已接上。未 Commit／未 Push／未 Deploy。沒有新套卡圖，也沒有改音訊或戰力。

## 行為

- `CARD_COLLECTION.completeSets(packs, marks)` 回 `{ id, name, total, full, complete }`。真詞庫 32 包、有效字 164。空包不完成。decoy 排除。NFC 相同的字只算一次。四印齊才完成。
- `openCards(storage, loc, packs?)` 省略第三參數時用真 `WORD_PACKS`。成功配送（含 assisted）第一次達成時，`newAwards` 是 packId 陣列。失敗、重複、Boss 是空陣列。
- `snapshot().awards` 與正式／dev 卡檔是同一個 boolean map。損毀的 awards 不當已獲獎。舊檔已滿但沒有紀錄時，下一次成功配送補領一次。學習鍵不動。
- `loadState`、`applyEvent`、`copyState` 都留下 awards。未寫入的印記仍按 storage 物件分開。`persisted: false` 不假裝已存。
- 蓋印時若有新套卡，HUD 顯示「套卡已集齊」和真 pack 名。存檔失敗另外說尚未寫入。單字頁用既有紙札旁的字顯示 `收藏 n/32・包名 full/total`。

## 測試

`tests/card-rewards-runtime.test.cjs`：9 PASS / 0 FAIL。

`tests/card-collection-c1c2.test.cjs`、`tests/card-delivery-bridge.test.cjs`、`tests/card-delivery-runtime.test.cjs`、`tests/card-gallery-runtime.test.cjs`：同輪 48 PASS / 0 FAIL。

Space `tests/spacebunny-c4-rewards-independent.acceptance.cjs --strict`：資料案例除 R16-04 外都 PASS，含 quota、補領、正式／dev 隔離與第三參數。R16-04 仍是 RED：它把動物街三個字都設成 3 印，只把「ねこ」加成 4，套卡仍是 1/3，所以 `newAwards` 是空陣列。契約要整包四印才發獎。該檔另外把 PASS 函式本身當成狀態，並在總結時讀到未定義的 `newAwardsFieldPresent` 而丟出 ReferenceError。這些沒有改 Space 的腳本。說明在 `artifacts/validation/c4-cursor-20261014/r16-strict-note.json`。

Chrome（注入印記，不是自然集齊；音訊 stub、音檔 204）：

- `artifacts/validation/c4-cursor-20261014/award-1280x800-official.png`：正式鍵，`動物街 0/3`
- `award-1194x834-dev.png`、`award-844x390-dev.png`：dev 鍵，`收藏 1/32・動物街 3/3`

沒有在實體 iPad 上看。套卡插畫仍待人審。
