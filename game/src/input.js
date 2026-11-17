// Keyboard and mouse, read once per frame in the shape the world wants: movement flags, the aim
// point in the game's 1280x720 space, which weapon key was pressed, and the one-shot presses
// (pause, save, restart, load, confirm) that the loop consumes exactly once.
import { VIEW } from './config.js';

const HELD = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  handbrake: ['Space'],
};

const WEAPON_KEYS = { Digit1: 'pistol', Digit2: 'smg', Digit3: 'shotgun' };

export function createInput(canvas) {
  const keys = new Set();
  const presses = new Set();
  const aim = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let mouseDown = false;
  let weapon = null;
  let firstInput = false;

  function held(name) {
    return HELD[name].some((code) => keys.has(code));
  }

  function toGame(event) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || VIEW.width;
    const height = rect.height || VIEW.height;
    aim.x = ((event.clientX - rect.left) / width) * VIEW.width;
    aim.y = ((event.clientY - rect.top) / height) * VIEW.height;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      keys.add(event.code);
      return;
    }
    keys.add(event.code);
    presses.add(event.code);
    firstInput = true;
    if (WEAPON_KEYS[event.code]) weapon = WEAPON_KEYS[event.code];
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => toGame(event));
  canvas.addEventListener('pointerdown', (event) => {
    toGame(event);
    mouseDown = true;
    presses.add('PointerDown');
    firstInput = true;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Everything the simulation needs this frame; clears the one-shot presses. */
    read() {
      const state = {
        up: held('up'),
        down: held('down'),
        left: held('left'),
        right: held('right'),
        run: held('run'),
        enter: held('enter'),
        handbrake: held('handbrake'),
        fire: mouseDown,
        aimX: aim.x,
        aimY: aim.y,
        weapon,
        pause: presses.has('Escape') || presses.has('KeyP'),
        confirm: presses.has('Enter') || presses.has('Space') || presses.has('PointerDown'),
        save: presses.has('KeyF'),
        restart: presses.has('KeyR'),
        load: presses.has('KeyL'),
        any: firstInput || presses.size > 0,
      };
      presses.clear();
      weapon = null;
      firstInput = false;
      return state;
    },
    /** Without a real frame loop (a staged screenshot) the aim point still has to be sane. */
    setAim(x, y) {
      aim.x = x;
      aim.y = y;
    },
  };
}
