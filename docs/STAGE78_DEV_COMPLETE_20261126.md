# 幽世渡口、黃泉境及八關內容工作日誌

2026-11-26 · `IN_GAME_TRIAL_PENDING_USER_REVIEW`

| 階段 | 已完成和修改位置 | 測試及接續 |
| --- | --- | --- |
| 1 幽世渡口 | `stage-route-layouts.js` 的無限河岸、老木交橋和碰撞，`late-stage-art.js` 的 63 張地面／建物／怪物／頭目／預警／出場圖。受控後段用靈河橫浪和長篙，首波與守關各有不同本體。 | 渡口取貨與答題腳點以兩種 Y 間距驗證。渡橋追蹤、持續操作和美術待玩家確認。 |
| 2 黃泉境 | 56 張候選。深灰紫荒土、裂石交道、赤月、終章鳥居、裂谷與寺門。四波分為冥門骸武者、灰火祭姬、玄巖墓蛇、言靈之核；環形傷害有中心和外圈安全區，半血追加另一次預警。 | Boss HP 沿原藍圖。裂線和赤月環依實際計算的範圍對齊，預警鎖點和恢復期由聚焦測試覆蓋。 |
| 3 教材 | `delivery-media.js` 的 DEV 材料路由。`tools/audit-delivery-media.py` 從既有候選逐索引複製，新增 60 圖、60 音，保持來源雜湊。渡口 `16 ふね` 使用現役候選 manifest 指定的第二次漢字版。 | 全 140 WebP 和 MP3 核對，沒有缺檔、重複讀音鍵或 PCM 門檻警示。母語發音、語意與各圖檔細邊待人工逐筆審核。 |
| 4 音效 | `audio.js` 延用既有合成器、音量與混音匯流，接本機後四關出怪、遠程出招及頭目登場，新增渡口和黃泉各三種預警／命中音色。前四關專用 BGM 現役，第五至八關用共用戰鬥曲及 Boss 曲。 | 完整專用錄音和 iPad 喇叭混音待驗，見下方缺漏。 |
| 5 進度 | `overworld.js` 允許 DEV 依清關串接，公開門禁繼續鎖住；`game.js`、`ui.js` 接黃泉晨曦、赤月淡出和「八夜配達完成」。兩關使用現有結算、技能獎勵介面、卡冊和題庫。 | 共用四波、封印、多王、結算與輸入回歸。第七／八關未新增技能獎勵內容。 |
| 6 品質 | Chrome 找到渡口碰撞虛線和橋面過粗、黃泉赤月遮住中央戰鬥，已調整木板、座標和透明度。圖集重切時沿透明溝槽切片。終章鳥居改成雙腳碰撞，中央留通路。 | 兩視角走位與畫面複測，後兩關高景物沿用遮擋淡化。多王自然分布、長局場景節奏、裝置上危險色對比待驗。 |
| 7 式神與舊圖 | `game-shikigami.js`、`assets/img/skills/shikigami/manifest.json`。17 張狼系候選，黑狼 Lv5 才載入。四張變異圖各 820×1230，合看大小、邊界、構圖與辨識度。雨港潮扇／雨渦、竹林切線／筍陣另有 4 張 Stage Lab 前搖用圖。 | 0.75 秒咬擊及雙狼 AI 沿用先前試玩規格。狼系 17 圖和前搖 4 圖均待玩家驗收。 |
| 8 效能 | 關卡圖片按需載入，退出放開本關引用。場景區塊共用有界串流，地圖外保留委託 pin。地板各六款，沿用現有地面快取、視口裁切和 512 顆靈玉機制。 `service-worker.js`、`ASSET_INVENTORY.json` 更新。 | 第七、八關 PNG 原稿留每關 `art/…`，遊戲下載約 5.3 MB／4.7 MB WebP。若同時解碼，圖集 RGBA 上限約 37.1 MiB／35.5 MiB，不含遊戲共用材質與 Canvas。實體 iPad 的長局峰值及幀率待驗。 |
| 9 驗證 | `tools/audit-stage78-browser.cjs` 走八關 PC 入口，第七／八關另跑同區網觸控視口，驗封印反噬、解除封印與結算。含鍵盤、觸控暫停和虛擬手把軸。 | 聚焦 137 通過。現行 1,281 通過、0 失敗、1 既有雨港美術 TODO。兩種 Chrome 視口 0 本機媒體 404、0 頁面例外。 |

## 交付入口

| 用途 | PC | iPad 同區網 |
| --- | --- | --- |
| 美術預覽與五至八關入口 | [開預覽](http://127.0.0.1:8007/stage-art-review/) | [開預覽](http://192.168.50.107:8007/stage-art-review/) |
| 幽世渡口 | [直接進關](http://127.0.0.1:8007/?dev=1&s3play=1&stageLab=1&stage=spirit-ferry) | [直接進關](http://192.168.50.107:8007/?dev=1&s3play=1&stageLab=1&stage=spirit-ferry) |
| 黃泉境 | [直接進關](http://127.0.0.1:8007/?dev=1&s3play=1&stageLab=1&stage=yomi) | [直接進關](http://192.168.50.107:8007/?dev=1&s3play=1&stageLab=1&stage=yomi) |
| 黑白狼 | [Lv5 鏡頭](http://127.0.0.1:8007/?dev=1&s3play=1&stageLab=1&stage=bamboo-maze&skillLab=5) | [Lv5 鏡頭](http://192.168.50.107:8007/?dev=1&s3play=1&stageLab=1&stage=bamboo-maze&skillLab=5) |

使用「開發選關 → 直接進關」。預覽頁共 236 張，第五／六／七／八關各 66／51／63／56 張，另有 2D 與 `bossLab=1` 入口。新增到本機用路徑的 200 張 WebP 中，140 張是新製，60 張沿用既有單字圖。60 段 MP3 都是既有候選無損複製。新製圖由內建 ImageGen 生成，提示、尺寸、雜湊及原稿連結收錄於 [渡口 manifest](../art/stage7-spirit-ferry/manifest.json)、[黃泉 manifest](../art/stage8-yomi/manifest.json)、[式神 manifest](../assets/img/skills/shikigami/manifest.json)、[雨港預警](../art/stage2-rain-port/characters/harbor-warning-ink-manifest.json)、[竹林預警](../art/stage4-bamboo-maze/characters/bamboo-warning-ink-manifest.json)。

測試收據與案例畫面在 `scratch/stage78-dev-20261126/`。資產登錄驗完 1,360 檔、151 alias／copy。預覽重建用 `node tools/build-stage-art-review.cjs`，場景原稿、詞音原始來源在本機 `art/`。

## 剩餘素材與複查

| 範圍 | 待補檔名／時機 | 現行 |
| --- | --- | --- |
| 第五至八關 BGM | `assets/audio/bgm/stages/<stage-id>/<stage-id>__battle.mp3`，進關時選播、Boss 混音走原流程 | 共用 battle、boss、menu。檢查本機四個原始關卡 BGM 資料夾只找到前四關曲目。 |
| 渡口頭目 | `ferry-<soul-splash|spirit-tide|oar-sweep>__<warning|impact>.mp3`，鎖點／轉 active | 三種低量鈴與太鼓合成音。 |
| 黃泉頭目 | `yomi-<cinder-burst|fault-line|eclipse>__<warning|impact>.mp3`，含終王半血續招 | 三種鈴、木塊與低太鼓合成音。 |
| 第五至八關出怪與出招 | `<stage-id>__mob-spawn.mp3`、`<stage-id>__mob-shot.mp3`、`<stage-id>__boss-arrival.mp3` | DEV 合成音，有節流；一般近身接觸使用原受擊提示。 |
| 第五至八關動畫 | 第七、八關小怪是待機／預備／動作三姿，六個主要攻擊分預警／命中，殘留沿用命中圖淡出。後續可補中間格和獨立殘留圖。 | 已用相同腳點、深度和投影接入候選。 |
| 前四關 | [既有圖音清單](FIRST_FOUR_STAGES_ART_AUDIO_BACKLOG.md) 的雨港海面、竹林遮擋、櫻道王招銜接以及音效人審項目 | DEV 有 4 張新前搖圖。雨港命中圖沿舊候選，仍有水術起手與命中層的整體實機驗收。 |

獨立複查可從 `tests/stage78-dev.test.cjs`、 `tests/unified-boss-schedule-no-delivery-gate-20261125.test.cjs`、`node tools/audit-stage78-browser.cjs` 開始。最重要的實機重點是渡口貼河走位、黃泉環形兩側安全帶、答題語音、三王同場與黑狼咬擊。遊戲素材未經玩家核准，未提交、推送或部署。
