import { makeCanvas } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * 404 scene (S27): lost in space. A sparse, dim starfield, a handful of rock
 * fragments drifting and tumbling slowly, and a small derelict satellite
 * turning end over end in the lower right, away from the page text.
 *
 * This is the default scene for unmapped routes (see `routes.ts`).
 *
 * Cost per frame: the starfield plus about a dozen small rotated sprites.
 */

const DEBRIS_COUNT = 14
/** Satellite tumble speed, radians per second. */
const TUMBLE = 0.05

interface Debris {
  sprite: HTMLCanvasElement
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  angle: number
  /** 0 = far, 1 = near: scales speed and parallax. */
  depth: number
}

/** Irregular rock lit from the upper left. */
function makeRock(size: number, random: () => number): HTMLCanvasElement {
  const canvas = makeCanvas(size + 2, size + 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = canvas.width / 2
  const r = size / 2
  const points = Math.round(between(random, 6, 10))
  ctx.beginPath()
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const d = r * between(random, 0.55, 1)
    ctx.lineTo(c + Math.cos(a) * d, c + Math.sin(a) * d)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(c - r, c - r, c + r, c + r)
  g.addColorStop(0, 'rgb(200 190 180)')
  g.addColorStop(0.5, 'rgb(120 112 108)')
  g.addColorStop(1, 'rgb(40 38 44)')
  ctx.fillStyle = g
  ctx.fill()
  if (size > 6) {
    ctx.fillStyle = 'rgb(30 28 34 / 0.5)'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(c + between(random, -0.4, 0.4) * r, c + between(random, -0.4, 0.4) * r, r * between(random, 0.08, 0.18), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}

/** Derelict satellite: gold-foil body, two solar panels, a dish. Centered. */
function makeSatellite(s: number): HTMLCanvasElement {
  const canvas = makeCanvas(s * 2.8, s * 1.4)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  // Struts.
  ctx.strokeStyle = 'rgb(170 170 180)'
  ctx.lineWidth = Math.max(1, s * 0.04)
  ctx.beginPath()
  ctx.moveTo(cx - s * 1.3, cy)
  ctx.lineTo(cx + s * 1.3, cy)
  ctx.stroke()
  // Solar panels with a grid.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - s * 1.38 : cx + s * 0.48
    const w = s * 0.9
    const h = s * 0.5
    const g = ctx.createLinearGradient(x0, cy - h / 2, x0 + w, cy + h / 2)
    g.addColorStop(0, 'rgb(80 110 200)')
    g.addColorStop(1, 'rgb(30 40 100)')
    ctx.fillStyle = g
    ctx.fillRect(x0, cy - h / 2, w, h)
    ctx.strokeStyle = 'rgb(150 175 240 / 0.55)'
    ctx.lineWidth = Math.max(0.5, s * 0.02)
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(x0 + (w * i) / 4, cy - h / 2)
      ctx.lineTo(x0 + (w * i) / 4, cy + h / 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(x0, cy)
    ctx.lineTo(x0 + w, cy)
    ctx.stroke()
  }
  // Body: gold foil.
  const bw = s * 0.62
  const bh = s * 0.7
  const foil = ctx.createLinearGradient(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
  foil.addColorStop(0, 'rgb(255 225 140)')
  foil.addColorStop(0.45, 'rgb(220 165 60)')
  foil.addColorStop(1, 'rgb(110 70 25)')
  ctx.fillStyle = foil
  ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh)
  // Dish on top, and a thin antenna.
  ctx.fillStyle = 'rgb(225 225 235)'
  ctx.beginPath()
  ctx.ellipse(cx, cy - bh / 2 - s * 0.08, s * 0.26, s * 0.1, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgb(200 200 210)'
  ctx.lineWidth = Math.max(0.6, s * 0.025)
  ctx.beginPath()
  ctx.moveTo(cx + bw * 0.3, cy + bh / 2)
  ctx.lineTo(cx + bw * 0.55, cy + bh / 2 + s * 0.35)
  ctx.stroke()
  return canvas
}

function createLostInSpace(setup: SceneSetup) {
  const stars = createStarfield(setup, {
    seed: 404,
    density: 0.35,
    nebulaStrength: 0.25,
    nebulaColors: [[70, 60, 160]],
  })

  let debris: Debris[] = []
  let satellite: HTMLCanvasElement | null = null
  let sat = { x: 0, y: 0, size: 0 }
  let margin = 0

  function build({ width, height }: SceneSize) {
    const random = createRandom(4040)
    const mobile = width < 768
    margin = 30
    debris = Array.from({ length: DEBRIS_COUNT }, (_, i) => {
      const depth = random()
      const size = i < 2 ? (mobile ? 13 : 19) - i * 4 : 3 + depth * depth * (mobile ? 8 : 12)
      const speed = 1.5 + depth * 5
      const dir = between(random, Math.PI * 0.85, Math.PI * 1.25)
      return {
        sprite: makeRock(size, random),
        // Start mostly away from the top-left text block.
        x: between(random, 0.25, 1) * width,
        y: between(random, 0.15, 1) * height,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        spin: between(random, -0.25, 0.25),
        angle: random() * Math.PI * 2,
        depth,
      }
    })
    const size = mobile ? 24 : 38
    satellite = makeSatellite(size)
    sat = mobile ? { x: width * 0.72, y: height * 0.74, size } : { x: width * 0.78, y: height * 0.66, size }
  }

  build(setup)

  function wrap(value: number, min: number, max: number) {
    const span = max - min
    return ((((value - min) % span) + span) % span) + min
  }

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    const { ctx, time, scrollY, width, height } = frame
    for (const d of debris) {
      const x = wrap(d.x + d.vx * time, -margin, width + margin)
      const y = wrap(d.y + d.vy * time - scrollY * (0.02 + 0.06 * d.depth), -margin, height + margin)
      ctx.save()
      ctx.globalAlpha = 0.55 + 0.45 * d.depth
      ctx.translate(x, y)
      ctx.rotate(d.angle + d.spin * time)
      ctx.drawImage(d.sprite, -d.sprite.width / 2, -d.sprite.height / 2)
      ctx.restore()
    }
    if (satellite) {
      // Floats around its spot without leaving the corner, tumbling slowly.
      const x = sat.x + Math.sin(time * 0.011) * width * 0.06
      const y = sat.y + Math.sin(time * 0.017 + 1) * height * 0.04 - Math.min(scrollY * 0.05, 40)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(0.45 + time * TUMBLE)
      ctx.drawImage(satellite, -satellite.width / 2, -satellite.height / 2)
      ctx.restore()
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
      debris = []
      satellite = null
    },
  }
}

export const lostInSpaceScene: Scene = {
  id: 'lost-in-space',
  create: createLostInSpace,
}
