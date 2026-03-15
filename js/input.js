// ─── VOID RUNNER — INPUT ────────────────────────────────────────────────────

const Input = (() => {
  const keys = {};
  let _prevGpStart = false;
  let _gpConnected = false;
  let _gpId = '';

  window.addEventListener('keydown', e => { keys[e.code] = true; });
  window.addEventListener('keyup',   e => { keys[e.code] = false; });

  window.addEventListener('gamepadconnected', e => {
    _gpConnected = true;
    _gpId = e.gamepad.id.substring(0, 30);
    if (typeof UI !== 'undefined') UI.setGamepad(true, _gpId);
  });
  window.addEventListener('gamepaddisconnected', () => {
    _gpConnected = false;
    if (typeof UI !== 'undefined') UI.setGamepad(false, '');
  });

  function getGamepad() {
    const gamepads = navigator.getGamepads?.() || [];
    for (const gp of gamepads) {
      if (!gp) continue;
      const dz = 0.15;
      let x = Math.abs(gp.axes[0]) > dz ? gp.axes[0] : 0;
      let y = Math.abs(gp.axes[1]) > dz ? gp.axes[1] : 0;
      if (gp.buttons[14]?.pressed) x = -1;
      if (gp.buttons[15]?.pressed) x =  1;
      if (gp.buttons[12]?.pressed) y = -1;
      if (gp.buttons[13]?.pressed) y =  1;
      const start = !!(gp.buttons[9]?.pressed || gp.buttons[0]?.pressed);
      return { x, y, start };
    }
    return { x: 0, y: 0, start: false };
  }

  return {
    // Movement vector — normalized
    getMove() {
      const gp = getGamepad();
      let ix = 0, iy = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) ix -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) ix += 1;
      if (keys['ArrowUp']   || keys['KeyW']) iy -= 1;
      if (keys['ArrowDown'] || keys['KeyS']) iy += 1;
      ix += gp.x;
      iy += gp.y;
      const mag = Math.sqrt(ix * ix + iy * iy);
      if (mag > 1) { ix /= mag; iy /= mag; }
      return { x: ix, y: iy };
    },

    // Returns true once on press (not held)
    isStartPressed() {
      const gp = getGamepad();
      const gpStart = gp.start;
      const pressed = (keys['Enter'] || keys['Space'] || gpStart) && !_prevGpStart;
      _prevGpStart = gpStart;
      return pressed;
    },

    // Raw key check
    isDown(code) { return !!keys[code]; },

    tick() {
      const gp = getGamepad();
      _prevGpStart = gp.start;
    },

    get gpConnected() { return _gpConnected; },
    get gpId()        { return _gpId; },
  };
})();
