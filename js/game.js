// ─── VOID RUNNER — MAIN GAME LOOP ───────────────────────────────────────────

const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); Particles.initStars(W, H); });

// ─── GAME STATE ────────────────────────────────────────────────────────────
const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', DEAD: 'DEAD' };
let state = STATE.MENU;
let score = 0;
let highScore = 0;
let pickupsCollected = 0;
let shakeTime = 0;
let shakeIntensity = 0;
let slowmo = 0;
let frameCount = 0;

// Active power-up timers (frames)
let activePU = { shield: 0, slow: 0, speed: 0, magnet: 0, double: 0, emp: 0 };
let empFlash = 0;

Particles.initStars(W, H);

// ─── AUTO-START FROM ONBOARDING ────────────────────────────────────────────
window.addEventListener('load', () => {
  const vr = localStorage.getItem('vr_player');
  if (vr) setTimeout(() => startGame(), 150);
});

// ─── START GAME ────────────────────────────────────────────────────────────
function startGame() {
  state = STATE.PLAYING;
  score = 0; pickupsCollected = 0; frameCount = 0;
  shakeTime = 0; slowmo = 0;
  activePU = { shield: 0, slow: 0, speed: 0, magnet: 0, double: 0, emp: 0 };
  empFlash = 0;

  Player.resetStats();
  Player.reset(W, H);
  Weapons.reset();
  Enemies.clear();
  Particles.clear();
  Rounds.reset();
  Upgrades.reset();
  Boss.clear();
  BG.clear();
  BG.setRound(1);
  Hazards.clear();

  // Audio — init + spustit hudbu JEN při letu
  Audio.init();
  Audio.resume();
  Audio.stopMusic();
  setTimeout(() => Audio.startMusic(), 600);

  UI.showGame();
  UI.updateHighScore(highScore);
  UI.hideBossBar();
}

// ─── DIE ───────────────────────────────────────────────────────────────────
function takeDamage() {
  if (activePU.shield > 0) {
    activePU.shield = 0;
    Player.invincible = 60;
    shakeTime = 10; shakeIntensity = 6;
    Particles.spawn(Player.x, Player.y, '#00aaff', 25);
    UI.showNotify('ŠTÍT ABSORBOVAL NÁRAZ', '#00aaff');
    return;
  }

  Player.lives -= 1;

  if (Player.lives <= 0) {
    die();
  } else {
    Player.invincible = 90;
    shakeTime = 15; shakeIntensity = 8;
    Particles.spawn(Player.x, Player.y, '#ff3355', 20);
    UI.showNotify(`♥ ŽIVOTY: ${Player.lives}`, '#ff3355');
  }
}

function die() {
  state = STATE.DEAD;
  Audio.sfx('death');
  setTimeout(() => Audio.stopMusic(), 800);
  Particles.spawn(Player.x, Player.y, '#ff3355', 50);
  Particles.spawn(Player.x, Player.y, '#00ffc8', 30);
  shakeTime = 30; shakeIntensity = 12; slowmo = 20;

  const isNew = score > highScore;
  if (isNew) highScore = score;

  UI.showGameOver(score, highScore, pickupsCollected, isNew);
}

// ─── UPDATE ────────────────────────────────────────────────────────────────
function update() {
  frameCount++;

  // If upgrade screen is showing — only tick upgrades, nothing else
  if (Upgrades.showing) { Upgrades.update(); return; }

  if (state !== STATE.PLAYING) {
    Particles.update(state, frameCount, W, H, 1, false);
    return;
  }

  // Tick rounds state machine (only while playing)
  Rounds.tick(W, H);

  // Update background — BH proximity based on round
  BG.setRound(Rounds.current);
  BG.update(frameCount, W, H);

  // Music intensity — higher near boss
  const intensity = (Rounds.current - 1) / 9;
  if (frameCount % 300 === 0) Audio.setMusicIntensity(Rounds.isBossRound() ? 1 : intensity);

  // Power-up timers
  for (const key of Object.keys(activePU)) {
    if (activePU[key] > 0) activePU[key]--;
  }

  // Input → player
  const move = Input.getMove();
  Player.update(W, H, move, activePU);

  // Spawn enemies
  if (Rounds.shouldSpawnEnemies()) {
    const spawnRate = Math.max(8, Rounds.getSpawnRate() - score * 0.01);
    if (frameCount % Math.floor(spawnRate) === 0) {
      Enemies.spawnObstacle(W, H, Rounds.getDifficulty(), activePU.slow > 0);
    }
    const puRate = Math.max(120, 250 - score * 0.05);
    if (frameCount % Math.floor(puRate) === 0) {
      Enemies.spawnPickupItem(W);
    }
  }

  // Hazards (planets, pillars, clusters — can't be destroyed)
  if (Rounds.shouldSpawnEnemies()) Hazards.spawnForRound(Rounds.current, W, H);
  Hazards.update(W, H, activePU.slow > 0);
  if (Hazards.checkPlayerCollision(activePU)) takeDamage();

  // Enemy update
  Enemies.update(W, H, activePU);

  // Weapons update — pass enemy list + boss target
  const allTargets = [...Enemies.list];
  const bossTarget = Boss.asBossTarget();
  if (bossTarget) allTargets.push(bossTarget);

  Weapons.update(Player.x, Player.y, allTargets, W, H, frameCount, activePU.slow > 0);

  // Check boss damage from weapons
  if (bossTarget) {
    // Boss damage was applied via takeDmg callback in asBossTarget
    // But we also need to check direct hits
  }

  // Boss update
  Boss.update(W, H, activePU.slow > 0);
  if (Rounds.isBossRound()) {
    UI.updateBossBar(Boss.hp, Boss.maxHp, Boss.phase);
    if (Boss.checkPlayerBulletHit()) takeDamage();
  } else {
    UI.hideBossBar();
  }

  // Pickup collection
  const collected = Enemies.checkPickupCollision();
  collected.forEach(item => {
    pickupsCollected++;
    const def = CFG.POWERUPS[item.type];
    if (item.type === 'emp') {
      score += Enemies.triggerEMP();
      empFlash = 30;
      shakeTime = 15; shakeIntensity = 8;
      UI.showNotify('⚡ EMP IMPULS ⚡', '#ff44ff');
      Audio.sfx('emp');
    } else {
      activePU[item.type] = def.duration;
      UI.showNotify(`${def.icon} ${def.name}`, def.color);
      Audio.sfx('pickup');
    }
  });

  // Player collision with enemies
  if (Enemies.checkPlayerCollision(activePU)) takeDamage();

  // Score
  const mult = (activePU.double > 0 ? 2 : 1) * Player.scoreMult;
  score += mult;

  UI.updateScore(score);
  UI.updateRound(Rounds.current, CFG.ROUNDS.TOTAL, Rounds.timeLeft(), Rounds.phase);
  UI.updatePowerups(activePU);

  // Particles
  Particles.update(state, frameCount, W, H, Rounds.getDifficulty(), activePU.slow > 0);

  if (shakeTime > 0) shakeTime--;

  // Game won?
  if (Rounds.isGameDone()) {
    state = STATE.DEAD; // reuse dead state for "done" flow
    const isNew = score > highScore;
    if (isNew) highScore = score;
  }
}

// ─── DRAW ──────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  let sx = 0, sy = 0;
  if (shakeTime > 0) {
    sx = (Math.random() - 0.5) * shakeIntensity * (shakeTime / 30);
    sy = (Math.random() - 0.5) * shakeIntensity * (shakeTime / 30);
  }

  ctx.save();
  ctx.translate(sx, sy);

  // Background
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  bg.addColorStop(0, activePU.slow > 0 ? '#18180a' : '#12121f');
  bg.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W+40, H+40);

  // Dynamic background (BH approaching)
  BG.draw(ctx, W, H, frameCount, Rounds.isBossRound());

  // Stars
  Particles.drawStars(ctx, frameCount);

  // Grid
  const slowG = activePU.slow > 0 ? 0.3 : 1;
  ctx.strokeStyle = '#00ffc808';
  ctx.lineWidth = 1;
  const gridOff = (frameCount * 0.5 * Rounds.getDifficulty() * slowG) % 60;
  for (let y = gridOff; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // EMP waves
  Particles.drawEmpWaves(ctx);

  // Hazards (planets, pillars — behind enemies)
  Hazards.draw(ctx, frameCount);

  // Enemies
  Enemies.draw(ctx);

  // Boss
  Boss.draw(ctx, frameCount);

  // Projectiles
  Weapons.draw(ctx);

  // Player
  if (state === STATE.PLAYING) {
    Player.draw(ctx, frameCount, activePU);
    Player.drawLivesHUD(ctx, W);
    Weapons.drawMagHUD(ctx, W, H, frameCount);
  }

  // Particles
  Particles.drawParticles(ctx);

  // Slow-mo tint
  if (activePU.slow > 0) {
    ctx.fillStyle = `rgba(255, 204, 0, ${0.02 + 0.01 * Math.sin(frameCount * 0.05)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Double score indicator
  if (activePU.double > 0) {
    ctx.save();
    ctx.font = '900 14px Orbitron, monospace';
    ctx.fillStyle = `rgba(255, 51, 136, ${0.5 + 0.3 * Math.sin(frameCount * 0.1)})`;
    ctx.textAlign = 'left';
    ctx.fillText('×2', 34, 110);
    ctx.restore();
  }

  ctx.restore();

  // Overlay screens (drawn outside shake)
  if (Upgrades.showing) {
    Upgrades.draw(ctx, W, H, frameCount);
  } else if (Rounds.isIntermission() && state === STATE.PLAYING) {
    UI.drawIntermissionOverlay(ctx, W, H, Rounds.current, CFG.ROUNDS.TOTAL, frameCount);
  } else if (Rounds.isGameDone()) {
    UI.drawDoneOverlay(ctx, W, H, frameCount);
  }
}

// ─── MAIN LOOP ─────────────────────────────────────────────────────────────
function loop() {
  // Start/restart input
  if (Input.isStartPressed()) {
    if (state === STATE.MENU) startGame();
    else if (state === STATE.DEAD) startGame();
    else if (Rounds.isGameDone()) startGame();
  }

  if (slowmo > 0) {
    slowmo--;
    if (slowmo % 2 === 0) update();
  } else {
    update();
  }

  draw();
  requestAnimationFrame(loop);
}

loop();
