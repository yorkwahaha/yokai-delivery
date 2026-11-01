# 妖怪配送｜八關宅配詞庫與物件圖（2026-10-29）
> **最新核准狀態（2026-10-30）**：第一關夜行町 20 個 icon 已經由使用者核准，正式接線在 `assets/img/delivery/night-town/`，可以直接在一般遊戲模式使用；第二至七關仍是待審候選。第一關也已製作 Fish Audio A/B 兩聲線各 20 詞、Google 日語 TTS 後備，詳見 `docs/NIGHT_TOWN_FISH_AUDIO_20261030.md`。下方各段是歷史製作紀錄，不代表最新批准狀態。


- 主題：S1 夜行町居家文具、S2 雨夜港町海鮮料理、S3 妖櫻山道花草茶亭、S4 竹影迷宮山村蔬菜、S5 百鬼京都市集食物、S6 雪燈山寺冬季用品、S7 幽世渡口旅行書信。
- S1–S7 各 20 件互不重複，共 **140** 個宅配實物詞；S8 黃泉境仍複習 140 詞，優先 20 件已選代表貨物，不新增重複進度。
- 正式詞庫唯一來源：`js/delivery-lexicon.js`，由 `js/words.js` 沿用各關分組數（共 32 個 pack）。既有舊 pack、熟練度與配送印記不刪除；存檔按日文 `jp` 鍵存有歷史資料，照舊留存。
- 新詞缺既有 MP3 時使用 `js/audio.js` 現成 ja-JP speechSynthesis 降級，**未修改/重建語音檔**。正式發音包仍待另輪生成。
- 本機 ComfyUI（非付費服務）QwenImage 2.1 依統一指令產生七張 5x4 物件圖表，拆成 140 張半水墨／浮世繪／和紙風格 WebP 候選。來源及種子見各 `art/delivery-icons/<stage>/manifest_candidate.json`。
- 審圖入口：`art/delivery-icons/preview.html`，每關總覽＋20 個單項圖＋標記重畫清單。
- **美術狀態：ART_CANDIDATE_NOT_APPROVED。** 正式模式不使用未審圖；候選僅限本機 loopback `?dev=1&deliveryArt=1`，並與正式存檔隔離；正式圖示仍使用既有核准 WebP 或臨時 emoji，等待使用者批准替換。
- 圖示共用路由：`js/delivery-icon-art.js`；`js/ui.js`、`js/game.js` 的跟隨貨物、任務提示、屋前牌子共用同一來源。不因改詞庫把抽象方位變成玩家背後文字牌。
- 美術目標：單一實體、無字、透明底、粗墨線、低彩度和紙顏料、日本插畫，優先 40px 可辨識。港口魚種（鮭／鮪／鯖／鯛）應特別驗輪廓。
- **2026-10-30 美術回饋修正**：用戶指定 S1 七件、S2 十二件共 19 件重畫；嚴禁使用 ChatGPT ImageGen 輸出的三張不同風格圖。已再次以**同一台本機 ComfyUI 與相同 Qwen Image 2.1 workflow**繪製。兩組新候選存於 `art/delivery-icons/{night-town,rain-port}/rerender-qwen-v2/`，原本 `*_candidate.webp` 不覆蓋。
- 第二關其餘八件仍沿用舊圖，只去掉模型烙印在物件下方的漢字與假名，並重新置中；S2 的二十張候選目前均由 `rerender-qwen-v2/` 提供。
- 審圖 `preview.html` 預設看最新混合候選，按「顯示原版圖片（比較）」可以切換前後版本；遊戲中的新美術仍只限本機 `?dev=1&deliveryArt=1`。
- **2026-10-30 第三版原始風格修正**：前輪 Qwen v2 雖用同模型，卻擅自改寫美術提示詞，造成畫風不一致，**v2 只供比較**。此輪調整 `tools/generate_delivery_icons_local.py`：抽出唯一原始 `build_original_prompt` 與 `ORIGINAL_NEGATIVE_PROMPT`，由 `tools/rerender_delivery_original_style_v3.py` 引用；沿用原始五欄四列／18 步／ComfyUI workflow。第二關的魚種僅在逐項物件描述加強輪廓，不動 Art direction。
- 最新重繪候選：`art/delivery-icons/night-town/rerender-original-style-v3/` 七張、`art/delivery-icons/rain-port/rerender-original-style-v3/` 十二張；第二關未勾選的八張沿用原畫去字版 `rerender-qwen-v2/`，正式美術均待使用者批准。
- `preview.html` 現可循環比較「第三版原始提示詞重繪」、「第一批原始」、「第二版風格不符」三版本；全部原圖保留，本機遊戲試圖僅在 `?dev=1&deliveryArt=1` 導向新圖。
- **2026-10-30 夜行町六件第四版**：用本機 ComfyUI Qwen Image 2.1，直接引用 `build_original_prompt` 及 `ORIGINAL_NEGATIVE_PROMPT`，5×4、18 步。只補強報紙、橡皮擦、尺、紙、牙刷、肥皂的主體描述，seed 20286119／20286120／20286121 三次抽卡。從中分別選種子：報紙 20286121、橡皮擦 20286121、尺 20286121、紙 20286119、牙刷 20286121、肥皂 20286121。六張統一收在 `art/delivery-icons/night-town/rerender-original-style-v4/selected/`，組合總覽 `review_contact.webp`；繪圖源檔、三組種子及前三版全部保留，未正式批准。
- 美術審核頁預設第四版，按「切換版本」可比較第四、第三、第二、第一版。開發版 `?dev=1&deliveryArt=1` 會讀夜行町六件第四版（鉛筆仍是第三版），正式遊戲不使用未批准圖片。**往後重繪請只調整物件描述與 seed，切勿自行改寫 style 與 negative prompt。**
- 沒有提交、推送或部署；等玩家審圖與實測。
