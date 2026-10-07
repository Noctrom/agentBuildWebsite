import { runToEnd } from './build'
import { makeCanvas, makeSoftDot, rgba, spread, type Rgb } from './canvas'
import { bandRows, drawTwinkles, makeTwinkleSprite, paintBand, type BandTwinkle } from './galaxyBand'
import { MILKY_WAY, mix } from './galaxyPalette'
import { createDiskStars, type DiskStars, type StarSeed, type Twinkle } from './galaxyStars'
import { between, createRandom } from './random'
import { createStarfield } from './starfield'
import type { Scene, SceneBuild, SceneFrame, SceneSetup, SceneSize } from './types'

/**
 * Contact scene (S27, swirling since V0.39): a quiet starfield with a spiral
 * galaxy. Two arms of blue-white stars with star-forming knots and dark
 * dust lanes wind out of a warm core. Since V0.59 the colours follow Chris's
 * Milky Way photo (`galaxyPalette.ts`): a gold and amber core with burnt
 * orange edges and a cream centre, brown-black dust, blue-white and pale cyan
 * outer arms, rust knots, and an indigo-to-navy sky with extra fine stars
 * around the galaxy (`makeSky`). The galaxy is tilted and sits right of
 * the contact text on desktop, below it on mobile. A small companion galaxy
 * and two faint background smudges add depth.
 *
 * Motion (V0.39): the spiral pattern (arm glow, knots, dust) turns rigidly
 * once every `PATTERN_PERIOD` seconds, while the stars orbit on their own,
 * faster toward the core. The arms are a density wave that the stars stream
 * through, so they never wind up; see `galaxyStars.ts`.
 *
 * Shimmer (V0.40): the warm core breathes: a soft warm halo around the
 * baked core brightens and fades back over `CORE_PERIOD` seconds (at its
 * faintest the core is exactly the baked one, so it never disappears). The
 * halo is wider than the white centre, which is already at full brightness
 * and would hide the breath. Some arm stars and some knots twinkle,
 * each on its own slow wave around its V0.39 brightness with a random
 * phase, so they never pulse together and the galaxy is as bright on
 * average as before. With reduced motion the engine draws time 0 only, so
 * nothing changes.
 *
 * Layers, back to front: the Contact sky (V0.59) with the Milky Way band
 * baked into it (V0.60, `galaxyBand.ts`), the band's twinkling stars, starfield, smudges, the baked glow texture
 * (`makeGlow`, drawn in `drawGlow`) with the breathing core and the live
 * knots on top, then the live stars (`createDiskStars`).
 *
 * Cost per frame: one draw of the baked sky, ~14-36 tiny twinkle sprites, the starfield, three tiny sprites, one transformed draw of
 * the glow texture (as in S27), the core halo sprite and 16 live
 * small knot sprites, a third of the ~4 600 stars splatted into a
 * pixel buffer and one draw of that buffer.
 */

/** Tilt of the galaxy disk (vertical squash) and rotation of its plane. */
const TILT = 0.48
const PLANE_ANGLE = -0.42
/** Rotation of the galaxy inside its plane at time 0 (the S27 still frame). */
const START_ANGLE = 1.3
/** Seconds per turn of the arm pattern; outer stars move with it. */
const PATTERN_PERIOD = 90
const PATTERN_SPIN = (Math.PI * 2) / PATTERN_PERIOD
/**
 * Rotation curve softening: orbit speed is PATTERN_SPIN * (1 + S) / (r + S),
 * so a star at the edge (r = 1) keeps pace with the arms, one at r = 0.15
 * turns ~4x faster and the inner bulge ~6x (about 15 s per turn).
 */
const SOFTENING = 0.15
const PARALLAX = 0.025
const MAX_PARALLAX = 30
const ARMS = 2
/** Arm winding: the arm reaches the edge after this many radians. */
const ARM_TURN = Math.PI * 3
/** Log spiral of the arms: radius ARM_R0 * e^(ARM_B * theta), reaching 0.95 at ARM_TURN. */
const ARM_R0 = 0.09
const ARM_B = Math.log(0.95 / ARM_R0) / ARM_TURN
/** Live stars per arm. */
const ARM_STARS = 1500
/** Star-forming knots per arm (as in S27, rust since V0.59); every `LIVE_KNOT_EVERY`th is drawn live and twinkles. */
const KNOTS = 22
const LIVE_KNOT_EVERY = 3
/** Seconds per core breath (the story asks for 4-8). */
const CORE_PERIOD = 6
/** Peak opacity of the breathing halo, added on top of the baked core. */
const CORE_PEAK = 0.35
/** Radius of the breathing halo, in galaxy radii. */
const CORE_SIZE = 0.32
/** Share of arm and inter-arm disk stars that twinkle. */
const ARM_TWINKLE_SHARE = 0.35
const DISK_TWINKLE_SHARE = 0.2

/**
 * V0.59 colours, all from the Milky Way palette (`galaxyPalette.ts`).
 * Disk glow stops: [position in galaxy radii, colour, opacity].
 */
const DISK_STOPS: readonly (readonly [number, Rgb, number])[] = [
  [0, MILKY_WAY.cream, 0.9],
  [0.05, MILKY_WAY.gold, 0.6],
  [0.12, MILKY_WAY.amber, 0.38],
  [0.22, MILKY_WAY.burntOrange, 0.2],
  [0.4, mix(MILKY_WAY.burntOrange, MILKY_WAY.blueWhite, 0.6), 0.09],
  [0.6, MILKY_WAY.blueWhite, 0.06],
  [1, MILKY_WAY.paleCyan, 0],
]
/**
 * Arm glow colour by arm radius: amber and gold inside, through a greyish
 * mix (as in the photo) to blue-white, and pale cyan at the tips.
 */
const ARM_GLOW_RAMP: readonly (readonly [number, Rgb])[] = [
  [0.1, MILKY_WAY.gold],
  [0.3, MILKY_WAY.amber],
  [0.45, mix(MILKY_WAY.amber, MILKY_WAY.blueWhite, 0.5)],
  [0.62, MILKY_WAY.blueWhite],
  [0.95, MILKY_WAY.paleCyan],
]
/** The ramp baked into this many arm glow sprites (only used on resize). */
const ARM_GLOW_STEPS = 10
const ARM_GLOW_COLORS: readonly Rgb[] = Array.from({ length: ARM_GLOW_STEPS }, (_, i) =>
  rampColor(ARM_GLOW_RAMP, i / (ARM_GLOW_STEPS - 1)),
)
/** Dust lanes: share of the glow removed, then strength of the brown-black tint. */
const DUST_THIN = 0.12
const DUST_TINT = 0.32
/**
 * Contact sky tint: a soft ellipse of indigo fading to navy around the
 * galaxy (see `skyShape`), with this peak opacity under the 0.2 canvas
 * opacity. A tint over the whole screen raised the background behind the
 * contact text and cost 1-3% of its contrast, which the story rules out, so
 * the tint stays where there is no text.
 */
const SKY_TINT = 1
/** Extra fine stars in the tinted sky (the shared starfield has ~270 per megapixel). */
const FINE_STARS_PER_MEGAPIXEL = 2500
const FINE_STARS_MAX = 2400
/** Bright blue-white stars, placed in the tint around (not on) the galaxy. */
const BRIGHT_STARS = 7
/** Arm stars inside this radius are warm (gold) instead of blue-white. */
const WARM_STAR_RADIUS = 0.3

/** Colour at `t` (0..1) of a ramp of [position, colour] stops. */
function rampColor(ramp: readonly (readonly [number, Rgb])[], t: number): Rgb {
  if (t <= ramp[0][0]) return ramp[0][1]
  for (let i = 1; i < ramp.length; i++) {
    const [at, color] = ramp[i]
    if (t <= at) {
      const [prevAt, prev] = ramp[i - 1]
      return mix(prev, color, (t - prevAt) / (at - prevAt))
    }
  }
  return ramp[ramp.length - 1][1]
}

/** Arm glow sprite for arm radius `radius` (0..1). */
function armGlowIndex(radius: number) {
  return Math.min(ARM_GLOW_STEPS - 1, Math.max(0, Math.round(radius * (ARM_GLOW_STEPS - 1))))
}

interface Layout {
  cx: number
  cy: number
  r: number
}

/**
 * Phones: the free band between the contact panel's text and the footer
 * text, measured on /contact at 375x812 (V0.58). The galaxy is fixed to the
 * viewport, so each edge is taken at the scroll position where that text is
 * closest to it:
 * - top: the panel's last button row ends 549 px from the top of the page
 *   (scroll 0). Since V0.51 the real email wraps and the buttons take two
 *   rows; it was ~495 in V0.39.
 * - bottom: the stacked footer's text (the copyright line) starts 178 px
 *   above the bottom of the page (V0.57 added the eye button row; it was
 *   130). Phone pages are at least as tall as the viewport, so scrolled to
 *   the end that is 178 px above the bottom of the viewport.
 * Each keeps an 8 px gap.
 */
const PHONE_BAND_TOP = 557
const PHONE_BAND_BOTTOM = 186
/** Half the height the turning disk sweeps on screen, in galaxy radii (measured). */
const SWEEP_HALF_HEIGHT = 0.64

/**
 * Where the galaxy sits. The whole tilted disk sweeps through every
 * orientation as it turns, so its outline, not just the time-0 frame, has to
 * stay clear of the text.
 * - Phones: centred in the band between the panel and the footer text, sized
 *   to fit it (at most S27's 0.44 * width, at least 100 px). If even 100 px
 *   doesn't fit (375x812 and shorter since V0.58), it sits on the band's
 *   bottom edge, clear of the footer text, and overlaps the panel.
 * - Tablet and up: right of the panel. Since V0.38 the desktop nav is a left
 *   rail, which moves the content right but not as far as the galaxy.
 */
function layoutFor({ width, height }: SceneSize): Layout {
  if (width < 768) {
    const top = PHONE_BAND_TOP
    const bottom = height - PHONE_BAND_BOTTOM
    const r = Math.max(100, Math.min(width * 0.44, (bottom - top) / 2 / SWEEP_HALF_HEIGHT))
    // When the band is too short for the smallest galaxy, keep the footer
    // gap and let it reach up behind the frosted panel instead.
    const cy = Math.min((top + bottom) / 2, bottom - r * SWEEP_HALF_HEIGHT)
    return { cx: width * 0.6, cy, r }
  }
  return { cx: width * 0.76, cy: height * 0.46, r: Math.max(150, Math.min(width * 0.2, height * 0.36)) }
}

/** Arm radius (as a fraction of the galaxy radius) at winding angle theta. */
function armRadius(theta: number) {
  return ARM_R0 * Math.exp(ARM_B * theta)
}

/** Winding angle at which the arm centre line reaches `radius`. */
function armTheta(radius: number) {
  return Math.log(radius / ARM_R0) / ARM_B
}

/** A knot drawn live so it can twinkle, in texture coordinates (centre 0, 0). */
interface LiveKnot {
  x: number
  y: number
  /** Half the sprite's side. */
  s: number
  alpha: number
  twinkle: Twinkle
}

/**
 * Face-on glow texture, radius r, centered in a 2.5r square: disk glow, warm
 * core, soft arm glow, knots and dust lanes. Everything here turns
 * rigidly with the arm pattern; the stars are drawn live (`starSeeds`).
 * Every `LIVE_KNOT_EVERY`th knot is left out of the texture and pushed to
 * `liveKnots` instead (the random sequence, and so the rest of the texture,
 * is the same as S27's).
 */
function makeGlow(r: number, random: () => number, liveKnots: LiveKnot[]): HTMLCanvasElement {
  const half = r * 1.25
  const canvas = makeCanvas(half * 2, half * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.translate(half, half)
  // Overall disk glow (V0.59): cream centre, gold and amber core, burnt
  // orange edge, then blue-white fading out.
  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  for (const [at, color, alpha] of DISK_STOPS) disk.addColorStop(at, rgba(color, alpha))
  ctx.fillStyle = disk
  ctx.fillRect(-r, -r, r * 2, r * 2)

  ctx.globalCompositeOperation = 'lighter'
  const armGlows = ARM_GLOW_COLORS.map((color) => makeSoftDot(color, 64))
  const knot = makeSoftDot(MILKY_WAY.rust, 32, 0.15)
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
      ctx.drawImage(armGlows[armGlowIndex(armRadius(theta))], x - s, y - s, s * 2, s * 2)
    }
    // Star-forming knots (rust since V0.59).
    for (let i = 0; i < KNOTS; i++) {
      const theta = between(random, 0.25, 0.9) * ARM_TURN
      const [x, y] = point(theta, arm, 0.025)
      const s = between(random, 2.5, 5) * Math.max(1, r / 220)
      const alpha = between(random, 0.55, 0.95)
      if (i % LIVE_KNOT_EVERY === 0) {
        liveKnots.push({ x, y, s, alpha, twinkle: knotTwinkle(liveKnots.length) })
        continue
      }
      ctx.globalAlpha = alpha
      ctx.drawImage(knot, x - s, y - s, s * 2, s * 2)
    }
  }
  // Dust lanes along each arm: thin the glow (as in S27), then (V0.59) tint
  // what is left brown-black, so the lanes read as dark dust against the gold
  // rather than as gaps.
  const dust = makeSoftDot([0, 0, 0], 32)
  const dustTint = makeSoftDot(MILKY_WAY.dust, 32)
  const lanes: [number, number][] = []
  for (let arm = 0; arm < ARMS; arm++) {
    for (let i = 0; i < 90; i++) {
      const theta = between(random, 0.22, 0.8) * ARM_TURN
      lanes.push(point(theta - 0.3, arm, 0.012))
    }
  }
  const s = r * 0.035
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = DUST_THIN
  for (const [x, y] of lanes) ctx.drawImage(dust, x - s, y - s, s * 2, s * 2)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.globalAlpha = DUST_TINT
  for (const [x, y] of lanes) ctx.drawImage(dustTint, x - s * 1.3, y - s * 1.3, s * 2.6, s * 2.6)
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

/** The glow texture's edge fade (1 inside 0.85r, 0 at 1.25r), for live stars. */
function edgeFade(radius: number) {
  return Math.min(1, Math.max(0, (1.25 - radius) / 0.4))
}

/**
 * Twinkle for live knot number `index`: deeper and slower than the stars'.
 * From its own seeded random (per index), so it is the same after a resize
 * and doesn't disturb the texture's random sequence.
 */
function knotTwinkle(index: number): Twinkle {
  const random = createRandom(27330 + index)
  return { depth: between(random, 0.4, 0.6), period: between(random, 3, 6), phase: random() * Math.PI * 2 }
}

/**
 * Arm star colour index (`STAR_COLORS`): gold inside `WARM_STAR_RADIUS`,
 * blue-white (and some pale cyan) outside. The boundary is spread over 0.15
 * galaxy radii per star (`index` hashed, no extra random draws, so the S27
 * layout is unchanged) so there is no visible ring.
 */
function armStarColor(radius: number, common: boolean, index: number) {
  const hash = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1
  const warm = radius < WARM_STAR_RADIUS + 0.15 * (hash - 0.5)
  if (warm) return common ? 4 : 5
  return common ? 0 : 1
}

/** A star twinkle from `random`, or none (steady) for 1 - `share` of the stars. */
function starTwinkle(random: () => number, share: number): Twinkle | undefined {
  if (random() >= share) return undefined
  return { depth: between(random, 0.4, 0.7), period: between(random, 1.6, 4), phase: random() * Math.PI * 2 }
}

/**
 * Star seeds with the same counts, colors and spread as the S27 baked stars:
 * 1 500 per arm, 700 bulge and 900 inter-arm disk stars. Arm stars get a
 * window around their arm instead of a radial jitter, see `galaxyStars.ts`.
 */
function starSeeds(random: () => number): StarSeed[] {
  // Twinkles come from their own sequence so the S27 star layout is unchanged.
  const twinkleRandom = createRandom(2732)
  const seeds: StarSeed[] = []
  for (let arm = 0; arm < ARMS; arm++) {
    for (let i = 0; i < ARM_STARS; i++) {
      // Denser toward the inside, as before.
      const theta = Math.pow(random(), 0.85) * ARM_TURN
      const center = armRadius(theta)
      // S27 jittered arm stars radially by +-jitter. Express that spread as an
      // angle along the arm (dr = ARM_B * r * dtheta), matched to the bell's
      // spread, capped at half the gap between arms.
      const jitter = 0.04 + 0.06 * center
      const radius = Math.max(0.02, center + spread(random) * jitter * 0.25)
      const width = Math.min(Math.PI / ARMS, (0.88 * jitter) / (ARM_B * Math.max(radius, ARM_R0)))
      seeds.push({
        radius,
        base: armTheta(Math.max(radius, ARM_R0)) + (arm * Math.PI * 2) / ARMS,
        delta: between(random, -width, width),
        width,
        alpha: between(random, 0.5, 1) * edgeFade(radius),
        color: armStarColor(radius, random() < 0.75, i),
        size: random() < 0.12 ? 1.5 : 1,
        twinkle: starTwinkle(twinkleRandom, ARM_TWINKLE_SHARE),
      })
    }
  }
  // Bulge.
  for (let i = 0; i < 700; i++) {
    seeds.push({
      radius: Math.abs(spread(random)) * 0.16,
      base: random() * Math.PI * 2,
      delta: 0,
      width: 0,
      alpha: between(random, 0.3, 0.8),
      color: 2,
      size: 1,
    })
  }
  // Inter-arm disk.
  for (let i = 0; i < 900; i++) {
    seeds.push({
      radius: Math.sqrt(random()) * 0.85,
      base: random() * Math.PI * 2,
      delta: 0,
      width: 0,
      alpha: between(random, 0.15, 0.45),
      color: 3,
      size: 1,
      twinkle: starTwinkle(twinkleRandom, DISK_TWINKLE_SHARE),
    })
  }
  return seeds
}

/** An ellipse on screen: centre and half-axes in CSS pixels. */
interface Ellipse {
  x: number
  y: number
  ax: number
  ay: number
}

/**
 * Where the sky tint and the bright stars go: the text-free area around the
 * galaxy, from text boxes measured on /contact (V0.59).
 * - Tablet and up: the galaxy is right of the panel. The intro text ends
 *   ~170 px from the top and the footer text starts 92 px above the bottom,
 *   at every size from 768x1024 to 1920x1080, so there is more room below
 *   the galaxy (cy = 0.46h) than above it (0.75r at 1280x800, the tightest).
 *   The ellipse reaches 0.75r up, 1.25r down and 1.3r left of the galaxy
 *   centre, where the galaxy's own outline ends and the panel is.
 * - Phones: only the band the turning galaxy already sweeps (0.64r up and
 *   down, which V0.58 keeps clear of the footer), but the full width.
 */
function skyShape({ width }: SceneSize, { cx, cy, r }: Layout): Ellipse {
  if (width < 768) return { x: cx, y: cy, ax: 2.2 * r, ay: 0.68 * r }
  return { x: cx + 0.35 * r, y: cy + 0.25 * r, ax: 1.65 * r, ay: r }
}

/** The baked sky and where it goes on screen (CSS pixels), with the band's twinkling stars. */
interface SkyLayer {
  canvas: HTMLCanvasElement
  x: number
  y: number
  w: number
  h: number
  twinkles: BandTwinkle[]
}

/**
 * Contact sky (V0.59), baked once per size into one canvas at device
 * resolution and drawn under the shared starfield: a deep indigo-to-navy
 * tint around the galaxy, the Milky Way band (V0.60, `galaxyBand.ts`) across
 * it, then many fine blue-white stars and a few bright ones in the tint. It
 * is the Contact scene's own layer, so the shared starfield (and every other
 * page) is unchanged. It doesn't move, so it costs one `drawImage` a frame;
 * only the band's few twinkling stars are drawn live. A generator (see
 * "Heavy setup" in `types.ts`): the band bake yields every few rows.
 */
function* makeSky(size: SceneSize, layout: Layout): Generator<unknown, SkyLayer, undefined> {
  const { width, height, dpr } = size
  const { cx, cy, r } = layout
  const shape = skyShape(size, layout)
  // Only the rows of the tint and the band are baked and drawn, full width
  // (the band crosses the screen): the whole screen on desktop, about two
  // fifths of it on phones.
  const [bandTop, bandBottom] = bandRows(size, layout)
  const y0 = Math.max(0, Math.min(bandTop, Math.floor(shape.y - shape.ay)))
  const y1 = Math.min(height, Math.max(bandBottom, Math.ceil(shape.y + shape.ay)))
  const layer = { x: 0, y: y0, w: Math.max(1, width), h: Math.max(1, y1 - y0) }
  const canvas = makeCanvas(layer.w * dpr, layer.h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, ...layer, twinkles: [] }
  ctx.scale(dpr, dpr)
  ctx.translate(-layer.x, -layer.y)
  ctx.save()
  ctx.translate(shape.x, shape.y)
  ctx.scale(shape.ax, shape.ay)
  const tint = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  tint.addColorStop(0, rgba(MILKY_WAY.skyIndigo, SKY_TINT))
  tint.addColorStop(0.5, rgba(MILKY_WAY.skyNavy, SKY_TINT * 0.85))
  tint.addColorStop(0.8, rgba(MILKY_WAY.skyNavy, SKY_TINT * 0.4))
  tint.addColorStop(1, rgba(MILKY_WAY.skyNavy, 0))
  ctx.fillStyle = tint
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
  yield

  // V0.60: the Milky Way band over the tint.
  const twinkles = yield* paintBand(ctx, size, layout, layer.x, layer.y, layer.w, layer.h)

  const random = createRandom(2734)
  // Fine stars fill the tinted sky only, so none lands behind the text.
  const area = Math.PI * shape.ax * shape.ay
  const count = Math.min(FINE_STARS_MAX, Math.round((area / 1_000_000) * FINE_STARS_PER_MEGAPIXEL))
  ctx.fillStyle = rgba(MILKY_WAY.fineStar, 1)
  for (let i = 0; i < count; i++) {
    // Uniform in the ellipse.
    const angle = random() * Math.PI * 2
    const dist = Math.sqrt(random())
    const x = shape.x + Math.cos(angle) * dist * shape.ax
    const y = shape.y + Math.sin(angle) * dist * shape.ay
    // Fewer and fainter toward the edge, with the tint.
    ctx.globalAlpha = between(random, 0.3, 0.8) * (1 - dist * dist)
    const s = between(random, 0.8, 1.3)
    ctx.fillRect(x, y, s, s)
  }

  const bright = makeSoftDot(MILKY_WAY.brightStar, 32, 0.12)
  let placed = 0
  for (let tries = 0; placed < BRIGHT_STARS && tries < 400; tries++) {
    const x = shape.x + (random() * 2 - 1) * shape.ax
    const y = shape.y + (random() * 2 - 1) * shape.ay
    const size = between(random, 2.5, 4)
    const alpha = between(random, 0.6, 0.95)
    // Inside the tint, off the galaxy's own disk, and on screen.
    const inTint = Math.hypot((x - shape.x) / shape.ax, (y - shape.y) / shape.ay) < 0.9
    const offDisk = Math.hypot(x - cx, (y - cy) / SWEEP_HALF_HEIGHT) > 1.2 * r
    if (!inTint || !offDisk || x < 8 || x > width - 8 || y < 8 || y > height - 8) continue
    ctx.globalAlpha = alpha
    ctx.drawImage(bright, x - size, y - size, size * 2, size * 2)
    placed++
  }
  ctx.globalAlpha = 1
  return { canvas, ...layer, twinkles }
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

function* createGalaxy(setup: SceneSetup): SceneBuild {
  const stars = createStarfield(setup, {
    seed: 273,
    density: 0.7,
    nebulaStrength: 0.25,
    // V0.59: navy and indigo clouds (was one blue).
    nebulaColors: [
      [52, 76, 220],
      [78, 58, 200],
    ],
  })

  let layout = layoutFor(setup)
  let texture: HTMLCanvasElement | null = null
  let sky: SkyLayer | null = null
  let smudges: Smudge[] = []
  let liveKnots: LiveKnot[] = []
  const coreSprite = makeSoftDot(MILKY_WAY.gold, 64)
  const knotSprite = makeSoftDot(MILKY_WAY.rust, 32, 0.15)
  // Seeds are in galaxy units (radius 0..1), so a resize doesn't rebuild them.
  const diskStars: DiskStars = createDiskStars(starSeeds(createRandom(2731)), {
    patternSpin: PATTERN_SPIN,
    outerSpin: PATTERN_SPIN,
    softening: SOFTENING,
  })

  const twinkleSprite = makeTwinkleSprite()

  function* build(size: SceneSize): Generator<unknown, void, undefined> {
    const next = layoutFor(size)
    const random = createRandom(2730)
    const nextKnots: LiveKnot[] = []
    const nextTexture = makeGlow(next.r, random, nextKnots)
    yield
    const nextSky = yield* makeSky(size, next)
    // Assigned only once the whole bake is done (a build may be abandoned at a yield).
    layout = next
    liveKnots = nextKnots
    texture = nextTexture
    sky = nextSky
    const { width, height } = size
    const { cx, cy, r } = layout
    const warm = makeSmudge(mix(MILKY_WAY.gold, MILKY_WAY.cream, 0.5))
    const cool = makeSmudge(MILKY_WAY.blueWhite)
    smudges = [
      // Companion galaxy, near the main disk.
      { sprite: warm, x: cx - r * 0.95, y: cy - r * 0.55, w: r * 0.13, h: r * 0.08, angle: 0.5, alpha: 0.7 },
      // Faint background galaxies.
      { sprite: cool, x: width * 0.12, y: height * 0.92, w: 14, h: 6, angle: -0.6, alpha: 0.6 },
      { sprite: warm, x: width * 0.94, y: height * 0.1, w: 10, h: 5, angle: 0.9, alpha: 0.55 },
    ]
  }

  yield* build(setup)

  /**
   * The glow texture, turning rigidly with the arm pattern, with the
   * breathing core and the twinkling knots added on top.
   */
  function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
    if (!texture) return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(PLANE_ANGLE)
    ctx.scale(1, TILT)
    ctx.rotate(START_ANGLE - time * PATTERN_SPIN)
    ctx.drawImage(texture, -texture.width / 2, -texture.height / 2)
    ctx.globalCompositeOperation = 'lighter'
    // Core breath: 0 at time 0 (the baked core alone), CORE_PEAK half a period later.
    const breath = 0.5 - 0.5 * Math.cos((time * Math.PI * 2) / CORE_PERIOD)
    if (breath > 0.002) {
      const s = r * CORE_SIZE
      ctx.globalAlpha = CORE_PEAK * breath
      ctx.drawImage(coreSprite, -s, -s, s * 2, s * 2)
    }
    for (const k of liveKnots) {
      const { depth, period, phase } = k.twinkle
      // Around the baked brightness; above 1 the rest goes in a second
      // additive draw (globalAlpha can't exceed 1).
      let light = k.alpha * (1 + depth * Math.sin(phase + (time * Math.PI * 2) / period))
      while (light > 0.004) {
        ctx.globalAlpha = Math.min(1, light)
        ctx.drawImage(knotSprite, k.x - k.s, k.y - k.s, k.s * 2, k.s * 2)
        light -= 1
      }
    }
    ctx.restore()
  }

  function draw(frame: SceneFrame) {
    if (sky) {
      frame.ctx.drawImage(sky.canvas, sky.x, sky.y, sky.w, sky.h)
      // V0.60: the band's twinkling stars (time 0, so steady, with reduced motion).
      drawTwinkles(frame.ctx, twinkleSprite, sky.twinkles, frame.time)
    }
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
    const { cx, cy, r } = layout
    drawGlow(ctx, cx, cy - shift, r, time)
    diskStars.draw(
      ctx,
      { cx, cy: cy - shift, r, tilt: TILT, planeAngle: PLANE_ANGLE, startAngle: START_ANGLE },
      time,
      frame.reducedMotion || frame.dt === 0,
    )
  }

  return {
    draw,
    resize(next: SceneSize) {
      stars.resize?.(next)
      runToEnd(build(next))
    },
    dispose() {
      stars.dispose?.()
      diskStars.dispose()
      texture = null
      sky = null
      smudges = []
      liveKnots = []
    },
  }
}

export const galaxyScene: Scene = {
  id: 'galaxy',
  create: createGalaxy,
}
