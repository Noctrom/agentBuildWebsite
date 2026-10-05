import { isSceneBuild } from '../../scenes/build'
import type { Scene, SceneBudget, SceneBuild, SceneInstance, SceneSize } from '../../scenes/types'

/**
 * Imperative engine behind <SpaceBackground> (S24). Owns one <canvas> per
 * active scene inside `container`, the requestAnimationFrame loop, resizing,
 * crossfades, reduced motion and pausing while the tab is hidden. Scenes only
 * draw; see `src/scenes/types.ts` for the contract.
 *
 * Scenes with heavy setup can build incrementally (S29): their `create` is a
 * generator, which the engine steps in time-boxed tasks while the current
 * scene keeps animating, then crossfades once the new instance is ready.
 */

/**
 * Opacity the scene canvas is shown at over the page background (S24: 0.1,
 * raised to 0.2 in S32). Even pure white then composites to rgb(55 56 63),
 * which keeps every text token in `index.css` at WCAG AA over every panel;
 * the tightest pairs are accent on a surface nested twice (4.96:1) and accent
 * on the bare background (5.05:1). At 0.22 bare accent drops to 4.7, so this
 * is the cap with the current tokens. Recompute (table in `index.css`) before
 * raising it.
 */
export const BACKGROUND_MAX_OPACITY = 0.2

/**
 * Canvas resolution caps. The background is dim and soft, so it gains little
 * from more pixels, and fill rate is the main cost: at 1.5 the 375px view ran
 * at ~36 fps under 4x CPU throttling, at 1 it holds 60 fps. Large screens are
 * further scaled down to at most MAX_CANVAS_PIXELS backing pixels.
 */
const MAX_DPR = 1
const MAX_CANVAS_PIXELS = 1_100_000
/** Crossfade between scenes on navigation. */
const CROSSFADE_MS = 1200
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
  /** Scene time in seconds (excludes time paused). */
  time: number
  fadeFrom: number
  fadeTo: number
  fadeStart: number
  fadeMs: number
  opacity: number
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
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export class BackgroundEngine {
  private readonly container: HTMLElement
  private readonly onFail: () => void
  private reducedMotion: boolean
  private layers: Layer[] = []
  private pending: PendingBuild | null = null
  private size: SceneSize = { width: 0, height: 0, dpr: 1 }
  private frameId = 0
  private lastNow = 0
  private failed = false
  private destroyed = false
  private readonly resizeObserver: ResizeObserver | null

  constructor(container: HTMLElement, options: BackgroundEngineOptions) {
    this.container = container
    this.onFail = options.onFail
    this.reducedMotion = options.reducedMotion
    this.measure()
    this.resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.handleResize())
    this.resizeObserver?.observe(container)
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  /**
   * Show `scene`, crossfading from the current one unless reduced motion is
   * on. A generator `create` is built over several tasks first; the current
   * scene stays on screen until it is ready.
   */
  setScene(scene: Scene) {
    if (this.failed || this.destroyed) return
    if (this.pending?.scene.id === scene.id) return
    const current = this.layers.at(-1)
    if (current && current.scene.id === scene.id) {
      // Back on the shown scene before the next one finished building.
      this.cancelPending()
      return
    }
    this.beginScene(scene, false)
  }

  setReducedMotion(reducedMotion: boolean) {
    if (this.reducedMotion === reducedMotion) return
    this.reducedMotion = reducedMotion
    const target = this.pending?.scene ?? this.layers.at(-1)?.scene
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

  destroy() {
    this.destroyed = true
    this.cancelPending()
    this.stop()
    this.resizeObserver?.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    for (const layer of [...this.layers]) this.removeLayer(layer)
  }

  private measure() {
    const rect = this.container.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      MAX_DPR,
      Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    )
    // Round so tiny viewport changes don't trigger a rebuild.
    this.size = { width, height, dpr: Math.round(dpr * 100) / 100 }
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
    const current = this.layers.at(-1)
    const animate = !this.reducedMotion && !instant
    if (instant) {
      for (const old of [...this.layers]) this.removeLayer(old)
    } else {
      for (const old of this.layers) this.startFade(old, 0, animate ? CROSSFADE_MS : 0, now)
    }
    this.startFade(layer, 1, animate ? (current ? CROSSFADE_MS : INTRO_MS) : 0, now)
    this.layers.push(layer)
    this.container.appendChild(layer.canvas)
    this.refresh()
  }

  private createLayer(scene: Scene, instance: SceneInstance): Layer {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0'
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.sizeCanvas(canvas, ctx)
    return {
      scene,
      instance,
      canvas,
      ctx,
      time: 0,
      fadeFrom: 0,
      fadeTo: 0,
      fadeStart: 0,
      fadeMs: 0,
      opacity: 0,
    }
  }

  private sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    const { width, height, dpr } = this.size
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private removeLayer(layer: Layer) {
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

  /** Advance fades; returns true while any fade is still running. */
  private updateFades(now: number): boolean {
    let running = false
    for (const layer of [...this.layers]) {
      const t = layer.fadeMs > 0 ? Math.min(1, (now - layer.fadeStart) / layer.fadeMs) : 1
      layer.opacity = layer.fadeFrom + (layer.fadeTo - layer.fadeFrom) * easeInOut(t)
      layer.canvas.style.opacity = String(layer.opacity * BACKGROUND_MAX_OPACITY)
      if (t < 1) running = true
      else if (layer.fadeTo === 0) this.removeLayer(layer)
    }
    return running
  }

  private drawLayer(layer: Layer, dt: number) {
    const { ctx, canvas } = layer
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(this.size.dpr, 0, 0, this.size.dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    const still = this.reducedMotion
    layer.instance.draw({
      ctx,
      ...this.size,
      time: still ? 0 : layer.time,
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
    }
  }

  private start() {
    if (this.frameId) return
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
    const dt = Math.min(MAX_DT, Math.max(0, (now - this.lastNow) / 1000))
    this.lastNow = now
    for (const layer of this.layers) layer.time += dt
    this.updateFades(now)
    this.drawAll(dt)
    if (!this.failed && this.layers.length > 0) {
      this.frameId = requestAnimationFrame(this.tick)
    }
  }

  private readonly handleVisibility = () => {
    if (document.hidden) this.stop()
    else this.refresh()
  }

  private handleResize() {
    const prev = this.size
    this.measure()
    const { width, height, dpr } = this.size
    if (width === prev.width && height === prev.height && dpr === prev.dpr) return
    try {
      for (const layer of this.layers) {
        this.sizeCanvas(layer.canvas, layer.ctx)
        layer.instance.resize?.(this.size)
      }
    } catch (error) {
      this.fail(error)
      return
    }
    // Still frames must be redrawn; the loop redraws on its next frame anyway.
    if (this.reducedMotion || document.hidden) this.drawAll(0)
  }

  private fail(error: unknown) {
    if (this.failed) return
    this.failed = true
    console.error('Space background disabled:', error)
    this.cancelPending()
    this.stop()
    for (const layer of [...this.layers]) this.removeLayer(layer)
    this.onFail()
  }
}
