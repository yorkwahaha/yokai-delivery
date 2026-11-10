// Phase 13: static skill, mutation, charm and legacy-duo catalog tables.
// Preserve the exact original object literals and key iteration order.
// Only the catalog holder is frozen: entries retain the original mutability.
window.GAME_CATALOG = (() => {
  const CHARM_CONFIG = {
    charm_power: {
      id: "charm_power",
      n: "力紋守",
      s: "りきもん",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "對已持有技能增加小幅基礎傷害（+0.20）；次級傷害不再次乘算",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_step: {
      id: "charm_step",
      n: "風步守",
      s: "かぜあるき",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "提升移動速度（+28 px/s），採單一集中參數；無穿牆、無無敵",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_gather: {
      id: "charm_gather",
      n: "招靈守",
      s: "しょうれい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "擴大靈玉拾取吸收半徑（+75 px）；不增產量、不自動完成送貨",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_cadence: {
      id: "charm_cadence",
      n: "疾奏守",
      s: "しっそう",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針攻擊冷卻小幅縮短（有效頻率 +0.25）；保留每招冷卻下限與 Lv5 固有節奏，不加速雷雲、火龍或時鐘",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_reach: {
      id: "charm_reach",
      n: "遠霞守",
      s: "とおがすみ",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    },
    charm_guard: {
      id: "charm_guard",
      n: "紙甲守",
      s: "かみよろい",
      cat: "【 御守護符 】",
      levelText: "◆ 御守加持",
      d: "受創燈油損失減少 10%；護盾與無敵優先判定，小傷不歸零、不回油，不減免答題扣油",
      requirementText: "御守槽位未滿（最多 3 種）",
      limitText: "每局最多佩戴 3 款不同御守（同種可升至 Lv3）",
      inPool: false
    }
  };

  const MUTATION_CONFIG = {
    mut_boom_fan: {
      id: "mut_boom_fan",
      skillId: "boom",
      skillIds: ["boom"],
      n: "陰陽符・千本散射",
      s: "さんしゃ",
      cat: "【 陰陽符變異 】",
      levelText: "◆ 陰陽符變異",
      d: "陰陽符增加 2 枚、最多 6 枚，總傷害預算提高 20% 並分攤單符；僅限陰陽符",
      requirementText: "持有陰陽符",
      limitText: "每種限選一次；每技能最多 2 種變異",
      inPool: true
    },
    mut_seek: {
      id: "mut_seek",
      skillId: "needle",
      skillIds: ["needle"],
      family: "seek",
      n: "靈針・引魂追跡",
      s: "ついせき",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "靈針飛行中平滑轉向追蹤妖怪，失去目標後沿當前方向直行；僅限靈針",
      requirementText: "持有天狐靈針；同類效果只能歸屬一招",
      limitText: "同類變異靈針或陰陽符擇一；每技能最多 2 種變異",
      inPool: true
    },
    mut_boom_seek: {
      id: "mut_boom_seek",
      skillId: "boom",
      skillIds: ["boom"],
      family: "seek",
      n: "陰陽符・引魂追跡",
      s: "ついせき",
      cat: "【 陰陽符變異 】",
      levelText: "◆ 陰陽符變異",
      d: "未黏附陰陽符平滑轉向追蹤妖怪，失去目標後繼續直行；僅限陰陽符",
      requirementText: "持有陰陽符；同類效果只能歸屬一招",
      limitText: "同類變異靈針或陰陽符擇一；每技能最多 2 種變異",
      inPool: true
    },
    mut_frost: {
      id: "mut_frost",
      skillId: "needle",
      skillIds: ["needle"],
      family: "frost",
      n: "靈針・冰魄封靈",
      s: "ひょうはくふうれい",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "靈針命中使小怪冰凍 0.5 秒；Boss 每累積 3 次命中冰凍 0.15 秒，並有 2 秒免疫期",
      requirementText: "持有天狐靈針；同類效果只能歸屬一招",
      limitText: "同類變異靈針或陰陽符擇一；每技能最多 2 種變異",
      inPool: true
    },
    mut_boom_frost: {
      id: "mut_boom_frost",
      skillId: "boom",
      skillIds: ["boom"],
      family: "frost",
      n: "陰陽符・冰魄封靈",
      s: "ひょうはくふうれい",
      cat: "【 陰陽符變異 】",
      levelText: "◆ 陰陽符變異",
      d: "陰陽符主爆使小怪冰凍 0.5 秒；Boss 每 3 次主爆命中冰凍 0.15 秒，次爆不觸發",
      requirementText: "持有陰陽符；同類效果只能歸屬一招",
      limitText: "同類變異靈針或陰陽符擇一；每技能最多 2 種變異",
      inPool: true
    },
    mut_pierce: {
      id: "mut_pierce",
      skillId: "needle",
      skillIds: ["needle"],
      n: "靈針・穿透增額",
      s: "せんぼん・ぞうがく",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "保持既有穿透；第 2、第 3 隻命中獨敵各增加該針生成時 15% 傷害（總增額至多 30%），不額外投射，同敵去重",
      requirementText: "持有天狐靈針",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_return: {
      id: "mut_return",
      skillId: "needle",
      skillIds: ["needle"],
      n: "靈針・回旋折返",
      s: "せんぼん・おりかえし",
      cat: "【 靈針變異 】",
      levelText: "◆ 靈針變異",
      d: "靈針單次折返，回程可對原目標額外命中一次，造成原傷害35%，不重複冰封",
      requirementText: "持有天狐靈針",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_crosscut: {
      id: "mut_crosscut",
      skillId: "katana",
      skillIds: ["katana"],
      n: "妖刀・十字交斬",
      s: "ようとう・こうざん",
      cat: "【 妖刀變異 】",
      levelText: "◆ 妖刀變異",
      d: "主斬後延遲施展第二刀；Lv5 追加一道反面風刃，與主風刃共用命中紀錄以限制重複傷害",
      requirementText: "持有退魔妖刀",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_pulse: {
      id: "mut_pulse",
      skillId: "barrier",
      skillIds: ["barrier"],
      n: "靈陣・連環脈衝",
      s: "れいじん・みゃくどう",
      cat: "【 靈陣變異 】",
      levelText: "◆ 靈陣變異",
      d: "靈陣保持原半徑，兩次脈衝各65%原傷害，完整命中總傷增加30%",
      requirementText: "持有淨化靈陣",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_branch: {
      id: "mut_branch",
      skillId: "thunder",
      skillIds: ["thunder"],
      n: "天狐雷・連鎖分歧",
      s: "てんこれい・ぶんき",
      cat: "【 天狐雷變異 】",
      levelText: "◆ 天狐雷變異",
      d: "主雷命中後分出至多 1 道次級雷擊，傷害為當次主雷 25%；次級不得再分支，不以生命百分比計傷",
      requirementText: "持有天狐雷",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_orbit: {
      id: "mut_orbit",
      skillId: "fire",
      skillIds: ["fire"],
      n: "狐火・偏心輪道",
      s: "こか・へんしんりんどう",
      cat: "【 狐火變異 】",
      levelText: "◆ 狐火變異",
      d: "狐火改為偏心橢圓軌道（rx=126, ry=78），接觸傷害+20%，Lv5黑龍傷害+15%，火球數不變",
      requirementText: "持有狐火",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_splitblast: {
      id: "mut_splitblast",
      skillId: "boom",
      skillIds: ["boom"],
      n: "陰陽符・餘燼爆散",
      s: "おふだ・ばくさん",
      cat: "【 陰陽符變異 】",
      levelText: "◆ 陰陽符變異",
      d: "主爆後原爆心延遲 0.18 秒產生一次小型次爆（半徑 55%）；對原直擊目標取主爆全傷 25%，其餘取濺射傷 25%，無擊退、不再次派生",
      requirementText: "持有陰陽符",
      limitText: "每種限選一次（每技能最多 2 種變異）",
      inPool: true
    },
    mut_iaicharge: {
      id: "mut_iaicharge",
      skillId: "katana",
      skillIds: ["katana"],
      n: "妖刀・蓄力居合", s: "ためいあい",
      cat: "【 妖刀變異 】", levelText: "◆ 妖刀變異",
      d: "斬擊及Lv5風刃傷害提高24%，但每次揮刀冷卻增加0.16秒",
      requirementText: "持有退魔妖刀",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_armorbreak: {
      id: "mut_armorbreak",
      skillId: "katana",
      skillIds: ["katana"],
      n: "妖刀・破甲斬", s: "はこうざん",
      cat: "【 妖刀變異 】", levelText: "◆ 妖刀變異",
      d: "對坦克敵人傷害+30%、對Boss傷害+20%，普通敵人不變",
      requirementText: "持有退魔妖刀",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_longblade: {
      id: "mut_longblade",
      skillId: "katana",
      skillIds: ["katana"],
      n: "妖刀・長風刃", s: "ちょうふうじん",
      cat: "【 妖刀變異 】", levelText: "◆ 妖刀變異",
      d: "Lv1～4斬擊距離+23%；Lv5風刃飛行距離+25%",
      requirementText: "持有退魔妖刀",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_bindseal: {
      id: "mut_bindseal",
      skillId: "barrier",
      skillIds: ["barrier"],
      n: "靈陣・縛足靈紋", s: "ばくそくれいもん",
      cat: "【 靈陣變異 】", levelText: "◆ 靈陣變異",
      d: "靈陣命中的普通敵人移動遲滯0.72秒；Boss不受影響",
      requirementText: "持有淨化靈陣",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_widecircle: {
      id: "mut_widecircle",
      skillId: "barrier",
      skillIds: ["barrier"],
      n: "靈陣・廣域護陣", s: "こういきごじん",
      cat: "【 靈陣變異 】", levelText: "◆ 靈陣變異",
      d: "靈陣半徑+22%，每次脈衝傷害減少12%；Lv5庇護區同步放大",
      requirementText: "持有淨化靈陣",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_repulse: {
      id: "mut_repulse",
      skillId: "barrier",
      skillIds: ["barrier"],
      n: "靈陣・反震退魔", s: "はんしんたいま",
      cat: "【 靈陣變異 】", levelText: "◆ 靈陣變異",
      d: "擊退強度提升60%；Lv1～3也可擊退一般妖怪，Boss免疫",
      requirementText: "持有淨化靈陣",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_rapidfire: {
      id: "mut_rapidfire",
      skillId: "fire",
      skillIds: ["fire"],
      n: "狐火・疾旋輪舞", s: "しっせんりんぶ",
      cat: "【 狐火變異 】", levelText: "◆ 狐火變異",
      d: "環繞速度+40%，碰觸同一敵人的最短間隔縮短15%",
      requirementText: "持有狐火",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_flamebind: {
      id: "mut_flamebind",
      skillId: "fire",
      skillIds: ["fire"],
      n: "狐火・纏足焰", s: "てんそくえん",
      cat: "【 狐火變異 】", levelText: "◆ 狐火變異",
      d: "環繞狐火接觸命中使普通妖怪遲滯0.65秒，Boss不受影響",
      requirementText: "持有狐火",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_furyfire: {
      id: "mut_furyfire",
      skillId: "fire",
      skillIds: ["fire"],
      n: "狐火・熾焰強化", s: "しえんきょうか",
      cat: "【 狐火變異 】", levelText: "◆ 狐火變異",
      d: "環繞接觸傷害+25%；Lv5黑龍焦土傷害+15%",
      requirementText: "持有狐火",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_thunderfocus: {
      id: "mut_thunderfocus",
      skillId: "thunder",
      skillIds: ["thunder"],
      n: "天狐雷・雷印聚焦", s: "らいいんしゅうしょう",
      cat: "【 天狐雷變異 】", levelText: "◆ 天狐雷變異",
      d: "優先鎖定Boss與坦克，目標數少1（最少1），每道主雷傷害+30%",
      requirementText: "持有天狐雷",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_thunderstun: {
      id: "mut_thunderstun",
      skillId: "thunder",
      skillIds: ["thunder"],
      n: "天狐雷・雷痺", s: "らいひ",
      cat: "【 天狐雷變異 】", levelText: "◆ 天狐雷變異",
      d: "主雷命中使普通妖怪遲滯0.55秒；Boss僅0.18秒",
      requirementText: "持有天狐雷",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    },
    mut_thunderoverload: {
      id: "mut_thunderoverload",
      skillId: "thunder",
      skillIds: ["thunder"],
      n: "天狐雷・過載天罰", s: "かさいてんばつ",
      cat: "【 天狐雷變異 】", levelText: "◆ 天狐雷變異",
      d: "每道主雷傷害+35%，但施放冷卻增加25%",
      requirementText: "持有天狐雷",
      limitText: "每種限選一次；每技能最多2種變異",
      inPool: true
    }
  };

  const DUO_CONFIG = {
    // Legacy DUO resonance skills (Lv3-based) — quarantined from normal level-up pool per R9 rules.
    // New rule: all true fusion/奧義 require 2 parents Lv5 + valid ema + dedicated fusion menu.
    // These four legacy duos are preserved for code guard/compatibility but MUST NOT appear in standard pool.
    duo_thundercircle: {
      id: "duo_thundercircle",
      skillIds: ["barrier", "thunder"],
      n: "雷紋陣",
      s: "らいもんじん",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "淨化靈陣內落雷引發墨紋衝擊（延遲 0.12 秒、半徑 64）；至多命中 3 敵各一次，總傷害為該次非暴擊雷基傷 20% 分攤（無再派生）",
      beforeText: "落雷",
      afterText: "墨紋衝擊",
      requirementText: "持有淨化靈陣 Lv3+ 與 天狐雷 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；不重新落雷、不聚怪）",
      inPool: false
    },
    duo_inkfire: {
      id: "duo_inkfire",
      skillIds: ["katana", "fire"],
      n: "墨焰斬",
      s: "ぼくえんざん",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）",
      beforeText: "直接斬",
      afterText: "留墨焰",
      requirementText: "持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；每次攻擊有觸發上限、無再派生）",
      inPool: false
    },
    duo_frostseal: {
      id: "duo_frostseal",
      skillIds: ["needle", "boom"],
      n: "寒封符",
      s: "かんぷうふ",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "陰陽符主爆命中帶寒冷目標時給一次受限控場反應（普通怪凍結結束後追擊×0.65持續0.35秒，Boss追擊×0.90持續0.15秒；每cast限1敵、2秒免疫）",
      beforeText: "直投",
      afterText: "寒封",
      requirementText: "持有天狐靈針 Lv3+ 與 陰陽符 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；不重置冰封、Boss受限）",
      inPool: false
    },
    duo_cinderseal: {
      id: "duo_cinderseal",
      skillIds: ["fire", "boom"],
      n: "餘燼符",
      s: "よじんふ",
      cat: "【 共鳴奧義 】",
      levelText: "◆ 共鳴奧義",
      d: "陰陽符主爆命中灼燒目標時留下短效餘燼（延遲 0.3 秒、半徑 64、持續 0.8 秒）；至多命中 3 敵各一次，總傷害為該次非暴擊符傷 15% 分攤（無再派生）",
      beforeText: "引爆",
      afterText: "留餘燼",
      requirementText: "持有狐火炎 Lv3+ 與 陰陽符 Lv3+",
      limitText: "每局限選一次（不占主動、御守、變異槽位；每次引爆限一處、無再派生）",
      inPool: false
    }
  };

  const WI = {
    katana: { id: "katana", jp: "かたな", zh: "妖刀斬", type: "active", category: "方向斬擊", desc: "揮出凌厲新月刀芒，斬裂前方扇形妖怪" },
    barrier: { id: "barrier", jp: "じょうか", zh: "淨化靈陣", type: "active", category: "全方結界", desc: "展開 360 度低傷害除魔陣，Lv4 起可震退周身妖怪" },
    fire: { id: "fire", jp: "きつねび", zh: "狐火炎", type: "active", category: "烈焰火把", desc: "周身飛旋烈焰火把，高速甩擊灼燒貼身妖怪" },
    boom: { id: "boom", jp: "おふだ", zh: "陰陽符", type: "active", category: "延爆咒符", desc: "擲出符咒黏住妖怪，稍後爆炸；周圍受到濺射並震退" },
    thunder: { id: "thunder", jp: "いかずち", zh: "天狐雷", type: "active", category: "天罰落雷", desc: "固定係數落雷。Lv4 鎖定三個威脅，覺醒為三朵雷雲，不依生命秒殺" },
    needle: { id: "needle", jp: "せんぼん", zh: "天狐靈針", type: "active", category: "高速靈針", desc: "向面朝方向連續迸射破魔靈針，貫通前方妖怪" },
    // 融合武器（十組 registry；全部都有真攻擊 consumer）
    fusion_inkblade: { id: "fusion_inkblade", jp: "ぼくえんざん", zh: "墨焰斬", type: "active", category: "融合・扇形斬", desc: "大型扇形墨焰斬，命中留下短暫地面灼燒；妖刀與狐火共鳴覺醒" },
    fusion_foxiai: { id: "fusion_foxiai", jp: "らいこいあい", zh: "雷狐居合", type: "active", category: "融合・雷斬", desc: "短預警後前向線性雷斬，穿過有限目標，每 cast 同敵一次" },
    fusion_exorcistblade: { id: "fusion_exorcistblade", jp: "たいまふとう", zh: "退魔符刃", type: "active", category: "融合・符刃", desc: "前向刀斬附符印、有限延遲符爆，命中與符爆各自快照" },
    fusion_foxfirebarrier: { id: "fusion_foxfirebarrier", jp: "ようかけっかい", zh: "妖火結界", type: "active", category: "融合・火域", desc: "施放點短時燃燒結界、有限週期脈衝，首碰擊退尋常妖怪" },
    fusion_exorcistseal: { id: "fusion_exorcistseal", jp: "たいまふうじん", zh: "退魔封陣", type: "active", category: "融合・封陣", desc: "前方固定落點預警後有限多段符爆陣，不永久控制 Boss" },
    fusion_thundercircle: { id: "fusion_thundercircle", jp: "らいじんふうかい", zh: "雷陣封界", type: "active", category: "融合・雷域", desc: "大型陣域脈衝定點引雷，在陣域內有節奏地多次擊中並可閃避警示；靈陣與天狐雷共鳴覺醒" },
    fusion_slashwheel: { id: "fusion_slashwheel", jp: "ざんかいりん", zh: "斬界輪", type: "active", category: "融合・斬環", desc: "高速擴散內外雙斬環，各環每敵一次；妖刀與靈陣共鳴覺醒" },
    fusion_foxthunderlantern: { id: "fusion_foxthunderlantern", jp: "こらいてんとう", zh: "狐雷天燈", type: "active", category: "融合・雷燈", desc: "三盞雷光燈籠鎖定目標、預警後定點落雷；狐火與天狐雷共鳴覺醒" },
    fusion_flamefestival: { id: "fusion_flamefestival", jp: "えんぷさい", zh: "炎符祭", type: "active", category: "融合・火符", desc: "四枚火符交錯飛散、依序引爆並留短燼；狐火與陰陽符共鳴覺醒" },
    fusion_thundertalisman: { id: "fusion_thundertalisman", jp: "らいふしんばつ", zh: "雷符神罰", type: "active", category: "融合・雷符", desc: "五枚雷符交錯落定、預警落雷並單次連鎖；天狐雷與陰陽符共鳴覺醒" },
  };

  const WEAPON_UPGRADES = {
    katana:["暖光單刃，斬擊前方妖怪","雙刃交叉，距離 +16、傷害 +0.8","三刃收束，距離與傷害再提升","蓄風四刃；下一階射出穿透風刃","覺醒・斷空殘月斬：世界距離 720、最多 6 體，前三全傷其後 ×0.75，冷卻下限 0.6 秒"],
    barrier:["展開單盤除魔陣，低傷害全方位攻擊","雙盤刻印，範圍擴大、傷害小幅提升","反轉雙盤，範圍與傷害再提升","蓄勢大陣，半徑 252，命中可震退敵人","覺醒・金剛退魔曼荼羅：基礎半徑擴大至 290，持續 1.8 秒地面緩速；不回油、不聚怪"],
    fire:["一顆狐火環繞護身，僅接觸周遭妖怪","兩顆狐火環繞護身，不主動飛出","三顆狐火環繞護身，不主動飛出","三顆護火，其中一顆離體追敵後回歸","覺醒・墨焰黑龍：三顆護火，每 7.2 秒一條黑龍（露臉 1.5 秒＋退場後 5 秒）；不再離體。每次三球、五秒焦土最多三處"],
    boom:["單符黏附後延遲爆炸；本體全傷，周圍濺射並震退","一次擲出 2 枚符咒","三符齊射，冷卻縮短","四符齊射，爆炸範圍加大","覺醒・兩儀延爆：兩枚符咒，爆炸範圍最大"],
    thunder:["190 範圍內攻擊最近 1 隻，傷害 2 倍係數","270 範圍內同時攻擊 2 隻，傷害 3 倍係數","350 範圍內同時攻擊 3 隻，傷害 4.5 倍係數，不依生命秒殺","450 範圍內鎖定 3 個威脅，固定 6 倍係數","覺醒・建御雷神破界天罰：450 範圍內三朵雷雲，每朵半徑 90、8 倍係數"],
    needle:["三發靈針，貫穿前方妖怪","五發雙羽，傷害提升","七發三叉，傷害再提升","八星噴射；下一階八方輪射","覺醒・八方輪射：依序順時針每 0.05 秒一枚，追蹤與冰封須另選變異"],
    // 融合武器升級描述（Lv1 即完成形，描述供圖鑑/確認畫面）
    fusion_inkblade:["融合・墨焰斬：大型扇形墨焰斬，命中留下短暫地面灼燒；妖刀與狐火共鳴覺醒","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・墨焰斬：扇形 114.6°、半徑 280、地面灼燒 2.5 秒、冷卻 1.2 秒、直接斬擊與地面焦痕雙段傷害"],
    fusion_thundercircle:["融合・雷陣封界：大型陣域脈衝定點引雷，在陣域內有節奏地多次擊中並可閃避警示","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷陣封界：陣域半徑 240、脈衝間隔 0.8 秒、落雷預警 0.6 秒、命中去重 0.3 秒"],
    fusion_foxiai:["融合・雷狐居合：短預警前向線性雷斬，穿過有限目標","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷狐居合：前向雷斬、每 cast 同敵一次、短預警、有限穿透"],
    fusion_exorcistblade:["融合・退魔符刃：前向斬附符印，短延遲符爆","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・退魔符刃：每 cast 斬擊與符爆快照分開，符爆上限 4 印"],
    fusion_foxfirebarrier:["融合・妖火結界：施放點短時燃燒結界","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・妖火結界：max1 域、4 段脈衝、首碰擊退尋常妖怪"],
    fusion_exorcistseal:["融合・退魔封陣：前方固定落點預警後多段符爆","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・退魔封陣：固定落點、有限多段符爆、Boss 不受永久控制"],
    fusion_slashwheel:["融合・斬界輪：高速擴散內外雙斬環","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・斬界輪：雙環各每敵一次、半徑 320、冷卻 2.0 秒"],
    fusion_foxthunderlantern:["融合・狐雷天燈：三盞雷光燈籠鎖定落雷","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・狐雷天燈：三燈各一擊、落點預警 0.5 秒、單燈最多 3 體"],
    fusion_flamefestival:["融合・炎符祭：四枚火符交錯引爆留燼","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・炎符祭：四符依序引爆、每符 2 次短燼、派生上限固定"],
    fusion_thundertalisman:["融合・雷符神罰：五枚雷符落定引雷連鎖","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","（融合武器不再升級；Lv1 即完成形）","覺醒已完成・雷符神罰：五符各一擊、單次連鎖、Boss 不受控"],
  };
  return Object.freeze({
    CHARM_CONFIG, MUTATION_CONFIG, DUO_CONFIG, WI, WEAPON_UPGRADES
  });
})();
