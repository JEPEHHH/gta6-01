// Pedestrians: they walk the sidewalk loop of a block, flee gunfire and speeding cars, and die
// where they are shot. A dead pedestrian leaves a mark the street keeps for a while, and the
// people around run from it — which is most of what makes the city feel like it is watching.
import { CITY, PALETTE } from './config.js';

const SHIRTS = ['#e0574a', '#4f7fd0', '#e8c95a', '#5fa87a', '#c7b18f', '#8d5f9c', '#e8e2d4', '#3b4a66'];
const SKINS = ['#8d5a3b', '#c99770', '#efd0a8', '#6b4229', '#e0b48a'];

/** The four corners of a block's sidewalk, in the order a pedestrian walks them. */
function corners(block, inset) {
  return [
    { x: block.x + inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + block.h - inset },
    { x: block.x + inset, y: block.y + block.h - inset },
  ];
}

export function spawnPed(world, block = null) {
  const city = world.city;
  if (block) return makePed(world, block);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = world.random.range(0, Math.PI * 2);
    const distance = world.random.range(620, 1500);
    const x = world.camera.x + Math.cos(angle) * distance;
    const y = world.camera.y + Math.sin(angle) * distance;
    if (x < 120 || y < 120 || x > city.width - 120 || y > city.height - 120) continue;
    let block = null;
    let best = 1e9;
    for (const candidate of city.blocks) {
      if (candidate.kind === 'water') continue;
      const d = Math.hypot(candidate.x + candidate.w / 2 - x, candidate.y + candidate.h / 2 - y);
      if (d < best) {
        best = d;
        block = candidate;
      }
    }
    if (block) return makePed(world, block);
  }
  return null;
}

/** One pedestrian on a given block, walking its sidewalk loop in a random direction. */
function makePed(world, block) {
  const points = corners(block, CITY.walk * 0.55);
  const dir = world.random.chance(0.5) ? 1 : -1;
  const start = world.random.int(4);
  const ped = {
    x: points[start].x + world.random.range(-8, 8),
    y: points[start].y + world.random.range(-8, 8),
    angle: 0,
    speed: world.random.range(42, 78),
    hp: 40,
    dead: false,
    corpse: 0,
    points,
    corner: (start + dir + 4) % 4,
    dir,
    shirt: world.random.pick(SHIRTS),
    skin: world.random.pick(SKINS),
    hat: world.random.chance(0.2),
    bag: world.random.chance(0.25),
    phone: world.random.chance(0.3),
    flee: 0,
    fleeFrom: { x: 0, y: 0 },
    phase: world.random.range(0, 6.28),
    block,
    hitReact: 0,
  };
  ped.angle = Math.atan2(points[ped.corner].y - ped.y, points[ped.corner].x - ped.x);
  world.peds.push(ped);
  return ped;
}

export function updatePeds(world, dt) {
  const player = world.player;
  for (const ped of world.peds) {
    if (ped.dead) {
      ped.corpse += dt;
      if (ped.corpse > 16) {
        const index = world.peds.indexOf(ped);
        if (index >= 0) world.peds.splice(index, 1);
      }
      continue;
    }
    ped.hitReact = Math.max(0, ped.hitReact - dt);
    if (ped.flee > 0) {
      ped.flee -= dt;
      const angle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x) + Math.sin(ped.phase + world.time * 2) * 0.2;
      ped.x += Math.cos(angle) * 205 * dt;
      ped.y += Math.sin(angle) * 205 * dt;
      ped.angle = angle;
      ped.phase += dt * 8;
      if (ped.flee <= 0) {
        // Back to the nearest sidewalk corner once the panic passes.
        let best = 0;
        let bestDistance = 1e9;
        for (let i = 0; i < ped.points.length; i += 1) {
          const d = Math.hypot(ped.points[i].x - ped.x, ped.points[i].y - ped.y);
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        }
        ped.corner = best;
      }
    } else {
      const target = ped.points[ped.corner];
      const dx = target.x - ped.x;
      const dy = target.y - ped.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 14) {
        ped.corner = (ped.corner + ped.dir + 4) % 4;
      } else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        ped.phase += dt * ped.speed * 0.09;
      }
    }

    // A speeding car scatters the pavement, and runs over whoever is too slow.
    for (const vehicle of world.vehicles) {
      if (vehicle.scrapped) continue;
      const speed = Math.hypot(vehicle.vx, vehicle.vy);
      const d = Math.hypot(vehicle.x - ped.x, vehicle.y - ped.y);
      if (d < 34 && speed > 210) {
        hurtPed(world, ped, 60, Math.atan2(ped.y - vehicle.y, ped.x - vehicle.x), 'car');
        vehicle.vx *= 0.82;
        vehicle.vy *= 0.82;
        if (vehicle.driver === 'player') world.crime(55, 'Hit and run');
        break;
      }
      if (d < 90 && speed > 130) {
        ped.flee = Math.max(ped.flee, 1.2);
        ped.fleeFrom = { x: vehicle.x, y: vehicle.y };
      }
    }

    if (!player.car && Math.hypot(player.x - ped.x, player.y - ped.y) < 26) {
      ped.flee = Math.max(ped.flee, 0.8);
      ped.fleeFrom = { x: player.x, y: player.y };
    }
    void PALETTE;
  }
}

/** Scare everyone within `radius` of a noise: a gunshot, a crash, an explosion. */
export function fleePeds(world, x, y, radius = 340) {
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = Math.max(ped.flee, 2 + world.random.range(0, 1.5));
      ped.fleeFrom = { x, y };
    }
  }
}

export function hurtPed(world, ped, damage, angle, source) {
  if (ped.dead) return;
  ped.hp -= damage;
  ped.hitReact = 0.25;
  world.spawnParticle('blood', ped.x, ped.y, { count: 3, speed: 90, angle, color: '#a3241f' });
  if (ped.hp > 0) {
    ped.flee = Math.max(ped.flee, 2);
    ped.fleeFrom = { x: ped.x - Math.cos(angle) * 40, y: ped.y - Math.sin(angle) * 40 };
    return;
  }
  ped.dead = true;
  ped.corpse = 0;
  world.addDecal('blood', ped.x, ped.y, angle, 22, 90);
  world.spawnParticle('blood', ped.x, ped.y, { count: 10, speed: 130, color: '#8f1f1b' });
  fleePeds(world, ped.x, ped.y, 300);
  world.audio?.impact(0.3);
  if (source === 'car' || source === 'fists') world.crime(60, 'Body in the street');
  if (world.random.chance(0.35)) world.spawnPickup('cash', ped.x, ped.y, 25 + world.random.int(40));
}
