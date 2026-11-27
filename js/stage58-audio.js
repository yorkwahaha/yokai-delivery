// Source of truth for DEV playback, generation and review. Paths mirror the runtime naming convention.
((root) => {
  const base = "art/audio/stage58/";
  const stages = Object.freeze({
    "hyakki-kyoto": "百鬼京都", "snow-temple": "雪燈山寺", "spirit-ferry": "幽世渡口", yomi: "黃泉境"
  });
  const entries = [];
  function add(stage, event, name, when, kind, path, seconds, prompt, settings = {}) {
    entries.push(Object.freeze({ id: stage + "-" + event, stage, event, name, when, kind,
      path: base + path, seconds, prompt, seed: 580260 + entries.length * 17, ...settings }));
  }
  function music(stage, event, name, bpm, seconds, key, brief, meter = "4") {
    const ending = event === "ending";
    const when = { battle: "進關與王戰結束", boss: "首隻正式頭目登場至末隻退場",
      final: "言靈之核破封至赤月淡出", ending: "赤月開始淡出，延續至八夜結算" }[event];
    const prompt = `Original, purely instrumental Japanese fantasy game score. ${brief} ${bpm} BPM, ${meter}/4, ${key}. ${ending
        ? "Begin audibly in the first second, then slowly resolve into a quiet, clean final chord."
        : "Maintain a steady pulse and compatible first and last phrases for a seamless loop; enter on the downbeat, no intro silence, fade-out or final cadence."} Leave midrange space for Japanese vocabulary narration. No lyrics, vocals, chants, speech or sampled voices. Do not imitate existing melodies.`;
    add(stage, event, name, when, "music", `bgm/stages/${stage}/${stage}__${event}.mp3`,
      seconds, prompt, { bpm, key, meter, priority: "P0", loop: !ending,
        lyriaPrompt: `${prompt} Target duration: ${seconds} seconds.` });
  }
  music("hyakki-kyoto", "battle", "夜街百鬼行", 116, 108, "D minor",
    "Mysterious and lively night parade in old Kyoto, with syncopated shamisen, short breathy shakuhachi replies, hand-played taiko and dry hyoshigi. Underlying danger, never comic or club-like.");
  music("hyakki-kyoto", "boss", "祭夜封街", 148, 110, "D minor",
    "An old Kyoto festival turns into a pursuit. Rapid angular shamisen, layered heavy taiko, staccato low bowed strings and spare wooden clappers, a relentless but human acoustic pulse.");
  music("snow-temple", "battle", "雪徑寺燈", 96, 110, "E minor",
    "Lonely snowbound temple and warm stone lanterns. Airy shakuhachi and measured koto, occasional low temple bell and bowed bass. A regular walking pulse and quiet danger, no meditation drone.");
  music("snow-temple", "boss", "霜鐘暴雪", 132, 112, "E minor",
    "A mountain temple fight in a blizzard. Deep temple bells punctuate urgent rolling taiko and low string ostinato; cold metallic overtones and biting shakuhachi, with weight and room.");
  music("spirit-ferry", "battle", "墨河送舟", 96, 120, "A minor",
    "Ink-wash spirit river crossing. A low shakuhachi motif floats over distant plucks, muted frame drum and gently rocking meter. Mysterious crossing energy without horror or voices.", "6");
  music("spirit-ferry", "boss", "亡渡逆潮", 120, 120, "A minor",
    "Life and death contest on a dark river. Deep war drums and low strings push in waves under an uneven Japanese pentatonic plucked motif. Growing current and unstable accents, with no jump-scare stingers.", "6");
  music("yomi", "battle", "赤月荒徑", 108, 116, "C minor",
    "A dark, expansive and mournful march under a red moon. Deep taiko and tense bowed strings support a clearly foregrounded shamisen and low shakuhachi motif drawn from Japanese modal phrasing.");
  music("yomi", "boss", "冥門三關", 132, 116, "C minor",
    "Epic but austere battle at the gates of the underworld. Layered odaiko, forceful shamisen answers and climbing low strings. Acoustic Japanese emphasis with controlled peaks and a repeating battle pulse.");
  music("yomi", "final", "言靈之核", 156, 120, "C minor",
    "The climax of an eight-night courier journey. Recast the red-moon Japanese pentatonic idea in insistent shamisen and piercing shakuhachi, over powerful asymmetrical taiko and broad string arcs. Build tension in rising waves and return to the opening pulse. No Hollywood brass.");
  music("yomi", "ending", "八夜歸燈", 68, 30, "C minor",
    "The red moon fades and the last word-spirit is returned. Open with a soft struck temple bell, then a spare shakuhachi and koto reprise of an austere Japanese pentatonic motif. Tender low strings recede toward a cathartic dawn.");

  function effect(stage, event, actor, label, when, seconds, sound, priority = "P0", volume = .5) {
    const world = event === "ambience" || event === "spawn";
    const [action, phase] = event.split(".");
    const asset = action === "arrival" ? action :
      phase ? `${action === actor + "-crossing" ? "crossing" : action}-${phase}` : action;
    add(stage, event, label, when, world ? (event === "ambience" ? "ambience" : "effect") : "effect",
      `sfx/${world ? "world" : "enemies/" + actor}/${actor}__${asset}.mp3`, seconds,
      `Isolated game sound effect. ${sound} Duration ${seconds} seconds. No music, no speech, no vocals.`,
      { actor, priority, volume, loop: event === "ambience" });
  }
  const profiles = {
    "hyakki-kyoto": [
      "quiet festival street air, shifting paper lanterns and occasional wooden eave creaks",
      "a short sustained dry straw slide across old boards, ending with a gentle wooden touch",
      "kyoto-box-bellows", "木箱風妖", "short wooden bellows snap with a paper dart slicing forward",
      "one dry wood clack falling into fluttering festival paper"
    ],
    "snow-temple": [
      "steady cold mountain air, fine snow and soft wind around a deserted temple",
      "powdery snow compressing once under a small creature",
      "snow-lantern-monk", "雪燈僧", "a focused icy pellet hiss with a tiny crystalline click at launch",
      "deep icy slough and a close dusting of crystalline shards"
    ],
    "spirit-ferry": [
      "steady quiet river lapping against a wooden jetty with very sparse boat creaks",
      "a tiny wet board creak and single light ripple",
      "ferry-boat-mail-spirit", "船札靈", "a thin watery spirit dart, wet initial tap with a narrow fast whoosh",
      "a hollow downward submerged slosh and receding wooden groan"
    ],
    yomi: [
      "distant warm ash wind in a basalt chasm and faint irregular ember crackle",
      "a few small dry lava pebbles shifting underfoot",
      "yomi-gate-priest", "冥門祭妖", "a dry cinder dart popping out and fizzing in flight",
      "short dark ash collapse, gravel and one muted stone drop"
    ]
  };
  for (const [stage, [ambient, spawn, shooter, title, shot, death]] of Object.entries(profiles)) {
    effect(stage, "ambience", stage, "環境循環", "進入本關至退場，答題與暫停時降低音量", 24,
      `Continuous seamless field recording bed of ${ambient}. Stable density and level from start to end; no individual foreground events.`, "P1", .15);
    effect(stage, "spawn", stage, "小怪接近", "一般怪生成且距玩家小於 520px，共用一個節流槽", .8,
      `One small nearby creature arrival: ${spawn}. Dry, no repeated beats.`, "P1", .23);
    effect(stage, "shot", shooter, title + "・遠程發射", "射手實際建立投射物時", .8,
      `A single ${shot}. Immediate onset and short clean tail.`, "P1", .34);
    effect(stage, "death", stage + "-boss", "頭目倒下", "本關頭目血量歸零／倒下演出", 1.7,
      `One weighty yokai defeat: ${death}. A clear impact at the first frame.`, "P0", .67);
  }
  const bosses = {
    "hyakki-kyoto": [
      ["kyoto-taiko-warden", "太鼓門將", "one weighted taiko entrance beat and resonating wooden gate",
        "crossing", "taiko skin tightening and paired wooden warning clacks", "sideways street-wide taiko shock with a hard drum strike and board rattle"],
      ["kyoto-brocade-puppeteer", "錦幡伶", "close brocade unfurling with a lacquered puppet frame snap",
        "crossing", "a continuous rising scrape of brocade tightening on a wooden spindle, with soft high fabric friction lasting most of the cue", "rapid lateral snap of heavy brocade and lacquered pole beating timber"],
      ["kyoto-procession-marshal", "百鬼夜行主宰・酒吞", "low festival drum and a large wooden bar lifting",
        "crossing", "double wooden gate click and low swelling taiko resonance", "wide heavy festival shockwave rattling doors, sharp thud and short debris tail"]
    ],
    "snow-temple": [
      ["snow-frost-bell-guardian", "霜鐘石將", "a heavy stone footfall beside a muted temple bell",
        "frost-bell", "a frosted bell vibrating faintly and brittle cracks gathering in a circle", "deep resonant temple bell strike immediately cracking a circular ice sheet"],
      ["snow-white-kimono", "雪衣姬", "long silk sleeve whipping once through powdered snow",
        "ice-gale", "a high narrow cold intake indicating the locked wind lane", "a fast directional ice wind blast with granular snow and a rushing tail"],
      ["snow-mountain-lion", "雪嶺獅王", "heavy powdery snow impact and a low icy stone shudder",
        "blizzard-claws", "a frosty rasp gathering around a nearby circular mark", "a broad sharp raking ice fracture with a deep punch and scattering crystals"]
    ],
    "spirit-ferry": [
      ["ferry-shore-lion", "靈河鎮岸獅", "massive stone paw onto wet planks and a low river surge",
        "soul-splash", "a hollow swirl of water pressure rising from a marked circle", "a circular dense river splash with a submerged thump and falling droplets"],
      ["ferry-drowned-maiden", "水鏡巫女", "a quiet ripple breaking into a hollow mirrorlike ring",
        "spirit-tide", "a long low river intake and one light board strain", "a single broad horizontal wave slamming a jetty, low moving water and plank strain"],
      ["ferry-bell-oni", "沉鐘鬼將", "one deep muffled iron bell pulled out of river water",
        "soul-splash"],
      ["ferry-ferryman", "幽冥渡船使", "oar butt striking deck and the weight of a wooden ferry turning",
        "oar-sweep", "an oar scraping sideways across damp wood", "a fast sweeping timber oar strike across the river lane with a brief water slap"]
    ],
    yomi: [
      ["yomi-grave-samurai", "冥門骸武者", "heavy dry armor shifting at an ash-covered stone gate",
        "cinder-burst", "tight rising ash pressure with granular hiss around a marked circle", "one sudden circular cinder blast with a low stone thud and hot fine grit"],
      ["yomi-cinder-priestess", "灰火祭姬", "embers fanning on stone and a short dry ceremonial metal rattle",
        "fault-line", "sharp descending gravel ticks across a narrow rock seam", "instant linear basalt fracture, hard spreading crack and falling rock grit"],
      ["yomi-grave-serpent", "玄巖墓蛇", "a heavy basalt coil grinding past loose stones",
        "cinder-burst"],
      ["yomi-word-soul-core", "言靈之核", "deep suspended red-moon resonance with a strong single stone impact",
        "eclipse", "ominous tightening circular pressure and high rocky harmonic before a ring erupts",
        "an immediate huge double-layered stone impact expanding out into a ring, with dark subharmonic resonance and a brief red-hot debris tail"]
    ]
  };
  for (const [stage, roster] of Object.entries(bosses)) {
    for (const [actor, title, arrival, attack, warn, impact] of roster) {
      effect(stage, "arrival." + actor, actor, title + "・登場", "正式波次加入戰鬥的出場動畫", 1.6,
        `Single supernatural arrival: ${arrival}. Audible from the start, clean decay.`, "P0", .62);
      if (!warn) continue;
      const group = stage === "hyakki-kyoto" ? actor + "-" + attack : attack;
      effect(stage, group + ".warning", actor, title + "・預警", "鎖定傷害區，預警相位開始，半血追加重新提示", 1,
        `Warning cue: ${warn}. Immediate soft cue with rising intensity; no strike or rumble release.`, "P0", .52);
      effect(stage, group + ".impact", actor, title + "・爆發", "傷害區進入有效相位，每段一次", 1.65,
        `One attack release: ${impact}. Main transient at the very start, clean decay.`, "P0", attack === "eclipse" ? .86 : .68);
    }
  }
  effect("hyakki-kyoto", "rally.warning", "kyoto-crow-bell-courier", "鴉鈴・報信", "百鬼報信前搖開始", .8,
    "A small raised wooden and bronze signal bell, one short preparatory note.", "P1", .38);
  effect("hyakki-kyoto", "rally.impact", "kyoto-crow-bell-courier", "鴉鈴・集結", "成功加速已有普通怪時", .8,
    "One bright wood-and-bronze rally signal, quick double click and decay.", "P1", .44);
  effect("yomi", "core-collapse", "yomi-word-soul-core", "言靈之核・崩解", "血量歸零時破裂，勝利演出落地時重播一次", 3.2,
    "A huge suspended obsidian core breaks: immediate deep mineral crack followed by collapsing brittle plates, falling embers, and a fading dark resonance.", "P0", .84);
  // F9: local audition candidates derived by DSP from existing project cues.
  effect("spirit-ferry", "mud-pool", "ferry-shore-lion", "泥濘・生成", "泥濘池生成時一次", .75,
    "A short dense muddy water slurp with low damp grit.", "P1", .42);
  effect("yomi", "heavy-slash.warning", "yomi-grave-samurai", "冥門骸武者・重斬預警", "有向長條斬擊預警", 1.02,
    "Directional blade scrape and tightening dry mineral grit.", "P0", .58);
  effect("yomi", "heavy-slash.impact", "yomi-grave-samurai", "冥門骸武者・重斬爆發", "有向長條斬擊命中相位", 1.41,
    "Sharp linear fracture over a short low stone impact.", "P0", .77);
  // Detached name is stage-specific and cannot collide with its attack or arrival sounds.
  const byStage = Object.freeze(Object.fromEntries(Object.keys(stages).map(stage => [stage,
    Object.freeze(Object.fromEntries(entries.filter(row => row.stage === stage).map(row => [row.event, row])))])));
  // Public classroom media mirror: no authoring files or local review endpoint required.
  const publicEntries=Object.freeze(entries.map(row=>Object.freeze({...row,path:row.path.replace(base,"assets/audio/")})));
  const publicByStage=Object.freeze(Object.fromEntries(Object.keys(stages).map(stage=>[stage,
    Object.freeze(Object.fromEntries(publicEntries.filter(row=>row.stage===stage).map(row=>[row.event,row])))])));
  const catalog = Object.freeze({ base, stages, entries: Object.freeze(entries), byStage, publicEntries, publicByStage });
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  else root.STAGE58_AUDIO = catalog;
})(globalThis);
