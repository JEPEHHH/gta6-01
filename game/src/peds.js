// Pedestrians: people walking the ring of pavement around a block, each with their own
// clothes and pace. They flee from gunfire, and a body stays on the pavement for a while
// before somebody new turns up somewhere else.

import { CITY, PED, roadX, roadY, VIEW } from './config.js';
import { range, int, pick, chance } from './random.js';
import { PALETTE } from './config.js';

/** A point `s` pixels around a rectangle's edge, and the heading there. */
export function pointOnRect(rect, s) {
  const per = 2 * (rect.w + rect.h);
  let t = ((s % per) + per) % per;
  if (t < rect.w) return { x: rect.x + t, y: rect.y, angle: 0 };
  t -= rect.w;
  if (t < rect.h) return { x: rect.x + rect.w, y: rect.y + t, angle: Math.PI / 2 };
  t -= rect.h;
  if (t < rect.w) return { x: rect.x + rect.w - t, y: rect.y + rect.h, angle: Math.PI };
  t -= rect.w;
  return { x: rect.x, y: rect.y + rect.h - t, angle: -Math.PI / 2 };
}

export function pavementRing(i, j) {
  const inset = CITY.roadHalf + 6;
  return {
    x: roadX(i) + inset,
    y: roadY(j) + inset,
    w: CITY.block - inset * 2,
    h: CITY.block - inset * 2,
  };
}

function spawnPed(random, city, keep) {
  const i = int(random, 0, CITY.cols - 1);
  const j = int(random, 0, CITY.rows - 1);
  const ring = pavementRing(i, j);
  const per = 2 * (ring.w + ring.h);
  const ped = {
    i,
    j,
    ring,
    s: range(random, 0, per),
    dir: chance(random, 0.5) ? 1 : -1,
    speed: range(random, PED.minSpeed, PED.maxSpeed),
    flee: 0,
    alive: true,
    body: 0,
    skin: pick(random, PALETTE.skin),
    shirt: pick(random, PALETTE.shirt),
    walk: random() * 6,
  };
  const spot = pointOnRect(ring, ped.s);
  ped.x = spot.x + (keep?.x ?? 0);
  ped.y = spot.y;
  ped.angle = spot.angle;
  return ped;
}

export function createPeds(random, city) {
  const peds = [];
  for (let n = 0; n < PED.count; n += 1) peds.push(spawnPed(random, city));
  return peds;
}

/** Everyone within `radius` of a point starts running. */
export function scatterPeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) ped.flee = Math.max(ped.flee, 3.2);
  }
}

export function updatePeds(peds, dt, world) {
  for (let n = peds.length - 1; n >= 0; n -= 1) {
    const ped = peds[n];
    if (!ped.alive) {
      ped.body -= dt;
      if (ped.body <= 0) peds[n] = spawnPed(world.random, world.city);
      continue;
    }
    if (ped.flee > 0) ped.flee -= dt;
    const speed = ped.flee > 0 ? PED.flee : ped.speed;
    ped.s += ped.dir * speed * dt;
    ped.walk += speed * dt * 0.06;
    const spot = pointOnRect(ped.ring, ped.s);
    ped.x = spot.x;
    ped.y = spot.y;
    ped.angle = spot.angle;
    if (ped.flee > 0) {
      // Cover: run the way that puts the nearest gun behind them.
      const away = Math.atan2(ped.y - world.player.y, ped.x - world.player.x);
      ped.facing = away;
    } else {
      ped.facing = spot.angle;
    }
    if (ped.x < 0 || ped.y < 0 || ped.x > VIEW.width * 4) peds[n] = spawnPed(world.random, world.city);
  }
}

export function killPed(ped) {
  ped.alive = false;
  ped.body = 9;
}
