// ─── VOID RUNNER — SYNERGY SYSTEM ────────────────────────────────────────────
// Tracks upgrade tags accumulated this run.
// When tag thresholds are met, passive combat bonuses activate automatically.
//
// Usage:
//   Synergies.addTags(card.tags)   → call from Upgrades when card is picked
//   Synergies.has('burn')          → check in weapons/enemies hit logic
//   Synergies.reset()              → call from game.js on new run
//   Synergies.getActive()          → list active synergies (for HUD/display)

const Synergies = (() => {

  // Tag counts this run: { kinetic: 3, fire: 1, ... }
  let _tags = {};
  // Set of activated synergy IDs
  const _active = new Set();

  // ── Synergy definitions ────────────────────────────────────────────────────
  // requires: minimum tag counts to unlock (all must be satisfied)
  // effect:   internal key used by combat code (Synergies.has('effect'))
  const DEFS = {
    fire_x2: {
      requires: { fire: 2 },
      name:  'ŽHAVÉ STŘELY',
      desc:  'Každý zásah zapálí nepřítele (1.5s hoření)',
      color: '#ff4400', icon: '🔥',
      effect: 'burn',
    },
    electric_x2: {
      requires: { electric: 2 },
      name:  'ŘETĚZOVÝ VÝBOJ',
      desc:  'Zásah se přenáší na 2 nejbližší nepřátele (50% dmg)',
      color: '#44aaff', icon: '⚡',
      effect: 'chain',
    },
    kinetic_x3: {
      requires: { kinetic: 3 },
      name:  'PRŮRAZ',
      desc:  'Projektily probíjejí 1 extra nepřítele',
      color: '#aaffcc', icon: '→',
      effect: 'pierce',
    },
    explosive_x2: {
      requires: { explosive: 2 },
      name:  'VÝBUŠNÁ VLNA',
      desc:  'Zásah způsobí výbuch v okruhu 50px (50% dmg)',
      color: '#ff8800', icon: '💥',
      effect: 'aoe',
    },
    crit_x2: {
      requires: { crit: 2 },
      name:  'OSTROSTŘELEC',
      desc:  'Kritický zásah způsobuje ×3 místo ×2',
      color: '#ff2266', icon: '💢',
      effect: 'supercrit',
    },
    fire_explosive: {
      requires: { fire: 1, explosive: 1 },
      name:  'POŽÁRNÍ VLNA',
      desc:  'Hořící nepřátelé explodují při smrti (AoE 60px)',
      color: '#ff6600', icon: '🌋',
      effect: 'burnExplode',
    },
    electric_crit: {
      requires: { electric: 1, crit: 1 },
      name:  'NABITÝ VÝBOJ',
      desc:  'Zřetězené střely mají 2× vyšší crit šanci',
      color: '#88aaff', icon: '⚡',
      effect: 'thunderCrit',
    },
    armor_x2: {
      requires: { armor: 2 },
      name:  'REGENERACE',
      desc:  'Po kole bez zásahu: +1 HP (max 5)',
      color: '#44aaff', icon: '💙',
      effect: 'regen',
    },
  };

  // ── Internal: check if any new synergies unlocked ─────────────────────────
  function _checkSynergies() {
    for (const [id, def] of Object.entries(DEFS)) {
      if (_active.has(id)) continue;
      const met = Object.entries(def.requires)
        .every(([tag, count]) => (_tags[tag] || 0) >= count);
      if (met) {
        _active.add(id);
        // Notify player — slight delay so upgrade pick animation finishes first
        setTimeout(() => {
          if (typeof UI !== 'undefined') UI.showNotify(`${def.icon} SYNERGIE: ${def.name}`, def.color);
          if (typeof Audio !== 'undefined') Audio.sfx('legendary');
        }, 400);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function addTag(tag) {
    if (!tag) return;
    _tags[tag] = (_tags[tag] || 0) + 1;
    _checkSynergies();
  }

  function addTags(tagArray) {
    if (!Array.isArray(tagArray)) return;
    tagArray.forEach(addTag);
  }

  // Returns true if any active synergy has this effect identifier
  function has(effect) {
    for (const id of _active) {
      if (DEFS[id] && DEFS[id].effect === effect) return true;
    }
    return false;
  }

  // Returns array of { id, name, desc, color, icon, effect } for active synergies
  function getActive() {
    return [..._active].map(id => ({ id, ...DEFS[id] }));
  }

  function getTags() { return { ..._tags }; }

  function reset() {
    _tags = {};
    _active.clear();
  }

  return { addTag, addTags, has, getActive, getTags, reset, DEFS };
})();
