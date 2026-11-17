// The police: a wanted level from one star to five, cruisers that hunt the player down,
// officers who get out and shoot, a siren and the hiding clock that takes the stars away
// again when nobody can see the player.

import { CITY, POLICE, WANTED, roadX, roadY } from './config.js';
import { createCar, stepCar, clamp, moveCircle } from './vehicles.js';
import { addEffect, clearLine, spawnBullet } from './combat.js';

export function createPolice() {
  return { stars: 0, hide: 0, spawn: 0, cars: [], cops: [], sirened: 0, heat: 0 };
}

export function raiseWanted(world, amount) {
  const police = world.police;
  if (police.stars >= WANTED.max) return;
  const before = police.stars;
  police.stars = Math.min(WANTED.max, police.stars + amount);
  police.hide = 0;
  police.heat = 6;
  if (police.stars > before) {
    world.message = { text: `WANTED LEVEL ${police.stars}`, life: 2.2 };
    world.flash = 0.45;
    world.bump = 0.4;
  }
}

function spawnCruiser(world) {
  const { city, player, random } = world;
  for (let tries = 0; tries < 16; tries += 1) {
    const vertical = random() < 0.5;
    let x;
    let y;
    if (vertical) {
      const i = Math.floor(random() * (CITY.cols + 1));
      x = roadX(i);
      y = clamp(player.y + (random() * 2 - 1) * 640, city.anchors.north.y + 40, city.height - 140);
    } else {
      const j = Math.floor(random() * (CITY.rows + 1));
      y = roadY(j);
      x = clamp(player.x + (random() * 2 - 1) * 700, 80, city.width - 80);
    }
    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist < 430 || dist > 1500) continue;
    const car = createCar(x, y, Math.atan2(player.y - y, player.x - x), '#22262e');
    car.driver = 'cop';
    car.siren = true;
    car.health = POLICE.carHealth;
    world.cars.push(car);
    world.police.cars.push({ car, fire: 0.8, deployed: false });
    addEffect(world, x, y, 'siren', '#3d6bff', 0.4);
    return;
  }
}

function deployOfficers(world, x, y) {
  for (const side of [-1, 1]) {
    const unit = {
      x: x + side * 26,
      y: y + 14,
      angle: 0,
      health: POLICE.copHealth,
      fire: 0.7,
      hit: 0,
      dead: false,
      walk: 0,
    };
    world.police.cops.push(unit);
  }
}

function updateCops(world, dt, audio) {
  const player = world.player;
  const cops = world.police.cops;
  for (let n = cops.length - 1; n >= 0; n -= 1) {
    const cop = cops[n];
    if (cop.dead) {
      cops.splice(n, 1);
      continue;
    }
    cop.hit = Math.max(0, cop.hit - dt);
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);

    if (dist > 165) {
      moveCircle(cop, (dx / dist) * POLICE.copSpeed * dt, (dy / dist) * POLICE.copSpeed * dt, 9, world.city.solids);
      cop.walk += dt * 7;
    } else if (dist < 95) {
      moveCircle(cop, (-dx / dist) * POLICE.copSpeed * 0.5 * dt, (-dy / dist) * POLICE.copSpeed * 0.5 * dt, 9, world.city.solids);
    }

    cop.fire -= dt;
    if (cop.fire <= 0 && dist < POLICE.range && clearLine(world.city, cop.x, cop.y, player.x, player.y)) {
      cop.fire = POLICE.fireDelay + world.random() * 0.5;
      spawnBullet(world, cop.x, cop.y, cop.angle + (world.random() - 0.5) * 0.16, POLICE.bulletSpeed, 'cop', POLICE.damage);
      addEffect(world, cop.x + Math.cos(cop.angle) * 12, cop.y + Math.sin(cop.angle) * 12, 'muzzle', '#cfe3ff', 0.08);
      audio.copShot();
    }
  }
}

function updateCruisers(world, dt, audio) {
  const player = world.player;
  for (let n = world.police.cars.length - 1; n >= 0; n -= 1) {
    const unit = world.police.cars[n];
    const car = unit.car;
    if (car.health <= 0) {
      addEffect(world, car.x, car.y, 'boom', '#ff8b3d', 0.9);
      addEffect(world, car.x, car.y, 'smoke', '#6b6b6b', 1.6);
      audio.crash();
      world.cars.splice(world.cars.indexOf(car), 1);
      world.police.cars.splice(n, 1);
      continue;
    }
    if (unit.deployed) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    const diff = ((want - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    stepCar(car, { throttle: dist > 120 ? 1 : 0.2, steer: clamp(diff * 1.8, -1, 1) }, dt, world.city.solids);

    unit.fire -= dt;
    if (unit.fire <= 0 && dist < 430 && world.police.stars >= 2 && clearLine(world.city, car.x, car.y, player.x, player.y)) {
      unit.fire = 1.5;
      spawnBullet(world, car.x, car.y, want + (world.random() - 0.5) * 0.2, POLICE.bulletSpeed, 'cop', 7);
    }

    if (dist < POLICE.deployRange && Math.abs(car.speed) < 150) {
      unit.deployed = true;
      car.driver = 'parked';
      car.siren = false;
      car.speed = 0;
      deployOfficers(world, car.x, car.y);
    }
  }
}

/** Distance from the player to the nearest police unit, car or officer. */
function nearestOfficer(police, x, y) {
  let best = 99999;
  for (const unit of police.cars) best = Math.min(best, Math.hypot(unit.car.x - x, unit.car.y - y));
  for (const cop of police.cops) best = Math.min(best, Math.hypot(cop.x - x, cop.y - y));
  return best;
}

export function updatePolice(world, dt, audio) {
  const police = world.police;
  const player = world.player;

  if (police.stars === 0) {
    if (police.cars.length || police.cops.length) {
      for (const unit of police.cars) {
        const index = world.cars.indexOf(unit.car);
        if (index >= 0) world.cars.splice(index, 1);
      }
      police.cars.length = 0;
      police.cops.length = 0;
    }
    audio.siren(0);
    return;
  }

  police.spawn -= dt;
  const wantedCars = Math.min(WANTED.carLimit, police.stars + 1);
  if (police.cars.length + police.cops.length / 2 < wantedCars && police.spawn <= 0) {
    spawnCruiser(world);
    police.spawn = Math.max(1.1, 3.4 - police.stars * 0.4);
  }
  if (world.police.stars >= 3 && police.cops.length < WANTED.copLimit && police.spawn <= 0 && world.random() < 0.4) {
    const dx = (world.random() - 0.5) * 520;
    const dy = (world.random() - 0.5) * 520;
    deployOfficers(world, clamp(player.x + dx, 60, world.city.width - 60), clamp(player.y + dy, 60, world.city.height - 60));
    police.spawn = 2.2;
  }

  updateCruisers(world, dt, audio);
  updateCops(world, dt, audio);

  const nearest = nearestOfficer(police, player.x, player.y);
  if (nearest > WANTED.hideRadius) {
    police.hide += dt;
    if (police.hide > WANTED.decay[police.stars]) {
      police.stars -= 1;
      police.hide = 0;
      if (police.stars === 0) world.message = { text: 'YOU LOST THEM', life: 2.4 };
    }
  } else {
    police.hide = Math.max(0, police.hide - dt * 2.5);
  }

  const level = police.stars >= 2 ? 3 : 1;
  if (police.sirened !== level) {
    police.sirened = level;
    audio.siren(level);
  }
  world.heat = Math.max(0, police.hide / Math.max(1, WANTED.decay[police.stars] || 1));
}

/** A star the player earns: shooting near the law, or a body on the pavement. */
export function tickHeat(world) {
  const police = world.police;
  if (world.wantedHeat > 0) {
    raiseWanted(world, 1);
    world.wantedHeat = 0;
  }
  if (police.heat > 0) police.heat -= 1 / 60;
}
