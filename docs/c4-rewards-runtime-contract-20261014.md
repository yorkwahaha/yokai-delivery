# C4 純收藏套卡：最小 runtime 契約

Codex執行決策，2026-10-14。C3正式接線及独立gate後由Cursor實作；新插畫仍WAITING_HUMAN，不能以這份契約宣稱獎勵已可用。

1. 套卡來源用真 `CONTENT.WORD_PACKS`／PACK_ORDER，每個pack依NFC去重有效jp、排除decoy。穩定ID用packId，不用名稱或stageId；一詞多關仍共用配送印記。空包不達成，不硬碼25詞或8關。
2. 全包每字均≥4印才complete；0–3任何一字都未完成。純圖卡收藏，無攻擊/血量/速度/配送/相機加成。
3. 先完成資料投影（packId/name/total/full/complete），再接正式成功配送觸發：新成功event（含assisted）更新marks後，計算新達成套卡。失敗/duplicate/Boss/學習重聽不能重發獎勵。
4. 一次性收藏紀錄留在既有卡檔正式/dev鍵內，可新增optional `awards`（或既有等價sets）true map；v1舊檔可讀，損毀值不當已獲獎。`loadState`/migrate/applyEvent/serialize不能在下一次配送或reload丟掉它。不得另開學習鍵或改STORE熟練box。
5. 舊檔已4印且無獎勵紀錄可在下一次成功配送補齊（或清楚定義UI-open reconcile）；使用者不重做已滿卡。每次newAwards非空才出中性文字通知，不阻斷對局，不自動暫停、不反覆播放。
6. 無核准套卡插畫，UI只顯示「套卡已集齊」及真pack名/進度。沒有dummy圖片、emoji、程序假插畫，不從未批准art路徑載圖。獎勵圖片接入另等人審；可先顯示文字收藏紀錄。
7. storage拒絕仍不阻斷成功配送。已接受事件回 `applied:true`，寫入成功回 `persisted:true`，quota/security/serialization失敗回 `persisted:false` 及精簡 `storageError`（name/message），不得 throw 或冒稱已保存。當前 bag 保留記憶體 marks/events/awards 與去重，`newAwards` 只代表當次記憶體首次達成；reload 僅讀上次真正保存值，可能再次補領，不能承諾跨 reload 去重。未 applied 的事件不寫 storage，回 `persisted:null`（此次無保存嘗試）。後續成功寫入可保存當前完整 snapshot，避免丟掉先前未保存印記。UI 如有通知須區分未保存，不加音效或擋對局。

最小hook：`card-gallery-model`可有純packSets投影，`card-collection`承接可持久化資料、`card-delivery-bridge.openCards.record`用正式詞包集更新；game成功配送讀newAwards作非阻斷文字，UI字頁讀真record/sets。可用另一小型純模組但不大重構，不增加相依。Cursor獨占這些檔，Space只新增QA。

獨立QA可依的公開資料邊界：`CARD_DELIVERY.openCards(storage,loc,packs?)` 第三參數可傳真pack陣列，省略時用CONTENT.WORD_PACKS；不改既有兩參數caller語意。`record` 成功結果增加 `newAwards: [packId,...]`（未達成/失敗/duplicate為空），`snapshot().awards` 是boolean true map，持久化JSON使用同欄。資料投影可由 `CARD_COLLECTION.completeSets(packs,marks)` 或 `CARD_GALLERY.packSets` 供UI，不應讓core反向require Gallery產生循環。名稱若有既有等價helper可保留，但record/snapshot的可觀測行為必須一致。

必驗：真32詞包（本輪Node實查WORD_PACKS/PACK_ORDER為32；歷史21已過期）與164詞對應、跨關NFC共享、0–4各邊界、empty/decoy/NFC去重、首次成功grant一次、重复event不grant、下一次配送/reload保留、舊已滿卡補領、ordinary/dev/public?dev隔離、storage失敗安全、UI顯示真收藏資料且無戰力變更。CONTENT.STAGES為object，各stage.wordPacks為array，catalogs需Object.values後使用；不猜資料形狀。圖片待核准/音訊凍結/真機缺口各列，不將NodePASS當美術PASS。

19:07 gate：R16 現況12 RED/2 PASS為未實作基線；runner目前 RED 可 exit0，正式驗收須同時檢查 RED=0/FAIL=0/BLOCKED=0，不以退出碼獨判完成。`openCards.length` 不是第三參數支持的契約（預設參數可不計 length）；以真傳入詞包行為驗。既有 delivery assisted 成功可計印、Boss kind被拒絕不是缺陷。storage quota 中斷則是現役真缺陷，優先修。
