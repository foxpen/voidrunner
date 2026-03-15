// ─── VOID RUNNER — WEAPONS ──────────────────────────────────────────────────

const Weapons = (() => {
  let equipped = [];       // pole aktivních weapon ID
  let stats = {};          // per-weapon override stats
  let projectiles = [];
  let orbitBalls = [];
  let fireCooldowns = {};
  let orbitCount = 2;

  function reset() {
    equipped = ['basic'];
    stats = {};
    projectiles = [];
    orbitBalls = [];
    fireCooldowns = {};
    orbitCount = 2;
    _rebuildOrbits();
  }

  function unlockWeapon(id) {
    if (!equipped.includes(id)) equipped.push(id);
  }

  function applyUpgrade(card) {
    if (card.type === 'weapon') {
      unlockWeapon(card.weaponId);
      return;
    }
    switch (card.stat) {
      case 'damage':
        for (const id of equipped) {
          stats[id] = stats[id] || {};
          stats[id].damage = (stats[id].damage || CFG.WEAPONS[id]?.damage || 1) + card.value;
        }
        break;
      case 'fireRate':
        for (const id of equipped) {
          stats[id] = stats[id] || {};
          const base = CFG.WEAPONS[id]?.fireRate || 15;
          stats[id].fireRate = Math.max(4, Math.round(base * (1 + card.value)));
        }
        break;
      case 'orbitCount':
        orbitCount += card.value;
        _rebuildOrbits();
        break;
      case 'dualFire':
        stats['basic'] = stats['basic'] || {};
        stats['basic'].dual = true;
        break;
    }
  }

  function _getStat(id, key) {
    return (stats[id] && stats[id][key] !== undefined)
      ? stats[id][key]
      : CFG.WEAPONS[id][key];
  }

  function _rebuildOrbits() {
    orbitBalls = [];
    if (!equipped.includes('orbit')) return;
    for (let i = 0; i < orbitCount; i++) {
      orbitBalls.push({
        angle: (i / orbitCount) * Math.PI * 2,
        radius: 50,
        speed: 0.04,
        size: _getStat('orbit', 'size'),
        color: CFG.WEAPONS.orbit.color,
        damage: _getStat('orbit', 'damage'),
      });
    }
  }

  function update(px, py, enemies, W, H, frameCount, slowActive) {
    const slowMult = slowActive ? 0.5 : 1;

    // Fire all equipped weapons
    for (const id of equipped) {
      const wCfg = CFG.WEAPONS[id];
      if (wCfg.pattern === 'orbit') continue; // handled separately

      fireCooldowns[id] = (fireCooldowns[id] || 0);
      if (fireCooldowns[id] > 0) { fireCooldowns[id]--; continue; }

      const fireRate = _getStat(id, 'fireRate');
      fireCooldowns[id] = fireRate;

      _fireWeapon(id, px, py, enemies, W, H);
    }

    // Orbit balls
    if (equipped.includes('orbit')) {
      if (orbitBalls.length !== orbitCount) _rebuildOrbits();
      orbitBalls.forEach(b => {
        b.angle += b.speed * slowMult;
        b.x = px + Math.cos(b.angle) * b.radius;
        b.y = py + Math.sin(b.angle) * b.radius;
      });

      // Orbit collision with enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        for (const b of orbitBalls) {
          if (Utils.dist(b.x, b.y, e.x, e.y) < b.size + e.size * 0.5) {
            e.hp -= b.damage;
            Particles.spawn(e.x, e.y, CFG.WEAPONS.orbit.color, 6);
          }
        }
      }
    }

    // Move projectiles
    projectiles.forEach(proj => {
      if (proj.homing) {
        const target = _findNearest(proj.x, proj.y, enemies);
        if (target) {
          const angle = Utils.angleTo(proj.x, proj.y, target.x, target.y);
          proj.vx = Utils.moveToward(proj.vx, Math.cos(angle) * proj.speed, 0.4);
          proj.vy = Utils.moveToward(proj.vy, Math.sin(angle) * proj.speed, 0.4);
        }
      }
      proj.x += proj.vx * slowMult;
      proj.y += proj.vy * slowMult;
    });

    // Ring expansion
    projectiles.filter(p => p.ring).forEach(p => { p.radius += 5 * slowMult; });

    // Projectile bounds
    projectiles = projectiles.filter(p =>
      p.x > -50 && p.x < W + 50 && p.y > -50 && p.y < H + 50 && !p.dead
    );

    // Projectile vs enemy collisions
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
      const proj = projectiles[pi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        const hitDist = proj.ring ? proj.radius : proj.size + e.size * 0.5;
        if (proj.ring) {
          // Ring hits once at expansion boundary
          const d = Utils.dist(proj.x, proj.y, e.x, e.y);
          if (Math.abs(d - proj.radius) < 8 && !proj.hitSet?.has(ei)) {
            proj.hitSet = proj.hitSet || new Set();
            proj.hitSet.add(ei);
            e.hp -= proj.damage;
            Particles.spawn(e.x, e.y, proj.color, 8);
          }
        } else {
          if (Utils.dist(proj.x, proj.y, e.x, e.y) < hitDist) {
            e.hp -= proj.damage;
            Particles.spawn(e.x, e.y, proj.color, 8);
            if (!proj.piercing) { proj.dead = true; break; }
          }
        }
      }
    }

    // Remove dead ring projectiles when too large
    projectiles = projectiles.filter(p => !p.ring || p.radius < Math.max(W, H));
  }

  function _fireWeapon(id, px, py, enemies, W, H) {
    const wCfg = CFG.WEAPONS[id];
    const damage  = _getStat(id, 'damage');
    const speed   = _getStat(id, 'speed');
    const size    = _getStat(id, 'size');
    const isDual  = stats[id]?.dual;

    switch (wCfg.pattern) {
      case 'single': {
        // Shoot toward nearest enemy or straight up
        const target = _findNearest(px, py, enemies);
        const angle  = target ? Utils.angleTo(px, py, target.x, target.y) : -Math.PI / 2;
        _addProj(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, damage, size, wCfg.color, id);
        if (isDual) {
          _addProj(px-10, py, Math.cos(angle)*speed, Math.sin(angle)*speed, damage, size, wCfg.color, id);
        }
        break;
      }
      case 'spread': {
        const target = _findNearest(px, py, enemies);
        const base   = target ? Utils.angleTo(px, py, target.x, target.y) : -Math.PI / 2;
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.3;
          _addProj(px, py, Math.cos(a)*speed, Math.sin(a)*speed, damage, size, wCfg.color, id);
        }
        break;
      }
      case 'homing': {
        const target = _findNearest(px, py, enemies);
        if (!target) return;
        const angle = Utils.angleTo(px, py, target.x, target.y);
        const proj = _addProj(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, damage, size, wCfg.color, id);
        proj.homing = true;
        break;
      }
      case 'ring': {
        const proj = _addProj(px, py, 0, 0, damage, size, wCfg.color, id);
        proj.ring = true;
        proj.radius = 10;
        break;
      }
    }
  }

  function _addProj(x, y, vx, vy, damage, size, color, weaponId) {
    const proj = { x, y, vx, vy, damage, size, color, weaponId, dead: false };
    projectiles.push(proj);
    return proj;
  }

  function _findNearest(x, y, enemies) {
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      const d = Utils.dist(x, y, e.x, e.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  function draw(ctx) {
    // Orbit balls
    orbitBalls.forEach(b => {
      if (b.x === undefined) return;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Projectiles
    projectiles.forEach(proj => {
      if (proj.ring) {
        ctx.strokeStyle = proj.color + 'aa';
        ctx.lineWidth = 3;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(proj.x - proj.vx * 2, proj.y - proj.vy * 2, proj.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    });
  }

  function clearProjectiles() { projectiles = []; }

  return {
    reset, unlockWeapon, applyUpgrade, update, draw, clearProjectiles,
    get equipped() { return equipped; },
    get orbitBalls() { return orbitBalls; },
  };
})();
