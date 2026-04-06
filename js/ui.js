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
      bossHpFill.style.background = pct > 0.5
        ? 'linear-gradient(90deg,#00bb88,#00ffc8 60%,#44ffdd)'
        : pct > 0.25
          ? 'linear-gradient(90deg,#cc8800,#ffcc00 60%,#ffee44)'
          : 'linear-gradient(90deg,#cc0033,#ff3355 60%,#ff6688)';
      bossHpFill.style.boxShadow = pct > 0.5
        ? '0 0 10px rgba(0,255,200,0.6)'
        : pct > 0.25
          ? '0 0 10px rgba(255,200,0,0.6)'
          : '0 0 10px rgba(255,51,85,0.7)';
    }
    if (bossLabel) bossLabel.textContent = `GUARDIAN  ·  FÁZE ${phase}`;
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

  function _panelRect(ctx, x, y, w, h, r, borderColor) {
    // Reusable dark panel helper
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,4,12,0.82)';
    ctx.fill();
    ctx.strokeStyle = borderColor || 'rgba(0,212,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawIntermissionOverlay(ctx, W, H, round, totalRounds, frameCount) {
    // Full dark overlay
    ctx.fillStyle = 'rgba(0,4,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const fadeIn = Math.min(1, frameCount / 25);
    ctx.globalAlpha = fadeIn;

    const mainText = round >= totalRounds ? 'BOSS SE PROBOUZÍ...' : `KOLO ${round}  DOKONČENO`;
    const mainSz   = Math.min(48, W * 0.055);
    const subSz    = Math.min(22, W * 0.032);

    // Main panel
    const pw = Math.min(W * 0.78, 680);
    const ph = 110;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2 - 16;
    _panelRect(ctx, px, py, pw, ph, 8, round >= totalRounds ? 'rgba(255,51,85,0.28)' : 'rgba(0,212,255,0.22)');

    // Main heading
    ctx.font        = `900 ${mainSz}px Orbitron, monospace`;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = round >= totalRounds ? '#ff3355' : '#00d4ff';
    ctx.shadowBlur  = 28;
    ctx.fillText(mainText, W / 2, H / 2 + mainSz * 0.3 - 16);
    ctx.shadowBlur  = 0;

    // Round message
    const msg = round >= totalRounds ? '' : (ROUND_MSGS[round] || '');
    if (msg) {
      ctx.font      = `500 ${subSz}px Rajdhani, sans-serif`;
      ctx.fillStyle = 'rgba(255,200,100,0.9)';
      ctx.shadowColor = 'rgba(255,140,0,0.4)';
      ctx.shadowBlur  = 14;
      ctx.fillText(msg, W / 2, H / 2 + mainSz * 0.3 + subSz * 1.4 - 16);
      ctx.shadowBlur  = 0;
    }

    // Subhint
    ctx.font      = `500 ${Math.min(14, W * 0.018)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(0,212,255,0.45)';
    ctx.fillText('VYBER  VYLEPŠENÍ', W / 2, py + ph + 28);

    ctx.globalAlpha = 1;
  }

  function drawCountdownOverlay(ctx, W, H, value, frameCount) {
    const colors = { 3: '#00ffc8', 2: '#ffcc00', 1: '#ff4455' };
    const glows  = { 3: '#00d4ff', 2: '#ffaa00', 1: '#ff0000' };
    const col    = colors[value] || '#ffffff';
    const glow   = glows[value]  || '#ffffff';

    const frac  = (frameCount % 60) / 60;
    const scale = 1.35 - frac * 0.35;
    const alpha = Math.min(1, frac < 0.12 ? frac / 0.12 : 1.0);
    const sz    = Math.floor(Math.min(160, W * 0.18) * scale);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.globalAlpha = alpha;
    ctx.textAlign   = 'center';

    // Dark backdrop circle
    ctx.fillStyle = 'rgba(0,4,12,0.70)';
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col + '44';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.72, 0, Math.PI * 2); ctx.stroke();

    // Number
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 60;
    ctx.font        = `900 ${sz}px Orbitron, monospace`;
    ctx.fillStyle   = '#ffffff';
    ctx.fillText(value, 0, sz * 0.36);
    ctx.shadowBlur  = 0;

    // Subtitle
    ctx.globalAlpha = alpha * 0.75;
    ctx.font        = `700 ${Math.max(11, Math.floor(W * 0.018))}px Orbitron, monospace`;
    ctx.fillStyle   = 'rgba(0,212,255,0.8)';
    ctx.fillText('PŘIPRAV  SE', 0, sz * 0.36 + 34);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDoneOverlay(ctx, W, H, frameCount) {
    ctx.fillStyle = 'rgba(0,4,12,0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const pw = Math.min(W * 0.7, 560), ph = 120;
    _panelRect(ctx, W/2 - pw/2, H/2 - ph/2, pw, ph, 8, 'rgba(255,200,60,0.35)');

    ctx.font      = `900 ${Math.min(52, W * 0.06)}px Orbitron, monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 40;
    ctx.fillText('VÍTĚZ!', W / 2, H / 2 + 18);
    ctx.shadowBlur = 0;

    ctx.font      = `500 ${Math.min(15, W * 0.02)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(0,212,255,0.65)';
    ctx.fillText('BOSS PORAŽEN  ·  STISKNI ENTER', W / 2, H / 2 + 52);
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
