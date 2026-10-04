# 第十九輪效能修正發布

1. 正式部署 SHA：`d561526fa47e1310c7a05214280abf8dbb3991c4`。只改 renderer 與入口快取版本；限制大視窗額外 DPR 像素、降低柔和光照遮罩解析度並快取靜態地面。沒有更改 Chrome 設定或玩法規則。
2. [Pages run 37195323565](https://github.com/yorkwahaha/yokai-delivery/actions/runs/37195323565) 與 build／deploy／report-build-status 全數 completed／success，headSha 與遠端 master 都符合部署 SHA。
3. 正式 index.html＋12 個 JS 全數 HTTP 200，SHA-256 與部署 Git blob 13/13 一致；`artifacts/validation/round19-deploy-proof.json` verified=true。
4. 153/153 測試通過，語法與差異檢查通過。受控 Windows Chrome 前景場景約 13.77→41.62 FPS，移動相機約 39.13 FPS；未穩定達 60，不能延伸為所有場景／晚期戰鬥或手機效能保證。完整量測与取捨見 PERFORMANCE_ROUND19_2026-10-04.md。
5. [新版本回測連結](https://yorkwahaha.github.io/yokai-delivery/?v=d561526)。使用者已回報圖形加速設定開啟；工具安全政策阻擋 chrome://gpu，實際 GPU backend 沒有核對。未部署較慢的光暈快取候選。
6. 臨時預覽與核對腳本已清除、預覽伺服器已停止。此發布報告與正式核對 proof 在部署後另作本機文件提交，不再次推送；較新的本機文件 HEAD 不代表另一個正式版本。
