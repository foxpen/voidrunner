// ─── VOID RUNNER — ROUNDS ───────────────────────────────────────────────────

const Rounds = (() => {
  let current = 1;
  let timer = 0;
  let intermissionTimer = 0;
  let countdownTimer = 0;
  let phase = 'PLAYING';   // PLAYING | INTERMISSION | UPGRADE | COUNTDOWN | BOSS | BOSS_DEAD | DONE
  let frameCount = 0;

  const TOTAL = CFG.ROUNDS.TOTAL;
  const DUR   = CFG.ROUNDS.ROUND_DURATION;
  const INTER = CFG.ROUNDS.INTERMISSION;

  let gameMode = 'story'; // story | endless | hardcore

  function reset() {
    const vr = JSON.parse(localStorage.getItem('vr_player') || '{}');
    gameMode = vr.mode || 'story';

    current = 1;
    timer   = gameMode === 'endless' ? Infinity : DUR * (gameMode === 'hardcore' ? 0.7 : 1);
    intermissionTimer = 0;
    phase   = 'PLAYING';
    frameCount = 0;
  }

  function getDifficulty() {
    const idx = Math.min(current - 1, CFG.DIFFICULTY.length - 1);
    const d = CFG.DIFFICULTY[idx];
    const over = current > CFG.DIFFICULTY.length ? 1 + (current - CFG.DIFFICULTY.length) * 0.12 : 1;
    return d ? d.speed * over : 3.2;
  }

  function getSpawnRate() {
    const idx = Math.min(current - 1, CFG.DIFFICULTY.length - 1);
    const d = CFG.DIFFICULTY[idx];
    const over = current > CFG.DIFFICULTY.length ? 1 + (current - CFG.DIFFICULTY.length) * 0.15 : 1;
    return d ? Math.max(6, Math.floor(d.spawnRate / over)) : 8;
  }

  function tick(W, H) {
    frameCount++;

    if (phase === 'INTERMISSION') {
      intermissionTimer--;
      if (intermissionTimer <= 0) {
        phase = 'UPGRADE';
        Upgrades.showShop(W, H,
          card => { _applyCard(card); },
          () => {
            if (current >= TOTAL && gameMode !== 'endless') {
              phase = 'BOSS';
              Boss.spawn(W, H);
              Enemies.clear();
              Hazards.clear();
            } else {
              current++;
              timer = gameMode === 'endless' ? Infinity : DUR * (gameMode === 'hardcore' ? 0.7 : 1);
              countdownTimer = 180;
              phase = 'COUNTDOWN';
            }
          }
        );
      }
      return;
    }

    if (phase === 'UPGRADE') {
      Upgrades.update();
      return;
    }

    if (phase === 'COUNTDOWN') {
      countdownTimer--;
      if (countdownTimer <= 0) {
        phase = 'PLAYING';
        Audio.sfx('round');
      }
      return;
    }

    if (phase === 'BOSS') {
      // Boss fight — no timer, just survive until boss is dead
      if (Boss.defeated) {
        phase = 'BOSS_DEAD';
        intermissionTimer = INTER;
      }
      return;
    }

    if (phase === 'BOSS_DEAD') {
      intermissionTimer--;
      if (intermissionTimer <= 0) {
        current++;
        timer = DUR * (gameMode === 'hardcore' ? 0.7 : 1);
        phase = 'UPGRADE';
        Upgrades.showShop(W, H,
          card => { _applyCard(card); },
          () => {
            countdownTimer = 180;
            phase = 'COUNTDOWN';
          }
        );
      }
      return;
    }

    if (phase === 'PLAYING') {
      if (timer !== Infinity) timer--;
      if (timer <= 0) {
        phase = 'INTERMISSION';
        intermissionTimer = INTER;
        Enemies.clear();
        Weapons.clearProjectiles();
      }
    }
  }

  function _applyCard(card) {
    if (card.type === 'weapon') {
      Weapons.applyUpgrade(card);
    } else {
      Player.applyUpgrade(card);
      Weapons.applyUpgrade(card);
    }
  }

  function shouldSpawnEnemies() {
    return phase === 'PLAYING';
  }

  function isBossRound() {
    return phase === 'BOSS';
  }

  function isUpgradeScreen() {
    return phase === 'UPGRADE';
  }

  function isGameDone() { return false; }

  function isIntermission() {
    return phase === 'INTERMISSION' || phase === 'BOSS_DEAD';
  }

  // Returns 0-1 progress of current round
  function progress() {
    if (phase !== 'PLAYING') return 1;
    return 1 - timer / DUR;
  }

  function forceEndRound() {
    if (phase === 'PLAYING' && timer > 1) timer = 1;
  }

  function getScoreTarget() {
    if (current > CFG.DIFFICULTY.length) return 12000 + (current - CFG.DIFFICULTY.length) * 1500;
    const d = CFG.DIFFICULTY[current - 1];
    return d ? (d.scoreTarget || 0) : 0;
  }

  function timeLeft() {
    return Math.max(0, Math.ceil(timer / 60));
  }

  function isCountdown() { return phase === 'COUNTDOWN'; }

  return {
    reset, tick, getDifficulty, getSpawnRate,
    shouldSpawnEnemies, isBossRound, isUpgradeScreen, isGameDone, isIntermission, isCountdown,
    progress, timeLeft, forceEndRound, getScoreTarget,
    get current()        { return current; },
    get phase()          { return phase; },
    get frameCount()     { return frameCount; },
    get countdownValue() { return Math.max(1, Math.ceil(countdownTimer / 60)); },
  };
})();
