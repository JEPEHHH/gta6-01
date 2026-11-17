// The four screenshot scenes behind ?shot=start|city|chase|mission. Each one stages a real moment
// of the game — a place, a car, a wanted level, a job — then runs the ordinary fixed-step
// simulation with a scripted driver for a set number of steps and freezes it. The same seed always
// produces the same frame, so a screenshot taken headless matches the one a player would see.
import { CITY, STEP } from './config.js';
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
  world.clock = 19 * 60 + 24;
  world.screen = 'title';
  const block = centreBlock(world);
  standOnCorner(world, block);
  fillJunction(world, world.camera);
  dressPavement(world, block, 5);
  simulate(world, 2.2, blank());
}

/** shot=city — on foot on a busy junction in daylight, HUD and minimap up. */
function sceneCity(world) {
  world.clock = 16 * 60 + 40;
  world.screen = 'play';
  const block = centreBlock(world);
  standOnCorner(world, block);
  const player = world.player;
  player.weapon = 'smg';
  player.cash = 1240;
  player.ammo.smg = 240;
  // The job's contact is across town, so this frame stays free roam with the marker pointing away.
  world.missions.contact = { x: player.x + 1500, y: player.y - 900 };
  fillJunction(world, world.camera);
  dressPavement(world, block, 6);
  dressFarSide(world, block, 3);
  const aimX = player.x + 260;
  const aimY = player.y - 90;
  const input = blank();
  simulate(world, 1.5, input, () => {
    input.aimX = aimX;
    input.aimY = aimY;
  });
}

/** shot=chase — four stars, patrol cars and the helicopter shadow behind the player's car. */
function sceneChase(world) {
  world.clock = 19 * 60 + 52;
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
  car.vx = 300;
  world.camera.x = car.x + 240;
  world.camera.y = car.y;

  setWanted(world, 4);
  startMission(world);
  for (const [dx, dy] of [[-190, -60], [-120, 76], [-320, 8]]) {
    const unit = createVehicle(world, 'police', car.x + dx, lane + dy, 0, 'police');
    unit.vx = 300;
    unit.siren = 1;
    unit.fireCd = 1.4;
    unit.aggression = 1;
    world.wanted.units.push(unit);
  }
  fillJunction(world, car, 150);
  dressPavement(world, centreBlock(world), 4);
  dressFarSide(world, centreBlock(world), 2);

  const input = blank();
  input.up = true;
  input.run = true;
  simulate(world, 2.2, input, (index) => {
    input.aimX = world.player.x + 160;
    input.aimY = world.player.y - 80;
    input.left = index > 70 && index < 86;
  });
}

/** shot=mission — a job in progress: marker, contact line, muzzle flash, cash on the HUD. */
function sceneMission(world) {
  world.clock = 18 * 60 + 30;
  world.screen = 'play';
  const block = centreBlock(world);
  standOnCorner(world, block);
  const player = world.player;
  player.cash = 4820;
  player.weapon = 'pistol';
  player.hp = 78;
  player.armor = 40;
  player.ammo.pistol = 94;
  fillJunction(world, world.camera);
  dressPavement(world, block, 6);
  dressFarSide(world, block, 4);

  startMission(world);
  const state = world.missions;
  state.target = { x: block.x + block.w + CITY.road + 150, y: block.y + block.h - 40 };
  state.dialog = 'Riva: "Crate at Pier Nine. Tavo pays on delivery. Do not open it."';
  state.dialogTimer = 9;

  // A target on the far pavement, one of the people already walking there.
  const targetPed = spawnPed(world, block);
  if (targetPed) {
    targetPed.x = block.x + block.w + CITY.road + 22;
    targetPed.y = player.y - 34;
    targetPed.angle = Math.PI;
    targetPed.flee = 0;
  }

  const aimX = block.x + block.w + CITY.road + 22;
  const aimY = player.y - 34;
  player.aim = Math.atan2(aimY - player.y, aimX - player.x);
  const input = blank();
  simulate(world, 1.4, input, () => {
    input.aimX = aimX;
    input.aimY = aimY;
  });
  // Fire on the very last step: the muzzle flash and the round in the air are still on screen
  // when the frame freezes.
  input.fire = true;
  updateWorld(world, STEP, input);
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
