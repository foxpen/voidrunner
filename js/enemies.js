// ─── VOID RUNNER — ENEMIES ──────────────────────────────────────────────────

const Enemies = (() => {
  let list = [];
  let pickups = [];
  let crystals = [];
  let enemyBullets = [];   // projectiles fired by 'shooter' role enemies
  let deathExplosions = []; // frame-1 bomber explosions checked for player collision
  let recentKills = 0;
  let recentKillValue = 0;   // score hodnota killů tohoto framu (podle tieru a role)
  let crystalsCollectedThisFrame = 0;

  // Score za kill podle tieru; tank/bomber jsou nebezpečnější → ×1.5
  const KILL_VALUE = [0, 25, 60, 120];
  // Loot objekty (neútočí, jen odměna za sestřelení)
  const LOOT_ROLES = { crystalRock: 50, cargo: 40, fuel: 30 };
  function _isLoot(o) { return LOOT_ROLES[o.role] !== undefined; }
  function _killValue(o) {
    if (_isLoot(o)) return LOOT_ROLES[o.role];
    const base = KILL_VALUE[o.tier] || 25;
    const roleMult = (o.role === 'tank' || o.role === 'bomber') ? 1.5 : 1;
    return Math.round(base * roleMult);
  }

  function clear() { list = []; pickups = []; crystals = []; enemyBullets = []; deathExplosions = []; }

  // ── Role picker: which combat role a tier-2/3 enemy gets ─────────────────
  function _pickRole(tier, round) {
    if (tier === 1) return 'asteroid';
    const r = Math.random();
    if (round <= 3) return 'chaser'; // kola 1–3: jen chasers
    if (round <= 6) {                // kola 4–6
      if (r < 0.42) return 'chaser';
      if (r < 0.65) return 'shooter';
      if (r < 0.80) return 'tank';
      return 'bomber';
    }
    if (round <= 7) {                // kolo 7
      if (r < 0.28) return 'chaser';
      if (r < 0.52) return 'shooter';
      if (r < 0.72) return 'tank';
      return 'bomber';
    }
    // Kola 8+: přibývá splitter
    if (r < 0.22) return 'chaser';
    if (r < 0.42) return 'shooter';
    if (r < 0.58) return 'tank';
    if (r < 0.78) return 'bomber';
    return 'splitter';
  }

  function spawnObstacle(W, H, difficulty, slowActive) {
    const side = Math.random();
    let x, y, vx, vy;
    const slowMult = slowActive ? 0.35 : 1;
    const round = (typeof Rounds !== 'undefined') ? Rounds.current : 1;

    // ── 3 typy: malý asteroid, střední, velký ──
    const roll = Math.random();
    let tier, size, hp, hue, spd;
    if (roll < 0.50) {
      tier = 1; size = 10 + Math.random() * 10; hp = 1;   hue = 195 + Math.random() * 30;
      spd = (2.0 + Math.random() * 2.5) * difficulty;
    } else if (roll < 0.82) {
      tier = 2; size = 20 + Math.random() * 12; hp = 2 + Math.floor(Math.random() * 2); hue = 0 + Math.random() * 20;
      spd = (1.4 + Math.random() * 1.8) * difficulty;
    } else {
      tier = 3; size = 32 + Math.random() * 14; hp = 4 + Math.floor(Math.random() * 2); hue = 340 + Math.random() * 15;
      spd = (0.9 + Math.random() * 1.2) * difficulty;
    }

    // ── Assign role for tier 2/3 ──
    const role = _pickRole(tier, round);

    // Role stat modifiers
    if (role === 'tank') {
      hp   = Math.round(hp * 3);
      size = Math.round(size * 1.30);
      spd *= 0.55;
      hue  = 120 + Math.random() * 20; // zelená
    } else if (role === 'bomber') {
      hp  += 1;
      size = Math.round(size * 1.10);
      hue  = 25 + Math.random() * 15;  // oranžová
    } else if (role === 'splitter') {
      hp   = Math.round(hp * 1.5);
      size = Math.round(size * 1.15);
      spd *= 0.85;
      hue  = 280 + Math.random() * 20; // fialová
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

    const baseVx0 = vx / slowMult;
    const baseVy0 = vy / slowMult;
    list.push({
      x, y, vx, vy,
      baseVx: baseVx0,
      baseVy: baseVy0,
      initSpd: Math.hypot(baseVx0, baseVy0) || spd,
      size, vertices, tier, hue, role,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      hp, maxHp: hp,
      burnTimer: 0, burnDps: 0,       // burn DoT (set by weapons on hit)
      shootCooldown: 40 + Math.floor(Math.random() * 40), // staggered initial fire
      aimingTimer: 0,                 // shooter telegraph window
      aimX: 0, aimY: 0,
      regenLockout: 0, regenAccum: 0, // tank: lockout after hit, then heal
      _lastHp: hp,                    // hit detection for tank regen
    });
  }

  // Spawn a small fragment (used by bomber/splitter death)
  function _spawnFragment(x, y, ang, sizeOverride, hueOverride) {
    const sz  = sizeOverride || (8 + Math.random() * 6);
    const spd = 1.6 + Math.random() * 1.4;
    const nv  = 5 + Math.floor(Math.random() * 3);
    const verts = [];
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * Math.PI * 2;
      const r = sz * (0.55 + Math.random() * 0.45);
      verts.push({ x: Math.cos(a)*r, y: Math.sin(a)*r });
    }
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd + 0.6; // gentle downward bias
    list.push({
      x, y, vx, vy,
      baseVx: vx, baseVy: vy,
      initSpd: spd,
      size: sz, vertices: verts,
      tier: 1, hue: hueOverride ?? (210 + Math.random() * 40),
      role: 'asteroid',
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      hp: 1, maxHp: 1,
      burnTimer: 0, burnDps: 0,
      shootCooldown: 0, aimingTimer: 0,
      regenLockout: 0, regenAccum: 0, _lastHp: 1,
      _isFragment: true,
    });
  }

  function spawnPickupItem(W, atX, atY) {
    const typeKeys = Object.keys(CFG.POWERUPS);
    const type = Utils.randFrom(typeKeys);
    const def  = CFG.POWERUPS[type];
    pickups.push({
      type,
      x: atX !== undefined ? atX : 60 + Math.random() * (W - 120),
      y: atY !== undefined ? atY : -30,
      vy: 1.2 + Math.random() * 0.8,
      size: 16, bobPhase: Math.random() * Math.PI * 2,
      color: def.color, icon: def.icon,
    });
  }

  // ── LOOT OBJEKTY — neutrální cíle: neubližují, vyplatí se sestřelit ───────
  function _baseLootFields() {
    return {
      rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.02,
      burnTimer: 0, burnDps: 0, shootCooldown: 0, aimingTimer: 0,
      regenLockout: 0, regenAccum: 0,
    };
  }

  function spawnCrystalRock(W) {
    const size = 22 + Math.random() * 8;
    const nv = 7, vertices = [];
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * Math.PI * 2;
      const r = size * (0.6 + Math.random() * 0.4);
      vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    const vx = (Math.random() - 0.5) * 0.4, vy = 0.7 + Math.random() * 0.4;
    list.push({
      x: 60 + Math.random() * (W - 120), y: -50,
      vx, vy, baseVx: vx, baseVy: vy, initSpd: 1,
      size, vertices, tier: 1, hue: 275, role: 'crystalRock',
      hp: 4, maxHp: 4, _lastHp: 4,
      ..._baseLootFields(),
    });
  }

  function spawnCargoDrone(W, H) {
    const fromLeft = Math.random() < 0.5;
    const vx = (fromLeft ? 1 : -1) * 4.2;
    list.push({
      x: fromLeft ? -50 : W + 50, y: H * (0.15 + Math.random() * 0.35),
      vx, vy: 0, baseVx: vx, baseVy: 0, initSpd: 4.2,
      size: 16, vertices: [], tier: 1, hue: 180, role: 'cargo',
      hp: 2, maxHp: 2, _lastHp: 2,
      ..._baseLootFields(),
    });
  }

  function spawnFuelTank(W) {
    list.push({
      x: 80 + Math.random() * (W - 160), y: -40,
      vx: 0, vy: 0.55, baseVx: 0, baseVy: 0.55, initSpd: 0.55,
      size: 15, vertices: [], tier: 1, hue: 30, role: 'fuel',
      hp: 1, maxHp: 1, _lastHp: 1,
      ..._baseLootFields(),
    });
  }

  function triggerEMP() {
    let bonus = 0;
    list.forEach(o => {
      Particles.spawn(o.x, o.y, '#ff44ff', 8);
      bonus += [0, 12, 30, 60][o.tier] || 12;
      // EMP kill nesmí hráče připravit o měnu — 50% šance na normální drop
      if (Math.random() < 0.5) _spawnCrystals(o);
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
    recentKillValue = 0;
    crystalsCollectedThisFrame = 0;
    deathExplosions = [];
    const slowMult = activePU.slow > 0 ? 0.35 : 1;

    list.forEach(o => {
      // ── Burn DoT ──
      if (o.burnTimer > 0) {
        o.burnTimer -= slowMult;
        o.hp -= o.burnDps * slowMult;
        // Orange flicker particle occasionally
        if (Math.random() < 0.15) Particles.spawn(o.x, o.y, '#ff6600', 2);
      }

      // ── Enemy AI per role/tier — scaled by slowMult ──
      if (o.tier === 1 || o.role === 'asteroid') {
        // Tier 1 asteroids: straight flight, no steering
      } else if (o.role === 'tank') {
        // Tank: slow hunt — steers toward player lazily
        const dx = Player.x - o.x, dy = Player.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 30) {
          const spd = Math.hypot(o.baseVx, o.baseVy) || 0.8;
          o.baseVx += ((dx/dist)*spd - o.baseVx) * 0.015 * slowMult;
          o.baseVy += ((dy/dist)*spd - o.baseVy) * 0.015 * slowMult;
        }
        // ── Self-repair: regen 1 HP every 2s when not recently hit ──
        if (o.hp < (o._lastHp ?? o.hp)) o.regenLockout = 120; // hit → block regen
        o._lastHp = o.hp;
        if (o.regenLockout > 0) {
          o.regenLockout -= slowMult;
        } else if (o.hp < o.maxHp && o.hp > 0) {
          o.regenAccum = (o.regenAccum || 0) + slowMult;
          if (o.regenAccum >= 120) {
            o.hp = Math.min(o.hp + 1, o.maxHp);
            o._lastHp = o.hp;
            o.regenAccum = 0;
            // visible repair pulse
            Particles.spawn(o.x, o.y, '#44ff88', 10);
          }
        }
      } else if (o.role === 'shooter') {
        // Shooter: strafe like chaser
        const dx = Player.x - o.x;
        o.baseVx += Math.sign(dx) * 0.025 * slowMult;
        o.baseVx = Utils.clamp(o.baseVx, -o.initSpd * 1.3, o.initSpd * 1.3);

        // ── Aim → Telegraph → Fire cycle ──
        // Cooldown counts down → spawns telegraph (30f aim) → fires.
        o.shootCooldown = (o.shootCooldown || 0);
        if (o.aimingTimer > 0) {
          // Mid-aim — track player so telegraph + bullet match
          o.aimX = Player.x; o.aimY = Player.y;
          o.aimingTimer -= slowMult;
          if (o.aimingTimer <= 0) {
            const bDx = o.aimX - o.x, bDy = o.aimY - o.y;
            const bDist = Math.hypot(bDx, bDy);
            if (bDist > 0) {
              // Střely zrychlují s kolem — shooter v kole 9 nesmí být stejný jako v kole 4
              const bRound = (typeof Rounds !== 'undefined') ? Rounds.current : 1;
              const bSpd = 3.4 + (bRound - 1) * 0.15;
              enemyBullets.push({
                x: o.x, y: o.y,
                vx: (bDx / bDist) * bSpd,
                vy: (bDy / bDist) * bSpd,
                size: 5, damage: 1, life: 200,
              });
            }
            o.shootCooldown = 90 + Math.random() * 30;
          }
        } else if (o.shootCooldown > 0) {
          o.shootCooldown -= slowMult;
        } else {
          // Begin aim
          o.aimingTimer = 30;
          o.aimX = Player.x; o.aimY = Player.y;
        }
      } else if (o.role === 'splitter') {
        // Splitter: aggressive hunt like tier 3
        const dx = Player.x - o.x, dy = Player.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          const spd = Math.hypot(o.baseVx, o.baseVy) || 1.2;
          o.baseVx += ((dx/dist)*spd - o.baseVx) * 0.022 * slowMult;
          o.baseVy += ((dy/dist)*spd - o.baseVy) * 0.022 * slowMult;
        }
      } else if (o.role === 'bomber') {
        // Bomber: aggressive hunt — steers fast, explodes on death
        const dx = Player.x - o.x, dy = Player.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          const spd = Math.hypot(o.baseVx, o.baseVy) || 1.2;
          o.baseVx += ((dx/dist)*spd - o.baseVx) * 0.030 * slowMult;
          o.baseVy += ((dy/dist)*spd - o.baseVy) * 0.030 * slowMult;
        }
      } else if (o.tier === 2) {
        // Default chaser (tier 2)
        const dx = Player.x - o.x;
        o.baseVx += Math.sign(dx) * 0.03 * slowMult;
        o.baseVx = Utils.clamp(o.baseVx, -o.initSpd * 1.4, o.initSpd * 1.4);
      } else if (o.tier === 3) {
        // Default hunter (tier 3)
        const dx = Player.x - o.x, dy = Player.y - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          const spd = Math.hypot(o.baseVx, o.baseVy) || 1.2;
          o.baseVx += ((dx/dist)*spd - o.baseVx) * 0.025 * slowMult;
          o.baseVy += ((dy/dist)*spd - o.baseVy) * 0.025 * slowMult;
        }
      }

      o.vx = o.baseVx * slowMult;
      o.vy = o.baseVy * slowMult;
      o.x += o.vx;
      o.y += o.vy;
      o.rot += o.rotSpeed * slowMult;
    });
    list = list.filter(o => o.x > -100 && o.x < W+100 && o.y > -100 && o.y < H+100);

    // ── Enemy bullet movement ──
    enemyBullets.forEach(b => {
      b.x += b.vx * slowMult;
      b.y += b.vy * slowMult;
      b.life -= slowMult;
    });
    enemyBullets = enemyBullets.filter(b =>
      b.life > 0 && b.x > -60 && b.x < W+60 && b.y > -60 && b.y < H+60
    );

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

    // Remove dead enemies — spawn crystals, handle special death effects
    const dying = list.filter(o => o.hp <= 0);
    dying.forEach(o => {
      recentKillValue += _killValue(o);
      _spawnCrystals(o);
      Particles.spawn(o.x, o.y, o.tier === 3 ? '#ff8800' : '#ff3355', 8 + o.tier * 4);

      // ── Loot objekty — odměny ──
      if (o.role === 'crystalRock') {
        // 3–6 krystalů ve dvou shlucích
        const total = 3 + Math.floor(Math.random() * 4);
        for (let k = 0; k < 2; k++) {
          crystals.push({
            x: o.x + (Math.random() - 0.5) * 24, y: o.y + (Math.random() - 0.5) * 24,
            vy: 0.8 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 1.4,
            bobPhase: Math.random() * Math.PI * 2,
            value: k === 0 ? Math.ceil(total / 2) : Math.floor(total / 2),
            size: 10,
          });
        }
        Particles.spawn(o.x, o.y, '#cc77ff', 18);
      }
      if (o.role === 'cargo') {
        // Garantovaný power-up na místě sestřelu
        spawnPickupItem(0, o.x, o.y);
        Particles.spawn(o.x, o.y, '#00ffc8', 14);
      }
      if (o.role === 'fuel') {
        // Exploze — AoE 4 dmg všemu okolo (taktika: nalákat vlnu k nádrži)
        Particles.spawnExplosion(o.x, o.y, 90);
        list.forEach(other => {
          if (other !== o && other.hp > 0 && Utils.dist(o.x, o.y, other.x, other.y) < 90) {
            other.hp -= 4;
          }
        });
        if (typeof Audio !== 'undefined') Audio.sfx('explode');
      }

      // Bomber: death explosion — registers for player collision check
      if (o.role === 'bomber') {
        deathExplosions.push({ x: o.x, y: o.y, radius: 85 });
        Particles.spawnExplosion(o.x, o.y, 85);
        // Spawn 2 burning fragments on random arcs
        for (let k = 0; k < 2; k++) {
          const ang = Math.random() * Math.PI * 2;
          _spawnFragment(o.x, o.y, ang, 10 + Math.random() * 6, 25 + Math.random() * 15);
        }
      }

      // Splitter: fragment into 2 mini splitters when killed (not on fragments themselves)
      if (o.role === 'splitter' && !o._isFragment) {
        for (let k = 0; k < 2; k++) {
          const ang = (Math.random() * 0.8 - 0.4) + (k === 0 ? -Math.PI * 0.4 : -Math.PI * 0.6);
          _spawnFragment(o.x, o.y, ang, 14 + Math.random() * 4, 280 + Math.random() * 20);
        }
        Particles.spawn(o.x, o.y, '#cc66ff', 14);
      }

      // burnExplode synergy: burning enemies explode on death
      if (o.burnTimer > 0 && typeof Synergies !== 'undefined' && Synergies.has('burnExplode')) {
        Particles.spawnExplosion(o.x, o.y, 60);
        // AoE damage to nearby surviving enemies (processed after list is filtered)
        list.forEach(other => {
          if (other !== o && other.hp > 0 && Utils.dist(o.x, o.y, other.x, other.y) < 60) {
            other.hp -= 2;
          }
        });
      }

      // Tank: drops more crystals (double value)
      if (o.role === 'tank') {
        _spawnCrystals({ ...o, tier: Math.min(o.tier + 1, 3) }); // bonus drop as if 1 tier higher
      }
    });
    const beforeKill = list.length;
    list = list.filter(o => o.hp > 0);
    recentKills = beforeKill - list.length;
  }

  function checkPlayerCollision(activePU) {
    if (Player.invincible > 0) return false;
    for (const o of list) {
      if (_isLoot(o)) continue;   // loot objekty hráči neubližují
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

  function checkEnemyBulletCollision() {
    if (Player.invincible > 0) return false;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (Utils.dist(Player.x, Player.y, b.x, b.y) < b.size + Player.w * 0.5) {
        Particles.spawn(b.x, b.y, '#ff8800', 8);
        enemyBullets.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function checkBomberExplosion() {
    if (Player.invincible > 0 || deathExplosions.length === 0) return false;
    for (const ex of deathExplosions) {
      if (Utils.dist(Player.x, Player.y, ex.x, ex.y) < ex.radius + Player.w * 0.5) {
        return true;
      }
    }
    return false;
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

    // Barva trupu podle role — okamžitá čitelnost bojiště
    // (chaser/hunter červená, tank zelená, bomber oranžová, splitter fialová, shooter žlutá)
    const ROLE_COLORS = {
      tank:     '#44dd77',
      bomber:   '#ff8822',
      splitter: '#cc66ff',
      shooter:  '#ffcc33',
    };
    const sc  = ROLE_COLORS[o.role] || '#ff2233';
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

    // ── Role visuals ──
    if (o.role === 'tank') {
      // HP bar above ship
      const barW = pw * 2.5, barH = 4;
      const pct  = Math.max(0, o.hp / o.maxHp);
      ctx.fillStyle = '#111';
      ctx.fillRect(-barW/2, -ph * 1.25, barW, barH);
      ctx.fillStyle = pct > 0.5 ? '#00cc44' : pct > 0.25 ? '#ffcc00' : '#ff3300';
      ctx.fillRect(-barW/2, -ph * 1.25, barW * pct, barH);
    } else if (o.role === 'bomber') {
      // Pulsing orange warning ring
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      ctx.strokeStyle = `rgba(255,120,0,${0.4 * pulse})`;
      ctx.lineWidth = 2; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8 * pulse;
      ctx.beginPath(); ctx.arc(0, 0, o.size * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (o.role === 'shooter') {
      // Turret barrel indicator
      ctx.fillStyle = '#ff8866';
      ctx.fillRect(-1.5 * s, -ph * 1.05, 3 * s, ph * 0.20);
    } else if (o.role === 'splitter') {
      // Pulsing purple aura — visual cue this one will split
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.012);
      ctx.strokeStyle = `rgba(200,120,255,${0.45 * pulse})`;
      ctx.lineWidth = 1.5; ctx.shadowColor = '#cc66ff'; ctx.shadowBlur = 10 * pulse;
      ctx.beginPath(); ctx.arc(0, 0, o.size * 1.25, 0, Math.PI * 2); ctx.stroke();
      // Inner divide line — hints at fracture
      ctx.strokeStyle = `rgba(220,150,255,${0.5 * pulse})`;
      ctx.lineWidth = 1; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-pw * 0.45, 0); ctx.lineTo(pw * 0.45, 0); ctx.stroke();
    }

    // Burn glow overlay
    if (o.burnTimer > 0) {
      const ba = Math.min(1, o.burnTimer / 30) * 0.5;
      ctx.fillStyle = `rgba(255,80,0,${ba})`;
      ctx.beginPath(); ctx.arc(0, 0, o.size * 1.1, 0, Math.PI * 2); ctx.fill();
    }

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
    if (o.role === 'crystalRock') {
      // Krystalový asteroid — fialový, svítí (loot piñata)
      grd.addColorStop(0,   '#9a6ad0');
      grd.addColorStop(0.5, '#5a3088');
      grd.addColorStop(1,   '#241040');
    } else if (o.tier === 1) {
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

    // Krystalový asteroid — pulzující jiskry + glow okraj
    if (o.role === 'crystalRock') {
      const sparkle = 0.5 + 0.5 * Math.sin(Date.now() * 0.005 + o.x);
      ctx.strokeStyle = `rgba(200,130,255,${0.5 + 0.3 * sparkle})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#aa44ff';
      ctx.shadowBlur  = 14 * sparkle;
      ctx.stroke();
      // Vystupující krystalky
      ctx.fillStyle = `rgba(220,160,255,${0.6 + 0.4 * sparkle})`;
      [[0.3, -0.2], [-0.25, 0.3], [0.05, 0.05]].forEach(([fx, fy]) => {
        ctx.save();
        ctx.translate(o.size * fx, o.size * fy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
      });
      ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }

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
    // Enemy bullets
    enemyBullets.forEach(b => {
      ctx.save();
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = '#ff6600';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc66';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    list.forEach(o => {
      if (o.role === 'cargo')     _drawCargo(ctx, o);
      else if (o.role === 'fuel') _drawFuel(ctx, o);
      else if (o.tier === 1)      _drawAsteroid(ctx, o);
      else                        _drawEnemyShip(ctx, o);
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

  // ── Cargo dron — teal kontejner s blikajícím světlem ──────────────────────
  function _drawCargo(ctx, o) {
    const blink = Math.floor(Date.now() / 250) % 2;
    ctx.save();
    ctx.translate(o.x, o.y);
    // Tělo
    ctx.fillStyle   = '#0a2a28';
    ctx.strokeStyle = '#00ddb8';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.rect(-o.size, -o.size * 0.55, o.size * 2, o.size * 1.1);
    ctx.fill(); ctx.stroke();
    // Pruhy kontejneru
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,255,200,0.35)';
    ctx.lineWidth = 1;
    [-0.4, 0, 0.4].forEach(fx => {
      ctx.beginPath();
      ctx.moveTo(o.size * fx, -o.size * 0.55);
      ctx.lineTo(o.size * fx,  o.size * 0.55);
      ctx.stroke();
    });
    // Ikona nákladu
    ctx.font = `${o.size * 0.8}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText('📦', 0, 1);
    ctx.globalAlpha = 1;
    // Blikající maják
    ctx.fillStyle = blink ? '#00ffc8' : '#00ffc833';
    ctx.shadowColor = '#00ffc8'; ctx.shadowBlur = blink ? 10 : 0;
    ctx.beginPath(); ctx.arc(0, -o.size * 0.85, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── Palivová nádrž — oranžový barel s výstražným pruhem ───────────────────
  function _drawFuel(ctx, o) {
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.006 + o.x);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    // Barel
    ctx.fillStyle   = '#3a1c08';
    ctx.strokeStyle = '#ff8822';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = '#ff8822';
    ctx.shadowBlur  = 10 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, o.size, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Výstražný pruh
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,180,40,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, o.size * 0.55, 0, Math.PI * 2); ctx.stroke();
    // Symbol
    ctx.fillStyle = `rgba(255,200,60,${0.7 + 0.3 * pulse})`;
    ctx.font = `bold ${o.size * 0.9}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Jen hrozby — používá zaměřovací reticle a danger overlay (loot není nebezpečí)
  function nearest(px, py, maxDist) {
    let best = null, bestD = maxDist || Infinity;
    list.forEach(o => {
      if (_isLoot(o)) return;
      const d = Math.hypot(o.x - px, o.y - py);
      if (d < bestD) { bestD = d; best = o; }
    });
    return best;
  }

  return {
    get list()            { return list; },
    get recentKills()     { return recentKills; },
    get recentKillValue() { return recentKillValue; },
    clear, spawnObstacle, spawnPickupItem, triggerEMP,
    spawnCrystalRock, spawnCargoDrone, spawnFuelTank,
    update, checkPlayerCollision, checkPickupCollision, checkCrystalCollision,
    checkEnemyBulletCollision, checkBomberExplosion,
    spawnBossCrystals, draw, nearest,
  };
})();
