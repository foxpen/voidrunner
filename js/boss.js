// ─── VOID RUNNER — BOSS ─────────────────────────────────────────────────────

const Boss = (() => {
  let active = false;
  let b = {};
  let bullets = [];
  let attackTimer = 0;
  let phase = 1;
  let defeated = false;
  let entryDone = false;

  const CFG_B = CFG.BOSS;

  function spawn(W, H) {
    active = true;
    defeated = false;
    entryDone = false;
    phase = 1;
    attackTimer = 0;
    const bh_cy = (H || window.innerHeight) * 0.62; // pod středem BH aby byl viditelný
    b = {
      x: W / 2,
      y: bh_cy,
      targetY: bh_cy,
      vx: 0, vy: 0,
      hp: CFG_B.HP,
      maxHp: CFG_B.HP,
      size: 0,             // začíná na 0, scale-up animace
      targetSize: CFG_B.SIZE,
      entryFrame: 0,
      rot: 0,
      rotSpeed: 0.012,
      color: CFG_B.COLOR_P1,
      shakeX: 0,
      hitFlash: 0,
      orbitAngle: 0,
    };
    bullets = [];
  }

  function clear() {
    active = false;
    bullets = [];
    b = {};
    defeated = false;
  }

  function update(W, H, slowActive) {
    if (!active) return;
    const slowMult = slowActive ? 0.35 : 1;

    // Entry: materializace z černé díry (scale 0 → targetSize za 90 framů)
    if (!entryDone) {
      b.entryFrame++;
      b.size = b.targetSize * Math.min(1, b.entryFrame / 90);
      b.orbitAngle += 0.05 * slowMult;
      b.rot += b.rotSpeed * slowMult;
      if (b.entryFrame >= 90) { b.size = b.targetSize; entryDone = true; }
      return;
    }

    // Phase check
    if (b.hp <= CFG_B.PHASE2_HP && phase === 1) {
      phase = 2;
      b.color = CFG_B.COLOR_P2;
      b.rotSpeed = 0.025;
      Particles.spawn(b.x, b.y, '#ff8800', 60);
    }

    // Patrol — horizontal + vertical drift
    const spd = CFG_B.SPEED * (phase === 2 ? 2.5 : 1.4);
    b.vx += (Math.random() - 0.5) * 0.5 * (phase === 2 ? 2 : 1);
    b.vy += (Math.random() - 0.5) * 0.25 * (phase === 2 ? 2 : 1);
    b.vx *= 0.94; b.vy *= 0.94;
    b.vx = Utils.clamp(b.vx, -spd, spd);
    b.vy = Utils.clamp(b.vy, -spd * 0.6, spd * 0.6);
    b.x += b.vx * slowMult;
    b.y += b.vy * slowMult;
    b.x  = Utils.clamp(b.x, b.size + 20, W - b.size - 20);
    b.y  = Utils.clamp(b.y, H * 0.45, H - b.size - 20);

    b.rot += b.rotSpeed * slowMult;
    b.orbitAngle += 0.028 * (phase === 2 ? 1.8 : 1) * slowMult;

    // Attack
    attackTimer--;
    if (attackTimer <= 0) {
      attackTimer = Math.max(30, CFG_B.ATTACK_RATE - (phase === 2 ? 30 : 0));
      _attack(W, H);
    }

    // Move bullets
    bullets.forEach(bul => {
      bul.x += bul.vx * slowMult;
      bul.y += bul.vy * slowMult;
      if (bul.homing) {
        const angle = Utils.angleTo(bul.x, bul.y, Player.x, Player.y);
        bul.vx = Utils.moveToward(bul.vx, Math.cos(angle) * bul.speed, 0.15);
        bul.vy = Utils.moveToward(bul.vy, Math.sin(angle) * bul.speed, 0.15);
      }
    });
    bullets = bullets.filter(bul => bul.x > -20 && bul.x < W+20 && bul.y > -20 && bul.y < H+20);
  }

  function _attack(W, H) {
    if (phase === 1) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a)*3, vy: Math.sin(a)*3, size: 6, halo: '#ff8800', speed: 3 });
      }
    } else {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a)*4, vy: Math.sin(a)*4, size: 5, halo: '#ff4400', speed: 4 });
      }
      for (let i = 0; i < 2; i++) {
        const angle = Utils.angleTo(b.x, b.y, Player.x, Player.y) + (i===0?-0.2:0.2);
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(angle)*3, vy: Math.sin(angle)*3, size: 8, halo: '#ffcc00', speed: 3, homing: true });
      }
    }
  }

  function takeDamage(dmg) {
    if (!active) return;
    b.hp = Math.max(0, b.hp - dmg);
    b.shakeX = 8;
    b.hitFlash = 8; // bílý záblesk při zásahu
    Particles.spawn(b.x, b.y, '#ffffff', 6);
    if (b.hp <= 0 && !defeated) {
      defeated = true;
      active = false;
      Particles.spawn(b.x, b.y, '#ff3355', 80);
      Particles.spawn(b.x, b.y, '#ff8800', 60);
      Particles.spawn(b.x, b.y, '#ffcc00', 40);
    }
  }

  function checkWeaponHits(enemies) {
    // Boss acts as a single enemy-like target for weapon system
    if (!active || !entryDone) return;
    // We inject boss as enemy-like object; weapons.js handles collision
    // So we expose boss as a target list
  }

  function checkPlayerBulletHit() {
    if (!active || !entryDone || Player.invincible > 0) return false;
    for (const bul of bullets) {
      if (Utils.dist(Player.x, Player.y, bul.x, bul.y) < bul.size + Player.w * 0.5) return true;
    }
    return false;
  }

  function asBossTarget() {
    if (!active || !entryDone) return null;
    return { x: b.x, y: b.y, size: b.size, hp: b.hp, takeDmg: takeDamage };
  }

  function draw(ctx, frameCount) {
    if (!active) return;

    // ── Boss bullets — mini event horizons ──
    bullets.forEach(bul => {
      const halo = bul.halo || '#ff8800';
      // Halo glow
      const hg = ctx.createRadialGradient(bul.x, bul.y, 0, bul.x, bul.y, bul.size * 2.5);
      hg.addColorStop(0, halo + '66');
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size * 2.5, 0, Math.PI * 2); ctx.fill();
      // Dark core
      ctx.fillStyle = '#020002';
      ctx.shadowColor = halo; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(bul.x, bul.y, bul.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // ── Boss body ──
    ctx.save();
    ctx.translate(b.x + b.shakeX, b.y);
    b.shakeX *= 0.7;

    const pulse = 0.7 + 0.3 * Math.sin(frameCount * (phase === 2 ? 0.12 : 0.06));
    const ringColor = phase === 2 ? '#ff4400' : '#ff9922';
    const edgeColor = phase === 2 ? '#ff4400' : '#ff8800';

    // Phase 2: outer distortion corona
    if (phase === 2) {
      const corona = ctx.createRadialGradient(0, 0, b.size * 0.8, 0, 0, b.size * 1.6);
      corona.addColorStop(0, 'rgba(0,0,0,0)');
      corona.addColorStop(0.6, `rgba(255,60,0,${0.12 * pulse})`);
      corona.addColorStop(1,   `rgba(255,20,0,${0.3 * pulse})`);
      ctx.fillStyle = corona;
      ctx.beginPath(); ctx.arc(0, 0, b.size * 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // Hit flash overlay
    if (b.hitFlash > 0) {
      b.hitFlash--;
      const hfa = (b.hitFlash / 8) * 0.5;
      ctx.globalAlpha = hfa;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, b.size * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Body — solid black event horizon
    ctx.rotate(b.rot);
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
    bodyGrad.addColorStop(0, '#000000');
    bodyGrad.addColorStop(0.8, '#050205');
    bodyGrad.addColorStop(1, '#0a0308');
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = edgeColor;
    ctx.shadowBlur = 30 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, b.size, 0, Math.PI * 2); ctx.fill();

    // Hexagon structure inside core (subtle)
    ctx.strokeStyle = `rgba(255,80,0,${0.12 + 0.08 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = b.size * (0.65 + 0.15 * Math.sin(frameCount * 0.05 + i));
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Orbiting photon ring (accretion disk) ──
    ctx.rotate(-b.rot); // world-space
    ctx.save();
    ctx.rotate(b.orbitAngle);
    ctx.scale(1, 0.26);  // flatten to ellipse
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = phase === 2 ? 4 : 2.5;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = phase === 2 ? 28 : 16;
    ctx.globalAlpha = phase === 2 ? 0.9 : 0.72;
    ctx.beginPath();
    ctx.arc(0, 0, b.size * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  }

  return {
    spawn, clear, update, draw,
    checkPlayerBulletHit, asBossTarget, takeDamage,
    get active() { return active; },
    get defeated() { return defeated; },
    get hp() { return b.hp || 0; },
    get maxHp() { return b.maxHp || CFG_B.HP; },
    get phase() { return phase; },
  };
})();
