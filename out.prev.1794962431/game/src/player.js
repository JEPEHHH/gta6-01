// The player on foot and behind the wheel: walking with a little inertia, sprinting, aiming
// at the mouse, shooting, and stepping into the nearest car with E. Driving hands the same
// frame's input to the car's physics instead.

import { PLAYER, VIEW, VEHICLE } from './config.js';
import { blockedAt, clamp, moveCircle, nearestCar, stepCar } from './vehicles.js';
import { firePlayerShot, addEffect } from './combat.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    vx: 0,
    vy: 0,
    health: PLAYER.health,
    ammo: PLAYER.ammo,
    fire: 0,
    step: 0,
    hurt: 0,
    recoil: 0,
    walk: 0,
    car: null,
    dead: false,
    deadTimer: 0,
    respawns: 0,
  };
}

const aimPoint = (world, input) => ({
  x: world.camera.x + (input.mouse.x - VIEW.width / 2),
  y: world.camera.y + (input.mouse.y - VIEW.height / 2),
});

export function playerEnterCar(world, car) {
  const player = world.player;
  if (car.ai) {
    const index = world.traffic.cars.indexOf(car);
    if (index >= 0) world.traffic.cars.splice(index, 1);
    car.ai = null;
  }
  car.driver = 'player';
  car.speed *= 0.5;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
}

export function playerExitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed *= 0.4;
  player.car = null;
  for (const side of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const nx = car.x + Math.cos(car.angle + side) * 30;
    const ny = car.y + Math.sin(car.angle + side) * 30;
    if (!blockedAt(nx, ny, PLAYER.radius, world.city.solids)) {
      player.x = nx;
      player.y = ny;
      return;
    }
  }
  player.x = car.x;
  player.y = car.y;
}

function driveCar(world, input, dt, audio) {
  const player = world.player;
  const car = player.car;
  const throttle = -input.axisY();
  const steer = input.axisX();
  const speedBefore = Math.abs(car.speed);
  const hit = stepCar(car, { throttle, steer }, dt, world.city.solids);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;

  if (hit && speedBefore > 150) {
    audio.crash();
    player.hurt = 0.2;
    addEffect(world, car.x, car.y, 'spark', '#ffe0a3', 0.3);
    if (speedBefore > 260) player.health = Math.max(0, player.health - 4);
  }
  audio.engine(Math.abs(car.speed) / VEHICLE.maxSpeed);

  if (input.pressed('KeyE')) {
    playerExitCar(world);
    audio.engineOff();
  }
}

export function updatePlayer(world, input, dt, audio) {
  const player = world.player;

  if (player.dead) {
    player.deadTimer -= dt;
    if (player.deadTimer <= 0) {
      player.dead = false;
      player.health = PLAYER.health;
      player.ammo = Math.max(player.ammo, 40);
      player.x = world.city.anchors.home.x;
      player.y = world.city.anchors.home.y;
      player.vx = 0;
      player.vy = 0;
      world.respawnFlash = 1.2;
    }
    return;
  }

  player.fire = Math.max(0, player.fire - dt);
  player.hurt = Math.max(0, player.hurt - dt);
  player.recoil = Math.max(0, player.recoil - dt);

  if (player.car) {
    driveCar(world, input, dt, audio);
    if (input.mouse.down && player.fire <= 0 && player.ammo > 0) {
      player.fire = PLAYER.fireDelay;
      player.ammo -= 1;
      const aim = aimPoint(world, input);
      player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
      firePlayerShot(world, player, audio);
    }
    return;
  }

  const aim = aimPoint(world, input);
  player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);

  const ax = input.axisX();
  const ay = input.axisY();
  const speed = input.sprint() ? PLAYER.sprint : PLAYER.walk;
  const length = Math.hypot(ax, ay);
  const tx = length > 0 ? (ax / length) * speed : 0;
  const ty = length > 0 ? (ay / length) * speed : 0;
  const blend = clamp(dt * PLAYER.accel / 120, 0, 1);
  player.vx += (tx - player.vx) * blend;
  player.vy += (ty - player.vy) * blend;

  moveCircle(player, player.vx * dt, player.vy * dt, PLAYER.radius, world.city.solids);
  player.x = clamp(player.x, PLAYER.radius, world.city.width - PLAYER.radius);
  player.y = clamp(player.y, PLAYER.radius, world.city.height - PLAYER.radius);

  const moving = Math.hypot(player.vx, player.vy) > 20;
  player.walk += moving ? Math.hypot(player.vx, player.vy) * dt * 0.09 : 0;
  if (moving) {
    player.step -= dt * (input.sprint() ? 1.7 : 1);
    if (player.step <= 0) {
      player.step = 0.34;
      audio.step();
    }
  }

  if (input.mouse.down && player.fire <= 0 && player.ammo > 0) {
    player.fire = PLAYER.fireDelay;
    player.ammo -= 1;
    firePlayerShot(world, player, audio);
  }

  if (input.pressed('KeyE')) {
    const car = nearestCar(world.cars, player.x, player.y, PLAYER.reach);
    if (car && !car.wreck) {
      playerEnterCar(world, car);
      audio.blip();
      audio.engineOn();
    }
  }
}

export function damagePlayer(world, amount) {
  const player = world.player;
  if (player.dead) return;
  player.health -= amount;
  player.hurt = 0.3;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    player.deadTimer = 2.6;
    player.respawns += 1;
    world.money = Math.max(0, world.money - 150);
    if (player.car) {
      player.car.driver = 'parked';
      player.car = null;
    }
  }
}
