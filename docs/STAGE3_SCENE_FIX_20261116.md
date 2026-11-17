# 第三關新版場景接回（2026-11-16 R2）

使用者指出 R1 未使用先前通過的泥土地＋單列石路變體，並重新提供五張原圖。本輪已接回這五張確切圖片，沒有重新生圖。

## 已修正

1. 新泥地來源 `image-gen-1(20261024-195404).png`：1254×1254 RGB。
2. 四張 1024×1536 RGBA 單列石路：`image-gen-1(20261025-033148).png`、`image-gen-2(20261025-033151).png`、`image-gen-4(20261025-033158).png`、`image-gen-3(20261025-033154).png`，分別接直／左／右／破損角色。
3. 原 PNG 位元相同保存在 `art/stage3-sakura-pass/scene/`；runtime 在 `assets/img/stages/sakura-pass/tiles/`，只做 lossless WebP 編碼，逐像素、原尺寸與 alpha 均核對相同。原有五張舊 runtime 圖全部保留。
4. `js/renderer.js` 改為單列長段落輪替。世界畫寬440；原比例高660，再套同一世界 Y spacing；邏輯段距620，避免將整條石路每174單位疊一次而鋪成大片石地。世界位置穩定，負座標與回走同樣生成。
5. 房屋缺圖的其中一個根因是 `s3art=1` 次要旗標：只進本機第三關卻沒帶這個旗標時，神社完全不載入。現在 `s3play=1` 本機入口會一起載入地形與現有神社，不必再加 `s3art=1`；`s3art=0` 仍可明確停用。公開網域維持阻擋。

**房屋交付限制**：現有神社已能實際繪製。茶屋、山宿、山倉、拜殿的四張獨立圖在 Stage3 現行原稿及 runtime 均不存在；相關據點仍暫用神社圖，不宣稱五種房屋圖已完成。此輪沒有付費生圖或拿舊關建物冒充第三關新圖。

## 證據

1. `node --test tests/stage3-engine-20261116.test.cjs tests/stage3-house-density-depth.test.cjs tests/content-world.test.cjs tests/s2-published-release.test.cjs tests/media-cache.test.cjs`：**48 PASS / 0 FAIL**，包含第三關14項技術測試、單列長石路尺寸／角色輪替、無次要旗標也載神社、第一／二關及媒體快取保護。
2. `node --check js/assets.js`、`node --check js/renderer.js`、兩個修改 Python 工具的 AST 解析、`git diff --check` 通過。
3. `python tools/import-sakura-scene.py`：五圖原 PNG／WebP 解碼像素與透明通道相同；重跑不覆蓋不同內容。機讀來源／尺寸／SHA256 在 `assets/img/stages/sakura-pass/manifest.json`，原稿旁亦保留同份 manifest。
4. `node tools/build-media-cache.cjs` 更新本機內容快取。清冊只增加本輪五筆、保留每個既有登錄項；registry 的試玩 manifest 指向已登錄。`python tools/asset_registry.py --check` 仍 **exit 1**，僅回報開工前既有四個雨港音效未登錄，沒有新增未登錄 Stage3 圖片。
5. `docs/STAGE3_SELECTED_SCENE_HTTP_20261116.json`：本機入口及七個場景資源 **HTTP 200**；五張新圖的 HTTP 回傳位元 SHA256 與本機 manifest 相同。
6. `scratch/stage3-selected-static-preview.cjs` 只載入真 `world.js`、`viewport.js`、`renderer.js` 和實際圖片，輸出 `scratch/stage3-selected-scene-{2d,tilt}.png`，已檢視兩張圖的泥地／單列石路／神社。**沒有載入 game.js、模擬玩家、答題或通關，不能當成實機跑關通過。** 沙箱自帶瀏覽器路徑不存在（exit 1）、已安裝 Edge 在沙箱內管道被關閉（exit 1）；改用沙箱外隔離無頭 Edge 成功（exit 0），未安裝軟體、未保留測試瀏覽器設定檔。

## 試玩

<http://127.0.0.1:8788/?dev=1&s3play=1&stage=sakura-pass&perf=1>

重新整理一次，點「開發選關」→第三關→「直接進關」。原本帶 `s3art=1` 的連結也繼續有效。若服務停止，在專案根目錄執行 `node tools/serve-tilt.cjs`，保持 loopback 預設。

本輪只完成圖片接回與房屋載入修正，仍標 **USER_PLAYTEST_PENDING**。未 commit／push／deploy，未開放前輪遭拒絕的 LAN 服務，未改音檔／金鑰／BGM／角色進度。
