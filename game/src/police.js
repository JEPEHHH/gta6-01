// Police and the wanted level. Crimes add heat; every 100 heat is a star, up to five. Police cars
// spawn off-camera, chase, ram and shoot, a helicopter joins at four stars, and the level cools
// only once the player has been out of sight for a while. Being caught on foot is a bust.
import { POLICE } from './config.js';
import { clamp } from './random.js';
import { nearestJunction } from './city.js';
import { createVehicle, damageVehicle, steerToward } from './vehicles.js';
import { policeFire } from './weapons.js';

export function createWanted() {
  return {
    level: 0,
    heat: 0,
    units: [],
    heli: null,
    decay: 0,
    bustTimer: 0,
    spawnCd: 0,
    lastCrime: '',
    starFlash: 0,
  };
}

/** A crime adds heat; the star count follows the heat and starts the cooldown over. */
export function reportCrime(world, points, label) {
  if (world.outcome) return;
  const wanted = world.wanted;
  wanted.heat = clamp(wanted.heat + points, 0, 520);
  const level = clamp(Math.ceil(wanted.heat / POLICE.heatPerStar), 0, 5);
  if (level > wanted.level) {
    world.toast(`Wanted ${'★'.repeat(level)} — ${label}`);
    wanted.starFlash = 1.2;
  }
  wanted.level = Math.max(wanted.level, level);
  wanted.decay = 0;
  wanted.lastCrime = label;
}

/** Jump straight to a level: a mission's ambush, or a fresh start after a bust. */
export function setWanted(world, level) {
  const wanted = world.wanted;
  wanted.heat = clamp(level, 0, 5) * POLICE.heatPerStar;
  wanted.level = clamp(level, 0, 5);
  wanted.decay = 0;
  wanted.bustTimer = 0;
}

/** One patrol car, arriving at a junction outside the view. */
function spawnUnit(world) {
  const city = world.city;
  const player = world.player;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const angle = world.random.range(0, Math.PI * 2);
    const distance = world.random.range(POLICE.spawnRange[0], POLICE.spawnRange[1]);
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;
    if (x < 150 || y < 150 || x > city.width - 150 || y > city.height - 150) continue;
    const junction = nearestJunction(city, x, y);
    const car = createVehicle(world, 'police', junction.x, junction.y + city.road * 0.24, 0, 'police');
    car.siren = 1;
    car.fireCd = world.random.range(0.6, 1.8);
    car.aggression = 0.7 + world.random() * 0.6;
    world.wanted.units.push(car);
    return car;
  }
  return null;
}

function retire(world, unit) {
  const index = world.vehicles.indexOf(unit);
  if (index >= 0) world.vehicles.splice(index, 1);
  const unitIndex = world.wanted.units.indexOf(unit);
  if (unitIndex >= 0) world.wanted.units.splice(unitIndex, 1);
}

/** The whole police response, stepped after traffic so it reads the player's fresh position. */
export function updatePolice(world, dt) {
  const wanted = world.wanted;
  const player = world.player;
  const targetX = player.car ? player.car.x : player.x;
  const targetY = player.car ? player.car.y : player.y;

  // Retire the extras first, so lowering the level cleans up immediately.
  while (wanted.units.length > Math.max(0, wanted.level)) retire(world, wanted.units[wanted.units.length - 1]);
  for (const unit of wanted.units) unit.siren = wanted.level > 0 ? 1 : 0;
  if (wanted.starFlash > 0) wanted.starFlash = Math.max(0, wanted.starFlash - dt);

  let nearest = Infinity;
  for (const unit of wanted.units) {
    nearest = Math.min(nearest, Math.hypot(unit.x - targetX, unit.y - targetY));
  }

  // Heat cools only when nothing has eyes on the player.
  if (wanted.level > 0) {
    if (nearest > 880) {
      wanted.decay += dt;
      if (wanted.decay > POLICE.decayDelay) {
        wanted.heat = Math.max(0, wanted.heat - POLICE.decayRate * dt);
        if (wanted.heat <= 0) {
          wanted.level = 0;
          world.toast('You lost them');
        } else {
          wanted.level = clamp(Math.ceil(wanted.heat / POLICE.heatPerStar), 1, 5);
        }
      }
    } else {
      wanted.decay = 0;
    }
  }

  wanted.spawnCd -= dt;
  if (wanted.units.length < Math.min(POLICE.maxUnits, wanted.level) && wanted.spawnCd <= 0) {
    spawnUnit(world);
    wanted.spawnCd = 2.2;
  }

  for (const unit of wanted.units) {
    if (unit.scrapped) continue;
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const distance = Math.hypot(dx, dy) || 1;
    const heading = Math.atan2(dy, dx);
    // Aim a little ahead of a moving target; ram at range, hold back when close.
    const lead = player.car ? 0.42 : 0.15;
    const aimX = targetX + (player.car?.vx ?? player.vx) * lead;
    const aimY = targetY + (player.car?.vy ?? player.vy) * lead;
    const speed = Math.hypot(unit.vx, unit.vy);
    let want = unit.type.maxSpeed * 0.82;
    if (distance < POLICE.ramRange) want = unit.driver === 'police' && distance < 90 ? 0 : 165;
    steerToward(world, unit, { x: aimX, y: aimY }, want, dt, 2.6);
    unit.lightPhase = (unit.lightPhase + dt * (4 + speed * 0.01)) % (Math.PI * 2);

    unit.fireCd -= dt;
    if (distance < POLICE.shootRange && unit.fireCd <= 0) {
      const facing = Math.abs(Math.atan2(Math.sin(heading - unit.angle), Math.cos(heading - unit.angle)));
      if (facing < 0.6) {
        unit.fireCd = world.random.range(0.7, 1.4) / (unit.aggression ?? 1);
        policeFire(world, unit.x + Math.cos(heading) * 36, unit.y + Math.sin(heading) * 36, heading, 7);
      }
    }
    if (distance < 60 && speed > 240 && player.car) {
      damageVehicle(world, unit, 6);
      world.shake = Math.min(14, world.shake + 4);
    }
  }

  // The helicopter: no guns, just a shadow and a searchlight that follows from four stars up.
  if (wanted.level >= 4) {
    if (!wanted.heli) wanted.heli = { x: targetX - 200, y: targetY - 260, rotor: 0, angle: 0 };
    const heli = wanted.heli;
    heli.x += (targetX - 150 - heli.x) * Math.min(1, dt * 1.6);
    heli.y += (targetY - 230 - heli.y) * Math.min(1, dt * 1.6);
    heli.angle = Math.atan2(targetY - heli.y, targetX - heli.x);
    heli.rotor += dt * 26;
  } else {
    wanted.heli = null;
  }

  // Caught on foot, standing still next to a patrol car: busted.
  if (wanted.level > 0 && !player.car) {
    const fast = Math.hypot(player.vx, player.vy) > 60;
    if (nearest < POLICE.bustRange && !fast) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer > POLICE.bustTime) {
        world.outcome = 'busted';
        world.screen = 'busted';
        world.wanted.bustTimer = 0;
      }
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
    }
  } else {
    wanted.bustTimer = 0;
  }
}

/** After a bust the impound takes the car and the stars go out. */
export function clearWanted(world) {
  const wanted = world.wanted;
  while (wanted.units.length > 0) retire(world, wanted.units[wanted.units.length - 1]);
  wanted.heat = 0;
  wanted.level = 0;
  wanted.decay = 0;
  wanted.bustTimer = 0;
  wanted.heli = null;
}
