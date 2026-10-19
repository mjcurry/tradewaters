// Synthesized sound effects (no audio files needed) and an optional music player that
// plays files dropped into assets/music/ (see assets/music/README.md).
(function () {
  let ac = null, master = null;
  const settings = { sfx: true, music: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('tw-audio') || '{}')); } catch (e) {}
  const saveSettings = () => { try { localStorage.setItem('tw-audio', JSON.stringify(settings)); } catch (e) {} };

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function noise(dur, filterFreq, gain, decay) {
    const a = ctx(); if (!a) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function tone(freq, dur, type = 'sine', gain = 0.2, slide = 0) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(a.currentTime + dur);
  }

  let lastCannon = 0;
  TW.sfx = function (name) {
    if (!settings.sfx) return;
    const now = performance.now();
    switch (name) {
      case 'cannon': if (now - lastCannon < 60) return; lastCannon = now; noise(0.5, 600, 0.9, 3); tone(70, 0.3, 'sine', 0.4, -30); break;
      case 'cannonFar': noise(0.4, 350, 0.35, 3); break;
      case 'hit': noise(0.35, 1800, 0.6, 2); tone(140, 0.2, 'square', 0.08, -80); break;
      case 'hitFar': noise(0.25, 1200, 0.25, 2); break;
      case 'boom': noise(1.0, 400, 1, 2); tone(50, 0.6, 'sine', 0.5, -20); break;
      case 'sink': noise(1.5, 300, 0.5, 1); break;
      case 'coins': [0, 70, 140].forEach((d, i) => setTimeout(() => tone(1400 + i * 300, 0.12, 'triangle', 0.12), d)); break;
      case 'click': tone(700, 0.05, 'triangle', 0.08); break;
      case 'bell': tone(880, 1.2, 'sine', 0.15); tone(1320, 0.8, 'sine', 0.06); break;
      case 'storm': noise(2.5, 500, 0.5, 0.6); break;
      case 'bad': tone(220, 0.4, 'sawtooth', 0.08, -100); break;
    }
  };

  // Music: one <audio> element that crossfades between named tracks if files exist.
  const TRACKS = { title: 'title', port: 'port', sea: 'sailing', combat: 'combat', tavern: 'tavern', victory: 'victory' };
  const missing = new Set();
  let audio = null, current = null;
  TW.music = function (name) {
    if (current === name) return;
    current = name;
    stopCurrent();
    if (!settings.music || !name || missing.has(name)) return;
    const el = new Audio();
    el.loop = name !== 'victory'; el.volume = 0;
    // The tracks are Opus-in-M4A; browsers that can't decode that (older Safari) get the MP3 copies.
    const exts = el.canPlayType('audio/mp4; codecs="opus"') ? ['m4a', 'mp3'] : ['mp3', 'm4a'];
    let i = 0;
    const tryNext = () => {
      if (i >= exts.length) { missing.add(name); return; }
      el.src = `assets/music/${TRACKS[name]}.${exts[i++]}`;
      start(el, name);
    };
    el.onerror = tryNext;
    tryNext();
    audio = el;
  };
  // Play and fade in. If autoplay is blocked this rejects quietly and the
  // first click or key press retries it. TW.onMusicStart lets the title screen
  // drop its "click to begin" prompt as soon as music is actually playing.
  function start(el, name) {
    el.play().then(() => {
      if (current === name && audio === el) { fade(el, 0.45, 1200); if (TW.onMusicStart) TW.onMusicStart(); }
      else el.pause();
    }).catch(() => {});
  }
  function stopCurrent() {
    if (!audio) return;
    const old = audio; audio = null;
    fade(old, 0, 600, () => old.pause());
  }
  // A newer fade on the same element cancels the older one, so a fade-in
  // still running can't undo a fade-out.
  function fade(el, to, ms, done) {
    // Timer-based so fades (and the pause at the end of a fade-out) still finish
    // in background tabs, where requestAnimationFrame stops firing.
    const from = el.volume, start = performance.now(), id = (el._fade = (el._fade || 0) + 1);
    const timer = setInterval(() => {
      if (el._fade !== id) return clearInterval(timer);
      const k = Math.min(1, (performance.now() - start) / ms);
      el.volume = Math.min(1, Math.max(0, from + (to - from) * k));
      if (k >= 1) { clearInterval(timer); if (done) done(); }
    }, 30);
  }
  TW.audioSettings = settings;
  TW.toggleAudio = function (key) {
    settings[key] = !settings[key]; saveSettings();
    if (key === 'music') {
      if (settings.music) { const c = current; current = null; TW.music(c); }
      else stopCurrent();   // keep `current` so turning music back on resumes this screen's track
    }
    return settings[key];
  };
  // Browsers block audio until the first user gesture.
  const unlock = () => { ctx(); if (current && audio && audio.paused && audio.src && settings.music) start(audio, current); };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
})();
