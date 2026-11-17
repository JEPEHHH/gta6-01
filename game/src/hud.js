// The HUD, drawn in screen space over the world: health and armour, cash, the five wanted stars,
// the weapon and its ammo, the mission objective and the contact's dialogue, a minimap built from
// the city's own road and water rectangles, a speedometer while driving, toasts and a controls
// line. Nothing here reads the keyboard; it only reports what the world holds.
import { CITY_NAME, HUD_FONT, PALETTE, POLICE, VIEW } from './config.js';
import { ammoLabel, weaponOf } from './weapons.js';
import { markerFor, objectiveText } from './missions.js';

const MAP = { x: 16, y: VIEW.height - 16 - 190, size: 190 };
const MAP_SCALE = 0.072;

const fonts = new Map();
function font(size, weight = '600') {
  const key = `${weight}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${HUD_FONT}`);
  return fonts.get(key);
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function label(ctx, text, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.74) {
  ctx.fillStyle = `rgba(14,16,22,${alpha})`;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function starPath(ctx, cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Health and armour as two slim bars, cash underneath. */
function drawVitals(ctx, world) {
  const player = world.player;
  const x = 20;
  const y = 20;
  panel(ctx, x, y, 232, 84);

  const bar = (offsetY, value, max, color, tag) => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, x + 14, y + offsetY, 168, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = color;
    rr(ctx, x + 14, y + offsetY, Math.max(0, 168 * Math.min(1, value / max)), 9, 4.5);
    ctx.fill();
    label(ctx, tag, x + 190, y + offsetY + 9, 11, PALETTE.muted, 'left', '700');
  };
  bar(16, player.hp, 100, PALETTE.health, 'HP');
  bar(34, player.armor, 100, PALETTE.armor, 'AR');

  label(ctx, `$${Math.round(player.cash).toLocaleString('en-US')}`, x + 14, y + 74, 22, PALETTE.cash, 'left', '700');
  const clockHours = Math.floor(world.clock / 60);
  const clockMinutes = Math.floor(world.clock % 60);
  label(ctx, `${String(clockHours).padStart(2, '0')}:${String(clockMinutes).padStart(2, '0')}`, x + 218, y + 74, 15,
    PALETTE.muted, 'right', '600');
}

/** Five stars, lit up to the wanted level, with a pulse when a new one lands. */
function drawWanted(ctx, world) {
  const level = world.wanted.level;
  const pulse = 1 + Math.sin(world.time * 9) * 0.06 * (world.wanted.starFlash > 0 ? 1 : 0);
  const startX = VIEW.width - 20 - 5 * 34;
  for (let i = 0; i < 5; i += 1) {
    const cx = startX + i * 34 + 15;
    const cy = 34;
    starPath(ctx, cx, cy, 13 * (i < level ? pulse : 1));
    if (i < level) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(20,22,28,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  if (level > 0) {
    label(ctx, level >= 4 ? 'AIR SUPPORT' : level >= 2 ? 'PURSUIT' : 'PATROL ALERT', VIEW.width - 20, 66, 11,
      level >= 3 ? PALETTE.danger : PALETTE.muted, 'right', '700');
  }
  label(ctx, CITY_NAME, VIEW.width - 20, 88, 13, 'rgba(255,255,255,0.35)', 'right', '700');
}

/** The objective line, pinned to the top of the screen. */
function drawObjective(ctx, world) {
  const text = objectiveText(world);
  ctx.font = font(15, '600');
  const width = Math.min(560, ctx.measureText(text).width + 44);
  const x = (VIEW.width - width) / 2;
  panel(ctx, x, 16, width, 38);
  ctx.fillStyle = PALETTE.gold;
  rr(ctx, x + 12, 28, 14, 14, 3);
  ctx.fill();
  label(ctx, text, x + 34, 42, 15, PALETTE.ink, 'left', '600');
}

/** The contact's line, bottom centre, fading out after a few seconds. */
function drawDialog(ctx, world) {
  const state = world.missions;
  if (state.dialogTimer <= 0 || !state.dialog) return;
  const alpha = Math.min(1, state.dialogTimer / 0.8);
  ctx.globalAlpha = alpha;
  ctx.font = font(16, '600');
  const width = Math.min(720, ctx.measureText(state.dialog).width + 52);
  const x = (VIEW.width - width) / 2;
  const y = VIEW.height - 176;
  panel(ctx, x, y, width, 56, 0.8);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x + 14, y + 14, 3, 28);
  label(ctx, state.speaker || 'Contact', x + 26, y + 22, 11, PALETTE.gold, 'left', '700');
  label(ctx, state.dialog, x + 26, y + 42, 15, PALETTE.ink, 'left', '500');
  ctx.globalAlpha = 1;
}

/** The minimap: roads, water, blocks and blips, clipped to a rounded square. */
function drawMinimap(ctx, world) {
  const { x, y, size } = MAP;
  const camera = world.camera;
  const scale = MAP_SCALE;
  ctx.save();
  rr(ctx, x, y, size, size, 12);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(12,16,22,0.92)';
  ctx.fillRect(x, y, size, size);

  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);

  const viewLeft = camera.x - size / 2 / scale;
  const viewTop = camera.y - size / 2 / scale;
  const viewW = size / scale;
  const viewH = size / scale;

  ctx.fillStyle = '#2a2f39';
  for (const road of world.city.roads) {
    if (road.x > viewLeft + viewW || road.y > viewTop + viewH) continue;
    if (road.x + road.w < viewLeft || road.y + road.h < viewTop) continue;
    ctx.fillRect(road.x, road.y, road.w, road.h);
  }
  ctx.fillStyle = '#3c7f8c';
  for (const water of world.city.water) ctx.fillRect(water.x, water.y, water.w, water.h);
  ctx.fillStyle = '#182029';
  for (const block of world.city.blocks) {
    if (block.kind === 'water') continue;
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
  ctx.fillStyle = '#20313a';
  for (const park of world.city.parks) ctx.fillRect(park.x, park.y, park.w, park.h);
  ctx.restore();

  // Blips, in map pixels.
  const toMap = (wx, wy) => ({ x: x + size / 2 + (wx - camera.x) * scale, y: y + size / 2 + (wy - camera.y) * scale });
  for (const vehicle of world.vehicles) {
    if (vehicle.driver !== 'ai') continue;
    const p = toMap(vehicle.x, vehicle.y);
    if (p.x < x + 4 || p.x > x + size - 4 || p.y < y + 4 || p.y > y + size - 4) continue;
    ctx.fillStyle = 'rgba(230,215,170,0.55)';
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  for (const unit of world.wanted.units) {
    const p = toMap(unit.x, unit.y);
    ctx.fillStyle = Math.sin(world.time * 12) > 0 ? '#ff5a4d' : '#5a8cff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pickup of world.pickups) {
    const p = toMap(pickup.x, pickup.y);
    ctx.fillStyle = pickup.kind === 'health' ? '#5fd17a' : pickup.kind === 'ammo' ? '#e8c766' : '#79d47a';
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }

  const marker = markerFor(world);
  if (marker) {
    const p = toMap(marker.x, marker.y);
    // Clamped to the rim so a distant objective still points the way.
    const cx = Math.max(x + 10, Math.min(x + size - 10, p.x));
    const cy = Math.max(y + 10, Math.min(y + size - 10, p.y));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = marker.kind === 'contact' ? '#f2c14e' : '#ffd76a';
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.strokeStyle = 'rgba(20,20,20,0.7)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  }

  const player = world.player;
  const pp = toMap(player.x, player.y);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate((player.car ? player.car.angle : player.aim) + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.6, 5);
  ctx.lineTo(0, 2.6);
  ctx.lineTo(-4.6, 5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  rr(ctx, x, y, size, size, 12);
  ctx.strokeStyle = 'rgba(242,193,78,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, 'N', x + size - 12, y + 18, 10, 'rgba(255,255,255,0.6)', 'center', '700');
}

/** A speedometer arc while driving; the weapon readout when on foot. */
function drawVehicleHud(ctx, world) {
  const player = world.player;
  if (player.car) {
    const car = player.car;
    const speed = Math.hypot(car.vx, car.vy);
    const value = Math.round(speed * 0.34);
    const x = VIEW.width - 118;
    const y = VIEW.height - 96;
    ctx.save();
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.arc(x, y, 54, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(x, y, 54, Math.PI * 0.85, Math.PI * (0.85 + 1.3 * Math.min(1, speed / car.type.maxSpeed)));
    ctx.stroke();
    ctx.restore();
    label(ctx, String(value), x, y + 8, 30, PALETTE.ink, 'center', '700');
    label(ctx, 'KM/H', x, y + 26, 10, PALETTE.muted, 'center', '700');
    label(ctx, car.name.toUpperCase(), x, y + 66, 11, PALETTE.muted, 'center', '700');
    if (car.hp < car.maxHp * 0.4) label(ctx, 'ENGINE DAMAGED', x, y - 74, 10, PALETTE.danger, 'center', '700');
  } else {
    const weapon = weaponOf(player);
    const x = VIEW.width - 22;
    const y = VIEW.height - 24;
    label(ctx, weapon.name.toUpperCase(), x, y - 22, 13, PALETTE.ink, 'right', '700');
    label(ctx, weapon.melee ? 'MELEE' : `${ammoLabel(player)} ROUNDS`, x, y, 12, PALETTE.muted, 'right', '600');
    const slot = ['pistol', 'smg', 'shotgun'].indexOf(player.weapon);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i === slot ? PALETTE.gold : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - 62 + i * 20, y - 34, 16, 4);
    }
  }
}

/** Toasts ("Wanted 2 stars", "+ $350") stack above the minimap. */
function drawToasts(ctx, world) {
  let y = MAP.y - 16;
  for (let i = world.messages.length - 1; i >= 0; i -= 1) {
    const message = world.messages[i];
    const alpha = Math.min(1, message.life / 0.6);
    ctx.globalAlpha = alpha;
    label(ctx, message.text, 22, y, 14, PALETTE.gold, 'left', '600');
    ctx.globalAlpha = 1;
    y -= 22;
  }
}

/** The control legend, small and out of the way along the bottom. */
function drawControls(ctx) {
  const text = 'WASD move · SHIFT run/boost · E enter/exit · SPACE handbrake · MOUSE aim · CLICK shoot · 1-3 weapon · F save · ESC pause · R restart';
  ctx.font = font(12, '500');
  const width = ctx.measureText(text).width + 28;
  const x = (VIEW.width - width) / 2;
  ctx.fillStyle = 'rgba(10,12,18,0.55)';
  rr(ctx, x, VIEW.height - 34, width, 24, 8);
  ctx.fill();
  label(ctx, text, VIEW.width / 2, VIEW.height - 18, 12, 'rgba(240,235,220,0.72)', 'center', '500');
}

export function drawHUD(ctx, world) {
  if (world.screen === 'title') return;
  drawVitals(ctx, world);
  drawWanted(ctx, world);
  drawObjective(ctx, world);
  drawMinimap(ctx, world);
  drawVehicleHud(ctx, world);
  drawDialog(ctx, world);
  drawToasts(ctx, world);
  drawControls(ctx);
  if (world.hitFlash > 0) {
    ctx.fillStyle = `rgba(190,30,26,${world.hitFlash * 0.28})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  void POLICE;
}
