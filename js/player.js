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

  function draw(ctx, frameCount, activePU) {
    // Trail
    trail.forEach(t => {
      if (t.life <= 0) return;
      ctx.globalAlpha = t.life * 0.35;
      ctx.fillStyle = t.color || '#00ffc8';
      const s = 3.5 * t.life;
      ctx.beginPath();
      ctx.arc(t.x, t.y + 10, s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Blink when invincible
    const blink = invincible > 0 && Math.floor(invincible / 4) % 2;
    if (blink) return;

    ctx.save();
    ctx.translate(x, y);

    const shipColor = activePU.speed > 0 ? '#00ff88'
                    : activePU.shield > 0 ? '#00aaff'
                    : '#00ffc8';

    ctx.shadowColor = shipColor;
    ctx.shadowBlur  = 25;
    ctx.fillStyle   = shipColor;

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -p.H);
    ctx.lineTo(-p.W,     p.H * 0.6);
    ctx.lineTo(-p.W*0.3, p.H * 0.3);
    ctx.lineTo(0,         p.H * 0.5);
    ctx.lineTo( p.W*0.3,  p.H * 0.3);
    ctx.lineTo( p.W,      p.H * 0.6);
    ctx.closePath();
    ctx.fill();

    // Cockpit cutout
    ctx.fillStyle = '#0a0a0f';
    ctx.beginPath();
    ctx.moveTo(0, -p.H * 0.55);
    ctx.lineTo(-p.W * 0.4, p.H * 0.3);
    ctx.lineTo(0,           p.H * 0.15);
    ctx.lineTo( p.W * 0.4,  p.H * 0.3);
    ctx.closePath();
    ctx.fill();

    // Cockpit dot
    ctx.fillStyle = shipColor + 'aa';
    ctx.beginPath();
    ctx.arc(0, -p.H * 0.15, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Engine flame
    const flameLen = activePU.speed > 0
      ? 14 + Math.random() * 16
      :  8 + Math.random() * 10;
    const flameColor = activePU.speed > 0
      ? `rgba(0, 255, 136, ${0.4 + Math.random() * 0.4})`
      : `rgba(0, 255, 200, ${0.3 + Math.random() * 0.3})`;

    ctx.fillStyle = flameColor;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + p.H * 0.5);
    ctx.lineTo(x,     y + p.H * 0.5 + flameLen);
    ctx.lineTo(x + 5, y + p.H * 0.5);
    ctx.closePath();
    ctx.fill();

    if (activePU.speed > 0) {
      const sfl = 6 + Math.random() * 8;
      ctx.fillStyle = `rgba(0, 255, 136, ${0.2 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(x - p.W,     y + p.H * 0.6);
      ctx.lineTo(x - p.W - 3, y + p.H * 0.6 + sfl);
      ctx.lineTo(x - p.W + 3, y + p.H * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + p.W,     y + p.H * 0.6);
      ctx.lineTo(x + p.W + 3, y + p.H * 0.6 + sfl);
      ctx.lineTo(x + p.W - 3, y + p.H * 0.6);
      ctx.closePath();
      ctx.fill();
    }

    // Shield bubble
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
