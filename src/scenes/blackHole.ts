import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Behind the Scenes scene (S26): a black hole, after the EHT images and the
 * Interstellar render. A dark shadow with a thin photon ring, a tilted,
 * slowly turning accretion disk that passes in front of the shadow, the far
 * side of the disk bent up over the top (and faintly under the bottom) by the
 * hole's gravity, and background starlight stretched into faint arcs.
 *
 * Cost per frame: the starfield, one rotated draw of the disk texture into a
 * small offscreen layer, and five sprite draws. Every gradient is
 * baked on create/resize.
 */

type Rgb = readonly [number, number, number]

/** Disk colors from inner (hottest) to outer edge. */
const DISK_COLORS: readonly Rgb[] = [
  [255, 244, 214],
  [255, 206, 120],
  [251, 160, 70],
  [220, 96, 48],
  [150, 52, 40],
]
/** Disk radii as multiples of the shadow radius. */
const DISK_INNER = 1.55
const DISK_OUTER = 4.8
/** Vertical squash of the disk (how edge-on we see it) and tilt of its plane. */
const DISK_TILT = 0.15
const PLANE_ANGLE = -0.14
/** Disk rotation, radians per second (slow; the texture is mostly streaks). */
const SPIN = 0.045
/**
 * The disk layer is re-rendered at this rate, not every frame: rendering it
 * is most of the scene's cost, and at SPIN the rim moves under a pixel per
 * step, so the stepping is invisible.
 */
const DISK_FPS = 12
const PARALLAX = 0.03

/**
 * Height of the (sticky) site header: the shadow and photon ring stay below
 * it, also after the parallax lift.
 */
const HEADER_BAND = 65

interface Layout {
  cx: number
  cy: number
  /** Shadow radius in CSS px; everything else scales from it. */
  r: number
  /** Most the scroll parallax lifts the hole, in CSS px. */
  lift: number
}

function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    // Phones: top right above the centered column. The lift is small so the
    // shadow never slides under the sticky header.
    const r = Math.max(24, width * 0.08)
    const lift = 8
    return { cx: width * 0.78, cy: Math.max(height * 0.13, HEADER_BAND + lift + r * 1.1), r, lift }
  }
  if (width < 1024) {
    // Tablets (V0.36): the prose and diagrams span almost the full width, so
    // the hole sits high in the top-right corner, beside the page title and
    // above the end of the intro, instead of behind the text.
    const r = Math.max(36, Math.min(width, height) * 0.06)
    const lift = 16
    return { cx: width - r * 1.75, cy: HEADER_BAND + lift + r * 1.5, r, lift }
  }
  return { cx: width * 0.8, cy: height * 0.3, r: Math.max(40, Math.min(width, height) * 0.075), lift: 40 }
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

function diskColor(t: number): Rgb {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (DISK_COLORS.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  const a = DISK_COLORS[i]
  const b = DISK_COLORS[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/** Face-on disk texture: a hot gradient annulus with turbulent streaks. */
function makeDiskTexture(r: number): HTMLCanvasElement {
  const outer = r * DISK_OUTER
  const inner = r * DISK_INNER
  const size = outer * 2
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.translate(outer, outer)
  const base = ctx.createRadialGradient(0, 0, inner, 0, 0, outer)
  base.addColorStop(0, rgba(DISK_COLORS[0], 0.95))
  base.addColorStop(0.12, rgba(DISK_COLORS[1], 0.75))
  base.addColorStop(0.35, rgba(DISK_COLORS[2], 0.4))
  base.addColorStop(0.7, rgba(DISK_COLORS[3], 0.14))
  base.addColorStop(1, rgba(DISK_COLORS[4], 0))
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(0, 0, outer, 0, Math.PI * 2)
  ctx.arc(0, 0, inner, 0, Math.PI * 2, true)
  ctx.fill()

  // Streaks: partial arcs, denser and brighter toward the inner edge.
  const random = createRandom(2601)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 150; i++) {
    const t = random() ** 1.6
    const radius = inner + (outer - inner) * t
    const start = random() * Math.PI * 2
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + between(random, 0.4, 2.2))
    ctx.lineWidth = between(random, 0.6, 2.2) * (r / 50)
    ctx.strokeStyle = rgba(diskColor(t), between(random, 0.12, 0.4) * (1 - t * 0.7))
    ctx.stroke()
  }
  // Dark lanes for texture.
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 26; i++) {
    const radius = inner + (outer - inner) * between(random, 0.05, 0.9)
    const start = random() * Math.PI * 2
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + between(random, 0.6, 2.4))
    ctx.lineWidth = between(random, 1, 3) * (r / 50)
    ctx.strokeStyle = `rgb(0 0 0 / ${between(random, 0.2, 0.5)})`
    ctx.stroke()
  }
  return canvas
}

/**
 * Relativistic beaming: the side of the disk turning toward us is brighter.
 * Applied to the disk layer with `destination-in`.
 */
function makeBeamingMask(width: number, height: number): HTMLCanvasElement {
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const g = ctx.createLinearGradient(0, 0, width, 0)
  g.addColorStop(0, 'rgb(0 0 0 / 0.8)')
  g.addColorStop(0.35, 'rgb(0 0 0 / 1)')
  g.addColorStop(0.65, 'rgb(0 0 0 / 0.75)')
  g.addColorStop(1, 'rgb(0 0 0 / 0.4)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
  return canvas
}

/**
 * Static backdrop around the hole, baked into one sprite so it costs a single
 * draw: a soft warm glow, plus light-bending part 1, background starlight
 * near the hole stretched into thin tangential arcs and a faint Einstein ring.
 */
function makeBackdrop(r: number): HTMLCanvasElement {
  const outer = r * 5.2
  const canvas = makeCanvas(outer * 2, outer * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.translate(outer, outer)
  const g = ctx.createRadialGradient(0, 0, r, 0, 0, outer)
  g.addColorStop(0, 'rgb(255 190 110 / 0.35)')
  g.addColorStop(0.3, 'rgb(240 130 70 / 0.13)')
  g.addColorStop(0.7, 'rgb(150 90 200 / 0.04)')
  g.addColorStop(1, 'rgb(120 80 200 / 0)')
  ctx.fillStyle = g
  ctx.fillRect(-outer, -outer, outer * 2, outer * 2)

  ctx.lineCap = 'round'
  const random = createRandom(2602)
  for (let i = 0; i < 30; i++) {
    const radius = r * between(random, 1.7, 3.8)
    // Arcs are longer the closer they are to the hole.
    const length = (between(random, 0.05, 0.18) * (2.2 * r)) / radius
    const start = random() * Math.PI * 2
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + length)
    ctx.lineWidth = between(random, 0.6, 1.4)
    ctx.strokeStyle = `rgb(215 225 255 / ${between(random, 0.15, 0.45)})`
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgb(200 210 255 / 0.12)'
  ctx.stroke()
  return canvas
}

/**
 * Light-bending, part 2: the far side of the disk seen bent up over the top
 * of the shadow, with a fainter secondary image under it, and the thin photon
 * ring hugging the shadow.
 */
function makeLensedDisk(r: number): HTMLCanvasElement {
  const outer = r * 2
  const size = outer * 2
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.translate(outer, outer)
  // The image is an annulus around the shadow that is thick over the top,
  // thinner underneath and thinnest at the sides: an ellipse shifted up.
  const glow = ctx.createRadialGradient(0, -r * 0.12, r, 0, -r * 0.12, r * 1.75)
  glow.addColorStop(0, rgba(DISK_COLORS[0], 0.95))
  glow.addColorStop(0.25, rgba(DISK_COLORS[1], 0.75))
  glow.addColorStop(0.6, rgba(DISK_COLORS[2], 0.35))
  glow.addColorStop(1, rgba(DISK_COLORS[3], 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.14, r * 1.5, r * 1.72, 0, 0, Math.PI * 2)
  ctx.arc(0, 0, r, 0, Math.PI * 2, true)
  ctx.fill('evenodd')
  // Streaks follow the ring, like the disk's own texture seen bent.
  const random = createRandom(2603)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 40; i++) {
    const t = random() ** 1.5
    const start = -Math.PI + between(random, -0.4, Math.PI + 0.4)
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.1 * t, r * (1.06 + 0.4 * t), r * (1.06 + 0.55 * t), 0, start, start + between(random, 0.3, 1.4))
    ctx.lineWidth = between(random, 0.5, 1.6) * (r / 50)
    ctx.strokeStyle = rgba(diskColor(t * 0.7), between(random, 0.15, 0.45))
    ctx.stroke()
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Strong over the top, weak at the sides, a fainter image underneath.
  const fade = ctx.createLinearGradient(0, 0, 0, size)
  fade.addColorStop(0, 'rgb(0 0 0 / 1)')
  fade.addColorStop(0.4, 'rgb(0 0 0 / 0.85)')
  fade.addColorStop(0.5, 'rgb(0 0 0 / 0.3)')
  fade.addColorStop(0.62, 'rgb(0 0 0 / 0.45)')
  fade.addColorStop(1, 'rgb(0 0 0 / 0.6)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'
  // Photon ring.
  ctx.beginPath()
  ctx.arc(outer, outer, r * 1.04, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(1, r * 0.035)
  ctx.strokeStyle = 'rgb(255 240 210 / 0.9)'
  ctx.stroke()
  return canvas
}

function createBlackHole(setup: SceneSetup) {
  const stars = createStarfield(setup, {
    seed: 2626,
    density: 0.85,
    nebulaStrength: 0.45,
    nebulaColors: [
      [124, 92, 255],
      [190, 72, 190],
      [64, 96, 230],
    ],
  })

  let size: SceneSize = setup
  let layout = layoutFor(size)
  let texture: HTMLCanvasElement | null = null
  let backdrop: HTMLCanvasElement | null = null
  let lensedDisk: HTMLCanvasElement | null = null
  let mask: HTMLCanvasElement | null = null
  /** Offscreen layer holding the tilted, turning disk for the current frame. */
  let disk: HTMLCanvasElement | null = null
  let diskCtx: CanvasRenderingContext2D | null = null
  /** Disk step last rendered into the layer (-1 = needs a render). */
  let diskStep = -1

  function build() {
    layout = layoutFor(size)
    const { r } = layout
    texture = makeDiskTexture(r)
    backdrop = makeBackdrop(r)
    lensedDisk = makeLensedDisk(r)
    const w = r * DISK_OUTER * 2
    const h = w * DISK_TILT
    disk = makeCanvas(w, h)
    diskCtx = disk.getContext('2d')
    diskStep = -1
    mask = makeBeamingMask(disk.width, disk.height)
  }

  build()

  function renderDisk(time: number) {
    if (!disk || !diskCtx || !texture || !mask) return
    const step = Math.floor(time * DISK_FPS)
    if (step === diskStep) return
    diskStep = step
    const stepTime = step / DISK_FPS
    const ctx = diskCtx
    const half = texture.width / 2
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, disk.width, disk.height)
    ctx.translate(disk.width / 2, disk.height / 2)
    ctx.scale(1, disk.height / disk.width)
    ctx.rotate(-stepTime * SPIN)
    ctx.drawImage(texture, -half, -half)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }

  /** Draw the top (far) or bottom (near) half of the disk layer. */
  function drawDiskHalf(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: 'far' | 'near') {
    if (!disk) return
    const w = disk.width
    const h = disk.height / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(PLANE_ANGLE)
    if (half === 'far') ctx.drawImage(disk, 0, 0, w, h, -w / 2, -h, w, h)
    else ctx.drawImage(disk, 0, h, w, h, -w / 2, 0, w, h)
    ctx.restore()
  }

  function drawCentered(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement | null, x: number, y: number) {
    if (sprite) ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)
  }

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    const { ctx, time, scrollY } = frame
    const { cx, r } = layout
    const cy = layout.cy - Math.min(scrollY * PARALLAX, layout.lift)

    // The glow breathes slowly.
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(time * 0.3)
    drawCentered(ctx, backdrop, cx, cy)
    ctx.globalAlpha = 1

    renderDisk(time)
    drawDiskHalf(ctx, cx, cy, 'far')
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(time * 0.5)
    drawCentered(ctx, lensedDisk, cx, cy)
    ctx.globalAlpha = 1

    // The shadow covers everything behind it; the photon ring is in the lensed sprite.
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    drawDiskHalf(ctx, cx, cy, 'near')
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
      texture = backdrop = lensedDisk = mask = disk = null
      diskCtx = null
    },
  }
}

export const blackHoleScene: Scene = {
  id: 'black-hole',
  create: createBlackHole,
}
