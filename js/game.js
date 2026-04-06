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
let screenFlash = { a: 0, r: 255, g: 51, b: 85 };

// Combo system
let comboCount = 0;
let comboTimer = 0;   // frames before combo expires

// Round target tracking
let roundScoreStart = 0;
let roundTargetHit  = false;
let lastRoundsPhase = '';

// Warp transition
let warpFlash = 0;
// Credits system removed — upgrades are free (pick one per round)

Particles.initStars(W, H);

// ─── MENU MUSIC — spustí se při první interakci uživatele ──────────────────
let _audioReady = false;
function _initAudioOnGesture() {
  if (_audioReady) return;
  _audioReady = true;
  Audio.init();
  Audio.resume();
  Audio.startMusic();
}
document.addEventListener('keydown',     _initAudioOnGesture, { once: true });
document.addEventListener('pointerdown', _initAudioOnGesture, { once: true });

// ─── START GAME ────────────────────────────────────────────────────────────
function startGame() {
  state = STATE.PLAYING;
  score = 0; pickupsCollected = 0; frameCount = 0;
  shakeTime = 0; slowmo = 0;
  activePU = { shield: 0, slow: 0, speed: 0, magnet: 0, double: 0, emp: 0 };
  empFlash = 0;
  screenFlash = { a: 0, r: 255, g: 51, b: 85 };
  comboCount = 0; comboTimer = 0;
  roundScoreStart = 0; roundTargetHit = false; lastRoundsPhase = '';
  warpFlash = 0;
  // (no credits to reset)

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

  // Audio — pokud ještě nehraje (po game over), restartuj hudbu
  Audio.init();
  Audio.resume();
  if (!Audio.playing) {
    Audio.stopMusic();
    setTimeout(() => Audio.startMusic(), 400);
  }

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
    screenFlash = { a: 0.18, r: 0, g: 170, b: 255 };
    return;
  }

  Player.lives -= 1;
  comboCount = 0; comboTimer = 0;

  if (Player.lives <= 0) {
    die();
  } else {
    Player.invincible = 90;
    shakeTime = 15; shakeIntensity = 8;
    Particles.spawn(Player.x, Player.y, '#ff3355', 20);
    UI.showNotify(`♥ ŽIVOTY: ${Player.lives}`, '#ff3355');
    screenFlash = { a: 0.22, r: 255, g: 30, b: 50 };
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

  const _lb = JSON.parse(localStorage.getItem('vr_scores') || '[]');
  _lb.push({ score, round: Rounds.current, date: new Date().toLocaleDateString('cs-CZ') });
  _lb.sort((a, b) => b.score - a.score);
  _lb.splice(5);
  localStorage.setItem('vr_scores', JSON.stringify(_lb));

  UI.showGameOver(score, highScore, pickupsCollected, isNew);
}

// ─── UPDATE ────────────────────────────────────────────────────────────────
function update() {
  frameCount++;

  // If upgrade screen is showing — tick upgrades; also tick narrative if transitioning
  if (Upgrades.showing) {
    Upgrades.update();
    if (typeof Narrative !== 'undefined' && Narrative.active) Narrative.tick();
    return;
  }

  if (state !== STATE.PLAYING) {
    Particles.update(state, frameCount, W, H, 1, false);
    return;
  }

  // Tick rounds state machine (only while playing)
  Rounds.tick(W, H);

  // Update background — BH proximity based on round
  BG.setRound(Rounds.current);
  BG.update(frameCount, W, H, activePU.slow > 0 ? 0.35 : 1);

  // ── Round phase transitions ──
  const _curPhase = Rounds.phase;
  if (_curPhase === 'PLAYING' && lastRoundsPhase !== 'PLAYING') {
    roundScoreStart = score;
    roundTargetHit  = false;
  }
  if (_curPhase === 'INTERMISSION' && lastRoundsPhase === 'PLAYING') {
    warpFlash = 50;
  }
  lastRoundsPhase = _curPhase;

  // ── Round score target — early advance ──
  if (_curPhase === 'PLAYING' && !roundTargetHit) {
    const target = Rounds.getScoreTarget();
    if (target > 0 && (score - roundScoreStart) >= target) {
      roundTargetHit = true;
      score += 500;
      UI.showNotify('🎯 CÍLE DOSAŽENO! +500', '#00ff88');
      Rounds.forceEndRound();
    }
  }

  // Music intensity — higher near boss
  const intensity = (Rounds.current - 1) / 9;
  if (frameCount % 300 === 0) Audio.setIntensity(Rounds.isBossRound() ? 1 : intensity);

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

  // Spawn pickups during boss fight (slow rate — every ~5s)
  if (Rounds.isBossRound() && frameCount % 300 === 0) {
    Enemies.spawnPickupItem(W);
  }

  // Hazards (planets, pillars, clusters — can't be destroyed)
  if (Rounds.shouldSpawnEnemies() && !Rounds.isBossRound()) Hazards.spawnForRound(Rounds.current, W, H);
  Hazards.update(W, H, activePU.slow > 0);
  if (Hazards.checkPlayerCollision(activePU)) takeDamage();

  // Enemy update
  Enemies.update(W, H, activePU);

  // ── Kill score + combo ──
  if (Enemies.recentKills > 0) {
    comboCount += Enemies.recentKills;
    comboTimer  = 140;
    const cMult = comboCount >= 20 ? 3 : comboCount >= 10 ? 2 : comboCount >= 5 ? 1.5 : 1;
    const kMult = (activePU.double > 0 ? 2 : 1) * Player.scoreMult * cMult;
    score += Enemies.recentKills * 15 * kMult;
  }
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer <= 0) comboCount = 0;
  }

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

  // shakeTime is decremented in draw()

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
    shakeTime--;
    const decay = shakeTime / 30;
    const t = frameCount;
    sx = (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.1) * 0.4) * shakeIntensity * decay;
    sy = (Math.cos(t * 0.8) * 0.6 + Math.cos(t * 1.7) * 0.4) * shakeIntensity * decay;
  }

  ctx.save();
  ctx.translate(sx, sy);

  // Background — fialové pro boss arenu, jinak normální
  const isBoss = Rounds.isBossRound();
  const bg = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W*0.85);
  if (isBoss) {
    bg.addColorStop(0,   '#100015');
    bg.addColorStop(0.5, '#080008');
    bg.addColorStop(1,   '#030003');
  } else {
    const mid = activePU.slow > 0 ? '#181808' : '#0d1018';
    bg.addColorStop(0,   activePU.slow > 0 ? '#1a1a06' : '#0f1220');
    bg.addColorStop(0.5, mid);
    bg.addColorStop(1,   '#050508');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W+40, H+40);

  // Dynamic background (BH approaching)
  BG.draw(ctx, W, H, frameCount, Rounds.isBossRound());

  // ── Large cinematic nebula cloud around BH ──
  {
    const bhX = W * 0.5, bhY = H * 0.35;
    const bhS = BG.scale;
    // Outer smoke cloud
    [[0, 0, 0.85, '#3d1a00', 0.08],
     [-W*0.18, H*0.06, 0.55, '#1a0d30', 0.06],
     [ W*0.20, -H*0.05, 0.60, '#0d1a30', 0.05],
     [-W*0.10, H*0.12, 0.45, '#2a1400', 0.07],
     [ W*0.12,  H*0.10, 0.50, '#1a0010', 0.05],
    ].forEach(([ox, oy, sc, col, al]) => {
      const r = Math.min(W, H) * (0.55 + bhS * 0.3) * sc;
      const g2 = ctx.createRadialGradient(bhX + ox, bhY + oy, 0, bhX + ox, bhY + oy, r);
      g2.addColorStop(0,   col + 'cc');
      g2.addColorStop(0.45, col + '66');
      g2.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.globalAlpha = al * (0.6 + bhS * 0.4);
      ctx.fillRect(0, 0, W, H);
    });
    ctx.globalAlpha = 1;
  }

  // Stars
  Particles.drawStars(ctx, frameCount);

  // Speed lines — pruhy pohybu za letu
  if (state === STATE.PLAYING) {
    Particles.drawSpeedLines(ctx, Rounds.getDifficulty());
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

    // ── Combo display — nad lodí ──
    if (comboCount >= 3) {
      const cMult  = comboCount >= 20 ? 3 : comboCount >= 10 ? 2 : comboCount >= 5 ? 1.5 : 1;
      const cColor = comboCount >= 20 ? '#ffcc00' : comboCount >= 10 ? '#ff8800' : '#00ffc8';
      const cSize  = comboCount >= 10 ? 15 : 12;
      ctx.save();
      ctx.textAlign   = 'center';
      ctx.font        = `bold ${cSize}px Orbitron, monospace`;
      ctx.fillStyle   = cColor;
      ctx.shadowColor = cColor;
      ctx.shadowBlur  = 18;
      ctx.fillText(`×${cMult}  ${comboCount}↑`, Player.x, Player.y - 46);
      ctx.shadowBlur  = 0;
      ctx.restore();
    }

    // ── VOIDRUNNER watermark — very subtle, below HUD row ──
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = `700 ${Utils.clamp(W * 0.018, 8, 11)}px Orbitron, monospace`;
    ctx.fillStyle   = 'rgba(140,200,230,0.12)';
    ctx.shadowBlur  = 0;
    ctx.fillText('V O I D R U N N E R', W / 2, 96);
    ctx.restore();

    // ── Targeting reticle — tracks nearest enemy ──
    const nearestEnemy = Enemies.nearest(Player.x, Player.y);
    if (nearestEnemy) {
      const dx   = nearestEnemy.x - Player.x;
      const dy   = nearestEnemy.y - Player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isClose = dist < 200;
      const rc  = isClose ? '#ff4455' : '#00d4ff';
      const rPulse = 0.7 + 0.3 * Math.sin(frameCount * 0.1);
      ctx.save();
      ctx.translate(nearestEnemy.x, nearestEnemy.y);
      ctx.strokeStyle = rc + (isClose ? 'cc' : '99');
      ctx.lineWidth   = isClose ? 2 : 1.5;
      ctx.shadowColor = rc;
      ctx.shadowBlur  = 12;
      // Outer circle
      const rr = Math.max(nearestEnemy.r + 14, 22) * rPulse;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      // 4 corner ticks
      const tl = rr * 0.35;
      [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(a => {
        const cx2 = Math.cos(a), cy2 = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(cx2 * rr * 0.7, cy2 * rr * 0.7);
        ctx.lineTo(cx2 * (rr + tl), cy2 * (rr + tl));
        ctx.stroke();
      });
      // Distance label
      if (dist > 60) {
        ctx.font      = `bold ${Utils.clamp(1.2 * W / 100, 9, 11)}px Orbitron, monospace`;
        ctx.fillStyle = rc + 'cc';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 6;
        ctx.fillText(`${Math.round(dist)}m`, 0, -rr - 8);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Warning overlay — close big asteroid ──
    const dangerEnemy = Enemies.nearest(Player.x, Player.y, 140);
    if (dangerEnemy) {
      const wa = 0.06 + 0.04 * Math.sin(frameCount * 0.25);
      ctx.fillStyle = `rgba(255,20,20,${wa})`;
      ctx.fillRect(0, 0, W, H);
      // Warning border
      ctx.strokeStyle = `rgba(255,60,60,${0.3 + 0.2*Math.sin(frameCount*0.3)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, W-8, H-8);
    }

    // ── Bottom HUD bar — AMMO / SPEED / SHIELDS ──
    const hudH  = 56;
    const hudY  = H - hudH;

    // Dark gradient base
    const hudBg = ctx.createLinearGradient(0, hudY - 18, 0, H);
    hudBg.addColorStop(0,   'rgba(0,4,12,0)');
    hudBg.addColorStop(0.35,'rgba(0,4,12,0.88)');
    hudBg.addColorStop(1,   'rgba(0,2,8,0.97)');
    ctx.fillStyle = hudBg;
    ctx.fillRect(0, hudY - 18, W, hudH + 18);

    // Top separator line — subtle cyan
    ctx.strokeStyle = 'rgba(0,212,255,0.18)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, hudY); ctx.lineTo(W, hudY); ctx.stroke();

    const col    = W / 3;
    const labelY = hudY + 15;
    const valueY = hudY + 42;
    const labelSz = Utils.clamp(W * 0.017, 7, 9);
    const valueSz = Utils.clamp(W * 0.040, 13, 21);

    function _hudStat(label, value, cx2, accent) {
      // Label
      ctx.textAlign  = 'center';
      ctx.font       = `700 ${labelSz}px Orbitron, monospace`;
      ctx.fillStyle  = 'rgba(0, 212, 255, 0.50)';
      ctx.shadowBlur = 0;
      ctx.fillText(label, cx2, labelY);
      // Value — white with colored glow + drop shadow
      ctx.font       = `900 ${valueSz}px Orbitron, monospace`;
      ctx.shadowColor = accent;
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = '#ffffff';
      ctx.fillText(value, cx2, valueY);
      // Drop shadow pass for readability
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(0,0,0,0.55)';
      ctx.fillText(value, cx2 + 1, valueY + 1);
      ctx.fillStyle   = '#ffffff';
      ctx.fillText(value, cx2, valueY);
      ctx.shadowBlur  = 0;
    }

    const ammoVal   = Weapons.magShots;
    _hudStat('AMMO', ammoVal, col * 0.5, ammoVal <= 3 ? '#ff4455' : '#00d4ff');

    const speedVal = Math.min(9999, score > 0 ? score * 4 + 400 : 400);
    _hudStat('SPEED', speedVal, col * 1.5, '#00d4ff');

    const shieldPct = Math.round((Player.lives / 3) * 100);
    _hudStat('SHIELDS', shieldPct + '%', col * 2.5, shieldPct <= 34 ? '#ff4455' : shieldPct <= 67 ? '#ffcc00' : '#00d4ff');

    // Progress bar
    if (Rounds.phase === 'PLAYING') {
      const target = Rounds.getScoreTarget();
      if (target > 0) {
        const pct    = Math.min(1, (score - roundScoreStart) / target);
        const bw     = W * 0.5;
        const bx     = (W - bw) / 2;
        const by     = H - 5;
        const barCol = pct >= 1 ? '#00ff88' : pct > 0.6 ? '#ffcc00' : '#00d4ff';
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(bx, by, bw, 3);
        ctx.fillStyle = barCol; ctx.shadowColor = barCol; ctx.shadowBlur = 6;
        ctx.fillRect(bx, by, bw * pct, 3);
        ctx.shadowBlur = 0;
      }
    }

    // ── Tilt indicator (mobile) ──
    if (Input.tiltEnabled) {
      ctx.font      = '10px Orbitron, monospace';
      ctx.fillStyle = '#00d4ff22';
      ctx.textAlign = 'center';
      ctx.fillText('↕↔ NAKLON', W / 2, hudY - 8);
    }
  }

  // Explosions (behind particles)
  Particles.drawExplosions(ctx);

  // Particles
  Particles.drawParticles(ctx);
  Particles.drawDebris(ctx);

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

  // ── Warp flash (round transition) ──
  if (warpFlash > 0) {
    warpFlash--;
    const wf = warpFlash / 50;
    const wg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H) * 0.9);
    wg.addColorStop(0,   `rgba(0,255,200,${wf * 0.7})`);
    wg.addColorStop(0.4, `rgba(0,180,255,${wf * 0.3})`);
    wg.addColorStop(1,   `rgba(0,0,0,0)`);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);
    const lineCount = 24;
    for (let i = 0; i < lineCount; i++) {
      const a   = (i / lineCount) * Math.PI * 2;
      const len = (1 - wf) * Math.max(W, H) * 0.85;
      const sr  = wf * 60;
      ctx.strokeStyle = `rgba(0,255,200,${wf * 0.5})`;
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(W/2 + Math.cos(a)*sr,       H/2 + Math.sin(a)*sr);
      ctx.lineTo(W/2 + Math.cos(a)*(sr+len), H/2 + Math.sin(a)*(sr+len));
      ctx.stroke();
    }
  }

  // Screen flash — radial burst from player position
  if (screenFlash.a > 0) {
    const fr  = `${screenFlash.r},${screenFlash.g},${screenFlash.b}`;
    const flx = state === STATE.PLAYING ? Player.x : W / 2;
    const fly = state === STATE.PLAYING ? Player.y : H / 2;
    const fg  = ctx.createRadialGradient(flx, fly, 0, flx, fly, W * 0.7);
    fg.addColorStop(0,   `rgba(${fr},${screenFlash.a * 0.9})`);
    fg.addColorStop(0.25,`rgba(${fr},${screenFlash.a * 0.5})`);
    fg.addColorStop(1,   `rgba(${fr},0)`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
    screenFlash.a = Math.max(0, screenFlash.a - 0.07);
  }

  // Overlay screens (drawn outside shake)
  if (Rounds.isNarrative && Rounds.isNarrative() && typeof Narrative !== 'undefined') {
    Narrative.draw(ctx, W, H);
  } else if (Upgrades.showing) {
    Upgrades.draw(ctx, W, H, frameCount);
  } else if (Rounds.isCountdown() && state === STATE.PLAYING) {
    UI.drawCountdownOverlay(ctx, W, H, Rounds.countdownValue, frameCount);
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

// Auto-start if coming from onboarding
if (localStorage.getItem('vr_autostart')) {
  localStorage.removeItem('vr_autostart');
  document.getElementById('start-screen').style.display = 'none';
  startGame();
}
loop();
