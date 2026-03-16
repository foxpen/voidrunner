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
    if (b.hp <= 0 && !defeated && !b.dying) {
      b.dying    = true;
      dyingTimer = 150;
      bullets    = [];
      Particles.spawn(b.x, b.y, '#ff3355', 50);
      Particles.spawn(b.x, b.y, '#ff8800', 40);
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
    return { x: b.x, y: b.y, size: b.size, hp: b.hp, takeDmg: takeDamage };
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────
  function draw(ctx, frameCount) {
    if (!active) return;

    // Boss bullets
    bullets.forEach(bul => {
      const halo = bul.halo || '#ff8800';
      const hg   = ctx.createRadialGradient(bul.x, bul.y, 0, bul.x, bul.y, bul.size * 2.5);
      hg.addColorStop(0, halo + '88');
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#010001';
      ctx.shadowColor = halo; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Boss body
    ctx.save();
    ctx.translate(b.x + b.shakeX, b.y);
    b.shakeX *= 0.7;

    const pulse    = 0.7 + 0.3 * Math.sin(frameCount * (phase === 2 ? 0.12 : 0.06));
    const ringColor = phase === 2 ? '#ff4400' : '#ff9922';
    const edgeColor = phase === 2 ? '#ff4400' : '#ff8800';

    // Hit flash
    if (b.hitFlash > 0) {
      b.hitFlash--;
      ctx.globalAlpha = (b.hitFlash / 8) * 0.55;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, b.size * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── Dying rings ──
    if (b.dying) {
      const dyingPct = 1 - dyingTimer / 150;
      for (let r = 0; r < 3; r++) {
        const ringR = b.size * (1 + dyingPct * (r + 1) * 0.9);
        const ringA = Math.max(0, 0.8 - dyingPct * (r + 1) * 0.4);
        ctx.strokeStyle = `rgba(255,${80 + r*60},0,${ringA})`;
        ctx.lineWidth   = 3 - r * 0.8;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur  = 18;
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = dyingTimer % 8 < 4 ? 0.55 : 1.0; // flicker
    }

    // Phase 2: corona
    if (phase === 2) {
      const corona = ctx.createRadialGradient(0, 0, b.size * 0.8, 0, 0, b.size * 1.7);
      corona.addColorStop(0,   'rgba(0,0,0,0)');
      corona.addColorStop(0.5, `rgba(255,60,0,${0.12 * pulse})`);
      corona.addColorStop(1,   `rgba(255,20,0,${0.32 * pulse})`);
      ctx.fillStyle = corona;
      ctx.beginPath(); ctx.arc(0, 0, b.size * 1.7, 0, Math.PI * 2); ctx.fill();
    }

    // Body
    ctx.rotate(b.rot);
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
    bodyGrad.addColorStop(0,   '#000000');
    bodyGrad.addColorStop(0.8, '#050205');
    bodyGrad.addColorStop(1,   '#0a0308');
    ctx.fillStyle  = bodyGrad;
    ctx.shadowColor = edgeColor;
    ctx.shadowBlur  = 30 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, b.size, 0, Math.PI * 2); ctx.fill();

    // Hexagon core
    ctx.strokeStyle = `rgba(255,80,0,${0.12 + 0.08 * pulse})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = b.size * (0.65 + 0.15 * Math.sin(frameCount * 0.05 + i));
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Accretion ring
    ctx.rotate(-b.rot);
    ctx.save();
    ctx.rotate(b.orbitAngle);
    ctx.scale(1, 0.26);
    ctx.strokeStyle  = ringColor;
    ctx.lineWidth    = phase === 2 ? 4 : 2.5;
    ctx.shadowColor  = ringColor;
    ctx.shadowBlur   = phase === 2 ? 28 : 16;
    ctx.globalAlpha  = phase === 2 ? 0.9 : 0.72;
    ctx.beginPath(); ctx.arc(0, 0, b.size * 1.18, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();

    // Move state indicator — malý symbol nad bossem
    if (moveState === 'CHARGE') {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle   = '#ff4422';
      ctx.font        = `bold ${b.size * 0.3}px monospace`;
      ctx.textAlign   = 'center';
      ctx.fillText('▼', 0, -b.size - 10);
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
