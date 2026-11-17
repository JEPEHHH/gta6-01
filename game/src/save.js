// Saving a run to localStorage: position, cash, health, wanted level, weapon and the job the
// player is on. Every call is guarded, because a sandboxed or private window can refuse storage —
// the game then plays on with saving simply unavailable.
const KEY = 'sol-verde.save.v1';

function storage() {
  try {
    const value = window.localStorage;
    if (!value) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveGame(world) {
  const store = storage();
  if (!store) return false;
  const player = world.player;
  const missions = world.missions;
  try {
    store.setItem(KEY, JSON.stringify({
      version: 1,
      seed: world.seed,
      clock: world.clock,
      x: Math.round(player.x),
      y: Math.round(player.y),
      hp: Math.round(player.hp),
      armor: Math.round(player.armor),
      cash: Math.round(player.cash),
      weapon: player.weapon,
      ammo: player.ammo,
      wanted: world.wanted.level,
      heat: world.wanted.heat,
      mission: missions.index,
      step: missions.step,
      active: missions.active,
      done: missions.done,
      earned: missions.totalEarned,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(world) {
  const store = storage();
  if (!store) return false;
  let data = null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return false;
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!data || data.version !== 1) return false;

  const player = world.player;
  player.x = data.x;
  player.y = data.y;
  player.hp = Math.max(20, Math.min(100, data.hp));
  player.armor = Math.max(0, Math.min(100, data.armor));
  player.cash = Math.max(0, data.cash);
  player.weapon = data.weapon ?? 'pistol';
  if (data.ammo) player.ammo = { ...player.ammo, ...data.ammo };
  player.car = null;
  player.vx = 0;
  player.vy = 0;

  world.clock = data.clock ?? world.clock;
  world.wanted.level = Math.max(0, Math.min(5, data.wanted ?? 0));
  world.wanted.heat = data.heat ?? world.wanted.level * 100;
  world.missions.index = Math.max(0, Math.min(3, data.mission ?? 0));
  world.missions.step = Math.max(0, data.step ?? 0);
  world.missions.active = Boolean(data.active);
  world.missions.done = data.done ?? 0;
  world.missions.totalEarned = data.earned ?? 0;
  world.missions.contact = { x: data.x, y: data.y };
  world.camera.x = player.x;
  world.camera.y = player.y;
  world.outcome = null;
  world.screen = 'play';
  world.toast('Run loaded');
  return true;
}

export function hasSave() {
  const store = storage();
  if (!store) return false;
  try {
    return Boolean(store.getItem(KEY));
  } catch {
    return false;
  }
}

export function clearSave() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
