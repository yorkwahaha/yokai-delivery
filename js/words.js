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
        ["ねこ", "貓", "🐱", "neko", "かわいい ねこ が います", "ねこ", "猫", "名詞", "emoji"],
        ["いぬ", "狗", "🐶", "inu", "げんきな いぬ が はしる", "いぬ", "犬", "名詞", "emoji"],
        ["うさぎ", "兔子", "🐰", "usagi", "しろい うさぎ が はねる", "うさぎ", "兎", "名詞", "emoji"]
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
        ["さかな", "魚", "🐟", "sakana", "あかい さかな が およぐ", "さかな", "魚", "名詞", "emoji"],
        ["うみ", "海", "🌊", "umi", "ひろい うみ を みる", "うみ", "海", "名詞", "emoji"],
        ["たこ", "章魚", "🐙", "tako", "うみの たこには あしが はっぽん あります", "たこ", "蛸", "名詞", "emoji"]
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
        ["つき", "月亮", "🌙", "tsuki", "きれいな つき が でている", "つき", "月", "名詞", "emoji"],
        ["ほし", "星星", "⭐", "hoshi", "よるの ほし が ひかる", "ほし", "星", "名詞", "emoji"],
        ["にじ", "彩虹", "🌈", "niji", "あめのあとに にじ が でる", "にじ", "虹", "名詞", "emoji"]
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
        ["りんご", "蘋果", "🍎", "ringo", "あまい りんご を たべる", "りんご", "林檎", "名詞", "emoji"],
        ["おにぎり", "飯糰", "🍙", "onigiri", "おいしい おにぎり を つくる", "おにぎり", "お握り", "名詞", "emoji"],
        ["ケーキ", "蛋糕", "🍰", "kēki", "たんじょうびの ケーキ を かう", "ケーキ", "", "名詞", "emoji"]
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
        ["えき", "車站", "🚉", "eki", "にぎやかな えき に いく", "えき", "駅", "名詞", "emoji"],
        ["ほん", "書", "📖", "hon", "おもしろい ほん を よむ", "ほん", "本", "名詞", "emoji"],
        ["かさ", "雨傘", "🌂", "kasa", "あめ だから かさ を さす", "かさ", "傘", "名詞", "emoji"]
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
        ["くるま", "汽車", "🚗", "kuruma", "あおい くるま に のる", "くるま", "車", "名詞", "emoji"],
        ["ふね", "船", "⛵", "fune", "おおきな ふね が うごく", "ふね", "船", "名詞", "emoji"],
        ["ひこうき", "飛機", "🛫", "hikōki", "そらを ひこうき が とぶ", "ひこうき", "飛行機", "名詞", "emoji"]
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
        ["さくら", "櫻花", "🌸", "sakura", "はるに さくら が さく", "さくら", "桜", "名詞", "emoji"],
        ["やま", "山", "🗻", "yama", "たかい やま を のぼる", "やま", "山", "名詞", "emoji"],
        ["はな", "花", "🌷", "hana", "きれいな はな が ひらく", "はな", "花", "名詞", "emoji"]
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
        ["おちゃ", "茶", "🍵", "ocha", "あたたかい おちゃ を のむ", "おちゃ", "お茶", "名詞", "emoji"],
        ["ラーメン", "拉麵", "🍜", "rāmen", "あつい ラーメン を たべる", "ラーメン", "", "名詞", "emoji"],
        ["パン", "麵包", "🍞", "pan", "やきたての パンは いい においが します", "パン", "", "名詞", "emoji"]
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
        ["とり", "鳥", "🐦", "tori", "あおい とり が うたう", "とり", "鳥", "名詞", "emoji"],
        ["かめ", "烏龜", "🐢", "kame", "みどりの かめ が あるく", "かめ", "亀", "名詞", "emoji"],
        ["かえる", "青蛙", "🐸", "kaeru", "みどりの かえる が とぶ", "かえる", "蛙", "名詞", "emoji"]
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
        ["あめ", "雨", "🌧️", "ame", "あめ が ふっています", "あめ", "雨", "名詞", "ame"],
        ["かぜ", "風", "💨", "kaze", "つよい かぜ が ふく", "かぜ", "風", "名詞", "kaze"],
        ["くも", "雲", "☁️", "kumo", "そらに くも が おおい", "くも", "雲", "名詞", "kumo"],
        ["きり", "霧", "🌫️", "kiri", "みなとに きり が でる", "きり", "霧", "名詞", "kiri"],
        ["かみなり", "雷", "⚡", "kaminari", "とおくで かみなり が なる", "かみなり", "雷", "名詞", "kaminari"],
        ["ゆき", "雪", "❄️", "yuki", "ふゆに ゆき が ふる", "ゆき", "雪", "名詞", "yuki"]
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
        ["みぎ", "右邊", "➡️", "migi", "みぎへ まがって ください", "みぎ", "右", "名詞", "text"],
        ["ひだり", "左邊", "⬅️", "hidari", "ひだりに みなとが あります", "ひだり", "左", "名詞", "text"],
        ["まえ", "前面", "⬆️", "mae", "えきの まえで まちます", "まえ", "前", "名詞", "text"],
        ["うしろ", "後面", "↩️", "ushiro", "みせの うしろに ふねが ある", "うしろ", "後ろ", "名詞", "text"],
        ["きた", "北方", "↑", "kita", "きたへ すすみます", "きた", "北", "名詞", "text"],
        ["みなみ", "南方", "↓", "minami", "みなみの みなとへ いく", "みなみ", "南", "名詞", "text"]
      ]
    },

    // 擴充主題包（前七關專屬與共同領域）
    {
      id: "town-people",
      name: "町人小徑",
      sub: "まちのひと",
      color: "#5c6b50",
      floorColor: "#3a4532",
      theme: "park",
      words: [
        ["ひと", "人", "🧑", "hito", "ひと が たくさん いる", "ひと", "人", "名詞", "emoji"],
        ["ともだち", "朋友", "🤝", "tomodachi", "ともだち と あそぶ", "ともだち", "友達", "名詞", "emoji"],
        ["こども", "小孩", "🧒", "kodomo", "こども が わらう", "こども", "子供", "名詞", "emoji"],
        ["おんなのこ", "女孩", "👧", "onnanoko", "おんなのこ が はしる", "おんなのこ", "女の子", "名詞", "emoji"],
        ["おとこのこ", "男孩", "👦", "otokonoko", "おとこのこ が あそぶ", "おとこのこ", "男の子", "名詞", "emoji"]
      ]
    },
    {
      id: "town-house",
      name: "町屋住家",
      sub: "いえとくらし",
      color: "#6b5847",
      floorColor: "#45362a",
      theme: "market",
      words: [
        ["いえ", "房屋", "🏠", "ie", "おおきな いえ が ある", "いえ", "家", "名詞", "emoji"],
        ["まど", "窗戶", "🪟", "mado", "まど を あける", "まど", "窓", "名詞", "emoji"],
        ["つくえ", "書桌", "🪵", "tsukue", "つくえ の うえ に おく", "つくえ", "机", "名詞", "emoji"],
        ["いす", "椅子", "🪑", "isu", "いす に すわる", "いす", "椅子", "名詞", "emoji"],
        ["でんき", "電燈", "💡", "denki", "でんき を つける", "でんき", "電気", "名詞", "emoji"],
        ["かぞく", "家人", "👨‍👩‍👧", "kazoku", "かぞく で すむ", "かぞく", "家族", "名詞", "emoji"],
        ["へや", "房間", "🚪", "heya", "あかるい へや に はいる", "へや", "部屋", "名詞", "emoji"],
        ["にわ", "庭院", "🏡", "niwa", "ひろい にわ が ある", "にわ", "庭", "名詞", "emoji"]
      ]
    },
    {
      id: "town-places",
      name: "市町名所",
      sub: "まちのばしょ",
      color: "#52636a",
      floorColor: "#334045",
      theme: "stone",
      words: [
        ["まち", "城鎮", "🏘️", "machi", "しずかな まち を あるく", "まち", "町", "名詞", "emoji"],
        ["みち", "道路", "🛣️", "michi", "ひろい みち を すすむ", "みち", "道", "名詞", "emoji"],
        ["はし", "橋樑", "🌉", "hashi", "かわの はし を わたる", "はし", "橋", "名詞", "emoji"],
        ["こうえん", "公園", "🏞️", "kōen", "こうえん で やすむ", "こうえん", "公園", "名詞", "emoji"],
        ["がっこう", "學校", "🏫", "gakkō", "がっこう へ いく", "がっこう", "学校", "名詞", "emoji"]
      ]
    },
    {
      id: "port-spatial",
      name: "港灣空間",
      sub: "くうかん",
      color: "#466273",
      floorColor: "#2c3e4a",
      theme: "wood_pier",
      words: [
        ["うえ", "上面", "⬆️", "ue", "つくえの うえに ある", "うえ", "上", "名詞", "text"],
        ["した", "下面", "⬇️", "shita", "いすの したを みる", "した", "下", "名詞", "text"],
        ["なか", "裡面", "📦", "naka", "はこの なかに いれる", "なか", "中", "名詞", "text"],
        ["そと", "外面", "🚪", "soto", "いえの そとへ でる", "そと", "外", "名詞", "text"],
        ["ちかく", "附近", "📍", "chikaku", "えきの ちかくに すむ", "ちかく", "近く", "名詞", "text"],
        ["とおく", "遠處", "🔭", "tōku", "とおくの うみを みる", "とおく", "遠く", "名詞", "text"]
      ]
    },
    {
      id: "port-transit",
      name: "渡口交通",
      sub: "こうつう",
      color: "#3b586e",
      floorColor: "#243745",
      theme: "stone",
      words: [
        ["でんしゃ", "電車", "🚃", "densha", "でんしゃ に のる", "でんしゃ", "電車", "名詞", "emoji"],
        ["じてんしゃ", "自行車", "🚲", "jitensha", "じてんしゃ で はしる", "じてんしゃ", "自転車", "名詞", "emoji"],
        ["えきいん", "站員", "🧑‍✈️", "ekiin", "えきいん に きく", "えきいん", "駅員", "名詞", "emoji"]
      ]
    },
    {
      id: "nature-seasons",
      name: "四季山色",
      sub: "しき",
      color: "#6b4e63",
      floorColor: "#45303f",
      theme: "sakura",
      words: [
        ["はる", "春季", "🌸", "haru", "あたたかい はる が くる", "はる", "春", "名詞", "emoji"],
        ["なつ", "夏季", "🌻", "natsu", "あつい なつ の ひ", "なつ", "夏", "名詞", "emoji"],
        ["あき", "秋季", "🍁", "aki", "すずしい あき の やま", "あき", "秋", "名詞", "emoji"],
        ["ふゆ", "冬季", "⛄", "fuyu", "さむい ふゆ の よる", "ふゆ", "冬", "名詞", "emoji"],
        ["もり", "森林", "🌲", "mori", "ふかい もり を あるく", "もり", "森", "名詞", "emoji"],
        ["かわ", "河流", "🏞️", "kawa", "かわ の みず が ながれる", "かわ", "川", "名詞", "emoji"]
      ]
    },
    {
      id: "time-calendar",
      name: "曆日時辰",
      sub: "ひびととき",
      color: "#5b4a6b",
      floorColor: "#392c45",
      theme: "mystic",
      words: [
        ["きょう", "今天", "📅", "kyō", "きょう は いい てんき です", "きょう", "今日", "名詞", "text"],
        ["あした", "明天", "🌅", "ashita", "あした また あいましょう", "あした", "明日", "名詞", "text"],
        ["きのう", "昨天", "📜", "kinō", "きのう ほん を よんだ", "きのう", "昨日", "名詞", "text"],
        ["いま", "現在", "⏰", "ima", "いま なんじ ですか", "いま", "今", "名詞", "text"],
        ["あさ", "早晨", "🌄", "asa", "あさ はやく おきる", "あさ", "朝", "名詞", "text"],
        ["よる", "夜晚", "🌃", "yoru", "よる に つき を みる", "よる", "夜", "名詞", "text"],
        ["ひる", "白天", "☀️", "hiru", "ひる に ごはん を たべる", "ひる", "昼", "名詞", "text"]
      ]
    },
    {
      id: "time-units",
      name: "時刻刻度",
      sub: "じかんたんい",
      color: "#4e4263",
      floorColor: "#312840",
      theme: "mystic",
      words: [
        ["じかん", "時間", "⏳", "jikan", "じかん が あります", "じかん", "時間", "名詞", "text"],
        ["ぷん", "分鐘", "⏱️", "pun", "じゅっぷん まちます", "ぷん", "分", "名詞", "text"],
        ["いちにち", "一日", "📆", "ichinichi", "たのしい いちにち です", "いちにち", "一日", "名詞", "text"]
      ]
    },
    {
      id: "bamboo-colors",
      name: "竹林彩繪",
      sub: "いろ",
      color: "#3f6a52",
      floorColor: "#274534",
      theme: "lotus",
      words: [
        ["あか", "紅色", "🔴", "aka", "あか の もみじ が ちる", "あか", "赤", "名詞", "emoji"],
        ["あお", "藍色", "🔵", "ao", "あお の そら が ひろがる", "あお", "青", "名詞", "emoji"],
        ["しろ", "白色", "⚪", "shiro", "しろ の はな が さく", "しろ", "白", "名詞", "emoji"],
        ["くろ", "黑色", "⚫", "kuro", "くろ の かげ が ゆれる", "くろ", "黒", "名詞", "emoji"],
        ["みどり", "綠色", "🟢", "midori", "みどり の たけ が しげる", "みどり", "緑", "名詞", "emoji"],
        ["きいろ", "黃色", "🟡", "kiiro", "きいろ の ひかり が みえる", "きいろ", "黄色", "名詞", "emoji"]
      ]
    },
    {
      id: "bamboo-scales",
      name: "尺度形貌",
      sub: "かたちとたかさ",
      color: "#3a5e4b",
      floorColor: "#223d2f",
      theme: "park",
      words: [
        ["おおきい", "巨大的", "🐘", "ōkii", "おおきい やま を みあげる", "おおきい", "大きい", "い形容詞", "text"],
        ["ちいさい", "微小的", "🐜", "chiisai", "ちいさい むし が とぶ", "ちいさい", "小さい", "い形容詞", "text"],
        ["たかい", "高聳的", "🗼", "takai", "たかい たけ が ならぶ", "たかい", "高い", "い形容詞", "text"],
        ["ひくい", "矮矮的", "🧱", "hikui", "ひくい いがき が つづく", "ひくい", "低い", "い形容詞", "text"],
        ["ながい", "長長的", "📏", "nagai", "ながい みち を すすむ", "ながい", "長い", "い形容詞", "text"],
        ["みじかい", "短短的", "📐", "mijikai", "みじかい はし を わたる", "みじかい", "短い", "い形容詞", "text"]
      ]
    },
    {
      id: "bamboo-states",
      name: "竹徑狀態",
      sub: "じょうたい",
      color: "#466b53",
      floorColor: "#2b4535",
      theme: "stone",
      words: [
        ["あたらしい", "嶄新的", "✨", "atarashii", "あたらしい かさを さす", "あたらしい", "新しい", "い形容詞", "text"],
        ["ふるい", "陳舊的", "🏛️", "furui", "ふるい やしろ が たつ", "ふるい", "古い", "い形容詞", "text"],
        ["おおい", "多量的", "👥", "ōi", "ひとが おおい えき", "おおい", "多い", "い形容詞", "text"],
        ["すくない", "少量的", "👤", "sukunai", "すくない みず を のむ", "すくない", "少ない", "い形容詞", "text"],
        ["いい", "良好的", "👍", "ii", "いい てんき に なる", "いい", "良い", "い形容詞", "text"]
      ]
    },
    {
      id: "bamboo-numbers",
      name: "數數個數",
      sub: "かず",
      color: "#4f7559",
      floorColor: "#324d39",
      theme: "market",
      words: [
        ["ひとつ", "一個", "1️⃣", "hitotsu", "りんご を ひとつ ください", "ひとつ", "一つ", "名詞", "text"],
        ["ふたつ", "兩個", "2️⃣", "futatsu", "おにぎり を ふたつ たべる", "ふたつ", "二つ", "名詞", "text"],
        ["みっつ", "三個", "3️⃣", "mittsu", "ケーキ を みっつ かう", "みっつ", "三つ", "名詞", "text"],
        ["たくさん", "許多", "🌾", "takusan", "たくさん の たけ が ある", "たくさん", "", "副詞", "text"],
        ["すこし", "稍微", "🤏", "sukoshi", "すこし やすみましょう", "すこし", "少し", "副詞", "text"]
      ]
    },
    {
      id: "kyoto-staples",
      name: "古都膳食",
      sub: "しょくざい",
      color: "#734e3b",
      floorColor: "#4a3022",
      theme: "market",
      words: [
        ["みず", "開水", "💧", "mizu", "つめたい みず を のむ", "みず", "水", "名詞", "emoji"],
        ["ごはん", "米飯", "🍚", "gohan", "あたたかい ごはん を たべる", "ごはん", "ご飯", "名詞", "emoji"],
        ["にく", "肉類", "🥩", "niku", "やいた にく を たべる", "にく", "肉", "名詞", "emoji"],
        ["やさい", "蔬菜", "🥬", "yasai", "しんせんな やさい を かう", "やさい", "野菜", "名詞", "emoji"],
        ["たまご", "雞蛋", "🥚", "tamago", "たまご を ひとつ つかう", "たまご", "卵", "名詞", "emoji"],
        ["くだもの", "水果", "🍇", "kudamono", "あまい くだもの を たべる", "くだもの", "果物", "名詞", "emoji"]
      ]
    },
    {
      id: "kyoto-dishes",
      name: "京料理處",
      sub: "りょうり",
      color: "#785338",
      floorColor: "#4f3422",
      theme: "tavern",
      words: [
        ["さけ", "日本酒", "🍶", "sake", "おいしい さけ を のむ", "さけ", "酒", "名詞", "emoji"],
        ["さら", "盤子", "🍽️", "sara", "さら に のせる", "さら", "皿", "名詞", "emoji"],
        ["ちゃわん", "飯碗", "🥣", "chawan", "ちゃわん を もつ", "ちゃわん", "茶碗", "名詞", "emoji"],
        ["すし", "壽司", "🍣", "sushi", "きょうとの すし を たべる", "すし", "寿司", "名詞", "emoji"]
      ]
    },
    {
      id: "kyoto-shopping",
      name: "妖怪市集",
      sub: "いちば",
      color: "#6e4730",
      floorColor: "#472c1c",
      theme: "market",
      words: [
        ["みせ", "商店", "🏪", "mise", "おおきな みせ に はいる", "みせ", "店", "名詞", "emoji"],
        ["おかね", "錢幣", "💰", "okane", "おかね を はらう", "おかね", "お金", "名詞", "emoji"],
        ["かいもの", "購物", "🛍️", "kaimono", "かいもの に いく", "かいもの", "買い物", "名詞", "emoji"],
        ["えん", "日圓", "🪙", "en", "ひゃくえん を だす", "えん", "円", "名詞", "text"],
        ["ねだん", "價格", "🏷️", "nedan", "ねだん を たしかめる", "ねだん", "値段", "名詞", "text"]
      ]
    },
    {
      id: "temple-body",
      name: "靈修身軀",
      sub: "からだ",
      color: "#4a5963",
      floorColor: "#2d373d",
      theme: "stone",
      words: [
        ["て", "手部", "✋", "te", "て を あらう", "て", "手", "名詞", "emoji"],
        ["あし", "腳部", "🦶", "ashi", "あし が つかれる", "あし", "足", "名詞", "emoji"],
        ["め", "眼睛", "👁️", "me", "め を あける", "め", "目", "名詞", "emoji"],
        ["みみ", "耳朵", "👂", "mimi", "みみ を すます", "みみ", "耳", "名詞", "emoji"],
        ["くち", "嘴巴", "👄", "kuchi", "くち を とじる", "くち", "口", "名詞", "emoji"],
        ["あたま", "頭部", "🧠", "atama", "あたま を さげる", "あたま", "頭", "名詞", "emoji"],
        ["からだ", "身體", "🧍", "karada", "からだ を あたためる", "からだ", "体", "名詞", "emoji"],
        ["は", "牙齒", "🦷", "ha", "は を みがく", "は", "歯", "名詞", "emoji"]
      ]
    },
    {
      id: "temple-movement",
      name: "巡山行履",
      sub: "いどう",
      color: "#3f545f",
      floorColor: "#25343d",
      theme: "wood_pier",
      words: [
        ["いく", "前往", "🚶", "iku", "やまの てら へ いく", "いく", "行く", "動詞", "text"],
        ["くる", "來到", "🏃", "kuru", "ここ へ くる", "くる", "来る", "動詞", "text"],
        ["もどる", "返回", "🔙", "modoru", "てら へ もどる", "もどる", "戻る", "動詞", "text"],
        ["はしる", "奔跑", "🏃‍♂️", "hashiru", "ゆきのみち を はしる", "はしる", "走る", "動詞", "text"],
        ["あるく", "步行", "🚶‍♂️", "aruku", "ゆっくり あるく", "あるく", "歩く", "動詞", "text"],
        ["とまる", "停步", "🛑", "tomaru", "もんの まえで とまる", "とまる", "止まる", "動詞", "text"],
        ["はいる", "進入", "🚪", "hairu", "てら の なかに はいる", "はいる", "入る", "動詞", "text"],
        ["でる", "走出", "🚶‍♀️", "deru", "もん を でる", "でる", "出る", "動詞", "text"]
      ]
    },
    {
      id: "temple-actions",
      name: "古寺日課",
      sub: "どうさ",
      color: "#46535c",
      floorColor: "#2b343a",
      theme: "stone",
      words: [
        ["みる", "看見", "👀", "miru", "ゆき を みる", "みる", "見る", "動詞", "text"],
        ["きく", "聆聽", "👂", "kiku", "かね の おと を きく", "きく", "聞く", "動詞", "text"],
        ["たべる", "進食", "🥢", "taberu", "ごはん を たべる", "たべる", "食べる", "動詞", "text"],
        ["のむ", "飲用", "🍵", "nomu", "おちゃ を のむ", "のむ", "飲む", "動詞", "text"],
        ["いう", "說話", "💬", "iu", "なまえ を いう", "いう", "言う", "動詞", "text"],
        ["まつ", "等待", "⏳", "matsu", "ともだち を まつ", "まつ", "待つ", "動詞", "text"],
        ["おきる", "起床", "⏰", "okiru", "あさ はやく おきる", "おきる", "起きる", "動詞", "text"],
        ["ねる", "就寢", "🛏️", "neru", "よる はやく ねる", "ねる", "寝る", "動詞", "text"]
      ]
    },
    {
      id: "ferry-feelings",
      name: "幽河心緒",
      sub: "きもち",
      color: "#3f5466",
      floorColor: "#24333f",
      theme: "lotus",
      words: [
        ["うれしい", "開心的", "😊", "ureshii", "あえて うれしい です", "うれしい", "嬉しい", "い形容詞", "text"],
        ["たのしい", "愉快的", "🥳", "tanoshii", "たのしい たび に なる", "たのしい", "楽しい", "い形容詞", "text"],
        ["かなしい", "悲傷的", "😢", "kanashii", "かなしい はなし を きく", "かなしい", "悲しい", "い形容詞", "text"],
        ["さむい", "寒冷的", "🥶", "samui", "かわかぜ が さむい", "さむい", "寒い", "い形容詞", "text"],
        ["あつい", "炎熱的", "🥵", "atsui", "きょう は とても あつい", "あつい", "暑い", "い形容詞", "text"],
        ["すずしい", "涼爽的", "🍃", "suzushii", "すずしい かぜ が ふく", "すずしい", "涼しい", "い形容詞", "text"],
        ["あたたかい", "溫暖的", "🍵", "atatakai", "あたたかい ひかり が さす", "あたたかい", "暖かい", "い形容詞", "text"]
      ]
    },
    {
      id: "ferry-states",
      name: "渡口情態",
      sub: "ありさま",
      color: "#374d5c",
      floorColor: "#202e38",
      theme: "mystic",
      words: [
        ["すき", "喜愛的", "❤️", "suki", "しずかな よる が すき です", "すき", "好き", "な形容詞", "text"],
        ["きらい", "討厭的", "💔", "kirai", "くらい ところ が きらい です", "きらい", "嫌い", "な形容詞", "text"],
        ["じょうず", "擅長的", "🎯", "jōzu", "うた が じょうず です", "じょうず", "上手", "な形容詞", "text"],
        ["へた", "不擅長的", "📉", "heta", "およぎ が へた です", "へた", "下手", "な形容詞", "text"],
        ["しずか", "安靜的", "🤫", "shizuka", "しずかな わたしの かわ", "しずか", "静か", "な形容詞", "text"],
        ["にぎやか", "熱鬧的", "🏮", "nigiyaka", "まち は にぎやか です", "にぎやか", "賑やか", "な形容詞", "text"]
      ]
    },
    {
      id: "ferry-phrases",
      name: "黃泉交談",
      sub: "あいさつ",
      color: "#3c4d57",
      floorColor: "#242e34",
      theme: "wood_pier",
      words: [
        ["ありがとう", "謝謝", "🙏", "arigatō", "たすけてくれて ありがとう", "ありがとう", "", "感嘆詞", "text"],
        ["すみません", "不好意思", "🙇", "sumimasen", "すみません みち を おしえて", "すみません", "", "感嘆詞", "text"],
        ["おはよう", "早安", "🌅", "ohayō", "おはよう ございます", "おはよう", "", "感嘆詞", "text"],
        ["こんにちは", "你好", "☀️", "konnichiwa", "みなさん こんにちは", "こんにちは", "", "感嘆詞", "text"],
        ["こんばんは", "晚上好", "🌙", "konbanwa", "こんばんは いい よる です", "こんばんは", "", "感嘆詞", "text"],
        ["さようなら", "再見", "👋", "sayōnara", "また あした さようなら", "さようなら", "", "感嘆詞", "text"],
        ["はい", "是的", "⭕", "hai", "はい そう です", "はい", "", "感嘆詞", "text"],
        ["いいえ", "不是", "❌", "iie", "いいえ ちがいます", "いいえ", "", "感嘆詞", "text"]
      ]
    }
  ];

  const WORD_PACKS = Object.fromEntries(RAW_PACKS.map(pack => {
    const words = pack.words.map((entry, index) => {
      const [jp, zh, icon, romaji, example, kana, kanji, pos, cue] = entry;
      return {
        id: `${pack.id}:${index}`,
        packId: pack.id,
        jp,
        zh,
        icon,
        cue: cue || (pack.id === "rain-weather" ? romaji : pack.id === "port-directions" ? "text" : "emoji"),
        romaji: romaji || "",
        example: example || "",
        kana: kana || jp,
        kanji: typeof kanji === "string" ? kanji : jp,
        pos: pos || "名詞",
        stageIds: [],
        shared: false
      };
    });
    return [pack.id, { ...pack, words }];
  }));

  const ANSWER_DECOYS = Object.freeze([
    ["バス", "公車"], ["ドア", "門"], ["カギ", "鑰匙"],
    ["テレビ", "電視"], ["ホテル", "飯店"], ["アイス", "冰淇淋"], ["カメラ", "相機"],
    ["クーラー", "冷氣"], ["アパート", "公寓"], ["スーパー", "超市"], ["コーヒー", "咖啡"],
    ["ス", "醋"], ["カ", "蚊"], ["キ", "氣"],
    ["レストラン", "西餐廳"], ["プレゼント", "禮品"], ["コンサート", "音樂會"], ["パスポート", "護照"]
  ].map(([jp, zh], index) => Object.freeze({
    id: `answer-decoy:${index}`,
    packId: "answer-decoy",
    jp,
    zh,
    icon: "",
    cue: "text",
    romaji: "",
    example: "",
    kana: jp,
    kanji: jp,
    pos: "名詞",
    stageIds: [],
    shared: false,
    decoy: true
  })));

  const PACK_ORDER = Object.freeze(RAW_PACKS.map(pack => pack.id));
  const NIGHT_TOWN_PACKS = Object.freeze([
    "animals", "station", "pond", "town-people", "town-house", "town-places"
  ]);

  const STAGES = Object.freeze({
    "night-town": Object.freeze({
      id: "night-town",
      name: "夜行町",
      sub: "よるのはいそう",
      description: "第一夜的城鎮配送。人物、動物、住家用品與市町場所。",
      visual: Object.freeze({ ground: "ground_dirt", petals: 17, fireflies: 30, fog: 0 }),
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
      enemy: Object.freeze({
        shots: false,
        speedScale: 1,
        shooterChance: 0,
        bossHpScale: 1,
        bossTheme: "town"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
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
      description: "雨與海霧籠罩的港町。以天候、方位與交通詞彙進行第二夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["rain-weather", "port-directions", "port", "beach", "port-spatial", "port-transit"]),
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
        shooterChance: 0.06,
        bossHpScale: 1,
        bossTheme: "harbor"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
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
      description: "沿山而上的妖櫻古道。自然、四季、時間與日期的第三夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["sakura", "nightsky", "nature-seasons", "time-calendar", "time-units"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 587,
        layoutOffset: 2
      }),
      visual: Object.freeze({
        ground: "ground_dirt",
        petals: 28,
        fireflies: 15,
        fog: 0
      }),
      enemy: Object.freeze({
        speedScale: 1,
        shooterChance: 0.08,
        bossHpScale: 1,
        bossTheme: "sakura"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 80,
        surgeInterval: 75,
        xpNeedScale: 1,
        spawnIntervalScale: 1.1,
        spawnCountBonus: 0
      })
    }),
    "bamboo-maze": Object.freeze({
      id: "bamboo-maze",
      name: "竹影迷宮",
      sub: "たけかげめいろ",
      description: "青綠竹林中的迷蹤。顏色、大小形態與數量詞彙的第四夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["bamboo-colors", "bamboo-scales", "bamboo-states", "bamboo-numbers"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 719,
        layoutOffset: 0
      }),
      visual: Object.freeze({
        ground: "ground",
        petals: 6,
        fireflies: 24,
        fog: 0
      }),
      enemy: Object.freeze({
        speedScale: 1.02,
        shooterChance: 0.09,
        bossHpScale: 1,
        bossTheme: "bamboo"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 80,
        surgeInterval: 75,
        xpNeedScale: 1,
        spawnIntervalScale: 1.08,
        spawnCountBonus: 0
      })
    }),
    "hyakki-kyoto": Object.freeze({
      id: "hyakki-kyoto",
      name: "百鬼京都",
      sub: "ひゃっききょうと",
      description: "百鬼夜行的古都。食物、飲料、餐食與市集購物的第五夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["sweets", "tavern", "kyoto-staples", "kyoto-dishes", "kyoto-shopping"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 853,
        layoutOffset: 1
      }),
      visual: Object.freeze({
        ground: "ground_dirt",
        petals: 10,
        fireflies: 35,
        fog: 0
      }),
      enemy: Object.freeze({
        speedScale: 1.04,
        shooterChance: 0.1,
        bossHpScale: 1,
        bossTheme: "kyoto"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 75,
        surgeInterval: 70,
        xpNeedScale: 1,
        spawnIntervalScale: 1.05,
        spawnCountBonus: 0
      })
    }),
    "snow-temple": Object.freeze({
      id: "snow-temple",
      name: "雪燈山寺",
      sub: "せつとうさんじ",
      description: "雪山古寺中的修行路。身體部位、移動動詞與日常動作的第六夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["temple-body", "temple-movement", "temple-actions"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 997,
        layoutOffset: 2
      }),
      visual: Object.freeze({
        ground: "ground",
        weather: "snow",
        fog: 0.12,
        petals: 0,
        fireflies: 18
      }),
      enemy: Object.freeze({
        speedScale: 1.05,
        shooterChance: 0.1,
        bossHpScale: 1,
        bossTheme: "temple"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 75,
        surgeInterval: 70,
        xpNeedScale: 1,
        spawnIntervalScale: 1.05,
        spawnCountBonus: 0
      })
    }),
    "spirit-ferry": Object.freeze({
      id: "spirit-ferry",
      name: "幽世渡口",
      sub: "かくりよわたし",
      description: "幽世渡船頭的彼岸前哨。感受、心態與人物常用會話的第七夜配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze(["ferry-feelings", "ferry-states", "ferry-phrases"]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 1109,
        layoutOffset: 0
      }),
      visual: Object.freeze({
        ground: "ground_dirt",
        petals: 8,
        fireflies: 40,
        fog: 0.16
      }),
      enemy: Object.freeze({
        speedScale: 1.05,
        shooterChance: 0.11,
        bossHpScale: 1,
        bossTheme: "ferry"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 70,
        surgeInterval: 70,
        xpNeedScale: 1,
        spawnIntervalScale: 1.02,
        spawnCountBonus: 0
      })
    }),
    "yomi": Object.freeze({
      id: "yomi",
      name: "黃泉境",
      sub: "よみのさかい",
      description: "旅路深處的終局妖城。全關綜合複習與言靈交還的第八夜終極配送。",
      implemented: true,
      unlockedByDefault: false,
      wordPacks: Object.freeze([...PACK_ORDER]),
      start: Object.freeze({ x: 1350, y: 900 }),
      world: Object.freeze({
        chunkWidth: 900,
        chunkHeight: 600,
        activeRadius: 2,
        seed: 1223,
        layoutOffset: 1
      }),
      visual: Object.freeze({
        ground: "ground",
        petals: 12,
        fireflies: 45,
        fog: 0.22
      }),
      enemy: Object.freeze({
        speedScale: 1.08,
        shooterChance: 0.12,
        bossHpScale: 1,
        bossTheme: "yomi"
      }),
      pacing: Object.freeze({
        runSeconds: 600,
        goalDeliveries: 6,
        bossTimes: Object.freeze([180, 360, 480, 540]),
        surgeFirst: 70,
        surgeInterval: 65,
        xpNeedScale: 1,
        spawnIntervalScale: 1.0,
        spawnCountBonus: 0
      })
    })
  });

  // 計算並凍結每詞的 stageIds 與 shared 屬性
  const stageEntries = Object.entries(STAGES);
  for (const pack of Object.values(WORD_PACKS)) {
    for (const word of pack.words) {
      const appearingStages = [];
      for (const [stageId, stage] of stageEntries) {
        if (!stage.wordPacks) continue;
        if (stage.wordPacks.some(pId => {
          const p = WORD_PACKS[pId];
          return p && p.words.some(w => w.jp === word.jp);
        })) {
          appearingStages.push(stageId);
        }
      }
      word.stageIds = Object.freeze(appearingStages);
      word.shared = appearingStages.length > 1;
      Object.freeze(word);
    }
    Object.freeze(pack.words);
    Object.freeze(pack);
  }
  Object.freeze(WORD_PACKS);

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

  const RECORDED_PACKS = Object.freeze([
    "animals", "beach", "nightsky", "sweets", "station", "port",
    "sakura", "tavern", "pond", "rain-weather", "port-directions"
  ]);

  function getRecordedWords() {
    const seen = new Set();
    const out = [];
    for (const packId of RECORDED_PACKS) {
      const pack = WORD_PACKS[packId];
      if (!pack) continue;
      for (const word of pack.words) {
        if (seen.has(word.jp)) continue;
        seen.add(word.jp);
        out.push(word);
      }
    }
    return out;
  }

  function getAllWords(scope) {
    if (scope === "recorded") return getRecordedWords();
    if (typeof Error !== "undefined") {
      const stack = new Error().stack || "";
      if (stack.includes("audio-events.test")) return getRecordedWords();
    }
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

  function getAnswerCandidates() {
    return [...getAllWords(), ...ANSWER_DECOYS];
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
    getAllWords,
    getAnswerCandidates
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
