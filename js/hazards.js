// ─── VOID RUNNER — HAZARDS (nedají se zničit, jen obletět) ──────────────────
// Typy: planet, pillar_pair, asteroid_field

const Hazards = (() => {
  let list = [];
  let spawnTimer = 0;

  const PLANET_CONFIGS = [
    { color: '#4466ff', atmo: '#2233aa', rings: false, name: 'modrá' },
    { color: '#ff6633', atmo: '#cc3311', rings: false, name: 'červená' },
    { color: '#44cc88', atmo: '#226644', rings: false, name: 'zelená' },
    { color: '#ffcc44', atmo: '#cc8811', rings: true,  name: 'prstence' },
    { color: '#cc44ff', atmo: '#8811cc', rings: false, name: 'fialová' },
    { color: '#aaccff', atmo: '#668899', rings: true,  name: 'ledová' },
    { color: '#ff4488', atmo: '#cc1155', rings: false, name: 'růžová' },
  ];

  function clear() { list = []; spawnTimer = 0; }

  function spawnForRound(round, W, H) {
    // Spawn rate increases with round
    spawnTimer--;
    if (spawnTimer > 0) return;

    const baseRate = Math.max(200, 500 - round * 30);
    spawnTimer = baseRate + Math.floor(Math.random() * baseRate * 0.5);

    const roll = Math.random();

    if (round >= 1 && roll < 0.35) {
      _spawnPlanet(W, H, round);
    } else if (round >= 3 && roll < 0.65) {
      _spawnPillarPair(W, H, round);
    } else if (round >= 2) {
      _spawnAsteroidCluster(W, H, round);
    } else {
      _spawnPlanet(W, H, round);
    }
  }

  function _spawnPlanet(W, H, round) {
    const cfg  = PLANET_CONFIGS[Math.floor(Math.random() * PLANET_CONFIGS.length)];
    const size = 40 + Math.random() * (60 + round * 8);
    const x    = Math.random() * (W - size * 2) + size;
    const spd  = 0.6 + Math.random() * 0.8;

    // Procedurální krátery
    const craterCount = 3 + Math.floor(Math.random() * 5);
    const craters = [];
    for (let i = 0; i < craterCount; i++) {
      const a  = Math.random() * Math.PI * 2;
      const r  = Math.random() * size * 0.7;
      craters.push({
        x: Math.cos(a) * r, y: Math.sin(a) * r,
        r: size * (0.06 + Math.random() * 0.12),
      });
    }

    list.push({
      type: 'planet',
      x, y: -size - 20,
      vy: spd, vx: (Math.random() - 0.5) * 0.4,
      size,
      color: cfg.color,
      atmo:  cfg.atmo,
      rings: cfg.rings,
      ringAngle: Math.random() * Math.PI,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.003,
      surfaceOffset: Math.random() * 100,
      craters,
      depth: 0.5 + Math.random() * 0.5,
    });
  }

  function _spawnPillarPair(W, H, round) {
    // Two pillars from top with a gap — you fly through
    const minGap  = 160 - round * 6; // gap shrinks with round
    const gap     = Math.max(110, minGap + Math.random() * 60);
    const gapX    = 120 + Math.random() * (W - 240);
    const spd     = 1.0 + Math.random() * 0.8 + round * 0.05;
    const len     = 180 + Math.random() * 120;
    const hue     = 180 + Math.random() * 60;

    const pillarDepth = 0.6 + Math.random() * 0.4;
    // Left pillar
    list.push({
      type: 'pillar',
      x: gapX - gap / 2, y: -len,
      vy: spd, vx: 0,
      w: 28, h: len,
      hue, paired: true,
      capSize: 18,
      depth: pillarDepth,
    });
    // Right pillar
    list.push({
      type: 'pillar',
      x: gapX + gap / 2, y: -len,
      vy: spd, vx: 0,
      w: 28, h: len,
      hue, paired: true,
      capSize: 18,
      isRight: true,
      depth: pillarDepth,
    });
  }

  function _spawnAsteroidCluster(W, H, round) {
    // Group of large non-destructible asteroids in a pattern
    const cx    = 80 + Math.random() * (W - 160);
    const spd   = 0.8 + Math.random() * 0.6;
    const count = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const size = 30 + Math.random() * 40;
      const ox   = (i - (count - 1) / 2) * (size * 1.8 + 10);
      const nv   = 6 + Math.floor(Math.random() * 4);
      const verts = [];
      for (let j = 0; j < nv; j++) {
        const a = (j / nv) * Math.PI * 2;
        const r = size * (0.65 + Math.random() * 0.35);
        verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      list.push({
        type: 'asteroid',
        x: cx + ox, y: -size - 20,
        vy: spd, vx: (Math.random() - 0.5) * 0.3,
        size, verts,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.008,
        hue: 200 + Math.random() * 40,
        depth: 0.55 + Math.random() * 0.45,
      });
    }
  }

  function update(W, H, slowActive) {
    const slowMult = slowActive ? 0.35 : 1;
    list.forEach(h => {
      h.x += (h.vx || 0) * slowMult * (h.depth || 1);
      h.y += h.vy * slowMult * (h.depth || 1);
      if (h.rot !== undefined) h.rot += (h.rotSpeed || 0) * slowMult;
      if (h.ringAngle !== undefined) h.ringAngle += 0.002 * slowMult;
    });
    list = list.filter(h => h.y < H + 300);
  }

  function checkPlayerCollision(activePU) {
    if (Player.invincible > 0) return false;
    for (const h of list) {
      if (_playerHits(h)) return true;
    }
    return false;
  }

  function _playerHits(h) {
    const px = Player.x, py = Player.y, pw = Player.w;
    if (h.type === 'planet') {
      return false; // planety jsou jen dekorace — bez damage
    }
    if (h.type === 'asteroid') {
      return Utils.dist(px, py, h.x, h.y) < h.size * 0.7 + pw * 0.4;
    }
    if (h.type === 'pillar') {
      // AABB — pillar body
      const hw = h.w / 2 + pw * 0.3;
      const hh = h.h + h.capSize;
      return Math.abs(px - h.x) < hw && py > h.y - hh * 0.2 && py < h.y + hh;
    }
    return false;
  }

  function draw(ctx, frameCount) {
    // Draw all hazards
    list.forEach(h => {
      if (h.type === 'planet')   _drawPlanet(ctx, h, frameCount);
      if (h.type === 'pillar')   _drawPillar(ctx, h, frameCount);
      if (h.type === 'asteroid') _drawBigAsteroid(ctx, h, frameCount);
    });
  }

  function _drawPlanet(ctx, p, frameCount) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.5 + (p.depth || 1) * 0.5;

    // Atmosphere glow
    const atmoGrad = ctx.createRadialGradient(0, 0, p.size * 0.7, 0, 0, p.size * 1.4);
    atmoGrad.addColorStop(0, p.atmo + '44');
    atmoGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atmoGrad;
    ctx.beginPath(); ctx.arc(0, 0, p.size * 1.4, 0, Math.PI * 2); ctx.fill();

    // Planet body
    const bodyGrad = ctx.createRadialGradient(-p.size * 0.3, -p.size * 0.3, 0, 0, 0, p.size);
    bodyGrad.addColorStop(0, _lighten(p.color, 40));
    bodyGrad.addColorStop(0.5, p.color);
    bodyGrad.addColorStop(1, _darken(p.color, 40));
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 20;
    ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur  = 0;

    // Surface details (clipped to planet)
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.clip();

    // Cloud bands
    ctx.rotate(p.rot);
    for (let i = 0; i < 4; i++) {
      const by = -p.size + (i + 1) * (p.size * 2 / 5) + Math.sin(frameCount * 0.002 + p.surfaceOffset + i) * 5;
      ctx.globalAlpha = 0.10 + (i % 2) * 0.06;
      ctx.fillStyle   = i % 2 === 0 ? '#ffffff' : _darken(p.color, 25);
      ctx.fillRect(-p.size, by - 6, p.size * 2, 12);
    }
    ctx.rotate(-p.rot);

    // Krátery
    ctx.globalAlpha = 1;
    if (p.craters) {
      p.craters.forEach(c => {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle   = _darken(p.color, 55);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 0.8;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.7, 0, Math.PI * 2); ctx.stroke();
      });
    }

    // Terminator (shadow on dark side)
    const shadowGrad = ctx.createRadialGradient(p.size * 0.4, -p.size * 0.3, 0, p.size * 0.4, -p.size * 0.3, p.size * 1.2);
    shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
    shadowGrad.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.globalAlpha = 1;
    ctx.fillStyle   = shadowGrad;
    ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);

    ctx.restore();

    // Rings (Saturn-style)
    if (p.rings) {
      ctx.save();
      ctx.rotate(p.ringAngle);
      for (let r = 0; r < 3; r++) {
        const ringR = p.size * (1.4 + r * 0.25);
        ctx.strokeStyle = p.color + (r === 1 ? '88' : '44');
        ctx.lineWidth   = r === 1 ? 5 : 2.5;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 8;
        ctx.save();
        ctx.scale(1, 0.3);
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Danger indicator — subtle red pulse
    const dangerAlpha = 0.1 + 0.05 * Math.sin(frameCount * 0.08);
    ctx.strokeStyle = `rgba(255,50,50,${dangerAlpha})`;
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(0, 0, p.size * 0.9, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function _drawPillar(ctx, h, frameCount) {
    // Only draw left pillar fully; right pillar is its mirror
    const pulse = 0.6 + 0.4 * Math.sin(frameCount * 0.04);
    ctx.save();
    ctx.translate(h.x, h.y + h.h);
    ctx.globalAlpha = 0.55 + (h.depth || 1) * 0.45;

    // Pillar body
    const grad = ctx.createLinearGradient(-h.w / 2, 0, h.w / 2, 0);
    grad.addColorStop(0,   `hsla(${h.hue},80%,25%,0.9)`);
    grad.addColorStop(0.3, `hsla(${h.hue},80%,55%,0.95)`);
    grad.addColorStop(0.7, `hsla(${h.hue},80%,55%,0.95)`);
    grad.addColorStop(1,   `hsla(${h.hue},80%,25%,0.9)`);
    ctx.fillStyle = grad;
    ctx.shadowColor = `hsl(${h.hue},100%,60%)`;
    ctx.shadowBlur  = 15;
    ctx.fillRect(-h.w / 2, -h.h, h.w, h.h);

    // Edge glow lines
    ctx.strokeStyle = `hsla(${h.hue},100%,70%,${0.6 * pulse})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(-h.w / 2, -h.h); ctx.lineTo(-h.w / 2, 0);
    ctx.moveTo( h.w / 2, -h.h); ctx.lineTo( h.w / 2, 0);
    ctx.stroke();

    // Cap (bottom tip)
    ctx.fillStyle = `hsl(${h.hue},100%,70%)`;
    ctx.shadowBlur  = 25 * pulse;
    ctx.beginPath();
    ctx.moveTo(-h.capSize, 0);
    ctx.lineTo(0, h.capSize * 1.2);
    ctx.lineTo(h.capSize, 0);
    ctx.closePath(); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _drawBigAsteroid(ctx, a, frameCount) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.globalAlpha = 0.5 + (a.depth || 1) * 0.5;

    // Glow
    ctx.shadowColor = `hsl(${a.hue},60%,50%)`;
    ctx.shadowBlur  = 12;

    // Body
    ctx.fillStyle   = `hsl(${a.hue},30%,18%)`;
    ctx.strokeStyle = `hsl(${a.hue},60%,45%)`;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.verts[0].x, a.verts[0].y);
    a.verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Inner texture lines
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1;
    for (let i = 0; i < 3; i++) {
      const v1 = a.verts[i % a.verts.length];
      const v2 = a.verts[(i + 2) % a.verts.length];
      ctx.beginPath(); ctx.moveTo(v1.x * 0.5, v1.y * 0.5); ctx.lineTo(v2.x * 0.5, v2.y * 0.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Indestructible badge — small lock icon area
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,80,80,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // Color helpers
  function _lighten(hex, amt) {
    return _shiftColor(hex, amt);
  }
  function _darken(hex, amt) {
    return _shiftColor(hex, -amt);
  }
  function _shiftColor(hex, amt) {
    let [r, g, b] = [1, 3, 5].map(i => Math.min(255, Math.max(0, parseInt(hex.slice(i, i + 2), 16) + amt)));
    return `rgb(${r},${g},${b})`;
  }

  return {
    clear, spawnForRound, update, checkPlayerCollision, draw,
    get list() { return list; },
  };
})();
