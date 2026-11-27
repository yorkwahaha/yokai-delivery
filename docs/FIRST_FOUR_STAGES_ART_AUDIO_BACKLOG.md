# 前四關待補美術與音效

2026-11-25 · `ART_CANDIDATE_USER_REVIEW_PENDING`。Phase D 已核對畫面、現役資產及路徑。候選交付使用既有原稿目錄，新圖經人審後才接入。圖檔尺寸是製作規格，遊戲內顯示大小由現有渲染器控制。

2026-11-26 本機 Stage Lab 接入雨港與竹林共 4 張獨立前搖圖。雨港的墨邊水紋貼合現有扇緣及雨渦，竹林切線和筍陣改用深墨暖赭的候選警戒圖。命中與判定沿原流程。 [八關 DEV 工作日誌](STAGE78_DEV_COMPLETE_20261126.md)

## 美術優先順序

共同畫風為第一關母風格的半水墨、浮世繪、和紙印痕、強墨線與微 Q。場景地面用正投影，角色／物件用淺 3/4，保留腳底錨點及透明邊緣。每件在 2D、2.5D 和觸控視口核對，再比對原畫。

| 優先 | 關卡／現役檔案 | 畫面與原因 | 建議構圖與交付 | 接入點／驗收 |
| --- | --- | --- | --- | --- |
| P1 | S4 切線與筍陣。 `assets/img/vfx/enemies/bamboo-cut/bamboo-cut__warning.webp`、`assets/img/vfx/enemies/bamboo-shoots/bamboo-shoots__warning.webp` | [雙王 2.5D](../scratch/phase-d-20261125/after/bamboo-maze-dense-tilt.jpg) · [2D](../scratch/phase-d-20261125/after/bamboo-maze-dense-flat.jpg)。細長黃白墨邊在靈陣上容易變成同一道亮線，筍陣連續五次更依賴邊緣辨識。 | 切線 768×144、筍陣 512×512，透明 PNG 原稿及 WebP。切線留清楚的塊面端點及深墨／暖赭雙色邊，筍陣保留五段一致的形狀語言，中央留透明。 | `BAMBOO_ART.paintHazard` 的兩個 warning 槽。玩家能即時指出危險側與出口。貼地外緣符合現有命中範圍，命中立繪依原頭尾節奏。 |
| P1 | S2 潮扇與雨渦。 `assets/img/vfx/enemies/ikari-umibozu/ikari-umibozu__tidal-fan.webp`、`ikari-umibozu__rain-vortex.webp` 同目錄 | [雙王 2.5D](../scratch/phase-d-20261125/after/rain-port-dense-tilt.jpg)。大面積白浪與青色靈陣疊在港倉、角色和安全邊上。 | 1024×1024 透明 PNG／WebP，交付可獨立合成的墨邊前搖與白浪／水柱命中層。前搖集中在輪廓，中心留足透明，命中層才用高亮厚墨。 | `drawPortBossHazard`、`drawPortBossTelegraphOverlay`。雙王同場仍能指認扇緣、三／五渦位置及安全帶，`2D/.60` 對齊真實傷害區。 |
| P2 | S2 港口海面。 `assets/img/stages/rain-port/scene/rain-port__surface-sea-canonical.webp` | [開局 2D](../scratch/phase-d-20261125/after/rain-port-opening-flat.jpg) · [活戰前段](../scratch/phase-d-20261125/after/rain-port-mid-tilt.jpg)。岸外的長弧白浪週期明顯，與港邊預警亮線競爭。 | 512×512 不透明正投影 WebP。先交一組 4 張四向可鄰接變體，浪頭疏密和重心有差異，保留現有靛藍粗墨及紙面。 | 雨港海面材質 consumer。先 3×3、6×6、10×10 連鋪，再用港倉至碼頭鏡頭對照。岸線不出現新格縫，白浪對比讓位於預警。 |
| P2 | S4 竹叢與路口。 `assets/img/stages/bamboo-maze/props/bamboo-maze__bamboo-column.webp`、`bamboo-maze__bamboo-thicket.webp` 同目錄 | [中段 2D](../scratch/phase-d-20261125/after/bamboo-maze-mid-flat.jpg) · [百鬼 2.5D](../scratch/phase-d-20261125/after/bamboo-maze-surge-tilt.jpg)。多組高竹同向，輪廓相近，窄路一眼看不出哪側可轉。 | 384×1024 與 640×768 透明 PNG／WebP，兩組疏密有差的簇形、低明度葉面、根部留乾淨錨點。可走路口側留較疏空間，保留既有綠墨與暖色竹節。 | `BAMBOO_ART` props、現有路障對位。玩家經過遮擋前後能辨識路口、竹籬與茶屋腳底，障礙輪廓符合現有碰撞。 |
| P2 | S4 草帽妖突進辨識。 `assets/img/enemies/bamboo-hat-imp/bamboo-hat-imp__sprite__idle.webp`、`bamboo-hat-imp__sprite__attack.webp` 同目錄 | [群怪](../scratch/phase-d-20261125/after/bamboo-maze-surge-flat.jpg)。現役土褐草帽與走道、筍妖帽緣的形狀接近，擠在一起時難認攻擊姿勢。 | 512×512 RGBA，每格同腳底與朝向。以帽沿傾角、手部剪影與淺米色內襯區分待機和攻擊，小面積冷色布襯協助辨識。 | `BAMBOO_ART.monster` 的 ghost idle／attack。保持原碰撞、可辨朝向，兩個視角下都能和筍妖、蟹、小竹柱區分。 |
| P2 | S3 王招銜接。 `assets/img/enemies/night-sakura-princess/night-sakura-princess__sprite__attack.webp`、`assets/img/vfx/enemies/sakura-tengu/sakura-tengu__wind-blade.webp` | [雙王與櫻道](../scratch/phase-d-20261125/after/sakura-pass-dense-tilt.jpg)。待機到單攻擊姿勢跳接，大量櫻粉背景削弱羽刃朝向。 | 512×512 RGBA 的蓄勢、發招和收勢三格，原地對腳。另交 768×320 透明羽刃，尖端深墨、短暖邊，保留束扇和櫻紋。 | `SAKURA_ART_DATA` 的角色 pose 與 windBlade 槽。既有 3 類王招各可辨起手、前方與結束，足底平穩，VFX 與實際方向重合。 |
| P3 | S3／S4 後解鎖技能卡。 `assets/img/skills/ink-trail/cards/ink-trail__art.webp`、`assets/img/skills/seal-nail/cards/seal-nail__art.webp` | [S3 入選](../scratch/phase-d-20261125/after/sakura-pass-upgrade-tilt.jpg) · [S4 三張介紹](../scratch/phase-d-20261125/after/bamboo-maze-upgrade-tilt.jpg)。現役試玩卡能分色，主體仍容易只被看成光渦或爆光。 | 820×1230 不透明中心圖 WebP，無字無框。毒香以低伏紫煙沿腳步拖長，封印釘保留巨大墨釘與清楚的放置點。 | 共用核准卡框的 center 插槽。按現行裁切保留焦點、名稱區與覺醒反光，手機縮圖仍可在三卡中指出技能。 |

夜行町石板在採樣中有規律重複，整體辨識度及接地仍優於其餘關，先保留現役母風格。 [夜行町開局](../scratch/phase-d-20261125/after/night-town-opening-flat.jpg)

## 音效交付清單

Phase C 報告的兩組瀏覽器布置遇到 **20 個不同 MP3 404**，標 **●**。延長活戰鬥原始記錄另有暴雨與白狼消失兩槽，標 **△**。共 **28 個 MP3＋2 個 OGG** 路由待交付。逐一比對磁碟、同名檔與現行 alias 後，這 30 槽均欠專屬錄音。獨立的普通刀聲、一般靈針、雨港潮扇與雨渦檔案仍可用。

交付按表放檔，從 `js/audio.js` 的 `unprovidedSfx` 移除該鍵，並更新素材清冊與測試。竹林和白狼的播放入口還須依原本的本機候選流程驗收。已知缺檔直接走表內 fallback。同一工作階段，現有可選錄音真的載入失敗仍沿用既有失敗記憶。

| C 404 | 關卡／事件與所需聽感 | 預期檔案路徑 | 現用 fallback |
| --- | --- | --- | --- |
| ● | 全關・妖刀 Lv1–4，短單刃確認 | `assets/audio/sfx/katana-lv1-4.mp3` | 通用 `world__slash.mp3` → 合成刀聲 |
| ● | 全關・靈陣 Lv1–4，柔和脈衝 | `assets/audio/sfx/barrier-lv1-4.mp3` | 合成靈陣 |
|  | 全關・靈針 Lv1–4，短穿刺 | `assets/audio/sfx/needle-lv1-4.mp3` | `needle__cast.mp3` → 合成針聲 |
| ● | 全關・靈針 Lv5，輪射辨識 | `assets/audio/sfx/needle-lv5.mp3` | `needle__cast.mp3` → 合成針聲 |
| ● | S1 首通後・紫藤鋪霧，低量提示 | `assets/audio/sfx/skills/ink-trail/ink-trail__drop.mp3` | 靜音 |
|  | S1 首通後・毒香首次命中 | `assets/audio/sfx/skills/ink-trail/ink-trail__hit.mp3` | 靜音 |
| ● | S1 首通後・毒香 Lv5 混亂覺醒 | `assets/audio/sfx/skills/ink-trail/ink-trail__awaken__lv05.mp3` | 靜音 |
|  | S1 首通後・餘香變異觸發 | `assets/audio/sfx/skills/ink-trail/ink-trail__echo.mp3` | 靜音 |
| ● | S2 首通後・封印釘落地 | `assets/audio/sfx/skills/seal-nail/seal-nail__drop.mp3` | 靜音 |
| ● | S2 首通後・封印釘爆炸 | `assets/audio/sfx/skills/seal-nail/seal-nail__burst.mp3` | 靜音 |
|  | S2 首通後・二重破封覺醒 | `assets/audio/sfx/skills/seal-nail/seal-nail__awaken__lv05.mp3` | 靜音 |
|  | S2・舊水術保留槽，蓄勢 | `assets/audio/sfx/boss/rain_port_water_slam_warn.ogg` | 靜音 |
|  | S2・舊水術保留槽，水擊落地 | `assets/audio/sfx/boss/rain_port_water_slam_impact.ogg` | 靜音 |
|  | S2・海嘯前搖，指示要找安全帶 | `assets/audio/sfx/enemies/ikari-umibozu/ikari-umibozu__tsunami-warn.mp3` | 靜音 |
|  | S2・海嘯推上岸 | `assets/audio/sfx/enemies/ikari-umibozu/ikari-umibozu__tsunami-impact.mp3` | 靜音 |
| △ | S2・雨勢升為暴雨，天氣切換提示 | `assets/audio/sfx/world/rain-port__heavy-rain.mp3` | 靜音 |
| ● | S3・櫻天狗突進起手 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__rush-warn.mp3` | 靜音 |
| ● | S3・櫻天狗突進，疾風掠過 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__rush-cast.mp3` | 靜音 |
| ● | S3・羽扇前搖，提早辨識扇形 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__feather-warn.mp3` | 靜音 |
| ● | S3・羽刃射出 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__feather-cast.mp3` | 靜音 |
| ● | S3・櫻根蓄勢，地下低響 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__root-warn.mp3` | 靜音 |
| ● | S3・櫻根破土 | `assets/audio/sfx/enemies/sakura-tengu/sakura-tengu__root-impact.mp3` | 靜音 |
| ● | S3 首通後／S4・白狼召喚 | `assets/audio/sfx/skills/shikigami/shikigami__summon.mp3` | 靜音 |
| ● | S3 首通後／S4・白狼咬擊 | `assets/audio/sfx/skills/shikigami/shikigami__attack.mp3` | 靜音 |
| ● | S3 首通後／S4・白狼受傷 | `assets/audio/sfx/skills/shikigami/shikigami__hurt.mp3` | 靜音 |
| △ | S3 首通後／S4・白狼消失或陣亡 | `assets/audio/sfx/skills/shikigami/shikigami__vanish.mp3` | 靜音 |
| ● | S4・竹林王切線前搖 | `assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__cut-warning.mp3` | 靜音 |
| ● | S4・竹林王切線命中 | `assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__cut-impact.mp3` | 靜音 |
| ● | S4・竹筍預警，連續五次仍可分辨 | `assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__shoots-warning.mp3` | 靜音 |
| ● | S4・竹筍破土，與切線不同音色 | `assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__shoots-impact.mp3` | 靜音 |

優先試聽竹林王四槽、櫻天狗六槽及雨港海嘯兩槽。用 iPad 揚聲器和低音量 BGM，核對玩家是否能只靠聲音辨認預警、實際出招及多次提示，並確認正常播放時無重複建立音訊請求。 [Phase D 驗證](../.cleanup-archive/history/20261127/docs/FIRST_FOUR_STAGES_POLISH_PHASE_D_20261125.md)
