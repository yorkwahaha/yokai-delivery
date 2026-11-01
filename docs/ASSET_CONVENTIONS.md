# Yokai Delivery｜全遊戲圖片與音檔正式資產規範

**版本：2026-10-31**　**適用：場景、地面、建築物、敵人、Boss、角色、技能卡、技能圖示、技能特效、UI、BGM、SFX、配音、宅配單字。**

## 唯一規則

- **正式可執行資產：`assets/img/`、`assets/audio/`；候選／種子／試音／退件／歷史原稿：`art/`。** 已存在的舊路徑因相容保留時，稱為「legacy」，不得因此將它們解釋成新規範。不得因路徑看起來舊就刪除。
- 所有正式 `id` 為 **英文小寫 kebab-case**；不可有空白、漢字、假名。檔名使用 `<id>__<role>[__<state>][__lvNN][__fNN].<ext>`，順序固定，無須的欄位省略。等級與 frame 補零（`lv01`、`f01`）。
- **正式路徑不能帶生成工具、種子、聲線或「final、final2、draft、candidate、v3」等製作資訊**；資料來源、模型 ID、聲線、版本、SHA256、尺寸請寫 `manifest.json`／`docs/ASSET_REGISTRY.json`。合法的物件名稱例外：`fish-workshop` 是建築物，不是 Fish Audio 工具。
- 宅配單字沿用例外：每關 `01.webp…20.webp` 與 `01.mp3…20.mp3` 同號，同關同單字，以 `js/delivery-lexicon.js` 的序號為準。
- 未經使用者核准的替代圖、語音、合成 VFX，**不可**冒稱正式核准。使用者明確指示「先接入本機試玩」者得以 `IN_GAME_TRIAL_PENDING_USER_REVIEW` 標記並在獨立 `trial` 路由啟用，待驗收後才升級為 `APPROVED_BY_USER`。第八關 `yomi` 直接復用前七關可用素材。
- 音效、BGM、場景與 UI 的舊路徑**過渡期間會保留**，不做覆寫或刪除。通過雜湊核對後，可以讓 loader 將該舊 URL 指向新正式檔案。相容 alias 只能存在一處，不許散落在 renderers。
- `assets/img/words` 與 `assets/audio/words` 是**舊教材單字備援**，不強行移至已核准的 `delivery`，避免混淆新詞庫。主角／Boss 等已有動畫圖片仍按原圖使用，待資產語意審核後才轉新的統一分類。

## 正式分類（全遊戲唯一）

| 類型 | 正式資料夾 | 正式範例 |
|---|---|---|
| 關卡場景 | `assets/img/stages/<stage-id>/scene/` | `night-town__house-shop.webp` |
| 關卡地面／石板 | `assets/img/stages/<stage-id>/tiles/` | `night-town__ground-dirt.webp` |
| 關卡物件 | `assets/img/stages/<stage-id>/props/`、`objects/` | `night-town__lantern.webp` |
| 普通敵人與 Boss | `assets/img/enemies/<enemy-id>/` | `water-spirit__sprite__idle.webp` |
| 玩家與 NPC | `assets/img/characters/<character-id>/` | `player__sprite__walk__f01.webp` |
| 技能卡／技能 icon | `assets/img/skills/<skill-id>/cards/`、`icons/` | `foxfire__card__lv05.webp` |
| 技能特效 | `assets/img/vfx/skills/<skill-id>/` | `foxfire__burst__lv05__f01.webp` |
| 敵人特效 | `assets/img/vfx/enemies/<effect-id>/` | `water-tornado__warning.webp` |
| UI | `assets/img/ui/{hud,menu,map,dialog,buttons,badges,icons}/` | `ui__lantern-oil.webp` |
| BGM | `assets/audio/bgm/{stages/<stage-id>,menu,boss,event}/` | `night-town__battle.mp3` |
| 技能 SFX | `assets/audio/sfx/skills/<skill-id>/` | `fire__cast__lv05.mp3` |
| 敵人 SFX | `assets/audio/sfx/enemies/<enemy-id>/` | `boss__death.mp3` |
| UI／系統／世界 SFX | `assets/audio/sfx/{ui,system,world}/` | `system__level-up.mp3` |
| 語音劇情 | `assets/audio/voice/<speaker-or-purpose>/` | `mentor__greeting.mp3` |
| 宅配圖片／配音 | `assets/{img,audio}/delivery/<stage-id>/` | `09.webp`、`09.mp3` |

固定 `stage-id`：`night-town`、`rain-port`、`sakura-pass`、`bamboo-maze`、`hyakki-kyoto`、`snow-temple`、`spirit-ferry`、`yomi`。

**名稱只表用途，不表來源：** 例如 `assets/audio/sfx/skills/fire/fire__ball__lv05.mp3` 不會因 Fish Audio、Google 或其他製作工具而換名稱。

## 現有素材的安全遷移（進行中）

本輪首次建立 `docs/ASSET_REGISTRY.json`（正式分類、路徑模板、從哪搬去哪、SHA256、是否生效）與 `docs/ASSET_INVENTORY.json`（全部現有影音清單；標記 canonical、legacy、需審核候選）。

`tools/asset_registry.py --build` 已按可確認的對應進行**同位元複製**：
- 3 段 BGM、25 段既有 SFX、第一關 8 張場景／道具 WebP、4 張正式 HUD 圖，以及上列 12 張敵人和 23 張技能 raster VFX → 新統一路徑、原檔保留；共 **75 筆**有第一輪 loader 的相容接線（不含第二關此次新增的 21 筆）。
- 另外將第一關既有的 **12 張敵人 WebP**、**23 張技能 raster VFX** 搬出無用途層級的舊目錄，透過相同路由表安全改接；原圖、動作圖皆位元不變。
- **2026-10-31 第二關正式接入**：依較新的 `assets/img/runtime-art-manifest.json` 選用清單，核對 SHA256 後，將 **17 張正式場景（泥地、木地、接縫、5 建築、5 道具、2 海岸）與 4 張已核准敵人／Boss 本體圖** 正式接上統一路由；保留舊圖作載入後備。四張遭泥土版取代的石地副本隔離至 `art/stage2-rain-port/archive/replaced-stone-copies-20261031/`。**Boss 水系特效 3 張仍為 BLOCKED，不在本次核准名單**。詳細 [第二關整理收據](STAGE2_APPROVED_MEDIA_MIGRATION_20261031.md)。
- 整理後共 **141 筆正式路徑映射，其中 96 筆已生效**（前輪 75 ＋ 第二關 21）。不覆寫、不刪除任何原始素材；另仍有 root 玩家圖、部分 UI 變體、SVG、舊 word 圖音等列入 inventory，標為 legacy 或 review-required。**未經語意核對的圖沒有擅自重新命名或宣稱已正式接入**。尤其存在於 `assets/` 的歷史候選，不可當成已批准素材。

`js/asset-paths.js` 是**由 Python 腳本生成**的路由表，正式程式的 `js/assets.js` 會在 BGM、SFX、第一關場景、第一關敵人、技能 raster VFX、HUD 的主要載入處使用，沒有匹配時原網址保持不變。音訊無法載入依原遊戲音效後備處理；宅配詞音仍使用 `js/delivery-media.js` 和 Google 日語 TTS 後備。

## 日後修改的唯一流程

1. 在 `art/` 製作新稿／試音並取得使用者批准，記錄詞彙、狀態、原稿及版號；**先搜尋 registry 與清單，再選檔案**。
2. 決定類型／ID／role／state／lv／frame，固定到 `ASSET_REGISTRY.json` 的模板。不可使用 `final2` 或模型名字當正式檔名。
3. 驗證來源和目標 SHA256，相同才能安全複製並更新 loader 映射；**不覆蓋內容不同的已核准檔案**。需要替換正式圖時，以獨立審核與小範圍修改處理。
4. 執行 `python tools/asset_registry.py --check`（檢查 影音檔未被意外新增或刪除、已映射兩端 SHA256 一致）、`node --test tests/asset-registry.test.cjs` 及相關窄測試。
5. 更動正式影音檔後執行 `node tools/build-media-cache.cjs` 更新快取版號，再由玩家試玩驗收。
6. **未獲要求不 commit / push / deploy / clean / reset。** 不可直接刪除舊 assets 或 art；等所有引用都已改接且驗收，才列入獨立清除清單。

文檔入口：`README.md`、`docs/PROJECT_FILE_MAP.md`、`docs/STAGE_PATHS.json`；宅配詞的特別規則詳見 `docs/DELIVERY_MEDIA_PATHS.md`。
