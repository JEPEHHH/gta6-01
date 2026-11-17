// The world: one object holding the city, the player and every list of things alive (vehicles,
// pedestrians, police, bullets, pickups, particles, decals). It owns update order and the helpers
// the other systems call — spawn a particle, report a crime, hurt the player, keep the population
// topped up around the camera — so those modules never import each other.
import { CITY, POP, PLAYER, RENDER, TIME, VIEW } from './config.js';
import { clamp, createRandom } from './random.js';
import { blocked, createCity, hitBuilding, nearBuildings } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { createVehicle, integrate, separateVehicles, spawnParked } from './vehicles.js';
import { spawnTrafficCar, updateTraffic } from './traffic.js';
import { spawnPed, updatePeds } from './peds.js';
import { createWanted, reportCrime, setWanted, updatePolice } from './police.js';
import { updateBullets } from './weapons.js';
import { createMissions, updateMissions } from './missions.js';
import { createGarageState, updateGarage } from './garage.js';
import { ECON } from './config.js';

const MAX_PARTICLES = 320;
const MAX_DECALS = 260;

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);

  const world = {
    seed,
    random,
    city,
    time: 0,
    clock: TIME.start,
    screen: 'play',
    outcome: null,
    frozen: false,
    paused: false,
    audio: null,
    prevEnter: false,
    nextVehicleId: 1,
    vehicles: [],
    peds: [],
    bullets: [],
    pickups: [],
    particles: [],
    decals: [],
    messages: [],
    wanted: createWanted(),
    missions: createMissions(),
    camera: { x: 0, y: 0 },
    zoom: RENDER.zoom,
    shake: 0,
    flash: 0,
    hitFlash: 0,
    // ---- helpers the rest of the game calls ------------------------------------------------
    spawnParticle(kind, x, y, options = {}) {
      const count = options.count ?? 1;
      for (let i = 0; i < count && world.particles.length < MAX_PARTICLES; i += 1) {
        const angle = options.angle ?? random.range(0, Math.PI * 2);
        const speed = (options.speed ?? 60) * random.range(0.35, 1);
        world.particles.push({
          kind,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + (options.rise ?? 0),
          life: options.life ?? random.range(0.35, 0.8),
          max: options.life ?? 0.8,
          size: options.size ?? 3,
          color: options.color ?? null,
        });
      }
    },
    addDecal(kind, x, y, angle = 0, size = 8, life = 26) {
      world.decals.push({ kind, x, y, angle, size, life, max: life });
      if (world.decals.length > MAX_DECALS) world.decals.shift();
    },
    toast(text) {
      world.messages.push({ text, life: 3.4 });
      if (world.messages.length > 3) world.messages.shift();
    },
    addCash(amount) {
      world.player.cash += amount;
      world.toast(`+ $${amount}`);
      world.spawnParticle('cash', world.player.x, world.player.y - 12, { count: 5, speed: 70, rise: -40, color: '#79d47a' });
      world.audio?.cash();
    },
    crime(points, label) {
      reportCrime(world, points, label);
    },
    spawnPickup(kind, x, y, value = 0) {
      if (world.pickups.length > 40) return;
      world.pickups.push({ kind, x, y, value, life: 60, bob: random.range(0, 6.28) });
    },
    hurtPlayer(damage, fromX = null, fromY = null) {
      const player = world.player;
      if (player.invuln > 0 || world.outcome) return;
      let left = damage;
      if (player.armor > 0) {
        const absorbed = Math.min(player.armor, left * 0.7);
        player.armor -= absorbed;
        left -= absorbed;
      }
      player.hp -= left;
      player.invuln = PLAYER.invuln;
      world.hitFlash = 0.5;
      world.shake = Math.min(14, world.shake + 5);
      if (fromX !== null) {
        const angle = Math.atan2(player.y - fromY, player.x - fromX);
        world.spawnParticle('blood', player.x, player.y, { count: 5, speed: 110, angle, color: '#a3241f' });
      }
      if (player.hp <= 0) {
        player.hp = 0;
        world.outcome = 'wasted';
        world.screen = 'wasted';
        world.spawnParticle('blood', player.x, player.y, { count: 16, speed: 120, color: '#a3241f' });
        world.addDecal('blood', player.x, player.y, 0, 26, 60);
      }
    },
    explodeAt(x, y, radius, damage) {
      world.spawnParticle('fire', x, y, { count: 18, speed: 180, size: 8 });
      world.shake = Math.min(18, world.shake + 9);
      world.audio?.impact(1);
      for (const vehicle of world.vehicles) {
        if (Math.hypot(vehicle.x - x, vehicle.y - y) < radius) vehicle.hp -= damage;
      }
      if (Math.hypot(world.player.x - x, world.player.y - y) < radius) world.hurtPlayer(damage * 0.6, x, y);
    },
  };

  world.player = createPlayer(city);
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  world.garage = createGarageState(city);
  spawnParked(world);

  // A first population so the streets are never empty on the first frame.
  for (let i = 0; i < POP.traffic; i += 1) spawnTrafficCar(world);
  for (let i = 0; i < POP.peds; i += 1) spawnPed(world);
  for (let i = 0; i < 4; i += 1) {
    const block = city.blocks[random.int(city.blocks.length)];
    world.spawnPickup(random.pick(['cash', 'ammo', 'health']), block.x + block.w / 2 + random.range(-80, 80), block.y + CITY.walk * 0.5);
  }
  return world;
}

/** One fixed step of the whole simulation, in the order the systems depend on each other. */
export function updateWorld(world, dt, input) {
  if (world.frozen || world.outcome) return;
  world.time += dt;
  world.clock = (world.clock + dt * TIME.minutesPerSecond) % 1440;

  updatePlayer(world, dt, input);
  updateTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt);
  updateBullets(world, dt);
  updatePickups(world, dt);
  updateGarage(world, dt);
  updateParticles(world, dt);
  updateDecals(world, dt);
  updateMessages(world, dt);
  updateMissions(world, dt);
  separateVehicles(world);
  updateCamera(world, dt);

  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.hitFlash > 0) world.hitFlash = Math.max(0, world.hitFlash - dt);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt);
  keepPopulated(world);
}

function updateParticles(world, dt) {
  const list = world.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.4;
    p.vy = p.vy * (1 - dt * 2.4) + (p.kind === 'smoke' ? -14 * dt : 0);
  }
}

function updateDecals(world, dt) {
  const list = world.decals;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].life -= dt;
    if (list[i].life <= 0) list.splice(i, 1);
  }
}

function updateMessages(world, dt) {
  for (let i = world.messages.length - 1; i >= 0; i -= 1) {
    world.messages[i].life -= dt;
    if (world.messages[i].life <= 0) world.messages.splice(i, 1);
  }
}

function updatePickups(world, dt) {
  const player = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.life -= dt;
    pickup.bob += dt * 3;
    if (pickup.life <= 0) {
      world.pickups.splice(i, 1);
      continue;
    }
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 30) {
      if (pickup.kind === 'cash') world.addCash(pickup.value || ECON.pickupCash);
      else if (pickup.kind === 'health') {
        player.hp = Math.min(PLAYER.maxHealth, player.hp + ECON.healAmount);
        world.toast('Health +' + ECON.healAmount);
      } else {
        player.ammo.pistol += ECON.ammoPerPickup;
        player.ammo.smg += ECON.ammoPerPickup;
        player.ammo.shotgun += Math.round(ECON.ammoPerPickup / 3);
        world.toast('Ammo collected');
      }
      world.spawnParticle('cash', pickup.x, pickup.y, { count: 6, speed: 80, rise: -30, color: '#f2c14e' });
      world.pickups.splice(i, 1);
    }
  }
}

/** The camera: leads the car, holds the crosshair's side of the street, pulls back with speed. */
function updateCamera(world, dt) {
  const player = world.player;
  let targetX = player.x;
  let targetY = player.y;
  let speed = Math.hypot(player.vx, player.vy);
  if (player.car) {
    const car = player.car;
    speed = Math.hypot(car.vx, car.vy);
    const lead = Math.min(170, speed * 0.26);
    targetX = car.x + Math.cos(car.angle) * lead;
    targetY = car.y + Math.sin(car.angle) * lead;
  } else {
    // On foot the player body sits away from the crosshair, so what is aimed at stays in frame.
    const reach = Math.hypot((player.aimX ?? player.x) - player.x, (player.aimY ?? player.y) - player.y);
    const gaze = Math.min(92, reach * 0.24);
    targetX += Math.cos(player.aim) * gaze + player.vx * 0.22;
    targetY += Math.sin(player.aim) * gaze + player.vy * 0.22;
  }
  const k = 1 - Math.exp(-6.5 * dt);
  world.camera.x += (targetX - world.camera.x) * k;
  world.camera.y += (targetY - world.camera.y) * k;

  // A slower zoom that opens the frame as the car runs, and closes it again when it stops.
  const wantZoom = RENDER.zoom - Math.min(0.1, (speed / 560) * 0.1);
  world.zoom += (wantZoom - world.zoom) * (1 - Math.exp(-3.4 * dt));

  const halfW = VIEW.width / 2 / world.zoom;
  const halfH = VIEW.height / 2 / world.zoom;
  world.camera.x = clamp(world.camera.x, halfW * 0.55, world.city.width - halfW * 0.55);
  world.camera.y = clamp(world.camera.y, halfH * 0.55, world.city.height - halfH * 0.55);
}

/** Spawn and retire AI cars and pedestrians so the streets near the camera stay busy. */
function keepPopulated(world) {
  const cam = world.camera;
  for (let i = world.vehicles.length - 1; i >= 0; i -= 1) {
    const vehicle = world.vehicles[i];
    if (vehicle.driver === 'player' || vehicle.driver === 'police') continue;
    if (vehicle.scrapped) {
      world.vehicles.splice(i, 1);
      continue;
    }
    if (Math.hypot(vehicle.x - cam.x, vehicle.y - cam.y) > POP.keepRadius) world.vehicles.splice(i, 1);
  }
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(world.peds[i].x - cam.x, world.peds[i].y - cam.y) > POP.keepRadius) world.peds.splice(i, 1);
  }

  let traffic = 0;
  for (const vehicle of world.vehicles) if (vehicle.driver === 'ai') traffic += 1;
  if (traffic < POP.traffic) spawnTrafficCar(world);
  if (world.peds.length < POP.peds) spawnPed(world);
}

/** A square metre is walkable: not inside a building and not out on the water. */
export function walkable(world, x, y, pad = 0) {
  return !blocked(world.city, x, y, pad);
}

/** The building a point falls in, for bullets and camera culling. */
export function buildingAt(world, x, y) {
  return hitBuilding(world.city, x, y);
}

export { integrate, createVehicle, setWanted, nearBuildings, VIEW, CITY };
