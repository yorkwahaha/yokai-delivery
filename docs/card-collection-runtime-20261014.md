# 言靈圖鑑 C1／C2 本機 runtime（2026-10-14）

狀態：**本機已接入配送**。C3 圖鑑畫面、C4 套卡、C5 圖鑑專頁都還沒做。第一關地板 P0、第二關石木交界、第三關自由轉角仍是原來的 BLOCKED，這份接線沒有動它們。

未 Commit／未 Push／未 Deploy。

## 實際改了什麼

| 檔案 | 變更 |
|---|---|
| `index.html` | `game.js` 之前載入 `card-collection.js`、`card-delivery-bridge.js`。`game.js` 快取參數改為 `20261014-cards1`。音訊 script 沒改。 |
| `js/game.js` | 圖鑑腳本存在時，`makeOrder` 只呼叫 `window.CARD_DELIVERY.choose`。成功配送（獨立或輔助）對同一個 `cardEventId` 記一筆印記。4/4 當下用既有浮字 `言靈齊印 4/4`，不切畫面。 |
| `js/card-delivery-bridge.js` | 補上正式入口 `choose(words, exclude, rnd)`，從目前的 `localStorage` 與 `location` 讀印記。 |
| `js/card-collection.js`、`js/card-delivery-bridge.js` | 外面包一層函式。瀏覽器經典 script 會共用頂層 `const`，否則會和 `dev-mode.js` 的 `api` 撞名，整頁停住。 |
| `tests/card-delivery-runtime.test.cjs` | 新的 runtime 測試。 |
| `tools/card-delivery-chrome.cjs` | 真 Chrome 檢查。只在 HTTP 回應注入 hook，不改磁碟上的 `game.js`。 |

`js/store.js`、地板、敵人、Boss 圖、`renderer.js`、`world.js`、`assets/`、音檔、TTS、開發者選關都沒改。AGY 的 terrain-v2／junction 沒有接進 runtime。

## 配送契約

`makeOrder` 先排除活著的誤配妖和已經掛著的委託，再交給 `CARD_DELIVERY.choose`。回傳的是詞池裡的原物件。池子空了就這張單不發，也不退回 `study.pick`。

已存在的委託不重抽。成功配送寫入印記之後，下一張新委託才用新權重。

Boss 問答、護符聽題、`STORE.rec`／`recAssisted`／`recRecall` 不加印記。熟練度 `m.ok`／`m.box` 仍寫在原來的學習存檔，不會被抄成印記。

印記 0–4，NFC 日文當 key，跨關同一字共用，同一個 event id 只算一次。正式鍵 `yokai-delivery-cards-v1`。`127.0.0.1`／`localhost`／`::1` 且 `?dev=1` 用 `yokai-delivery-dev-cards-v1`。公開網址即使帶 `?dev=1` 仍走正式鍵。

存檔拋錯時這張配送仍算完成，遊戲留在 `play`。該次印記如果沒寫進磁碟，重新讀檔不會補上。

沒有載入圖鑑腳本的舊 Node 沙箱，`makeOrder` 仍走原來的 `study.pick`。正式 `index.html` 有載入圖鑑，玩家路徑不會走那段。

## 測試

沙箱不載入 `js/audio.js`。`location.search` 附 `tilt=1`，只為了讓 VM 保持 2D 間距。`usePool` 只換該局詞池；`installJob` 用同一張委託重放 event id。

```text
node --test tests/card-collection-c1c2.test.cjs tests/card-delivery-bridge.test.cjs tests/card-delivery-runtime.test.cjs
31/31 PASS
```

另外：`tests/progression.test.cjs` 8/8、`tests/v3-study-session.test.cjs` 6/6、`tests/v3-contract-gate.test.cjs` 21/21。沒有跑會讀音檔的 media-cache 測試。

## Chrome

`node tools/card-delivery-chrome.cjs`

- 真 Chrome headless，`http://127.0.0.1:8796/index.html?dev=1&tilt=1`，1280×800。
- `requestAnimationFrame` 凍結。`__cardQA` 只存在於這次 HTTP 回應。
- `js/audio.js` 換成靜音 stub。音檔路徑回 HTTP 204，磁碟讀取次數 0。這次 stub 後沒有發出 mp3 請求，所以 204 計數是 0。
- 夜行町抽出的委託是詞池原物件 `まち`。答錯不加印記；同一張單答對後 `yokai-delivery-dev-cards-v1` 的 `まち` 為 1，event id `delivery:night-town:まち:1`。
- `yokai-delivery-cards-v1` 與 `yokai-delivery-v1` 都沒被寫入。開發學習檔 `yokai-delivery-dev-v1` 沒有 `marks`。
- 接著答對 Boss 題 `ねこ`，印記 JSON 與答題前相同，結界有解開。
- 沒有未捕捉例外。

證據：`artifacts/validation/card-delivery-runtime-20261014/chrome.json`。

這不是自然十分鐘通關，也不是手機或平板實機。

## 還沒做

- C3：圖鑑分類、剪影、0–4 顯示、卡片與發音重聽。
- C4：套卡獎勵。
- C5：圖鑑頁自己的長期抽詞畫面。公式與去重已在 Node 測試裡。
- Roadmap 的 C1／C2 核取方塊這輪沒勾。畫面驗收要等獨立 QA，不把 31/31 或這次 Chrome 寫成整關美術通過。

## 建議交給 Space Bunny 的範圍

只核對這次接線：`?dev=1` 成功配送會增加 dev 印記、失敗與 Boss 不加、正式鍵不被 dev 寫到、4/4 浮字不擋操作。不要重跑第一關地板或第三關場景，也不要讀現役 MP3。
