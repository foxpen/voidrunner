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
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,2,8,0.70)';
    ctx.fill();
    ctx.strokeStyle = borderColor || 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawIntermissionOverlay(ctx, W, H, round, totalRounds, frameCount) {
    ctx.fillStyle = 'rgba(0,2,8,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const fadeIn = Math.min(1, frameCount / 22);
    ctx.globalAlpha = fadeIn;

    const isBoss   = round >= totalRounds;
    const mainText = isBoss ? 'BOSS SE PROBOUZÍ...' : `KOLO ${round}  DOKONČENO`;
    const mainSz   = Math.min(42, W * 0.048);
    const subSz    = Math.min(20, W * 0.028);

    const pw = Math.min(W * 0.72, 620), ph = 96;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2 - 12;
    _panelRect(ctx, px, py, pw, ph, 6, isBoss ? 'rgba(220,50,70,0.18)' : 'rgba(255,255,255,0.07)');

    ctx.font      = `900 ${mainSz}px Orbitron, monospace`;
    ctx.fillStyle = isBoss ? 'rgba(230,80,90,0.90)' : 'rgba(255,255,255,0.88)';
    ctx.shadowBlur = 0;
    // Subtle drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(mainText, W/2 + 1, H/2 + mainSz * 0.28 - 12 + 1);
    ctx.fillStyle = isBoss ? 'rgba(230,80,90,0.90)' : 'rgba(255,255,255,0.88)';
    ctx.fillText(mainText, W/2, H/2 + mainSz * 0.28 - 12);

    const msg = isBoss ? '' : (ROUND_MSGS[round] || '');
    if (msg) {
      ctx.font      = `500 ${subSz}px Rajdhani, sans-serif`;
      ctx.fillStyle = 'rgba(220, 175, 100, 0.70)';
      ctx.fillText(msg, W / 2, H / 2 + mainSz * 0.28 + subSz * 1.5 - 12);
    }

    ctx.font      = `500 ${Math.min(12, W * 0.015)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(180, 210, 220, 0.35)';
    ctx.fillText('VYBER  VYLEPŠENÍ', W / 2, py + ph + 24);

    ctx.globalAlpha = 1;
  }

  function drawCountdownOverlay(ctx, W, H, value, frameCount) {
    const col = value === 1 ? 'rgba(230,70,80,0.88)' : value === 2 ? 'rgba(220,180,60,0.85)' : 'rgba(255,255,255,0.88)';

    const frac  = (frameCount % 60) / 60;
    const scale = 1.30 - frac * 0.30;
    const alpha = Math.min(1, frac < 0.12 ? frac / 0.12 : 1.0);
    const sz    = Math.floor(Math.min(148, W * 0.17) * scale);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.globalAlpha = alpha;
    ctx.textAlign   = 'center';

    // Dark backdrop
    ctx.fillStyle = 'rgba(0,2,8,0.60)';
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.68, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.70, 0, Math.PI * 2); ctx.stroke();

    // Number — drop shadow for readability
    ctx.font      = `900 ${sz}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(value, 1, sz * 0.36 + 1);
    ctx.fillStyle = col;
    ctx.fillText(value, 0, sz * 0.36);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.globalAlpha = alpha * 0.55;
    ctx.font        = `700 ${Math.max(10, Math.floor(W * 0.016))}px Orbitron, monospace`;
    ctx.fillStyle   = 'rgba(200, 220, 225, 0.85)';
    ctx.fillText('PŘIPRAV  SE', 0, sz * 0.36 + 30);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDoneOverlay(ctx, W, H, frameCount) {
    ctx.fillStyle = 'rgba(0,2,8,0.80)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    const pw = Math.min(W * 0.65, 520), ph = 110;
    _panelRect(ctx, W/2 - pw/2, H/2 - ph/2, pw, ph, 6, 'rgba(220,180,60,0.18)');

    const sz = Math.min(46, W * 0.054);
    ctx.font = `900 ${sz}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('VÍTĚZ!', W/2 + 1, H/2 + 16 + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText('VÍTĚZ!', W / 2, H / 2 + 16);

    ctx.font      = `500 ${Math.min(13, W * 0.017)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(180, 210, 220, 0.45)';
    ctx.fillText('BOSS PORAŽEN  ·  STISKNI ENTER', W / 2, H / 2 + 48);
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
