import { runToEnd } from './build'
import { makeCanvas, rgba, spread, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneBuild, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Projects scene (S27): a few distinct planets drifting at different depths.
 * A large banded gas giant fills the bottom-right corner (near), a ringed ice
 * planet floats top right (middle distance), a cratered rocky world sits on
 * the left edge and a tiny blue planet is far away near the top. All are lit
 * from the upper left. Near planets drift and parallax more than far ones.
 *
 * Cost per frame: the starfield, one sprite per small planet, and the gas
 * giant. The small planets (rings, shading and atmosphere included) are each
 * baked into a single sprite on create/resize, because nothing moves inside
 * them. The gas giant's clouds flow (V0.64): see "Gas giant" below for how
 * that stays cheap. `create` is a generator (S29) because the gas giant's
 * band texture takes a few slices to paint; `resize` runs it to the end.
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

/**
 * Gas giant (V0.64): Jupiter-like belts and zones that flow.
 *
 * The clouds are painted once into a wrapping band texture: an
 * equirectangular strip, 360° of longitude across and pole to pole down.
 * Every band of rows flows at its own speed. A cached lookup maps each
 * visible pixel of the disk to its texture row and longitude on the sphere,
 * so a frame is one table walk (texel = row + (longitude + band offset) mod
 * width) over the part of the disk that can be on screen. It steps
 * `GAS_UPDATE_HZ` times a second, and the work is spread over the frames
 * between steps (`GAS_SLICES`). Lighting, limb darkening and the atmosphere
 * glow are the same as before, baked once into an overlay laid on top.
 */
interface GasBand {
  /** Latitude of the band's top and bottom edge in degrees (north, i.e. up, positive). */
  top: number
  bottom: number
  color: Rgb
  /** Seconds per full turn. Positive flows left on screen, negative right. */
  period: number
}

/** North to south. Neighbours flow at different speeds, mostly in opposite directions. */
const GAS_BANDS: readonly GasBand[] = [
  { top: 90, bottom: 60, color: [150, 128, 110], period: 260 }, // north polar region
  { top: 60, bottom: 50, color: [186, 148, 110], period: -170 }, // tan belt with white ovals
  { top: 50, bottom: 41, color: [228, 204, 166], period: 125 }, // cream zone
  { top: 41, bottom: 32, color: [176, 106, 70], period: -100 }, // rust belt
  { top: 32, bottom: 11, color: [234, 214, 180], period: 150 }, // white zone with the storm
  { top: 11, bottom: 2, color: [148, 90, 62], period: -120 }, // brown belt
  { top: 2, bottom: -13, color: [238, 220, 188], period: 85 }, // equatorial zone, festoons
  { top: -13, bottom: -25, color: [172, 116, 82], period: -115 }, // tan-brown belt
  { top: -25, bottom: -38, color: [228, 204, 168], period: 140 }, // cream zone
  { top: -38, bottom: -50, color: [196, 156, 116], period: -160 }, // tan belt
  { top: -50, bottom: -90, color: [146, 126, 108], period: 240 }, // south polar region
]
/** The storm: band index, centre (degrees, longitude 0 = facing us at time 0) and half-size. */
const STORM = { band: 4, lat: 21.5, lon: -28, halfWidth: 12, halfHeight: 6 }
/** Equatorial zone (festoons along its top edge) and the belt with white ovals. */
const FESTOON_BAND = 6
const OVAL_BAND = 1
/** Same turn as the old still planet. */
const GAS_TILT = 0.22
/** Cloud steps per second; the fastest band moves about a pixel per step. */
const GAS_UPDATE_HZ = 15
/**
 * The cloud layer is re-rendered in this many row slices, one per frame in
 * turn, so a step's work is spread over the frames between steps.
 */
const GAS_SLICES = 4
/** Largest texture width; also caps the sharpness at DPR > 1. */
const GAS_MAX_TEXTURE = 2048
const GAS_MAX_SCALE = 2
/** The band texture is painted at this fraction of its size, then smoothed up. */
const GAS_PAINT_SCALE = 0.5

interface GasTexture {
  /** Size of one turn of the strip in texels. */
  width: number
  height: number
  /** Texels, each row stored twice side by side (stride 2 × width), so a lookup never wraps. */
  texels: Uint32Array
  /** Band index of every texture row. */
  rowBand: Uint8Array
}

let gasTextureCache: GasTexture | null = null

/** Mix two colours (t = 0: a, 1: b). */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

/** Lighten (amount > 0) or darken (< 0) a colour. */
function tint(c: Rgb, amount: number): Rgb {
  return amount >= 0 ? mix(c, [255, 250, 240], amount) : mix(c, [70, 40, 30], -amount)
}

/** Paint the wrapping band texture, `width` px for 360° of longitude, yielding between bands. */
function* paintGasTexture(width: number): Generator<unknown, GasTexture, undefined> {
  const height = width / 2
  // Painted at half size and smoothed up: soft cloud edges for free.
  const canvas = makeCanvas(width * GAS_PAINT_SCALE, height * GAS_PAINT_SCALE)
  const rowBand = new Uint8Array(height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width, height, texels: new Uint32Array(width * height * 2), rowBand }
  ctx.scale(GAS_PAINT_SCALE, GAS_PAINT_SCALE)
  const random = createRandom(2764)
  const deg = width / 360
  const row = (lat: number) => (0.5 - lat / 180) * height
  const col = (lon: number) => (((lon / 360) % 1) + 1) % 1 * width
  /** Paint at x and, where it would cross a texture edge, again one turn over, so the strip wraps seamlessly. */
  const wrapped = (x: number, reach: number, paint: (x: number) => void) => {
    paint(x)
    if (x - reach < 0) paint(x + width)
    if (x + reach > width) paint(x - width)
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, color: Rgb, alpha: number) => {
    wrapped(x, rx, (px) => {
      ctx.beginPath()
      ctx.ellipse(px, y, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = rgba(color, alpha)
      ctx.fill()
    })
  }
  /** A flattened spiral (an eddy), `sense` +1 or -1 for its turning direction. */
  const curl = (x: number, y: number, rad: number, sense: number, color: Rgb, alpha: number, line: number) => {
    const turns = between(random, 1.3, 2.1) * Math.PI * 2
    const start = random() * Math.PI * 2
    wrapped(x, rad * 1.8, (px) => {
      ctx.beginPath()
      for (let a = 0; a <= turns; a += 0.2) {
        const k = rad * (1 - (a / turns) * 0.85)
        ctx.lineTo(px + Math.cos(start + a * sense) * k * 1.7, y + Math.sin(start + a * sense) * k)
      }
      ctx.strokeStyle = rgba(color, alpha)
      ctx.lineWidth = line
      ctx.stroke()
    })
  }

  for (let b = 0; b < GAS_BANDS.length; b++) {
    const band = GAS_BANDS[b]
    const v0 = Math.round(row(band.top))
    const v1 = Math.round(row(band.bottom))
    rowBand.fill(b, v0, v1)
    const above = GAS_BANDS[b - 1]
    const below = GAS_BANDS[b + 1]
    const polar = band.top === 90 || band.bottom === -90
    ctx.save()
    // Everything for a band stays inside its rows: they all flow together.
    ctx.beginPath()
    ctx.rect(0, v0, width, v1 - v0)
    ctx.clip()
    ctx.fillStyle = rgba(band.color, 1)
    ctx.fillRect(0, v0, width, v1 - v0)
    // Soft relief: a little lighter in the middle of the band.
    const relief = ctx.createLinearGradient(0, v0, 0, v1)
    relief.addColorStop(0, 'rgb(255 250 240 / 0)')
    relief.addColorStop(0.5, 'rgb(255 250 240 / 0.07)')
    relief.addColorStop(1, 'rgb(255 250 240 / 0)')
    ctx.fillStyle = relief
    ctx.fillRect(0, v0, width, v1 - v0)

    // Streaks stretched along the flow.
    const streaks = Math.round(((v1 - v0) / deg) * (polar ? 10 : 9))
    for (let i = 0; i < streaks; i++) {
      const y = between(random, v0, v1)
      const len = between(random, 5, polar ? 14 : 34) * deg
      const other = (random() < 0.5 ? above : below) ?? band
      const color = random() < 0.25 ? mix(band.color, other.color, 0.5) : tint(band.color, between(random, -0.3, 0.15))
      ellipse(random() * width, y, len / 2, between(random, 0.2, polar ? 1.2 : 0.7) * deg, color, between(random, 0.18, 0.42))
    }
    yield

    // Wavy edges: each neighbour's colour reaches into this band in scallops, so
    // where the bands meet the waves on either side slide past each other.
    for (const [edge, other, dir] of [
      [v0, above, 1],
      [v1, below, -1],
    ] as const) {
      if (!other || polar) continue
      const n = Math.round(between(random, 9, 22))
      const n2 = n * 2 + 1
      const amp = between(random, 0.5, 1.3) * deg
      const ph = random() * Math.PI * 2
      const ph2 = random() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, edge)
      for (let x = 0; x <= width; x += 3) {
        const t = (x / width) * Math.PI * 2
        const wave = amp * (0.55 + 0.45 * Math.sin(t * n + ph)) + amp * 0.15 * Math.sin(t * n2 + ph2)
        ctx.lineTo(x, edge + dir * Math.max(0, wave))
      }
      ctx.lineTo(width, edge)
      ctx.closePath()
      ctx.fillStyle = rgba(mix(other.color, band.color, 0.25), 0.65)
      ctx.fill()
      // Curls along the edge, turning with the shear between the two bands.
      const sense = Math.sign(1 / other.period - 1 / band.period) * dir || 1
      const curls = 4 + Math.floor(random() * 3)
      for (let i = 0; i < curls; i++) {
        const rad = between(random, 1.4, 2.6) * deg
        const x = random() * width
        const y = edge + dir * (rad * between(random, 0.7, 1.4))
        ellipse(x, y, rad * 1.6, rad * 0.9, mix(other.color, band.color, 0.6), 0.3)
        curl(x, y, rad, sense, mix(other.color, band.color, 0.3), 0.45, between(random, 0.45, 0.7) * deg)
      }
    }

    if (polar) {
      // Mottled polar haze with a few small cyclones.
      const blobs = Math.round(((v1 - v0) / deg) * 6)
      for (let i = 0; i < blobs; i++) {
        const s = between(random, 0.8, 2.5) * deg
        ellipse(random() * width, between(random, v0, v1), s * 1.6, s, tint(band.color, between(random, -0.3, 0.3)), between(random, 0.15, 0.35))
      }
      for (let i = 0; i < 8; i++) {
        const rad = between(random, 1, 1.8) * deg
        curl(random() * width, between(random, v0 + rad, v1 - rad), rad, random() < 0.5 ? 1 : -1, tint(band.color, 0.3), 0.5, 0.35 * deg)
      }
    }

    if (b === OVAL_BAND) {
      // A string of small white ovals.
      for (let i = 0; i < 6; i++) {
        const x = col(-60 + i * 55 + between(random, -10, 10))
        const y = (v0 + v1) / 2 + between(random, -1, 1) * deg
        ellipse(x, y, 2.6 * deg, 1.5 * deg, tint(band.color, -0.25), 0.5)
        ellipse(x, y, 2 * deg, 1.1 * deg, [246, 240, 228], 0.85)
      }
    }

    if (b === FESTOON_BAND) {
      // Dark blue-grey festoons trailing from the belt above into the bright zone.
      for (let i = 0; i < 9; i++) {
        const x = random() * width
        const len = between(random, 5, 10) * deg
        const drop = between(random, 2.5, 5) * deg
        wrapped(x, len * 1.2, (px) => {
          ctx.beginPath()
          ctx.ellipse(px + len * 0.45, v0 + drop * 0.4, len * 0.55, drop * 0.3, 0.3, 0, Math.PI * 2)
          ctx.fillStyle = rgba([132, 116, 112], 0.3)
          ctx.fill()
        })
      }
    }

    if (b === STORM.band) {
      const sx = col(STORM.lon)
      const sy = row(STORM.lat)
      const w = STORM.halfWidth * deg
      const h = STORM.halfHeight * deg
      // Turbulent wake trailing behind the storm (it flows left).
      for (let i = 0; i < 14; i++) {
        const x = sx + w * between(random, 1, 3.6)
        const y = sy + spread(random) * h * 0.9
        const rad = between(random, 0.8, 1.8) * deg
        curl(x, y, rad, random() < 0.5 ? 1 : -1, tint([206, 146, 106], between(random, -0.1, 0.15)), 0.35, 0.5 * deg)
      }
      for (let i = 0; i < 10; i++) {
        ellipse(sx + w * between(random, 1, 4), sy + spread(random) * h, between(random, 3, 8) * deg, between(random, 0.3, 0.7) * deg, [222, 170, 130], 0.35)
      }
      // Pale collar, the red oval, a darker rim and inner swirls.
      ellipse(sx, sy, w * 1.3, h * 1.32, [246, 232, 206], 0.6)
      wrapped(sx, w * 1.4, (px) => {
        ctx.save()
        ctx.translate(px, sy)
        ctx.scale(1, h / w)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w)
        g.addColorStop(0, 'rgb(186 84 56)')
        g.addColorStop(0.5, 'rgb(196 94 62)')
        g.addColorStop(0.78, 'rgb(208 124 86 / 0.95)')
        g.addColorStop(1, 'rgb(220 160 120 / 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, w, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
      curl(sx, sy, h * 0.75, -1, [228, 150, 112], 0.35, 0.6 * deg)
      curl(sx - w * 0.1, sy + h * 0.05, h * 0.45, -1, [168, 72, 50], 0.3, 0.5 * deg)
    }
    ctx.restore()
    yield
  }
  const full = makeCanvas(width, height)
  const fctx = full.getContext('2d')
  if (!fctx) return { width, height, texels: new Uint32Array(width * height * 2), rowBand }
  fctx.imageSmoothingQuality = 'high'
  fctx.drawImage(canvas, 0, 0, width, height)
  yield
  const once = new Uint32Array(fctx.getImageData(0, 0, width, height).data.buffer)
  // Band edges fall between half-size pixels; keep every texel opaque so no seam shows through.
  for (let i = 0; i < once.length; i++) once[i] |= 0xff000000
  const texels = new Uint32Array(width * height * 2)
  for (let v = 0; v < height; v++) {
    const rowTexels = once.subarray(v * width, (v + 1) * width)
    texels.set(rowTexels, v * width * 2)
    texels.set(rowTexels, v * width * 2 + width)
  }
  return { width, height, texels, rowBand }
}

function* gasTexture(width: number): Generator<unknown, GasTexture, undefined> {
  if (gasTextureCache?.width === width) return gasTextureCache
  const texture = yield* paintGasTexture(width)
  gasTextureCache = texture
  return texture
}

/** The visible part of the gas giant: cloud layer, lighting overlay and the lookup between them. */
interface GasGiant {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  image: ImageData
  out: Uint32Array
  overlay: HTMLCanvasElement
  /** Region in sprite CSS pixels: offset from the sprite's top-left corner and size. */
  left: number
  top: number
  width: number
  height: number
  texture: GasTexture
  /**
   * The disk as runs of neighbouring pixels in the same band: where each run
   * starts in `out`, its length and band. `source` holds, per pixel in run
   * order, the texel index at time 0 (row start + longitude column).
   */
  runStart: Int32Array
  runLength: Int32Array
  runBand: Uint8Array
  source: Int32Array
  /** Antialiased limb: indices in `out` and their alpha, already shifted into the top byte. */
  edgeDst: Int32Array
  edgeAlpha: Uint32Array
  /**
   * Per slice (GAS_SLICES + 1 entries each): first run, first `source`
   * index, first edge pixel and first row of each slice.
   */
  sliceRun: Int32Array
  sliceSource: Int32Array
  sliceEdge: Int32Array
  sliceRow: Int32Array
  /** Step each slice was last rendered at (-1: never). */
  sliceStep: Int32Array
  /** Slice to render next. */
  nextSlice: number
  offsets: Int32Array
  rows: number
  cols: number
}

/**
 * Build the gas giant for radius `r` and a sprite `size` px square, keeping
 * only the region (sprite px) that can ever be on screen.
 */
function* makeGasGiant(
  r: number,
  size: number,
  region: { left: number; top: number; right: number; bottom: number },
  scale: number,
): Generator<unknown, GasGiant | null, undefined> {
  const left = Math.max(0, Math.floor(region.left))
  const top = Math.max(0, Math.floor(region.top))
  const right = Math.min(size, Math.ceil(region.right))
  const bottom = Math.min(size, Math.ceil(region.bottom))
  if (right <= left || bottom <= top) return null
  const texWidth = Math.min(GAS_MAX_TEXTURE, Math.ceil((Math.PI * 2 * r * scale) / 64) * 64)
  const texture = yield* gasTexture(texWidth)
  yield
  const c = size / 2
  const cols = Math.ceil((right - left) * scale)
  const rows = Math.ceil((bottom - top) * scale)
  const canvas = makeCanvas(cols, rows)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(cols, rows)
  const out = new Uint32Array(image.data.buffer)

  const cos = Math.cos(GAS_TILT)
  const sin = Math.sin(GAS_TILT)
  const source = new Int32Array(cols * rows)
  const runStart: number[] = []
  const runLength: number[] = []
  const runBand: number[] = []
  const edgeDst: number[] = []
  const edgeAlpha: number[] = []
  let n = 0
  const random = createRandom(2765)
  const jitter = () => random() - 0.5
  const tw = texture.width
  const th = texture.height
  const sliceRun = new Int32Array(GAS_SLICES + 1)
  const sliceSource = new Int32Array(GAS_SLICES + 1)
  const sliceEdge = new Int32Array(GAS_SLICES + 1)
  const sliceRow = new Int32Array(GAS_SLICES + 1)
  let slice = 0
  for (let j = 0; j < rows; j++) {
    // Slice boundaries fall on whole rows.
    while (slice < GAS_SLICES && j >= Math.round((rows * slice) / GAS_SLICES)) {
      sliceRun[slice] = runStart.length
      sliceSource[slice] = n
      sliceEdge[slice] = edgeDst.length
      sliceRow[slice] = j
      slice++
    }
    const py = top + (j + 0.5) / scale - c
    let open = false
    for (let i = 0; i < cols; i++) {
      const px = left + (i + 0.5) / scale - c
      const d = Math.hypot(px, py)
      const cover = Math.min(1, (r - d) * scale + 0.5)
      if (cover <= 0) {
        open = false
        continue
      }
      // On the sphere: rotate into the planet's frame, then latitude and longitude.
      const k = d > r * 0.999 ? (r * 0.999) / d : 1
      const nx = ((px * cos + py * sin) * k) / r
      const ny = ((py * cos - px * sin) * k) / r
      // A fixed sub-texel jitter turns the stair steps of nearest sampling into a soft edge.
      const v = Math.min(th - 1, Math.max(0, Math.floor((Math.asin(ny) / Math.PI + 0.5) * th + jitter() * 1.5)))
      const across = Math.sqrt(Math.max(1e-9, 1 - ny * ny))
      const u = Math.asin(Math.max(-1, Math.min(1, nx / across))) / (Math.PI * 2)
      const p = j * cols + i
      const b = texture.rowBand[v]
      if (open && runBand[runBand.length - 1] === b) runLength[runLength.length - 1]++
      else {
        runStart.push(p)
        runLength.push(1)
        runBand.push(b)
        open = true
      }
      source[n++] = v * tw * 2 + (Math.floor((u + 1) * tw + jitter()) % tw)
      if (cover < 1) {
        edgeDst.push(p)
        edgeAlpha.push(Math.round(cover * 255) * 0x1000000)
      }
    }
    if (j % 32 === 31) yield
  }
  for (; slice <= GAS_SLICES; slice++) {
    sliceRun[slice] = runStart.length
    sliceSource[slice] = n
    sliceEdge[slice] = edgeDst.length
    sliceRow[slice] = rows
  }

  // Lighting and glow exactly as the old baked planet, cropped to the region.
  const overlay = makeCanvas(cols, rows)
  const octx = overlay.getContext('2d')
  if (octx) {
    octx.scale(scale, scale)
    octx.translate(-left, -top)
    octx.save()
    octx.beginPath()
    octx.arc(c, c, r, 0, Math.PI * 2)
    octx.clip()
    shade(octx, c, c, r, 0.95)
    octx.restore()
    atmosphere(octx, c, c, r, [255, 200, 160], 0.35)
  }
  return {
    canvas,
    ctx,
    image,
    out,
    overlay,
    left,
    top,
    width: cols / scale,
    height: rows / scale,
    texture,
    runStart: Int32Array.from(runStart),
    runLength: Int32Array.from(runLength),
    runBand: Uint8Array.from(runBand),
    source: source.slice(0, n),
    edgeDst: Int32Array.from(edgeDst),
    edgeAlpha: Uint32Array.from(edgeAlpha),
    sliceRun,
    sliceSource,
    sliceEdge,
    sliceRow,
    sliceStep: new Int32Array(GAS_SLICES).fill(-1),
    nextSlice: 0,
    offsets: new Int32Array(GAS_BANDS.length),
    rows,
    cols,
  }
}

/**
 * Bring the cloud layer up to `time`: one slice per call in turn, or every
 * slice on the very first frame (so a still frame is complete).
 */
function renderGas(gas: GasGiant, time: number) {
  const step = Math.floor(time * GAS_UPDATE_HZ)
  const t = step / GAS_UPDATE_HZ
  const { offsets } = gas
  const width = gas.texture.width
  for (let b = 0; b < GAS_BANDS.length; b++) {
    const turns = t / GAS_BANDS[b].period
    offsets[b] = Math.floor((turns - Math.floor(turns)) * width) % width
  }
  if (gas.sliceStep[0] < 0) {
    for (let i = 0; i < GAS_SLICES; i++) renderGasSlice(gas, i, step)
    return
  }
  for (let tries = 0; tries < GAS_SLICES; tries++) {
    const i = gas.nextSlice
    gas.nextSlice = (i + 1) % GAS_SLICES
    if (gas.sliceStep[i] !== step) {
      renderGasSlice(gas, i, step)
      return
    }
  }
}

function renderGasSlice(gas: GasGiant, i: number, step: number) {
  gas.sliceStep[i] = step
  const { out, runStart, runLength, runBand, source, offsets, edgeDst, edgeAlpha } = gas
  const { texels } = gas.texture
  // The hot loop: one texel copy per pixel, no wrapping (rows are stored twice).
  let k = gas.sliceSource[i]
  for (let run = gas.sliceRun[i]; run < gas.sliceRun[i + 1]; run++) {
    const off = offsets[runBand[run]]
    let p = runStart[run]
    const end = k + runLength[run]
    while (k < end) out[p++] = texels[source[k++] + off]
  }
  for (let e = gas.sliceEdge[i]; e < gas.sliceEdge[i + 1]; e++) out[edgeDst[e]] = (out[edgeDst[e]] & 0xffffff) | edgeAlpha[e]
  const y = gas.sliceRow[i]
  const h = gas.sliceRow[i + 1] - y
  if (h <= 0) return
  gas.ctx.putImageData(gas.image, 0, 0, 0, y, gas.cols, h)
  // Lighting and glow go on as each slice is re-rendered, so a frame draws the planet once.
  gas.ctx.drawImage(gas.overlay, 0, y, gas.cols, h, 0, y, gas.cols, h)
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
function makePlanet(kind: Exclude<Kind, 'gas'>, r: number, seed: number): HTMLCanvasElement {
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
  if (kind === 'rocky') paintRocky(ctx, c, c, r, random)
  else paintIce(ctx, c, c, r, random, kind === 'ringed')
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.clip()
  shade(ctx, c, c, r, 0.9)
  ctx.restore()
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
  /** Baked sprite; null for the gas giant, which draws `gas` instead. */
  sprite: HTMLCanvasElement | null
  gas: GasGiant | null
  /** Sprite size in CSS pixels (square). */
  size: number
  x: number
  y: number
  r: number
  spec: PlanetSpec
}

/** How far a planet drifts (px) and the most its parallax shifts it up (px). Same math as `draw`. */
function driftReach(width: number, spec: PlanetSpec) {
  const reach = Math.min(width, 900)
  return { amp: reach * (0.006 + 0.018 * spec.depth), maxShift: 15 + 45 * spec.depth }
}

function* createPlanets(setup: SceneSetup): SceneBuild {
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
  yield

  let placed: Placed[] = []

  function* build({ width, height, dpr }: SceneSize): Generator<unknown, void, undefined> {
    const mobile = width < 768
    const unit = mobile ? width : Math.min(width, height)
    const next: Placed[] = []
    for (let i = 0; i < PLANETS.length; i++) {
      const spec = PLANETS[i]
      const p = mobile ? spec.mobile : spec.desktop
      const minR = spec.kind === 'gas' ? 90 : spec.kind === 'ice' ? 3 : 7
      const r = Math.max(minR, p.r * unit)
      const x = p.x * width
      const y = p.y * height
      if (spec.kind !== 'gas') {
        const sprite = makePlanet(spec.kind, r, 2710 + i)
        next.push({ sprite, gas: null, size: sprite.width, x, y, r, spec })
        continue
      }
      // Same sprite size as the old baked gas giant, so it sits exactly where it did.
      const size = Math.max(1, Math.ceil(r * 1.15 * 2))
      const { amp, maxShift } = driftReach(width, spec)
      // Sprite pixels that can reach the viewport at any drift and scroll.
      const region = {
        left: size / 2 - x - amp - 1,
        right: width - (x - amp - size / 2) + 1,
        top: size / 2 - y - amp * 0.45 - 1,
        bottom: height - (y - amp * 0.45 - maxShift - size / 2) + 1,
      }
      const scale = Math.min(GAS_MAX_SCALE, Math.max(1, dpr))
      const gas = yield* makeGasGiant(r, size, region, scale)
      next.push({ sprite: null, gas, size, x, y, r, spec })
    }
    placed = next
  }

  yield* build(setup)

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    const { ctx, time, scrollY, width } = frame
    for (const { sprite, gas, size, x, y, spec } of placed) {
      // Slow figure-eight drift; nearer planets drift further.
      const { amp, maxShift } = driftReach(width, spec)
      const t = (time / spec.period) * Math.PI * 2 + spec.phase
      const dx = Math.sin(t) * amp
      const dy = Math.sin(t * 2) * amp * 0.45
      const shift = Math.min(scrollY * (0.01 + 0.05 * spec.depth), maxShift)
      const left = x + dx - size / 2
      const top = y + dy - shift - size / 2
      if (sprite) ctx.drawImage(sprite, left, top)
      else if (gas) {
        renderGas(gas, time)
        ctx.drawImage(gas.canvas, left + gas.left, top + gas.top, gas.width, gas.height)
      }
    }
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      runToEnd(build(next))
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
