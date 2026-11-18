// Everything drawn on top of the world: the health bar, the money, the wanted stars, the job
// objective, the minimap, the crosshair, and the full screen title, pause and wasted panels.

import { VIEW, HUD, FONT } from './config.js';
import { missionTarget, missionLabel, missionTitle } from './missions.js';

export const GOLD = '#e8c46a';

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let n = 0; n < 10; n += 1) {
    const radius = n % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (n * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function label(ctx, text, x, y, size, color, align, weight) {
  ctx.font = `${weight ?? 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align ?? 'left';
  ctx.fillText(text, x, y);
}

function panel(ctx, x, y, w, h, fill, stroke) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

const money = (value) => `$${Math.max(0, Math.round(value)).toLocaleString('en-US')}`;

/** Five stars, the filled ones gold and the rest outlines. */
export function drawStars(ctx, x, y, count, max) {
  for (let n = 0; n < max; n += 1) {
    starPath(ctx, x - n * 30, y, 12, 5);
    if (n < count) {
      ctx.fillStyle = '#f2c94c';
      ctx.fill();
      ctx.strokeStyle = '#8a6a1e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(240,240,240,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawMinimap(ctx, world) {
  const { x, y, width, height } = HUD.mini;
  const city = world.city;
  const sx = width / city.width;
  const sy = height / city.height;
  ctx.save();
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = 'rgba(14,19,26,0.86)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#2f6f84';
  ctx.fillRect(x, y + city.water.y * sy, width, height);
  ctx.fillStyle = '#c8b98f';
  ctx.fillRect(x, y + city.sand.y * sy, width, 76 * sy);
  ctx.fillStyle = '#3c434c';
  ctx.fillRect(x, y, width, city.height * sy);
  for (const block of city.blocks) {
    ctx.fillStyle = block.kind === 'park' ? '#4d7040' : '#5b6470';
    ctx.fillRect(x + block.x * sx, y + block.y * sy, block.w * sx, block.h * sy);
  }
  ctx.fillStyle = 'rgba(190,200,208,0.35)';
  for (const building of city.buildings) ctx.fillRect(x + building.x * sx, y + building.y * sy, building.w * sx, building.h * sy);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (const car of world.cars) if (car.driver !== 'cop') ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
  ctx.fillStyle = '#ff5b5b';
  for (const unit of world.police.cars) ctx.fillRect(x + unit.car.x * sx - 2, y + unit.car.y * sy - 2, 4, 4);
  ctx.fillStyle = '#ff8b5b';
  for (const cop of world.police.cops) ctx.fillRect(x + cop.x * sx - 1.5, y + cop.y * sy - 1.5, 3, 3);

  const target = missionTarget(world.missions);
  if (target) {
    const px = x + target.x * sx;
    const py = y + target.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.strokeStyle = 'rgba(232,196,106,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.stroke();
  }

  const player = world.player;
  ctx.save();
  ctx.translate(x + player.x * sx, y + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, 4);
  ctx.lineTo(-4, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  roundRect(ctx, x, y, width, height, 8);
  ctx.strokeStyle = 'rgba(232,220,192,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, 'SALT HARBOR', x + 10, y + 16, 11, 'rgba(240,235,220,0.75)', 'left', 700);
  label(ctx, 'N', x + width - 14, y + 16, 11, 'rgba(240,235,220,0.75)', 'center', 700);
  ctx.restore();
}

function drawObjective(ctx, world) {
  const x = 20;
  const y = VIEW.height - 128;
  panel(ctx, x, y, 470, 66, 'rgba(12,17,23,0.78)', 'rgba(232,196,106,0.55)');
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y + 8, 3, 50);
  label(ctx, `${missionLabel(world.missions)}  ${missionTitle(world.missions)}`, x + 16, y + 24, 13, GOLD, 'left', 700);
  label(ctx, world.missions.text, x + 16, y + 48, 15, '#f2f0e6', 'left', 500);
  const target = missionTarget(world.missions);
  if (target) {
    const dist = Math.hypot(target.x - world.player.x, target.y - world.player.y);
    label(ctx, `${Math.round(dist / 6)} m`, x + 452, y + 26, 20, '#f2f0e6', 'right', 700);
  }
}

function drawPlayerPanel(ctx, world) {
  const player = world.player;
  const x = 20;
  const y = 18;
  panel(ctx, x, y, 300, 78, 'rgba(12,17,23,0.78)', 'rgba(232,220,192,0.35)');
  label(ctx, 'RAY CORTEZ', x + 14, y + 22, 14, GOLD, 'left', 700);
  label(ctx, money(world.money), x + 286, y + 24, 18, '#f2f0e6', 'right', 700);
  const bar = { x: x + 14, y: y + 34, w: 272, h: 12 };
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  roundRect(ctx, bar.x, bar.y, bar.w, bar.h, 4);
  ctx.fill();
  const ratio = Math.max(0, Math.min(1, player.health / 100));
  const gradient = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
  gradient.addColorStop(0, ratio > 0.35 ? '#4fbf7a' : '#d2543f');
  gradient.addColorStop(1, ratio > 0.35 ? '#8ad46a' : '#f0824f');
  ctx.fillStyle = gradient;
  roundRect(ctx, bar.x, bar.y, Math.max(6, bar.w * ratio), bar.h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let n = 1; n < 5; n += 1) {
    ctx.beginPath();
    ctx.moveTo(bar.x + (bar.w / 5) * n, bar.y);
    ctx.lineTo(bar.x + (bar.w / 5) * n, bar.y + bar.h);
    ctx.stroke();
  }
  label(ctx, `AMMO ${player.ammo}`, x + 14, y + 66, 13, 'rgba(242,240,230,0.8)', 'left', 600);
  if (player.car) label(ctx, `${Math.round(Math.abs(player.car.speed) * 0.32)} KM/H`, x + 286, y + 66, 15, GOLD, 'right', 700);
}

function drawWanted(ctx, world) {
  const stars = world.police.stars;
  drawStars(ctx, VIEW.width - 26, 44, stars, 5);
  label(ctx, stars > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 26, 72, 13, stars > 0 ? '#f2c94c' : 'rgba(242,240,230,0.55)', 'right', 700);
  if (world.police.hide > 0.6 && stars > 0) {
    const ratio = Math.min(1, world.police.hide / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(VIEW.width - 186, 80, 160, 5);
    ctx.fillStyle = '#7fd6ff';
    ctx.fillRect(VIEW.width - 186, 80, 160 * ratio, 5);
    label(ctx, 'HIDING', VIEW.width - 186, 76, 11, 'rgba(200,235,255,0.9)', 'left', 700);
  }
}

function drawCrosshair(ctx, mouse) {
  if (!mouse) return;
  const { x, y } = mouse;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [[14, 0], [-14, 0], [0, 14], [0, -14]]) {
    ctx.moveTo(x + dx * 0.55, y + dy * 0.55);
    ctx.lineTo(x + dx, y + dy);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,196,106,0.9)';
  ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

export function drawHud(ctx, world, ui) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  drawPlayerPanel(ctx, world);
  drawWanted(ctx, world);
  drawObjective(ctx, world);
  drawMinimap(ctx, world);
  drawCrosshair(ctx, ui.mouse);

  if (world.missions.bannerLife > 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, world.missions.bannerLife) * Math.min(1, (6 - world.missions.bannerLife) * 2));
    label(ctx, world.missions.banner, VIEW.width / 2, 108, 30, '#fdf6e3', 'center', 800);
    ctx.fillStyle = GOLD;
    const width = Math.min(360, world.missions.banner.length * 9);
    ctx.fillRect(VIEW.width / 2 - width / 2, 118, width, 3);
    ctx.globalAlpha = 1;
  }
  if (world.message.life > 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, world.message.life));
    label(ctx, world.message.text, VIEW.width / 2, VIEW.height - 168, 22, GOLD, 'center', 700);
    ctx.globalAlpha = 1;
  }
  if (world.player.dead) {
    ctx.fillStyle = 'rgba(90,10,10,0.42)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    label(ctx, 'WASTED', VIEW.width / 2, VIEW.height / 2 + 10, 74, '#f4e6e6', 'center', 800);
    label(ctx, 'waking up at the clinic…', VIEW.width / 2, VIEW.height / 2 + 48, 16, 'rgba(244,230,230,0.75)', 'center', 500);
  }
  ctx.restore();
}

export function drawTitle(ctx, world, save) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.42)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  shade.addColorStop(0, 'rgba(10,16,24,0.55)');
  shade.addColorStop(0.55, 'rgba(10,16,24,0.05)');
  shade.addColorStop(1, 'rgba(8,12,18,0.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  label(ctx, 'SALT HARBOR', VIEW.width / 2, 216, 96, '#fdf6e3', 'center', 800);
  ctx.fillStyle = GOLD;
  ctx.fillRect(VIEW.width / 2 - 210, 236, 420, 4);
  label(ctx, 'AN OPEN-WORLD CRIME STORY', VIEW.width / 2, 272, 19, 'rgba(240,235,220,0.85)', 'center', 600);
  const x = VIEW.width / 2 - 285;
  const y = 320;
  panel(ctx, x, y, 570, 236, 'rgba(10,15,21,0.8)', 'rgba(232,196,106,0.45)');
  const rows = [
    ['WASD / ARROWS', 'walk and drive'],
    ['MOUSE + CLICK', 'aim and shoot'],
    ['SHIFT', 'sprint'],
    ['E', 'steal or leave a car'],
    ['ESC', 'pause      F5  save'],
  ];
  rows.forEach((row, index) => {
    label(ctx, row[0], x + 34, y + 42 + index * 27, 14, GOLD, 'left', 700);
    label(ctx, row[1], x + 214, y + 42 + index * 27, 14, 'rgba(242,240,230,0.82)', 'left', 500);
  });
  label(ctx, save ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER OR CLICK TO START', VIEW.width / 2, y + 194, 22, '#fdf6e3', 'center', 800);
  label(
    ctx,
    save ? `saved job ${(save.job ?? 0) + 1} · ${money(save.money ?? 0)}   —   N for a new game` : 'six jobs, one city, five stars of trouble',
    VIEW.width / 2,
    y + 220,
    13,
    'rgba(242,240,230,0.7)',
    'center',
    500,
  );
  label(ctx, 'a make.fun entry · everything drawn and sounded at runtime', VIEW.width / 2, VIEW.height - 22, 12, 'rgba(240,235,220,0.55)', 'center', 500);
  ctx.restore();
  void world;
}

export function drawPause(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const x = VIEW.width / 2 - 250;
  const y = 190;
  panel(ctx, x, y, 500, 330, 'rgba(12,17,23,0.92)', 'rgba(232,196,106,0.5)');
  label(ctx, 'PAUSED', VIEW.width / 2, y + 64, 44, '#fdf6e3', 'center', 800);
  const stats = [
    [missionLabel(world.missions), missionTitle(world.missions)],
    ['WALLET', money(world.money)],
    ['WANTED', `${world.police.stars} / 5`],
    ['TIME IN TOWN', `${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`],
  ];
  stats.forEach((row, index) => {
    label(ctx, row[0], x + 40, y + 118 + index * 34, 14, GOLD, 'left', 700);
    label(ctx, row[1], x + 460, y + 118 + index * 34, 15, 'rgba(242,240,230,0.88)', 'right', 600);
  });
  label(ctx, 'ESC  RESUME        F5  SAVE', VIEW.width / 2, y + 290, 18, '#fdf6e3', 'center', 700);
  ctx.restore();
}

export function drawEnding(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  label(ctx, 'THE CITY IS YOURS', VIEW.width / 2, 280, 62, '#fdf6e3', 'center', 800);
  ctx.fillStyle = GOLD;
  ctx.fillRect(VIEW.width / 2 - 190, 302, 380, 3);
  label(ctx, `six jobs done · ${money(world.money)} in the bank · ${Math.floor(world.time / 60)} minutes`, VIEW.width / 2, 348, 18, 'rgba(242,240,230,0.85)', 'center', 500);
  label(ctx, 'keep driving — the city stays open', VIEW.width / 2, 386, 15, 'rgba(242,240,230,0.65)', 'center', 500);
  ctx.restore();
}
