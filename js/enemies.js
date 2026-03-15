// ─── VOID RUNNER — ENEMIES ──────────────────────────────────────────────────

const Enemies = (() => {
  let list = [];
  let pickups = [];
  let recentKills = 0;

  function clear() { list = []; pickups = []; }

  function spawnObstacle(W, H, difficulty, slowActive) {
    const side = Math.random();
    let x, y, vx, vy;
    const spd = (1.5 + Math.random() * 2) * difficulty;
    const slowMult = slowActive ? 0.35 : 1;

    if (side < 0.6)       { x = Math.random() * W; y = -40; vx = (Math.random()-0.5)*spd; vy = spd; }
    else if (side < 0.8)  { x = -40; y = Math.random()*H*0.7; vx = spd; vy = (Math.random()-0.3)*spd*0.5; }
    else                  { x = W+40; y = Math.random()*H*0.7; vx = -spd; vy = (Math.random()-0.3)*spd*0.5; }

    vx *= slowMult;
    vy *= slowMult;

    const size = 12 + Math.random() * 28;
    const vertices = [];
    const nv = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < nv; i++) {
      const a = (i / nv) * Math.PI * 2;
      const r = size * (0.6 + Math.random() * 0.4);
      vertices.push({ x: Math.cos(a)*r, y: Math.sin(a)*r });
    }

    list.push({
      x, y, vx, vy,
      baseVx: vx / slowMult,
      baseVy: vy / slowMult,
      size, vertices,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      hue: Math.random() < 0.3 ? 340 : (180 + Math.random() * 40),
      hp: 1,
      maxHp: 1,
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

  function update(W, H, activePU) {
    recentKills = 0;
    const slowMult = activePU.slow > 0 ? 0.35 : 1;

    list.forEach(o => {
      o.vx = o.baseVx * slowMult;
      o.vy = o.baseVy * slowMult;
      o.x += o.vx;
      o.y += o.vy;
      o.rot += o.rotSpeed * slowMult;
    });
    list = list.filter(o => o.x > -100 && o.x < W+100 && o.y > -100 && o.y < H+100);

    // Pickups
    const hasMagnet = activePU.magnet > 0 || Player.permMagnet;
    pickups.forEach(p => {
      p.y += p.vy * slowMult;
      p.bobPhase += 0.05;
      if (hasMagnet) {
        const dx = Player.x - p.x;
        const dy = Player.y - p.y;
        const dist = Utils.dist(Player.x, Player.y, p.x, p.y);
        if (dist < 300) {
          const force = 4 * (1 - dist / 300);
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      }
    });
    pickups = pickups.filter(p => p.y < H + 60);

    // Remove dead enemies — track kill count for juice
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

  function draw(ctx) {
    list.forEach(o => {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);

      // HP bar for tougher enemies
      if (o.maxHp > 1) {
        const pct = o.hp / o.maxHp;
        ctx.fillStyle = '#ff3355';
        ctx.fillRect(-o.size, -o.size - 10, o.size * 2, 4);
        ctx.fillStyle = '#00ffc8';
        ctx.fillRect(-o.size, -o.size - 10, o.size * 2 * pct, 4);
      }

      ctx.shadowColor = `hsl(${o.hue}, 100%, 60%)`;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = `hsl(${o.hue}, 80%, 55%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.vertices[0].x, o.vertices[0].y);
      for (let i = 1; i < o.vertices.length; i++) ctx.lineTo(o.vertices[i].x, o.vertices[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `hsla(${o.hue}, 60%, 30%, 0.15)`;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Pickups
    pickups.forEach(p => {
      const bob   = Math.sin(p.bobPhase) * 4;
      const pulse = 0.7 + 0.3 * Math.sin(p.bobPhase * 2);
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.strokeStyle = p.color + '44';
      ctx.lineWidth = 2;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, p.size + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.color + '22';
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(p.icon, 0, 1);
      ctx.restore();
    });
  }

  return {
    get list()        { return list; },
    get recentKills() { return recentKills; },
    clear, spawnObstacle, spawnPickupItem, triggerEMP,
    update, checkPlayerCollision, checkPickupCollision, draw,
  };
})();
