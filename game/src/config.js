// SOL VERDE — every tuning number, price and colour in one place. The game draws into a fixed
// 1280x720 logical frame that the canvas scales to the window, so nothing below depends on the
// display. Units are world pixels and seconds; a car is about 68 px long, a block 750 px.

export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };

/** The camera's magnification: cars and people read clearly at 1280x720 and in a small contact sheet. */
export const RENDER = { zoom: 1.14 };

/** City grid: cols*rows blocks of `pitch` pixels, separated by two-lane `road` strips. */
export const CITY = { cols: 8, rows: 6, pitch: 900, road: 150, walk: 26, alley: 22 };

/** How many people and cars the world keeps alive around the camera. */
export const POP = { traffic: 24, peds: 46, spawnRadius: 1500, keepRadius: 2300 };

/** Clock time: 0.5 game-minutes per real second, opening in the late afternoon so dusk falls as you play. */
export const TIME = { start: 17 * 60 + 10, minutesPerSecond: 0.5, duskStart: 17 * 60 + 40, duskEnd: 21 * 60 };

export const PLAYER = {
  radius: 11,
  walk: 152,
  run: 240,
  maxHealth: 100,
  startCash: 250,
  enterRange: 118,
  punchRange: 34,
  punchDamage: 24,
  punchRate: 0.32,
  invuln: 0.4,
  respawnHealth: 60,
};

/**
 * Car types. `turn` is radians per second at full steering lock, `grip` the share of sideways
 * velocity that survives a step (lower is stickier), `hp` how many hard crashes it survives.
 */
export const CAR_TYPES = [
  { id: 'sedan', name: 'Vento 4', length: 68, width: 32, maxSpeed: 430, accel: 300, turn: 2.5, grip: 0.82, hp: 130,
    colors: ['#d8564b', '#4f7fd0', '#e8d8b0', '#5f6a74', '#3f8f74', '#b2673f', '#8d5f9c'] },
  { id: 'sport', name: 'Marlin GT', length: 64, width: 30, maxSpeed: 560, accel: 430, turn: 2.95, grip: 0.87, hp: 100,
    colors: ['#e8b23f', '#c8382f', '#2ec4b6', '#f2f2f2', '#2b2f3a'] },
  { id: 'van', name: 'Bodega', length: 78, width: 36, maxSpeed: 330, accel: 230, turn: 2.1, grip: 0.8, hp: 175,
    colors: ['#e6e2d6', '#6f8fa8', '#c7b18f'] },
  { id: 'pickup', name: 'Ranchero', length: 74, width: 34, maxSpeed: 390, accel: 290, turn: 2.3, grip: 0.78, hp: 150,
    colors: ['#8a5a3b', '#3d6b4f', '#b8b0a0', '#7a3a3a'] },
  { id: 'taxi', name: 'Cabbie', length: 68, width: 32, maxSpeed: 400, accel: 300, turn: 2.5, grip: 0.82, hp: 130,
    colors: ['#f0c132'] },
  { id: 'police', name: 'Patrol 12', length: 70, width: 33, maxSpeed: 520, accel: 400, turn: 2.7, grip: 0.86, hp: 220,
    colors: ['#22304c'] },
];

export const CIVILIAN_TYPES = ['sedan', 'sport', 'van', 'pickup', 'taxi'];

/** Wanted level: crimes add heat, 100 heat is a star, hiding lets it cool. */
export const POLICE = {
  heatPerStar: 100,
  maxUnits: 4,
  spawnRange: [820, 1150],
  shootRange: 430,
  ramRange: 170,
  decayDelay: 8,
  decayRate: 26,
  bustRange: 105,
  bustTime: 1.6,
};

/** Payouts and pickups. */
export const ECON = {
  pickupCash: 45,
  healAmount: 35,
  ammoPerPickup: 24,
  sprayCost: 300,
};

export const PALETTE = {
  asphalt: '#4a4952',
  asphaltAlt: '#514f59',
  asphaltPatch: 'rgba(28,27,32,0.30)',
  lane: '#e3d6ae',
  laneFaint: 'rgba(236,226,196,0.42)',
  sidewalk: '#c8bba3',
  sidewalkEdge: '#a4977f',
  curb: '#8b7f6c',
  curbLight: 'rgba(255,246,224,0.35)',
  tyre: '#1b1c21',
  glass: 'rgba(176,214,232,0.62)',
  windowLit: 'rgba(255,214,140,0.72)',
  windowDark: 'rgba(38,46,58,0.55)',
  signalRed: '#e2493c',
  signalAmber: '#f2b23c',
  signalGreen: '#4fd08a',
  signalOff: 'rgba(20,22,28,0.6)',
  shutter: '#7a7f86',
  awning: ['#c8382f', '#2f6f5e', '#3f5f9c', '#c99a2f'],
  billboard: '#2a2f38',
  sidewalkLine: 'rgba(110,98,80,0.35)',
  grass: '#5e8b47',
  grassDark: '#4a7239',
  sand: '#e5d2a0',
  water: '#2f7f8c',
  waterDeep: '#1e5d6b',
  waterLight: 'rgba(190,240,240,0.22)',
  roofs: ['#c9b9a1', '#a9b6bd', '#c98f74', '#93999f', '#d8cdb4', '#b7806a', '#8fa9a2'],
  walls: ['#8d8272', '#7d858c', '#9b7460', '#6e7378', '#a89b83', '#8a6552', '#6f8681'],
  roofEdge: 'rgba(35,30,26,0.35)',
  shadow: 'rgba(18,16,24,0.34)',
  player: '#f6e7cd',
  shirt: '#e0574a',
  policeShirt: '#2f4f8f',
  gold: '#f2c14e',
  cash: '#79d47a',
  danger: '#e2493c',
  health: '#5fd17a',
  armor: '#5fa8f0',
  panel: 'rgba(14,16,22,0.74)',
  panelEdge: 'rgba(255,236,200,0.16)',
  ink: '#f5efe2',
  muted: '#b6ad9c',
  night: '#0d1830',
  neon: ['#ff6f61', '#f2c14e', '#4fd6c8', '#ff9f4a'],
};

export const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const HUD_FONT = '"Segoe UI", system-ui, Helvetica, Arial, sans-serif';

/** The city's name and the shop words the buildings carry. */
export const CITY_NAME = 'SOL VERDE';
export const SHOP_NAMES = ['MERCADO', 'FARMACIA', 'CAFE SOL', 'BANCO', 'HOTEL MAR', 'CINE', 'TALLER', 'LICORES'];
