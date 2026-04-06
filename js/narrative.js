// ─── VOID RUNNER — NARRATIVE SYSTEM ─────────────────────────────────────────
// Cinematic story panels shown at key moments. Each panel is pure canvas.
// Trigger: Narrative.show('sceneId', callback)

const Narrative = (() => {

  // ── SCENE DATA ────────────────────────────────────────────────────────────
  const SCENES = {
    signal: {
      num: '01', title: 'THE SIGNAL',
      sub: null,
      body: 'If you\'re hearing this...\nyou\'ve come closer than anyone before.',
      style: 'terminal',
      duration: 280,
    },
    void: {
      num: '02', title: 'THE VOID REVEALED',
      sub: null,
      body: 'This isn\'t just a black hole.\nIt reacts.',
      style: 'space',
      duration: 260,
    },
    mission: {
      num: '03', title: 'THE MISSION',
      sub: null,
      body: 'Everyone who got close... vanished.\nYou have one chance.',
      style: 'space',
      duration: 260,
    },
    approach: {
      num: '04', title: 'THE APPROACH',
      sub: 'ROUNDS  1 – 3',
      body: 'Gravitational fields stable... for now.\nKeep your course.',
      style: 'space',
      duration: 220,
    },
    shift: {
      num: '05', title: 'REALITY SHIFT',
      sub: 'ROUNDS  4 – 6',
      body: 'Nothing makes sense...\nObjects move against their trajectory.',
      style: 'distort',
      duration: 220,
    },
    unstable: {
      num: '06', title: 'UNSTABLE',
      sub: 'ROUNDS  7 – 9',
      body: 'Reality is breaking apart.\nThere\'s no way back.',
      style: 'distort',
      duration: 220,
    },
    guardian: {
      num: '07', title: 'THE GUARDIAN',
      sub: 'BOSS',
      body: 'This isn\'t an object.\nIt\'s a reaction.',
      style: 'boss',
      duration: 300,
    },
    passage: {
      num: '08', title: 'THE FINAL PASS',
      sub: null,
      body: 'This is it... the passage.\nNow. Don\'t stop.',
      style: 'white',
      duration: 280,
    },
    beyond: {
      num: '09', title: 'BEYOND',
      sub: null,
      body: '...This isn\'t our universe.\nThe signal... it\'s different.',
      style: 'beyond',
      duration: 320,
    },
  };

  // ── STATE ─────────────────────────────────────────────────────────────────
  let _active     = false;
  let _scene      = null;
  let _frame      = 0;      // 60fps-normalised frame counter (display-rate independent)
  let _startTime  = 0;      // performance.now() at scene start
  let _onComplete = null;
  let _stars      = [];
  let _particles  = [];
  let _skipReady  = false;

  // ── STARS ─────────────────────────────────────────────────────────────────
  function _genStars(W, H) {
    _stars = [];
    for (let i = 0; i < 220; i++) {
      _stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.12 ? 1.4 : 0.6,
        a: 0.3 + Math.random() * 0.7,
        t: Math.random() * Math.PI * 2,
        ts: 0.008 + Math.random() * 0.02,
      });
    }
  }

  function _genParticles(W, H, style) {
    _particles = [];
    const count = style === 'boss' ? 60 : style === 'distort' ? 45 : 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 0.2 + Math.random() * (style === 'boss' ? 1.2 : 0.5);
      _particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r: 0.5 + Math.random() * 2,
        a: Math.random(),
        color: style === 'boss'    ? `hsl(${Math.random()*30},100%,60%)` :
               style === 'distort' ? `hsl(${200+Math.random()*80},80%,70%)` :
               style === 'beyond'  ? `hsl(${30+Math.random()*40},90%,70%)` :
               '#aaccff',
      });
    }
  }

  // ── PUBLIC: show ──────────────────────────────────────────────────────────
  function show(sceneId, onComplete) {
    const scene = SCENES[sceneId];
    if (!scene) { if (onComplete) onComplete(); return; }

    _scene      = { ...scene, id: sceneId };
    _frame      = 0;
    _startTime  = performance.now();
    _active     = true;
    _onComplete = onComplete || null;
    _skipReady  = false;

    const W = window.innerWidth, H = window.innerHeight;
    _genStars(W, H);
    _genParticles(W, H, scene.style);

    // Allow skip after 2 seconds (real time, independent of refresh rate)
    setTimeout(() => { _skipReady = true; }, 2000);
  }

  function _complete() {
    _active = false;
    _scene  = null;
    if (_onComplete) { const cb = _onComplete; _onComplete = null; cb(); }
  }

  // ── TICK ──────────────────────────────────────────────────────────────────
  function tick() {
    if (!_active || !_scene) return;
    // Normalise to 60fps so durations are display-rate independent
    _frame = Math.round((performance.now() - _startTime) / (1000 / 60));

    _stars.forEach(s => { s.t += s.ts; });
    _particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.a = Math.max(0, p.a - 0.003);
      if (p.a <= 0) {
        const W = window.innerWidth, H = window.innerHeight;
        p.x = Math.random() * W; p.y = Math.random() * H;
        p.a = 0.6 + Math.random() * 0.4;
      }
    });

    if (_frame >= _scene.duration) _complete();
  }

  // ── DRAW ──────────────────────────────────────────────────────────────────
  function draw(ctx, W, H) {
    if (!_active || !_scene) return;

    const s     = _scene;
    const f     = _frame;
    const dur   = s.duration;

    // Fade in / out
    const fadeIn  = Math.min(1, f / 40);
    const fadeOut = f > dur - 50 ? Math.max(0, (dur - f) / 50) : 1;
    const alpha   = fadeIn * fadeOut;

    ctx.save();

    // Solid black base — covers game canvas fully before content fades in
    const bgAlpha = Math.min(1, f / 20);
    ctx.fillStyle = '#000';
    ctx.globalAlpha = bgAlpha;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;

    // ── Background ────────────────────────────────────────────────────────
    _drawBackground(ctx, W, H, s.style, f);

    // ── Stars ─────────────────────────────────────────────────────────────
    _stars.forEach(st => {
      const sa = st.a * (0.5 + 0.5 * Math.sin(st.t));
      ctx.globalAlpha = alpha * sa;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = alpha;

    // ── Particles ─────────────────────────────────────────────────────────
    _particles.forEach(p => {
      ctx.globalAlpha = alpha * p.a * 0.7;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = alpha;

    // ── Cinematic letterbox ───────────────────────────────────────────────
    const barH = Math.round(H * 0.10);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);

    // ── Panel number ──────────────────────────────────────────────────────
    const numAlpha = Math.min(1, f / 30);
    ctx.globalAlpha = alpha * numAlpha * 0.55;
    ctx.font        = `700 ${Math.round(W * 0.055)}px Orbitron, monospace`;
    ctx.fillStyle   = '#ffffff';
    ctx.textAlign   = 'left';
    ctx.fillText(s.num, 44, barH + 52);

    // ── Title ─────────────────────────────────────────────────────────────
    const titleAlpha = Math.min(1, Math.max(0, (f - 20) / 35));
    ctx.globalAlpha  = alpha * titleAlpha;
    const titleSz    = Math.round(W * 0.042);
    ctx.font         = `900 ${titleSz}px Orbitron, monospace`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'left';
    ctx.shadowColor  = _accentColor(s.style);
    ctx.shadowBlur   = 18;
    ctx.fillText(s.title, 44, barH + 50 + titleSz * 1.1);
    ctx.shadowBlur   = 0;

    // ── Sub-label (round range / BOSS) ────────────────────────────────────
    if (s.sub) {
      ctx.globalAlpha = alpha * titleAlpha * 0.6;
      ctx.font        = `400 ${Math.round(W * 0.014)}px Orbitron, monospace`;
      ctx.fillStyle   = _accentColor(s.style);
      ctx.letterSpacing = '4px';
      ctx.fillText(s.sub, 46, barH + 50 + titleSz * 2.2);
    }

    // ── Separator line ────────────────────────────────────────────────────
    ctx.globalAlpha = alpha * titleAlpha * 0.4;
    ctx.strokeStyle = _accentColor(s.style);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(44, barH + 50 + titleSz * 2.5 + (s.sub ? 14 : 0));
    ctx.lineTo(44 + W * 0.22, barH + 50 + titleSz * 2.5 + (s.sub ? 14 : 0));
    ctx.stroke();

    // ── Body text ─────────────────────────────────────────────────────────
    const bodyAlpha = Math.min(1, Math.max(0, (f - 55) / 40));
    ctx.globalAlpha = alpha * bodyAlpha;
    const bodySz    = Math.round(W * 0.018);
    ctx.font        = `300 ${bodySz}px Rajdhani, sans-serif`;
    ctx.fillStyle   = 'rgba(200,220,240,0.85)';
    ctx.textAlign   = 'left';
    s.body.split('\n').forEach((line, i) => {
      ctx.fillText(line, 44, H - barH - 48 - (s.body.split('\n').length - 1 - i) * (bodySz * 1.55));
    });

    // ── Style-specific visuals ────────────────────────────────────────────
    ctx.globalAlpha = alpha;
    _drawStyleVisual(ctx, W, H, s.style, f, barH, alpha);

    // ── Skip hint ─────────────────────────────────────────────────────────
    if (_skipReady && f > 80) {
      const hint = 0.25 + 0.2 * Math.sin(f * 0.08);
      ctx.globalAlpha = alpha * hint;
      ctx.font        = `400 ${Math.round(W * 0.011)}px Orbitron, monospace`;
      ctx.fillStyle   = '#ffffff';
      ctx.textAlign   = 'center';
      ctx.fillText('POKRAČOVAT  ›', W / 2, H - barH - 14);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _accentColor(style) {
    return style === 'boss'    ? '#ff3322' :
           style === 'distort' ? '#8866ff' :
           style === 'terminal'? '#00ffc8' :
           style === 'beyond'  ? '#ffcc66' :
           style === 'white'   ? '#aaccff' :
           '#4488ff';
  }

  function _drawBackground(ctx, W, H, style, f) {
    let g;
    if (style === 'terminal') {
      // Dark green-tinted terminal
      g = ctx.createRadialGradient(W*0.3, H*0.4, 0, W*0.5, H*0.5, W*0.85);
      g.addColorStop(0, '#060e0a');
      g.addColorStop(1, '#020508');
    } else if (style === 'boss') {
      // Red-dark
      g = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, W*0.8);
      g.addColorStop(0, '#120004');
      g.addColorStop(0.6, '#080002');
      g.addColorStop(1, '#020002');
    } else if (style === 'distort') {
      g = ctx.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.5, W*0.8);
      g.addColorStop(0, '#0a0818');
      g.addColorStop(0.7, '#040408');
      g.addColorStop(1, '#020204');
    } else if (style === 'beyond') {
      g = ctx.createRadialGradient(W*0.6, H*0.4, 0, W*0.5, H*0.5, W*0.9);
      g.addColorStop(0, '#18100a');
      g.addColorStop(0.5, '#0a0806');
      g.addColorStop(1, '#020202');
    } else if (style === 'white') {
      g = ctx.createRadialGradient(W*0.5, H*0.45, 0, W*0.5, H*0.5, W*0.9);
      g.addColorStop(0, '#080c18');
      g.addColorStop(1, '#020408');
    } else {
      // Default space
      g = ctx.createRadialGradient(W*0.5, H*0.38, 0, W*0.5, H*0.5, W*0.85);
      g.addColorStop(0, '#080c18');
      g.addColorStop(0.6, '#040608');
      g.addColorStop(1, '#010205');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Style-specific BG overlays
    if (style === 'terminal') {
      // Scanline overlay
      for (let y = 0; y < H; y += 4) {
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, W, 2);
      }
      ctx.globalAlpha = 1;
      // CRT glow
      const crt = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, W*0.6);
      crt.addColorStop(0, 'rgba(0,255,150,0.04)');
      crt.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = crt;
      ctx.fillRect(0, 0, W, H);
    }

    if (style === 'boss') {
      // Red vein cracks from edges
      const cr = ctx.createRadialGradient(W*0.5, H*0.5, H*0.15, W*0.5, H*0.5, H*0.8);
      cr.addColorStop(0, 'rgba(0,0,0,0)');
      cr.addColorStop(0.7, 'rgba(180,0,0,0.12)');
      cr.addColorStop(1, 'rgba(255,0,0,0.22)');
      ctx.fillStyle = cr; ctx.fillRect(0, 0, W, H);
    }

    if (style === 'beyond') {
      // Warm glow — new universe
      const bey = ctx.createRadialGradient(W*0.65, H*0.35, 0, W*0.65, H*0.35, W*0.5);
      bey.addColorStop(0, 'rgba(255,200,80,0.12)');
      bey.addColorStop(0.4, 'rgba(255,120,20,0.06)');
      bey.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bey; ctx.fillRect(0, 0, W, H);
    }

    if (style === 'distort') {
      // Purple anomaly glow
      const dist = ctx.createRadialGradient(W*0.5, H*0.45, 0, W*0.5, H*0.45, W*0.5);
      dist.addColorStop(0, 'rgba(100,60,255,0.10)');
      dist.addColorStop(0.5, 'rgba(60,20,180,0.05)');
      dist.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dist; ctx.fillRect(0, 0, W, H);
    }
  }

  function _drawStyleVisual(ctx, W, H, style, f, barH, alpha) {
    const cx = W * 0.5, cy = H * 0.42;

    if (style === 'terminal') {
      // Signal waveform in center
      const waveAlpha = Math.min(1, Math.max(0, (f - 40) / 50)) * alpha;
      ctx.globalAlpha = waveAlpha;
      ctx.strokeStyle = '#00ffc8';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#00ffc8';
      ctx.shadowBlur  = 8;

      // Panel frame
      const pw = Math.min(500, W * 0.5), ph = Math.min(180, H * 0.28);
      const px = cx - pw/2, py = cy - ph/2;
      ctx.strokeStyle = '#00ffc844';
      ctx.lineWidth   = 1;
      ctx.strokeRect(px, py, pw, ph);
      // Corner accents
      const ca = 16;
      ctx.strokeStyle = '#00ffc8';
      ctx.lineWidth = 2;
      [[px,py],[px+pw,py],[px,py+ph],[px+pw,py+ph]].forEach(([x,y], i) => {
        const sx = i % 2 === 0 ? 1 : -1, sy = i < 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x, y + sy*ca); ctx.lineTo(x, y); ctx.lineTo(x + sx*ca, y); ctx.stroke();
      });

      // Signal text
      ctx.fillStyle = '#00ffc8cc';
      ctx.font = `700 ${Math.round(W * 0.016)}px Orbitron, monospace`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 12;
      ctx.fillText('INCOMING SIGNAL', cx, py + ph * 0.3);
      // Waveform
      ctx.strokeStyle = '#00ffc8';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i < pw - 20; i++) {
        const wx = px + 10 + i;
        const amp = 20 + 8 * Math.sin(i * 0.08 + f * 0.1);
        const wy  = py + ph * 0.55 + Math.sin(i * 0.18 + f * 0.04) * amp * Math.sin(i * 0.04);
        i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      // "UNKNOWN ORIGIN"
      ctx.fillStyle = '#00ffc855';
      ctx.font = `400 ${Math.round(W * 0.012)}px Orbitron, monospace`;
      ctx.fillText('UNKNOWN ORIGIN', cx, py + ph * 0.8);
      ctx.shadowBlur = 0;
    }

    if (style === 'space' || style === 'distort' || style === 'white') {
      // Black hole silhouette in background
      const bhAlpha = (style === 'white' ? 0.65 : 0.45) * alpha * Math.min(1, (f - 30) / 60);
      ctx.globalAlpha = bhAlpha;
      const bhR = Math.min(W, H) * 0.22;

      // Accretion disk glow
      const diskG = ctx.createRadialGradient(cx, cy, bhR * 0.5, cx, cy, bhR * 2.2);
      diskG.addColorStop(0,   style === 'white' ? 'rgba(200,220,255,0.18)' : 'rgba(255,140,30,0.22)');
      diskG.addColorStop(0.5, style === 'white' ? 'rgba(100,140,255,0.08)' : 'rgba(180,60,0,0.10)');
      diskG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = diskG;
      ctx.fillRect(0, 0, W, H);

      // BH circle
      ctx.fillStyle = '#000000';
      ctx.shadowColor = style === 'white' ? '#4488ff' : '#ff8820';
      ctx.shadowBlur  = 40;
      ctx.beginPath(); ctx.arc(cx, cy, bhR, 0, Math.PI * 2); ctx.fill();

      // Event horizon ring
      ctx.strokeStyle = style === 'white' ? 'rgba(100,160,255,0.5)' : 'rgba(255,160,40,0.55)';
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 24;
      ctx.beginPath(); ctx.arc(cx, cy, bhR * 1.06, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    if (style === 'boss') {
      // Red eye / core
      const eyeAlpha = alpha * Math.min(1, (f - 20) / 50);
      const pulse    = 0.75 + 0.25 * Math.sin(f * 0.07);
      ctx.globalAlpha = eyeAlpha;

      // Outer tentacle glow blobs
      for (let i = 0; i < 8; i++) {
        const a   = (i / 8) * Math.PI * 2 + f * 0.006;
        const r   = W * 0.18 + Math.sin(f * 0.05 + i) * W * 0.04;
        const ex  = cx + Math.cos(a) * r;
        const ey  = cy + Math.sin(a) * r * 0.6;
        const bg2 = ctx.createRadialGradient(ex, ey, 0, ex, ey, W * 0.10);
        bg2.addColorStop(0, `rgba(180,0,0,${0.18 * pulse})`);
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg2; ctx.fillRect(0, 0, W, H);
      }

      // Core red eye
      const eyeR = Math.min(W, H) * 0.08 * pulse;
      const eyeG = ctx.createRadialGradient(cx, cy, 0, cx, cy, eyeR * 2.5);
      eyeG.addColorStop(0,   'rgba(255,255,200,0.95)');
      eyeG.addColorStop(0.2, 'rgba(255,80,0,0.85)');
      eyeG.addColorStop(0.6, 'rgba(200,0,0,0.5)');
      eyeG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle   = eyeG;
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur  = 60 * pulse;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR * 2.5, 0, Math.PI * 2); ctx.fill();

      // Pupil
      ctx.fillStyle = '#000';
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (style === 'beyond') {
      // Bright star/light — new universe
      const bAlpha = alpha * Math.min(1, (f - 30) / 70);
      const pulse  = 0.7 + 0.3 * Math.sin(f * 0.04);
      ctx.globalAlpha = bAlpha;
      const sx = W * 0.65, sy = H * 0.35;

      // Star rays
      ctx.strokeStyle = 'rgba(255,220,100,0.15)';
      ctx.lineWidth   = 1;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + f * 0.002;
        const r1 = W * 0.04, r2 = W * 0.35;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
        ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
        ctx.stroke();
      }

      // Star glow
      const stG = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.40);
      stG.addColorStop(0,   `rgba(255,240,180,${0.95 * pulse})`);
      stG.addColorStop(0.1, `rgba(255,200,80,${0.6 * pulse})`);
      stG.addColorStop(0.35,`rgba(200,120,20,${0.2 * pulse})`);
      stG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle   = stG;
      ctx.shadowColor = '#ffcc44';
      ctx.shadowBlur  = 50;
      ctx.beginPath(); ctx.arc(sx, sy, W * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  // ── INPUT — skip on click or key ──────────────────────────────────────────
  // Guard: only respond if no other overlay (upgrades) is open
  function _onInput() {
    if (_active && _skipReady && (typeof Upgrades === 'undefined' || !Upgrades.showing)) _complete();
  }

  document.addEventListener('keydown',     e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') _onInput(); });
  document.addEventListener('pointerdown', _onInput);

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  return {
    show, tick, draw,
    get active() { return _active; },
  };

})();
