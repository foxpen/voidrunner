// ─── VOID RUNNER — PARTICLES ────────────────────────────────────────────────

const Particles = (() => {
  let list     = [];
  let bgStars  = [];
  let nebulae  = [];
  let empWaves = [];
  let debrisList = [];
  let speedLines = [];
  let _W = 800, _H = 600;

  // Star colors — weighted toward white/blue
  const STAR_COLORS = ['#ffffff', '#ffffff', '#ccdeff', '#aabbff', '#ffeedd', '#ffcc99'];

  function initSpeedLines(W, H) {
    speedLines = [];
    for (let i = 0; i < 60; i++) {
      speedLines.push(_makeSpeedLine(W, H, true));
    }
  }

  function _makeSpeedLine(W, H, randomY) {
    const speed = 4 + Math.random() * 14;
    return {
      x:      Math.random() * W,
      y:      randomY ? Math.random() * H : -20,
      len:    speed * (2.5 + Math.random() * 3),   // proužek delší = rychlejší
      speed,
      alpha:  0.04 + Math.random() * 0.14,
      width:  0.4 + Math.random() * 0.8,
      hue:    Math.random() < 0.8 ? 0 : 190,       // mostly white, some cyan
    };
  }

  function initStars(W, H) {
    _W = W; _H = H;
    bgStars = [];
    nebulae = [];
    initSpeedLines(W, H);

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

  // Explosion fireball list
  let explosions = [];

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

  // Cinematic explosion — orange fireball + white flash + debris
  function spawnExplosion(x, y, radius) {
    const r = radius || 20;
    // Core flash
    explosions.push({ x, y, radius: r * 0.4, maxR: r * 3.5, life: 1, type: 'flash' });
    // Fireball expand
    explosions.push({ x, y, radius: r * 0.2, maxR: r * 2.8, life: 1, type: 'fire' });
    // Shockwave ring
    explosions.push({ x, y, radius: r * 0.1, maxR: r * 4.0, life: 1, type: 'ring' });

    // Ember particles
    const emberCount = 8 + Math.floor(r * 0.6);
    for (let i = 0; i < emberCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (1 + Math.random() * 5) * (r / 20);
      const warm = Math.random() < 0.6;
      list.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
        life: 1,
        decay: 0.008 + Math.random() * 0.018,
        size: 1.5 + Math.random() * 3.5,
        color: warm ? (Math.random() < 0.5 ? '#ff9933' : '#ffcc44') : '#ffffff',
      });
    }

    // Rock debris chunks
    spawnDebris(x, y, '#7a6040', 4 + Math.floor(r / 8));
  }

  function spawnEmpWave(x, y, W, H) {
    empWaves.push({ x, y, radius: 0, maxRadius: Math.max(W, H), life: 1 });
  }

  // Floating damage numbers — rise + fade; crit gets bigger/yellow
  let damageNumbers = [];
  function spawnDamageNumber(x, y, value, isCrit) {
    damageNumbers.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y - 4,
      vx: (Math.random() - 0.5) * 1.0,
      vy: -1.4 - Math.random() * 0.6,
      life: 1,
      decay: isCrit ? 0.014 : 0.022,
      value: Math.max(1, Math.round(value)),
      isCrit: !!isCrit,
    });
    if (damageNumbers.length > 80) damageNumbers.splice(0, damageNumbers.length - 80);
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

    // Speed lines — pohybují se s obtížností
    if (isPlaying) {
      speedLines.forEach(s => {
        s.y += s.speed * difficulty * slowMult;
        if (s.y - s.len > H) {
          const nl = _makeSpeedLine(W, H, false);
          s.x = nl.x; s.y = nl.y; s.len = nl.len;
          s.speed = nl.speed; s.alpha = nl.alpha; s.hue = nl.hue;
        }
      });
    }

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

    explosions.forEach(e => {
      e.radius += (e.maxR - e.radius) * (e.type === 'flash' ? 0.22 : e.type === 'fire' ? 0.14 : 0.10);
      e.life   -= e.type === 'flash' ? 0.07 : e.type === 'fire' ? 0.04 : 0.05;
    });
    explosions = explosions.filter(e => e.life > 0);

    // Floating damage numbers
    damageNumbers.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      d.vy *= 0.94;
      d.life -= d.decay;
    });
    damageNumbers = damageNumbers.filter(d => d.life > 0);
  }

  function drawDamageNumbers(ctx) {
    damageNumbers.forEach(d => {
      const baseSize = d.isCrit ? 18 : 12;
      const pop      = d.isCrit ? 1 + (1 - d.life) * 0.3 : 1;
      const size     = baseSize * pop;
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life * 1.2);
      ctx.font        = `900 ${size.toFixed(0)}px Orbitron, monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.shadowColor = d.isCrit ? '#ffaa00' : '#000000';
      ctx.shadowBlur  = d.isCrit ? 14 : 6;
      ctx.lineWidth   = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(d.value, d.x, d.y);
      ctx.fillStyle   = d.isCrit ? '#ffd84a' : '#ffffff';
      ctx.fillText(d.value, d.x, d.y);
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
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

  function drawSpeedLines(ctx, difficulty) {
    const spd = Math.min(1, (difficulty || 1) / 3.5);
    if (spd < 0.05) return;
    speedLines.forEach(s => {
      const alpha = s.alpha * spd;
      if (alpha < 0.008) return;
      // Gradient line — bright tip, fades upward
      const grad = ctx.createLinearGradient(s.x, s.y - s.len, s.x, s.y);
      if (s.hue === 190) {
        // Cyan streak
        grad.addColorStop(0, 'rgba(0,200,255,0)');
        grad.addColorStop(1, `rgba(0,220,255,${alpha})`);
      } else {
        // White streak
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, `rgba(220,240,255,${alpha})`);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth   = s.width;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.len);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    });
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

  function drawExplosions(ctx) {
    explosions.forEach(e => {
      if (e.type === 'flash') {
        // White-hot core flash
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
        g.addColorStop(0,   `rgba(255,255,220,${e.life * 0.9})`);
        g.addColorStop(0.3, `rgba(255,200,80,${e.life * 0.5})`);
        g.addColorStop(1,   'rgba(255,100,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'fire') {
        // Orange fireball
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
        g.addColorStop(0,   `rgba(255,160,20,${e.life * 0.75})`);
        g.addColorStop(0.4, `rgba(220,60,0,${e.life * 0.45})`);
        g.addColorStop(0.75,`rgba(80,20,0,${e.life * 0.2})`);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
      } else {
        // Shockwave ring
        ctx.strokeStyle = `rgba(255,140,40,${e.life * 0.5})`;
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#ff8820';
        ctx.shadowBlur  = 12;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });
  }

  function clear() { list = []; empWaves = []; debrisList = []; explosions = []; damageNumbers = []; }

  return { initStars, initSpeedLines, spawn, spawnEmpWave, spawnDebris, spawnExplosion, spawnDamageNumber, update, drawStars, drawSpeedLines, drawEmpWaves, drawParticles, drawDebris, drawExplosions, drawDamageNumbers, clear };
})();
