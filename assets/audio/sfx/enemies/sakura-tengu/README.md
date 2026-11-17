# 櫻嶺天狗音效預留

把 MP3 放在此目錄，檔名如下，重新整理本機遊戲即可載入。不放空白檔；缺檔會靜音，每個名稱最多嘗試一次，不會反覆404或改播合成音。

| 檔名 | 觸發時機 |
| --- | --- |
| sakura-tengu__rush-warn.mp3 | 疾風突進：每次鎖線開始一次 |
| sakura-tengu__rush-cast.mp3 | 疾風突進：每段衝刺開始一次 |
| sakura-tengu__feather-warn.mp3 | 扇形羽刃：前搖開始一次 |
| sakura-tengu__feather-cast.mp3 | 扇形羽刃：整組發射一次 |
| sakura-tengu__root-warn.mp3 | 錯峰櫻根：整組預警一次 |
| sakura-tengu__root-impact.mp3 | 錯峰櫻根：每處破土各一次 |

預警建議約0.4～0.9秒，發動約0.2～0.6秒；破土間隔0.24秒，root-impact宜短，不要含長靜音開頭。沿用現有SFX靜音／暫停／語音壓低音量；實際音量與音色待放檔後聽驗。

此清單只是預留路徑，不代表此目錄的MP3已存在或已審核。放檔後資產清冊需同步登錄。

2026-11-17：已使用本機 ComfyUI／Stable Audio Open 1.0 生成六個音效候選，保留於 `art/stage3-sakura-pass/characters/sakura-tengu-sfx/`，含原始 FLAC、短版 WAV／MP3、試聽頁 `review.html`、提示詞與生成收據。該六款已由使用者退件（偏電子合成音、不搭）；原檔保留，禁止接入遊戲。尚未複製至本目錄或改動遊戲接線。追溯資料：`docs/STAGE3_BOSS_SFX_GENERATION_20261117.json`。

2026-11-17 再試：`art/stage3-sakura-pass/characters/sakura-tengu-sfx/foley-r2/` 僅製作破土一招，改以 CC0 木裂／鏟土錄音剪輯疊音。A 木裂、B 木裂＋泥土與0.24秒短版亦已退件（像塑膠盒落地，沒有破土感）；來源授權與處理參數見該目錄 manifest.json。

2026-11-17 第三輪：依使用者指定，以本機已安裝 ACE-Step 1.5 XL SFT 與 MiniMax Music 3 各生成一段約8秒破土小樣，保留完整輸出、只調整音量，位於 `art/stage3-sakura-pass/characters/sakura-tengu-sfx/model-probe-r3/`。兩者屬音樂生成模型；使用者已確認兩段都是短音樂，第三輪亦退件，禁止接入遊戲。

2026-11-17 第四輪：依使用者選定「厚重：低沉地裂＋大量碎土」，用本機既有 MiniMax H3 Ref2VA 生成一段約5.17秒非音樂試音，位於 `art/stage3-sakura-pass/characters/sakura-tengu-sfx/h3-probe-r4/`。完整保留音訊，只調整音量，提示詞與收據齊；待使用者聽驗，仍未接入遊戲。

2026-11-17 第五輪：使用者認為 H3 前版只有岩壁剝落小砂石感，未達破土。已重生 H3 厚重主體、疊少量前版碎屑，位於 `art/stage3-sakura-pass/characters/sakura-tengu-sfx/h3-heavy-r5/`，待聽驗；低頻比例量測僅為技術描述，不表示重量感或語意通過。所有原檔保留，仍未接入遊戲。

2026-11-17：第五輪 H3 加重版已由使用者列為候補（已有土地撕裂感），僅候補，未核准接入。依新指示，另用使用者已下載的 Stable Audio 3.0 Medium 生成約5.02秒完整試音（官方 Medium 8步／CFG1／LCM參數），位於 `art/stage3-sakura-pass/characters/sakura-tengu-sfx/sa3-probe-r6/`；review.html 可與 H3 候補比較。新音效待聽驗，候補原檔雜湊確認未變，仍無 runtime MP3。
