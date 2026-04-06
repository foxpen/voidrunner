// ─── VOID RUNNER — UPGRADES (Shop) ───────────────────────────────────────────
// Pick ONE upgrade per round, free of charge. No credits system.

const Upgrades = (() => {
  let showing = false;
  let cards   = [];
  let onPick  = null;
  let animIn  = 0;
  let hovered = -1;
  let title   = 'VYBER VYLEPŠENÍ';
  let legendaryFlash = 0;
  let picked  = false;   // true after user picks a card (prevents double-click)

  const CARD_COUNT = 3;
  const applied = new Set();

  // ── Responsive card sizing ──────────────────────────────────────────────────
  function _cardDims(W, H) {
    // Portrait/narrow: cards stack vertically
    const vertical = W < 560;
    if (vertical) {
      const cardW = Math.min(W - 32, 300);
      const cardH = Math.round(cardW * 0.48);
      const gap   = 10;
      return { cardW, cardH, gap, vertical };
    } else {
      const totalAvail = W - 48;
      const cardW = Math.min(200, Math.floor((totalAvail - 2 * 20) / 3));
      const cardH = Math.round(cardW * 1.35);
      const gap   = Math.min(24, Math.floor((totalAvail - cardW * 3) / 2));
      return { cardW, cardH, gap, vertical };
    }
  }

  function _cardPos(i, W, H) {
    const { cardW, cardH, gap, vertical } = _cardDims(W, H);
    if (vertical) {
      const totalH = CARD_COUNT * cardH + (CARD_COUNT - 1) * gap;
      const startY = H / 2 - totalH / 2 + 20; // slight offset for title
      return { x: W / 2 - cardW / 2, y: startY + i * (cardH + gap), cardW, cardH };
    } else {
      const totalW = CARD_COUNT * cardW + (CARD_COUNT - 1) * gap;
      const startX = W / 2 - totalW / 2;
      return { x: startX + i * (cardW + gap), y: H / 2 - cardH / 2 + 20, cardW, cardH };
    }
  }

  // ── Pool building ───────────────────────────────────────────────────────────
  function _buildPool(round) {
    return CFG.UPGRADE_CARDS.filter(c => {
      if (c.type === 'weapon' && applied.has(c.id)) return false;
      if ((c.minRound || 1) > round) return false;
      if (c.stat === 'dualFire'   && !Weapons.equipped.includes('basic'))  return false;
      if (c.stat === 'orbitCount' && !Weapons.equipped.includes('orbit'))  return false;
      if (c.stat === 'overdrive'  && Weapons.equipped.length < 2)          return false;
      return true;
    });
  }

  function _weightedPick(pool, n) {
    if (pool.length <= n) return [...pool];
    const result = [], remaining = [...pool];
    for (let i = 0; i < n && remaining.length > 0; i++) {
      const totalW = remaining.reduce((s, c) => s + (c.weight || 5), 0);
      let r = Math.random() * totalW, idx = 0;
      for (let j = 0; j < remaining.length; j++) {
        r -= (remaining[j].weight || 5);
        if (r <= 0) { idx = j; break; }
      }
      result.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return result;
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  function show(W, H, callback, customTitle) {
    showing = true;
    animIn  = 0;
    picked  = false;
    hovered = -1;
    onPick  = callback;
    title   = customTitle || 'VYBER VYLEPŠENÍ';
    legendaryFlash = 0;

    const round = (typeof Rounds !== 'undefined') ? Rounds.current : 1;

    if (!Weapons.equipped.includes('basic')) {
      const basicCard = CFG.UPGRADE_CARDS.find(c => c.id === 'unlock_basic');
      const rest = _buildPool(round).filter(c => c.id !== 'unlock_basic');
      cards = [basicCard, ..._weightedPick(rest, CARD_COUNT - 1)];
    } else {
      cards = _weightedPick(_buildPool(round), CARD_COUNT);
    }

    _setupHandlers(W, H);
  }

  // Alias kept for backward compat
  function showShop(W, H, onBuyCallback, onCloseCallback) {
    show(W, H, card => { onBuyCallback && onBuyCallback(card); if (onCloseCallback) setTimeout(onCloseCallback, 0); }, null);
  }

  function hide() {
    showing = false;
    _removeHandlers();
  }

  // ── Input handlers ──────────────────────────────────────────────────────────
  let _mouseMove, _mouseClick, _keyHandler;

  function _setupHandlers(W, H) {
    _mouseMove = e => {
      if (!showing) return;
      const mx = e.clientX, my = e.clientY;
      hovered = -1;
      for (let i = 0; i < cards.length; i++) {
        const { x, y, cardW, cardH } = _cardPos(i, W, H);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) { hovered = i; break; }
      }
    };

    _mouseClick = e => {
      if (!showing || picked) return;
      const mx = e.clientX, my = e.clientY;
      for (let i = 0; i < cards.length; i++) {
        const { x, y, cardW, cardH } = _cardPos(i, W, H);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
          _pickCard(i);
          return;
        }
      }
    };

    _keyHandler = e => {
      if (!showing || picked) return;
      if (e.code === 'Digit1') _pickCard(0);
      if (e.code === 'Digit2') _pickCard(1);
      if (e.code === 'Digit3') _pickCard(2);
      if (e.code === 'Escape') { hide(); }
    };

    window.addEventListener('mousemove', _mouseMove);
    window.addEventListener('click',     _mouseClick);
    window.addEventListener('keydown',   _keyHandler);
  }

  function _removeHandlers() {
    window.removeEventListener('mousemove', _mouseMove);
    window.removeEventListener('click',     _mouseClick);
    window.removeEventListener('keydown',   _keyHandler);
  }

  function _pickCard(i) {
    if (i < 0 || i >= cards.length) return;
    if (picked) return;
    picked = true;
    const card = cards[i];
    applied.add(card.id);

    if (card.rarity === 'legendary') {
      Audio.sfx('legendary');
      if (typeof screenFlash !== 'undefined') {
        screenFlash.r = 255; screenFlash.g = 180; screenFlash.b = 0; screenFlash.a = 0.6;
      }
      legendaryFlash = 40;
    } else if (card.rarity === 'rare') {
      Audio.sfx('rare');
    } else {
      Audio.sfx('upgrade');
    }

    onPick && onPick(card);

    // Short delay so player sees the pick, then auto-close
    setTimeout(() => { hide(); }, 320);
  }

  // ── Update / Draw ───────────────────────────────────────────────────────────
  function update() {
    if (!showing) return;
    if (animIn < 1) animIn = Math.min(1, animIn + 0.06);
    if (legendaryFlash > 0) legendaryFlash--;
  }

  function draw(ctx, W, H, frameCount) {
    if (!showing) return;
    const alpha = animIn;

    // Dim overlay
    ctx.fillStyle = `rgba(8, 8, 14, ${0.90 * alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;

    const { vertical } = _cardDims(W, H);

    // Title — position above cards
    const firstCard = _cardPos(0, W, H);
    const titleY = firstCard.y - (vertical ? 36 : 52);

    ctx.font = `bold ${Utils.clamp(16, W * 0.045, 22)}px Orbitron, monospace`;
    ctx.fillStyle = '#00ffc8'; ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffc8'; ctx.shadowBlur = 18;
    ctx.fillText(title, W / 2, titleY);
    ctx.shadowBlur = 0;

    ctx.font = `${Utils.clamp(10, W * 0.028, 13)}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#ffffff55';
    ctx.fillText('Vyber jednu kartu  ·  1 · 2 · 3', W / 2, titleY + 18);

    // Cards
    cards.forEach((card, i) => {
      const { x, y, cardW, cardH } = _cardPos(i, W, H);
      const isHov  = hovered === i && !picked;
      const isPicked = picked && hovered === i;
      const rarity  = card.rarity || 'common';
      const hovOff  = isHov && !vertical ? -6 : 0;

      ctx.globalAlpha = alpha * (picked && hovered !== i ? 0.3 : 1);

      // Card background
      const bgC = { common: isHov ? '#161624' : '#101018', rare: isHov ? '#0d1a2e' : '#080f1c', legendary: isHov ? '#1a100e' : '#110a08' };
      ctx.fillStyle = bgC[rarity] || bgC.common;
      _roundRect(ctx, x, y + hovOff, cardW, cardH, 10); ctx.fill();

      // Legendary shimmer
      if (rarity === 'legendary') {
        const shimHue = (frameCount * 2) % 360;
        const sg = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
        sg.addColorStop(0, `hsla(${shimHue},80%,40%,0.08)`);
        sg.addColorStop(0.5, `hsla(${shimHue + 60},80%,50%,0.14)`);
        sg.addColorStop(1, `hsla(${shimHue + 120},80%,40%,0.08)`);
        ctx.fillStyle = sg; _roundRect(ctx, x, y + hovOff, cardW, cardH, 10); ctx.fill();
      }
      if (rarity === 'rare') {
        const rg = ctx.createRadialGradient(x + cardW / 2, y + cardH / 2, 0, x + cardW / 2, y + cardH / 2, cardW * 0.8);
        rg.addColorStop(0, 'rgba(100,40,200,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; _roundRect(ctx, x, y + hovOff, cardW, cardH, 10); ctx.fill();
      }

      // Border
      if (rarity === 'legendary') {
        const hue = (frameCount * 2.5) % 360;
        ctx.strokeStyle = `hsl(${hue},100%,65%)`; ctx.lineWidth = 2.5;
        ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = isHov ? 40 : 20;
      } else if (rarity === 'rare') {
        ctx.strokeStyle = isHov ? '#cc44ff' : '#9933ccaa'; ctx.lineWidth = 2;
        ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = isHov ? 28 : 12;
      } else {
        ctx.strokeStyle = card.color + (isHov ? 'ff' : '88'); ctx.lineWidth = 2;
        ctx.shadowColor = card.color; ctx.shadowBlur = isHov ? 26 : 9;
      }
      _roundRect(ctx, x, y + hovOff, cardW, cardH, 10); ctx.stroke(); ctx.shadowBlur = 0;

      // Top color bar
      ctx.fillStyle = card.color;
      _roundRect(ctx, x, y + hovOff, cardW, 4, { tl: 10, tr: 10, bl: 0, br: 0 }); ctx.fill();

      const midX = x + cardW / 2;

      if (!vertical) {
        // ── Vertical layout (portrait) is horizontal layout per-card ──
        // Normal tall card layout
        // Rarity badge
        ctx.font = 'bold 9px Orbitron, monospace'; ctx.textAlign = 'center';
        if (rarity === 'legendary') {
          const bHue = (frameCount * 2.5) % 360;
          ctx.fillStyle = `hsl(${bHue},100%,68%)`; ctx.shadowColor = `hsl(${bHue},100%,55%)`; ctx.shadowBlur = 8;
          ctx.fillText('\u2605 LEGENDARY \u2605', midX, y + hovOff + 16);
        } else if (rarity === 'rare') {
          ctx.fillStyle = '#cc44ff'; ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 6;
          ctx.fillText('\u25C6 RARE', midX, y + hovOff + 16);
        } else {
          ctx.fillStyle = '#888899'; ctx.shadowBlur = 0;
          ctx.fillText('COMMON', midX, y + hovOff + 16);
        }
        ctx.shadowBlur = 0;

        // Icon
        const iconSz = Math.round(cardH * 0.15);
        ctx.font = `${iconSz}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.fillText(card.icon, midX, y + hovOff + cardH * 0.38);

        // Name
        ctx.font = `bold ${Utils.clamp(11, cardW * 0.065, 14)}px Orbitron, monospace`;
        ctx.fillStyle = card.color; ctx.shadowColor = card.color; ctx.shadowBlur = 8;
        ctx.fillText(card.name, midX, y + hovOff + cardH * 0.52); ctx.shadowBlur = 0;

        // Type
        ctx.font = `${Utils.clamp(9, cardW * 0.05, 11)}px Orbitron, monospace`;
        ctx.fillStyle = card.type === 'weapon' ? '#ff3388' : '#00ffc888';
        ctx.fillText(card.type === 'weapon' ? 'NOVÁ ZBRAŇ' : 'VYLEPŠENÍ', midX, y + hovOff + cardH * 0.62);

        // Desc
        ctx.font = `${Utils.clamp(10, cardW * 0.06, 13)}px Rajdhani, sans-serif`;
        ctx.fillStyle = '#ffffffcc';
        _wrapText(ctx, card.desc, midX, y + hovOff + cardH * 0.72, cardW - 20, 16);

      } else {
        // ── Horizontal compact card (vertical stacking on phone) ──
        const iconX = x + cardH * 0.5;
        const textX = x + cardH * 0.85;
        const textMaxW = cardW - cardH * 0.85 - 10;

        // Icon
        const iconSz = Math.round(cardH * 0.42);
        ctx.font = `${iconSz}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.fillText(card.icon, iconX, y + hovOff + cardH * 0.62);

        // Rarity small
        ctx.font = `bold ${Utils.clamp(7, cardH * 0.13, 9)}px Orbitron, monospace`;
        ctx.textAlign = 'left';
        if (rarity === 'legendary') {
          const bHue = (frameCount * 2.5) % 360;
          ctx.fillStyle = `hsl(${bHue},100%,68%)`; ctx.shadowBlur = 6;
          ctx.fillText('\u2605 LEGENDARY', textX, y + hovOff + cardH * 0.22);
        } else if (rarity === 'rare') {
          ctx.fillStyle = '#cc44ff'; ctx.shadowBlur = 4;
          ctx.fillText('\u25C6 RARE', textX, y + hovOff + cardH * 0.22);
        } else {
          ctx.fillStyle = '#666677'; ctx.shadowBlur = 0;
          ctx.fillText('COMMON', textX, y + hovOff + cardH * 0.22);
        }
        ctx.shadowBlur = 0;

        // Name
        ctx.font = `bold ${Utils.clamp(11, cardH * 0.22, 14)}px Orbitron, monospace`;
        ctx.fillStyle = card.color; ctx.shadowColor = card.color; ctx.shadowBlur = 8;
        ctx.fillText(card.name, textX, y + hovOff + cardH * 0.52); ctx.shadowBlur = 0;

        // Desc inline
        ctx.font = `${Utils.clamp(10, cardH * 0.17, 13)}px Rajdhani, sans-serif`;
        ctx.fillStyle = '#ffffffcc'; ctx.textAlign = 'left';
        _wrapText(ctx, card.desc, textX, y + hovOff + cardH * 0.73, textMaxW, 15);
      }

      // Hotkey hint (1/2/3)
      ctx.font = `bold ${Utils.clamp(9, cardW * 0.07, 12)}px Orbitron, monospace`;
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff22';
      if (!vertical) {
        ctx.fillText(String(i + 1), midX, y + hovOff + cardH - 8);
      } else {
        ctx.fillText(String(i + 1), x + cardH * 0.08, y + hovOff + cardH - 8);
      }

      ctx.globalAlpha = alpha;
    });

    ctx.globalAlpha = 1;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    const radius = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r;
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + w - radius.tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
    ctx.lineTo(x + w, y + h - radius.br); ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
    ctx.lineTo(x + radius.bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
    ctx.lineTo(x, y + radius.tl); ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  }

  function _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line.trim(), cx, y); line = words[i] + ' '; y += lineH;
      } else { line = test; }
    }
    ctx.fillText(line.trim(), cx, y);
  }

  function reset() { applied.clear(); showing = false; cards = []; picked = false; }

  return { show, showShop, hide, update, draw, reset, get showing() { return showing; } };
})();
