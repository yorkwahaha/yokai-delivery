# R15 總監證據補正｜2026-10-14

保留Space原報告與logs；本檔為獨立查證補正，不修改其owner產物。C3 **NOT_DONE**。

1. 最新run-full6 started `2026-10-14T11:16:20.413Z`，32PASS/0FAIL/3HUMAN/3BLOCKED。目錄12張PNG中只有 **9張屬最後一輪更新**；三張 `*-B-codex-from-pause.png` LastWriteTime為19:03:29／19:03:41／19:03:51，早於本輪19:16–19:17。程式在G07 BLOCKED直接return、未執行B shot；末尾readdir把旧圖一併計入。三舊圖保留但 **不能證明最新pause路徑**，報告12不可當本輪12有效新圖。
2. G06用replay窗口增量2≤自然對照29，不足證明事件可歸因增量0。Node/public hit disabled回ok:false正確；真正pointerdown仍在hit之前AUDIO.init，是新定位待修／實測的副作用。R17須同步事件歸因或固定背景rAF（方法明示），要求replay事件0音訊/TTS/fetch，真音檔0讀取依guard另列。不可用較高background控制量掩蓋。
3. G03最後仍是全頁文字再窄regex，不等於真正圖鑑scope。R17須在CARD_GALLERY_UI.draw範圍抓實際文字；鎖卡jp/zh/kana不能洩漏，滿卡各欄必有，不讓HUD時間／包emoji冒算禁欄。
4. R15 S01的openCards讀storage例外安全，不能推成record寫quota安全；R16已證實setItem throw。Cursor正按persisted:false修寫入路徑，C4 full awards尚未實作。
5. G08有效熱區獨立重算與root Node RED一致：desktop/tablet無裁切／重疊，mobile cards/filter-stage、words/filter-pack有1.84615邏輯px重疊；raw32熱區實際已擴張44CSS。不放寬44、不以负x當出界。

R17由獨立Codex承接（Space free Rate limit exceeded done631），新run screenshot清單需當次產出追蹤，不用整目錄歷史數量。音訊／部署凍結維持。
