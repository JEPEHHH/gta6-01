// Boot and the one loop: the title screen, the running city, pause, save and the four staged
// screenshot scenes. Input is read once a frame; the world advances in fixed 1/60 s steps so
// physics and police behave the same on a fast screen and a slow one.

import { STEP } from './config.js';
import { createWorld, updateWorld, toast } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { drawHud, drawTitle, drawPause, drawEnding } from './hud.js';
import { saveGame, loadGame, applySave, clearGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.2;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 11;

let world = createWorld(seed);
let save = loadGame();
let screen = 'title';
let plannedShot = null;
let endingAt = 0;
let accumulator = 0;
let last = performance.now();

// A handle for the console and for automated checks: the live world, read-only by convention.
window.saltHarbor = { get world() { return world; }, get screen() { return screen; } };

function paint() {
  renderer.draw(world, { mouse: input.mouse, hud: false });
  if (screen === 'title') {
    drawTitle(ctx, world, save);
  } else {
    drawHud(ctx, world, { mouse: input.mouse });
    if (screen === 'paused') drawPause(ctx, world);
    if (endingAt && world.time - endingAt < 9) drawEnding(ctx, world);
  }
  window.__shotReady = true;
}

function startGame(mode) {
  audio.unlock();
  if (mode === 'new') {
    clearGame();
    world = createWorld(seed);
    save = null;
    endingAt = 0;
  } else if (save) {
    applySave(world, save);
  }
  screen = 'play';
  accumulator = 0;
  input.reset();
}

function handleKeys() {
  if (input.pressed('Escape')) {
    if (screen === 'play') {
      screen = 'paused';
      audio.engine(0);
    } else if (screen === 'paused') {
      screen = 'play';
    }
  }
  if (screen === 'title') {
    if (input.pressed('KeyN')) startGame('new');
    else if (input.pressed('Enter') || input.pressed('Space') || input.mouse.clicked) startGame(save ? 'continue' : 'new');
    return;
  }
  if (screen === 'play' && (input.pressed('F5') || input.pressed('KeyF'))) {
    const saved = saveGame(world);
    save = saved ? loadGame() : save;
    toast(world, saved ? 'PROGRESS SAVED' : 'NO STORAGE IN THIS WINDOW', 2);
    audio.blip();
  }
}

function stepWorld() {
  updateWorld(world, input, STEP, audio);
  if (world.missions.done && !endingAt) endingAt = world.time;
  if (world.saveDirty) {
    save = saveGame(world);
    if (!save) save = loadGame();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;

  if (plannedShot) {
    paint();
    return;
  }

  handleKeys();
  if (screen === 'play') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 8) {
      stepWorld();
      accumulator -= STEP;
      steps += 1;
      // A one-shot press belongs to a single step: a frame that catches up on two steps
      // must not enter a car and leave it again in the same frame.
      input.endFrame();
    }
    if (steps === 8) accumulator = 0;
  } else {
    accumulator = 0;
    input.endFrame();
  }
  paint();
}

window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    audio.engine(0);
  }
});

if (shotName) {
  screen = stageShot(world, shotName);
  plannedShot = shotName;
  // Point the reticle where the scene's action is, not at the player under it.
  input.mouse.x = Math.min(1210, Math.max(70, Math.round(world.player.x - world.camera.x + 640 + 170)));
  input.mouse.y = Math.min(650, Math.max(70, Math.round(world.player.y - world.camera.y + 360 - 34)));
  paint();
} else {
  paint();
}
requestAnimationFrame(frame);
