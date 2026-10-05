// 可擴充內容層：Word Pack 與 Stage 定義。
// 瀏覽器使用 window.CONTENT；Node 測試可直接 require 本檔。
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;

  const RAW_PACKS = [
    {
      id: "animals",
      name: "動物街",
      sub: "どうぶつ",
      color: "#4f7a5b",
      floorColor: "#334f3b",
      theme: "park",
      words: [
        ["ねこ", "貓", "🐱", "neko", "かわいい ねこ が います"],
        ["いぬ", "狗", "🐶", "inu", "げんきな いぬ が はしる"],
        ["うさぎ", "兔子", "🐰", "usagi", "しろい うさぎ が はねる"]
      ]
    },
    {
      id: "beach",
      name: "海邊",
      sub: "うみべ",
      color: "#3d7385",
      floorColor: "#294d59",
      theme: "water",
      words: [
        ["さかな", "魚", "🐟", "sakana", "あかい さかな が およぐ"],
        ["うみ", "海", "🌊", "umi", "ひろい うみ を みる"],
        ["かめ", "烏龜", "🐢", "kame", "みどりの かめ が あるく"]
      ]
    },
    {
      id: "nightsky",
      name: "夜空町",
      sub: "よぞら",
      color: "#4f497a",
      floorColor: "#312c52",
      theme: "mystic",
      words: [
        ["つき", "月亮", "🌙", "tsuki", "きれいな つき が でている"],
        ["ほし", "星星", "⭐", "hoshi", "よるの ほし が ひかる"],
        ["にじ", "彩虹", "🌈", "niji", "あめのあとに にじ が でる"]
      ]
    },
    {
      id: "sweets",
      name: "點心街",
      sub: "おかし",
      color: "#7a583e",
      floorColor: "#523926",
      theme: "market",
      words: [
        ["りんご", "蘋果", "🍎", "ringo", "あまい りんご を たべる"],
        ["おにぎり", "飯糰", "🍙", "onigiri", "おいしい おにぎり を つくる"],
        ["ケーキ", "蛋糕", "🍰", "kēki", "たんじょうびの ケーキ を かう"]
      ]
    },
    {
      id: "station",
      name: "車站前",
      sub: "えきまえ",
      color: "#5b5c5e",
      floorColor: "#393a3d",
      theme: "stone",
      words: [
        ["えき", "車站", "🚉", "eki", "にぎやかな えき に いく"],
        ["ほん", "書", "📖", "hon", "おもしろい ほん を よむ"],
        ["かさ", "雨傘", "🌂", "kasa", "あめ だから かさ を さす"]
      ]
    },
    {
      id: "port",
      name: "港口",
      sub: "みなと",
      color: "#3f5f85",
      floorColor: "#263f5c",
      theme: "wood_pier",
      words: [
        ["くるま", "汽車", "🚗", "kuruma", "あおい くるま に のる"],
        ["ふね", "船", "⛵", "fune", "おおきな ふね が うごく"],
        ["ひこうき", "飛機", "🛫", "hikōki", "そらを ひこうき が とぶ"]
      ]
    },
    {
      id: "sakura",
      name: "櫻花坡",
      sub: "さくらざか",
      color: "#7a435c",
      floorColor: "#52293b",
      theme: "sakura",
      words: [
        ["さくら", "櫻花", "🌸", "sakura", "はるに さくら が さく"],
        ["やま", "山", "🗻", "yama", "たかい やま を のぼる"],
        ["はな", "花", "🌷", "hana", "きれいな はな が ひらく"]
      ]
    },
    {
      id: "tavern",
      name: "食堂街",
      sub: "しょくどう",
      color: "#7a4732",
      floorColor: "#542c1c",
      theme: "tavern",
      words: [
        ["おちゃ", "茶", "🍵", "ocha", "あたたかい おちゃ を のむ"],
        ["ラーメン", "拉麵", "🍜", "rāmen", "あつい ラーメン を たべる"],
        ["パン", "麵包", "🍞", "pan", "やきたての パンは いい においが します"]
      ]
    },
    {
      id: "pond",
      name: "幽靜池塘",
      sub: "いけ",
      color: "#3f7a63",
      floorColor: "#255240",
      theme: "lotus",
      words: [
        ["とり", "鳥", "🐦", "tori", "あおい とり が うたう"],
        ["たこ", "章魚", "🐙", "tako", "うみの たこには あしが はっぽん あります"],
        ["かえる", "青蛙", "🐸", "kaeru", "みどりの かえる が とぶ"]
      ]
    },
    {
      id: "rain-weather",
      name: "雨宿り通り",
      sub: "あまやどり",
      color: "#4f6478",
      floorColor: "#2c3a49",
      theme: "water",
      words: [
        ["あめ", "雨", "🌧️", "ame", "あめ が ふっています"],
        ["かぜ", "風", "💨", "kaze", "つよい かぜ が ふく"],
        ["くも", "雲", "☁️", "kumo", "そらに くも が おおい"],
        ["きり", "霧", "🌫️", "kiri", "みなとに きり が でる"],
        ["かみなり", "雷", "⚡", "kaminari", "とおくで かみなり が なる"],
        ["ゆき", "雪", "❄️", "yuki", "ふゆに ゆき が ふる"]
      ]
    },
    {
      id: "port-directions",
      name: "水先案內所",
      sub: "みちあんない",
      color: "#3f6270",
      floorColor: "#263f48",
      theme: "wood_pier",
      words: [
        ["みぎ", "右邊", "➡️", "migi", "みぎへ まがって ください"],
        ["ひだり", "左邊", "⬅️", "hidari", "ひだりに みなとが あります"],
        ["まえ", "前面", "⬆️", "mae", "えきの まえで まちます"],
        ["うしろ", "後面", "↩️", "ushiro", "みせの うしろに ふねが ある"],
        ["きた", "北方", "↑", "kita", "きたへ すすみます"],
        ["みなみ", "南方", "↓", "minami", "みなみの みなとへ いく"]
      ]
    }
  ];

  const WORD_PACKS = Object.fromEntries(RAW_PACKS.map(pack => {
    const words = pack.words.map(([jp, zh, icon, romaji, example], index) => ({
      id: `${pack.id}:${index}`,
      packId: pack.id,
      jp,
      zh,
      icon,
      cue: pack.id === "rain-weather" ? romaji : pack.id === "port-directions" ? "text" : "emoji",
      romaji: romaji || "",
      example: example || ""
    }));
    return [pack.id, Object.freeze({ ...pack, words: Object.freeze(words) })];
  }));

  const PACK_ORDER = Object.freeze(RAW_PACKS.map(pack => pack.id));
  const NIGHT_TOWN_PACKS = Object.freeze([
    "animals", "beach", "nightsky", "sweets", "station", "port", "sakura", "tavern", "pond"
  ]);

  const STAGES = Object.freeze({
    "night-town": Object.freeze({
      id: "night-town",
      name: "夜行町",
      sub: "よるのはいそう",
      description: "目前的十分鐘夜行配達。九種街區以 chunk 形式向四方延伸。",
      visual: Object.freeze({ ground: "ground_dirt", petals: 17, fireflies: 30 }),
      implemented: true,
      wordPacks: NIGHT_TOWN_PACKS,
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 137,
        layoutOffset: 0
      }),
      // 第一夜新手關：燈籠怪不出現，妖怪也不吐妖火彈，只靠追身與走位。
      enemy: Object.freeze({ shots: false }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 540, 590]),
        surgeFirst: 75,
        surgeInterval: 75,
        xpNeedScale: 1,
        spawnIntervalScale: 1,
        spawnCountBonus: 0
      })
    }),
    "rain-port": Object.freeze({
      id: "rain-port",
      name: "雨夜港町",
      sub: "あめよのみなと",
      description: "雨與海霧籠罩的港町。以天候、方位與港口詞彙進行第二夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["rain-weather", "port-directions", "port"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 431,
        layoutOffset: 1
      }),
      visual: Object.freeze({
        ground: "ground",
        petals: 0,
        fireflies: 0,
        weather: "rain",
        fog: 0.18,
        rainIntensity: 1
      }),
      enemy: Object.freeze({
        speedScale: 1,
        shooterChanceBonus: 0.02,
        bossHpScale: 1,
        bossTheme: "harbor"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([210, 420, 590]),
        surgeFirst: 90,
        surgeInterval: 80,
        xpNeedScale: 1,
        spawnIntervalScale: 1.15,
        spawnCountBonus: 0
      })
    }),
    "sakura-pass": Object.freeze({
      id: "sakura-pass",
      name: "妖櫻山道",
      sub: "ようざくらさんどう",
      description: "沿山而上的妖櫻古道。預定加入自然、時間與形容詞。",
      implemented: false,
      wordPacks: Object.freeze([])
    }),
    "hyakki-kyoto": Object.freeze({
      id: "hyakki-kyoto",
      name: "百鬼京都",
      sub: "ひゃっききょうと",
      description: "妖怪密度極高的古都關卡。預定加入生活動詞與店家詞彙。",
      implemented: false,
      wordPacks: Object.freeze([])
    }),
    "yomi": Object.freeze({
      id: "yomi",
      name: "黃泉境",
      sub: "よみのさかい",
      description: "旅路深處的終局區域。預定混合前面詞庫與錯題。",
      implemented: false,
      wordPacks: Object.freeze([])
    })
  });

  function getPack(id) {
    return WORD_PACKS[id] || null;
  }

  function getStage(id = "night-town") {
    return STAGES[id] || STAGES["night-town"];
  }

  function getStageWords(stageOrId = "night-town") {
    const stage = typeof stageOrId === "string" ? getStage(stageOrId) : stageOrId;
    const seen = new Set();
    const out = [];
    for (const packId of stage.wordPacks || []) {
      const pack = getPack(packId);
      if (!pack) continue;
      for (const word of pack.words) {
        if (seen.has(word.jp)) continue;
        seen.add(word.jp);
        out.push(word);
      }
    }
    return out;
  }

  function getSiblingWords(word) {
    if (!word || !word.packId) return [];
    const pack = getPack(word.packId);
    return pack ? pack.words.filter(other => other.jp !== word.jp) : [];
  }

  function getAllWords() {
    const seen = new Set();
    const out = [];
    for (const pack of Object.values(WORD_PACKS)) {
      for (const word of pack.words) {
        if (seen.has(word.jp)) continue;
        seen.add(word.jp);
        out.push(word);
      }
    }
    return out;
  }

  const api = Object.freeze({
    WORD_PACKS,
    PACK_ORDER,
    NIGHT_TOWN_PACKS,
    STAGES,
    getPack,
    getStage,
    getStageWords,
    getSiblingWords,
    getAllWords
  });

  root.CONTENT = api;
  root.WORD_PACKS = WORD_PACKS;
  root.STAGES = STAGES;

  // 舊介面暫時保留，避免尚未遷移的畫面或外部測試直接讀 DISTRICTS 時失效。
  root.DISTRICTS = PACK_ORDER.map(id => {
    const pack = WORD_PACKS[id];
    return {
      id: pack.id,
      name: pack.name,
      sub: pack.sub,
      color: pack.color,
      floorColor: pack.floorColor,
      theme: pack.theme,
      words: pack.words.map(w => [w.jp, w.zh, w.icon, w.romaji, w.example])
    };
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
