// The painter: camera in, pixels out. The static city (streets, kerbs, lots, buildings, trees,
// docks and sea) is drawn from the city data every frame with off-screen parts culled, then the
// people, cars, bullets and effects on top, then a warm vignette.

import { VIEW, CITY, PALETTE, cityBottom } from './config.js';
import { hash2 } from './random.js';
import { nearestCar } from './vehicles.js';
import { missionTarget } from './missions.js';

const PAD = 80;
const box = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
const dot = (ctx, color, x, y, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

function inView(cam, x, y, w, h) {
  return x + w > cam.x - VIEW.width / 2 - PAD && x < cam.x + VIEW.width / 2 + PAD && y + h > cam.y - VIEW.height / 2 - PAD && y < cam.y + VIEW.height / 2 + PAD;
}

function drawShore(ctx, city, cam) {
  const left = cam.x - VIEW.width / 2 - 40;
  const top = cam.y - VIEW.height / 2 - 40;
  // Beyond the last street the ground stays tarmac, never an empty hole in the picture.
  box(ctx, '#3a424b', left, top, VIEW.width + 80, VIEW.height + 80);
  const water = city.water;
  if (!inView(cam, water.x, water.y, water.w, water.h)) return;
  box(ctx, PALETTE.water, water.x, water.y, water.w, water.h);
  ctx.strokeStyle = 'rgba(190,235,240,0.22)';
  ctx.lineWidth = 2;
  for (let x = Math.max(0, Math.floor((cam.x - VIEW.width / 2) / 46) * 46); x < cam.x + VIEW.width / 2 + 60; x += 46) {
    for (let y = water.y + 22; y < water.y + water.h; y += 34) {
      const wobble = Math.sin((x + y) * 0.03) * 5;
      ctx.beginPath();
      ctx.moveTo(x, y + wobble);
      ctx.lineTo(x + 16, y + wobble);
      ctx.stroke();
    }
  }
  box(ctx, PALETTE.sand, city.sand.x, city.sand.y, city.sand.w, city.sand.h);
  box(ctx, 'rgba(255,255,255,0.32)', city.sand.x, city.water.y - 3, city.sand.w, 5);
  for (const pier of city.piers) {
    box(ctx, '#a98a5f', pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(70,52,32,0.35)';
    ctx.lineWidth = 1.5;
    for (let y = pier.y + 14; y < pier.y + pier.h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(pier.x, y);
      ctx.lineTo(pier.x + pier.w, y);
      ctx.stroke();
    }
    const hull = pier.y + pier.h - 44;
    ctx.fillStyle = '#e8e4d6';
    ctx.beginPath();
    ctx.ellipse(pier.x + pier.w / 2, hull, 20, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f6f8a';
    ctx.beginPath();
    ctx.ellipse(pier.x + pier.w / 2, hull - 4, 11, 17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarkings(ctx, city, cam) {
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([16, 18]);
  for (const x of city.roadsX) {
    if (Math.abs(x - cam.x) > VIEW.width / 2 + 20) continue;
    ctx.beginPath();
    ctx.moveTo(x, CITY.margin - 30);
    ctx.lineTo(x, cityBottom());
    ctx.stroke();
  }
  for (const y of city.roadsY) {
    if (Math.abs(y - cam.y) > VIEW.height / 2 + 20) continue;
    ctx.beginPath();
    ctx.moveTo(CITY.margin - 30, y);
    ctx.lineTo(city.width - CITY.margin + 30, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks and stop lines on the four sides of every intersection in view.
  const inset = CITY.roadHalf + 16;
  for (const x of city.roadsX) {
    if (Math.abs(x - cam.x) > VIEW.width / 2 + 40) continue;
    for (const y of city.roadsY) {
      if (Math.abs(y - cam.y) > VIEW.height / 2 + 40) continue;
      ctx.fillStyle = 'rgba(240,236,220,0.42)';
      for (let n = -2; n <= 2; n += 1) {
        ctx.fillRect(x + n * 11 - 4, y - CITY.roadHalf - 11, 7, 22);
        ctx.fillRect(x + n * 11 - 4, y + CITY.roadHalf - 11, 7, 22);
        ctx.fillRect(x - CITY.roadHalf - 11, y + n * 11 - 4, 22, 7);
        ctx.fillRect(x + CITY.roadHalf - 11, y + n * 11 - 4, 22, 7);
      }
      ctx.fillStyle = 'rgba(240,236,220,0.3)';
      ctx.fillRect(x - inset, y - inset - 3, 34, 4);
      ctx.fillRect(x + inset - 34, y + inset - 1, 34, 4);
      ctx.fillRect(x - inset - 3, y + inset - 34, 4, 34);
      ctx.fillRect(x + inset - 1, y - inset, 4, 34);
    }
  }
}

const LOT_FILL = { park: PALETTE.grass, parking: PALETTE.asphaltAlt, docks: '#9d968a' };

function drawBlockBase(ctx, block) {
  const foot = { x: block.x - CITY.sidewalk, y: block.y - CITY.sidewalk, w: block.w + CITY.sidewalk * 2, h: block.h + CITY.sidewalk * 2 };
  box(ctx, PALETTE.sidewalk, foot.x, foot.y, foot.w, foot.h);
  ctx.strokeStyle = 'rgba(120,112,98,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(foot.x + 1.5, foot.y + 1.5, foot.w - 3, foot.h - 3);
  box(ctx, LOT_FILL[block.kind] ?? '#b9b2a3', block.x, block.y, block.w, block.h);
  if (block.kind === 'park') {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let n = 0; n < 5; n += 1) ctx.fillRect(block.x + 12 + n * 34, block.y + block.h * 0.5 - 6, 22, 12);
    box(ctx, 'rgba(226,214,180,0.55)', block.x + block.w * 0.45, block.y, 14, block.h);
  }
  // Paving joints across the pavement ring.
  ctx.strokeStyle = 'rgba(150,144,130,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = foot.x + 14; x < foot.x + foot.w - 8; x += 24) {
    ctx.moveTo(x, foot.y + 2);
    ctx.lineTo(x, block.y - 2);
    ctx.moveTo(x, block.y + block.h + 2);
    ctx.lineTo(x, foot.y + foot.h - 2);
  }
  for (let y = foot.y + 14; y < foot.y + foot.h - 8; y += 24) {
    ctx.moveTo(foot.x + 2, y);
    ctx.lineTo(block.x - 2, y);
    ctx.moveTo(block.x + block.w + 2, y);
    ctx.lineTo(foot.x + foot.w - 2, y);
  }
  ctx.stroke();
}

function drawBuilding(ctx, b) {
  box(ctx, PALETTE.shadow, b.x + 8, b.y + 9, b.w, b.h);
  box(ctx, b.tone, b.x, b.y, b.w, b.h);
  box(ctx, 'rgba(255,255,255,0.16)', b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.strokeStyle = 'rgba(60,58,52,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  if (b.kind === 'house') box(ctx, 'rgba(110,150,90,0.65)', b.x - 6, b.y + b.h - 8, b.w + 12, 14);
  if (b.kind === 'tower' || b.kind === 'office') {
    const cols = Math.max(2, Math.floor(b.w / 20));
    const rows = Math.max(2, Math.floor(b.h / 18));
    const pad = 8;
    const cw = (b.w - pad * 2) / cols;
    const ch = (b.h - pad * 2) / rows;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const lit = hash2(Math.round(b.x) + c, Math.round(b.y) + r) > 0.78;
        ctx.globalAlpha = lit ? 0.85 : 0.55;
        box(ctx, lit ? PALETTE.windowLit : PALETTE.window, b.x + pad + c * cw + 2, b.y + pad + r * ch + 2, Math.max(3, cw - 5), Math.max(3, ch - 5));
      }
    }
    // The plant on the roof: a lift shaft, an air handler and the parapet around them.
    ctx.globalAlpha = 1;
    box(ctx, 'rgba(96,104,110,0.5)', b.x + b.w * 0.32, b.y + b.h * 0.34, b.w * 0.36, b.h * 0.3);
    box(ctx, 'rgba(255,255,255,0.22)', b.x + b.w * 0.32, b.y + b.h * 0.34, b.w * 0.36, 4);
    ctx.strokeStyle = 'rgba(60,58,52,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x + 9, b.y + 9, b.w - 18, b.h - 18);
    if (b.kind === 'tower') box(ctx, '#8a8f96', b.x + b.w * 0.46, b.y + b.h * 0.44, 8, 8);
  } else if (b.kind === 'shop') {
    if (b.awning) box(ctx, b.awning, b.x + 3, b.y + b.h - 9, b.w - 6, 7);
    box(ctx, 'rgba(70,90,105,0.5)', b.x + 6, b.y + 8, b.w - 12, Math.max(6, b.h * 0.22));
    box(ctx, 'rgba(40,46,52,0.35)', b.x + b.w * 0.2, b.y + b.h * 0.5, b.w * 0.6, 4);
    box(ctx, 'rgba(255,255,255,0.35)', b.x + b.w * 0.72, b.y + b.h * 0.72, 12, 8);
  } else if (b.kind === 'house') {
    box(ctx, 'rgba(120,80,64,0.35)', b.x + 6, b.y + 6, b.w - 12, b.h * 0.34);
    box(ctx, 'rgba(255,255,255,0.3)', b.x + b.w * 0.6, b.y + b.h * 0.55, 10, 7);
  } else if (b.kind === 'warehouse') {
    ctx.fillStyle = 'rgba(90,86,78,0.35)';
    for (let n = 6; n < b.w - 6; n += 14) ctx.fillRect(b.x + n, b.y + 6, 6, b.h - 12);
    box(ctx, 'rgba(255,255,255,0.22)', b.x + 8, b.y + b.h - 16, b.w - 16, 6);
  }
  const grain = hash2(Math.round(b.x), Math.round(b.y));
  box(ctx, 'rgba(60,58,52,0.18)', b.x + 10 + grain * 20, b.y + 12 + grain * 10, 9, 7);
}

function drawProp(ctx, city) {
  for (const tree of city.trees) {
    dot(ctx, 'rgba(20,30,20,0.22)', tree.x + 5, tree.y + 6, tree.r);
    dot(ctx, PALETTE.grassAlt, tree.x, tree.y, tree.r);
    dot(ctx, '#7cb063', tree.x - tree.r * 0.22, tree.y - tree.r * 0.22, tree.r * 0.66);
    dot(ctx, '#5a7340', tree.x, tree.y, 3);
  }
  ctx.strokeStyle = 'rgba(240,240,230,0.55)';
  ctx.lineWidth = 2;
  for (const stall of city.stalls) ctx.strokeRect(stall.x, stall.y, stall.w, stall.h);
  for (const crate of city.crates) {
    box(ctx, '#9a7c53', crate.x, crate.y, crate.s, crate.s);
    ctx.strokeStyle = 'rgba(60,44,26,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crate.x, crate.y, crate.s, crate.s);
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y);
    ctx.lineTo(crate.x + crate.s, crate.y + crate.s);
    ctx.stroke();
  }
  for (const lamp of city.lamps) {
    box(ctx, 'rgba(30,34,40,0.5)', lamp.x - 4, lamp.y - 2, 8, 4);
    dot(ctx, '#6b6f76', lamp.x, lamp.y, 4);
    dot(ctx, 'rgba(255,236,180,0.45)', lamp.x, lamp.y, 2.2);
  }
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  box(ctx, 'rgba(10,14,20,0.26)', -20, -10, 42, 23);
  ctx.fillStyle = car.driver === 'cop' ? '#1b1f27' : car.color;
  ctx.beginPath();
  ctx.moveTo(-21, -9);
  ctx.lineTo(13, -11);
  ctx.quadraticCurveTo(22, -8, 22, 0);
  ctx.quadraticCurveTo(22, 8, 13, 11);
  ctx.lineTo(-21, 9);
  ctx.quadraticCurveTo(-23, 0, -21, -9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  box(ctx, 'rgba(255,255,255,0.18)', -16, -8, 26, 4);
  ctx.fillStyle = '#26313b';
  ctx.beginPath();
  ctx.moveTo(8, -8);
  ctx.lineTo(14, -6);
  ctx.lineTo(14, 6);
  ctx.lineTo(8, 8);
  ctx.closePath();
  ctx.fill();
  box(ctx, '#1d262e', -16, -7, 10, 14);
  ctx.fillStyle = '#14171c';
  for (const [wx, wy] of [[-12, -10], [-12, 7], [8, -10], [8, 7]]) ctx.fillRect(wx, wy, 7, 4);
  if (car.driver === 'cop') {
    const blink = Math.sin(time * 12) > 0;
    box(ctx, blink ? '#ff4444' : '#3d6bff', -4, -11, 5, 4);
    box(ctx, blink ? '#3d6bff' : '#ff4444', -4, 7, 5, 4);
    box(ctx, '#ffffff', -14, -2, 30, 4);
  }
  ctx.restore();
}

function drawHuman(ctx, person, shirt, skin, scale, angle) {
  ctx.save();
  ctx.translate(person.x, person.y);
  ctx.fillStyle = 'rgba(10,14,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 8 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle ?? 0);
  dot(ctx, shirt, 0, 0, 7.5 * scale);
  dot(ctx, skin, 2.5 * scale, 0, 4 * scale);
  ctx.restore();
}

function drawEffects(ctx, world) {
  for (const e of world.effects) {
    const t = Math.max(0, e.life / e.max);
    ctx.globalAlpha = e.kind === 'smoke' ? t * 0.4 : e.kind === 'splash' ? t * 0.85 : t;
    if (e.kind === 'muzzle') dot(ctx, e.color, e.x, e.y, 7 * t + 3);
    else if (e.kind === 'spark') {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x - 6, e.y - 4);
      ctx.lineTo(e.x + 6, e.y + 4);
      ctx.moveTo(e.x + 4, e.y - 6);
      ctx.lineTo(e.x - 4, e.y + 6);
      ctx.stroke();
    } else if (e.kind === 'boom') {
      dot(ctx, e.color, e.x, e.y, 10 + (1 - t) * 46);
      ctx.globalAlpha = t * 0.5;
      dot(ctx, '#fff3c4', e.x, e.y, 6 + (1 - t) * 20);
    } else if (e.kind === 'smoke') dot(ctx, e.color, e.x + (1 - t) * 12, e.y - (1 - t) * 26, 8 + (1 - t) * 18);
    else if (e.kind === 'splash') dot(ctx, e.color, e.x, e.y, 5 + (1 - t) * 16);
    else {
      ctx.globalAlpha = t * 0.6;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 + (1 - t) * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });

  function draw(world) {
    const cam = world.camera;
    const city = world.city;
    const player = world.player;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    box(ctx, '#16202a', 0, 0, VIEW.width, VIEW.height);
    const shakeX = Math.sin(world.time * 61) * cam.shake * 7;
    const shakeY = Math.cos(world.time * 47) * cam.shake * 7;
    ctx.setTransform(1, 0, 0, 1, Math.round(VIEW.width / 2 - cam.x + shakeX), Math.round(VIEW.height / 2 - cam.y + shakeY));

    drawShore(ctx, city, cam);
    box(ctx, PALETTE.asphalt, 0, 0, city.width, cityBottom());
    for (const block of city.blocks) if (inView(cam, block.x - 20, block.y - 20, block.w + 40, block.h + 40)) drawBlockBase(ctx, block);
    drawMarkings(ctx, city, cam);
    for (const building of city.buildings) if (inView(cam, building.x, building.y, building.w, building.h)) drawBuilding(ctx, building);
    drawProp(ctx, city);
    for (const car of world.cars) if (inView(cam, car.x - 30, car.y - 30, 60, 60)) drawCar(ctx, car, world.time);
    for (const ped of world.peds) {
      if (!inView(cam, ped.x - 12, ped.y - 12, 24, 24)) continue;
      if (ped.alive) drawHuman(ctx, ped, ped.shirt, ped.skin, 1, ped.facing ?? ped.angle);
      else {
        ctx.fillStyle = 'rgba(124,59,59,0.75)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 11, 6, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const goon of world.missions.enemies) {
      if (goon.dead) {
        ctx.fillStyle = 'rgba(120,50,50,0.8)';
        ctx.beginPath();
        ctx.ellipse(goon.x, goon.y, 11, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawHuman(ctx, goon, '#3b3f47', '#c58f68', 1.05, goon.angle);
        if (goon.hit > 0) dot(ctx, 'rgba(255,80,80,0.5)', goon.x, goon.y, 12);
      }
    }
    for (const cop of world.police.cops) {
      drawHuman(ctx, cop, '#2a3a5c', '#c99a72', 1.05, cop.angle);
      box(ctx, '#dfe8f5', cop.x - 1, cop.y - 3, 8, 3.5);
    }

    const marker = missionTarget(world.missions);
    if (marker) {
      const pulse = 0.5 + Math.sin(world.time * 4) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.22 + pulse * 0.22;
      dot(ctx, '#e8c46a', marker.x, marker.y, 42 + pulse * 12);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(246,227,174,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(marker.x, marker.y);
      ctx.rotate(Math.PI / 4);
      box(ctx, '#f6e3ae', -7, -7, 14, 14);
      ctx.restore();
    }

    if (!player.car) {
      drawHuman(ctx, player, '#2f8f8a', '#c58f68', 1, player.angle);
      ctx.strokeStyle = '#20262c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4);
      ctx.lineTo(player.x + Math.cos(player.angle) * 19, player.y + Math.sin(player.angle) * 19);
      ctx.stroke();
      if (player.recoil > 0) dot(ctx, 'rgba(255,220,150,0.85)', player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, 5);
    }

    ctx.strokeStyle = 'rgba(255,236,168,0.95)';
    ctx.lineWidth = 2.4;
    for (const bullet of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012);
      ctx.stroke();
    }
    drawEffects(ctx, world);

    // A prompt over the nearest car, so stealing one is obvious.
    if (!player.car && !player.dead) {
      const car = nearestCar(world.cars, player.x, player.y, 78);
      if (car) {
        box(ctx, 'rgba(12,17,23,0.82)', car.x - 15, car.y - 42, 30, 22);
        ctx.strokeStyle = 'rgba(232,196,106,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(car.x - 15, car.y - 42, 30, 22);
        ctx.fillStyle = '#f2f0e6';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('E', car.x, car.y - 26);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 240, VIEW.width / 2, VIEW.height / 2, 760);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(6,10,16,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    box(ctx, 'rgba(255,206,140,0.06)', 0, 0, VIEW.width, VIEW.height);
    if (world.flash > 0) box(ctx, `rgba(255,90,90,${Math.min(0.3, world.flash * 0.5)})`, 0, 0, VIEW.width, VIEW.height);
    if (player.hurt > 0) box(ctx, `rgba(180,20,20,${Math.min(0.28, player.hurt * 0.6)})`, 0, 0, VIEW.width, VIEW.height);
  }

  return { draw };
}
