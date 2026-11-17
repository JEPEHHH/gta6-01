// Salt Harbor: every tuning number, colour and grid measurement the game reads.
// The canvas is a fixed 1280x720 logical view; the city itself lives in world pixels.

export const VIEW = { width: 1280, height: 720 };

/** The simulation runs at a fixed 60 steps a second, whatever the display does. */
export const STEP = 1 / 60;

/** The street grid: a road line every `block` pixels, `cols` x `rows` blocks of lots. */
export const CITY = {
  cols: 6,
  rows: 6,
  block: 260,
  roadHalf: 30,
  lane: 13,
  margin: 60,
  shore: 230,
  sidewalk: 22,
};

export const worldWidth = () => CITY.margin * 2 + CITY.cols * CITY.block;
export const worldHeight = () => worldWidth() + CITY.shore + CITY.roadHalf;
export const roadX = (i) => CITY.margin + i * CITY.block;
export const roadY = (j) => CITY.margin + j * CITY.block;
/** The southern kerb of the last street: the promenade starts here. */
export const cityBottom = () => roadY(CITY.rows) + CITY.roadHalf;

/** The buildable lot of a block, inside its sidewalks. */
export function blockInner(i, j) {
  const pad = CITY.roadHalf + CITY.sidewalk;
  return { x: roadX(i) + pad, y: roadY(j) + pad, w: CITY.block - pad * 2, h: CITY.block - pad * 2 };
}

/** A point halfway between two intersections, on the road centre line. */
export function midRoad(i, j, horizontal) {
  if (horizontal) return { x: roadX(i) + CITY.block / 2, y: roadY(j) };
  return { x: roadX(i), y: roadY(j) + CITY.block / 2 };
}

export const PLAYER = {
  radius: 9,
  walk: 172,
  sprint: 274,
  accel: 1600,
  drag: 11,
  health: 100,
  ammo: 96,
  fireDelay: 0.17,
  bulletSpeed: 1480,
  bulletLife: 0.62,
  damage: 30,
  reach: 78,
};

export const VEHICLE = {
  length: 42,
  width: 22,
  radius: 17,
  accel: 350,
  brake: 560,
  drag: 1.05,
  maxSpeed: 345,
  maxReverse: 132,
  turn: 2.45,
  crash: 110,
};

export const TRAFFIC = { count: 18, minSpeed: 92, maxSpeed: 142 };

export const PED = { count: 40, minSpeed: 32, maxSpeed: 56, flee: 132, radius: 7 };

export const WANTED = {
  max: 5,
  /** Seconds out of sight before a star drops, by level. */
  decay: [0, 7, 9, 12, 15, 18],
  hideRadius: 540,
  spawnRadius: 780,
  carLimit: 6,
  copLimit: 10,
};

export const POLICE = {
  carHealth: 220,
  copHealth: 62,
  copSpeed: 126,
  fireDelay: 1.15,
  range: 320,
  damage: 9,
  bulletSpeed: 940,
  deployRange: 190,
};

export const MISSION = { reach: 46, pay: [250, 420, 600, 850, 1200, 2400] };

export const HUD = {
  mini: { width: 212, height: 196, x: VIEW.width - 212 - 18, y: VIEW.height - 196 - 18 },
  health: { x: 20, y: VIEW.height - 46, width: 190, height: 12 },
};

export const PALETTE = {
  water: '#2d7c93',
  waterDeep: '#256a80',
  foam: '#9fd3dd',
  sand: '#d9c79b',
  asphalt: '#4b5058',
  asphaltAlt: '#535963',
  line: '#e6d9ac',
  sidewalk: '#c8c2b2',
  curb: '#a9a394',
  grass: '#6f9d5b',
  grassAlt: '#5f8c4f',
  soil: '#8a7355',
  shadow: 'rgba(20,24,32,0.22)',
  window: '#8fb4c6',
  windowLit: '#e8d9a0',
  car: ['#d2543f', '#3f7d5a', '#2f5f8a', '#c9a63c', '#8b5ea8', '#d9d5c8', '#3b4650', '#b56a35'],
  skin: ['#c58f68', '#8d5b3c', '#e0b48f', '#6b4630'],
  shirt: ['#4a7d9e', '#b84b52', '#6f8f4a', '#d0ae52', '#7a5f9c', '#dcd5c4'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const SAVE_KEY = 'salt-harbor.save.v1';
