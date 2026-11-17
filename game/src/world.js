// The world: the city, everybody in it, the camera and one update function that steps the
// whole simulation in a fixed order — player, traffic, crowd, police, story, bullets, cars.

import { VIEW } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createCar, clamp, separateCars } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPeds, updatePeds, scatterPeds } from './peds.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice, updatePolice, tickHeat } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { updateBullets, updateEffects, addEffect } from './combat.js';

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const world = {
    seed,
    random,
    city,
    cars: [],
    traffic: null,
    peds: [],
    police: null,
    player: null,
    missions: null,
    bullets: [],
    effects: [],
    money: 0,
    time: 0,
    flash: 0,
    bump: 0,
    wantedHeat: 0,
    respawnFlash: 0,
    saveDirty: false,
    message: { text: '', life: 0 },
    camera: { x: city.anchors.home.x, y: city.anchors.home.y, shake: 0 },
    frozen: false,
  };

  for (const spot of city.parked) {
    const car = createCar(spot.x, spot.y, spot.angle, spot.color);
    car.driver = 'parked';
    world.cars.push(car);
  }

  world.traffic = createTraffic(random, city);
  world.cars.push(...world.traffic.cars);
  world.peds = createPeds(random, city);
  world.police = createPolice();
  world.player = createPlayer(city.anchors.home.x, city.anchors.home.y);
  world.missions = createMissions(world);
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  return world;
}

export function updateCamera(world, dt, input) {
  const camera = world.camera;
  const player = world.player;
  const lookX = player.x + (input.mouse.x - VIEW.width / 2) * 0.14;
  const lookY = player.y + (input.mouse.y - VIEW.height / 2) * 0.14;
  const ease = Math.min(1, dt * (player.car ? 5.5 : 8));
  camera.x += (lookX - camera.x) * ease;
  camera.y += (lookY - camera.y) * ease;

  const halfW = VIEW.width / 2;
  const halfH = VIEW.height / 2;
  camera.x = world.city.width > VIEW.width ? clamp(camera.x, halfW, world.city.width - halfW) : world.city.width / 2;
  camera.y = world.city.height > VIEW.height ? clamp(camera.y, halfH, world.city.height - halfH) : world.city.height / 2;
  camera.shake = Math.max(0, camera.shake - dt * 2.2);
}

export function toast(world, text, life = 2.2) {
  world.message = { text, life };
}

export function updateWorld(world, input, dt, audio) {
  world.time += dt;
  if (world.message.life > 0) world.message.life -= dt;
  world.flash = Math.max(0, world.flash - dt);
  world.bump = Math.max(0, world.bump - dt);
  world.respawnFlash = Math.max(0, world.respawnFlash - dt);

  updatePlayer(world, input, dt, audio);
  updateTraffic(world.traffic, dt, world);
  updatePeds(world.peds, dt, world);
  updatePolice(world, dt, audio);
  updateMissions(world, dt, audio);
  updateBullets(world, dt, audio);
  updateEffects(world, dt);
  separateCars(world.cars);
  tickHeat(world);

  if (world.wantedHeat > 0 || world.flash > 0) world.camera.shake = Math.max(world.camera.shake, 0.25);
  if (world.player.hurt > 0.25 && !world.player.dead) world.camera.shake = Math.max(world.camera.shake, 0.2);
  updateCamera(world, dt, input);
  if (!world.player.car) audio.engine(0);
}

/** A shot rings out near by: the crowd runs, and the law takes an interest. */
export function startle(world, x, y) {
  scatterPeds(world.peds, x, y, 260);
  addEffect(world, x, y, 'echo', '#ffe9b0', 0.3);
}
