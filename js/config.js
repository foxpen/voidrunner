// ─── VOID RUNNER — CONFIG ───────────────────────────────────────────────────

const CFG = {
  // Canvas / general
  BG_COLOR: '#0a0a0f',

  // Player
  PLAYER: {
    W: 26, H: 36,
    SPEED: 5.4,
    ACCEL: 0.5,    // svižnější odezva řízení (0.4 bylo těstovité)
    FRICTION: 0.85,
    TRAIL_LEN: 20,
    TRAIL_LEN_BOOST: 35,
    INVINCIBLE_START: 120,   // frames po spawnu
  },

  // Rounds
  ROUNDS: {
    TOTAL: 10,
    ROUND_DURATION: 1080,    // frames (~18s při 60fps) — kratší kola = častější odměny
    BOSS_ROUND: 10,
    INTERMISSION: 120,       // frames mezi koly (2s) — čekání je nepřítel tempa
  },

  // Difficulty scaling per round
  // scoreTarget = bonus cíl v rámci kola (~20s): pasivní skóre dá ~1200,
  // zbytek musí přijít z killů (T1 25 / T2 60 / T3 120, tank+bomber ×1.5).
  // Dosažitelné při agresivní hře, ne zadarmo.
  // obstacleCount = velikost vlny (burst nájezdu každých ~7s), spawnRate = kapání mezi vlnami
  DIFFICULTY: [
    { round: 1,  spawnRate: 38, speed: 1.15, obstacleCount: 1, scoreTarget: 1500 },
    { round: 2,  spawnRate: 34, speed: 1.40, obstacleCount: 2, scoreTarget: 1900 },
    { round: 3,  spawnRate: 31, speed: 1.65, obstacleCount: 2, scoreTarget: 2400 },
    { round: 4,  spawnRate: 28, speed: 1.90, obstacleCount: 2, scoreTarget: 3000 },
    { round: 5,  spawnRate: 25, speed: 2.15, obstacleCount: 3, scoreTarget: 3700 },
    { round: 6,  spawnRate: 22, speed: 2.40, obstacleCount: 3, scoreTarget: 4500 },
    { round: 7,  spawnRate: 19, speed: 2.65, obstacleCount: 3, scoreTarget: 5400 },
    { round: 8,  spawnRate: 16, speed: 3.00, obstacleCount: 4, scoreTarget: 6400 },
    { round: 9,  spawnRate: 13, speed: 3.40, obstacleCount: 4, scoreTarget: 7500 },
    { round: 10, spawnRate: 10, speed: 3.80, obstacleCount: 4, scoreTarget: 0    },
  ],

  // Weapons
  WEAPONS: {
    basic: {
      id: 'basic',
      name: 'ZÁKLADNÍ LASER',
      icon: '🔫',
      color: '#00ffc8',
      damage: 1,
      fireRate: 12,       // frames mezi výstřely (5/s — tempo!)
      speed: 12,
      size: 4,
      pattern: 'single',  // single | spread | orbit | beam | ring
      unlocked: true,
    },
    spread: {
      id: 'spread',
      name: 'BROKOVNICE',
      icon: '🌟',
      color: '#ffcc00',
      damage: 1,
      fireRate: 24,
      speed: 11,
      size: 3,
      pattern: 'spread',
      unlocked: false,
    },
    orbit: {
      id: 'orbit',
      name: 'ORBIT BOLA',
      icon: '⚪',
      color: '#ff8800',
      damage: 2,
      fireRate: 0,        // continuous orbit
      speed: 0,
      size: 8,
      pattern: 'orbit',
      unlocked: false,
    },
    missile: {
      id: 'missile',
      name: 'NAVÁDĚCÍ STŘELA',
      icon: '🚀',
      color: '#ff3355',
      damage: 3,
      fireRate: 50,
      speed: 6,
      size: 6,
      pattern: 'homing',
      unlocked: false,
    },
    ring: {
      id: 'ring',
      name: 'PLAZMOVÝ PRSTEN',
      icon: '💥',
      color: '#ff44ff',
      damage: 2,
      fireRate: 75,
      speed: 4,
      size: 5,
      pattern: 'ring',
      unlocked: false,
    },
    tesla: {
      id: 'tesla',
      name: 'TESLA OBLOUK',
      icon: '⚡',
      color: '#44aaff',
      damage: 2,
      fireRate: 45,       // auto-výboj ~1.3/s
      speed: 0,
      size: 0,
      range: 260,         // dosah oblouku v px
      pattern: 'tesla',
      unlocked: false,
    },
    salvo: {
      id: 'salvo',
      name: 'RAKETOVÁ SALVA',
      icon: '🚀',
      color: '#ff6644',
      damage: 2,
      fireRate: 360,      // dávka každých 6s
      speed: 7,
      size: 4,
      pattern: 'salvo',
      unlocked: false,
    },
    rail: {
      id: 'rail',
      name: 'RAILGUN',
      icon: '🎯',
      color: '#aaffee',
      damage: 6,
      fireRate: 150,      // výstřel každé 2.5s
      speed: 0,
      size: 0,
      pattern: 'rail',
      unlocked: false,
    },
  },

  // Upgrade cards — appear between rounds
  // rarity:   'common' | 'rare' | 'legendary'
  // category: 'safe' — always good, low risk
  //           'synergy' — stronger when combined with matching tags
  //           'risk' — high reward, conditional or costly
  // tags:     array of tag strings used by the Synergy system
  UPGRADE_CARDS: [
    // minRound = nejdřívější kolo kdy se karta může objevit
    // weight   = relativní pravděpodobnost výběru (vyšší = častější)

    // ── Zbraně — odemykají se postupně ──
    { id: 'unlock_basic',   rarity: 'common',    type: 'weapon',  minRound: 1, weight: 10, price: 200,
      name: 'ZÁKLADNÍ LASER',    desc: 'Přímá střelba na nejbližšího',        icon: '🔫', color: '#00ffc8', weaponId: 'basic',
      tags: ['kinetic'], category: 'safe' },
    { id: 'unlock_spread',  rarity: 'common',    type: 'weapon',  minRound: 2, weight: 6,  price: 200,
      name: 'BROKOVNICE',        desc: '5 broků ve vějíři — devastace zblízka', icon: '🌟', color: '#ffcc00', weaponId: 'spread',
      tags: ['kinetic'], category: 'safe' },
    { id: 'unlock_orbit',   rarity: 'rare',      type: 'weapon',  minRound: 4, weight: 4,  price: 380,
      name: 'ORBIT BOLA',        desc: 'Kuličky obíhají kolem lodi',          icon: '⚪', color: '#ff8800', weaponId: 'orbit',
      tags: ['kinetic'], category: 'synergy' },
    { id: 'unlock_missile', rarity: 'rare',      type: 'weapon',  minRound: 5, weight: 3,  price: 380,
      name: 'NAVÁDĚCÍ STŘELA',   desc: 'Samonaváděcí střela, 3× škoda',      icon: '🚀', color: '#ff3355', weaponId: 'missile',
      tags: ['explosive'], category: 'risk' },
    { id: 'unlock_ring',    rarity: 'legendary', type: 'weapon',  minRound: 7, weight: 2,  price: 900,
      name: 'PLAZMOVÝ PRSTEN',   desc: 'Krátký nábojový pulz → výbušná vlna',  icon: '💥', color: '#ff44ff', weaponId: 'ring',
      tags: ['explosive'], category: 'risk' },
    { id: 'unlock_tesla',   rarity: 'rare',      type: 'weapon',  minRound: 4, weight: 4,  price: 380,
      name: 'TESLA OBLOUK',      desc: 'Auto-výboj na nejbližšího do 260 px', icon: '⚡', color: '#44aaff', weaponId: 'tesla',
      tags: ['electric'], category: 'synergy' },
    { id: 'unlock_salvo',   rarity: 'rare',      type: 'weapon',  minRound: 6, weight: 3,  price: 380,
      name: 'RAKETOVÁ SALVA',    desc: 'Každých 6 s dávka 4 naváděcích raket', icon: '🚀', color: '#ff6644', weaponId: 'salvo',
      tags: ['explosive'], category: 'risk' },
    { id: 'unlock_rail',    rarity: 'legendary', type: 'weapon',  minRound: 7, weight: 2,  price: 900,
      name: 'RAILGUN',           desc: 'Průrazný paprsek přes celou obrazovku', icon: '🎯', color: '#aaffee', weaponId: 'rail',
      tags: ['kinetic'], category: 'risk' },

    // ── Common stat upgrady (kola 1–10) ──
    { id: 'dmg_up',    rarity: 'common',    type: 'stat', minRound: 1, weight: 8, price: 150,
      name: 'OSTŘEJŠÍ ZBRANĚ',    desc: '+1 poškození všem zbraním',          icon: '⬆️',  color: '#ff3355', stat: 'damage',    value: 1,
      tags: ['kinetic'], category: 'safe' },
    { id: 'fire_up',   rarity: 'common',    type: 'stat', minRound: 1, weight: 7, price: 150,
      name: 'RYCHLÁ PALBA',       desc: '-20% čas mezi výstřely',             icon: '🔥',  color: '#ff6b00', stat: 'fireRate',  value: -0.2,
      tags: ['tech'], category: 'safe' },
    { id: 'speed_up',  rarity: 'common',    type: 'stat', minRound: 1, weight: 7, price: 150,
      name: 'RYCHLEJŠÍ LOĎ',      desc: '+15% rychlost pohybu',               icon: '💨',  color: '#00ff88', stat: 'shipSpeed', value: 0.15,
      tags: ['tech'], category: 'safe' },

    // ── Rare stat upgrady (kola 4+) ──
    { id: 'hp_up',     rarity: 'rare',      type: 'stat', minRound: 4, weight: 5, price: 380,
      name: 'ŠTÍTOVÝ MODUL',      desc: '+1 extra život',                     icon: '❤️',  color: '#ff0055', stat: 'lives',     value: 1,
      tags: ['armor'], category: 'safe' },
    { id: 'proj_up',   rarity: 'rare',      type: 'stat', minRound: 4, weight: 4, price: 380,
      name: 'DUAL FIRE',          desc: 'Laser střílí ze dvou hlavní',        icon: '🔱',  color: '#00aaff', stat: 'dualFire',  value: true,
      tags: ['kinetic'], category: 'synergy' },
    { id: 'orbit_cnt', rarity: 'rare',      type: 'stat', minRound: 5, weight: 3, price: 380,
      name: 'VÍCE BOLAS',         desc: '+2 orbit kuličky',                   icon: '🔵',  color: '#ff8800', stat: 'orbitCount',value: 2,
      tags: ['kinetic'], category: 'synergy' },
    { id: 'mag_up',    rarity: 'rare',      type: 'stat', minRound: 3, weight: 4, price: 250,
      name: 'VĚTŠÍ ZÁSOBNÍK',     desc: '+6 nábojů do zásobníku',             icon: '🔋',  color: '#44ffaa', stat: 'magSize',   value: 6,
      tags: ['tech'], category: 'safe' },

    // ── Synergy karty — aktivují nebo zlepšují efekty ──
    { id: 'crit_module',  rarity: 'rare',      type: 'stat', minRound: 3, weight: 4, price: 300,
      name: 'KRIT. MODUL',        desc: '+15% šance na krit (×2 dmg)',        icon: '💢',  color: '#ff2266', stat: 'critChance', value: 0.15,
      tags: ['crit'], category: 'synergy' },
    { id: 'incendiary',   rarity: 'rare',      type: 'stat', minRound: 3, weight: 4, price: 300,
      name: 'ZÁPALNÉ STŘELY',     desc: 'Zásah způsobí hoření (1.5s DoT)',    icon: '🔥',  color: '#ff4400', stat: 'burnProc',   value: 1,
      tags: ['fire'], category: 'synergy' },
    { id: 'chain_module', rarity: 'rare',      type: 'stat', minRound: 4, weight: 3, price: 350,
      name: 'VÝBOJOVÝ MODUL',     desc: '30% šance přenést výboj na dalšího', icon: '⚡', color: '#44aaff', stat: 'chainProc',  value: 0.30,
      tags: ['electric'], category: 'synergy' },
    { id: 'piercer',      rarity: 'rare',      type: 'stat', minRound: 4, weight: 3, price: 350,
      name: 'PRŮRAZNÁ STŘELA',    desc: 'Projektily probíjejí 1 nepřítele',   icon: '→',   color: '#aaffcc', stat: 'pierce',     value: 1,
      tags: ['kinetic'], category: 'synergy' },

    // ── Legendary (kola 7+) ──
    { id: 'magnet_p',  rarity: 'legendary', type: 'stat', minRound: 7, weight: 2, price: 900,
      name: 'PERMANENTNÍ MAGNET', desc: 'Stálý přitažlivý efekt navždy',      icon: '🧲',  color: '#ff8800', stat: 'permMagnet',value: true,
      tags: ['void'], category: 'risk' },
    { id: 'score_up',  rarity: 'legendary', type: 'stat', minRound: 7, weight: 2, price: 900,
      name: 'SCORE BOOSTER ×1.5', desc: '+50% skóre permanentně',             icon: '⚡',  color: '#ff3388', stat: 'scoreMult', value: 0.5,
      tags: ['void'], category: 'risk' },
    { id: 'overdrive', rarity: 'legendary', type: 'stat', minRound: 8, weight: 1, price: 900,
      name: 'OVERDRIVE',          desc: '+30% damage +30% rychlost najednou', icon: '☄️',  color: '#ffaa00', stat: 'overdrive', value: true,
      tags: ['fire', 'kinetic'], category: 'risk' },
    { id: 'volatile',  rarity: 'legendary', type: 'stat', minRound: 6, weight: 2, price: 900,
      name: 'VÝBUŠNÁ NÁLOŽ',      desc: 'Každý zásah exploduje v okruhu 55px',icon: '💣',  color: '#ff8800', stat: 'explodeProc',value: 55,
      tags: ['explosive'], category: 'risk' },
  ],

  // Power-ups (pickups during game)
  POWERUPS: {
    shield:  { icon: '🛡', name: 'ŠTÍT',          color: '#00aaff', duration: 600 },
    emp:     { icon: '⚡', name: 'EMP IMPULS',     color: '#ff44ff', duration: 0   },
    slow:    { icon: '⏳', name: 'SLOW-MO',        color: '#ffcc00', duration: 300 },
    speed:   { icon: '🚀', name: 'TURBO',          color: '#00ff88', duration: 360 },
    magnet:  { icon: '🧲', name: 'MAGNET',         color: '#ff8800', duration: 480 },
    double:  { icon: '×2', name: 'DOUBLE SKÓRE',  color: '#ff3388', duration: 420 },
  },

  // Void Crystals — meta currency dropped by enemies
  CRYSTALS: {
    DROP_CHANCE: [0.45, 0.80, 1.0],   // chance per tier
    DROP_COUNT:  [[0,1], [1,2], [2,4]], // [min,max] per tier
    BOSS_REWARD: 60,
  },

  // Hangár — persistent upgrades bought between runs
  HANGAR: [
    { id: 'hull',      name: 'ZÁLOŽNÍ REAKTOR', desc: 'Začínáš s +1 životem',        icon: '❤️',  costs: [30, 55],     maxLevel: 2, color: '#ff4466' },
    { id: 'cannon',    name: 'DVOJITÁ HLAVEŇ',  desc: 'Laser střílí ze dvou hlavní od startu', icon: '🔱', costs: [50], maxLevel: 1, color: '#00ffc8' },
    { id: 'engine',    name: 'LODNÍ MOTOR',     desc: '+9% rychlost startu / level',  icon: '💨',  costs: [25, 38, 55], maxLevel: 3, color: '#00ff88' },
    { id: 'armor',     name: 'PANCÍŘ',          desc: '+1 život navíc / level',       icon: '🛡',  costs: [40, 65],     maxLevel: 2, color: '#44aaff' },
    { id: 'scavenger', name: 'SBĚRAČ',          desc: '+17,5 % spawn power-upů / level',icon:'🧲', costs: [35, 58],     maxLevel: 2, color: '#ff8800' },
    { id: 'warhead',   name: 'BOJOVÁ HLAVICE',  desc: '+1 poškození zbraní / level',  icon: '💥',  costs: [45, 72],     maxLevel: 2, color: '#ff44ff' },
  ],

  // Boss — HP škáluje: HP + 30 za každou sebranou upgrade kartu (boss.js),
  // fáze 2 začíná na 50 % maxHp
  BOSS: {
    HP: 200,
    SPEED: 1.5,
    SIZE: 60,
    COLOR_P1: '#ff3355',
    COLOR_P2: '#ff8800',
    ATTACK_RATE: 80,
    REWARD_CARDS: 3,      // kolik karet po porážce bosse
  },
};
