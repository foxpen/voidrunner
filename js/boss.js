// ─── VOID RUNNER — BOSS ─────────────────────────────────────────────────────

const Boss = (() => {
  let active   = false;
  let b        = {};
  let bullets  = [];
  let phase    = 1;
  let defeated = false;
  let entryDone = false;
  let dyingTimer = 0;

  // ── Attack state machine ──
  let attackTimer   = 0;   // frames until next attack
  let attackPattern = 0;   // 0-3, cycles through patterns
  let spiralFrame   = 0;   // frames left in spiral attack
  let spiralAngle   = 0;

  // ── Movement state machine ──
  let moveState     = 'DRIFT';  // DRIFT | CHARGE | DODGE
  let moveTimer     = 0;
  let chargeTarget  = { x: 0, y: 0 };
  let dodgeDir      = 1;

  const CFG_B = CFG.BOSS;

  function spawn(W, H) {
    active    = true;
    defeated  = false;
    entryDone = false;
    phase     = 1;
    attackTimer   = 60;   // krátká pauza před prvním útokem
    attackPattern = 0;
    spiralFrame   = 0;
    moveState     = 'DRIFT';
    moveTimer     = 120;
    dyingTimer    = 0;

    b = {
      x: W / 2,
      y: (H || window.innerHeight) * 0.62,
      vx: 0, vy: 0,
      hp: CFG_B.HP,
      maxHp: CFG_B.HP,
      size: 0,
      targetSize: CFG_B.SIZE,
      entryFrame: 0,
      rot: 0,
      rotSpeed: 0.012,
      shakeX: 0,
      hitFlash: 0,
      orbitAngle: 0,
    };
    bullets = [];
  }

  function clear() {
    active   = false;
    bullets  = [];
    b        = {};
    defeated = false;
  }

  function update(W, H, slowActive) {
    if (!active) return;
    const slowMult = slowActive ? 0.35 : 1;

    // ── Dying animation ──
    if (b.dying) {
      dyingTimer--;
      b.shakeX = (Math.random() - 0.5) * 14;
      b.rot += b.rotSpeed * 4 * slowMult;
      if (dyingTimer % 12 === 0) {
        const ex = b.x + (Math.random() - 0.5) * b.size * 2;
        const ey = b.y + (Math.random() - 0.5) * b.size * 2;
        const col = ['#ff3355','#ff8800','#ffcc00'][ Math.floor(Math.random()*3) ];
        Particles.spawn(ex, ey, col, 20);
        Particles.spawnDebris(ex, ey, '#ff8800', 3);
      }
      if (dyingTimer <= 0) {
        defeated = true;
        active   = false;
        Particles.spawn(b.x, b.y, '#ffffff', 60);
        Particles.spawn(b.x, b.y, '#ffcc00', 40);
      }
      return;
    }

    // ── Entry: materializace ──
    if (!entryDone) {
      b.entryFrame++;
      b.size = b.targetSize * Math.min(1, b.entryFrame / 90);
      b.orbitAngle += 0.05 * slowMult;
      b.rot += b.rotSpeed * slowMult;
      if (b.entryFrame >= 90) { b.size = b.targetSize; entryDone = true; }
      return;
    }

    // ── Phase check ──
    if (b.hp <= CFG_B.PHASE2_HP && phase === 1) {
      phase = 2;
      b.rotSpeed = 0.028;
      Particles.spawn(b.x, b.y, '#ff8800', 60);
    }

    const p2 = phase === 2;

    // ── Movement state machine ──
    _updateMovement(W, H, slowMult, p2);

    b.rot        += b.rotSpeed * slowMult;
    b.orbitAngle += 0.028 * (p2 ? 1.8 : 1) * slowMult;

    // Clamp v aréně
    b.x = Utils.clamp(b.x, b.size + 20, W - b.size - 20);
    b.y = Utils.clamp(b.y, H * 0.1,     H - b.size - 20);

    // ── Spiral — pokračující útok ──
    if (spiralFrame > 0) {
      spiralFrame--;
      spiralAngle += 0.28 * (p2 ? 1.5 : 1);
      const spd = p2 ? 4 : 3;
      bullets.push({
        x: b.x, y: b.y,
        vx: Math.cos(spiralAngle) * spd,
        vy: Math.sin(spiralAngle) * spd,
        size: 5, halo: '#aa44ff', speed: spd,
      });
    }

    // ── Attack timer ──
    attackTimer -= slowMult;
    if (attackTimer <= 0 && spiralFrame <= 0) {
      const rate = Math.max(40, (p2 ? 55 : 80));
      attackTimer = rate;
      _doAttack(W, H, p2);
    }

    // ── Move bullets ──
    bullets.forEach(bul => {
      bul.x += bul.vx * slowMult;
      bul.y += bul.vy * slowMult;
      if (bul.homing) {
        bul.homingDelay = (bul.homingDelay || 0) - 1;
        if (bul.homingDelay <= 0) {
          const angle = Utils.angleTo(bul.x, bul.y, Player.x, Player.y);
          bul.vx = Utils.moveToward(bul.vx, Math.cos(angle) * bul.speed, 0.07);
          bul.vy = Utils.moveToward(bul.vy, Math.sin(angle) * bul.speed, 0.07);
        }
        bul.life = (bul.life || 300) - 1;
        if (bul.life <= 0) { bul.x = -999; } // odstranit
      }
    });
    bullets = bullets.filter(bul =>
      bul.x > -30 && bul.x < W + 30 && bul.y > -30 && bul.y < H + 30
    );
  }

  // ─── Movement state machine ────────────────────────────────────────────────
  function _updateMovement(W, H, slowMult, p2) {
    moveTimer -= slowMult;

    if (moveState === 'DRIFT') {
      // Náhodný drift
      b.vx += (Math.random() - 0.5) * (p2 ? 0.7 : 0.4);
      b.vy += (Math.random() - 0.5) * (p2 ? 0.5 : 0.28);
      b.vx *= 0.93; b.vy *= 0.93;
      const maxSpd = p2 ? 2.5 : 1.6;
      b.vx = Utils.clamp(b.vx, -maxSpd, maxSpd);
      b.vy = Utils.clamp(b.vy, -maxSpd * 0.6, maxSpd * 0.6);
      if (moveTimer <= 0) {
        // Přepni na CHARGE nebo DODGE
        moveState    = Math.random() < (p2 ? 0.55 : 0.35) ? 'CHARGE' : 'DODGE';
        moveTimer    = p2 ? 80 : 110;
        chargeTarget = { x: Player.x, y: Player.y };
        dodgeDir     = Math.random() < 0.5 ? 1 : -1;
      }

    } else if (moveState === 'CHARGE') {
      // Nabíhá k pozici hráče (zapamatované při startu CHARGE)
      const ax = (chargeTarget.x - b.x) * 0.06;
      const ay = (chargeTarget.y - b.y) * 0.06;
      b.vx += ax; b.vy += ay;
      b.vx *= 0.9; b.vy *= 0.9;
      const maxChg = p2 ? 5.5 : 3.8;
      b.vx = Utils.clamp(b.vx, -maxChg, maxChg);
      b.vy = Utils.clamp(b.vy, -maxChg, maxChg);
      if (moveTimer <= 0) {
        moveState = 'DRIFT';
        moveTimer = p2 ? 100 : 140;
      }

    } else if (moveState === 'DODGE') {
      // Uhýbá kolmo od hráče
      const toPlayer = Utils.angleTo(b.x, b.y, Player.x, Player.y);
      const perpAngle = toPlayer + Math.PI * 0.5 * dodgeDir;
      const dodgeSpd  = p2 ? 3.5 : 2.2;
      b.vx += Math.cos(perpAngle) * 0.4;
      b.vy += Math.sin(perpAngle) * 0.4;
      b.vx *= 0.92; b.vy *= 0.92;
      b.vx = Utils.clamp(b.vx, -dodgeSpd, dodgeSpd);
      b.vy = Utils.clamp(b.vy, -dodgeSpd, dodgeSpd);
      if (moveTimer <= 0) {
        moveState = 'DRIFT';
        moveTimer = p2 ? 90 : 120;
      }
    }

    b.x += b.vx * slowMult;
    b.y += b.vy * slowMult;
  }

  // ─── 4 útočné patterny ────────────────────────────────────────────────────
  function _doAttack(W, H, p2) {
    const pat = attackPattern % (p2 ? 4 : 3);  // fáze 2 odemkne curtain
    attackPattern++;

    switch (pat) {

      case 0: // RADIAL — kruhový výbuch
        _attackRadial(p2 ? 14 : 10, p2 ? 4.5 : 3.2);
        break;

      case 1: // SPIRAL — otáčivá spirála
        spiralFrame = p2 ? 36 : 28;
        spiralAngle = Utils.angleTo(b.x, b.y, Player.x, Player.y);
        break;

      case 2: // SWARM — naváděcí roje
        _attackSwarm(p2 ? 6 : 4);
        break;

      case 3: // CURTAIN — zeď střel s mezerami (jen fáze 2)
        _attackCurtain(W, H);
        break;
    }

    // Po útoku — udělej dodge
    if (moveState === 'DRIFT') {
      moveState = 'DODGE';
      moveTimer = 70;
      dodgeDir  = Math.random() < 0.5 ? 1 : -1;
    }
  }

  function _attackRadial(count, spd) {
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      bullets.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        size: 6, halo: '#ff9922', speed: spd,
      });
    }
  }

  function _attackSwarm(count) {
    for (let i = 0; i < count; i++) {
      const spread = (i / count - 0.5) * 1.8; // větší rozptyl na startu
      const angle  = Utils.angleTo(b.x, b.y, Player.x, Player.y) + spread;
      const spd    = 2.0 + Math.random() * 0.8; // pomalejší
      bullets.push({
        x: b.x + Math.cos(angle) * b.size,
        y: b.y + Math.sin(angle) * b.size,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 7, halo: '#ffcc00', speed: spd,
        homing: true,
        homingDelay: 40, // 40 framů letí rovně
        life: 300,       // zmizí po 5s
      });
    }
  }

  function _attackCurtain(W, H) {
    // 3 řady střel se svislými mezerami (hráč musí projet)
    const rows   = 3;
    const cols   = 9;
    const gapCol = Math.floor(Math.random() * cols); // mezera
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.abs(col - gapCol) <= 0.5) continue; // mezera pro hráče
        const bx = (col / (cols - 1)) * W;
        const by = H * (0.15 + row * 0.08);
        bullets.push({
          x: bx, y: by,
          vx: 0, vy: 1.8 + row * 0.4,
          size: 6, halo: '#ff4466', speed: 1.8,
        });
      }
    }
  }

  // ─── Damage & hit ─────────────────────────────────────────────────────────
  function takeDamage(dmg) {
    if (!active) return;
    b.hp = Math.max(0, b.hp - dmg);
    b.shakeX   = 8;
    b.hitFlash = 8;
    Particles.spawn(b.x, b.y, '#ffffff', 6);
    if (typeof Audio !== 'undefined') Audio.sfx('bossHit');
    if (typeof Fx !== 'undefined') Fx.bossHitFlash = Math.max(Fx.bossHitFlash, 0.45);
    if (b.hp <= 0 && !defeated && !b.dying) {
      b.dying    = true;
      dyingTimer = 150;
      bullets    = [];
      Particles.spawn(b.x, b.y, '#ff3355', 50);
      Particles.spawn(b.x, b.y, '#ff8800', 40);
      if (typeof Audio !== 'undefined') Audio.sfx('explode');
      if (typeof Fx !== 'undefined') Fx.bossHitFlash = 1.0;
      if (typeof screenFlash !== 'undefined') {
        screenFlash.r = 255; screenFlash.g = 200; screenFlash.b = 0; screenFlash.a = 0.65;
      }
    }
  }

  function checkPlayerBulletHit() {
    if (!active || !entryDone || Player.invincible > 0 || b.dying) return false;
    for (const bul of bullets) {
      if (Utils.dist(Player.x, Player.y, bul.x, bul.y) < bul.size + Player.w * 0.5) return true;
    }
    return false;
  }

  function asBossTarget() {
    if (!active || !entryDone || b.dying) return null;
    return { x: b.x, y: b.y, size: b.size, hp: b.hp, takeDmg: takeDamage, isBoss: true };
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────
  function draw(ctx, frameCount) {
    if (!active) return;

    // ── Boss bullets — dark orbs with hot halo ──────────────────────────────
    bullets.forEach(bul => {
      const halo = bul.halo || '#ff8800';
      // Outer glow
      const hg = ctx.createRadialGradient(bul.x, bul.y, 0, bul.x, bul.y, bul.size * 3.5);
      hg.addColorStop(0,   halo + 'aa');
      hg.addColorStop(0.4, halo + '44');
      hg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size * 3.5, 0, Math.PI * 2); ctx.fill();
      // Dark core
      const bg2 = ctx.createRadialGradient(bul.x, bul.y, 0, bul.x, bul.y, bul.size);
      bg2.addColorStop(0,   '#000000');
      bg2.addColorStop(0.7, '#1a0400');
      bg2.addColorStop(1,   halo + '88');
      ctx.fillStyle = bg2;
      ctx.shadowColor = halo; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size, 0, Math.PI * 2); ctx.fill();
      // Hot rim
      ctx.strokeStyle = halo; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    });

    ctx.save();
    ctx.translate(b.x + b.shakeX, b.y);
    b.shakeX *= 0.7;

    const pulse     = 0.65 + 0.35 * Math.sin(frameCount * (phase === 2 ? 0.14 : 0.06));
    const ringColor = phase === 2 ? '#ff3300' : '#ff8800';
    const edgeColor = phase === 2 ? '#ff2200' : '#ff7700';

    // ── Far glow field ──────────────────────────────────────────────────────
    const farGlow = ctx.createRadialGradient(0, 0, b.size * 0.5, 0, 0, b.size * 3.5);
    farGlow.addColorStop(0,   `rgba(255,80,0,${0.08 * pulse})`);
    farGlow.addColorStop(0.5, `rgba(180,30,0,${0.04 * pulse})`);
    farGlow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = farGlow;
    ctx.beginPath(); ctx.arc(0, 0, b.size * 3.5, 0, Math.PI * 2); ctx.fill();

    // ── Tentacle arms (8 rotating appendages) ──────────────────────────────
    const armCount = phase === 2 ? 10 : 8;
    for (let i = 0; i < armCount; i++) {
      const baseA  = b.rot + (i / armCount) * Math.PI * 2;
      const wobble = Math.sin(frameCount * 0.04 + i * 1.2) * 0.3;
      const len    = b.size * (1.4 + 0.35 * Math.sin(frameCount * 0.06 + i));

      ctx.strokeStyle = `rgba(${phase===2?'255,40,0':'220,80,0'},${(0.3 + 0.2 * pulse) * (1 - i % 2 * 0.3)})`;
      ctx.lineWidth   = 3.5 - i * 0.2;
      ctx.shadowColor = edgeColor;
      ctx.shadowBlur  = 12;
      ctx.lineCap     = 'round';

      ctx.beginPath();
      const sx = Math.cos(baseA) * b.size * 0.85;
      const sy = Math.sin(baseA) * b.size * 0.85;
      const cx2 = Math.cos(baseA + wobble) * len * 0.6;
      const cy2 = Math.sin(baseA + wobble) * len * 0.6;
      const ex  = Math.cos(baseA + wobble * 2) * len;
      const ey  = Math.sin(baseA + wobble * 2) * len;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx2, cy2, ex, ey);
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.lineCap = 'butt';

    // ── Dying expansion ─────────────────────────────────────────────────────
    if (b.dying) {
      const dyPct = 1 - dyingTimer / 150;
      for (let r = 0; r < 4; r++) {
        const rr = b.size * (1.1 + dyPct * (r + 1) * 1.1);
        const ra = Math.max(0, 0.9 - dyPct * (r + 1) * 0.35);
        ctx.strokeStyle = `rgba(255,${60 + r * 50},0,${ra})`;
        ctx.lineWidth   = 3.5 - r * 0.7;
        ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = dyingTimer % 8 < 4 ? 0.45 : 1.0;
    }

    // ── Phase 2 corona flare ────────────────────────────────────────────────
    if (phase === 2) {
      for (let i = 0; i < 6; i++) {
        const a  = b.rot * 2 + (i / 6) * Math.PI * 2;
        const r1 = b.size * 0.9, r2 = b.size * (1.6 + 0.4 * Math.sin(frameCount * 0.08 + i));
        ctx.strokeStyle = `rgba(255,60,0,${0.15 * pulse})`;
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
        ctx.lineTo(Math.cos(a)*r2, Math.sin(a)*r2); ctx.stroke();
      }
    }

    // ── Main body ───────────────────────────────────────────────────────────
    ctx.rotate(b.rot);
    const bodyG = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
    bodyG.addColorStop(0,   '#000000');
    bodyG.addColorStop(0.55,`#0a0203`);
    bodyG.addColorStop(0.88,`#1a0405`);
    bodyG.addColorStop(1,   `#2a0608`);
    ctx.fillStyle   = bodyG;
    ctx.shadowColor = edgeColor;
    ctx.shadowBlur  = 40 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, b.size, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur  = 0;

    // ── Inner vein pattern ──────────────────────────────────────────────────
    for (let v = 0; v < 6; v++) {
      const a   = (v / 6) * Math.PI * 2 + frameCount * 0.008;
      const r1  = b.size * 0.18, r2 = b.size * 0.78;
      const mid = b.size * (0.35 + 0.12 * Math.sin(frameCount * 0.04 + v));
      const va  = a + 0.4 * Math.sin(frameCount * 0.03 + v);
      ctx.strokeStyle = `rgba(255,${50 + v*15},0,${0.18 * pulse})`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.quadraticCurveTo(Math.cos(va) * mid, Math.sin(va) * mid,
                            Math.cos(a + 0.2) * r2, Math.sin(a + 0.2) * r2);
      ctx.stroke();
    }

    // ── Red eye core ────────────────────────────────────────────────────────
    const eyeR = b.size * 0.22 * pulse;
    const eyeG = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeR * 2.2);
    eyeG.addColorStop(0,   'rgba(255,255,200,0.95)');
    eyeG.addColorStop(0.18,`rgba(255,100,0,0.9)`);
    eyeG.addColorStop(0.55,`rgba(200,0,0,0.55)`);
    eyeG.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle   = eyeG;
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 35 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, eyeR * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 0, eyeR * 0.28, 0, Math.PI * 2); ctx.fill();

    // ── Accretion ring ──────────────────────────────────────────────────────
    ctx.rotate(-b.rot);
    ctx.save();
    ctx.rotate(b.orbitAngle);
    for (let r = 0; r < 3; r++) {
      ctx.save();
      ctx.scale(1, 0.22 + r * 0.03);
      const rAlpha = (0.85 - r * 0.22) * (phase === 2 ? 1 : 0.75);
      ctx.strokeStyle = r === 0 ? ringColor : ringColor + (r === 1 ? 'bb' : '66');
      ctx.lineWidth   = phase === 2 ? 4 - r : 2.5 - r * 0.5;
      ctx.shadowColor = ringColor; ctx.shadowBlur = phase === 2 ? 28 : 16;
      ctx.globalAlpha = rAlpha;
      ctx.beginPath(); ctx.arc(0, 0, b.size * (1.15 + r * 0.12), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();

    // ── Hit flash ───────────────────────────────────────────────────────────
    if (b.hitFlash > 0) {
      b.hitFlash--;
      ctx.globalAlpha = (b.hitFlash / 8) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, b.size * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    spawn, clear, update, draw,
    checkPlayerBulletHit, asBossTarget, takeDamage,
    get active()   { return active; },
    get defeated() { return defeated; },
    get hp()       { return b.hp || 0; },
    get maxHp()    { return b.maxHp || CFG_B.HP; },
    get phase()    { return phase; },
  };
})();
