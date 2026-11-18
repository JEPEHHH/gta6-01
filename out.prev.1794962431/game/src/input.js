// Keyboard and mouse, in the canvas's own 1280x720 coordinates.
// Held keys live in a set; keys pressed since the last frame are handed out exactly once.

import { VIEW } from './config.js';

const SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F5']);

export function createInput(canvas) {
  const held = new Set();
  const fresh = new Set();
  const mouse = { x: VIEW.width / 2, y: VIEW.height / 2, down: false, clicked: false, moved: 0 };

  const toLogical = (event) => {
    const box = canvas.getBoundingClientRect();
    const sx = VIEW.width / Math.max(1, box.width);
    const sy = VIEW.height / Math.max(1, box.height);
    mouse.x = (event.clientX - box.left) * sx;
    mouse.y = (event.clientY - box.top) * sy;
    mouse.moved += 1;
  };

  window.addEventListener('keydown', (event) => {
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (!held.has(event.code)) fresh.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', toLogical);
  canvas.addEventListener('mousedown', (event) => {
    toLogical(event);
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    down: (code) => held.has(code),
    pressed: (code) => fresh.has(code),
    axisX: () => (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
    axisY: () => (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0),
    sprint: () => held.has('ShiftLeft') || held.has('ShiftRight'),
    /** Call once the frame's update has read the one-shot presses. */
    endFrame() {
      fresh.clear();
      mouse.clicked = false;
    },
    reset() {
      held.clear();
      fresh.clear();
      mouse.down = false;
      mouse.clicked = false;
    },
  };
}
