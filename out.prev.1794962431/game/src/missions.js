// Six story jobs, in order: what each one asks for, the marker the HUD points at, the goons who
// get in the way and the street race against Bruno Kessler. A job is data; the machine below
// walks it step by step as the player walks, drives, shoots and hides.

import { MISSION } from './config.js';
import { createCar, stepCar, clamp, blockedAt, moveCircle } from './vehicles.js';
import { clearLine, spawnBullet, addEffect } from './combat.js';
import { raiseWanted } from './police.js';

const step = (kind, label, extra) => ({ kind, label, ...extra });

function jobsFor(city) {
  const a = city.anchors;
  return [
    {
      title: 'DOCKSIDE PICKUP',
      brief: 'A crate came in on the morning boat. Walk it back to the lockup before the tide turns.',
      steps: [
        step('goto', 'Walk down to the waterfront and take the crate', { at: a.dock }),
        step('goto', 'Carry the crate back to the lockup', { at: a.hideout }),
      ],
    },
    {
      title: 'BORROWED WHEELS',
      brief: 'The crew needs a fast car that is on nobody’s papers. Any car will do.',
      steps: [
        step('goto', 'Walk to the downtown kerb', { at: a.tower }),
        step('drive', 'Steal a car (E) and park it in the garage', { at: a.garage, radius: 62 }),
      ],
    },
    {
      title: 'HOT DELIVERY',
      brief: 'Three drops, one afternoon. Keep the car moving and keep the engine warm.',
      steps: [
        step('drive', 'Drop 1 of 3 — the midtown corner', { at: a.midtown, radius: 62 }),
        step('drive', 'Drop 2 of 3 — the east side', { at: a.east, radius: 62 }),
        step('drive', 'Drop 3 of 3 — back to the garage', { at: a.garage, radius: 62 }),
      ],
    },
    {
      title: 'THE CAUSEWAY RACE',
      brief: 'Bruno Kessler thinks nobody in this city can drive. Take his money and his pride.',
      steps: [step('race', 'Beat Bruno through the four checkpoints', { points: [a.midtown, a.north, a.east, a.west] })],
    },
    {
      title: 'WAR ON THE PIER',
      brief: 'Bruno sent his crew down to lean on the dockers. Lean back.',
      steps: [
        step('goto', 'Get to the pier', { at: a.pier }),
        step('kill', 'Take out Bruno’s crew — click to shoot', { at: a.pier, count: 3, heat: 2 }),
        step('escape', 'Lose the police', {}),
      ],
    },
    {
      title: 'THE LAST SCORE',
      brief: 'One case in the tower, and one clean way out of Salt Harbor.',
      steps: [
        step('goto', 'Take the case from the tower lobby', { at: a.tower }),
        step('kill', 'Fight your way out of the tower', { at: a.tower, count: 4, heat: 3 }),
        step('escape', 'Shake the police and get clear', {}),
      ],
    },
  ];
}

/** Dry ground near a point, for goons who should not start inside a wall. */
function spotNear(city, random, x, y, radius) {
  for (let n = 0; n < 26; n += 1) {
    const angle = random() * Math.PI * 2;
    const dist = radius * (0.35 + random() * 0.9);
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    if (!blockedAt(px, py, 11, city.solids)) return { x: px, y: py };
  }
  return { x, y };
}

function spawnGoons(world, missions, at, count) {
  for (let n = 0; n < count; n += 1) {
    const spot = spotNear(world.city, world.random, at.x, at.y, 130);
    missions.enemies.push({ x: spot.x, y: spot.y, health: 42, angle: 0, fire: 0.9 + world.random() * 0.8, hit: 0, dead: false, walk: 0 });
    addEffect(world, spot.x, spot.y, 'spark', '#b8b8b8', 0.5);
  }
}

function clearRival(world, missions) {
  if (!missions.rival) return;
  const index = world.cars.indexOf(missions.rival.car);
  if (index >= 0) world.cars.splice(index, 1);
  missions.rival = null;
}

function startRace(world, missions, points) {
  clearRival(world, missions);
  const car = createCar(points[0].x - 110, points[0].y + 34, 0, '#b0392e');
  car.driver = 'rival';
  world.cars.push(car);
  missions.rival = { car, target: 1 };
  missions.cp = 0;
}

function enterStep(world, missions, announce) {
  const job = missions.jobs[missions.index];
  const current = job.steps[missions.step];
  missions.text = current.label;
  missions.enemies = [];
  missions.hint = 0;
  missions.cp = 0;
  clearRival(world, missions);
  if (current.heat) raiseWanted(world, current.heat);
  if (current.kind === 'escape' && world.police.stars < 2) raiseWanted(world, 2);
  if (current.kind === 'kill') spawnGoons(world, missions, current.at, current.count);
  if (current.kind === 'race') startRace(world, missions, current.points);
  if (announce) {
    missions.banner = `JOB ${missions.index + 1} — ${job.title}`;
    missions.bannerLife = 4.2;
  }
}

export function createMissions(world) {
  const missions = { jobs: jobsFor(world.city), index: 0, step: 0, cp: 0, enemies: [], rival: null, text: '', hint: 0, banner: '', bannerLife: 0, done: false };
  enterStep(world, missions, true);
  return missions;
}

/** Put the story back where a save left it. */
export function resumeJob(world, index, stepIndex) {
  const missions = world.missions;
  if (!missions || index < 0 || index >= missions.jobs.length) return;
  missions.index = index;
  missions.step = Math.max(0, Math.min(stepIndex, missions.jobs[index].steps.length - 1));
  missions.done = false;
  enterStep(world, missions, true);
}

function completeStep(world, audio) {
  const missions = world.missions;
  const job = missions.jobs[missions.index];
  missions.step += 1;
  if (missions.step < job.steps.length) {
    enterStep(world, missions, false);
    audio.blip();
    return;
  }
  const pay = MISSION.pay[missions.index] ?? 300;
  world.money += pay;
  world.player.ammo += 24;
  missions.index += 1;
  missions.step = 0;
  missions.banner = `JOB ${missions.index} COMPLETE   +$${pay}`;
  missions.bannerLife = 4.6;
  world.saveDirty = true;
  audio.cash();
  clearRival(world, missions);
  if (missions.index >= missions.jobs.length) {
    missions.done = true;
    missions.text = 'Every job in Salt Harbor is done. The city is yours.';
    missions.banner = 'THE CITY IS YOURS';
    missions.bannerLife = 8;
    return;
  }
  enterStep(world, missions, true);
}

function updateGoons(world, missions, dt, audio) {
  const player = world.player;
  for (const goon of missions.enemies) {
    if (goon.dead) continue;
    goon.hit = Math.max(0, goon.hit - dt);
    const dx = player.x - goon.x;
    const dy = player.y - goon.y;
    const dist = Math.hypot(dx, dy) || 1;
    goon.angle = Math.atan2(dy, dx);
    if (dist > 175) moveCircle(goon, (dx / dist) * 78 * dt, (dy / dist) * 78 * dt, 9, world.city.solids);
    goon.fire -= dt;
    if (goon.fire <= 0 && dist < 400 && clearLine(world.city, goon.x, goon.y, player.x, player.y)) {
      goon.fire = 1.15 + world.random() * 0.7;
      spawnBullet(world, goon.x, goon.y, goon.angle + (world.random() - 0.5) * 0.2, 860, 'cop', 8);
      addEffect(world, goon.x + Math.cos(goon.angle) * 12, goon.y + Math.sin(goon.angle) * 12, 'muzzle', '#ffd08a', 0.08);
      audio.copShot();
    }
  }
}

function updateRace(world, missions, dt, audio) {
  const points = missions.jobs[missions.index].steps[missions.step].points;
  if (missions.rival) {
    const car = missions.rival.car;
    const point = points[Math.min(missions.rival.target, points.length - 1)];
    const dx = point.x - car.x;
    const dy = point.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const diff = ((Math.atan2(dy, dx) - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    stepCar(car, { throttle: dist > 60 ? 1 : 0.3, steer: clamp(diff * 1.9, -1, 1) }, dt, world.city.solids);
    if (dist < 72) {
      missions.rival.target += 1;
      if (missions.rival.target >= points.length) {
        missions.banner = 'BRUNO WON IT — RACE RESET';
        missions.bannerLife = 3.2;
        startRace(world, missions, points);
        return;
      }
    }
  }
  const aim = points[Math.min(missions.cp, points.length - 1)];
  const player = world.player;
  if (Math.hypot(player.x - aim.x, player.y - aim.y) < 78) {
    if (!player.car) {
      if (missions.hint !== 1) {
        missions.hint = 1;
        missions.banner = 'YOU NEED A CAR FOR THIS (E)';
        missions.bannerLife = 2.6;
      }
      return;
    }
    missions.cp += 1;
    world.message = { text: `CHECKPOINT ${missions.cp}/${points.length}`, life: 1.6 };
    audio.blip();
    if (missions.cp >= points.length) completeStep(world, audio);
  }
}

export function updateMissions(world, dt, audio) {
  const missions = world.missions;
  if (!missions) return;
  if (missions.bannerLife > 0) missions.bannerLife -= dt;
  if (missions.done) return;
  const job = missions.jobs[missions.index];
  if (!job) return;
  const current = job.steps[missions.step];
  if (!current) return;
  const player = world.player;

  if (current.kind === 'goto' || current.kind === 'drive') {
    if (Math.hypot(player.x - current.at.x, player.y - current.at.y) < (current.radius ?? MISSION.reach)) completeStep(world, audio);
    else if (current.kind === 'drive' && !player.car && missions.hint !== 1) {
      missions.hint = 1;
      missions.banner = 'YOU NEED A CAR FOR THIS (E)';
      missions.bannerLife = 2.6;
    }
  } else if (current.kind === 'kill') {
    updateGoons(world, missions, dt, audio);
    if (missions.enemies.length > 0 && missions.enemies.every((goon) => goon.dead)) completeStep(world, audio);
  } else if (current.kind === 'race') {
    updateRace(world, missions, dt, audio);
  } else if (current.kind === 'escape' && world.police.stars === 0) {
    completeStep(world, audio);
  }
}

/** Where the HUD's marker and the minimap's gold diamond go, or null. */
export function missionTarget(missions) {
  if (!missions || missions.done) return null;
  const job = missions.jobs[missions.index];
  if (!job) return null;
  const current = job.steps[missions.step];
  if (!current) return null;
  if (current.kind === 'kill') {
    const alive = missions.enemies.filter((goon) => !goon.dead);
    if (alive.length > 0) return { x: alive[0].x, y: alive[0].y };
  }
  if (current.kind === 'race') return current.points[Math.min(missions.cp, current.points.length - 1)];
  return current.at ?? null;
}

export const missionLabel = (missions) => (!missions || missions.done ? 'ALL JOBS DONE' : `JOB ${missions.index + 1}/${missions.jobs.length}`);
export const missionTitle = (missions) => (!missions || missions.done ? 'SALT HARBOR' : missions.jobs[missions.index].title);
