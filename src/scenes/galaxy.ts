import { makeCanvas, makeSoftDot, spread, type Rgb } from './canvas'
import { createDiskStars, type DiskStars, type StarSeed } from './galaxyStars'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Contact scene (S27, swirling since V0.39): a quiet starfield with a spiral
 * galaxy. Two arms of blue-white stars with pink star-forming knots and dark
 * dust lanes wind out of a warm core. The galaxy is tilted and sits right of
 * the contact text on desktop, below it on mobile. A small companion galaxy
 * and two faint background smudges add depth.
 *
 * Motion (V0.39): the spiral pattern (arm glow, knots, dust) turns rigidly
 * once every `PATTERN_PERIOD` seconds, while the stars orbit on their own,
 * faster toward the core. The arms are a density wave that the stars stream
 * through, so they never wind up; see `galaxyStars.ts`.
 *
 * Layers, back to front: starfield, smudges, the baked glow texture
 * (`makeGlow`, drawn in `drawGlow`), then the live stars (`createDiskStars`).
 * For V0.40, core breathing fits in `drawGlow` (e.g. a core sprite with a
 * time-based alpha) and star twinkle in `galaxyStars.ts` (a per-star factor
 * on the light in `splat`).
 *
 * Cost per frame: the starfield, three tiny sprites, one transformed draw of
 * the glow texture (as in S27), a third of the ~4 600 stars splatted into a
 * pixel buffer and one draw of that buffer.
 */

/** Tilt of the galaxy disk (vertical squash) and rotation of its plane. */
const TILT = 0.48
const PLANE_ANGLE = -0.42
/** Rotation of the galaxy inside its plane at time 0 (the S27 still frame). */
const START_ANGLE = 1.3
/** Seconds per turn of the arm pattern; outer stars move with it. */
const PATTERN_PERIOD = 90
const PATTERN_SPIN = (Math.PI * 2) / PATTERN_PERIOD
/**
 * Rotation curve softening: orbit speed is PATTERN_SPIN * (1 + S) / (r + S),
 * so a star at the edge (r = 1) keeps pace with the arms, one at r = 0.15
 * turns ~4x faster and the inner bulge ~6x (about 15 s per turn).
 */
const SOFTENING = 0.15
const PARALLAX = 0.025
const MAX_PARALLAX = 30
const ARMS = 2
/** Arm winding: the arm reaches the edge after this many radians. */
const ARM_TURN = Math.PI * 3
/** Log spiral of the arms: radius ARM_R0 * e^(ARM_B * theta), reaching 0.95 at ARM_TURN. */
const ARM_R0 = 0.09
const ARM_B = Math.log(0.95 / ARM_R0) / ARM_TURN
/** Live stars per arm. */
const ARM_STARS = 1500

interface Layout {
  cx: number
  cy: number
  r: number
}

/**
 * Where the galaxy sits. The whole tilted disk (radius 1.05r) sweeps through
 * every orientation as it turns, so its outline, not just the time-0 frame,
 * has to stay clear of the text. Phones: below the contact panel and above
 * the footer text (0.75 instead of S27's 0.76 so the arm tips clear the
 * footer at 375x812). Tablet and up: right of the panel.
 */
function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    return { cx: width * 0.6, cy: height * 0.75, r: Math.max(110, width * 0.44) }
  }
  return { cx: width * 0.76, cy: height * 0.46, r: Math.max(150, Math.min(width * 0.2, height * 0.36)) }
}

/** Arm radius (as a fraction of the galaxy radius) at winding angle theta. */
function armRadius(theta: number) {
  return ARM_R0 * Math.exp(ARM_B * theta)
}

/** Winding angle at which the arm centre line reaches `radius`. */
function armTheta(radius: number) {
  return Math.log(radius / ARM_R0) / ARM_B
}

/**
 * Face-on glow texture, radius r, centered in a 2.5r square: disk glow, warm
 * core, soft arm glow, pink knots and dust lanes. Everything here turns
 * rigidly with the arm pattern; the stars are drawn live (`starSeeds`).
 */
function makeGlow(r: number, random: () => number): HTMLCanvasElement {
  const half = r * 1.25
  const canvas = makeCanvas(half * 2, half * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.translate(half, half)
  // Overall disk glow and warm core.
  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  disk.addColorStop(0, 'rgb(255 238 210 / 0.85)')
  disk.addColorStop(0.05, 'rgb(255 218 170 / 0.5)')
  disk.addColorStop(0.2, 'rgb(205 200 240 / 0.2)')
  disk.addColorStop(0.55, 'rgb(150 170 240 / 0.07)')
  disk.addColorStop(1, 'rgb(150 170 240 / 0)')
  ctx.fillStyle = disk
  ctx.fillRect(-r, -r, r * 2, r * 2)

  ctx.globalCompositeOperation = 'lighter'
  const armGlow = makeSoftDot([150, 175, 255], 64)
  const knot = makeSoftDot([255, 120, 175], 32, 0.15)
  const point = (theta: number, arm: number, jitter: number): [number, number] => {
    const rr = (armRadius(theta) + spread(random) * jitter) * r
    const a = theta + (arm * Math.PI * 2) / ARMS
    return [Math.cos(a) * rr, Math.sin(a) * rr]
  }
  for (let arm = 0; arm < ARMS; arm++) {
    // Soft arm glow.
    for (let i = 0; i < 70; i++) {
      const theta = (i / 70) * ARM_TURN
      const [x, y] = point(theta, arm, 0.03)
      const s = r * (0.08 + 0.16 * armRadius(theta))
      ctx.globalAlpha = 0.3
      ctx.drawImage(armGlow, x - s, y - s, s * 2, s * 2)
    }
    // Pink star-forming knots.
    for (let i = 0; i < 22; i++) {
      const theta = between(random, 0.25, 0.9) * ARM_TURN
      const [x, y] = point(theta, arm, 0.025)
      const s = between(random, 2.5, 5) * Math.max(1, r / 220)
      ctx.globalAlpha = between(random, 0.55, 0.95)
      ctx.drawImage(knot, x - s, y - s, s * 2, s * 2)
    }
  }
  // Dust lanes along each arm.
  ctx.globalCompositeOperation = 'destination-out'
  const dust = makeSoftDot([0, 0, 0], 32)
  for (let arm = 0; arm < ARMS; arm++) {
    for (let i = 0; i < 90; i++) {
      const theta = between(random, 0.22, 0.8) * ARM_TURN
      const [x, y] = point(theta - 0.3, arm, 0.012)
      const s = r * 0.035
      ctx.globalAlpha = 0.16
      ctx.drawImage(dust, x - s, y - s, s * 2, s * 2)
    }
  }
  // Fade the outer edge so the square texture never shows.
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'destination-in'
  const edge = ctx.createRadialGradient(0, 0, r * 0.85, 0, 0, half)
  edge.addColorStop(0, 'rgb(0 0 0 / 1)')
  edge.addColorStop(1, 'rgb(0 0 0 / 0)')
  ctx.fillStyle = edge
  ctx.fillRect(-half, -half, half * 2, half * 2)
  return canvas
}

/** The glow texture's edge fade (1 inside 0.85r, 0 at 1.25r), for live stars. */
function edgeFade(radius: number) {
  return Math.min(1, Math.max(0, (1.25 - radius) / 0.4))
}

/**
 * Star seeds with the same counts, colors and spread as the S27 baked stars:
 * 1 500 per arm, 700 bulge and 900 inter-arm disk stars. Arm stars get a
 * window around their arm instead of a radial jitter, see `galaxyStars.ts`.
 */
function starSeeds(random: () => number): StarSeed[] {
  const seeds: StarSeed[] = []
  for (let arm = 0; arm < ARMS; arm++) {
    for (let i = 0; i < ARM_STARS; i++) {
      // Denser toward the inside, as before.
      const theta = Math.pow(random(), 0.85) * ARM_TURN
      const center = armRadius(theta)
      // S27 jittered arm stars radially by +-jitter. Express that spread as an
      // angle along the arm (dr = ARM_B * r * dtheta), matched to the bell's
      // spread, capped at half the gap between arms.
      const jitter = 0.04 + 0.06 * center
      const radius = Math.max(0.02, center + spread(random) * jitter * 0.25)
      const width = Math.min(Math.PI / ARMS, (0.88 * jitter) / (ARM_B * Math.max(radius, ARM_R0)))
      seeds.push({
        radius,
        base: armTheta(Math.max(radius, ARM_R0)) + (arm * Math.PI * 2) / ARMS,
        delta: between(random, -width, width),
        width,
        alpha: between(random, 0.5, 1) * edgeFade(radius),
        color: random() < 0.75 ? 0 : 1,
        size: random() < 0.12 ? 1.5 : 1,
      })
    }
  }
  // Bulge.
  for (let i = 0; i < 700; i++) {
    seeds.push({
      radius: Math.abs(spread(random)) * 0.16,
      base: random() * Math.PI * 2,
      delta: 0,
      width: 0,
      alpha: between(random, 0.3, 0.8),
      color: 2,
      size: 1,
    })
  }
  // Inter-arm disk.
  for (let i = 0; i < 900; i++) {
    seeds.push({
      radius: Math.sqrt(random()) * 0.85,
      base: random() * Math.PI * 2,
      delta: 0,
      width: 0,
      alpha: between(random, 0.15, 0.45),
      color: 3,
      size: 1,
    })
  }
  return seeds
}

/** Small elliptical smudge for faint background galaxies. */
function makeSmudge(color: Rgb): HTMLCanvasElement {
  return makeSoftDot(color, 32, 0.08)
}

interface Smudge {
  sprite: HTMLCanvasElement
  x: number
  y: number
  w: number
  h: number
  angle: number
  alpha: number
}

function createGalaxy(setup: SceneSetup) {
  const stars = createStarfield(setup, {
    seed: 273,
    density: 0.7,
    nebulaStrength: 0.25,
    nebulaColors: [[64, 96, 230]],
  })

  let layout = layoutFor(setup)
  let texture: HTMLCanvasElement | null = null
  let smudges: Smudge[] = []
  // Seeds are in galaxy units (radius 0..1), so a resize doesn't rebuild them.
  const diskStars: DiskStars = createDiskStars(starSeeds(createRandom(2731)), {
    patternSpin: PATTERN_SPIN,
    outerSpin: PATTERN_SPIN,
    softening: SOFTENING,
  })

  function build(size: SceneSize) {
    layout = layoutFor(size)
    const random = createRandom(2730)
    texture = makeGlow(layout.r, random)
    const { width, height } = size
    const { cx, cy, r } = layout
    const warm = makeSmudge([255, 225, 190])
    const cool = makeSmudge([200, 210, 255])
    smudges = [
      // Companion galaxy, near the main disk.
      { sprite: warm, x: cx - r * 0.95, y: cy - r * 0.55, w: r * 0.13, h: r * 0.08, angle: 0.5, alpha: 0.7 },
      // Faint background galaxies.
      { sprite: cool, x: width * 0.12, y: height * 0.92, w: 14, h: 6, angle: -0.6, alpha: 0.6 },
      { sprite: warm, x: width * 0.94, y: height * 0.1, w: 10, h: 5, angle: 0.9, alpha: 0.55 },
    ]
  }

  build(setup)

  /** The glow texture, turning rigidly with the arm pattern. */
  function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
    if (!texture) return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(PLANE_ANGLE)
    ctx.scale(1, TILT)
    ctx.rotate(START_ANGLE - time * PATTERN_SPIN)
    ctx.drawImage(texture, -texture.width / 2, -texture.height / 2)
    ctx.restore()
  }

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    if (!texture) return
    const { ctx, time, scrollY } = frame
    const shift = Math.min(scrollY * PARALLAX, MAX_PARALLAX)
    for (const s of smudges) {
      ctx.save()
      ctx.globalAlpha = s.alpha
      ctx.translate(s.x, s.y - shift * 0.6)
      ctx.rotate(s.angle)
      ctx.drawImage(s.sprite, -s.w, -s.h, s.w * 2, s.h * 2)
      ctx.restore()
    }
    const { cx, cy, r } = layout
    drawGlow(ctx, cx, cy - shift, time)
    diskStars.draw(
      ctx,
      { cx, cy: cy - shift, r, tilt: TILT, planeAngle: PLANE_ANGLE, startAngle: START_ANGLE },
      time,
      frame.reducedMotion || frame.dt === 0,
    )
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      build(next)
    },
    dispose() {
      stars.dispose?.()
      diskStars.dispose()
      texture = null
      smudges = []
    },
  }
}

export const galaxyScene: Scene = {
  id: 'galaxy',
  create: createGalaxy,
}
