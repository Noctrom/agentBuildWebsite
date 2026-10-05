/**
 * Small drawing helpers shared by the S27 scenes: offscreen canvases, color
 * strings and soft dot sprites. Only used on create/resize, never per frame.
 */

export type Rgb = readonly [number, number, number]

/** Offscreen canvas of at least 1x1 pixels. */
export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

/** CSS color string for an RGB triple and an alpha. */
export function rgba([r, g, b]: Rgb, a: number): string {
  return `rgb(${r} ${g} ${b} / ${a})`
}

/** Soft round blob (radial falloff), `size` pixels across, for stamping with `drawImage`. */
export function makeSoftDot(color: Rgb, size = 64, core = 0): HTMLCanvasElement {
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, rgba(color, 1))
  if (core > 0) g.addColorStop(core, rgba(color, 0.9))
  g.addColorStop(Math.max(core, 0.4), rgba(color, 0.4))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Gaussian-ish random in about [-1, 1] (sum of three uniforms). */
export function spread(random: () => number): number {
  return (random() + random() + random()) / 1.5 - 1
}
