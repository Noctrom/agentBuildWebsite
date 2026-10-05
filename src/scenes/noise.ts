import { createRandom } from './random'

/**
 * Seeded 2D value noise and fractal noise (fBm) for baking cloud textures on
 * create/resize. Far too slow for per-frame use over the screen; bake into a
 * low-resolution bitmap instead.
 */

export type Noise2D = (x: number, y: number) => number

/** Smooth value noise in [0, 1], with features about 1 unit apart. */
export function createValueNoise(seed: number): Noise2D {
  const random = createRandom(seed)
  const values = new Float32Array(256)
  const perm = new Uint8Array(512)
  for (let i = 0; i < 256; i++) {
    values[i] = random()
    perm[i] = i
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = perm[i]
    perm[i] = perm[j]
    perm[j] = t
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const at = (x: number, y: number) => values[perm[(x & 255) + perm[y & 255]]]
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

/** Fractal noise in [0, 1]: `octaves` layers of value noise, each twice as fine and half as strong. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 5): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp
    norm += amp
    x = x * 2 + 17.3
    y = y * 2 + 9.1
    amp *= 0.5
  }
  return sum / norm
}
