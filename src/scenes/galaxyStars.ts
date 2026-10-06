import { makeCanvas, type Rgb } from './canvas'

/**
 * Moving stars of the Contact galaxy (V0.39), drawn live every frame so the
 * galaxy swirls: stars near the core orbit faster than the outer arms.
 *
 * Why the arms never wind up into a ring: the arms are a density wave. The
 * spiral pattern turns rigidly at one speed (`patternSpin`), and arm stars
 * only *pass through* it. Each arm star keeps a fixed radius and an offset
 * `delta` from the arm's centre line at that radius. Its offset drifts with
 * its speed relative to the pattern and wraps inside a window of +-`width`
 * around the arm. Brightness follows a bell over that window and is zero at
 * its edges, so a star fades out as it leaves the arm and fades back in as it
 * re-enters on the other side. The wrap is never visible, the arm shape is
 * the same at every time (offsets start uniform in the window, so frame 0
 * already looks like frame 10 000), and nothing ever needs re-seeding.
 * Bulge and inter-arm disk stars are spread evenly round each radius, so plain
 * differential rotation cannot pile them into structure either.
 *
 * Drawing: positions are projected straight onto the tilted disk and each
 * star is splatted (bilinear, so slow stars glide instead of hopping whole
 * pixels) into a pixel buffer the size of the galaxy, which is several times
 * cheaper than filling thousands of tiny rects. The refill is spread over
 * `FILL_FRAMES` frames (a slice of the stars per frame), then uploaded with
 * one `putImageData`; every frame draws the buffer with one additive
 * `drawImage`. The buffer is only ever touched by `putImageData`, so the
 * browser never has to rasterize into it on the main thread.
 *
 * Twinkle (V0.40): some stars get a slow brightness wave with their own
 * period and phase (`StarSeed.twinkle`). The factor swings between
 * 1 - depth and 1 + depth around 1, so on average the galaxy is exactly as
 * bright as in V0.39, and the random phases keep the stars out of step.
 */

/** Star colors, indexed by `StarSeed.color`. */
export const STAR_COLORS: readonly Rgb[] = [
  [205, 220, 255], // arm stars, blue-white
  [255, 245, 230], // arm stars, warm white
  [255, 228, 190], // bulge
  [210, 215, 245], // inter-arm disk
]

/** A star before packing, in galaxy units (radius as a fraction of the galaxy radius). */
export interface StarSeed {
  /** Radius, 0..~1.05 of the galaxy radius. */
  radius: number
  /**
   * Arm stars: angle of the arm centre line at this radius (pattern frame).
   * Other stars: their starting angle.
   */
  base: number
  /** Arm stars: starting offset from the arm in [-width, width]. Others: 0. */
  delta: number
  /** Arm stars: half-width of the arm window in radians. Others: 0 (free orbit). */
  width: number
  /** Peak opacity, 0..1 (edge fade already applied). */
  alpha: number
  /** Index into `STAR_COLORS`. */
  color: number
  /** Side of the star in CSS pixels before the disk tilt squashes it. */
  size: number
  /** Optional twinkle; leave out for a steady star. */
  twinkle?: Twinkle
}

/**
 * A slow brightness wave around the steady light: the light is scaled by
 * 1 + depth * sin(phase + time * 2 pi / period), which averages to 1.
 */
export interface Twinkle {
  /** 0..1: how far the light swings up and down. */
  depth: number
  /** Seconds per wave. */
  period: number
  /** Radians. */
  phase: number
}

export interface DiskView {
  cx: number
  cy: number
  /** Galaxy radius in CSS pixels. */
  r: number
  /** Vertical squash of the disk (inclination). */
  tilt: number
  /** Rotation of the disk plane on screen. */
  planeAngle: number
  /** Extra rotation of the galaxy inside its plane at time 0. */
  startAngle: number
}

export interface DiskMotion {
  /** Radians per second of the rigid arm pattern. */
  patternSpin: number
  /** Radians per second of a star at the galaxy edge (radius 1). */
  outerSpin: number
  /** Rotation curve core size, see `orbitSpeed`. */
  softening: number
}

/** Angular speed (radians per second) of a circular orbit at `radius`. */
export function orbitSpeed(radius: number, { outerSpin, softening }: DiskMotion) {
  // Flat-ish rotation curve: speed falls off like 1/r outside a soft core.
  return (outerSpin * (1 + softening)) / (radius + softening)
}

export interface DiskStars {
  /**
   * Draw the stars (additively) at `time`. With `complete` false the buffer
   * is refilled over several frames; pass true for still frames (reduce
   * motion), which must be whole in one call.
   */
  draw(ctx: CanvasRenderingContext2D, view: DiskView, time: number, complete: boolean): void
  dispose(): void
}

/**
 * Frames per buffer refill. Each frame splats 1/FILL_FRAMES of the stars, so
 * the buffer shows new positions 60 / FILL_FRAMES times a second. Stars move
 * at most ~0.3 px per frame, so at 20 updates a second they still glide
 * (bilinear splats) and the per-frame work is a third.
 */
const FILL_FRAMES = 3
/** Buffer extent in galaxy radii (stars reach ~1.05). */
const BUFFER_RADIUS = 1.1

/** Sine table for the hot loop: 4096 steps per turn, linearly interpolated. */
const SIN_STEPS = 4096
const SIN_SCALE = SIN_STEPS / (Math.PI * 2)
const SIN_TABLE = new Float32Array(SIN_STEPS + 1)
for (let i = 0; i <= SIN_STEPS; i++) SIN_TABLE[i] = Math.sin(i / SIN_SCALE)

/** sin(angle), angle in table steps (radians * SIN_SCALE), any sign. */
function tableSin(steps: number) {
  const f = Math.floor(steps)
  const i = f & (SIN_STEPS - 1)
  return SIN_TABLE[i] + (SIN_TABLE[i + 1] - SIN_TABLE[i]) * (steps - f)
}

/** Brightness of the arm window at u = offset / width, in [-1, 1]; 0 at the edges. */
function bell(u: number) {
  const v = 1 - u * u
  return v * v
}

/** Pack the seeds into typed arrays and return a drawer. */
export function createDiskStars(seeds: readonly StarSeed[], motion: DiskMotion): DiskStars {
  const n = seeds.length
  const radius = new Float32Array(n)
  const base = new Float32Array(n)
  const delta = new Float32Array(n)
  const width = new Float32Array(n)
  const relSpeed = new Float32Array(n)
  /** Peak light per star: alpha times the star's area in pixels at tilt 1. */
  const light = new Float32Array(n)
  const color = new Uint8Array(n)
  /** Twinkle depth (0 = steady), rate and phase in sine-table steps. */
  const twDepth = new Float32Array(n)
  const twRate = new Float32Array(n)
  const twPhase = new Float32Array(n)
  seeds.forEach((s, i) => {
    radius[i] = s.radius
    base[i] = s.base
    delta[i] = s.delta
    width[i] = s.width
    light[i] = s.alpha * s.size * s.size
    color[i] = s.color
    if (s.twinkle) {
      twDepth[i] = s.twinkle.depth
      twRate[i] = SIN_STEPS / s.twinkle.period
      twPhase[i] = s.twinkle.phase * SIN_SCALE
    }
    const own = orbitSpeed(s.radius, motion)
    // Arm stars move relative to the rigid pattern; free stars by their own orbit.
    relSpeed[i] = s.width > 0 ? own - motion.patternSpin : own
  })
  const palette = new Float32Array(STAR_COLORS.length * 3)
  STAR_COLORS.forEach(([r, g, b], k) => palette.set([r, g, b], k * 3))

  // Pixel buffer covering the galaxy's outline; (re)allocated when its size changes.
  let sizedFor = { r: 0, tilt: 0, planeAngle: 0 }
  let canvas: HTMLCanvasElement | null = null
  let bufCtx: CanvasRenderingContext2D | null = null
  let image: ImageData | null = null
  let bw = 0
  let bh = 0
  /**
   * Premultiplied RGB light per pixel for the refill in progress, and the
   * pixels it touched. `stamp` marks a pixel's accum as part of this refill,
   * so nothing is ever cleared in full. `shown` lists the pixels currently
   * set in `image`.
   */
  let accum = new Float32Array(0)
  let stamp = new Uint32Array(0)
  let touched = new Int32Array(0)
  let touchedCount = 0
  let shown = new Int32Array(0)
  let shownCount = 0
  let generation = 1
  /** Next star to splat in the refill in progress; 0 = a new refill starts. */
  let next = 0
  /** False until the buffer holds a complete frame. */
  let ready = false

  function allocate(view: DiskView) {
    const { r, tilt, planeAngle } = view
    const outer = r * BUFFER_RADIUS
    const c = Math.cos(planeAngle)
    const s = Math.sin(planeAngle)
    bw = Math.ceil(2 * outer * Math.sqrt(c * c + tilt * tilt * s * s)) + 4
    bh = Math.ceil(2 * outer * Math.sqrt(s * s + tilt * tilt * c * c)) + 4
    canvas = makeCanvas(bw, bh)
    bufCtx = canvas.getContext('2d')
    image = bufCtx ? bufCtx.createImageData(bw, bh) : null
    accum = new Float32Array(bw * bh * 3)
    stamp = new Uint32Array(bw * bh)
    touched = new Int32Array(bw * bh)
    shown = new Int32Array(bw * bh)
    touchedCount = 0
    shownCount = 0
    generation = 1
    next = 0
    ready = false
  }

  function add(index: number, amount: number, cr: number, cg: number, cb: number) {
    const k = index * 3
    if (stamp[index] !== generation) {
      stamp[index] = generation
      touched[touchedCount++] = index
      accum[k] = amount * cr
      accum[k + 1] = amount * cg
      accum[k + 2] = amount * cb
    } else {
      accum[k] += amount * cr
      accum[k + 1] += amount * cg
      accum[k + 2] += amount * cb
    }
  }

  /** Splat stars [from, to) at `time` into the accumulator. */
  function splat(view: DiskView, time: number, from: number, to: number) {
    const { r, tilt, planeAngle, startAngle } = view
    const cosP = Math.cos(planeAngle)
    const sinP = Math.sin(planeAngle)
    const ox = bw / 2
    const oy = bh / 2
    const squash = tilt / 255
    const quarter = SIN_STEPS / 4
    // The galaxy turns clockwise in its own frame (negative angles), which
    // makes the arms trail, as in a real spiral.
    const pattern = startAngle - motion.patternSpin * time
    for (let i = from; i < to; i++) {
      let angle: number
      let a = light[i]
      const depth = twDepth[i]
      if (depth > 0) a *= 1 + depth * tableSin(twPhase[i] + twRate[i] * time)
      const w = width[i]
      if (w > 0) {
        // Offset from the arm, wrapped into [-w, w).
        const span = 2 * w
        let d = delta[i] - relSpeed[i] * time + w
        d -= span * Math.floor(d / span)
        d -= w
        a *= bell(d / w)
        if (a < 0.02) continue
        angle = pattern + base[i] + d
      } else {
        angle = startAngle + base[i] - relSpeed[i] * time
      }
      const steps = angle * SIN_SCALE
      const rr = radius[i] * r
      const x = tableSin(steps + quarter) * rr
      const y = tableSin(steps) * rr * tilt
      // Position in the buffer, measured to pixel centres.
      const fx = ox + x * cosP - y * sinP - 0.5
      const fy = oy + x * sinP + y * cosP - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      if (x0 < 0 || y0 < 0 || x0 + 1 >= bw || y0 + 1 >= bh) continue
      const tx = fx - x0
      const ty = fy - y0
      const k = color[i] * 3
      const cr = palette[k] * squash
      const cg = palette[k + 1] * squash
      const cb = palette[k + 2] * squash
      const p = y0 * bw + x0
      add(p, a * (1 - tx) * (1 - ty), cr, cg, cb)
      add(p + 1, a * tx * (1 - ty), cr, cg, cb)
      add(p + bw, a * (1 - tx) * ty, cr, cg, cb)
      add(p + bw + 1, a * tx * ty, cr, cg, cb)
    }
  }

  /** Move the finished refill into `image` (straight RGBA) and upload it. */
  function publish() {
    if (!image || !bufCtx) return
    const data = image.data
    for (let t = 0; t < shownCount; t++) data[shown[t] * 4 + 3] = 0
    for (let t = 0; t < touchedCount; t++) {
      const index = touched[t]
      const k = index * 3
      const lr = accum[k]
      const lg = accum[k + 1]
      const lb = accum[k + 2]
      const alpha = Math.min(1, Math.max(lr, lg, lb))
      const q = index * 4
      data[q] = (lr / alpha) * 255
      data[q + 1] = (lg / alpha) * 255
      data[q + 2] = (lb / alpha) * 255
      data[q + 3] = alpha * 255
    }
    // The touched list becomes the shown list; reuse the old one next time.
    const swap = shown
    shown = touched
    shownCount = touchedCount
    touched = swap
    touchedCount = 0
    generation = (generation + 1) >>> 0 || 1
    bufCtx.putImageData(image, 0, 0)
    ready = true
  }

  function draw(ctx: CanvasRenderingContext2D, view: DiskView, time: number, complete: boolean) {
    const { cx, cy, r, tilt, planeAngle } = view
    if (r !== sizedFor.r || tilt !== sizedFor.tilt || planeAngle !== sizedFor.planeAngle) {
      sizedFor = { r, tilt, planeAngle }
      allocate(view)
    }
    if (!canvas || !image) return
    if (complete || !ready) {
      // Whole refill now: still frames, the first frame and after a resize.
      touchedCount = 0
      generation = (generation + 1) >>> 0 || 1
      splat(view, time, 0, n)
      publish()
      next = 0
    } else {
      const to = Math.min(n, next + Math.ceil(n / FILL_FRAMES))
      splat(view, time, next, to)
      next = to
      if (next >= n) {
        publish()
        next = 0
      }
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(canvas, cx - bw / 2, cy - bh / 2)
    ctx.restore()
  }

  return {
    draw,
    dispose() {
      sizedFor = { r: 0, tilt: 0, planeAngle: 0 }
      canvas = null
      bufCtx = null
      image = null
      accum = new Float32Array(0)
      stamp = new Uint32Array(0)
      touched = new Int32Array(0)
      shown = new Int32Array(0)
      touchedCount = 0
      shownCount = 0
      ready = false
    },
  }
}
