// ─── VOID RUNNER — ULTIMATE „NOVA" ──────────────────────────────────────────
// Nabíjí se killy (comba nabíjejí rychleji). Plná → MEZERNÍK / tap odpálí
// expandující vlnu přes celou obrazovku: 8 dmg všemu, boss max 10 % HP.
// Na rozdíl od EMP pickupu nechává krystaly (killy jdou normální dying cestou).

const Ultimate = (() => {
  const CHARGE_MAX = 25;     // kill-bodů do plného nabití
  const WAVE_DMG   = 8;
  const WAVE_SPEED = 22;     // px / frame expanze

  let charge = 0;
  let wave   = null;         // { x, y, r, hitSet, bossHit }
  let flashT = 0;            // záblesk HUD při naplnění

  function reset() { charge = 0; wave = null; flashT = 0; }

  function addCharge(n) {
    if (wave) return;
    const before = charge;
    charge = Math.min(CHARGE_MAX, charge + n);
    if (before < CHARGE_MAX && charge >= CHARGE_MAX) {
      flashT = 45;
      if (typeof Audio !== 'undefined') Audio.sfx('rare');
      if (typeof UI !== 'undefined') UI.showNotify('💥 NOVA PŘIPRAVENA — MEZERNÍK / TAP', '#00ffc8');
    }
  }

  function isReady() { return charge >= CHARGE_MAX && !wave; }

  function fire(px, py) {
    if (!isReady()) return false;
    charge = 0;
    wave = { x: px, y: py, r: 12, hitSet: new Set(), bossHit: false };
    if (typeof Audio !== 'undefined') Audio.sfx('emp');
    return true;
  }

  function update(W, H) {
    if (flashT > 0) flashT--;
    if (!wave) return;
    wave.r += WAVE_SPEED;

    // Damage sweep — každý nepřítel dostane zásah, když ho vlna mine
    const list = Enemies.list;
    for (const e of list) {
      if (wave.hitSet.has(e)) continue;
      if (Utils.dist(wave.x, wave.y, e.x, e.y) <= wave.r) {
        wave.hitSet.add(e);
        e.hp -= WAVE_DMG;
        Particles.spawn(e.x, e.y, '#00ffc8', 10);
      }
    }

    // Boss — jednorázově 10 % max HP (cap, ať NOVA není I-win button)
    if (!wave.bossHit && typeof Boss !== 'undefined' && Boss.active) {
      const bt = Boss.asBossTarget();
      if (bt && Utils.dist(wave.x, wave.y, bt.x, bt.y) <= wave.r) {
        wave.bossHit = true;
        bt.takeDmg(Math.ceil(Boss.maxHp * 0.10));
      }
    }

    if (wave.r > Math.max(W, H) * 1.25) wave = null;
  }

  // Expandující vlna — kreslí se mezi nepřáteli a hráčem
  function draw(ctx) {
    if (!wave) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,200,0.85)';
    ctx.lineWidth   = 5;
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur  = 24;
    ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,255,230,0.35)';
    ctx.lineWidth   = 14;
    ctx.shadowBlur  = 0;
    ctx.beginPath(); ctx.arc(wave.x, wave.y, Math.max(1, wave.r - 12), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Kruhový meter vlevo dole nad spodním HUD barem
  function drawHUD(ctx, W, H, frameCount) {
    const x = 48, y = H - 100, r = 17;
    const pct   = charge / CHARGE_MAX;
    const ready = isReady();
    const pulse = ready ? 0.7 + 0.3 * Math.sin(frameCount * 0.18) : 1;

    ctx.save();
    ctx.lineCap = 'round';

    // Podklad
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth   = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

    // Progress oblouk
    if (pct > 0) {
      ctx.strokeStyle = ready ? `rgba(0,255,200,${pulse})` : 'rgba(0,200,170,0.75)';
      ctx.shadowColor = '#00ffc8';
      ctx.shadowBlur  = ready ? 16 * pulse : 6;
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Flash při naplnění
    if (flashT > 0) {
      ctx.globalAlpha = flashT / 45;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 6 + (45 - flashT) * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Střed
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (ready) {
      ctx.font        = '900 11px Orbitron, monospace';
      ctx.fillStyle   = `rgba(0,255,200,${pulse})`;
      ctx.shadowColor = '#00ffc8';
      ctx.shadowBlur  = 10;
      ctx.fillText('NOVA', x, y);
      ctx.shadowBlur  = 0;
    } else {
      ctx.font      = '700 9px Orbitron, monospace';
      ctx.fillStyle = 'rgba(180,220,230,0.55)';
      ctx.fillText(`${Math.round(pct * 100)}%`, x, y);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  return {
    reset, addCharge, isReady, fire, update, draw, drawHUD,
    get charge()     { return charge; },
    get max()        { return CHARGE_MAX; },
    get waveActive() { return !!wave; },
  };
})();
