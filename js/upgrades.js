// ─── VOID RUNNER — UPGRADES (Card Selection) ────────────────────────────────

const Upgrades = (() => {
  let showing = false;
  let cards = [];
  let onSelect = null;
  let animIn = 0;       // 0→1 fade-in animation
  let hovered = -1;
  let title = 'VYBER VYLEPŠENÍ';

  const CARD_W = 200;
  const CARD_H = 260;
  const CARD_GAP = 24;
  const CARD_COUNT = 3;

  // Track which upgrades have been applied (to avoid duplicates for unlocks)
  const applied = new Set();

  function show(W, H, callback, customTitle) {
    showing = true;
    animIn = 0;
    onSelect = callback;
    title = customTitle || 'VYBER VYLEPŠENÍ';
    hovered = -1;

    // Pick CARD_COUNT unique cards
    const pool = CFG.UPGRADE_CARDS.filter(c => {
      if (c.type === 'weapon' && applied.has(c.id)) return false;
      return true;
    });
    cards = Utils.pickN(pool, CARD_COUNT);
    _setupMouseHandlers(W, H);
  }

  function hide() {
    showing = false;
    _removeMouseHandlers();
  }

  function _cardX(i, W) {
    const total = CARD_COUNT * CARD_W + (CARD_COUNT - 1) * CARD_GAP;
    return W / 2 - total / 2 + i * (CARD_W + CARD_GAP);
  }
  function _cardY(H) {
    return H / 2 - CARD_H / 2;
  }

  // Mouse / click handlers
  let _mouseMove, _mouseClick;
  function _setupMouseHandlers(W, H) {
    _mouseMove = e => {
      const mx = e.clientX, my = e.clientY;
      const cy = _cardY(H);
      hovered = -1;
      for (let i = 0; i < cards.length; i++) {
        const cx = _cardX(i, W);
        if (mx >= cx && mx <= cx + CARD_W && my >= cy && my <= cy + CARD_H) {
          hovered = i; break;
        }
      }
    };
    _mouseClick = e => {
      if (!showing) return;
      const mx = e.clientX, my = e.clientY;
      const cy = _cardY(H);
      for (let i = 0; i < cards.length; i++) {
        const cx = _cardX(i, W);
        if (mx >= cx && mx <= cx + CARD_W && my >= cy && my <= cy + CARD_H) {
          _selectCard(i);
          break;
        }
      }
    };
    window.addEventListener('mousemove', _mouseMove);
    window.addEventListener('click', _mouseClick);

    // Keyboard 1/2/3
    _keyHandler = e => {
      if (!showing) return;
      if (e.code === 'Digit1') _selectCard(0);
      if (e.code === 'Digit2') _selectCard(1);
      if (e.code === 'Digit3') _selectCard(2);
    };
    window.addEventListener('keydown', _keyHandler);
  }
  let _keyHandler;
  function _removeMouseHandlers() {
    window.removeEventListener('mousemove', _mouseMove);
    window.removeEventListener('click', _mouseClick);
    window.removeEventListener('keydown', _keyHandler);
  }

  function _selectCard(i) {
    if (i < 0 || i >= cards.length) return;
    const card = cards[i];
    applied.add(card.id);
    hide();
    onSelect && onSelect(card);
  }

  function update() {
    if (!showing) return;
    if (animIn < 1) animIn = Math.min(1, animIn + 0.05);
  }

  function draw(ctx, W, H, frameCount) {
    if (!showing) return;

    const alpha = animIn;

    // Dark overlay
    ctx.fillStyle = `rgba(10, 10, 15, ${0.85 * alpha})`;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.fillStyle = '#00ffc8';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffc8';
    ctx.shadowBlur = 20;
    ctx.fillText(title, W / 2, H / 2 - CARD_H / 2 - 40);
    ctx.fillStyle = '#ffffff55';
    ctx.font = '13px Rajdhani, sans-serif';
    ctx.fillText('KLÁVESY  1 · 2 · 3  nebo KLIKNI', W / 2, H / 2 - CARD_H / 2 - 16);
    ctx.shadowBlur = 0;

    const cy = _cardY(H);

    cards.forEach((card, i) => {
      const cx = _cardX(i, W);
      const isHov = hovered === i;
      const hovOff = isHov ? -8 : 0;

      // Card background
      ctx.shadowColor = card.color;
      ctx.shadowBlur = isHov ? 30 : 12;
      ctx.fillStyle = isHov ? '#1a1a2e' : '#12121f';
      ctx.strokeStyle = card.color + (isHov ? 'ff' : '88');
      ctx.lineWidth = 2;
      _roundRect(ctx, cx, cy + hovOff, CARD_W, CARD_H, 12);
      ctx.fill();
      ctx.stroke();

      // Top accent bar
      ctx.fillStyle = card.color;
      ctx.shadowBlur = 0;
      _roundRect(ctx, cx, cy + hovOff, CARD_W, 4, { tl: 12, tr: 12, bl: 0, br: 0 });
      ctx.fill();

      // Icon
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(card.icon, cx + CARD_W / 2, cy + hovOff + 80);

      // Name
      ctx.font = 'bold 14px Orbitron, monospace';
      ctx.fillStyle = card.color;
      ctx.shadowColor = card.color;
      ctx.shadowBlur = 8;
      ctx.fillText(card.name, cx + CARD_W / 2, cy + hovOff + 118);
      ctx.shadowBlur = 0;

      // Type badge
      const badgeText = card.type === 'weapon' ? 'NOVÁ ZBRAŇ' : 'VYLEPŠENÍ';
      ctx.font = '10px Orbitron, monospace';
      ctx.fillStyle = card.type === 'weapon' ? '#ff3388' : '#00ffc888';
      ctx.fillText(badgeText, cx + CARD_W / 2, cy + hovOff + 136);

      // Description
      ctx.font = '13px Rajdhani, sans-serif';
      ctx.fillStyle = '#ffffffcc';
      _wrapText(ctx, card.desc, cx + CARD_W / 2, cy + hovOff + 162, CARD_W - 24, 18);

      // Keyboard hint
      ctx.font = 'bold 12px Orbitron, monospace';
      ctx.fillStyle = card.color + '88';
      ctx.fillText(`[${i + 1}]`, cx + CARD_W / 2, cy + hovOff + CARD_H - 16);
    });

    ctx.globalAlpha = 1;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    const radius = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r;
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + w - radius.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
    ctx.lineTo(x + w, y + h - radius.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
    ctx.lineTo(x + radius.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  }

  function _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, cx, y);
        line = words[i] + ' ';
        y += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, cx, y);
  }

  function reset() {
    applied.clear();
    showing = false;
    cards = [];
  }

  return { show, hide, update, draw, reset, get showing() { return showing; } };
})();
