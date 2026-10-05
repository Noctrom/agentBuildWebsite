import { makeCanvas, rgba, spread, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Projects scene (S27): a few distinct planets drifting at different depths.
 * A large banded gas giant fills the bottom-right corner (near), a ringed ice
 * planet floats top right (middle distance), a cratered rocky world sits on
 * the left edge and a tiny blue planet is far away near the top. All are lit
 * from the upper left. Near planets drift and parallax more than far ones.
 *
 * Cost per frame: the starfield plus one sprite per planet. Each planet
 * (rings, shading and atmosphere included) is baked into a single sprite on
 * create/resize, because nothing moves inside a planet.
 */

type Kind = 'gas' | 'ringed' | 'rocky' | 'ice'

interface PlanetSpec {
  kind: Kind
  /** Center as fractions of the viewport, for mobile and desktop. */
  mobile: { x: number; y: number; r: number }
  desktop: { x: number; y: number; r: number }
  /** 0 = far, 1 = near: scales drift, parallax and speed. */
  depth: number
  /** Drift period in seconds and phase. */
  period: number
  phase: number
}

/**
 * Radii: mobile as a fraction of the width, desktop as a fraction of
 * min(width, height). Positions keep the planets in the corners and margins.
 */
const PLANETS: readonly PlanetSpec[] = [
  {
    kind: 'ice',
    mobile: { x: 0.36, y: 0.075, r: 0.018 },
    desktop: { x: 0.6, y: 0.07, r: 0.011 },
    depth: 0,
    period: 150,
    phase: 0.5,
  },
  {
    kind: 'rocky',
    mobile: { x: 0.025, y: 0.52, r: 0.045 },
    desktop: { x: 0.035, y: 0.6, r: 0.04 },
    depth: 0.3,
    period: 130,
    phase: 2.1,
  },
  {
    kind: 'ringed',
    mobile: { x: 0.83, y: 0.15, r: 0.075 },
    desktop: { x: 0.87, y: 0.22, r: 0.065 },
    depth: 0.55,
    period: 110,
    phase: 4,
  },
  {
    kind: 'gas',
    mobile: { x: 1.02, y: 0.96, r: 0.42 },
    desktop: { x: 0.98, y: 0.95, r: 0.3 },
    depth: 1,
    period: 95,
    phase: 1.2,
  },
]

/** Direction light comes from (upper left), as a unit vector. */
const LIGHT_X = -Math.SQRT1_2
const LIGHT_Y = -Math.SQRT1_2
const RING_TILT = 0.3
const RING_ANGLE = -0.32

/** Day/night shading for a disk of radius r centered at (r, r) on ctx (clip set by caller). */
function shade(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, night = 0.92) {
  // Terminator: dark toward the lower right.
  const g = ctx.createLinearGradient(cx + LIGHT_X * r, cy + LIGHT_Y * r, cx - LIGHT_X * r, cy - LIGHT_Y * r)
  g.addColorStop(0, 'rgb(0 0 0 / 0)')
  g.addColorStop(0.45, 'rgb(0 0 0 / 0.08)')
  g.addColorStop(0.68, 'rgb(0 0 0 / 0.6)')
  g.addColorStop(1, `rgb(0 0 0 / ${night})`)
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // Limb darkening.
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r)
  limb.addColorStop(0, 'rgb(0 0 0 / 0)')
  limb.addColorStop(1, 'rgb(0 0 0 / 0.3)')
  ctx.fillStyle = limb
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // Soft highlight on the lit side.
  const hx = cx + LIGHT_X * r * 0.45
  const hy = cy + LIGHT_Y * r * 0.45
  const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.7)
  hl.addColorStop(0, 'rgb(255 255 255 / 0.16)')
  hl.addColorStop(1, 'rgb(255 255 255 / 0)')
  ctx.fillStyle = hl
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
}

/** Thin atmosphere glow around the lit limb. */
function atmosphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: Rgb, strength: number) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.12)
  g.addColorStop(0, rgba(color, strength))
  g.addColorStop(1, rgba(color, 0))
  ctx.save()
  // Only on the lit half: fade with a linear mask toward the night side.
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2)
  ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  const m = ctx.createLinearGradient(cx + LIGHT_X * r, cy + LIGHT_Y * r, cx - LIGHT_X * r, cy - LIGHT_Y * r)
  m.addColorStop(0.35, 'rgb(0 0 0 / 0)')
  m.addColorStop(0.85, 'rgb(0 0 0 / 1)')
  ctx.fillStyle = m
  ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4)
  ctx.restore()
}

/** Banded gas giant (warm rose and amber bands, one storm), turned slightly. */
function paintGas(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, random: () => number) {
  const bands: readonly Rgb[] = [
    [232, 190, 150],
    [196, 120, 96],
    [244, 214, 176],
    [170, 96, 88],
    [226, 168, 120],
    [248, 226, 196],
    [188, 128, 104],
  ]
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx, cy)
  ctx.rotate(0.22)
  ctx.fillStyle = rgba(bands[0], 1)
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4)
  // Wavy bands: each a strip whose edges follow a slow sine.
  const count = 15
  for (let i = 0; i < count; i++) {
    const y0 = -r + (i / count) * r * 2
    const hgt = (r * 2) / count
    const amp = hgt * between(random, 0.1, 0.35)
    const freq = between(random, 2, 5) / r
    const ph = random() * Math.PI * 2
    const bottom = hgt * between(random, 0.8, 1.1)
    ctx.beginPath()
    for (let x = -r * 1.1; x <= r * 1.1; x += r / 24) ctx.lineTo(x, y0 + Math.sin(x * freq + ph) * amp)
    for (let x = r * 1.1; x >= -r * 1.1; x -= r / 24) ctx.lineTo(x, y0 + bottom + Math.sin(x * freq + ph + 1) * amp)
    ctx.closePath()
    ctx.fillStyle = rgba(bands[Math.floor(random() * bands.length)], between(random, 0.5, 0.9))
    ctx.fill()
  }
  // Storm: a pale oval with a darker rim, on the side that shows on screen.
  const sx = -r * 0.42
  const sy = -r * 0.3
  ctx.save()
  ctx.translate(sx, sy)
  ctx.scale(1, 0.55)
  const storm = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.16)
  storm.addColorStop(0, 'rgb(250 225 200 / 0.95)')
  storm.addColorStop(0.6, 'rgb(215 130 100 / 0.85)')
  storm.addColorStop(0.85, 'rgb(150 80 70 / 0.6)')
  storm.addColorStop(1, 'rgb(150 80 70 / 0)')
  ctx.fillStyle = storm
  ctx.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4)
  ctx.restore()
  ctx.restore()
}

/** Ice planet: pale blue-violet with faint bands. */
function paintIce(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, random: () => number, bands: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = bands ? 'rgb(170 180 240)' : 'rgb(110 170 240)'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  if (bands) {
    for (let i = 0; i < 7; i++) {
      const y = cy - r + random() * r * 2
      ctx.fillStyle = rgba(random() < 0.5 ? [205, 210, 250] : [130, 135, 215], between(random, 0.25, 0.5))
      ctx.fillRect(cx - r, y, r * 2, r * between(random, 0.06, 0.18))
    }
  }
  ctx.restore()
}

/** Rocky world: rust and grey, mottled, with craters lit from the upper left. */
function paintRocky(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, random: () => number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = 'rgb(176 112 84)'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  for (let i = 0; i < 14; i++) {
    const x = cx + spread(random) * r
    const y = cy + spread(random) * r
    const s = r * between(random, 0.2, 0.5)
    const g = ctx.createRadialGradient(x, y, 0, x, y, s)
    const c: Rgb = random() < 0.5 ? [120, 80, 70] : [200, 150, 120]
    g.addColorStop(0, rgba(c, 0.45))
    g.addColorStop(1, rgba(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(x - s, y - s, s * 2, s * 2)
  }
  const craters = Math.round(between(random, 9, 14))
  for (let i = 0; i < craters; i++) {
    const a = random() * Math.PI * 2
    const d = Math.sqrt(random()) * r * 0.85
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    const s = Math.max(0.8, r * between(random, 0.05, 0.16))
    ctx.fillStyle = 'rgb(105 66 54 / 0.7)'
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.fill()
    // Lit rim on the far side from the light, shadow on the near side.
    ctx.fillStyle = 'rgb(225 180 150 / 0.55)'
    ctx.beginPath()
    ctx.arc(x - LIGHT_X * s * 0.25, y - LIGHT_Y * s * 0.25, s * 0.75, 0, Math.PI * 2)
    ctx.arc(x - LIGHT_X * s * 0.1, y - LIGHT_Y * s * 0.1, s * 0.85, 0, Math.PI * 2, true)
    ctx.fill()
  }
  ctx.restore()
}

/** Rings in ring-local coordinates (before tilt), as one band set. */
function paintRings(ctx: CanvasRenderingContext2D, r: number, half: 'back' | 'front') {
  ctx.save()
  ctx.rotate(RING_ANGLE)
  ctx.beginPath()
  // Clip to the back (upper) or front (lower) half of the tilted ring plane.
  if (half === 'back') ctx.rect(-r * 3, -r * 3, r * 6, r * 3)
  else ctx.rect(-r * 3, 0, r * 6, r * 3)
  ctx.clip()
  ctx.scale(1, RING_TILT)
  const bands = [
    [1.3, 1.55, 0.3, [190, 195, 235]],
    [1.6, 2.05, 0.7, [215, 215, 240]],
    [2.12, 2.4, 0.45, [175, 180, 225]],
  ] as const
  for (const [inner, outer, alpha, color] of bands) {
    ctx.beginPath()
    ctx.arc(0, 0, r * outer, 0, Math.PI * 2)
    ctx.arc(0, 0, r * inner, 0, Math.PI * 2, true)
    ctx.fillStyle = rgba(color, alpha)
    ctx.fill()
  }
  ctx.restore()
}

/** Whole planet in one sprite; the planet center is at the sprite center. */
function makePlanet(kind: Kind, r: number, seed: number): HTMLCanvasElement {
  const random = createRandom(seed)
  const half = kind === 'ringed' ? r * 2.5 : r * 1.15
  const canvas = makeCanvas(half * 2, half * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = canvas.width / 2
  if (kind === 'ringed') {
    ctx.save()
    ctx.translate(c, c)
    paintRings(ctx, r, 'back')
    ctx.restore()
  }
  if (kind === 'gas') paintGas(ctx, c, c, r, random)
  else if (kind === 'rocky') paintRocky(ctx, c, c, r, random)
  else paintIce(ctx, c, c, r, random, kind === 'ringed')
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.clip()
  shade(ctx, c, c, r, kind === 'gas' ? 0.95 : 0.9)
  ctx.restore()
  if (kind === 'gas') atmosphere(ctx, c, c, r, [255, 200, 160], 0.35)
  if (kind === 'ice') atmosphere(ctx, c, c, r, [150, 200, 255], 0.5)
  if (kind === 'ringed') {
    ctx.save()
    ctx.translate(c, c)
    paintRings(ctx, r, 'front')
    ctx.restore()
  }
  return canvas
}

interface Placed {
  sprite: HTMLCanvasElement
  x: number
  y: number
  r: number
  spec: PlanetSpec
}

function createPlanets(setup: SceneSetup) {
  const stars = createStarfield(setup, {
    seed: 271,
    density: 0.85,
    nebulaStrength: 0.5,
    nebulaColors: [
      [64, 96, 230],
      [40, 150, 200],
      [124, 92, 255],
    ],
  })

  let placed: Placed[] = []

  function build({ width, height }: SceneSize) {
    const mobile = width < 768
    const unit = mobile ? width : Math.min(width, height)
    placed = PLANETS.map((spec, i) => {
      const p = mobile ? spec.mobile : spec.desktop
      const minR = spec.kind === 'gas' ? 90 : spec.kind === 'ice' ? 3 : 7
      const r = Math.max(minR, p.r * unit)
      return { sprite: makePlanet(spec.kind, r, 2710 + i), x: p.x * width, y: p.y * height, r, spec }
    })
  }

  build(setup)

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    const { ctx, time, scrollY, width } = frame
    const reach = Math.min(width, 900)
    for (const { sprite, x, y, spec } of placed) {
      // Slow figure-eight drift; nearer planets drift further.
      const amp = reach * (0.006 + 0.018 * spec.depth)
      const t = (time / spec.period) * Math.PI * 2 + spec.phase
      const dx = Math.sin(t) * amp
      const dy = Math.sin(t * 2) * amp * 0.45
      const shift = Math.min(scrollY * (0.01 + 0.05 * spec.depth), 15 + 45 * spec.depth)
      ctx.drawImage(sprite, x + dx - sprite.width / 2, y + dy - shift - sprite.height / 2)
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
      placed = []
    },
  }
}

export const planetsScene: Scene = {
  id: 'planets',
  create: createPlanets,
}
