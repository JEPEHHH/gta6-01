// The respray: the one lock-up in town that takes the police off you for cash. Drive or walk onto
// the pad in front of the roller door with a wanted level and the crew repaints the car, patches
// its body and changes the plates. It is the way out of a chase that does not end at the morgue.
import { ECON } from './config.js';
import { clearWanted } from './police.js';

/** The garage's own state: where its pad is, how long the player has stood on it, and its glow. */
export function createGarageState(city) {
  const spot = city.garage ?? null;
  return {
    spot,
    inside: false,
    timer: 0,
    glow: 0,
    warnCd: 0,
    resprays: 0,
  };
}

/** A fixed step of the garage: watch the pad, charge for the work, cool the wanted level. */
export function updateGarage(world, dt) {
  const garage = world.garage;
  const spot = garage.spot;
  if (!spot) return;
  garage.glow = Math.max(0, garage.glow - dt);
  garage.warnCd = Math.max(0, garage.warnCd - dt);

  const player = world.player;
  const pad = spot.pad;
  const inside = player.x > pad.x && player.x < pad.x + pad.w && player.y > pad.y && player.y < pad.y + pad.h;
  garage.inside = inside;
  if (!inside) {
    garage.timer = Math.max(0, garage.timer - dt * 2.4);
    return;
  }
  if (world.wanted.level <= 0) {
    garage.timer = 0;
    return;
  }
  if (player.cash < ECON.sprayCost) {
    if (garage.warnCd <= 0) {
      garage.warnCd = 4;
      world.toast(`Respray costs $${ECON.sprayCost} — you are short`);
    }
    return;
  }

  garage.timer += dt;
  if (garage.timer < 0.9) return;

  // The work itself: cash out, stars out, body and paint fresh.
  garage.timer = 0;
  garage.glow = 1.4;
  garage.resprays += 1;
  player.cash -= ECON.sprayCost;
  clearWanted(world);
  if (player.car) {
    player.car.hp = player.car.maxHp;
    player.car.flash = 0.3;
    player.car.color = world.random.pick(player.car.type.colors);
  }
  world.flash = 0.4;
  world.shake = 3;
  world.spawnParticle('smoke', player.x, player.y, { count: 8, speed: 70, rise: -20, size: 12 });
  world.audio?.respray();
  world.toast(`Resprayed for $${ECON.sprayCost} — new plates, no record`);
}

/** The HUD line the pad shows when the player is on it, or when the door is close by. */
export function garageHint(world) {
  const garage = world.garage;
  if (!garage?.spot) return null;
  const player = world.player;
  const pad = garage.spot.pad;
  const near = player.x > pad.x - 90 && player.x < pad.x + pad.w + 90
    && player.y > pad.y - 90 && player.y < pad.y + pad.h + 90;
  if (!near) return null;
  if (world.wanted.level <= 0) return { text: 'TALLER SOL — respray · $' + ECON.sprayCost, tone: 'muted' };
  if (player.cash < ECON.sprayCost) return { text: 'RESPRAY NEEDS $' + ECON.sprayCost, tone: 'danger' };
  if (garage.inside) return { text: 'RESPRAYING…', tone: 'good' };
  return { text: 'STOP ON THE PAD TO RESPRAY — $' + ECON.sprayCost, tone: 'good' };
}
