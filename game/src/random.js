// A seeded random number generator (mulberry32). One stream per world: every draw happens in a
// fixed order, so a seed gives the same city, the same traffic and the same screenshot frame every
// time. Helpers hang off the function so the callers stay short.

export function createRandom(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;

  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A float in [lo, hi). */
  random.range = (lo, hi) => lo + random() * (hi - lo);
  /** An integer in [0, n). */
  random.int = (n) => Math.floor(random() * n);
  /** One element of a non-empty list. */
  random.pick = (list) => list[Math.floor(random() * list.length)];
  /** True with probability p. */
  random.chance = (p) => random() < p;
  /** A value around `base`, jittered by +/- `spread`. */
  random.jitter = (base, spread) => base + (random() * 2 - 1) * spread;
  /** A shuffled copy, Fisher-Yates on the same stream. */
  random.shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  };

  return random;
}

/** Shortest signed angle from a to b, in (-PI, PI]. Every heading turn goes through it. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `a` toward `b` by at most `maxStep` radians. */
export function turnToward(a, b, maxStep) {
  const d = angleDelta(a, b);
  return a + Math.max(-maxStep, Math.min(maxStep, d));
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
