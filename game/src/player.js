// The player on foot: walking and running, aiming at the mouse, shooting and punching, health and
// armour, cash, and getting in and out of cars. Driving physics lives in vehicles.js; this module
// decides which of the two the player is doing and keeps the body out of walls.
import { ECON, PALETTE, PLAYER, RENDER, VIEW } from './config.js';
import { clamp } from './random.js';
import { nearBuildings } from './city.js';
import { driveVehicle, nearestVehicle, integrate } from './vehicles.js';
import { tryPlayerFire, WEAPON_ORDER, weaponOf } from './weapons.js';

export function createPlayer(city) {
  return {
    x: city.spawn.x,
    y: city.spawn.y,
    vx: 0,
    vy: 0,
    angle: city.spawn.angle,
    aim: city.spawn.angle,
    hp: PLAYER.maxHealth,
    armor: 0,
    cash: PLAYER.startCash,
    weapon: 'pistol',
    ammo: { pistol: 96, smg: 180, shotgun: 24 },
    car: null,
    invuln: 0,
    fireCd: 0,
    dryFire: 0,
    recoil: 0,
    flash: 0,
    walkPhase: 0,
    stride: 0,
    driving: false,
  };
}

/** The world point under the mouse: the input reads the screen, the game lives in world pixels. */
export function aimPoint(world, input) {
  const zoom = world.zoom || RENDER.zoom;
  return {
    x: world.camera.x + (input.aimX - VIEW.width / 2) / zoom,
    y: world.camera.y + (input.aimY - VIEW.height / 2) / zoom,
  };
}

/** One fixed step of the player: aim, trigger, enter/exit, then either drive or walk. */
export function updatePlayer(world, dt, input) {
  const player = world.player;
  player.invuln = Math.max(0, player.invuln - dt);
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.dryFire = Math.max(0, player.dryFire - dt);
  player.recoil = Math.max(0, player.recoil - dt * 6);
  player.flash = Math.max(0, player.flash - dt);

  const aim = aimPoint(world, input);
  player.aimX = aim.x;
  player.aimY = aim.y;
  player.aim = Math.atan2(aim.y - player.y, aim.x - player.x);
  if (input.weapon && WEAPON_ORDER.includes(input.weapon)) {
    if (player.weapon !== input.weapon) {
      player.weapon = input.weapon;
      player.fireCd = Math.max(player.fireCd, 0.18);
      world.audio?.click();
    }
  }

  if (input.enter && !world.prevEnter) toggleVehicle(world);
  world.prevEnter = Boolean(input.enter);

  if (player.car) {
    player.driving = true;
    const car = player.car;
    car.driver = 'player';
    driveVehicle(world, car, dt, input);
    integrate(world, car, dt);
    player.x = car.x;
    player.y = car.y;
    player.vx = car.vx;
    player.vy = car.vy;
    player.angle = car.angle;
    if (input.fire && player.fireCd <= 0) driveBy(world, car);
  } else {
    player.driving = false;
    walk(world, player, dt, input);
    if (input.fire) tryPlayerFire(world);
  }
}

function walk(world, player, dt, input) {
  let ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(ax, ay);
  if (length > 0) {
    ax /= length;
    ay /= length;
  }
  const speed = input.run ? PLAYER.run : PLAYER.walk;
  const wantX = ax * speed;
  const wantY = ay * speed;
  const blend = 1 - Math.exp(-14 * dt);
  player.vx += (wantX - player.vx) * blend;
  player.vy += (wantY - player.vy) * blend;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.angle = player.aim;

  const moved = Math.hypot(player.vx, player.vy);
  player.stride += moved * dt;
  player.walkPhase = (player.walkPhase + moved * dt * 0.055) % (Math.PI * 2);

  pushOutOfBuildings(world, player, PLAYER.radius);
}

/** A drive-by shot from the car window: weaker than on foot, enough to make a chase run. */
function driveBy(world, car) {
  const player = world.player;
  const weapon = weaponOf(player);
  if (weapon.melee) return;
  const stock = player.ammo[weapon.ammo] ?? 0;
  if (stock <= 0) return;
  player.ammo[weapon.ammo] = stock - 1;
  player.fireCd = weapon.rate * 1.6;
  const side = Math.atan2(player.aim - car.angle + Math.PI, 1);
  void side;
  const angle = player.aim;
  for (let pellet = 0; pellet < Math.max(1, weapon.pellets - 3); pellet += 1) {
    const jitter = angle + world.random.range(-0.12, 0.12);
    world.bullets.push({
      x: car.x + Math.cos(jitter) * 24,
      y: car.y + Math.sin(jitter) * 24,
      vx: Math.cos(jitter) * 1100,
      vy: Math.sin(jitter) * 1100,
      angle: jitter,
      life: 0.9,
      damage: weapon.damage * 0.8,
      owner: 'player',
      trail: 0,
    });
  }
  world.spawnParticle('flash', car.x + Math.cos(angle) * 26, car.y + Math.sin(angle) * 26,
    { count: 1, size: 10, life: 0.06, color: '#ffe9a8' });
  world.audio?.shot(weapon.sound);
  world.crime(18, 'Shots fired');
}

/** E: get into the closest car, or step out of the one being driven. */
function toggleVehicle(world) {
  const player = world.player;
  if (player.car) {
    const car = player.car;
    car.driver = 'none';
    car.exitTimer = 0.3;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 34;
    player.y = car.y + Math.sin(side) * 34;
    player.car = null;
    pushOutOfBuildings(world, player, PLAYER.radius);
    world.audio?.click();
    return;
  }
  const car = nearestVehicle(world, player.x, player.y, PLAYER.enterRange);
  if (!car) {
    world.toast('No car in reach');
    return;
  }
  if (car.driver === 'ai') {
    // Carjacking: the occupant bails out and someone calls it in.
    world.crime(70, 'Grand theft auto');
    world.toast('Carjacked a ' + car.name);
    car.nav = null;
  } else {
    world.toast(car.name);
  }
  car.driver = 'player';
  car.vx = 0;
  car.vy = 0;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  world.audio?.engineOn();
}

/** Circle-versus-rectangle: push a walking body out of any building it has overlapped. */
export function pushOutOfBuildings(world, entity, radius) {
  for (const b of nearBuildings(world.city, entity.x, entity.y, radius + 20)) {
    const cx = clamp(entity.x, b.x, b.x + b.w);
    const cy = clamp(entity.y, b.y, b.y + b.h);
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      entity.x = cx + (dx / d) * radius;
      entity.y = cy + (dy / d) * radius;
    } else {
      // Dead centre inside a wall: step out by the shortest way.
      const left = entity.x - b.x;
      const right = b.x + b.w - entity.x;
      const up = entity.y - b.y;
      const down = b.y + b.h - entity.y;
      const min = Math.min(left, right, up, down);
      if (min === left) entity.x = b.x - radius;
      else if (min === right) entity.x = b.x + b.w + radius;
      else if (min === up) entity.y = b.y - radius;
      else entity.y = b.y + b.h + radius;
    }
  }
}

/** Wasted: the hospital bill takes some cash, and the player wakes up beside the morgue. */
export function revivePlayer(world) {
  const player = world.player;
  player.hp = PLAYER.respawnHealth;
  player.armor = 0;
  player.cash = Math.max(0, player.cash - 100);
  player.car = null;
  player.x = world.city.spawn.x;
  player.y = world.city.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.invuln = 1.5;
  world.outcome = null;
  world.screen = 'play';
  world.wanted.level = 0;
  world.wanted.heat = 0;
  world.toast('Wasted — the clinic patched you up');
  void ECON;
  void PALETTE;
}
