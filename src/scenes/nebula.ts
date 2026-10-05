import { makeCanvas, makeSoftDot, spread, type Rgb } from './canvas'
import { createValueNoise, fbm } from './noise'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Resume scene (S27): a rich, colorful emission nebula, after Hubble and JWST
 * images of star-forming regions. Three cloud layers: a broad blue-violet
 * glow, turbulent emission clouds (hydrogen magenta-red, oxygen teal, warm
 * dust gold) cut by dark dust lanes, and bright rims that slowly brighten and
 * dim. A few young stars with six-point diffraction spikes sit inside the
 * clouds. The clouds hug the right edge and the bottom-left corner, so they
 * frame the resume text instead of filling the middle.
 *
 * Cost per frame: the starfield (stars only), three low-res cloud bitmaps
 * scaled up, and a few star sprites. The clouds are fractal noise baked into
 * the bitmaps on create/resize.
 */

type Path = readonly (readonly [number, number])[]

/** Where the clouds are, as viewport fractions: dense near these lines. */
const PATHS: readonly Path[] = [
  // Right edge, top to bottom, wandering in and out.
  [
    [1.04, -0.06],
    [0.9, 0.12],
    [0.95, 0.34],
    [0.84, 0.52],
    [0.93, 0.72],
    [0.88, 0.9],
    [1.05, 1.06],
  ],
  // Bottom-left corner.
  [
    [-0.06, 0.66],
    [0.1, 0.84],
    [0.24, 0.95],
    [0.36, 1.08],
  ],
  // Faint wisp across the top-left.
  [
    [-0.05, 0.12],
    [0.12, 0.02],
    [0.3, -0.04],
  ],
]
/** Relative weight of each path (how much cloud it gets). */
const PATH_WEIGHT = [1, 0.85, 0.35] as const

const GLOW_COLORS: readonly Rgb[] = [
  [50, 70, 205],
  [110, 70, 230],
  [70, 45, 170],
]
/** Emission colors, blended along a noise ramp. */
const EMISSION_RAMP: readonly Rgb[] = [
  [120, 80, 235],
  [225, 70, 150],
  [245, 90, 95],
  [245, 175, 85],
  [60, 200, 195],
  [90, 130, 240],
]
/** Low-res bitmap scales; the upscaling blur is part of the look. */
const GLOW_SCALE = 0.15
const CLOUD_SCALE = 0.22
/** Small screens get a finer bitmap, so features are not blocky. */
const MIN_CLOUD_PIXELS = 115

interface CloudLayer {
  canvas: HTMLCanvasElement
  parallax: number
  /** Drift (radians per second) and phase. */
  sx: number
  sy: number
  phase: number
  /** Brightness breathing speed (0 = steady). */
  breathe: number
}

interface YoungStar {
  x: number
  y: number
  size: number
  speed: number
  phase: number
}

/** Point along a polyline at t in [0, 1] (linear between points). */
function along(path: Path, t: number): [number, number] {
  const f = t * (path.length - 1)
  const i = Math.min(path.length - 2, Math.floor(f))
  const k = f - i
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]
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

/** Distance from (x, y) to the segment a-b. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  const ex = x - ax - dx * t
  const ey = y - ay - dy * t
  return Math.sqrt(ex * ex + ey * ey)
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Bake the emission clouds and bright rims (two bitmaps of the same size):
 * fractal noise, domain-warped for a turbulent look, masked to the area
 * around the cloud paths, colored along a noise ramp, with dark dust lanes
 * where a ridged noise peaks.
 */
function bakeClouds(width: number, height: number, margin: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const scale = Math.max(CLOUD_SCALE, Math.min(0.5, MIN_CLOUD_PIXELS / width))
  const cw = Math.max(1, Math.ceil((width + margin * 2) * scale))
  const ch = Math.max(1, Math.ceil((height + margin * 2) * scale))
  const cloud = makeCanvas(cw, ch)
  const rims = makeCanvas(cw, ch)
  const cctx = cloud.getContext('2d')
  const rctx = rims.getContext('2d')
  if (!cctx || !rctx) return [cloud, rims]
  const cImg = cctx.createImageData(cw, ch)
  const rImg = rctx.createImageData(cw, ch)
  const n1 = createValueNoise(2721)
  const n2 = createValueNoise(2722)
  const n3 = createValueNoise(2723)
  const unit = Math.sqrt(width * height)
  /** Noise units per CSS pixel: features about a sixth of the screen across. */
  const freq = 6 / unit
  const reach = unit * 0.2
  // Path segments in CSS pixels, with their weight.
  const segments: [number, number, number, number, number][] = []
  PATHS.forEach((path, p) => {
    for (let i = 0; i < path.length - 1; i++) {
      segments.push([
        path[i][0] * width,
        path[i][1] * height,
        path[i + 1][0] * width,
        path[i + 1][1] * height,
        PATH_WEIGHT[p],
      ])
    }
  })
  const distances = new Float64Array(segments.length)
  const last = EMISSION_RAMP.length - 1
  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      const x = px / scale - margin
      const y = py / scale - margin
      const nx = x * freq
      const ny = y * freq
      // Distances first (cheap): skip pixels far from every path before any noise.
      let near = false
      for (let s = 0; s < segments.length; s++) {
        const [ax, ay, bx, by] = segments[s]
        distances[s] = segmentDistance(x, y, ax, ay, bx, by)
        if (distances[s] < reach * 2.6) near = true
      }
      if (!near) continue
      // Domain warp: offset the lookup by another noise for swirls.
      const wx = nx + 1.8 * fbm(n2, nx + 5.2, ny + 1.3, 3)
      const wy = ny + 1.8 * fbm(n2, nx + 1.7, ny + 9.2, 3)
      const n = fbm(n1, wx, wy, 4)
      // Mask: close to a path, with a ragged edge.
      let mask = 0
      for (let s = 0; s < segments.length; s++) {
        const d = Math.max(0, distances[s] + (n - 0.5) * reach * 1.6)
        mask = Math.max(mask, segments[s][4] * Math.exp(-(d * d) / (reach * reach)))
      }
      if (mask < 0.01) continue
      const density = smoothstep(0.36, 0.68, n) * mask
      // Dust lanes along a ridged noise.
      const ridge = 1 - Math.abs(fbm(n3, nx + 20, ny, 3) * 2 - 1)
      const dust = 1 - 0.7 * smoothstep(0.74, 0.96, ridge)
      // Color along the ramp from a slow noise.
      const c = Math.max(0, Math.min(0.999, (fbm(n3, wx * 0.5 + 40, wy * 0.5 - 7, 2) - 0.3) * 1.8)) * last
      const k = Math.floor(c)
      const f = c - k
      const a = EMISSION_RAMP[k]
      const b = EMISSION_RAMP[Math.min(last, k + 1)]
      const i = (py * cw + px) * 4
      cImg.data[i] = a[0] + (b[0] - a[0]) * f
      cImg.data[i + 1] = a[1] + (b[1] - a[1]) * f
      cImg.data[i + 2] = a[2] + (b[2] - a[2]) * f
      cImg.data[i + 3] = 255 * Math.min(1, Math.pow(density, 1.2) * 0.95 * dust)
      // Bright rims: the densest bits, pale and tinted toward the cloud color.
      const rim = smoothstep(0.6, 0.75, n) * mask * dust
      if (rim > 0) {
        rImg.data[i] = 255
        rImg.data[i + 1] = 200 + (a[1] / 255) * 55
        rImg.data[i + 2] = 215 + (a[2] / 255) * 40
        rImg.data[i + 3] = 255 * rim * 0.7
      }
    }
  }
  cctx.putImageData(cImg, 0, 0)
  rctx.putImageData(rImg, 0, 0)
  return [cloud, rims]
}

/**
 * The cloud bake is the slow part of this scene (tens of ms on a phone), so
 * the last result is kept for the same viewport size: coming back to the
 * page doesn't bake again. Two small low-res bitmaps, well under 1 MB.
 */
let cloudCache: { key: string; bitmaps: [HTMLCanvasElement, HTMLCanvasElement] } | null = null

function cachedClouds(width: number, height: number, margin: number) {
  const key = `${width}x${height}`
  if (cloudCache?.key !== key) cloudCache = { key, bitmaps: bakeClouds(width, height, margin) }
  return cloudCache.bitmaps
}

function createNebula(setup: SceneSetup) {
  // Stars only: this scene draws its own, richer clouds.
  const stars = createStarfield(setup, { seed: 272, density: 0.9, nebulaColors: [] })
  const glowDots = GLOW_COLORS.map((c) => makeSoftDot(c, 64))

  let layers: CloudLayer[] = []
  let youngStars: YoungStar[] = []
  let spikeStar: HTMLCanvasElement | null = null
  let margin = 0

  /** Broad background glow: big soft blobs along the paths. */
  function bakeGlow(width: number, height: number, random: () => number) {
    const unit = Math.sqrt(width * height)
    const canvas = makeCanvas((width + margin * 2) * GLOW_SCALE, (height + margin * 2) * GLOW_SCALE)
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    ctx.scale(GLOW_SCALE, GLOW_SCALE)
    ctx.translate(margin, margin)
    PATHS.forEach((path, p) => {
      const n = Math.round(40 * PATH_WEIGHT[p])
      for (let i = 0; i < n; i++) {
        const [fx, fy] = along(path, random())
        const x = fx * width + spread(random) * unit * 0.2
        const y = fy * height + spread(random) * unit * 0.2
        const s = between(random, 0.12, 0.26) * unit
        ctx.globalAlpha = between(random, 0.1, 0.22) * PATH_WEIGHT[p]
        ctx.drawImage(glowDots[Math.floor(random() * glowDots.length)], x - s, y - s, s * 2, s * 2)
      }
    })
    return canvas
  }

  function build({ width, height }: SceneSize) {
    const random = createRandom(2720)
    const unit = Math.sqrt(width * height)
    margin = Math.round(Math.max(width, height) * 0.08)
    const glow = bakeGlow(width, height, random)
    const [cloud, rims] = cachedClouds(width, height, margin)
    const cloudPhase = random() * 6
    layers = [
      { canvas: glow, parallax: 0.01, sx: 0.006, sy: 0.004, phase: random() * 6, breathe: 0 },
      { canvas: cloud, parallax: 0.025, sx: -0.008, sy: 0.005, phase: cloudPhase, breathe: 0 },
      // Rims ride exactly on the clouds and slowly brighten and dim.
      { canvas: rims, parallax: 0.025, sx: -0.008, sy: 0.005, phase: cloudPhase, breathe: 0.12 },
    ]

    spikeStar = makeSpikeStar(56)
    youngStars = Array.from({ length: 5 }, (_, i) => {
      const [fx, fy] = along(PATHS[i < 3 ? 0 : 1], between(random, 0.15, 0.85))
      return {
        x: fx * width + spread(random) * unit * 0.04,
        y: fy * height + spread(random) * unit * 0.04,
        size: between(random, 26, 48) * Math.min(1, unit / 800 + 0.3),
        speed: between(random, 0.2, 0.45),
        phase: random() * Math.PI * 2,
      }
    })
  }

  build(setup)

  function draw(frame: SceneFrame) {
    const { ctx, width, height, time, scrollY } = frame
    for (const l of layers) {
      const dx = Math.sin(time * l.sx * Math.PI * 2 + l.phase) * margin * 0.6
      const dy = Math.cos(time * l.sy * Math.PI * 2 + l.phase) * margin * 0.5
      const py = Math.min(scrollY * l.parallax, margin * 0.4)
      ctx.globalAlpha = l.breathe ? 0.6 + 0.4 * Math.sin(time * l.breathe + l.phase) : 1
      ctx.drawImage(l.canvas, -margin + dx, -margin + dy - py, width + margin * 2, height + margin * 2)
    }
    ctx.globalAlpha = 1
    stars.draw(frame)
    const cloud = layers[1]
    if (spikeStar && cloud) {
      // Young stars sit in the clouds and move with them.
      const py = Math.min(scrollY * cloud.parallax, margin * 0.4)
      const dx = Math.sin(time * cloud.sx * Math.PI * 2 + cloud.phase) * margin * 0.6
      const dy = Math.cos(time * cloud.sy * Math.PI * 2 + cloud.phase) * margin * 0.5
      for (const s of youngStars) {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * s.speed + s.phase)
        ctx.drawImage(spikeStar, s.x + dx - s.size / 2, s.y + dy - py - s.size / 2, s.size, s.size)
      }
      ctx.globalAlpha = 1
    }
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      build(next)
    },
    dispose() {
      stars.dispose?.()
      layers = []
      youngStars = []
      spikeStar = null
    },
  }
}

export const nebulaScene: Scene = {
  id: 'nebula',
  create: createNebula,
}
