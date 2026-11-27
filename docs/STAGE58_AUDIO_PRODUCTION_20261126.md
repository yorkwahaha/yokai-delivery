# 第五至八關音訊製作紀錄

2026-11-28：公開課堂試玩使用 70 個音檔，其中 57 個由 Stable Audio 3 Medium 本機生成、10 個為配樂、3 個為既有音訊的 DSP 版本。選用檔、來源及 SHA256 見 [公開音訊 manifest](../assets/audio/stage58-manifest.json)。模型權重和生成原稿留在本機。

- Stability AI 的官方說明將自架 Stable Audio 3 Medium 列為 Community License 適用模型。研究／非商業與商業的條件不同。符合營收條件的商業用途仍須註冊，營收門檻為低於 US$1M。模型卡另列 Gemma 元件條款。專案擁有者仍須確認實際發布用途、適用資格與需要時的註冊紀錄。 [官方授權說明](https://kb.stability.ai/knowledge-base/stable-audio-commerical-and-usage-licensing) · [Community License](https://stability.ai/community-license-agreement) · [Stable Audio 3 Medium 模型卡](https://huggingface.co/stabilityai/stable-audio-3-medium) · [Gemma 條款](https://ai.google.dev/gemma/terms)
- 前四關獨立 Boss BGM 來自本機 ACE-Step 1.5 XL Turbo 及 ComfyUI 的 BF16 權重。四首生成種子、原稿及音檔 SHA256 在本機 `art/audio/early-boss-candidates/f9-production.json`。本機 Neon 修復只改播放增益，MP3 原始位元已另存至既有 `art/audio/stage-bgm-originals-20261122/`。 [ACE-Step XL 發布紀錄](https://github.com/ace-step/ACE-Step-1.5/releases) · [ComfyUI 權重與授權標示](https://huggingface.co/Comfy-Org/ACE-Step-1.5)

以下保留生成時的歷史紀錄。

2026-11-26 · `IN_GAME_TRIAL_PENDING_USER_REVIEW` · `USER_PLAYTEST_PENDING`

10 首配樂、4 支環境音、53 支事件音效，共 67 個候選 MP3，均已接入本機 DEV。候選約 21.1 MiB。FFmpeg 對全數檔案完成解碼與訊號檢查。桌面 Chrome 對四關的配樂、環境、首王登場、預警、爆發和小怪發射量到非零訊號，並覆蓋黃泉尾王、崩解及終章。人工音質、音樂純器樂內容、循環節拍與實體 iPad Safari 待驗。

- [集中試聽／下載 Lyria 提示詞](http://127.0.0.1:8008/stage-audio-review/)
- 開發選關 → 直接進關。[百鬼京都](http://127.0.0.1:8008/?dev=1&s3play=1&stageLab=1&stage=hyakki-kyoto) · [雪燈山寺](http://127.0.0.1:8008/?dev=1&s3play=1&stageLab=1&stage=snow-temple) · [幽世渡口](http://127.0.0.1:8008/?dev=1&s3play=1&stageLab=1&stage=spirit-ferry) · [黃泉境](http://127.0.0.1:8008/?dev=1&s3play=1&stageLab=1&stage=yomi)

## 原始缺漏與事件盤點

使用 CodeGraph 的 `selectStageBgm`、`stageLabCue` 源碼及呼叫關係，配合 `rg` 逐段核對 `spawnEnemy`、正式波次、`BOSS_AI.step`、`hurt`、`answerBoss` 與 `updateVictorySequence`。事件 ID、對應角色、觸發時機、所有路徑、英文提示詞、預計長度、優先序與預定 seed 在同一份 [DEV 事件清單](../js/stage58-audio.js)。使用者在驗收頁可查實際長度、模型、選用 seed、候選狀態及是否缺檔。

| 關卡 | 正式 Boss 與實際出招 | 小怪 | 上輪狀態 |
| --- | --- | --- | --- |
| 百鬼京都 | 太鼓門將、錦幡伶、太鼓門將、酒吞。三種封街視覺用同一鎖點／傷害流程，酒吞半血再接第二道。三角色各有登場、預警及爆發。 | 草履、鴉鈴、稻俵、木箱風妖共用近處生成。鴉鈴預警後只加速已有小怪，具報信與集結兩個聲部。木箱風妖射擊在建立飛彈時觸發。 | 戰鬥及 Boss 共用曲。登場、封街、報信、集結、射擊、近處出怪用合成音。舊京都檔名槽存在於程式資料，沒有對應 MP3 或活躍播放接線。環境無聲。 |
| 雪燈山寺 | 霜鐘石將、雪衣姬、霜鐘石將、雪嶺獅王。霜鐘環震、直橫冰風帶、暴雪環爪各有預警與爆發，半血第二圈重用暴雪爪兩段。 | 雪兔、雪鐮鼬、冰甲獾、雪燈僧共用近處生成。雪燈僧有冰彈發射。 | 戰鬥及 Boss 共用曲。三王登場、預警／爆發、射擊與近處出怪用合成音。風雪無環境音。 |
| 幽世渡口 | 靈河鎮岸獅、水鏡巫女、沉鐘鬼將、幽冥渡船使各有登場。鎮岸獅與鬼將共用圓形靈水爆。巫女橫浪、渡船使長篙掃擊分用不同兩段，渡船使半血追擊重用橫浪。 | 紙乘客、影河童、溺龜、船札靈共用近處生成。船札靈有水靈飛彈。 | 戰鬥及 Boss 共用曲。四王登場、預警／爆發、射擊與近處出怪用合成音。木橋與河面無環境音。 |
| 黃泉境 | 冥門骸武者、灰火祭姬、玄巖墓蛇、言靈之核各有登場。骸武者與墓蛇共用圓形灰爆。祭姬用裂線，核心用赤月環。核心半血追加裂線，歸零與演出終擊接同一崩解音。 | 燼靈、赤影奔妖、玄巖鬼、冥門祭妖共用近處生成。冥門祭妖有燼彈發射。 | 戰鬥及 Boss 共用曲。四王登場、預警／爆發、射擊與近處出怪用合成音。倒下沿用共用死亡錄音／一般 Boss 合成後備，結算沿用共用勝利提示，灰風無環境音。 |

四關的原始遊戲音檔使用共用戰鬥曲、共用頭目曲及共用死亡音效，這些檔案保留作後備。四關正式 Boss 的現行分支沒有生成獨立召喚怪或分身攻擊。京都集結只改已有普通怪狀態，勝利演出分身是無攻擊的視覺複本。共通式神、全關共用接觸傷害、打擊與教材音不列入關卡錄音。環境循環增加場景聲，現有場景沒有會觸發獨立聲響的可互動橋板或寺鐘開關。

| 關卡 | 戰鬥／頭目／終章曲 | 環境循環 | 頭目與小怪事件 | 待補檔案 |
| --- | ---: | ---: | ---: | ---: |
| 百鬼京都 | 2 | 1 | 14 | 0 |
| 雪燈山寺 | 2 | 1 | 12 | 0 |
| 幽世渡口 | 2 | 1 | 13 | 0 |
| 黃泉境 | 4 | 1 | 14 | 0 |
| 合計 | 10 | 4 | 53 | 0 |

## 模型、環境與商用條件

本機 RTX 4090 24 GB，ComfyUI Portable `0.46.0`（`a2103ae69d`），內嵌 Python 3.13.14、PyTorch 2.13.0+cu130、CUDA 13.0。使用既有的 `127.0.0.1:8188`，確認 `/system_stats`、`/object_info`、`/queue` 與原生載入、編碼、採樣和存檔節點。既有模型可直接用，模型下載、付費額度及系統安裝用量皆為 0。

| 模型 | 本輪使用與條件 |
| --- | --- |
| ACE-Step 1.5 XL Turbo BF16 | 10 首，本機 ComfyUI。實際權重 `acestep_v1.5_xl_turbo_bf16.safetensors`，配套 `qwen_0.6b_ace15`、`qwen_4b_ace15`、`ace_1.5_vae`。上游 ACE-Step 1.5 為 MIT，上游模型卡允許生成音樂商用。實際 Comfy-Org 重包裝權重標為 Apache-2.0。遊戲只使用生成音檔。 [上游模型與商用說明](https://huggingface.co/ACE-Step/Ace-Step1.5) · [實際權重](https://huggingface.co/Comfy-Org/ACE-Step-1.5) |
| Stable Audio 3 Medium | 57 個候選，本機 ComfyUI。使用 `stable_audio_3_medium.safetensors` 與 `t5gemma_b_b_ul2.safetensors`。Community License 允許符合條件的使用者商用，商用模型使用須向 Stability AI 註冊並核對組織與關係企業的年營收門檻（約 US$1M），超出門檻需企業授權。模型卡另列 Gemma 元件條款。未在本輪核對使用者營收或代辦註冊，57 檔維持本機候選。 [模型卡](https://huggingface.co/stabilityai/stable-audio-3-medium) · [ComfyUI 權重](https://huggingface.co/Comfy-Org/stable-audio-3) · [Stability AI 商用條件](https://stability.ai/license) · [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| Stable Audio 3 Small-SFX／Stable Audio Open 1.0 | 已評估。Small-SFX 可作低資源替代，本機未見權重。Open 1.0 權重已在，適合短音效；本輪 Medium 通過技術門檻，兩者均未送生成。各版本仍須依其官方授權確認。 [Small-SFX](https://huggingface.co/stabilityai/stable-audio-3-small-sfx) · [Open 1.0](https://huggingface.co/stabilityai/stable-audio-open-1.0) |
| MiniMax Music／Google Lyria 3.5 | 本輪無請求。未找到足以確認 MiniMax 零費及本帳戶商用資格的現行方案。Lyria 3.5 保留逐首英文提示詞，選用時依所用入口條款確認權利。 [MiniMax 官方定價](https://platform.minimax.io/docs/pricing/overview) · [Lyria 3.5 模型卡](https://deepmind.google/models/model-cards/lyria-3-5/) |

## 工作流、檔名與母帶

1. API 原型先跑京都戰鬥曲 35 秒及黃泉裂線爆發。兩檔可完整解碼，樣本曲尾有 5.38 秒低於 −38 dBFS，裂線樣本峰值 −0.1 dBFS，由此設定裁切和峰值餘裕。曲風、樂器辨識及音訊內容仍由人工試聽確認。
2. Stable Audio 8 步 LCM／simple、CFG 1。ACE-Step XL Turbo 8 步 Euler／simple、CFG 1、AuraFlow shift 3，音樂碼開啟、文字 CFG 2、temperature .85、top-p .90、歌詞欄 `[Instrumental]`。事件具有固定 seed。12 個攻擊爆發各有替代 take，尾王崩解也有替代 take。ComfyUI 的短音效 latent 下限為 1 秒，短於 1 秒的事件以 1 秒起跑，後製回到事件長度。京都小怪生成與錦幡伶預警各有兩次過短 take，改以持續摩擦聲提示和 2 秒 latent 重出，取 seed `584447`／`584770`。
3. 原始 FLAC 與對應完整 ComfyUI API JSON 在 `art/audio/stage58/raw/`，共 86 組已完成 take，含兩個初始樣本、替代及未選版本。ComfyUI 原輸出位置 `output/audio/yokai-stage58/`。選用表 `art/audio/stage58/production.json` 列實際 seed、原始檔、裁切位置、動態、循環處理、長度與位元組。挑選依完整解碼、有效長度、內部靜音、起音及峰值，聽感交由玩家驗收。
4. FFmpeg 9.0 做前後裁切、音量餘裕、短淡出與循環重疊。BGM 44.1 kHz、立體聲 160 kbps。環境音 44.1 kHz、立體聲 128 kbps。單發音效 44.1 kHz、單聲道 96 kbps。音樂、環境、頭目與小怪分別保留不同目標電平，每支受自身峰值上限限制。跨接區在曲尾與曲首各取樣，配樂 90 ms，環境音 850 ms。
5. 選定檔使用可機讀清單的精確相對路徑，`art/audio/stage58/bgm/stages/<stage-id>/`、`art/audio/stage58/sfx/enemies/<actor-id>/` 及 `art/audio/stage58/sfx/world/`。本機 preview server 只供應清單中的 MP3，原始音、工作流與外部來源候選不供應。補檔至清單路徑後重新整理頁面即可列入。候選一律留在 Git 忽略的 `art/`。

重現與獨立核對（執行完整生成會逐筆送入本機 ComfyUI，既有原稿與 MP3 預設跳過）：

```powershell
py -3 tools/produce-stage58-audio.py --sample --seed-offset 1000 hyakki-kyoto-battle yomi-fault-line.impact
py -3 tools/produce-stage58-audio.py
py -3 tools/produce-stage58-audio.py --seed-offset 2000 yomi-eclipse.impact yomi-core-collapse
py -3 tools/produce-stage58-audio.py --seed-offset 4000 --render-seconds 2 hyakki-kyoto-spawn hyakki-kyoto-kyoto-brocade-puppeteer-crossing.warning
py -3 tools/produce-stage58-audio.py --master --alternate-offset 1000 --alternate-offset 2000 --alternate-offset 4000
py -3 tools/produce-stage58-audio.py --verify scratch/stage58-audio/decode.json
$env:YOKAI_PREVIEW_PORT='8008'
node tools/serve-tilt.cjs
```

## 遊戲狀態與後備

進入後四關才準備本關資料和 SFX，起始畫面沒有大型關卡音訊請求。首隻正式頭目登場切入頭目曲，其他登場或剩餘頭目仍存在時保留同一首的播放進度。末隻退場且遭遇尚未完結時交叉淡回戰鬥曲。黃泉尾王破封轉尾王配樂，赤月自勝利演出 `7.1s` 開始淡出時切一次性終章曲，延至結算。如果缺檔，普通曲、頭目曲、終章分別使用既有戰鬥曲、共用 Boss 曲、共用勝利提示等後備。階段效果仍可回落既有合成提示或共用死亡錄音。缺檔由伺服器清單排除，已有檔案後續失敗則記住當次工作階段的失敗。

大招預警在鎖定範圍進入 telegraph 時播一次，爆發隨 active 起始播放，每段一次。半血追加按實際新預警再播，傷害持續期間不重播。登場音依 14 個實際角色分檔，重複波次共用角色錄音。聲部上限六支，其中低優先度最多三支，同一投射音節流 0.5 秒，近處出怪 3.8 秒。曲目跨淡、語音壓低背景音、暫停及抽卡沿用既有匯流排和狀態，候選背景及環境以 Web Audio gain 控制。當瀏覽器要求播放手勢會走既有輸入解鎖。退關清掉本關 MP3 媒體引用、解碼緩衝與未完成請求。

## Lyria 3.5 備用曲目

表內長度是 Lyria 生成目標，括弧為本機候選實際長度。驗收頁的 CSV 可直接取逐首完整英文提示詞、BPM、目標長度與精確 MP3 路徑。若候選音樂聽辨不合格，可將合格替代版放回表列路徑；保留原始生成版本與來源紀錄。

| 曲目／用途 | BPM | 目標秒數（實際） | 放入的本機路徑 |
| --- | ---: | ---: | --- |
| 夜街百鬼行／京都戰鬥 | 116 | 108（105.34） | `art/audio/stage58/bgm/stages/hyakki-kyoto/hyakki-kyoto__battle.mp3` |
| 祭夜封街／京都頭目 | 148 | 110（106.51） | `art/audio/stage58/bgm/stages/hyakki-kyoto/hyakki-kyoto__boss.mp3` |
| 雪徑寺燈／雪寺戰鬥 | 96 | 110（104.13） | `art/audio/stage58/bgm/stages/snow-temple/snow-temple__battle.mp3` |
| 霜鐘暴雪／雪寺頭目 | 132 | 112（104.74） | `art/audio/stage58/bgm/stages/snow-temple/snow-temple__boss.mp3` |
| 墨河送舟／渡口戰鬥 | 96 | 120（110.49） | `art/audio/stage58/bgm/stages/spirit-ferry/spirit-ferry__battle.mp3` |
| 亡渡逆潮／渡口頭目 | 120 | 120（114.10） | `art/audio/stage58/bgm/stages/spirit-ferry/spirit-ferry__boss.mp3` |
| 赤月荒徑／黃泉戰鬥 | 108 | 116（112.15） | `art/audio/stage58/bgm/stages/yomi/yomi__battle.mp3` |
| 冥門三關／黃泉頭目 | 132 | 116（112.61） | `art/audio/stage58/bgm/stages/yomi/yomi__boss.mp3` |
| 言靈之核／黃泉尾王破封 | 156 | 120（114.30） | `art/audio/stage58/bgm/stages/yomi/yomi__final.mp3` |
| 八夜歸燈／赤月淡出與結算 | 68 | 30（27.55） | `art/audio/stage58/bgm/stages/yomi/yomi__ending.mp3` |

以下各段可直接作為替代生成提示詞。各首附有相同的語音混音要求，循環與一次性結尾各遵循自己的用途。

**夜街百鬼行** — Original instrumental Japanese fantasy combat loop for a courier in an old Kyoto night parade. Syncopated shamisen, breathy shakuhachi answers, hand-played taiko and dry hyoshigi. Mysterious and lively with danger, no comedy or dance-club production. D minor, 116 BPM, 4/4, 108 seconds. Start on the downbeat and make the final phrase lead seamlessly back to it. Leave midrange space for Japanese vocabulary narration. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**祭夜封街** — Original instrumental Japanese festival boss chase loop. Angular fast shamisen, massive layered taiko, staccato low bowed strings and spare wooden clappers. Human acoustic performance, threatening street pursuit. D minor, 148 BPM, 4/4, 110 seconds. Immediate downbeat, matching first and final phrases, no terminal cadence. Leave midrange space for Japanese vocabulary narration. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**雪徑寺燈** — Original instrumental Japanese game combat loop. Lonely snowbound temple, warm stone lanterns, airy low shakuhachi, measured koto, occasional low temple bell and bowed bass. A walking pulse and quiet danger. E minor, 96 BPM, 4/4, 110 seconds. Start directly in the pulse with compatible opening and closing bars. Leave midrange space for Japanese vocabulary narration. No meditation drone, vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**霜鐘暴雪** — Original instrumental mountain temple boss combat loop in a blizzard. Deep temple bells over urgent rolling taiko, low string ostinato, cold metallic overtones and biting shakuhachi. Heavy and focused acoustic impact. E minor, 132 BPM, 4/4, 112 seconds. Begin audibly, maintain a stable heartbeat and build a clean loop seam. Leave midrange space for Japanese vocabulary narration. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**墨河送舟** — Original instrumental Japanese fantasy river crossing loop. Low shakuhachi floats over distant plucks, muted hand drums and a gently rocking six-beat pulse. Ink-wash atmosphere, mysterious travel, restrained darkness. A minor, 96 BPM, 6/4, 120 seconds. Match the last bars to the opening downbeat. Leave midrange space for Japanese vocabulary narration. No horror stinger, vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**亡渡逆潮** — Original instrumental supernatural river boss loop. Deep war drums and low strings advance in waves beneath an uneven Japanese pentatonic plucked melody. Strong current and unstable accents without jump scares. A minor, 120 BPM, 6/4, 120 seconds. Start with percussion on beat one and return to the opening current without an ending hit. Leave midrange space for Japanese vocabulary narration. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**赤月荒徑** — Original instrumental final-region combat loop in the Japanese underworld under a red moon. Deep taiko, tense bowed strings, strongly foregrounded shamisen and low shakuhachi in Japanese modal phrasing. Expansive and mournful, with a steady walking battle pace. C minor, 108 BPM, 4/4, 116 seconds. Match the final phrase to the opening motif and keep the entrance immediate. Leave midrange space for Japanese vocabulary narration. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**冥門三關** — Original instrumental Japanese underworld boss loop. Austere layered odaiko, forceful shamisen replies, rising low strings, bold acoustic attacks with controlled peaks. C minor, 132 BPM, 4/4, 116 seconds. Begin on a decisive downbeat, repeat a clear battle pulse and resolve back into the opening bars. Leave midrange space for Japanese vocabulary narration. No bombastic brass, vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**言靈之核** — Original climactic instrumental boss loop for the end of an eight-night courier journey. Recast an austere original Japanese pentatonic red-moon motif on insistent shamisen and cutting shakuhachi. Powerful asymmetric taiko and broad bowed-string arcs rise in waves, then reconnect to the starting pulse. C minor, 156 BPM, 4/4, 120 seconds. Leave midrange space for Japanese vocabulary narration. No Hollywood brass, vocals, chants, lyrics, speech, sampled voices or borrowed melody.

**八夜歸燈** — Original instrumental one-shot ending for a red moon fading into dawn. A soft struck temple bell within the first second, then a sparse shakuhachi and koto reprise of an austere Japanese pentatonic idea. Tender low strings withdraw towards a quiet resolved final chord. C minor, 68 BPM, 4/4, 30 seconds. Begin audibly in the first second and end cleanly. No vocals, chants, lyrics, speech, sampled voices or borrowed melody.

## 技術驗證與工作樹

| 層級 | 結果 |
| --- | --- |
| 已修改 | `js/audio.js`、`js/game.js`、`index.html`、`tools/serve-tilt.cjs`、`tools/run-tests.cjs`、`roadmap.md`。新增後四關事件清單、候選生成工具、集中驗收頁、聚焦 Node 測試、Chrome 音訊探針與本紀錄。 |
| 已靜態檢查 | 新改 JS 語法、`git diff --check` 與正式資產清冊通過。資產清冊仍為 1,360 檔與 151 alias／copy。已核准 `barrier-lv1-4.mp3`、既有 BGM 和教材人聲未寫入。 |
| 已測試（檔案） | 67／67 完整解碼、格式及電平驗證通過。解碼後最大 true peak −2.2 dBTP，最長低訊號 1.42 秒。逐檔 SHA-256、峰值、靜音及循環頭尾差值在 [解碼報告](../scratch/stage58-audio/decode.json)。 |
| 已測試（瀏覽器訊號） | 桌面 Chrome 隔離 context 開啟四關。測點透過真實波次與更新函式驅動，四關各 7 個聲音訊號，黃泉另量專屬尾王、崩解與終章，共 31 個非零圖內訊號。開場無候選 MP3 請求，四關各自請求本關資產，結束後媒體無 `src` 且已暫停。候選音訊 404、頁面例外、未捕捉 Promise rejection 均為 0。驗收頁四關各播一首，播放進度、停播、音量、循環、缺檔篩選與 CSV 下載通過。 [瀏覽器報告](../scratch/stage58-audio/browser.json) |
| 已測試（回歸） | 最終聚焦 81／81 通過，涵蓋音訊、後四關、Boss 排程及勝利音效。完整 `npm run test:current` 1,295 通過、1 失敗、1 既有 TODO，退出碼 1。失敗為 `tests/playtest-followup-20261102.test.cjs:36` 的既有源碼字串斷言，它仍在找 inline `enemies.filter(e => ...)`，工作樹本輪開始前已由先前的 Boss 觸控修正改用 `isBossBarVisible`，UI 與觸控目前共用該判定。 [聚焦紀錄](../scratch/stage58-audio/focused-final.log) · [完整回歸紀錄](../scratch/stage58-audio/regression.log) |
| 待核准 | 全 67 檔皆待人工聽辨。優先聽四關一般曲辨識度、王戰相位清晰度、MP3 循環拍點及黃泉終章入點。實體 iPad Safari 播放政策、教材語音相對音量及持續效能待實機。 |
| 發布 | 本輪僅本機 DEV。公開第五至八關仍鎖定。已保留先前工作樹和正式存檔；未提交、推送或部署。 |
