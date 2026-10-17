# 妖櫻山道地面 v2 契約

狀態：**ALGORITHM_READY_PENDING_ART_APPROVAL**。這不是第三關完成，也還沒接到正式畫面。

現役可玩規則不變，仍在 `js/renderer.js`：`tx < 3` 土路、`tx = 3` 一欄水平過渡、`tx >= 4` 石階。本輪沒有改 renderer、assets、game、index、service-worker，也沒有改 `assets/` 或 AGY 的圖。

Terrain V2 候選目錄 art/stage3-sakura-pass/candidates/terrain-v2/ 已由 AGY 交付六款真圖 PNG/WebP：兩種地板各一款變體，以及反向水平、雙向垂直、外凸 NW 轉角，另有拼排圖與 manifest。所有新圖仍 NEEDS_USER_VISUAL_APPROVAL，尚未進正式runtime。完整自由曲線區域仍缺凹角與鞍形轉接圖，不能隨機混貼。降低 512px 方格線是否合格需使用者目視。

## 算法

世界座標除以 512 取 `floor`，負座標同樣。種子固定為 587。函式只吃磚欄 `tx, ty`，不吃相機、chunk 或傾斜，所以 2D 與 2.5D 只要傳世界座標就會選到同一張。

先把地圖切成邊長 6 磚的粗格。粗格再用上一層 2×2 決定偏土或偏石，格內不會一磚一磚亂跳。四座固定山門／神社（含負座標與較大的正 X）周圍提高石階機率，但不是 `X >= 2048` 以東全部變石階。

石階磚若有一面或相鄰兩面貼著土，改要過渡圖。土磚只在相鄰兩面都是石階時要凹角圖。直邊的過渡畫在石階那一側，土磚維持土路，避免同一條縫畫兩次。缺圖時 `status` 是 `MISSING_REQUIRED_ART`，`assetId` 為空，不准改畫成另一種主材質。

同一主材質只在目錄列出的同一族變體裡用磚欄雜湊挑選。不能把不在族內的圖混進去。變體必須是手繪檔，接線時用 SHA-256 對檔，不在這個模組裡改像素。

128×128、原點 `(-40,-40)` 的取樣約土 56%、石 30%、過渡 14%，設計目標是 60／25／15。測試接受土 50–68%、石 20–36%、過渡 10–20%。左右相鄰同材質約 93%，沒有四面皆異的碎磚。

## 給 AGY 的圖

已有、且只核准了現役這三張：

| 角色 | 檔 | 狀態 |
| --- | --- | --- |
| 土路族 | `ground_mountain_dirt.webp` | 已核准。若要減重複，可再交一張四邊與它同一族的變體 |
| 石階族 | `ground_sakura_steps.webp` | 已核准，但 R9 看到 512 方格線。新變體必須與它同一族，邊緣不要另加一圈苔線 |
| `h-dirt-west` | `ground_trans_dirt_to_steps_h.webp` | 已核准。左土右石 |

還不能當正式圖的：先前那張垂直預覽是旋轉圖，接縫約 35，維持 BLOCKED，不要把它當成 `v-dirt-north`。

尚缺，缺一張就不能把該遮罩標成 PASS：

| id | 種類 | 西 | 東 | 北 | 南 |
| --- | --- | --- | --- | --- | --- |
| `h-dirt-east` | 水平，石在左、土在右 | 石 | 土 | 石 | 石 |
| `v-dirt-north` | 垂直，上土下石 | 石 | 石 | 土 | 石 |
| `v-dirt-south` | 垂直，上石下土 | 石 | 石 | 石 | 土 |
| `corner-steps-nw` | 石階凸角 | 土 | 石 | 土 | 石 |
| `corner-steps-ne` | 石階凸角 | 石 | 土 | 土 | 石 |
| `corner-steps-sw` | 石階凸角 | 土 | 石 | 石 | 土 |
| `corner-steps-se` | 石階凸角 | 石 | 土 | 石 | 土 |
| `corner-dirt-nw` | 土路凹角 | 石 | 土 | 石 | 土 |
| `corner-dirt-ne` | 土路凹角 | 土 | 石 | 石 | 土 |
| `corner-dirt-sw` | 土路凹角 | 石 | 土 | 土 | 石 |
| `corner-dirt-se` | 土路凹角 | 土 | 石 | 土 | 石 |

每張都要 512×512、手繪、對得上表裡那一側的主材質。不要交程式噪點、模糊或旋轉冒充。

## 測試

`node --test tests/sakura-terrain-plan.test.cjs`

模組：`js/sakura-terrain-plan.js`。

## 下一步

AGY 把上表缺圖交到 `terrain-v2/`，使用者看過之後，才另開一輪把 `planTile` 接到 sakura-pass。在那之前正式畫面繼續用現在的三張與 `tx` 規則。

未 commit、未 push、未 deploy。
