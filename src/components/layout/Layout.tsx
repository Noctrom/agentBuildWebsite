import { useCallback, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import AutoPauseNotice from './AutoPauseNotice'
import { hideableClass } from './contentVisibility'
import Footer from './Footer'
import Header from './Header'
import { useMotionChoice } from './motionPreference'
import SpaceBackground from './SpaceBackground'

/**
 * App shell used as the parent layout route for every page. The wrapper is
 * transparent and isolated so the fixed <SpaceBackground> (z-index -10) paints
 * above the body's solid bg but below all content.
 *
 * From lg the navigation is a rail fixed to the left edge (V0.38), so the
 * shell is padded by the rail width: main, the footer and every Container
 * sit to the right of it. The background stays full width behind the rail.
 * The width is the rail's measured width, `--rail-width` on <html>, set by
 * Header.tsx (V0.47): it changes per page, as the current page's full name
 * can widen the slim rail.
 *
 * The auto-pause toast (V0.42) opens when the background pauses itself on a
 * slow device, only in that page session, and closes early if the
 * animation setting changes (e.g. the footer switch is turned on).
 *
 * Hide content (V0.57): the footer eye button hides everything but itself
 * and the background (see contentVisibility.ts and HideContentButton.tsx).
 * While hidden, a transparent full-screen layer under the button catches a
 * click or tap anywhere on the background, and Esc also shows the content
 * again. The state belongs to the current history entry and is not saved,
 * so a page change (including back/forward) or a reload always shows
 * content. The background (SpaceBackground) is not touched, so it keeps
 * animating or stays paused exactly as before.
 */
export default function Layout() {
  useScrollToTopOnNavigate()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const motionChoice = useMotionChoice()
  const openNotice = useCallback(() => setNoticeOpen(true), [])
  const closeNotice = useCallback(() => setNoticeOpen(false), [])

  // The history entry the content was hidden on, or null. Comparing with the
  // current entry means any navigation shows content without an effect.
  const { key: locationKey } = useLocation()
  const [hiddenOn, setHiddenOn] = useState<string | null>(null)
  const contentHidden = hiddenOn === locationKey
  const showContent = useCallback(() => setHiddenOn(null), [])
  const toggleContent = () => setHiddenOn(contentHidden ? null : locationKey)
  useHiddenContentLock(contentHidden, showContent)

  return (
    <div className="relative isolate flex min-h-dvh flex-col text-fg lg:pl-(--rail-width)">
      <SpaceBackground onAutoPause={openNotice} />
      <a
        href="#main"
        inert={contentHidden}
        className="sr-only rounded-md bg-accent font-medium text-accent-fg focus:not-sr-only focus:fixed focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Header contentHidden={contentHidden} />
      <main
        id="main"
        tabIndex={-1}
        inert={contentHidden}
        className={`flex-1 focus:outline-none ${hideableClass(contentHidden)}`}
      >
        <Outlet />
      </main>
      {contentHidden && (
        // Background click layer: below the button (z-50), above everything
        // else. Pans are blocked here (touch-pinch-zoom), pinch zoom is not.
        <div aria-hidden="true" onClick={showContent} className="fixed inset-0 z-40 touch-pinch-zoom" />
      )}
      <Footer contentHidden={contentHidden} onToggleContent={toggleContent} />
      <AutoPauseNotice
        open={noticeOpen && motionChoice === 'auto-paused'}
        onClose={closeNotice}
        contentHidden={contentHidden}
      />
    </div>
  )
}

/**
 * Start each new page at the top (V0.35). With the sticky header the nav can
 * be used from far down a page, and the router keeps the scroll position, so
 * the next page would otherwise open part way down. Links with a hash scroll
 * to their target instead (scroll-padding keeps it below the header).
 * Back/forward (POP) is left to the browser's own scroll restoration.
 */
function useScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP') return
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash, navigationType])
}

/** Keys that scroll the page; blocked while content is hidden. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
])

/**
 * While content is hidden (V0.57): Esc shows it again, and the page doesn't
 * scroll, so the eye button stays exactly where it was on screen and the
 * content comes back at the same scroll position. Wheel, one-finger touch
 * moves and scroll keys are cancelled (Space still presses a focused button);
 * anything else that scrolls (e.g. dragging the scrollbar) is put back.
 * No `overflow: hidden`, which would drop the scrollbar and shift the layout.
 * A layout effect, so the lock is gone before a route change scrolls to top.
 */
function useHiddenContentLock(hidden: boolean, show: () => void) {
  useLayoutEffect(() => {
    if (!hidden) return
    const x = window.scrollX
    const y = window.scrollY
    const keepPosition = () => {
      if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y)
    }
    const cancel = (event: Event) => event.preventDefault()
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) event.preventDefault()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        show()
        return
      }
      if (!SCROLL_KEYS.has(event.key)) return
      if (event.key === ' ' && event.target instanceof HTMLButtonElement) return
      event.preventDefault()
    }
    window.addEventListener('wheel', cancel, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('scroll', keepPosition)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('scroll', keepPosition)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [hidden, show])
}
