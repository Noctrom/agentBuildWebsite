import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Button from '../ui/Button'
import { glassClass } from '../ui/tone'
import { setMotionChoice } from './motionPreference'

/** Message text approved by Chris (V0.42). */
const MESSAGE = 'Animation paused to keep things smooth on this device.'
/** Auto-close delay; the timer is paused while hovered, focused or in a hidden tab. */
const AUTO_CLOSE_MS = 10_000

interface AutoPauseNoticeProps {
  open: boolean
  onClose: () => void
}

/**
 * Small glass toast shown once when the site switched the background
 * animation off on a slow device (V0.42). "Turn back on" saves an explicit
 * "on" (the V0.41 footer switch follows); the close button or Escape just
 * closes it. It closes itself after AUTO_CLOSE_MS.
 *
 * Accessibility: the `role="status"` region is always mounted (empty while
 * closed), so the message is announced politely when it is filled. Nothing
 * takes focus. The auto-close timer pauses while the pointer is over the
 * toast or focus is inside it, so keyboard and screen reader users have
 * time to reach the buttons. If it closes with focus inside, focus moves to
 * <main> without scrolling rather than being lost.
 *
 * Placement: it is `sticky` at the bottom of the layout, after the footer,
 * so it sits in the bottom corner while the page scrolls but takes its own
 * space at the end of the page: scrolled to the bottom, the footer
 * (including the animation switch) is fully visible above it. It never
 * touches the top bar. Its height is published as `--notice-height` for
 * `scroll-padding-bottom` (index.css), so focused elements are scrolled
 * clear of it.
 */
export default function AutoPauseNotice({ open, onClose }: AutoPauseNoticeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(() => document.hidden)
  const remainingRef = useRef(AUTO_CLOSE_MS)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Every time it opens, the full delay applies again.
  useEffect(() => {
    if (open) remainingRef.current = AUTO_CLOSE_MS
  }, [open])

  // Run the timer while open and not paused; keep the time left on pause.
  const paused = hovered || focused || hidden
  useEffect(() => {
    if (!open || paused) return
    const startedAt = performance.now()
    const timer = window.setTimeout(() => onCloseRef.current(), remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt))
    }
  }, [open, paused])

  // Publish the height (toast plus its padding) for scroll-padding-bottom while open.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!open || !wrapper) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--notice-height', `${wrapper.offsetHeight}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(wrapper)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--notice-height')
    }
  }, [open])

  const close = () => {
    // Closing with focus inside: hand focus to <main> instead of losing it.
    if (cardRef.current?.contains(document.activeElement)) {
      document.getElementById('main')?.focus({ preventScroll: true })
    }
    // The buttons unmount, so no pointerleave/blur will clear these.
    setHovered(false)
    setFocused(false)
    onClose()
  }

  const turnBackOn = () => {
    setMotionChoice('on')
    close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }

  return (
    <div
      ref={wrapperRef}
      className={`pointer-events-none sticky bottom-0 z-30 flex justify-end print:hidden ${
        open ? 'px-gutter pt-2 pb-4' : ''
      }`}
    >
      <div
        ref={cardRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
        }}
        onKeyDown={onKeyDown}
        className={
          open
            ? `glass-edge pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border p-4 shadow-lg ${glassClass.bg}`
            : 'sr-only left-0' // left-0: the flex end would put the 1px box past the right edge (horizontal overflow)
        }
      >
        <div className="flex flex-1 flex-col items-start gap-3">
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-fg">
            {open ? MESSAGE : ''}
          </p>
          {open && (
            <Button variant="secondary" size="sm" onClick={turnBackOn}>
              Turn back on
            </Button>
          )}
        </div>
        {open && (
          <button
            type="button"
            aria-label="Close message"
            onClick={close}
            className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:text-accent focus-visible:shadow-glow-focus"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
