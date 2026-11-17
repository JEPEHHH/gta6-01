// A seeded generator (mulberry32) plus the small helpers the city builders use.
// The same seed always lays out the same city, which keeps the screenshots repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rnd, min, max) => min + rnd() * (max - min);
export const int = (rnd, min, max) => Math.floor(min + rnd() * (max - min + 1));
export const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];
export const chance = (rnd, p) => rnd() < p;

/** A stable pseudo-random number from a coordinate pair, for windows and rooftop marks. */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
