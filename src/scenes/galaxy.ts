import { makeCanvas, makeSoftDot, spread, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Contact scene (S27): a quiet starfield with a distant spiral galaxy that
 * turns very slowly. Two arms of blue-white stars with pink star-forming
 * knots and dark dust lanes wind out of a warm core. The galaxy is tilted
 * and sits right of the contact text on desktop, below it on mobile. A small
 * companion galaxy and two faint background smudges add depth.
 *
 * Cost per frame: the starfield, one transformed draw of the baked face-on
 * galaxy texture, and three tiny sprites. The texture (thousands of star
 * dots) is baked on create/resize.
 */

/** Tilt of the galaxy disk (vertical squash) and rotation of its plane. */
const TILT = 0.48
const PLANE_ANGLE = -0.42
/** Radians per second: about nine minutes per turn. */
const SPIN = 0.012
const PARALLAX = 0.025
const MAX_PARALLAX = 30
const ARMS = 2
/** Arm winding: the arm reaches the edge after this many radians. */
const ARM_TURN = Math.PI * 3

interface Layout {
  cx: number
  cy: number
  r: number
}

function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    return { cx: width * 0.6, cy: height * 0.76, r: Math.max(110, width * 0.44) }
  }
  return { cx: width * 0.76, cy: height * 0.46, r: Math.max(150, Math.min(width * 0.2, height * 0.36)) }
}

/** Arm radius (as a fraction of the galaxy radius) at winding angle theta. */
function armRadius(theta: number) {
  const r0 = 0.09
  const b = Math.log(0.95 / r0) / ARM_TURN
  return r0 * Math.exp(b * theta)
}

/** Face-on galaxy texture, radius r, centered in a 2r square. */
function makeGalaxy(r: number, random: () => number): HTMLCanvasElement {
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
    // Stars along the arm, denser toward the inside.
    for (let i = 0; i < 1500; i++) {
      const theta = Math.pow(random(), 0.85) * ARM_TURN
      const [x, y] = point(theta, arm, 0.04 + 0.06 * armRadius(theta))
      ctx.globalAlpha = between(random, 0.35, 0.9)
      ctx.fillStyle = random() < 0.75 ? 'rgb(205 220 255)' : 'rgb(255 245 230)'
      const s = random() < 0.12 ? 1.6 : 1
      ctx.fillRect(x, y, s, s)
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
  // Bulge and inter-arm disk stars.
  for (let i = 0; i < 700; i++) {
    const rr = Math.abs(spread(random)) * r * 0.16
    const a = random() * Math.PI * 2
    ctx.globalAlpha = between(random, 0.3, 0.8)
    ctx.fillStyle = 'rgb(255 228 190)'
    ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 1, 1)
  }
  for (let i = 0; i < 900; i++) {
    const rr = Math.sqrt(random()) * r * 0.85
    const a = random() * Math.PI * 2
    ctx.globalAlpha = between(random, 0.15, 0.45)
    ctx.fillStyle = 'rgb(210 215 245)'
    ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 1, 1)
  }
  // Dust lanes on the inner edge of each arm.
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

  function build(size: SceneSize) {
    layout = layoutFor(size)
    const random = createRandom(2730)
    texture = makeGalaxy(layout.r, random)
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
    const { cx, cy } = layout
    ctx.save()
    ctx.translate(cx, cy - shift)
    ctx.rotate(PLANE_ANGLE)
    ctx.scale(1, TILT)
    ctx.rotate(1.3 - time * SPIN)
    ctx.drawImage(texture, -texture.width / 2, -texture.height / 2)
    ctx.restore()
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      build(next)
    },
    dispose() {
      stars.dispose?.()
      texture = null
      smudges = []
    },
  }
}

export const galaxyScene: Scene = {
  id: 'galaxy',
  create: createGalaxy,
}
