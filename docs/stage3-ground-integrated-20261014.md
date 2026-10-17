# 第三關地面接入（2026-10-14）

狀態：**FINAL_GROUND_SCOPE_LIMITED，NOT_FULL_STAGE_APPROVAL**。只接妖櫻山道三張地面。不是整關核准，也不是小怪／Boss／神社／古木核准。直向過渡 **HUMAN_REVIEW／BLOCKED**。第一關 P0 與第二關石木硬切仍 BLOCKED。未 Commit／未 Push／未 Deploy。

## 接入

原樣複製，SHA-256 與候選圖一致：

- `assets/img/sakura-pass/ground_mountain_dirt.webp`
- `assets/img/sakura-pass/ground_trans_dirt_to_steps_h.webp`
- `assets/img/sakura-pass/ground_sakura_steps.webp`

沒有複製 `candidate_trans_dirt_to_steps_v.webp`。AGY 當時仍在工作；這三張的 hash 已與 manifest 相符才複製。沒有改 `art/`。

世界格以 512 對齊絕對座標。土路在磚欄 `tx < 3`（世界 X 1536 以西），`tx = 3`（1536–2048）只鋪一欄水平過渡，以東是石階。chunk 邊界 1800 落在這欄中間，材質不跟 chunk 切。三張都就緒才改畫；缺任何一張就留原本 `ground_dirt`，不畫雨港地板，也不畫漸層或白塊。只在 `start("sakura-pass")` 時載入。

`index.html` 的 `assets.js`／`renderer.js`／`game.js` 查詢字串改為 `?v=20261014-sakura-ground1`。`service-worker.js` 只加這三張圖的 revision。沒有跑會讀音檔的全媒體 hash。

## 測試

`node --check` 三支腳本：exit 0。

`node --test tests/stage3-ground-transitions.test.cjs tests/renderer.test.cjs tests/stage2-approved-enemies.test.cjs`：53 過、0 敗，exit 0。日志 `artifacts/validation/codex-lead-20261014-cursor/stage3-ground-tests.log`。沒有跑 `tests/media-cache.test.cjs`。

Chrome headless，不是 iPad 真機：桌面 1280×800、iPad 寬度 1194×834，各 2D（`?tilt=1`）與 2.5D。初載 0／150／600ms 三張都已 ready（本機快取，沒有抓到慢網缺圖）。走過接縫的 2.5D 畫面是左土、中間有機過渡、右石階，不是 47 色差那種直切。石階區仍看得到 512 方磚自接線，那是石階圖自己的重複，不是土石硬切。截圖在 `artifacts/validation/codex-lead-20261014-cursor/stage3-ground/`。

預覽：已在跑的 `http://127.0.0.1:8788/`。2D 加 `?tilt=1`。
