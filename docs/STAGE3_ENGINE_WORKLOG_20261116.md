# 第三關「妖櫻山道」本機工程交付（2026-11-16）

> **R3 新圖已完成**：神社重繪、四種獨立屋、六種裝飾、五怪物與三 Boss 候選（19 原稿／27 WebP），已接本機，34 項局部測試 PASS，待本人審核。詳見 [R3 素材交付](STAGE3_ART_BATCH_WORKLOG_20261116.md)。下方 R1／R2 的缺圖清單屬歷史狀態。

> **R2 場景修正已覆蓋下方 R1 的素材缺口與次要旗標描述**：使用者重新提供的新版泥地＋四張單列石路已接回，神社在 `s3play=1` 本機入口自動載入。48項聚焦測試通過，2D／2.5D真 renderer 靜態圖已檢視；四種獨立建物仍缺。詳見 [R2修正收據](STAGE3_SCENE_FIX_20261116.md)。下方為 R1 工程交付紀錄，不應再據此宣稱石路五圖仍缺檔。

| 狀態 | 本次範圍 |
| --- | --- |
| ENGINE_DONE | 接回既有主循環的本機工程基線：單列山道／配送／普通怪／四階段 Boss／共用技能／結算記錄與重玩；指必要接線及局部技術驗證完成，不代表整局通過 |
| ASSET_PENDING | 第三關專屬怪物、Boss、本體動作與 VFX、透明石階、場景變體、20 詞圖及 20 專屬錄音；3 張本機試圖仍未核准 |
| USER_PLAYTEST_PENDING | 自然配送、完整戰鬥、難度、畫面、觸控、真 iPad Safari、聽音與長局效能；未自動完整試玩、未做 FPS 宣稱 |
| BLOCKED | 正式素材切換／發布；LAN 服務被自動核准審查拒絕，尚未開放 iPad 區網入口 |

## 立即試玩

1. 桌機開啟 <http://127.0.0.1:8788/?dev=1&s3play=1&stage=sakura-pass&s3art=1&perf=1>。
2. 點上方「開發選關」，確認第三關，按「直接進關」。連結只預選，不會自行替玩家按開始。
3. 此入口使用 `yokai-delivery-dev-v1` 與開發言靈圖鑑，不覆寫原本正式進度。新的 DEV 存檔沒有第一關通關紀錄時，第七招仍維持原解鎖規則。
4. 視角用既有畫面按鈕切換；重新整理時附 `&tilt=1` 可用原 2D 開局。`?perf=1` 沿用既有診斷顯示。
5. 服務若已停止，在專案根目錄執行 `node tools/serve-tilt.cjs`，再開上述連結。預設僅綁 `127.0.0.1:8788`。本次未操作原 9455 服務。

建議這次本人先驗三件：縱向取送貨與左右山界、Boss 預警與封印問答、結算後重玩及切回前兩關。缺圖提示／暫借妖怪會常駐標示，不能據此驗收最終美術。

正常旅途地圖仍要求先通過第二關，且第三關工程版需本機 `s3play=1` 明確旗標；公開網域即使加旗標也不能進第三關。DEV 選關可繞過進度，但不能繞過本機／私有網段限制。候選圖另維持 `dev=1&s3art=1` 限制。

## A：世界與配送

1. `js/world.js`：可玩區固定 `900 <= x <= 1800`，沿 Y 無限串流；只在 `cx=1` 每塊一屋。其他列不生配送屋、燈籠或道具。一般維持 5 塊，配送中的起終點仍可 pin；回走由 seed 重建。
2. `WORLD.sakuraPathCenter(y, spacingScaleY)` 是房屋與未來石階貼花共用的蜿蜒中心線；2.5D 的 1.2 倍 Y 間距只作用於世界布局，切視角不重新移動物件。
3. 據點沿路兩側交錯；現行候選建物畫寬 210，底腳 `house.y+48`，實體寬 176、底緣 `house.y+45`。答題墊沿用共用世界座標且留在山界內。古櫻圖片以實際底邊落地，撤掉舊裁切 445/460 假設。
4. `js/game-delivery-rules.js`／`js/game.js`：取件優先距玩家 <=900，近屋都被預約時備援 <=1500；送達沿用既有 580–1250、必要時 420–1600 的距離池。使用普通配達事件、題目、學習與圖鑑邏輯，沒有另造第三關遊戲。
5. 10 分鐘、6 件目標、180/360/480/540 秒四次 Boss 排程沿用現有資料；加班繼續追擊／補配送，難度成長封頂於 600 秒。沒有新增自動強制通關或加班秒殺。

## B：普通怪、Boss 與技能

1. `js/config.js`：第三關 normal 候選基線 `hpScale=1.08`、其餘速度／時間／威力倍率 1、普通怪上限 80、包圍波量 .85、包圍節奏 1.1、XP 需求 1.05；既有第三關生成間隔倍率 1.1、射手機率 .08 不變。Hard 保留原 hard 曲線。目標為前兩關後可試的調整起點，不保證實戰等級／難度。
2. 第三關 normal 普通怪掉落 3 XP，Boss／誤配妖仍按既有獎勵；不改第二關 normal 的 1.05 XP 成本。普通怪、包圍及答錯伏擊共用生成上限；靈玉沿用 512 上限及遠距回收，不新增每幀圖像生成。
3. `js/assets.js` 的 Stage3 敵人槽仍暫借 `ghost/runner/tank/shooter/mis/boss` 與原 motion 圖，全部是 **TEMP_FALLBACK**。新生普通怪與 Boss 實體另附此狀態；UI 常駐告知暫借。第一／二關圖像未替換。
4. `js/boss-ai.js`：保留既有 slam／charge／ring 模板及四階段封印規則；第三關衝撞先用與移動相同的碰撞 callback 裁短預警，ring 缺口朝山道縱向，避免唯一缺口落在左右山界外。暫停／讀題凍結、Boss 死亡清 hazard 沿用共用流程。
5. 第三關沒有核准 Boss VFX，渲染器不借玩家招式圖或第一關 Boss VFX。只用既有 **TECH_SAFETY_ONLY** 範圍提示，明寫「特效待審」；這不是完稿。衝撞提示用真 `h.length` 與 `h.r`，ring 額外提示最終 400 半徑。
6. 六招／第一關通關解鎖墨跡、四槽、Lv1–5 自然覺醒、融合暫停都沿用。沒有實作第八、九招。

未核准的新招候選：古木根脈採鎖定落點、至少 1.1 秒提示、150 半徑單次命中與至少 1.35 秒恢復；花瓣封位可沿既有 ring 模板保留 90° 縱向缺口。這些名稱／獨立玩法及最終美術均待使用者決策，本次沒有新增正式招式。

## C：實際素材、尺寸與接線 Gate

逐號詞表、路徑、存在檢查、場景 SHA256：`docs/STAGE3_MEDIA_AUDIT_20261116.json`。所有現有 Stage3 圖片位元保持原樣，沒有生成、修改、複製或刪除影音檔。

| 檔案／角色 | 現況 | 接線 |
| --- | --- | --- |
| `assets/img/sakura-pass/ground_mountain_dirt.webp` | 512×512 RGB，無縫與亮度未核准 | DEV `dirt` 候選；全世界整數格貼圖，不以 chunk 邊界重置；圖本身週期接縫仍待人審 |
| `shrine_pavilion.webp` | 470×440 RGBA，alpha bbox (0,0,470,440) | DEV `pavilion`；完整圖等比例、世界畫寬 210；其他建物角色暫借同一張第三關候選，並非各有完稿 |
| `landmark_corrupted_sakura.webp` | 460×460 RGBA，alpha bbox (0,0,460,460) | DEV `ancientSakura`；世界畫寬 156，完整圖底邊對齊腳點 |
| `ground_sakura_steps.webp`、`ground_trans_dirt_to_steps_h.webp` | 512×512 RGB，非獨立透明石階 | 保留，**不接入**新石階路線 |
| `art/stage3-sakura-pass/scene/redraw_r1/g_dirt_01.png` | 原有待審來源 | 本輪未轉正、未載入 runtime |

`js/assets.js` 不再請求不存在的 `s3_*.webp`，第三關專屬槽也不再要求夜行町地板／地圖／神社；共用核心預載仍可能下載第一關資產，但不拿來畫第三關場景。候選只請求上述 3 張；缺角色保持空缺狀態，正式 resolver 仍 `BLOCKED`／`autoPass=false`。缺地板時只保留安全底色，左右深色遮罩只表示物理山界，不冒充山崖美術。

需要審核／製作的精確規格：

| 角色 | 輸入規格及裁切要求 | 現有 consumer |
| --- | --- | --- |
| 泥地母地 | 建議 1024×1024 RGB、四邊周期、純泥地少碎石，不含烤在圖中的道路 | `SAKURA_GROUND_ASSETS.dirt` |
| 6 石階變體 | 每張 512×512 RGBA、四邊真正透明、安全邊距 >=16px；直／左彎／右彎／破損／疏／混草；各張獨立石塊，不含矩形泥地底 | `stoneStraight/stoneLeft/stoneRight/stoneBroken/stoneSparse/stoneMixed`（目前 null） |
| 4 建物變體 | 建議 768×768 RGBA、完整屋簷、底腳置底中；可見內容留至少 16px 邊距。逐張記 alpha bbox，不能沿用別張裁切值；現行世界畫寬 210 | `teaHouse/mountainHouse/storehouse/worshipHall`（目前 null） |
| 5 場景道具 | 建議 512×512 RGBA，底中錨點、無白邊、無文字；世界寬 55/142/118/60/98 | `stoneLantern/torii/fence/marker/mossRocks`（目前 null） |
| 怪物／Boss | 獨立 Stage3 角色及動作 raster、同腳點與尺寸；manifest 記本體 bbox／腳點／動作幀。建議小怪 512×512、Boss 768×768 | `STAGE_ASSET_SLOTS['sakura-pass'].enemy`；目前共用圖 TEMP_FALLBACK |
| Boss 預警／命中 | slam 512×512、ring 1024×1024 透明俯視圖；charge 1024×256 RGBA，中心軸與有效長／寬明記，依 hazard 真尺寸縮放 | 共用 hazard 生命週期；核准前只安全提示 |
| 20 詞圖 | 256×256 RGBA、透明安全邊距 >=8px、單一實物無文字；櫻花／一般花、花盆／盆栽必須可辨 | 宅配 `01.webp`–`20.webp`；全部缺檔 |
| 20 語音 | 與詞表序號一致、單獨日語詞；聲線／來源／模型／授權及雜湊需記 manifest | 宅配 `01.mp3`–`20.mp3`；全部缺檔 |

新稿先放唯一 `art/stage3-sakura-pass/{scene,characters}/`，核准後才依 `ASSET_CONVENTIONS.md`／`ASSET_REGISTRY.json` 決定 canonical 路徑與唯一 alias，不另造散落路徑。上述為交接規格，沒有建立不存在的正式檔名假裝完成。

`js/delivery-icon-art.js`／`js/ui.js`：未核准第三關詞圖時顯示中文提示，不用 emoji 或把「花」借成「櫻花」。專屬音檔路由仍回 null，由現有音訊系統按單字使用其允許的錄音／`ja-JP` 瀏覽器 TTS 備援；沒有修改 Fish A、API key、BGM 或音訊程式。聲音需本人在裝置上確認。

## D：驗證、失敗與限制

1. **已靜態檢查**：11 個修改的 `js/*.js`、`tools/serve-tilt.cjs`、`tools/run-tests.cjs` 的 `node --check`；3 份本輪 JSON 解析；`git diff --check`。僅有既有 LF/CRLF 提示，沒有空白錯誤。
2. **已測試**：下列 15 檔共 **130 PASS / 0 FAIL**；`stage3-engine` 為 13 項非互動式技術測試，涵蓋開局、可達候選、四個 Boss 排程事件、界線、上限、單次配送／結算記錄、重玩、投影與候選渲染。不是自然跑關或真裝置驗收。輸出 `scratch/stage3-focused-20261116.log`。

```powershell
node --test --test-reporter=spec tests/stage3-engine-20261116.test.cjs tests/stage3-house-density-depth.test.cjs tests/content-world.test.cjs tests/game-delivery-rules-phase10-20261103.test.cjs tests/dev-stage-selector.test.cjs tests/overworld-eight-stage.test.cjs tests/viewport.test.cjs tests/v3-boss-ai.test.cjs tests/rain-port-boss-phase2-20261111.test.cjs tests/game-boss-delivery-phase41.test.cjs tests/game-ink-trail-20261110.test.cjs tests/b3-night-town-six-skills.test.cjs tests/balance-20261114.test.cjs tests/delivery-media-routes.test.cjs tests/s2-published-release.test.cjs
```

3. 交接列的 4 份舊第三關測試首輪 **6 PASS / 10 FAIL**（`scratch/stage3-legacy-20261116.log`）。其中現行 `stage3-house-density-depth` 的兩個舊「所有 X 列每塊都有屋」斷言已改驗真可玩單列／中心線／古櫻密度，該檔最終 **5 PASS**。沒有為測試恢復不正確的全平面生屋。
4. 其餘 3 份保留原測試 **3 PASS / 8 FAIL，exit 1**：不存在原稿 `G_mountain_dirt.webp`、缺 fetch 的舊 mock、舊 `sakuraTileRole`／三地板 X 軸切換介面、已不成立的刪檔與裁切斷言。沒有刪除、跳過或宣稱已綠。輸出 `scratch/stage3-legacy-remaining-20261116.log`，命令：

```powershell
node --test --test-reporter=spec tests/stage3-ground-transitions.test.cjs tests/stage3-shrine-buildings.test.cjs tests/sakura-terrain-plan.test.cjs
```

5. `python tools/asset_registry.py --check` 開工即 **exit 1**：既有 4 個 `assets/audio/sfx/enemies/ikari-umibozu/ikari-umibozu__{vortex-pillar,fan-warn,vortex-warn,fan-sweep}.mp3` 未登錄。這是本輪前已有的清冊缺口；本輪未改圖音檔，未重建清冊假裝全過。Stage3 五圖 SHA256 最後獨立核對未變，`js/words.js` 亦與開工雜湊相同。
6. HTTP：本機入口 **200**，48 個 script 與 3 張 Stage3 raster 共 **51 個資源 200**；文件／Git 路徑／未知 Host 為 403，POST 為 405。收據 `docs/STAGE3_HTTP_20261116.json`。無 Chrome／Playwright 自動玩家操作，沒有自動答題整局、20 趟配送、Boss 長流程或 FPS 推論。
7. HTTP 初查曾 `EACCES`（沙箱禁止 loopback）；沙箱外檢查可用。背景程序在受限程序查詢中不可見，後續唯讀 HTTP 再次實測 **200**，以前者猜測服務已死不可靠。LAN 綁 `0.0.0.0` 的動作被自動核准審查明確拒絕：認定區網曝露未獲授權；改用僅本機服務，未繞過審查或改防火牆。

## 本輪修改邊界

程式：`js/{world,dev-mode,assets,renderer,overworld,game-delivery-rules,config,boss-ai,delivery-icon-art,ui,game}.js`、`index.html`；工具 `tools/{serve-tilt,run-tests}.cjs`。測試：新 `stage3-engine-20261116`，局部更新 `stage3-house-density-depth`、`overworld-eight-stage` 及配送模組載入版號斷言。其餘既有 dirty 保留。

入口交接已更新 `docs/agent-handoff.md`、`roadmap.md`。開工雜湊在 `docs/STAGE3_BASELINE_20261116.json`。未 reset、clean、checkout、commit、push、deploy，未啟動其他 Agent，未付費生圖，未改影音檔或全域環境。
