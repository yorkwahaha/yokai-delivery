// 妖怪快遞社：八關短劇情、章節進展與首領登場台詞資料庫
// 支援 Node.js (CommonJS require) 與 Browser (window.STORY)
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  const STAGES = Object.freeze({
    "night-town": Object.freeze({
      stageId: "night-town",
      stageNumber: 1,
      chapter: 1,
      chapterTitle: "夜行起點",
      title: "夜行町",
      opening: "暖色燈籠映著町屋，言靈信件在包裹中微微震動。",
      delivery: "言靈平安送達町家，街道的燈火更亮了一分。",
      bossTitle: "大妖鬼",
      bossIntro: "大妖出現！把言靈留下！",
      bossSeal: "大妖鬼身形消散，殘存的妖氣凝為安寧的町火，第一枚言靈之印歸位。",
      clear: "夜行町的言靈恢復安寧，道路通往海霧瀰漫的碼頭。",
      nextStageId: "rain-port",
      hint: "沿著燈火穿過町屋，避開巡邏的鬼火。"
    }),
    "rain-port": Object.freeze({
      stageId: "rain-port",
      stageNumber: 2,
      chapter: 1,
      chapterTitle: "夜行起點",
      title: "雨夜港町",
      opening: "海霧與冷雨打濕青石板，迷失航路的呼喚在海風中迴盪。",
      delivery: "潮聲漸歇，方位與天候的言靈歸於港灣。",
      bossTitle: "港霧大妖",
      bossIntro: "港霧大妖！浪潮將吞噬一切！",
      bossSeal: "港霧大妖被真名封入繪卷，怒濤平息，化為守護燈塔的溫柔海風。",
      clear: "港灣燈塔重新點亮，山道落櫻正指引前路。",
      nextStageId: "sakura-pass",
      hint: "留意潮汐亮帶，避開從迷霧中射來的冷箭。"
    }),
    "sakura-pass": Object.freeze({
      stageId: "sakura-pass",
      stageNumber: 3,
      chapter: 1,
      chapterTitle: "夜行起點",
      title: "妖櫻山道",
      opening: "殘破鳥居立於落櫻古道，時間與四季的秩序開始錯亂。",
      delivery: "櫻瓣隨風散去，季節的言靈重新歸位。",
      bossTitle: "櫻鬼·花天狗",
      bossIntro: "落櫻紛飛，山道已封！",
      bossSeal: "花天狗羽扇落地，紛亂的花瓣化作清風，山道的古木結界重現光華。",
      clear: "山道結界重開，前方青綠竹林深處妖氣盤旋。",
      nextStageId: "bamboo-maze",
      hint: "狂風吹拂櫻瓣，順著落點預告尋找安全間隙。"
    }),
    "bamboo-maze": Object.freeze({
      stageId: "bamboo-maze",
      stageNumber: 4,
      chapter: 2,
      chapterTitle: "百鬼異變",
      title: "竹影迷宮",
      opening: "幽深竹林遮蔽夜空，顏色與數量的言靈化作層層迷陣。",
      delivery: "辨明虛實色彩，竹林迷陣悄然讓出一道小徑。",
      bossTitle: "竹影魅妖",
      bossIntro: "真假虛實，你能看破嗎？",
      bossSeal: "竹影魅妖的幻形破滅，虛實歸真，青竹沙沙低語，迷宮為行者讓出坦途。",
      clear: "破除竹影幻象，古都五重塔的燈火在遠方隱現。",
      nextStageId: "hyakki-kyoto",
      hint: "留心突進的竹影殘光，在竹葉縫隙中保持移動。"
    }),
    "hyakki-kyoto": Object.freeze({
      stageId: "hyakki-kyoto",
      stageNumber: 5,
      chapter: 2,
      chapterTitle: "百鬼異變",
      title: "百鬼京都",
      opening: "古都市集妖氣鼎盛，飲食與交易的言靈被妖怪據為己有。",
      delivery: "交還美味的言靈，妖怪市集的騷動平息了少許。",
      bossTitle: "百鬼夜行主宰·酒吞",
      bossIntro: "京都繁華，皆為妖宴！",
      bossSeal: "酒吞狂傲的妖火漸斂，古都百鬼歸於夜色，繁華市井重迎安詳。",
      clear: "百鬼夜行漸漸散去，寒風呼嘯，通往雪山之寺。",
      nextStageId: "snow-temple",
      hint: "市集街道狹窄，利用建築阻擋密集的妖火彈。"
    }),
    "snow-temple": Object.freeze({
      stageId: "snow-temple",
      stageNumber: 6,
      chapter: 2,
      chapterTitle: "百鬼異變",
      title: "雪燈山寺",
      opening: "暴風雪覆蓋深山古寺，行動與身軀的言靈正在被寒氣凍結。",
      delivery: "暖意驅散嚴寒，被冰封的言語重新甦醒。",
      bossTitle: "雪女·寒燈法師",
      bossIntro: "冰封之寺，長眠於雪吧！",
      bossSeal: "寒燈法師周身玄冰融化，雪寺銅鐘長鳴，刺骨暴風雪化為寧靜初雪。",
      clear: "寒冰消融，顯露出直通黃泉渡口的幽冥裂谷。",
      nextStageId: "spirit-ferry",
      hint: "積雪路滑行動受制，注意腳底結冰的減速預警。"
    }),
    "spirit-ferry": Object.freeze({
      stageId: "spirit-ferry",
      stageNumber: 7,
      chapter: 3,
      chapterTitle: "黃泉之門",
      title: "幽世渡口",
      opening: "青色鬼火漂浮在三途靈河，心境與思念的言靈在此化作渡船。",
      delivery: "傾聽未了的思緒，靈河孤舟緩緩靠向彼岸。",
      bossTitle: "幽冥渡船使",
      bossIntro: "三途無岸，魂魄止步！",
      bossSeal: "渡船使放下長篙微微致意，靈河彼岸的彼岸花盛開，引領最後的航程。",
      clear: "渡船抵達彼岸，赤月之下便是黃泉終局。",
      nextStageId: "yomi",
      hint: "靈河波浪橫向拍打，把握波峰退去的安全窗口。"
    }),
    "yomi": Object.freeze({
      stageId: "yomi",
      stageNumber: 8,
      chapter: 3,
      chapterTitle: "黃泉之門",
      title: "黃泉境",
      opening: "赤月高懸於裂谷妖城，所有失落的言靈在此收束成最後試煉。",
      delivery: "交還最初與最後的言靈，生者與幽世的邊界重塑。",
      bossTitle: "黃泉邪神·言靈之核",
      bossIntro: "世間之名，歸於虛無！",
      bossSeal: "黃泉邪神的混沌之核被八夜言靈徹底淨化，晨曦破曉，生滅之界重新歸於平衡。",
      clear: "晨曦破開黃泉長夜，最後的配達使命圓滿達成。",
      nextStageId: null,
      epilogue: "八夜的配達之旅在此畫下句點。從最初點亮夜行町的第一盞燈火，到平息黃泉深淵的混沌，每一封言靈都找回了歸處。少年整理好行囊，晨光熹微中，新的快遞委託正靜靜等候。",
      hint: "集合八夜所學，在全技能交織的終極攻勢中尋找生機。"
    })
  });

  function get(stageId) {
    if (!stageId || typeof stageId !== "string") return null;
    return STAGES[stageId] || null;
  }

  function getNextStageId(stageId) {
    const s = get(stageId);
    return s ? s.nextStageId : null;
  }

  const api = Object.freeze({
    STAGES,
    get,
    getNextStageId
  });

  root.STORY = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
