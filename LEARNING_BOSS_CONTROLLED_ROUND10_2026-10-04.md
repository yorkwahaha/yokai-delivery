# 第十輪 Boss 加速受控 UI 驗證（2026-10-04）

## 成果與範圍

依使用者授權，首個 Boss 排程在獨立測試入口縮短至 10 秒，完成實際 UI 的生成、出題、錯答排除、離場重入、答對破盾與輔助不升星驗證。沒有修改正式程式或平衡，沒有推送或部署。這份證據屬於加速受控瀏覽器測試，不能稱為自然存活三分鐘。

執行基準 HEAD：`3e80f4004fd40aaf09cf73b47d2a7e325ff9454a`。正式部署仍以 RELEASE_ROUND9_2026-10-04.md 記載的 `833972ddeb1c4cd9e1b41586a2a3662bd9f7403d`／Pages run `37144569464` 為準。

## 方法

1. 使用 `http://127.0.0.1:8789`，與前輪自然入口 8788 分離存檔；此 origin 起始首頁為 0 分／0 配送。
2. 最小 Node 靜態 server 僅在 HTTP 回應記憶體中，將 `js/words.js` 的 night-town `bossTimes` 第一項 180 改成 10；其餘三項 360／540／590 不變。工作檔始終保持原值 180，不需事後還原檔案。
3. HTTP 內容逐字比較證明只替換該排程，並局部執行回傳的內容設定，確認有效關卡排程。雜湊與斷言見 `artifacts/validation/round10-controlled-boss-config-proof.json`。
4. 首次只覆蓋 `config.js` 沒有效果，因關卡 `STAGE.pacing.bossTimes` 優先；該次約 26 秒未見 Boss，未當成成功證據。診斷後改覆蓋實際關卡設定。
5. 使用內建瀏覽器 1920×1080 與文件化 UI 按鍵；Boss 由真正 update 排程生成，正常抽詞。沒有修改時間、位置、油量、題詞或注入答案／事件。P 暫停僅供觀察及工具往返，沒有連續時限宣稱。

## 可核對的過程

時間依畫面剩餘倒數推算；圖片皆位於 `artifacts/validation/`。

| 局內約秒數 | 觀察 | 證據 |
| --- | --- | --- |
| 9 | 尚未看到 Boss；倒數 9:51，97 油 | round10-controlled-boss-before.png |
| 11–12 | Boss 已在視口右側可見 | round10-controlled-boss-spawn.png |
| 14 | 接近後出題「兔子」，三選一：うさぎ／いぬ／ねこ；94 油 | round10-controlled-boss-quiz.png |
| 15 | 選 いぬ 錯答，顯示燈油 -8 與排除錯誤選項，剩 うさぎ／ねこ；86 油 | round10-controlled-boss-wrong.png |
| 18 | 向左離開問答範圍，題板消失、Boss 結界仍在；途中受普通敵人傷害，74 油 | round10-controlled-boss-leave.png |
| 20 | 向右重入，同一「兔子」重新顯示三選一；73 油 | round10-controlled-boss-reenter.png |
| 21 | 選 うさぎ，題板消失、結界解除，顯示「結界破除！全力進攻！」；73 油 | round10-controlled-boss-correct.png |
| 答對後 | 才開圖鑑，うさぎ已揭露、四顆空星，精通 0/39 | round10-controlled-boss-codex.png |

重入恢復三個選項是現有重建題板的行為；不是排除後的兩個選項永久保留。需要保留的是本題的輔助狀態。這次 UI 圖鑑零星與既有 `Boss assistance survives leaving and reentering quiz range` 測試的 `box === 0` 共同支持該狀態未因重入遺失；沒有從圖鑑推算歷史答對／答錯計數。

## 驗證、限制與收尾

- 已修改：本報告及受控證據；正式入口與 12 個 JS 沒有修改。
- 已靜態檢查：12 個 JS `node --check`、`git diff --check` 通過；`git diff --exit-code -- index.html js` 無差異；night-town 原排程仍為 180／360／540／590。
- 已測試：`node --test tests/*.test.cjs` 109/109 通過，輸出為 `round10-controlled-boss-tests.txt`；既有離場重入、換字／新局清除及同字委託順序測試均涵蓋於其中。這些測試仍執行正式程式。
- 已部署：本輪無。原正式版本未變。
- 瀏覽器觀察到的 error 記錄為空，見 `round10-controlled-boss-errors.json`，不代表全路徑無錯誤。
- 沒有驗證 Boss 擊殺、三分鐘敵群強度與自然可達性；未在本次 UI 強湊同字配送／Boss，也未捕捉連續自然 1.8 秒回饋重疊。既有程式／測試證據仍須與這次 UI 證據分開。
- 測試分頁已關閉、視口 override 已 reset；server Ctrl+C 結束（退出碼 1），另以 Node TCP 連線確認 8789 回傳 ECONNREFUSED（退出碼 0）。

針對 Boss 功能的下一次驗證應優先採此類加速受控流程；自然三分鐘存活只在需要評估路線、操作與平衡時另列，不再作為每次功能驗證的先決條件。
