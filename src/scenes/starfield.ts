import { between, createRandom } from './random'
import type { Scene, SceneFrame, SceneInstance, SceneSetup, SceneSize } from './types'

/**
 * Starfield (S24): a layered starfield with gentle twinkling, slowly drifting
 * nebula clouds and a slight parallax between layers on scroll. It was the
 * first scene; since S27 every route has its own scene (see `routes.ts`, where
 * unmapped routes such as the 404 page get `lostInSpaceScene`), and most of
 * them draw this starfield as their base.
 *
 * Other scenes can reuse it as their base: call `createStarfield(setup)` in
 * your scene's `create`, forward `resize`/`dispose`, and call its `draw(frame)`
 * before drawing your own objects on top. Options tune density and colors.
 */

type Rgb = readonly [number, number, number]

export interface StarfieldOptions {
  /** Seed for star and cloud placement. Same seed = same sky. */
  seed?: number
  /** Multiplier for the number of stars (1 = default density). */
  density?: number
  /** Nebula cloud colors; an empty array draws no nebula. */
  nebulaColors?: readonly Rgb[]
  /** Multiplier for cloud opacity (1 = default). */
  nebulaStrength?: number
}

/** Colors drawn from Hubble/JWST nebula imagery: violet, deep blue, magenta, teal, warm dust. */
export const defaultNebulaColors: readonly Rgb[] = [
  [124, 92, 255],
  [64, 96, 230],
  [190, 72, 190],
  [40, 150, 200],
  [235, 150, 80],
]

const STAR_TINTS = ['#ffffff', '#d4ddff', '#c9c4ff', '#ffe8c2'] as const

/** Star layers, far to near: count per megapixel, size, parallax factor. */
const LAYERS = [
  { perMegapixel: 380, size: [0.5, 1.1], parallax: 0.02, twinkle: false },
  { perMegapixel: 110, size: [0.9, 1.6], parallax: 0.05, twinkle: true },
  { perMegapixel: 28, size: [2.5, 5], parallax: 0.1, twinkle: true },
] as const

/** Upper bound on stars per layer, so huge screens stay cheap. */
const MAX_PER_LAYER = 900

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  /** 0 = steady, up to ~0.6 = strong twinkle. */
  twinkle: number
  speed: number
  phase: number
  tint: number
}

interface NebulaLayer {
  /**
   * Cloud bitmap (V0.75), null until baked: in its own task right after
   * setup, or by the first frame if that comes sooner (see `scheduleBakes`).
   */
  canvas: HTMLCanvasElement | null
  /** What to bake: the glows and dust holes, and the bitmap's size in CSS px. */
  glows: Glow[]
  holes: Glow[]
  fullW: number
  fullH: number
  /** Drift speed (radians per second) and phase, per axis. */
  sx: number
  sy: number
  phase: number
  parallax: number
}

/**
 * Low-resolution scale for nebula bitmaps; the clouds are soft, so the
 * upscaling doesn't show. V0.75 halved it (from 0.25) when the bake moved
 * from canvas gradients to JS: a quarter of the texels keeps the bake to a
 * few ms on a slow phone, and with random dither instead of the browser's
 * gradient pattern the coarser bitmap still upscales smoothly.
 */
const NEBULA_SCALE = 0.125

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** Soft round glow used for the near stars. */
function makeStarSprite(tint: string): HTMLCanvasElement {
  const size = 32
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, tint)
  g.addColorStop(0.15, tint)
  g.addColorStop(0.35, 'rgb(255 255 255 / 0.25)')
  g.addColorStop(1, 'rgb(255 255 255 / 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** A soft radial glow (or dust hole) in CSS px, before the bitmap is scaled down. */
interface Glow {
  x: number
  y: number
  radius: number
  /** Opacity at the centre. */
  alpha: number
  /** Color, 0..1 per channel. */
  rgb: readonly [number, number, number]
}

/**
 * Cloud falloff tables for `bakeClouds`, indexed by squared distance / radius
 * (0..1) times `FALLOFF_STEPS`, so the texel loops need no square root. One
 * extra entry of 0 covers rounding at the very edge. Fine enough that the
 * steps stay far below one 8-bit level.
 * - Glow: 1 at the centre, 0.35 halfway out, 0 at the edge (the old gradient stops).
 * - Hole: 1 at the centre, 0 at the edge.
 */
const FALLOFF_STEPS = 16384
const GLOW_FALLOFF = new Float32Array(FALLOFF_STEPS + 2)
const HOLE_FALLOFF = new Float32Array(FALLOFF_STEPS + 2)
for (let i = 0; i < FALLOFF_STEPS; i++) {
  const t = Math.sqrt((i + 0.5) / FALLOFF_STEPS)
  GLOW_FALLOFF[i] = t < 0.5 ? 1 - 1.3 * t : 0.7 * (1 - t)
  HOLE_FALLOFF[i] = 1 - t
}

/**
 * Bake the cloud bitmap for one nebula layer (V0.75), at `NEBULA_SCALE`.
 *
 * The clouds used to be drawn with canvas radial gradients. The browser
 * dithers gradients with a fixed pattern, and stretching the low-res bitmap
 * to the screen magnified it into a visible ~4 px checker, worst in
 * the full-strength hidden-content view (V0.61). This computes the same
 * picture in code instead:
 * - Glows: opacity falls off linearly from `alpha` at the centre to 35% of it
 *   halfway out and 0 at the edge (the old gradient stops), and they add up
 *   like the old 'lighter' blending: premultiplied, clamped at 255. Clamping
 *   once after all glows gives the same result as after each, since they only
 *   add.
 * - Holes (dust): `alpha` at the centre to 0 at the edge, removing that share
 *   of the cloud (the old 'destination-out').
 * - Random dither of up to half a step on every channel, so the soft falloff
 *   shows no steps and no pattern at any brightness.
 *
 * Speed: this runs right after scene setup on the main thread, so it must
 * stay short (a few ms per layer at 4x throttle). Each glow only
 * visits the texels of its own disc, and the texel loops are small functions
 * called once per row (`glowRow`, `holeRow`, `outputRow`): V8 optimizes a
 * function after a few calls, while one long loop would run slowly until
 * on-stack replacement kicks in.
 */
function bakeClouds(fullW: number, fullH: number, glows: Glow[], holes: Glow[], dither: Float32Array) {
  const canvas = makeCanvas(fullW * NEBULA_SCALE, fullH * NEBULA_SCALE)
  const tw = canvas.width
  const th = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  /** Premultiplied RGBA, 0..255 (above 255 until clamped). */
  const acc = new Float32Array(tw * th * 4)

  const disc = (g: Glow, row: (k: number, i0: number, i1: number, cx: number, dy: number, inv: number) => void) => {
    const s = NEBULA_SCALE
    const inv = 1 / (g.radius * s)
    // Texel (i, j) has its centre at (i + 0.5, j + 0.5).
    const cx = g.x * s - 0.5
    const cy = g.y * s - 0.5
    const j0 = Math.max(0, Math.floor(cy - g.radius * s))
    const j1 = Math.min(th - 1, Math.ceil(cy + g.radius * s))
    for (let j = j0; j <= j1; j++) {
      const dy = (j - cy) * inv
      const rest = 1 - dy * dy
      if (rest <= 0) continue
      // This row's part of the disc.
      const half = Math.sqrt(rest) / inv
      const i0 = Math.max(0, Math.ceil(cx - half))
      const i1 = Math.min(tw - 1, Math.floor(cx + half))
      if (i0 <= i1) row(j * tw * 4, i0, i1, cx, dy, inv)
    }
  }
  for (const g of glows) {
    const peak = Math.min(1, g.alpha)
    const [r, gr, b] = g.rgb
    disc(g, (k, i0, i1, cx, dy, inv) => glowRow(acc, k, i0, i1, cx, dy, inv, peak, r * 255, gr * 255, b * 255))
  }
  for (const h of holes) disc(h, (k, i0, i1, cx, dy, inv) => holeRow(acc, k, i0, i1, cx, dy, inv, h.alpha))

  // To 8 bits with dither, see `outputRow`.
  const img = new ImageData(tw, th)
  const out = img.data
  let d = 0
  for (let j = 0; j < th; j++) d = outputRow(acc, out, j * tw * 4, (j + 1) * tw * 4, dither, d)
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** One row of a glow in `bakeClouds`: texels i0..i1, starting at index `k`. */
function glowRow(
  acc: Float32Array,
  k: number,
  i0: number,
  i1: number,
  cx: number,
  dy: number,
  inv: number,
  peak: number,
  r: number,
  g: number,
  b: number,
) {
  const dy2 = dy * dy
  for (let i = i0; i <= i1; i++) {
    const dx = (i - cx) * inv
    const a = peak * GLOW_FALLOFF[((dx * dx + dy2) * FALLOFF_STEPS) | 0]
    const p = k + i * 4
    acc[p] += r * a
    acc[p + 1] += g * a
    acc[p + 2] += b * a
    acc[p + 3] += a * 255
  }
}

/** One row of a dust hole in `bakeClouds` (clamps the glows first). */
function holeRow(acc: Float32Array, k: number, i0: number, i1: number, cx: number, dy: number, inv: number, alpha: number) {
  const dy2 = dy * dy
  for (let i = i0; i <= i1; i++) {
    const dx = (i - cx) * inv
    const keep = 1 - alpha * HOLE_FALLOFF[((dx * dx + dy2) * FALLOFF_STEPS) | 0]
    const p = k + i * 4
    acc[p] = Math.min(255, acc[p]) * keep
    acc[p + 1] = Math.min(255, acc[p + 1]) * keep
    acc[p + 2] = Math.min(255, acc[p + 2]) * keep
    acc[p + 3] = Math.min(255, acc[p + 3]) * keep
  }
}

/** 255 / alpha for every 8-bit alpha (0 for 0), for `outputRow`. */
const UNPREMULTIPLY = Float32Array.from({ length: 256 }, (_, a) => (a ? 255 / a : 0))

/**
 * One row of `bakeClouds` output, `acc[start..end)` to 8-bit RGBA with dither.
 * The canvas keeps premultiplied colors, so the dither goes on the
 * premultiplied values: the color written is the one whose premultiplied
 * value lands on the dithered number. A color never exceeds its alpha before
 * clamping, and `ImageData` rounds and clamps to 0..255 by itself, so only
 * the alpha needs rounding here. Returns the next dither index.
 */
function outputRow(acc: Float32Array, out: Uint8ClampedArray, start: number, end: number, dither: Float32Array, d: number) {
  const n = dither.length
  for (let k = start; k < end; k += 4) {
    d = d + 4 >= n ? 0 : d + 4
    let alpha = (acc[k + 3] + dither[d] + 0.5) | 0
    if (alpha <= 0) continue
    if (alpha > 255) alpha = 255
    const unpremultiply = UNPREMULTIPLY[alpha]
    out[k] = (acc[k] + dither[d + 1]) * unpremultiply
    out[k + 1] = (acc[k + 1] + dither[d + 2]) * unpremultiply
    out[k + 2] = (acc[k + 2] + dither[d + 3]) * unpremultiply
    out[k + 3] = alpha
  }
  return d
}

let ditherCache: Float32Array | null = null

/**
 * Seeded dither values in [-0.5, 0.5) for `bakeClouds`, made once: 4093
 * groups of four (prime, so the pattern doesn't line up with the bitmap's
 * rows).
 */
function ditherTable() {
  if (!ditherCache) {
    const random = createRandom(7919)
    ditherCache = new Float32Array(4093 * 4)
    for (let i = 0; i < ditherCache.length; i++) ditherCache[i] = random() - 0.5
  }
  return ditherCache
}

export function createStarfield(setup: SceneSetup, options: StarfieldOptions = {}): SceneInstance {
  const seed = options.seed ?? 24
  const density = options.density ?? 1
  const nebulaColors = options.nebulaColors ?? defaultNebulaColors
  const nebulaStrength = options.nebulaStrength ?? 1
  const sprites = STAR_TINTS.map(makeStarSprite)

  let size: SceneSize = setup
  let layers: Star[][] = []
  /** Far layer pre-rendered once per resize (it does not twinkle). */
  let farCanvas: HTMLCanvasElement | null = null
  let nebulae: NebulaLayer[] = []
  let margin = 0

  function build() {
    const random = createRandom(seed)
    const { width, height, dpr } = size
    const megapixels = (width * height) / 1_000_000

    layers = LAYERS.map((layer) => {
      const count = Math.min(MAX_PER_LAYER, Math.round(layer.perMegapixel * megapixels * density))
      return Array.from({ length: count }, () => ({
        x: random() * width,
        y: random() * height,
        size: between(random, layer.size[0], layer.size[1]),
        alpha: between(random, 0.45, 1),
        twinkle: layer.twinkle && random() < 0.7 ? between(random, 0.15, 0.6) : 0,
        speed: between(random, 0.25, 1.1),
        phase: random() * Math.PI * 2,
        tint: Math.floor(random() * STAR_TINTS.length),
      }))
    })

    // Far stars: bake into a bitmap the size of the viewport (device pixels).
    farCanvas = makeCanvas(width * dpr, height * dpr)
    const farCtx = farCanvas.getContext('2d')
    if (farCtx) {
      farCtx.scale(dpr, dpr)
      for (const star of layers[0]) {
        farCtx.globalAlpha = star.alpha * 0.85
        farCtx.fillStyle = STAR_TINTS[star.tint]
        farCtx.fillRect(star.x, star.y, star.size, star.size)
      }
    }

    // Nebulae: two low-res cloud bitmaps, larger than the viewport so they can drift.
    margin = Math.round(Math.max(width, height) * 0.12)
    nebulae = []
    cancelBakes()
    if (nebulaColors.length === 0) return
    const fullW = width + margin * 2
    const fullH = height + margin * 2
    for (let i = 0; i < 2; i++) {
      const span = Math.max(fullW, fullH)
      const glows: Glow[] = []
      // Each cloud is a chain of soft blobs along a wandering path, so it
      // reads as a filament (like Hubble nebula streaks), not a round haze.
      const clouds = i === 0 ? 1 : 2
      for (let c = 0; c < clouds; c++) {
        let x = between(random, 0.15, 0.85) * fullW
        let y = between(random, 0.15, 0.85) * fullH
        let angle = random() * Math.PI * 2
        const [r, g, bl] = nebulaColors[Math.floor(random() * nebulaColors.length)]
        const steps = i === 0 ? 14 : 8
        for (let b = 0; b < steps; b++) {
          // Mostly the cloud's own color, sometimes a neighbour for variation.
          const [cr, cg, cb] =
            random() < 0.3 ? nebulaColors[Math.floor(random() * nebulaColors.length)] : [r, g, bl]
          const radius = between(random, 0.07, 0.2) * span * (i === 0 ? 1.3 : 1)
          const peak = between(random, 0.25, 0.55) * nebulaStrength
          glows.push({ x, y, radius, alpha: peak, rgb: [cr / 255, cg / 255, cb / 255] })
          angle += between(random, -0.6, 0.6)
          // Keep the path on screen: steer back toward the center when it drifts out.
          if (x < 0 || x > fullW || y < 0 || y > fullH) {
            angle = Math.atan2(fullH / 2 - y, fullW / 2 - x) + between(random, -0.4, 0.4)
          }
          x += Math.cos(angle) * radius * 0.7
          y += Math.sin(angle) * radius * 0.7
        }
      }
      // Dark dust: a few soft holes so the clouds get texture.
      const holes: Glow[] = []
      for (let d = 0; d < 6; d++) {
        const x = random() * fullW
        const y = random() * fullH
        const radius = between(random, 0.04, 0.12) * span
        holes.push({ x, y, radius, alpha: between(random, 0.3, 0.6), rgb: [0, 0, 0] })
      }
      nebulae.push({
        canvas: null,
        glows,
        holes,
        fullW,
        fullH,
        sx: between(random, 0.006, 0.012) * (i === 0 ? 1 : -1),
        sy: between(random, 0.004, 0.009),
        phase: random() * Math.PI * 2,
        parallax: i === 0 ? 0.015 : 0.03,
      })
    }
    scheduleBakes()
  }

  /**
   * Cloud bakes waiting in their own tasks (V0.75). Each layer is a few ms
   * of JS on a slow phone: added to the scene's setup or its first frame, it
   * pushed those over 50 ms at 1280 px with 4x throttle, so each layer is
   * baked in a separate task right after setup. If a frame comes first, it
   * bakes whatever is missing itself, so every frame shows both layers.
   */
  let bakeTimers: number[] = []

  function cancelBakes() {
    for (const id of bakeTimers) clearTimeout(id)
    bakeTimers = []
  }

  function bake(n: NebulaLayer) {
    return (n.canvas ??= bakeClouds(n.fullW, n.fullH, n.glows, n.holes, ditherTable()))
  }

  function scheduleBakes() {
    cancelBakes()
    bakeTimers = nebulae.map((n) => window.setTimeout(() => bake(n), 0))
  }

  build()

  function drawNebulae({ ctx, width, height, time, scrollY }: SceneFrame) {
    for (const n of nebulae) {
      const canvas = bake(n)
      const dx = Math.sin(time * n.sx * Math.PI * 2 + n.phase) * margin * 0.6
      const dy = Math.cos(time * n.sy * Math.PI * 2 + n.phase) * margin * 0.4
      // Bounded parallax: clouds never slide past their margin on long pages.
      const py = Math.min(scrollY * n.parallax, margin * 0.5)
      ctx.drawImage(canvas, -margin + dx, -margin + dy - py, width + margin * 2, height + margin * 2)
    }
  }

  function wrap(value: number, max: number) {
    return ((value % max) + max) % max
  }

  function drawStars({ ctx, width, height, time, scrollY }: SceneFrame) {
    // Far layer: one bitmap, wrapped vertically for parallax.
    if (farCanvas) {
      const offset = wrap(-scrollY * LAYERS[0].parallax, height)
      ctx.drawImage(farCanvas, 0, offset - height, width, height)
      ctx.drawImage(farCanvas, 0, offset, width, height)
    }
    // Mid layer: small squares with twinkle.
    const mid = layers[1]
    const midOffset = -scrollY * LAYERS[1].parallax
    for (const star of mid) {
      const tw = star.twinkle ? 1 - star.twinkle * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase)) : 1
      ctx.globalAlpha = star.alpha * tw
      ctx.fillStyle = STAR_TINTS[star.tint]
      ctx.fillRect(star.x, wrap(star.y + midOffset, height), star.size, star.size)
    }
    // Near layer: soft glowing sprites.
    const near = layers[2]
    const nearOffset = -scrollY * LAYERS[2].parallax
    for (const star of near) {
      const tw = star.twinkle ? 1 - star.twinkle * (0.5 + 0.5 * Math.sin(time * star.speed * 0.8 + star.phase)) : 1
      ctx.globalAlpha = star.alpha * tw
      const s = star.size * 2
      ctx.drawImage(sprites[star.tint], star.x - s / 2, wrap(star.y + nearOffset, height) - s / 2, s, s)
    }
    ctx.globalAlpha = 1
  }

  return {
    draw(frame) {
      drawNebulae(frame)
      drawStars(frame)
    },
    resize(next) {
      size = next
      build()
    },
    dispose() {
      cancelBakes()
      layers = []
      farCanvas = null
      nebulae = []
    },
  }
}

/**
 * The starfield on its own, as a scene. No route uses it at the moment (the
 * default for unmapped routes is `lostInSpaceScene` in `routes.ts`); it stays
 * as the simplest complete example of the scene contract.
 */
export const starfieldScene: Scene = {
  id: 'starfield',
  create: (setup) => createStarfield(setup),
}
