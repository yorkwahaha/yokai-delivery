# 夜行典籍與本局構築美術重製

2026-11-26 · 本機候選 · `USER_PLAYTEST_PENDING`

## V2｜首頁修復、典籍細修、操作與自定義

PC 和 iPad 可由首頁直接進入「操作與自定義」，暫停中的「夜行設定」也有同一入口。典籍 DEV 選 A 可看封印條目，選 D 可看後期技能及四張實際變異圖。 [PC 遊戲](http://127.0.0.1:8012/) · [PC 典籍 DEV](http://127.0.0.1:8012/?dev=1&stageLab=1&compendiumReview=1&compendiumTab=cards&fixture=D) · [iPad 遊戲](http://192.168.50.107:8013/?dev=1&s3play=1) · [iPad 典籍 DEV](http://192.168.50.107:8013/?dev=1&s3play=1&stageLab=1&compendiumReview=1&compendiumTab=cards&fixture=D)

### 首頁封面回歸

Chrome 實際點「卡片一覽」進出後，畫面回到 `menu`，但 `ART.cover` 已從存在變為空，繪製封面的採樣停在 14 次。首頁的主視覺與題字共用該封面，粒子、字幕與按鈕另外畫，因此仍留在畫面。原因在 `runFrame` 的選景分支直接讀取 `state`。典籍的 `codex` 被送進關卡分支，`releaseRunCover()` 接著刪除封面參照。關閉典籍只切回原狀態。 [重現畫面](../scratch/ui-compendium-v2/home-red-return.jpg) · [重現數據](../scratch/ui-compendium-v2/home-red.json)

`runFrame` 讓繪圖與音樂同讀典籍開啟前的狀態。首頁與旅路地圖在各自的繪圖分支，進入實際關卡仍照既有規則釋放封面，結算回首頁仍用原本的 `loadCoverArt()`。Chrome 完成三條指定路徑，再交替往返十次，每次保留相同封面物件，額外封面請求 0。另從實際結算返回首頁再進出典籍，確認封面、字幕、粒子與按鈕。從暫停切換典籍與控制分頁時，夜行町同一首 BGM 的播放時間持續前進。 [修正位置](../js/game.js#L8326) · [瀏覽器結果](../scratch/ui-compendium-v2/browser-v2.json)

### 典籍和設定

[七張實拍總覽](../scratch/ui-compendium-v2/v2-overview.jpg) · [首頁修復前後](../scratch/ui-compendium-v2/home-comparison.jpg)

| 頁面 | V2 變更 | 實拍 |
| --- | --- | --- |
| 秘術卡片 | 右側文字放大 18%。1080p 的變異插畫框約 108×163 CSS px，寬度約為 V1 的 1.9 倍。桌面及 iPad 寬版固定四張一排，短視口可捲動 2×2。長效果文字獨立捲動，關閉詳情保留卡片焦點。 | [1080p](../scratch/ui-compendium-v2/1080p-variants.jpg) · [iPad 觸控模擬](../scratch/ui-compendium-v2/ipad-air-11-variants.jpg) · [短視口](../scratch/ui-compendium-v2/short-variants.jpg) |
| 封印條目 | 匿名索引、共用卡背與實際解鎖條件。隱藏日文別名、種類、效果、成長、卡圖及該招變異。受控 DEV 內依真正通關 API 解鎖後，名稱、五級成長與四張變異都恢復。 | [封印卡背](../scratch/ui-compendium-v2/1080p-sealed.jpg) |
| 單字圖鑑 | 題籤改用既有手繪紙面中央的肌理，搭配細墨線與短朱印。日文、假名、中文置中，進度留在右下，兩行及三行使用同高題籤。教材維持原字形。 | [收藏格](../scratch/ui-compendium-v2/1080p-words.jpg) · [二／三行長詞](../scratch/ui-compendium-v2/long-words.jpg) |
| 返回首頁 | 封面及其中的主題字持續繪製，保留原首頁資產管理。 | [正常首頁](../scratch/ui-compendium-v2/home-fixed.jpg) |
| 鍵盤設定 | 九項綁定、左右手預設、固定快捷鍵及恢復預設按鍵。等待輸入時隔離選單操作，支援取消與衝突回饋。每次有效改綁照舊即時存檔。 | [鍵盤頁](../scratch/ui-compendium-v2/1080p-settings-keys.jpg) · [改綁提示](../scratch/ui-compendium-v2/settings-binding.jpg) |
| 滑鼠與觸控 | 場地拖曳、右鍵或按鈕衝刺、取貨和震動設定。 | [滑鼠與觸控頁](../scratch/ui-compendium-v2/1080p-settings-pointer.jpg) |
| 手把設定說明 | 依遊戲、選單、答題與修行分區。設定分頁和按鈕沿用典籍的方向焦點，支援十字鍵、左搖桿、A／B、LB／RB。兩頁的震動選項同步。 | [手把頁](../scratch/ui-compendium-v2/1080p-settings-pad.jpg) · [手把焦點](../scratch/ui-compendium-v2/settings-gamepad-focus.jpg) |

沿用既有 raster 卡框、御守、衝刺紋章、貨箱與手繪和紙，新增素材檔 0。140 詞的 229 個日文字元及 205 個中文字元已檢查。日文字型子集缺七字，Chrome 在停用遠端 Google 字型 CSS 的情境以本機 Noto Sans JP 正確取字。205 個中文字符均可由既有嵌入的 `Yokai Cargo TC` 備援。 [字形清冊](../scratch/ui-compendium-v2/font-coverage.json) · [Chrome 字形來源](../scratch/ui-compendium-v2/jp-fallback-chrome.json)

### V2 驗證

- 已靜態檢查 JS 語法、差異及素材清冊。聚焦測試 97 通過。現行完整回歸 1,302 通過、0 失敗、1 個既有雨港美術 TODO。 [聚焦結果](../scratch/ui-compendium-v2/focused.log) · [完整回歸](../scratch/ui-compendium-v2/regression.log)
- 舊 Boss 斷言要求已移除的 inline filter 寫法。更新斷言前先用生產渲染分支確認實際傳入兩條合法血條，排除死亡、瀕死、分身、召喚及非正式波次目標，再點擊只命中雙血條版型的答案卡並成功破封。舊斷言改驗繪圖和命中共用 `isBossBarVisible`，保留答題版型檢查。 [行為測試](../tests/core-stateful-contracts-audit-20261126.test.cjs) · [源碼斷言](../tests/playtest-followup-20261102.test.cjs)
- Chrome 158 於 1920×1080、2560×1440、3840×2160、iPad Air 11 吋 1180×820 DPR 2、844×390 驗證。正常測程 0 Console error、0 頁面例外、0 資產 404。也驗證構築 A–E、教材語音請求、翻頁及插畫缺檔備援。 [V2 報告](../scratch/ui-compendium-v2/browser-v2.json) · [可重跑腳本](../tools/verify-ui-compendium-v2-browser.cjs)
- 實體 iPad Safari、實體手把、字級與美術待玩家確認。長秘術在右欄捲動，短視口的設定保持固定頁腳。狀態為本機候選，未提交、推送或部署。

## V1｜設計與首次接線紀錄

## 集中驗收

| 用途 | 入口 |
| --- | --- |
| 三頁與 A–E 構築情境 | [本機 DEV](http://127.0.0.1:8012/?dev=1&stageLab=1&compendiumReview=1) |
| iPad 同區網 DEV | [同區網入口](http://192.168.50.107:8013/?dev=1&s3play=1&stageLab=1&compendiumReview=1) |
| 一般遊戲入口 | [遊戲](http://127.0.0.1:8012/)，首頁可開秘術或單字圖鑑。進關後開暫停選單，按「本局構築」。 |

方向鍵、已綁定的移動鍵、手把十字鍵與左搖桿移動焦點。Tab／Shift+Tab、LB／RB 切頁。Enter、手把 A 或觸控確認。Esc／B 先關詳情，再回原選單。單字可用底部按鈕或 Page Up／Down 翻頁，按已收藏卡可聽讀音。

DEV 開局、四招修行、四招滿級、後期技能、被動與御守使用共用介面。樣本只做記憶體投影，由現行技能與變異資料驗算。正式進度與收藏存檔的同源哨兵均保留原值。

## 1. 美術基準及設計

基準為現行暫停和系統選單的朱漆金框、結算頁的和紙及升級三選一的描金直卡。先比較典籍書衣、掛軸、配送木箱與結陣四種構圖，採用典籍書衣。三頁共用深墨背景、朱漆選中書籤、頁腳返回基準及金色焦點框。和紙集中在秘術正文與單字題籤。主卡沿用 2:3 原框，名字寫入留白區。紙頁邊框採九宮格，插畫保留比例。資料密度依頁面區分。 [設計取捨](../scratch/ui-compendium-20261126/design.md) · [升級、暫停、設定、結算參考](../scratch/ui-compendium-20261126/reference-art.jpg)

| 頁面 | 改造前 | Phase A 原型 | Phase C 實際遊戲 |
| --- | --- | --- | --- |
| 秘術卡片 | [舊索引](../scratch/ui-compendium-20261126/before-cards.jpg) | [原型](../scratch/ui-compendium-20261126/design-cards.jpg) | [起始妖刀](../scratch/ui-compendium-20261126/normal-starter-cards.jpg) · [封印釘成長與變異](../scratch/ui-compendium-20261126/1080p-cards.jpg) |
| 單字圖鑑 | [未收藏舊版](../scratch/ui-compendium-20261126/before-words.jpg) | [原型](../scratch/ui-compendium-20261126/design-words.jpg) | [未收藏對照](../scratch/ui-compendium-20261126/normal-locked-words.jpg) · [已收藏與封印混合](../scratch/ui-compendium-20261126/1080p-words.jpg) |
| 本局構築 | 無，對照[舊暫停選單](../scratch/ui-compendium-20261126/before-pause.jpg) | [原型](../scratch/ui-compendium-20261126/design-build.jpg) | [暫停入口](../scratch/ui-compendium-20261126/after-pause.jpg) · [一般開局的實際資料](../scratch/ui-compendium-20261126/normal-pause-build.jpg) |

原型比對後，主卡名稱移入題籤，日文讀音改用日文字型鏈。短視口將兩排變異內容與候選入口壓進同一張構築版面，保留四招與 44 CSS px 操作高度。秘術成長可在紙面內捲動，短視口的被動和御守在構築格下方。王漢宗顏楷體沿用既有本機子集，依序回退標楷體系、既有嵌入楷體與一般字型。教材的日文拼寫維持原資料。

[新舊同條件對照](../scratch/ui-compendium-20261126/before-after.jpg) · [設計稿與實際介面對照](../scratch/ui-compendium-20261126/design-vs-runtime.jpg)

## 2. 畫面與輸入證據

| Chrome 視口 | 秘術卡片 | 單字圖鑑 | 本局構築 |
| --- | --- | --- | --- |
| 1920×1080 | [畫面](../scratch/ui-compendium-20261126/1080p-cards.jpg) | [畫面](../scratch/ui-compendium-20261126/1080p-words.jpg) | [畫面](../scratch/ui-compendium-20261126/1080p-build.jpg) |
| 2560×1440 | [畫面](../scratch/ui-compendium-20261126/1440p-cards.jpg) | [畫面](../scratch/ui-compendium-20261126/1440p-words.jpg) | [畫面](../scratch/ui-compendium-20261126/1440p-build.jpg) |
| 3840×2160 | [畫面](../scratch/ui-compendium-20261126/2160p-cards.jpg) | [畫面](../scratch/ui-compendium-20261126/2160p-words.jpg) | [畫面](../scratch/ui-compendium-20261126/2160p-build.jpg) |
| iPad Air 11 吋橫向 1180×820、DPR 2，Chrome 觸控模擬／私有網路 | [畫面](../scratch/ui-compendium-20261126/ipad-air-11-cards.jpg) | [畫面](../scratch/ui-compendium-20261126/ipad-air-11-words.jpg) | [畫面](../scratch/ui-compendium-20261126/ipad-air-11-build.jpg) |
| 較矮橫向 844×390，Chrome 觸控模擬 | [畫面](../scratch/ui-compendium-20261126/short-cards.jpg) | [畫面](../scratch/ui-compendium-20261126/short-words.jpg) | [後期技能](../scratch/ui-compendium-20261126/short-build.jpg) · [被動御守密集資料](../scratch/ui-compendium-20261126/short-build-E.jpg) |

| 構築資料 | 畫面 |
| --- | --- |
| A 開局，Lv1 妖刀、三個空技能欄、零變異 | [截圖](../scratch/ui-compendium-20261126/build-A.jpg) |
| B 四種等級，部分技能持有一個變異 | [截圖](../scratch/ui-compendium-20261126/build-B.jpg) |
| C 四招滿級，含已滿的兩槽組合 | [截圖](../scratch/ui-compendium-20261126/build-C.jpg) |
| D 紫藤毒香、封印釘、式神 | [截圖](../scratch/ui-compendium-20261126/build-D.jpg) |
| E 九種被動及三枚御守 | [截圖](../scratch/ui-compendium-20261126/build-E.jpg) · [長文字御守詳情](../scratch/ui-compendium-20261126/build-long-detail.jpg) |
| 鍵盤與標準 Gamepad API 模擬 | [鍵盤焦點](../scratch/ui-compendium-20261126/keyboard-focus.jpg) · [手把焦點](../scratch/ui-compendium-20261126/gamepad-focus.jpg) |

## 3. 實作及資產

| 範圍 | 接線 |
| --- | --- |
| 共用典籍 | 遊戲以原有 Canvas 狀態機進出典籍。內頁採原生對話框，延續遊戲控制綁定和手把輪詢。實際焦點矩形決定方向移動，詳情關閉回原控制項。 [介面](../js/ui-compendium.js) · [版面](../js/ui-compendium.css) · [遊戲接線](../js/game.js) |
| 秘術資料 | 沿用現行目錄與五類索引。Lv1–Lv5 共用升級說明，變異詳情使用現行正式資料。後期技能資格讀取存檔解鎖規則，實驗室合武保留既有條目與標示。 [目錄](../js/ui.js) · [解鎖規則](../js/store.js) |
| 收藏資料 | 沿用配送印記四枚解鎖，關卡和詞包可交集篩選。原文與假名相同時只顯示一次。每頁只建立可見且收藏完成的圖片，鎖定卡保留進度但不請求插畫。語音沿用既有教材音訊與備援。 [收藏投影](../js/card-gallery-model.js) · [圖音路徑](../js/delivery-media.js) |
| 構築資料 | 讀取本局技能、等級、已選變異、被動層數、裝備御守。可選變異由共用資格函式逐項判斷。空欄、滿級與變異容量使用既有規則求值。 [共用規則](../js/game-build-rules.js) · [顯示投影](../js/ui-compendium-model.js) · [DEV 樣本](../js/ui-compendium-review.js) |
| 本輪新增美術資產 | **0 檔**。沿用升級同款卡框、主動與變異中心圖、手繪和紙、朱漆題籤、B13 被動、B11 御守及現行教材。式神雙狼主卡與後期關卡教材沿用既有 DEV 候選及各自門禁。索引縮圖在進入視野時載入。 [升級素材路徑](../js/ui-upgrade-trial.js) · [和紙及題籤引用](../js/ui-compendium.css) |

## 4. 技術驗收

| 層級 | 證據 |
| --- | --- |
| 已修改 | 三頁接到一般遊戲和 DEV。暫停面板增加「本局構築」，保留兩個圖鑑入口。 |
| 已靜態檢查 | JS 語法、Git 差異、資產清冊通過。清冊 1,360 檔、151 個 alias／copy。 |
| 已測試，聚焦 | 109 項通過。另重跑 B15 正式圖路徑及典籍新測試，9 項通過。包含 A–E 每張變異的真實可取得性及精確槽位對映。 [聚焦結果](../scratch/ui-compendium-20261126/focused.log) |
| 已測試，現行完整回歸 | 改造前 1,295 通過、1 失敗、1 TODO。改造後 1,299 通過、1 失敗、1 TODO。既有 Boss 點擊測試仍要求舊 inline filter，實際程式的點擊與顯示都使用同一個 `isBossBarVisible`。斷言維持原樣。 [改造前](../scratch/ui-compendium-20261126/baseline.tap) · [改造後](../scratch/ui-compendium-20261126/regression.log) · [既有失敗斷言](../tests/playtest-followup-20261102.test.cjs#L36) |
| 已測試，瀏覽器 | 5 種視口均截取三頁，檢查頁腳、橫向溢出、圖片自然尺寸和焦點。短視口量測確認第二排主動技能完整落在內容區。一般路徑驗證暫停→構築→回暫停→遊戲。正常測程頁面例外、Console error、HTTP 4xx/5xx 均為 0。 [瀏覽器報告](../scratch/ui-compendium-20261126/browser.json) · [可重跑腳本](../tools/verify-ui-compendium-browser.cjs) |
| 已測試，圖音 | 140 圖及 140 音檔路徑各自查到本機檔案。語音卡觸發一支夜行町 MP3 的 Web Audio 播放。人為讓一支單字插畫回應 404 時，保留 4/4、語音入口及翻頁。切換三頁期間夜行町同一支 BGM 未暫停，播放秒數持續前進。 [圖音測點](../scratch/ui-compendium-20261126/browser.json) |
| 發布 | 本機候選。未提交、推送、部署。 |
| 待人工驗收 | 在 iPad Safari 實機觀察字形、觸控捲動和語音。用實體手把檢查焦點步進及返回。玩家核准整體美術及字級。 |

執行 `node tools/verify-ui-compendium-browser.cjs` 可重跑瀏覽器驗證。預設本機埠 8012，可用 `YOKAI_COMPENDIUM_ORIGIN`、`YOKAI_COMPENDIUM_LAN` 指定已啟動的預覽服務。

## 5. 品質自評

| 項目 | 分數／100 | 依據 |
| --- | --- | --- |
| 美術一致性 | 92 | 朱漆書籤、正統卡框及一套安全邊距在三頁一致。 [三頁對照](../scratch/ui-compendium-20261126/after-overview.jpg) |
| 視覺完成度 | 89 | 主卡名稱落在題籤內，單字實物比例與暗色陳列一致。被動密集資料的籤條較細。 [封印釘](../scratch/ui-compendium-20261126/1080p-cards.jpg) · [密集構築](../scratch/ui-compendium-20261126/build-E.jpg) |
| 版面可讀性 | 88 | 五級及覺醒獨立標行，單字資訊有固定進度位。矮視口仍需捲動才能讀完秘術長文。 [短視口秘術](../scratch/ui-compendium-20261126/short-cards.jpg) |
| 資訊層級 | 92 | 單字插畫、日文詞和讀音分級。構築的等級、已取得變異和空槽可並讀。 [收藏格](../scratch/ui-compendium-20261126/1080p-words.jpg) · [後期構築](../scratch/ui-compendium-20261126/build-D.jpg) |
| 本局構築實用性 | 94 | 開局與滿級均可直接看到四個欄位，詳情可查合法候選及效果。 [A](../scratch/ui-compendium-20261126/build-A.jpg) · [C](../scratch/ui-compendium-20261126/build-C.jpg) · [短視口](../scratch/ui-compendium-20261126/short-build-E.jpg) |
| 操作體驗 | 89 | 實際驗滑鼠、鍵盤、觸控模擬與手把訊號，詳情能回到原焦點。實體手把待驗。 [鍵盤](../scratch/ui-compendium-20261126/keyboard-focus.jpg) · [手把模擬](../scratch/ui-compendium-20261126/gamepad-focus.jpg) |
| 跨裝置相容性 | 84 | 1080p／1440p／2160p、iPad 尺寸及短視口均驗到畫面。實體 Safari 待驗。 [視口與尺寸](../scratch/ui-compendium-20261126/browser.json) |
| 程式與資料正確性 | 95 | 聚焦通過、A–E 依法驗算、存檔哨兵保留、音訊持續。完整回歸維持一項已知斷言及一個 TODO。 [現行完整結果](../scratch/ui-compendium-20261126/regression.log) |
