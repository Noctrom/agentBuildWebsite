/**
 * Scene contract for the animated space background (S24).
 *
 * A scene is a self-contained Canvas 2D drawing: a starfield, a solar system,
 * a black hole... The background engine (`components/layout/SpaceBackground`)
 * owns the canvas, the animation loop, resizing, crossfades between scenes,
 * "reduce motion", pausing in hidden tabs and the static fallback. A scene only
 * draws. You can add or change scenes without touching the engine, `Layout` or
 * `ui/`:
 *
 *   1. Create a file in `src/scenes/`, e.g. `blackHole.ts`, exporting a `Scene`.
 *   2. Map its route in `src/scenes/routes.ts`.
 *
 * Lifecycle
 * - `create(setup)` runs once when the scene becomes active (on page load or
 *   navigation). Precompute here: star positions, offscreen canvases, sprites.
 *   Keep state in the closure / returned object; scenes must not touch the DOM
 *   outside their own offscreen canvases.
 * - `resize(size)` runs when the viewport size changes. Rebuild anything that
 *   depends on width/height. The engine has already resized the canvas.
 * - `draw(frame)` runs every animation frame (about 60 fps). The engine clears
 *   the canvas and sets a transform so you draw in CSS pixels
 *   (0..width, 0..height); never call `setTransform` without restoring it.
 *   Keep it cheap: a few hundred `fillRect`/`drawImage` calls, no per-frame
 *   gradient creation over the full screen, no allocations in hot loops.
 * - `dispose()` runs after the scene has faded out. Free big buffers.
 *
 * Brightness (contrast budget)
 * - Draw at full brightness. The engine shows the canvas at a fixed low opacity
 *   (`budget.maxOpacity`, 0.1) over the page background, so even pure white
 *   ends up at most rgb(30 31 39). That keeps every text color in `index.css`
 *   at WCAG AA (>= 4.5:1) at every frame, including muted text on a surface
 *   panel nested twice. Scenes cannot break contrast, and should not try to
 *   compensate by brightening further; contrast against text is not their job.
 * - Because the output is scaled down, contrast *inside* the scene matters:
 *   use alpha 0.4-1 for things that should be visible.
 *
 * Motion
 * - `frame.time` is seconds since the scene was created, paused while the tab
 *   is hidden. Animate from `time` (positions = f(time)), not by accumulating
 *   `dt`, so a still frame at any time looks right.
 * - With `reducedMotion` true the engine calls `draw` once (and again after a
 *   resize) with `time = 0` and `scrollY = 0`: the scene must look complete
 *   and good at time 0. There is no crossfade between scenes in that mode.
 * - Keep motion subtle: slow drift, gentle twinkle, slight parallax on scroll
 *   (`frame.scrollY`). Nothing should flash or move fast behind text.
 *
 * Example: see `starfield.ts` (the default scene). A minimal scene:
 *
 *   export const pulsingStar: Scene = {
 *     id: 'pulsing-star',
 *     create() {
 *       return {
 *         draw({ ctx, width, height, time }) {
 *           const r = 40 + 6 * Math.sin(time * 0.5)
 *           ctx.fillStyle = '#fbbf4d'
 *           ctx.beginPath()
 *           ctx.arc(width * 0.8, height * 0.3, r, 0, Math.PI * 2)
 *           ctx.fill()
 *         },
 *       }
 *     },
 *   }
 */

/** Viewport size in CSS pixels, plus the device pixel ratio the canvas uses. */
export interface SceneSize {
  /** Width in CSS pixels. */
  width: number
  /** Height in CSS pixels (the large viewport height on mobile). */
  height: number
  /** Canvas pixels per CSS pixel (capped by the engine at 1, lower on very large screens). */
  dpr: number
}

/** How bright the background may get. Enforced by the engine, informational for scenes. */
export interface SceneBudget {
  /** Opacity the canvas is shown at over the page background (0..1). */
  maxOpacity: number
}

/** Passed to `Scene.create`. */
export interface SceneSetup extends SceneSize {
  /** OS "reduce motion" is on: `draw` is called once per resize with time 0. */
  reducedMotion: boolean
  budget: SceneBudget
}

/** Passed to `SceneInstance.draw` every frame. */
export interface SceneFrame extends SceneSize {
  /** 2D context, already cleared and scaled to CSS pixels. */
  ctx: CanvasRenderingContext2D
  /** Seconds since the scene was created (0 when reduced motion is on). */
  time: number
  /** Seconds since the previous frame (clamped to at most 0.1; 0 for still frames). */
  dt: number
  /** `window.scrollY` in CSS pixels, for parallax (0 when reduced motion is on). */
  scrollY: number
  reducedMotion: boolean
  budget: SceneBudget
}

/** A running scene, created by `Scene.create`. */
export interface SceneInstance {
  draw(frame: SceneFrame): void
  resize?(size: SceneSize): void
  dispose?(): void
}

/** A background scene. Export one per file from `src/scenes/`. */
export interface Scene {
  /** Unique, stable id (kebab-case). The engine only crossfades when the id changes. */
  id: string
  create(setup: SceneSetup): SceneInstance
}
