// Bullets and the small effects that follow them. Every shot in the game — the player's, a
// cop's, a goon's — is one bullet struct stepped in short hops so nothing tunnels through a
// wall, and every hit leaves a spark, a splash or a body behind.

import { blockedAt } from './vehicles.js';
import { killPed } from './peds.js';

export function spawnBullet(world, x, y, angle, speed, owner, damage) {
  world.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.66,
    owner,
    damage,
  });
}

export function addEffect(world, x, y, kind, color, life, angle) {
  world.effects.push({
    x,
    y,
    kind,
    color,
    life,
    max: life,
    angle: angle ?? Math.random() * Math.PI * 2,
  });
}

export function updateEffects(world, dt) {
  for (let n = world.effects.length - 1; n >= 0; n -= 1) {
    const effect = world.effects[n];
    effect.life -= dt;
    if (effect.life <= 0) world.effects.splice(n, 1);
  }
}

/** Whether a straight line between two points is clear of buildings. */
export function clearLine(city, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(dist / 30);
  for (let n = 1; n < steps; n += 1) {
    const t = n / steps;
    if (blockedAt(ax + (bx - ax) * t, ay + (by - ay) * t, 3, city.solids)) return false;
  }
  return true;
}

function hitPerson(bullet, person, damage) {
  const dx = bullet.x - person.x;
  const dy = bullet.y - person.y;
  if (dx * dx + dy * dy > 169) return false;
  person.health -= damage;
  return true;
}

/** One step for every bullet in flight, with what it hit. */
export function updateBullets(world, dt, audio) {
  const bullets = world.bullets;
  const player = world.player;
  for (let n = bullets.length - 1; n >= 0; n -= 1) {
    const bullet = bullets[n];
    bullet.life -= dt;
    let gone = bullet.life <= 0;
    const travel = Math.hypot(bullet.vx, bullet.vy) * dt;
    const hops = Math.max(1, Math.ceil(travel / 14));
    for (let hop = 0; hop < hops && !gone; hop += 1) {
      bullet.x += (bullet.vx * dt) / hops;
      bullet.y += (bullet.vy * dt) / hops;

      if (blockedAt(bullet.x, bullet.y, 3, world.city.solids)) {
        addEffect(world, bullet.x, bullet.y, 'spark', '#ffe0a3', 0.16);
        gone = true;
        break;
      }

      if (bullet.owner === 'player') {
        const police = world.police;
        for (const cop of police.cops) {
          if (!cop.dead && hitPerson(bullet, cop, bullet.damage)) {
            cop.hit = 0.2;
            if (cop.health <= 0) {
              cop.dead = true;
              addEffect(world, cop.x, cop.y, 'splash', '#8c2f2f', 0.5);
              world.money += 20;
            }
            addEffect(world, bullet.x, bullet.y, 'spark', '#ffd27a', 0.2);
            gone = true;
            break;
          }
        }
        if (gone) break;
        for (const unit of police.cars) {
          if (hitPerson(bullet, unit.car, bullet.damage)) {
            addEffect(world, bullet.x, bullet.y, 'spark', '#ffd27a', 0.2);
            if (unit.car.health <= 0) {
              addEffect(world, unit.car.x, unit.car.y, 'boom', '#ff8b3d', 0.6);
            }
            gone = true;
            break;
          }
        }
        if (gone) break;
        for (const goon of world.missions.enemies) {
          if (goon.dead) continue;
          if (hitPerson(bullet, goon, bullet.damage)) {
            goon.hit = 0.2;
            if (goon.health <= 0) {
              goon.dead = true;
              addEffect(world, goon.x, goon.y, 'splash', '#8c2f2f', 0.6);
              world.money += 35;
            }
            gone = true;
            break;
          }
        }
        if (gone) break;
        for (const ped of world.peds) {
          if (!ped.alive) continue;
          const dx = bullet.x - ped.x;
          const dy = bullet.y - ped.y;
          if (dx * dx + dy * dy < 169) {
            killPed(ped);
            addEffect(world, bullet.x, bullet.y, 'splash', '#8c2f2f', 0.5);
            world.wantedHeat = 1;
            gone = true;
            break;
          }
        }
      } else if (player && !player.dead) {
        if (player.car) {
          if (hitPerson(bullet, player.car, bullet.damage)) {
            addEffect(world, bullet.x, bullet.y, 'spark', '#ffd27a', 0.2);
            player.car.damage = Math.min(100, (player.car.damage ?? 0) + bullet.damage);
            gone = true;
            break;
          }
        } else if (hitPerson(bullet, player, bullet.damage)) {
          addEffect(world, bullet.x, bullet.y, 'splash', '#b23a3a', 0.4);
          player.hurt = 0.35;
          player.health = Math.max(0, player.health - bullet.damage);
          audio.hit();
          gone = true;
          break;
        }
      }
    }
    if (gone) bullets.splice(n, 1);
  }
}

/** The player's shot: a bullet, a flash, a noise, a shell of heat if it lands on a person. */
export function firePlayerShot(world, player, audio) {
  const muzzleX = player.x + Math.cos(player.angle) * 13;
  const muzzleY = player.y + Math.sin(player.angle) * 13;
  spawnBullet(world, muzzleX, muzzleY, player.angle, 1480, 'player', 30);
  addEffect(world, muzzleX, muzzleY, 'muzzle', '#ffd98a', 0.09);
  audio.shot();
  player.recoil = 0.12;
}
