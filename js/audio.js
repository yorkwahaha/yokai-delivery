// 音訊系統：和風傳統樂器合成器（三味線、太鼓、拍子木、神樂鈴）與衝擊音效
window.AUDIO = (() => {
  let ctx = null;
  let muted = false;
  let bgmStep = 0;
  let bgmTimer = 0;
  let wordClip = null;

  // 可替換的實體 MP3 音效。檔案不存在／解碼或播放失敗時，會自動退回下方既有 Web Audio 合成音效。
  // 命名採固定英文 kebab-case，之後只要把同名 MP3 丟進 assets/audio/sfx/ 即可，不必再改程式。
  const SFX_FILES = {
    slash: "assets/audio/sfx/slash.mp3",
    boomerang: "assets/audio/sfx/boomerang.mp3",
    fireball: "assets/audio/sfx/fireball.mp3",
    thunder: "assets/audio/sfx/thunder.mp3",
    dash: "assets/audio/sfx/dash.mp3",
    barrier: "assets/audio/sfx/barrier.mp3",
    needle: "assets/audio/sfx/needle.mp3",
    hurt: "assets/audio/sfx/hurt.mp3",
    gem: "assets/audio/sfx/gem.mp3",
    pickup: "assets/audio/sfx/pickup.mp3",
    sanctuary: "assets/audio/sfx/sanctuary.mp3",
    deliverSuccess: "assets/audio/sfx/delivery-success.mp3",
    deliverWrong: "assets/audio/sfx/delivery-wrong.mp3",
    breakShield: "assets/audio/sfx/break-shield.mp3",
    levelUp: "assets/audio/sfx/level-up.mp3",
    warningPulse: "assets/audio/sfx/warning-pulse.mp3"
  };
  const SFX_VOLUME = {
    slash: 0.72, boomerang: 0.62, fireball: 0.66, thunder: 0.82,
    dash: 0.68, barrier: 0.72, needle: 0.62, hurt: 0.72,
    gem: 0.42, pickup: 0.62, sanctuary: 0.74, deliverSuccess: 0.78,
    deliverWrong: 0.72, breakShield: 0.82, levelUp: 0.76, warningPulse: 0.78
  };
  const unavailableSfx = new Set();
  const activeSfx = new Set();

  function playExternalSfx(name, fallback, args) {
    if (muted) return;
    const src = SFX_FILES[name];
    if (!src || unavailableSfx.has(name)) {
      fallback(...args);
      return;
    }

    let audio;
    try {
      audio = new Audio(src);
    } catch (e) {
      unavailableSfx.add(name);
      fallback(...args);
      return;
    }

    audio.preload = "auto";
    audio.volume = SFX_VOLUME[name] ?? 0.7;
    activeSfx.add(audio);
    let fellBack = false;
    const cleanup = () => activeSfx.delete(audio);
    const useFallback = () => {
      cleanup();
      unavailableSfx.add(name);
      if (fellBack || muted) return;
      fellBack = true;
      fallback(...args);
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", useFallback, { once: true });

    try {
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === "function") playResult.catch(useFallback);
    } catch (e) {
      useFallback();
    }
  }

  // 接單、提示、送達與誤配都念同一個單字。全專案統一使用 Fish Audio「AZKi」聲線。
  // Public model: 5f8f82504223455f906c53e6d3e6b8cd
  const WORD_FILES = {
    "ねこ": "neko",
    "いぬ": "inu",
    "うさぎ": "usagi",
    "さかな": "sakana",
    "うみ": "umi",
    "かめ": "kame",
    "つき": "tsuki",
    "ほし": "hoshi",
    "にじ": "niji",
    "りんご": "ringo",
    "おにぎり": "onigiri",
    "ケーキ": "keeki",
    "えき": "eki",
    "ほん": "hon",
    "かさ": "kasa",
    "くるま": "kuruma",
    "ふね": "fune",
    "ひこうき": "hikouki",
    "さくら": "sakura",
    "やま": "yama",
    "はな": "hana",
    "おちゃ": "ocha",
    "ラーメン": "ramen",
    "パン": "pan",
    "とり": "tori",
    "たこ": "tako",
    "かえる": "kaeru",
    "あめ": "ame",
    "かぜ": "kaze",
    "くも": "kumo",
    "きり": "kiri",
    "かみなり": "kaminari",
    "ゆき": "yuki",
    "みぎ": "migi",
    "ひだり": "hidari",
    "まえ": "mae",
    "うしろ": "ushiro",
    "きた": "kita",
    "みなみ": "minami"
  };
  const wordClips = {};
  Object.values(WORD_FILES).forEach(file => {
    const audio = new Audio(`assets/audio/words/${file}.mp3`);
    audio.preload = "auto";
    wordClips[file] = audio;
  });

  function stopWord() {
    if (!wordClip) return;
    wordClip.pause();
    try { wordClip.currentTime = 0; } catch (e) {}
  }

  // 日本傳統五音音階 (平調子 / 陰旋律)
  // Hirajoshi: Root, +2, +1, +4, +1 -> C, D, Eb, G, Ab
  const SCALE = [0, 2, 3, 7, 8, 12, 14, 15, 19, 20];
  const BASS_SCALE = [-12, -8, -5, 0, 2];

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio API not supported", e);
      }
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function noteFreq(semitone, root = 220) {
    return root * Math.pow(2, semitone / 12);
  }

  // 1. 三味線 / 琵琶撥弦音
  function playShamisen(freq, duration = 0.45, vol = 0.12) {
    const ac = getCtx();
    if (!ac || muted) return;
    const now = ac.currentTime;

    // 雙振盪器模擬琴弦泛音
    const osc1 = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc1.type = "sawtooth";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(freq, now);
    // 撥弦時帶有微幅滑音（撥子按壓效果）
    osc1.frequency.exponentialRampToValueAtTime(freq * 0.995, now + duration);
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // 2. 和太鼓 (Taiko Bass Drum)
  function playTaiko(pitch = 90, vol = 0.22) {
    const ac = getCtx();
    if (!ac || muted) return;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    // 拍擊雜訊脈衝 (Stick hit slap)
    const noise = ac.createBufferSource();
    const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 300);
    noise.buffer = buf;
    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(noiseGain);
    noiseGain.connect(ac.destination);
    noise.start(now);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 3. 拍子木 (Hyoshigi / 劇目開場木塊清脆聲)
  function playHyoshigi(vol = 0.15) {
    const ac = getCtx();
    if (!ac || muted) return;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1420, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 4. 神樂鈴 / 仙境金幣叮鈴聲 (Suzu Chime)
  function playSuzu(freq = 1760, vol = 0.08) {
    const ac = getCtx();
    if (!ac || muted) return;
    const now = ac.currentTime;

    [freq, freq * 1.5, freq * 2.05].forEach((f, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.015);
      gain.gain.setValueAtTime(vol, now + idx * 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + idx * 0.02);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + idx * 0.015);
      osc.stop(now + 0.4);
    });
  }

  // 5. 戰鬥打擊音效
  const api = {
    init: getCtx,
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      if (window.BGM) {
        if (muted) window.BGM.pause();
        else window.BGM.play().catch(() => {});
      }
      if (muted) {
        stopWord();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        activeSfx.forEach(audio => {
          try { audio.pause(); } catch (e) {}
        });
        activeSfx.clear();
      }
      return muted;
    },

    // 揮刀斬擊
    slash() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    },

    // 符咒迴力鏢
    boomerang() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    },

    // 狐火燃燒
    fireball() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.2);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    },

    // 落雷轟擊
    thunder() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.4);
      playTaiko(75, 0.25);
    },

    // 衝刺風鳴
    dash() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    },

    // 淨化靈陣（神道神樂鈴 + 深層除魔震波）
    barrier() {
      const ac = getCtx();
      if (!ac || muted) return;
      playSuzu(1480, 0.15);
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.32);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    },

    // 破魔靈針（清脆高速穿雲嘯音）
    needle() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1420, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },

    // 擊中受傷
    hurt() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    },

    // 拾取靈玉 / 經驗
    gem() {
      playSuzu(1320 + Math.random() * 200, 0.04);
    },

    // 接取委託音效（輕快和紙與鈴鐺音，區別於送達大吉）
    pickup() {
      playSuzu(1560, 0.08);
      setTimeout(() => playShamisen(noteFreq(2, 260), 0.22, 0.08), 40);
    },

    // 結界啟動音效（神道清聖結界）
    sanctuary() {
      playSuzu(2100, 0.2);
      playHyoshigi(0.18);
    },

    // 日語單字：既有詞優先播放預錄聲線；新關卡尚未補錄的詞才單獨退回 ja-JP 系統語音。
    // 兩者互斥，避免曾經出現的預錄音與 fallback 同時發聲。
    speak(text) {
      if (muted) return;
      const file = WORD_FILES[text];
      const audio = file && wordClips[file];
      if (audio) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (wordClip && wordClip !== audio) stopWord();
        wordClip = audio;
        audio.volume = 0.95;
        try { audio.currentTime = 0; } catch (e) {}
        audio.play().catch(() => {});
        return;
      }
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        stopWord();
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP";
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      }
    },

    // 送達正確（拍子木 + 神樂鈴大吉）
    deliverSuccess() {
      playHyoshigi(0.2);
      setTimeout(() => playSuzu(1760, 0.14), 60);
      setTimeout(() => playShamisen(noteFreq(7, 260), 0.4, 0.15), 140);
    },

    // 送達錯誤 / 誤配妖怪召喚
    deliverWrong() {
      const ac = getCtx();
      if (!ac || muted) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    },

    // 破防成功
    breakShield() {
      playHyoshigi(0.25);
      playSuzu(2200, 0.16);
      playTaiko(110, 0.2);
    },

    // 升級音效
    levelUp() {
      [0, 4, 7, 12].forEach((s, idx) => {
        setTimeout(() => playShamisen(noteFreq(s, 293), 0.5, 0.13), idx * 80);
      });
      setTimeout(() => playSuzu(1980, 0.15), 320);
    },

    // 百鬼夜行預警三連擊鼓點 (緊張警報感)
    warningPulse(idx = 0) {
      playTaiko(70 + idx * 12, 0.26);
      playHyoshigi(0.22);
    },

    // 背景音樂步進循環（日式五音循環，黎明漸強，選卡片期間持續播放不中斷）
    updateBgm(dt, state, elapsed, dawnTime) {
      const isMusicActive = (state === "play" || state === "levelup" || state === "pause" || state === "overworld");
      if (muted || !isMusicActive) {
        if (window.BGM && !window.BGM.paused) window.BGM.pause();
        return;
      }
      if (window.BGM) {
        if (window.BGM.paused) window.BGM.play().catch(() => {});
        return;
      }

      bgmTimer -= dt;
      if (bgmTimer > 0) return;
      bgmTimer = 0.36;

      const progress = Math.min(1, elapsed / dawnTime);
      const melIdx = bgmStep % 16;
      const melodyNotes = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2];
      const pitchOffset = progress > 0.6 ? 7 : progress > 0.3 ? 2 : 0;

      // 拍點三味線主奏
      if (melIdx % 2 === 0 || progress > 0.7) {
        const note = melodyNotes[melIdx] + pitchOffset;
        playShamisen(noteFreq(note, 220), 0.32, 0.05 + progress * 0.03);
      }

      // 太鼓節奏（每 4 拍一擊，天色將明時加速）
      if (bgmStep % 4 === 0) {
        playTaiko(80, 0.12 + progress * 0.08);
      } else if (progress > 0.5 && bgmStep % 4 === 2) {
        playTaiko(95, 0.08);
      }

      // 神樂鈴點綴
      if (bgmStep % 8 === 0 && Math.random() < 0.6) {
        playSuzu(1500, 0.04);
      }

      bgmStep++;
    }
  };

  // 對外 API 保持不變；只替 SFX 方法加上一層「MP3 優先、合成音 fallback」。
  Object.keys(SFX_FILES).forEach(name => {
    const fallback = api[name];
    if (typeof fallback !== "function") return;
    api[name] = (...args) => playExternalSfx(name, fallback, args);
  });

  return api;
})();
