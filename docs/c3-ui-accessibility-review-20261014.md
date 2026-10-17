# C3 圖鑑可讀性／觸控審查｜2026-10-14

Codex；使用 game-ui-accessibility-reviewer。依 R15 真 Chrome desktop 1280×800、mobile 844×390 截圖與現役程式核對，非實體手機／最終美術核准。C3 **NOT_DONE**。

1. **阻塞**：`c3-mobile-landscape-844x390-A-codex.png` 滿卡五行擁擠；`card-gallery-ui.js` 印記置於 `cardH-8`，實拍深墨印記落在紙札下方暗底、難讀。印記是解鎖必要資訊，不可只以 fillText 被呼叫當可讀 PASS。
2. **主要問題**：舊 tabs raw 高32不是完整 input 熱區；`game.hitButton` 已擴張到44 CSS。手機 tabs 擴張下緣可能和首列 filter 重疊，須驗有效可見熱區、命中順序與 clipping。負 x 可屬擴展 viewport，不直接等於出界。G07 尚須真 play→pause 起始才可判來源回退。
3. **次要問題／限制**：32包逐次循環選擇負擔較高，先保留可逆簡單控制；焦點、長名稱須確認。Canvas 未做螢幕閱讀器語義驗收，不宣稱全面無障礙。重聽凍結可禁用，必要資訊不依聲音。
4. **修復**：手機降低每頁行數（建議1列4卡），提高每張紙的內容高度；`show/reduce/draw` 共用 pageSize。進度及 jp/zh/kana 放在實際明亮紙面安全區，留獨立行距，中性插畫提示可全頁共用。依精確 CSS scale 與實際可視 bounds 預留 tabs/header，避免擴張熱區吃到 filter。不得放寬44 CSS。
5. **身份風險**：減行數增加翻頁；移文字可能碰紙札裝飾；擴標籤可能擠標題。沿用核准紙札及字體，只改排列／定位，避免用普通幾何面板替換真圖。
6. **折衷**：桌機維持足夠可讀時的8卡，手機可4卡；關鍵進度深墨置於淺纸，提示保留中性文字且不擠字卡。優先可讀與可點，保持原美術。
7. **验收**：三 viewport 真 Chrome，鎖卡不洩漏 jp/zh/kana；滿卡三語欄與4/4可目視辨讀、行框不重疊、無文字落暗底。所有有效可點熱區可見部分≥44 CSS、無功能重疊／裁切；真 click 篩選／分頁／返回。G03 只計圖鑑實際 draw 文字；G06 replay 事件差值0且0音檔讀取/TTS；G07 真有 houses>0 的pause前後 elapsed/oil/P/IDs一致，setup hook須明示。Node PASS 不代替此視覺 gate。

證據：`artifacts/validation/spacebunny-r15-c3-runtime-20261014/c3-mobile-landscape-844x390-A-codex.png`、同目錄 desktop 圖；原始 run-full/run-full2 失敗保留。待 Cursor 修、Space focused 重驗；新插畫仍 WAITING_HUMAN。
