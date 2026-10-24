# Stage2 雨夜港町｜正式發布與舊圖封存紀錄（2026-10-24）

## 1. 發布對象
- 基線：a4aaa94（原 GitHub Pages master）。
- 本輪只發布第二關公開地板、港口建築與場景素材，不含同時開發的 BOSS 幾何圖重製或第三關重繪。
- 20 張圖片整理成 WebP，約 4.6MB：4 石、3 木、1 橫向石木過渡、5 建築、5 道具、海面與北側岩壁。
- Runtime 與 manifest：assets/img/rain-port/s2-production/；源圖和 QA 檔仍位於原本的 art/s2/ 和 art/stage2-rain-port/production-s2-nano-20261020/。
- 公開第二關預設使用新版。加上 s2legacy=1 可單獨進行舊版回退比較。
- 進入第二關才下載大型地板組，首頁和世界地圖不先下載，以維持手機載入速度。
- 仍保留舊 PORT_ART 作圖片解碼失敗時的保底。DEV 舊圖門檻未整批刪除，以免破壞歷史回歸；正常模式不下載兩張大容量舊候選建築圖。
- 旅路地圖沿用已核准 overworld_approved_v2.webp，校驗其內容未變。首頁所載 JS 的快取字串已更新。

## 2. 真實驗收
- Chrome 本機真頁（非純 stub / VM）：普通首頁 S2 lazy-load、DEV 選擇第二關、所有 8 張 WebP 地板載入、5 棟建築、5 個 props、海面與北崖成功解碼；沒有 page exceptions。
- 畫面 Canvas draw call 計數：4 種石地皆已 draw；3 種木地中至少 2 種於這個視口實繪；橫向石木過渡已實繪；海面有實繪紀錄。未見該視口的木地 01，不代表永遠不能畫。
- 新增 tests/s2-published-release.test.cjs + 現有 5 份適用範圍回歸合計 29/29 通過。已重新執行媒體 cache 生成器，內容索引由 428 媒體變 448。
- 已有舊測試 s2-ground-kit-contract.test.cjs 嚴格斷言「必須是 DEV gate 且 art/s2 原稿存在」，不符合這次正式發布新契約，且原稿位於 .gitignore，不在乾淨發布工作樹內；不拿舊 gate 的 RED 冒稱本輪畫面失效。
- S2 舊版拼接仍有少數人審問題，這次是把使用者指定的最新輕量素材發布；部署成功不等於所有拼縫已完美或自然十分鐘實玩已驗。
- Chrome 另觀察到十多個既存「融合圖從 art/fusion/candidates 請求但正式站不提供」的 404，與本輪第二關地圖修正無關；需另開 fusion source-publication 票，未以亂用舊圖或額外擴修處理。

## 3. 舊圖整理
- 本機原專案（非公開 release）已將 art/stage2-rain-port/s2-stone-methodb-20261021/ 與 s2-ground-redraw-20261021/ 封存至 art/archive/2026-10-24/stage2-retired/：67 檔、142.17 MiB，保留每檔 SHA256 和還原來源路徑。
- 14 張無 JS／tests／tools 引用的 UI 預覽 _thumb.jpeg 移至 art/archive/2026-10-24/ui-preview-thumbs/，保留每檔來源與 SHA256。
- **未刪原始圖**，未搬已核准 art/s2/、最新 Nano 原稿、現行 runtime WebP、BOSS 專案工作檔、manifest 引用或音檔。
- 不自動刪整庫 800+ 圖片：仍有舊 DEV gate、manifest 或研究腳本會引用；建議後續依零 consumer / 零 manifest / 零 tool 引用白名單分批封存，避免破壞可復原性。

## 4. 維護注意
- 發布在隔離工作樹 I:\\Projects\\yokai-delivery-release-s2-20261024 實作，確保主工作樹原有未提交 BOSS／第三關工程不被捲入。
- 發布完成後，原工作樹的 master 可能落後遠端 master；**不可直接 reset／checkout／pull 覆蓋已有 dirty**。下輪請先保全並單 writer 協調整合這次的 assets、index 與 service-worker 變更，再延續 BOSS 修補。
