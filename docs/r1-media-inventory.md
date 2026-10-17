# 妖怪快遞社：R1 全 164 詞語音與圖像資產映射總庫 (R1 Media Inventory)

> [!NOTE]
> 本文件由本輪唯一素材寫入者（AGY / Gemini 3.8 Flash）於 2026-10-13 依據 ChatGPT 經 Herdr 授權最新狀態更新。
> 記錄 164 個全域獨立單詞之 **175 筆磁碟語音資產**、**38 筆現存真實單字插畫** 與 **126 筆下一批待辦清單**。

---

## 1. 總體進度統計看板 (Progress Dashboard)

- **全域獨立單詞總數**：`164 詞`
- **語音資產 (MP3)**：
  - 磁碟真檔總數：`175 筆`（39 舊錄音 + 125 Haruka SAPI 新錄音 + 11 長音別名，100% 格式對齊 24kHz Mono 80kbps）
  - 程式接線狀態：39 筆已接進 `WORD_FILES`，136 筆真檔已就緒於 `assets/audio/words/`（依分工交 Cursor 後續接入）
- **圖像資產 (WebP 256×256)**：
  - **已完成真實插畫**：`38 筆`（包含首輪 6 筆 + 本輪新增 32 筆，和風 Q 版半水墨/半浮世繪真檔，無 emoji 占位）
  - **缺圖／下一批待辦清單**：`126 筆`（逐詞列管並附構圖指引）
  - 程式接線狀態：圖像檔案就緒於 `assets/img/words/` 與 `art/r1/`，未改動 JS，交 Cursor 後續接入

---

## 2. 本輪新增 32 筆高品質單字插畫明細 (Batch 2 Delivered)

| 單字 (jp) | 讀音 (kana) | 漢字 | 中文 (zh) | 檔名 (assets/img/words/) | 視覺語意與構圖實作細節 |
|---|---|---|---|---|---|
| いぬ | inu | 犬 | 狗 | `inu.webp` | 柴犬造型、黃白毛色、黑鼻、紅項圈與金鈴鐺 |
| うさぎ | usagi | 兎 | 兔子 | `usagi.webp` | 雪白和兔、長粉耳、紅寶石眼珠與雙爪蜷臥 |
| とり | tori | 鳥 | 鳥 | `tori.webp` | 停於綠葉枯枝之青羽小雀、朱紅短喙與展翼姿態 |
| さかな | sakana | 魚 | 魚 | `sakana.webp` | 躍出水面的紅金錦鯉、波浪水紋與金邊鱗片 |
| かめ | kame | 亀 | 烏龜 | `kame.webp` | 六角龜甲紋青綠厚殼、憨厚探頭與綠色四蹼 |
| かえる | kaeru | 蛙 | 青蛙 | `kaeru.webp` | 荷葉上蹲坐的碧綠雨蛙、大鼓圓眼與淡黃腹部 |
| たこ | tako | 蛸 | 章魚 | `tako.webp` | 紅頭圓章魚、捲曲吸盤觸手、圓嘴與噴吐氣泡 |
| つき | tsuki | 月 | 月亮 | `tsuki.webp` | 夜幕中金黃新月、夜霧水墨暈染與漂浮星屑 |
| ほし | hoshi | 星 | 星星 | `hoshi.webp` | 燦爛四角金芒星、光暈環繞與四角小星屑 |
| かみなり | kaminari | 雷 | 雷 | `kaminari.webp` | 黑紫雷雲中劈裂直下的金黃折線雷芒 |
| ゆき | yuki | 雪 | 雪 | `yuki.webp` | 六角對稱精緻雪晶、淡藍冰芒與中央菱核 |
| やま | yama | 山 | 山 | `yama.webp` | 浮世繪富嶽形態、深藍山體、山頂鋸齒白雪與旭日 |
| かわ | kawa | 川 | 河流 | `kawa.webp` | 兩岸綠草青石夾道、湍急藍白水流與中央旋渦波紋 |
| ふね | fune | 船 | 船 | `fune.webp` | 和風木造小舟、揚起白帆、破浪前進與海波紋 |
| くるま | kuruma | 車 | 汽車/車輛 | `kuruma.webp` | 和風御所牛車、黑漆車頂、朱紅車廂與巨大雙木輪 |
| ひこうき | hikouki | 飛行機 | 飛機 | `hikouki.webp` | 穿越雲海之紅身雙翼復古滑翔機與螺旋槳 |
| えき | eki | 駅 | 車站 | `eki.webp` | 車站候車亭屋頂、立柱、月台站名木牌與掛燈 |
| はし | hashi | 橋 | 橋樑 | `hashi.webp` | 跨越流水之朱紅太鼓木拱橋與金色擬寶珠欄杆 |
| こうえん | kōen | 公園 | 公園 | `kouen.webp` | 櫻花盛開樹冠、木造公園長凳與青綠草坪 |
| おにぎり | onigiri | お握り | 飯糰 | `onigiri.webp` | 飽滿白米三角飯糰、深綠海苔片與頂部紅梅 |
| りんご | ringo | 林檎 | 蘋果 | `ringo.webp` | 雙瓣飽滿深紅蘋果、高光反射、木蒂與綠葉 |
| おちゃ | ocha | お茶 | 茶 | `ocha.webp` | 粗陶茶碗中翠綠茶湯、碗緣光影與裊裊熱氣 |
| ラーメン | ramen | — | 拉麵 | `ramen.webp` | 青花瓷大碗、拉麵湯底、溏心蛋切片、海苔與竹筷 |
| パン | pan | — | 麵包 | `pan.webp` | 烘烤金黃的吐司麵包、頂部劃刀裂紋與香氣線條 |
| ほん | hon | 本 | 書 | `hon.webp` | 和裝線裝古書、藍布封面、四孔裝訂白線與題簽 |
| かさ | kasa | 傘 | 雨傘 | `kasa.webp` | 撐開之朱紅和風油紙番傘、竹傘骨與彎柄 |
| つくえ | tsukue | 机 | 書桌 | `tsukue.webp` | 檜木矮几桌板、穩固桌腿、桌上硯台與橫放毛筆 |
| いす | isu | 椅子 | 椅子 | `isu.webp` | 雅致和風木椅、橫木靠背、椅面與實木椅腿 |
| たべる | taberu | 食べる | 進食 | `taberu.webp` | 【動作情境】竹筷夾起冒熱氣的美味肉丸送入口中 |
| のむ | nomu | 飲む | 飲用 | `nomu.webp` | 【動作情境】雙手捧起綠茶碗啜飲、水滴微漾 |
| はしる | hashiru | 走る | 奔跑 | `hashiru.webp` | 【動作情境】綁腿草鞋邁步飛奔、腳下揚起煙塵動線 |
| ねる | neru | 寝る | 就寢 | `neru.webp` | 【動作情境】藍色和風被褥、平整白枕與安睡 Zzz 符號 |

---

## 3. 全 164 詞逐詞狀態大表 (現有／已產出／下一批排程)

| # | 單字 (jp) | 假名 (kana) | 漢字 | 中文 (zh) | 品詞 | 音訊檔名 | 語音狀態 | 圖像檔名 | 圖像完成狀態 | 關卡 |
|---:|---|---|---|---|---|---|---|---|:---:|---|
| 1 | ねこ | ねこ | 猫 | 貓 | 名詞 | `neko.mp3` | 🟢 磁碟已就緒 | `neko.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 2 | いぬ | いぬ | 犬 | 狗 | 名詞 | `inu.mp3` | 🟢 磁碟已就緒 | `inu.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 3 | うさぎ | うさぎ | 兎 | 兔子 | 名詞 | `usagi.mp3` | 🟢 磁碟已就緒 | `usagi.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 4 | さかな | さかな | 魚 | 魚 | 名詞 | `sakana.mp3` | 🟢 磁碟已就緒 | `sakana.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 5 | うみ | うみ | 海 | 海 | 名詞 | `umi.mp3` | 🟢 磁碟已就緒 | `umi.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 6 | たこ | たこ | 蛸 | 章魚 | 名詞 | `tako.mp3` | 🟢 磁碟已就緒 | `tako.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 7 | つき | つき | 月 | 月亮 | 名詞 | `tsuki.mp3` | 🟢 磁碟已就緒 | `tsuki.webp` | 🟢 已完成正式圖 | sakura-pass, yomi |
| 8 | ほし | ほし | 星 | 星星 | 名詞 | `hoshi.mp3` | 🟢 磁碟已就緒 | `hoshi.webp` | 🟢 已完成正式圖 | sakura-pass, yomi |
| 9 | にじ | にじ | 虹 | 彩虹 | 名詞 | `niji.mp3` | 🟢 磁碟已就緒 | `niji.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 10 | りんご | りんご | 林檎 | 蘋果 | 名詞 | `ringo.mp3` | 🟢 磁碟已就緒 | `ringo.webp` | 🟢 已完成正式圖 | hyakki-kyoto, yomi |
| 11 | おにぎり | おにぎり | お握り | 飯糰 | 名詞 | `onigiri.mp3` | 🟢 磁碟已就緒 | `onigiri.webp` | 🟢 已完成正式圖 | hyakki-kyoto, yomi |
| 12 | ケーキ | ケーキ | — | 蛋糕 | 名詞 | `keeki.mp3` | 🟢 磁碟已就緒 | `keeki.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 13 | えき | えき | 駅 | 車站 | 名詞 | `eki.mp3` | 🟢 磁碟已就緒 | `eki.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 14 | ほん | ほん | 本 | 書 | 名詞 | `hon.mp3` | 🟢 磁碟已就緒 | `hon.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 15 | かさ | かさ | 傘 | 雨傘 | 名詞 | `kasa.mp3` | 🟢 磁碟已就緒 | `kasa.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 16 | くるま | くるま | 車 | 汽車 | 名詞 | `kuruma.mp3` | 🟢 磁碟已就緒 | `kuruma.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 17 | ふね | ふね | 船 | 船 | 名詞 | `fune.mp3` | 🟢 磁碟已就緒 | `fune.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 18 | ひこうき | ひこうき | 飛行機 | 飛機 | 名詞 | `hikouki.mp3` | 🟢 磁碟已就緒 | `hikouki.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 19 | さくら | さくら | 桜 | 櫻花 | 名詞 | `sakura.mp3` | 🟢 磁碟已就緒 | `sakura.webp` | 🟢 已完成正式圖 | sakura-pass, yomi |
| 20 | やま | やま | 山 | 山 | 名詞 | `yama.mp3` | 🟢 磁碟已就緒 | `yama.webp` | 🟢 已完成正式圖 | sakura-pass, yomi |
| 21 | はな | はな | 花 | 花 | 名詞 | `hana.mp3` | 🟢 磁碟已就緒 | `hana.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 22 | おちゃ | おちゃ | お茶 | 茶 | 名詞 | `ocha.mp3` | 🟢 磁碟已就緒 | `ocha.webp` | 🟢 已完成正式圖 | hyakki-kyoto, yomi |
| 23 | ラーメン | ラーメン | — | 拉麵 | 名詞 | `raamen.mp3` | 🟢 磁碟已就緒 | `raamen.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 24 | パン | パン | — | 麵包 | 名詞 | `pan.mp3` | 🟢 磁碟已就緒 | `pan.webp` | 🟢 已完成正式圖 | hyakki-kyoto, yomi |
| 25 | とり | とり | 鳥 | 鳥 | 名詞 | `tori.mp3` | 🟢 磁碟已就緒 | `tori.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 26 | かめ | かめ | 亀 | 烏龜 | 名詞 | `kame.mp3` | 🟢 磁碟已就緒 | `kame.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 27 | かえる | かえる | 蛙 | 青蛙 | 名詞 | `kaeru.mp3` | 🟢 磁碟已就緒 | `kaeru.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 28 | あめ | あめ | 雨 | 雨 | 名詞 | `ame.mp3` | 🟢 磁碟已就緒 | `ame.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 29 | かぜ | かぜ | 風 | 風 | 名詞 | `kaze.mp3` | 🟢 磁碟已就緒 | `kaze.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 30 | くも | くも | 雲 | 雲 | 名詞 | `kumo.mp3` | 🟢 磁碟已就緒 | `kumo.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 31 | きり | きり | 霧 | 霧 | 名詞 | `kiri.mp3` | 🟢 磁碟已就緒 | `kiri.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 32 | かみなり | かみなり | 雷 | 雷 | 名詞 | `kaminari.mp3` | 🟢 磁碟已就緒 | `kaminari.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 33 | ゆき | ゆき | 雪 | 雪 | 名詞 | `yuki.mp3` | 🟢 磁碟已就緒 | `yuki.webp` | 🟢 已完成正式圖 | rain-port, yomi |
| 34 | みぎ | みぎ | 右 | 右邊 | 名詞 | `migi.mp3` | 🟢 磁碟已就緒 | `migi.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 35 | ひだり | ひだり | 左 | 左邊 | 名詞 | `hidari.mp3` | 🟢 磁碟已就緒 | `hidari.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 36 | まえ | まえ | 前 | 前面 | 名詞 | `mae.mp3` | 🟢 磁碟已就緒 | `mae.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 37 | うしろ | うしろ | 後ろ | 後面 | 名詞 | `ushiro.mp3` | 🟢 磁碟已就緒 | `ushiro.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 38 | きた | きた | 北 | 北方 | 名詞 | `kita.mp3` | 🟢 磁碟已就緒 | `kita.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 39 | みなみ | みなみ | 南 | 南方 | 名詞 | `minami.mp3` | 🟢 磁碟已就緒 | `minami.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 40 | ひと | ひと | 人 | 人 | 名詞 | `hito.mp3` | 🟢 磁碟已就緒 | `hito.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 41 | ともだち | ともだち | 友達 | 朋友 | 名詞 | `tomodachi.mp3` | 🟢 磁碟已就緒 | `tomodachi.webp` | 🟡 待下一批排程 | night-town, yomi |
| 42 | こども | こども | 子供 | 小孩 | 名詞 | `kodomo.mp3` | 🟢 磁碟已就緒 | `kodomo.webp` | 🟡 待下一批排程 | night-town, yomi |
| 43 | おんなのこ | おんなのこ | 女の子 | 女孩 | 名詞 | `onnanoko.mp3` | 🟢 磁碟已就緒 | `onnanoko.webp` | 🟡 待下一批排程 | night-town, yomi |
| 44 | おとこのこ | おとこのこ | 男の子 | 男孩 | 名詞 | `otokonoko.mp3` | 🟢 磁碟已就緒 | `otokonoko.webp` | 🟡 待下一批排程 | night-town, yomi |
| 45 | いえ | いえ | 家 | 房屋 | 名詞 | `ie.mp3` | 🟢 磁碟已就緒 | `ie.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 46 | まど | まど | 窓 | 窗戶 | 名詞 | `mado.mp3` | 🟢 磁碟已就緒 | `mado.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 47 | つくえ | つくえ | 机 | 書桌 | 名詞 | `tsukue.mp3` | 🟢 磁碟已就緒 | `tsukue.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 48 | いす | いす | 椅子 | 椅子 | 名詞 | `isu.mp3` | 🟢 磁碟已就緒 | `isu.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 49 | でんき | でんき | 電気 | 電燈 | 名詞 | `denki.mp3` | 🟢 磁碟已就緒 | `denki.webp` | 🟡 待下一批排程 | night-town, yomi |
| 50 | かぞく | かぞく | 家族 | 家人 | 名詞 | `kazoku.mp3` | 🟢 磁碟已就緒 | `kazoku.webp` | 🟡 待下一批排程 | night-town, yomi |
| 51 | へや | へや | 部屋 | 房間 | 名詞 | `heya.mp3` | 🟢 磁碟已就緒 | `heya.webp` | 🟡 待下一批排程 | night-town, yomi |
| 52 | にわ | にわ | 庭 | 庭院 | 名詞 | `niwa.mp3` | 🟢 磁碟已就緒 | `niwa.webp` | 🟡 待下一批排程 | night-town, yomi |
| 53 | まち | まち | 町 | 城鎮 | 名詞 | `machi.mp3` | 🟢 磁碟已就緒 | `machi.webp` | 🟡 待下一批排程 | night-town, yomi |
| 54 | みち | みち | 道 | 道路 | 名詞 | `michi.mp3` | 🟢 磁碟已就緒 | `michi.webp` | 🟡 待下一批排程 | night-town, yomi |
| 55 | はし | はし | 橋 | 橋樑 | 名詞 | `hashi.mp3` | 🟢 磁碟已就緒 | `hashi.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 56 | こうえん | こうえん | 公園 | 公園 | 名詞 | `kouen.mp3` | 🟢 磁碟已就緒 | `kouen.webp` | 🟢 已完成正式圖 | night-town, yomi |
| 57 | がっこう | がっこう | 学校 | 學校 | 名詞 | `gakkou.mp3` | 🟢 磁碟已就緒 | `gakkou.webp` | 🟡 待下一批排程 | night-town, yomi |
| 58 | うえ | うえ | 上 | 上面 | 名詞 | `ue.mp3` | 🟢 磁碟已就緒 | `ue.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 59 | した | した | 下 | 下面 | 名詞 | `shita.mp3` | 🟢 磁碟已就緒 | `shita.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 60 | なか | なか | 中 | 裡面 | 名詞 | `naka.mp3` | 🟢 磁碟已就緒 | `naka.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 61 | そと | そと | 外 | 外面 | 名詞 | `soto.mp3` | 🟢 磁碟已就緒 | `soto.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 62 | ちかく | ちかく | 近く | 附近 | 名詞 | `chikaku.mp3` | 🟢 磁碟已就緒 | `chikaku.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 63 | とおく | とおく | 遠く | 遠處 | 名詞 | `tooku.mp3` | 🟢 磁碟已就緒 | `tooku.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 64 | でんしゃ | でんしゃ | 電車 | 電車 | 名詞 | `densha.mp3` | 🟢 磁碟已就緒 | `densha.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 65 | じてんしゃ | じてんしゃ | 自転車 | 自行車 | 名詞 | `jitensha.mp3` | 🟢 磁碟已就緒 | `jitensha.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 66 | えきいん | えきいん | 駅員 | 站員 | 名詞 | `ekiin.mp3` | 🟢 磁碟已就緒 | `ekiin.webp` | 🟡 待下一批排程 | rain-port, yomi |
| 67 | はる | はる | 春 | 春季 | 名詞 | `haru.mp3` | 🟢 磁碟已就緒 | `haru.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 68 | なつ | なつ | 夏 | 夏季 | 名詞 | `natsu.mp3` | 🟢 磁碟已就緒 | `natsu.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 69 | あき | あき | 秋 | 秋季 | 名詞 | `aki.mp3` | 🟢 磁碟已就緒 | `aki.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 70 | ふゆ | ふゆ | 冬 | 冬季 | 名詞 | `fuyu.mp3` | 🟢 磁碟已就緒 | `fuyu.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 71 | もり | もり | 森 | 森林 | 名詞 | `mori.mp3` | 🟢 磁碟已就緒 | `mori.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 72 | かわ | かわ | 川 | 河流 | 名詞 | `kawa.mp3` | 🟢 磁碟已就緒 | `kawa.webp` | 🟢 已完成正式圖 | sakura-pass, yomi |
| 73 | きょう | きょう | 今日 | 今天 | 名詞 | `kyou.mp3` | 🟢 磁碟已就緒 | `kyou.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 74 | あした | あした | 明日 | 明天 | 名詞 | `ashita.mp3` | 🟢 磁碟已就緒 | `ashita.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 75 | きのう | きのう | 昨日 | 昨天 | 名詞 | `kinou.mp3` | 🟢 磁碟已就緒 | `kinou.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 76 | いま | いま | 今 | 現在 | 名詞 | `ima.mp3` | 🟢 磁碟已就緒 | `ima.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 77 | あさ | あさ | 朝 | 早晨 | 名詞 | `asa.mp3` | 🟢 磁碟已就緒 | `asa.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 78 | よる | よる | 夜 | 夜晚 | 名詞 | `yoru.mp3` | 🟢 磁碟已就緒 | `yoru.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 79 | ひる | ひる | 昼 | 白天 | 名詞 | `hiru.mp3` | 🟢 磁碟已就緒 | `hiru.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 80 | じかん | じかん | 時間 | 時間 | 名詞 | `jikan.mp3` | 🟢 磁碟已就緒 | `jikan.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 81 | ぷん | ぷん | 分 | 分鐘 | 名詞 | `pun.mp3` | 🟢 磁碟已就緒 | `pun.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 82 | いちにち | いちにち | 一日 | 一日 | 名詞 | `ichinichi.mp3` | 🟢 磁碟已就緒 | `ichinichi.webp` | 🟡 待下一批排程 | sakura-pass, yomi |
| 83 | あか | あか | 赤 | 紅色 | 名詞 | `aka.mp3` | 🟢 磁碟已就緒 | `aka.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 84 | あお | あお | 青 | 藍色 | 名詞 | `ao.mp3` | 🟢 磁碟已就緒 | `ao.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 85 | しろ | しろ | 白 | 白色 | 名詞 | `shiro.mp3` | 🟢 磁碟已就緒 | `shiro.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 86 | くろ | くろ | 黒 | 黑色 | 名詞 | `kuro.mp3` | 🟢 磁碟已就緒 | `kuro.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 87 | みどり | みどり | 緑 | 綠色 | 名詞 | `midori.mp3` | 🟢 磁碟已就緒 | `midori.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 88 | きいろ | きいろ | 黄色 | 黃色 | 名詞 | `kiiro.mp3` | 🟢 磁碟已就緒 | `kiiro.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 89 | おおきい | おおきい | 大きい | 巨大的 | い形容詞 | `ookii.mp3` | 🟢 磁碟已就緒 | `ookii.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 90 | ちいさい | ちいさい | 小さい | 微小的 | い形容詞 | `chiisai.mp3` | 🟢 磁碟已就緒 | `chiisai.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 91 | たかい | たかい | 高い | 高聳的 | い形容詞 | `takai.mp3` | 🟢 磁碟已就緒 | `takai.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 92 | ひくい | ひくい | 低い | 矮矮的 | い形容詞 | `hikui.mp3` | 🟢 磁碟已就緒 | `hikui.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 93 | ながい | ながい | 長い | 長長的 | い形容詞 | `nagai.mp3` | 🟢 磁碟已就緒 | `nagai.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 94 | みじかい | みじかい | 短い | 短短的 | い形容詞 | `mijikai.mp3` | 🟢 磁碟已就緒 | `mijikai.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 95 | あたらしい | あたらしい | 新しい | 嶄新的 | い形容詞 | `atarashii.mp3` | 🟢 磁碟已就緒 | `atarashii.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 96 | ふるい | ふるい | 古い | 陳舊的 | い形容詞 | `furui.mp3` | 🟢 磁碟已就緒 | `furui.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 97 | おおい | おおい | 多い | 多量的 | い形容詞 | `ooi.mp3` | 🟢 磁碟已就緒 | `ooi.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 98 | すくない | すくない | 少ない | 少量的 | い形容詞 | `sukunai.mp3` | 🟢 磁碟已就緒 | `sukunai.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 99 | いい | いい | 良い | 良好的 | い形容詞 | `ii.mp3` | 🟢 磁碟已就緒 | `ii.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 100 | ひとつ | ひとつ | 一つ | 一個 | 名詞 | `hitotsu.mp3` | 🟢 磁碟已就緒 | `hitotsu.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 101 | ふたつ | ふたつ | 二つ | 兩個 | 名詞 | `futatsu.mp3` | 🟢 磁碟已就緒 | `futatsu.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 102 | みっつ | みっつ | 三つ | 三個 | 名詞 | `mittsu.mp3` | 🟢 磁碟已就緒 | `mittsu.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 103 | たくさん | たくさん | — | 許多 | 副詞 | `takusan.mp3` | 🟢 磁碟已就緒 | `takusan.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 104 | すこし | すこし | 少し | 稍微 | 副詞 | `sukoshi.mp3` | 🟢 磁碟已就緒 | `sukoshi.webp` | 🟡 待下一批排程 | bamboo-maze, yomi |
| 105 | みず | みず | 水 | 開水 | 名詞 | `mizu.mp3` | 🟢 磁碟已就緒 | `mizu.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 106 | ごはん | ごはん | ご飯 | 米飯 | 名詞 | `gohan.mp3` | 🟢 磁碟已就緒 | `gohan.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 107 | にく | にく | 肉 | 肉類 | 名詞 | `niku.mp3` | 🟢 磁碟已就緒 | `niku.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 108 | やさい | やさい | 野菜 | 蔬菜 | 名詞 | `yasai.mp3` | 🟢 磁碟已就緒 | `yasai.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 109 | たまご | たまご | 卵 | 雞蛋 | 名詞 | `tamago.mp3` | 🟢 磁碟已就緒 | `tamago.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 110 | くだもの | くだもの | 果物 | 水果 | 名詞 | `kudamono.mp3` | 🟢 磁碟已就緒 | `kudamono.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 111 | さけ | さけ | 酒 | 日本酒 | 名詞 | `sake.mp3` | 🟢 磁碟已就緒 | `sake.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 112 | さら | さら | 皿 | 盤子 | 名詞 | `sara.mp3` | 🟢 磁碟已就緒 | `sara.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 113 | ちゃわん | ちゃわん | 茶碗 | 飯碗 | 名詞 | `chawan.mp3` | 🟢 磁碟已就緒 | `chawan.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 114 | すし | すし | 寿司 | 壽司 | 名詞 | `sushi.mp3` | 🟢 磁碟已就緒 | `sushi.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 115 | みせ | みせ | 店 | 商店 | 名詞 | `mise.mp3` | 🟢 磁碟已就緒 | `mise.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 116 | おかね | おかね | お金 | 錢幣 | 名詞 | `okane.mp3` | 🟢 磁碟已就緒 | `okane.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 117 | かいもの | かいもの | 買い物 | 購物 | 名詞 | `kaimono.mp3` | 🟢 磁碟已就緒 | `kaimono.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 118 | えん | えん | 円 | 日圓 | 名詞 | `en.mp3` | 🟢 磁碟已就緒 | `en.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 119 | ねだん | ねだん | 値段 | 價格 | 名詞 | `nedan.mp3` | 🟢 磁碟已就緒 | `nedan.webp` | 🟡 待下一批排程 | hyakki-kyoto, yomi |
| 120 | て | て | 手 | 手部 | 名詞 | `te.mp3` | 🟢 磁碟已就緒 | `te.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 121 | あし | あし | 足 | 腳部 | 名詞 | `ashi.mp3` | 🟢 磁碟已就緒 | `ashi.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 122 | め | め | 目 | 眼睛 | 名詞 | `me.mp3` | 🟢 磁碟已就緒 | `me.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 123 | みみ | みみ | 耳 | 耳朵 | 名詞 | `mimi.mp3` | 🟢 磁碟已就緒 | `mimi.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 124 | くち | くち | 口 | 嘴巴 | 名詞 | `kuchi.mp3` | 🟢 磁碟已就緒 | `kuchi.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 125 | あたま | あたま | 頭 | 頭部 | 名詞 | `atama.mp3` | 🟢 磁碟已就緒 | `atama.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 126 | からだ | からだ | 体 | 身體 | 名詞 | `karada.mp3` | 🟢 磁碟已就緒 | `karada.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 127 | は | は | 歯 | 牙齒 | 名詞 | `ha.mp3` | 🟢 磁碟已就緒 | `ha.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 128 | いく | いく | 行く | 前往 | 動詞 | `iku.mp3` | 🟢 磁碟已就緒 | `iku.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 129 | くる | くる | 来る | 來到 | 動詞 | `kuru.mp3` | 🟢 磁碟已就緒 | `kuru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 130 | もどる | もどる | 戻る | 返回 | 動詞 | `modoru.mp3` | 🟢 磁碟已就緒 | `modoru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 131 | はしる | はしる | 走る | 奔跑 | 動詞 | `hashiru.mp3` | 🟢 磁碟已就緒 | `hashiru.webp` | 🟢 已完成正式圖 | snow-temple, yomi |
| 132 | あるく | あるく | 歩く | 步行 | 動詞 | `aruku.mp3` | 🟢 磁碟已就緒 | `aruku.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 133 | とまる | とまる | 止まる | 停步 | 動詞 | `tomaru.mp3` | 🟢 磁碟已就緒 | `tomaru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 134 | はいる | はいる | 入る | 進入 | 動詞 | `hairu.mp3` | 🟢 磁碟已就緒 | `hairu.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 135 | でる | でる | 出る | 走出 | 動詞 | `deru.mp3` | 🟢 磁碟已就緒 | `deru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 136 | みる | みる | 見る | 看見 | 動詞 | `miru.mp3` | 🟢 磁碟已就緒 | `miru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 137 | きく | きく | 聞く | 聆聽 | 動詞 | `kiku.mp3` | 🟢 磁碟已就緒 | `kiku.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 138 | たべる | たべる | 食べる | 進食 | 動詞 | `taberu.mp3` | 🟢 磁碟已就緒 | `taberu.webp` | 🟢 已完成正式圖 | snow-temple, yomi |
| 139 | のむ | のむ | 飲む | 飲用 | 動詞 | `nomu.mp3` | 🟢 磁碟已就緒 | `nomu.webp` | 🟢 已完成正式圖 | snow-temple, yomi |
| 140 | いう | いう | 言う | 說話 | 動詞 | `iu.mp3` | 🟢 磁碟已就緒 | `iu.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 141 | まつ | まつ | 待つ | 等待 | 動詞 | `matsu.mp3` | 🟢 磁碟已就緒 | `matsu.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 142 | おきる | おきる | 起きる | 起床 | 動詞 | `okiru.mp3` | 🟢 磁碟已就緒 | `okiru.webp` | 🟡 待下一批排程 | snow-temple, yomi |
| 143 | ねる | ねる | 寝る | 就寢 | 動詞 | `neru.mp3` | 🟢 磁碟已就緒 | `neru.webp` | 🟢 已完成正式圖 | snow-temple, yomi |
| 144 | うれしい | うれしい | 嬉しい | 開心的 | い形容詞 | `ureshii.mp3` | 🟢 磁碟已就緒 | `ureshii.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 145 | たのしい | たのしい | 楽しい | 愉快的 | い形容詞 | `tanoshii.mp3` | 🟢 磁碟已就緒 | `tanoshii.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 146 | かなしい | かなしい | 悲しい | 悲傷的 | い形容詞 | `kanashii.mp3` | 🟢 磁碟已就緒 | `kanashii.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 147 | さむい | さむい | 寒い | 寒冷的 | い形容詞 | `samui.mp3` | 🟢 磁碟已就緒 | `samui.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 148 | あつい | あつい | 暑い | 炎熱的 | い形容詞 | `atsui.mp3` | 🟢 磁碟已就緒 | `atsui.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 149 | すずしい | すずしい | 涼しい | 涼爽的 | い形容詞 | `suzushii.mp3` | 🟢 磁碟已就緒 | `suzushii.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 150 | あたたかい | あたたかい | 暖かい | 溫暖的 | い形容詞 | `atatakai.mp3` | 🟢 磁碟已就緒 | `atatakai.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 151 | すき | すき | 好き | 喜愛的 | な形容詞 | `suki.mp3` | 🟢 磁碟已就緒 | `suki.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 152 | きらい | きらい | 嫌い | 討厭的 | な形容詞 | `kirai.mp3` | 🟢 磁碟已就緒 | `kirai.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 153 | じょうず | じょうず | 上手 | 擅長的 | な形容詞 | `jouzu.mp3` | 🟢 磁碟已就緒 | `jouzu.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 154 | へた | へた | 下手 | 不擅長的 | な形容詞 | `heta.mp3` | 🟢 磁碟已就緒 | `heta.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 155 | しずか | しずか | 静か | 安靜的 | な形容詞 | `shizuka.mp3` | 🟢 磁碟已就緒 | `shizuka.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 156 | にぎやか | にぎやか | 賑やか | 熱鬧的 | な形容詞 | `nigiyaka.mp3` | 🟢 磁碟已就緒 | `nigiyaka.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 157 | ありがとう | ありがとう | — | 謝謝 | 感嘆詞 | `arigatou.mp3` | 🟢 磁碟已就緒 | `arigatou.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 158 | すみません | すみません | — | 不好意思 | 感嘆詞 | `sumimasen.mp3` | 🟢 磁碟已就緒 | `sumimasen.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 159 | おはよう | おはよう | — | 早安 | 感嘆詞 | `ohayou.mp3` | 🟢 磁碟已就緒 | `ohayou.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 160 | こんにちは | こんにちは | — | 你好 | 感嘆詞 | `konnichiwa.mp3` | 🟢 磁碟已就緒 | `konnichiwa.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 161 | こんばんは | こんばんは | — | 晚上好 | 感嘆詞 | `konbanwa.mp3` | 🟢 磁碟已就緒 | `konbanwa.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 162 | さようなら | さようなら | — | 再見 | 感嘆詞 | `sayounara.mp3` | 🟢 磁碟已就緒 | `sayounara.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 163 | はい | はい | — | 是的 | 感嘆詞 | `hai.mp3` | 🟢 磁碟已就緒 | `hai.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |
| 164 | いいえ | いいえ | — | 不是 | 感嘆詞 | `iie.mp3` | 🟢 磁碟已就緒 | `iie.webp` | 🟡 待下一批排程 | spirit-ferry, yomi |

---

## 4. 下一批待製作清單摘要 (Next Batch Queue, 126 詞)
- **生活町與人物 (13 詞)**：`こども`, `おんなのこ`, `おとこのこ`, `でんき`, `かぞく`, `へや`, `にわ`, `まち`, `みち`, `でんしゃ`, `じてんしゃ`, `えきいん`, `ともだち`
- **四季自然與時間 (18 詞)**：`はる`, `なつ`, `あき`, `ふゆ`, `もり`, `きょう`, `あした`, `きのう`, `いま`, `あさ`, `よる`, `ひる`, `じかん`, `ぷん`, `いちにち`, `にじ`, `くも`, `きり`
- **顏色與形容詞 (20 詞)**：`あか`, `あお`, `しろ`, `くろ`, `みどり`, `きいろ`, `おおきい`, `ちいさい`, `たかい`, `ひくい`, `ながい`, `みじかい`, `あたらしい`, `ふるい`, `おおい`, `すくない`, `いい`, `ひとつ`, `ふたつ`, `みっつ`
- **飲食與生活器皿 (14 詞)**：`みず`, `ごはん`, `にく`, `やさい`, `たまご`, `くだもの`, `さけ`, `さら`, `ちゃわん`, `すし`, `みせ`, `おかね`, `かいもの`, `ケーキ`
- **身體部位與動作 (22 詞)**：`て`, `あし`, `め`, `みみ`, `くち`, `あたま`, `からだ`, `は`, `いく`, `くる`, `もどる`, `あるく`, `とまる`, `はいる`, `でる`, `みる`, `きく`, `いう`, `まつ`, `おきる`, `うみ`, `はな`
- **情感、狀態與問候語 (24 詞)**：`うれしい`, `たのしい`, `かなしい`, `さむい`, `あつい`, `すずしい`, `あたたかい`, `すき`, `きらい`, `じょうず`, `へた`, `しずか`, `にぎやか`, `ありがとう`, `すみません`, `おはよう`, `こんにちは`, `こんばんは`, `さようなら`, `はい`, `いいえ`, `えん`, `ねだん`, `たくさん`, `すこし`
- **方位詞 (15 詞)**：`うえ`, `した`, `なか`, `そと`, `ちかく`, `とおく`, `みぎ`, `ひだり`, `まえ`, `うしろ`, `きた`, `みなみ`, `かぜ`
