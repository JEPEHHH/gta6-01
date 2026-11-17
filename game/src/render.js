// Drawing: the camera follows the player, the city is painted from its rectangles, then cars,
// people, bullets, particles, the day/night tint with the lamps and headlights, a vignette, the
// HUD and the screen panels. Screen shake moves the camera, never the HUD.
import { CITY_NAME, FONT, HUD_FONT, PALETTE, RENDER, VIEW } from './config.js';
import { drawHUD } from './hud.js';
import { markerFor } from './missions.js';

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((value >> 16) & 255) * (1 + amount))));
  const g = Math.max(0, Math.min(255, Math.round(((value >> 8) & 255) * (1 + amount))));
  const b = Math.max(0, Math.min(255, Math.round((value & 255) * (1 + amount))));
  return `rgb(${r},${g},${b})`;
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** How dark the frame is: 0 in daylight, up to 0.62 deep at night, with a slow dusk ramp. */
export function darknessAt(clock) {
  const hour = clock / 60;
  if (hour >= 8 && hour <= 17.5) return 0;
  if (hour > 17.5 && hour < 21) return ((hour - 17.5) / 3.5) * 0.62;
  if (hour >= 21 || hour < 5) return 0.62;
  return Math.max(0, 0.62 - ((hour - 5) / 3) * 0.62);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  const visible = { left: 0, top: 0, right: 0, bottom: 0 };

  function pointIn(x, y, pad = 60) {
    return x > visible.left - pad && x < visible.right + pad && y > visible.top - pad && y < visible.bottom + pad;
  }

  // ---- city ---------------------------------------------------------------------------------
  function drawGround(world) {
    ctx.fillStyle = '#3a3d33';
    ctx.fillRect(visible.left, visible.top, visible.right - visible.left, visible.bottom - visible.top);

    ctx.fillStyle = PALETTE.asphalt;
    for (const road of world.city.roads) {
      if (road.x > visible.right || road.y > visible.bottom || road.x + road.w < visible.left || road.y + road.h < visible.top) continue;
      ctx.fillRect(road.x, road.y, road.w, road.h);
    }
    // A subtle centre seam so wide roads read as two lanes.
    ctx.fillStyle = PALETTE.laneFaint;
    for (const line of world.city.laneLines) {
      if (!pointIn(line.x, line.y, 20)) continue;
      ctx.fillRect(line.x, line.y, line.w, line.h);
    }
    ctx.fillStyle = 'rgba(232,220,184,0.42)';
    for (const stripe of world.city.crosswalks) {
      if (!pointIn(stripe.x, stripe.y, 40)) continue;
      ctx.fillRect(stripe.x, stripe.y, stripe.w, stripe.h);
    }
  }

  function drawBlocks(world) {
    const city = world.city;
    for (const block of city.blocks) {
      if (block.x > visible.right || block.y > visible.bottom || block.x + block.w < visible.left || block.y + block.h < visible.top) continue;
      if (block.kind === 'water') {
        ctx.fillStyle = PALETTE.sand;
        ctx.fillRect(block.x - 10, block.y - 10, block.w + 20, block.h + 20);
        ctx.fillStyle = PALETTE.waterDeep;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        continue;
      }
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(block.x, block.y, block.w, block.h);
      // Kerb: a dark band at the road edge with a lit top, so the pavement stands above the asphalt.
      ctx.strokeStyle = PALETTE.curb;
      ctx.lineWidth = 8;
      ctx.strokeRect(block.x + 4, block.y + 4, block.w - 8, block.h - 8);
      ctx.strokeStyle = PALETTE.curbLight;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(block.x + 8.5, block.y + 8.5, block.w - 17, block.h - 17);
      ctx.strokeStyle = PALETTE.sidewalkEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
      // Paving joints on the sidewalk ring.
      ctx.strokeStyle = PALETTE.sidewalkLine;
      ctx.lineWidth = 1;
      for (let t = 40; t < block.w; t += 56) {
        ctx.beginPath();
        ctx.moveTo(block.x + t, block.y);
        ctx.lineTo(block.x + t, block.y + 22);
        ctx.moveTo(block.x + t, block.y + block.h - 22);
        ctx.lineTo(block.x + t, block.y + block.h);
        ctx.stroke();
      }
    }

    for (const park of city.parks) {
      if (!pointIn(park.x, park.y, park.w)) continue;
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.grassDark;
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(park.x + ((i * 137) % (park.w - 90)), park.y + ((i * 211) % (park.h - 80)), 90, 64);
      }
      ctx.fillStyle = '#c9b48d';
      for (const path of city.pathList) {
        if (path.x < park.x - 10 || path.y < park.y - 10 || path.x > park.x + park.w || path.y > park.y + park.h) continue;
        ctx.fillRect(path.x, path.y, path.w, path.h);
      }
      if (park.pond) {
        ctx.fillStyle = '#3b7f8a';
        ctx.beginPath();
        ctx.ellipse(park.pond.x + park.pond.w / 2, park.pond.y + park.pond.h / 2, park.pond.w / 2, park.pond.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    for (const lot of city.lots) {
      if (!pointIn(lot.x, lot.y, lot.w)) continue;
      ctx.fillStyle = '#4a4a4f';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(232,220,184,0.28)';
      ctx.lineWidth = 2;
      for (let x = lot.x; x < lot.x + lot.w; x += lot.w / 5) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y);
        ctx.lineTo(x, lot.y + lot.h * 0.4);
        ctx.moveTo(x, lot.y + lot.h * 0.6);
        ctx.lineTo(x, lot.y + lot.h);
        ctx.stroke();
      }
    }

    // Water on top of the block sand, with slow wave lines.
    for (const water of city.water) {
      if (!pointIn(water.x, water.y, water.w)) continue;
      const gradient = ctx.createLinearGradient(water.x, water.y, water.x + water.w, water.y + water.h);
      gradient.addColorStop(0, PALETTE.water);
      gradient.addColorStop(1, PALETTE.waterDeep);
      ctx.fillStyle = gradient;
      ctx.fillRect(water.x, water.y, water.w, water.h);
      ctx.strokeStyle = PALETTE.waterLight;
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i += 1) {
        const wy = water.y + 30 + i * 42;
        ctx.beginPath();
        ctx.moveTo(water.x + 20 + ((i * 37) % 120), wy);
        ctx.lineTo(water.x + water.w - 40, wy + Math.sin(i) * 6);
        ctx.stroke();
      }
      for (const boat of city.boats) {
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.a);
        ctx.fillStyle = boat.kind === 'yacht' ? '#f4f2ec' : '#d8cdb8';
        rr(ctx, -30, -11, 60, 22, 8);
        ctx.fill();
        ctx.fillStyle = '#8fb6c4';
        rr(ctx, -10, -6, 22, 12, 4);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBuildings(world) {
    for (const b of world.city.buildings) {
      if (b.x > visible.right + 30 || b.y > visible.bottom + 30 || b.x + b.w < visible.left - 30 || b.y + b.h < visible.top - 30) continue;
      const lift = Math.min(18, 3 + b.floors * 1.15);
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(b.x + lift * 1.5 + 4, b.y + lift * 1.6 + 4, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
      // The south wall is the building's height: a grid of lit and dark windows above the shops.
      if (b.floors > 2) {
        const wallY = b.y + lift + b.h - lift * 0.74;
        const step = b.floors > 8 ? 12 : 16;
        for (let x = b.x + lift + 8; x < b.x + lift + b.w - 12; x += step) {
          const litHere = b.lit && Math.sin(x * 0.62 + b.x * 0.01) > -0.35;
          ctx.fillStyle = litHere ? PALETTE.windowLit : PALETTE.windowDark;
          ctx.fillRect(x, wallY, step * 0.58, lift * 0.44);
        }
        if (b.shop) {
          // A shopfront under the windows: glass, an awning, and the shop's own word.
          ctx.fillStyle = 'rgba(26,34,42,0.45)';
          ctx.fillRect(b.x + lift + 4, b.y + lift + b.h - 12, b.w - 8, 8);
          if (b.awning) {
            ctx.fillStyle = b.awning;
            ctx.fillRect(b.x + lift + 3, wallY - 11, Math.min(104, b.w - 14), 10);
          }
          if (pointIn(b.x + b.w / 2, b.y, 300)) {
            ctx.fillStyle = b.neon ?? PALETTE.gold;
            ctx.font = `700 10px ${FONT}`;
            ctx.textAlign = 'left';
            ctx.fillText(b.shop, b.x + lift + 9, wallY - 15);
          }
        }
      }
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.roofEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);

      for (const vent of b.vents) {
        ctx.fillStyle = shade(b.roof, -0.22);
        ctx.fillRect(vent.x, vent.y, vent.w, vent.h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(vent.x + 2, vent.y + 2, vent.w - 4, 3);
      }
      if (b.stair) {
        ctx.fillStyle = 'rgba(20,18,22,0.28)';
        ctx.fillRect(b.stair.x + 5, b.stair.y + 6, b.stair.w, b.stair.h);
        ctx.fillStyle = shade(b.wall, -0.08);
        ctx.fillRect(b.stair.x, b.stair.y, b.stair.w, b.stair.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.stair.x + 1, b.stair.y + 1, b.stair.w - 2, b.stair.h - 2);
      }
      for (const plant of b.plants) {
        ctx.fillStyle = '#4f7a42';
        ctx.beginPath();
        ctx.arc(plant.x, plant.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.spire) {
        ctx.fillStyle = shade(b.roof, -0.3);
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 4, 8, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2 - b.spire);
        ctx.stroke();
      }
      if (b.shop) {
        ctx.fillStyle = b.neon ?? '#f2c14e';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(b.x + lift + 6, b.y + lift + b.h - lift - 4, Math.min(b.w - 16, 70), 4);
        ctx.globalAlpha = 1;
      }
      // A hoarding on the roof: the city's own words, in the city's own colours.
      if (b.billboard) {
        const bb = b.billboard;
        ctx.fillStyle = 'rgba(10,12,16,0.45)';
        ctx.fillRect(bb.x + 4, bb.y + 5, bb.w, bb.h);
        ctx.fillStyle = PALETTE.billboard;
        ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
        ctx.fillStyle = bb.tint;
        ctx.fillRect(bb.x + 3, bb.y + 3, bb.w - 6, 3);
        ctx.fillStyle = 'rgba(245,239,226,0.86)';
        ctx.font = `800 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(bb.text, bb.x + bb.w / 2, bb.y + bb.h - 6);
        ctx.textAlign = 'left';
      }
      // The respray garage's roller door and its sign.
      if (b.garage && b.door) {
        const door = b.door;
        ctx.fillStyle = '#242a31';
        ctx.fillRect(door.x - 4, door.y - 5, door.w + 8, door.h + 7);
        ctx.fillStyle = PALETTE.shutter;
        ctx.fillRect(door.x, door.y, door.w, door.h);
        ctx.strokeStyle = 'rgba(20,24,30,0.4)';
        ctx.lineWidth = 1;
        for (let y = door.y + 5; y < door.y + door.h; y += 6) {
          ctx.beginPath();
          ctx.moveTo(door.x + 2, y);
          ctx.lineTo(door.x + door.w - 2, y);
          ctx.stroke();
        }
        ctx.fillStyle = b.neon ?? PALETTE.gold;
        ctx.font = `800 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.sign ?? 'GARAGE', b.x + b.w / 2, b.y + b.h * 0.46);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawScenery(world) {
    for (const tree of world.city.trees) {
      if (!pointIn(tree.x, tree.y, 40)) continue;
      ctx.fillStyle = 'rgba(12,16,12,0.28)';
      ctx.beginPath();
      ctx.ellipse(tree.x + 5, tree.y + 6, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      if (tree.palm) {
        ctx.strokeStyle = '#3f6b34';
        ctx.lineWidth = 4;
        for (let i = 0; i < 6; i += 1) {
          const angle = tree.tilt + (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(tree.x, tree.y);
          ctx.quadraticCurveTo(tree.x + Math.cos(angle) * tree.r, tree.y + Math.sin(angle) * tree.r * 0.8,
            tree.x + Math.cos(angle) * tree.r * 1.5, tree.y + Math.sin(angle) * tree.r * 1.3);
          ctx.stroke();
        }
        ctx.fillStyle = '#c8a86a';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#39662f';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4f8540';
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.2, tree.y - tree.r * 0.25, tree.r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const prop of world.city.props) {
      if (!pointIn(prop.x, prop.y, 20)) continue;
      if (prop.kind === 'hydrant') {
        ctx.fillStyle = '#b6402f';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'bench') {
        ctx.fillStyle = '#7a5a3c';
        ctx.fillRect(prop.x - 12, prop.y - 4, 24, 8);
      } else if (prop.kind === 'bin') {
        ctx.fillStyle = 'rgba(14,16,20,0.3)';
        ctx.fillRect(prop.x - 5, prop.y - 2, 13, 9);
        ctx.fillStyle = '#3f4a45';
        rr(ctx, prop.x - 6, prop.y - 5, 12, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#586560';
        ctx.fillRect(prop.x - 6, prop.y - 6, 12, 3);
      } else if (prop.kind === 'planter') {
        ctx.fillStyle = '#8b7f6c';
        rr(ctx, prop.x - 10, prop.y - 7, 20, 13, 3);
        ctx.fill();
        ctx.fillStyle = '#4f8540';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5e9b4b';
        ctx.beginPath();
        ctx.arc(prop.x - 3, prop.y - 7, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'umbrella') {
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0574a';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 11, 0.4, 1.6);
        ctx.arc(prop.x, prop.y, 11, 2.5, 3.6);
        ctx.fill();
      }
    }

    for (const lamp of world.city.lamps) {
      if (!pointIn(lamp.x, lamp.y, 14)) continue;
      ctx.fillStyle = '#2f333a';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Signals on the junction corners: a post, a head, and one lamp lit at a time.
    for (const signal of world.city.signals) {
      if (!pointIn(signal.x, signal.y, 30)) continue;
      const beat = (world.time + signal.phase) % 9;
      const lit = beat < 4 ? 'green' : beat < 5 ? 'amber' : 'red';
      ctx.fillStyle = 'rgba(14,16,20,0.32)';
      ctx.beginPath();
      ctx.ellipse(signal.x + 2, signal.y + 5, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b3038';
      rr(ctx, signal.x - 5, signal.y - 16, 10, 17, 3);
      ctx.fill();
      const lamps = { red: PALETTE.signalRed, amber: PALETTE.signalAmber, green: PALETTE.signalGreen };
      for (const [index, name] of ['red', 'amber', 'green'].entries()) {
        ctx.fillStyle = name === lit ? lamps[name] : PALETTE.signalOff;
        ctx.beginPath();
        ctx.arc(signal.x, signal.y - 12 + index * 5, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** The respray pad: painted stripes, a bay line and a cool glow while a respray is running. */
  function drawGaragePad(world) {
    const spot = world.city.garage;
    if (!spot) return;
    const pad = spot.pad;
    if (!pointIn(pad.x, pad.y, 260)) return;
    ctx.fillStyle = 'rgba(34,38,44,0.55)';
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.fillStyle = 'rgba(242,193,78,0.45)';
    for (let x = pad.x + 8; x < pad.x + pad.w - 10; x += 20) ctx.fillRect(x, pad.y + pad.h - 10, 11, 4);
    const glow = 0.22 + (world.garage?.glow ?? 0) * 0.5;
    ctx.strokeStyle = `rgba(79,214,200,${glow})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(pad.x + 1.5, pad.y + 1.5, pad.w - 3, pad.h - 3);
  }

  function drawDecals(world) {
    for (const decal of world.decals) {
      if (!pointIn(decal.x, decal.y, 30)) continue;
      const fade = Math.min(1, decal.life / 3);
      ctx.globalAlpha = decal.kind === 'scorch' ? 0.6 * fade : 0.5 * fade;
      if (decal.kind === 'tire') {
        ctx.fillStyle = '#1d1d22';
        ctx.save();
        ctx.translate(decal.x, decal.y);
        ctx.rotate(decal.angle);
        ctx.fillRect(-decal.size / 2, -2, decal.size, 4);
        ctx.restore();
      } else if (decal.kind === 'blood') {
        ctx.fillStyle = '#6d1a17';
        ctx.beginPath();
        ctx.ellipse(decal.x, decal.y, decal.size, decal.size * 0.65, decal.angle, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#141418';
        ctx.beginPath();
        ctx.arc(decal.x, decal.y, decal.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- actors -------------------------------------------------------------------------------
  function drawCar(vehicle, world) {
    const type = vehicle.type;
    const length = type.length;
    const width = type.width;
    const police = type.id === 'police';

    // A marked car is the job's target: a ring that pulses so it reads at a glance.
    if (vehicle.marked) {
      const pulse = 0.5 + Math.sin(world.time * 5) * 0.5;
      ctx.strokeStyle = `rgba(226,73,60,${0.45 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(vehicle.x, vehicle.y, type.length * 0.6 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The player's own car carries a warm halo, so it is never confused with traffic.
    if (vehicle.driver === 'player') {
      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      ctx.rotate(vehicle.angle);
      ctx.strokeStyle = 'rgba(255,238,186,0.72)';
      ctx.lineWidth = 2;
      rr(ctx, -length * 0.58, -width * 0.79, length * 1.16, width * 1.58, 10);
      ctx.stroke();
      ctx.restore();
    }

    // The shadow falls in world space, so a turning car never looks like it is floating.
    ctx.save();
    ctx.translate(vehicle.x + 4, vehicle.y + 5);
    ctx.rotate(vehicle.angle);
    ctx.fillStyle = 'rgba(12,10,16,0.32)';
    rr(ctx, -length / 2, -width / 2, length, width, 7);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(vehicle.x, vehicle.y);
    ctx.rotate(vehicle.angle);

    // Tyres outside the body: a car reads as a car and not as a coloured rectangle.
    ctx.fillStyle = PALETTE.tyre;
    for (const wheelX of [-length * 0.31, length * 0.3]) {
      for (const wheelY of [-width * 0.52, width * 0.52]) {
        rr(ctx, wheelX - length * 0.075, wheelY - 3, length * 0.15, 6, 2.5);
        ctx.fill();
      }
    }

    ctx.fillStyle = vehicle.flash > 0 ? '#ffffff' : vehicle.color;
    rr(ctx, -length / 2, -width / 2, length, width, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,10,14,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (police) {
      // Navy body, white doors, a light bar across the roof: a patrol car reads at a glance.
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(-length * 0.2, -width / 2, length * 0.42, 4.5);
      ctx.fillRect(-length * 0.2, width / 2 - 4.5, length * 0.42, 4.5);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(length * 0.2, -width / 2, length * 0.1, width);
      const flash = Math.sin(world.time * 14) > 0;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = flash ? '#ff4a3d' : '#3f7dff';
      ctx.beginPath();
      ctx.arc(0, 0, width * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#141a26';
      rr(ctx, -10, -width / 2 - 2, 20, width + 4, 3);
      ctx.fill();
      ctx.fillStyle = flash ? '#ff5348' : '#4f8bff';
      ctx.fillRect(-8, -width / 2 + 1, 7, width - 2);
      ctx.fillStyle = flash ? '#4f8bff' : '#ff5348';
      ctx.fillRect(1, -width / 2 + 1, 7, width - 2);
    }

    // Sun on the driver's side, then the cabin: roof, windscreen, rear glass.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-length * 0.42, -width * 0.46, length * 0.84, 2.4);
    ctx.fillStyle = shade(vehicle.color, -0.28);
    rr(ctx, -length * 0.16, -width * 0.4, length * 0.46, width * 0.8, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.glass;
    rr(ctx, length * 0.1, -width * 0.34, length * 0.11, width * 0.68, 3);
    ctx.fill();
    rr(ctx, -length * 0.3, -width * 0.3, length * 0.09, width * 0.6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-length * 0.1, -width * 0.24, length * 0.3, 1.6);

    ctx.fillStyle = '#ffe9b4';
    ctx.fillRect(length / 2 - 4, -width / 2 + 3, 4, 7);
    ctx.fillRect(length / 2 - 4, width / 2 - 10, 4, 7);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-length / 2, -width / 2 + 3, 3, 6);
    ctx.fillRect(-length / 2, width / 2 - 9, 3, 6);
    ctx.restore();
  }

  function drawPed(ped) {
    const walk = Math.sin(ped.phase) * 3.2;
    ctx.fillStyle = 'rgba(12,10,16,0.28)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      rr(ctx, -9, -5, 18, 10, 4);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(9, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = shade(ped.shirt, -0.3);
    ctx.fillRect(ped.x - 4 + walk * 0.4, ped.y + 2, 3, 7);
    ctx.fillRect(ped.x + 1 - walk * 0.4, ped.y + 2, 3, 7);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,16,22,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (ped.bag) {
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(ped.x - 9, ped.y - 2, 4, 7);
    }
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 - 1, 5.4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.hat) {
      ctx.fillStyle = '#2f3b4a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 2, ped.y + Math.sin(ped.angle) * 2 - 2, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(world) {
    const player = world.player;
    if (player.car) return;
    const hidden = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
    if (hidden) return;
    ctx.fillStyle = 'rgba(12,10,16,0.34)';
    ctx.beginPath();
    ctx.ellipse(player.x + 2, player.y + 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const step = Math.sin(player.walkPhase) * 3;
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(player.x - 5 + step * 0.5, player.y + 2, 4, 7);
    ctx.fillRect(player.x + 1 - step * 0.5, player.y + 2, 4, 7);

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aim);
    // Arms and weapon point where the mouse is.
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(13, -1);
    ctx.moveTo(2, 5);
    ctx.lineTo(13, 1);
    ctx.stroke();
    if (player.weapon !== 'fists') {
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(11, -2.2, 12, 4.4);
      if (player.flash > 0) {
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.lineTo(32, -6);
        ctx.lineTo(29, 0);
        ctx.lineTo(32, 6);
        ctx.closePath();
        ctx.fill();
      }
    } else if (player.recoil > 0.2) {
      ctx.fillStyle = '#f0dcc0';
      ctx.beginPath();
      ctx.arc(16, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = PALETTE.shirt;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(PALETTE.shirt, -0.25);
    ctx.beginPath();
    ctx.arc(player.x, player.y, 9, 0.9, 2.2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2118';
    ctx.beginPath();
    ctx.arc(player.x - Math.cos(player.aim) * 1.5, player.y - Math.sin(player.aim) * 1.5, 5.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A small crosshair where the mouse points, so aim reads before the first shot. */
  function drawAim(world) {
    const player = world.player;
    if (player.car) return;
    const x = player.aimX ?? player.x + Math.cos(player.aim) * 120;
    const y = player.aimY ?? player.y + Math.sin(player.aim) * 120;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 15, y);
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y + 15);
    ctx.stroke();
    ctx.restore();
  }

  function drawMarker(world) {
    const marker = markerFor(world);
    if (!marker) return;
    const pulse = 0.5 + Math.sin(world.time * 4) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.18 + pulse * 0.12;
    ctx.fillStyle = marker.kind === 'contact' ? '#f2c14e' : '#ffd76a';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, marker.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = marker.kind === 'contact' ? '#f2c14e' : '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, marker.radius * (0.6 + pulse * 0.12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, marker.radius + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const bob = Math.sin(world.time * 3) * 5;
    ctx.translate(marker.x, marker.y - marker.radius - 22 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = marker.kind === 'contact' ? '#f2c14e' : '#ffd76a';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = 'rgba(20,18,14,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.save();
    ctx.font = `600 15px ${HUD_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    const width = ctx.measureText(marker.label).width + 18;
    rr(ctx, marker.x - width / 2, marker.y - marker.radius - 66 + bob, width, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(marker.label, marker.x, marker.y - marker.radius - 51 + bob);
    ctx.restore();
  }

  function drawParticles(world) {
    for (const p of world.particles) {
      if (!pointIn(p.x, p.y, 30)) continue;
      const life = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        ctx.globalAlpha = life * 0.32;
        ctx.fillStyle = '#cfd2d6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - life), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.globalAlpha = Math.min(1, life * 1.4);
        ctx.fillStyle = life > 0.6 ? '#ffe08a' : life > 0.3 ? '#ff8a3c' : '#c0392b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + life), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = life;
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else if (p.kind === 'blood') {
        ctx.globalAlpha = life * 0.9;
        ctx.fillStyle = p.color ?? '#a3241f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.6 * life + 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'cash') {
        ctx.globalAlpha = life;
        ctx.fillStyle = '#79d47a';
        ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
      } else if (p.kind === 'casing') {
        ctx.globalAlpha = life;
        ctx.fillStyle = '#e8c766';
        ctx.fillRect(p.x, p.y, 3, 2);
      } else {
        ctx.globalAlpha = life;
        ctx.fillStyle = p.color ?? '#ffe9a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * life + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBullets(world) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const bullet of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.014, bullet.y - bullet.vy * 0.014);
      ctx.stroke();
    }
  }

  function drawPickups(world) {
    for (const pickup of world.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      const color = pickup.kind === 'health' ? '#5fd17a' : pickup.kind === 'ammo' ? '#e8c766' : '#79d47a';
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  function drawHeliShadow(world) {
    const heli = world.wanted.heli;
    if (!heli) return;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.ellipse(heli.x, heli.y, 46, 22, heli.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(heli.x, heli.y, 90 + Math.sin(world.time * 2) * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The aircraft itself, high above, drawn as a dark silhouette with a spinning rotor.
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle);
    ctx.fillStyle = 'rgba(20,24,32,0.8)';
    rr(ctx, -18, -9, 36, 18, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,32,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(40, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 34, heli.rotor, heli.rotor + Math.PI * 1.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- light --------------------------------------------------------------------------------
  function drawLight(world) {
    const darkness = darknessAt(world.clock);
    if (darkness > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${Math.round(40 + darkness * 30)},${Math.round(48 + darkness * 30)},${Math.round(92 + darkness * 40)},${darkness})`;
      ctx.fillRect(visible.left, visible.top, visible.right - visible.left, visible.bottom - visible.top);
      ctx.restore();

      // Street lamps, headlights and neon on top of the tint.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const lamp of world.city.lamps) {
        if (!pointIn(lamp.x, lamp.y, 140)) continue;
        const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 120);
        const strength = darkness * (0.55 + Math.sin(world.time * 2 + lamp.phase) * 0.04);
        glow.addColorStop(0, `rgba(255,214,150,${strength})`);
        glow.addColorStop(1, 'rgba(255,196,120,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 120, 0, Math.PI * 2);
        ctx.fill();
      }
      const carLight = (x, y, angle, strength) => {
        const gx = x + Math.cos(angle) * 120;
        const gy = y + Math.sin(angle) * 120;
        const cone = ctx.createRadialGradient(gx, gy, 4, gx, gy, 130);
        cone.addColorStop(0, `rgba(255,240,200,${strength})`);
        cone.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.arc(gx, gy, 130, 0, Math.PI * 2);
        ctx.fill();
      };
      for (const vehicle of world.vehicles) {
        if (!pointIn(vehicle.x, vehicle.y, 200)) continue;
        const moving = Math.hypot(vehicle.vx, vehicle.vy) > 20 || vehicle.driver === 'player';
        if (moving) carLight(vehicle.x, vehicle.y, vehicle.angle, darkness * 0.5);
      }
      ctx.restore();
      // Police light bars glow in the dark too.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const unit of world.wanted.units) {
        if (!pointIn(unit.x, unit.y, 160)) continue;
        const flash = Math.sin(world.time * 14) > 0;
        const g = ctx.createRadialGradient(unit.x, unit.y, 4, unit.x, unit.y, 110);
        g.addColorStop(0, flash ? 'rgba(230,60,50,0.5)' : 'rgba(70,120,255,0.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 110, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Sun on the street: a warm wash over the whole frame, strongest at golden hour.
      const warm = Math.max(0.08, 1 - Math.abs(world.clock / 60 - 18.6) / 2.6);
      ctx.fillStyle = `rgba(255,178,86,${warm * 0.13})`;
      ctx.fillRect(visible.left, visible.top, visible.right - visible.left, visible.bottom - visible.top);
    }
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.4, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(6,8,14,0.32)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // ---- screens ------------------------------------------------------------------------------
  function drawTitle(world) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, 'rgba(9,11,18,0.9)');
    gradient.addColorStop(0.45, 'rgba(9,11,18,0.42)');
    gradient.addColorStop(1, 'rgba(9,11,18,0.92)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(VIEW.width / 2, 210, 20, VIEW.width / 2, 210, 300);
    sun.addColorStop(0, 'rgba(255,170,90,0.30)');
    sun.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(VIEW.width / 2, 210, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = `800 96px ${FONT}`;
    ctx.fillStyle = 'rgba(10,10,14,0.55)';
    ctx.fillText(CITY_NAME, VIEW.width / 2 + 4, 250 + 5);
    const titleGradient = ctx.createLinearGradient(0, 160, 0, 260);
    titleGradient.addColorStop(0, '#ffe6b0');
    titleGradient.addColorStop(1, '#f2a03f');
    ctx.fillStyle = titleGradient;
    ctx.fillText(CITY_NAME, VIEW.width / 2, 250);

    ctx.font = `600 20px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(245,239,226,0.82)';
    ctx.fillText('An open-world crime story on the Gulf coast', VIEW.width / 2, 292);

    ctx.font = `500 15px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(245,239,226,0.6)';
    ctx.fillText('Riva needs a driver. Tavo needs a distraction. The port needs neither.', VIEW.width / 2, 324);

    const startPulse = 0.6 + Math.sin(world.time * 3.2) * 0.3;
    ctx.font = `700 22px ${HUD_FONT}`;
    ctx.fillStyle = `rgba(242,193,78,${startPulse})`;
    ctx.fillText('CLICK OR PRESS ENTER TO DRIVE', VIEW.width / 2, 404);

    ctx.font = `500 14px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(245,239,226,0.62)';
    ctx.fillText('L  load saved run      R  new city      ESC  pause', VIEW.width / 2, 440);

    const columns = [
      ['W A S D', 'walk / drive'],
      ['SHIFT', 'run / boost'],
      ['E', 'enter or exit a car'],
      ['SPACE', 'handbrake'],
      ['MOUSE', 'aim, LEFT CLICK shoot'],
      ['1 2 3', 'pistol, SMG, shotgun'],
      ['F', 'save the run'],
    ];
    ctx.font = `600 14px ${HUD_FONT}`;
    const columnWidth = 236;
    const startX = VIEW.width / 2 - columnWidth + 20;
    columns.forEach(([key, action], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + col * (columnWidth + 60);
      const y = 496 + row * 26;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(242,193,78,0.9)';
      ctx.fillText(key, x, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(245,239,226,0.66)';
      ctx.fillText(action, x + 14, y);
    });

    ctx.textAlign = 'left';
    ctx.font = `500 12px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(245,239,226,0.4)';
    ctx.fillText(`seed ${world.seed}   ·   every street, car, face and sound generated here`, 24, VIEW.height - 22);
    ctx.textAlign = 'right';
    ctx.fillText('SOL VERDE  ·  original city, no borrowed assets', VIEW.width - 24, VIEW.height - 22);
    ctx.textAlign = 'left';
  }

  function drawPanelScreen(title, lines, prompt, accent = PALETTE.gold) {
    ctx.fillStyle = 'rgba(6,8,14,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const height = 120 + lines.length * 30;
    const width = 560;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(14,16,22,0.9)';
    rr(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,193,78,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `800 44px ${FONT}`;
    ctx.fillStyle = accent;
    ctx.fillText(title, VIEW.width / 2, y + 66);
    ctx.font = `500 16px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(245,239,226,0.75)';
    lines.forEach((line, index) => ctx.fillText(line, VIEW.width / 2, y + 104 + index * 28));
    ctx.font = `700 16px ${HUD_FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(prompt, VIEW.width / 2, y + height - 22);
    ctx.textAlign = 'left';
  }

  function drawScreens(world) {
    if (world.screen === 'title') {
      drawTitle(world);
      return;
    }
    if (world.screen === 'paused') {
      drawPanelScreen('PAUSED', ['The city keeps running without you.', 'Your run is safe on this machine.'],
        'ESC resume    ·    F save    ·    R restart');
    } else if (world.screen === 'wasted') {
      drawPanelScreen('WASTED', [`The clinic billed you $100. Cash left: $${Math.round(world.player.cash)}.`],
        'R restart    ·    L load saved run', PALETTE.danger);
    } else if (world.screen === 'busted') {
      drawPanelScreen('BUSTED', ['The port police took the car and the guns.', 'You kept the cash, they kept the record.'],
        'R restart    ·    L load saved run', '#5a8cff');
    }
  }

  function draw(world) {
    const shakeX = world.shake > 0 ? Math.sin(world.time * 62) * world.shake : 0;
    const shakeY = world.shake > 0 ? Math.cos(world.time * 71) * world.shake * 0.7 : 0;
    const camX = world.camera.x + shakeX;
    const camY = world.camera.y + shakeY;
    const zoom = world.zoom || RENDER.zoom;
    const halfWidth = VIEW.width / 2 / zoom;
    const halfHeight = VIEW.height / 2 / zoom;
    visible.left = camX - halfWidth;
    visible.top = camY - halfHeight;
    visible.right = camX + halfWidth;
    visible.bottom = camY + halfHeight;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101319';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(VIEW.width / 2, VIEW.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(camX), -Math.round(camY));

    drawGround(world);
    drawBlocks(world);
    drawDecals(world);
    drawGaragePad(world);
    drawScenery(world);
    drawBuildings(world);
    drawMarker(world);
    drawPickups(world);
    drawHeliShadow(world);

    // Cars and people painted back to front so overlaps read correctly.
    const actors = [];
    for (const vehicle of world.vehicles) if (pointIn(vehicle.x, vehicle.y, 90)) actors.push({ y: vehicle.y, kind: 'car', ref: vehicle });
    for (const ped of world.peds) if (pointIn(ped.x, ped.y, 40)) actors.push({ y: ped.y, kind: 'ped', ref: ped });
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      if (actor.kind === 'car') drawCar(actor.ref, world);
      else drawPed(actor.ref);
    }
    drawPlayer(world);
    if (world.screen === 'play') drawAim(world);
    drawBullets(world);
    drawParticles(world);
    drawLight(world);
    ctx.restore();

    drawVignette();
    drawHUD(ctx, world);
    drawScreens(world);
  }

  return { draw, ctx };
}
