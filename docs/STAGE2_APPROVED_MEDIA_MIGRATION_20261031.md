# 第二關雨夜港町｜正式素材整理驗收紀錄（2026-10-31）

## 決策來源（不可混淆）

- **最終遊戲選用權威**：`assets/img/runtime-art-manifest.json` 裡 `stages.rain-port` 的 `runtime_status: APPROVED_RUNTIME / USER_SELECTED_RUNTIME`。
- **敵人正式核准權威**：`assets/img/rain-port/enemies/runtime-manifest-20261014.json` 的 `USER_APPROVED_FOR_RUNTIME`，內含 Sprite SHA256 和足部錨點。
- `assets/img/rain-port/s2-production/asset-manifest.json` 的 `ART_CANDIDATE` 是**當時的生圖審核狀態**；部分後來被正式選用，不能僅靠它判斷是否棄用，也不能盲目把全部素材升為正式。
- Boss 水系攻擊 `assets/img/runtime-art-manifest.json.boss_water_hazards` 的 3 組仍是 `BLOCKED`，且詳細美術紀錄為 `ART_CANDIDATE`；**未在本輪改接**。

## 已完成與實際遊戲讀取

| 類別 | 已核准且改成正式路徑 | 結果 |
|---|---:|---|
| 地板 | 1 份泥土主地、3 份木地、1 份石木接縫 = 5 份 | 正式使用的「泥土」取代舊石地，錨點不變 |
| 建築 | 5 | 調用原有裁切／尺寸設定 |
| 道具 | 5 | 來源 WebP 不變，位置由原本渲染器決定 |
| 海岸環境 | 2 | 海面與海岸懸崖 |
| 小怪／Boss 本體 | 4 | 潮目小僧 idle/attack、海坊主 idle/attack，足部／水位錨點維持 |
| **合計** | **17 場景 + 4 敵人 = 21 份** | SHA256 全部對照相符 |

在 `assets/img/runtime-art-manifest.json` 中，原路徑記為 `legacy_source_path`；在 `assets/img/rain-port/enemies/runtime-manifest-20261014.json` 中，記為 `legacy_runtime_path`。所有原圖仍在，保留後備。新正式場景清單是：

`assets/img/stages/rain-port/manifest.json`

敵人兩份清單：

`assets/img/enemies/minion-shiome/manifest.json`
`assets/img/enemies/boss-ikari-umibozu/manifest.json`

`tools/asset_registry.py` 現在**動態核對正式核准狀態和原始 SHA256**，只針對此 21 張設定 `route=true`。載入器 `js/assets.js` 的地板 kit、港口背景及敵人來源透過 `js/asset-paths.js` 取得新正式路徑；新路徑載入失敗時，回到原始 URL 一次後才算載入失敗。場景本身的尺寸、位置、圖層與繪製計算均未修改。

## 明確保留／不改動

- **四張舊 `g_stone_01..04` 石地主：** 早期選為輕量候選，但後期正式使用清單明確改成 `ground_mud_slab`，本次沒有把它們接進正式遊戲。之前為目錄整理而複製出的四張正式路徑副本已移到 `art/stage2-rain-port/archive/replaced-stone-copies-20261031/`。來源 `assets/img/rain-port/s2-production/g_stone_01..04.webp` 全部保留，供開發回溯。
- **水王 Boss 3 組圖像特效：** `tide`、`tidalFan`、`rainVortex` 保留舊位置與原本候選接線，不擅自改成「核准正式版」。後續美術與演出檢查才決定是否接入統一路徑。
- Stage2 技術用的候選／舊 fallback 圖片、其他關卡與敵人、技能卡、BGM、宅配音檔均保留；沒有重新生圖、轉碼或刪除原始資產。

## 測試結果與下一步

- 原始與新正式圖 SHA256 比對：21/21 相符；含場景 20 個 runtime placement（17 個 unique file）。
- `tests/stage2-approved-media-routes.test.cjs` 新增 3 項驗證：場景、敵人錨點、棄用石地和未核准 Boss 圖防誤接。
- `node --test tests/stage2-approved-media-routes.test.cjs tests/asset-registry.test.cjs tests/media-cache.test.cjs tests/audio-events.test.cjs tests/delivery-media-routes.test.cjs`：**41 項全部通過**。
- `node tools/build-media-cache.cjs` 已重建快取索引。
- **USER_PLAYTEST_PENDING**：請使用者本機打開第二關，檢查泥地、木棧道接縫、建築與物件繪製、Boss 本體與敵人動作。這些視覺項目非單靠路徑測試可確認。
- 後續必須查明水王 3 組特效是否已獲最新美術核准，再逐一整合和驗證；其他舊場景備援、候選物件不要批量刪除。

**沒有 Git commit / push / deploy。**
