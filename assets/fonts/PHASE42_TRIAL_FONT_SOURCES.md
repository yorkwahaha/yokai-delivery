# Phase 42 — local-only Traditional Chinese font comparison

The Phase 42 upgrade-card trial (?upgradeUI=1) uses optional web fonts.
Local pause and settlement screens additionally use a dedicated HanWang
YanKai subset. Approved artwork, damage rules and game movement are unaffected.

The three WOFF2 files in this folder are web-only, character-subset versions.
They were built using tools/phase42-build-font-trials.py with fontTools.

| In-game choice | Original source | Local font |
| --- | --- | --- |
| 莫大毛筆 | max32002/bakudaifont release 1.48, Bakudai-Regular.woff2 | YokaiTrialBakudaiTC.woff2 |
| 正風毛筆 | max32002/masafont release 2.1, MasaFont-Regular.woff2 | YokaiTrialMasaTC.woff2 |
| 霞鶩文楷 TC | lxgw/LxgwWenkaiTC main, fonts/TTF/LXGWWenKaiTC-Regular.ttf | YokaiTrialWenKaiTC.woff2 |
| 月星楷・繁 (Regular) | GuiWonder/MoonStarsKai release 1.105, MoonStarsKaiT-Regular.ttf | YokaiTrialMoonStarsKaiT-Regular.woff2 |
| 月星楷・繁 (Bold) | GuiWonder/MoonStarsKai release 1.105, MoonStarsKaiT-Bold.ttf | YokaiTrialMoonStarsKaiT-Bold.woff2 |
| 玄冬楷書（缺繁體字） | Skr-ZERO/Xuandong-Kaishu, original 玄冬楷书.ttf | YokaiTrialXuandong.woff2 |
| 文鼎DC孫四海楷書（本機官方安裝） | iFontCloud, proprietary commercial font | Not included |
| 文鼎毛楷（本機官方安裝） | iFontCloud, proprietary commercial font | Not included |
| 王漢宗顏楷體繁（本機比較） | wt064.ttf from FreeBSD historical wang-fonts mirror | YokaiTrialHanWangYanKai.woff2 |
| 王漢宗顏楷體繁（本機結算／暫停 UI） | same GPL-2.0 wt064.ttf source, rebuilt via tools/build-yokai-ui-hanwang.py to include text such as 瀰漫 | YokaiUIHanWangYanKai.woff2 |
| cwTeX Q 中楷（OFL 繁體版） | l10n-tw/cwtex-q-fonts-TTFs, cwTeXQKaiZH-Medium.ttf | YokaiTrialCwTeXQKaiZH.woff2 |
| 寒蟬正楷（Big5） | Warren2060/Chillkai v2.000, ChillKai_Big5.ttf | YokaiTrialChillKaiBig5.woff2 |

Source repositories:
- https://github.com/max32002/bakudaifont
- https://github.com/max32002/masafont
- https://github.com/lxgw/LxgwWenkaiTC
- https://github.com/GuiWonder/MoonStarsKai/releases/tag/1.105
- https://github.com/Skr-ZERO/Xuandong-Kaishu
- https://ifontcloud.com.tw/index/font_intro.jsp?family_font_id=1789608880399
- https://www.ifontcloud.com/index/eula.jsp?country=TW&lang=zh
- https://ftpmirror.your.org/pub/FreeBSD-Archive/ports/distfiles/zh-wangttf/wt064.ttf
- https://github.com/l10n-tw/cwtex-q-fonts-TTFs/blob/master/ttf/cwTeXQKaiZH-Medium.ttf
- https://github.com/Warren2060/Chillkai/releases/tag/v2.000

Licensing: upstream fonts declare the SIL Open Font License 1.1. See
OFL-Phase42-Fonts.txt for the license text and the upstream repositories
for original authorship and copyright notices. In-game font-face families
use names prefixed with Yokai Trial to distinguish these Web subsets.
Moon Stars Kai's release license is copied separately as OFL-MoonStarsKai.txt.
**HanWang is GPL-2.0, not OFL**: its separate attribution/license is in
`GPL-2.0-HanWang.txt` and its source URL is listed above. This local UI font
is NOT selected on public hosts until its release/source obligations are
reviewed; public builds retain the MoonStars Kai fallback.
Its two Web subsets preserve original glyph outlines and OpenType shaping rules.
Xuandong Kaishu states SIL OFL 1.1 in its upstream README. Its local
subset is incomplete for Traditional Chinese: see
art/phase42-qwen21-calibration/phase42-xuandong-glyph-audit.json.

The two commercial iFontCloud choices are NOT packaged and have no
font binary in the repository. They are local-only lookups of a legitimately
installed font, and the UI rejects the choice when that font is absent.
The official 60-minute evaluation can be activated with iFontCloud's
font manager. Web/game font embedding requires separate permissions.

The new three local-only calligraphy font trials use their genuine sources:
王漢宗顏楷體繁 (GPL-2.0+, see GPL-2.0-HanWang.txt), cwTeX Q KaiZH
(SIL OFL-1.1, see OFL-cwTeX-Q.txt), 寒蟬正楷 Big5
(SIL OFL-1.1, see OFL-ChillKai.txt). The cwTeX project documents a
copyright-provenance caution, and HanWang's GPL license requires a separate
distribution/source-obligations review. Do NOT deploy them with the game
until this and art-direction review are complete.
The glyph coverage audit is at
art/phase42-qwen21-calibration/phase42-kai-font-glyph-audit.json.

Only the subsets are served by the local game, on demand, when a player
chooses that font. They are not distributed as installable desktop fonts.
The Web subsetting and WOFF2 conversion have not changed their glyph designs.

Coverage audit: art/phase42-qwen21-calibration/phase42-font-glyph-audit.json.
Moon Stars Kai coverage: art/phase42-qwen21-calibration/phase42-moonstars-glyph-audit.json.
This includes game-catalog Chinese text and the visible Phase 42 labels
such as 選卡, 能力提升, 覺醒印, 重抽 and skill names.

Do not ship to production until final visual and font-license review.
