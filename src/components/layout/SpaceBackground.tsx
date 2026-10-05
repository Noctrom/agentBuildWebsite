import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { sceneForPath } from '../../scenes/routes'
import { BackgroundEngine } from './backgroundEngine'
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
 */
export default function SpaceBackground({ onAutoPause }: { onAutoPause?: () => void }) {
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
    onAutoPauseRef.current = onAutoPause
  }, [onAutoPause])

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
