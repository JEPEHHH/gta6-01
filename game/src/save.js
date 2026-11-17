// Progress, in this browser only: the job the player is on, the money in their pocket and
// the number of times they woke up in hospital. localStorage may be unavailable (private
// windows), so every failure is a quiet no.

import { SAVE_KEY } from './config.js';
import { resumeJob } from './missions.js';

export function saveGame(world) {
  try {
    const data = {
      job: world.missions.index,
      step: world.missions.step,
      money: world.money,
      respawns: world.player.respawns,
      time: Math.round(world.time),
      saved: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    world.saveDirty = false;
    return data;
  } catch (error) {
    return null;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.job !== 'number' || typeof data.step !== 'number') return null;
    return data;
  } catch (error) {
    return null;
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

/** Fold a saved game into a fresh world. */
export function applySave(world, data) {
  if (!data) return false;
  world.money = Math.max(0, data.money ?? 0);
  world.player.respawns = data.respawns ?? 0;
  resumeJob(world, data.job ?? 0, data.step ?? 0);
  world.saveDirty = false;
  return true;
}
