import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Background mirror (V0.48): lets an element in front of the page show the
 * space background, and only the background, behind it.
 *
 * Below lg the top bar and the open hamburger menu sit over the page while it
 * scrolls. They must show the space background with no seam, but no page
 * content. CSS can't do that directly (a see-through bar shows whatever is
 * under it, and clipping the content layer would have to follow every scroll
 * frame on the main thread). So the bar paints a copy instead: a small canvas
 * behind it that holds the same pixels as the background canvas at that
 * spot, over the same solid page color. It is opaque, so content scrolling
 * under the bar is hidden, and it matches the page around it, so there is no
 * edge.
 *
 * The copy is made by the engine itself (`BackgroundEngine.paintCopy`), right
 * after it draws each frame, so it is never a frame behind and it follows
 * every fade and scene change. The cost is one `drawImage` of the bar's area
 * per scene layer per frame. While nothing is drawing (animation off, hidden
 * tab) a mirror repaints only when its own size changes.
 */

/** What a mirror copies from: the running background engine. */
export interface MirrorSource {
  /**
   * Paint the background's current pixels for the area whose top-left corner
   * is at (`left`, `top`) in the viewport (CSS px) into all of `ctx.canvas`,
   * whose backing size is that area's size times `scale`.
   */
  paintCopy(ctx: CanvasRenderingContext2D, left: number, top: number): void
  /** Backing px per CSS px of the background canvases. */
  readonly scale: number
}

let source: MirrorSource | null = null
const mirrors = new Set<() => void>()

/** Set (or with `null`, clear) the engine mirrors copy from. Repaints every mirror. */
export function setMirrorSource(next: MirrorSource | null) {
  source = next
  repaintMirrors()
}

/** Clear the source only if it is still `current` (StrictMode remounts). */
export function clearMirrorSource(current: MirrorSource) {
  if (source === current) setMirrorSource(null)
}

/** Repaint every mounted mirror. Called by the engine after each draw. */
export function repaintMirrors() {
  for (const repaint of mirrors) repaint()
}

/** True while a mirror is mounted, so the engine can skip the call entirely. */
export function hasMirrors() {
  return mirrors.size > 0
}

let fallback = false
const fallbackListeners = new Set<() => void>()

/**
 * The background failed and shows the static gradient instead (set by
 * SpaceBackground). Mirrors then show the same gradient with CSS.
 */
export function setMirrorFallback(next: boolean) {
  if (fallback === next) return
  fallback = next
  for (const listener of fallbackListeners) listener()
}

function subscribeFallback(listener: () => void) {
  fallbackListeners.add(listener)
  return () => fallbackListeners.delete(listener)
}

export function useMirrorFallback() {
  return useSyncExternalStore(subscribeFallback, () => fallback, () => false)
}

/**
 * Keep `canvas` painted with the background pixels behind it. The canvas's
 * backing size follows its rendered size (a ResizeObserver repaints it when
 * it changes, e.g. the menu opening). A canvas that isn't rendered (display
 * none, from lg) is skipped.
 */
export function useBackgroundMirror() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const repaint = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const scale = source?.scale ?? 1
      const width = Math.max(1, Math.round(rect.width * scale))
      const height = Math.max(1, Math.round(rect.height * scale))
      // Assigning the size clears the canvas, so only when it changed.
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, width, height)
      source?.paintCopy(ctx, rect.left, rect.top)
    }
    mirrors.add(repaint)
    repaint()
    const observer = new ResizeObserver(repaint)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      mirrors.delete(repaint)
    }
  }, [])

  return ref
}
