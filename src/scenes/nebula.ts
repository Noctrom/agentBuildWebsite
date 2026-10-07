import { runToEnd } from './build'
import { makeCanvas, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneBuild, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Resume scene (S27, redrawn in V0.62): a Carina-Nebula-style field of
 * drifting clouds across the whole screen. Back to front:
 *
 * 1. Gas: a soft glow of blue-violet, teal and magenta everywhere, so no part
 *    of the screen is empty.
 * 2. Cloud banks: puffy, billowing clouds (magenta-red, warm gold, teal,
 *    blue-violet), lit from the upper left: a bright rim on the side facing
 *    the light, a darker shadowed side. Dark dust lanes cut through them.
 * 3. Streamers: thin, wispy filaments that trail off the edges of the banks,
 *    baked at a finer resolution so they stay sharp.
 * 4. Stars, and five young stars with six-point diffraction spikes that sit
 *    in the cloud banks and move with them.
 * 5. Near dust: soft dark lanes in front, drifting a little faster.
 *
 * Drift (V0.62): every layer is a tileable texture (periodic noise), baked
 * once per viewport size. Each frame draws a window of it, offset by
 * `speed * time` and wrapped, so the clouds drift forever without gaps or
 * seams, and no noise is computed per frame. The layers drift at different
 * speeds (parallax), so the motion reads as depth. Per frame: four
 * `drawImage` calls for the clouds, the starfield and five star sprites.
 * Motion is a pure function of `time`, so the first frame already moves at
 * full speed and a still frame (reduce motion) at time 0 looks complete.
 *
 * Bake cost: the cloud textures are value noise, and the bake must not make
 * the scene appear later than the S27 one did. So the smooth parts (domain
 * warp, colour, dust lanes) are computed on a grid 4x coarser and
 * interpolated, streamers are only computed downwind of a bank, and the
 * texel loops run in plain functions, one call per row (see `eachRow`).
 * `create` is a generator (S31, see "Heavy setup" in `types.ts`): it yields
 * every few hundred texels and the engine spreads the work over frames.
 * `resize` runs the same bake to the end at once with `runToEnd`.
 */

/** Emission colors for the cloud banks, blended along a noise ramp. */
const EMISSION_RAMP: readonly Rgb[] = [
  [60, 200, 195],
  [90, 130, 240],
  [120, 80, 235],
  [225, 70, 150],
  [245, 90, 95],
  [245, 175, 85],
]
/** Background gas colours (blue-violet base, teal and magenta patches). */
const GAS_BASE: readonly Rgb[] = [
  [60, 60, 200],
  [105, 70, 220],
]
const GAS_TEAL: Rgb = [40, 160, 185]
const GAS_MAGENTA: Rgb = [185, 60, 150]
/** Dust: the dark lanes, and the near dust in front. */
const DUST: Rgb = [16, 8, 16]
/** Pale tint for lit rims and streamers. */
const RIM: Rgb = [255, 236, 228]

/** Direction toward the light (upper left), about a unit vector. */
const LIGHT_X = -0.74
const LIGHT_Y = -0.67
/** Domain warp strength (noise lattice cells): how much the clouds swirl. */
const WARP = 0.7
/** How dark the cloud gets per unit of cloud between it and the light. */
const SHADOW = 1.6
/** How strongly the puffs inside a bank are lit by their slope. */
const RELIEF = 1.6
/** Shadow samples toward the light: distance in bank texels and weight. */
const SHADOW_STEPS: readonly (readonly [number, number])[] = [
  [1.5, 0.3],
  [2.5, 0.3],
  [5, 0.3],
  [8, 0.2],
  [12, 0.15],
]
/** Upwind samples when tracing streamers back to a bank. */
const TRAIL_STEPS = 4

/**
 * Tile size: the viewport plus this margin (CSS px), so a young star sprite
 * never pops in at the wrap edge.
 */
const TILE_PAD = 64
/**
 * Texture resolution in texels per CSS pixel. The banks aim for
 * `BANK_TEXELS` texels per tile within the `BANK_SCALE` limits (phones get
 * the finer end, large screens the coarser); streamers are 1.5x finer than
 * the banks. Gas and near dust are soft, so they can be coarse.
 */
const BANK_TEXELS = 40_000
const BANK_SCALE: readonly [number, number] = [0.24, 0.45]
const WISP_FACTOR = 1.5
const GAS_SCALE = 0.07
const NEAR_SCALE = 0.12
/** Texels of noise work between yields (each slice stays well under 5 ms on a slow phone). */
const TEXELS_PER_SLICE = 600

/**
 * Drift speed of the cloud banks in CSS px per second: about 0.8% of the
 * screen's size per second, but never faster than crossing the width in
 * 90 s. The gas drifts at 45% of that, the near dust at 140% (so it crosses
 * a phone screen in a bit over a minute). Direction: left and slightly up.
 */
const DRIFT_PER_UNIT = 0.008
const MIN_CROSS_SECONDS = 90
const DRIFT_X = -0.94
const DRIFT_Y = -0.34

interface TileLayer {
  /** Texture holding the tile plus a wrapped copy, so any viewport-sized window fits. */
  canvas: HTMLCanvasElement
  /** Tile size in CSS px. */
  tw: number
  th: number
  /** Texels per CSS px. */
  scale: number
  /** Drift relative to the banks, and scroll parallax. */
  speed: number
  parallax: number
  /** Starting offset into the tile (CSS px), seeded, so every load starts the same. */
  x0: number
  y0: number
}

interface YoungStar {
  /** Position in the bank tile (CSS px). */
  x: number
  y: number
  size: number
  speed: number
  phase: number
}

type TileNoise = (x: number, y: number, px: number, py: number) => number

/**
 * Seeded 2D value noise in [0, 1] that repeats every `px` x `py` lattice
 * cells (integers), so textures baked from it tile without seams.
 */
function createTileNoise(seed: number): TileNoise {
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
  return (x, y, px, py) => {
    const xf0 = Math.floor(x)
    const yf0 = Math.floor(y)
    const xf = x - xf0
    const yf = y - yf0
    let x0 = xf0 % px
    if (x0 < 0) x0 += px
    let y0 = yf0 % py
    if (y0 < 0) y0 += py
    const x1 = (x0 + 1 === px ? 0 : x0 + 1) & 255
    const y1 = (y0 + 1 === py ? 0 : y0 + 1) & 255
    x0 &= 255
    y0 &= 255
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = values[perm[x0 + perm[y0]]]
    const b = values[perm[x1 + perm[y0]]]
    const c = values[perm[x0 + perm[y1]]]
    const d = values[perm[x1 + perm[y1]]]
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

/** Fractal tileable noise in [0, 1]; each octave is twice as fine (and twice the period). */
function tileFbm(noise: TileNoise, x: number, y: number, px: number, py: number, octaves: number) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y, px, py) * amp
    norm += amp
    x = x * 2 + 17.3
    y = y * 2 + 9.1
    px *= 2
    py *= 2
    amp *= 0.5
  }
  return sum / norm
}

/**
 * Value noise averaged over two lattices offset by half a cell, with the
 * contrast restored. Plain value noise has features lined up with its grid,
 * which a sharp cloud edge turns into boxy shapes; the second lattice hides
 * that. Same periods as `noise`.
 */
function offGrid(noise: TileNoise, x: number, y: number, px: number, py: number) {
  return 0.5 + (noise(x, y, px, py) + noise(x + 101.5, y + 37.5, px, py) - 1) * 0.7
}

/**
 * Billowing fractal noise in about [0, 1]: smooth first octave, then
 * "billow" octaves (|2n - 1|), which pile up into round, cauliflower-like
 * puffs.
 */
function billowFbm(noise: TileNoise, x: number, y: number, px: number, py: number, octaves: number) {
  let sum = noise(x, y, px, py) * 0.5
  let amp = 0.25
  let norm = 0.5
  for (let o = 1; o < octaves; o++) {
    x = x * 2 + 17.3
    y = y * 2 + 9.1
    px *= 2
    py *= 2
    sum += Math.abs(offGrid(noise, x, y, px, py) * 2 - 1) * amp
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Bilinear lookup in a periodic grid of `gw` x `gh` values at grid coords (x, y). */
function sampleWrapped(grid: Float32Array, gw: number, gh: number, x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  let x0 = xi % gw
  if (x0 < 0) x0 += gw
  let y0 = yi % gh
  if (y0 < 0) y0 += gh
  const x1 = x0 + 1 === gw ? 0 : x0 + 1
  const y1 = y0 + 1 === gh ? 0 : y0 + 1
  const a = grid[y0 * gw + x0]
  const b = grid[y0 * gw + x1]
  const c = grid[y1 * gw + x0]
  const d = grid[y1 * gw + x1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/**
 * Bilinear lookup in a periodic coarse grid with one value every 4 texels,
 * at texel (i, j): the fast path of `sampleWrapped` for whole texels.
 */
function sampleCoarse(grid: Float32Array, gw: number, gh: number, i: number, j: number) {
  const x0 = i >> 2
  const y0 = j >> 2
  const fx = (i & 3) * 0.25
  const fy = (j & 3) * 0.25
  const x1 = x0 + 1 === gw ? 0 : x0 + 1
  const r0 = y0 * gw
  const r1 = (y0 + 1 === gh ? 0 : y0 + 1) * gw
  const a = grid[r0 + x0]
  const b = grid[r0 + x1]
  const c = grid[r1 + x0]
  const d = grid[r1 + x1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/**
 * Periodic box blur of radius `r` along one line of a grid, in place: `count`
 * values starting at `start`, `stride` apart (1 for a row, the grid width for
 * a column). `tmp` is scratch space of at least `count` values.
 */
function blurLine(grid: Float32Array, start: number, stride: number, count: number, r: number, tmp: Float32Array) {
  const n = r * 2 + 1
  let sum = 0
  for (let k = -r; k <= r; k++) sum += grid[start + wrap(k, count) * stride]
  for (let i = 0; i < count; i++) {
    tmp[i] = sum / n
    sum += grid[start + wrap(i + r + 1, count) * stride] - grid[start + wrap(i - r, count) * stride]
  }
  for (let i = 0; i < count; i++) grid[start + i * stride] = tmp[i]
}

/** Color along the emission ramp at t in [0, 1], written into `out` (no allocation in hot loops). */
function rampInto(t: number, out: [number, number, number]) {
  const last = EMISSION_RAMP.length - 1
  const c = Math.max(0, Math.min(0.999, t)) * last
  const k = Math.floor(c)
  const f = c - k
  const a = EMISSION_RAMP[k]
  const b = EMISSION_RAMP[k + 1]
  out[0] = a[0] + (b[0] - a[0]) * f
  out[1] = a[1] + (b[1] - a[1]) * f
  out[2] = a[2] + (b[2] - a[2]) * f
}

/** Clamp to a byte, with dither in [-0.5, 0.5) so gradients don't band. */
function byte(v: number, dither: number) {
  const x = Math.round(v + dither)
  return x < 0 ? 0 : x > 255 ? 255 : x
}

/** RGBA bytes packed for a little-endian `Uint32Array` view of `ImageData`. */
function pack(r: number, g: number, b: number, a: number, dither: number) {
  return ((byte(a, dither) << 24) | (byte(b, -dither) << 16) | (byte(g, dither) << 8) | byte(r, -dither)) >>> 0
}

/** Column index `i + shift`, wrapped, for every column `i` of a `size`-wide grid. */
function shiftedColumns(size: number, shift: number) {
  const out = new Int32Array(size)
  for (let i = 0; i < size; i++) out[i] = wrap(i + shift, size)
  return out
}

/** `value` wrapped into [0, size). */
function wrap(value: number, size: number) {
  const m = value % size
  return m < 0 ? m + size : m
}

/**
 * Put a tile's pixels on a texture large enough for any viewport-sized
 * window at any offset: the tile, plus wrapped copies to the right and below.
 * The extra copy also feeds the texels just outside a window, so the
 * bilinear upscale has no seams.
 */
function tileTexture(img: ImageData, tx: number, ty: number, viewW: number, viewH: number) {
  const tile = makeCanvas(tx, ty)
  tile.getContext('2d')?.putImageData(img, 0, 0)
  const w = Math.min(tx * 2, tx + Math.ceil(viewW) + 2)
  const h = Math.min(ty * 2, ty + Math.ceil(viewH) + 2)
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  for (let y = 0; y < h; y += ty) for (let x = 0; x < w; x += tx) ctx.drawImage(tile, x, y)
  return canvas
}

/** Tile dimensions in texels (multiples of 4, for the coarse grid) for a scale. */
function tileTexels(width: number, height: number, scale: number) {
  const tx = Math.max(8, Math.ceil(((width + TILE_PAD) * scale) / 4) * 4)
  const ty = Math.max(8, Math.ceil(((height + TILE_PAD) * scale) / 4) * 4)
  return [tx, ty] as const
}

/** Seeded dither values in [-0.5, 0.5), so smooth gradients don't band at full strength. */
function makeDither(seed: number) {
  const random = createRandom(seed)
  // A table of 4093 values (prime, so it doesn't line up with texture rows) is plenty.
  const table = Float32Array.from({ length: 4093 }, () => random() - 0.5)
  let i = 0
  return () => {
    i = i === 4092 ? 0 : i + 1
    return table[i]
  }
}

interface Baked {
  gas: TileLayer
  banks: TileLayer
  wisps: TileLayer
  near: TileLayer
  youngStars: YoungStar[]
}

/**
 * Run `row(j)` for every row, yielding after every `TEXELS_PER_SLICE` texels
 * of work (`row` returns its work). The texel loops live in plain functions
 * on purpose: V8 doesn't optimize a long loop inside a generator body, while
 * a function called once per row is optimized after a few rows, which makes
 * the bake several times faster.
 */
function* eachRow(count: number, row: (j: number) => number): Generator<unknown, void, undefined> {
  let work = 0
  for (let j = 0; j < count; j++) {
    work += row(j)
    if (work >= TEXELS_PER_SLICE) {
      work = 0
      yield
    }
  }
}

/** Bake every cloud layer for a viewport size, in slices (see `eachRow`). */
function* bakeLayers(width: number, height: number): Generator<unknown, Baked, undefined> {
  const unit = Math.sqrt(width * height)
  const random = createRandom(2720)
  const dither = makeDither(2729)
  const rgb: [number, number, number] = [0, 0, 0]

  // --- 1. Gas: soft, low-res glow over the whole tile. ---
  const [gx, gy] = tileTexels(width, height, GAS_SCALE)
  const gasImg = new ImageData(gx, gy)
  {
    const px32 = new Uint32Array(gasImg.data.buffer)
    const noise = createTileNoise(2731)
    const pgx = Math.max(1, Math.round((gx / GAS_SCALE / unit) * 3))
    const pgy = Math.max(1, Math.round((gy / GAS_SCALE / unit) * 3))
    const [b0, b1] = GAS_BASE
    yield* eachRow(gy, (j) => {
      const y = (j / gy) * pgy
      for (let i = 0; i < gx; i++) {
        const x = (i / gx) * pgx
        const base = offGrid(noise, x, y, pgx, pgy)
        const teal = smoothstep(0.5, 0.78, offGrid(noise, x + 31.7, y + 4.3, pgx, pgy)) * 0.8
        const mag = smoothstep(0.52, 0.8, offGrid(noise, x + 8.9, y + 57.1, pgx, pgy)) * 0.7
        let r = b0[0] + (b1[0] - b0[0]) * base
        let g = b0[1] + (b1[1] - b0[1]) * base
        let b = b0[2] + (b1[2] - b0[2]) * base
        r += (GAS_TEAL[0] - r) * teal + (GAS_MAGENTA[0] - r) * mag
        g += (GAS_TEAL[1] - g) * teal + (GAS_MAGENTA[1] - g) * mag
        b += (GAS_TEAL[2] - b) * teal + (GAS_MAGENTA[2] - b) * mag
        const a = 255 * (0.22 + 0.4 * smoothstep(0.25, 0.75, base))
        px32[j * gx + i] = pack(r, g, b, a, dither())
      }
      return gx * 3
    })
  }

  // --- 2. Cloud banks. ---
  const bankScale = Math.max(
    BANK_SCALE[0],
    Math.min(BANK_SCALE[1], Math.sqrt(BANK_TEXELS / ((width + TILE_PAD) * (height + TILE_PAD)))),
  )
  const [bx, by] = tileTexels(width, height, bankScale)
  /** Density noise lattice: cloud masses about 30% of the screen across. */
  const px = Math.max(2, Math.round((bx / bankScale / unit) * 3.4))
  const py = Math.max(2, Math.round((by / bankScale / unit) * 3.4))
  /** Colour varies more slowly than the clouds: half the lattice. */
  const hx = Math.max(1, Math.round(px / 2))
  const hy = Math.max(1, Math.round(py / 2))
  const densityNoise = createTileNoise(2721)
  const warpNoise = createTileNoise(2722)
  const dustNoise = createTileNoise(2723)

  // Coarse grid (every 4th texel): domain warp, broad cloud masses, colour
  // and dust lanes. They are smooth, so interpolating them is enough.
  const cw = bx / 4
  const ch = by / 4
  const warpX = new Float32Array(cw * ch)
  const warpY = new Float32Array(cw * ch)
  const masses = new Float32Array(cw * ch)
  const hue = new Float32Array(cw * ch)
  const lanes = new Float32Array(cw * ch)
  yield* eachRow(ch, (j) => {
    const y = (j / ch) * py
    for (let i = 0; i < cw; i++) {
      const x = (i / cw) * px
      const k = j * cw + i
      const wx = WARP * (warpNoise(x + 5.2, y + 1.3, px, py) - 0.5)
      const wy = WARP * (warpNoise(x + 1.7, y + 9.2, px, py) - 0.5)
      warpX[k] = wx
      warpY[k] = wy
      masses[k] = tileFbm(densityNoise, x + wx, y + wy, px, py, 2)
      hue[k] = 0.25 + (tileFbm(dustNoise, (i / cw) * hx + 40, (j / ch) * hy - 7, hx, hy, 2) - 0.25) * 1.7
      // Dust lanes: a ridged noise, only in some patches.
      const lx = x + wx * 0.5 + 11.3
      const ly = y + wy * 0.5
      const lane = (offGrid(dustNoise, lx, ly, px, py) * 2 + offGrid(dustNoise, lx * 2 + 5.5, ly * 2, px * 2, py * 2)) / 3
      const ridge = 1 - Math.abs(lane * 2 - 1)
      const patch = smoothstep(0.4, 0.62, densityNoise(x + 70.5, y + 30.5, px, py))
      lanes[k] = smoothstep(0.78, 0.96, ridge) * patch * 0.75
    }
    return cw * 10
  })

  // Density at every texel: the cloud masses plus billowing puffs at the
  // warped position, through a narrow threshold for crisp, lumpy edges.
  const density = new Float32Array(bx * by)
  /** The noise before the threshold: shapes the puffs inside the banks. */
  const relief = new Float32Array(bx * by)
  yield* eachRow(by, (j) => {
    for (let i = 0; i < bx; i++) {
      const x = (i / bx) * px + sampleCoarse(warpX, cw, ch, i, j)
      const y = (j / by) * py + sampleCoarse(warpY, cw, ch, i, j)
      const puffs = billowFbm(densityNoise, x * 3 + 3.1, y * 3 + 7.7, px * 3, py * 3, 2)
      const n = sampleCoarse(masses, cw, ch, i, j) * 0.6 + puffs * 0.4
      relief[j * bx + i] = n
      density[j * bx + i] = smoothstep(0.45, 0.58, n)
    }
    return bx * 3
  })

  // Lighting: each texel looks a few steps toward the light (upper left)
  // and is shadowed by the cloud in the way. Edges facing the light glow,
  // the far sides and the deep insides fall into shadow: that is what makes
  // the banks look puffy and 3D. The steps are whole-texel offsets; the
  // first reads the sharp density, the rest a blurred copy.
  const soft = density.slice()
  const blurTmp = new Float32Array(Math.max(bx, by))
  for (let pass = 0; pass < 2; pass++) {
    yield* eachRow(by, (j) => {
      blurLine(soft, j * bx, 1, bx, 2, blurTmp)
      return bx / 4
    })
    yield* eachRow(bx, (i) => {
      blurLine(soft, i, bx, by, 2, blurTmp)
      return by / 4
    })
  }
  const bankImg = new ImageData(bx, by)
  {
    const px32 = new Uint32Array(bankImg.data.buffer)
    const [c0, c1, c2, c3, c4] = SHADOW_STEPS.map(([dist]) => shiftedColumns(bx, Math.round(LIGHT_X * dist)))
    const [w0, w1, w2, w3, w4] = SHADOW_STEPS.map(([, weight]) => weight)
    const dy = SHADOW_STEPS.map(([dist]) => Math.round(LIGHT_Y * dist))
    yield* eachRow(by, (j) => {
      const r0w = wrap(j + dy[0], by) * bx
      const r1w = wrap(j + dy[1], by) * bx
      const r2w = wrap(j + dy[2], by) * bx
      const r3w = wrap(j + dy[3], by) * bx
      const r4w = wrap(j + dy[4], by) * bx
      for (let i = 0; i < bx; i++) {
        const k = j * bx + i
        const d = density[k]
        const lane = sampleCoarse(lanes, cw, ch, i, j)
        if (d < 0.004 && lane < 0.004) continue
        const occlusion =
          w0 * density[r0w + c0[i]] +
          w1 * soft[r1w + c1[i]] +
          w2 * soft[r2w + c2[i]] +
          w3 * soft[r3w + c3[i]] +
          w4 * soft[r4w + c4[i]]
        // Plus a gentle relief from the raw noise, so the puffs inside a bank
        // catch the light too (not just its edges).
        const bump = (relief[k] - relief[r2w + c2[i]]) * RELIEF
        const light = Math.min(1, Math.max(0, Math.exp(-SHADOW * occlusion) + bump))
        rampInto(sampleCoarse(hue, cw, ch, i, j), rgb)
        // Body: the emission colour, dark in shadow; lit edges turn pale.
        const body = 0.2 + 1.2 * light
        const rim = smoothstep(0.45, 0.85, light) * smoothstep(0.05, 0.5, d) * 0.6
        let r = rgb[0] * body
        let g = rgb[1] * body
        let b = rgb[2] * body
        r += (RIM[0] - r) * rim
        g += (RIM[1] - g) * rim
        b += (RIM[2] - b) * rim
        // Dust lanes: dark, covering both the banks and the gas behind them.
        r += (DUST[0] - r) * lane
        g += (DUST[1] - g) * lane
        b += (DUST[2] - b) * lane
        let a = d * 0.92
        if (a < 0.8) a += (0.8 - a) * lane
        px32[k] = pack(r, g, b, a * 255, dither())
      }
      return bx * 2
    })
  }

  // --- 3. Streamers: thin filaments trailing off the banks, finer texture. ---
  // Each texel looks upwind (to the left) for a bank; thin strands run
  // downwind from it and fade with distance, like gas blown off the clouds.
  const wx2 = Math.round(bx * WISP_FACTOR)
  const wy2 = Math.round(by * WISP_FACTOR)
  const wispImg = new ImageData(wx2, wy2)
  {
    // Upwind search on the bank grid (cheaper than per streamer texel),
    // reaching about 20% of the screen.
    const stepLen = (unit * 0.2 * bankScale) / TRAIL_STEPS
    const trails = new Float32Array(bx * by)
    const upwind = Array.from({ length: TRAIL_STEPS }, (_, s) => shiftedColumns(bx, -Math.round((s + 1) * stepLen)))
    const fade = Array.from({ length: TRAIL_STEPS }, (_, s) => 1 - (s + 1) / (TRAIL_STEPS + 1))
    yield* eachRow(by, (j) => {
      const row = j * bx
      for (let i = 0; i < bx; i++) {
        const here = soft[row + i]
        if (here > 0.7) continue
        let trail = 0
        for (let s = 0; s < TRAIL_STEPS; s++) {
          const t = soft[row + upwind[s][i]] * fade[s]
          if (t > trail) trail = t
        }
        trails[row + i] = smoothstep(0.15, 0.6, trail) * (1 - smoothstep(0.35, 0.7, here))
      }
      return bx * 2
    })

    const px32 = new Uint32Array(wispImg.data.buffer)
    const noise = createTileNoise(2724)
    /** Strands: long along x (few lattice cells), thin across (many). */
    const pa = Math.max(1, Math.round(px / 2))
    const pb = py * 7
    /** Nearest bank column for each streamer column, for a quick reject. */
    const nearCol = new Int32Array(wx2)
    for (let i = 0; i < wx2; i++) nearCol[i] = wrap(Math.round(i / WISP_FACTOR), bx)
    yield* eachRow(wy2, (j) => {
      let work = wx2 * 0.5
      const bj = j / WISP_FACTOR
      const nearRow = wrap(Math.round(bj), by) * bx
      const v = j / wy2
      for (let i = 0; i < wx2; i++) {
        if (trails[nearRow + nearCol[i]] < 0.005) continue
        const bi = i / WISP_FACTOR
        const trail = sampleWrapped(trails, bx, by, bi, bj)
        if (trail < 0.02) continue
        work += 3
        const u = i / wx2
        const wy = sampleWrapped(warpY, cw, ch, bi / 4, bj / 4)
        const n = tileFbm(noise, u * pa, v * pb + wy * 4, pa, pb, 2)
        let streak = (1 - Math.abs(n * 2 - 1)) ** 12 * trail
        if (streak < 0.01) continue
        // Break the strands up into different lengths.
        streak *= smoothstep(0.25, 0.6, noise(u * px + 50.5, v * py * 4 + 9.5, px, py * 4))
        if (streak < 0.01) continue
        rampInto(sampleWrapped(hue, cw, ch, bi / 4, bj / 4), rgb)
        const r = rgb[0] + (RIM[0] - rgb[0]) * 0.4
        const g = rgb[1] + (RIM[1] - rgb[1]) * 0.4
        const b = rgb[2] + (RIM[2] - rgb[2]) * 0.4
        px32[j * wx2 + i] = pack(r, g, b, 255 * Math.min(1, streak), dither())
      }
      return work
    })
  }

  // --- 5. Near dust: soft dark lanes in front. ---
  const [nx, ny] = tileTexels(width, height, NEAR_SCALE)
  const nearImg = new ImageData(nx, ny)
  {
    const px32 = new Uint32Array(nearImg.data.buffer)
    const noise = createTileNoise(2725)
    const pnx = Math.max(1, Math.round((nx / NEAR_SCALE / unit) * 2.4))
    const pny = Math.max(1, Math.round((ny / NEAR_SCALE / unit) * 2.4))
    yield* eachRow(ny, (j) => {
      const y = (j / ny) * pny
      for (let i = 0; i < nx; i++) {
        const x = (i / nx) * pnx
        const patch = smoothstep(0.5, 0.7, tileFbm(noise, x + 13.1, y + 3.7, pnx, pny, 2))
        if (patch < 0.01) continue
        const ridge = 1 - Math.abs(tileFbm(noise, x, y, pnx, pny, 3) * 2 - 1)
        px32[j * nx + i] = pack(DUST[0], DUST[1], DUST[2], 255 * smoothstep(0.7, 0.95, ridge) * patch * 0.6, dither())
      }
      return nx * 3
    })
  }

  // Young stars: on dense spots of the banks (tile coordinates).
  const youngStars: YoungStar[] = []
  for (let tries = 0; tries < 400 && youngStars.length < 5; tries++) {
    const i = Math.floor(random() * bx)
    const j = Math.floor(random() * by)
    if (soft[j * bx + i] < 0.35) continue
    const x = i / bankScale
    const y = j / bankScale
    if (youngStars.some((s) => Math.hypot(s.x - x, s.y - y) < unit * 0.25)) continue
    youngStars.push({
      x,
      y,
      size: between(random, 26, 48) * Math.min(1, unit / 800 + 0.3),
      speed: between(random, 0.2, 0.45),
      phase: random() * Math.PI * 2,
    })
  }
  yield

  const layer = (img: ImageData, tx: number, ty: number, scale: number, speed: number, parallax: number): TileLayer => ({
    canvas: tileTexture(img, tx, ty, width * scale, height * scale),
    tw: tx / scale,
    th: ty / scale,
    scale,
    speed,
    parallax,
    x0: random() * (tx / scale),
    y0: random() * (ty / scale),
  })
  const banks = layer(bankImg, bx, by, bankScale, 1, 0.025)
  yield
  // Streamers share the banks' tile and offset, so they stay attached.
  const wisps: TileLayer = { ...layer(wispImg, wx2, wy2, bankScale * WISP_FACTOR, 1, 0.025), x0: banks.x0, y0: banks.y0 }
  yield
  const gas = layer(gasImg, gx, gy, GAS_SCALE, 0.45, 0.012)
  const near = layer(nearImg, nx, ny, NEAR_SCALE, 1.4, 0.04)
  return { gas, banks, wisps, near, youngStars }
}

/**
 * The bake is the slow part of this scene, so the last result is kept for the
 * same viewport size: coming back to the page doesn't bake again. A few small
 * textures, about 1-4 MB. Written only once a bake has finished: a build
 * abandoned mid-bake leaves the cache as it was.
 */
let bakeCache: { key: string; baked: Baked } | null = null

function* cachedLayers(width: number, height: number): Generator<unknown, Baked, undefined> {
  const key = `${width}x${height}`
  if (bakeCache?.key === key) return bakeCache.baked
  const baked = yield* bakeLayers(width, height)
  bakeCache = { key, baked }
  return baked
}

/** Young star: bright core and six diffraction spikes (JWST style). */
function makeSpikeStar(size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = size / 2
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35)
  glow.addColorStop(0, 'rgb(255 255 255 / 1)')
  glow.addColorStop(0.15, 'rgb(255 240 250 / 0.9)')
  glow.addColorStop(0.4, 'rgb(255 200 230 / 0.25)')
  glow.addColorStop(1, 'rgb(255 200 230 / 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
  ctx.translate(c, c)
  for (let i = 0; i < 6; i++) {
    const len = i % 3 === 0 ? c : c * 0.75
    const spike = ctx.createLinearGradient(0, 0, len, 0)
    spike.addColorStop(0, 'rgb(255 255 255 / 0.8)')
    spike.addColorStop(1, 'rgb(255 255 255 / 0)')
    ctx.fillStyle = spike
    ctx.fillRect(0, -0.6, len, 1.2)
    ctx.rotate(Math.PI / 3)
  }
  return canvas
}

function* createNebula(setup: SceneSetup): SceneBuild {
  // Stars only: this scene draws its own, richer clouds.
  const stars = createStarfield(setup, { seed: 272, density: 0.9, nebulaColors: [] })
  const spikeStar = makeSpikeStar(56)
  yield

  let baked: Baked | null = null
  /** Bank drift speed (CSS px per second) for the current size. */
  let drift = 0

  function* build({ width, height }: SceneSize): Generator<unknown, void, undefined> {
    const next = yield* cachedLayers(width, height)
    baked = next
    drift = Math.min(Math.sqrt(width * height) * DRIFT_PER_UNIT, width / MIN_CROSS_SECONDS)
  }

  yield* build(setup)

  /** Offset into a layer's tile (CSS px, unwrapped): the screen shows tile point (x + ox, y + oy). */
  const offsetX = (l: TileLayer, time: number) => l.x0 - DRIFT_X * drift * l.speed * time
  const offsetY = (l: TileLayer, time: number, scrollY: number) =>
    l.y0 - DRIFT_Y * drift * l.speed * time + scrollY * l.parallax

  function drawLayer(ctx: CanvasRenderingContext2D, l: TileLayer, frame: SceneFrame) {
    const ox = offsetX(l, frame.time)
    const oy = offsetY(l, frame.time, frame.scrollY)
    const s = l.scale
    ctx.drawImage(
      l.canvas,
      wrap(ox, l.tw) * s,
      wrap(oy, l.th) * s,
      frame.width * s,
      frame.height * s,
      0,
      0,
      frame.width,
      frame.height,
    )
  }

  function draw(frame: SceneFrame) {
    if (!baked) return
    const { ctx, time, scrollY } = frame
    drawLayer(ctx, baked.gas, frame)
    drawLayer(ctx, baked.banks, frame)
    drawLayer(ctx, baked.wisps, frame)
    stars.draw(frame)
    // Young stars sit in the banks and drift with them.
    const banks = baked.banks
    const ox = offsetX(banks, time)
    const oy = offsetY(banks, time, scrollY)
    for (const s of baked.youngStars) {
      const half = s.size / 2
      const x = wrap(s.x - ox + half, banks.tw) - half
      const y = wrap(s.y - oy + half, banks.th) - half
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * s.speed + s.phase)
      ctx.drawImage(spikeStar, x - half, y - half, s.size, s.size)
    }
    ctx.globalAlpha = 1
    drawLayer(ctx, baked.near, frame)
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      runToEnd(build(next))
    },
    dispose() {
      stars.dispose?.()
      baked = null
    },
  }
}

export const nebulaScene: Scene = {
  id: 'nebula',
  create: createNebula,
}
