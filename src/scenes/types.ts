/**
 * Scene contract for the animated space background (S24).
 *
 * A scene is a self-contained Canvas 2D drawing: a starfield, a solar system,
 * a black hole... The background engine (`components/layout/SpaceBackground`)
 * owns the canvas, the animation loop, resizing, fades between scenes,
 * "reduce motion" (the footer Animation switch, else the OS setting), pausing in hidden tabs and the static fallback. A scene only
 * draws. You can add or change scenes without touching the engine, `Layout` or
 * `ui/`:
 *
 *   1. Create a file in `src/scenes/`, e.g. `blackHole.ts`, exporting a `Scene`.
 *   2. Map its route in `src/scenes/routes.ts`.
 *
 * Lifecycle
 * - `create(setup)` runs when the scene becomes active (on page load or
 *   navigation), and again in the background when the visitor hides or shows
 *   the page content (see "Size changes between the views" below).
 *   Precompute here: star positions, offscreen canvases, sprites.
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
 * Heavy setup: building over several frames (S29)
 * - `create` runs on the main thread right after a navigation. Anything over
 *   ~16 ms freezes every animation on the page for that long; on a slow phone
 *   (4x CPU throttle at 375px) the S27 nebula bake took ~185 ms and the sun
 *   ~90 ms, which showed as a 200-300 ms hitch as the new page appeared.
 * - If `create` does more than a few ms of work, write it as a generator
 *   function instead: do a slice of work, `yield`, repeat, and finally
 *   `return` the instance. The engine runs the slices in small time-boxed
 *   tasks between frames and fades the new scene in (~250 ms) once the
 *   instance is returned. Since S33 the previous scene fades out (~160 ms)
 *   as soon as the visitor navigates, so a long build shows the plain page
 *   background meanwhile.
 *   `yield` often enough that one slice stays under ~5 ms on a slow phone
 *   (e.g. every few rows of an `ImageData` bake); yielding often is cheap,
 *   since the engine runs as many slices per task as fit its time budget.
 * - The generator may be abandoned at any `yield` (the visitor navigated on,
 *   reduce motion changed, the page unmounted): the engine then calls its
 *   `return()`, so `finally` blocks run, and never calls `dispose`. Don't
 *   leave shared state (e.g. a module-level cache) half written across a
 *   `yield`; fill a local and assign it at the end.
 * - If the viewport is resized while the build runs, the engine calls
 *   `resize` on the new instance before showing it. `resize` itself stays
 *   synchronous; to reuse a generator bake there, run it with `runToEnd` from
 *   `./build`.
 * - Plain (non-generator) `create` keeps working exactly as before. In a
 *   hidden tab the engine runs a build to the end at once.
 *
 *   export const heavyScene: Scene = {
 *     id: 'heavy',
 *     *create(setup) {
 *       const img = new ImageData(w, h)
 *       for (let y = 0; y < h; y++) {
 *         bakeRow(img, y)
 *         if (y % 8 === 7) yield
 *       }
 *       // ...put the image on an offscreen canvas...
 *       return { draw(frame) { ... } }
 *     },
 *   }
 *
 * Brightness (contrast budget) and the two views
 * - Draw at full brightness. A scene is shown in two views, and the engine
 *   picks the opacity and resolution; scenes draw the same in both:
 *   - Normal view (page content shown): the canvas is shown at a fixed low
 *     opacity (`budget.maxOpacity`, 0.2 since S32) over the page background,
 *     at a DPR capped at 1 (lower on very large screens), so even pure white
 *     ends up at most rgb(55 56 63). That keeps every text color in
 *     `index.css` at WCAG AA (>= 4.5:1) at every frame, on the bare
 *     background and on surface panels nested twice (lowest: accent, 4.96).
 *     Scenes cannot break contrast, and should not try to compensate by
 *     brightening further; contrast against text is not their job.
 *   - Hidden-content view (V0.57 eye button, V0.61 "showcase"): no text is
 *     shown, so the canvas goes to full strength (opacity 1, 5x brighter)
 *     and, except on phones, to the screen's native DPR, capped at
 *     3840x2160 backing pixels (larger screens are scaled down to that).
 *     Phones get full strength at the normal resolution. If the sharp view
 *     runs slow, the engine silently drops back to the normal resolution
 *     (still at full strength) for the rest of the visit. The change fades
 *     with the content (~300 ms), or switches at once with reduced motion.
 *     `budget.maxOpacity` stays 0.2 in this view: it describes the normal
 *     cap, not the current opacity.
 * - Because the normal view is scaled down, contrast *inside* the scene
 *   matters: use alpha 0.4-1 for things that should be visible.
 * - Build for full strength too: at opacity 1 every flaw is 5x more visible.
 *   Soft layers (clouds, glows, gradients baked into textures) must not show
 *   banding or blockiness: bake them at enough resolution (or in device
 *   pixels via `dpr`) and add a little dither or noise to long, smooth
 *   gradients. Check a new scene with the content hidden, on a DPR 2 screen.
 *
 * Size changes between the views
 * - Switching views changes `dpr` (on desktops and tablets). While the scene
 *   animates, the engine does not call `resize` for this: it builds a fresh
 *   instance of the scene at the new size in the background (`create`, run
 *   in slices if it is a generator, plus one priming `draw` off screen),
 *   keeps the old instance drawing meanwhile, then swaps them and disposes
 *   the old one. `frame.time` carries on from the old instance, so the
 *   motion does not jump. `create` must give the same picture as `create` +
 *   `resize` at that size, and should not depend on randomness that changes
 *   the look between two calls (use a fixed seed). A real viewport resize, or any size change while
 *   reduced motion is on, still calls `resize` at once and redraws.
 *
 * Motion
 * - `frame.time` is seconds since the scene was created, paused while the tab
 *   is hidden. Animate from `time` (positions = f(time)), not by accumulating
 *   `dt`, so a still frame at any time looks right.
 * - With `reducedMotion` true the engine calls `draw` once (and again after a
 *   resize) with `time = 0` and `scrollY = 0`: the scene must look complete
 *   and good at time 0. Scenes swap instantly in that mode (the old one stays
 *   until the new one is ready).
 * - Keep motion subtle: slow drift, gentle twinkle, slight parallax on scroll
 *   (`frame.scrollY`). Nothing should flash or move fast behind text.
 *
 * Example: see `starfield.ts` (the base most scenes draw first). A minimal scene:
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
  /**
   * Canvas pixels per CSS pixel. Normal view: capped by the engine at 1,
   * lower on very large screens (at most 1.1 M backing pixels). Hidden-content
   * view (V0.61): the device's native ratio, capped at 3840x2160 backing
   * pixels; not on phones, and back to the normal cap if it runs slow. When it
   * changes, the engine rebuilds the scene at the new size in the background
   * (see "Size changes between the views" above).
   */
  dpr: number
}

/** How bright the background may get. Enforced by the engine, informational for scenes. */
export interface SceneBudget {
  /**
   * Opacity the canvas is shown at over the page background (0..1) in the
   * normal view. Stays at this value while the content is hidden, even
   * though the engine then shows the canvas at 1 (V0.61).
   */
  maxOpacity: number
}

/** Passed to `Scene.create`. */
export interface SceneSetup extends SceneSize {
  /**
   * Animation is off: the visitor's footer choice (V0.41), else the automatic
   * low-power pause (V0.42), else the OS "reduce motion" setting. `draw` is
   * then called once per resize with time 0.
   */
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

/**
 * An incremental `create` (S29): a generator that does a slice of setup work
 * between `yield`s and returns the instance. Yielded values are ignored.
 * See "Heavy setup" above.
 */
export type SceneBuild = Generator<unknown, SceneInstance, undefined>

/** A background scene. Export one per file from `src/scenes/`. */
export interface Scene {
  /** Unique, stable id (kebab-case). The engine only changes scenes when the id changes. */
  id: string
  /**
   * Build the scene: return the instance directly, or (for heavy setup) be a
   * generator function that yields between slices of work. See "Heavy setup".
   */
  create(setup: SceneSetup): SceneInstance | SceneBuild
}
