// The four screenshot scenes behind ?shot=start|city|chase|mission. Each one poses the real
// world — the same city, the same cars, the same police — at a chosen moment, so the picture is
// what the game actually looks like rather than an illustration of it.

import { CITY, roadX, roadY } from './config.js';
import { createCar } from './vehicles.js';
import { raiseWanted } from './police.js';
import { addEffect, spawnBullet } from './combat.js';
import { resumeJob } from './missions.js';
import { pavementRing, pointOnRect } from './peds.js';

function laneSpot(axis, line, dir, p) {
  if (axis === 'h') return { x: p, y: roadY(line) + dir * CITY.lane, angle: dir > 0 ? 0 : Math.PI };
  return { x: roadX(line) - dir * CITY.lane, y: p, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

/** Put a civilian car on a named lane, mid-block. */
function setLane(car, axis, line, dir, p, cruise) {
  const spot = laneSpot(axis, line, dir, p);
  car.x = spot.x;
  car.y = spot.y;
  car.angle = spot.angle;
  car.ai = { axis, line, dir, p, cruise: cruise ?? 110, pause: 0 };
  car.speed = car.ai.cruise;
}

/** Walk a few pedestrians onto the pavements around a block. */
function crowd(world, spots) {
  spots.forEach((entry, index) => {
    const ped = world.peds[index];
    if (!ped) return;
    const ring = pavementRing(entry.i, entry.j);
    ped.ring = ring;
    ped.s = entry.s;
    ped.dir = entry.dir ?? 1;
    ped.alive = true;
    ped.flee = 0;
    const at = pointOnRect(ring, ped.s);
    ped.x = at.x;
    ped.y = at.y;
    ped.angle = at.angle;
    ped.facing = at.angle;
  });
}

function addCar(world, x, y, angle, color, driver, speed) {
  const car = createCar(x, y, angle, color);
  car.driver = driver;
  car.speed = speed ?? 0;
  world.cars.push(car);
  return car;
}

function look(world, x, y) {
  const halfW = 640;
  const halfH = 360;
  world.camera.x = Math.min(Math.max(x, halfW), world.city.width - halfW);
  world.camera.y = Math.min(Math.max(y, halfH), world.city.height - halfH);
}

export function stageShot(world, name) {
  const city = world.city;
  const player = world.player;
  const traffic = world.traffic.cars;

  if (name === 'start') {
    world.money = 1250;
    look(world, player.x, player.y);
    setLane(traffic[0], 'h', 2, 1, 430, 120);
    setLane(traffic[1], 'h', 2, -1, 780, 104);
    setLane(traffic[2], 'v', 2, 1, 470, 96);
    setLane(traffic[3], 'v', 2, -1, 730, 112);
    setLane(traffic[4], 'h', 3, -1, 300, 108);
    crowd(world, [
      { i: 2, j: 2, s: 40 },
      { i: 2, j: 2, s: 210, dir: -1 },
      { i: 2, j: 1, s: 120 },
      { i: 1, j: 2, s: 90, dir: -1 },
      { i: 3, j: 2, s: 160 },
      { i: 2, j: 2, s: 320 },
      { i: 1, j: 1, s: 60 },
      { i: 3, j: 3, s: 240, dir: -1 },
    ]);
    return 'title';
  }

  if (name === 'city') {
    resumeJob(world, 1, 0);
    world.money = 3750;
    player.x = roadX(2) + 96;
    player.y = roadY(2) + 36;
    player.angle = Math.PI * 0.85;
    look(world, player.x + 40, player.y + 60);
    setLane(traffic[0], 'h', 2, 1, 520, 118);
    setLane(traffic[1], 'h', 2, -1, 900, 96);
    setLane(traffic[2], 'v', 2, 1, 700, 104);
    setLane(traffic[3], 'v', 3, -1, 470, 110);
    setLane(traffic[4], 'h', 3, 1, 420, 100);
    world.cars[0].x = roadX(2) + 150;
    world.cars[0].y = roadY(2) - 12;
    world.cars[0].angle = 0;
    crowd(world, [
      { i: 2, j: 2, s: 70 },
      { i: 2, j: 2, s: 260, dir: -1 },
      { i: 1, j: 2, s: 190 },
      { i: 2, j: 1, s: 300, dir: -1 },
      { i: 3, j: 2, s: 30 },
      { i: 3, j: 2, s: 210, dir: -1 },
      { i: 2, j: 3, s: 150 },
      { i: 1, j: 3, s: 320, dir: -1 },
    ]);
    return 'play';
  }

  if (name === 'chase') {
    resumeJob(world, 4, 2);
    world.money = 6120;
    const y = roadY(3) + CITY.lane;
    const hero = addCar(world, 720, y, 0, '#d2543f', 'player', 238);
    player.car = hero;
    player.x = hero.x;
    player.y = hero.y;
    player.angle = 0;
    player.ammo = 74;
    look(world, hero.x + 90, hero.y - 26);

    raiseWanted(world, 3);
    const behindA = addCar(world, 592, y, 0, '#22262e', 'cop', 250);
    const behindB = addCar(world, 452, y, 0, '#22262e', 'cop', 242);
    const roadblock = addCar(world, 1030, roadY(3) - CITY.lane, Math.PI, '#22262e', 'cop', 40);
    for (const car of [behindA, behindB, roadblock]) {
      car.siren = true;
      world.police.cars.push({ car, fire: 1, deployed: false });
    }
    world.police.cops.push({ x: 660, y: y + 52, angle: 0, health: 62, fire: 1, hit: 0, dead: false, walk: 0 });

    spawnBullet(world, 660, y + 2, 0.02, 940, 'cop', 7);
    spawnBullet(world, 700, y - 4, -0.01, 940, 'cop', 7);
    addEffect(world, 700, y, 'muzzle', '#cfe3ff', 2.6);
    addEffect(world, 736, y - 6, 'muzzle', '#cfe3ff', 2.6);
    addEffect(world, 720, y - 30, 'smoke', '#6b6b6b', 2.4);

    setLane(traffic[0], 'h', 3, 1, 1120, 106);
    setLane(traffic[1], 'h', 3, -1, 940, 98);
    setLane(traffic[2], 'h', 4, 1, 700, 112);
    setLane(traffic[3], 'v', 3, 1, 1010, 108);
    setLane(traffic[4], 'h', 3, 1, 240, 116);
    crowd(world, [
      { i: 3, j: 3, s: 60 },
      { i: 3, j: 3, s: 220, dir: -1 },
      { i: 3, j: 2, s: 140 },
      { i: 4, j: 3, s: 300, dir: -1 },
    ]);
    return 'play';
  }

  resumeJob(world, 2, 0);
  world.money = 4980;
  const y = roadY(3) + CITY.lane;
  const target = city.anchors.midtown;
  const hero = addCar(world, target.x - 300, y, 0, '#3f7d5a', 'player', 188);
  player.car = hero;
  player.x = hero.x;
  player.y = hero.y;
  player.angle = 0;
  player.ammo = 82;
  look(world, hero.x + 200, hero.y - 20);
  setLane(traffic[0], 'h', 3, 1, target.x + 40, 120);
  setLane(traffic[1], 'h', 3, -1, target.x + 220, 96);
  setLane(traffic[2], 'h', 3, 1, target.x - 90, 104);
  setLane(traffic[3], 'v', 3, 1, roadY(3) + 120, 108);
  setLane(traffic[4], 'v', 4, -1, roadY(3) + 210, 102);
  world.cars[1].x = target.x - 150;
  world.cars[1].y = roadY(3) - CITY.lane;
  crowd(world, [
    { i: 3, j: 3, s: 80 },
    { i: 3, j: 3, s: 240, dir: -1 },
    { i: 4, j: 3, s: 20 },
    { i: 3, j: 2, s: 180, dir: -1 },
  ]);
  addEffect(world, target.x, target.y, 'echo', '#e8c46a', 2.4);
  return 'play';
}
