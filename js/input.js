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

  // ── GYROSCOPE / TILT ───────────────────────────────────────────────────────
  let tiltX      = 0, tiltY = 0;
  let tiltCalibX = 0, tiltCalibY = 0;
  let tiltEnabled = false;
  let _rawGamma  = 0, _rawBeta = 90;

  const TILT_DEAD = 5;   // degrees dead zone
  const TILT_MAX  = 28;  // degrees = full speed

  function _normTilt(v) {
    const sign = v < 0 ? -1 : 1;
    const abs  = Math.abs(v);
    if (abs < TILT_DEAD) return 0;
    return sign * Math.min(1, (abs - TILT_DEAD) / (TILT_MAX - TILT_DEAD));
  }

  function _onOrientation(e) {
    if (e.gamma === null) return;
    tiltEnabled = true;
    _rawGamma   = e.gamma || 0;
    _rawBeta    = e.beta  || 90;
    tiltX = _normTilt(_rawGamma - tiltCalibX);
    tiltY = _normTilt((_rawBeta - 90) - tiltCalibY);
  }

  function _startTilt() {
    window.addEventListener('deviceorientation', _onOrientation, { passive: true });
  }

  function calibrateTilt() {
    // Set current orientation as neutral
    tiltCalibX = _rawGamma;
    tiltCalibY = _rawBeta - 90;
  }

  // ── TOUCH — tap = start, auto-calibrate tilt ───────────────────────────────
  let _touchPressed = false;
  let _prevTouchPressed = false;

  window.addEventListener('touchstart', () => {
    _touchPressed = true;
    // Calibrate tilt to current position on first touch
    calibrateTilt();
    // Request iOS permission if needed
    if (!tiltEnabled) {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(s => { if (s === 'granted') _startTilt(); })
          .catch(() => {});
      } else {
        _startTilt();
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    _touchPressed = false;
  }, { passive: true });

  // Auto-start tilt on non-iOS (no permission needed)
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    _startTilt();
  }

  // ── GAMEPAD ────────────────────────────────────────────────────────────────
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
    getMove() {
      const gp = getGamepad();
      let ix = 0, iy = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) ix -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) ix += 1;
      if (keys['ArrowUp']   || keys['KeyW']) iy -= 1;
      if (keys['ArrowDown'] || keys['KeyS']) iy += 1;
      ix += gp.x;
      iy += gp.y;
      if (tiltEnabled) {
        ix += tiltX;
        iy += tiltY;
      }
      const mag = Math.sqrt(ix * ix + iy * iy);
      if (mag > 1) { ix /= mag; iy /= mag; }
      return { x: ix, y: iy };
    },

    isStartPressed() {
      const gp         = getGamepad();
      const gpStart    = gp.start;
      const gpPress    = gpStart && !_prevGpStart;
      const touchPress = _touchPressed && !_prevTouchPressed;
      const pressed    = !!(keys['Enter'] || keys['Space'] || gpPress || touchPress);
      _prevGpStart      = gpStart;
      _prevTouchPressed = _touchPressed;
      return pressed;
    },

    calibrateTilt,

    isDown(code) { return !!keys[code]; },

    tick() {
      const gp = getGamepad();
      _prevGpStart = gp.start;
    },

    get gpConnected()  { return _gpConnected; },
    get gpId()         { return _gpId; },
    get tiltEnabled()  { return tiltEnabled; },
  };
})();
