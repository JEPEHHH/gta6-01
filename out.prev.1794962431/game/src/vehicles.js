// Cars: one struct, one arcade physics step, and the circle/rectangle tests the whole game
// shares. A car accelerates, brakes, reverses, steers harder the faster it goes, and stops
// when it meets a building or another car.

import { VEHICLE, PALETTE } from './config.js';

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

/** The closest point of a rectangle to a circle's centre, and whether they overlap. */
export function circleHitsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

/** The first solid a circle overlaps, or null. */
export function blockedAt(x, y, r, solids) {
  for (let n = 0; n < solids.length; n += 1) {
    if (circleHitsRect(x, y, r, solids[n])) return solids[n];
  }
  return null;
}

export function createCar(x, y, angle, color) {
  return {
    x,
    y,
    angle,
    speed: 0,
    color,
    health: 100,
    jolt: 0,
    siren: false,
    driver: null,
    ai: null,
  };
}

/** One physics step for a car under the given controls: throttle -1..1, steer -1..1. */
export function stepCar(car, controls, dt, solids) {
  const throttle = clamp(controls.throttle, -1, 1);
  if (throttle > 0) car.speed += VEHICLE.accel * dt * throttle;
  else if (throttle < 0) car.speed -= (car.speed > 2 ? VEHICLE.brake : VEHICLE.accel * 0.5) * dt;
  else car.speed -= car.speed * VEHICLE.drag * dt;
  car.speed = clamp(car.speed, -VEHICLE.maxReverse, VEHICLE.maxSpeed);

  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += clamp(controls.steer, -1, 1) * VEHICLE.turn * grip * dt * (car.speed < 0 ? -1 : 1);

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  let hit = false;
  if (!blockedAt(car.x + dx, car.y, VEHICLE.radius, solids)) car.x += dx;
  else hit = true;
  if (!blockedAt(car.x, car.y + dy, VEHICLE.radius, solids)) car.y += dy;
  else hit = true;

  if (hit) {
    if (Math.abs(car.speed) > 80) car.jolt = 1;
    car.speed *= -0.18;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  car.x = clamp(car.x, 10, 20000);
  car.y = clamp(car.y, 10, 20000);
  car.jolt = Math.max(0, car.jolt - dt * 2.4);
  return hit;
}

/** Move a small round body (a player, a cop, a goon) around solids, one axis at a time. */
export function moveCircle(body, dx, dy, r, solids) {
  if (!blockedAt(body.x + dx, body.y, r, solids)) body.x += dx;
  if (!blockedAt(body.x, body.y + dy, r, solids)) body.y += dy;
  return body;
}

/** Push overlapping cars apart, so a queue never stacks into one sprite. */
export function separateCars(cars) {
  const min = VEHICLE.radius * 1.75;
  for (let a = 0; a < cars.length; a += 1) {
    for (let b = a + 1; b < cars.length; b += 1) {
      const A = cars[a];
      const B = cars[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        A.speed *= 0.82;
        B.speed *= 0.82;
      }
    }
  }
}

/** The nearest car within range of a point, or null. */
export function nearestCar(cars, x, y, range) {
  let best = null;
  let bestD = range * range;
  for (const car of cars) {
    const dx = car.x - x;
    const dy = car.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = car;
    }
  }
  return best;
}

export function carColor(random) {
  return PALETTE.car[Math.floor(random() * PALETTE.car.length) % PALETTE.car.length];
}
