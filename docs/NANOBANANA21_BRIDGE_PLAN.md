# Yokai Delivery：Nano Banana 2.1 生圖橋接方案
制定：2026-10-20｜狀態：CLI橋接器已建立並完成DRY_RUN測試，尚未發出任何付費API呼叫／未讀取使用者API密鑰

## 目前已可操作的橋接器（2026-10-20 驗證）
- 實際檔案：tools/nanobanana_generate.py（獨立CLI、預設只dry-run、官方gemini-nano-banana-2.1、最大4張參考圖、限定候選目錄），第一組獨立prompt已在 art/fusion/requests/fusion_inkblade_main_v01.txt。
- 經本機實測：全域Python仍是 google-genai 1.72.0（已失效的Interactions格式，勿用來生圖）；已於 I:\Tools\NanoBanana21\.venv 安裝獨立 Python3.11 / google-genai **2.31.0** / Pillow **12.3.0**。新版SDK的乾跑、py_compile、模擬 interactions.create＋JPEG轉PNG＋manifest＋相同任務不重付費cache皆通過；**模擬不連外、不計費、不代表真API已通**。實際執行必須呼叫 `& "I:\Tools\NanoBanana21\.venv\Scripts\python.exe" tools\nanobanana_generate.py ...`，不要使用仍為1.72.0的`python`。此前兩次真API嘗試先後400報錯：PNG輸出不支援、舊版Interactions schema；橋接器目前使用image/jpeg且會在1.x SDK版本時提早阻止。
- 預演指令（Windows PowerShell；不付費）：
  python tools/nanobanana_generate.py --prompt-file art/fusion/requests/fusion_inkblade_main_v01.txt --output art/fusion/candidates/fusion_inkblade/main_v01.png --size 1K --aspect-ratio 3:2
- 未來在用戶明確授權費用及確認GEMINI_API_KEY屬於哪個專案後，以同一指令加 --execute --max-cost-usd 0.08，並在執行當下由使用者設定進程環境變數 NANOBANANA_APPROVED=YES。沒有這些條件，任何Agent都不得發付費API。
- 這個--max-cost-usd是估算前檢（1K圖片輸出US$0.0336＋US$0.02預留輸入費），**不是Google提供的帳單硬上限**；必須另外在Google Cloud管理實際帳單/項目配額。避免讓Agent自己設定授權環境變數，把用戶審核視為真正許可邊界。
- Codex/Herdr僅負責呼叫工具、管控工作與接圖；Nano Banana不能直接作為herdr agent start --kind的新增推理Agent。直到用戶授權第一張1K測試並看到真image＋manifest，現階段狀態仍是 API_UNTESTED / ART_WAITING_APPROVAL。

## 可行性與模型
- 官方 Gemini API 生圖模型代碼：gemini-nano-banana-2.1，支援文字＋參考圖生成、1K/2K/4K。官方文件：https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1
- Herdr 0.9.5 的 agent start --kind 清單沒有Nano Banana，也不是可任意註冊新Agent模型的框架；Gemini Nano Banana 2.1 官方模型卡不支援function calling，所以不宜直接當一個自主程式開發Agent。
- 正確方案：另設Herdr「Art Operator」工作位，由已支援的Codex/Kilo/其他Agent調用本機受控的generate_image CLI。CLI再透過Gemini官方SDK向Nano Banana 2.1發圖像生成請求，回傳檔案與審稿manifest。
- 若將來Herdr支援自訂工具/外部命令，也可在同一CLI外包一層本機MCP service；不必為了1個生圖功能額外開常駐服務。

## 最小架構（先CLI，不開本機對外網路服務）
Herdr Codex / Art Operator
→ 準備受審prompt + 已授權參考圖 + 尺寸 + 產圖批次ID
→ tools/nanobanana_generate.py（已建立，DRY_RUN通過，付費路徑待授權實測）
→ 官方 google-genai SDK → client.interactions.create（型號gemini-nano-banana-2.1）
→ 候選圖 art/fusion/candidates/<skill-id>/<phase>_vNN.png
→ 自動生成 manifest.json（輸出SHA、尺寸、model、promptSHA、參考圖SHA、產出時間、估計API花費、不含密鑰）
→ Codex對位/美術審稿→使用者選定→AGY/Kilo接線到正式assets/img/vfx/fusion/。

建議 CLI 參數：
  --prompt-file PATH (必填)
  --reference PATH (可重複)
  --output PATH (限定 art/fusion/candidates 子目錄)
  --aspect-ratio 1:1 或 3:2 或 2:3
  --size 1K | 2K | 4K
  --dry-run (預設：只驗證prompt/文件/預算，不執行API)
  --execute (必須明確取得用戶的付費API授權)
  --max-images 1 (每次最多1張)
  --job-id 唯一批次ID
  --max-cost-usd 已核准的單批費用上限

## 費用與配額（以官方2026-10已公布標準費率為參考）
Nano Banana 2.1 標準輸出費率：約US$0.0336/1K圖、US$0.0504/2K圖、US$0.113/4K圖，另計文字／參考圖輸入與可能的其他費用。
來源：https://ai.google.dev/gemini-api/docs/pricing
- API費用屬 Gemini Developer API 專案：不可直接把Antigravity的Gemini「週剩14%」當作API額度或免費生成次數，兩者需分別查Google帳單／配額。
- 任何批次在取得使用者核准的單次圖數及花費上限之前，預設只能dry-run；不得大量4K、並行觸發或遇失敗無限重試。
- 成本預估須含單張輸出費與合理額外費用，真正執行前由使用者確認；工具應設每批／每日最大數量、項目費用停止閾值。預設首張樣本只1K。
- 429配額錯誤直接停止、記錄安全錯誤狀態，不自動輪替到更貴模型或換另一個API key；5xx暫時故障最多重試1次。
- 同一promptSHA＋refsSHA＋model＋size＋aspect完全相同且已生成者，直接回傳已存候選，不再付費重新生圖。

## 密鑰安全
- 絕不讀取、搬運或解碼 Cherry Studio 儲存的 API key；用户自行在Windows憑證存放／安全環境變數 GEMINI_API_KEY 設定。嚴禁密鑰出現在Git、roadmap、命令列參數、manifest、截圖或log。
- CLI僅從進程環境載入金鑰，沒有環境變數就清楚返回「尚未設定」，不可自行搜尋其他磁碟文件取得密鑰。
- 限制可存取的產出路徑與檔名，不覆寫原正式圖檔、不操作包含音訊/KEY/Stage8的資料夾；必要的本機MCP限定127.0.0.1和白名單工具，不得暴露外部API端點。
- 未經用戶審核候選圖，狀態保持 ART_CANDIDATE，不直接部署到遊戲。透明背景/PNG alpha須獨立驗證，模型輸出不是保證透明的sprite。

## 實作分期
G0：規格＋正式美術交件規範＋prompt範本，CLI已建並通過DRY_RUN；無API呼叫、零付費，付費連通性仍未驗證。目前停在G0。
G1：Codex確認可用Python/SDK版本和已有安全憑證管理方式，提出單批USD花費上限與調用方式供用戶確認；不讀用戶key、不從Cherry Studio提取。
G2：得到用戶明示授權與API帳單上限後，才做tools/nanobanana_generate.py實作與1張1K試生，確認真圖片、模型、PNG MIME、尺寸、去背、成本、manifest及cache。
G3：試生通過後，建立Herdr中名為Art Operator的可用Agent工作位，使用受控CLI；允許Codex在用戶授權預算內派發小批候選，超額自動停止。
G4：用戶美術核准後，由AGY/Kilo接正式圖並驗2D/tilt.60與手機載入；與原本融合技能技術PASS分開記錄。

## 額度節流與排班
目前截圖：Gemini週14%、5小時54%；Claude/GPT雙池100%、Gemini4Argon週55%。
- Codex擔任管理、規格/接線QA；Kilo/Claude/GPT承接繁重重複的程式、CLI、測試工作。
- AGY只承接真實需要Gemini視覺評估的有限美術範圍；停止重讀138KB的roadmap、歷史bug重跑、無差異多輪產圖。
- 每Gate先最小聚焦測試；有重大差異才做真Chrome；同一錯誤重試兩次則派單回總監，不再盲目耗費Gemini 5h/週配額。
- 若本週Gemini先達到保護下限，使用者可以在Cherry Studio手動Nano Banana 2.1作畫，或先只保留提示詞 WAITING_ART；Codex不能聲稱自己已自動出圖。

## 用戶可直接在Cherry Studio手動執行的流程
打開Nano Banana 2.1→貼上 docs/FUSION_ART_PROMPTS.md 的指定主圖提示詞→附上已核准技能風格參考圖→先生1K草圖→用戶看過再生2K→存到art/fusion/candidates/...→由Agent去背、接圖並送審。

本文件只是完整橋接設計，沒有安裝、啟用或扣取任何API用量，也沒有生成圖片。
