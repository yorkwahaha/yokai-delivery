# 第三關 Boss 可讀性、招式幅度與音效接線（2026-11-16）

LOCAL_ONLY / USER_PLAYTEST_PENDING；新破土圖 ART_CANDIDATE_USER_REVIEW_PENDING；音效 ASSET_PENDING。

## 本次完成

1. 追王標題箭頭改依實際字寬定位並預留旋轉包圍範圍；任務區小於280世界像素時，箭頭移至下一列，極窄區保留單組。維持既有字型、標題文字與箭頭圖樣，不再壓住「擊敗櫻鬼・花天狐」。
2. 第三關的新招式移至玩家靈陣、夜色與技能效果之上繪製一次，仍低於委託字幕與HUD。預警採深色12px外框＋亮象牙5px實線與低透明酒紅底，不再只靠細虛線；輪廓由同一份實際危險區資料繪製。圖片仍是既有專用候選，線框是可讀性安全提示，不宣稱正式預警美術完稿。
3. 羽毛實際速度330→495、半血370→555，皆為原本1.5倍；射程540、羽刃數量、前搖、傷害與碰撞保持。有效飛行時間隨速度縮短。
4. 櫻根發動主圖寬度166.5→249.75（1.5倍），高度等比。僅放大視覺，傷害半徑仍74；另接獨立真圖片的破土碎片／塵霧，隨每處根點發動擴散淡出，沒有用程序碎石冒充正式圖片。
5. 破土原稿 art/stage3-sakura-pass/characters/sakura-tengu__earth-break.png，執行圖 assets/img/vfx/enemies/sakura-tengu/sakura-tengu__earth-break.webp。內建 image_gen 生成，原稿、完整提示詞、來源與SHA256保存於 [VFX紀錄](STAGE3_BOSS_VFX_20261116.json)。舊38張圖雜湊未變，只新增一張。

## 音效檔案（待使用者提供）

位置：assets/audio/sfx/enemies/sakura-tengu/。此處已有 [README](../assets/audio/sfx/enemies/sakura-tengu/README.md) 與 [機讀manifest](../assets/audio/sfx/enemies/sakura-tengu/manifest.json)，沒有建立空白MP3或擅自生成音訊。

| 檔名 | API／時機 |
| --- | --- |
| sakura-tengu__rush-warn.mp3 | sakuraRushWarn；每段疾風突進鎖線一次 |
| sakura-tengu__rush-cast.mp3 | sakuraRushCast；每段突進發動一次 |
| sakura-tengu__feather-warn.mp3 | sakuraFanWarn；羽刃整組預警一次 |
| sakura-tengu__feather-cast.mp3 | sakuraFanCast；整組羽刃射出一次 |
| sakura-tengu__root-warn.mp3 | sakuraBloomWarn；櫻根整組預警一次 |
| sakura-tengu__root-impact.mp3 | sakuraBloomImpact；每處破土各一次 |

沿用現有SFX匯流、靜音／暫停及讀詞時壓低音量。這六檔不在進關預載中；首次實際用到時若缺檔，每個名稱最多嘗試一次後靜音，不連續404、不補合成音或舊技能音。放檔後重新整理即走正式命名的本機路徑，清冊仍需同步登錄；實際聲音與音量待音檔到齊後聽驗。根點間隔0.24秒，破土音宜短、避免長靜音前綴。

## 使用者尾聲截圖的判讀

FPS60、sim0.4ms、draw3.1ms，屬截圖當下健康的表現：以60FPS約16.7ms一幀比較，兩段CPU量測合計約3.5ms，有餘裕。數值是約0.9秒取樣區間的平均，並非完整GPU／呈現耗時，不能排除偶發尖峰、長局熱降速或其他裝置的狀況。

敵42與靈玉34沒有顯示明顯堆積（第三關normal一般怪上限80、靈玉物件上限512）；單張截圖不能當記憶體洩漏檢驗。753秒為12分33秒；遊戲允許破曉後延長追王，超過10分鐘本身不是錯誤。此輪沒有為了數字變好而改生怪、靈玉或效能顯示。

## 技術驗證

1. 98項聚焦檢查PASS：第三關工程14、新Boss行為7、素材／renderer9、新可讀性／音效事件5、既有音訊26、HUD4、雨港Boss15、既有Boss11、快取7。涵蓋任意箭頭旋轉的避字幾何、窄版另列、495／555實速、249.75主圖寬度與破土圖、預警層級只繪製一次、六個缺檔靜音、每個事件一次及前兩關回歸。
2. 六個JS語法與registry工具py_compile通過；媒體索引1036項已更新；素材登錄PASS（1043檔／151 aliases/copies）。預留音檔清單獨立列ASSET_PENDING，不把不存在檔案列作已完成資產。
3. 39張圖片解碼、SHA256與HTTP通過；34張候選RGBA／四邊透明留白通過；43個靜態網址HTTP200。證據 [HTTP](STAGE3_BOSS_POLISH_HTTP_20261116.json)。
4. 靜態真renderer：scratch/stage3-boss-polish-2d.png、stage3-boss-polish-tilt.png。實際HUD助手＋專案字型靜態接圖：scratch/stage3-boss-title-polish.png。已檢視；不載入game.js，不操作玩家。Node事件測試只檢查單次事件，不是自動Boss戰。
5. 沒有實機完整跑關、音檔聽驗或新版本FPS保證；未提交／推送／部署，保留既有dirty與所有舊圖音。

試玩：重新整理 <http://127.0.0.1:8788/?dev=1&s3play=1&stage=sakura-pass&perf=1> →開發選關→第三關→直接進關。請本人確認靈陣開啟時的預警辨識、加速羽毛是否仍有閃避空間、櫻根與破土的新大小。
