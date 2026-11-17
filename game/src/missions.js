// The story: four jobs from three contacts, each a short chain of objective steps — fetch, deliver,
// steal, shake the police — with a marker on the map, a line of dialogue and cash on completion.
// The table is data; the code only walks it.
import { nearestJunction } from './city.js';
import { setWanted } from './police.js';

/**
 * `contactAt` and each step's `at` are fractions of the city, resolved when the job starts so a
 * different seed still puts the marker on a street. `kind` is goto, steal or evade.
 */
export const MISSIONS = [
  {
    id: 'first-cut',
    title: 'First Cut',
    contact: 'Riva',
    contactAt: [0.5, 0.42],
    intro: 'Riva: "Crate at Pier Nine. Tavo pays on delivery. Don\'t open it, don\'t stop."',
    steps: [
      { kind: 'goto', at: [0.22, 0.78], label: 'Collect the crate at Pier Nine', radius: 95, line: 'The crate is heavy. Something inside shifts.' },
      { kind: 'goto', at: [0.74, 0.22], label: "Deliver the crate to Tavo's lockup", radius: 95, line: 'Riva: "Tavo says you are late. He says it like a compliment."' },
    ],
    reward: 350,
  },
  {
    id: 'tab-run',
    title: 'Tab Run',
    contact: 'Mira',
    contactAt: [0.72, 0.6],
    intro: 'Mira: "Three people owe me. Collect, don\'t chat. The third one runs — chase him."',
    steps: [
      { kind: 'goto', at: [0.2, 0.3], label: 'Collect from the market stall', radius: 85, line: 'The stallholder counts slowly and stares at your hands.' },
      { kind: 'goto', at: [0.44, 0.72], label: 'Collect from the garage', radius: 85, line: 'The mechanic pays without a word and goes back to the lift.' },
      { kind: 'goto', at: [0.84, 0.36], label: 'Catch the runner by the marina', radius: 85, line: 'Mira: "See? Told you he runs. Get in a car."' },
    ],
    reward: 600,
  },
  {
    id: 'heat-check',
    title: 'Heat Check',
    contact: 'Tavo',
    contactAt: [0.34, 0.5],
    intro: 'Tavo: "The port cops are watching my dock. Make them chase you, then vanish. Lose them."',
    steps: [
      { kind: 'evade', stars: 3, label: 'Draw three stars, then lose the police', radius: 0, line: 'Tavo: "Go on, make some noise. I will move the cargo."' },
    ],
    reward: 900,
  },
  {
    id: 'harbour-job',
    title: 'The Harbour Job',
    contact: 'Riva',
    contactAt: [0.6, 0.3],
    intro: 'Riva: "One car, one crate, one clean run. Steal something fast and bring it to the harbour lockup."',
    steps: [
      { kind: 'steal', label: 'Steal any car', radius: 0, line: 'Riva: "Not that one. Something with a boot."' },
      { kind: 'goto', at: [0.86, 0.72], label: 'Drive the car to the harbour lockup', radius: 120, line: 'The lockup door rolls up. Two men in clean shirts are waiting.' },
      { kind: 'evade', stars: 2, label: 'Lose the police with the money', radius: 0, line: 'Riva: "You have the money. Now lose the blue lights."' },
    ],
    reward: 5000,
  },
];

export function createMissions() {
  return {
    index: 0,
    active: false,
    step: 0,
    stepTimer: 0,
    target: { x: 0, y: 0 },
    contact: { x: 0, y: 0 },
    dialog: '',
    speaker: '',
    dialogTimer: 0,
    done: 0,
    reward: 0,
    totalEarned: 0,
    lastResult: '',
    resolves: new Map(),
  };
}

/** Where a fraction of the city lands, snapped to a road so a marker never sits in a wall. */
function resolveSpot(city, fraction) {
  const key = fraction.join(':');
  const cache = city.spotCache ?? (city.spotCache = new Map());
  if (cache.has(key)) return cache.get(key);
  let x = city.width * fraction[0];
  let y = city.height * fraction[1];
  const junction = nearestJunction(city, x, y);
  const inside = city.buildings.some((b) => x > b.x - 10 && x < b.x + b.w + 10 && y > b.y - 10 && y < b.y + b.h + 10);
  if (inside) {
    x = junction.x;
    y = junction.y + city.road * 0.3;
  }
  const spot = { x, y };
  cache.set(key, spot);
  return spot;
}

/** Start the job whose contact marker the player has stepped into. */
export function startMission(world) {
  const state = world.missions;
  const mission = MISSIONS[state.index];
  if (!mission) return;
  state.active = true;
  state.step = 0;
  state.stepTimer = 0;
  state.dialog = mission.intro;
  state.speaker = mission.contact;
  state.dialogTimer = 7;
  world.toast(`${mission.title} — ${mission.contact}`);
  const step = mission.steps[0];
  state.target = step.at ? resolveSpot(world.city, step.at) : { x: world.player.x, y: world.player.y };
  if (step.kind === 'evade' && step.stars) setWanted(world, step.stars);
  if (world.audio) world.audio.mission();
}

/** Step done: pay out on the last one, otherwise point at the next. */
function advance(world) {
  const state = world.missions;
  const mission = MISSIONS[state.index];
  state.step += 1;
  state.stepTimer = 0;
  if (state.step >= mission.steps.length) {
    const reward = Math.round(mission.reward);
    state.active = false;
    state.done += 1;
    state.index += 1;
    state.reward = reward;
    state.totalEarned += reward;
    state.lastResult = `${mission.title} complete`;
    state.dialog = `${mission.contact}: "Clean. Here is your cut."`;
    state.speaker = mission.contact;
    state.dialogTimer = 6;
    world.addCash(reward);
    world.audio?.missionComplete();
    if (state.index < MISSIONS.length) {
      state.contact = resolveSpot(world.city, MISSIONS[state.index].contactAt);
    }
    return;
  }
  const step = mission.steps[state.step];
  state.target = step.at ? resolveSpot(world.city, step.at) : { x: world.player.x, y: world.player.y };
  state.dialog = step.line ?? '';
  state.speaker = mission.contact;
  state.dialogTimer = 5.5;
  if (step.kind === 'evade' && step.stars) setWanted(world, step.stars);
  world.toast(step.label);
}

/** Wasted or busted mid-job: the job goes back to its first step and the marker stays put. */
export function failMission(world) {
  const state = world.missions;
  if (!state.active) return;
  state.active = false;
  state.step = 0;
  state.stepTimer = 0;
  state.dialog = 'Job failed. The marker is still on the map.';
  state.dialogTimer = 4;
  state.lastResult = 'Failed';
}

export function stepDone(world, step) {
  const state = world.missions;
  const player = world.player;
  if (step.kind === 'goto') return Math.hypot(player.x - state.target.x, player.y - state.target.y) < (step.radius ?? 90);
  if (step.kind === 'steal') return Boolean(player.car);
  if (step.kind === 'evade') return state.stepTimer > 2.5 && world.wanted.level === 0;
  return false;
}

export function updateMissions(world, dt) {
  const state = world.missions;
  if (state.dialogTimer > 0) state.dialogTimer = Math.max(0, state.dialogTimer - dt);

  if (state.active) {
    state.stepTimer += dt;
    const mission = MISSIONS[state.index];
    if (world.outcome) {
      failMission(world);
      return;
    }
    if (mission && stepDone(world, mission.steps[state.step])) advance(world);
    return;
  }
  if (state.index >= MISSIONS.length) return;
  if (state.contact.x === 0 && state.contact.y === 0) {
    state.contact = resolveSpot(world.city, MISSIONS[state.index].contactAt);
  }
  const player = world.player;
  if (Math.hypot(player.x - state.contact.x, player.y - state.contact.y) < 78) startMission(world);
}

/** The marker to draw and the line the HUD shows: objective while playing, contact while idle. */
export function markerFor(world) {
  const state = world.missions;
  if (state.active) {
    const mission = MISSIONS[state.index];
    const step = mission.steps[state.step];
    if (step && (step.kind === 'goto' || (step.kind === 'steal' && world.player.car))) {
      return { x: state.target.x, y: state.target.y, label: step.label, kind: 'objective', radius: step.radius ?? 90 };
    }
    return null;
  }
  if (state.index >= MISSIONS.length) return null;
  if (state.contact.x === 0 && state.contact.y === 0) state.contact = resolveSpot(world.city, MISSIONS[state.index].contactAt);
  return { x: state.contact.x, y: state.contact.y, label: MISSIONS[state.index].title, kind: 'contact', radius: 78 };
}

/** HUD text: the job's name and current step, or an invitation to the next contact. */
export function objectiveText(world) {
  const state = world.missions;
  if (state.active) {
    const mission = MISSIONS[state.index];
    const step = mission.steps[state.step];
    return `${mission.title} — ${step.label}`;
  }
  if (state.index >= MISSIONS.length) return 'Story complete — free roam';
  return `${MISSIONS[state.index].title}: meet ${MISSIONS[state.index].contact}`;
}
