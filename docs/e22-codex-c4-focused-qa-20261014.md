# E22 Codex C4 focused QA（2026-10-14）

**最新 DONE（E22-05修後）：獨立contrast Chrome 15 PASS／0 FAIL／0 BLOCKED，三視口manual可讀性 PASS。** 僅頁級文字對比技術缺陷已解除；C3/C4插畫藝術與真機仍WAITING_HUMAN／WAITING_DEVICE，未 Commit／未 Push／未 Deploy。

1. 已修改QA：同owner腳本新增 --contrast-only，僅新run及本報告。未修改production或既有FAIL PNG。
2. 已靜態檢查：node --check tests/director-e22-c4-focused.acceptance.cjs，exit0。
3. 已測試命令：node --require ./tools/director-audio-freeze.cjs tests/director-e22-c4-focused.acceptance.cjs --contrast-only，exit0；每視口4項共12項＋3守門＝15項。
4. 真Chrome穩圖已逐張view_image：桌面1280×800正式鍵、平板1194×834與手機844×390 dev鍵；資料來自真CONTENT.WORD_PACKS.animals的三詞，SETUP_ONLY全4印＋awards.animals true。真正UI顯示收藏1/32・動物街3/3及待解鎖插畫，未拼假UI。

[result.json](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-59-45-696Z/result.json)、[visual-review.json](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-59-45-696Z/visual-review.json)各自保留命令／exitCode／真fillText色彩與glyph bboxCSS／pager CSS box／9檔beforeafter快照；三圖與SHA如下。紙卡jp／zh／kana／4/4仍#24180f；頁級兩行#efe2bf、alpha1。獨立實測CSS baseline：desktop 22.000001px；tablet 22.000001px；mobile 21.999999px，容差0.001px。文字真glyph bbox未越視口、未與prev／next重疊；manual可讀／分行亦PASS。

| 新截圖 | SHA256 |
|---|---|
| [desktop-gallery-contrast.png](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-59-45-696Z/desktop-gallery-contrast.png) | 5191797ee8c8408cdf75744a077dd2b0cd548ef03140b659989476b849573e4b |
| [tablet-gallery-contrast.png](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-59-45-696Z/tablet-gallery-contrast.png) | a1fb578aba29cdc6f5ce05170d4c9b8dc2f02e4eae936e6a43ec6fd7d1acbdcc |
| [mobile-gallery-contrast.png](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-59-45-696Z/mobile-gallery-contrast.png) | 6284f593e5e1ae76a5bcb5dd9a25f50efdbadc65c2d5fa2ee183e3010314cb47 |

三張SHA已重新讀PNG核對，不readdir湊舊图。9檔before=after；對前輪core snapshot唯一變動是index.html及js/card-gallery-ui.js，另外7檔（含game／UI／core／bridge／model／viewport／words）完全相同，可明確復用前輪C4核心24/24與C3 scoped輕驗9/9，不重新測也不重複加總。新SHA：

| 檔 | SHA256 |
|---|---|
| index.html | 92fb3058161665d425657faad7586f9706e8af5f7aa745b78245bc2b6b2462a5 |
| js/card-gallery-ui.js | b30a18056fd19e4b5f7d950168b818854d35b35de5e233a6cf8890ec075b1e9c |

rAF frozen、手動少量幀等待fade結束，非FPS／實體iPad／Xbox。HTTP before-FS音訊stub3次、音檔讀取0／音檔bytes0，外部請求攔截與字型fallback，未讀音訊／TTS／金鑰。自身Chrome程序已關閉，未碰他人server。下方保留修前FAIL與harness錯誤歷史證據，不能當成現行FAIL；原artifact不可覆寫。

---

## 修前獨立QA歷史（22:43–22:45）

**DONE：C4 技術24/24 PASS；C3 light9/9 PASS；三視口收藏／插畫提示可讀性 FAIL。** Production可交還Cursor修已核實UI文字對比；不能宣稱整體gate或美術完成。

1. 已修改：僅新增 tests/director-e22-c4-focused.acceptance.cjs、本報告及 director-e22-c4-focused-20261014 下的新run。未改production、Sonnet證據、音訊或圖片。
2. 已靜態檢查：node --check tests/director-e22-c4-focused.acceptance.cjs，exit0。
3. 已測試：Chrome桌面1280×800正式鍵，tablet1194×834與mobile844×390使用dev鍵；單一origin9560，CDP9561，相同query reload。C4每視口8項共24項。C3每視口3項共9項，最新runner另含3守門項，不跨run加總重複項目。
4. 部署：未 Commit／未 Push／未 Deploy。

## 實際證據與命令

| 執行 | 原始結果／退出碼 | 判讀 |
|---|---|---|
| node --require ./tools/director-audio-freeze.cjs tests/director-e22-c4-focused.acceptance.cjs --view=desktop | run-2026-10-14T14-40-01-475Z：12PASS1FAIL，exit1 | 原C3全局calls增2。同步pointerdown為空；兩個setSuspended由Chrome focus觸發，非replay。首圖有轉場fade，不作最終視覺證據 |
| 同命令、240frames試驗 | run-2026-10-14T14-40-47-856Z：4PASS1BLOCKED，exit1 | Runtime.evaluate15秒timeout，改少量批次，不原樣重試 |
| 同桌面命令、批次幀 | run-2026-10-14T14-41-38-198Z：12PASS1FAIL，exit1 | 上述focus呼叫已取得明細，保留原red |
| node --require ./tools/director-audio-freeze.cjs tests/director-e22-c4-focused.acceptance.cjs | run-2026-10-14T14-43-10-921Z：33PASS3FAIL，exit1 | C4全部24PASS；新增C3 3/4斷言把世界HUD ×0／拖曳移動混入卡片座標，原始errors.log保留，不能把exit1寫成總PASS |
| node --require ./tools/director-audio-freeze.cjs tests/director-e22-c4-focused.acceptance.cjs --c3-only | run-2026-10-14T14-45-14-202Z：12PASS0FAIL0BLOCKED，exit0 | 改真CARD_GALLERY_UI.draw專屬capture，仅重驗9項C3與3守門，解決上述3假FAIL；沒有重跑C4或18／48／719Node |

C4核心結果見 [result.json](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-43-10-921Z/result.json) 與 [adjudication.json](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-43-10-921Z/adjudication.json)；C3 scoped真重驗見 [result.json](../artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-45-14-202Z/result.json)。每個run保留命令、exitCode、原始errors.log和Chrome stderr。技術PASS與視覺FAIL分列，不依runner exit0冒稱驗收全綠。

## 已證實的契約

SETUP_ONLY注入真CONTENT.WORD_PACKS.animals的ねこ／いぬ／うさぎ，前兩詞4印、最後詞3印、awards空；before確為2/3。configureStage＋start真正建world，play、houses75、artPending false、tutorial false，再批次手動幀退去轉場和title。沒有直接state=play。

真stampDeliveryCard({word:actualLastWordObject,cardEventId:unique}, P座標)回bridge觀測結果applied成功、newAwards=[animals]；marks全4、awards.animals=true，persistedJSON一致。texts實際say一次套卡已集齊・動物街，真正play draw的fillText與三張HUD截圖皆可見；同event再觸發applied false／newAwards空，通知數仍1。圖鑑真顯示收藏1/32・動物街3/3，同origin同query reload保留bag；對向正式/dev sentinelJSON不變。

C3 light以真圖鑑draw scope驗0／1／2／3印均locked，不出jp／zh／kana。pointerdown與pointerup同步capture→bubble的呼叫增量都0；全局觀測另記focus setSuspended，不能混成重聽。未重跑完整R17 navigation/44CSS/world套件，舊R17只保留歷史範圍。

## 真UI缺陷（manual FAIL）

view_image實看三張gallery-award及三張hud-award。穩定圖鑑的收藏與待解鎖插畫皆color#24180f、alpha1，仍落暗底，三尺寸均幾乎不可讀；不是fade或沒有fillText。兩行CSS baseline差：desktop 14.96px；tablet 15.34px；mobile 15.03px。手機約15px行距未單獨判遮疊，主要已核實缺陷是對比。紙卡內容深墨在紙面可讀，不要求改卡片紙張美術。

最小修復位置js/card-gallery-ui.js:169–173：頁級收藏／插畫提示改用與暗底相容的文字色或既有文字對比方式，保留卡片深墨與已核准圖片；不加假幾何美術。修後須用新快照與三視口穩定截圖focused再驗，不能沿用本次FAIL圖當PASS。

## 限制

rAF自boot凍結，手動50ms幀，非FPS或真人自然通關。桌面Chrome emulation，非實體iPad／Xbox，WAITING_DEVICE。外部字型被攔截、await document.fonts.ready後使用系統fallback。音訊HTTP在FS讀檔前stub/204，audioFileReads=0，TTS/API外部request攔截；沒有读取凍結音訊來源、音檔、TTS或金鑰。沒有套卡插畫核准；WAITING_HUMAN。

## 本次明確截圖清單（每張獨立SHA256已重新核對）

C4圖共12張，來自artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-43-10-921Z；C3 light圖共3張，來自artifacts/validation/director-e22-c4-focused-20261014/run-2026-10-14T14-45-14-202Z。清單取此次shot回傳，未readdir累計舊圖。

| run | 檔名 | SHA256 |
|---|---|---|
| C4 | desktop-play-before.png | f772b33024bf4b66cf1963d434358d54104246413af671a933af2cb9939f8045 |
| C4 | desktop-hud-award.png | 00f62e9f4de98dff13f7332ee961dc89eecc4294f0facf098f2dd453fb2e1ed7 |
| C4 | desktop-gallery-award.png | 683dfc27e0ba6ddebe8715ecdef2378d455c3cd9e12b91c13c38c394bab605ce |
| C4 | desktop-gallery-locked.png | 4d7f8afaeec97cba2801bcb0d60720e0bf6876e95d2aab0a368dac0c59c503ed |
| C4 | tablet-play-before.png | 26a1e5a8049ff25517b2fe0ce658121c72fbd276e43175ba278fbe3aa724f1b5 |
| C4 | tablet-hud-award.png | 76e6f43e67c4e3c77c65342c8dc92a887c569522ac3d0f4b36b62221be23a73a |
| C4 | tablet-gallery-award.png | a73ac6eeb2dadb6da1fbd7db31cb2bc4df0d67e1fa59e9ab52fd3f1517e5f368 |
| C4 | tablet-gallery-locked.png | cef6f752e0b22eed5edb9ab136f59ecf15a3c317d0e6593db81b6ae2e98b963b |
| C4 | mobile-play-before.png | 5dbad87e926d2227944d99c7e3e705eda8ecedb0e244def7503e3aa1b3f78074 |
| C4 | mobile-hud-award.png | 405887f2778f50a4e7f556d7ef8dd3b7508a02cf1b25e4919bdff05548c1178e |
| C4 | mobile-gallery-award.png | 70669f3c75d6c22da59c59a640526587b2e9a64197f5a89ed57d7736bb184bf9 |
| C4 | mobile-gallery-locked.png | 4a58ad761c18c6bc0e95805052d4774cadcb2f376a2b4231cf06273f42895177 |
| C3 light | desktop-gallery-locked.png | f2e436ee7b2314e2dbd62b5c42b12c10916e7ab921b3d946bf0625a62abd8c54 |
| C3 light | tablet-gallery-locked.png | 609ec178964f0479069c1f315657e3ffa7503dbae249b844bee9722cd83bcd88 |
| C3 light | mobile-gallery-locked.png | e739eca5119dbfc2fda3688088dc2b673585bd3060c8a5582f680e196b4adecc |

## Production固定快照

两個最終run各自before=after，且C4 core before=C3 light before，9檔SHA256一致。獨立重讀比對，不靠成功訊息。

| 檔 | SHA256 |
|---|---|
| index.html | 0e518d0495c91759a6499ba8506598046ee1cb60e07496ea94bc2c02f7eda270 |
| js/game.js | f833f252c9f5cb9a7d974461a7d4cd486ea310c3d96761098b99211582a4d198 |
| js/ui.js | bd3d17c5de951c3b17e85730a6453e36ff01a4ffd2cbc5ab8e635ec40cbe21e7 |
| js/viewport.js | 4ccf0c545f814b6ae43a3aefa845ff2b75ab58cceea27dfe66ccba4692069448 |
| js/card-gallery-ui.js | 9d7f6eaeef1515924cab77b159e6f2c1bfbbb1e9782a87a797d2ef8451a8088a |
| js/card-gallery-model.js | 37d82cdf965793ca01449bfe3bf3d690d934b364a1165d8876ce66cd94b7f0f8 |
| js/card-delivery-bridge.js | 28d6f9df307c164a078ad3f3fdfc614e2b54dfa94da773b76a31f28fe54583a0 |
| js/card-collection.js | f964d8aca94a7868ad9272cbfb194b596f5fd15c6536a5a5f099c5df70b14fcc |
| js/words.js | 3714daecdcf8066aa40ae81e74134a181eefc9fb0a6703082fb19a06ca4dfb64 |
