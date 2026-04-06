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
      case 'overdrive':  stats.speed *= 1.3; break;
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
    const ports = [
      { ox: 0,            oy: p.H * 0.55, w: 9  },
      { ox: -p.W * 0.42,  oy: p.H * 0.42, w: 6  },
      { ox:  p.W * 0.42,  oy: p.H * 0.42, w: 6  },
      { ox: -p.W * 0.78,  oy: p.H * 0.35, w: 4  },
      { ox:  p.W * 0.78,  oy: p.H * 0.35, w: 4  },
    ];
    ports.forEach((port, i) => {
      const base    = isBoosting ? 20 + Math.random() * 28 : 10 + Math.random() * 14;
      const fl      = base * (i === 0 ? 1 : i <= 2 ? 0.7 : 0.45);
      const flicker = 0.5 + Math.random() * 0.5;
      const grad    = ctx.createLinearGradient(px+port.ox, py+port.oy, px+port.ox, py+port.oy+fl);
      if (isBoosting) {
        grad.addColorStop(0, `rgba(80,255,180,${0.95*flicker})`);
        grad.addColorStop(0.35, `rgba(0,200,255,${0.5*flicker})`);
        grad.addColorStop(1, 'rgba(0,60,200,0)');
      } else {
        grad.addColorStop(0, `rgba(0,240,200,${0.75*flicker})`);
        grad.addColorStop(0.5, `rgba(0,140,255,${0.3*flicker})`);
        grad.addColorStop(1, 'rgba(0,40,180,0)');
      }
      ctx.fillStyle   = grad;
      ctx.shadowColor = isBoosting ? '#00ff88' : '#00ffc8';
      ctx.shadowBlur  = isBoosting ? 24 : 14;
      ctx.beginPath();
      ctx.moveTo(px+port.ox - port.w, py+port.oy);
      ctx.lineTo(px+port.ox,          py+port.oy + fl);
      ctx.lineTo(px+port.ox + port.w, py+port.oy);
      ctx.closePath();
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function draw(ctx, frameCount, activePU) {
    const shipColor = activePU.speed  > 0 ? '#00ff88'
                    : activePU.shield > 0 ? '#00aaff'
                    : '#00d4ff';

    // ── Trail ──
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      if (t.life <= 0) continue;
      const frac = i / trail.length;
      ctx.globalAlpha = t.life * frac * 0.5;
      ctx.fillStyle   = t.color || shipColor;
      ctx.shadowColor = t.color || shipColor;
      ctx.shadowBlur  = 8;
      const s = (3 + frac * 4) * t.life;
      ctx.beginPath();
      ctx.arc(t.x, t.y + p.H * 0.5, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    const blink = invincible > 0 && Math.floor(invincible / 4) % 2;
    if (blink) return;

    const isBoosting = activePU.speed > 0;

    _drawEngines(ctx, x, y, shipColor, isBoosting, frameCount);

    ctx.save();
    ctx.translate(x, y);

    // ── Outer glow halo ──
    const haloGrad = ctx.createRadialGradient(0, 0, p.W * 0.3, 0, 0, p.W * 2.2);
    haloGrad.addColorStop(0, shipColor + '22');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath(); ctx.arc(0, 0, p.W * 2.2, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = shipColor;
    ctx.shadowBlur  = 22;

    // ── Outer wing panels ──
    ctx.fillStyle = '#0a1a2a';
    ctx.strokeStyle = shipColor + '88';
    ctx.lineWidth = 1;
    // Left outer wing
    ctx.beginPath();
    ctx.moveTo(-p.W * 0.55,  p.H * 0.08);
    ctx.lineTo(-p.W * 1.35,  p.H * 0.42);
    ctx.lineTo(-p.W * 1.1,   p.H * 0.62);
    ctx.lineTo(-p.W * 0.55,  p.H * 0.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right outer wing
    ctx.beginPath();
    ctx.moveTo( p.W * 0.55,  p.H * 0.08);
    ctx.lineTo( p.W * 1.35,  p.H * 0.42);
    ctx.lineTo( p.W * 1.1,   p.H * 0.62);
    ctx.lineTo( p.W * 0.55,  p.H * 0.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ── Main hull body ──
    ctx.fillStyle = '#0d2035';
    ctx.strokeStyle = shipColor;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(0,             -p.H);           // nose
    ctx.lineTo(-p.W * 0.28,  -p.H * 0.4);     // upper left
    ctx.lineTo(-p.W * 0.55,   p.H * 0.08);    // left shoulder
    ctx.lineTo(-p.W * 0.72,   p.H * 0.48);    // left engine pod
    ctx.lineTo(-p.W * 0.42,   p.H * 0.58);    // left tail
    ctx.lineTo(-p.W * 0.18,   p.H * 0.48);    // left center notch
    ctx.lineTo(0,              p.H * 0.58);    // center tail
    ctx.lineTo( p.W * 0.18,   p.H * 0.48);
    ctx.lineTo( p.W * 0.42,   p.H * 0.58);
    ctx.lineTo( p.W * 0.72,   p.H * 0.48);
    ctx.lineTo( p.W * 0.55,   p.H * 0.08);
    ctx.lineTo( p.W * 0.28,  -p.H * 0.4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ── Center fuselage stripe ──
    ctx.fillStyle = shipColor + '33';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0,            -p.H * 0.75);
    ctx.lineTo(-p.W * 0.22,  p.H * 0.05);
    ctx.lineTo(-p.W * 0.12,  p.H * 0.35);
    ctx.lineTo(0,             p.H * 0.45);
    ctx.lineTo( p.W * 0.12,  p.H * 0.35);
    ctx.lineTo( p.W * 0.22,  p.H * 0.05);
    ctx.closePath();
    ctx.fill();

    // ── Engine pods ──
    ctx.fillStyle = '#081828';
    ctx.strokeStyle = shipColor + 'aa';
    ctx.lineWidth = 1;
    // Left pod
    ctx.beginPath();
    ctx.ellipse(-p.W * 0.6, p.H * 0.3, p.W * 0.18, p.H * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Right pod
    ctx.beginPath();
    ctx.ellipse( p.W * 0.6, p.H * 0.3, p.W * 0.18, p.H * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // ── Cockpit ──
    ctx.fillStyle = '#020810';
    ctx.strokeStyle = shipColor + 'cc';
    ctx.lineWidth = 1;
    ctx.shadowColor = shipColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0,            -p.H * 0.72);
    ctx.lineTo(-p.W * 0.2,  -p.H * 0.18);
    ctx.lineTo(0,             p.H * 0.05);
    ctx.lineTo( p.W * 0.2,  -p.H * 0.18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit glow
    ctx.shadowColor = shipColor;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = shipColor + 'cc';
    ctx.beginPath();
    ctx.arc(0, -p.H * 0.3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Accent lines on wings ──
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = shipColor + '55';
    ctx.lineWidth   = 1;
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side * p.W * 0.3,  -p.H * 0.15);
      ctx.lineTo(side * p.W * 0.65,  p.H * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * p.W * 0.42,  p.H * 0.1);
      ctx.lineTo(side * p.W * 0.95,  p.H * 0.5);
      ctx.stroke();
    });

    // ── Wing-tip lights ──
    const blinkLight = Math.floor(frameCount / 18) % 2;
    ctx.shadowBlur = 12;
    ctx.fillStyle  = blinkLight ? '#ff4455' : '#ff334455';
    ctx.beginPath(); ctx.arc(-p.W * 1.3, p.H * 0.44, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle  = blinkLight ? '#44ff88' : '#33ff5533';
    ctx.beginPath(); ctx.arc( p.W * 1.3, p.H * 0.44, 2.8, 0, Math.PI * 2); ctx.fill();

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
    const sz     = 28;           // heart font size
    const gap    = sz * 1.15;    // spacing between hearts
    const totalW = (stats.lives - 1) * gap;
    const startX = W / 2 - totalW / 2;
    const y      = 52;           // below round display
    for (let i = 0; i < stats.lives; i++) {
      const fading = i === 0 && invincible > 0;
      ctx.globalAlpha = fading ? 0.25 : 1;
      ctx.fillStyle   = '#ff3355';
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur  = fading ? 0 : 14;
      ctx.font        = `${sz}px sans-serif`;
      ctx.textAlign   = 'center';
      ctx.fillText('♥', startX + i * gap, y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
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
