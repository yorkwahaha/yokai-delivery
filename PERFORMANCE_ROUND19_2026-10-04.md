# 第十九輪：Windows Chrome 卡頓修正

已修改、已靜態檢查、153/153 測試通過、Windows Chrome 受控效能對照完成；此修正文件建立時尚未部署，正式發布另記錄。

## 結果與限制

使用者回報 Windows＋Chrome、非全螢幕，體感約 20 FPS；後續確認「可用時使用圖形加速」已開啟。這是使用者提供的設定狀態，沒有把它當作已核對 Chrome 實際 GPU backend 的證據。

| 同一 Chrome 前景視窗，CSS 1680×893、裝置 DPR 2 | 場景 Canvas | 120 幀平均 FPS | CPU 中位 ms | 幀間隔 P95 ms |
| --- | --- | ---: | ---: | ---: |
| 正式站原版 renderer（8d46d7a） | 3360×1786 | 13.77 | 62.0 | 100.1 |
| 僅限制像素 | 1680×893 | 39.35 | 0.8 | 33.5 |
| 最終：限制像素＋靜態底圖快取 | 1680×893 | 41.62 | 0.7 | 33.4 |
| 最終＋受控移動相機／切換街區 | 1680×893 | 39.13 | 0.8 | 33.4 |

`artifacts/validation/round19-foreground-terrain.json` 保存全部值；各段 document visible、focused=true、gameState=play。測試用第一關、elapsed=51、Lv.1、單一妖怪；固定油量與委託／技能狀態、停用一般 update／手把輪詢，只在最後一段推動玩家座標與相機以驗證快取更新。沒有用這些數值或跳時稱自然實玩、完整學習流程、所有機型或晚期戰鬥 FPS。時間並非正式遊戲加速器；fixture 在獨立 localhost:8793，正式 game.js 未加入測試入口。

結果足以確認此高 DPR 視窗的掉幀改善，但未穩定達 60 FPS。CPU 計時只代表 JS／Canvas 提交部分，不能與 GPU 完成時間或實玩 FPS混為一談；實際 FPS 使用 rAF 幀間隔另算。靜態底圖相對單獨像素限制的收益較小，不宣稱它是主要提升來源。

## 最終實作

1. 大視窗限制額外 DPR 像素：目標 150 萬 scene pixels，最大 DPR 2；保留至少 1 倍 CSS 解析度（若裝置本身 DPR <1 則尊重裝置），因此超大 CSS 視口可能超過目標。小視口在預算內仍保留較高 DPR。測得上述視窗 scene pixels 約 600 萬→150 萬，減少 75%。不改 CSS 視口、字級、攝影機座標或命中範圍；大視窗邊緣會較原 DPR 2 柔和。
2. 柔和夜色遮罩以 50 萬 pixels 為預算，使用相應 transform；最終 drawImage 仍映射完整相同的邏輯視口，光圈半徑／燈油比例規則保留。
3. 地面底圖與街區色調漸層快取在「視口＋各邊 120 邏輯 px」的單一緩衝 Canvas；相機超出緩衝、chunk 物件／關卡更換、底圖資產遲到或被替換、視口／DPR 改變時重畫。只有一張地面快取，不建立整個無邊界世界的貼圖集合。
4. 水波仍逐幀按 elapsed 繪製；道路、地名、鳥居／櫻樹保持原本水波之後的層次；房屋與角色原有排序沒有更動。未改 update、enemy、學習、音訊或存檔規則。
5. `index.html` renderer query 為 `20261004-8`。正式程式僅 `js/renderer.js` 與入口更新；測試、文件與證據另存。

## 實驗取捨

1. 初始四段 ablation 的後段受前景／暖機干擾，包含很大的 rAF 間隔，不能拿來稱實玩 FPS或直接排名瓶頸。`round19-ablation.json` 保留原資料。第一段大量成本在地面與光照，HUD 約 0.2ms；沒有因此製作 C9 家紋快取。
2. 使用 ABBA 交錯、每版本 60 個同步 raster 樣本並強制讀回 1px 的壓力測試，原版中位 79.5ms；像素限制候選 21.8ms（約減少 72.6%）。這個讀回會改變 Canvas 行為，不能反推自然 FPS。`round19-paired-initial.json`／`round19-paired-final.json` 保留第一次及收緊預算的結果。
3. 改用無讀回的前景測試後，初步原版 13.77→像素限制 34.28 FPS，見 `round19-foreground.json`。
4. 嘗試固定街燈遮罩／暖色光暈 sprite 快取，實測同場景像素限制 40.22 FPS、加入光暈快取 31.58 FPS；沒有採用。`round19-foreground-glow-experiment.json` 的 fixed 指這個已撤回候選，不是最終發布版。`a8d79a0`／`round19-glow-red.txt` 是該實驗測試的歷史；測試也隨候選撤回，不能宣稱光暈快取已修／已部署。
5. 比較結果以最後的四段 foreground-terrain 檔為準；不挑選候選的最高數字當作穩定 60 FPS。

## 驗證

1. RED `f3a2ba8`／`round19-red.txt`：大型高 DPR scene 與 light backing 超過預算；退出碼 1。`ecd6a05`／`round19-budget-red.txt`：收緊額外 DPR 預算，保護最低 CSS 解析度；退出碼 1。
2. 地面快取 RED `16121ce`／`round19-terrain-red.txt`：未重用緩衝，且無正確資產／相機／resize 失效條件；退出碼 1。快取實作後相同測試通過，水波位置仍隨 elapsed 改變。
3. `round19-renderer-tests.txt`：9/9 PASS。引入已撤回的光暈候選時，舊測試假定「最後一張 drawImage 必定是夜色遮罩」而失敗；改為依實際 light canvas 找對疊圖。初次診斷輸出留在 `round19-renderer-initial-failure.txt`，不稱它是正式遊戲故障。
4. `npm.cmd test`：153/153 PASS，退出碼 0，`round19-tests.txt`。原 149 項保留，新增四項（scene 預算、light 預算、靜態快取失效／重用、水波與 resize）。
5. `node --check js/renderer.js`、`node --check tests/renderer.test.cjs`、`git diff --check` 通過。`round19-coverage.txt` 的六個可辨識正式模組仍為行 96.24%、分支 74.29%、函式 97.59%；renderer 經 VM 匿名載入不列入，因此不是全專案或本輪 renderer 的覆蓋百分比。
6. 新的真實 Chrome 效能分頁以本機原始碼與正式 renderer Git blob 對照，沒有安裝套件／修改 Chrome 設定或全域環境。Native 按鈕啟動使量測可核對焦點；讀取 document.hasFocus 的虛擬 DOM evaluate 不支援該方法，改由 fixture 將真值寫入可讀 DOM。
7. 瀏覽器等待 DONE 的 locator 超過工具內部 deadline；未原樣重試，繼續獨立檢查後從 DOM 讀取已完成結果。Chrome 圖形狀態頁 chrome://gpu 被瀏覽器工具 URL 安全政策拒絕，未繞過或改用其他自動入口；GPU backend 未核對。
8. `round19-browser-errors.json` 記錄最後取得的三筆「listener indicated an asynchronous response／message channel closed」錯誤。來源未確定；這批返回項目沒有「遊戲迴圈發生錯誤」，但不宣稱瀏覽器全程零錯誤，也不未經證據歸咎於任何擴充套件。
9. `round19-optimized-desktop.jpg` 是原生 Chrome 受控畫面，並非實玩完成／實體手機證據。沒有編修圖片或注入正式站。
10. 四個臨時入口／renderer 副本已移除；量測分頁已關閉，未設 viewport override。Node 伺服器 Ctrl+C 退出碼 1，另以 localhost:8793 ECONNREFUSED（退出碼 0）核對已停止。

仍需使用者以原 Chrome 視窗回測實際體感；GPU 狀態、長時間／大量敵人／手機效能尚未驗證。
