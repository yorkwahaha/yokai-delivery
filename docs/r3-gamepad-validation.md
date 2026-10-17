# R3 Xbox 藍牙手把震動 — 相容性調整與真機清單

> 2026-10-13。Grok Build 只改 `js/haptics.js` 與本檔、`roadmap.md`。
> **未在 iPad、Android、實體 Xbox 手把上測過。** 本檔沒有任何「手把已震動」的通過紀錄。
> 未 Commit／未 Push／未 Deploy。

技術依據：[MDN GamepadHapticActuator.playEffect](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/playEffect)、[effects](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/effects)、[reset](https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/reset)。`navigator.vibrate` 是機身震動，不能當成手把成功。

---

## 1. 這輪查到的舊行為

`js/haptics.js` 原本會呼叫 `vibrationActuator.playEffect('dual-rumble')`，沒有 `playEffect` 才改走 `hapticActuators[0].pulse`。Promise 拒絕被空的 `catch` 吃掉，**不會改走 pulse**。`effects` 已寫明不支援 `dual-rumble` 時仍會先叫 `playEffect`。

關掉設定只改 `enabled` 旗標，**不會** `reset()`，也不會 `navigator.vibrate(0)`，進行中的震動會繼續到時間結束。沒有聽 `blur`、`pagehide`、`visibilitychange`、`gamepaddisconnected`。

`js/game.js` 的 `togglePause()`（約 518–529 行）進入暫停時只停語音與畫面搖晃，**沒有**觸覺停止。頁面仍聚焦時，本檔的失焦監聽不會跑。這條要改 `js/game.js`，本輪不改，交給 Cursor（見 §4）。

遊戲內沒有「震動成功」的文案。公開的 `dash`／`hit` 等方法維持不回傳成功布林值。`toggle()` 回傳的是開關狀態，不是硬體結果。

---

## 2. 本輪在 js/haptics.js 的調整

- 先看 `effects`。有列出才決定支不支援 `dual-rumble`。沒有 `effects` 時才看已棄用的 `type`（`dual-rumble` 才走雙馬達；`vibration` 直接 pulse）。兩者都沒有才試 `playEffect`，並在同步拋錯或 Promise 拒絕時改 pulse。
- `NotSupportedError` 與其他拒絕會 fallback。`InvalidStateError`（文件隱藏或未啟用）不改 pulse。`stop()` 或斷線之後若原 Promise 才拒絕，也不再 pulse。
- `weakMagnitude`／`strongMagnitude` 各自夾在 0–1。pulse 只有一個強度，沿用較大的那個。
- 設定關、`stop()`、視窗 `blur`、`pagehide`、分頁隱藏：`actuator.reset()`，沒有 `reset` 才用零強度效果收尾，並 `navigator.vibrate(0)`。
- `gamepaddisconnected` 只停事件上的那支手把，不停其他手把，也不把機身震動算進去。
- 沒有 `getGamepads`、沒有 actuator、沒有 `vibrate`：靜默跳過，不丟例外，不顯示成功。
- 手把能操作但沒有 actuator：只可能有機身震動，不發手把效果。

強度與時長沿用原本的 dash／受傷／護盾／命中等數值，沒有改手感參數。

---

## 3. 靜態與沙箱契約（不是真機）

| 檢查 | 結果 |
|---|---|
| `node --check js/haptics.js` | exit 0 |
| 既有 `node --test tests/controls.test.cjs` | **7/7 PASS**（含震動開關存檔；未改測試檔） |
| 本輪沙箱契約 13 項（暫存腳本，跑完即刪，沒有寫進 `tests/`） | **13/13 PASS** |

沙箱 13 項只證明假 actuator 的呼叫順序：缺 API 不拋錯且不回傳成功、存檔關閉時不呼叫 vibrate、只有機身 `vibrate` 回傳 true 時不呼叫手把、`dual-rumble` 強弱分開、Promise 拒絕改 pulse、`InvalidStateError` 不 pulse、`effects` 不含 dual-rumble 時不呼叫 `playEffect`、舊 `type: "vibration"` 走 pulse、同步拋錯改 pulse、關開關會 `reset` 與 `vibrate(0)` 且在途拒絕不再 pulse、blur／隱藏會停、斷線只 reset 該手把、失焦後才拒絕的 dual-rumble 不再 pulse、強度與時長有夾限。

**這 13 項沒有馬達，不能寫成 iPad 或 Xbox 已測。**

---

## 4. 交給 Cursor（本輪未改這些檔）

1. **暫停沒有停震動。** `js/game.js` `togglePause()` 在 `state === "play"` 改成暫停的分支（約 518–523 行）加上 `HAPTICS.stop?.()`。`haptics.js` 先載入，執行期的 `HAPTICS` 就是同一個物件；選用呼叫可避免缺檔時丟錯。不要依 `stop()` 或 `navigator.vibrate` 的回傳在畫面上顯示成功。
2. **快取版本仍是舊的。** `index.html` 第 116 行仍是 `js/haptics.js?v=20261006-1`。service worker 只快取媒體，不會改寫這支腳本；瀏覽器仍可能沿用舊 query。請 Cursor 改 query，本輪不動 `index.html`。
3. 直向遮罩時 `pollGamepad()`（約 1072 行）會提前返回，同樣不會呼叫 `stop()`。若暫停那條要一併處理，用同一個 `stop()`。

結算畫面沒有另接 `stop()`。目前最長的手把效果是破曉 360ms，暫停才是會留在聚焦頁面上的缺口。

---

## 5. 真機清單（全部未測）

每一列都要記 OS、瀏覽器版本、手把型號、連線方式（藍牙，不是 USB 轉接）、日期與測試者。手把能移動角色不算震動通過。`navigator.vibrate` 讓平板本身震，也不算手把通過。未填實測之前，狀態維持 **未測**。

| # | 要做的事 | 通過標準 | 狀態 |
|---|---|---|---|
| 1 | iPadOS Safari + Xbox 無線手把藍牙 | 左右馬達都能感到 `dual-rumble`；若瀏覽器沒有 actuator，畫面沒有成功提示，遊戲仍可玩 | **未測** |
| 2 | Android Chrome + 同一支手把藍牙 | 同上。Chrome 桌面結果不能拿來代替 | **未測** |
| 3 | 手把只有 pulse、沒有 dual-rumble | 有單一路震動；沒有把失敗畫成雙馬達成功 | **未測** |
| 4 | 瀏覽器完全沒有手把震動 API | 無例外、無成功文案；機身若震，記錄成機身，不是手把 | **未測** |
| 5 | 設定關掉時手把正在震 | 震動立刻停，之後命中不再震；再開才恢復 | **未測** |
| 6 | 藍牙斷線、重連 | 斷線後馬達停；重連後下一次事件才可再震 | **未測** |
| 7 | 切到背景、視窗失焦、再回來 | 離開時停；回來後不會補震剛才那一下 | **未測** |
| 8 | 遊戲內暫停（頁面仍聚焦） | 依賴 §4 的 `game.js` 接線。接上之前這列維持未測，不能寫通過 | **未測** |
| 9 | 只插入手把、不看機身 | 關掉系統「觸覺回饋」或選沒有 `vibrate` 的環境，確認記錄的是手把馬達 | **未測** |

iPad／Safari 與 Android／Chrome **都還沒有實測通過**。不要把本檔或沙箱 13/13 抄進驗收矩陣當成 R3 PASS。前一輪 `docs/r6-test-report.md` 的 R3 仍是 `NOT_TESTED_ON_DEVICE`，這個結論現在還在。
