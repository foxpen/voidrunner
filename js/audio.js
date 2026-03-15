// ─── VOID RUNNER — AUDIO (Web Audio API) ────────────────────────────────────

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicNodes = [];
  let musicPlaying = false;
  let sfxEnabled = true;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── SFX ─────────────────────────────────────────────────────────────────

  function sfx(type) {
    if (!ctx || !sfxEnabled) return;
    switch (type) {
      case 'shoot':    _shootSfx();    break;
      case 'hit':      _hitSfx();      break;
      case 'pickup':   _pickupSfx();   break;
      case 'death':    _deathSfx();    break;
      case 'emp':      _empSfx();      break;
      case 'boss_hit': _bossHitSfx();  break;
      case 'round':    _roundSfx();    break;
    }
  }

  function _shootSfx() {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(masterGain);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  }

  function _hitSfx() {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 300;
    src.buffer = buf;
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    src.start(); src.stop(ctx.currentTime + 0.15);
  }

  function _pickupSfx() {
    const freqs = [523, 659, 784];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.06;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    });
  }

  function _deathSfx() {
    // Deep explosion
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 200;
    src.buffer = buf;
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(0.8, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    src.start(); src.stop(ctx.currentTime + 0.8);
  }

  function _empSfx() {
    const osc  = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g    = ctx.createGain();
    osc.connect(g); osc2.connect(g); g.connect(masterGain);
    osc.type = 'sawtooth'; osc2.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);
    osc2.frequency.setValueAtTime(60, ctx.currentTime);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
    osc2.start(); osc2.stop(ctx.currentTime + 0.5);
  }

  function _bossHitSfx() {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  }

  function _roundSfx() {
    const freqs = [440, 550, 660, 880];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    });
  }

  // ── AMBIENT MUSIC ────────────────────────────────────────────────────────
  // Generativní procedurální ambient — 3 vrstvy:
  // 1. Drone (nízký tón, pomalé modulace)
  // 2. Pad (harmonické akordy)
  // 3. Pulse (rytmický puls)

  let droneOsc, droneGain;
  let padOscs = [], padGain;
  let pulseInterval;
  let musicGain;

  function startMusic(intensity = 0) {
    if (!ctx || musicPlaying) return;
    musicPlaying = true;

    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(masterGain);

    // Fade in
    musicGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 3);

    _startDrone(intensity);
    _startPad(intensity);
    _startPulse(intensity);
  }

  function _startDrone(intensity) {
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.3;
    droneGain.connect(musicGain);

    droneOsc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 55; // A1
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 4;

    lfo.connect(lfoGain);
    lfoGain.connect(droneOsc.frequency);

    // Filter for warmth
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 300 + intensity * 200;
    filt.Q.value = 2;

    droneOsc.connect(filt);
    filt.connect(droneGain);

    droneOsc.start(); lfo.start();
    musicNodes.push(droneOsc, lfo);
  }

  function _startPad(intensity) {
    padGain = ctx.createGain();
    padGain.gain.value = 0.15;
    padGain.connect(musicGain);

    // Dm chord: D3, F3, A3, C4
    const chords = [
      [146.83, 174.61, 220, 261.63],  // Dm
      [130.81, 164.81, 196, 246.94],  // Cm
      [110,    138.59, 164.81, 220],  // Am
      [123.47, 155.56, 185, 246.94],  // Bm
    ];
    let chordIdx = 0;

    const playChord = () => {
      padOscs.forEach(o => { try { o.stop(); } catch(e){} });
      padOscs = [];
      const chord = chords[chordIdx % chords.length];
      chordIdx++;

      chord.forEach(freq => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 800;

        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 2);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 6);

        osc.connect(filt); filt.connect(gain); gain.connect(padGain);
        osc.start();
        padOscs.push(osc);
        musicNodes.push(osc);
      });
    };

    playChord();
    const chordTimer = setInterval(playChord, 8000);
    musicNodes.push({ stop: () => clearInterval(chordTimer) });
  }

  function _startPulse(intensity) {
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.12 + intensity * 0.08;
    pulseGain.connect(musicGain);

    const bpm = 80 + intensity * 20;
    const beat = 60000 / bpm;

    let tick = 0;
    pulseInterval = setInterval(() => {
      if (!ctx) return;
      const osc  = ctx.createOscillator();
      const g    = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = tick % 4 === 0 ? 80 : 160;

      osc.type = 'sine';
      osc.frequency.value = tick % 4 === 0 ? 55 : 82.5;
      g.gain.setValueAtTime(tick % 4 === 0 ? 0.5 : 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(filt); filt.connect(g); g.connect(pulseGain);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
      tick++;
    }, beat);
    musicNodes.push({ stop: () => clearInterval(pulseInterval) });
  }

  function setMusicIntensity(level) {
    // 0 = calm, 1 = intense (boss)
    if (!musicGain || !ctx) return;
    const target = 0.5 + level * 0.5;
    musicGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 2);
  }

  function stopMusic() {
    musicPlaying = false;
    musicNodes.forEach(n => { try { n.stop?.(); } catch(e){} });
    musicNodes = [];
    padOscs = [];
  }

  function setVolume(v) {
    if (masterGain) masterGain.gain.value = v;
  }

  return {
    init, resume, sfx, startMusic, stopMusic, setMusicIntensity, setVolume,
    get playing() { return musicPlaying; },
  };
})();
