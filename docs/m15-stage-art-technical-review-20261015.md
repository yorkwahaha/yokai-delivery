# M15-02 Stage 3／4 技術審查與 Stage 2 接線計劃

2026-10-15。Grok 隔離審查。只讀 `js/` 與現役 `assets/img` 檔頭。未開啟 `art/**`，未改 loader、測試或引用。Stage 2「石板→木棧道過渡 v2」的視覺為 USER_APPROVED，本文件不把它退回人審，也不把它寫成整關或部署核准。新 Stage 3／4 稿的藝術合格仍只由使用者決定。

證據分四級：

- **已證**：這次讀到的源碼或檔頭。
- **推論**：由已證行為推出、尚未用連續截圖看見的畫面結果。
- **待mapping**：要等 AGY 的路徑對照列才能指名的檔。
- **待人審**：像素風格、體積感、巨石／大葉是否成立。本票不代批。

## 1. 現役地表怎麼重複

呼叫點：`js/game.js:2722` `RENDERER.drawGround(..., STAGE_VISUAL.ground || "ground", STAGE.id)`。

`js/renderer.js:407-429` `tileImage`：

- 步進等於該圖的 `naturalWidth` × `naturalHeight`，原點在世界 (0, 0)。
- 相鄰磚共用整數像素邊，不重疊、不拉邊。
- `imageSmoothingEnabled = false`。
- 圖沒有 `naturalWidth` 就直接 return，不補幾何地板。

`SCENE_TILE = 512`（`js/renderer.js:58`）只服務 `groundAtlasFor`。`paintTerrainRegion`（`js/renderer.js:473-475`）寫明：1024 原稿仍會建 atlas，畫面上貼的是原圖，不抽 512 變體。這次量到的現役地面都是 512，那條 1024 分支不會走到。

`groundTileIndex`（`js/renderer.js:107-111`）全庫只被櫻樹尺寸使用（`js/renderer.js:360`，係數 0.92／1／1.08）。地面選圖不用它。

快取：`drawGroundBase`（`js/renderer.js:499-584`）在材質、關卡、可見 chunk 或鏡頭離開快取矩形時重繪，捲動時只補新條帶（562-574 行）。單張靜止圖可以落在已畫過的區域。

檔頭只讀前 40 或 256 byte，沒有解像素。2026-10-15 這次讀到的尺寸：

| 現役字串（`js/assets.js`，mapping 前的程式路徑，不是新 canonical） | 像素 | 格式 |
| --- | --- | --- |
| `assets/img/scenery/ground.webp`（`ground`，經 `SCENERY_ASSET_KEYS`） | 512×512 | VP8 |
| `assets/img/scenery/ground_dirt.webp` | 512×512 | VP8 |
| `assets/img/scenery/house_shop.webp` | 384×355 | VP8X |
| `assets/img/scenery/house_tavern.webp` | 384×385 | VP8X |
| `assets/img/scenery/house_shrine.webp` | 384×401 | VP8X |
| `assets/img/rain-port/ground_stone.webp` | 512×512 | VP8X |
| `assets/img/rain-port/ground_wood_dock.webp` | 512×512 | VP8X |
| `ground_stone_var1.webp`／`var2` | 512×512 | VP8 |
| `ground_wood_dock_var1.webp`／`var2` | 512×512 | VP8 |
| `ground_trans_stone_wood_h.webp`／`_v.webp` | 512×512 | VP8 |
| `assets/img/sakura-pass/ground_mountain_dirt.webp` | 512×512 | VP8 |
| `ground_trans_dirt_to_steps_h.webp` | 512×512 | VP8 |
| `ground_sakura_steps.webp` | 512×512 | VP8 |
| `shrine_pavilion.webp` | 470×440 | VP8X |
| `landmark_corrupted_sakura.webp` | 460×460 | VP8X |

`assets/img/ground.webp` 等根目錄同名檔這次是 ENOENT。載入走 `js/assets.js:88-89` 的 `assets/img/scenery/`。

這些尺寸是「程式字串今天指向的檔」。哪一張是使用者核准的 v2，等 mapping 列，不在這裡指名。

## 2. 關卡分支

`paintTerrainRegion`（`js/renderer.js:470-496`）先鋪 `ART[groundKey]`，再只加兩條：

- `stageId === "rain-port"`：石材 `portGroundPick("stone")`，奇數列岸帶再鋪木。
- `stageId === "sakura-pass"` 且 dirt、transH、steps 都有寬度：`sakuraTileRole(tx)`。

Stage 4–8 沒有自己的地形分支。`bamboo-maze` 的 visual 只有 `{ground:"ground", petals:6, fireflies:24}`（`js/words.js:668-671`）。`petals` 是共用粒子計數。

### 雨夜港布局需要哪些邊

Chunk 預設 900×600（`js/world.js:62-64`、`js/words.js` 各關 `chunkWidth/Height`）。`spacingScaleY()`（`js/viewport.js:104-108`）看的是**載入當下**的 tilt：初始就是 0.6 且沒有 `?spacing=1` 時高度 ×1.2（720）；`?tilt=1` 載入時高度維持 600。局中再切 tilt 不會改這個間距。

岸帶：`js/world.js:172` `shore: mod(cy, 2) === 1`。同一列的左右鄰居旗標相同，所以沒有東西向材質縫，也沒有角或斜向交點。

實際只有兩條水平縫（`js/renderer.js:456-490`）：

1. 奇數 chunk 內部。石畫到 `chunk.y + chunk.h - 256`，其下 256 世界像素夾木。北石、南木。
2. 該奇數 chunk 的底邊接下一列偶數 chunk。偶數 chunk 整塊是石。北木、南石。

出生點雨夜港 `{x:1350, y:900}`（`js/words.js:582`）。間距 1 時 chunk 高 600，y=900 在 cy=1（岸塊）石側，內縫 y=944，底邊 y=1200。間距 1.2 時 chunk 高 720，仍是 cy=1，內縫 y=1184，底邊 y=1440。

`portGroundPick`（`js/renderer.js:445-454`）木只用 `woodVar1`，否則 `dock`；石只用 `stoneVar1`，否則 `stone`。`var2`、`transH`、`transV` 會被 `refreshPortArt` 載入（`js/assets.js:332-393`），畫家不讀。快取戳記也只含 stone／dock／stoneVar1／woodVar1（`js/renderer.js:517-521`）。註解 `js/renderer.js:431` 已寫交界圖未接入。

縫的 Y 不在 512 格上。間距 1 時內縫 944 mod 512 = 432；間距 1.2 時 1184 mod 512 = 160。過渡條要錨在縫的 Y，X 仍可沿世界 512 格走，才跟石／木磚的橫向接縫對齊。

岸高 256 是寫死的世界像素（`js/renderer.js:457`）。現役木圖高剛好 512，畫面是 512 磚被矩形裁進這 256 帶，不是把圖縮成 256。

### 櫻山道的 512 重複

`sakuraTileRole`（`js/renderer.js:433-438`）：`tx < 3` 土、`tx === 3` 橫向過渡、其餘石階。`tx` 是 `tileImage` 的欄索引，步進是圖寬。三張現役圖都是 512，所以 tx 3 是世界 X 1536–2048，跨過 chunk 邊界 1800。註解 `js/renderer.js:432` 與這次檔頭一致。圖寬若以後改掉，這條欄界會跟著移，`SAKURA_SEAM_TX` 要重對。

同一角色的每一格貼同一張圖。`tx` 小於 3 的每一格都貼同一張土，圖寬 512 時就是世界 X 小於 1536，週期 512。`tx` 大於 3 的每一格都貼同一張石階。畫家沒有第二張變體可選。

直向櫻過渡未進表（`js/assets.js:396-402`）。現役三張是 dirt、transH、steps。神樂殿 `shrine_pavilion.webp`，古櫻 `landmark_corrupted_sakura.webp`（`js/assets.js:423-426`）。進關才載（`refreshSakuraArt`／`refreshSakuraScene`）。

## 3. 2.5D、比例、排序、遮擋

鏡頭：`js/viewport.js:81-86` 以 (450, 300) 為錨，Y 乘 tilt。`setTiltScale` 只接受 1 與 0.6（39、45 行）。瀏覽器無 query 時初始 0.6（24-29 行）；沒有 `location.search` 的測試環境初始 1。

直立：`js/viewport.js:135-139`。tilt 為 1 時不變換；否則繞腳點 `scale(1, 1/k)`，把地面的 Y 壓扁抵消，立繪保持站直。

景深：`sceneryDepth`（`js/renderer.js:143-157`）**scale 永遠是 1**。遠屋不會被程式縮小。山道且 tilt ≤ 0.97 且 depth 不是 `off` 時只加模糊（`sakuraDepthOn`，133-137 行）。`?depth=enhanced` 只加長模糊距離。櫻的世界 zoom 只在 sakura-pass、localhost、query 為 1／1.1／1.15，且 tilt 不是 1 時生效（`js/viewport.js:63-79`）。

房屋繪製寬是常數，高度跟圖的寬高比（`js/renderer.js:686-691`）：

| 物件 | 繪製寬 | 這次圖檔 | 腳 |
| --- | --- | --- | --- |
| 町屋店 | 166 | 384×355 | 圖底對 `h.y+48` |
| 食堂 | 175 | 384×385 | 同上 |
| 第一關神社屋 | 158 | 384×401 | 同上 |
| 港倉／魚舖 | 187／201 | 本票未量這兩張 | 同上 |
| 神樂殿 | 210 | 470×440 | `(h.y+48) - bh*(430/440)`（`js/renderer.js:653-657`） |
| 古櫻 | 156 | 460×460 | `tree.y - dh*(445/460)`（`js/renderer.js:373-384`） |
| 港道具 | 倉／魚 210、船 118、其餘 70 | 未量 | 圖底對 `p.y`（605-607 行） |

430/440 與神樂殿檔高 440 一致，445/460 與古櫻檔高 460 一致。換一張不同高度的圖仍沿用這兩個分數，腳會浮起或陷入。玩家立繪高 114 是 `js/renderer.js:686` 的註解，本票沒有量玩家圖檔。

排序：`js/game.js:2987-3005` 以腳底 Y 排序，北側先畫。房屋排序點 `h.y+48`，直立軸是 `h.y+46`（3011 行）。差 2 像素。遮擋規則是腳更南的角色蓋住腳更北的屋頂。

接觸影是程式橢圓，畫在直立之前，所以會跟地面一起被 tilt 壓扁（`js/renderer.js:613-623`）。房屋橢圓在 `h.y+46`，半徑 58×14。港道具在圖缺失時仍先畫橢圓（590-601 行）。房屋本體缺圖時 `drawHouse` 的 else 是空的（699-700 行，註解「缺料不畫幾何房子」）；神樂殿缺圖只留「載入中／失敗」文字（664-666 行）。

快取補繪前有一次未設定 `fillStyle` 的 `fillRect`（`js/renderer.js:564`）。圖蓋滿之後看不見；地面若有透明洞，底下是 canvas 預設填色。

## 4. 圖片原因與程式原因

**已證的程式比例：** 現役屋與殿都被縮小到上表的寬，不是被放大。遠近不改 scale。地面重複週期等於圖檔的 512。櫻的土／階各用一張圖鋪滿該角色的所有格子。雨夜港交界圖雖在目錄裡，畫家沒有把它貼到兩條縫上，縫是硬裁。

**推論：** 一張正面、沒有側牆與屋簷厚度的神社圖，經過 `upright` 之後仍是那張平面圖。體積要畫在圖裡。`upright` 與腳錨只負責讓它站在被壓扁的地面上。神樂殿若看起來比町屋寬，程式側的差是 210 對 166，約四分之一，不是庭院級放大。2 像素的排序／直立差，在 0.6 與 1 兩種 tilt 下都不像會單獨變成「巨石」或「貼地失敗」。

**待人審（使用者已拒的候選，本票不重判、不刪現役）：** Stage 3 只拒巨石庭院加神社的候選構圖、貼花與預覽。拒收理由按 03:26 指示記為：石相對角色／屋過大、神社沒有體積、地表規則重複。現役神樂殿、古櫻、三張地面不刪、不改、不標成拒稿。Stage 4 拒黑暗竹泥、與角色同高的巨葉、以及那張組合預覽。其餘怪母版維持未判定，不標拒收，也不標核准。

**已證這些拒稿不在現役畫家裡：** `js/` 的地形分支沒有巨石 decal，也沒有竹葉 decal。Stage 4 畫的是共用 `ground` 512 磚加粒子計數。巨石與巨葉是候選圖的內容，不是 166／210 這些常數算出來的。

新稿進 runtime 之前的素材門（不是藝術批准）：

- Stage 3 新神社：自訂腳列，並寫進接線票；繪製寬落在現役 158–210 這段，整張圖共用一個寬。石、人、屋要在同一張圖裡就已經是可並立的尺寸。有側牆或屋簷厚度。透明區在腳列之上，腳列以下不要留一截會被當成地面的不透明邊。
- Stage 3 新地表：邊對邊可接。畫面路徑沒有 120px 羽化；羽化只在未貼上畫面的 atlas。一張 512 不能靠現行程式變成不規則重複。要不圖本身看不出週期，要不先有兩張以上使用者收過的變體，再另票用世界座標選圖。在變體存在之前不加選圖器。
- Stage 4 新地面：明亮、小葉只作稀疏點綴、半水墨半浮世繪木版。未收人審前不接 `bamboo-maze`。怪母版不跟這張地面稿綁在一起判定。

## 5. 視口與驗收限制

以後任何接線或新稿的技術驗收只看這些，不代替藝術批准：

- 兩次載入。預設頁：tilt 0.6、chunk 高 720。`?tilt=1`：tilt 1、chunk 高 600。局中切換不能同時覆蓋兩種間距。
- 連續移動，讓快取條帶重畫過縫。一張靜止截圖不夠。
- 最近鄰。縫的取樣行要對齊整數世界像素，避免在 512 格之間閃。
- 腳點同時是排序鍵。新圖更換腳列比例時，排序點與 `drawImage` 的底要一起改。
- 地面圖給 `tileImage` 的範圍不透明、滿寬滿高。建築圖在腳以上透明。
- 接觸影維持現有橢圓。缺圖時不新增矩形、木板線或色塊房子。
- Stage 1 的 `ground_dirt`、三間町屋寬、Stage 3 的三張地面、神樂殿、古櫻路徑都留在原分支。雨夜港改動包在 `stageId === "rain-port"` 裡。

## 6. Stage 2 接線計劃（本票不實作）

目標：把已核准的石→木 v2 貼到第 1 節的兩條水平縫。等 mapping 列指出那張圖的路徑與雜湊之後才改程式。本計劃不猜新路徑，也不把現役 `ground_trans_stone_wood_h.webp` 當成已證明的 v2；它只是今天目錄裡一張 512×512、尚未被畫家讀取的檔。

要接的：

- 縫 A，北石南木，Y = `chunk.y + chunk.h - 256`，只在 `decor.port.shore` 的 chunk。
- 縫 B，北木南石，Y = 下一條 chunk 邊界。用同一張圖做垂直翻轉。翻轉後木紋若不再是那張核准圖的樣子，停下來，只再要一張反向橫條。

不要接的：

- 垂直縫、角、斜向。現在世界沒有東西向換材質。`transV` 與兩張 `var2` 繼續不畫，直到布局真的出現直縫。
- 不要把 512 過渡圖整張拿去取代石磚或木磚。只裁貼縫所在的那一條。裁哪幾列要看 mapping 之後那張核准圖的內容，本票不猜列號。帶高可以仍是 256 世界像素，或改成核准圖上混合帶的高度，兩者都必須裁在縫上，不能改岸帶的碰撞。
- X 方向沿世界 512 格重複，Y 錨在縫，不錨在磚原點。取樣 1 圖像像素對 1 世界像素，最近鄰，與現役 `tileImage` 相同。
- 圖缺失或 `naturalWidth` 為 0：跳過這次貼圖，留下現在的硬裁。不畫假木板、假石縫。

驗收截圖（接線票做，本票沒做）：

- 預設載入，從 (1350, 900) 往南連續經過 y=1184 與 y=1440。
- `?tilt=1` 載入，同一出生點往南經過 y=944 與 y=1200。
- Stage 1 仍是 `ground_dirt` 與三間町屋；Stage 3 仍是三張櫻地面、神樂殿、古櫻。這是隔離證據。整關藝術與部署門另計。

建議的下一張實作票只動雨夜港縫的貼圖與 mapping 列指定的那一個載入鍵。不動 `js/words.js`、不動 Stage 1／3 素材鍵、不動音訊。

## 7. 分級摘要

| 結論 | 級別 |
| --- | --- |
| 畫面重複週期 = 圖的 naturalWidth；現役地面檔頭皆 512 | 已證 |
| 1024 atlas 不是現在畫面上的取樣 | 已證 |
| 櫻土／階各一張圖；`groundTileIndex` 不選地面 | 已證 |
| 雨夜港只有兩條水平縫；無垂直、角、斜向 | 已證 |
| trans／var2 有載入、未繪製 | 已證 |
| 房屋與神樂殿是常數寬縮小，景深 scale 恆為 1 | 已證 |
| 神樂殿 430/440、古櫻 445/460 對得上這兩張檔的高度 | 已證 |
| 平面圖直立後仍平面；2px 腳差不會變成巨石 | 推論 |
| 巨石庭院、無體積神社、規則重複地表的觀感 | 待人審（候選已拒；現役三地面／神樂殿／古櫻不在拒收範圍） |
| 竹泥、角色高的葉、組合預覽 | 待人審（候選已拒） |
| 其他怪母版 | 未判定 |
| 核准 v2 的檔名、雜湊、混合帶列號 | 待mapping |
| Stage 2 v2 這張圖的視覺 | USER_APPROVED，不再待人審 |
| 整關視覺、部署 | 未核准 |

## 8. 下一張可派的 coding 票

mapping 列被 root 收下之前，沒有可以改 code 的票。列收下後可原樣派工，不必再做一輪設計：

**票名：** Stage 2 石→木 v2 水平縫接線。

**閘門：** M15-01 mapping 裡標成 USER_APPROVED stone→wood v2 的那一列（路徑 + 雜湊）。對不上就停，不猜路徑。

**範圍：** `js/renderer.js` 雨夜港縫的貼圖，以及該列指定的載入鍵。缺圖不畫。縫 A 用原圖，縫 B 用垂直翻轉。不接垂直／角／斜向，不把整張 512 當地板。截圖用第 6 節的兩次載入與連續移動。Stage 1／3 的素材鍵與三張櫻地面、神樂殿、古櫻保持原樣。

**不做：** 藝術批准、部署、Stage 3／4 新稿、詞表、音訊、怪母版。
