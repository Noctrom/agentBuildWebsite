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
  canvas: HTMLCanvasElement
  /** Drift speed (radians per second) and phase, per axis. */
  sx: number
  sy: number
  phase: number
  parallax: number
}

/** Low-resolution scale for nebula bitmaps; the blur hides the upscaling. */
const NEBULA_SCALE = 0.25

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
    if (nebulaColors.length === 0) return
    const fullW = width + margin * 2
    const fullH = height + margin * 2
    for (let i = 0; i < 2; i++) {
      const canvas = makeCanvas(fullW * NEBULA_SCALE, fullH * NEBULA_SCALE)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.scale(NEBULA_SCALE, NEBULA_SCALE)
      const span = Math.max(fullW, fullH)
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
          ctx.globalCompositeOperation = 'lighter'
          const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
          grad.addColorStop(0, `rgb(${cr} ${cg} ${cb} / ${peak})`)
          grad.addColorStop(0.5, `rgb(${cr} ${cg} ${cb} / ${peak * 0.35})`)
          grad.addColorStop(1, `rgb(${cr} ${cg} ${cb} / 0)`)
          ctx.fillStyle = grad
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
          angle += between(random, -0.6, 0.6)
          // Keep the path on screen: steer back toward the center when it drifts out.
          if (x < 0 || x > fullW || y < 0 || y > fullH) {
            angle = Math.atan2(fullH / 2 - y, fullW / 2 - x) + between(random, -0.4, 0.4)
          }
          x += Math.cos(angle) * radius * 0.7
          y += Math.sin(angle) * radius * 0.7
        }
      }
      // Dark dust: carve a few soft holes so the clouds get texture.
      ctx.globalCompositeOperation = 'destination-out'
      for (let d = 0; d < 6; d++) {
        const x = random() * fullW
        const y = random() * fullH
        const radius = between(random, 0.04, 0.12) * span
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
        grad.addColorStop(0, `rgb(0 0 0 / ${between(random, 0.3, 0.6)})`)
        grad.addColorStop(1, 'rgb(0 0 0 / 0)')
        ctx.fillStyle = grad
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }
      nebulae.push({
        canvas,
        sx: between(random, 0.006, 0.012) * (i === 0 ? 1 : -1),
        sy: between(random, 0.004, 0.009),
        phase: random() * Math.PI * 2,
        parallax: i === 0 ? 0.015 : 0.03,
      })
    }
  }

  build()

  function drawNebulae({ ctx, width, height, time, scrollY }: SceneFrame) {
    for (const n of nebulae) {
      const dx = Math.sin(time * n.sx * Math.PI * 2 + n.phase) * margin * 0.6
      const dy = Math.cos(time * n.sy * Math.PI * 2 + n.phase) * margin * 0.4
      // Bounded parallax: clouds never slide past their margin on long pages.
      const py = Math.min(scrollY * n.parallax, margin * 0.5)
      ctx.drawImage(n.canvas, -margin + dx, -margin + dy - py, width + margin * 2, height + margin * 2)
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
