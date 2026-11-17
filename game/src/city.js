// The city: a 6x6 grid of blocks between streets, with a downtown of towers, rows of
// shophouses, a residential quarter, a park, a parking lot, warehouses at the docks and a
// waterfront. Everything is data — rectangles, points and seeded variation — so the renderer
// only has to draw it and the physics only has to test it.

import {
  CITY,
  blockInner,
  roadX,
  roadY,
  cityBottom,
  worldWidth,
  worldHeight,
} from './config.js';
import { range, int, pick, chance } from './random.js';

const ROOF = {
  tower: ['#c9d3d9', '#bcc7ce', '#d6dee2'],
  office: ['#c6bda9', '#b8ae9a', '#d2c9b4'],
  shop: ['#e0b184', '#d99a6c', '#cdbfa4', '#e3c39a'],
  house: ['#e6dccb', '#dccfba', '#e9d9c4'],
  warehouse: ['#b7ad9a', '#a9a08d', '#c3baa6'],
};

const AWNING = ['#c0503f', '#3f7f6a', '#c8a13c', '#4a6f9c'];

/** What each block of the grid holds: the two rows by the water are warehouses. */
function blockKind(i, j) {
  if (j === CITY.rows - 1 && (i === 1 || i === 2)) return 'docks';
  if (i === 4 && j === 1) return 'park';
  if (i === 2 && j === 4) return 'parking';
  if (i <= 1 && j <= 1) return 'downtown';
  if (i >= 3 && j >= 2) return 'houses';
  return 'shops';
}

function addBuilding(city, random, x, y, w, h, kind) {
  const building = {
    x,
    y,
    w,
    h,
    kind,
    tone: pick(random, ROOF[kind]),
    seed: random(),
    awning: chance(random, 0.5) ? pick(random, AWNING) : null,
  };
  city.buildings.push(building);
  city.solids.push({ x, y, w, h });
  return building;
}

/** Lay out one block's lots. */
function fillBlock(city, i, j, kind, random) {
  const lot = blockInner(i, j);
  const { x, y, w, h } = lot;

  if (kind === 'downtown') {
    addBuilding(city, random, x, y, w * 0.63, h * 0.63, 'tower');
    addBuilding(city, random, x + w * 0.67, y, w * 0.33, h * 0.4, 'office');
    addBuilding(city, random, x + w * 0.67, y + h * 0.44, w * 0.33, h * 0.56, 'shop');
    addBuilding(city, random, x, y + h * 0.67, w * 0.6, h * 0.33, 'shop');
    city.trees.push({ x: x + w * 0.32, y: y + h * 0.82, r: 13 });
    return;
  }

  if (kind === 'office' || kind === 'shops') {
    const columns = kind === 'office' ? 2 : 3;
    const gap = 5;
    const cell = (w - gap * (columns - 1)) / columns;
    for (let c = 0; c < columns; c += 1) {
      const bx = x + c * (cell + gap);
      const depth = h * (kind === 'office' ? 0.62 : 0.7);
      addBuilding(city, random, bx, y, cell, depth, kind === 'office' ? 'office' : 'shop');
      if (chance(random, 0.65)) {
        addBuilding(city, random, bx, y + depth + gap, cell, h - depth - gap, 'shop');
      }
    }
    return;
  }

  if (kind === 'houses') {
    for (let ry = 0; ry < 2; ry += 1) {
      for (let rx = 0; rx < 2; rx += 1) {
        const hw = w * 0.36;
        const hh = h * 0.3;
        const hx = x + rx * w * 0.5 + w * 0.07;
        const hy = y + ry * h * 0.5 + h * 0.1;
        addBuilding(city, random, hx, hy, hw, hh, 'house');
        city.trees.push({ x: hx + hw + 12, y: hy + hh + 8, r: range(random, 10, 15) });
        if (chance(random, 0.4)) city.trees.push({ x: hx - 9, y: hy + hh * 0.45, r: 9 });
      }
    }
    return;
  }

  if (kind === 'park') {
    for (let n = 0; n < 12; n += 1) {
      city.trees.push({
        x: range(random, x + 10, x + w - 10),
        y: range(random, y + 10, y + h - 10),
        r: range(random, 11, 21),
      });
    }
    city.park = { x, y, w, h };
    return;
  }

  if (kind === 'parking') {
    for (let row = 0; row < 2; row += 1) {
      for (let c = 0; c < 3; c += 1) {
        city.stalls.push({
          x: x + 12 + c * ((w - 24) / 3),
          y: y + h * 0.22 + row * h * 0.46,
          w: (w - 24) / 3 - 8,
          h: 34,
        });
      }
    }
    city.lots.push({ x, y, w, h });
    return;
  }

  if (kind === 'docks') {
    addBuilding(city, random, x, y, w, h * 0.46, 'warehouse');
    addBuilding(city, random, x, y + h * 0.52, w * 0.46, h * 0.48, 'warehouse');
    for (let n = 0; n < 5; n += 1) {
      city.crates.push({
        x: range(random, x + w * 0.5, x + w - 16),
        y: range(random, y + h * 0.56, y + h - 16),
        s: range(random, 12, 20),
      });
    }
    city.lots.push({ x, y, w, h });
  }
}

function buildShore(city) {
  const top = cityBottom();
  city.sand = { x: 0, y: top, w: city.width, h: 76 };
  city.water = { x: 0, y: top + 70, w: city.width, h: city.height - (top + 70) };
  city.solids.push(city.water);
  for (const i of [1, 2, 4]) {
    city.piers.push({ x: roadX(i) - 28, y: top + 34, w: 56, h: city.height - (top + 34) - 30 });
  }
}

function buildStreetFurniture(city, random) {
  for (let j = 0; j <= CITY.rows; j += 1) {
    for (let i = 0; i <= CITY.cols; i += 1) {
      city.lamps.push({ x: roadX(i) + 38, y: roadY(j) + 38 });
      city.lamps.push({ x: roadX(i) + 38, y: roadY(j) - 38 });
    }
  }
  for (let i = 0; i < CITY.cols; i += 1) {
    for (let j = 0; j < CITY.rows; j += 1) {
      if (j >= 1 && j <= CITY.rows - 2 && chance(random, 0.35)) {
        const lot = blockInner(i, j);
        city.trees.push({ x: lot.x - 6, y: lot.y + range(random, 20, lot.h - 20), r: range(random, 9, 13) });
      }
    }
  }
}

/** Named places the story sends the player to. All are on drivable ground. */
function buildAnchors(city) {
  city.anchors = {
    home: { x: roadX(2) + CITY.block * 0.5, y: roadY(2) + CITY.roadHalf + 11 },
    dock: { x: roadX(2), y: cityBottom() + 38 },
    garage: { x: roadX(2) + CITY.block * 0.5, y: roadY(4) + CITY.block * 0.5 },
    tower: { x: roadX(1), y: roadY(1) + CITY.block * 0.5 },
    pier: { x: roadX(4), y: cityBottom() + 50 },
    hideout: { x: roadX(5), y: roadY(3) + CITY.block * 0.5 },
    midtown: { x: roadX(3) + CITY.block * 0.5, y: roadY(3) },
    north: { x: roadX(1) + CITY.block * 0.5, y: roadY(0) },
    east: { x: roadX(5), y: roadY(2) + CITY.block * 0.5 },
    west: { x: roadX(0), y: roadY(4) + CITY.block * 0.5 },
  };
}

/** A handful of parked cars along the kerbs and in the lot. */
function buildParked(city, random) {
  const spots = [
    { x: roadX(1) + CITY.block * 0.5 + 60, y: roadY(2) + CITY.roadHalf - 15, angle: 0 },
    { x: roadX(1) + CITY.block * 0.5 - 40, y: roadY(3) - CITY.roadHalf + 15, angle: Math.PI },
    { x: roadX(2) + CITY.roadHalf - 15, y: roadY(2) + 90, angle: Math.PI / 2 },
    { x: roadX(3) + CITY.block * 0.5, y: roadY(1) + CITY.roadHalf - 15, angle: 0 },
    { x: roadX(4) + 90, y: roadY(5) - CITY.roadHalf + 15, angle: Math.PI },
    { x: roadX(2) + CITY.block * 0.5 - 40, y: roadY(4) + 40, angle: Math.PI / 2 },
    { x: roadX(2) + CITY.block * 0.5 + 30, y: roadY(4) + 40, angle: Math.PI / 2 },
    { x: roadX(5), y: roadY(4) + 120, angle: Math.PI / 2 },
  ];
  for (const spot of spots) {
    city.parked.push({ ...spot, color: pick(random, ['#d2543f', '#3f7d5a', '#2f5f8a', '#c9a63c', '#d9d5c8']) });
  }
  void int;
}

export function buildCity(random) {
  const city = {
    width: worldWidth(),
    height: worldHeight(),
    roadsX: [],
    roadsY: [],
    blocks: [],
    buildings: [],
    trees: [],
    lamps: [],
    stalls: [],
    piers: [],
    crates: [],
    lots: [],
    parked: [],
    solids: [],
    sand: null,
    water: null,
    park: null,
    anchors: null,
  };

  for (let i = 0; i <= CITY.cols; i += 1) city.roadsX.push(roadX(i));
  for (let j = 0; j <= CITY.rows; j += 1) city.roadsY.push(roadY(j));

  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      const kind = blockKind(i, j);
      const lot = blockInner(i, j);
      city.blocks.push({ i, j, kind, x: lot.x, y: lot.y, w: lot.w, h: lot.h });
      fillBlock(city, i, j, kind, random);
    }
  }

  buildShore(city);
  buildStreetFurniture(city, random);
  buildAnchors(city);
  buildParked(city, random);
  return city;
}

/** The block whose lot holds a point, or null. */
export function blockAt(city, x, y) {
  for (const block of city.blocks) {
    if (x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h) return block;
  }
  return null;
}
