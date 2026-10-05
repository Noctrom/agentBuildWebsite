import { useCallback, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import AutoPauseNotice from './AutoPauseNotice'
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
 *
 * The auto-pause toast (V0.42) opens when the background pauses itself on a
 * slow device, only in that page session, and closes early if the
 * animation setting changes (e.g. the footer switch is turned on).
 */
export default function Layout() {
  useScrollToTopOnNavigate()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const motionChoice = useMotionChoice()
  const openNotice = useCallback(() => setNoticeOpen(true), [])
  const closeNotice = useCallback(() => setNoticeOpen(false), [])

  return (
    <div className="relative isolate flex min-h-dvh flex-col text-fg lg:pl-rail">
      <SpaceBackground onAutoPause={openNotice} />
      <a
        href="#main"
        className="sr-only rounded-md bg-accent font-medium text-accent-fg focus:not-sr-only focus:fixed focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <AutoPauseNotice open={noticeOpen && motionChoice === 'auto-paused'} onClose={closeNotice} />
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
