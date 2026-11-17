// The four screenshot scenes behind ?shot=start|city|chase|mission. Each one stages a real moment
// of the game — a place, a car, a wanted level, a job — then runs the ordinary fixed-step
// simulation with a scripted driver for a set number of steps and freezes it. The same seed always
// produces the same frame, so a screenshot taken headless matches the one a player would see.
import { CITY, RENDER, STEP, VIEW } from './config.js';
import { updateWorld } from './world.js';
import { createVehicle } from './vehicles.js';
import { spawnPed } from './peds.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { nearestJunction } from './city.js';

/** An input frame with nothing pressed: the base every scene drives from. */
function blank() {
  return {
    up: false, down: false, left: false, right: false, run: false, enter: false,
    handbrake: false, fire: false, aimX: 0, aimY: 0, weapon: null,
  };
}

function simulate(world, seconds, input, each) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (each) each(i, input);
    updateWorld(world, STEP, input);
    if (world.outcome) break;
  }
}

/** The screen point that aims the player at a world point: input reads screen, the game world. */
function aimScreen(world, x, y) {
  const zoom = world.zoom || RENDER.zoom;
  return { aimX: VIEW.width / 2 + (x - world.camera.x) * zoom, aimY: VIEW.height / 2 + (y - world.camera.y) * zoom };
}

/** Point a scripted input frame at a world point. */
function aimAt(world, input, x, y) {
  const screen = aimScreen(world, x, y);
  input.aimX = screen.aimX;
  input.aimY = screen.aimY;
}

/** The block a point inside the city falls in. */
function blockAt(city, x, y) {
  for (const block of city.blocks) {
    if (x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h) return block;
  }
  return null;
}

/** The block nearest the middle of town that is not the marina. */
function centreBlock(world) {
  const centre = world.city.centre;
  let best = null;
  let bestDistance = Infinity;
  for (const block of world.city.blocks) {
    if (block.kind === 'water') continue;
    const d = Math.hypot(block.x + block.w / 2 - centre.x, block.y + block.h / 2 - centre.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = block;
    }
  }
  return best;
}

/** Stand the player on the south-east corner of a block, so a junction fills the middle of frame. */
function standOnCorner(world, block) {
  const player = world.player;
  player.car = null;
  player.vx = 0;
  player.vy = 0;
  player.x = block.x + block.w - 30;
  player.y = block.y + block.h - 30;
  player.aim = 0.35;
  world.camera.x = player.x + 90;
  world.camera.y = player.y + 40;
}

/** Cars queued and moving on both roads of the junction nearest the view's centre. */
function fillJunction(world, focus, speed = 110) {
  const city = world.city;
  const junction = nearestJunction(city, focus.x, focus.y);
  const lane = city.road * 0.24;
  const place = (x, y, angle, type) => {
    const car = createVehicle(world, type, x, y, angle, 'ai');
    car.vx = Math.cos(angle) * speed;
    car.vy = Math.sin(angle) * speed;
    car.cruise = 1;
    return car;
  };
  // Eastbound on the south lane, westbound on the north lane.
  place(junction.x - 330, junction.y + lane, 0, 'sedan');
  place(junction.x - 160, junction.y + lane, 0, 'taxi');
  place(junction.x + 230, junction.y + lane, 0, 'van');
  place(junction.x + 300, junction.y - lane, Math.PI, 'sport');
  place(junction.x + 90, junction.y - lane, Math.PI, 'sedan');
  // Southbound on the west lane, northbound on the east lane.
  place(junction.x - lane, junction.y - 340, Math.PI / 2, 'sedan');
  place(junction.x - lane, junction.y + 250, Math.PI / 2, 'pickup');
  place(junction.x + lane, junction.y - 200, -Math.PI / 2, 'sedan');
  place(junction.x + lane, junction.y + 330, -Math.PI / 2, 'taxi');
  return junction;
}

/** Put people on the pavements the camera sees: the block's own south side, and the far side. */
function dressPavement(world, block, count = 4) {
  for (let i = 0; i < count; i += 1) {
    const ped = spawnPed(world, block);
    if (!ped) continue;
    const t = (i + 1) / (count + 1);
    ped.x = block.x + block.w * t;
    ped.y = block.y + block.h - 15 + (i % 2 === 0 ? 0 : 8);
    ped.angle = i % 2 === 0 ? 0 : Math.PI;
    ped.corner = i % 2 === 0 ? 3 : 2;
    ped.flee = 0;
  }
}

/** People on the pavement across the road east of the player. */
function dressFarSide(world, block, count = 3) {
  for (let i = 0; i < count; i += 1) {
    const ped = spawnPed(world, block);
    if (!ped) continue;
    ped.x = block.x + block.w + CITY.road + 16;
    ped.y = block.y + block.h * (0.25 + i * 0.2);
    ped.angle = Math.PI;
    ped.corner = 0;
  }
}

/** shot=start — the title over a live junction at dusk. */
function sceneStart(world) {
  world.clock = 18 * 60 + 42;
  world.screen = 'title';
  const block = centreBlock(world);
  standOnCorner(world, block);
  fillJunction(world, world.camera);
  dressPavement(world, block, 5);
  simulate(world, 2.2, blank());
}

/** shot=city — on foot on a busy junction in daylight, the respray garage behind, HUD up. */
function sceneCity(world) {
  world.clock = 16 * 60 + 40;
  world.screen = 'play';
  const garage = world.city.garage;
  const block = (garage && blockAt(world.city, garage.x + garage.w / 2, garage.y + garage.h / 2)) ?? centreBlock(world);
  standOnCorner(world, block);
  const player = world.player;
  player.weapon = 'smg';
  player.cash = 1240;
  player.ammo.smg = 240;
  player.hp = 94;
  // The job's contact is across town, so this frame stays free roam with the marker pointing away.
  world.missions.contact = { x: player.x + 1400, y: player.y - 800 };
  fillJunction(world, world.camera);
  dressPavement(world, block, 6);
  dressFarSide(world, block, 4);

  // A car at the kerb in reach of the player, and cash on the pavement: the two things to grab.
  const kerb = createVehicle(world, 'sport', player.x - 96, player.y + 64, Math.PI, 'none');
  kerb.color = '#2ec4b6';
  world.spawnPickup('cash', block.x + block.w - 62, block.y + block.h - 8, 60);

  const aimX = player.x + 240;
  const aimY = player.y - 90;
  const input = blank();
  simulate(world, 1.6, input, (index) => {
    aimAt(world, input, aimX, aimY);
    input.right = index < 26;
  });
  // The camera sits between the player and what he is aiming at.
  world.camera.x = player.x + 34;
  world.camera.y = player.y - 26;
}

/** shot=chase — four stars, patrol cars ahead and alongside, helicopter shadow, a live objective. */
function sceneChase(world) {
  world.clock = 18 * 60 + 12;
  world.screen = 'play';
  const city = world.city;
  const junction = nearestJunction(city, city.centre.x, city.centre.y);
  const lane = junction.y + city.road * 0.2;
  const car = createVehicle(world, 'sport', junction.x - 300, lane, 0, 'player');
  car.color = '#e8b23f';
  const player = world.player;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.cash = 8420;
  player.weapon = 'smg';
  player.ammo.smg = 180;
  player.hp = 88;
  car.vx = 330;
  car.vy = 0;
  world.camera.x = car.x + 240;
  world.camera.y = car.y;

  setWanted(world, 4);
  world.missions.index = 0;
  startMission(world);
  // Patrol cars ahead and alongside, the way a pursuit looks from behind the wheel.
  const units = [[210, -74], [150, 78], [-150, -72], [-215, 58]];
  units.forEach(([dx, dy], index) => {
    const unit = createVehicle(world, 'police', car.x + dx, lane + dy, 0, 'police');
    unit.vx = 330;
    unit.siren = 1;
    unit.fireCd = 0.8;
    unit.aggression = 1.1 - index * 0.1;
    world.wanted.units.push(unit);
  });
  fillJunction(world, car, 170);
  dressPavement(world, centreBlock(world), 5);
  dressFarSide(world, centreBlock(world), 3);

  // Rubber down behind the car and sparks off the bonnet: the chase is happening right now.
  for (let i = 0; i < 16; i += 1) {
    world.addDecal('tire', car.x - 96 - i * 24, lane + (i % 2 === 0 ? 10 : -10), 0, 9, 24);
  }
  world.spawnParticle('spark', car.x + 26, lane - 18, { count: 8, speed: 220 });
  world.spawnParticle('flash', car.x + 30, lane - 20, { count: 1, size: 14, life: 0.5, color: '#ffe9a8' });

  const input = blank();
  input.up = true;
  input.run = true;
  simulate(world, 2.0, input, (index) => {
    aimAt(world, input, world.player.x + 220, world.player.y - 90);
    input.left = index > 74 && index < 88;
  });
  // The car low in frame, the road and the pursuit ahead of it.
  world.camera.x = car.x + 70;
  world.camera.y = car.y + 20;
}

/** shot=mission — a job in progress on foot: a marked car to wreck, the contact's line, muzzle flash. */
function sceneMission(world) {
  world.clock = 18 * 60 + 30;
  world.screen = 'play';
  const block = centreBlock(world);
  standOnCorner(world, block);
  const player = world.player;
  player.cash = 4820;
  player.weapon = 'smg';
  player.ammo.smg = 168;
  player.hp = 78;
  player.armor = 40;
  fillJunction(world, world.camera);
  dressPavement(world, block, 5);
  dressFarSide(world, block, 3);

  // The courier's car: a job with a target you can put a ring around.
  world.missions.index = 4;
  startMission(world);
  const marked = world.vehicles.find((vehicle) => vehicle.marked);
  if (marked) {
    marked.x = player.x + 215;
    marked.y = player.y - 66;
    marked.angle = Math.PI;
    marked.driver = 'none';
    marked.nav = null;
    marked.vx = 0;
    marked.vy = 0;
    marked.hp = marked.maxHp * 0.5;
    world.missions.target = { x: marked.x, y: marked.y };
  }

  const aimX = marked ? marked.x : player.x + 215;
  const aimY = marked ? marked.y : player.y - 66;
  const input = blank();
  simulate(world, 1.3, input, (index) => {
    aimAt(world, input, aimX, aimY);
    if (index % 8 === 0) world.spawnParticle('smoke', aimX - 30, aimY + 4, { count: 1, speed: 24, rise: -30, size: 11 });
  });
  // Fire on the last steps: the flash, the tracer and the smoke are all on screen when it freezes.
  aimAt(world, input, aimX, aimY);
  input.fire = true;
  updateWorld(world, STEP, input);
  updateWorld(world, STEP, input);

  world.camera.x = player.x + 74;
  world.camera.y = player.y - 34;
}

const SCENES = { start: sceneStart, city: sceneCity, chase: sceneChase, mission: sceneMission };

/** Build the named scene in `world` and freeze it: the loop keeps drawing, nothing advances. */
export function stageShot(world, name) {
  const scene = SCENES[name] ?? SCENES.city;
  scene(world);
  world.messages.length = 0;
  world.frozen = true;
  return { name: SCENES[name] ? name : 'city' };
}
