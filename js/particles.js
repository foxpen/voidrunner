// ─── VOID RUNNER — PARTICLES ────────────────────────────────────────────────

const Particles = (() => {
  let list = [];
  let bgStars = [];
  let empWaves = [];

  function initStars(W, H) {
    bgStars = [];
    for (let i = 0; i < 200; i++) {
      bgStars.push({
        x: Math.random() * W, y: Math.random() * H,
        size: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 1.5 + 0.3,
        brightness: Math.random(),
      });
    }
  }

  function spawn(x, y, color, count = 40) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 6 + 1;
      list.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1,
        decay: 0.01 + Math.random() * 0.025,
        size: Math.random() * 4 + 1,
        color,
      });
    }
  }

  function spawnEmpWave(x, y, W, H) {
    empWaves.push({ x, y, radius: 0, maxRadius: Math.max(W, H), life: 1 });
  }

  function update(state, frameCount, W, H, difficulty, slowActive) {
    const slowMult = slowActive ? 0.3 : 1;
    const isPlaying = state === 'PLAYING';

    // Stars
    bgStars.forEach(s => {
      s.y += s.speed * (isPlaying ? difficulty * slowMult : 0.5);
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    // Particles
    list.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.03;
      p.life -= p.decay;
    });
    list = list.filter(p => p.life > 0);

    // EMP waves
    empWaves.forEach(w => { w.radius += 18; w.life -= 0.025; });
    empWaves = empWaves.filter(w => w.life > 0);
  }

  function drawStars(ctx, frameCount) {
    bgStars.forEach(s => {
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.02 + s.brightness * 10);
      ctx.globalAlpha = s.brightness * 0.4 * pulse + 0.1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawEmpWaves(ctx) {
    empWaves.forEach(w => {
      ctx.strokeStyle = `rgba(255, 68, 255, ${w.life * 0.5})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff44ff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles(ctx) {
    list.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function clear() { list = []; empWaves = []; }

  return { initStars, spawn, spawnEmpWave, update, drawStars, drawEmpWaves, drawParticles, clear };
})();
