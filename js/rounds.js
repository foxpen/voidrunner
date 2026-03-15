// ─── VOID RUNNER — ROUNDS ───────────────────────────────────────────────────

const Rounds = (() => {
  let current = 1;
  let timer = 0;           // frames remaining this round
  let intermissionTimer = 0;
  let phase = 'PLAYING';   // PLAYING | INTERMISSION | UPGRADE | BOSS | BOSS_DEAD | DONE
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
    const d = CFG.DIFFICULTY[current - 1];
    return d ? d.speed : 3.2;
  }

  function getSpawnRate() {
    const d = CFG.DIFFICULTY[current - 1];
    return d ? d.spawnRate : 12;
  }

  function tick(W, H) {
    frameCount++;

    if (phase === 'INTERMISSION') {
      intermissionTimer--;
      if (intermissionTimer <= 0) {
        // Show upgrade cards
        phase = 'UPGRADE';
        Upgrades.show(W, H, card => {
          _applyCard(card);
          if (gameMode === 'endless') {
            current++;
            timer = Infinity;
            phase = 'PLAYING';
          } else if (current >= TOTAL) {
            phase = 'BOSS';
            Boss.spawn(W);
            Enemies.clear();
          } else {
            current++;
            timer = DUR * (gameMode === 'hardcore' ? 0.7 : 1);
            phase = 'PLAYING';
          }
        });
      }
      return;
    }

    if (phase === 'UPGRADE') {
      Upgrades.update();
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
        phase = 'DONE';
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

  function isGameDone() {
    return phase === 'DONE';
  }

  function isIntermission() {
    return phase === 'INTERMISSION' || phase === 'BOSS_DEAD';
  }

  // Returns 0-1 progress of current round
  function progress() {
    if (phase !== 'PLAYING') return 1;
    return 1 - timer / DUR;
  }

  function timeLeft() {
    return Math.max(0, Math.ceil(timer / 60));
  }

  return {
    reset, tick, getDifficulty, getSpawnRate,
    shouldSpawnEnemies, isBossRound, isUpgradeScreen, isGameDone, isIntermission,
    progress, timeLeft,
    get current() { return current; },
    get phase()   { return phase; },
    get frameCount() { return frameCount; },
  };
})();
