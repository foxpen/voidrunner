// ─── VOID RUNNER — HANGÁR (meta shop) ───────────────────────────────────────

const Hangar = (() => {
  const LS_CRYSTALS = 'vr_crystals';
  const LS_HANGAR   = 'vr_hangar';

  let _crystals = 0;
  let _levels   = {};
  let _showing  = false;
  let _hoverIdx = 0;
  let _onClose  = null;
  let _buyFlash = {};   // { id: framesLeft }

  // ── Persistence ────────────────────────────────────────────────────────────
  function load() {
    _crystals = parseInt(localStorage.getItem(LS_CRYSTALS) || '0') || 0;
    const saved = JSON.parse(localStorage.getItem(LS_HANGAR) || '{}');
    _levels = {};
    CFG.HANGAR.forEach(item => { _levels[item.id] = saved[item.id] || 0; });
  }

  function save() {
    localStorage.setItem(LS_CRYSTALS, String(_crystals));
    localStorage.setItem(LS_HANGAR, JSON.stringify(_levels));
  }

  function addCrystals(n) {
    load();
    _crystals += Math.round(n);
    save();
  }

  // ── Apply bonuses at run start ──────────────────────────────────────────────
  function applyBonuses() {
    load();
    CFG.HANGAR.forEach(item => {
      const lv = _levels[item.id] || 0;
      if (lv === 0) return;
      switch (item.id) {
        case 'hull':
        case 'engine':
        case 'armor':
        case 'scavenger':
        case 'warhead':
          Player.applyHangarBonus(item.id, lv);
          break;
        case 'cannon':
          Weapons.unlockWeapon('basic');   // ensures basic starts equipped
          break;
      }
    });
  }

  // ── Show / Hide ─────────────────────────────────────────────────────────────
  function show(onClose) {
    load();
    _showing  = true;
    _hoverIdx = 0;
    _buyFlash = {};
    _onClose  = onClose || null;

    // Key listeners
    _keyHandler = (e) => {
      if (!_showing) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        _hoverIdx = (_hoverIdx - 1 + CFG.HANGAR.length) % CFG.HANGAR.length;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        _hoverIdx = (_hoverIdx + 1) % CFG.HANGAR.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        _tryBuy(_hoverIdx);
      } else if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
        hide();
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  let _keyHandler = null;

  function hide() {
    _showing = false;
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    if (_onClose) { const cb = _onClose; _onClose = null; cb(); }
  }

  function _tryBuy(idx) {
    const item = CFG.HANGAR[idx];
    if (!item) return;
    const lv   = _levels[item.id] || 0;
    if (lv >= item.maxLevel) return;
    const cost = item.costs[lv];
    if (_crystals < cost) return;
    _crystals -= cost;
    _levels[item.id] = lv + 1;
    save();
    _buyFlash[item.id] = 40;
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw(ctx, W, H, frameCount) {
    if (!_showing) return;

    // Darken background
    ctx.fillStyle = 'rgba(0,1,6,0.88)';
    ctx.fillRect(0, 0, W, H);

    const panW  = Math.min(W * 0.78, 640);
    const panH  = Math.min(H * 0.82, 580);
    const panX  = W / 2 - panW / 2;
    const panY  = H / 2 - panH / 2;

    // Panel bg
    ctx.save();
    ctx.beginPath();
    _roundRect(ctx, panX, panY, panW, panH, 8);
    ctx.fillStyle   = 'rgba(4,8,18,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,80,255,0.22)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

    // Title
    ctx.textAlign = 'center';
    ctx.font      = `900 ${Math.min(26, W * 0.032)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 0;
    ctx.fillText('HANGÁR', W / 2, panY + 38);

    // Crystal count
    const cSz = Math.min(14, W * 0.018);
    ctx.font      = `700 ${cSz}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(200,120,255,0.90)';
    ctx.fillText(`◆ ${_crystals}  KRYSTALŮ`, W / 2, panY + 62);

    ctx.shadowBlur = 0;

    // Hint
    ctx.font      = `500 ${Math.min(9, W * 0.012)}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(160,200,210,0.32)';
    ctx.fillText('↑↓ NAVIGACE  ·  ENTER KOUPIT  ·  ESC ZAVŘÍT', W / 2, panY + panH - 14);

    // Items
    const rows      = CFG.HANGAR.length;
    const rowH      = (panH - 100) / rows;
    const itemX     = panX + 22;
    const itemW     = panW - 44;

    CFG.HANGAR.forEach((item, i) => {
      const iy    = panY + 80 + i * rowH;
      const lv    = _levels[item.id] || 0;
      const maxed = lv >= item.maxLevel;
      const cost  = maxed ? 0 : item.costs[lv];
      const canAfford = !maxed && _crystals >= cost;
      const isHover = i === _hoverIdx;
      const flashAlpha = (_buyFlash[item.id] > 0) ? Math.min(1, _buyFlash[item.id] / 15) : 0;
      if (_buyFlash[item.id] > 0) _buyFlash[item.id]--;

      // Row background
      ctx.save();
      ctx.beginPath();
      _roundRect(ctx, itemX, iy + 2, itemW, rowH - 4, 5);
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(160,80,255,${0.25 * flashAlpha})`;
      } else if (isHover) {
        ctx.fillStyle = 'rgba(140,60,240,0.12)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
      }
      ctx.fill();
      if (isHover) {
        ctx.strokeStyle = `rgba(${isHover ? '160,80,255' : '255,255,255'},${isHover ? 0.30 : 0.06})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      const midY  = iy + rowH / 2;
      const iconX = itemX + 22;
      const nameX = itemX + 48;

      // Icon
      ctx.font      = `${Math.min(18, rowH * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, iconX, midY + 6);

      // Name
      const nameSz = Math.min(12, W * 0.015);
      ctx.font      = `700 ${nameSz}px Orbitron, monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = maxed ? 'rgba(160,220,180,0.70)' : 'rgba(255,255,255,0.85)';
      ctx.fillText(item.name, nameX, midY - 4);

      // Desc
      ctx.font      = `500 ${Math.min(9, W * 0.012)}px Rajdhani, sans-serif`;
      ctx.fillStyle = 'rgba(180,200,210,0.50)';
      ctx.fillText(item.desc, nameX, midY + 11);

      // Level dots
      const dotX  = itemX + itemW - 140;
      ctx.textAlign = 'center';
      for (let d = 0; d < item.maxLevel; d++) {
        ctx.beginPath();
        ctx.arc(dotX + d * 14, midY, 4, 0, Math.PI * 2);
        ctx.fillStyle = d < lv
          ? item.color
          : 'rgba(255,255,255,0.12)';
        ctx.fill();
      }

      // Cost / Maxed
      const costX = itemX + itemW - 50;
      if (maxed) {
        ctx.font      = `700 ${Math.min(9, W * 0.011)}px Orbitron, monospace`;
        ctx.fillStyle = 'rgba(140,220,160,0.70)';
        ctx.fillText('MAX', costX, midY + 5);
      } else {
        ctx.font      = `700 ${Math.min(11, W * 0.013)}px Orbitron, monospace`;
        ctx.fillStyle = canAfford
          ? 'rgba(200,120,255,0.90)'
          : 'rgba(180,100,200,0.40)';
        ctx.fillText(`◆ ${cost}`, costX, midY + 5);
      }
    });
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Mouse click support
  function handleClick(mx, my, W, H) {
    if (!_showing) return;
    const panW  = Math.min(W * 0.78, 640);
    const panH  = Math.min(H * 0.82, 580);
    const panX  = W / 2 - panW / 2;
    const panY  = H / 2 - panH / 2;
    const rows  = CFG.HANGAR.length;
    const rowH  = (panH - 100) / rows;
    const itemX = panX + 22;
    const itemW = panW - 44;

    for (let i = 0; i < CFG.HANGAR.length; i++) {
      const iy = panY + 80 + i * rowH;
      if (mx >= itemX && mx <= itemX + itemW && my >= iy + 2 && my <= iy + rowH - 2) {
        _hoverIdx = i;
        _tryBuy(i);
        return;
      }
    }
    // Click outside — close
    if (mx < panX || mx > panX + panW || my < panY || my > panY + panH) {
      hide();
    }
  }

  return {
    get showing()  { return _showing; },
    get crystals() { return _crystals; },
    load, save, addCrystals, applyBonuses, show, hide, draw, handleClick,
  };
})();
