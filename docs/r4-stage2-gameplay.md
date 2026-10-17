# 第二關 rain-port 可玩核查（2026-10-13）

Grok Build 本輪只查玩法、故事與解鎖。沒有改 `js/boss-ai.js`、`js/story-dialogue.js`、`js/store.js` 的行為。沒有改 `tests/`、素材、`art/r4/`。未 Commit、未 Push、未 Deploy。

**R4 不可勾完成。** 等 OpenCode 覆核 `tests/r4-rain-port.acceptance.cjs` 之後才能寫完成。混合青石主街＋局部木碼頭是【可逆試玩候選】，不是使用者美術定案。

行號以本輪讀到的工作樹為準。Cursor 若同時在改 `js/game.js`、`js/assets.js`，以函式名稱對照。

## 總判

| 項目 | 判定 | 證據 |
|---|---|---|
| 第一關通關才解鎖第二關 | 程式已接上 | `STORE.finish('night-town', …, true)` 經 `NEXT_STAGE` 打開 `rain-port`；失敗結算不打開。畸形存檔 `'yes'` 不打開 |
| 旅路進入第二關 | 程式已接上 | 節點 `unlockAfter:"night-town"`、`enterable:true`。未通關第一關時 `isEnterable` 為假 |
| 通關第二關解鎖第三關、重開仍留在第二關 | 程式已接上 | 勝利才 `completeStage('rain-port')`，只多打開 `sakura-pass`，不打開 `bamboo-maze`。重新開始呼叫 `start()`，預設關卡是目前的 `STAGE.id` |
| 27 詞、發音檔、答案詞條 | 詞條與 MP3 對照已齊 | 6 包 27 詞不重複。`WORD_FILES` 27/27，`assets/audio/words/*.mp3` 27/27 存在。`audio-events` 的 rain-port 錄音對照通過。本輪沒有真機聽音 |
| 6 次配送、600 秒、敵潮 | 契約已在 `words.js`，戰鬥迴圈讀 pacing | `goalDeliveries: 6`、`runSeconds: 600`、`bossTimes: [180,360,480,540]`、`surgeFirst: 90`、`surgeInterval: 80`、`spawnIntervalScale: 1.15` |
| 特別怪 | 沿用全遊戲生成，港町射手 6% | 90 秒後有機率 runner、160 秒後 shooter、200 秒後 tank。`shooterChance: 0.06`。沒有另做港町專屬小怪種類 |
| 港町 Boss 潮汐 | 已接上，且只在終王 | `nextAttackKind`：`stageId === 'rain-port'` 且終王才把 `tide` 放進招式池。半血前 slam／charge／tide，半血後再加 ring。門番只 slam，中王只 slam／charge。第一關終王沒有 tide。`tests/v3-boss-ai.test.cjs` 這次全過 |
| 對話 | 開場、配送、首領名、破關文案已接上 | `STORY.get('rain-port')`：開場、`bossTitle` 港霧大妖、`bossIntro`、`clear` 指向山道。`story.hint` 有寫潮汐提示，但 `drawTitleCard` 不讀它 |
| 破封與 Boss 音樂 | 與第一關同一套，沒有港町專屬曲 | 只有終王答對破盾才呼叫 `AUDIO.startBossMusic()`。曲目仍是全域 `BOSS_BGM` |
| 平板與手把 | 未測 | 直向會 `suspend()`，手把輪詢在直向戰鬥中直接返回。沒有 iPad 或 Xbox 實測。不得寫成通過 |
| 港町地面與建築圖 | 候選未定案，木碼頭 WebP 沒被載入配對 | 見下方。OC 的 B1、B2、C1–C6、E2 這次失敗 |

## 可玩步驟（程式路徑，不是真機通關）

1. 新檔只開放 `night-town`。`finish('night-town', 分數, 配送數, false)` 不打開 `rain-port`。
2. `finish('night-town', …, true)` 寫入通關，並打開 `rain-port`。此時 `sakura-pass` 仍關。
3. 旅路節點在第一關已通關且 `implemented === true` 時可進入。路徑是 gate → night-town → cross-west → rain-port。
4. `start('rain-port')` 讀 600 秒、6 次配送、Boss 180／360／480／540 秒、90 秒起每 80 秒一波敵潮。進關會呼叫 `refreshPortArt()`。
5. 詞池是天候 6、方位 6、港口交通 3、海邊 3、空間 6、渡口交通 3。配送與首領破盾都用這個池的 `jp`。發音先播對應 MP3，解碼失敗才改 `ja-JP`。
6. 終王死亡且已送達 6 件才進勝利演出。演出結束狀態變成 `won`，下一幀 `STORE.finish(STAGE.id, …, true)` 才存檔並打開 `sakura-pass`。失敗或油盡不開下一關。
7. 結算的重新開始走 `start()`，留在剛剛那一關。

本輪用獨立 `localStorage` 跑過上述 1、2、6。重載後 `sakura-pass` 仍開、`bamboo-maze` 仍關、`rain-port` 通關次數為 1。既有 `tests/progression.test.cjs`、`tests/overworld.test.cjs`、`tests/content-world.test.cjs`、`tests/v3-boss-ai.test.cjs`、`tests/audio-events.test.cjs` 在同一次指令裡都通過。這不是 10 分鐘自然遊玩，也不是平板操作證明。

## 27 詞

| 包 | 區塊主題 | 詞 |
|---|---|---|
| rain-weather | water | あめ 雨、かぜ 風、くも 雲、きり 霧、かみなり 雷、ゆき 雪 |
| port-directions | wood_pier | みぎ 右邊、ひだり 左邊、まえ 前面、うしろ 後面、きた 北方、みなみ 南方 |
| port | wood_pier | くるま 汽車、ふね 船、ひこうき 飛機 |
| beach | water | さかな 魚、うみ 海、たこ 章魚 |
| port-spatial | wood_pier | うえ 上面、した 下面、なか 裡面、そと 外面、ちかく 附近、とおく 遠處 |
| port-transit | stone | でんしゃ 電車、じてんしゃ 自行車、えきいん 站員 |

`js/audio.js` 的 `speak()` 用 `WORD_FILES` 找 `assets/audio/words/<檔名>.mp3`。上表 27 個鍵都有檔，且檔案大小都大於 32 bytes。本輪沒有播放，也沒有核對聽感。

## Boss、對話、音樂

- 潮汐鎖的是出手當下的玩家位置與朝向。預告 1.1 秒，之後 1 秒內波前從 -280 走到 280。安全帶 `safeOffset` 在 +100 與 -100 之間交替，`safeWidth` 130。人在波前 60 單位內、又不在安全帶，扣 18，只扣一次。繪製用同一組 `safeOffset`／`progress`（`drawBossHazard`）。
- 這組招式沒有缺第二關終王的 tide，也沒有把 tide 漏到第一關。中王與門番維持原招，是既有契約，不是漏做。本輪不為了「看起來更完整」加招或改傷害。
- 四隻港町首領共用稱號「港霧大妖」。`game.js` 只讀 `story.bossTitle` 一個欄位，與第一關「大妖鬼」的做法相同。不另加一個沒人讀的中王稱號。
- `story.hint`（「留意潮汐亮帶…」）沒有被 `UI.drawTitleCard` 讀取。開場白、配送浮字、終王登場句、破關句有在用。提示沒顯示不阻擋通關。
- 破封音效是 `AUDIO.breakShield()`。換曲只有 `answerBoss` 在 `bs.final` 時呼叫 `startBossMusic()`。沒有雨夜港町自己的 BGM 或解鎖音。這是全域設計，本輪不改 `js/audio.js`。

## 地表：可逆試玩候選，不是定案

使用者沒有選定純青石或純木碼頭。`docs/r4-asset-manifest.md` 與 `art/r4/README.md` 寫的混合方案只是可逆試玩候選。

目前實際畫面上的分工：

- `words.js` 的 `rain-port.visual.ground` 仍是 `"ground"`。第一關是 `"ground_dirt"`。底圖先鋪共用石紋。
- `renderer.js` 的 `paintTerrainRegion` 只在 `stageId === "rain-port"` 且 `PORT_ART.stone` 已載入時，才把青石圖鋪到 chunk。有岸線的 chunk 底部 92px 留給 `paintPortShore`。
- `paintPortShore` 有 `PORT_ART.dock` 才鋪木碼頭圖；沒有就畫棕色橫條。
- `world.js` 只在 rain-port 加岸線與道具，不改夜行町碰撞。`game.js` 會畫這些道具。圖沒載入時，`drawPortProp` 用色塊。

磁碟上 `assets/img/rain-port/` 有 9 個 WebP，尺寸非零，OC 的 E1 通過。進關時 `start()` 會呼叫 `refreshPortArt()`。`loadPortArt()` 去抓 `docs/r4-asset-manifest.md`，再用檔名前面 96 個字元猜角色。本輪用同一段規則對這份 Markdown 試配，結果只有四張對上：

| 角色 | 實際配到的檔 | 沒配上的 |
|---|---|---|
| stone | `ground_stone.webp` | |
| warehouse | `port_warehouse.webp` | |
| mooring | `prop_mooring_post.webp` | |
| boat | `prop_port_boat.webp` | |
| dock | 沒有 | `ground_wood_dock.webp` 被前一行的「青石」猜成 stone，因 stone 已佔用而跳過 |
| beacon | 沒有 | `prop_port_lighthouse.webp` 被前一行的「倉庫」猜成 warehouse 而跳過 |
| crate | 沒有 | `prop_cargo_crates.webp` 被前一行的「繫船」猜成 mooring 而跳過 |

所以玩家進關後，主街有機會換上青石 WebP，木碼頭 WebP 不會出現，燈台與貨箱仍是色塊。這還不是「混合青石主街＋局部木碼頭」的候選圖本身。候選可以整段撤回，不代表使用者已選定這套美術。`prop_anchor_gear.webp` 與 `vfx_rain_splash_ripple.webp` 沒有對應角色，載入器會略過。

## 給 Cursor 的具體缺口（Grok 不能寫這些檔）

1. `js/assets.js` `portRole`／`loadPortArt`（約 318–363 行）。不要用前一段說明文字猜角色。改成檔名對角色的固定表，至少含：`stone=ground_stone.webp`、`dock=ground_wood_dock.webp`、`warehouse=port_warehouse.webp`、`mooring=prop_mooring_post.webp`、`beacon=prop_port_lighthouse.webp`、`crate=prop_cargo_crates.webp`、`boat=prop_port_boat.webp`。路徑維持 `assets/img/rain-port/`。不要改第一關 `ground_dirt` 或町屋。這仍是可逆候選，不要在註解或 roadmap 寫成使用者定案。
2. `js/words.js` `rain-port.visual.ground`（約 591 行）仍是 `"ground"`。OC B1 因此失敗。若要過 B1，只能改第二關自己的鍵，並讓 `loadGameArt()` 的請求名單出現 `ground_stone` 或 `ground_wood_dock`。不要把 `ART.ground` 換成港町圖。B2 現在只檢查 `loadGameArt()` 同步建立的 `Image.src`，而港町圖是進關後 `refreshPortArt()` 才抓，所以 B2 仍失敗。E2 要程式原文含 9 個檔名主檔名；動態抓 Markdown 不算。
3. `js/game.js` `drawStageWeather`（約 2332–2410 行）。海霧呼叫 `createRadialGradient` 後直接 `addColorStop`。OC 探針沒有這個方法，回傳值是空的，C1–C6 全部在約 2405 行中止。瀏覽器有這個 API，正式遊玩不一定會炸；仍應在沒有漸層時跳過霧層，避免中斷整段雨。雨分支沒有漣漪。`vfx_rain_splash_ripple.webp` 未被引用，C4 即使探針補上漸層也會失敗。漣漪只加在 `STAGE.id === "rain-port"`。2350 行附近要留著第一條舊斜率，註解寫明既有雨向測試靠它。不要改 2375 行 else 裡第一關／其他關的雨，也不要改油耗、生成或 Boss 數值。
4. `js/ui.js` `drawTitleCard`（約 3044 行）不讀 `story.hint`。若要顯示潮汐提示，只在標題卡加一行即可。不阻擋可玩。

## 這次測試

指令：

`node --test --test-reporter=spec tests/r4-rain-port.acceptance.cjs tests/progression.test.cjs tests/v3-boss-ai.test.cjs tests/content-world.test.cjs tests/overworld.test.cjs tests/audio-events.test.cjs`

結果：87 項、通過 78、失敗 9、略過 0、退出碼 1。9 項全是 R4 驗收：B1、B2、C1、C2、C3、C4、C5、C6、E2。A1–A6、B3、E1、E3、F1 通過。另外用 `I:\WinTemp\r4-rain-port-check.cjs` 核對 27 詞檔案與存檔解鎖，19 項斷言全過；該腳本不在專案裡，用完即刪。

## 尚未驗證

- 沒有從主選單實際打完第二關，沒有看結算畫面，沒有聽 27 詞。
- 沒有 iPad、手機或 Xbox 手把。直向暫停與手把震動沿用既有路徑，R2／R3 仍是真機未測。
- 雨的隨機性與三景深沒有測完，因為探針先在霧層漸層中止。
- 混合地面候選沒有在瀏覽器裡截圖確認。即使修了載入配對，仍要等 OC 覆核，不能寫成完成。
