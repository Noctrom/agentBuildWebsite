import type { Rgb } from './canvas'

/**
 * Milky Way palette of the Contact scene (V0.59), taken from Chris's
 * reference photo (`docs/story-inbox/night-sky-Milky-Way-Galaxy.webp`, a
 * colour reference only; it is not shipped). Region medians and bright
 * percentiles of the photo, scaled up to full brightness where the scene
 * needs a light colour (the scene canvas is shown at 0.2 opacity, so it
 * works with bright source colours):
 * - core, median 169 118 67 and bright 230 181 114: gold to amber
 * - core edges: burnt orange, with a cream highlight in the centre
 * - dust lanes: brown-black
 * - outer band, bright 152 174 218: blue-white, with pale cyan
 * - sky, median 28 28 54 and darkest 13 13 38: deep navy to indigo
 *
 * The galaxy (`galaxy.ts`, `galaxyStars.ts`) uses these names, and V0.60's
 * Milky Way band should reuse them so the two match.
 */
export const MILKY_WAY = {
  /** Core highlight. */
  cream: [255, 238, 200],
  /** Inner core. */
  gold: [255, 196, 110],
  /** Core and inner arms. */
  amber: [240, 150, 62],
  /** Edge of the core glow. */
  burntOrange: [196, 92, 36],
  /** Star-forming knots (pink before V0.59; rust is Chris's choice). */
  rust: [210, 84, 44],
  /** Dust lanes. */
  dust: [30, 18, 10],
  /** Outer arms and blue-white stars. */
  blueWhite: [200, 220, 255],
  /** Outer arm tips, mixed with the blue-white. */
  paleCyan: [170, 228, 245],
  /** Sky tint near the edges of the screen. */
  skyNavy: [26, 32, 100],
  /** Sky tint around the galaxy. */
  skyIndigo: [54, 40, 128],
  /** Fine background stars. */
  fineStar: [196, 212, 255],
  /** The few bright background stars. */
  brightStar: [215, 232, 255],
} as const satisfies Record<string, Rgb>

/** Mix of two colours, `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const at = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return [at(0), at(1), at(2)]
}
