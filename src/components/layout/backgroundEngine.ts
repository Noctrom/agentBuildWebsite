import { isSceneBuild } from '../../scenes/build'
import type { Scene, SceneBudget, SceneBuild, SceneInstance, SceneSize } from '../../scenes/types'
import {
  clearMirrorSource,
  hasMirrors,
  repaintMirrors,
  setMirrorSource,
  type MirrorSource,
} from './backgroundMirror'
import { FrameRateMonitor } from './frameRateMonitor'

/**
 * Imperative engine behind <SpaceBackground> (S24). Owns one <canvas> per
 * active scene inside `container`, the requestAnimationFrame loop, resizing,
 * fades between scenes, reduced motion and pausing while the tab is hidden.
 * Scenes only draw; see `src/scenes/types.ts` for the contract.
 *
 * Scene changes (S33): on navigation the current scene starts fading out at
 * once (FADE_OUT_MS) and the new one fades in (FADE_IN_MS) as soon as it is
 * ready. Scenes with heavy setup build incrementally (S29): their `create` is
 * a generator, which the engine steps in time-boxed tasks; meanwhile the old
 * scene fades away and only the plain page background shows. A plain
 * `create` is ready at once, which gives a short crossfade. Going back to a
 * scene that is still fading out fades it back in instead of rebuilding it.
 * With reduce motion on, the old scene stays until the new one is ready and
 * is then swapped instantly.
 *
 * Slow devices (V0.42): `watchFrameRate` measures the loop's real frame
 * cadence, counting only steady frames (no build, no fade, tab visible), and
 * reports once if the animation runs consistently slow. See
 * frameRateMonitor.ts.
 *
 * Mirrors (V0.48): after every draw the engine repaints the background
 * mirrors (backgroundMirror.ts), small canvases such as the phone top bar's
 * backdrop that show a copy of the background at their spot.
 *
 * Contrast budget: the layers' opacities never sum to more than 1 (times
 * BACKGROUND_MAX_OPACITY), so overlapping fades are never brighter than one
 * scene at full opacity.
 *
 * Showcase (V0.61): while the page content is hidden (V0.57) there is no text
 * to keep readable, so `setShowcase(true)` raises the canvases from
 * BACKGROUND_MAX_OPACITY to full strength and, where the device can afford
 * it, draws them at the screen's native resolution ("sharp"). The strength
 * follows the content's fade (SHOWCASE_FADE_MS), or switches at once with
 * reduce motion. If the loop runs consistently slow while sharp, the engine
 * silently drops back to the standard resolution (keeping full strength)
 * for the rest of the page session; only after that does the V0.42
 * auto-pause monitor see any frames.
 */

/**
 * Opacity the scene canvas is shown at over the page background (S24: 0.1,
 * raised to 0.2 in S32). Even pure white then composites to rgb(55 56 63),
 * which keeps every text token in `index.css` at WCAG AA over every panel;
 * the tightest pairs are accent on a surface nested twice (4.96:1) and accent
 * on the bare background (5.05:1). At 0.22 bare accent drops to 4.7, so this
 * is the cap with the current tokens. Recompute (table in `index.css`) before
 * raising it. Showcase mode (V0.61) lifts it to 1 only while no text is shown.
 */
export const BACKGROUND_MAX_OPACITY = 0.2

/**
 * Canvas resolution caps. The background is dim and soft, so it gains little
 * from more pixels, and fill rate is the main cost: at 1.5 the 375px view ran
 * at ~36 fps under 4x CPU throttling, at 1 it holds 60 fps. Large screens are
 * further scaled down to at most MAX_CANVAS_PIXELS backing pixels. Showcase
 * mode (V0.61) uses MAX_SHARP_PIXELS and no DPR cap instead.
 */
const MAX_DPR = 1
const MAX_CANVAS_PIXELS = 1_100_000
/**
 * Sharp mode (V0.61, content hidden): no DPR cap, so the canvas has one
 * backing pixel per screen pixel. The only cap is a 4K panel's pixel count,
 * which any browser window on a 4K or Retina laptop screen fits; larger
 * screens (5K and up) are scaled down to it.
 */
const MAX_SHARP_PIXELS = 3840 * 2160
/**
 * Brightening and dimming in showcase mode (V0.61). Matches the content's
 * fade in contentVisibility.ts (300 ms, ease-out), so they move together.
 */
const SHOWCASE_FADE_MS = 300
/**
 * Fade-out of the old scene, started as soon as the scene changes (S33).
 * React renders the new page first (~40-80 ms after the click on desktop,
 * more on a slow phone), so 160 here means the old scene is gone ~250 ms
 * after the click on desktop. It eases out, so it visibly dims at once.
 */
const FADE_OUT_MS = 160
/** Fade-in of a new scene once it is ready (S33). */
const FADE_IN_MS = 250
/** Fade-in of the first scene after load. */
const INTRO_MS = 1500
/** Largest time step passed to scenes (e.g. after a long frame). */
const MAX_DT = 0.1
/**
 * Main-thread time per task for incremental scene builds. Short enough that
 * a 60 fps frame still fits the task, the animation tick and the browser's
 * own work on a slow phone.
 */
const BUILD_SLICE_MS = 6

const budget: SceneBudget = { maxOpacity: BACKGROUND_MAX_OPACITY }

interface Layer {
  scene: Scene
  instance: SceneInstance
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /**
   * Size this layer's canvas and instance have. Usually the engine's size;
   * differs while a showcase resolution rebuild runs, and for a layer that
   * was fading out when the resolution changed.
   */
  size: SceneSize
  /** Scene time in seconds (excludes time paused). */
  time: number
  fadeFrom: number
  fadeTo: number
  fadeStart: number
  fadeMs: number
  opacity: number
}

/**
 * A shown layer being rebuilt at a new resolution in the background
 * (V0.61), so switching sharp mode never stalls the animation. The old
 * instance keeps drawing until the new one is ready, then they swap.
 */
interface Rebuild {
  layer: Layer
  build: SceneBuild
  size: SceneSize
  /** setTimeout id of the next task (0 while none is queued). */
  timer: number
  /** The built instance and its canvas (off screen), once `build` is done. */
  next: { instance: SceneInstance; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null
  /** `next` has drawn its first frame and is ready to swap in. */
  primed: boolean
}

function sameSize(a: SceneSize, b: SceneSize) {
  return a.width === b.width && a.height === b.height && a.dpr === b.dpr
}

/** An incremental scene build in progress (S29). */
interface PendingBuild {
  scene: Scene
  build: SceneBuild
  /** Viewport size the build started with; the instance is resized if it changed. */
  size: SceneSize
  /** Replace the current layers without a crossfade (reduce motion changed). */
  instant: boolean
  /** setTimeout id of the next slice (0 while none is queued). */
  timer: number
}

export interface BackgroundEngineOptions {
  reducedMotion: boolean
  /** Called once if canvas is unsupported or a scene throws; the engine stops. */
  onFail: () => void
  /**
   * May showcase mode draw at native resolution (V0.61)? False on phones,
   * which get full strength only. Defaults to true.
   */
  allowSharp?: boolean
}

/**
 * Close to CSS `ease-out` as Tailwind defines it (cubic-bezier(0, 0, 0.2, 1)),
 * which the content fade uses.
 */
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/** Fast start: a fade-out is visible from its first frame. */
function easeOut(t: number) {
  return 1 - (1 - t) ** 2
}

export class BackgroundEngine implements MirrorSource {
  private readonly container: HTMLElement
  private readonly onFail: () => void
  private reducedMotion: boolean
  private layers: Layer[] = []
  private pending: PendingBuild | null = null
  private rebuild: Rebuild | null = null
  /** False until the first scene is shown; that one uses the slower intro fade. */
  private introDone = false
  private size: SceneSize = { width: 0, height: 0, dpr: 1 }
  private frameId = 0
  private lastNow = 0
  private failed = false
  private destroyed = false
  /** Slow-frame detection (V0.42); null while not watching. */
  private monitor: FrameRateMonitor | null = null
  /** Content is hidden: full strength, sharp where allowed (V0.61). */
  private showcase = false
  /**
   * Canvas opacity of a fully shown layer: BACKGROUND_MAX_OPACITY normally,
   * 1 in showcase mode, in between while it fades.
   */
  private strength = BACKGROUND_MAX_OPACITY
  private strengthFrom = BACKGROUND_MAX_OPACITY
  private strengthTo = BACKGROUND_MAX_OPACITY
  private strengthStart = 0
  private strengthMs = 0
  /** May showcase mode be sharp on this device (false on phones). */
  private readonly sharpAllowed: boolean
  /** Sharp mode is on and adds pixels (the device DPR is above the standard cap). */
  private sharpActive = false
  /** Sharp mode ran slow once; it stays off for this page session. */
  private sharpBlocked = false
  /** Watches the frame rate while sharp mode is active; null otherwise. */
  private sharpMonitor: FrameRateMonitor | null = null
  private readonly resizeObserver: ResizeObserver | null

  constructor(container: HTMLElement, options: BackgroundEngineOptions) {
    this.container = container
    this.onFail = options.onFail
    this.reducedMotion = options.reducedMotion
    this.sharpAllowed = options.allowSharp ?? true
    this.measure()
    this.resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.applySize())
    this.resizeObserver?.observe(container)
    document.addEventListener('visibilitychange', this.handleVisibility)
    setMirrorSource(this)
  }

  /** Backing px per CSS px of the scene canvases (MirrorSource). */
  get scale() {
    return this.size.dpr
  }

  /**
   * Copy the background as shown now into `ctx.canvas` (MirrorSource, V0.48):
   * the area whose top-left corner is at (`left`, `top`) in the viewport, at
   * the same backing scale. Each layer is drawn with the opacity its canvas
   * is shown at, so over the same solid page color the copy matches the page
   * pixel for pixel. The container is fixed at the viewport's top-left, so
   * viewport and container coordinates are the same. A layer at another
   * resolution (V0.61, mid-rebuild) is scaled to `scale`.
   */
  paintCopy(ctx: CanvasRenderingContext2D, left: number, top: number) {
    const { width, height } = ctx.canvas
    for (const layer of this.layers) {
      const alpha = layer.opacity * this.strength
      if (alpha <= 0) continue
      const { dpr } = layer.size
      const k = dpr / this.size.dpr
      ctx.globalAlpha = alpha
      ctx.drawImage(
        layer.canvas,
        Math.round(left * dpr),
        Math.round(top * dpr),
        width * k,
        height * k,
        0,
        0,
        width,
        height,
      )
    }
    ctx.globalAlpha = 1
  }

  /**
   * Show `scene`. The current scene starts fading out now and the new one
   * fades in once it is ready (a generator `create` is built over several
   * tasks first). With reduced motion on, the current scene stays until the
   * new one is ready and is then swapped instantly.
   */
  setScene(scene: Scene) {
    if (this.failed || this.destroyed) return
    // A route change: its render, build and fade are not the device's steady pace.
    this.monitor?.reset()
    if (this.pending?.scene.id === scene.id) return
    if (this.reducedMotion) {
      const current = this.layers.at(-1)
      if (current && current.scene.id === scene.id) {
        // Back on the shown scene before the next one finished building.
        this.cancelPending()
        return
      }
      this.beginScene(scene, false)
      return
    }
    const now = performance.now()
    // A layer of this scene that is shown, fading in, or still fading out.
    const existing = this.layers.findLast((layer) => layer.scene.id === scene.id)
    if (existing) {
      // Back on a scene that is still on screen: keep it instead of rebuilding.
      this.cancelPending()
      for (const layer of this.layers) {
        if (layer !== existing) this.fadeOut(layer, now)
      }
      if (existing.fadeTo !== 1) this.startFade(existing, 1, FADE_IN_MS, now)
      // It may have been fading out when the resolution changed.
      if (this.rebuild?.layer !== existing) this.startRebuild(existing)
      this.refresh()
      return
    }
    this.cancelRebuild()
    for (const layer of this.layers) this.fadeOut(layer, now)
    this.refresh()
    this.beginScene(scene, false)
  }

  setReducedMotion(reducedMotion: boolean) {
    if (this.reducedMotion === reducedMotion) return
    this.reducedMotion = reducedMotion
    this.monitor?.reset()
    this.sharpMonitor?.reset()
    // A running strength fade ends now.
    this.strengthMs = 0
    // The layer is rebuilt below anyway, at the current size.
    this.cancelRebuild()
    // The scene being shown: the one building, else the layer fading in or
    // shown (after a quick "back" it need not be the top layer).
    const target =
      this.pending?.scene ?? this.layers.findLast((layer) => layer.fadeTo !== 0)?.scene
    // Settle any fade now: drop outgoing layers, show the incoming one fully.
    const now = performance.now()
    for (const layer of [...this.layers]) {
      if (layer.fadeTo === 0) this.removeLayer(layer)
      else this.startFade(layer, 1, 0, now)
    }
    this.refresh()
    // Rebuild with the new flag; the old layer stays until the new one is ready.
    if (target) this.beginScene(target, true)
  }

  /**
   * Showcase mode (V0.61), on while the page content is hidden: the
   * background goes to full strength and, where allowed, native resolution.
   * Off returns both to normal. The strength fades over SHOWCASE_FADE_MS
   * with the content, or switches at once with reduced motion. The new
   * resolution is built in the background while the scene animates (see
   * `applySize`), or at once for a still frame.
   */
  setShowcase(showcase: boolean) {
    if (this.showcase === showcase || this.failed || this.destroyed) return
    this.showcase = showcase
    this.strengthFrom = this.strength
    this.strengthTo = showcase ? 1 : BACKGROUND_MAX_OPACITY
    this.strengthStart = performance.now()
    this.strengthMs = this.reducedMotion ? 0 : SHOWCASE_FADE_MS
    this.applySize(true)
    this.refresh()
  }

  /**
   * Start (or with `null`, stop) watching for a consistently slow animation
   * (V0.42). `onSlow` is called at most once; watching then stops. Only
   * steady animated frames count, so it never fires while animation is off.
   */
  watchFrameRate(onSlow: (() => void) | null) {
    if (!onSlow) {
      this.monitor = null
      return
    }
    const monitor = new FrameRateMonitor(() => {
      if (this.monitor === monitor) this.monitor = null
      onSlow()
    })
    this.monitor = monitor
  }

  destroy() {
    this.destroyed = true
    this.cancelPending()
    this.cancelRebuild()
    this.stop()
    this.resizeObserver?.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    for (const layer of [...this.layers]) this.removeLayer(layer)
    clearMirrorSource(this)
  }

  private measure() {
    const rect = this.container.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const device = window.devicePixelRatio || 1
    const capped = (maxDpr: number, maxPixels: number) => {
      const dpr = Math.min(device, maxDpr, Math.sqrt(maxPixels / (width * height)))
      // Round a pixel cap so tiny viewport changes don't trigger a rebuild.
      // The device ratio itself is stable and stays exact, so a sharp canvas
      // is exactly its on-screen size x devicePixelRatio.
      return dpr === device ? dpr : Math.round(dpr * 100) / 100
    }
    const standard = capped(MAX_DPR, MAX_CANVAS_PIXELS)
    const dpr =
      this.showcase && this.sharpAllowed && !this.sharpBlocked
        ? capped(Infinity, MAX_SHARP_PIXELS)
        : standard
    this.size = { width, height, dpr }
    const sharpActive = dpr > standard
    if (sharpActive && !this.sharpActive) {
      // A fresh monitor per sharp period; it fires at most once.
      const monitor = new FrameRateMonitor(() => {
        if (this.sharpMonitor !== monitor) return
        // Too slow at native resolution: standard resolution from now on,
        // still at full strength. Silent (V0.61).
        this.sharpBlocked = true
        this.applySize(true)
      })
      this.sharpMonitor = monitor
    } else if (!sharpActive) {
      this.sharpMonitor = null
    }
    this.sharpActive = sharpActive
  }

  /** Create `scene`: show it now, or start an incremental build. */
  private beginScene(scene: Scene, instant: boolean) {
    this.cancelPending()
    let result: SceneInstance | SceneBuild
    try {
      result = scene.create({ ...this.size, reducedMotion: this.reducedMotion, budget })
    } catch (error) {
      this.fail(error)
      return
    }
    if (!isSceneBuild(result)) {
      this.showScene(scene, result, instant)
      return
    }
    // A generator's body has not run yet; the first slice runs in a later
    // task, so the new page paints before any scene work.
    this.pending = { scene, build: result, size: this.size, instant, timer: 0 }
    this.schedulePump()
  }

  private schedulePump() {
    if (this.pending && !this.pending.timer) this.pending.timer = window.setTimeout(this.pump, 0)
  }

  /** Run build slices for up to BUILD_SLICE_MS (to the end in a hidden tab). */
  private readonly pump = () => {
    const pending = this.pending
    if (!pending || this.failed || this.destroyed) return
    pending.timer = 0
    const deadline = performance.now() + BUILD_SLICE_MS
    let instance: SceneInstance | null = null
    try {
      for (;;) {
        const step = pending.build.next()
        if (step.done) {
          instance = step.value
          break
        }
        if (!document.hidden && performance.now() >= deadline) break
      }
    } catch (error) {
      this.fail(error)
      return
    }
    if (!instance) {
      this.schedulePump()
      return
    }
    this.pending = null
    const { width, height, dpr } = this.size
    if (width !== pending.size.width || height !== pending.size.height || dpr !== pending.size.dpr) {
      try {
        instance.resize?.(this.size)
      } catch (error) {
        this.fail(error)
        return
      }
    }
    this.showScene(pending.scene, instance, pending.instant)
  }

  /** Abandon an incremental build, letting its `finally` blocks run. */
  private cancelPending() {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    window.clearTimeout(pending.timer)
    try {
      pending.build.return(undefined as never)
    } catch {
      // A scene failing to clean up must not break the page.
    }
  }

  /** Add a layer for a ready instance and fade it in (or swap it in at once). */
  private showScene(scene: Scene, instance: SceneInstance, instant: boolean) {
    let layer: Layer
    try {
      layer = this.createLayer(scene, instance)
    } catch (error) {
      try {
        instance.dispose?.()
      } catch {
        // Already failing; ignore cleanup errors.
      }
      this.fail(error)
      return
    }
    const now = performance.now()
    const animate = !this.reducedMotion && !instant
    if (!animate) {
      for (const old of [...this.layers]) this.removeLayer(old)
    } else {
      // Normally already fading out since setScene; this only catches stragglers.
      for (const old of this.layers) this.fadeOut(old, now)
    }
    this.startFade(layer, 1, animate ? (this.introDone ? FADE_IN_MS : INTRO_MS) : 0, now)
    this.introDone = true
    this.layers.push(layer)
    this.container.appendChild(layer.canvas)
    this.refresh()
  }

  private createLayer(scene: Scene, instance: SceneInstance): Layer {
    const { canvas, ctx } = this.createCanvas(this.size, '0')
    return {
      scene,
      instance,
      canvas,
      ctx,
      size: this.size,
      time: 0,
      fadeFrom: 0,
      fadeTo: 0,
      fadeStart: 0,
      fadeMs: 0,
      opacity: 0,
    }
  }

  private createCanvas(size: SceneSize, opacity: string) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;opacity:${opacity}`
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.sizeCanvas(canvas, ctx, size)
    return { canvas, ctx }
  }

  private sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, size: SceneSize) {
    const { width, height, dpr } = size
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /**
   * Bring the shown `layer` to the engine's size without stalling the
   * animation (V0.61). A new instance of its scene is made at that size in
   * the background while the old one keeps drawing, in separate tasks
   * between frames: `create` (a generator in time-boxed slices, as for a
   * scene change), then one priming draw on a new canvas that is not on
   * screen yet (a scene's first draw uploads its new caches, which can take
   * a frame or two). The next animation frame swaps the canvases.
   */
  private startRebuild(layer: Layer) {
    this.cancelRebuild()
    if (sameSize(layer.size, this.size)) return
    const size = this.size
    const setup = { ...size, reducedMotion: this.reducedMotion, budget }
    // Defer even a plain `create` to its own task.
    const build: SceneBuild = (function* () {
      const result = layer.scene.create(setup)
      return isSceneBuild(result) ? yield* result : result
    })()
    this.rebuild = { layer, build, size, timer: 0, next: null, primed: false }
    this.scheduleRebuildPump()
  }

  private scheduleRebuildPump() {
    if (this.rebuild && !this.rebuild.timer) {
      this.rebuild.timer = window.setTimeout(this.pumpRebuild, 0)
    }
  }

  /** One rebuild task: build slices for up to BUILD_SLICE_MS, else the priming draw. */
  private readonly pumpRebuild = () => {
    const rebuild = this.rebuild
    if (!rebuild || this.failed || this.destroyed) return
    rebuild.timer = 0
    try {
      if (!rebuild.next) {
        const deadline = performance.now() + BUILD_SLICE_MS
        for (;;) {
          const step = rebuild.build.next()
          if (step.done) {
            rebuild.next = { instance: step.value, ...this.createCanvas(rebuild.size, '0') }
            break
          }
          // In a hidden tab, run to the end at once.
          if (!document.hidden && performance.now() >= deadline) break
        }
        if (!document.hidden || !rebuild.next) {
          this.scheduleRebuildPump()
          return
        }
      }
      const { instance, canvas, ctx } = rebuild.next
      this.drawScene(instance, ctx, canvas, rebuild.size, rebuild.layer.time, 0)
      rebuild.primed = true
    } catch (error) {
      this.fail(error)
      return
    }
    // The loop swaps it in at its next frame; with no loop running (hidden
    // tab), swap and draw now.
    if (!this.frameId) {
      this.finishRebuild()
      if (this.layers.length) this.drawAll(0)
    }
  }

  /** Abandon a resolution rebuild, letting its `finally` blocks run. */
  private cancelRebuild() {
    const rebuild = this.rebuild
    if (!rebuild) return
    this.rebuild = null
    window.clearTimeout(rebuild.timer)
    try {
      rebuild.build.return(undefined as never)
      rebuild.next?.instance.dispose?.()
    } catch {
      // A scene failing to clean up must not break the page.
    }
  }

  /**
   * Swap a primed rebuild in: the layer takes the new instance and canvas,
   * the old canvas leaves the DOM in the same frame, so the screen never
   * shows an empty or half-drawn frame. The caller draws the layer next.
   */
  private finishRebuild() {
    const rebuild = this.rebuild
    if (!rebuild?.next || !rebuild.primed) return
    this.rebuild = null
    const { layer } = rebuild
    const old = { instance: layer.instance, canvas: layer.canvas }
    const { instance, canvas, ctx } = rebuild.next
    canvas.style.opacity = old.canvas.style.opacity
    Object.assign(layer, { instance, canvas, ctx, size: rebuild.size })
    old.canvas.replaceWith(canvas)
    try {
      old.instance.dispose?.()
    } catch {
      // A scene failing to clean up must not break the page.
    }
    this.monitor?.reset()
    this.sharpMonitor?.reset()
  }


  private removeLayer(layer: Layer) {
    if (this.rebuild?.layer === layer) this.cancelRebuild()
    this.layers = this.layers.filter((l) => l !== layer)
    layer.canvas.remove()
    try {
      layer.instance.dispose?.()
    } catch {
      // A scene failing to clean up must not break the page.
    }
  }

  private startFade(layer: Layer, to: number, ms: number, now: number) {
    layer.fadeFrom = layer.opacity
    layer.fadeTo = to
    layer.fadeStart = now
    layer.fadeMs = ms
  }

  /** Start fading `layer` out, unless it already is. */
  private fadeOut(layer: Layer, now: number) {
    if (layer.fadeTo !== 0) this.startFade(layer, 0, FADE_OUT_MS, now)
  }

  /**
   * Advance fades; returns true while any fade is still running. Layers
   * fading in are capped so all opacities sum to at most 1 (contrast budget).
   */
  private updateFades(now: number): boolean {
    let running = this.updateStrength(now)
    let outgoing = 0
    const done: Layer[] = []
    for (const layer of this.layers) {
      // A rAF timestamp can be earlier than a fade started in the same frame,
      // so clamp below too.
      const t =
        layer.fadeMs > 0 ? Math.min(1, Math.max(0, (now - layer.fadeStart) / layer.fadeMs)) : 1
      const ease = layer.fadeTo === 0 ? easeOut(t) : easeInOut(t)
      layer.opacity = layer.fadeFrom + (layer.fadeTo - layer.fadeFrom) * ease
      if (t < 1) running = true
      else if (layer.fadeTo === 0) done.push(layer)
      if (layer.fadeTo === 0) outgoing += layer.opacity
    }
    let room = Math.max(0, 1 - outgoing)
    for (const layer of this.layers) {
      if (layer.fadeTo !== 0) {
        if (layer.opacity > room) {
          layer.opacity = room
          running = true
        }
        room -= layer.opacity
      }
      layer.canvas.style.opacity = String(layer.opacity * this.strength)
    }
    for (const layer of done) this.removeLayer(layer)
    return running
  }

  /** Advance the showcase strength fade; returns true while it runs. */
  private updateStrength(now: number): boolean {
    const t =
      this.strengthMs > 0
        ? Math.min(1, Math.max(0, (now - this.strengthStart) / this.strengthMs))
        : 1
    this.strength = this.strengthFrom + (this.strengthTo - this.strengthFrom) * easeOutCubic(t)
    return t < 1
  }

  private drawLayer(layer: Layer, dt: number) {
    this.drawScene(layer.instance, layer.ctx, layer.canvas, layer.size, layer.time, dt)
  }

  private drawScene(
    instance: SceneInstance,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    size: SceneSize,
    time: number,
    dt: number,
  ) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    const still = this.reducedMotion
    instance.draw({
      ctx,
      ...size,
      time: still ? 0 : time,
      dt: still ? 0 : dt,
      scrollY: still ? 0 : window.scrollY,
      reducedMotion: still,
      budget,
    })
  }

  /** Draw now, then keep animating unless reduced motion is on or the tab is hidden. */
  private refresh() {
    if (this.failed || this.destroyed) return
    if (this.reducedMotion) {
      this.stop()
      this.updateFades(performance.now())
      this.drawAll(0)
      return
    }
    if (!document.hidden) this.start()
  }

  private drawAll(dt: number) {
    try {
      for (const layer of this.layers) this.drawLayer(layer, dt)
    } catch (error) {
      this.fail(error)
      return
    }
    if (hasMirrors()) repaintMirrors()
  }

  private start() {
    if (this.frameId) return
    // The loop was stopped (hidden tab, reduced motion, no layers): that gap
    // and the first interval after it are not frame times.
    this.monitor?.reset()
    this.lastNow = performance.now()
    this.frameId = requestAnimationFrame(this.tick)
  }

  private stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId)
    this.frameId = 0
  }

  private readonly tick = (now: number) => {
    this.frameId = 0
    if (this.failed || this.destroyed) return
    const interval = now - this.lastNow
    const dt = Math.min(MAX_DT, Math.max(0, interval / 1000))
    this.lastNow = now
    for (const layer of this.layers) layer.time += dt
    const fading = this.updateFades(now)
    // A primed resolution rebuild (V0.61) takes over in this frame's draw.
    if (this.rebuild?.primed) this.finishRebuild()
    this.drawAll(dt)
    // Steady: on screen, animating, nothing building, rebuilding or fading.
    // While sharp mode is active only its own monitor counts frames, so a
    // slow sharp frame rate first drops the resolution (V0.61), and only a
    // slow standard one can auto-pause (V0.42).
    const steady = !(
      fading ||
      this.pending ||
      this.rebuild ||
      document.hidden ||
      this.layers.length === 0
    )
    if (steady && this.sharpActive) {
      this.monitor?.reset()
      this.sharpMonitor?.frame(now, interval)
    } else if (steady) {
      this.monitor?.frame(now, interval)
    } else {
      this.monitor?.reset()
      this.sharpMonitor?.reset()
    }
    if (!this.failed && this.layers.length > 0) {
      this.frameId = requestAnimationFrame(this.tick)
    }
  }

  private readonly handleVisibility = () => {
    if (document.hidden) this.stop()
    else this.refresh()
  }

  /**
   * Re-measure (viewport size, DPR, showcase sharp mode) and resize every
   * layer if the canvas size changed.
   */
  /**
   * Re-measure (viewport size, DPR, showcase sharp mode) and bring the layers
   * to the new size if it changed.
   *
   * `gradual` (V0.61, showcase on/off and the sharp fallback) while the
   * scene animates: the shown layer is rebuilt in the background and swapped
   * in when ready (`startRebuild`), because a scene's `resize` rebuilds all
   * its caches at once (the sun took ~65 ms at 1x and ~225 ms at 4x CPU
   * throttle), which showed as a hitch at the start of the fade. Layers
   * fading out keep their size until they are removed.
   *
   * Otherwise (a real resize, or a still frame) every layer is resized at
   * once and redrawn.
   */
  private applySize(gradual = false) {
    if (this.failed || this.destroyed) return
    const prev = this.size
    this.measure()
    if (sameSize(prev, this.size)) return
    // Resizing (e.g. rotating a phone) costs frames that say nothing about the device.
    this.monitor?.reset()
    this.sharpMonitor?.reset()
    const shown = this.layers.findLast((layer) => layer.fadeTo !== 0)
    if (gradual && !this.reducedMotion && shown) {
      this.startRebuild(shown)
      return
    }
    this.cancelRebuild()
    try {
      for (const layer of this.layers) {
        if (sameSize(layer.size, this.size)) continue
        this.sizeCanvas(layer.canvas, layer.ctx, this.size)
        layer.size = this.size
        layer.instance.resize?.(this.size)
      }
    } catch (error) {
      this.fail(error)
      return
    }
    // Resizing clears the canvases, and this can run after this frame's draw
    // (a ResizeObserver callback), so redraw now rather than show an empty
    // frame. dt 0: no scene time passes.
    this.updateFades(performance.now())
    this.drawAll(0)
  }

  private fail(error: unknown) {
    if (this.failed) return
    this.failed = true
    this.monitor = null
    this.sharpMonitor = null
    console.error('Space background disabled:', error)
    this.cancelPending()
    this.cancelRebuild()
    this.stop()
    for (const layer of [...this.layers]) this.removeLayer(layer)
    clearMirrorSource(this)
    this.onFail()
  }
}
