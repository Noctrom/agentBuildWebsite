import { Outlet } from 'react-router'
import Footer from './Footer'
import Header from './Header'
import SpaceBackground from './SpaceBackground'

/**
 * App shell used as the parent layout route for every page. The wrapper is
 * transparent and isolated so the fixed <SpaceBackground> (z-index -10) paints
 * above the body's solid bg but below all content.
 */
export default function Layout() {
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
