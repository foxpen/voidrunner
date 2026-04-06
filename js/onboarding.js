// ── ONBOARDING OVERLAY ──────────────────────────────────────────────────────
// Self-contained module. Call Onboarding.start(callback) to show the overlay,
// callback is fired after the player finishes and "LETĚT" is clicked.

const Onboarding = (() => {

  // ── DATA ──────────────────────────────────────────────────────────────────
  const SHIPS = [
    {
      id: 'scout',
      name: 'PRŮZKUMNÍK',
      desc: 'Rychlá a obratná.\nIdeal pro vyhýbání.',
      color: '#00ffc8',
      stats: { speed: 0.9, armor: 0.3, firepower: 0.5 },
      shape: 'scout',
    },
    {
      id: 'fighter',
      name: 'BOJOVNÍK',
      desc: 'Vyvážená loď.\nPro zkušené piloty.',
      color: '#ff8c00',
      stats: { speed: 0.6, armor: 0.6, firepower: 0.8 },
      shape: 'fighter',
    },
    {
      id: 'tank',
      name: 'PEVNOST',
      desc: 'Pomalá, ale odolná.\nVydrží víc zásahů.',
      color: '#ff3355',
      stats: { speed: 0.35, armor: 0.95, firepower: 0.6 },
      shape: 'tank',
    },
  ];

  const MODES = [
    {
      id: 'story',
      name: 'PŘÍBĚH',
      icon: '🌌',
      desc: '10 kol s rostoucí\nobtížností.\nFinální boss fight.',
      color: '#00ffc8',
    },
    {
      id: 'endless',
      name: 'ENDLESS',
      icon: '♾️',
      desc: 'Nekonečná prázdnota.\nPřežij co nejdéle.\nŽádná milost.',
      color: '#ff8c00',
    },
    {
      id: 'hardcore',
      name: 'HARDCORE',
      icon: '💀',
      desc: 'Jeden život.\nŽádné chyby.\nJen pro odvážné.',
      color: '#ff3355',
    },
  ];

  // ── STATE ─────────────────────────────────────────────────────────────────
  let _onComplete   = null;
  let _currentScreen = null;
  let _selectedShip = null;
  let _selectedMode = null;
  let _playerName   = '';

  // ── SHIP CANVAS STATE ─────────────────────────────────────────────────────
  let _shipCanvas = null;
  let _shipCtx    = null;
  let _ssW = 0, _ssH = 0;
  let _ssShips   = [];
  let _ssActive  = false;
  let _ssChosen  = -1;
  let _ssHovered = -1;
  let _ssFrame   = 0;
  let _ssRafId   = null;

  // ── OVERLAY HELPERS ───────────────────────────────────────────────────────
  function _overlay()  { return document.getElementById('onboarding-overlay'); }
  function _el(id)     { return document.getElementById(id); }

  function _showScreen(id) {
    if (_currentScreen) {
      const prev = _el('ob-' + _currentScreen);
      if (prev) prev.classList.remove('ob-active');
    }
    _currentScreen = id;
    const next = _el('ob-' + id);
    if (next) next.classList.add('ob-active');
    // Back button visibility
    const back = _el('ob-btn-back');
    if (back) back.classList.toggle('ob-back-visible', id !== 'name');
  }

  function _fadeTo(fn) {
    const f = _el('ob-fade');
    if (!f) { fn(); return; }
    f.style.transition = 'opacity 0.5s ease';
    f.classList.add('ob-black');
    setTimeout(() => {
      fn();
      f.style.transition = 'opacity 0.7s ease';
      f.classList.remove('ob-black');
    }, 600);
  }

  // ── SHIP CANVAS FUNCTIONS ─────────────────────────────────────────────────
  function _ssResize() {
    if (!_shipCanvas) return;
    _ssW = _shipCanvas.width  = _shipCanvas.offsetWidth  || window.innerWidth;
    _ssH = _shipCanvas.height = _shipCanvas.offsetHeight || window.innerHeight;
  }

  function _ssTargetPos(i) {
    const narrow = _ssW < 600;
    if (narrow) {
      return [
        { x: _ssW * 0.50, y: _ssH * 0.28 },
        { x: _ssW * 0.25, y: _ssH * 0.58 },
        { x: _ssW * 0.75, y: _ssH * 0.58 },
      ][i];
    } else {
      const spread = Math.min(_ssW * 0.26, 280);
      const offsets = [-spread, 0, spread];
      return { x: _ssW * 0.5 + offsets[i], y: _ssH * 0.46 };
    }
  }

  function _ssStartPos(i) {
    const dirs = [
      { x: _ssW * 0.5, y: -250 },
      { x: -250,       y: _ssH * 0.8 },
      { x: _ssW + 250, y: _ssH * 0.8 },
    ];
    return dirs[i] || dirs[0];
  }

  function _ssHitRadius(i) {
    const ship = SHIPS[i];
    const cfg  = _shipCfg(ship.shape);
    return 52 * Math.max(cfg.sw, cfg.sh);
  }

  function _startShipSelect() {
    _ssActive  = true;
    _ssChosen  = -1;
    _ssHovered = -1;
    _ssFrame   = 0;
    if (typeof BG !== 'undefined') BG.showSwarm(false);
    // Explicitly show title/sub (may have been hidden from a previous call)
    const titleEl = _el('ob-ship-title');
    const subEl   = _el('ob-ship-sub');
    if (titleEl) titleEl.style.display = '';
    if (subEl)   subEl.style.display   = '';

    _ssShips = SHIPS.map((def, i) => {
      const start  = _ssStartPos(i);
      const target = _ssTargetPos(i);
      return {
        def,
        x: start.x, y: start.y,
        tx: target.x, ty: target.y,
        vx: 0, vy: 0,
        alpha: 0,
        bobPhase: Math.random() * Math.PI * 2,
        state: 'flying_in',
        exhaustFlicker: 0,
      };
    });

    _shipCanvas.classList.add('ob-ss-active');
    _el('ob-ship-title').classList.add('ob-show');
    _el('ob-ship-sub').classList.add('ob-show');

    _shipCanvas.addEventListener('mousemove', _ssOnMove);
    _shipCanvas.addEventListener('click',     _ssOnClick);
    _shipCanvas.addEventListener('touchstart', _ssOnTouch, { passive: true });

    _ssLoop();
  }

  function _stopShipSelect() {
    _ssActive = false;
    if (typeof BG !== 'undefined') BG.showSwarm(true);
    if (_ssRafId) { cancelAnimationFrame(_ssRafId); _ssRafId = null; }
    _shipCanvas.classList.remove('ob-ss-active');
    const titleEl = _el('ob-ship-title');
    const subEl   = _el('ob-ship-sub');
    if (titleEl) { titleEl.classList.remove('ob-show'); titleEl.style.display = 'none'; }
    if (subEl)   { subEl.classList.remove('ob-show');   subEl.style.display   = 'none'; }
    _shipCanvas.removeEventListener('mousemove', _ssOnMove);
    _shipCanvas.removeEventListener('click',     _ssOnClick);
    _shipCanvas.removeEventListener('touchstart', _ssOnTouch);
    if (_shipCtx) _shipCtx.clearRect(0, 0, _ssW, _ssH);
  }

  function _ssOnMove(e) {
    if (!_ssActive || _ssChosen >= 0) return;
    const mx = e.clientX, my = e.clientY;
    _ssHovered = -1;
    _ssShips.forEach((s, i) => {
      if (s.state !== 'settled') return;
      const d = Math.hypot(mx - s.x, my - s.y);
      if (d < _ssHitRadius(i)) _ssHovered = i;
    });
  }

  function _ssOnTouch(e) {
    if (!_ssActive || _ssChosen >= 0) return;
    const t = e.touches[0];
    const mx = t.clientX, my = t.clientY;
    _ssHovered = -1;
    _ssShips.forEach((s, i) => {
      if (s.state !== 'settled') return;
      const d = Math.hypot(mx - s.x, my - s.y);
      if (d < _ssHitRadius(i) * 1.3) _ssHovered = i;
    });
    if (_ssHovered >= 0) _ssPickShip(_ssHovered);
  }

  function _ssOnClick(e) {
    if (!_ssActive || _ssChosen >= 0) return;
    const mx = e.clientX, my = e.clientY;
    _ssShips.forEach((s, i) => {
      if (s.state !== 'settled') return;
      const d = Math.hypot(mx - s.x, my - s.y);
      if (d < _ssHitRadius(i)) _ssPickShip(i);
    });
  }

  function _ssPickShip(i) {
    if (_ssChosen >= 0) return;
    _ssChosen    = i;
    _selectedShip = SHIPS[i].id;

    _ssShips.forEach((s, idx) => {
      if (idx === i) {
        s.state = 'chosen';
      } else {
        s.state = 'flying_away';
        const sp = _ssStartPos(idx);
        const dx = sp.x - s.x, dy = sp.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        s.vx = (dx / len) * 8;
        s.vy = (dy / len) * 8;
      }
    });

    setTimeout(() => {
      const btn = _el('ob-btn-fly');
      if (btn) btn.classList.add('ob-ready');
    }, 600);
  }

  function _tickShipSelect() {
    if (!_ssActive) return;
    _ssFrame++;

    _ssShips.forEach((s, i) => {
      s.bobPhase += 0.025;
      s.exhaustFlicker = Math.random();

      if (s.state === 'flying_in') {
        s.alpha = Math.min(1, s.alpha + 0.018);
        const dx = s.tx - s.x, dy = s.ty - s.y;
        s.vx = s.vx * 0.88 + dx * 0.045;
        s.vy = s.vy * 0.88 + dy * 0.045;
        s.x += s.vx; s.y += s.vy;
        if (Math.hypot(dx, dy) < 3 && Math.hypot(s.vx, s.vy) < 0.8) {
          s.x = s.tx; s.y = s.ty; s.vx = 0; s.vy = 0;
          s.state = 'settled';
        }
      } else if (s.state === 'settled') {
        const bob    = Math.sin(s.bobPhase) * 5;
        const hovOff = _ssHovered === i ? -8 : 0;
        s.displayY   = s.ty + bob + hovOff;
        s.displayX   = s.x;
      } else if (s.state === 'chosen') {
        const cx2 = _ssW * 0.5, cy2 = _ssH * 0.45;
        s.x += (cx2 - s.x) * 0.02;
        s.y += (cy2 - s.y) * 0.02;
        const bob  = Math.sin(s.bobPhase) * 3;
        s.displayX = s.x;
        s.displayY = s.y + bob;
      } else if (s.state === 'flying_away') {
        s.vx *= 1.06; s.vy *= 1.06;
        s.x += s.vx; s.y += s.vy;
        s.alpha = Math.max(0, s.alpha - 0.025);
      }
    });
  }

  function _drawShipSelect() {
    if (!_ssActive || !_shipCtx) return;
    _shipCtx.clearRect(0, 0, _ssW, _ssH);

    let hoveredShip = null;
    _ssShips.forEach((s, i) => {
      if (s.alpha <= 0) return;
      const dx = s.displayX !== undefined ? s.displayX : s.x;
      const dy = s.displayY !== undefined ? s.displayY : s.y;
      _shipCtx.globalAlpha = s.state === 'flying_away' ? s.alpha * s.alpha : s.alpha;
      const isHov    = _ssHovered === i;
      const isChosen = _ssChosen  === i;
      const ship     = SHIPS[i];
      _ssDrawShip(_shipCtx, ship, dx, dy, isHov || isChosen, s.exhaustFlicker, _ssFrame);
      if ((isHov && _ssChosen < 0) || isChosen) hoveredShip = { ship, s };
      _shipCtx.globalAlpha = 1;
    });

    if (hoveredShip) {
      _ssDrawStats(_shipCtx, hoveredShip.ship, _ssW, _ssH);
    }

    if (_ssChosen < 0 && _ssShips.every(s => s.state === 'settled') && !hoveredShip) {
      _shipCtx.globalAlpha = 0.30 + 0.20 * Math.sin(_ssFrame * 0.05);
      _shipCtx.font = '11px Orbitron, monospace';
      _shipCtx.fillStyle = '#aaccff';
      _shipCtx.textAlign = 'center';
      _shipCtx.fillText('KLIKNI NA LOĎ', _ssW / 2, _ssH * 0.86);
      _shipCtx.globalAlpha = 1;
    }
  }

  let _ssLastTime = 0;
  function _ssLoop(now) {
    if (!_ssActive) return;
    _tickShipSelect();
    _drawShipSelect();
    _ssRafId = requestAnimationFrame(_ssLoop);
  }

  // ── SHIP DRAWING ──────────────────────────────────────────────────────────
  function _shipCfg(shape) {
    return {
      scout:   { sw: 1.0,  sh: 1.15, noseH: 1.15 },
      fighter: { sw: 1.0,  sh: 1.0,  noseH: 1.0  },
      tank:    { sw: 1.25, sh: 0.85, noseH: 0.75  },
    }[shape] || { sw: 1.0, sh: 1.0, noseH: 1.0 };
  }

  function _ssDrawShip(ctx, ship, ox, oy, highlighted, exhaustFlicker, frame) {
    const cfg = _shipCfg(ship.shape);
    const sc  = ship.color;
    const pw  = 42 * cfg.sw;
    const ph  = 56 * cfg.sh;

    ctx.save();
    ctx.translate(ox, oy);

    // Outer halo
    const halo = ctx.createRadialGradient(0, 0, pw * 0.3, 0, 0, pw * (highlighted ? 3.0 : 2.0));
    halo.addColorStop(0, sc + (highlighted ? '44' : '22'));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, pw * 3.0, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = sc;
    ctx.shadowBlur  = highlighted ? 28 : 18;

    // Outer wing panels
    ctx.fillStyle   = '#0a1a2a';
    ctx.strokeStyle = sc + (highlighted ? 'cc' : '77');
    ctx.lineWidth   = highlighted ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(-pw*0.55, ph*0.08); ctx.lineTo(-pw*1.35, ph*0.42);
    ctx.lineTo(-pw*1.1,  ph*0.62); ctx.lineTo(-pw*0.55, ph*0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( pw*0.55, ph*0.08); ctx.lineTo( pw*1.35, ph*0.42);
    ctx.lineTo( pw*1.1,  ph*0.62); ctx.lineTo( pw*0.55, ph*0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Main hull
    ctx.fillStyle   = '#0d2035';
    ctx.strokeStyle = sc;
    ctx.lineWidth   = highlighted ? 2 : 1.5;
    ctx.shadowBlur  = highlighted ? 28 : 18;
    ctx.beginPath();
    ctx.moveTo(0,           -ph*cfg.noseH);
    ctx.lineTo(-pw*0.28,   -ph*0.4);
    ctx.lineTo(-pw*0.55,    ph*0.08);
    ctx.lineTo(-pw*0.72,    ph*0.48);
    ctx.lineTo(-pw*0.42,    ph*0.58);
    ctx.lineTo(-pw*0.18,    ph*0.48);
    ctx.lineTo(0,            ph*0.58);
    ctx.lineTo( pw*0.18,    ph*0.48);
    ctx.lineTo( pw*0.42,    ph*0.58);
    ctx.lineTo( pw*0.72,    ph*0.48);
    ctx.lineTo( pw*0.55,    ph*0.08);
    ctx.lineTo( pw*0.28,   -ph*0.4);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Fuselage stripe
    ctx.fillStyle = sc + '33'; ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0,          -ph*0.75); ctx.lineTo(-pw*0.22, ph*0.05);
    ctx.lineTo(-pw*0.12,   ph*0.35);  ctx.lineTo(0,        ph*0.45);
    ctx.lineTo( pw*0.12,   ph*0.35);  ctx.lineTo( pw*0.22, ph*0.05);
    ctx.closePath(); ctx.fill();

    // Engine pods
    ctx.fillStyle = '#081828'; ctx.strokeStyle = sc + 'aa'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-pw*0.6, ph*0.3, pw*0.18, ph*0.22,  0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse( pw*0.6, ph*0.3, pw*0.18, ph*0.22, -0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#020810'; ctx.strokeStyle = sc + 'cc'; ctx.lineWidth = 1;
    ctx.shadowColor = sc; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0,          -ph*0.72*cfg.noseH);
    ctx.lineTo(-pw*0.2,   -ph*0.18);
    ctx.lineTo(0,           ph*0.05);
    ctx.lineTo( pw*0.2,   -ph*0.18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sc + 'cc'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, -ph*0.3, 3.5, 0, Math.PI*2); ctx.fill();

    // Accent lines
    ctx.shadowBlur = 0; ctx.strokeStyle = sc + '44'; ctx.lineWidth = 1;
    [-1, 1].forEach(side => {
      ctx.beginPath(); ctx.moveTo(side*pw*0.3, -ph*0.15); ctx.lineTo(side*pw*0.65, ph*0.35); ctx.stroke();
    });

    // Wing-tip lights
    const bl = Math.floor(frame / 18) % 2;
    ctx.shadowBlur = 12;
    ctx.fillStyle = bl ? '#ff4455' : '#ff334422';
    ctx.beginPath(); ctx.arc(-pw*1.3, ph*0.44, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = bl ? '#44ff88' : '#33ff5522';
    ctx.beginPath(); ctx.arc( pw*1.3, ph*0.44, 3, 0, Math.PI*2); ctx.fill();

    // Engine exhaust
    ctx.shadowBlur = 0;
    const fl  = (12 + exhaustFlicker * 20) * (highlighted ? 1.4 : 1);
    const flC = highlighted ? sc : sc + 'aa';
    const exGrad = ctx.createLinearGradient(0, ph*0.58, 0, ph*0.58 + fl);
    exGrad.addColorStop(0, flC);
    exGrad.addColorStop(1, 'rgba(0,60,200,0)');
    ctx.fillStyle = exGrad;
    ctx.beginPath(); ctx.moveTo(-6, ph*0.58); ctx.lineTo(0, ph*0.58+fl); ctx.lineTo(6, ph*0.58);
    ctx.closePath(); ctx.fill();
    // Side engine exhausts
    const fl2 = (6 + exhaustFlicker * 10) * (highlighted ? 1.3 : 1);
    [-pw*0.42, pw*0.42].forEach(ex => {
      const eg2 = ctx.createLinearGradient(ex, ph*0.58, ex, ph*0.58 + fl2);
      eg2.addColorStop(0, sc + '99'); eg2.addColorStop(1, 'rgba(0,60,200,0)');
      ctx.fillStyle = eg2;
      ctx.beginPath(); ctx.moveTo(ex-3.5, ph*0.58); ctx.lineTo(ex, ph*0.58+fl2); ctx.lineTo(ex+3.5, ph*0.58);
      ctx.closePath(); ctx.fill();
    });

    ctx.restore();
  }

  function _ssDrawStats(ctx, ship, W, H) {
    const panelW = Math.min(420, W * 0.82);
    const panelH = 110;
    const px     = W / 2 - panelW / 2;
    const py     = H - panelH - 28;

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = '#060c18';
    _ssRoundRect(ctx, px, py, panelW, panelH, 10); ctx.fill();
    ctx.strokeStyle = ship.color + '99';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = ship.color; ctx.shadowBlur = 14;
    _ssRoundRect(ctx, px, py, panelW, panelH, 10); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = ship.color;
    _ssRoundRect(ctx, px, py, panelW, 3, { tl: 10, tr: 10, bl: 0, br: 0 }); ctx.fill();

    const textX = px + 16;
    ctx.font = 'bold 15px Orbitron, monospace';
    ctx.fillStyle = ship.color; ctx.textAlign = 'left';
    ctx.shadowColor = ship.color; ctx.shadowBlur = 8;
    ctx.fillText(ship.name, textX, py + 26); ctx.shadowBlur = 0;

    ctx.font = '12px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffffaa';
    ship.desc.split('\n').forEach((line, i) => ctx.fillText(line, textX, py + 46 + i * 16));

    const barsX = px + panelW * 0.46;
    const barsW = panelW * 0.50;
    ['speed', 'armor', 'firepower'].forEach((key, i) => {
      const val = ship.stats[key];
      const by  = py + 22 + i * 28;
      ctx.font = '9px Orbitron, monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff55';
      ctx.fillText(key.toUpperCase(), barsX, by);
      ctx.fillStyle = '#ffffff18'; ctx.fillRect(barsX, by + 5, barsW - 40, 5);
      ctx.fillStyle = ship.color; ctx.shadowColor = ship.color; ctx.shadowBlur = 5;
      ctx.fillRect(barsX, by + 5, (barsW - 40) * val, 5); ctx.shadowBlur = 0;
      ctx.font = '10px Orbitron, monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${Math.round(val * 100)}%`, px + panelW - 10, by + 1);
    });

    ctx.globalAlpha = 1;
  }

  function _ssRoundRect(ctx, x, y, w, h, r) {
    if (typeof r === 'object') {
      const { tl = 0, tr = 0, br = 0, bl = 0 } = r;
      ctx.beginPath();
      ctx.moveTo(x + tl, y);
      ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
      ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
      ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
      ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  // ── MODE BUILDER ──────────────────────────────────────────────────────────
  function _buildModes() {
    const row = _el('ob-modes-row');
    if (!row) return;
    row.innerHTML = '';
    MODES.forEach(mode => {
      const card = document.createElement('div');
      card.className = 'ob-mode-card';
      card.style.setProperty('--ob-mode-color', mode.color);
      card.innerHTML = `
        <div class="ob-mode-icon">${mode.icon}</div>
        <div class="ob-mode-name">${mode.name}</div>
        <div class="ob-mode-desc">${mode.desc.replace(/\n/g, '<br>')}</div>
      `;
      card.addEventListener('click', () => {
        row.querySelectorAll('.ob-mode-card').forEach(c => c.classList.remove('ob-selected'));
        card.classList.add('ob-selected');
        _selectedMode = mode.id;
        const btn = _el('ob-btn-launch');
        if (btn) btn.classList.add('ob-ready');
      });
      row.appendChild(card);
    });
  }

  // ── EVENT WIRING ──────────────────────────────────────────────────────────
  function _wireEvents() {
    // NAME — confirm → goes to MODE
    const btnNameNext = _el('ob-btn-name-next');
    if (btnNameNext) {
      btnNameNext.addEventListener('click', _goToMode);
    }
    const nameInput = _el('ob-name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') _goToMode();
      });
    }

    // MODE — next → goes to SHIP selection
    const btnLaunch = _el('ob-btn-launch');
    if (btnLaunch) {
      btnLaunch.addEventListener('click', () => {
        if (!_selectedMode) return;
        _fadeTo(() => {
          _showScreen('ship');
          _ssResize();
          _startShipSelect();
        });
      });
    }

    // SHIP — LETĚT → save + start game directly (no page reload)
    const btnFly = _el('ob-btn-fly');
    if (btnFly) {
      btnFly.addEventListener('click', () => {
        if (!_selectedShip) return;
        btnFly.classList.remove('ob-ready');
        localStorage.setItem('vr_player', JSON.stringify({
          name: _playerName,
          ship: _selectedShip,
          mode: _selectedMode,
        }));
        // Fade out overlay then start game directly
        const fade = _el('ob-fade');
        if (fade) {
          fade.style.transition = 'opacity 0.4s ease';
          fade.classList.add('ob-black');
          setTimeout(() => {
            _stopShipSelect();
            _hide();
            if (_onComplete) _onComplete();
          }, 420);
        } else {
          _stopShipSelect();
          _hide();
          if (_onComplete) _onComplete();
        }
      });
    }

    // BACK button — prev map updated for new order
    const btnBack = _el('ob-btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        const prev = { 'mode': 'name', 'ship': 'mode' };
        const p = prev[_currentScreen];
        if (!p) return;
        if (_currentScreen === 'ship') {
          _stopShipSelect();
          _el('ob-btn-fly').classList.remove('ob-ready');
          _selectedShip = null;
          _fadeTo(() => _showScreen(p));
        } else {
          _fadeTo(() => _showScreen(p));
        }
      });
    }

    // Resize
    window.addEventListener('resize', () => {
      if (_ssActive) {
        _ssResize();
        _ssShips.forEach((s, i) => {
          const t = _ssTargetPos(i);
          s.tx = t.x; s.ty = t.y;
          // Snap already-settled ships to new position immediately
          if (s.state === 'settled' || s.state === 'chosen') {
            s.x = t.x; s.y = t.y;
          }
        });
      }
    });
  }

  function _goToMode() {
    const input = _el('ob-name-input');
    const val   = input ? input.value.trim().toUpperCase() : '';
    if (!val) { if (input) input.focus(); return; }
    _playerName = val;
    _fadeTo(() => {
      _buildModes();
      _showScreen('mode');
    });
  }

  // ── SHOW / HIDE ───────────────────────────────────────────────────────────
  function _show() {
    const ov = _overlay();
    if (!ov) return;
    ov.classList.add('ob-visible');
    // Reset state
    _currentScreen = null;
    _selectedShip  = null;
    _selectedMode  = null;
    _playerName    = '';
    const inp = _el('ob-name-input');
    if (inp) inp.value = '';
    const btnFly = _el('ob-btn-fly');
    if (btnFly) btnFly.classList.remove('ob-ready');
    const btnLaunch = _el('ob-btn-launch');
    if (btnLaunch) btnLaunch.classList.remove('ob-ready');
    // Grab canvas refs
    _shipCanvas = _el('ship-canvas-ob');
    if (_shipCanvas) _shipCtx = _shipCanvas.getContext('2d');
    _ssResize();
    // Show name screen first
    _fadeTo(() => _showScreen('name'));
  }

  function _hide() {
    const ov = _overlay();
    if (ov) ov.classList.remove('ob-visible');
    _stopShipSelect();
    // Reset back button
    const back = _el('ob-btn-back');
    if (back) back.classList.remove('ob-back-visible');
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  let _eventsWired = false;

  function start(onCompleteCallback) {
    _onComplete = onCompleteCallback || null;
    if (!_eventsWired) {
      _eventsWired = true;
      _wireEvents();
    }
    _show();
  }

  function stop() {
    _hide();
  }

  return { start, stop };

})();
