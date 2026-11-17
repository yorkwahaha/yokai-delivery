# 2026-11-16 R5｜四款樹群與自然疏密排列（最新）

依使用者「排列太整齊」的回饋，新增低矮橫展、高挑疏枝兩款真圖片；現有四款樹群混合使用，保留先前兩款原稿與執行圖。由固定世界座標種子分別控制橫向偏移、縱向間隔、尺寸、四款樹形、鏡射與 ±2° 左右的微傾；左右岸獨立取樣，回走不會重抽。仍使用既有 Y-sort 與 upright，未更改行走邊界、配送位置或其他關卡。

1. 新原稿：art/stage3-sakura-pass/scene/sakura-pass__forest-spreading.png、sakura-pass__forest-slender.png；執行圖位於 assets/img/stages/sakura-pass/props/ 的同名 WebP。使用內建 image_gen，完整提示詞與 SHA256 延續 [生成紀錄](STAGE3_FOREST_20261116.json)。新圖 ART_CANDIDATE_USER_REVIEW_PENDING，待本人審核。
2. 修改前 34 張素材的雜湊全數保留，只新增兩張；匯入器改為直接沿用來源與執行檔雜湊一致的既有圖片，不再重編碼。
3. 本輪 27 項聚焦測試 PASS（第三關工程14、素材／森林6、快取7）；語法檢查、素材登錄（1040檔／151 aliases/copies）、36張圖片解碼與HTTP／雜湊、31張候選透明留白通過。靜態HTTP共39個回應200，證據 [R5 HTTP](STAGE3_FOREST_NATURAL_HTTP_20261116.json)。
4. 真 renderer 的 2D／2.5D 新排列靜態圖已檢視：scratch/stage3-forest-natural-scene-2d.png、stage3-forest-natural-scene-tilt.png。未載入 game.js、未操作玩家或自動跑關；實機與主觀觀感待本人驗收。
5. 本機網址維持 <http://127.0.0.1:8788/?dev=1&s3play=1&stage=sakura-pass&perf=1>，重新整理→開發選關→第三關→直接進關；入口版號已更新。本輪無提交／推送／部署。

---

# 妖櫻山道兩側櫻花樹林（2026-11-16 R4）

ART_CANDIDATE_USER_REVIEW_PENDING / USER_PLAYTEST_PENDING / LOCAL_ONLY

依使用者要求，將道路兩側不可走區的黑色安全遮罩改成連續櫻花樹林。新增兩款不同的樹群，左右枝冠分別向道路延伸；樹群按世界座標固定排列、依腳底排序，使用現有 upright 投影，在 2D 與 2.5D 維持直立。原行走牆 x=900／1800、世界碰撞、建築位置、答題墊、泥地與石路均未修改。

## 圖片與來源

| 角色 | 原始 PNG | 執行時 WebP |
| --- | --- | --- |
| 左側櫻林 | art/stage3-sakura-pass/scene/sakura-pass__forest-left.png | assets/img/stages/sakura-pass/props/sakura-pass__forest-left.webp |
| 右側櫻林 | art/stage3-sakura-pass/scene/sakura-pass__forest-right.png | assets/img/stages/sakura-pass/props/sakura-pass__forest-right.webp |

使用本會話內建 image_gen，參照既有古櫻樹的水墨／浮世繪筆觸、粉櫻、深木與和紙質感；兩款均為普通自然樹林，無注連繩、燈籠或建築。完整提示詞、生成來源與檔案雜湊：[生成紀錄](STAGE3_FOREST_20261116.json)。原稿留存，透明裁切與 24px 安全邊由既有圖像工具完成；新圖列為待本人審核，未提升正式上線素材。

## 接線

1. 沿用 js/sakura-art-data.js、assets.js 的本機候選載入器，資料新增 forest 兩角色；公開網域不載入新圖。
2. renderer.sakuraForestActors 只產生可見視野附近的外側樹群，世界列固定且回走一致；沒有建立新碰撞或額外遊戲場景。
3. game.js 將樹群併入既有 Y-sort，樹冠可以遮住位於其後的場景；HUD 與配送標籤沿原流程顯示。
4. 兩張新圖皆已載入才移除原黑帶，圖片缺失保留安全遮罩。森林圖片到達會使地面快取失效，避免載入完成後仍留黑帶。
5. 入口版號與媒體 content revisions 已更新；匯入工具 tools/import-sakura-forest.py，以及既有批次重建工具，均保留兩款森林與先前素材。

## 驗證

1. 36 項局部測試 PASS：第三關工程 14、素材／森林 6、媒體快取 7、關卡發布狀態 1、第二關核准路徑 3、山道房屋 5。森林測試包含固定位置、根部位於外牆以外、前兩關隔離、圖片到達後快取更新。
2. 四個 JS 語法檢查及兩個 Python 工具 py_compile PASS。
3. 34 張場景／角色素材的解碼、HTTP 及 SHA256 通過；29 張候選透明與留白邊界通過，37 個靜態網址 HTTP 200。證據：[HTTP](STAGE3_FOREST_HTTP_20261116.json)。
4. 和修改前的 manifest 快照逐項比較，原有 32 張圖片雜湊全數保留，本輪僅新增 2 張森林圖。
5. 結尾 python tools/asset_registry.py --check PASS：1038 個檔案、151 組 aliases/copies，無漏登或未記錄位元組變更。本輪沒有修改音檔。
6. 真正 renderer 靜態圖已檢視：scratch/stage3-forest-scene-2d.png、stage3-forest-scene-tilt.png。腳本不載入 game.js，不操作玩家、不自動跑關。首次沙箱 Edge IPC 啟動失敗，改用獲准的沙箱外相同靜態腳本成功。

## 本機試玩

1. 重新整理 <http://127.0.0.1:8788/?dev=1&s3play=1&stage=sakura-pass&perf=1> →「開發選關」→第三關→「直接進關」。
2. 素材總覽 <http://127.0.0.1:8788/assets/img/stages/sakura-pass/review.html> 已加入左右森林。
3. 請本人確認左右林帶密度、靠近森林時的樹冠遮擋與兩種視角。實機操作、主觀美術、長局效能未驗收；未提交、推送或部署。
