// Cars: the arcade physics the player feels, the shared integration every AI car runs through,
// damage and explosions, and the query the player uses to find a car to steal. Body shapes are
// drawn in render.js; here a car is a position, a heading and a velocity.
import { CAR_TYPES, CIVILIAN_TYPES, PALETTE } from './config.js';
import { clamp, turnToward } from './random.js';
import { nearBuildings, waterAt } from './city.js';

export function typeOf(id) {
  return CAR_TYPES.find((type) => type.id === id) ?? CAR_TYPES[0];
}

export function createVehicle(world, typeId, x, y, angle, driver = 'ai') {
  const type = typeOf(typeId);
  const vehicle = {
    id: world.nextVehicleId++,
    type,
    name: type.name,
    color: world.random.pick(type.colors),
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    hp: type.hp,
    maxHp: type.hp,
    driver,
    nav: null,
    siren: 0,
    lightPhase: world.random.range(0, 6.28),
    flash: 0,
    slide: 0,
    skidTimer: 0,
    exitTimer: 0,
    smoke: 0,
    scrapped: false,
    occupants: driver === 'police' ? 2 : driver === 'ai' ? 1 : 0,
  };
  world.vehicles.push(vehicle);
  return vehicle;
}

/** Park the cars the city's lots hold: a few are drivable, one is the player's first ride. */
export function spawnParked(world) {
  for (const slot of world.city.parked) {
    const type = world.random.pick(CIVILIAN_TYPES);
    createVehicle(world, type, slot.x, slot.y, slot.angle, 'none');
  }
}

/** Speed in km/h, for the speedometer (the scale is a game number, not a real conversion). */
export function speedKmh(vehicle) {
  return Math.round(Math.hypot(vehicle.vx, vehicle.vy) * 0.34);
}

/**
 * Player-driven physics, stepped in fixed 1/60 s: throttle along the heading, speed-scaled
 * steering, a friction that bites and a handbrake that lets the tail slide.
 */
export function driveVehicle(world, vehicle, dt, input) {
  const type = vehicle.type;
  const forward = Math.cos(vehicle.angle);
  const side = Math.sin(vehicle.angle);
  let along = vehicle.vx * forward + vehicle.vy * side;
  let lateral = -vehicle.vx * side + vehicle.vy * forward;

  const boost = input.run ? 1.18 : 1;
  const throttle = input.up ? 1 : input.down ? -0.75 : 0;
  const top = type.maxSpeed * boost;
  if (throttle !== 0) {
    along += throttle * type.accel * boost * dt * (Math.abs(along) > top * 0.92 && throttle > 0 ? 0.25 : 1);
  }
  // Rolling drag: stronger when nothing is pressed, so the car coasts to a stop.
  const drag = (throttle === 0 ? 0.9 : 0.35) * dt * 60 * 0.05;
  along *= 1 - Math.min(0.5, drag);
  if (input.handbrake) along *= 0.965;
  along = clamp(along, -type.maxSpeed * 0.42, top);

  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const bite = clamp(Math.abs(along) / 210, 0, 1);
  if (steer !== 0) {
    const direction = along < -6 ? -1 : 1;
    vehicle.angle += steer * type.turn * dt * bite * direction * (input.handbrake ? 1.25 : 1);
  }

  // Grip pulls sideways speed back to the heading; the handbrake lets most of it survive.
  const gripStep = Math.pow(type.grip, dt * 60);
  lateral *= input.handbrake ? 0.995 : gripStep;
  if (input.handbrake) along *= 0.995;

  vehicle.slide = Math.abs(lateral);
  vehicle.vx = Math.cos(vehicle.angle) * along - Math.sin(vehicle.angle) * lateral;
  vehicle.vy = Math.sin(vehicle.angle) * along + Math.cos(vehicle.angle) * lateral;
  vehicle.steer = steer;
}

/** AI and player cars both end up here: move, collide with the city, leave marks, take damage. */
export function integrate(world, vehicle, dt) {
  const before = Math.hypot(vehicle.vx, vehicle.vy);
  const nx = vehicle.x + vehicle.vx * dt;
  const ny = vehicle.y + vehicle.vy * dt;

  if (!hitSolid(world, nx, ny, vehicle)) {
    vehicle.x = nx;
    vehicle.y = ny;
  } else if (!hitSolid(world, nx, vehicle.y, vehicle)) {
    // Slide along the wall rather than stopping dead against it.
    vehicle.x = nx;
    vehicle.vy *= -0.15;
    scrape(world, vehicle, before);
  } else if (!hitSolid(world, vehicle.x, ny, vehicle)) {
    vehicle.y = ny;
    vehicle.vx *= -0.15;
    scrape(world, vehicle, before);
  } else {
    vehicle.vx *= -0.2;
    vehicle.vy *= -0.2;
    scrape(world, vehicle, before);
  }

  // Skid marks while the tail slides, smoke once the body is badly bent.
  vehicle.skidTimer -= dt;
  if ((vehicle.slide > 55 || (Math.abs(vehicle.steer ?? 0) > 0 && before > 340)) && vehicle.skidTimer <= 0) {
    vehicle.skidTimer = 0.045;
    const rear = -vehicle.type.length * 0.36;
    for (const side of [-1, 1]) {
      world.addDecal('tire', vehicle.x + Math.cos(vehicle.angle) * rear - Math.sin(vehicle.angle) * side * vehicle.type.width * 0.34,
        vehicle.y + Math.sin(vehicle.angle) * rear + Math.cos(vehicle.angle) * side * vehicle.type.width * 0.34,
        vehicle.angle, 7 + world.random.range(0, 3), 6);
    }
  }
  if (vehicle.hp < vehicle.maxHp * 0.45) {
    vehicle.smoke = Math.min(1, vehicle.smoke + dt * 0.4);
    if (world.random.chance(dt * 12)) {
      world.spawnParticle('smoke', vehicle.x - Math.cos(vehicle.angle) * vehicle.type.length * 0.4,
        vehicle.y - Math.sin(vehicle.angle) * vehicle.type.length * 0.4, { count: 1, speed: 24, rise: -18 });
    }
  }
  if (vehicle.hp <= 0) explode(world, vehicle);
}

/** A hard hit with the city: sparks, a shake and body damage, once per collision. */
function scrape(world, vehicle, speed) {
  if (speed <= 190) return;
  world.shake = Math.min(14, world.shake + speed / 90);
  damageVehicle(world, vehicle, Math.round((speed - 170) / 9));
  world.spawnParticle('spark', vehicle.x, vehicle.y, { count: 4, speed: 150 });
}

/** Does the car's body overlap a building or the marina? Sampled at three points along its axis. */
function hitSolid(world, x, y, vehicle) {
  const half = vehicle.type.width * 0.5;
  const fx = Math.cos(vehicle.angle);
  const fy = Math.sin(vehicle.angle);
  for (const step of [-0.32, 0, 0.32]) {
    const px = x + fx * vehicle.type.length * step;
    const py = y + fy * vehicle.type.length * step;
    for (const b of nearBuildings(world.city, px, py, half)) {
      const cx = clamp(px, b.x, b.x + b.w);
      const cy = clamp(py, b.y, b.y + b.h);
      if ((px - cx) ** 2 + (py - cy) ** 2 < half * half) return true;
    }
    if (waterAt(world.city, px, py, half * 0.7)) return true;
  }
  return false;
}

export function damageVehicle(world, vehicle, amount, source = 'crash') {
  if (vehicle.scrapped) return;
  vehicle.hp -= amount;
  vehicle.flash = 0.12;
  if (vehicle.hp <= 0) explode(world, vehicle);
  void source;
}

function explode(world, vehicle) {
  if (vehicle.scrapped) return;
  vehicle.scrapped = true;
  world.spawnParticle('fire', vehicle.x, vehicle.y, { count: 30, speed: 220, size: 9 });
  world.spawnParticle('smoke', vehicle.x, vehicle.y, { count: 14, speed: 90, rise: -30, size: 18 });
  world.addDecal('scorch', vehicle.x, vehicle.y, vehicle.angle, 52, 999);
  world.shake = 16;
  world.audio?.impact(1);
  const player = world.player;
  if (Math.hypot(player.x - vehicle.x, player.y - vehicle.y) < 130) {
    world.hurtPlayer(48);
    if (player.car === vehicle) {
      player.car = null;
      player.x = vehicle.x + 30;
      player.y = vehicle.y + 30;
    }
  }
  if (vehicle.driver === 'player') {
    player.car = null;
    world.toast('Your ride is scrap');
  }
}

/** Push cars apart when they touch, and swap speed for damage when the hit was hard. */
export function separateVehicles(world) {
  const cars = world.vehicles;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.scrapped) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.scrapped) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = (a.type.length + b.type.length) * 0.34;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (reach - d) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const hit = Math.hypot(a.vx - b.vx, a.vy - b.vy);
      if (hit > 150) {
        const damage = Math.min(40, Math.round((hit - 120) / 8));
        damageVehicle(world, a, damage);
        damageVehicle(world, b, damage);
        world.spawnParticle('spark', (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 6, speed: 170 });
        if (a.driver === 'player' || b.driver === 'player') world.shake = Math.min(12, world.shake + hit / 120);
      }
    }
  }
}

/** The car the player would get into with E: the closest one within reach. */
export function nearestVehicle(world, x, y, maxDistance) {
  let best = null;
  let bestDistance = maxDistance;
  for (const vehicle of world.vehicles) {
    if (vehicle.scrapped || vehicle.driver === 'police') continue;
    const d = Math.hypot(vehicle.x - x, vehicle.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = vehicle;
    }
  }
  return best;
}

/** Steer an AI car toward its nav target at a wanted speed, then integrate it. */
export function steerToward(world, vehicle, target, wantSpeed, dt, turnRate = 2.4) {
  const desired = Math.atan2(target.y - vehicle.y, target.x - vehicle.x);
  vehicle.angle = turnToward(vehicle.angle, desired, turnRate * dt * clamp(Math.abs(wantSpeed) / 120, 0.25, 1.4));
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const next = speed + clamp(wantSpeed - speed, -420 * dt, 260 * dt);
  vehicle.vx = Math.cos(vehicle.angle) * next;
  vehicle.vy = Math.sin(vehicle.angle) * next;
  integrate(world, vehicle, dt);
}

export { PALETTE };
