# 第一季 164 詞庫盤點與語料音訊契約表 (Season One Content Inventory)

> [!NOTE]
> 本檔由 AGY 獨立驗證工具 `tools/verify-words-corpus.cjs` 於 2026-10-13 依真實 `js/words.js` (CONTENT) 與 `js/audio.js` (WORD_FILES) 生成。符合 B1/B2 語意與中繼資料契約規範。

## 1. 總體統計摘要

- **全域獨立單詞數 (Unique Words)**：**164 詞**
- **既有錄音資產重用 (Reused MP3)**：**39 筆** (100% 匹配現有 `assets/audio/words/*.mp3`)
- **缺新詞語音合成降級 (TTS Fallback)**：**125 筆** (依賴瀏覽器 `speechSynthesis`，無實體 MP3)
- **第 8 關黃泉境綜合池 (Stage 8 yomi)**：**164 詞** (涵蓋前 7 關所有 21 個 Pack，支援個人錯題優先加權複習)
- **詞庫檔案雜湊 (js/words.js SHA-256)**：`3714daecdcf8066aa40ae81e74134a181eefc9fb0a6703082fb19a06ca4dfb64`

### 1.1 extra 3 單詞加入原因說明
- 原規劃前 7 關詞數為 24/27/22/22/21/24/21 (共 161 詞)。
- 在落實第 1 關「人物動物住家場所」時，為使生活住家領域（town-house）覆蓋更完整日常生活空間，擴充加入 **まど** (窗戶)、**つくえ** (書桌)、**いす** (椅子) 三個基礎 N5 住家詞彙，使第 1 關詞數由 24 詞增至 27 詞，與第 2 關 (27 詞) 對齊，全域獨立單詞總數因此由 161 詞調整為 **164 詞**。

### 1.2 漢字欄位規範 (Kanji Orthography Contract)
- 日語自然假名詞（問候語、感嘆詞、數量副詞、外來語等如 `いいえ`、`はい`、`さようなら`、`ありがとう`、`すみません`、`おはよう`、`こんにちは`、`こんばんは`、`たくさん`、`ケーキ`、`ラーメン`、`パン`）不硬填繁中翻譯或生僻罕用漢字，其 `kanji` 欄位依官方契約為空字串 `""`，下表以 `—` 呈現。
- 具備標準新字體之詞彙（如 `学校`、`静か`、`寝る`、`林檎`、`山`、`川` 等）皆正確標註。

## 2. 各關卡分佈現況

| 關卡 ID | 關卡名稱 | 章節進度 | 單詞數 | 主題範疇 | 實裝狀態 |
|---|---|---|---:|---|:---:|
| `night-town` | 夜行町 | 第 1 章 | 27 | 人物、動物、住家、場所 | 已實裝 |
| `rain-port` | 雨夜港町 | 第 1 章 | 27 | 方位、天氣、交通 | 已實裝 |
| `sakura-pass` | 妖櫻山道 | 第 1 章 | 22 | 自然、季節、時間、日期 | 已實裝 |
| `bamboo-maze` | 竹影迷宮 | 第 2 章 | 22 | 顏色、形容詞、數量 | 已實裝 |
| `hyakki-kyoto` | 百鬼京都 | 第 2 章 | 21 | 食物、飲料、購物 | 已實裝 |
| `snow-temple` | 雪燈山寺 | 第 2 章 | 24 | 動作、移動、身體 | 已實裝 |
| `spirit-ferry` | 幽世渡口 | 第 3 章 | 21 | 感受、狀態、人物表達 | 已實裝 |
| `yomi` | 黃泉境 | 第 3 章 | 164 | 全關綜合複習與個人錯題加權 | 已實裝 |

## 3. 全 164 詞詳細中繼資料表

| # | 日文 (jp) | 讀音 (kana) | 漢字 (kanji) | 中文翻譯 (zh) | 品詞 (pos) | 音訊狀態 | 提示型態 | 所屬關卡 (stageIds) |
|---:|---|---|---|---|---|:---:|:---:|---|
| 1 | ねこ | ねこ | 猫 | 貓 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 2 | いぬ | いぬ | 犬 | 狗 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 3 | うさぎ | うさぎ | 兎 | 兔子 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 4 | えき | えき | 駅 | 車站 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 5 | ほん | ほん | 本 | 書 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 6 | かさ | かさ | 傘 | 雨傘 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 7 | とり | とり | 鳥 | 鳥 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 8 | かめ | かめ | 亀 | 烏龜 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 9 | かえる | かえる | 蛙 | 青蛙 | 名詞 | 🟢 MP3 | emoji | night-town, yomi |
| 10 | ひと | ひと | 人 | 人 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 11 | ともだち | ともだち | 友達 | 朋友 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 12 | こども | こども | 子供 | 小孩 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 13 | おんなのこ | おんなのこ | 女の子 | 女孩 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 14 | おとこのこ | おとこのこ | 男の子 | 男孩 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 15 | いえ | いえ | 家 | 房屋 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 16 | まど | まど | 窓 | 窗戶 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 17 | つくえ | つくえ | 机 | 書桌 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 18 | いす | いす | 椅子 | 椅子 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 19 | でんき | でんき | 電気 | 電燈 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 20 | かぞく | かぞく | 家族 | 家人 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 21 | へや | へや | 部屋 | 房間 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 22 | にわ | にわ | 庭 | 庭院 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 23 | まち | まち | 町 | 城鎮 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 24 | みち | みち | 道 | 道路 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 25 | はし | はし | 橋 | 橋樑 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 26 | こうえん | こうえん | 公園 | 公園 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 27 | がっこう | がっこう | 学校 | 學校 | 名詞 | 🟡 TTS | emoji | night-town, yomi |
| 28 | あめ | あめ | 雨 | 雨 | 名詞 | 🟢 MP3 | ame | rain-port, yomi |
| 29 | かぜ | かぜ | 風 | 風 | 名詞 | 🟢 MP3 | kaze | rain-port, yomi |
| 30 | くも | くも | 雲 | 雲 | 名詞 | 🟢 MP3 | kumo | rain-port, yomi |
| 31 | きり | きり | 霧 | 霧 | 名詞 | 🟢 MP3 | kiri | rain-port, yomi |
| 32 | かみなり | かみなり | 雷 | 雷 | 名詞 | 🟢 MP3 | kaminari | rain-port, yomi |
| 33 | ゆき | ゆき | 雪 | 雪 | 名詞 | 🟢 MP3 | yuki | rain-port, yomi |
| 34 | みぎ | みぎ | 右 | 右邊 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 35 | ひだり | ひだり | 左 | 左邊 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 36 | まえ | まえ | 前 | 前面 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 37 | うしろ | うしろ | 後ろ | 後面 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 38 | きた | きた | 北 | 北方 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 39 | みなみ | みなみ | 南 | 南方 | 名詞 | 🟢 MP3 | text | rain-port, yomi |
| 40 | くるま | くるま | 車 | 汽車 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 41 | ふね | ふね | 船 | 船 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 42 | ひこうき | ひこうき | 飛行機 | 飛機 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 43 | さかな | さかな | 魚 | 魚 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 44 | うみ | うみ | 海 | 海 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 45 | たこ | たこ | 蛸 | 章魚 | 名詞 | 🟢 MP3 | emoji | rain-port, yomi |
| 46 | うえ | うえ | 上 | 上面 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 47 | した | した | 下 | 下面 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 48 | なか | なか | 中 | 裡面 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 49 | そと | そと | 外 | 外面 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 50 | ちかく | ちかく | 近く | 附近 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 51 | とおく | とおく | 遠く | 遠處 | 名詞 | 🟡 TTS | text | rain-port, yomi |
| 52 | でんしゃ | でんしゃ | 電車 | 電車 | 名詞 | 🟡 TTS | emoji | rain-port, yomi |
| 53 | じてんしゃ | じてんしゃ | 自転車 | 自行車 | 名詞 | 🟡 TTS | emoji | rain-port, yomi |
| 54 | えきいん | えきいん | 駅員 | 站員 | 名詞 | 🟡 TTS | emoji | rain-port, yomi |
| 55 | さくら | さくら | 桜 | 櫻花 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 56 | やま | やま | 山 | 山 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 57 | はな | はな | 花 | 花 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 58 | つき | つき | 月 | 月亮 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 59 | ほし | ほし | 星 | 星星 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 60 | にじ | にじ | 虹 | 彩虹 | 名詞 | 🟢 MP3 | emoji | sakura-pass, yomi |
| 61 | はる | はる | 春 | 春季 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 62 | なつ | なつ | 夏 | 夏季 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 63 | あき | あき | 秋 | 秋季 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 64 | ふゆ | ふゆ | 冬 | 冬季 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 65 | もり | もり | 森 | 森林 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 66 | かわ | かわ | 川 | 河流 | 名詞 | 🟡 TTS | emoji | sakura-pass, yomi |
| 67 | きょう | きょう | 今日 | 今天 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 68 | あした | あした | 明日 | 明天 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 69 | きのう | きのう | 昨日 | 昨天 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 70 | いま | いま | 今 | 現在 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 71 | あさ | あさ | 朝 | 早晨 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 72 | よる | よる | 夜 | 夜晚 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 73 | ひる | ひる | 昼 | 白天 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 74 | じかん | じかん | 時間 | 時間 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 75 | ぷん | ぷん | 分 | 分鐘 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 76 | いちにち | いちにち | 一日 | 一日 | 名詞 | 🟡 TTS | text | sakura-pass, yomi |
| 77 | あか | あか | 赤 | 紅色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 78 | あお | あお | 青 | 藍色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 79 | しろ | しろ | 白 | 白色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 80 | くろ | くろ | 黒 | 黑色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 81 | みどり | みどり | 緑 | 綠色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 82 | きいろ | きいろ | 黄色 | 黃色 | 名詞 | 🟡 TTS | emoji | bamboo-maze, yomi |
| 83 | おおきい | おおきい | 大きい | 巨大的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 84 | ちいさい | ちいさい | 小さい | 微小的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 85 | たかい | たかい | 高い | 高聳的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 86 | ひくい | ひくい | 低い | 矮矮的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 87 | ながい | ながい | 長い | 長長的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 88 | みじかい | みじかい | 短い | 短短的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 89 | あたらしい | あたらしい | 新しい | 嶄新的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 90 | ふるい | ふるい | 古い | 陳舊的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 91 | おおい | おおい | 多い | 多量的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 92 | すくない | すくない | 少ない | 少量的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 93 | いい | いい | 良い | 良好的 | い形容詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 94 | ひとつ | ひとつ | 一つ | 一個 | 名詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 95 | ふたつ | ふたつ | 二つ | 兩個 | 名詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 96 | みっつ | みっつ | 三つ | 三個 | 名詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 97 | たくさん | たくさん | — | 許多 | 副詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 98 | すこし | すこし | 少し | 稍微 | 副詞 | 🟡 TTS | text | bamboo-maze, yomi |
| 99 | りんご | りんご | 林檎 | 蘋果 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 100 | おにぎり | おにぎり | お握り | 飯糰 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 101 | ケーキ | ケーキ | — | 蛋糕 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 102 | おちゃ | おちゃ | お茶 | 茶 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 103 | ラーメン | ラーメン | — | 拉麵 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 104 | パン | パン | — | 麵包 | 名詞 | 🟢 MP3 | emoji | hyakki-kyoto, yomi |
| 105 | みず | みず | 水 | 開水 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 106 | ごはん | ごはん | ご飯 | 米飯 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 107 | にく | にく | 肉 | 肉類 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 108 | やさい | やさい | 野菜 | 蔬菜 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 109 | たまご | たまご | 卵 | 雞蛋 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 110 | くだもの | くだもの | 果物 | 水果 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 111 | さけ | さけ | 酒 | 日本酒 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 112 | さら | さら | 皿 | 盤子 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 113 | ちゃわん | ちゃわん | 茶碗 | 飯碗 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 114 | すし | すし | 寿司 | 壽司 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 115 | みせ | みせ | 店 | 商店 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 116 | おかね | おかね | お金 | 錢幣 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 117 | かいもの | かいもの | 買い物 | 購物 | 名詞 | 🟡 TTS | emoji | hyakki-kyoto, yomi |
| 118 | えん | えん | 円 | 日圓 | 名詞 | 🟡 TTS | text | hyakki-kyoto, yomi |
| 119 | ねだん | ねだん | 値段 | 價格 | 名詞 | 🟡 TTS | text | hyakki-kyoto, yomi |
| 120 | て | て | 手 | 手部 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 121 | あし | あし | 足 | 腳部 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 122 | め | め | 目 | 眼睛 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 123 | みみ | みみ | 耳 | 耳朵 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 124 | くち | くち | 口 | 嘴巴 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 125 | あたま | あたま | 頭 | 頭部 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 126 | からだ | からだ | 体 | 身體 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 127 | は | は | 歯 | 牙齒 | 名詞 | 🟡 TTS | emoji | snow-temple, yomi |
| 128 | いく | いく | 行く | 前往 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 129 | くる | くる | 来る | 來到 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 130 | もどる | もどる | 戻る | 返回 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 131 | はしる | はしる | 走る | 奔跑 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 132 | あるく | あるく | 歩く | 步行 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 133 | とまる | とまる | 止まる | 停步 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 134 | はいる | はいる | 入る | 進入 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 135 | でる | でる | 出る | 走出 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 136 | みる | みる | 見る | 看見 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 137 | きく | きく | 聞く | 聆聽 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 138 | たべる | たべる | 食べる | 進食 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 139 | のむ | のむ | 飲む | 飲用 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 140 | いう | いう | 言う | 說話 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 141 | まつ | まつ | 待つ | 等待 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 142 | おきる | おきる | 起きる | 起床 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 143 | ねる | ねる | 寝る | 就寢 | 動詞 | 🟡 TTS | text | snow-temple, yomi |
| 144 | うれしい | うれしい | 嬉しい | 開心的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 145 | たのしい | たのしい | 楽しい | 愉快的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 146 | かなしい | かなしい | 悲しい | 悲傷的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 147 | さむい | さむい | 寒い | 寒冷的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 148 | あつい | あつい | 暑い | 炎熱的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 149 | すずしい | すずしい | 涼しい | 涼爽的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 150 | あたたかい | あたたかい | 暖かい | 溫暖的 | い形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 151 | すき | すき | 好き | 喜愛的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 152 | きらい | きらい | 嫌い | 討厭的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 153 | じょうず | じょうず | 上手 | 擅長的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 154 | へた | へた | 下手 | 不擅長的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 155 | しずか | しずか | 静か | 安靜的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 156 | にぎやか | にぎやか | 賑やか | 熱鬧的 | な形容詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 157 | ありがとう | ありがとう | — | 謝謝 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 158 | すみません | すみません | — | 不好意思 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 159 | おはよう | おはよう | — | 早安 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 160 | こんにちは | こんにちは | — | 你好 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 161 | こんばんは | こんばんは | — | 晚上好 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 162 | さようなら | さようなら | — | 再見 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 163 | はい | はい | — | 是的 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |
| 164 | いいえ | いいえ | — | 不是 | 感嘆詞 | 🟡 TTS | text | spirit-ferry, yomi |

## 4. 缺 MP3 需 TTS 降級之 125 單詞清單

| # | 日文 (jp) | 中文 (zh) | 預期音檔名 | 登場關卡 |
|---:|---|---|---|---|
| 1 | ひと | 人 | `ひと.mp3` | night-town, yomi |
| 2 | ともだち | 朋友 | `ともだち.mp3` | night-town, yomi |
| 3 | こども | 小孩 | `こども.mp3` | night-town, yomi |
| 4 | おんなのこ | 女孩 | `おんなのこ.mp3` | night-town, yomi |
| 5 | おとこのこ | 男孩 | `おとこのこ.mp3` | night-town, yomi |
| 6 | いえ | 房屋 | `いえ.mp3` | night-town, yomi |
| 7 | まど | 窗戶 | `まど.mp3` | night-town, yomi |
| 8 | つくえ | 書桌 | `つくえ.mp3` | night-town, yomi |
| 9 | いす | 椅子 | `いす.mp3` | night-town, yomi |
| 10 | でんき | 電燈 | `でんき.mp3` | night-town, yomi |
| 11 | かぞく | 家人 | `かぞく.mp3` | night-town, yomi |
| 12 | へや | 房間 | `へや.mp3` | night-town, yomi |
| 13 | にわ | 庭院 | `にわ.mp3` | night-town, yomi |
| 14 | まち | 城鎮 | `まち.mp3` | night-town, yomi |
| 15 | みち | 道路 | `みち.mp3` | night-town, yomi |
| 16 | はし | 橋樑 | `はし.mp3` | night-town, yomi |
| 17 | こうえん | 公園 | `こうえん.mp3` | night-town, yomi |
| 18 | がっこう | 學校 | `がっこう.mp3` | night-town, yomi |
| 19 | うえ | 上面 | `うえ.mp3` | rain-port, yomi |
| 20 | した | 下面 | `した.mp3` | rain-port, yomi |
| 21 | なか | 裡面 | `なか.mp3` | rain-port, yomi |
| 22 | そと | 外面 | `そと.mp3` | rain-port, yomi |
| 23 | ちかく | 附近 | `ちかく.mp3` | rain-port, yomi |
| 24 | とおく | 遠處 | `とおく.mp3` | rain-port, yomi |
| 25 | でんしゃ | 電車 | `でんしゃ.mp3` | rain-port, yomi |
| 26 | じてんしゃ | 自行車 | `じてんしゃ.mp3` | rain-port, yomi |
| 27 | えきいん | 站員 | `えきいん.mp3` | rain-port, yomi |
| 28 | はる | 春季 | `はる.mp3` | sakura-pass, yomi |
| 29 | なつ | 夏季 | `なつ.mp3` | sakura-pass, yomi |
| 30 | あき | 秋季 | `あき.mp3` | sakura-pass, yomi |
| 31 | ふゆ | 冬季 | `ふゆ.mp3` | sakura-pass, yomi |
| 32 | もり | 森林 | `もり.mp3` | sakura-pass, yomi |
| 33 | かわ | 河流 | `かわ.mp3` | sakura-pass, yomi |
| 34 | きょう | 今天 | `きょう.mp3` | sakura-pass, yomi |
| 35 | あした | 明天 | `あした.mp3` | sakura-pass, yomi |
| 36 | きのう | 昨天 | `きのう.mp3` | sakura-pass, yomi |
| 37 | いま | 現在 | `いま.mp3` | sakura-pass, yomi |
| 38 | あさ | 早晨 | `あさ.mp3` | sakura-pass, yomi |
| 39 | よる | 夜晚 | `よる.mp3` | sakura-pass, yomi |
| 40 | ひる | 白天 | `ひる.mp3` | sakura-pass, yomi |
| 41 | じかん | 時間 | `じかん.mp3` | sakura-pass, yomi |
| 42 | ぷん | 分鐘 | `ぷん.mp3` | sakura-pass, yomi |
| 43 | いちにち | 一日 | `いちにち.mp3` | sakura-pass, yomi |
| 44 | あか | 紅色 | `あか.mp3` | bamboo-maze, yomi |
| 45 | あお | 藍色 | `あお.mp3` | bamboo-maze, yomi |
| 46 | しろ | 白色 | `しろ.mp3` | bamboo-maze, yomi |
| 47 | くろ | 黑色 | `くろ.mp3` | bamboo-maze, yomi |
| 48 | みどり | 綠色 | `みどり.mp3` | bamboo-maze, yomi |
| 49 | きいろ | 黃色 | `きいろ.mp3` | bamboo-maze, yomi |
| 50 | おおきい | 巨大的 | `おおきい.mp3` | bamboo-maze, yomi |
| 51 | ちいさい | 微小的 | `ちいさい.mp3` | bamboo-maze, yomi |
| 52 | たかい | 高聳的 | `たかい.mp3` | bamboo-maze, yomi |
| 53 | ひくい | 矮矮的 | `ひくい.mp3` | bamboo-maze, yomi |
| 54 | ながい | 長長的 | `ながい.mp3` | bamboo-maze, yomi |
| 55 | みじかい | 短短的 | `みじかい.mp3` | bamboo-maze, yomi |
| 56 | あたらしい | 嶄新的 | `あたらしい.mp3` | bamboo-maze, yomi |
| 57 | ふるい | 陳舊的 | `ふるい.mp3` | bamboo-maze, yomi |
| 58 | おおい | 多量的 | `おおい.mp3` | bamboo-maze, yomi |
| 59 | すくない | 少量的 | `すくない.mp3` | bamboo-maze, yomi |
| 60 | いい | 良好的 | `いい.mp3` | bamboo-maze, yomi |
| 61 | ひとつ | 一個 | `ひとつ.mp3` | bamboo-maze, yomi |
| 62 | ふたつ | 兩個 | `ふたつ.mp3` | bamboo-maze, yomi |
| 63 | みっつ | 三個 | `みっつ.mp3` | bamboo-maze, yomi |
| 64 | たくさん | 許多 | `たくさん.mp3` | bamboo-maze, yomi |
| 65 | すこし | 稍微 | `すこし.mp3` | bamboo-maze, yomi |
| 66 | みず | 開水 | `みず.mp3` | hyakki-kyoto, yomi |
| 67 | ごはん | 米飯 | `ごはん.mp3` | hyakki-kyoto, yomi |
| 68 | にく | 肉類 | `にく.mp3` | hyakki-kyoto, yomi |
| 69 | やさい | 蔬菜 | `やさい.mp3` | hyakki-kyoto, yomi |
| 70 | たまご | 雞蛋 | `たまご.mp3` | hyakki-kyoto, yomi |
| 71 | くだもの | 水果 | `くだもの.mp3` | hyakki-kyoto, yomi |
| 72 | さけ | 日本酒 | `さけ.mp3` | hyakki-kyoto, yomi |
| 73 | さら | 盤子 | `さら.mp3` | hyakki-kyoto, yomi |
| 74 | ちゃわん | 飯碗 | `ちゃわん.mp3` | hyakki-kyoto, yomi |
| 75 | すし | 壽司 | `すし.mp3` | hyakki-kyoto, yomi |
| 76 | みせ | 商店 | `みせ.mp3` | hyakki-kyoto, yomi |
| 77 | おかね | 錢幣 | `おかね.mp3` | hyakki-kyoto, yomi |
| 78 | かいもの | 購物 | `かいもの.mp3` | hyakki-kyoto, yomi |
| 79 | えん | 日圓 | `えん.mp3` | hyakki-kyoto, yomi |
| 80 | ねだん | 價格 | `ねだん.mp3` | hyakki-kyoto, yomi |
| 81 | て | 手部 | `て.mp3` | snow-temple, yomi |
| 82 | あし | 腳部 | `あし.mp3` | snow-temple, yomi |
| 83 | め | 眼睛 | `め.mp3` | snow-temple, yomi |
| 84 | みみ | 耳朵 | `みみ.mp3` | snow-temple, yomi |
| 85 | くち | 嘴巴 | `くち.mp3` | snow-temple, yomi |
| 86 | あたま | 頭部 | `あたま.mp3` | snow-temple, yomi |
| 87 | からだ | 身體 | `からだ.mp3` | snow-temple, yomi |
| 88 | は | 牙齒 | `は.mp3` | snow-temple, yomi |
| 89 | いく | 前往 | `いく.mp3` | snow-temple, yomi |
| 90 | くる | 來到 | `くる.mp3` | snow-temple, yomi |
| 91 | もどる | 返回 | `もどる.mp3` | snow-temple, yomi |
| 92 | はしる | 奔跑 | `はしる.mp3` | snow-temple, yomi |
| 93 | あるく | 步行 | `あるく.mp3` | snow-temple, yomi |
| 94 | とまる | 停步 | `とまる.mp3` | snow-temple, yomi |
| 95 | はいる | 進入 | `はいる.mp3` | snow-temple, yomi |
| 96 | でる | 走出 | `でる.mp3` | snow-temple, yomi |
| 97 | みる | 看見 | `みる.mp3` | snow-temple, yomi |
| 98 | きく | 聆聽 | `きく.mp3` | snow-temple, yomi |
| 99 | たべる | 進食 | `たべる.mp3` | snow-temple, yomi |
| 100 | のむ | 飲用 | `のむ.mp3` | snow-temple, yomi |
| 101 | いう | 說話 | `いう.mp3` | snow-temple, yomi |
| 102 | まつ | 等待 | `まつ.mp3` | snow-temple, yomi |
| 103 | おきる | 起床 | `おきる.mp3` | snow-temple, yomi |
| 104 | ねる | 就寢 | `ねる.mp3` | snow-temple, yomi |
| 105 | うれしい | 開心的 | `うれしい.mp3` | spirit-ferry, yomi |
| 106 | たのしい | 愉快的 | `たのしい.mp3` | spirit-ferry, yomi |
| 107 | かなしい | 悲傷的 | `かなしい.mp3` | spirit-ferry, yomi |
| 108 | さむい | 寒冷的 | `さむい.mp3` | spirit-ferry, yomi |
| 109 | あつい | 炎熱的 | `あつい.mp3` | spirit-ferry, yomi |
| 110 | すずしい | 涼爽的 | `すずしい.mp3` | spirit-ferry, yomi |
| 111 | あたたかい | 溫暖的 | `あたたかい.mp3` | spirit-ferry, yomi |
| 112 | すき | 喜愛的 | `すき.mp3` | spirit-ferry, yomi |
| 113 | きらい | 討厭的 | `きらい.mp3` | spirit-ferry, yomi |
| 114 | じょうず | 擅長的 | `じょうず.mp3` | spirit-ferry, yomi |
| 115 | へた | 不擅長的 | `へた.mp3` | spirit-ferry, yomi |
| 116 | しずか | 安靜的 | `しずか.mp3` | spirit-ferry, yomi |
| 117 | にぎやか | 熱鬧的 | `にぎやか.mp3` | spirit-ferry, yomi |
| 118 | ありがとう | 謝謝 | `ありがとう.mp3` | spirit-ferry, yomi |
| 119 | すみません | 不好意思 | `すみません.mp3` | spirit-ferry, yomi |
| 120 | おはよう | 早安 | `おはよう.mp3` | spirit-ferry, yomi |
| 121 | こんにちは | 你好 | `こんにちは.mp3` | spirit-ferry, yomi |
| 122 | こんばんは | 晚上好 | `こんばんは.mp3` | spirit-ferry, yomi |
| 123 | さようなら | 再見 | `さようなら.mp3` | spirit-ferry, yomi |
| 124 | はい | 是的 | `はい.mp3` | spirit-ferry, yomi |
| 125 | いいえ | 不是 | `いいえ.mp3` | spirit-ferry, yomi |
