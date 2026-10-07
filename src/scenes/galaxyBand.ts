import { makeCanvas, makeSoftDot, type Rgb } from './canvas'
import { MILKY_WAY, mix } from './galaxyPalette'
import { createValueNoise, fbm } from './noise'
import { between, createRandom } from './random'
import type { SceneSize } from './types'

/**
 * Milky Way band across the Contact sky (V0.60), after Chris's reference
 * photo (`docs/story-inbox/night-sky-Milky-Way-Galaxy.webp`): a diagonal band
 * from lower left to upper right with a gold and amber middle, broken
 * brown-black dust lanes running along it, blue-white edges fading softly
 * into the sky, and dense fine stars.
 *
 * - Desktop and tablet: it crosses the open sky left of the spiral galaxy,
 *   behind the contact text (Chris's choice), and passes behind the top of
 *   the spiral. Its warm middle sits in the open sky below the contact panel.
 * - Phones: it runs behind the galaxy, below the contact text.
 *
 * The band doesn't move. `paintBand` bakes it once per size into the Contact
 * sky layer (`galaxy.ts`), which is drawn with one `drawImage` a frame, behind
 * the starfield and the spiral (so the spiral is always in front). The only
 * motion is a few twinkling stars (`BandTwinkle`), drawn live as small
 * sprites, each on its own slow wave with a random phase, so they never pulse
 * together. With reduced motion the engine draws time 0 only, so they hold
 * still.
 *
 * Contrast: the engine shows the scene at 0.2 opacity, so the text stays AA
 * whatever is drawn. On top of that the band is dimmed softly where it
 * crosses the desktop contact text (`textDim`), and the twinkling stars stay
 * out of the text areas, so nothing changes behind the text. Numbers in the
 * V0.60 log.
 */

/** Where the spiral galaxy is (`galaxy.ts` layout), in CSS pixels. */
export interface GalaxyPlace {
  cx: number
  cy: number
  r: number
}

/** The band's centre line and size, in CSS pixels. */
interface BandShape {
  /** A point on the centre line. */
  ox: number
  oy: number
  /** Unit vector along the band, toward the upper right. */
  dx: number
  dy: number
  /** Unit normal, toward the lower right. */
  nx: number
  ny: number
  /** Half-width of the band's glow (before the warm middle widens it). */
  halfWidth: number
  /** Position of the warm middle along the band, from the point above. */
  core: number
  /** Length of the warm middle (Gaussian sigma) along the band. */
  coreLength: number
}

/** Rise of the band: radians above horizontal (the photo's band rises ~20 degrees). */
const DESKTOP_ANGLE = 0.55
const PHONE_ANGLE = 0.26
/** Peak opacity of the band glow (the canvas itself is shown at 0.2). */
const BAND_PEAK = 0.85
/** How far out the glow reaches, in band half-widths (it is ~0 beyond). */
const BAND_REACH = 1.9
/** Low-res bake: one bitmap cell per this many CSS pixels, smoothed when drawn. */
const CELL = 3
/** Bitmap rows baked between yields (each slice well under 5 ms on a slow phone). */
const ROWS_PER_SLICE = 6
/** Fine stars in the band per megapixel of the layer (at full glow). */
const BAND_STARS_PER_MEGAPIXEL = 30000
const BAND_STARS_MAX = 14000
/** Twinkling stars in the band (desktop, phones). */
const TWINKLES_DESKTOP = 36
const TWINKLES_PHONE = 14
/**
 * Band brightness left where it crosses the desktop contact text (1 = not
 * dimmed). A soft fade (`textDim`), not a cutout.
 */
const TEXT_DIM = 0.75

/**
 * Colour across the band, by warmth (0 = edge, 1 = warm middle): blue-white
 * edges, a greyish mix (as in the photo), amber, gold, and a cream highlight.
 */
const BAND_RAMP: readonly (readonly [number, Rgb])[] = [
  [0, MILKY_WAY.blueWhite],
  [0.25, mix(MILKY_WAY.blueWhite, MILKY_WAY.amber, 0.45)],
  [0.5, mix(MILKY_WAY.amber, MILKY_WAY.burntOrange, 0.3)],
  [0.75, MILKY_WAY.gold],
  [1, mix(MILKY_WAY.gold, MILKY_WAY.cream, 0.6)],
]

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function ramp(t: number): Rgb {
  const stops = BAND_RAMP
  if (t <= 0) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [at, color] = stops[i]
    if (t <= at) {
      const [prevAt, prev] = stops[i - 1]
      const f = (t - prevAt) / (at - prevAt)
      return [prev[0] + (color[0] - prev[0]) * f, prev[1] + (color[1] - prev[1]) * f, prev[2] + (color[2] - prev[2]) * f]
    }
  }
  return stops[stops.length - 1][1]
}

/**
 * Where the band goes.
 * - Tablet and up: through a point left of and slightly above the galaxy
 *   centre, rising at `DESKTOP_ANGLE`, so it passes behind the panel and the
 *   intro text and behind the top of the spiral. Its warm middle is one
 *   galaxy radius further down-left, in the open sky below the panel.
 * - Phones: through the galaxy, a little below its centre, at the flatter
 *   `PHONE_ANGLE` so it stays in the band below the text. The warm middle is
 *   left of the galaxy, where it isn't hidden by the spiral.
 */
function bandShape({ width, height }: SceneSize, { cx, cy, r }: GalaxyPlace): BandShape {
  const phone = width < 768
  const angle = phone ? PHONE_ANGLE : DESKTOP_ANGLE
  const dx = Math.cos(angle)
  const dy = -Math.sin(angle)
  if (phone) {
    return { ox: cx, oy: cy + 0.1 * r, dx, dy, nx: -dy, ny: dx, halfWidth: 0.62 * r, core: -0.9 * r, coreLength: 1.3 * r }
  }
  return {
    ox: cx - 1.25 * r,
    oy: cy - 0.15 * r,
    dx,
    dy,
    nx: -dy,
    ny: dx,
    halfWidth: Math.max(0.6 * r, 0.13 * Math.min(width, height)),
    core: -1 * r,
    coreLength: 1.7 * r,
  }
}

/**
 * Screen rows the band covers, so the layer can be cropped to it on phones
 * (on desktop it crosses the whole screen).
 */
export function bandRows(size: SceneSize, place: GalaxyPlace): [number, number] {
  const s = bandShape(size, place)
  // Widest the glow gets (warm middle, plus the wander), measured across the band.
  const reach = (BAND_REACH * 1.22 + 0.45) * s.halfWidth
  const slope = s.dy / s.dx
  const yAt = (x: number) => s.oy + (x - s.ox) * slope
  const across = reach / s.dx
  const top = Math.min(yAt(0), yAt(size.width)) - across
  const bottom = Math.max(yAt(0), yAt(size.width)) + across
  return [Math.max(0, Math.floor(top)), Math.min(size.height, Math.ceil(bottom))]
}

/**
 * Share of the band's light kept at screen point (x, y): 1 in open sky,
 * `TEXT_DIM` behind the desktop contact text, with a soft edge. Text boxes
 * measured on /contact from 768x1024 to 1920x1080 (V0.59, V0.60): the intro
 * and the contact panel end ~415 px from the top (768) or ~350 (1024 and up),
 * and the intro reaches right to 740 (768 wide), 851 (1024), 908 (1280) and
 * 1228 (1920), all inside `textRight`; the footer text starts
 * ~92 px above the bottom. Phones return 1: there the band runs below the
 * text.
 */
function textDim({ width, height }: SceneSize, x: number, y: number) {
  if (width < 768 || TEXT_DIM >= 1) return 1
  const panel = (1 - smoothstep(420, 520, y)) * (1 - smoothstep(textRight(width), textRight(width) + 90, x))
  const footer = smoothstep(height - 150, height - 95, y)
  const text = Math.max(panel, footer)
  return 1 - (1 - TEXT_DIM) * text
}

/** Right edge of the desktop contact text, with a small margin (see `textDim`). */
function textRight(width: number) {
  return width / 2 + 360
}

/** A twinkling band star, in CSS pixels. */
export interface BandTwinkle {
  x: number
  y: number
  /** Half the sprite's side. */
  s: number
  /** Steady opacity. */
  alpha: number
  depth: number
  period: number
  phase: number
}

/**
 * Paint the band into `ctx` (CSS pixels, already translated so that screen
 * point (x0, y0) is the layer's corner; the layer is `w` x `h`). Glow and
 * dust are baked into a low-res bitmap (one cell per `CELL` CSS pixels,
 * yielding every few rows) and drawn smoothed, so all edges are soft; the
 * fine stars are then drawn at full resolution. Returns the twinkling stars.
 */
export function* paintBand(
  ctx: CanvasRenderingContext2D,
  size: SceneSize,
  place: GalaxyPlace,
  x0: number,
  y0: number,
  w: number,
  h: number,
): Generator<unknown, BandTwinkle[], undefined> {
  const s = bandShape(size, place)
  const cols = Math.max(1, Math.ceil(w / CELL))
  const rows = Math.max(1, Math.ceil(h / CELL))
  const bitmap = makeCanvas(cols, rows)
  const bctx = bitmap.getContext('2d')
  if (!bctx) return []
  const img = bctx.createImageData(cols, rows)
  // Glow per cell (0..1, before the text dim) and warmth, for placing stars.
  const glow = new Float32Array(cols * rows)
  const warmth = new Float32Array(cols * rows)
  const wander = createValueNoise(2741)
  const clumps = createValueNoise(2742)
  const lanes = createValueNoise(2743)
  const breaks = createValueNoise(2744)
  const W = s.halfWidth
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      const x = x0 + (px + 0.5) * CELL
      const y = y0 + (py + 0.5) * CELL
      const rx = x - s.ox
      const ry = y - s.oy
      const u = rx * s.dx + ry * s.dy
      const across = rx * s.nx + ry * s.ny
      // The centre line wanders a little, and the band widens at its middle.
      const middle = Math.exp(-(((u - s.core) / s.coreLength) ** 2))
      const half = W * (0.72 + 0.5 * middle)
      const v = (across - (fbm(wander, u / (4 * W), 3.7, 3) - 0.5) * 0.9 * W) / half
      if (Math.abs(v) > BAND_REACH) continue
      const profile = Math.exp(-v * v * 0.9) * (1 - smoothstep(BAND_REACH * 0.7, BAND_REACH, Math.abs(v)))
      // Clumpy star clouds.
      const clump = fbm(clumps, x / 85, y / 85, 4)
      let alpha = profile * Math.min(1, Math.max(0, 0.5 + 1.1 * (clump - 0.5) + 0.5 * middle * Math.exp(-v * v * 2)))
      // Warm in the middle of the band near its core, cooler out to the edges.
      const warm = Math.min(1, Math.max(0, middle * Math.exp(-v * v * 1.6) * (0.85 + 1.2 * (clump - 0.5))))
      let [r, g, b] = ramp(warm)
      // Dust: dark brown patches stretched along the band (a noise squashed
      // across it), with thinner lanes where a ridged noise peaks inside them,
      // strongest in the middle of the band and fading out to its edges.
      const along = u / (0.9 * W)
      const side = across / (0.3 * W)
      const patch = smoothstep(0.5, 0.78, fbm(lanes, along, side, 3))
      const ridge = 1 - Math.abs(fbm(breaks, along * 0.7, side * 1.6, 2) * 2 - 1)
      const lane = Math.min(1, patch * 0.75 + smoothstep(0.82, 0.97, ridge) * patch) * Math.exp(-v * v * 1.6)
      if (lane > 0) {
        const t = 0.85 * lane
        r += (MILKY_WAY.dust[0] - r) * t
        g += (MILKY_WAY.dust[1] - g) * t
        b += (MILKY_WAY.dust[2] - b) * t
        alpha *= 1 - 0.4 * lane
      }
      const k = py * cols + px
      glow[k] = alpha * (1 - lane)
      warmth[k] = warm
      const i = k * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255 * Math.min(1, alpha * BAND_PEAK * textDim(size, x, y))
    }
    if (py % ROWS_PER_SLICE === ROWS_PER_SLICE - 1) yield
  }
  bctx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, x0, y0, cols * CELL, rows * CELL)
  ctx.restore()
  yield

  // Dense fine stars, more where the band is bright: blue-white, gold toward
  // the warm middle.
  const random = createRandom(2745)
  const tries = Math.min(BAND_STARS_MAX * 3, Math.round(((w * h) / 1_000_000) * BAND_STARS_PER_MEGAPIXEL * 3))
  const cool = MILKY_WAY.fineStar
  const warmStar = mix(MILKY_WAY.gold, MILKY_WAY.cream, 0.4)
  let drawn = 0
  for (let t = 0; t < tries && drawn < BAND_STARS_MAX; t++) {
    const x = x0 + random() * w
    const y = y0 + random() * h
    const k = Math.min(rows - 1, Math.floor((y - y0) / CELL)) * cols + Math.min(cols - 1, Math.floor((x - x0) / CELL))
    const pick = random()
    const alpha = between(random, 0.35, 0.95)
    const side = random() < 0.1 ? 1.5 : 1
    const isWarm = random() < warmth[k] * 0.8
    if (pick > glow[k] * 0.8) continue
    const [r, g, b] = isWarm ? warmStar : cool
    ctx.fillStyle = `rgb(${r} ${g} ${b} / ${(alpha * textDim(size, x, y)).toFixed(3)})`
    ctx.fillRect(x, y, side, side)
    drawn++
    if (drawn % 1500 === 0) yield
  }

  // Twinkling stars: in the bright band, off the spiral's disk (it is drawn
  // in front) and out of the text areas.
  const twinkles: BandTwinkle[] = []
  const want = size.width < 768 ? TWINKLES_PHONE : TWINKLES_DESKTOP
  const trandom = createRandom(2746)
  for (let t = 0; twinkles.length < want && t < want * 200; t++) {
    const x = x0 + trandom() * w
    const y = y0 + trandom() * h
    const pick = trandom()
    const k = Math.min(rows - 1, Math.floor((y - y0) / CELL)) * cols + Math.min(cols - 1, Math.floor((x - x0) / CELL))
    if (pick > glow[k]) continue
    if (x < 6 || x > size.width - 6 || y < 6 || y > size.height - 6) continue
    if (Math.hypot(x - place.cx, (y - place.cy) / 0.64) < 1.15 * place.r) continue
    if (inTextArea(size, x, y)) continue
    twinkles.push({
      x,
      y,
      s: between(trandom, 1.4, 2.6),
      alpha: between(trandom, 0.35, 0.6),
      depth: between(trandom, 0.45, 0.75),
      period: between(trandom, 3, 7),
      phase: trandom() * Math.PI * 2,
    })
  }
  return twinkles
}

/**
 * The text areas of /contact, generously (see `textDim` for the
 * measurements): phones from the top down to the panel's last button row
 * (549 px at scroll 0, `PHONE_BAND_TOP` in `galaxy.ts`) and from the footer
 * text (178 px above the bottom), each with an 8 px gap; tablet and up the
 * panel area and the footer.
 */
function inTextArea({ width, height }: SceneSize, x: number, y: number) {
  if (width < 768) return y < 557 || y > height - 186
  return (y < 520 && x < textRight(width) + 90) || y > height - 150
}

/** Sprite for the twinkling band stars. */
export function makeTwinkleSprite(): HTMLCanvasElement {
  return makeSoftDot(MILKY_WAY.brightStar, 16, 0.25)
}

/** Draw the twinkling band stars at `time` (seconds). */
export function drawTwinkles(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  twinkles: readonly BandTwinkle[],
  time: number,
) {
  for (const t of twinkles) {
    const light = t.alpha * (1 + t.depth * Math.sin(t.phase + (time * Math.PI * 2) / t.period))
    if (light < 0.01) continue
    ctx.globalAlpha = Math.min(1, light)
    ctx.drawImage(sprite, t.x - t.s, t.y - t.s, t.s * 2, t.s * 2)
  }
  ctx.globalAlpha = 1
}
