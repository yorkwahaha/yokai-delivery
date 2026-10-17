# R17 Codex C3／storage focused QA

狀態：**技術基線已實測，藝術／現役C4仍待後續驗收**。20:11 ChatGPT在Codex額度限制期間真正執行本runner，`run-2026-10-14T12-12-55-664Z/result.json` 為30PASS/0FAIL/3HUMAN_REVIEW/0BLOCKED；22:xx Codex重新解析JSON核對。commands／snapshot SHA／guard／當次PNG清單在該result，0真音檔read。這是當時C3快照，不等於後加C4的獨立QA，也不代表美術／實體裝置批准。現役C4的page收藏/hint深墨暗底由Codex實圖確認仍待修，E22 Sonnet補驗。

以下為保留的 **歷史PREP**，其「未測試／等待」不可當最新狀態。

1. 已修改：新增 `tests/director-c3-focused.acceptance.cjs`，只檢查 G03/G05/G06/G07/G08/G09 與公開 `CARD_DELIVERY.openCards` 安全儲存。HTTP-only 私有觀測；印記為 SETUP_ONLY，不冒充自然配送。只讀指定 production，不改 production。
2. 已靜態檢查：`node --require ./tools/director-audio-freeze.cjs --check tests/director-c3-focused.acceptance.cjs` exit 0；`node --require ./tools/director-audio-freeze.cjs tests/director-c3-focused.acceptance.cjs --prep` exit 0，INIT／完整 HTTP game hook `vm.Script` 通過，未執行 production。
3. 未測試：正式命令為 `node --require ./tools/director-audio-freeze.cjs tests/director-c3-focused.acceptance.cjs --frozen`。三 viewport 1280×800／1194×834／844×390，真 CDP click、scoped gallery fillText、精確 VIEWPORT scale/bounds、44 CSS 有效熱區、真 play→pause→圖鑑→pause。每 run 獨立子目錄；截圖只引用 explicit screenshot 欄位和 SHA，不計舊檔。
4. 儲存驗收：動態 Map 模擬真正 getItem/setItem；quota/security 不 throw，applied/persisted 分離、bag marks/events 與 duplicate 去重、失敗配送仍 applied true 保存事件、恢復可保存完整 state。same-page 同 storage 保留 pending；不同 storage identity 不互見；新 vm 重建 bridge 模組代表 browser reload，只讀真正已存資料。C4 未實作的套卡獎勵不列 C3 FAIL。
5. 音訊守門：Node require fs guard；HTTP 在讀檔前 silent audio.js stub／音檔204；外部 browser request 阻擋；從 startup 凍結 rAF，真 pointerdown capture/bubble同步事件差值以及 click 前後整段 call delta 均需零，背景累計不作替代證據。
6. 限制：非實體裝置／FPS／螢幕閱讀器驗收。紙面對比與插畫美術仍需圖片檢視及使用者人審。未 Commit／未 Push／未 Deploy。

PREP 證據：`artifacts/validation/director-r17-c3-storage-20261014/prep.json`；一次 PowerShell quoting 與一次不存在檔名的搜尋錯誤記於 `prep-errors.log`，已改用聚焦正確檔名，均未執行 production。
