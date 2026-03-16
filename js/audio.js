// ─── VOID RUNNER — AUDIO ────────────────────────────────────────────────────
// Hudba: Interstellar styl — varhany, hlubokáé drony, reverb, pomalé akordy
// Spouští se JEN při hraní (ne na menu/onboardingu)

const Audio = (() => {
  let ctx = null;
  let master = null;
  let reverb = null;
  let musicPlaying = false;
  let allNodes = [];
  let fadeGain = null;

  // Chord progression — Am, F, C, G (Hans Zimmer vibes)
  const CHORDS = [
    [110, 130.81, 164.81, 220],      // Am  — A2 C3 E3 A3
    [87.31, 130.81, 174.61, 261.63], // F   — F2 C3 F3 C4
    [65.41, 130.81, 164.81, 196],    // C   — C2 C3 E3 G3
    [98, 123.47, 146.83, 196],       // G   — G2 B2 D3 G3
  ];
  let chordIdx = 0;
  let chordTimer = null;

  // ── INIT ──────────────────────────────────────────────────────────────────
  let musicEnabled = true;
  let sfxEnabled   = true;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      // Reverb — kratší buffer aby neblokoval (1s místo 4.5s)
      setTimeout(() => { reverb = _makeReverb(1.0); }, 0);
    } catch(e) { console.warn('Audio init failed:', e); }
  }

  function resume() {
    try { ctx?.state === 'suspended' && ctx.resume(); } catch(e) {}
  }

  function setMusic(enabled) {
    musicEnabled = enabled;
    if (!enabled) stopMusic();
    else if (!musicPlaying) startMusic();
  }

  function setSfx(enabled) { sfxEnabled = enabled; }

  // Impulse reverb — krátký (1s) = malý buffer, bez freeze
  function _makeReverb(duration) {
    try {
      const len  = Math.floor(ctx.sampleRate * duration);
      const buf  = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = buf.getChannelData(c);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.0);
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      conv.connect(master);
      return conv;
    } catch(e) { return null; }
  }

  // ── ORGAN NOTE ─────────────────────────────────────────────────────────────
  // Pipe organ = sum of sine harmonics
  function _organ(freq, gainVal, startTime, dur, target) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gainVal, startTime + 0.8);
    g.gain.setValueAtTime(gainVal, startTime + dur - 1.5);
    g.gain.linearRampToValueAtTime(0, startTime + dur);
    g.connect(target);
    allNodes.push(g);

    // Harmonics: 1, 2, 3, 4, 5 (organ character)
    const harmonics = [1, 2, 3, 4, 6];
    const amps      = [1, 0.5, 0.25, 0.12, 0.06];
    harmonics.forEach((h, i) => {
      const osc = ctx.createOscillator();
      const hg  = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * h;
      hg.gain.value = amps[i];
      osc.connect(hg); hg.connect(g);
      osc.start(startTime); osc.stop(startTime + dur + 0.1);
      allNodes.push(osc, hg);
    });
    return g;
  }

  // ── DRONE ─────────────────────────────────────────────────────────────────
  function _startDrone() {
    const dg = ctx.createGain();
    dg.gain.value = 0.18;
    if (reverb) dg.connect(reverb);
    dg.connect(master);

    // Sub-bass drone A1 (55 Hz)
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = 'sine'; lfo.frequency.value = 0.05;
    lfoG.gain.value = 3;
    lfo.connect(lfoG); lfo.start();
    allNodes.push(lfo, lfoG);

    [55, 82.41, 110].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 400;

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      lfoG.connect(osc.frequency); // subtle wobble

      g.gain.value = i === 0 ? 0.6 : 0.15 - i * 0.04;
      osc.connect(filt); filt.connect(g); g.connect(dg);
      osc.start(); allNodes.push(osc, g, filt);
    });
  }

  // ── CHORD PLAYER ──────────────────────────────────────────────────────────
  function _playChord(idx) {
    const now    = ctx.currentTime;
    const dur    = 12; // každý akord trvá 12 sekund
    const chord  = CHORDS[idx % CHORDS.length];

    const chordG = ctx.createGain();
    chordG.gain.value = 1;
    if (reverb) chordG.connect(reverb);
    chordG.connect(master);

    chord.forEach((freq, i) => {
      const vol = i === 0 ? 0.10 : 0.055 - i * 0.008;
      _organ(freq, vol, now + 0.1, dur - 0.1, chordG);
    });

    // Bass pedal — two octaves below root
    _organ(chord[0] / 2, 0.13, now + 0.1, dur - 0.1, master);
  }

  // ── START / STOP ──────────────────────────────────────────────────────────
  function startMusic() {
    if (!ctx || musicPlaying || !musicEnabled) return;
    musicPlaying = true;

    fadeGain = ctx.createGain();
    fadeGain.gain.setValueAtTime(0, ctx.currentTime);
    fadeGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 4); // 4s fade-in
    fadeGain.connect(master);

    _startDrone();

    // Play chords on a loop
    chordIdx = 0;
    _playChord(chordIdx++);
    chordTimer = setInterval(() => {
      if (!ctx) return;
      _playChord(chordIdx++);
    }, 12000);
  }

  function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    clearInterval(chordTimer);

    // Fade out
    if (master && ctx) {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => {
        allNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch(e){} });
        allNodes = [];
        master.gain.value = 0.55;
      }, 2500);
    }
  }

  function setIntensity(level) {
    // 0 = calm, 1 = boss
    if (!master || !ctx) return;
    const vol = 0.45 + level * 0.35;
    master.gain.linearRampToValueAtTime(vol, ctx.currentTime + 3);
  }

  // ── SFX ───────────────────────────────────────────────────────────────────
  function sfx(type) {
    if (!ctx || !sfxEnabled) return;
    if (type === 'shoot' && !sfxEnabled) return;
    switch(type) {
      case 'shoot':    _sfxShoot();   break;
      case 'pickup':   _sfxPickup();  break;
      case 'emp':      _sfxEmp();     break;
      case 'death':    _sfxDeath();   break;
      case 'hit':      _sfxHit();     break;
      case 'round':    _sfxRound();   break;
      case 'upgrade':   _sfxUpgrade();   break;
      case 'rare':      _sfxRare();      break;
      case 'legendary': _sfxLegendary(); break;
    }
  }

  function _sfxShoot() {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(master);
    o.type = 'square';
    o.frequency.setValueAtTime(700, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(); o.stop(ctx.currentTime + 0.08);
  }

  function _sfxPickup() {
    [523, 659, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(master);
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  }

  function _sfxEmp() {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 400;
    o.connect(f); f.connect(g); g.connect(master);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  }

  function _sfxDeath() {
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.6);
    }
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    const f   = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 180;
    src.buffer = buf;
    src.connect(f); f.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.7, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    src.start(); src.stop(ctx.currentTime + 1.2);
  }

  function _sfxHit() {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(master);
    o.type = 'sine';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start(); o.stop(ctx.currentTime + 0.2);
  }

  function _sfxRound() {
    [330, 440, 550, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(master);
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.5);
    });
  }

  function _sfxUpgrade() {
    [330, 550, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(master);
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.3);
    });
  }

  function _sfxRare() {
    // Vzestupný arpeggio — přirozenější než common
    [440, 660, 880, 1100, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(master);
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.38);
    });
  }

  function _sfxLegendary() {
    // Epický chord burst — nízký + vysoký najednou
    const now = ctx.currentTime;
    [[220, 0], [440, 0.02], [660, 0.04], [880, 0.06], [1320, 0.08], [1760, 0.12]].forEach(([f, delay]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(master);
      o.type = 'sine'; o.frequency.value = f;
      const t = now + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.start(t); o.stop(t + 0.75);
    });
  }

  return {
    init, resume, startMusic, stopMusic, setIntensity, sfx,
    setMusic, setSfx,
    get playing()       { return musicPlaying; },
    get musicEnabled()  { return musicEnabled; },
    get sfxEnabled()    { return sfxEnabled; },
  };
})();
