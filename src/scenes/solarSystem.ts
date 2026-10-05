import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Home scene (S26): a solar system. A warm sun sits in the top-right corner,
 * partly off-screen, with planets moving slowly along tilted, visible orbits
 * that sweep around the hero instead of sitting behind its text. Drawn over
 * a sparser default starfield.
 *
 * Cost per frame: the starfield, one bitmap for the orbits (cropped to their
 * bounding box), two sprites for the sun and two to four sprites per planet.
 * All gradients and paths are baked into sprites on create/resize.
 */

type Rgb = readonly [number, number, number]

interface PlanetSpec {
  /** Orbit radius as a fraction of the system's unit size. */
  orbit: number
  /** Planet radius as a fraction of the unit size, and a minimum in CSS px. */
  size: number
  minSize: number
  /** Seconds per orbit (subtle: the fastest is over a minute). */
  period: number
  /** Angle at time 0, in radians (0 = right of the sun, PI/2 = in front). */
  phase: number
  /** Base color, plus optional band colors drawn as horizontal stripes. */
  color: Rgb
  bands?: readonly Rgb[]
  rings?: boolean
}

/** Colors after NASA imagery: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Neptune. */
const PLANETS: readonly PlanetSpec[] = [
  { orbit: 0.2, size: 0.007, minSize: 2, period: 70, phase: 2.4, color: [170, 160, 150] },
  { orbit: 0.29, size: 0.011, minSize: 3, period: 110, phase: 0.9, color: [230, 200, 140] },
  {
    orbit: 0.39,
    size: 0.012,
    minSize: 3,
    period: 160,
    phase: 3.7,
    color: [70, 130, 220],
    bands: [[90, 160, 110], [235, 240, 255]],
  },
  { orbit: 0.49, size: 0.009, minSize: 2.5, period: 220, phase: 1.9, color: [205, 105, 70] },
  {
    orbit: 0.68,
    size: 0.03,
    minSize: 7,
    period: 340,
    phase: 2.1,
    color: [215, 180, 140],
    bands: [[180, 130, 95], [240, 220, 190], [165, 110, 80], [230, 205, 170]],
  },
  {
    orbit: 0.88,
    size: 0.024,
    minSize: 5.5,
    period: 460,
    phase: 2.85,
    color: [225, 200, 150],
    bands: [[200, 175, 125], [240, 220, 175]],
    rings: true,
  },
  { orbit: 1.08, size: 0.018, minSize: 4.5, period: 600, phase: 1.35, color: [90, 130, 235] },
]

/** Orbit ellipse: vertical squash (viewing angle) and rotation of the plane. */
const TILT = 0.34
const PLANE_ANGLE = -0.78
/** Sun color from the `sun` palette (#fbbf4d) with a whiter core. */
const SUN: Rgb = [251, 191, 77]
/** How far the system shifts up per pixel scrolled, and the cap. */
const PARALLAX = 0.04
const MAX_PARALLAX = 60

interface Layout {
  cx: number
  cy: number
  /** Unit size: the outermost planet orbits at about this radius. */
  unit: number
  sunRadius: number
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

function rgba([r, g, b]: Rgb, a: number) {
  return `rgb(${r} ${g} ${b} / ${a})`
}

/**
 * Where the sun sits. Desktop: top-right corner, partly off-screen, so the
 * orbits sweep down and left around the hero text. Mobile: smaller and
 * tucked further into the corner, above the centered content column.
 */
function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    const unit = Math.min(width * 1.05, height * 0.75)
    return { cx: width * 0.96, cy: height * 0.09, unit, sunRadius: Math.max(22, unit * 0.075) }
  }
  // Tablets: a little larger, so the inner planets aren't all behind the hero photo.
  const unit = Math.min(width * (width < 1024 ? 0.66 : 0.56), height * 1.05)
  return { cx: width * 0.93, cy: height * 0.1, unit, sunRadius: Math.max(34, unit * 0.075) }
}

/** Sun glow (corona) sprite, drawn larger than the disk. */
function makeCorona(radius: number): HTMLCanvasElement {
  const r = radius * 5
  const canvas = makeCanvas(r * 2, r * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createRadialGradient(r, r, radius * 0.6, r, r, r)
  g.addColorStop(0, rgba(SUN, 0.75))
  g.addColorStop(0.12, rgba(SUN, 0.4))
  g.addColorStop(0.3, rgba([240, 130, 50], 0.14))
  g.addColorStop(0.6, rgba([220, 90, 40], 0.04))
  g.addColorStop(1, rgba([220, 90, 40], 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, r * 2, r * 2)
  return canvas
}

/** Sun disk with a white-hot center and limb darkening toward orange. */
function makeSunDisk(radius: number): HTMLCanvasElement {
  const canvas = makeCanvas(radius * 2, radius * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)
  g.addColorStop(0, 'rgb(255 250 230)')
  g.addColorStop(0.45, 'rgb(255 222 140)')
  g.addColorStop(0.85, rgba(SUN, 1))
  g.addColorStop(1, 'rgb(236 128 44)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(radius, radius, radius, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

/** Lit planet disk: base color, optional bands, soft limb darkening. */
function makePlanet(spec: PlanetSpec, radius: number): HTMLCanvasElement {
  const size = radius * 2
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.beginPath()
  ctx.arc(radius, radius, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = rgba(spec.color, 1)
  ctx.fillRect(0, 0, size, size)
  if (spec.bands) {
    const stripes = spec.bands.length * 2 + 1
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 0) continue
      ctx.fillStyle = rgba(spec.bands[(i >> 1) % spec.bands.length], 0.75)
      ctx.fillRect(0, (i / stripes) * size, size, size / stripes)
    }
  }
  const limb = ctx.createRadialGradient(radius, radius, radius * 0.5, radius, radius, radius)
  limb.addColorStop(0, 'rgb(0 0 0 / 0)')
  limb.addColorStop(1, 'rgb(0 0 0 / 0.35)')
  ctx.fillStyle = limb
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Night side: dark on the right half, drawn rotated so the dark side faces away from the sun. */
function makeShade(radius: number): HTMLCanvasElement {
  const size = radius * 2
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.beginPath()
  ctx.arc(radius, radius, radius, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createLinearGradient(0, 0, size, 0)
  g.addColorStop(0, 'rgb(0 0 0 / 0)')
  g.addColorStop(0.4, 'rgb(0 0 0 / 0.1)')
  g.addColorStop(0.62, 'rgb(0 0 0 / 0.75)')
  g.addColorStop(1, 'rgb(0 0 0 / 0.9)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Saturn's rings, split in a back half (behind the planet) and a front half. */
function makeRings(radius: number): { back: HTMLCanvasElement; front: HTMLCanvasElement } {
  const rx = radius * 2.3
  const ry = rx * TILT * 0.9
  const make = (half: 'back' | 'front') => {
    const canvas = makeCanvas(rx * 2, ry * 2)
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    ctx.beginPath()
    ctx.rect(0, half === 'back' ? 0 : ry, rx * 2, ry)
    ctx.clip()
    ctx.translate(rx, ry)
    ctx.scale(1, ry / rx)
    const bands = [
      [0.62, 0.72, 0.35],
      [0.74, 0.88, 0.75],
      [0.9, 1, 0.5],
    ] as const
    for (const [inner, outer, alpha] of bands) {
      ctx.beginPath()
      ctx.arc(0, 0, rx * outer, 0, Math.PI * 2)
      ctx.arc(0, 0, rx * inner, 0, Math.PI * 2, true)
      ctx.fillStyle = rgba([225, 205, 165], alpha)
      ctx.fill()
    }
    return canvas
  }
  return { back: make('back'), front: make('front') }
}

/** All orbit paths baked into one bitmap, cropped to their on-screen bounding box. */
interface OrbitBitmap {
  canvas: HTMLCanvasElement
  /** Top-left corner and size in CSS pixels, before the scroll shift. */
  x: number
  y: number
  width: number
  height: number
}

function makeOrbits(size: SceneSize, layout: Layout, styles: readonly string[]): OrbitBitmap {
  const { width, height, dpr } = size
  const { cx, cy, unit } = layout
  // Bounding box of the outermost (rotated) ellipse, clipped to what can be
  // on screen: the viewport plus the parallax margin below it.
  const r = Math.max(...PLANETS.map((p) => p.orbit)) * unit + 2
  const cos = Math.cos(PLANE_ANGLE)
  const sin = Math.sin(PLANE_ANGLE)
  const halfW = Math.hypot(r * cos, r * TILT * sin)
  const halfH = Math.hypot(r * sin, r * TILT * cos)
  const x = Math.max(0, Math.floor(cx - halfW))
  const y = Math.max(0, Math.floor(cy - halfH))
  const right = Math.min(width, Math.ceil(cx + halfW))
  const bottom = Math.min(height + MAX_PARALLAX, Math.ceil(cy + halfH))
  const box = { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
  const canvas = makeCanvas(box.width * dpr, box.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, ...box }
  ctx.scale(dpr, dpr)
  ctx.translate(cx - x, cy - y)
  ctx.rotate(PLANE_ANGLE)
  ctx.lineWidth = 1
  PLANETS.forEach((planet, i) => {
    const pr = planet.orbit * unit
    ctx.beginPath()
    ctx.ellipse(0, 0, pr, pr * TILT, 0, 0, Math.PI * 2)
    ctx.strokeStyle = styles[i]
    ctx.stroke()
  })
  return { canvas, ...box }
}

interface PlanetSprites {
  spec: PlanetSpec
  radius: number
  body: HTMLCanvasElement
  shade: HTMLCanvasElement
  rings: { back: HTMLCanvasElement; front: HTMLCanvasElement } | null
}

function createSolarSystem(setup: SceneSetup) {
  const stars = createStarfield(setup, {
    seed: 26,
    density: 0.75,
    nebulaStrength: 0.55,
    nebulaColors: [
      [64, 96, 230],
      [124, 92, 255],
      [235, 150, 80],
    ],
  })

  let size: SceneSize = setup
  let layout = layoutFor(size)
  let corona: HTMLCanvasElement | null = null
  let sunDisk: HTMLCanvasElement | null = null
  let planets: PlanetSprites[] = []
  let orbits: OrbitBitmap | null = null
  // Outer orbits a little fainter so the corner doesn't get busy.
  const orbitStyles = PLANETS.map((p) => `rgb(200 210 255 / ${0.42 - p.orbit * 0.14})`)
  const cosPlane = Math.cos(PLANE_ANGLE)
  const sinPlane = Math.sin(PLANE_ANGLE)

  function build() {
    layout = layoutFor(size)
    corona = makeCorona(layout.sunRadius)
    sunDisk = makeSunDisk(layout.sunRadius)
    orbits = makeOrbits(size, layout, orbitStyles)
    planets = PLANETS.map((spec) => {
      const radius = Math.max(spec.minSize, spec.size * layout.unit)
      return {
        spec,
        radius,
        body: makePlanet(spec, radius),
        shade: makeShade(radius),
        rings: spec.rings ? makeRings(radius) : null,
      }
    })
  }

  build()

  function drawPlanet(ctx: CanvasRenderingContext2D, p: PlanetSprites, x: number, y: number) {
    const r = p.radius
    if (p.rings) {
      const { back } = p.rings
      ctx.drawImage(back, x - back.width / 2, y - back.height / 2)
    }
    ctx.drawImage(p.body, x - r, y - r)
    // Turn the night side away from the sun.
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.atan2(y - sunY, x - layout.cx))
    ctx.drawImage(p.shade, -r, -r)
    ctx.restore()
    if (p.rings) {
      const { front } = p.rings
      ctx.drawImage(front, x - front.width / 2, y - front.height / 2)
    }
  }

  // Positions are written into these each frame (no allocations in the loop).
  const px = new Float64Array(PLANETS.length)
  const py = new Float64Array(PLANETS.length)
  const behind = new Uint8Array(PLANETS.length)
  let sunY = 0

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    const { ctx, time, scrollY } = frame
    const shift = Math.min(scrollY * PARALLAX, MAX_PARALLAX)
    const { cx, unit, sunRadius } = layout
    sunY = layout.cy - shift

    // Orbits: one 1:1 blit at a whole-pixel offset. Stroking the ellipses
    // every frame cost more raster time on slow devices.
    if (orbits) {
      const dy = Math.round(shift * size.dpr) / size.dpr
      ctx.drawImage(orbits.canvas, orbits.x, orbits.y - dy, orbits.width, orbits.height)
    }

    for (let i = 0; i < planets.length; i++) {
      const { spec } = planets[i]
      const angle = spec.phase + (time / spec.period) * Math.PI * 2
      const r = spec.orbit * unit
      const ex = Math.cos(angle) * r
      const ey = Math.sin(angle) * r * TILT
      px[i] = cx + ex * cosPlane - ey * sinPlane
      py[i] = sunY + ex * sinPlane + ey * cosPlane
      // Far half of the orbit (sin < 0) passes behind the sun.
      behind[i] = Math.sin(angle) < 0 ? 1 : 0
    }

    for (let i = 0; i < planets.length; i++) {
      if (behind[i]) drawPlanet(ctx, planets[i], px[i], py[i])
    }

    // Sun: corona breathes very slowly; the disk is steady.
    if (corona && sunDisk) {
      const breathe = 1 + 0.035 * Math.sin(time * 0.35)
      const c = (corona.width / 2) * breathe
      ctx.drawImage(corona, cx - c, sunY - c, c * 2, c * 2)
      ctx.drawImage(sunDisk, cx - sunRadius, sunY - sunRadius)
    }

    for (let i = 0; i < planets.length; i++) {
      if (!behind[i]) drawPlanet(ctx, planets[i], px[i], py[i])
    }
  }

  return {
    draw,
    resize(next: SceneSize) {
      size = next
      stars.resize?.(next)
      build()
    },
    dispose() {
      stars.dispose?.()
      corona = null
      sunDisk = null
      planets = []
      orbits = null
    },
  }
}

export const solarSystemScene: Scene = {
  id: 'solar-system',
  create: createSolarSystem,
}
