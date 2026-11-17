// Traffic: AI cars follow the lane grid from junction to junction, pick a turn at each one, keep
// their distance from whatever is ahead and brake for the player on foot. They are ordinary
// vehicles, so the player can steal one and the police can treat it as traffic like any other.
import { POP } from './config.js';
import { nearestJunction } from './city.js';
import { createVehicle, steerToward } from './vehicles.js';

const LANE = 0.24;
const CRUISE = 0.34;

/** The point on the lane a car aims at: just right of the road's centre line, by its heading. */
function lanePoint(from, to, road) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: to.x + (-dy / length) * road * LANE, y: to.y + (dx / length) * road * LANE };
}

/** Weighted choice on the world's stream, so the same seed drives the same cars around. */
function chooseWeighted(world, options) {
  let total = 0;
  for (const option of options) total += option.weight;
  let roll = world.random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

function pickOptions(city, from, to) {
  const i = Math.round((to.x - city.road / 2) / city.pitch);
  const j = Math.round((to.y - city.road / 2) / city.pitch);
  const heading = Math.sign(to.x - from.x) + Math.sign(to.y - from.y) * 2;
  const options = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || ni > city.cols || nj < 0 || nj > city.rows) continue;
    const nx = ni * city.pitch + city.road / 2;
    const ny = nj * city.pitch + city.road / 2;
    if (Math.abs(nx - from.x) < 2 && Math.abs(ny - from.y) < 2) continue;
    const straight = Math.sign(nx - to.x) + Math.sign(ny - to.y) * 2 === heading;
    options.push({ x: nx, y: ny, weight: straight ? 6 : 1 });
  }
  return options;
}

function assignNav(world, car, from, to) {
  const options = pickOptions(world.city, from, to);
  const next = options.length > 0 ? chooseWeighted(world, options) : to;
  car.nav = { from: to, to: next, target: lanePoint(to, next, world.city.road) };
}

/** A car entering the world at a junction near the camera but out of sight. */
export function spawnTrafficCar(world) {
  const city = world.city;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = world.random.range(0, Math.PI * 2);
    const distance = world.random.range(760, POP.spawnRadius);
    const x = world.camera.x + Math.cos(angle) * distance;
    const y = world.camera.y + Math.sin(angle) * distance;
    if (x < 200 || y < 200 || x > city.width - 200 || y > city.height - 200) continue;
    const junction = nearestJunction(city, x, y);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .filter(([di, dj]) => junction.i + di >= 0 && junction.i + di <= city.cols && junction.j + dj >= 0 && junction.j + dj <= city.rows);
    if (directions.length === 0) continue;
    const [di, dj] = world.random.pick(directions);
    const from = { x: junction.x, y: junction.y };
    const to = {
      x: (junction.i + di) * city.pitch + city.road / 2,
      y: (junction.j + dj) * city.pitch + city.road / 2,
    };
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    const start = {
      x: from.x + Math.cos(heading) * city.road * 0.9 + (-Math.sin(heading)) * city.road * LANE,
      y: from.y + Math.sin(heading) * city.road * 0.9 + Math.cos(heading) * city.road * LANE,
    };
    let crowded = false;
    for (const other of world.vehicles) {
      if (Math.hypot(other.x - start.x, other.y - start.y) < 110) {
        crowded = true;
        break;
      }
    }
    if (crowded) continue;
    const type = world.random.pick(['sedan', 'sedan', 'sedan', 'sport', 'van', 'pickup', 'taxi']);
    const car = createVehicle(world, type, start.x, start.y, heading, 'ai');
    car.vx = Math.cos(heading) * 120;
    car.vy = Math.sin(heading) * 120;
    car.cruise = type === 'van' || type === 'pickup' ? 0.62 : 1;
    assignNav(world, car, from, to);
    return car;
  }
  return null;
}

/** Move every AI car: advance along nav, slow for turns, jam on the brakes behind an obstacle. */
export function updateTraffic(world, dt) {
  const city = world.city;
  const player = world.player;
  for (const car of world.vehicles) {
    if (car.driver !== 'ai' || car.scrapped) continue;
    if (!car.nav) {
      // No route yet: aim at the next junction along the heading, so a newly placed car never
      // steers at a point inside a block.
      const junction = nearestJunction(city, car.x, car.y);
      const horizontal = Math.abs(Math.cos(car.angle)) >= Math.abs(Math.sin(car.angle));
      let dirX = horizontal ? Math.sign(Math.cos(car.angle)) || 1 : 0;
      let dirY = horizontal ? 0 : Math.sign(Math.sin(car.angle)) || 1;
      if (junction.x + dirX * city.pitch > city.width || junction.x + dirX * city.pitch < 0) dirX *= -1;
      if (junction.y + dirY * city.pitch > city.height || junction.y + dirY * city.pitch < 0) dirY *= -1;
      const to = { x: junction.x + dirX * city.pitch, y: junction.y + dirY * city.pitch };
      const from = { x: junction.x - dirX * city.pitch, y: junction.y - dirY * city.pitch };
      assignNav(world, car, from, to);
    }
    const nav = car.nav;
    const distanceToTurn = Math.hypot(car.x - nav.to.x, car.y - nav.to.y);
    if (distanceToTurn < city.road * 0.62) {
      assignNav(world, car, nav.from, nav.to);
    }

    let want = car.type.maxSpeed * CRUISE * (car.cruise ?? 1);
    if (distanceToTurn < 240) want *= 0.45;
    if (distanceToTurn < 130) want *= 0.6;

    // Keep clear of whatever is directly ahead, and of the player when on foot.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of world.vehicles) {
      if (other === car || other.scrapped) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 150 && side < 46) {
        const otherSpeed = Math.max(0, other.vx * fx + other.vy * fy);
        want = Math.min(want, Math.max(0, otherSpeed * 0.85 - 12));
      }
    }
    if (!player.car) {
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 110 && side < 40) want = Math.min(want, 0);
    }
    for (const ped of world.peds) {
      if (ped.dead) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < 110 * 110 && dx * fx + dy * fy > 0) want = Math.min(want, 40);
    }

    const turnRate = want < 40 ? 3.4 : 2.1;
    steerToward(world, car, nav.target, want, dt, turnRate);
    if (car.hp < car.maxHp * 0.5) car.hp = Math.min(car.maxHp, car.hp + dt * 0.6);
  }
}

export { lanePoint };
