import { runToEnd } from './build'
import { makeCanvas, makeSoftDot, rgba, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneBuild, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * About scene (S27): a close view of a star. A large sun sits on the right
 * edge, mostly off-screen, so its limb curves down the side of the page and
 * frames the text instead of sitting behind it. Its surface shimmers
 * (granulation that slowly boils), soft prominences rise and fade on the
 * visible limb, and the corona breathes. Drawn over a sparse, warm starfield.
 *
 * Cost per frame: the starfield, the corona, the disk, two granulation
 * layers, two flare glows and a few prominence sprites. Every gradient and
 * path is baked on create/resize.
 *
 * The bake takes about 80-100 ms at 375px on a 4x throttled CPU, mostly the
 * thousands of granulation cells, so `create` is a generator (S31, see
 * "Heavy setup" in `types.ts`): it yields between sprites and every few
 * hundred cells, and the engine spreads the work over frames. `resize` runs
 * the same bake to the end at once with `runToEnd`.
 */

/** Sun color from the `sun` palette (#fbbf4d). */
const SUN: Rgb = [251, 191, 77]
const PARALLAX = 0.03
const MAX_PARALLAX = 40
/** Prominence sprite padding (for the glow) and where the feet sit within it, as fractions. */
const PROMINENCE_PAD = 0.6
const FOOT = 0.4
/** Granulation cells stamped between yields (each slice stays well under 5 ms on a slow phone). */
const CELLS_PER_SLICE = 200

interface Layout {
  cx: number
  cy: number
  r: number
}

/**
 * Desktop: center just past the right edge at about a third of the height,
 * so a crescent of the disk shows. Mobile: the top-right corner.
 */
function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    const r = Math.max(120, width * 0.5)
    return { cx: width + r * 0.08, cy: height * 0.07, r }
  }
  const r = Math.max(180, Math.min(width * 0.3, height * 0.45))
  return { cx: width + r * 0.4, cy: height * 0.36, r }
}

/** Prominences on the visible limb: angle (deg, 90 = down, 180 = left), size, timing. */
const PROMINENCES = [
  { angle: 122, width: 0.3, height: 0.15, speed: 0.11, phase: 0.6 },
  { angle: 146, width: 0.22, height: 0.11, speed: 0.08, phase: 2.2 },
  { angle: 168, width: 0.36, height: 0.19, speed: 0.06, phase: 1.1 },
  { angle: 191, width: 0.2, height: 0.12, speed: 0.1, phase: 2.8 },
  { angle: 214, width: 0.28, height: 0.14, speed: 0.07, phase: 0.2 },
] as const

/** Bright flare patches near the limb: angle (deg), distance from center (r), pulse. */
const FLARES = [
  { angle: 150, dist: 0.86, size: 0.16, speed: 0.13, phase: 0.4 },
  { angle: 198, dist: 0.8, size: 0.12, speed: 0.09, phase: 2 },
] as const

/** Corona glow with faint streamers, larger than the disk. */
function makeCorona(r: number, random: () => number): HTMLCanvasElement {
  const outer = r * 2.1
  const canvas = makeCanvas(outer * 2, outer * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createRadialGradient(outer, outer, r * 0.95, outer, outer, outer)
  g.addColorStop(0, 'rgb(255 205 120 / 0.6)')
  g.addColorStop(0.08, 'rgb(250 160 70 / 0.3)')
  g.addColorStop(0.3, 'rgb(240 120 50 / 0.1)')
  g.addColorStop(0.65, 'rgb(220 90 40 / 0.03)')
  g.addColorStop(1, 'rgb(220 90 40 / 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, outer * 2, outer * 2)
  // Streamers: long soft blobs pointing outward.
  const dot = makeSoftDot([255, 200, 120], 64)
  ctx.globalCompositeOperation = 'lighter'
  ctx.translate(outer, outer)
  for (let i = 0; i < 16; i++) {
    ctx.save()
    ctx.rotate(random() * Math.PI * 2)
    ctx.globalAlpha = between(random, 0.05, 0.13)
    const len = r * between(random, 0.5, 1)
    const w = r * between(random, 0.12, 0.3)
    ctx.drawImage(dot, r * 0.85, -w / 2, len, w)
    ctx.restore()
  }
  return canvas
}

/** Disk: limb darkening toward orange, faint mottling and a sunspot group. */
function makeDisk(r: number, random: () => number): HTMLCanvasElement {
  const canvas = makeCanvas(r * 2, r * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, 'rgb(255 238 190)')
  g.addColorStop(0.55, 'rgb(255 208 115)')
  g.addColorStop(0.85, rgba(SUN, 1))
  g.addColorStop(0.97, 'rgb(232 120 42)')
  g.addColorStop(1, 'rgb(205 90 34)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, r * 2, r * 2)
  // Large, faint orange mottling (supergranulation).
  const mottle = makeSoftDot([220, 110, 40], 64)
  for (let i = 0; i < 70; i++) {
    const a = random() * Math.PI * 2
    const d = Math.sqrt(random()) * r
    const s = r * between(random, 0.12, 0.28)
    ctx.globalAlpha = between(random, 0.05, 0.14)
    ctx.drawImage(mottle, r + Math.cos(a) * d - s / 2, r + Math.sin(a) * d - s / 2, s, s)
  }
  // A sunspot group on the visible side: penumbra, then umbra.
  ctx.globalAlpha = 1
  const spots = [
    [158, 0.55, 0.06],
    [163, 0.6, 0.035],
    [152, 0.5, 0.025],
  ] as const
  for (const [deg, dist, size] of spots) {
    const a = (deg * Math.PI) / 180
    const x = r + Math.cos(a) * dist * r
    const y = r + Math.sin(a) * dist * r
    const s = size * r
    const pen = ctx.createRadialGradient(x, y, 0, x, y, s * 1.9)
    pen.addColorStop(0, 'rgb(90 35 15 / 0.9)')
    pen.addColorStop(0.4, 'rgb(150 70 25 / 0.65)')
    pen.addColorStop(1, 'rgb(190 100 40 / 0)')
    ctx.fillStyle = pen
    ctx.fillRect(x - s * 2, y - s * 2, s * 4, s * 4)
  }
  return canvas
}

/** Granulation: many small bright cells, fading out toward the limb. Yields every `CELLS_PER_SLICE` cells. */
function* makeGranulation(
  r: number,
  random: () => number,
  dot: HTMLCanvasElement,
): Generator<unknown, HTMLCanvasElement, undefined> {
  const canvas = makeCanvas(r * 2, r * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const cell = Math.max(3, r * 0.03)
  const count = Math.min(5000, Math.round((Math.PI * r * r) / (cell * cell) * 0.8))
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2
    const d = Math.sqrt(random()) * r
    const s = cell * between(random, 1.2, 2.2)
    ctx.globalAlpha = between(random, 0.1, 0.38)
    ctx.drawImage(dot, r + Math.cos(a) * d - s / 2, r + Math.sin(a) * d - s / 2, s, s)
    if (i % CELLS_PER_SLICE === CELLS_PER_SLICE - 1) yield
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'destination-in'
  const mask = ctx.createRadialGradient(r, r, 0, r, r, r)
  mask.addColorStop(0, 'rgb(0 0 0 / 1)')
  mask.addColorStop(0.8, 'rgb(0 0 0 / 0.7)')
  mask.addColorStop(0.97, 'rgb(0 0 0 / 0.1)')
  mask.addColorStop(1, 'rgb(0 0 0 / 0)')
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, r * 2, r * 2)
  return canvas
}

/** A prominence: glowing loops rising from the limb. Base at the bottom center. */
function makeProminence(w: number, h: number, random: () => number): HTMLCanvasElement {
  const pad = h * PROMINENCE_PAD
  const canvas = makeCanvas(w + pad * 2, h + pad * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.globalCompositeOperation = 'lighter'
  const baseY = canvas.height - pad * FOOT
  const cx = canvas.width / 2
  // Soft glow at the foot.
  const foot = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, w * 0.6)
  foot.addColorStop(0, 'rgb(255 170 90 / 0.35)')
  foot.addColorStop(1, 'rgb(255 120 60 / 0)')
  ctx.fillStyle = foot
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  // Two plasma arches, blurred with a shadow so they glow instead of reading as wire.
  ctx.shadowColor = 'rgb(255 110 50)'
  ctx.shadowBlur = Math.max(6, h * 0.5)
  for (let k = 0; k < 2; k++) {
    const half = (w / 2) * between(random, 0.6, 1)
    const top = h * between(random, 0.65, 1)
    const off = between(random, -0.1, 0.1) * w
    const lean = between(random, -0.35, 0.35) * half
    ctx.beginPath()
    ctx.moveTo(cx + off - half, baseY)
    ctx.bezierCurveTo(
      cx + off - half * 0.6 + lean,
      baseY - top * 1.1,
      cx + off + half * 0.6 + lean,
      baseY - top * 1.1,
      cx + off + half,
      baseY,
    )
    ctx.strokeStyle = k === 0 ? 'rgb(255 150 80 / 0.32)' : 'rgb(255 120 60 / 0.22)'
    ctx.lineWidth = Math.max(2, h * (k === 0 ? 0.2 : 0.14))
    ctx.stroke()
  }
  return canvas
}

interface ProminenceSprite {
  canvas: HTMLCanvasElement
  /** Distance from the sprite's bottom edge to the loops' feet, in px. */
  foot: number
  angle: number
  speed: number
  phase: number
}

function* createSun(setup: SceneSetup): SceneBuild {
  const stars = createStarfield(setup, {
    seed: 27,
    density: 0.5,
    nebulaStrength: 0.3,
    nebulaColors: [
      [124, 92, 255],
      [190, 72, 190],
      [235, 150, 80],
    ],
  })
  yield

  let layout = layoutFor(setup)
  let corona: HTMLCanvasElement | null = null
  let disk: HTMLCanvasElement | null = null
  let granA: HTMLCanvasElement | null = null
  let granB: HTMLCanvasElement | null = null
  let flare: HTMLCanvasElement | null = null
  let prominences: ProminenceSprite[] = []

  /**
   * Bake every sprite for a viewport size. Works on locals and only assigns
   * the scene's state at the end, so `draw` never sees a half-built mix of sizes.
   */
  function* build(size: SceneSize): Generator<unknown, void, undefined> {
    const nextLayout = layoutFor(size)
    const random = createRandom(2701)
    const { r } = nextLayout
    const nextCorona = makeCorona(r, random)
    yield
    const nextDisk = makeDisk(r, random)
    yield
    const cellDot = makeSoftDot([255, 246, 215], 16)
    const nextGranA = yield* makeGranulation(r, random, cellDot)
    yield
    const nextGranB = yield* makeGranulation(r, random, cellDot)
    yield
    const nextFlare = makeSoftDot([255, 250, 230], 64, 0.15)
    const nextProminences: ProminenceSprite[] = []
    for (const p of PROMINENCES) {
      const w = p.width * r
      const h = p.height * r
      const canvas = makeProminence(w, h, random)
      nextProminences.push({
        canvas,
        foot: h * PROMINENCE_PAD * FOOT,
        angle: (p.angle * Math.PI) / 180,
        speed: p.speed,
        phase: p.phase,
      })
      yield
    }
    layout = nextLayout
    corona = nextCorona
    disk = nextDisk
    granA = nextGranA
    granB = nextGranB
    flare = nextFlare
    prominences = nextProminences
  }

  yield* build(setup)

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    if (!corona || !disk || !granA || !granB || !flare) return
    const { ctx, time, scrollY, dpr } = frame
    const { r } = layout
    // Big sprites are blitted 1:1 at whole device pixels: scaling or
    // sub-pixel offsets made the corona the most expensive draw on phones.
    const snap = (v: number) => Math.round(v * dpr) / dpr
    const cx = snap(layout.cx)
    const cy = snap(layout.cy - Math.min(scrollY * PARALLAX, MAX_PARALLAX))

    // Corona breathes slowly (in brightness, not size).
    const c = corona.width / 2
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(time * 0.3)
    ctx.drawImage(corona, snap(cx - c), snap(cy - c))
    ctx.globalAlpha = 1

    ctx.drawImage(disk, snap(cx - r), snap(cy - r))
    // Shimmer: two granulation patterns crossfade and shift by a pixel now and then.
    const mix = 0.5 + 0.5 * Math.sin(time * 0.45)
    ctx.globalAlpha = 0.35 + 0.65 * mix
    ctx.drawImage(granA, snap(cx - r + Math.sin(time * 0.21)), snap(cy - r + Math.cos(time * 0.17)))
    ctx.globalAlpha = 1 - 0.65 * mix
    ctx.drawImage(granB, snap(cx - r - Math.sin(time * 0.19)), snap(cy - r + Math.sin(time * 0.23)))

    // Flares: soft bright patches near the limb that swell and fade.
    for (const f of FLARES) {
      const a = (f.angle * Math.PI) / 180
      const pulse = 0.5 + 0.5 * Math.sin(time * f.speed + f.phase)
      const s = f.size * r * (0.85 + 0.3 * pulse)
      ctx.globalAlpha = 0.15 + 0.4 * pulse
      ctx.drawImage(flare, cx + Math.cos(a) * f.dist * r - s / 2, cy + Math.sin(a) * f.dist * r - s / 2, s, s)
    }

    // Prominences: loops on the limb, slowly rising and fading.
    for (const p of prominences) {
      const wave = Math.sin(time * p.speed + p.phase)
      ctx.globalAlpha = 0.55 + 0.4 * wave
      const sy = 1 + 0.1 * wave
      const w = p.canvas.width
      const h = p.canvas.height * sy
      ctx.save()
      ctx.translate(cx + Math.cos(p.angle) * r, cy + Math.sin(p.angle) * r)
      ctx.rotate(p.angle + Math.PI / 2)
      // Feet sit slightly inside the limb.
      ctx.drawImage(p.canvas, -w / 2, -h + p.foot * sy + r * 0.015, w, h)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      runToEnd(build(next))
    },
    dispose() {
      stars.dispose?.()
      corona = disk = granA = granB = flare = null
      prominences = []
    },
  }
}

export const sunScene: Scene = {
  id: 'sun',
  create: createSun,
}
