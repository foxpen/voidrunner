// ─── VOID RUNNER — ENEMIES ──────────────────────────────────────────────────

const Enemies = (() => {
  let list = [];
  let pickups = [];
  let crystals = [];
  let recentKills = 0;
  let crystalsCollectedThisFrame = 0;

  function clear() { list = []; pickups = []; crystals = []; }

  function spawnObstacle(W, H, difficulty, slowActive) {
    const side = Math.random();
    let x, y, vx, vy;
    const slowMult = slowActive ? 0.35 : 1;

    // ── 3 typy asteroidů: modrý (malý), červený (střední), velký (tmavý) ──
    const roll = Math.random();
    let tier, size, hp, hue, spd;
    if (roll < 0.50) {
      tier = 1; size = 10 + Math.random() * 10; hp = 1;   hue = 195 + Math.random() * 30; // modrý
      spd = (2.0 + Math.random() * 2.5) * difficulty;
    } else if (roll < 0.82) {
      tier = 2; size = 20 + Math.random() * 12; hp = 2 + Math.floor(Math.random() * 2); hue = 0 + Math.random() * 20; // červený
      spd = (1.4 + Math.random() * 1.8) * difficulty;
    } else {
      tier = 3; size = 32 + Math.random() * 14; hp = 4 + Math.floor(Math.random() * 2); hue = 340 + Math.random() * 15; // tmavě červený
      spd = (0.9 + Math.random() * 1.2) * difficulty;
    }

    if (side < 0.6)      { x = Math.random() * W; y = -50; vx = (Math.random()-0.5)*spd; vy = spd; }
    else if (side < 0.8) { x = -50; y = Math.random()*H*0.7; vx = spd; vy = (Math.random()-0.3)*spd*0.5; }
    else                 { x = W+50; y = Math.random()*H*0.7; vx = -spd; vy = (Math.random()-0.3)*spd*0.5; }

    vx *= slowMult; vy *= slowMult;

    const nv = 5 + Math.floor(Math.random() * 4) + tier;
    const vertices = [];
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * Math.PI * 2;
      const r = size * (0.55 + Math.random() * 0.45);
      vertices.push({ x: Math.cos(a)*r, y: Math.sin(a)*r });
    }

    list.push({
      x, y, vx, vy,
      baseVx: vx / slowMult,
      baseVy: vy / slowMult,
      size, vertices, tier, hue,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      hp, maxHp: hp,
    });
  }

  function spawnPickupItem(W) {
    const typeKeys = Object.keys(CFG.POWERUPS);
    const type = Utils.randFrom(typeKeys);
    const def  = CFG.POWERUPS[type];
    pickups.push({
      type, x: 60 + Math.random() * (W - 120), y: -30,
      vy: 1.2 + Math.random() * 0.8,
      size: 16, bobPhase: Math.random() * Math.PI * 2,
      color: def.color, icon: def.icon,
    });
  }

  function triggerEMP(score) {
    let bonus = 0;
    list.forEach(o => {
      Particles.spawn(o.x, o.y, '#ff44ff', 8);
      bonus += 5;
    });
    list = [];
    Particles.spawnEmpWave(Player.x, Player.y, window.innerWidth, window.innerHeight);
    return bonus;
  }

  function _spawnCrystals(o) {
    const c = CFG.CRYSTALS;
    const chance = c.DROP_CHANCE[o.tier - 1] || 0;
    if (Math.random() > chance) return;
    const [mn, mx] = c.DROP_COUNT[o.tier - 1] || [0, 1];
    const count = mn + Math.floor(Math.random() * (mx - mn + 1));
    if (count <= 0) return;
    crystals.push({
      x: o.x + (Math.random() - 0.5) * 20,
      y: o.y + (Math.random() - 0.5) * 20,
      vy: 0.8 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 1.2,
      bobPhase: Math.random() * Math.PI * 2,
      value: count,
      size: 9 + count * 1.5,
    });
  }

  function update(W, H, activePU) {
    recentKills = 0;
    crystalsCollectedThisFrame = 0;
    const slowMult = activePU.slow > 0 ? 0.35 : 1;

    list.forEach(o => {
      // ── Enemy AI per tier ──
      if (o.tier === 2) {
        // Strafe: nudge vx toward player X
        const dx = Player.x - o.x;
        o.baseVx += Math.sign(dx) * 0.03;
        o.baseVx = Utils.clamp(o.baseVx, -Math.abs(o.baseVy) * 1.4, Math.abs(o.baseVy) * 1.4);
      } else if (o.tier === 3) {
        // Hunt: steer velocity toward player
        const dx = Player.x - o.x;
        const dy = Player.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          const spd = Math.hypot(o.baseVx, o.baseVy) || 1.2;
          const tx = (dx / dist) * spd;
          const ty = (dy / dist) * spd;
          o.baseVx += (tx - o.baseVx) * 0.025;
          o.baseVy += (ty - o.baseVy) * 0.025;
        }
      }

      o.vx = o.baseVx * slowMult;
      o.vy = o.baseVy * slowMult;
      o.x += o.vx;
      o.y += o.vy;
      o.rot += o.rotSpeed * slowMult;
    });
    list = list.filter(o => o.x > -100 && o.x < W+100 && o.y > -100 && o.y < H+100);

    // Pickups
    const hasMagnet = activePU.magnet > 0 || Player.permMagnet;
    const magnetRange = 300;
    pickups.forEach(p => {
      p.y += p.vy * slowMult;
      p.bobPhase += 0.05;
      if (hasMagnet) {
        const dx = Player.x - p.x;
        const dy = Player.y - p.y;
        const dist = Utils.dist(Player.x, Player.y, p.x, p.y);
        if (dist < magnetRange) {
          const force = 4 * (1 - dist / magnetRange);
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      }
    });
    pickups = pickups.filter(p => p.y < H + 60);

    // Crystals movement + magnet pull
    crystals.forEach(c => {
      c.x += c.vx * slowMult;
      c.y += c.vy * slowMult;
      c.bobPhase += 0.06;
      if (hasMagnet) {
        const dx = Player.x - c.x;
        const dy = Player.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetRange && dist > 1) {
          const force = 5 * (1 - dist / magnetRange);
          c.x += (dx / dist) * force;
          c.y += (dy / dist) * force;
        }
      }
    });
    crystals = crystals.filter(c => c.y < H + 60);

    // Remove dead enemies — spawn crystals, track kill count
    const dying = list.filter(o => o.hp <= 0);
    dying.forEach(o => {
      _spawnCrystals(o);
      Particles.spawn(o.x, o.y, o.tier === 3 ? '#ff8800' : '#ff3355', 8 + o.tier * 4);
    });
    const beforeKill = list.length;
    list = list.filter(o => o.hp > 0);
    recentKills = beforeKill - list.length;
  }

  function checkPlayerCollision(activePU) {
    if (Player.invincible > 0) return false;
    for (const o of list) {
      const hitRadius = activePU.shield > 0
        ? o.size * 0.4 + Player.w * 0.3
        : o.size * 0.6 + Player.w * 0.5;
      if (Utils.dist(Player.x, Player.y, o.x, o.y) < hitRadius) return true;
    }
    return false;
  }

  function checkPickupCollision() {
    const collected = [];
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Utils.dist(Player.x, Player.y, p.x, p.y) < p.size + Player.w) {
        collected.push(p);
        Particles.spawn(p.x, p.y, p.color, 15);
        pickups.splice(i, 1);
      }
    }
    return collected;
  }

  function checkCrystalCollision() {
    let total = 0;
    for (let i = crystals.length - 1; i >= 0; i--) {
      const c = crystals[i];
      if (Utils.dist(Player.x, Player.y, c.x, c.y) < c.size + Player.w) {
        total += c.value;
        Particles.spawn(c.x, c.y, '#aa44ff', 10);
        crystals.splice(i, 1);
      }
    }
    return total;
  }

  function spawnBossCrystals(x, y) {
    // Scatter a cluster of crystals when boss dies
    const count = CFG.CRYSTALS.BOSS_REWARD;
    const clumps = 8;
    for (let i = 0; i < clumps; i++) {
      const angle = (i / clumps) * Math.PI * 2;
      crystals.push({
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 1.5 + 1,
        bobPhase: Math.random() * Math.PI * 2,
        value: Math.round(count / clumps),
        size: 14,
      });
    }
  }

  // ── Draw enemy ship (tier 2 = fighter, tier 3 = heavy) ──────────────────────
  function _drawEnemyShip(ctx, o, frame) {
    ctx.save();
    ctx.translate(o.x, o.y);
    // Ships always point downward (toward player)
    const angle = Math.atan2(o.vy, o.vx) + Math.PI / 2;
    ctx.rotate(angle);

    const sc  = '#ff2233';   // danger red
    const dim = '#cc1122';
    const s   = o.tier === 3 ? 1.35 : 1.0;
    const pw  = 14 * s, ph = 18 * s;

    // Engine glow
    const fl = (6 + Math.random() * 10) * s;
    const eg = ctx.createLinearGradient(0, ph * 0.55, 0, ph * 0.55 + fl);
    eg.addColorStop(0, 'rgba(255,40,0,0.9)');
    eg.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = eg;
    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(-5 * s, ph * 0.55); ctx.lineTo(0, ph * 0.55 + fl); ctx.lineTo(5 * s, ph * 0.55);
    ctx.closePath(); ctx.fill();
    // Side engines
    [-pw * 0.5, pw * 0.5].forEach(ex => {
      const fl2 = (3 + Math.random() * 6) * s;
      const eg2 = ctx.createLinearGradient(ex, ph * 0.4, ex, ph * 0.4 + fl2);
      eg2.addColorStop(0, 'rgba(255,60,0,0.7)'); eg2.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = eg2;
      ctx.beginPath();
      ctx.moveTo(ex - 3 * s, ph * 0.4); ctx.lineTo(ex, ph * 0.4 + fl2); ctx.lineTo(ex + 3 * s, ph * 0.4);
      ctx.closePath(); ctx.fill();
    });

    ctx.shadowBlur = 0;

    // Outer wing panels
    ctx.fillStyle = '#1a0808';
    ctx.strokeStyle = sc + '66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-pw * 0.55,  ph * 0.08);
    ctx.lineTo(-pw * 1.3,   ph * 0.40);
    ctx.lineTo(-pw * 1.05,  ph * 0.58);
    ctx.lineTo(-pw * 0.52,  ph * 0.48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( pw * 0.55,  ph * 0.08);
    ctx.lineTo( pw * 1.3,   ph * 0.40);
    ctx.lineTo( pw * 1.05,  ph * 0.58);
    ctx.lineTo( pw * 0.52,  ph * 0.48);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Main hull
    ctx.fillStyle = '#200808';
    ctx.strokeStyle = sc;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = sc; ctx.shadowBlur = o.tier === 3 ? 20 : 14;
    ctx.beginPath();
    ctx.moveTo(0,           -ph);
    ctx.lineTo(-pw * 0.28, -ph * 0.38);
    ctx.lineTo(-pw * 0.55,  ph * 0.08);
    ctx.lineTo(-pw * 0.68,  ph * 0.46);
    ctx.lineTo(-pw * 0.38,  ph * 0.56);
    ctx.lineTo(-pw * 0.15,  ph * 0.46);
    ctx.lineTo(0,            ph * 0.56);
    ctx.lineTo( pw * 0.15,  ph * 0.46);
    ctx.lineTo( pw * 0.38,  ph * 0.56);
    ctx.lineTo( pw * 0.68,  ph * 0.46);
    ctx.lineTo( pw * 0.55,  ph * 0.08);
    ctx.lineTo( pw * 0.28, -ph * 0.38);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Red fuselage stripe
    ctx.fillStyle = sc + '44'; ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0,           -ph * 0.72);
    ctx.lineTo(-pw * 0.18,  ph * 0.05);
    ctx.lineTo(0,            ph * 0.42);
    ctx.lineTo( pw * 0.18,  ph * 0.05);
    ctx.closePath(); ctx.fill();

    // Cockpit — dark with red glow
    ctx.fillStyle = '#100004';
    ctx.strokeStyle = sc + 'bb'; ctx.lineWidth = 1;
    ctx.shadowColor = sc; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0,           -ph * 0.70);
    ctx.lineTo(-pw * 0.18, -ph * 0.15);
    ctx.lineTo(0,            ph * 0.05);
    ctx.lineTo( pw * 0.18, -ph * 0.15);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Red cockpit dot
    ctx.fillStyle = sc; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, -ph * 0.28, 2.5 * s, 0, Math.PI * 2); ctx.fill();

    // Damage cracks
    if (o.hp < o.maxHp) {
      const dmg = 1 - o.hp / o.maxHp;
      ctx.strokeStyle = `rgba(255,100,0,${dmg * 0.7})`;
      ctx.lineWidth = 1; ctx.shadowBlur = 6 * dmg;
      ctx.beginPath();
      ctx.moveTo(-pw * 0.2, -ph * 0.1); ctx.lineTo(pw * 0.1, ph * 0.2); ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Draw a filled asteroid with depth shading ──────────────────────────────
  function _drawAsteroid(ctx, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);

    // Filled body — dark grey base
    ctx.beginPath();
    ctx.moveTo(o.vertices[0].x, o.vertices[0].y);
    for (let i = 1; i < o.vertices.length; i++) ctx.lineTo(o.vertices[i].x, o.vertices[i].y);
    ctx.closePath();

    // Radial gradient — lit from top-left (matches BH light source)
    const grd = ctx.createRadialGradient(-o.size * 0.3, -o.size * 0.3, o.size * 0.05, 0, 0, o.size * 1.1);
    if (o.tier === 1) {
      // Small — cool blue-grey
      grd.addColorStop(0,   '#6a7a8a');
      grd.addColorStop(0.5, '#3a4550');
      grd.addColorStop(1,   '#1a2028');
    } else if (o.tier === 2) {
      // Mid — warm grey with slight red tint
      grd.addColorStop(0,   '#7a6060');
      grd.addColorStop(0.5, '#3d2e2e');
      grd.addColorStop(1,   '#1a1010');
    } else {
      // Large — dark with orange warmth from BH
      grd.addColorStop(0,   '#6a5040');
      grd.addColorStop(0.5, '#2e1e14');
      grd.addColorStop(1,   '#0e0808');
    }
    ctx.fillStyle = grd;
    ctx.fill();

    // Edge rim — thin highlight
    const rimAlpha = o.tier === 1 ? 0.55 : o.tier === 2 ? 0.45 : 0.35;
    ctx.strokeStyle = o.tier === 1 ? `rgba(120,150,180,${rimAlpha})`
                    : o.tier === 2 ? `rgba(160,100,80,${rimAlpha})`
                    :                `rgba(180,110,60,${rimAlpha})`;
    ctx.lineWidth = o.tier === 3 ? 1.5 : 1;
    ctx.stroke();

    // Subtle surface crack lines for large asteroids
    if (o.tier === 3 && o.vertices.length > 6) {
      ctx.strokeStyle = 'rgba(255,180,80,0.08)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        const v1 = o.vertices[i * 2 % o.vertices.length];
        const v2 = o.vertices[(i * 2 + 3) % o.vertices.length];
        ctx.beginPath();
        ctx.moveTo(v1.x * 0.5, v1.y * 0.5);
        ctx.lineTo(v2.x * 0.5, v2.y * 0.5);
        ctx.stroke();
      }
    }

    // BH orange ambient glow on large asteroids
    if (o.tier >= 2) {
      const glowAlpha = o.tier === 3 ? 0.22 : 0.12;
      ctx.shadowColor = o.tier === 3 ? '#ff8820' : '#ff4422';
      ctx.shadowBlur  = o.tier === 3 ? 18 : 10;
      ctx.strokeStyle = 'transparent';
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // HP damage cracks — red when low HP
    if (o.hp < o.maxHp) {
      const dmgFrac = 1 - o.hp / o.maxHp;
      ctx.strokeStyle = `rgba(255,60,20,${dmgFrac * 0.6})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur  = 8 * dmgFrac;
      ctx.beginPath();
      ctx.moveTo(o.vertices[0].x * 0.6, o.vertices[0].y * 0.6);
      ctx.lineTo(o.vertices[2 % o.vertices.length].x * 0.6, o.vertices[2 % o.vertices.length].y * 0.6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function draw(ctx) {
    list.forEach(o => {
      if (o.tier === 1) _drawAsteroid(ctx, o);
      else              _drawEnemyShip(ctx, o);
    });
    crystals.forEach(c => _drawCrystal(ctx, c));

    // Pickups — teal diamond/hexagon gem
    pickups.forEach(p => {
      const bob   = Math.sin(p.bobPhase) * 5;
      const pulse = 0.6 + 0.4 * Math.sin(p.bobPhase * 2);
      ctx.save();
      ctx.translate(p.x, p.y + bob);

      // Outer aura
      const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.8);
      aura.addColorStop(0,   p.color + '44');
      aura.addColorStop(0.5, p.color + '18');
      aura.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, p.size * 2.8, 0, Math.PI * 2); ctx.fill();

      // Hexagon body
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 18 * pulse;
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = 1.5;
      ctx.fillStyle   = p.color + '30';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        i === 0 ? ctx.moveTo(Math.cos(a) * p.size, Math.sin(a) * p.size)
                : ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Inner bright diamond
      ctx.shadowBlur = 10;
      ctx.fillStyle  = p.color + 'cc';
      ctx.beginPath();
      ctx.moveTo(0,           -p.size * 0.55);
      ctx.lineTo( p.size * 0.4, 0);
      ctx.lineTo(0,            p.size * 0.55);
      ctx.lineTo(-p.size * 0.4, 0);
      ctx.closePath(); ctx.fill();

      // Icon
      ctx.shadowBlur = 0;
      ctx.font = `${p.size * 0.95}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.9;
      ctx.fillText(p.icon, 0, 1);
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  }

  function _drawCrystal(ctx, c) {
    const bob = Math.sin(c.bobPhase) * 4;
    const pulse = 0.6 + 0.4 * Math.sin(c.bobPhase * 1.5);
    ctx.save();
    ctx.translate(c.x, c.y + bob);

    // Outer aura
    ctx.fillStyle = `rgba(160,60,255,${0.12 * pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, c.size * 2.2, 0, Math.PI * 2); ctx.fill();

    // Crystal body — rotated square (diamond)
    ctx.shadowColor = '#aa44ff';
    ctx.shadowBlur  = 14 * pulse;
    ctx.strokeStyle = '#cc77ff';
    ctx.lineWidth   = 1.5;
    ctx.fillStyle   = 'rgba(140,40,240,0.35)';
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.rect(-c.size * 0.6, -c.size * 0.6, c.size * 1.2, c.size * 1.2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Inner bright core
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = `rgba(200,120,255,${0.80 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, c.size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Value label if > 1
    if (c.value > 1) {
      ctx.shadowBlur  = 0;
      ctx.font        = `bold ${Math.max(8, c.size * 0.65)}px Orbitron, monospace`;
      ctx.fillStyle   = 'rgba(255,255,255,0.90)';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.value, 0, 0);
    }

    ctx.restore();
  }

  function nearest(px, py, maxDist) {
    let best = null, bestD = maxDist || Infinity;
    list.forEach(o => {
      const d = Math.hypot(o.x - px, o.y - py);
      if (d < bestD) { bestD = d; best = o; }
    });
    return best;
  }

  return {
    get list()        { return list; },
    get recentKills() { return recentKills; },
    clear, spawnObstacle, spawnPickupItem, triggerEMP,
    update, checkPlayerCollision, checkPickupCollision, checkCrystalCollision,
    spawnBossCrystals, draw, nearest,
  };
})();
