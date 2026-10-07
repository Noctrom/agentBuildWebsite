import { runToEnd } from './build'
import { makeCanvas, makeSoftDot, rgba, type Rgb } from './canvas'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneBuild, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * About scene (S27): a close view of a star. A large sun sits on the right
 * edge, mostly off-screen, so its limb curves down the side of the page and
 * frames the text instead of sitting behind it. Soft prominences rise and
 * fade on the visible limb and the corona breathes. Drawn over a sparse,
 * warm starfield.
 *
 * Churning surface (V0.65): small bright cells with dark lanes boil over
 * larger bright and dark swells that roll slowly across the disk, and every
 * 20-40 s (random) a sunburst flares on the limb: a bright patch flashes
 * over ~2 s while a jet or loop of gas erupts off the edge and fades within
 * 3.8-5 s. No burst comes in the first 20 s, and a still frame (reduced
 * motion, time 0) never shows one.
 *
 * Cost per frame: the starfield, the disk, three pattern fills of one disk
 * path (the swells and two boiling-cell frames crossfading), the corona
 * overlay, two flare glows, a few prominence sprites and, during a burst,
 * four small sprite draws. Nothing is computed per pixel per frame:
 * - The cells are a small seamless tile baked per pixel (a weighted Voronoi
 *   pattern) for each of `CELL_FRAMES` steps of a looping boil, at device
 *   resolution (up to 2x). The disk shows two adjacent steps crossfading,
 *   repeated as a canvas pattern, so the boiling costs two fills.
 * - The swells are one larger soft tile, drifting as a pattern.
 * - The corona overlay also holds the limb darkening and the sunspots: drawn
 *   over the cells, it fades them out toward the limb (as the old
 *   granulation's mask did) without a per-frame mask.
 * Pattern offsets are snapped to device pixels, so no fill is resampled at
 * the standard resolution.
 *
 * The bake is a generator (S31, see "Heavy setup" in `types.ts`): it yields
 * between sprites and every few rows of the cell tiles, and the engine
 * spreads the work over frames. `resize` runs the same bake to the end at
 * once with `runToEnd`.
 */

/** Sun color from the `sun` palette (#fbbf4d). */
const SUN: Rgb = [251, 191, 77]
const PARALLAX = 0.03
const MAX_PARALLAX = 40
const TAU = Math.PI * 2
/** Prominence sprite padding (for the glow) and where the feet sit within it, as fractions. */
const PROMINENCE_PAD = 0.6
const FOOT = 0.4
/**
 * Granulation cells the pre-V0.65 bake drew per layer, and random numbers
 * per cell. The bake no longer draws them, but skips as many random numbers
 * so the prominences keep exactly their old shapes.
 */
const OLD_GRANULE_RANDOMS = 4

/** Boiling cells: grid of cells per tile side, cell size (fraction of r, min px) and loop. */
const CELL_GRID = 8
const CELL_SIZE = 0.034
const CELL_MIN_PX = 5
/** Steps in one boil loop, and its length in seconds (one crossfade per second). */
const CELL_FRAMES = 8
const BOIL_PERIOD = 8
/** Cell tiles are baked at the device resolution, up to this scale. */
const CELL_MAX_SCALE = 2
/** Opacity of the cell layer. */
const CELL_ALPHA = 0.85
/** Tile pixels per bake slice (each slice stays well under 5 ms on a slow phone). */
const CELL_PIXELS_PER_SLICE = 3000
/** Swell and cell drift across the disk, in r per second (down and slightly left). */
const SWELL_DRIFT = { x: -0.011, y: 0.026 } as const
const CELL_DRIFT = { x: -0.007, y: 0.017 } as const

/** Time between burst starts (s), and how long a burst lasts (s). */
const BURST_GAP = [20, 40] as const
const BURST_LENGTH = [3.8, 5] as const
/** The surface flash: rises over FLASH_RISE s, gone at FLASH_END s. */
const FLASH_RISE = 0.4
const FLASH_END = 2
/** The eruption starts this long after the flash, grows for ERUPT_GROW s, then stretches outward and fades. */
const ERUPT_DELAY = 0.15
const ERUPT_GROW = 1.4
const ERUPT_FADE_FROM = 1.8
/** How far the eruption travels out (in r) by the end of the burst. */
const ERUPT_LIFT = 0.3
/** Keep burst sites at least this far (fraction of r, min px) inside the viewport. */
const BURST_MARGIN = 0.06

/** Smoothstep from 0 to 1 over t in [0, 1]. */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

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

/**
 * Angles (radians) of the visible limb where a burst may start: the limb
 * point must be at least a margin inside the viewport. Bursts pick a place
 * between `from` and `to`.
 */
function burstArc({ cx, cy, r }: Layout, { width, height }: SceneSize): { from: number; to: number } {
  const m = Math.max(12, r * BURST_MARGIN)
  let from = Infinity
  let to = -Infinity
  for (let deg = 90; deg <= 270; deg++) {
    const a = (deg * Math.PI) / 180
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (x <= width - m && y >= m && y <= height - m) {
      from = Math.min(from, a)
      to = Math.max(to, a)
    }
  }
  if (from > to) return { from: Math.PI, to: Math.PI }
  return { from, to }
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

/** Sunspot group on the visible side: angle (deg), distance (r), size (r). */
const SPOTS = [
  [158, 0.55, 0.06],
  [163, 0.6, 0.035],
  [152, 0.5, 0.025],
] as const

/**
 * Overlay drawn over the disk's surface layers: the corona glow with faint
 * streamers outside the disk, and inside it the limb darkening (which fades
 * the cells and swells out toward the edge) and the sunspot group.
 */
function makeOverlay(r: number, random: () => number): HTMLCanvasElement {
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
  // The disk itself shows through: clear the corona inside the limb.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(outer, outer, r, 0, TAU)
  ctx.fill()
  // Limb darkening in the disk's own colors, opaque at the edge.
  ctx.globalCompositeOperation = 'source-over'
  const limb = ctx.createRadialGradient(outer, outer, 0, outer, outer, r)
  limb.addColorStop(0, 'rgb(255 214 125 / 0)')
  limb.addColorStop(0.62, 'rgb(255 210 120 / 0)')
  limb.addColorStop(0.8, 'rgb(252 194 83 / 0.22)')
  limb.addColorStop(0.9, 'rgb(243 161 62 / 0.5)')
  limb.addColorStop(0.97, 'rgb(232 120 42 / 0.88)')
  limb.addColorStop(1, 'rgb(205 90 34 / 1)')
  ctx.fillStyle = limb
  ctx.fill()
  // Sunspots: penumbra, then umbra.
  for (const [deg, dist, size] of SPOTS) {
    const a = (deg * Math.PI) / 180
    const x = outer + Math.cos(a) * dist * r
    const y = outer + Math.sin(a) * dist * r
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

/** Disk: limb darkening toward orange and faint mottling. */
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
  return canvas
}

/** A seamless tile, its pattern, and the pattern's transform (reused every frame). */
interface Tile {
  canvas: HTMLCanvasElement
  pattern: CanvasPattern | null
  /** Tile pixels per CSS pixel. */
  scale: number
  /** Tile size in CSS pixels. */
  width: number
  height: number
}

function makeTile(canvas: HTMLCanvasElement, scale: number): Tile {
  const pattern = canvas.getContext('2d')?.createPattern(canvas, 'repeat') ?? null
  return { canvas, pattern, scale, width: canvas.width / scale, height: canvas.height / scale }
}

/**
 * Boiling cells (granulation): `CELL_FRAMES` steps of a seamless loop, each a
 * square tile of CELL_GRID x CELL_GRID cells. Each cell is a weighted Voronoi
 * region: bright in the middle, with dark lanes along its edges. Over the
 * loop each cell brightens and fades on its own phase, swelling while bright
 * (so it squeezes its neighbors) and wandering a little.
 */
function* makeCellTiles(
  cellCss: number,
  scale: number,
  random: () => number,
): Generator<unknown, Tile[], undefined> {
  const n = CELL_GRID
  const size = Math.max(n, Math.round(n * cellCss * scale))
  const c = size / n
  const count = n * n
  const baseX = new Float32Array(count)
  const baseY = new Float32Array(count)
  const moveX = new Float32Array(count)
  const moveY = new Float32Array(count)
  const glow = new Float32Array(count)
  const rate = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    baseX[i] = ((i % n) + between(random, 0.2, 0.8)) * c
    baseY[i] = (Math.floor(i / n) + between(random, 0.2, 0.8)) * c
    moveX[i] = random() * TAU
    moveY[i] = random() * TAU
    glow[i] = random() * TAU
    rate[i] = random() < 0.65 ? 1 : 2
  }
  const px = new Float32Array(count)
  const py = new Float32Array(count)
  const bright = new Float32Array(count)
  /** 1 / cell weight: a brighter cell's distances shrink, so it swells. */
  const shrink = new Float32Array(count)
  const rows = Math.max(1, Math.floor(CELL_PIXELS_PER_SLICE / size))
  const tiles: Tile[] = []
  for (let k = 0; k < CELL_FRAMES; k++) {
    const phi = (k / CELL_FRAMES) * TAU
    for (let i = 0; i < count; i++) {
      const p = phi * rate[i]
      px[i] = baseX[i] + Math.cos(p + moveX[i]) * 0.14 * c
      py[i] = baseY[i] + Math.sin(p + moveY[i]) * 0.14 * c
      const b = 0.5 + 0.5 * Math.sin(p + glow[i])
      bright[i] = 0.2 + 0.8 * b
      shrink[i] = 1 / (1 + 0.45 * b)
    }
    const canvas = makeCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      tiles.push(makeTile(canvas, scale))
      continue
    }
    const img = ctx.createImageData(size, size)
    const data = img.data
    for (let y = 0; y < size; y++) {
      const sy = y + 0.5
      const gy = Math.min(n - 1, Math.floor(sy / c))
      for (let x = 0; x < size; x++) {
        const sx = x + 0.5
        const gx = Math.min(n - 1, Math.floor(sx / c))
        let f1 = Infinity
        let f2 = Infinity
        let near = 0
        for (let oy = -1; oy <= 1; oy++) {
          let ny = gy + oy
          let shiftY = 0
          if (ny < 0) {
            ny += n
            shiftY = -size
          } else if (ny >= n) {
            ny -= n
            shiftY = size
          }
          for (let ox = -1; ox <= 1; ox++) {
            let nx = gx + ox
            let shiftX = 0
            if (nx < 0) {
              nx += n
              shiftX = -size
            } else if (nx >= n) {
              nx -= n
              shiftX = size
            }
            const j = ny * n + nx
            const dx = px[j] + shiftX - sx
            const dy = py[j] + shiftY - sy
            const d = Math.sqrt(dx * dx + dy * dy) * shrink[j]
            if (d < f1) {
              f2 = f1
              f1 = d
              near = j
            } else if (d < f2) {
              f2 = d
            }
          }
        }
        // q: 0 at a cell's middle, 1 where two cells meet. Bright, rounded
        // granules with dark lanes between them.
        const q = f2 > 0 ? f1 / f2 : 0
        const dark = smooth((q - 0.62) / 0.38)
        const light = bright[near] * (1 - q * q) * (1 - dark)
        const o = (y * size + x) * 4
        data[o] = 255 - 65 * dark
        data[o + 1] = 248 - 163 * dark
        data[o + 2] = 222 - 197 * dark
        data[o + 3] = 255 * (0.6 * light + 0.4 * dark)
      }
      if (y % rows === rows - 1) yield
    }
    ctx.putImageData(img, 0, 0)
    tiles.push(makeTile(canvas, scale))
    yield
  }
  return tiles
}

/** Swells: a seamless tile of large soft bright and dark patches. */
function makeSwells(r: number, random: () => number): Tile {
  const w = Math.max(1, Math.round(r * 1.7))
  const h = Math.max(1, Math.round(r * 2.1))
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeTile(canvas, 1)
  const light = makeSoftDot([255, 240, 190], 64)
  const dark = makeSoftDot([196, 82, 24], 64)
  for (let i = 0; i < 26; i++) {
    const isDark = i % 2 === 1
    const s = r * between(random, 0.28, 0.58)
    const x = random() * w
    const y = random() * h
    ctx.globalAlpha = between(random, 0.38, 0.58)
    // Stamp the wrapped copies too, so the tile repeats without seams.
    for (let ox = -w; ox <= w; ox += w)
      for (let oy = -h; oy <= h; oy += h) {
        const left = x + ox - s / 2
        const top = y + oy - s / 2
        if (left < w && left + s > 0 && top < h && top + s > 0) {
          ctx.drawImage(isDark ? dark : light, left, top, s, s)
        }
      }
  }
  return makeTile(canvas, 1)
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

interface EruptionSprite {
  canvas: HTMLCanvasElement
  /** Distance from the sprite's bottom edge to the gas's feet, in px. */
  foot: number
}

/**
 * An eruption sprite for a sunburst, feet at the bottom center: a jet (a fan
 * of twisted glowing strands with a bright head) or a loop (big plasma
 * arches). `w` and `h` are the size of the gas itself; the sprite is padded
 * for the glow.
 */
function makeEruption(kind: 'jet' | 'loop', w: number, h: number, random: () => number): EruptionSprite {
  const pad = Math.max(w, h) * 0.3
  // Room below the feet for the whole foot glow, so the sprite's bottom
  // edge never cuts it, even when stretched past the limb.
  const below = w * 0.6
  const canvas = makeCanvas(w + pad * 2, h + pad + below)
  const sprite = { canvas, foot: below }
  const ctx = canvas.getContext('2d')
  if (!ctx) return sprite
  ctx.globalCompositeOperation = 'lighter'
  const baseY = canvas.height - below
  const cx = canvas.width / 2
  const foot = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, w * 0.55)
  foot.addColorStop(0, 'rgb(255 205 130 / 0.55)')
  foot.addColorStop(1, 'rgb(255 130 60 / 0)')
  ctx.fillStyle = foot
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgb(255 125 55)'
  ctx.shadowBlur = Math.max(6, Math.min(w, h) * 0.35)
  if (kind === 'jet') {
    for (let k = 0; k < 5; k++) {
      const x0 = cx + between(random, -0.1, 0.1) * w
      const x1 = cx + between(random, -0.42, 0.42) * w
      const top = baseY - h * between(random, 0.7, 0.98)
      ctx.beginPath()
      ctx.moveTo(x0, baseY)
      ctx.bezierCurveTo(
        x0 + between(random, -0.25, 0.25) * w,
        baseY - h * 0.35,
        x1 + between(random, -0.3, 0.3) * w,
        baseY - h * 0.7,
        x1,
        top,
      )
      ctx.strokeStyle = `rgb(255 ${Math.round(between(random, 160, 205))} 105 / ${between(random, 0.22, 0.38).toFixed(2)})`
      ctx.lineWidth = Math.max(2, w * between(random, 0.08, 0.16))
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    const head = makeSoftDot([255, 214, 150], 64)
    ctx.globalAlpha = 0.45
    const s = w * 0.9
    ctx.drawImage(head, cx - s / 2, baseY - h * 0.82 - s / 2, s, s)
  } else {
    for (let k = 0; k < 3; k++) {
      const half = (w / 2) * between(random, 0.7, 1)
      const top = h * between(random, 0.75, 1)
      const off = between(random, -0.08, 0.08) * w
      const lean = between(random, -0.3, 0.3) * half
      ctx.beginPath()
      ctx.moveTo(cx + off - half, baseY)
      ctx.bezierCurveTo(
        cx + off - half * 0.7 + lean,
        baseY - top * 1.25,
        cx + off + half * 0.7 + lean,
        baseY - top * 1.25,
        cx + off + half,
        baseY,
      )
      ctx.strokeStyle = k === 0 ? 'rgb(255 200 120 / 0.5)' : 'rgb(255 150 80 / 0.35)'
      ctx.lineWidth = Math.max(2, h * between(random, 0.07, 0.12))
      ctx.stroke()
    }
  }
  return sprite
}

/**
 * The burst schedule: the current (or next) burst. `at` is the place on the
 * visible limb arc (0..1), so it stays valid after a resize.
 */
interface Burst {
  /** Number of bursts planned so far. */
  count: number
  start: number
  length: number
  at: number
  kind: 0 | 1
  flip: 1 | -1
}

/**
 * Test-only hook for the contrast scan (V0.65): with
 * `window.__sunBurstTest = { every: 6, steps: 9 }` bursts come every `every`
 * seconds (at least one burst long, so still never two at once), stepping
 * along the visible limb in `steps` places, first jets, then loops. Compiled
 * in only in dev and in builds with `VITE_SUN_TEST=1`; a production build
 * drops it, so it can do nothing there.
 */
interface BurstTestHook {
  every?: number
  steps?: number
}
const TEST_HOOK_ENABLED: boolean = import.meta.env.DEV || import.meta.env.VITE_SUN_TEST === '1'

function testHook(): BurstTestHook | undefined {
  if (!TEST_HOOK_ENABLED) return undefined
  return (window as Window & { __sunBurstTest?: BurstTestHook }).__sunBurstTest
}

/** Plan the next burst: a random 20-40 s after the last one started (or after `now` for the first). */
function planBurst(burst: Burst, now: number) {
  const hook = testHook()
  const first = burst.count === 0
  if (hook) {
    const every = Math.max(BURST_LENGTH[1], hook.every ?? 6)
    const steps = Math.max(1, Math.round(hook.steps ?? 8))
    const k = burst.count
    burst.start = first ? now + 0.5 : burst.start + every
    burst.length = BURST_LENGTH[1]
    burst.at = steps > 1 ? (k % steps) / (steps - 1) : 0.5
    burst.kind = Math.floor(k / steps) % 2 === 0 ? 0 : 1
    burst.flip = k % 2 === 0 ? 1 : -1
  } else {
    burst.start = (first ? now : burst.start) + between(Math.random, BURST_GAP[0], BURST_GAP[1])
    burst.length = between(Math.random, BURST_LENGTH[0], BURST_LENGTH[1])
    burst.at = Math.random()
    burst.kind = Math.random() < 0.5 ? 0 : 1
    burst.flip = Math.random() < 0.5 ? 1 : -1
  }
  burst.count++
}

/**
 * The schedule of the sun instance drawn last, and its scene time. When the
 * engine rebuilds the scene at another resolution (V0.61) it keeps the
 * layer's time, so the new instance takes over the schedule and a burst in
 * progress carries on. A fresh visit starts at time 0 and gets a new one.
 */
let carried: Burst | null = null
let carriedTime = -Infinity

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
  let arc = burstArc(layout, setup)
  let overlay: HTMLCanvasElement | null = null
  let disk: HTMLCanvasElement | null = null
  let swells: Tile | null = null
  let cells: Tile[] = []
  let flare: HTMLCanvasElement | null = null
  let glow: HTMLCanvasElement | null = null
  let prominences: ProminenceSprite[] = []
  let eruptions: EruptionSprite[] = []
  let blob: HTMLCanvasElement | null = null
  let burst: Burst | null = null
  /** Pattern transform, reused every frame. */
  const matrix = new DOMMatrix()

  /**
   * Bake every sprite for a viewport size. Works on locals and only assigns
   * the scene's state at the end, so `draw` never sees a half-built mix of sizes.
   */
  function* build(size: SceneSize): Generator<unknown, void, undefined> {
    const nextLayout = layoutFor(size)
    const random = createRandom(2701)
    const { r } = nextLayout
    const nextOverlay = makeOverlay(r, random)
    yield
    const nextDisk = makeDisk(r, random)
    yield
    // Skip the random numbers the two old granulation layers used (see OLD_GRANULE_RANDOMS).
    const oldCell = Math.max(3, r * 0.03)
    const oldCount = Math.min(5000, Math.round(((Math.PI * r * r) / (oldCell * oldCell)) * 0.8))
    for (let i = 0; i < oldCount * OLD_GRANULE_RANDOMS * 2; i++) random()
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
    // V0.65: churning surface and sunbursts, from their own random streams.
    const nextSwells = makeSwells(r, createRandom(2702))
    yield
    const scale = Math.min(CELL_MAX_SCALE, Math.max(0.5, size.dpr))
    const cellCss = Math.max(CELL_MIN_PX, r * CELL_SIZE)
    const nextCells = yield* makeCellTiles(cellCss, scale, createRandom(2703))
    const burstRandom = createRandom(2704)
    const nextEruptions = [
      makeEruption('jet', r * 0.3, r * 0.5, burstRandom),
      makeEruption('loop', r * 0.42, r * 0.34, burstRandom),
    ]
    yield
    const nextGlow = makeSoftDot([255, 196, 120], 64)
    const nextBlob = makeSoftDot([255, 186, 110], 64)
    layout = nextLayout
    arc = burstArc(nextLayout, size)
    overlay = nextOverlay
    disk = nextDisk
    swells = nextSwells
    cells = nextCells
    flare = nextFlare
    glow = nextGlow
    blob = nextBlob
    prominences = nextProminences
    eruptions = nextEruptions
  }

  yield* build(setup)

  /** Fill the current path with a tile, its origin at (x, y) in CSS px. */
  function fillTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, alpha: number) {
    if (!tile.pattern || alpha <= 0) return
    matrix.a = 1 / tile.scale
    matrix.d = 1 / tile.scale
    matrix.e = x
    matrix.f = y
    tile.pattern.setTransform(matrix)
    ctx.fillStyle = tile.pattern
    ctx.globalAlpha = alpha
    ctx.fill()
  }

  /** One sunburst, `u` seconds after it started. */
  function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, u: number, cx: number, cy: number) {
    if (!flare || !glow || !blob) return
    const { r } = layout
    const a = arc.from + (arc.to - arc.from) * b.at
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    ctx.globalCompositeOperation = 'lighter'
    // Surface flash: one soft rise and fall, a patch on the disk near the limb.
    const flash = u < FLASH_RISE ? smooth(u / FLASH_RISE) : 1 - smooth((u - FLASH_RISE) / (FLASH_END - FLASH_RISE))
    if (flash > 0) {
      const x = cx + cos * 0.88 * r
      const y = cy + sin * 0.88 * r
      const halo = r * 0.5
      ctx.globalAlpha = 0.4 * flash
      ctx.drawImage(glow, x - halo / 2, y - halo / 2, halo, halo)
      const s = r * (0.14 + 0.1 * flash)
      ctx.globalAlpha = 0.9 * flash
      ctx.drawImage(flare, x - s / 2, y - s / 2, s, s)
    }
    // Eruption: shoots up off the limb, then stretches outward, widening and
    // fading, while a clump of ejected gas runs on ahead of it.
    const e = u - ERUPT_DELAY
    const sprite = eruptions[b.kind]
    if (e > 0 && sprite) {
      const grow = 1 - (1 - Math.min(1, e / ERUPT_GROW)) ** 3
      const travel = smooth((e - ERUPT_GROW * 0.6) / (b.length - ERUPT_DELAY - ERUPT_GROW * 0.6))
      const fade = 1 - smooth((u - ERUPT_FADE_FROM) / (b.length - ERUPT_FADE_FROM))
      const alpha = smooth(e / 0.45) * fade
      if (alpha > 0) {
        const lift = travel * ERUPT_LIFT * r
        const w = sprite.canvas.width * (1 + 0.4 * travel)
        const h = sprite.canvas.height * (0.2 + 0.8 * grow) * (1 + 1.1 * travel)
        const foot = sprite.foot * (h / sprite.canvas.height)
        ctx.save()
        ctx.translate(cx + cos * r, cy + sin * r)
        ctx.rotate(a + Math.PI / 2)
        ctx.scale(b.flip, 1)
        ctx.globalAlpha = alpha
        ctx.drawImage(sprite.canvas, -w / 2, -h + foot + r * 0.015, w, h)
        const s = r * (0.16 + 0.24 * travel)
        ctx.globalAlpha = alpha * (0.3 + 0.4 * travel)
        ctx.drawImage(blob, -s / 2, -(h - foot) * 0.85 - lift - s / 2, s, s)
        ctx.restore()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function draw(frame: SceneFrame) {
    stars.draw(frame)
    if (!overlay || !disk || !swells || !flare) return
    const { ctx, time, scrollY, dpr, reducedMotion } = frame
    const { r } = layout
    // Big sprites are blitted 1:1 at whole device pixels: scaling or
    // sub-pixel offsets made the corona the most expensive draw on phones.
    const snap = (v: number) => Math.round(v * dpr) / dpr
    const cx = snap(layout.cx)
    const cy = snap(layout.cy - Math.min(scrollY * PARALLAX, MAX_PARALLAX))

    ctx.drawImage(disk, snap(cx - r), snap(cy - r))

    // Surface: one disk path, filled with two neighboring steps of the
    // boiling cells (crossfading), then the rolling swells over them.
    ctx.beginPath()
    ctx.arc(cx, cy, r - 0.5, 0, TAU)
    if (cells.length > 0) {
      const tile = cells[0]
      const ox = snap(cx + ((time * r * CELL_DRIFT.x) % tile.width))
      const oy = snap(cy + ((time * r * CELL_DRIFT.y) % tile.height))
      const step = ((time / BOIL_PERIOD) * cells.length) % cells.length
      const k = Math.floor(step)
      const f = ((step - k) * Math.PI) / 2
      fillTile(ctx, cells[k], ox, oy, CELL_ALPHA * Math.cos(f))
      fillTile(ctx, cells[(k + 1) % cells.length], ox, oy, CELL_ALPHA * Math.sin(f))
    }
    const sw = (time * r * SWELL_DRIFT.x) % swells.width
    const sh = (time * r * SWELL_DRIFT.y) % swells.height
    fillTile(ctx, swells, snap(cx + sw), snap(cy + sh), 1)

    // Corona (breathes slowly, in brightness, not size), limb darkening and sunspots.
    const c = overlay.width / 2
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(time * 0.3)
    ctx.drawImage(overlay, snap(cx - c), snap(cy - c))

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

    // Sunbursts (never in a still frame).
    if (!reducedMotion) {
      if (!burst) {
        burst = carried && Math.abs(time - carriedTime) < 1 ? carried : { count: 0, start: 0, length: 0, at: 0, kind: 0, flip: 1 }
        if (burst.count === 0) planBurst(burst, time)
      }
      while (time >= burst.start + burst.length) planBurst(burst, time)
      carried = burst
      carriedTime = time
      const u = time - burst.start
      if (u >= 0) drawBurst(ctx, burst, u, cx, cy)
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
      overlay = disk = flare = glow = blob = null
      swells = null
      cells = []
      prominences = []
      eruptions = []
    },
  }
}

export const sunScene: Scene = {
  id: 'sun',
  create: createSun,
}
