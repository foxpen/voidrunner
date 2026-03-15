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

  function spawn(W) {
    active = true;
    defeated = false;
    entryDone = false;
    phase = 1;
    attackTimer = 0;
    b = {
      x: W / 2,
      y: -CFG_B.SIZE,        // starts above screen
      targetY: 120,
      vx: 0, vy: 2,
      hp: CFG_B.HP,
      maxHp: CFG_B.HP,
      size: CFG_B.SIZE,
      rot: 0,
      rotSpeed: 0.01,
      color: CFG_B.COLOR_P1,
      shakeX: 0,
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

    // Entry animation
    if (!entryDone) {
      b.y += b.vy;
      if (b.y >= b.targetY) { b.y = b.targetY; b.vy = 0; entryDone = true; }
      return;
    }

    // Phase check
    if (b.hp <= CFG_B.PHASE2_HP && phase === 1) {
      phase = 2;
      b.color = CFG_B.COLOR_P2;
      b.rotSpeed = 0.025;
      Particles.spawn(b.x, b.y, '#ff8800', 60);
    }

    // Horizontal patrol
    b.vx += (Math.random() - 0.5) * 0.3 * (phase === 2 ? 2 : 1);
    b.vx *= 0.95;
    b.vx = Utils.clamp(b.vx, -CFG_B.SPEED * (phase===2?2:1), CFG_B.SPEED * (phase===2?2:1));
    b.x += b.vx * slowMult;
    b.x  = Utils.clamp(b.x, b.size + 20, W - b.size - 20);

    b.rot += b.rotSpeed * slowMult;

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
      // Spread burst
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a)*3, vy: Math.sin(a)*3, size: 6, color: '#ff3355', speed: 3 });
      }
    } else {
      // Phase 2: aimed + homing
      const count = 12;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a)*4, vy: Math.sin(a)*4, size: 5, color: '#ff8800', speed: 4 });
      }
      // 2 homing missiles
      for (let i = 0; i < 2; i++) {
        const angle = Utils.angleTo(b.x, b.y, Player.x, Player.y) + (i===0?-0.2:0.2);
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(angle)*3, vy: Math.sin(angle)*3, size: 8, color: '#ffcc00', speed: 3, homing: true });
      }
    }
  }

  function takeDamage(dmg) {
    if (!active) return;
    b.hp = Math.max(0, b.hp - dmg);
    b.shakeX = 6;
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

    // Boss bullets
    bullets.forEach(bul => {
      ctx.shadowColor = bul.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = bul.color;
      ctx.beginPath();
      ctx.arc(bul.x, bul.y, bul.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Boss body
    ctx.save();
    ctx.translate(b.x + b.shakeX, b.y);
    b.shakeX *= 0.7;

    const pulse = 0.7 + 0.3 * Math.sin(frameCount * (phase===2 ? 0.12 : 0.06));
    ctx.rotate(b.rot);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 40 * pulse;

    // Outer ring
    ctx.strokeStyle = b.color + 'aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.size + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Body — hexagon
    ctx.fillStyle = b.color + '22';
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = b.size * (0.8 + 0.2 * Math.sin(frameCount * 0.05 + i));
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
              : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner core
    ctx.rotate(-b.rot * 2);
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size * 0.4);
    coreGrad.addColorStop(0, b.color + 'ff');
    coreGrad.addColorStop(1, b.color + '00');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, b.size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // HP bar
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(b.x - b.size, b.y - b.size - 16, b.size * 2, 8);
    const hpPct = b.hp / b.maxHp;
    const hpColor = hpPct > 0.5 ? '#00ffc8' : hpPct > 0.25 ? '#ffcc00' : '#ff3355';
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(b.x - b.size, b.y - b.size - 16, b.size * 2 * hpPct, 8);
    ctx.shadowBlur = 0;

    // Phase label
    ctx.font = 'bold 11px Orbitron, monospace';
    ctx.fillStyle = b.color;
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS  FÁZE ${phase}`, b.x, b.y - b.size - 22);
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
