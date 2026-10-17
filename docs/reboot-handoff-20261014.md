# Yokai Delivery — 重開機前停工與恢復分工（2026-10-14 23:03 台灣時間）

## 最高優先：使用者緊急停工指示

2026-10-14 23:03 使用者要求 **所有 Agent 立即停工，準備由使用者自行關閉 Herdr 並重啟 Windows**。此停工指示覆蓋 22:xx「Codex 自主連續派工直到做完」的啟動權限。**電腦重啟後，在使用者明確說「繼續工作」之前，一律不得自動恢復派工、生成圖片、執行測試、修改程式、部署，或在背景執行任何工作。**

實際停工：Codex `codex_lead` 的進行中工作已由 Herdr 主動取消，主狀態 `done`；Cursor、AGY、兩個 OpenCode 工作階段均為 `idle`；Codex `/ps` 已顯示 **No background terminals running**（原本兩個靜音本機預覽 server 已執行 `/stop` 關閉）。使用者負責關閉 Herdr 及重新開機；不由 Agent 殺掉 Herdr 伺服器或執行 Windows reboot。保留所有 dirty 修改、原有會話與交接證據；不 reset/clean/checkout。

## 重開機後，**使用者再次授權啟動**時的唯一分工

1. **Codex `codex_lead`**：執行總監，負責 Roadmap、工作票拆分/檔案獨占、重要跨檔整合/最終驗收；不能自己未經使用者指示恢復連續派工。
2. **OpenCode + OmniRoute Kiro Claude Sonnet 4.5**：主要 coding 實作、修 Bug、獨立審查／驗收，沿用已證實有效的路由 `omni_kiro/kr/claude-sonnet-4.5`，按 Codex 分工。
3. **AGY（Gemini）**：獨立圖片美術候選、場景/設計驗證與分配的任務。保留已生成的 Stage2 石板↔木棧道候選；未經使用者人審不可接入 runtime，也不可重生已核准素材。
4. **Kilo CLI + NVIDIA Nemotron 3 Ultra Free**：低成本第二組 coding/獨立 QA。注意現有 Kilo 另一工作階段曾配置為 `omniroute/kr/claude-sonnet-4.5`，**不得誤把 Kiro Sonnet 4.5 當作 Nemotron**；重新啟動時明確選 Kilo Gateway 的免費 Nemotron 3 Ultra，先核對實際模型與免費標籤，再派工。

**Cursor 全面暫停使用。** 使用者回報 Cursor 月額度僅剩約 20%、距重置約 19 天；沒有使用者日後明確許可前，不可啟動 Cursor、登入 Cursor CLI、或委派任何 Cursor Agent 工作。原 `cursor_prod` 會話及 `docs/cursor-production-handoff-20261014-22.md` 僅供參考/只讀，保留當前修改；原先「Cursor 獨占 production」「Cursor 用 Grok 4.7 High 新會話」等歷史指令均已由本分工取代。Space Bunny 與 Muse Spark OpenCode 免費額度已耗盡，恢復前不再派工；Vercel AI Gateway 本輪放棄。

## 中斷時工程狀態

- `I:\Projects\yokai-delivery` 仍有 **大量未提交/未追蹤檔案（300+）**；不得 reset/clean/checkout 或覆寫產物。以重開機後的 `git status`、最新 Roadmap、執行看板及交接為準。
- C4 言靈圖鑑套卡功能：Cursor 已交 runtime 與 Chrome/Node 自測，但獨立 QA 尚有後續；Sonnet QA 判定 R16-04（動物街三字只一字 4 印卻期待整包獎勵）及某些 harness ReferenceError 為測試腳本問題，非直接證實的產品 bug。勿將 C3/C4 美術/真機假寫完成。
- Stage2 石板↔木棧道新圖為 `WAITING_HUMAN`，不能在未人審前部署/替換；Stage1 P0 慢網/真機、C3/C4 視覺、Stage3/4 後續項目仍有 BLOCKED/WAITING_DEVICE。
- **凍結**：`assets/audio/**`、`js/audio.js`、TTS/BGM/API Key 不讀不改；未經批准的美術不接線；不執行 commit/push/deploy。Codex 應依 Roadmap 驗收四項發布門後再提請使用者核准。

## 恢復程序

收到使用者在重開機後的明確開工指令 → 查 Herdr `agent list` 與 OmniRoute/Kilo 的真實模型 → 查 `git status` 與 `docs/cursor-production-handoff-20261014-22.md`、`docs/roadmap-execution-board-20261014.md` → 由 Codex 重新按上面**四模型**分票，先解明確可驗證的 C4/QA 再推進 Roadmap。Cursor 始終暫停，沒有自動恢復日期。
