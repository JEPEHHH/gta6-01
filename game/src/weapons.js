// Weapons: the stat table for fists, pistol, SMG and shotgun, the player's trigger, the police's
// return fire, and the bullets themselves — travel, buildings, bodies and cars. Muzzle flashes and
// spent casings are particles, not sprites, so everything here is data plus a handful of numbers.
import { clamp } from './random.js';
import { nearBuildings } from './city.js';
import { damageVehicle } from './vehicles.js';
import { hurtPed } from './peds.js';
import { blocked } from './city.js';

/** Rate is seconds between shots, spread is radians of random cone, pellets is per trigger pull. */
export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', rate: 0.3, damage: 22, range: 38, spread: 0.1, pellets: 1, melee: true, sound: 'punch', ammo: null },
  pistol: { id: 'pistol', name: 'Pistol', rate: 0.26, damage: 27, speed: 1250, spread: 0.035, pellets: 1, melee: false, sound: 'pistol', ammo: 'pistol' },
  smg: { id: 'smg', name: 'SMG', rate: 0.082, damage: 15, speed: 1150, spread: 0.1, pellets: 1, melee: false, sound: 'smg', ammo: 'smg' },
  shotgun: { id: 'shotgun', name: 'Shotgun', rate: 0.72, damage: 15, speed: 980, spread: 0.26, pellets: 7, melee: false, sound: 'shotgun', ammo: 'shotgun' },
};

/** The order the 1/2/3 keys select. */
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];

export function weaponOf(player) {
  return WEAPONS[player.weapon] ?? WEAPONS.pistol;
}

/** Called every frame the trigger is held; the weapon's own rate decides how often it fires. */
export function tryPlayerFire(world) {
  const player = world.player;
  if (player.fireCd > 0 || player.car) return;
  const weapon = weaponOf(player);
  if (!weapon.melee) {
    const stock = player.ammo[weapon.ammo] ?? 0;
    if (stock <= 0) {
      if (player.dryFire <= 0) {
        player.dryFire = 0.45;
        world.toast('Out of ammo');
        world.audio?.dry();
      }
      return;
    }
    player.ammo[weapon.ammo] = stock - 1;
  }
  player.fireCd = weapon.rate;
  player.flash = 0.07;
  player.recoil = 1;

  if (weapon.melee) {
    world.audio?.punch();
    const reach = { x: player.x + Math.cos(player.aim) * 24, y: player.y + Math.sin(player.aim) * 24 };
    for (const ped of world.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - reach.x, ped.y - reach.y) < weapon.range) {
        hurtPed(world, ped, weapon.damage, Math.atan2(ped.y - player.y, ped.x - player.x), 'fists');
        world.crime(30, 'Assault');
        break;
      }
    }
    world.spawnParticle('spark', reach.x, reach.y, { count: 2, speed: 60, color: '#f2e0bb' });
    return;
  }

  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const angle = player.aim + (world.random() - 0.5) * weapon.spread * (pellet === 0 ? 0.4 : 1);
    spawnBullet(world, player.x + Math.cos(angle) * 16, player.y + Math.sin(angle) * 16, angle, {
      owner: 'player',
      damage: weapon.damage,
      speed: weapon.speed * world.random.range(0.96, 1.04),
    });
  }
  world.audio?.shot(weapon.sound);
  world.spawnParticle('flash', player.x + Math.cos(player.aim) * 22, player.y + Math.sin(player.aim) * 22, {
    count: 1, speed: 8, size: 12, life: 0.06, color: '#ffe9a8',
  });
  world.spawnParticle('casing', player.x, player.y, { count: 1, speed: 120, life: 0.7, color: '#e8c766' });
  world.crime(22, 'Shots fired');
}

export function spawnBullet(world, x, y, angle, options) {
  world.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * options.speed,
    vy: Math.sin(angle) * options.speed,
    angle,
    life: options.life ?? 1.1,
    damage: options.damage,
    owner: options.owner,
    trail: 0,
  });
}

/** A police car or walking officer firing at a point. */
export function policeFire(world, x, y, angle, damage = 8) {
  spawnBullet(world, x, y, angle + world.random.range(-0.07, 0.07), { owner: 'police', damage, speed: 1050 });
  world.spawnParticle('flash', x, y, { count: 1, speed: 6, size: 10, life: 0.06, color: '#ffe9a8' });
  world.audio?.shot('pistol');
}

export function updateBullets(world, dt) {
  const player = world.player;
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.life -= dt;
    if (bullet.life <= 0) {
      world.bullets.splice(i, 1);
      continue;
    }
    // Two substeps so a fast round never jumps over a body or a wall.
    let consumed = false;
    for (let step = 0; step < 2 && !consumed; step += 1) {
      bullet.x += (bullet.vx * dt) / 2;
      bullet.y += (bullet.vy * dt) / 2;
      if (blocked(world.city, bullet.x, bullet.y, 2)) {
        world.spawnParticle('spark', bullet.x, bullet.y, { count: 3, speed: 90, life: 0.25 });
        consumed = true;
        break;
      }
      if (bullet.owner !== 'police') {
        for (const vehicle of world.vehicles) {
          if (vehicle.scrapped) continue;
          if (Math.hypot(vehicle.x - bullet.x, vehicle.y - bullet.y) < vehicle.type.length * 0.42) {
            damageVehicle(world, vehicle, bullet.damage * 0.7);
            if (vehicle.driver === 'police') world.crime(20, 'Police vehicle hit');
            consumed = true;
            break;
          }
        }
      }
      if (consumed) break;
      if (bullet.owner === 'player') {
        for (const ped of world.peds) {
          if (ped.dead) continue;
          if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 13) {
            hurtPed(world, ped, bullet.damage, bullet.angle, 'gun');
            world.crime(45, 'Manslaughter');
            consumed = true;
            break;
          }
        }
      } else if (!player.car && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 15) {
        world.hurtPlayer(bullet.damage, bullet.x, bullet.y);
        consumed = true;
      } else if (player.car && Math.hypot(player.car.x - bullet.x, player.car.y - bullet.y) < 26) {
        damageVehicle(world, player.car, bullet.damage);
        world.hurtPlayer(bullet.damage * 0.25);
        consumed = true;
      }
    }
    if (consumed) world.bullets.splice(i, 1);
  }
}

/** Ammo the HUD shows: the loaded weapon's stock, or a dash for fists. */
export function ammoLabel(player) {
  const weapon = weaponOf(player);
  if (weapon.melee) return '∞';
  return String(clamp(player.ammo[weapon.ammo] ?? 0, 0, 9999));
}
