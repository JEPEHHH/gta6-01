// Boot and the one loop: read input, advance the world in fixed 1/60 s steps with an accumulator,
// draw. Screens go title -> play -> pause, and wasted or busted out of a run; R builds a new city
// from the same seed, L loads the saved run, F saves it. ?seed=N fixes the city, ?shot=<name>
// stages a frozen screenshot scene instead of playing.
import { CITY_NAME, STEP } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { revivePlayer } from './player.js';
import { clearWanted } from './police.js';
import { failMission } from './missions.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const renderer = createRenderer(canvas);
window.__renderer = renderer;
const audio = createAudio();

function announce(message) {
  if (statusLine) statusLine.textContent = message;
}

let world = createWorld(seed);
world.audio = audio;
world.screen = 'title';
// A handle for debugging from the console (and for the screenshot harness): read-only in spirit.
window.__world = world;

if (shot) {
  stageShot(world, shot);
  let painted = 0;
  function paint() {
    renderer.draw(world);
    painted += 1;
    if (painted >= 2) {
      window.__shotReady = true;
      window.__shotName = shot;
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
} else {
  play();
}

function play() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let previousScreen = world.screen;

  const idle = {
    up: false, down: false, left: false, right: false, run: false, enter: false,
    handbrake: false, fire: false, aimX: 0, aimY: 0, weapon: null,
  };

  function newRun(startPlaying) {
    world = createWorld(seed);
    world.audio = audio;
    world.screen = startPlaying ? 'play' : 'title';
    window.__world = world;
    previousScreen = world.screen;
    accumulator = 0;
    announce(startPlaying ? 'New run.' : `${CITY_NAME}. Press enter to start.`);
  }

  function onScreenChange() {
    if (world.screen === previousScreen) return;
    previousScreen = world.screen;
    if (world.screen === 'wasted') {
      failMission(world);
      announce(`Wasted. Cash left ${Math.round(world.player.cash)}.`);
    } else if (world.screen === 'busted') {
      failMission(world);
      clearWanted(world);
      announce('Busted.');
    } else if (world.screen === 'paused') {
      announce('Paused.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min(0.25, (now - last) / 1000);
    last = now;
    const state = input.read();
    if (state.any) audio.unlock();

    if (state.save) {
      if (saveGame(world)) {
        world.toast('Run saved');
        announce('Run saved.');
      } else {
        world.toast('No storage in this browser');
      }
    }
    if (state.load) {
      if (loadGame(world)) {
        accumulator = 0;
        announce('Saved run loaded.');
      } else {
        world.toast('No saved run here');
      }
    }
    if (state.restart) {
      newRun(true);
      return;
    }
    if (state.pause) {
      if (world.screen === 'play') world.screen = 'paused';
      else if (world.screen === 'paused') {
        world.screen = 'play';
        accumulator = 0;
      }
    }

    if (world.screen === 'title') {
      if (state.confirm) {
        world.screen = 'play';
        accumulator = 0;
        announce('Playing. WASD to move, E to get in a car.');
      } else {
        idle.aimX = world.player.x + 120;
        idle.aimY = world.player.y;
        updateWorld(world, STEP, idle);
      }
    } else if (world.screen === 'play') {
      accumulator += delta;
      let guard = 0;
      while (accumulator >= STEP && guard < 4) {
        updateWorld(world, STEP, state);
        accumulator -= STEP;
        guard += 1;
      }
      if (state.confirm && world.outcome) reviveOutcome();
    } else if (world.screen === 'wasted' || world.screen === 'busted') {
      if (state.confirm) reviveOutcome();
    } else {
      accumulator = 0;
    }

    onScreenChange();

    const car = world.player.car;
    const ratio = car ? Math.hypot(car.vx, car.vy) / car.type.maxSpeed : 0;
    audio.engine(ratio, Boolean(car) && world.screen === 'play');
    audio.siren(world.wanted.level > 0 && world.wanted.units.length > 0);

    renderer.draw(world);
  }

  function reviveOutcome() {
    if (world.screen === 'busted') clearWanted(world);
    revivePlayer(world);
    world.screen = 'play';
    previousScreen = 'play';
    accumulator = 0;
    announce('Back on the street.');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.screen === 'play') world.screen = 'paused';
  });

  announce(`${CITY_NAME}. Press enter or click to start.`);
  requestAnimationFrame(frame);
}
