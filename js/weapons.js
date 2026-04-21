// ─── VOID RUNNER — WEAPONS ──────────────────────────────────────────────────

const Weapons = (() => {
  let equipped = [];
  let stats = {};
  let projectiles = [];
  let orbitBalls = [];
  let fireCooldowns = {};
  let orbitCount = 2;

  // ── ZÁSOBNÍK / RELOAD ──
  const MAG_SIZE        = 12;   // základní velikost zásobníku (neměnné)
  const RELOAD_FRAMES   = 300;  // 5s při 60fps
  let magCapacity = MAG_SIZE;   // efektivní kapacita (roste s mag_up upgradem)
  let magShots    = MAG_SIZE;   // zbývající výstřely
  let reloading   = false;
  let reloadTimer = 0;

  // ── Projectile behavior state (set via applyUpgrade) ──
  let pierceCount     = 0;     // extra enemies each shot pierces through
  let burnProcEnabled = false; // incendiary card: shots apply burn DoT
  let chainProcChance = 0;     // chain_module card: 0–1 chance to chain on hit
  let explodeProcRadius = 0;   // volatile card: AoE radius on hit (0 = disabled)

  function reset() {
    equipped = []; // zbraně jsou upgrade — hráč začíná bez střelby
    stats = {};
    projectiles = [];
    orbitBalls = [];
    fireCooldowns = {};
    orbitCount = 2;
    magCapacity = MAG_SIZE;
    magShots  = MAG_SIZE;
    reloading = false;
    reloadTimer = 0;
    pierceCount = 0;
    burnProcEnabled = false;
    chainProcChance = 0;
    explodeProcRadius = 0;
    _rebuildOrbits();
  }

  function unlockWeapon(id) {
    if (!equipped.includes(id)) {
      equipped.push(id);
      // Apply warhead hangar bonus on unlock
      const wb = (typeof Player !== 'undefined') ? Player.warheadBonus : 0;
      if (wb > 0) {
        stats[id] = stats[id] || {};
        stats[id].damage = (CFG.WEAPONS[id]?.damage || 1) + wb;
      }
    }
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
      case 'magSize':
        magCapacity += card.value;
        magShots = Math.min(magShots + card.value, magCapacity);
        break;
      case 'pierce':
        pierceCount += card.value;
        break;
      case 'burnProc':
        burnProcEnabled = true;
        break;
      case 'chainProc':
        chainProcChance = Math.min(chainProcChance + card.value, 1.0);
        break;
      case 'explodeProc':
        explodeProcRadius = Math.max(explodeProcRadius, card.value);
        break;
      case 'overdrive':
        // +30% damage všem zbraním
        for (const id of equipped) {
          stats[id] = stats[id] || {};
          stats[id].damage = ((stats[id].damage || CFG.WEAPONS[id]?.damage || 1) * 1.3) | 0;
        }
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
        magShots  = magCapacity;
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
          if (typeof Audio !== 'undefined') Audio.sfx('shieldDown'); // prázdný zásobník — mag dump
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
            Particles.spawnDebris(e.x, e.y, CFG.WEAPONS.orbit.color, 2);
            if (e.hp <= 0) {
              Particles.spawnExplosion(e.x, e.y, e.size || 20);
              if (typeof Audio !== 'undefined') Audio.sfx('explode');
            } else if (typeof Audio !== 'undefined') {
              Audio.sfx('hit');
            }
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

    // Ring expansion (with optional charge-up)
    projectiles.filter(p => p.ring).forEach(p => {
      if (p.followPlayer) { p.x = px; p.y = py; }
      if (p.chargeFrames > 0) {
        p.chargeFrames -= slowMult;
        // Pulse during charge — radius oscillates slightly
        p.chargePulse = (p.chargePulse || 0) + 0.25 * slowMult;
        if (p.chargeFrames <= 0) {
          p.followPlayer = false;
          p.expansionRate = 7.5;        // burst out fast
          if (typeof Audio !== 'undefined') Audio.sfx('emp');
        }
      } else {
        p.radius += (p.expansionRate || 5) * slowMult;
      }
    });

    // Projectile bounds
    projectiles = projectiles.filter(p =>
      p.x > -50 && p.x < W + 50 && p.y > -50 && p.y < H + 50 && !p.dead
    );

    // Projectile vs enemy collisions
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
      const proj = projectiles[pi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (proj.ring) {
          if (proj.chargeFrames > 0) continue; // no damage during charge-up
          // Ring: hit when projectile radius matches enemy distance (±8px)
          const d = Utils.dist(proj.x, proj.y, e.x, e.y);
          if (Math.abs(d - proj.radius) < 8 && !proj.hitSet?.has(ei)) {
            proj.hitSet = proj.hitSet || new Set();
            proj.hitSet.add(ei);
            _applyHit(proj, e, enemies);
          }
        } else {
          const hitDist = proj.size + e.size * 0.5;
          if (Utils.dist(proj.x, proj.y, e.x, e.y) < hitDist) {
            _applyHit(proj, e, enemies);
            // Pierce: projectile passes through if pierceLeft > 0
            if (proj.pierceLeft > 0) {
              proj.pierceLeft--;
              // Mark this enemy as hit so we don't double-hit on overlap
              proj._chained = true; // reuse flag to suppress chain recursion
            } else {
              proj.dead = true;
              break;
            }
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
        // SHOTGUN — 5 pellets in randomized cone, varied speed for stagger
        const target = _findNearest(px, py, enemies);
        const base   = target ? Utils.angleTo(px, py, target.x, target.y) : -Math.PI / 2;
        const PELLETS    = 5;
        const CONE_HALF  = 0.32;       // ~37° total cone
        for (let i = 0; i < PELLETS; i++) {
          // Spread pellets: 2 outer + 3 inner with jitter
          const t   = (i / (PELLETS - 1)) * 2 - 1; // -1 → +1
          const jitter = (Math.random() - 0.5) * 0.10;
          const a   = base + t * CONE_HALF + jitter;
          const sp  = speed * (0.85 + Math.random() * 0.30); // varied bullet speed
          _addProj(px, py, Math.cos(a)*sp, Math.sin(a)*sp, damage, size, wCfg.color, id);
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
        // Ring: short charge-up at player position, then explosive expand
        const proj = _addProj(px, py, 0, 0, damage, size, wCfg.color, id);
        proj.ring        = true;
        proj.radius      = 6;
        proj.chargeFrames = 22;       // ~0.37s wind-up
        proj.followPlayer = true;     // sticks to player during charge
        break;
      }
    }
  }

  function _addProj(x, y, vx, vy, damage, size, color, weaponId) {
    // Pierce count = card upgrades + synergy bonus (computed at fire time)
    const synPierce = (typeof Synergies !== 'undefined' && Synergies.has('pierce')) ? 1 : 0;
    const proj = {
      x, y, vx, vy, damage, size, color, weaponId, dead: false,
      pierceLeft:   pierceCount + synPierce,
      burnProc:     burnProcEnabled || (typeof Synergies !== 'undefined' && Synergies.has('burn')),
      chainProc:    chainProcChance + ((typeof Synergies !== 'undefined' && Synergies.has('chain')) ? 1.0 : 0),
      explodeProc:  explodeProcRadius > 0 ? explodeProcRadius
                  : (typeof Synergies !== 'undefined' && Synergies.has('aoe')) ? 50 : 0,
    };
    projectiles.push(proj);
    return proj;
  }

  // ── Hit application — crit + on-hit effects ───────────────────────────────
  // proj: projectile object, target: enemy hit, allEnemies: full enemy array
  function _applyHit(proj, target, allEnemies) {
    // ── Crit roll ──
    const critChance = (typeof Player !== 'undefined') ? Player.critChance : 0.05;
    const critMult   = (typeof Synergies !== 'undefined' && Synergies.has('supercrit')) ? 3 : 2;
    const isCrit     = Math.random() < critChance;
    const finalDmg   = isCrit ? Math.round(proj.damage * critMult) : proj.damage;

    if (target.takeDmg) target.takeDmg(finalDmg); else target.hp -= finalDmg;

    // ── Audio + FX feedback ──
    const isBoss = target.isBoss === true;
    if (isBoss) {
      // Boss hit handled in Boss.takeDamage — skip generic hit sfx
    } else if (isCrit) {
      if (typeof Audio !== 'undefined') Audio.sfx('crit');
      if (typeof Fx !== 'undefined') Fx.critFlash = Math.max(Fx.critFlash, 0.55);
    } else {
      if (typeof Audio !== 'undefined') Audio.sfx('hit');
    }

    // Crit visual — brighter burst
    if (isCrit) {
      Particles.spawn(target.x, target.y, '#ffcc00', 14);
      Particles.spawnDebris(target.x, target.y, '#ffcc00', 4);
    } else {
      Particles.spawn(target.x, target.y, proj.color, 8);
      Particles.spawnDebris(target.x, target.y, proj.color, 3);
    }
    if (Particles.spawnDamageNumber) {
      Particles.spawnDamageNumber(target.x, target.y, finalDmg, isCrit);
    }
    if (target.hp <= 0) {
      Particles.spawnExplosion(target.x, target.y, target.size || 20);
      if (!isBoss && typeof Audio !== 'undefined') Audio.sfx('explode');
    }

    // ── Burn DoT — mark enemy for burn ──
    if (proj.burnProc && target.hp > 0) {
      target.burnTimer = Math.max(target.burnTimer || 0, 90); // 1.5s at 60fps
      target.burnDps   = 0.3;
    }

    // ── AoE explosion ──
    if (proj.explodeProc > 0) {
      const aoeR = proj.explodeProc;
      Particles.spawnExplosion(target.x, target.y, aoeR * 0.7);
      for (const other of allEnemies) {
        if (other === target || other.hp <= 0) continue;
        if (Utils.dist(target.x, target.y, other.x, other.y) < aoeR) {
          const aoeDmg = Math.max(1, Math.round(finalDmg * 0.5));
          if (other.takeDmg) other.takeDmg(aoeDmg); else other.hp -= aoeDmg;
          Particles.spawn(other.x, other.y, '#ff8800', 6);
          if (other.hp <= 0) Particles.spawnExplosion(other.x, other.y, other.size || 20);
        }
      }
    }

    // ── Chain effect — bounce to 2 nearby enemies ──
    if (proj.chainProc > 0 && !proj._chained) {
      // thunderCrit: chain shots use 2× crit chance
      const effectiveChance = (typeof Synergies !== 'undefined' && Synergies.has('thunderCrit'))
        ? Math.min(proj.chainProc * 2, 1)
        : proj.chainProc;
      // Cap at 1.0 so synergy 'chain' (which sets chainProc=1) always fires
      if (Math.random() < Math.min(effectiveChance, 1.0)) {
        const nearby = allEnemies
          .filter(e => e !== target && e.hp > 0
                    && Utils.dist(target.x, target.y, e.x, e.y) < 200)
          .sort((a, b) => Utils.dist(target.x, target.y, a.x, a.y)
                        - Utils.dist(target.x, target.y, b.x, b.y))
          .slice(0, 2);
        nearby.forEach(chainTarget => {
          const chainDmg = Math.max(1, Math.round(finalDmg * 0.5));
          if (chainTarget.takeDmg) chainTarget.takeDmg(chainDmg);
          else chainTarget.hp -= chainDmg;
          Particles.spawn(chainTarget.x, chainTarget.y, '#44aaff', 8);
          // Visual arc between hit point and chain target
          const mx = (target.x + chainTarget.x) / 2;
          const my = (target.y + chainTarget.y) / 2;
          Particles.spawn(mx, my, '#44aaff', 4);
          if (chainTarget.hp <= 0) {
            Particles.spawnExplosion(chainTarget.x, chainTarget.y, chainTarget.size || 20);
          }
        });
      }
    }
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
        if (proj.chargeFrames > 0) {
          // Charge-up: pulsing inner ring + bright core glow
          const t  = 1 - proj.chargeFrames / 22;
          const r  = 8 + t * 14 + Math.sin((proj.chargePulse || 0)) * 3;
          const a  = 0.5 + 0.5 * Math.sin((proj.chargePulse || 0));
          ctx.shadowColor = proj.color;
          ctx.shadowBlur  = 22;
          // Core glow
          const cg = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, r * 2);
          cg.addColorStop(0,   proj.color + 'cc');
          cg.addColorStop(0.6, proj.color + '44');
          cg.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(proj.x, proj.y, r * 2, 0, Math.PI * 2); ctx.fill();
          // Charging ring
          ctx.strokeStyle = proj.color + Math.floor(a * 255).toString(16).padStart(2,'0');
          ctx.lineWidth   = 2 + t * 2;
          ctx.beginPath(); ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = proj.color + 'cc';
          ctx.lineWidth   = 4;
          ctx.shadowColor = proj.color;
          ctx.shadowBlur  = 16;
          ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2); ctx.stroke();
          // Inner trail ring
          ctx.strokeStyle = proj.color + '44';
          ctx.lineWidth   = 2;
          ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.radius - 6, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Elongated laser bolt
        const speed = Math.hypot(proj.vx, proj.vy) || 1;
        const nx    = proj.vx / speed, ny = proj.vy / speed;
        const boltLen = proj.size * 5 + speed * 1.8;

        // Glow trail
        const grad = ctx.createLinearGradient(
          proj.x - nx * boltLen, proj.y - ny * boltLen,
          proj.x + nx * proj.size, proj.y + ny * proj.size
        );
        grad.addColorStop(0,   'rgba(0,0,0,0)');
        grad.addColorStop(0.4, proj.color + '55');
        grad.addColorStop(1,   proj.color + 'ff');
        ctx.strokeStyle = grad;
        ctx.lineWidth   = proj.size * 1.8;
        ctx.lineCap     = 'round';
        ctx.shadowColor = proj.color;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.moveTo(proj.x - nx * boltLen, proj.y - ny * boltLen);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();

        // Bright core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = proj.size * 0.7;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.moveTo(proj.x - nx * boltLen * 0.4, proj.y - ny * boltLen * 0.4);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();

        ctx.shadowBlur = 0; ctx.lineCap = 'butt';
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
      // Label
      ctx.font      = '9px Orbitron, monospace';
      ctx.fillStyle = '#ffffff33';
      ctx.textAlign = 'center';
      ctx.fillText('ZÁSOBNÍK', W / 2, y - 6);
      // Bullet pips
      const pipW = Math.max(4, Math.floor(barW / magCapacity) - 2);
      for (let i = 0; i < magCapacity; i++) {
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
    get magShots()    { return magShots; },
    get magSize()     { return magCapacity; },
  };
})();
