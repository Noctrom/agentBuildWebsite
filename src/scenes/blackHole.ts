import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Behind the Scenes scene (S26): a black hole, after the EHT images and the
 * Interstellar render. A dark shadow with a thin photon ring, a tilted,
 * turning accretion disk that passes in front of the shadow, the far side of
 * the disk bent up over the top (and faintly under the bottom) by the hole's
 * gravity, and background starlight stretched into faint arcs.
 *
 * V0.44 brings it to life, all as plain functions of `time` (no intro, and
 * time 0 is a complete still frame for reduced motion):
 * - Swirl: the streaks of the hot inner band whirl round in ~10 s while
 *   the outer disk drifts (~2 min a turn). See SPLIT and `makeDiskTextures`.
 * - Hot spots: three bright clumps with short trails race round the inner
 *   edge, brighter on the side turning toward the viewer (left).
 * - Photon ring flicker: the ring's brightness wanders on a sum of slow
 *   sines, at most 1.1 Hz (see `ringFlicker` for the WCAG 2.3.1 bound).
 * - Lensing shimmer: the lensed arc over the top shimmers in brightness, the
 *   hot spots' bent images run along it as glints while they pass behind the
 *   hole, and some of the stretched starlight arcs twinkle.
 * Every brightness wave swings around its old value, so on average the scene
 * is as bright as before; the hot spots and glints add a little light.
 *
 * V0.45 adds a blue gas giant orbiting in the disk plane (one turn in 30 s).
 * See `Planet`: one small sprite draw a frame. (V0.63 removed the faint gas
 * stream V0.45 drew off it into the inner disk.)
 *
 * Cost per frame: the starfield, the outer disk layer re-rendered 12 times a
 * second (as before), a cached inner band frame, about 15 small sprite draws
 * (arcs, spots, glints), one stroked ring and six larger sprite draws. Every
 * gradient is baked on create/resize.
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
/**
 * V0.44 swirl. The disk is split at SPLIT shadow radii into two layers that
 * turn at different speeds (radians per second): the hot inner band whirls
 * round in ~10 s, the outer disk drifts (one turn in ~2 min), so the inner
 * edge visibly laps the outer edge.
 *
 * Turning a layer means re-rendering it (a rotated, squashed draw of its
 * texture), which is most of the scene's cost, so:
 * - The outer layer is re-rendered OUTER_FPS times a second, as before V0.44;
 *   at OUTER_SPIN its rim moves about a pixel a step.
 * - The inner band repeats every quarter turn (INNER_SYMMETRY), so it only
 *   has INNER_FRAMES distinct frames: one every 1/60 s over the 2.5 s a
 *   quarter turn takes. Each is rendered once, the first time it is shown,
 *   and reused after that, so after 2.5 s the fast band costs only a copy
 *   (on very large screens it is rendered live, see INNER_CACHE_BYTES).
 */
const SPLIT = 2.2
const INNER_SPIN = 0.62
const INNER_SYMMETRY = 4
const INNER_FPS = 60
const INNER_PERIOD = (Math.PI * 2) / INNER_SYMMETRY / INNER_SPIN
const INNER_FRAMES = Math.round(INNER_PERIOD * INNER_FPS)
const OUTER_SPIN = 0.05
const OUTER_FPS = 12
const PARALLAX = 0.03

/** Hot spot speed (radians per second) at `radius` shadow radii: Kepler, a bit faster than the band. */
function spotSpin(radius: number): number {
  return 0.8 * (DISK_INNER / radius) ** 1.5
}

/**
 * Hot spots on the inner edge: orbit radius (shadow radii) and angle at time
 * 0, chosen so the still frame shows one bright on the approaching (left)
 * side, one in front of the shadow and one behind it (seen as a glint on the
 * lensed arc). Each is a separate draw, so there are only a few.
 */
const HOT_SPOTS: readonly { radius: number; angle: number }[] = [
  { radius: 1.62, angle: 2.75 },
  { radius: 1.7, angle: 1.35 },
  { radius: 1.84, angle: 5.1 },
]
/** Trail behind each spot: angle step (radians) and relative brightness. */
const TRAIL_STEP = 0.1
const TRAIL: readonly number[] = [1, 0.4]
const SPOT_ALPHA = 0.9
/** Spot brightness on the receding (right) side, relative to the approaching side. */
const SPOT_BEAM_MIN = 0.25

/**
 * The page's visible area (V0.43). Below lg the sticky top bar (V0.35/V0.48)
 * covers the top 64px; from lg there is no top bar, and the nav rail (V0.47)
 * covers the left `--rail-width` px instead.
 */
const HEADER_BAND = 64
const LG = 1024
/** Shadow radius as a share of the visible area's shorter side. */
const SIZE = 0.08
const MIN_R = 24

/**
 * The rail's width as published by the Header on <html> (V0.47). It is an
 * inline style, so reading it never forces a style or layout pass. It differs
 * per page (187px when Behind the Scenes is current, 98px on Home) and is 0
 * below lg.
 */
function readRailWidth(): number {
  if (typeof document === 'undefined') return 0
  const value = parseFloat(document.documentElement.style.getPropertyValue('--rail-width'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

interface Layout {
  cx: number
  cy: number
  /** Shadow radius in CSS px; everything else scales from it. */
  r: number
  /** Most the scroll parallax lifts the hole, in CSS px. */
  lift: number
}

/**
 * V0.43: the hole sits in the middle of the visible area at every width,
 * behind the text (Chris's choice; it replaces V0.36's corner spots).
 * Readability comes from the engine's brightness budget, not from position.
 */
function layoutFor({ width, height }: SceneSize, railWidth: number): Layout {
  const rail = width >= LG ? Math.min(railWidth, width / 2) : 0
  const top = width >= LG ? 0 : HEADER_BAND
  const areaWidth = width - rail
  const areaHeight = Math.max(1, height - top)
  // The disk (DISK_OUTER r each side) always fits inside the area's width.
  const r = Math.min(
    Math.max(MIN_R, Math.min(areaWidth, areaHeight) * SIZE),
    (areaWidth * 0.48) / DISK_OUTER,
  )
  return {
    cx: rail + areaWidth / 2,
    cy: top + areaHeight / 2,
    r,
    // Gentle scroll parallax; from the middle it never reaches the top bar.
    lift: width >= LG ? 40 : 16,
  }
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

interface DiskTextures {
  /** The fast inner band's streaks, on transparent. */
  inner: HTMLCanvasElement
  /** The hot gradient annulus, the outer streaks and the dark lanes. */
  outer: HTMLCanvasElement
}

/**
 * Face-on disk textures: a hot gradient annulus with turbulent streaks.
 * - Outer: the gradient (which looks the same at any rotation), the streaks
 *   from SPLIT outward and the dark lanes, all as before V0.44 (same seed and
 *   order; streaks inside SPLIT are skipped).
 * - Inner: the band from the inner edge to SPLIT, streaks only, as dense and
 *   bright as before but laid out with INNER_SYMMETRY-fold symmetry (the same
 *   quarter repeated), so its frames repeat every quarter turn. Seen nearly
 *   edge-on, squashed to a thin band and moving, the repeat doesn't show.
 */
function makeDiskTextures(r: number): DiskTextures {
  const outerR = r * DISK_OUTER
  const inner = r * DISK_INNER
  const split = r * SPLIT
  const outer = makeCanvas(outerR * 2, outerR * 2)
  // Pad the inner texture for the widest streak so nothing is clipped.
  const innerHalf = Math.ceil(split + 2.5 * (r / 50) + 2)
  const innerTex = makeCanvas(innerHalf * 2, innerHalf * 2)
  const ctx = outer.getContext('2d')
  const ictx = innerTex.getContext('2d')
  if (!ctx || !ictx) return { inner: innerTex, outer }
  ctx.translate(outerR, outerR)
  const base = ctx.createRadialGradient(0, 0, inner, 0, 0, outerR)
  base.addColorStop(0, rgba(DISK_COLORS[0], 0.95))
  base.addColorStop(0.12, rgba(DISK_COLORS[1], 0.75))
  base.addColorStop(0.35, rgba(DISK_COLORS[2], 0.4))
  base.addColorStop(0.7, rgba(DISK_COLORS[3], 0.14))
  base.addColorStop(1, rgba(DISK_COLORS[4], 0))
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(0, 0, outerR, 0, Math.PI * 2)
  ctx.arc(0, 0, inner, 0, Math.PI * 2, true)
  ctx.fill()

  // Streaks: partial arcs, denser and brighter toward the inner edge.
  const random = createRandom(2601)
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 150; i++) {
    const t = random() ** 1.6
    const radius = inner + (outerR - inner) * t
    const start = random() * Math.PI * 2
    const length = between(random, 0.4, 2.2)
    const lineWidth = between(random, 0.6, 2.2) * (r / 50)
    const alpha = between(random, 0.12, 0.4) * (1 - t * 0.7)
    if (radius < split) continue
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + length)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = rgba(diskColor(t), alpha)
    ctx.stroke()
  }
  // Dark lanes for texture.
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 26; i++) {
    const radius = inner + (outerR - inner) * between(random, 0.05, 0.9)
    const start = random() * Math.PI * 2
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + between(random, 0.6, 2.4))
    ctx.lineWidth = between(random, 1, 3) * (r / 50)
    ctx.strokeStyle = `rgb(0 0 0 / ${between(random, 0.2, 0.5)})`
    ctx.stroke()
  }

  // Inner band: 14 streaks per quarter (the old texture had ~55 inside SPLIT).
  ictx.translate(innerHalf, innerHalf)
  ictx.globalCompositeOperation = 'lighter'
  const band = createRandom(2605)
  const sector = (Math.PI * 2) / INNER_SYMMETRY
  const tSplit = (SPLIT - DISK_INNER) / (DISK_OUTER - DISK_INNER)
  for (let i = 0; i < 14; i++) {
    const t = tSplit * band() ** 1.3
    const radius = inner + (outerR - inner) * t
    const start = band() * sector
    // Shorter than a quarter turn, so a streak never meets its own copy.
    const length = between(band, 0.3, 1.3)
    ictx.lineWidth = between(band, 0.6, 2.2) * (r / 50)
    ictx.strokeStyle = rgba(diskColor(t), between(band, 0.14, 0.42) * (1 - t * 0.7))
    for (let k = 0; k < INNER_SYMMETRY; k++) {
      ictx.beginPath()
      ictx.arc(0, 0, radius, start + k * sector, start + k * sector + length)
      ictx.stroke()
    }
  }
  return { inner: innerTex, outer }
}

/** Render `texture` turned by `angle` and squashed onto the tilted disk, then apply the beaming mask. */
function renderDisk(ctx: CanvasRenderingContext2D, texture: HTMLCanvasElement, mask: HTMLCanvasElement, angle: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  // translate(w/2, h/2) . scale(1, h/w) . rotate(angle)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const squash = h / w
  ctx.setTransform(cos, sin * squash, -sin, cos * squash, w / 2, h / 2)
  ctx.drawImage(texture, -texture.width / 2, -texture.height / 2)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

/** The slow outer disk: one canvas, re-rendered OUTER_FPS times a second. */
class OuterDisk {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly mask: HTMLCanvasElement
  /** Step last rendered (-1 = none yet). */
  private step = -1

  private readonly texture: HTMLCanvasElement

  constructor(texture: HTMLCanvasElement) {
    this.texture = texture
    this.canvas = makeCanvas(texture.width, texture.width * DISK_TILT)
    this.ctx = this.canvas.getContext('2d')
    this.mask = makeBeamingMask(this.canvas.width, this.canvas.height)
  }

  /** The layer at `time`. */
  at(time: number): HTMLCanvasElement {
    const step = Math.floor(time * OUTER_FPS)
    if (this.ctx && step !== this.step) {
      this.step = step
      // Negative angles: the near side moves right (see the hot spots).
      renderDisk(this.ctx, this.texture, this.mask, (-step / OUTER_FPS) * OUTER_SPIN)
    }
    return this.canvas
  }
}

/**
 * Most memory the inner band's frame cache may use, in bytes. It fits while
 * the hole's visible area is under about 1000px on its shorter side (375x812:
 * ~1.8 MB, 1280x800: ~7.8 MB, 1440x900: ~10 MB). On larger screens the band
 * is rendered live instead, one small rotated draw per frame.
 */
const INNER_CACHE_BYTES = 12e6

/**
 * The fast inner band: INNER_FRAMES frames, each rendered the first time it is
 * needed, then reused (or rendered live into one canvas if the cache would be
 * too big).
 */
class InnerBand {
  private readonly frames: (HTMLCanvasElement | null)[]
  private readonly width: number
  private readonly height: number
  private readonly mask: HTMLCanvasElement
  private readonly texture: HTMLCanvasElement
  private readonly cached: boolean
  /** Live mode: the frame index last rendered into frames[0]. */
  private shown = -1

  constructor(texture: HTMLCanvasElement) {
    this.texture = texture
    this.width = texture.width
    this.height = Math.ceil(texture.width * DISK_TILT)
    this.mask = makeBeamingMask(this.width, this.height)
    this.cached = this.width * this.height * 4 * INNER_FRAMES <= INNER_CACHE_BYTES
    this.frames = new Array(this.cached ? INNER_FRAMES : 1).fill(null)
  }

  /** The band at `time`. */
  at(time: number): HTMLCanvasElement | null {
    const n = Math.floor(time * INNER_FPS) % INNER_FRAMES
    const slot = this.cached ? n : 0
    let frame = this.frames[slot]
    if (frame && (this.cached || n === this.shown)) return frame
    if (!frame) frame = this.frames[slot] = makeCanvas(this.width, this.height)
    const ctx = frame.getContext('2d')
    if (!ctx) return null
    // Frame n shows the band turned by n frames' worth of spin, so the frames
    // loop seamlessly after a quarter turn.
    renderDisk(ctx, this.texture, this.mask, -(n / INNER_FRAMES) * ((Math.PI * 2) / INNER_SYMMETRY))
    this.shown = n
    return frame
  }
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
 * Static backdrop around the hole, baked into one sprite: a soft warm glow,
 * a faint Einstein ring and, for light-bending part 1, background starlight
 * near the hole stretched into thin tangential arcs.
 *
 * V0.44 shimmer: every TWINKLE_EVERY-th arc is left out of the sprite and
 * drawn on its own (`StarArc`) with a slow twinkle that averages to its old
 * brightness. Only some arcs twinkle because each one is a separate draw.
 */
function makeBackdrop(r: number): { sprite: HTMLCanvasElement; arcs: StarArc[] } {
  const outer = r * 5.2
  const sprite = makeCanvas(outer * 2, outer * 2)
  const arcs: StarArc[] = []
  const ctx = sprite.getContext('2d')
  if (!ctx) return { sprite, arcs }
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
  const twinkle = createRandom(2604)
  for (let i = 0; i < 30; i++) {
    const radius = r * between(random, 1.7, 3.8)
    // Arcs are longer the closer they are to the hole.
    const length = (between(random, 0.05, 0.18) * (2.2 * r)) / radius
    const start = random() * Math.PI * 2
    const lineWidth = between(random, 0.6, 1.4)
    const alpha = between(random, 0.15, 0.45)
    if (i % TWINKLE_EVERY === 0) {
      arcs.push(makeStarArc(radius, start, length, lineWidth, alpha, twinkle))
      continue
    }
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + length)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = `rgb(215 225 255 / ${alpha})`
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgb(200 210 255 / 0.12)'
  ctx.stroke()
  return { sprite, arcs }
}

/** Every this-many-th starlight arc twinkles (6 of 30). */
const TWINKLE_EVERY = 5

/** One twinkling starlight arc: a small sprite, its place and its twinkle. */
interface StarArc {
  sprite: HTMLCanvasElement
  /** Sprite's top-left corner relative to the hole's centre, CSS px. */
  dx: number
  dy: number
  /** Steady opacity (the same as the arc had before V0.44). */
  alpha: number
  /** Twinkle: opacity times 1 + depth * sin(phase + rate * time). */
  depth: number
  rate: number
  phase: number
}

/** Bake one arc at full opacity into a sprite just big enough for it. */
function makeStarArc(
  radius: number,
  start: number,
  length: number,
  lineWidth: number,
  alpha: number,
  twinkle: () => number,
): StarArc {
  // Bounding box of the arc (sampled), padded for the round caps.
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let s = 0; s <= 8; s++) {
    const a = start + (length * s) / 8
    x0 = Math.min(x0, Math.cos(a) * radius)
    y0 = Math.min(y0, Math.sin(a) * radius)
    x1 = Math.max(x1, Math.cos(a) * radius)
    y1 = Math.max(y1, Math.sin(a) * radius)
  }
  const pad = lineWidth + 2
  const dx = Math.floor(x0 - pad)
  const dy = Math.floor(y0 - pad)
  const sprite = makeCanvas(x1 + pad - dx, y1 + pad - dy)
  const ctx = sprite.getContext('2d')
  if (ctx) {
    ctx.translate(-dx, -dy)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, start + length)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = 'rgb(215 225 255)'
    ctx.stroke()
  }
  return {
    sprite,
    dx,
    dy,
    alpha,
    // alpha * (1 + depth) stays under 1 (0.45 * 1.8), so globalAlpha never clips.
    depth: between(twinkle, 0.5, 0.8),
    // Periods 1.4-3.5 s (at most 0.71 Hz).
    rate: (Math.PI * 2) / between(twinkle, 1.4, 3.5),
    phase: twinkle() * Math.PI * 2,
  }
}

/**
 * Light-bending, part 2: the far side of the disk seen bent up over the top
 * of the shadow, with a fainter secondary image under it. (The photon ring,
 * part of this sprite before V0.44, is now stroked live so it can flicker.)
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
  return canvas
}

/**
 * Lensed arc brightness: the old slow pulse (0.9 on average) plus a faster
 * shimmer, at most 0.7 Hz, in [0.8, 1].
 */
function lensShimmer(time: number): number {
  return 0.9 + 0.06 * Math.sin(time * 0.5) + 0.04 * Math.sin(Math.PI * 2 * 0.7 * time + 1)
}

/**
 * Lensed images of the hot spots: while a spot passes behind the hole, its
 * light is bent over the top, so a glint runs along the lensed arc. Radius
 * and vertical stretch of the path, in shadow radii, and peak opacity.
 */
const GLINT_RADIUS = 1.2
const GLINT_STRETCH = 1.12
const GLINT_ALPHA = 0.6

/** Photon ring: radius in shadow radii, colour, and opacity RING_ALPHA x (1 + RING_DEPTH x flicker), in [0.6, 1]. */
const RING_RADIUS = 1.04
const RING_COLOR = 'rgb(255 240 210)'
const RING_ALPHA = 0.8
const RING_DEPTH = 0.25
/**
 * Photon ring flicker, in [-1, 1]. WCAG 2.3.1 (no more than three flashes a
 * second) is guaranteed by construction:
 * - All three waves are harmonics of 0.1 Hz (3rd, 7th, 11th: 0.3, 0.7 and
 *   1.1 Hz). So the flicker is a trigonometric polynomial of degree 11 with a
 *   10 s period, whose slope can change sign at most 2 x 11 = 22 times per
 *   period: at most 2.2 turns (1.1 brightenings) per second, under the
 *   3 flashes per second limit even if every turn counted as a flash.
 * - It is also far from being a "flash" at all: the swing is +-0.2 of a
 *   1-2px ring's opacity, on a canvas the engine shows at 0.2 opacity, i.e.
 *   a change of a few 8-bit levels on a tiny area (WCAG's threshold is a 10%
 *   relative-luminance swing over a quarter of a 10-degree field).
 */
function ringFlicker(time: number): number {
  const w = Math.PI * 2 * 0.1
  return (
    0.5 * Math.sin(3 * w * time + 1.1) +
    0.3 * Math.sin(7 * w * time + 2.6) +
    0.2 * Math.sin(11 * w * time + 4.4)
  )
}

/** Soft round hot spot, white-hot centre fading to the disk's inner colour. */
function makeSpot(r: number): HTMLCanvasElement {
  const radius = Math.max(3, r * 0.16)
  const canvas = makeCanvas(radius * 2, radius * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = canvas.width / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgb(255 252 240 / 1)')
  g.addColorStop(0.3, rgba(DISK_COLORS[0], 0.8))
  g.addColorStop(0.6, rgba(DISK_COLORS[1], 0.3))
  g.addColorStop(1, rgba(DISK_COLORS[1], 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * V0.45: a blue gas giant on a circular orbit in the disk plane, at
 * PLANET_ORBIT shadow radii (inside the disk's outer edge, so it never leaves
 * the area the disk already fits in). Its radius is PLANET_SIZE shadow radii,
 * so it is a quarter as wide as the shadow. It turns the same way as the disk
 * (angles decrease, so the near side moves right), once every PLANET_PERIOD s.
 *
 * PLANET_START is its angle at time 0, the reduced-motion still frame: on the
 * near side, front left of the hole, fully visible.
 */
const PLANET_ORBIT = 3.4
const PLANET_SIZE = 0.25
const PLANET_PERIOD = 30
const PLANET_SPIN = (Math.PI * 2) / PLANET_PERIOD
const PLANET_START = 2.3
/**
 * Lighting steps per orbit (10 degrees each). Each is a sprite baked the
 * first time it is shown (see `Planet`), so a bake happens at most every
 * 0.83 s during the first orbit and never after.
 */
const PLANET_PHASES = 36
/** Band colours, darkest to palest (Neptune/Jupiter-like shades of blue). */
const PLANET_COLORS: readonly Rgb[] = [
  [18, 38, 104],
  [40, 84, 182],
  [84, 140, 232],
  [156, 198, 250],
  [212, 230, 255],
]
/** Light from the hole and disk: an ambient part (so the bands always show) plus a part facing the hole. */
const PLANET_AMBIENT = 0.6
const PLANET_DIFFUSE = 0.55

function planetColor(t: number): Rgb {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (PLANET_COLORS.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  const a = PLANET_COLORS[i]
  const b = PLANET_COLORS[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/**
 * The planet: a sphere whose axis is the disk's axis (so its bands lie
 * parallel to the disk and bow slightly, as we see it a little from above),
 * banded in blues by latitude with a slight wave, darker toward the limb and
 * brighter on the side facing the hole.
 *
 * The bands and limb are worked out once per size (`base`, one pass with the
 * trigonometry). A lighting step only multiplies them by the light, which is
 * cheap; its sprite is made the first time it is shown.
 */
class Planet {
  private readonly size: number
  /** Per pixel: band colour x limb darkening (RGB), coverage (0-255), and the surface normal. */
  private readonly base: Float32Array
  private readonly normals: Float32Array
  private readonly phases: (HTMLCanvasElement | null)[] = new Array(PLANET_PHASES).fill(null)
  private image: ImageData | null = null

  constructor(r: number) {
    /** Radius in CSS px. */
    const radius = Math.max(4, r * PLANET_SIZE)
    // Even, so the sprite's centre is on a pixel corner.
    const size = (this.size = 2 * Math.ceil(radius + 1))
    this.base = new Float32Array(size * size * 4)
    this.normals = new Float32Array(size * size * 3)
    const c = size / 2
    const pc = Math.cos(PLANE_ANGLE)
    const ps = Math.sin(PLANE_ANGLE)
    // Disk plane frame: x right, y down, z toward the viewer. The disk is the
    // plane spanned by (1, 0, 0) and (0, tilt, depth); its axis (0, -depth, tilt) points up.
    const tilt = DISK_TILT
    const depth = Math.sqrt(1 - tilt * tilt)
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const dx = i + 0.5 - c
        const dy = j + 0.5 - c
        const cover = Math.min(1, radius - Math.sqrt(dx * dx + dy * dy) + 0.5)
        if (cover <= 0) continue
        // Into the disk plane frame (undo the plane's tilt on screen).
        let u = (dx * pc + dy * ps) / radius
        let v = (-dx * ps + dy * pc) / radius
        const q = u * u + v * v
        if (q > 1) {
          const k = 1 / Math.sqrt(q)
          u *= k
          v *= k
        }
        const w = Math.sqrt(Math.max(0, 1 - u * u - v * v))
        // Latitude (its sine) against the disk axis, with a slight wave along the longitude.
        const lat = -v * depth + w * tilt
        const lon = Math.atan2(u, v * tilt + w * depth)
        const l = lat + 0.03 * Math.sin(lon * 5 + lat * 9)
        const band =
          0.55 +
          0.25 * Math.sin(l * 11 + 0.4) +
          0.14 * Math.sin(l * 23 + 2.1) +
          0.07 * Math.sin(l * 41 + 0.7) -
          0.35 * l ** 4
        const [cr, cg, cb] = planetColor(band)
        const limb = 0.6 + 0.4 * w
        const p = j * size + i
        this.base[p * 4] = cr * limb
        this.base[p * 4 + 1] = cg * limb
        this.base[p * 4 + 2] = cb * limb
        this.base[p * 4 + 3] = cover * 255
        this.normals[p * 3] = u
        this.normals[p * 3 + 1] = v
        this.normals[p * 3 + 2] = w
      }
    }
  }

  /** The sprite lit for orbit angle `angle`. */
  at(angle: number): HTMLCanvasElement | null {
    const step = Math.round((angle / (Math.PI * 2)) * PLANET_PHASES)
    const k = ((step % PLANET_PHASES) + PLANET_PHASES) % PLANET_PHASES
    return (this.phases[k] ??= this.bake((k / PLANET_PHASES) * Math.PI * 2))
  }

  /** Light the planet from the hole while it is at orbit angle `angle`. */
  private bake(angle: number): HTMLCanvasElement | null {
    const { size, base, normals } = this
    const canvas = makeCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const image = (this.image ??= ctx.createImageData(size, size))
    const data = image.data
    // Unit vector from the planet toward the hole, in the disk plane frame.
    const depth = Math.sqrt(1 - DISK_TILT * DISK_TILT)
    const lx = -Math.cos(angle)
    const ly = -Math.sin(angle) * DISK_TILT
    const lz = -Math.sin(angle) * depth
    for (let p = 0; p < size * size; p++) {
      const facing = normals[p * 3] * lx + normals[p * 3 + 1] * ly + normals[p * 3 + 2] * lz
      const shade = PLANET_AMBIENT + PLANET_DIFFUSE * Math.max(0, facing)
      data[p * 4] = base[p * 4] * shade
      data[p * 4 + 1] = base[p * 4 + 1] * shade
      data[p * 4 + 2] = base[p * 4 + 2] * shade
      data[p * 4 + 3] = base[p * 4 + 3]
    }
    ctx.putImageData(image, 0, 0)
    return canvas
  }
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
  let railWidth = readRailWidth()
  let layout = layoutFor(size, railWidth)
  /** The slow outer disk and the fast inner band (drawn additively on top). */
  let outerDisk: OuterDisk | null = null
  let innerBand: InnerBand | null = null
  let backdrop: HTMLCanvasElement | null = null
  let arcs: StarArc[] = []
  let lensed: HTMLCanvasElement | null = null
  let spot: HTMLCanvasElement | null = null
  let planet: Planet | null = null

  function build() {
    layout = layoutFor(size, railWidth)
    const { r } = layout
    const textures = makeDiskTextures(r)
    outerDisk = new OuterDisk(textures.outer)
    innerBand = new InnerBand(textures.inner)
    const back = makeBackdrop(r)
    backdrop = back.sprite
    arcs = back.arcs
    lensed = makeLensedDisk(r)
    spot = makeSpot(r)
    planet = new Planet(r)
  }

  build()

  /**
   * Draw the top (far) or bottom (near) half of the outer disk and the inner
   * band. The band is streaks only, so its light is added, as the streaks
   * were in the single texture before V0.44.
   */
  function drawDiskHalf(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: 'far' | 'near', time: number) {
    const outer = outerDisk?.at(time)
    const band = innerBand?.at(time)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(PLANE_ANGLE)
    for (const disk of [outer, band]) {
      if (!disk) continue
      const w = disk.width
      const h = disk.height / 2
      ctx.globalCompositeOperation = disk === band ? 'lighter' : 'source-over'
      if (half === 'far') ctx.drawImage(disk, 0, 0, w, h, -w / 2, -h, w, h)
      else ctx.drawImage(disk, 0, h, w, h, -w / 2, 0, w, h)
    }
    ctx.restore()
  }

  const planeCos = Math.cos(PLANE_ANGLE)
  const planeSin = Math.sin(PLANE_ANGLE)

  /**
   * Hot spots on the far (behind the shadow) or near side of the disk. Each
   * spot and its trail dots are placed on the tilted disk plane; the far ones
   * are drawn before the shadow, so it hides them as they pass behind.
   */
  function drawSpots(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, time: number, far: boolean) {
    if (!spot) return
    const half = spot.width / 2
    ctx.globalCompositeOperation = 'lighter'
    for (const s of HOT_SPOTS) {
      const radius = s.radius * r
      // Same sense as the disk: angles decrease, so the near side moves right.
      const head = s.angle - spotSpin(s.radius) * time
      for (let j = 0; j < TRAIL.length; j++) {
        const a = head + j * TRAIL_STEP
        const sin = Math.sin(a)
        if (sin < 0 !== far) continue
        const cos = Math.cos(a)
        const x = radius * cos
        const y = radius * sin * DISK_TILT
        // Approaching side (left, cos -1) at full brightness.
        const beam = SPOT_BEAM_MIN + (1 - SPOT_BEAM_MIN) * (1 - cos) * 0.5
        ctx.globalAlpha = SPOT_ALPHA * beam * TRAIL[j]
        ctx.drawImage(spot, cx + x * planeCos - y * planeSin - half, cy + x * planeSin + y * planeCos - half)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  /**
   * Glints on the lensed arc: the bent image of each hot spot on the far
   * side runs over the top of the shadow, brightest when the spot is right
   * behind the hole.
   */
  function drawGlints(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, time: number) {
    if (!spot) return
    const half = spot.width / 2
    const rx = GLINT_RADIUS * r
    const ry = rx * GLINT_STRETCH
    ctx.globalCompositeOperation = 'lighter'
    for (const s of HOT_SPOTS) {
      const a = s.angle - spotSpin(s.radius) * time
      const sin = Math.sin(a)
      // Only while the spot is well behind the hole (the glint is faint near the sides anyway).
      if (sin > -0.2) continue
      const cos = Math.cos(a)
      const beam = SPOT_BEAM_MIN + (1 - SPOT_BEAM_MIN) * (1 - cos) * 0.5
      ctx.globalAlpha = GLINT_ALPHA * beam * sin * sin
      ctx.drawImage(spot, cx + rx * cos - half, cy + ry * sin - r * 0.12 - half)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function drawCentered(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement | null, x: number, y: number) {
    if (sprite) ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)
  }

  /**
   * The rail can change width after the scene is created (the Header measures
   * it just after a route change), so follow it. The sprites are only rebuilt
   * when the hole's size changes.
   */
  function followRail() {
    const next = readRailWidth()
    if (next === railWidth) return
    railWidth = next
    const nextLayout = layoutFor(size, railWidth)
    if (nextLayout.r === layout.r) layout = nextLayout
    else build()
  }

  function draw(frame: SceneFrame) {
    followRail()
    stars.draw(frame)
    const { ctx, time, scrollY } = frame
    const { cx, r } = layout
    const cy = layout.cy - Math.min(scrollY * PARALLAX, layout.lift)

    // The glow breathes slowly; some of the stretched starlight twinkles.
    const breath = 0.85 + 0.15 * Math.sin(time * 0.3)
    ctx.globalAlpha = breath
    drawCentered(ctx, backdrop, cx, cy)
    for (const arc of arcs) {
      ctx.globalAlpha = breath * arc.alpha * (1 + arc.depth * Math.sin(arc.phase + arc.rate * time))
      ctx.drawImage(arc.sprite, cx + arc.dx, cy + arc.dy)
    }
    ctx.globalAlpha = 1

    drawDiskHalf(ctx, cx, cy, 'far', time)
    drawSpots(ctx, cx, cy, r, time, true)

    // The planet: on the far side it is drawn now, so the shadow hides it as
    // it passes behind; on the near side after the near half of the disk.
    const planetAngle = PLANET_START - PLANET_SPIN * time
    const planetFar = Math.sin(planetAngle) < 0
    const px = PLANET_ORBIT * r * Math.cos(planetAngle)
    const py = PLANET_ORBIT * r * Math.sin(planetAngle) * DISK_TILT
    const planetX = cx + px * planeCos - py * planeSin
    const planetY = cy + px * planeSin + py * planeCos
    if (planet && planetFar) drawCentered(ctx, planet.at(planetAngle), planetX, planetY)

    // Lensed far side (shimmering, with the hot spots' glints running over it).
    ctx.globalAlpha = lensShimmer(time)
    drawCentered(ctx, lensed, cx, cy)
    ctx.globalAlpha = 1
    drawGlints(ctx, cx, cy, r, time)

    // Photon ring, flickering gently (see `ringFlicker` for the WCAG bound).
    ctx.globalAlpha = RING_ALPHA * (1 + RING_DEPTH * ringFlicker(time))
    ctx.strokeStyle = RING_COLOR
    ctx.lineWidth = Math.max(1, r * 0.035)
    ctx.beginPath()
    ctx.arc(cx, cy, r * RING_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1

    // The shadow covers everything behind it.
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    drawDiskHalf(ctx, cx, cy, 'near', time)
    drawSpots(ctx, cx, cy, r, time, false)
    if (planet && !planetFar) drawCentered(ctx, planet.at(planetAngle), planetX, planetY)
  }

  return {
    draw,
    resize(next: SceneSize) {
      size = next
      railWidth = readRailWidth()
      stars.resize?.(next)
      build()
    },
    dispose() {
      stars.dispose?.()
      arcs = []
      backdrop = lensed = spot = outerDisk = innerBand = planet = null
    },
  }
}

export const blackHoleScene: Scene = {
  id: 'black-hole',
  create: createBlackHole,
}
