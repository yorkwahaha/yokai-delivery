# E15-05 R16 harness 正負控制校準（2026-10-15）

Grok Build w7:p3。只新增本說明、`tests/e15-r16-harness-calibration.test.cjs`，以及 `artifacts/validation/e15-r16-calibration-20261015/**`。R16 harness 與 production 唯讀。E15-01 證據未覆蓋。這不是產品缺陷，也不是美術或部署許可。

印記都是 harness 裡的人工 fixture，不是自然遊玩。

## 做法

三個 Node 內建測試各開一個 child。Child 先載入 `tools/director-audio-freeze.cjs`，再用本檔當 preload：把 harness 對 `artifacts/validation/e15-grok-r16-20261015/` 的寫入改到該情境子目錄，並在需要時用 `Module.prototype.require` 包住公開 `openCards().record`。沒有只檢查原始碼字串。沒有新增依賴。

每次父測試啟動用 `fs.mkdtempSync` 建一個 `run-*` 目錄，三個情境寫在該次 run 裡面。已交的 `known-good`、`strip-new-awards`、`drop-second-pack` 三個目錄不寫。寫入路徑若落在這三個目錄會直接拋錯。測試同時核對 production、R16 harness、本測試與本說明、E15-01 證據，以及那三份已交 JSON 的 SHA256。

## 結果

命令：

`node --require ./tools/director-audio-freeze.cjs --test tests/e15-r16-harness-calibration.test.cjs`

校準套件 exit **0**。tests 3、pass 3、fail 0、skipped 0。

| 情境 | harness exit | strict | 狀態 |
|---|---|---|---|
| known-good | 0 | red 0 / fail 0 / blocked 0 / notClean 0 | PASS 23。R16-06 的 `newAwards` 為 `["animals","beach"]` |
| 每個 `record` 結果刪除 `newAwards` | 1 | red 8 / fail 0 / blocked 0 / notClean 8 | RED 8、PASS 15。`recordHasNewAwardsField=false` |
| 只在 `newAwards.length > 1` 時丟掉第二包 | 1 | red 1 / fail 0 / blocked 0 / notClean 1 | 只有 R16-06 為 RED，`got=["animals"]`。其餘 22 列 PASS |

移除欄位後的 8 個 RED：`R16-00`、`R16-02`、`R16-03` 失敗配送、`R16-04`、`R16-06`、`R16-08`、`R16-09`、`R16-13`。

三份 evidence 的 `marksAreFixtureNotNaturalPlay` 都是 true。status 都是有效字串。

## 輸出

可重跑命令相同。每次產生新的 `run-*`，不覆蓋舊 run，也不覆蓋首交三目錄。

`node --require ./tools/director-audio-freeze.cjs --test tests/e15-r16-harness-calibration.test.cjs`

2026-10-15 返修後這次 run：

- `artifacts/validation/e15-r16-calibration-20261015/run-oo7GPQ/known-good/evidence.json`
- `artifacts/validation/e15-r16-calibration-20261015/run-oo7GPQ/strip-new-awards/evidence.json`
- `artifacts/validation/e15-r16-calibration-20261015/run-oo7GPQ/drop-second-pack/evidence.json`

每個情境子目錄另有 `scenario.json`、`qa-log.txt`、`exit-code.txt`、`stderr.txt`。這次套件 exit **0**，3 pass / 0 fail。數值與上表相同：known-good PASS 23、strict 0；刪除欄位 RED 8、exit 1；漏第二包只有 R16-06 RED、`got=["animals"]`、exit 1。

首交三份 JSON 重跑後 SHA256 不變：

| 檔 | SHA256 |
|---|---|
| `known-good/evidence.json` | `5a6e079d20c6eeb70279943d2f54ee45fd6b7b1a835679634a4c79c267367063` |
| `strip-new-awards/evidence.json` | `92a318043d4f0b0f56eb283946e925a1d464210cc7b733c988b27d1e55ed492f` |
| `drop-second-pack/evidence.json` | `2a0e60a0cb5ca99a7f21221f2b1d675f27cb029f149a31627456ff57b6cbb61f` |

測試前後比對，下列檔案 SHA256 也沒有變：三個 card production 檔、`js/words.js`、R16 harness、本測試、本說明，以及 E15-01 的 `evidence.json` 與 `qa-log.txt`。

## 部署

未 Commit／未 Push／未 Deploy。未 reset／clean／checkout。未啟 Cursor。未跑 7 萬詞長測。音訊／TTS／BGM／KEY 未讀、未執行、未改。沒有改產品。
