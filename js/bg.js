// ─── VOID RUNNER — DYNAMIC BACKGROUND ───────────────────────────────────────
// Černá díra se přibližuje s každým kolem. Kolo 10 = uvnitř BH.

const BG = (() => {
  // Debris/asteroid flying past during flight (onboarding-style)
  let debris = [];
  let debrisTimer = 0;

  // ── Parallax asteroid swarm — always-on flight sensation ──
  const SWARM_LAYERS = [
    { count: 60,  speed: 0.6,  sizeMin: 1,  sizeMax: 2.5, alpha: 0.18, shape: 'dot'  },   // far dust
    { count: 35,  speed: 1.6,  sizeMin: 2,  sizeMax: 5,   alpha: 0.30, shape: 'rock' },   // mid rocks
    { count: 18,  speed: 3.2,  sizeMin: 4,  sizeMax: 9,   alpha: 0.45, shape: 'rock' },   // close rocks
  ];
  let swarm = [];
  let swarmEnabled = true;

  // BH background state
  let bhBgScale  = 0;   // current rendered scale
  let bhBgTarget = 0;   // target scale for this round
  let dustAngle  = 0;

  // Per-round BH scales — BH roste s každým kolem
  const ROUND_SCALES = [
    0.28,  // round 1  — jasně viditelná v dáli
    0.42,  // 2
    0.58,  // 3
    0.76,  // 4
    0.95,  // 5
    1.15,  // 6
    1.40,  // 7
    1.70,  // 8
    2.10,  // 9  — obrovská, skoro uvnitř
    1.80,  // 10 BOSS — obrovská ale arena ještě viditelná
  ];

  function _initSwarm(W, H) {
    swarm = [];
    SWARM_LAYERS.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        swarm.push(_makeSwarmParticle(layer, li, W, H, true));
      }
    });
  }

  function _makeSwarmParticle(layer, layerIdx, W, H, randomY) {
    const size = layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin);
    const nv   = layer.shape === 'rock' ? 5 + Math.floor(Math.random() * 4) : 0;
    const verts = [];
    if (nv > 0) {
      for (let i = 0; i < nv; i++) {
        const a = (i / nv) * Math.PI * 2;
        const r = size * (0.55 + Math.random() * 0.45);
        verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
    }
    const hue = 180 + Math.random() * 60;
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : -size - Math.random() * 40,
      vy: layer.speed * (0.8 + Math.random() * 0.4),
      vx: (Math.random() - 0.5) * layer.speed * 0.15,
      size, verts, layerIdx,
      rot:      Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03 * (layerIdx + 1),
      alpha:    layer.alpha * (0.6 + Math.random() * 0.4),
      hue,
    };
  }

  function _updateSwarm(W, H, slowMult) {
    if (swarm.length === 0) _initSwarm(W, H);
    swarm.forEach(p => {
      const spd = slowMult !== undefined ? slowMult : 1;
      p.y += p.vy * spd;
      p.x += p.vx * spd;
      p.rot += p.rotSpeed * spd;
    });
    // Recycle off-screen particles back to top
    for (let i = 0; i < swarm.length; i++) {
      const p = swarm[i];
      if (p.y > H + p.size + 10) {
        const layer = SWARM_LAYERS[p.layerIdx];
        const fresh = _makeSwarmParticle(layer, p.layerIdx, W, H, false);
        fresh.x = Math.random() * W;
        swarm[i] = fresh;
      }
    }
  }

  function _drawSwarm(ctx) {
    swarm.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.verts.length === 0) {
        // Dot
        ctx.fillStyle = `hsl(${p.hue}, 50%, 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Rock shape
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.strokeStyle = `hsl(${p.hue}, 55%, 55%)`;
        ctx.lineWidth   = 0.8;
        ctx.fillStyle   = `hsla(${p.hue}, 40%, 18%, 0.5)`;
        ctx.beginPath();
        ctx.moveTo(p.verts[0].x, p.verts[0].y);
        for (let i = 1; i < p.verts.length; i++) ctx.lineTo(p.verts[i].x, p.verts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  }

  function setRound(round) {
    const target = ROUND_SCALES[Math.min(round - 1, ROUND_SCALES.length - 1)] || 0.28;
    // Na začátku kola skočí na novou hodnotu okamžitě (bez lerpu)
    if (Math.abs(bhBgTarget - target) > 0.05) bhBgScale = target * 0.88;
    bhBgTarget = target;
  }

  function update(_fc, W, H, slowMult) {
    // Lerp
    bhBgScale += (bhBgTarget - bhBgScale) * 0.012;
    dustAngle += 0.0003;

    // Parallax swarm
    if (swarmEnabled) _updateSwarm(W, H, slowMult !== undefined ? slowMult : 1);

    // Debris flying past
    debrisTimer--;
    if (debrisTimer <= 0 && bhBgScale < 0.5) {
      debrisTimer = 40 + Math.floor(Math.random() * 60);
      _spawnDebris(W, H);
    }

    debris.forEach(d => {
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.rotSpeed;
      d.alpha -= 0.004;
    });
    debris = debris.filter(d => d.alpha > 0 && d.x > -200 && d.x < W + 200 && d.y < H + 200);
  }

  function _spawnDebris(W, H) {
    // Spawn at edges, fly past screen
    const side = Math.random();
    let x, y, vx, vy;
    const speed = 2 + Math.random() * 4;

    if (side < 0.4) {
      // From top
      x = Math.random() * W; y = -60;
      vx = (Math.random() - 0.5) * 1.5; vy = speed;
    } else if (side < 0.7) {
      // From left
      x = -60; y = Math.random() * H * 0.8;
      vx = speed; vy = (Math.random() - 0.3) * speed * 0.5;
    } else {
      // From right
      x = W + 60; y = Math.random() * H * 0.8;
      vx = -speed; vy = (Math.random() - 0.3) * speed * 0.5;
    }

    const size = 15 + Math.random() * 45;
    const nv   = 5 + Math.floor(Math.random() * 5);
    const verts = [];
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * Math.PI * 2;
      const r = size * (0.5 + Math.random() * 0.5);
      verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    debris.push({
      x, y, vx, vy,
      size, verts,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      alpha: 0.12 + Math.random() * 0.15,
      hue: 200 + Math.random() * 40,
    });
  }

  function draw(ctx, W, H, frameCount, isBossRound) {
    const s = bhBgScale;
    if (s < 0.005) { _drawSwarm(ctx); _drawDebris(ctx); return; }

    const cx = W * 0.5, cy = H * 0.35; // BH in upper half

    // ── Outer nebula / glow ──
    const glowR = Math.min(W, H) * 1.6 * s;
    for (let i = 3; i >= 0; i--) {
      const r     = glowR * (0.5 + i * 0.2);
      const alpha = (0.10 - i * 0.015) * Math.min(1, s * 2);
      const grad  = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grad.addColorStop(0,   `rgba(255,120,0,${alpha})`);
      grad.addColorStop(0.5, `rgba(180,50,0,${alpha * 0.5})`);
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    // ── Accretion disk (ellipse, background version) ──
    if (s > 0.05) {
      const diskR   = 300 * s;
      const flatten = 0.25 + (1 - s) * 0.1;
      ctx.save();
      ctx.translate(cx, cy);

      // Outer glow ring
      for (let pass = 0; pass < 3; pass++) {
        const r     = diskR * (1 + pass * 0.3);
        const alpha = (0.14 - pass * 0.03) * Math.min(1, s * 1.5);
        const grad  = ctx.createRadialGradient(0, 0, diskR * 0.5, 0, 0, r);
        grad.addColorStop(0,   `rgba(255,160,40,${alpha})`);
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.save();
        ctx.scale(1, flatten);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Rotating dust streaks
      for (let i = 0; i < 80; i++) {
        const a     = dustAngle + (i / 80) * Math.PI * 2;
        const r     = diskR * (0.7 + Math.sin(a * 3 + frameCount * 0.001) * 0.3);
        const px    = Math.cos(a) * r;
        const py    = Math.sin(a) * r * flatten;
        const alpha = 0.10 * Math.min(1, s * 2.5) * (0.5 + 0.5 * Math.sin(a * 7));
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `hsl(${25 + Math.sin(a) * 15}, 90%, 60%)`;
        ctx.beginPath(); ctx.arc(px, py, 2 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Event horizon (black circle) ──
    if (s > 0.03) {
      const bhR  = 110 * s;
      const bhGr = ctx.createRadialGradient(cx, cy, 0, cx, cy, bhR * 1.3);
      bhGr.addColorStop(0,   '#000000');
      bhGr.addColorStop(0.6, '#000005');
      bhGr.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = bhGr;
      ctx.beginPath(); ctx.arc(cx, cy, bhR * 1.3, 0, Math.PI * 2); ctx.fill();

      // Photon ring
      if (s > 0.03) {
        const ringAlpha = Math.min(0.85, s * 1.2);
        ctx.strokeStyle = `rgba(255,200,80,${ringAlpha})`;
        ctx.lineWidth   = 2.5 * Math.min(1, s * 1.5);
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur  = 20 * s;
        ctx.beginPath(); ctx.arc(cx, cy, bhR, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur  = 0;
      }
    }

    // ── Boss round: inside the wormhole — completely different arena ──
    if (isBossRound) {
      // Překryj vesmír fialovo-červeným interiérem červí díry
      const arenaGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H));
      arenaGrad.addColorStop(0,   'rgba(20,0,30,0.92)');
      arenaGrad.addColorStop(0.4, 'rgba(60,0,40,0.88)');
      arenaGrad.addColorStop(0.8, 'rgba(100,10,0,0.85)');
      arenaGrad.addColorStop(1,   'rgba(0,0,0,0.95)');
      ctx.fillStyle = arenaGrad;
      ctx.fillRect(0, 0, W, H);

      // Energie vortex — točící se energetické pruhy
      ctx.save();
      ctx.translate(W / 2, H * 0.35);
      for (let i = 0; i < 18; i++) {
        const a  = frameCount * 0.018 + (i / 18) * Math.PI * 2;
        const r1 = 80 + Math.sin(a * 3 + frameCount * 0.005) * 30;
        const r2 = 220 + Math.cos(a * 2) * 50;
        const alpha = 0.06 + 0.04 * Math.sin(a * 5);
        ctx.strokeStyle = `hsla(${280 + i * 8},90%,60%,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.quadraticCurveTo(
          Math.cos(a + 0.5) * (r1 + r2) * 0.5,
          Math.sin(a + 0.5) * (r1 + r2) * 0.5,
          Math.cos(a + 1.0) * r2, Math.sin(a + 1.0) * r2
        );
        ctx.stroke();
      }

      // Spaghettification — horizontální distorzní vlny
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#cc44ff';
      ctx.lineWidth   = 1;
      for (let i = 0; i < 16; i++) {
        const y    = (i / 16) * H - H * 0.35;
        const wave = Math.sin(frameCount * 0.025 + i * 0.6) * 14;
        ctx.beginPath();
        ctx.moveTo(-W/2, y + wave);
        ctx.bezierCurveTo(-W * 0.1, y + wave * 2.5, W * 0.1, y - wave * 2.5, W/2, y + wave);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Okraje — rudá záře singularity
      const edgeGrad = ctx.createRadialGradient(W/2, H/2, H * 0.25, W/2, H/2, H);
      edgeGrad.addColorStop(0,   'rgba(0,0,0,0)');
      edgeGrad.addColorStop(0.7, 'rgba(180,0,80,0.10)');
      edgeGrad.addColorStop(1,   'rgba(255,0,60,0.25)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, 0, W, H);
    }

    if (swarmEnabled) _drawSwarm(ctx);
    _drawDebris(ctx);
  }

  function _drawDebris(ctx) {
    debris.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = d.alpha;
      ctx.strokeStyle = `hsl(${d.hue}, 60%, 50%)`;
      ctx.lineWidth   = 1;
      ctx.shadowColor = `hsl(${d.hue}, 80%, 60%)`;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.moveTo(d.verts[0].x, d.verts[0].y);
      d.verts.forEach(v => ctx.lineTo(v.x, v.y));
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `hsla(${d.hue}, 40%, 20%, 0.3)`;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function clear() { debris = []; swarm = []; bhBgScale = ROUND_SCALES[0]; bhBgTarget = ROUND_SCALES[0]; }

  function showSwarm(v) { swarmEnabled = v; }

  return { setRound, update, draw, clear, showSwarm, get scale() { return bhBgScale; } };
})();
