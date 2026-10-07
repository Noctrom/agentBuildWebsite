import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { sceneForPath } from '../../scenes/routes'
import { BackgroundEngine } from './backgroundEngine'
import { setMirrorFallback } from './backgroundMirror'
import {
  getMotionChoice,
  getReducedMotion,
  setMotionChoice,
  useMotionChoice,
  useReducedMotion,
} from './motionPreference'

/**
 * Run `callback` after the next frame has painted and the browser is idle.
 * Returns a cancel function.
 */
function afterPaint(callback: () => void): () => void {
  let cancelled = false
  let idleId = 0
  let timeoutId = 0
  // rAF runs before the next paint; a task queued from it runs after that paint.
  const frameId = requestAnimationFrame(() => {
    timeoutId = window.setTimeout(() => {
      if (cancelled) return
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(callback, { timeout: 1000 })
      } else {
        callback()
      }
    })
  })
  return () => {
    cancelled = true
    cancelAnimationFrame(frameId)
    window.clearTimeout(timeoutId)
    if (idleId) window.cancelIdleCallback(idleId)
  }
}

/**
 * Phones get the showcase's full strength but not its native resolution
 * (V0.61): at 375px under 4x CPU throttle with software raster, sharp mode
 * fell from 60 fps to ~8 fps at DPR 3 and ~21 fps at DPR 2 (see the V0.61
 * log). A phone is a touch-first device whose screen is under 600 CSS px on
 * its short side; tablets and desktops get sharp mode, with the engine's
 * automatic fallback if it runs slow.
 */
function isPhone(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return coarse && Math.min(window.screen.width, window.screen.height) < 600
}

interface SpaceBackgroundProps {
  /** Content is hidden (V0.57): show the background bright and sharp (V0.61). */
  showcase?: boolean
  onAutoPause?: () => void
}

/**
 * Animated space background (S24), fixed behind all content. Renders the
 * scene mapped to the current route in `src/scenes/routes.ts`; on navigation
 * the old scene fades out at once and the new one fades in when ready (S33).
 * Starts after the page has painted, so it never delays content. Shows a
 * still frame when animation is off (the footer control, else the OS
 * "reduce motion" setting; see motionPreference.ts, V0.41), pauses in hidden
 * tabs, and falls back to a static gradient if the canvas can't run.
 *
 * Slow devices (V0.42): while animation is on and the visitor hasn't chosen
 * (no saved choice, OS not asking for reduced motion), the engine watches
 * the frame rate. If the animation runs consistently slow it saves
 * 'auto-paused' (remembered, shown as off in the footer) and calls
 * `onAutoPause` so the layout can tell the visitor. It never runs once the
 * visitor has chosen on/off or after an auto-pause.
 *
 * Showcase (V0.61): while the page content is hidden (`showcase`), the
 * engine shows the scene at full strength and, except on phones, at the
 * screen's native resolution; see backgroundEngine.ts. A paused scene
 * brightens and sharpens too. If sharp mode runs slow the engine silently
 * falls back to the standard resolution before auto-pause can trigger.
 */
export default function SpaceBackground({ showcase = false, onAutoPause }: SpaceBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<BackgroundEngine | null>(null)
  const [failed, setFailed] = useState(false)
  const reducedMotion = useReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)
  const motionChoice = useMotionChoice()
  const watchFrameRate = motionChoice === null && !reducedMotion
  const onAutoPauseRef = useRef(onAutoPause)
  const { pathname } = useLocation()

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
    engine?.setReducedMotion(reducedMotion)
  }, [engine, reducedMotion])

  useEffect(() => {
    engine?.setShowcase(showcase)
  }, [engine, showcase])

  useEffect(() => {
    onAutoPauseRef.current = onAutoPause
  }, [onAutoPause])

  // Mirrors (the phone top bar, V0.48) show the static gradient too.
  useEffect(() => {
    setMirrorFallback(failed)
  }, [failed])

  useEffect(() => {
    if (!engine || !watchFrameRate) return
    engine.watchFrameRate(() => {
      // Re-check: another tab may have saved a choice since.
      if (getMotionChoice() !== null || getReducedMotion()) return
      setMotionChoice('auto-paused')
      onAutoPauseRef.current?.()
    })
    return () => engine.watchFrameRate(null)
  }, [engine, watchFrameRate])

  // Create the engine once, lazily, after first paint.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let created: BackgroundEngine | null = null
    const cancel = afterPaint(() => {
      created = new BackgroundEngine(container, {
        reducedMotion: reducedMotionRef.current,
        onFail: () => setFailed(true),
        allowSharp: !isPhone(),
      })
      setEngine(created)
    })
    return () => {
      cancel()
      created?.destroy()
    }
  }, [])

  useEffect(() => {
    engine?.setScene(sceneForPath(pathname))
  }, [engine, pathname])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="space-background"
      data-state={failed ? 'fallback' : engine ? 'running' : 'pending'}
      className={`pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh overflow-hidden print:hidden ${
        failed ? 'space-fallback' : ''
      }`}
    />
  )
}
