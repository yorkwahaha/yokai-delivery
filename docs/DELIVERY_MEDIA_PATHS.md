# 妖怪快遞社｜宅配單字正式圖片與語音的唯一檔案規則

**最後整理：2026-10-31。** 本文件只規範每關的「單字貨物圖片與單字發音」，不包含場景、Boss、BGM、技能音效或過場動畫。它們維持各自的正式資產規則。

## 1. 兩個完全對稱的正式目錄

```text
assets/
  img/delivery/<stage-id>/
    01.webp
    02.webp
    ...
    20.webp
    manifest.json
  audio/delivery/<stage-id>/
    01.mp3
    02.mp3
    ...
    20.mp3
    manifest.json
```

- `<stage-id>` 必須使用下面表格指定的固定英文代碼。
- **編號必須為 01–20（兩位數）**。例如同一關的 `09.webp` 和 `09.mp3` 一定是同一個日語單字。**不要**把魚種、日文假名、模型、聲線、版本、種子加到正式檔名或正式目錄。
- 正式順序一律對應 `js/delivery-lexicon.js` 的該關 `words[0..19]`；每個資料夾的 `manifest.json` 列出日文 `jp`、漢字、中文、`index`、`file`，以及來源／發音元資料。
- 使用者已正式核准的圖音可標記 `APPROVED_BY_USER`；若使用者**明確要求先接遊戲試玩**，可以在同一套統一路徑放置已驗證的 01～20 素材，但 manifest 必須標記 `IN_GAME_TRIAL_PENDING_USER_REVIEW`，前端也須與核准清單分開。其他未經允許的候選不可進入正式遊戲路由。
- 第八關黃泉境複習前七關的單字，**不新增第八組重複檔案**，而是沿用對應單字的原關卡圖片及音訊。

## 2. 固定關卡 ID 與目前核准狀態

| 關卡 | stage-id | 正式圖片 | 正式語音 |
|---|---|---|---|
| 1 夜行町 | `night-town` | ✅ 20 張核准 | ✅ 20 段核准（Fish A） |
| 2 雨夜港町 | `rain-port` | 20 張已接本機試玩，待審 | 20 段 Fish A 已接本機試玩，待聽 |
| 3 妖櫻山道 | `sakura-pass` | 待審候選 | 待審 |
| 4 竹影迷宮 | `bamboo-maze` | 待審候選 | 待審 |
| 5 百鬼京都 | `hyakki-kyoto` | 待審候選 | 待審 |
| 6 雪燈山寺 | `snow-temple` | 待審候選 | 待審 |
| 7 幽世渡口 | `spirit-ferry` | 待審候選 | 待審 |

**目前實際遊戲載入的統一路徑：**

- 圖：`assets/img/delivery/night-town/01.webp` ～ `20.webp`
- 音：`assets/audio/delivery/night-town/01.mp3` ～ `20.mp3`
- 第二關（本機試玩待審）：`assets/img/delivery/rain-port/01.webp` ～ `20.webp`，`assets/audio/delivery/rain-port/01.mp3` ～ `20.mp3`；[審核紀錄](RAIN_PORT_DELIVERY_TRIAL_20261031.md)。
- `js/delivery-media.js` 是前端**唯一**用來核准及產生正式單字素材路徑的路由；`js/delivery-icon-art.js`（圖片）與 `js/delivery-fish-audio.js`／`js/audio.js`（語音）皆使用它。
- 語音無法載入時維持 `ja-JP` TTS 後備，Chrome 有 Google 日本語聲線時優先。
- 使用者核准的第一關語音：Fish Audio A 聲線 `97eda32449cf443bbc4b8782853ca554`、`s2.1-pro-free`、常用漢字優先，`はさみ`／`せっけん` 保留假名，無 pitch 標記。聲線及模型**只寫在 manifest，不會寫在正式 URL**。

## 3. 歷次候選與備份另行管理

| 用途 | 目錄 |
|---|---|
| 初稿與各次 ComfyUI／Qwen Image 重繪 | `art/delivery-icons/<stage-id>/` |
| Fish Audio 舊 A／B 與 A 漢字版來源（全部保留） | `art/audio/fish-night-town/archive/legacy/` |
| Fish Audio A／C 漢字對照 | `art/audio/fish-night-town/kanji-voices/` |
| Fish Audio 重音比較 | `art/audio/fish-night-town/accent-tests/` 與 `ja-phoneme-trial/` |
| 兩組舊聲線試聽頁 | `art/audio/fish-night-town/preview.html` |

候選版本可以用 `seed-`、`v3`、`a-kanji` 等詳細名稱；只有使用者核准，或明確授權接進本機試玩且**標示待審**的選定版本，才能複製到 `assets/{img,audio}/delivery/`。舊版是原始資料，不直接用於遊戲。

## 4. 後續每關接入時的一致流程

1. 先在 `art/` 產生、試聽及審核候選；確認每個 `01..20` 都符合對應詞彙。
2. 使用者批准正式使用，或明確要求先接本機試玩時，才將選定 20 個編為 `01..20`；試玩版必須以 `IN_GAME_TRIAL_PENDING_USER_REVIEW` 與正式 `APPROVED_BY_USER` 區隔。
3. 使用 `python tools/publish_delivery_media.py --stage rain-port --kind audio --source <暫存目錄> --dry-run` 檢查，正式批准後才使用 `--approved`。圖片把 `--kind` 改成 `image`。
4. 更新 `js/delivery-media.js` 內**對應 kind** 的 `approved` 或 `trial` 清單；圖片與音訊可分開試玩／核准。未核准也未授權試玩的素材不可開放。
5. 重新執行 `node tools/build-media-cache.cjs`，跑 `tests/delivery-media-routes.test.cjs`、`tests/media-cache.test.cjs` 與遊戲音訊測試。
6. 未收到提交／部署指令，不推送線上。

**切勿在其他每關檔案寫死 `/fish/`、`/a-kanji/`、`/rerender-v4/` 等正式路徑，也不要讓生成程式直接覆蓋已核准目錄。**
