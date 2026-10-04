// 音訊系統：和風傳統樂器合成器（三味線、太鼓、拍子木、神樂鈴）與衝擊音效
window.AUDIO = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("yokai-muted-v1") === "true"; } catch {}
  let suspended = false;
  let bgmStep = 0;
  let bgmTimer = 0;
  let wordClip = null;
  let wordSpeechNonce = 0;
  let wordDucking = false;
  let pauseDucking = false;
  let activeBgm = null;
  let musicShouldPlay = false;
  const bgmAttempts = new WeakSet();
  function playMusic(audio, retry = false) {
    if (!audio || !audio.paused || (!retry && bgmAttempts.has(audio))) return;
    bgmAttempts.add(audio);
    audio.play().catch(() => {});
  }
  const BGM_NORMAL_VOLUME = 0.27;
  const BGM_DUCK_VOLUME = 0.10;
  const BGM_PAUSE_VOLUME = 0.055;
  const bgmRamps = new Map();
  const clipBuffers = new Map(), bufferSources = new Set();
  let audioEpoch = 0, wordSource = null;

  function loadBuffer(path, ac) {
    if (!clipBuffers.has(path)) {
      const pending = fetch(window.audioAsset?.(path) || path)
        .then(response => { if (!response.ok) throw new Error(`Audio HTTP ${response.status}`); return response.arrayBuffer(); })
        .then(bytes => ac.decodeAudioData(bytes));
      clipBuffers.set(path,pending);
      pending.catch(()=>{ if (clipBuffers.get(path)===pending) clipBuffers.delete(path); });
    }
    return clipBuffers.get(path);
  }

  function playBuffer(path, volume, options = {}) {
    if (typeof fetch !== 'function' || (!window.AudioContext && !window.webkitAudioContext)) return false;
    const ac = getCtx();
    if (!ac || typeof fetch !== 'function' || !ac.decodeAudioData || !ac.createBufferSource) return false;
    const epoch = audioEpoch;
    const current = () => !muted && !suspended && epoch===audioEpoch && (!options.isCurrent || options.isCurrent());
    loadBuffer(path,ac).then(buffer=>{
      if (!current()) return;
      const source = ac.createBufferSource(), gain = ac.createGain();
      source.buffer = buffer;gain.gain.value = volume;
      source.connect(gain);gain.connect(ac.destination);
      bufferSources.add(source);
      source.onended = () => { bufferSources.delete(source);options.onended?.(); };
      options.onstart?.(source);source.start();
    }).catch(()=>{ if (current()) options.onerror?.(); });
    return true;
  }

  function stopBuffers() {
    audioEpoch++;
    bufferSources.forEach(source=>{try {source.stop();} catch(e) {}});
    bufferSources.clear();wordSource=null;
  }

  function musicTracks() {
    return [...new Set([window.BGM, window.MAP_BGM].filter(Boolean))];
  }

  function rampMusicVolume(audio, target, duration = 180) {
    if (!audio) return;
    const old = bgmRamps.get(audio);
    if (old && typeof cancelAnimationFrame === "function") cancelAnimationFrame(old);
    bgmRamps.delete(audio);

    const safeTarget = Math.max(0, Math.min(1, target));
    if (audio.paused || typeof requestAnimationFrame !== "function" || typeof performance === "undefined") {
      audio.volume = safeTarget;
      return;
    }

    const start = audio.volume;
    const startedAt = performance.now();
    const step = now => {
      const t = Math.min(1, (now - startedAt) / duration);
      audio.volume = start + (safeTarget - start) * t;
      if (t < 1) {
        bgmRamps.set(audio, requestAnimationFrame(step));
      } else {
        bgmRamps.delete(audio);
      }
    };
    bgmRamps.set(audio, requestAnimationFrame(step));
  }

  function setWordDucking(enabled) {
    wordDucking = enabled;
    const target = musicVolume();
    const duration = enabled ? 140 : 220;
    musicTracks().forEach(audio => rampMusicVolume(audio, target, duration));
  }

  function musicVolume() {
    return pauseDucking ? BGM_PAUSE_VOLUME : wordDucking ? BGM_DUCK_VOLUME : BGM_NORMAL_VOLUME;
  }

  function beginWordSpeech() {
    const nonce = ++wordSpeechNonce;
    setWordDucking(true);
    return nonce;
  }

  function endWordSpeech(nonce) {
    if (nonce !== wordSpeechNonce) return;
    wordClip = null;
    setWordDucking(false);
  }

  // 可替換的實體 MP3 音效。檔案不存在／解碼或播放失敗時，會自動退回下方既有 Web Audio 合成音效。
  // 只列出實際提供的檔案；其餘音效直接使用既有合成器，避免首次播放請求缺檔。
  const SFX_FILES = {
    slash: "assets/audio/sfx/slash.mp3",
    boomerang: "assets/audio/sfx/boomerang.mp3",
    dash: "assets/audio/sfx/dash.mp3",
    needle: "assets/audio/sfx/needle.mp3",
    sanctuary: "assets/audio/sfx/sanctuary.mp3",
    deliverSuccess: "assets/audio/sfx/delivery-success.mp3",
    deliverWrong: "assets/audio/sfx/delivery-wrong.mp3",
    breakShield: "assets/audio/sfx/break-shield.mp3",
    levelUp: "assets/audio/sfx/level-up.mp3",
    warningPulse: "assets/audio/sfx/warning-pulse.mp3",
    bossDeath: "assets/audio/sfx/boss-death.mp3",
    fanfare: "assets/audio/sfx/fanfare.mp3",
    lose: "assets/audio/sfx/lose.mp3"
  };
  const SFX_VOLUME = {
    slash: 0.72, boomerang: 0.62, fireball: 0.66, thunder: 0.82,
    dash: 0.68, barrier: 0.72, needle: 0.62, hurt: 0.72,
    gem: 0.42, pickup: 0.62, sanctuary: 0.74, deliverSuccess: 0.78,
    deliverWrong: 0.72, breakShield: 0.82, levelUp: 0.76, warningPulse: 0.78,
    bossDeath: 0.78, fanfare: 0.75, lose: 0.7
  };
  const unavailableSfx = new Set();
  const activeSfx = new Set();

  function playExternalSfx(name, fallback, args, buffered = true) {
    if (muted || suspended) return;
    const src = SFX_FILES[name];
    if (src && buffered && playBuffer(src,SFX_VOLUME[name] ?? 0.7,{onerror:()=>playExternalSfx(name,fallback,args,false)})) return;
    if (!src || unavailableSfx.has(name)) {
      fallback(...args);
      return;
    }

    let audio;
    try {
      audio = new Audio(window.audioAsset?.(src) || src);
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
    const useFallback = reason => {
      cleanup();
      if (fellBack || muted || suspended) return;
      // 背景取消不補播；政策拒絕改走已解鎖合成器，但不把 MP3 標成壞檔。
      if (reason?.name === "AbortError") return;
      if (reason?.name === "NotSupportedError" || [3, 4].includes(audio.error?.code)) unavailableSfx.add(name);
      fellBack = true;
      audio.pause();
      fallback(...args);
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", useFallback, { once: true });

    try {
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === "function") playResult.catch(useFallback);
    } catch (e) {
      useFallback(e);
    }
  }

  // 接單、提示、送達與誤配都念同一個單字。
  // 目前 39 個詞統一使用 Gemini 3.8 Flash TTS / Leda（ja-JP）預錄。
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
    const path = `assets/audio/words/${file}.mp3`;
    const audio = new Audio(window.audioAsset?.(path) || path);
    audio.preload = "none";
    wordClips[file] = audio;
  });

  function stopWord(restoreMusic = true) {
    ++wordSpeechNonce;
    if (wordSource) { try { wordSource.stop(); } catch(e) {} wordSource=null; }
    if (wordClip) {
      wordClip.pause();
      try { wordClip.currentTime = 0; } catch (e) {}
      wordClip = null;
    }
    if (restoreMusic && wordDucking) setWordDucking(false);
  }

  // 日本傳統五音音階 (平調子 / 陰旋律)
  // Hirajoshi: Root, +2, +1, +4, +1 -> C, D, Eb, G, Ab
  const SCALE = [0, 2, 3, 7, 8, 12, 14, 15, 19, 20];
  const BASS_SCALE = [-12, -8, -5, 0, 2];

  function getCtx() {
    if (muted || suspended) return null;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio API not supported", e);
      }
    }
    if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
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
    bossDeath() {
      playTaiko(48, 0.3);
      playHyoshigi(0.18);
      [520, 390, 260].forEach((freq, i) => setTimeout(() => playSuzu(freq, 0.1), i * 140));
    },
    fanfare() {
      [261.63, 329.63, 392, 523.25].forEach((freq, i) => setTimeout(() => playShamisen(freq, 0.5, 0.12), i * 180));
      setTimeout(() => playSuzu(1046.5, 0.12), 600);
    },
    lose() {
      [392, 329.63, 261.63, 196].forEach((freq, i) => setTimeout(() => playShamisen(freq, 0.6, 0.1), i * 240));
    },
    init() {
      const ac = getCtx();
      if (musicShouldPlay && !muted && !suspended) playMusic(activeBgm, true);
      return ac;
    },
    preloadWords(words) {
      const ac = getCtx();
      if (!ac || typeof fetch !== 'function' || !ac.decodeAudioData) return;
      const paths = [...words.map(w=>WORD_FILES[w.jp]).filter(Boolean).map(file=>`assets/audio/words/${file}.mp3`),...Object.values(SFX_FILES)];
      let next = 0;
      const worker = async()=>{while(next<paths.length){const path=paths[next++];try {await loadBuffer(path,ac);}catch(e){}}};
      for(let i=0;i<4;i++) worker();
    },
    setSuspended(value) {
      suspended = value;
      if (!suspended) { if (activeBgm) bgmAttempts.delete(activeBgm); return; }
      stopBuffers();
      musicShouldPlay = false;
      for (const id of bgmRamps.values()) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      }
      bgmRamps.clear();
      musicTracks().forEach(audio => audio.pause());
      stopWord(false);
      wordDucking = false;
      window.speechSynthesis?.cancel();
      activeSfx.forEach(audio => audio.pause());
      activeSfx.clear();
      if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
    },
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem("yokai-muted-v1", String(muted)); } catch {}
      if (muted) musicTracks().forEach(audio => audio.pause());
      else if (musicShouldPlay && activeBgm) playMusic(activeBgm, true);
      if (muted) {
        stopBuffers();
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
      if (muted || suspended) return;
      const file = WORD_FILES[text];
      const audio = file && wordClips[file];
      if (audio) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        stopWord(false);
        const nonce = beginWordSpeech();
        const playMedia = () => {
          wordClip = audio;
          audio.volume = 1;
          try { audio.currentTime = 0; } catch (e) {}
          audio.onended = () => endWordSpeech(nonce);
          audio.onerror = () => endWordSpeech(nonce);
          try {audio.play().catch(()=>endWordSpeech(nonce));}catch(e){endWordSpeech(nonce);}
        };
        if (playBuffer(`assets/audio/words/${file}.mp3`,1,{
          isCurrent:()=>nonce===wordSpeechNonce,
          onstart:source=>{wordSource=source;},
          onended:()=>{if(nonce===wordSpeechNonce)wordSource=null;endWordSpeech(nonce);},
          onerror:playMedia
        })) return;
        playMedia();
        return;
      }
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        stopWord(false);
        window.speechSynthesis.cancel();
        const nonce = beginWordSpeech();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP";
        u.rate = 0.92;
        u.onend = () => endWordSpeech(nonce);
        u.onerror = () => endWordSpeech(nonce);
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

    // 背景音樂：旅路地圖用 MAP.mp3、遊戲用 BGM.mp3。
    // 外部檔不存在時才退回日式五音程序化循環。
    updateBgm(dt, state, elapsed, dawnTime) {
      if (suspended) return;
      const paused = state === "pause";
      if (pauseDucking !== paused) {
        pauseDucking = paused;
        musicTracks().forEach(audio => rampMusicVolume(audio, musicVolume(), 220));
      }
      const isMusicActive = (state === "play" || state === "levelup" || state === "pause" || state === "overworld");
      musicShouldPlay = isMusicActive && !muted;
      if (muted || !isMusicActive) {
        musicTracks().forEach(audio => {
          if (!audio.paused) audio.pause();
        });
        activeBgm = null;
        return;
      }

      const desiredBgm = state === "overworld"
        ? (window.MAP_BGM || window.BGM)
        : window.BGM;
      if (desiredBgm) {
        if (activeBgm !== desiredBgm) {
          musicTracks().forEach(audio => {
            if (audio !== desiredBgm && !audio.paused) audio.pause();
          });
          activeBgm = desiredBgm;
          bgmAttempts.delete(activeBgm);
          activeBgm.volume = musicVolume();
        }
        playMusic(activeBgm);
        return;
      }

      bgmTimer -= dt;
      if (bgmTimer > 0) return;
      bgmTimer = 0.36;

      const progress = Math.min(1, elapsed / dawnTime);
      const musicGain = musicVolume() / BGM_NORMAL_VOLUME;
      const melIdx = bgmStep % 16;
      const melodyNotes = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2];
      const pitchOffset = progress > 0.6 ? 7 : progress > 0.3 ? 2 : 0;

      // 拍點三味線主奏
      if (melIdx % 2 === 0 || progress > 0.7) {
        const note = melodyNotes[melIdx] + pitchOffset;
        playShamisen(noteFreq(note, 220), 0.32, (0.05 + progress * 0.03) * musicGain);
      }

      // 太鼓節奏（每 4 拍一擊，天色將明時加速）
      if (bgmStep % 4 === 0) {
        playTaiko(80, (0.12 + progress * 0.08) * musicGain);
      } else if (progress > 0.5 && bgmStep % 4 === 2) {
        playTaiko(95, 0.08 * musicGain);
      }

      // 神樂鈴點綴
      if (bgmStep % 8 === 0 && Math.random() < 0.6) {
        playSuzu(1500, 0.04 * musicGain);
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
