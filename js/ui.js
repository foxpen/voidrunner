// ─── VOID RUNNER — UI ───────────────────────────────────────────────────────

const UI = (() => {
  // DOM refs
  const scoreVal   = document.getElementById('score-value');
  const highVal    = document.getElementById('highscore-value');
  const scoreDisp  = document.getElementById('score-display');
  const highDisp   = document.getElementById('highscore-display');
  const puHud      = document.getElementById('powerup-hud');
  const pickupNote = document.getElementById('pickup-notify');
  const gpIndicator = document.getElementById('gamepad-indicator');
  const gpText     = document.getElementById('gamepad-text');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScore  = document.getElementById('final-score');
  const statsRow    = document.getElementById('stats-row');
  const newRecord   = document.getElementById('new-record');
  const roundDisp   = document.getElementById('round-display');
  const roundTimer  = document.getElementById('round-timer');
  const bossBar     = document.getElementById('boss-bar-wrap');
  const bossHpFill  = document.getElementById('boss-hp-fill');
  const bossLabel   = document.getElementById('boss-label');

  let notifyTimer = 0;

  // Power-up HUD slot refs
  const puSlots = {};
  for (const [key, def] of Object.entries(CFG.POWERUPS)) {
    const el = document.getElementById('pu-' + key);
    if (el) puSlots[key] = { el, timer: el.querySelector('.pu-timer') };
  }

  function showGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('visible');
    scoreDisp.classList.add('visible');
    highDisp.classList.add('visible');
    puHud.classList.add('visible');
    gpIndicator.classList.add('visible');
    if (roundDisp) roundDisp.classList.add('visible');
  }

  function showMenu() {
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.remove('visible');
    scoreDisp.classList.remove('visible');
    highDisp.classList.remove('visible');
    puHud.classList.remove('visible');
    if (roundDisp) roundDisp.classList.remove('visible');
    if (bossBar) bossBar.classList.remove('visible');
    updateLeaderboard();
  }

  function showGameOver(score, highScore, pickups, isNew) {
    finalScore.textContent = score;
    statsRow.textContent   = `VYLEPŠENÍ SEBRÁNO: ${pickups}`;
    newRecord.textContent  = isNew ? '★ NOVÝ REKORD ★' : '';
    highVal.textContent    = highScore;
    setTimeout(() => gameOverScreen.classList.add('visible'), 600);
  }

  function updateScore(score) {
    if (scoreVal) scoreVal.textContent = score;
  }

  function updateHighScore(hs) {
    if (highVal) highVal.textContent = hs;
  }

  function updateRound(round, total, timeLeft, phase) {
    if (!roundDisp) return;
    if (phase === 'BOSS') {
      roundDisp.innerHTML = `<span class="label">KOL</span><span class="value" style="color:#ff3355">BOSS</span>`;
    } else {
      roundDisp.innerHTML = `<span class="label">KOLO</span><span class="value">${round}<span style="font-size:18px;color:#ffffff55"> / ${total}</span></span>`;
    }
    if (roundTimer) {
      roundTimer.textContent = phase === 'PLAYING' ? `${timeLeft}s` : '';
    }
  }

  function updateBossBar(hp, maxHp, phase) {
    if (!bossBar) return;
    if (hp <= 0) { bossBar.classList.remove('visible'); return; }
    bossBar.classList.add('visible');
    const pct = hp / maxHp;
    if (bossHpFill) {
      bossHpFill.style.transform = `scaleX(${pct})`;
      bossHpFill.style.background = pct > 0.5 ? '#00ffc8' : pct > 0.25 ? '#ffcc00' : '#ff3355';
    }
    if (bossLabel) bossLabel.textContent = `BOSS  FÁZE ${phase}`;
  }

  function hideBossBar() {
    if (bossBar) bossBar.classList.remove('visible');
  }

  function updatePowerups(activePU) {
    for (const [key, def] of Object.entries(CFG.POWERUPS)) {
      if (key === 'emp') continue;
      const slot = puSlots[key];
      if (!slot) continue;
      if (activePU[key] > 0) {
        slot.el.classList.add('active');
        slot.timer.style.transform = `scaleX(${activePU[key] / def.duration})`;
      } else {
        slot.el.classList.remove('active');
        slot.timer.style.transform = 'scaleX(0)';
      }
    }
  }

  function showNotify(text, color) {
    notifyTimer = 90;
    pickupNote.textContent = text;
    pickupNote.style.color = color;
    pickupNote.style.textShadow = `0 0 20px ${color}66`;
    pickupNote.classList.add('show');
    setTimeout(() => pickupNote.classList.remove('show'), 1500);
  }

  function setGamepad(connected, id) {
    if (connected) {
      gpIndicator.classList.add('connected', 'visible');
      gpText.textContent = id;
    } else {
      gpIndicator.classList.remove('connected');
      gpText.textContent = 'GAMEPAD NEPŘIPOJEN';
    }
  }

  // Zprávy pro každé kolo — co přichází dál
  const ROUND_MSGS = [
    '',
    'PRÁZDNOTA TĚ VOLÁ...',           // po kole 1
    'NEBEZPEČÍ ROSTE',                // 2
    'GRAVITACE SE ZVYŠUJE',           // 3
    'HVĚZDNÉ TROSKY HOUSTNOU',        // 4
    'JSME V DOSAHU ČERNÉ DÍRY',       // 5
    'NÁVRAT JIŽ NENÍ MOŽNÝ',          // 6
    'ČASOPROSTOR SE DEFORMUJE',       // 7
    'SPAGHETTIFIKACE ZAČÍNÁ',         // 8
    'BOSS SE PROBOUZÍ Z TEMNOTY',     // 9
  ];

  function drawIntermissionOverlay(ctx, W, H, round, totalRounds, frameCount) {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const pulse = 0.8 + 0.2 * Math.sin(frameCount * 0.08);
    ctx.globalAlpha = pulse;

    // Hlavní nadpis — kolo dokončeno
    const mainText = round >= totalRounds ? 'KONEČNÝ BOSS SE BLÍŽÍ...' : `KOLO ${round} — DOKONČENO`;
    ctx.font = `900 clamp(32px, 5vw, 62px) Orbitron, monospace`;
    ctx.font = 'bold 58px Orbitron, monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 40;
    ctx.fillText(mainText, W / 2, H / 2 - 48);

    // Intro text příštího kola
    const nextRound = round + 1;
    const msg = round >= totalRounds ? '' : (ROUND_MSGS[round] || `KOLO ${nextRound}`);
    if (msg) {
      ctx.font = 'bold 28px Rajdhani, sans-serif';
      ctx.fillStyle = '#ff8c00';
      ctx.shadowColor = '#ff8c0066';
      ctx.shadowBlur = 20;
      ctx.fillText(msg, W / 2, H / 2 + 10);
    }

    // Podtitulek
    ctx.font = '20px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff55';
    ctx.shadowBlur = 0;
    ctx.fillText('— vyber vylepšení —', W / 2, H / 2 + 52);

    ctx.globalAlpha = 1;
  }

  function drawCountdownOverlay(ctx, W, H, value, frameCount) {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(10,10,15,0.35)';
    ctx.fillRect(0, 0, W, H);

    // Color by value: 3=cyan, 2=yellow, 1=red
    const colors = { 3: '#00ffc8', 2: '#ffcc00', 1: '#ff3355' };
    const glows  = { 3: '#00ffc8', 2: '#ffaa00', 1: '#ff0000' };
    const col    = colors[value] || '#ffffff';
    const glow   = glows[value]  || '#ffffff';

    // Zoom-pulse: scale based on fractional position within current second
    const frac   = (frameCount % 60) / 60;
    const scale  = 1.4 - frac * 0.4; // zoom in from 1.4→1.0
    const alpha  = Math.min(1, frac < 0.15 ? frac / 0.15 : 1.0);

    const sz = Math.floor(Math.min(180, W * 0.2) * scale);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    // Outer glow ring
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 80;
    ctx.font        = `900 ${sz}px Orbitron, monospace`;
    ctx.fillStyle   = col;
    ctx.fillText(value, 0, sz * 0.35);

    // Subtitle
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = `bold ${Math.floor(W * 0.022)}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('— PŘIPRAV SE —', 0, sz * 0.35 + 38);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDoneOverlay(ctx, W, H, frameCount) {
    ctx.fillStyle = `rgba(10, 10, 15, 0.85)`;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Orbitron, monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 40;
    ctx.fillText('VÍTĚZ!', W / 2, H / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.font = '18px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff88';
    ctx.fillText('Boss poražen · Stiskni ENTER pro restart', W / 2, H / 2 + 30);
  }

  function updateLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    const scores = JSON.parse(localStorage.getItem('vr_scores') || '[]');
    if (scores.length === 0) {
      lb.innerHTML = '<div class="lb-empty">Zat\u00edm \u017e\u00e1dn\u00e9 z\u00e1znamy</div>';
      return;
    }
    lb.innerHTML = scores.map((s, i) =>
      `<div class="lb-row">
        <span class="lb-rank">#${i + 1}</span>
        <span class="lb-score">${s.score.toLocaleString()}</span>
        <span class="lb-meta">KOL ${s.round} \u00B7 ${s.date}</span>
      </div>`
    ).join('');
  }

  return {
    showGame, showMenu, showGameOver, updateScore, updateHighScore,
    updateRound, updateBossBar, hideBossBar, updatePowerups,
    showNotify, setGamepad, drawIntermissionOverlay, drawDoneOverlay, drawCountdownOverlay,
    updateLeaderboard,
  };
})();
