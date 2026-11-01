# 清理狀態與保留規則（2026-10-24）

## 實際完成
- 舊關卡圖像：已依 SHA256 清單刪除 567 張、約 620 MB。art/ 已被 Git 忽略，刪除清單**不是備份**：art/archive/2026-10-24/ART_PURGE_RESULT.json。
- 第一關正式美術來源未動，但 9 張無引用歷史 QA 預覽已刪除、2 張測試證據移至 docs/archive/2026-10/visual-evidence/；第二關保留已採用的八張地板、五棟 Nano 建築、五種道具、海／崖，和核准的敵人及 Boss 原稿。
- S2 原稿 32 張圖片已從 art/s2/ 與帶日期 Nano 目錄合併回 art/stage2-rain-port/scene/；移動前後 SHA256：art/archive/2026-10-24/STAGE2_SOURCE_MOVE.json。
- S3–S8 只剩各 stage manifest.json 中列出的 STYLE_REFERENCE_ONLY，S3 新 candidate 未核准；舊 manifest／QA metadata 已另外封存。
- 舊文件 61 份移往 docs/archive/2026-10/，映射與 SHA256 見 ARCHIVE-INDEX.json；工作入口 AGENTS.md/README.md 舊版見 old-entrypoints/。
- 具歷史價值的 Nano 生圖 prompt / 付費請求及退件 metadata 放 art/archive/2026-10-24/legacy-material/，不再混入關卡 scene/。

## 仍待安全收尾
- 線上 master 0e5875d 已部署第二關新 WebP；本機 dirty 主工作樹仍在舊提交，BOSS JS 未提交。禁止 reset/clean/force pull。
- assets/img/sakura-pass/ 舊版五張 WebP 已從本機刪除，js/assets.js 暫用第一關已核准圖片備援。這不是 Stage3 的正式新美術，正式頁的舊版尚未重新部署。
- assets/img/rain-port/ 的舊備援和 DEV 檔，必須先核 consumer 與發布支線再另票清除；不能直接刪到第一、二關正式版。
- 老測試若仍斷言 art/s2/ 原檔存在，屬過期契約，應更新到新 scene/ 映射。

## 之後維護
新稿必須在 art/stageN-關卡/scene/ 或 characters/。每關一份 manifest.json；關卡根層僅少數審核用 Preview。歷史 QA/派工由 docs/archive/ 與 scratch/ 分流，非必要不讀。
\n- 本機第三關已刪除的 5 張 runtime WebP 另外記錄於 art/archive/2026-10-24/STAGE3_RUNTIME_PURGE.json；正式網站尚未將本機本輪改動部署。\n\n## 最終驗證限制
- 完整 npm test **exit=1**，M1、難度、BOSS 與部分 UI/舊契約斷言 RED；已通過的只限 stage-art-reset、S2 canonical source、media-cache 等專項測試。詳情見 CLEANUP_REPORT_20261024.md。
