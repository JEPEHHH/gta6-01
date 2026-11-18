// Traffic: civilian cars that keep to their lane, drive the length of a street, slow for
// anything in front of them and come back on the street behind. They are kinematic — the
// player's car and the police are the ones with real physics — which keeps the city calm.

import { CITY, TRAFFIC, roadX, roadY } from './config.js';
import { range, pick, chance } from './random.js';
import { createCar, clamp } from './vehicles.js';
import { PALETTE } from './config.js';

/** A point on a lane, and the heading a car keeps there. */
function lanePoint(ai) {
  if (ai.axis === 'h') {
    return { x: ai.p, y: roadY(ai.line) + ai.dir * CITY.lane, angle: ai.dir > 0 ? 0 : Math.PI };
  }
  return { x: roadX(ai.line) - ai.dir * CITY.lane, y: ai.p, angle: ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

function laneStart(ai) {
  return ai.axis === 'h' ? roadX(0) : roadY(0);
}

function laneEnd(ai) {
  return ai.axis === 'h' ? roadX(CITY.cols) : roadY(CITY.rows);
}

function makeTrafficCar(random, city) {
  const horizontal = chance(random, 0.55);
  const ai = {
    axis: horizontal ? 'h' : 'v',
    line: horizontal ? Math.floor(random() * (CITY.rows + 1)) : Math.floor(random() * (CITY.cols + 1)),
    dir: chance(random, 0.5) ? 1 : -1,
    p: 0,
    cruise: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    pause: 0,
  };
  ai.p = range(random, laneStart(ai) + 40, laneEnd(ai) - 40);
  const spot = lanePoint(ai);
  const color = pick(random, PALETTE.car);
  const car = createCar(spot.x, spot.y, spot.angle, color);
  car.ai = ai;
  car.driver = 'traffic';
  car.speed = ai.cruise;
  car.city = city;
  return car;
}

export function createTraffic(random, city) {
  const cars = [];
  for (let n = 0; n < TRAFFIC.count; n += 1) cars.push(makeTrafficCar(random, city));
  return { cars };
}

/** The next car ahead on this lane, if it is close enough to matter. */
function carAhead(traffic, car) {
  let gap = 9999;
  for (const other of traffic.cars) {
    if (other === car) continue;
    const ai = other.ai;
    if (ai.axis !== car.ai.axis || ai.line !== car.ai.line || ai.dir !== car.ai.dir) continue;
    const ahead = (ai.p - car.ai.p) * car.ai.dir;
    if (ahead > 0 && ahead < gap) gap = ahead;
  }
  return gap;
}

export function updateTraffic(traffic, dt, world) {
  const { city, player } = world;
  for (const car of traffic.cars) {
    const ai = car.ai;
    let goal = ai.cruise;

    const gap = carAhead(traffic, car);
    if (gap < 58) goal = Math.max(0, goal * (gap / 58));
    if (ai.pause > 0) {
      ai.pause -= dt;
      goal = 0;
    }

    // A pedestrian or the player standing in the lane stops the car: nobody gets run over
    // by a civilian in this city.
    if (player && !player.dead) {
      const spot = lanePoint(ai);
      const along = (player.y - spot.y) * (ai.axis === 'v' ? ai.dir : 0) + (player.x - spot.x) * (ai.axis === 'h' ? ai.dir : 0);
      const across = ai.axis === 'h' ? Math.abs(player.y - spot.y) : Math.abs(player.x - spot.x);
      if (along > 0 && along < 62 && across < 26) goal = 0;
    }

    car.speed += clamp(goal - car.speed, -260 * dt, 160 * dt);
    ai.p += car.speed * ai.dir * dt;

    if (ai.dir > 0 && ai.p > laneEnd(ai) + 30) ai.p = laneStart(ai) - 30;
    if (ai.dir < 0 && ai.p < laneStart(ai) - 30) ai.p = laneEnd(ai) + 30;

    const spot = lanePoint(ai);
    car.x = spot.x;
    car.y = spot.y;
    car.angle = spot.angle;
    car.jolt = Math.max(0, car.jolt - dt * 2);
    void city;
  }
}
