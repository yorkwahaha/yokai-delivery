# 第三關房屋密度與 2.5D 景深（2026-10-14）

狀態：本機已改。只動妖櫻山道的房屋數量，以及山道 2.5D 的渲染層次。第一、二關與第四到八關的房屋配置沒改。地板轉角、已核准神社／古櫻圖、C1／C2 配送印記都沒重做。

未 Commit／未 Push／未 Deploy。

## 房屋

`js/world.js` 只在 `sakura-pass` 把每塊地從 3 間改成 1 間神樂殿。位置用原 seed 的 hash，落在區塊中段（局部 x 260–639、y 210–389），避免每間都卡在同一個角落，也避免鏡頭只掃到鄰塊邊緣就多看到一間。詞仍來自該塊原本的 word pack。房屋 id 是 `sakura-pass:cx,cy:0`。古櫻仍是每五塊一棵，沒有刪圖，也沒有加新圖。

9×9 區塊抽樣：山道 81 間，正好是原來 243 間的 1/3。夜行町、雨港、竹影迷宮、黃泉境抽樣仍是每塊 3 間。

同一局只切投影時，房屋 id 與座標不重建。Chrome 在 `?tilt=1` 進關後切到 0.6，載入的 25 個 id 前後相同。沒有用世界 spacing 來假裝房子變少。

起點可見神社（邏輯鏡頭，含一點邊緣）：

| 畫面 | 2D | 2.5D |
|---|---:|---:|
| 桌機 1280×800 | 1 | 2 |
| 平板模擬 1194×834 | 1 | 2 |

起點附近每隔一段取樣，2.5D 最多看到 3 間，沒有再出現 5–6 間。2D 與 2.5D 可見數不同，是投影高度不同，不是房屋被增刪。

配送：起點 2200 內有成對神社，距離落在 420–2000。Chrome 桌機這張單是 `かわ`，直線約 682。腳本走到距離 145（60 步 `update`）。平板另一次冷啟動是 `じかん`，約 816。不是自然十分鐘通關。

## 景深

只在山道、而且投影不是 2D 時加層次。近處縮放 100%、不模糊。往北連續收到約 88%（`?depth=enhanced` 約 85%），模糊最高約 2.6px（enhanced 3.2px）。招牌文字、題板、HUD、角色不套這層 filter。腳底仍對齊原來的接觸點，陰影不跟著縮小。

2D 維持原尺寸。其他關的房子仍走舊的 290px 以後才淡的算法。`?depth=off` 只在 loopback 把山道退回舊算法；公開網址帶這個參數不會改掉預設。

遠景視差用既有墨雲與薄霧：山道 2.5D 的雲跟鏡頭係數從 0.20 提到 0.42，遠霧透明度約 0.048，近霧約 0.02。沒有用幾何畫假山，也沒有每幀開大張離屏畫布。櫻花粒子的前後視差在山道 2.5D 乘上 1.75。

Chrome 在玩家以北 480 世界單位的探針：2D 縮放 1、模糊 0；2.5D 縮放 0.882、模糊 2.51px。`desktop-25d-north.png` 裡，畫面上方的神社比下方近處屋簷小、墨線也較軟。招牌「神社」仍可讀，古櫻沒有蓋住 HUD。

## 畫面與效能

截圖在 `artifacts/validation/stage3-density-depth-20261014/`：

- `desktop-2d.png`、`desktop-25d.png`、`desktop-25d-north.png`
- `tablet-2d.png`、`tablet-25d.png`

1194×834 是 Chrome 視窗模擬，不是真 iPad。

headless Chrome 把遊戲迴圈打開 1 秒，數到 **7 幀**。這是這次 headless 取樣，不能當成桌機或 iPad 的遊玩 FPS。景深沒有額外離屏模糊畫布。

音訊腳本換成 stub，mp3 讀取次數 0。這次沒有發出音檔請求，所以 HTTP 204 計數是 0。

## 測試

```text
node --test tests/stage3-house-density-depth.test.cjs tests/stage3-shrine-buildings.test.cjs tests/content-world.test.cjs tests/card-delivery-runtime.test.cjs
```

上述全過。`tests/stage3-shrine-buildings.test.cjs` 的每塊間數從 3 改成 1，對齊這次密度。C1／C2 runtime 15 項仍過。沒有跑 media-cache hash。

`node tools/stage3-density-depth-chrome.cjs` 通過。hook 只加在 HTTP 回應。

## 請人審，並建議 Space Bunny 小範圍看

- 2.5D 往北走時，遠神社是否夠「遠」、又還沒糊到墨線消失。若要再強，本機用 `?depth=enhanced`；若要對照舊版，用 `?depth=off`。
- 實際走兩三分鐘，畫面是否仍會同時出現 4 間以上。
- 古櫻和答題板的遮擋。這輪只保證樹沒有壓到房屋碰撞盒。

不要重跑地板轉角，也不要讀現役 MP3。
