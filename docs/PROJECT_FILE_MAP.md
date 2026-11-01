# Yokai Delivery — 八關檔案地圖（2026-10-26）

**Agent 要找檔案先看 docs/STAGE_PATHS.json。** 那是最短的、可機讀的八關路徑；除需了解規則外不用讀本文全文。

**全遊戲正式素材規範：** `docs/ASSET_CONVENTIONS.md`、`docs/ASSET_REGISTRY.json`。所有場景、敵人、技能卡／特效、UI、BGM、SFX 與語音共用固定分類；既有 runtime 舊路徑依相容索引漸進遷移，詳細盤點見 `docs/ASSET_INVENTORY.json`。

**宅配單字圖與錄音統一規範：** [docs/DELIVERY_MEDIA_PATHS.md](DELIVERY_MEDIA_PATHS.md)。七關一律用 `assets/img/delivery/<stage-id>/NN.webp`、`assets/audio/delivery/<stage-id>/NN.mp3`（NN=01–20）；僅核准者接正式路由；舊 Fish 試音封存於 `art/audio/fish-night-town/archive/legacy/`。

**唯一根目錄**：`I:/Projects/yokai-delivery/`，其他三個同名日期資料夾已於 2026-10-26 移除。原發布版留 Git `release/s2-assets-20261024` 分支；不再有 release 平行工作樹。舊版程式救援 ZIP 在被忽略的 `.cleanup-archive/`，第三至八關第一份設定底圖只保留於 `docs/archive/2026-10/original-stage-concepts/`，這些不是正式美術或 Agent 常規搜尋路徑。移除清單見 `docs/cleanup/20261026-CONSOLIDATION.md`。

## 專案固定層級

~~~text
I:/Projects/yokai-delivery/
├── AGENTS.md / roadmap.md / README.md
├── index.html / service-worker.js
├── js/                         # 遊戲程式
├── assets/
│   ├── img/                     # 已核准遊戲會載入的資產
│   │   ├── scenery/             # 第一關/共用地景
│   │   ├── rain-port/           # 第二關 runtime
│   │   ├── sakura-pass/         # 已刪除；Stage3 暫時由 scenery/ 借圖
│   │   ├── ui/ vfx/ words/ yokai/
│   │   └── overworld_approved_v2.webp
│   └── audio/                   # 保護，不隨美術整理移動
├── art/                         # 原稿（Git 忽略）
│   ├── stage1-night-town/
│   ├── stage2-rain-port/
│   ├── stage3-sakura-pass/
│   ├── stage4-bamboo-maze/
│   ├── stage5-hyakki-kyoto/
│   ├── stage6-snow-temple/
│   ├── stage7-spirit-ferry/
│   ├── stage8-yomi/
│   └── archive/2026-10-24/
├── docs/                        # 現行文件，archive/2026-10/ 是歷史
├── tests/                       # 自動化驗證
├── tools/                       # 生產及檢測腳本
└── scratch/                     # 只作臨時輸出，非正式資料來源
~~~

## 第一關是所有關卡的唯一模板

~~~text
art/stageN-<stage-id>/
├── scene/                       # G/g 地板、T/t 轉場、H 房屋、O 道具
├── characters/                  # E 敵人、B Boss（沒有正式角色可省略）
├── manifest.json                # 唯一現存參考／核准列表
├── README.md                    # 人審與待辦概覽
└── Preview_*.webp/png           # 少量全景參考圖（可沒有）
~~~

### 八關速查

| 關卡 | 來源圖位置 | 目前狀態 |
|---|---|---|
| 1 夜行町 night-town | art/stage1-night-town/ | 定稿 |
| 2 雨夜港町 rain-port | art/stage2-rain-port/ | 選定來源合併 scene/＋characters/ |
| 3 妖櫻山道 sakura-pass | art/stage3-sakura-pass/ | 僅形象參考＋10/24新候選 |
| 4 竹影迷宮 bamboo-maze | art/stage4-bamboo-maze/ | 僅形象參考 |
| 5 百鬼京都 hyakki-kyoto | art/stage5-hyakki-kyoto/ | 僅形象參考 |
| 6 雪燈山寺 snow-temple | art/stage6-snow-temple/ | 僅形象參考 |
| 7 幽世渡口 spirit-ferry | art/stage7-spirit-ferry/ | 當前熱目錄無核准形象圖；第一份 floor 構想冷存 docs/archive/2026-10/original-stage-concepts/ |
| 8 黃泉境 yomi | art/stage8-yomi/ | 僅形象參考 |

**不要建立 art/s1～art/s8 或新的 production-日期-模型 資料夾。** 早期 art/s2 和 Stage2 Nano 深層來源已併入 art/stage2-rain-port/scene/；只有歷史 metadata 在 art/archive/ 供必要時追查。

## 第二關引用完全釐清

- **已發布網頁**（GitHub Pages master 0e5875d）：assets/img/rain-port/s2-production/ 裡 8 張輕量 WebP 地板與過渡、5 棟建築、5 個道具、海與崖。這是**網站實際圖片**。
- **本機主開發樹**（a4aaa94，尚有未提交的 BOSS 變動）：原始真圖在 art/stage2-rain-port/scene/；DEV ground kit 路徑已修，Nano DEV 讀 art/stage2-rain-port/manifest-dev-runtime.json。後續合併線上 master 需單 writer 執行，不可 reset/force pull。
- **地圖與地板是不同圖片**：旅路地圖 assets/img/overworld_approved_v2.webp；雨港關卡圖縮圖 assets/img/map_rain_port_v1.webp。場景地面由 ground kit 繪製，不是這兩張 map。

## 哪些圖片已清空？
- S1/S2 定稿保留；S3–S8 僅 manifest.json 中的 STYLE_REFERENCE_ONLY（Stage3 新 g_dirt_01.png 仍是候選）。
- 2026-10-24 清理的舊圖共 567 張、約 620 MB，逐項 SHA256、舊路徑見 art/archive/2026-10-24/ART_PURGE_RESULT.json。**刪除紀錄不是圖片備份，Git 不會替被忽略的 art/ 還原檔案。**
- 歷史付費 request、QA metrics、舊 manifest 留 metadata 在 art/archive/2026-10-24/legacy-material/。
- 第三關 assets/img/sakura-pass/ 的 5 張舊 WebP 已從本機清除；目前 js/assets.js 暫時重用 Stage1 的地板/神社/櫻花真圖作缺稿保底，等待 Stage3 真正新美術核准。

## Agent 查檔及遷移守則
1. 先讀 docs/STAGE_PATHS.json，**只讀該關 manifest.json 與 README.md**。不要對全 art/ 掃描。
2. 現有圖片被測試/JS/manifest 或在網站載入時，不擅自改名或刪除。
3. 新候選只進 scene/ 或 characters/，用短名，在 manifest 中註明真實 SHA、來源、審核狀態；未經使用者核准不當正式圖。
4. docs/archive/ 和 art/archive/ 是歷史，不得作最新派工或自動回填舊圖來源。
5. 任何 Git 整合先保護主工作樹 dirty、確認 Agent writers，後續部署另按使用者授權辦理。
