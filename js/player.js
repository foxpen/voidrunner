// ─── VOID RUNNER — PLAYER ───────────────────────────────────────────────────

const Player = (() => {
  const p = CFG.PLAYER;
  let x, y, vx, vy, invincible, trail;

  // Persistent stats (carried between rounds via upgrades)
  let stats = {
    speed: p.SPEED,
    lives: 3,
    scoreMult: 1,
    permMagnet: false,
    dualFire: false,
  };

  function reset(W, H) {
    x = W / 2;
    y = H * 0.75;
    vx = 0; vy = 0;
    invincible = p.INVINCIBLE_START;
    trail = [];
  }

  function resetStats() {
    // Base stats
    stats = { speed: p.SPEED, lives: 3, scoreMult: 1, permMagnet: false, dualFire: false };

    // Apply ship selection from onboarding
    const vr = JSON.parse(localStorage.getItem('vr_player') || '{}');
    if (vr.ship === 'scout')   { stats.speed *= 1.35; stats.lives = 3; }
    if (vr.ship === 'fighter') { stats.speed *= 1.0;  stats.lives = 3; }
    if (vr.ship === 'tank')    { stats.speed *= 0.65; stats.lives = 5; }

    // Apply mode
    if (vr.mode === 'hardcore') stats.lives = 1;
  }

  function applyUpgrade(card) {
    switch (card.stat) {
      case 'shipSpeed':  stats.speed    *= (1 + card.value); break;
      case 'lives':      stats.lives    += card.value; break;
      case 'scoreMult':  stats.scoreMult += card.value; break;
      case 'permMagnet': stats.permMagnet = true; break;
      case 'dualFire':   stats.dualFire  = true; break;
    }
  }

  function update(W, H, moveVec, activePU) {
    const speedMult = activePU.speed > 0 ? 1.6 : 1;
    vx += moveVec.x * p.ACCEL;
    vy += moveVec.y * p.ACCEL;
    vx *= p.FRICTION;
    vy *= p.FRICTION;

    x += vx * stats.speed * speedMult;
    y += vy * stats.speed * speedMult;

    x = Utils.clamp(x, p.W, W - p.W);
    y = Utils.clamp(y, p.H, H - p.H);

    if (invincible > 0) invincible--;

    // Trail
    const trailColor = activePU.speed > 0 ? '#00ff88'
                     : activePU.shield > 0 ? '#00aaff'
                     : '#00ffc8';
    trail.push({ x, y, life: 1, color: trailColor });
    const maxLen = activePU.speed > 0 ? p.TRAIL_LEN_BOOST : p.TRAIL_LEN;
    if (trail.length > maxLen) trail.shift();
    trail.forEach(t => t.life -= 0.05);
  }

  function _drawEngines(ctx, px, py, shipColor, isBoosting, frameCount) {
    // 3 engine ports: center + 2 side
    const ports = [
      { ox: 0,           oy: p.H * 0.55,  w: 7 },
      { ox: -p.W * 0.25, oy: p.H * 0.45,  w: 4 },
      { ox:  p.W * 0.25, oy: p.H * 0.45,  w: 4 },
    ];
    ports.forEach((port, i) => {
      const base = isBoosting ? 16 + Math.random() * 20 : 8 + Math.random() * 10;
      const fl   = base * (i === 0 ? 1 : 0.65);
      const flicker = 0.5 + Math.random() * 0.5;

      // Outer glow
      const grad = ctx.createLinearGradient(
        px + port.ox, py + port.oy,
        px + port.ox, py + port.oy + fl
      );
      if (isBoosting) {
        grad.addColorStop(0, `rgba(0,255,136,${0.8 * flicker})`);
        grad.addColorStop(0.4, `rgba(0,200,255,${0.4 * flicker})`);
        grad.addColorStop(1, 'rgba(0,80,255,0)');
      } else {
        grad.addColorStop(0, `rgba(0,255,200,${0.6 * flicker})`);
        grad.addColorStop(0.5, `rgba(0,150,255,${0.25 * flicker})`);
        grad.addColorStop(1, 'rgba(0,50,200,0)');
      }

      ctx.fillStyle = grad;
      ctx.shadowColor = isBoosting ? '#00ff88' : '#00ffc8';
      ctx.shadowBlur  = isBoosting ? 20 : 10;

      ctx.beginPath();
      ctx.moveTo(px + port.ox - port.w, py + port.oy);
      ctx.lineTo(px + port.ox,          py + port.oy + fl);
      ctx.lineTo(px + port.ox + port.w, py + port.oy);
      ctx.closePath();
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function draw(ctx, frameCount, activePU) {
    const shipColor = activePU.speed > 0 ? '#00ff88'
                    : activePU.shield > 0 ? '#00aaff'
                    : '#00ffc8';

    // ── Trail — tapered glow ribbon ──
    for (let i = 0; i < trail.length; i++) {
      const t    = trail[i];
      if (t.life <= 0) continue;
      const frac = i / trail.length;
      ctx.globalAlpha = t.life * frac * 0.45;
      ctx.fillStyle   = t.color || shipColor;
      ctx.shadowColor = t.color || shipColor;
      ctx.shadowBlur  = 6;
      const s = (2.5 + frac * 3) * t.life;
      ctx.beginPath();
      ctx.arc(t.x, t.y + p.H * 0.5, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // Blink when invincible
    const blink = invincible > 0 && Math.floor(invincible / 4) % 2;
    if (blink) return;

    const isBoosting = activePU.speed > 0;

    // ── Engines (drawn behind hull) ──
    _drawEngines(ctx, x, y, shipColor, isBoosting, frameCount);

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = shipColor;
    ctx.shadowBlur  = 18;

    // ── Hull — main body ──
    ctx.fillStyle = shipColor;
    ctx.beginPath();
    ctx.moveTo(0,          -p.H);           // nose
    ctx.lineTo(-p.W * 0.5,  p.H * 0.1);    // inner left shoulder
    ctx.lineTo(-p.W,         p.H * 0.5);    // left wing tip
    ctx.lineTo(-p.W * 0.55,  p.H * 0.6);   // left wing trailing
    ctx.lineTo(-p.W * 0.25,  p.H * 0.45);  // left engine notch
    ctx.lineTo(0,             p.H * 0.55);  // center tail
    ctx.lineTo( p.W * 0.25,  p.H * 0.45);  // right engine notch
    ctx.lineTo( p.W * 0.55,  p.H * 0.6);   // right wing trailing
    ctx.lineTo( p.W,          p.H * 0.5);   // right wing tip
    ctx.lineTo( p.W * 0.5,   p.H * 0.1);   // inner right shoulder
    ctx.closePath();
    ctx.fill();

    // ── Hull accent stripe ──
    ctx.fillStyle   = shipColor + '66';
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.moveTo(0,           -p.H * 0.7);
    ctx.lineTo(-p.W * 0.3,   p.H * 0.05);
    ctx.lineTo(0,             p.H * 0.2);
    ctx.lineTo( p.W * 0.3,   p.H * 0.05);
    ctx.closePath();
    ctx.fill();

    // ── Cockpit ──
    ctx.fillStyle = '#060610';
    ctx.beginPath();
    ctx.moveTo(0,           -p.H * 0.65);
    ctx.lineTo(-p.W * 0.32,  p.H * 0.05);
    ctx.lineTo(0,             p.H * 0.18);
    ctx.lineTo( p.W * 0.32,  p.H * 0.05);
    ctx.closePath();
    ctx.fill();

    // Cockpit glow dot
    ctx.shadowColor = shipColor;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = shipColor;
    ctx.beginPath();
    ctx.arc(0, -p.H * 0.2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Wing-tip running lights ──
    const blink2 = Math.floor(frameCount / 18) % 2;
    ctx.shadowBlur = 10;
    ctx.fillStyle  = blink2 ? '#ff4444' : '#ff000066';
    ctx.beginPath(); ctx.arc(-p.W, p.H * 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle  = blink2 ? '#44ff44' : '#00ff0066';
    ctx.beginPath(); ctx.arc( p.W, p.H * 0.5, 2.2, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Shield bubble and magnet handled below
    // (engines already drawn before hull)
    if (activePU.shield > 0) {
      const shieldPulse = 0.6 + 0.4 * Math.sin(frameCount * 0.08);
      const shieldAlpha = activePU.shield < 120 ? (activePU.shield / 120) * 0.3 : 0.3;
      ctx.strokeStyle = `rgba(0, 170, 255, ${shieldAlpha * shieldPulse + 0.1})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, 32 + shieldPulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Magnet field indicator
    const showMagnet = activePU.magnet > 0 || stats.permMagnet;
    if (showMagnet) {
      const mPulse = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.04));
      ctx.strokeStyle = `rgba(255, 136, 0, ${0.08 * mPulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(x, y, 300, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawLivesHUD(ctx, W) {
    const heartSize = 10;
    const startX = W / 2 - (stats.lives * 22) / 2;
    for (let i = 0; i < stats.lives; i++) {
      ctx.fillStyle = i === 0 && invincible > 0 ? '#ff003355' : '#ff3355';
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 8;
      ctx.font = `${heartSize * 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('♥', startX + i * 22, 30);
    }
    ctx.shadowBlur = 0;
  }

  return {
    get x() { return x; },
    get y() { return y; },
    get w() { return p.W; },
    get h() { return p.H; },
    get invincible() { return invincible; },
    get lives() { return stats.lives; },
    get scoreMult() { return stats.scoreMult; },
    get permMagnet() { return stats.permMagnet; },
    get dualFire() { return stats.dualFire; },

    set invincible(v) { invincible = v; },
    set lives(v) { stats.lives = v; },

    reset, resetStats, applyUpgrade, update, draw, drawLivesHUD,
  };
})();
