// ─── VOID RUNNER — UPGRADES (Shop) ───────────────────────────────────────────

const Upgrades = (() => {
  let showing = false;
  let cards = [];
  let onBuy = null;
  let onClose = null;
  let animIn = 0;
  let hovered = -1;
  let title = 'SHOP — VYBER VYLEPŠENÍ';
  let legendaryFlash = 0;
  let boughtSet = new Set();

  const CARD_W = 200;
  const CARD_H = 270;
  const CARD_GAP = 24;
  const CARD_COUNT = 3;

  const applied = new Set();

  function showShop(W, H, onBuyCallback, onCloseCallback) {
    showing = true;
    animIn = 0;
    onBuy = onBuyCallback;
    onClose = onCloseCallback;
    title = 'SHOP — VYBER VYLEPŠENÍ';
    hovered = -1;
    boughtSet = new Set();

    const round = (typeof Rounds !== 'undefined') ? Rounds.current : 1;

    if (!Weapons.equipped.includes('basic')) {
      const basicCard = CFG.UPGRADE_CARDS.find(c => c.id === 'unlock_basic');
      const rest = _buildPool(round).filter(c => c.id !== 'unlock_basic');
      const others = _weightedPick(rest, CARD_COUNT - 1);
      cards = [basicCard, ...others];
    } else {
      const pool = _buildPool(round);
      cards = _weightedPick(pool, CARD_COUNT);
    }
    _setupMouseHandlers(W, H);
  }

  function show(W, H, callback, customTitle) {
    showShop(W, H, card => { callback && callback(card); }, null);
    title = customTitle || 'SHOP — VYBER VYLEPŠENÍ';
  }

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
    const result = [];
    const remaining = [...pool];
    for (let i = 0; i < n && remaining.length > 0; i++) {
      const totalW = remaining.reduce((s, c) => s + (c.weight || 5), 0);
      let r = Math.random() * totalW;
      let idx = 0;
      for (let j = 0; j < remaining.length; j++) {
        r -= (remaining[j].weight || 5);
        if (r <= 0) { idx = j; break; }
      }
      result.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return result;
  }

  function hide() {
    showing = false;
    _removeMouseHandlers();
  }

  function _cardX(i, W) {
    const total = CARD_COUNT * CARD_W + (CARD_COUNT - 1) * CARD_GAP;
    return W / 2 - total / 2 + i * (CARD_W + CARD_GAP);
  }
  function _cardY(H) { return H / 2 - CARD_H / 2; }

  let _mouseMove, _mouseClick, _keyHandler;

  function _setupMouseHandlers(W, H) {
    _mouseMove = e => {
      const mx = e.clientX, my = e.clientY;
      const cy = _cardY(H);
      hovered = -1;
      for (let i = 0; i < cards.length; i++) {
        const cx = _cardX(i, W);
        if (mx >= cx && mx <= cx + CARD_W && my >= cy && my <= cy + CARD_H) { hovered = i; break; }
      }
      const bx = W / 2 - 90, by = _cardY(H) + CARD_H + 22;
      if (mx >= bx && mx <= bx + 180 && my >= by && my <= by + 38) hovered = 999;
    };
    _mouseClick = e => {
      if (!showing) return;
      const mx = e.clientX, my = e.clientY;
      const bx = W / 2 - 90, by = _cardY(H) + CARD_H + 22;
      if (mx >= bx && mx <= bx + 180 && my >= by && my <= by + 38) { _closeShop(); return; }
      const cy = _cardY(H);
      for (let i = 0; i < cards.length; i++) {
        const cx = _cardX(i, W);
        if (mx >= cx && mx <= cx + CARD_W && my >= cy && my <= cy + CARD_H) { _buyCard(i); break; }
      }
    };
    _keyHandler = e => {
      if (!showing) return;
      if (e.code === 'Digit1') _buyCard(0);
      if (e.code === 'Digit2') _buyCard(1);
      if (e.code === 'Digit3') _buyCard(2);
      if (e.code === 'Enter' || e.code === 'Escape') _closeShop();
    };
    window.addEventListener('mousemove', _mouseMove);
    window.addEventListener('click', _mouseClick);
    window.addEventListener('keydown', _keyHandler);
  }

  function _removeMouseHandlers() {
    window.removeEventListener('mousemove', _mouseMove);
    window.removeEventListener('click', _mouseClick);
    window.removeEventListener('keydown', _keyHandler);
  }

  function _buyCard(i) {
    if (i < 0 || i >= cards.length) return;
    if (boughtSet.has(i)) return;
    const card = cards[i];
    const price = card.price || 0;
    const credits = window.shopCredits || 0;
    if (credits < price) {
      card._noCredits = 14;
      Audio.sfx('hit');
      return;
    }
    window.shopCredits = credits - price;
    applied.add(card.id);
    boughtSet.add(i);

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

    onBuy && onBuy(card);
  }

  function _closeShop() {
    hide();
    onClose && onClose();
  }

  function update() {
    if (!showing) return;
    if (animIn < 1) animIn = Math.min(1, animIn + 0.05);
    cards.forEach(c => { if (c._noCredits > 0) c._noCredits--; });
  }

  function draw(ctx, W, H, frameCount) {
    if (!showing) return;
    const alpha = animIn;
    const credits = window.shopCredits || 0;

    ctx.fillStyle = `rgba(10, 10, 15, ${0.88 * alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = alpha;

    // Title
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.fillStyle = '#00ffc8'; ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffc8'; ctx.shadowBlur = 20;
    ctx.fillText(title, W / 2, H / 2 - CARD_H / 2 - 52);

    // Credits
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 14;
    ctx.fillText(`\uD83D\uDCB3 ${credits} KREDITY`, W / 2, H / 2 - CARD_H / 2 - 22);
    ctx.shadowBlur = 0;

    ctx.font = '12px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffffff44';
    ctx.fillText('Klikni na kartu  \u00B7  1 \u00B7 2 \u00B7 3  \u00B7  ENTER = hotovo', W / 2, H / 2 - CARD_H / 2 - 5);

    const cy = _cardY(H);

    cards.forEach((card, i) => {
      const cx = _cardX(i, W);
      const bought = boughtSet.has(i);
      const price = card.price || 0;
      const canAfford = credits >= price;
      const noCredFlash = (card._noCredits || 0) > 0;
      const isHov = hovered === i && !bought;
      const hovOff = isHov ? -8 : 0;
      const rarity = card.rarity || 'common';

      ctx.globalAlpha = alpha * (bought ? 0.35 : canAfford ? 1 : 0.5);

      const bgColors = { common: isHov ? '#161624' : '#101018', rare: isHov ? '#0d1a2e' : '#080f1c', legendary: isHov ? '#1a100e' : '#110a08' };
      ctx.fillStyle = noCredFlash ? '#2a0808' : (bgColors[rarity] || bgColors.common);
      _roundRect(ctx, cx, cy + hovOff, CARD_W, CARD_H, 12); ctx.fill();

      if (rarity === 'legendary' && !bought) {
        const shimHue = (frameCount * 2) % 360;
        const sg = ctx.createLinearGradient(cx, cy+hovOff, cx+CARD_W, cy+hovOff+CARD_H);
        sg.addColorStop(0, `hsla(${shimHue},80%,40%,0.08)`); sg.addColorStop(0.5, `hsla(${shimHue+60},80%,50%,0.12)`); sg.addColorStop(1, `hsla(${shimHue+120},80%,40%,0.08)`);
        ctx.fillStyle = sg; _roundRect(ctx, cx, cy+hovOff, CARD_W, CARD_H, 12); ctx.fill();
      }
      if (rarity === 'rare' && !bought) {
        const rg = ctx.createRadialGradient(cx+CARD_W/2,cy+hovOff+CARD_H/2,0,cx+CARD_W/2,cy+hovOff+CARD_H/2,CARD_W*0.8);
        rg.addColorStop(0,'rgba(100,40,200,0.10)'); rg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = rg; _roundRect(ctx, cx, cy+hovOff, CARD_W, CARD_H, 12); ctx.fill();
      }

      if (bought) {
        ctx.strokeStyle = '#00ff8866'; ctx.lineWidth = 2; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 8;
      } else if (rarity === 'legendary') {
        const hue = (frameCount*2.5)%360;
        ctx.strokeStyle = `hsl(${hue},100%,65%)`; ctx.lineWidth = 3; ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = isHov?45:22;
      } else if (rarity === 'rare') {
        ctx.strokeStyle = isHov?'#cc44ff':'#9933ccaa'; ctx.lineWidth = 2; ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = isHov?30:14;
      } else {
        ctx.strokeStyle = card.color+(isHov?'ff':'88'); ctx.lineWidth = 2; ctx.shadowColor = card.color; ctx.shadowBlur = isHov?28:10;
      }
      _roundRect(ctx, cx, cy+hovOff, CARD_W, CARD_H, 12); ctx.stroke(); ctx.shadowBlur = 0;

      ctx.font = 'bold 9px Orbitron, monospace'; ctx.textAlign = 'center';
      if (rarity === 'legendary') {
        const bHue=(frameCount*2.5)%360; ctx.fillStyle=`hsl(${bHue},100%,68%)`; ctx.shadowColor=`hsl(${bHue},100%,55%)`; ctx.shadowBlur=8;
        ctx.fillText('\u2605 LEGENDARY \u2605', cx+CARD_W/2, cy+hovOff+14);
      } else if (rarity === 'rare') {
        ctx.fillStyle='#cc44ff'; ctx.shadowColor='#cc44ff'; ctx.shadowBlur=6; ctx.fillText('\u25C6 RARE', cx+CARD_W/2, cy+hovOff+14);
      } else {
        ctx.fillStyle='#888899'; ctx.shadowBlur=0; ctx.fillText('COMMON', cx+CARD_W/2, cy+hovOff+14);
      }
      ctx.shadowBlur = 0;

      ctx.fillStyle = card.color;
      _roundRect(ctx, cx, cy+hovOff, CARD_W, 4, {tl:12,tr:12,bl:0,br:0}); ctx.fill();

      ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      ctx.fillText(bought ? '\u2713' : card.icon, cx+CARD_W/2, cy+hovOff+82);

      ctx.font = 'bold 13px Orbitron, monospace'; ctx.fillStyle = card.color;
      ctx.shadowColor = card.color; ctx.shadowBlur = 8;
      ctx.fillText(card.name, cx+CARD_W/2, cy+hovOff+116); ctx.shadowBlur = 0;

      ctx.font = '10px Orbitron, monospace';
      ctx.fillStyle = card.type==='weapon'?'#ff3388':'#00ffc888';
      ctx.fillText(card.type==='weapon'?'NOV\u00C1 ZBRA\u0147':'VYLEP\u0160EN\u00CD', cx+CARD_W/2, cy+hovOff+132);

      ctx.font = '12px Rajdhani, sans-serif'; ctx.fillStyle = '#ffffffcc';
      _wrapText(ctx, card.desc, cx+CARD_W/2, cy+hovOff+158, CARD_W-24, 17);

      if (bought) {
        ctx.font='bold 12px Orbitron, monospace'; ctx.fillStyle='#00ff88'; ctx.shadowColor='#00ff88'; ctx.shadowBlur=8;
        ctx.fillText('KOUPENO', cx+CARD_W/2, cy+hovOff+CARD_H-14);
      } else {
        const pc = canAfford?'#ffcc00':'#ff3355';
        ctx.font='bold 12px Orbitron, monospace'; ctx.fillStyle=pc; ctx.shadowColor=pc; ctx.shadowBlur=8;
        ctx.fillText(`\uD83D\uDCB3 ${price}`, cx+CARD_W/2, cy+hovOff+CARD_H-14);
      }
      ctx.shadowBlur = 0;
    });

    ctx.globalAlpha = alpha;

    // HOTOVO button
    const btnHov = hovered === 999;
    const bx = W/2-90, by = cy+CARD_H+22;
    ctx.fillStyle = btnHov?'#00ffc822':'#00ffc811';
    ctx.strokeStyle = btnHov?'#00ffc8':'#00ffc855'; ctx.lineWidth = btnHov?2:1;
    ctx.shadowColor = '#00ffc8'; ctx.shadowBlur = btnHov?20:6;
    _roundRect(ctx, bx, by, 180, 38, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.font = `bold ${btnHov?15:13}px Orbitron, monospace`;
    ctx.fillStyle = btnHov?'#00ffc8':'#00ffc8aa'; ctx.textAlign = 'center';
    ctx.fillText('HOTOVO  [ENTER]', W/2, by+24);

    ctx.globalAlpha = 1;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    const radius = typeof r==='number'?{tl:r,tr:r,bl:r,br:r}:r;
    ctx.beginPath();
    ctx.moveTo(x+radius.tl, y);
    ctx.lineTo(x+w-radius.tr, y); ctx.quadraticCurveTo(x+w, y, x+w, y+radius.tr);
    ctx.lineTo(x+w, y+h-radius.br); ctx.quadraticCurveTo(x+w, y+h, x+w-radius.br, y+h);
    ctx.lineTo(x+radius.bl, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-radius.bl);
    ctx.lineTo(x, y+radius.tl); ctx.quadraticCurveTo(x, y, x+radius.tl, y);
    ctx.closePath();
  }

  function _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' '); let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line+words[i]+' ';
      if (ctx.measureText(test).width > maxW && i > 0) { ctx.fillText(line, cx, y); line=words[i]+' '; y+=lineH; }
      else { line = test; }
    }
    ctx.fillText(line, cx, y);
  }

  function reset() { applied.clear(); showing=false; cards=[]; boughtSet=new Set(); }

  return { show, showShop, hide, update, draw, reset, get showing() { return showing; } };
})();
