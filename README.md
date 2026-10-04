# 妖怪快遞社：夜行配達

以 Canvas 製作的日文假名學習遊戲。入口為 `index.html`，程式在 `js/`，素材在 `assets/`，回歸測試在 `tests/`。

## 執行與測試

1. 使用本機靜態 HTTP 伺服器開啟專案根目錄，再以瀏覽器進入 `index.html`。遊戲不需要建置。
2. 安裝 Node.js 的環境可執行 `npm.cmd test`（Windows PowerShell），或 `node --test tests/*.test.cjs`。

## 操作與規則

- 滑鼠按住左鍵拖曳移動，右鍵衝刺；鍵盤方向鍵移動、Shift 衝刺、Esc 暫停。
- 手機橫向遊玩，使用畫面上的移動與操作按鈕。
- 題目以圖像／中文意思對應日文假名；反向題型目前關閉。
- 在答案區停留 0.45 秒會提交答案。
- 使用提示的配送仍計入配送目標並獲得經驗，但不累積熟練星；分數與燈油獎勵較少。
- Boss 答錯會扣燈油，第一次排除錯誤選項並標記使用協助；剩兩個選項時再次答錯會換題。
- 目前提供兩個可玩關卡，第三關尚未開放。

## 素材與驗證

- 自訂音效與快取更新方式見 [音效說明](assets/audio/sfx/README.md)。
- 原始驗證資料保留在 `artifacts/validation/`；舊盤查、逐輪報告與交接內容可從 Git 歷史查閱。
- 專案說明統一維護於此，避免每輪新增一份 Markdown 報告。
- 最近程式版本的回歸測試為 153/153 通過；這不代表所有實機情境均已驗證。
- Windows Chrome 受控效能量測約為靜止 41.62 FPS、移動 39.13 FPS，尚未達到穩定 60 FPS，也尚無手機效能驗證。

正式站台：[開始遊玩](https://yorkwahaha.github.io/yokai-delivery/)。最近已驗證部署的程式提交為 `d561526`，證據在 `artifacts/validation/round19-deploy-proof.json`；本機後續文件提交不代表已部署。
