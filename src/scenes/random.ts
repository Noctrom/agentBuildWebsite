/**
 * Small seeded random number generator (mulberry32) for scenes, so a scene
 * looks the same on every load and after a resize. Returns floats in [0, 1).
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random float in [min, max). */
export function between(random: () => number, min: number, max: number): number {
  return min + (max - min) * random()
}
