// ─── VOID RUNNER — PARTICLES ────────────────────────────────────────────────

const Particles = (() => {
  let list     = [];
  let bgStars  = [];
  let nebulae  = [];
  let empWaves = [];
  let debrisList = [];
  let _W = 800, _H = 600;

  // Star colors — weighted toward white/blue
  const STAR_COLORS = ['#ffffff', '#ffffff', '#ccdeff', '#aabbff', '#ffeedd', '#ffcc99'];

  function initStars(W, H) {
    _W = W; _H = H;
    bgStars = [];
    nebulae = [];

    // 3 parallax layers: far / mid / near
    const layers = [
      { count: 110, sMin: 0.25, sMax: 0.7,  spMin: 0.12, spMax: 0.35 },
      { count: 70,  sMin: 0.7,  sMax: 1.5,  spMin: 0.38, spMax: 0.75 },
      { count: 35,  sMin: 1.4,  sMax: 2.8,  spMin: 0.8,  spMax: 1.6  },
    ];

    layers.forEach((cfg, layer) => {
      for (let i = 0; i < cfg.count; i++) {
        bgStars.push({
          x:     Math.random() * W,
          y:     Math.random() * H,
          size:  cfg.sMin + Math.random() * (cfg.sMax - cfg.sMin),
          speed: cfg.spMin + Math.random() * (cfg.spMax - cfg.spMin),
          brightness: 0.4 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          twinkleSpd: 0.012 + Math.random() * 0.035,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
          layer,
        });
      }
    });

    // 4 nebula patches — soft colored gas clouds
    const nebulaHues = [210, 270, 300, 180];
    for (let i = 0; i < 4; i++) {
      nebulae.push({
        x:     Math.random() * W,
        y:     Math.random() * H,
        r:     120 + Math.random() * 180,
        hue:   nebulaHues[i] + Math.random() * 30,
        alpha: 0.028 + Math.random() * 0.032,
        speed: 0.08 + Math.random() * 0.12,
      });
    }
  }

  function spawn(x, y, color, count = 40) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 6 + 1;
      list.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1,
        decay: 0.01 + Math.random() * 0.025,
        size: Math.random() * 4 + 1,
        color,
      });
    }
  }

  function spawnEmpWave(x, y, W, H) {
    empWaves.push({ x, y, radius: 0, maxRadius: Math.max(W, H), life: 1 });
  }

  function update(state, frameCount, W, H, difficulty, slowActive) {
    _W = W; _H = H;
    const slowMult = slowActive ? 0.3 : 1;
    const isPlaying = state === 'PLAYING';

    bgStars.forEach(s => {
      s.y += s.speed * (isPlaying ? difficulty * slowMult : 0.4);
      if (s.y > H + 10) { s.y = -5; s.x = Math.random() * W; }
    });

    nebulae.forEach(n => {
      n.y += n.speed * (isPlaying ? difficulty * slowMult : 0.2);
      if (n.y - n.r > H + 20) { n.y = -n.r; n.x = Math.random() * W; }
    });

    list.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.03;
      p.life -= p.decay;
    });
    list = list.filter(p => p.life > 0);

    debrisList.forEach(d => { d.x += d.vx; d.y += d.vy; d.vy += 0.04; d.rot += d.rotSpeed; d.vx *= 0.97; d.life -= d.decay; });
    debrisList = debrisList.filter(d => d.life > 0);

    empWaves.forEach(w => { w.radius += 18; w.life -= 0.025; });
    empWaves = empWaves.filter(w => w.life > 0);
  }

  function drawStars(ctx, frameCount) {
    const W = _W, H = _H;

    // ── Nebulae ──
    nebulae.forEach(n => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0,   `hsla(${n.hue},65%,50%,${n.alpha * 2})`);
      grad.addColorStop(0.4, `hsla(${n.hue},60%,40%,${n.alpha})`);
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    });

    // ── Stars with gravitational lensing ──
    const bhScale = (typeof BG !== 'undefined') ? BG.scale : 0;
    const bhCX = W * 0.5;
    const bhCY = H * 0.35;
    const lensRadius = bhScale * 220; // lensing influence radius

    bgStars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(frameCount * s.twinkleSpd + s.phase);
      const alpha   = Math.min(1, s.brightness * (0.35 + 0.65 * twinkle));

      // Gravitational lensing — pull star toward BH visually
      let sx = s.x, sy = s.y;
      if (bhScale > 0.08 && lensRadius > 5) {
        const dx   = bhCX - sx;
        const dy   = bhCY - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < lensRadius && dist > 5) {
          const pull = Math.pow(1 - dist / lensRadius, 2) * bhScale * 0.55;
          sx += dx * pull;
          sy += dy * pull;
        }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = s.color;

      if (s.layer === 2 && s.size > 1.8) {
        // Near bright stars: diamond sparkle
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 5;
        const h = s.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx,          sy - s.size * 1.4);
        ctx.lineTo(sx + h,      sy);
        ctx.lineTo(sx,          sy + s.size * 1.4);
        ctx.lineTo(sx - h,      sy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
  }

  function drawEmpWaves(ctx) {
    empWaves.forEach(w => {
      ctx.strokeStyle = `rgba(255, 68, 255, ${w.life * 0.5})`;
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#ff44ff';
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles(ctx) {
    list.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  function spawnDebris(x, y, color, count) {
    count = count || 5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 4;
      const sz = 4 + Math.random() * 9;
      const nv = 3 + Math.floor(Math.random() * 3);
      const verts = [];
      for (let j = 0; j < nv; j++) {
        const va = (j / nv) * Math.PI * 2 + Math.random() * 0.5;
        verts.push({ x: Math.cos(va) * sz * (0.45 + Math.random() * 0.55), y: Math.sin(va) * sz * (0.45 + Math.random() * 0.55) });
      }
      debrisList.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.18,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        verts, color,
      });
    }
  }

  function drawDebris(ctx) {
    debrisList.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = d.life * 0.9;
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(d.verts[0].x, d.verts[0].y);
      for (let i = 1; i < d.verts.length; i++) ctx.lineTo(d.verts[i].x, d.verts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function clear() { list = []; empWaves = []; debrisList = []; }

  return { initStars, spawn, spawnEmpWave, spawnDebris, update, drawStars, drawEmpWaves, drawParticles, drawDebris, clear };
})();
