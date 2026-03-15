// ─── VOID RUNNER — WEAPONS ──────────────────────────────────────────────────

const Weapons = (() => {
  let equipped = [];
  let stats = {};
  let projectiles = [];
  let orbitBalls = [];
  let fireCooldowns = {};
  let orbitCount = 2;

  // ── ZÁSOBNÍK / RELOAD ──
  const MAG_SIZE        = 12;   // výstřelů než se musí nabít
  const RELOAD_FRAMES   = 300;  // 5s při 60fps
  let magShots    = MAG_SIZE;   // zbývající výstřely
  let reloading   = false;
  let reloadTimer = 0;

  function reset() {
    equipped = []; // zbraně jsou upgrade — hráč začíná bez střelby
    stats = {};
    projectiles = [];
    orbitBalls = [];
    fireCooldowns = {};
    orbitCount = 2;
    magShots  = MAG_SIZE;
    reloading = false;
    reloadTimer = 0;
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

    // ── Reload tick ──
    if (reloading) {
      reloadTimer--;
      if (reloadTimer <= 0) {
        reloading = false;
        magShots  = MAG_SIZE;
        if (typeof Audio !== 'undefined') Audio.sfx('pickup'); // reload done sound
      }
    }

    // Fire all equipped weapons
    for (const id of equipped) {
      const wCfg = CFG.WEAPONS[id];
      if (wCfg.pattern === 'orbit') continue;
      if (reloading) continue; // nelze střílet při nabíjení

      fireCooldowns[id] = (fireCooldowns[id] || 0);
      if (fireCooldowns[id] > 0) { fireCooldowns[id]--; continue; }

      const fireRate = _getStat(id, 'fireRate');
      fireCooldowns[id] = fireRate;

      _fireWeapon(id, px, py, enemies, W, H);

      // Odečti náboj (jen pro 'basic' jako hlavní zbraň)
      if (id === 'basic') {
        magShots--;
        if (magShots <= 0) {
          reloading   = true;
          reloadTimer = RELOAD_FRAMES;
          if (typeof Audio !== 'undefined') Audio.sfx('hit'); // prázdný zásobník click
        }
      }
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
            if (e.takeDmg) e.takeDmg(b.damage); else e.hp -= b.damage;
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
          const d = Utils.dist(proj.x, proj.y, e.x, e.y);
          if (Math.abs(d - proj.radius) < 8 && !proj.hitSet?.has(ei)) {
            proj.hitSet = proj.hitSet || new Set();
            proj.hitSet.add(ei);
            if (e.takeDmg) e.takeDmg(proj.damage); else e.hp -= proj.damage;
            Particles.spawn(e.x, e.y, proj.color, 8);
          }
        } else {
          if (Utils.dist(proj.x, proj.y, e.x, e.y) < hitDist) {
            if (e.takeDmg) e.takeDmg(proj.damage); else e.hp -= proj.damage;
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
    if (typeof Audio !== 'undefined') Audio.sfx('shoot');
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

  function drawMagHUD(ctx, W, H, frameCount) {
    if (equipped.length === 0) return; // žádné zbraně, žádný HUD
    const barW  = 120;
    const barH  = 6;
    const x     = W / 2 - barW / 2;
    const y     = H - 72;

    if (reloading) {
      // Reload progress bar
      const pct = 1 - reloadTimer / RELOAD_FRAMES;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = '#ff6600';
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8;
      ctx.fillRect(x, y, barW * pct, barH);
      ctx.shadowBlur = 0;

      // NABÍJÍ text — bliká
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(frameCount * 0.15);
      ctx.font = 'bold 11px Orbitron, monospace';
      ctx.fillStyle = '#ff6600';
      ctx.textAlign = 'center';
      ctx.fillText('NABÍJÍ...', W / 2, y - 6);
      ctx.globalAlpha = 1;
    } else {
      // Bullet pips
      const pipW = Math.floor(barW / MAG_SIZE) - 2;
      for (let i = 0; i < MAG_SIZE; i++) {
        const px = x + i * (pipW + 2);
        ctx.fillStyle = i < magShots ? '#00ffc8' : '#1a1a2e';
        ctx.shadowColor = i < magShots ? '#00ffc8' : 'transparent';
        ctx.shadowBlur  = i < magShots ? 4 : 0;
        ctx.fillRect(px, y, pipW, barH);
      }
      ctx.shadowBlur = 0;
    }
  }

  function clearProjectiles() { projectiles = []; }

  return {
    reset, unlockWeapon, applyUpgrade, update, draw, drawMagHUD, clearProjectiles,
    get equipped()   { return equipped; },
    get orbitBalls() { return orbitBalls; },
    get reloading()  { return reloading; },
    get magShots()   { return magShots; },
    get magSize()    { return MAG_SIZE; },
  };
})();
