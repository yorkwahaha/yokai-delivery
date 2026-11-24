# iPad Safari 效能優化

## 2026-11-24｜實機驗收結案（USER_PLAYTEST_PASS）

- 使用者以 iPad Air M4 Safari 完整通關雨夜港町，肉眼最低約 46–47 FPS、後期平均 51 FPS 以上、512 顆靈玉約 54–55 FPS；整局無背景閃爍或消失，完整解析度、雨勢、技能特效正常。本人確認可以進入下一步。
- 前一對話對 `yokai-port-performance 5.json` 的分析摘要（本輪未重新取得原始 JSON）：約 14:20 通關、有效遊玩快照平均約 55.6 FPS、約 96.8% 達 45 FPS、最低短窗約 41.07 FPS、context loss 0。重疊快照平均不是逐幀全局平均，不據此宣稱 1% low 或每個短窗都達 45。
- 驗收設定：uiShadows=cached、gemBatch=ordered、resolution=1；fxBatch、terrainCache、lighting、damageText、sanctuaryPulse=original；rainBatch=false、bossRaster=false，雨勢／空中粒子／靈陣等保持正常。背景消失的精確根因未證實；目前實機穩定性獲驗收。
- 停止主要效能工程，保留候選開關、原生 Canvas 2D、512 顆靈玉上限及原美術。以下為驗收前歷史量測與步驟；不等同待驗收狀態。實機通過不代表已部署。

以下為 2026-11-24 驗收前的歷史工程記錄。本機工作樹基準 `704cf72` 加上本輪開始前既有的未提交變更。Windows 受控測試使用 Chrome 158、1194×834 CSS pixels、DPR 2、觸控和前景定格。實機驗收條件為 iPad Air M4 Safari 在 100% 畫質的長局中維持至少 45 FPS、理想 60 FPS，且背景持續可見。當時狀態為 `USER_PLAYTEST_PENDING`，最新結論以頂端驗收為準。

## Neon 交叉核實

| 優先度與問題 | 核實結果 |
| --- | --- |
| P0 空中粒子和混色 | iPad 第 763 秒同場 A → P → A → P 為 35.6–37.8 → 55.2–58.1 FPS。P 隔離空中貼圖，這是目前最強的實機因果證據。繪圖迴圈原已避開連續相同混色，本輪將混色寫入移到 alpha／大小判斷之後。普通透明覆蓋與加法混色相遇時不可交換，保留原順序。Neon 的混色切換峰值屬其桌面樣本。 |
| P0 小 Canvas 路徑 | 上游 WebKit 的 `128 × 129` 門檻是 `USE(SKIA)` 預設，其他組態的預設為 0；實機 Safari 的圖形後端、IOSurface 分配及 Canvas／Image／Bitmap 傳輸成本仍待驗證。 [WebKit Settings.yaml](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/page/Settings.yaml) |
| P0 HUD 模糊和媒體查詢 | 查到被動格、技能扇、御守、委託、Boss 血條與暴雨字樣會在每幀重畫時用陰影。HUD 及天氣動態偏好原先能重複查詢，已快取並以設定變更事件同步。Neon 的 50 次陰影和 17 次查詢取決於其 HUD 內容。 |
| P0 影像和地形 | PORT_ART 的三個接縫別名、S2 正式地磚與部分 Boss 別名會建立重複 Image。地形 2.5D 的 backing 確實按未壓扁的世界高度配置。移動可觸發同畫布 self-blit；其內部暫存配置及長局影像消失原因尚待 iPad 證據。 |
| P1 靈玉 | 512 顆觸控圖磚路徑有 1,024 次貼圖。原 2.5D 路徑的陰影已可直貼，本體仍有 upright 和內層 Canvas 狀態堆疊。保留數量、順序、透明度和位移，移除逐顆狀態堆疊。 |
| P1 雨、光罩、靈陣、Boss | 雨絲逐筆描線、雨港無路燈卻仍合成一張全視口光罩、Lv5 持續地陣與短脈衝同時覆蓋，以及水柱雙重不透明化、海嘯即時遮罩均經程式確認。矩形提交面積只描述取樣與覆蓋，無法量出實際填充或 GPU 時間。 |
| P1 G 75% | 舊 iPad 測試曾從 32–33 降至 19–20 FPS。現版同尺寸重設防護仍在，新增獨立 `low / medium / high` 基準取樣比較。部分本來就要求高品質的角色貼圖仍自行指定 `high`。造成舊結果的取樣、合成、排程條件尚未釐清。 |

rAF 的 `outsideCallbackMs` 包含刷新等待、排程與可能的 raster、合成或其他工作。RGBA 估算以引用到的載入圖片物件及 Canvas 像素數乘以四計算。Safari 內部副本、共享解碼、實際駐留和記憶體上限均未量出。Neon 的 350–400 MiB 與收益預估屬假設。

## 實作與回退

| 階段 | 修改位置及目前路徑 | 獨立回退 |
| --- | --- | --- |
| 0 診斷 | `js/port-performance.js`、`js/game.js`、`index.html`。面板可獨立切 HUD 陰影、光照、傷害數字、粒子 backing、取樣品質、靈玉、地形、雨絲、Boss、靈陣；另可重畫地面。切換時重置當前幀樣本，JSON 含設定、長窗歷史、Canvas loss／重畫和來源資料。 | 每欄選回原路徑或預設；不帶 `perf=1` 可隱藏整個診斷面板。 |
| 1 HUD | `js/ui.js`、`js/game.js`、`js/fx.js`。被動亮格依尺寸／縮放快取模糊，保留呼吸亮度。技能扇、御守、委託和 Boss 血條仍保留原繪法和隔離開關。移除滿視口 Canvas 外側 CSS 陰影。 | HUD「原路徑」恢復原亮格，`off` 隔離 HUD 模糊。CSS 可單獨恢復 `box-shadow`。 |
| 1 粒子 | `js/fx.js`。512×512 圖集最多兩頁，冷啟動可直接在共享畫布烘焙。可切 Canvas、PNG 解碼的 HTMLImageElement、ImageBitmap。轉換期間及失敗保留可繪 backing，圖集滿了走舊來源。場上混色順序與空中／地面層皆保留。 | 粒子「原路徑」沿用上一輪雨港 bitmap 候選及 Canvas fallback。P 只供診斷空中粒子。 |
| 2 圖片 | `js/assets.js`。以完整請求 URL 共用選定的場景圖，包含版本字串。僅在確定是同一核准雨港路徑時，讓 S2 manifest loader 採用與 PORT_ART 一致的既有版本字串，保留舊 WebP／PNG 逐一備援及候選 gate。進關釋放旅路大圖，遊戲完成載入後釋放封面，回首頁或旅路按需重載。 | 可分別回退三個 loader 接線與 `loadMapArt`／`loadGameArt` 生命週期。 |
| 2 地形 | `js/renderer.js`。保留同一張快取。候選在穩定 2.5D 按投影高度配置，移動重畫候選停用 self-blit，另可直接繪地面作對照。修正地磚、接縫的獨立 X/Y 換算。已知 context loss 直繪完整地面，帶上限的退避持續重試，回頁和主 Canvas 恢復時會失效重畫，離開場景時縮小不再使用的 backing。 | 地形「原路徑」恢復原解析度與 scroll copy。手動重畫可在不重開關下驗證快取假設。 |
| 3 靈玉和配置 | `js/renderer.js`、`js/game.js`。觸控靈玉用同序的兩次貼圖和直接投影，保留 512 顆、可視裁切及透明度。畫面角色列表重用陣列並保留深度排序同分順序，傷害數字原地收攏，房屋 QA 對照只在抽樣時保留最多 256 筆。 | Gem Batch「原路徑」。角色列表、數字更新和 QA 對照可各自回退。 |
| 3 雨絲和光照 | `js/game-weather.js`、`js/renderer.js`。雨絲依原顏色及粗細合成 path，不合併個別水花。雨港直接徑向遮罩保留燈油、黎明、橢圓校正和暖光。第一、三關維持多光源路徑。 | 雨絲、光照各選原路徑。 |
| 3 技能、Boss、傷害字 | `js/game.js`、`js/skillfx.js`、`js/renderer.js`。靈陣可比較單圖脈衝。Boss 有預亮潮扇／預警漣漪、預疊水柱本體與穩定海嘯遮罩。傷害字圖集最多 96 個槽，顏色、字型及大小分開，文字狀態或過寬數字維持原繪。這些路徑預設沿用原畫。 | 靈陣、Boss、傷害字可各自切回原路徑。海嘯演出及警告邊界未動及碰撞邏輯。 |

未採用全域兩趟混色重排、降低靈玉上限、地形大邊距／雙緩衝、逐幀 GPU 回讀和資產降尺寸。預烘焙尚未涵蓋 HUD 其餘陰影、提燈及雷達。仍保留水擊陰影與非冰靈針濾鏡。地形靜默丟失在沒有標準訊號時仍需要實機重現，現有恢復路徑未證明能攔截所有閃爍。

## Windows 受控量測

雨港第 819 秒、20 敵、380 顆粒子、512 顆靈玉、Lv5 靈陣、45 個傷害數字及被動欄。各條件先取約 4.2 秒未包裝指令的 rAF 資料，再短抽樣 Canvas 指令。下表的 callback 是 JS 回呼牆鐘時間。

| 單項對照 | 原路徑 | 候選 |
| --- | ---: | ---: |
| HUD 每幀帶模糊的 API 次數 | 31 | 11 |
| HUD 單獨切換 callback P50 | 4.1 ms | 4.0 ms |
| 靈玉每幀 save／restore | 各 1,024 | 各 0 |
| 靈玉每幀貼圖 | 1,024 | 1,024 |
| 靈玉單獨切換 callback P50／P95 | 4.1／4.5 ms | 3.1／3.4 ms |
| HUD 與靈玉皆使用新路徑的 callback P50／P95 | 4.1／4.5 ms | 3.0／3.2 ms |
| 2.5D 地形 backing | 5,383,278 px | 3,230,840 px（−40%，RGBA 約省 8.21 MiB） |
| 前景雨及水花 stroke／幀 | 52.5–53 | 7.5 |
| 雨港主畫布的光罩貼圖／幀 | 1 | 0 |
| 傷害描邊字／幀 | 45 | 7（另有 38 筆圖集貼圖） |
| 粒子 backing callback P50 | 約 3.0 ms | Canvas 3.1、Image 3.0、Bitmap 3.0 ms |

各組定格 rAF 約 58.3–60 FPS，未得到可轉換成 iPad FPS 的收益。投影與移動重畫候選在此固定鏡頭都使用 3,230,840 像素。單元測試已確認移動重畫模式在位移後無 self-blit。長時間自然移動下兩者的重畫成本及畫質仍待裝置對照。

同一影像統計範圍（ART、PORT_ART、S2 manifest；按物件 identity 去重），本輪開始的雨港場景有 96 個物件、55,183,590 像素，本輪 88 個物件、36,374,286 像素，RGBA 推估差約 71.75 MiB。附近幀的資源暖機節奏可能不同。新報表擴充影像範圍後同時記錄 118 個角色引用、96 個獨立物件、43,005,350 像素，額外納入 Boss 和雨港敵人。這些數據只計已就緒且被指定容器持有的物件。

### 像素差異

三關各做 2D／2.5D 同幀比較。下表的「顯著」統計任一 RGB 通道差大於 8／255 的像素，樣本每幀約 207 萬像素。使用固定晚期 HUD、相同粒子順序、傷害字及雨港技能時鐘。

| 候選 | 結果與保留的風險 |
| --- | --- |
| 保序靈玉 | 三關最大通道差 1／255。 |
| HUD 快取 | 單通道最大差 63／255，局部集中在被動亮格，最重樣本約 0.093% 畫面顯著。仍可切回原陰影。 |
| Canvas／ImageBitmap 圖集 | 三關最大通道差 8／255。HTMLImageElement 最大 111／255，雨港有約 0.8% 像素超過門檻，維持對照候選。 |
| 投影地形 | 2D 地形比對一致。2.5D 修正地磚及接縫座標後仍有取樣差，三關約 5.6–15.5% 畫面顯著，維持原路徑。 |
| 雨絲與光罩 | 雨絲保留筆畫位置，半透明線相交處有差異，雨港少於 0.02% 顯著。直接光罩最大差 2／255。 |
| 傷害字、單層靈陣 | 傷害字的字形邊緣與縮放有明顯差異。單層脈衝在雨港多達約 26% 畫面顯著。兩者維持原路徑。 |
| Boss | 六個受控畫面涵蓋 2D／2.5D 的潮扇預警、水柱、海嘯。海嘯相同，潮扇最大差 1／255，水柱在 2.5D 局部最大差 193／255；候選不預設啟用。 |

### 回歸與入口

- 聚焦 Node 測試 156 通過、0 失敗。包含地形 loss、退避重試、投影高度／位移重畫、場景圖別名與旅路重載、冷啟動粒子共用／回退、雨港 Boss、診斷及 DEV 存檔。
- `npm test` 共 1,205 項，1,196 通過、8 失敗、1 TODO，退出碼 1。失敗均為先前雨港效能紀錄已知的 `tests/v3-core.test.cjs` 八項，位置在 47、62、77、111、173、184、196、279 行。未改寫這些斷言。
- 三關新矩陣 60 組畫面比較，另有 6 組雨港 Boss 比較。既有 `--verify-pixels` 和 `--verify-particle-pixels` 皆通過，最大單色差分別為 3 和 2／255。
- Playwright 預設 Chromium 執行檔缺失，使用本機 Chrome 158 續做。Modern Web Guidance 的 npm 離線快取缺件，瀏覽器 API 以 HTML Standard、CSSOM View 和 WebKit 原始碼交叉查核。 [HTML Canvas](https://html.spec.whatwg.org/multipage/canvas.html) [CSSOM View MediaQueryList](https://drafts.csswg.org/cssom-view/#the-mediaquerylist-interface)
- 8002 已有預覽程序，保留原服務。從同一台 Windows 以 Chromium 打開指定 LAN URL，確認首頁有開發選關、可直接進雨港、21／21 必要資源就緒、程式使用 `yokai-delivery-dev-v1`。乾淨瀏覽器資料中未寫正式 key，實際下載並解析 `yokai-port-performance.json`。首次以程式直接觸發按鈕的檢查逾時，改以面板實際操作通過。
- 本輪為短窗與受控截幀，尚未重做新路徑的 20 分鐘桌面連續壓測，也尚未有 iPad Safari 的長局、背景閃爍重現或裝置恢復資料。畫質風險較高的路徑仍可單項切回。未提交、推送或部署。

## 桌面重現與實機步驟

1. Windows 執行 `node tools/measure-port-performance.cjs --verify-phase-pixels --stage=rain-port`。將關卡改成 `night-town` 及 `sakura-pass` 做第一至三關的 2D／2.5D 對照。工具只在測試截幀時回讀像素。
2. 效能對照執行 `node tools/measure-port-performance.cjs --brief --heavy-air OLD HUD GEMS E512 TERRAIN REPAINT RAIN LIGHT DAMAGE FX-canvas FX-image FX-bitmap`。沒有 Playwright 自帶 Chromium 時，以 `YOKAI_BENCH_CHROME` 指定已安裝的 Chrome。
3. 實機橫放、Safari 保持前景，開啟指定區網入口並按「開發選關 → 雨夜港町」。H、100%、抽樣關閉、候選維持預設，遊玩到第 12–16 分鐘並記錄裝置、iPadOS 版本及省電設定。 [iPad 測試入口](http://192.168.50.107:8002/?dev=1&s3play=1&perf=1)
4. 在掉到 45 FPS 以下時，先切 A 固定畫面。每次只換一欄，建議先測「粒子原路徑 → Bitmap 圖集 → 原路徑」和「HUD 快取 → 隔離 → 快取」，各留約 20 秒。取樣關閉做時間比較，另開短窗記指令數。正式驗收保留所有特效。若背景消失，先記時並匯出，再按「重畫地面」，記下有無立即恢復。若可重現，再比較地形原路徑和移動重畫。
5. 回 H 以完整畫面驗收至少 45 FPS、理想 60 FPS，並觀察跨頁回前景與第二次進關。匯出 JSON。只有在同畫質的 Canvas 2D 最佳組合仍低於目標、粒子隔離仍有明顯收益時，再討論局部 WebGL 2 Sprite Batcher。
