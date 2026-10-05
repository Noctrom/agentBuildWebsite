import { useLayoutEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import Footer from './Footer'
import Header from './Header'
import SpaceBackground from './SpaceBackground'

/**
 * App shell used as the parent layout route for every page. The wrapper is
 * transparent and isolated so the fixed <SpaceBackground> (z-index -10) paints
 * above the body's solid bg but below all content.
 */
export default function Layout() {
  useScrollToTopOnNavigate()

  return (
    <div className="relative isolate flex min-h-dvh flex-col text-fg">
      <SpaceBackground />
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
