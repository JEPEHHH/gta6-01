// The city, generated from the seed: a road grid, blocks with sidewalks, buildings with a height
// that casts a shadow, parks with palms, a marina in the south-east corner, parking lots, street
// lamps and small street furniture. Also the collision queries the rest of the game asks of it
// (is this square inside a building or the sea?), answered from a coarse grid so they stay cheap.
import { CITY, PALETTE, SHOP_NAMES } from './config.js';

const GRID_CELL = 300;

/** The one place the city grid is keyed: a square of building indices. */
function gridKey(x, y) {
  return `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`;
}

/** Split a rectangle into nx*ny lots separated by an alley. */
function splitLots(x, y, w, h, nx, ny, alley) {
  const out = [];
  const lw = (w - alley * (nx - 1)) / nx;
  const lh = (h - alley * (ny - 1)) / ny;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) out.push({ x: x + i * (lw + alley), y: y + j * (lh + alley), w: lw, h: lh });
  }
  return out;
}

function makeBuilding(lot, kind, random, city) {
  const tall = kind === 'downtown';
  const floors = tall ? 11 + random.int(10) : kind === 'commercial' ? 3 + random.int(5) : 2 + random.int(3);
  const tint = random.int(PALETTE.roofs.length);
  const building = {
    x: lot.x,
    y: lot.y,
    w: lot.w,
    h: lot.h,
    floors,
    roof: PALETTE.roofs[tint],
    wall: PALETTE.walls[tint],
    lit: random.chance(0.6),
    neon: kind === 'commercial' ? random.pick(PALETTE.neon) : null,
    shop: null,
    vents: [],
    plants: [],
  };
  if (kind === 'commercial' && random.chance(0.7)) building.shop = random.pick(SHOP_NAMES);
  if (tall && random.chance(0.45)) building.spire = 8 + random.int(14);
  // A stair head or lift housing on the roof, which is what makes a flat roof read as a building.
  if (random.chance(0.7)) {
    building.stair = {
      x: lot.x + random.range(0.08, 0.55) * lot.w,
      y: lot.y + random.range(0.08, 0.5) * lot.h,
      w: Math.min(58, lot.w * 0.3),
      h: Math.min(46, lot.h * 0.26),
    };
  }
  for (let n = random.int(3); n > 0; n -= 1) {
    building.vents.push({
      x: lot.x + random.range(0.12, 0.66) * lot.w,
      y: lot.y + random.range(0.12, 0.66) * lot.h,
      w: random.range(14, 32),
      h: random.range(12, 26),
    });
  }
  for (let n = random.int(2); n > 0; n -= 1) {
    building.plants.push({ x: lot.x + random.range(0.15, 0.85) * lot.w, y: lot.y + random.range(0.15, 0.85) * lot.h });
  }
  city.buildings.push(building);
}

/** A block's interior built up with 1, 2 or 4 buildings, laid out by district. */
function fillBlock(block, kind, random, city) {
  const { walk, alley } = CITY;
  const inner = { x: block.x + walk, y: block.y + walk, w: block.w - walk * 2, h: block.h - walk * 2 };
  const layouts = kind === 'downtown'
    ? [[1, 1], [2, 2], [2, 1]]
    : kind === 'commercial'
      ? [[2, 2], [1, 2], [2, 1]]
      : [[2, 2], [3, 1], [1, 3], [2, 2]];
  const [nx, ny] = random.pick(layouts);
  for (const lot of splitLots(inner.x, inner.y, inner.w, inner.h, nx, ny, alley)) {
    makeBuilding(lot, kind, random, city);
  }
}

/** Road paint: dashed lane dividers down every road, plus a crosswalk at each junction. */
function paintRoads(city, random) {
  const { pitch, road, cols, rows, width, height } = CITY;
  const dash = 46;
  for (let i = 0; i <= cols; i += 1) {
    const x = i * pitch + road / 2 - 2.5;
    for (let y = road + 24; y < height - 20; y += dash + 42) {
      if (y % pitch < 20) continue;
      city.laneLines.push({ x, y, w: 5, h: dash });
    }
  }
  for (let j = 0; j <= rows; j += 1) {
    const y = j * pitch + road / 2 - 2.5;
    for (let x = road + 24; x < width - 20; x += dash + 42) {
      if (x % pitch < 20) continue;
      city.laneLines.push({ x, y, w: dash, h: 5 });
    }
  }
  // Zebra stripes on all four arms of every junction: six bars each, 18 px wide.
  for (let i = 0; i <= cols; i += 1) {
    for (let j = 0; j <= rows; j += 1) {
      const cx = i * pitch + road / 2;
      const cy = j * pitch + road / 2;
      const half = road / 2;
      for (let b = -2; b <= 2; b += 1) {
        const off = b * 26;
        city.crosswalks.push({ x: cx + off - 8, y: cy - half - 34, w: 16, h: 30 });
        city.crosswalks.push({ x: cx + off - 8, y: cy + half + 4, w: 16, h: 30 });
        city.crosswalks.push({ x: cx - half - 34, y: cy + off - 8, w: 30, h: 16 });
        city.crosswalks.push({ x: cx + half + 4, y: cy + off - 8, w: 30, h: 16 });
      }
    }
  }
  void random;
}

/** Grass, palms, a pond and a path cross: the park blocks. */
function buildPark(block, random, city) {
  const { walk } = CITY;
  const x = block.x + walk;
  const y = block.y + walk;
  const w = block.w - walk * 2;
  const h = block.h - walk * 2;
  const pond = random.chance(0.5) ? { x: x + w * 0.2, y: y + h * 0.55, w: w * 0.36, h: h * 0.24, pond: true } : null;
  city.parks.push({ x, y, w, h, pond });
  city.pathList.push({ x: x + w * 0.46, y, w: w * 0.08, h });
  city.pathList.push({ x, y: y + h * 0.46, w, h: h * 0.08 });
  for (let n = 14 + random.int(10); n > 0; n -= 1) {
    const tx = x + random.range(0.05, 0.95) * w;
    const ty = y + random.range(0.05, 0.95) * h;
    if (pond && tx > pond.x - 20 && tx < pond.x + pond.w + 20 && ty > pond.y - 20 && ty < pond.y + pond.h + 20) continue;
    city.trees.push({ x: tx, y: ty, r: random.range(11, 22), palm: true, tilt: random.range(-0.3, 0.3) });
  }
  for (let n = 3; n > 0; n -= 1) {
    city.props.push({ kind: 'bench', x: x + random.range(0.1, 0.9) * w, y: y + h * 0.5 + random.range(-10, 10), a: 0 });
  }
}

/** A parking lot: asphalt, stall stripes and a couple of cars the world fills in at boot. */
function buildLot(block, random, city) {
  const { walk } = CITY;
  const x = block.x + walk;
  const y = block.y + walk;
  const w = block.w - walk * 2;
  const h = block.h - walk * 2;
  city.lots.push({ x, y, w, h });
  const stalls = 5;
  const stallW = w / stalls;
  for (let n = 0; n < stalls; n += 1) {
    city.laneLines.push({ x: x + n * stallW, y, w: 3, h: h * 0.42 });
    if (random.chance(0.55)) {
      city.parked.push({ x: x + n * stallW + stallW / 2, y: y + h * 0.2, angle: Math.PI / 2 });
    }
    if (random.chance(0.35)) {
      city.parked.push({ x: x + n * stallW + stallW / 2, y: y + h * 0.78, angle: Math.PI / 2 });
    }
  }
}

/** The marina: water past the sea wall, a sand beach, planks and moored boats. */
function buildWater(block, random, city) {
  const w = { x: block.x - CITY.road / 2, y: block.y - CITY.road / 2, w: block.w + CITY.road, h: block.h + CITY.road };
  city.water.push(w);
  const shore = 44;
  city.sand.push({ x: w.x, y: w.y, w: w.w, h: shore });
  city.sand.push({ x: w.x, y: w.y, w: shore, h: w.h });
  city.decks.push({ x: w.x + 40, y: w.y + 120, w: 240, h: 26 });
  city.decks.push({ x: w.x + 60, y: w.y + 260, w: 180, h: 22 });
  for (let n = 0; n < 3; n += 1) {
    city.boats.push({ x: w.x + 300 + n * 150, y: w.y + 110 + random.range(0, 240), a: random.range(0, Math.PI * 2), kind: n === 0 ? 'yacht' : 'skiff' });
  }
  for (let n = 0; n < 10; n += 1) {
    city.props.push({ kind: 'umbrella', x: w.x + random.range(0.1, 0.9) * 140, y: w.y + random.range(0.15, 0.85) * 60, a: 0 });
  }
  for (let n = 0; n < 6; n += 1) {
    city.trees.push({ x: w.x + random.range(0.1, 0.85) * 120, y: w.y + 40 + random.range(0, 50), r: random.range(10, 16), palm: true, tilt: random.range(-0.3, 0.3) });
  }
}

export function createCity(random) {
  const { cols, rows, pitch, road, width, height, walk } = { ...CITY, width: CITY.cols * CITY.pitch + CITY.road, height: CITY.rows * CITY.pitch + CITY.road };

  const city = {
    width,
    height,
    pitch,
    road,
    cols,
    rows,
    centre: { x: width / 2, y: height / 2 },
    roads: [],
    blocks: [],
    buildings: [],
    laneLines: [],
    crosswalks: [],
    parks: [],
    pathList: [],
    trees: [],
    props: [],
    lots: [],
    parked: [],
    water: [],
    sand: [],
    decks: [],
    boats: [],
    lamps: [],
    grid: new Map(),
  };

  for (let i = 0; i <= cols; i += 1) city.roads.push({ x: i * pitch, y: 0, w: road, h: height, vertical: true, index: i });
  for (let j = 0; j <= rows; j += 1) city.roads.push({ x: 0, y: j * pitch, w: width, h: road, vertical: false, index: j });

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const block = { x: i * pitch + road, y: j * pitch + road, w: pitch - road, h: pitch - road, i, j };
      const distance = Math.hypot((i + 0.5) / cols - 0.5, (j + 0.5) / rows - 0.5);
      let kind;
      if (i >= cols - 2 && j >= rows - 1) kind = 'water';
      else if (distance < 0.28) kind = random.pick(['downtown', 'downtown', 'commercial']);
      else kind = random.pick(['commercial', 'residential', 'residential', 'park', 'lot']);

      block.kind = kind;
      city.blocks.push(block);
      if (kind === 'water') buildWater(block, random, city);
      else if (kind === 'park') buildPark(block, random, city);
      else if (kind === 'lot') buildLot(block, random, city);
      else fillBlock(block, kind, random, city);

      // A lamp on every corner of the sidewalk, with a warm pool of light at night.
      for (const corner of [[block.x + 16, block.y + 16], [block.x + block.w - 16, block.y + 16],
        [block.x + 16, block.y + block.h - 16], [block.x + block.w - 16, block.y + block.h - 16]]) {
        if (kind === 'water') continue;
        city.lamps.push({ x: corner[0], y: corner[1], phase: random.range(0, 6.28) });
      }
      if (kind !== 'water' && kind !== 'park') {
        city.props.push({ kind: 'hydrant', x: block.x + block.w * 0.5 + random.range(-40, 40), y: block.y + walk * 0.5, a: 0 });
      }
    }
  }

  // Street trees along the sidewalks of the built-up blocks.
  for (const block of city.blocks) {
    if (block.kind === 'water' || block.kind === 'park') continue;
    for (let n = 0; n < 3; n += 1) {
      city.trees.push({
        x: block.x + random.range(0.08, 0.92) * block.w,
        y: block.y + (random.chance(0.5) ? walk * 0.55 : block.h - walk * 0.55),
        r: random.range(9, 14),
        palm: false,
        tilt: 0,
      });
    }
  }

  paintRoads(city, random);

  // Index the buildings so collision and culling only look at a handful of them.
  for (const b of city.buildings) {
    for (let cy = Math.floor(b.y / GRID_CELL); cy <= Math.floor((b.y + b.h) / GRID_CELL); cy += 1) {
      for (let cx = Math.floor(b.x / GRID_CELL); cx <= Math.floor((b.x + b.w) / GRID_CELL); cx += 1) {
        const key = `${cx},${cy}`;
        if (!city.grid.has(key)) city.grid.set(key, []);
        city.grid.get(key).push(b);
      }
    }
  }

  // Where a new player stands: the sidewalk of the block nearest the middle of town.
  const startBlock = city.blocks[Math.floor(city.blocks.length / 2) - 1] ?? city.blocks[0];
  city.spawn = { x: startBlock.x + startBlock.w / 2, y: startBlock.y + walk * 0.6, angle: Math.PI / 2 };
  return city;
}

/** Buildings whose cell (and its neighbours) the point falls in: the candidates for a collision. */
export function nearBuildings(city, x, y, radius) {
  const out = [];
  const step = GRID_CELL;
  for (let cy = Math.floor((y - radius) / step); cy <= Math.floor((y + radius) / step); cy += 1) {
    for (let cx = Math.floor((x - radius) / step); cx <= Math.floor((x + radius) / step); cx += 1) {
      const list = city.grid.get(`${cx},${cy}`);
      if (list) for (const b of list) if (!out.includes(b)) out.push(b);
    }
  }
  return out;
}

/** The building under a point, grown by `pad`; null in the open. */
export function hitBuilding(city, x, y, pad = 0) {
  const list = city.grid.get(gridKey(x, y));
  if (!list) return null;
  for (const b of list) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

/** True on asphalt (used by traffic, peds and the minimap). */
export function onRoad(city, x, y) {
  for (const r of city.roads) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  return false;
}

/** True inside the marina: cars and people do not drive into the sea. */
export function waterAt(city, x, y, pad = 0) {
  for (const w of city.water) {
    if (x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad) return true;
  }
  return false;
}

/** True where nothing may stand or drive: inside a building, or out on the water. */
export function blocked(city, x, y, pad = 0) {
  if (hitBuilding(city, x, y, pad)) return true;
  return waterAt(city, x, y, pad);
}

/** The centre of the nearest junction, for spawning cars and police at a sensible spot. */
export function nearestJunction(city, x, y) {
  const i = Math.max(0, Math.min(city.cols, Math.round((x - city.road / 2) / city.pitch)));
  const j = Math.max(0, Math.min(city.rows, Math.round((y - city.road / 2) / city.pitch)));
  return { x: i * city.pitch + city.road / 2, y: j * city.pitch + city.road / 2, i, j };
}
