import type { Scene, SceneBudget, SceneInstance, SceneSize } from '../../scenes/types'

/**
 * Imperative engine behind <SpaceBackground> (S24). Owns one <canvas> per
 * active scene inside `container`, the requestAnimationFrame loop, resizing,
 * crossfades, reduced motion and pausing while the tab is hidden. Scenes only
 * draw; see `src/scenes/types.ts` for the contract.
 */

/**
 * Opacity the scene canvas is shown at over the page background. Even pure
 * white then composites to rgb(30 31 39), which keeps every text token in
 * `index.css` at WCAG AA, including muted text on a surface nested twice
 * (4.76:1). Recompute before raising it.
 */
export const BACKGROUND_MAX_OPACITY = 0.1

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

  /** Show `scene`, crossfading from the current one unless reduced motion is on. */
  setScene(scene: Scene) {
    if (this.failed || this.destroyed) return
    const current = this.layers.at(-1)
    if (current && current.scene.id === scene.id) return

    const layer = this.createLayer(scene)
    if (!layer) return
    const now = performance.now()
    const animate = !this.reducedMotion
    for (const old of this.layers) {
      this.startFade(old, 0, animate ? CROSSFADE_MS : 0, now)
    }
    this.startFade(layer, 1, animate ? (current ? CROSSFADE_MS : INTRO_MS) : 0, now)
    this.layers.push(layer)
    this.container.appendChild(layer.canvas)
    this.refresh()
  }

  setReducedMotion(reducedMotion: boolean) {
    if (this.reducedMotion === reducedMotion) return
    this.reducedMotion = reducedMotion
    // Finish any fade immediately and rebuild scenes with the new flag.
    for (const layer of this.layers) {
      if (layer.fadeTo === 0) this.removeLayer(layer)
    }
    const scenes = this.layers.map((l) => l.scene)
    for (const layer of [...this.layers]) this.removeLayer(layer)
    for (const scene of scenes) {
      const layer = this.createLayer(scene)
      if (!layer) return
      this.startFade(layer, 1, 0, performance.now())
      this.layers.push(layer)
      this.container.appendChild(layer.canvas)
    }
    this.refresh()
  }

  destroy() {
    this.destroyed = true
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

  private createLayer(scene: Scene): Layer | null {
    try {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0'
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D is not available')
      this.sizeCanvas(canvas, ctx)
      const instance = scene.create({ ...this.size, reducedMotion: this.reducedMotion, budget })
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
    } catch (error) {
      this.fail(error)
      return null
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
    this.stop()
    for (const layer of [...this.layers]) this.removeLayer(layer)
    this.onFail()
  }
}
