// ─── VOID RUNNER — UTILS ────────────────────────────────────────────────────

const Utils = {
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(this.rand(min, max + 1)); },
  randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

  dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Pick N unique random items from array
  pickN(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  },

  // Angle from point A to point B (radians)
  angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  },

  // Move value toward target by step
  moveToward(current, target, step) {
    const diff = target - current;
    if (Math.abs(diff) <= step) return target;
    return current + Math.sign(diff) * step;
  },
};
