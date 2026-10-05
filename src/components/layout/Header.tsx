import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { NavLink, useLocation } from 'react-router'
import Container from '../ui/Container'
import { glowClass } from '../ui/tone'
import { navItems } from './navItems'

const MENU_ID = 'primary-nav-menu'

/**
 * Nav button (V0.38). No hover color or background: on hover the button
 * grows a little and a frosted glass bubble fades and expands in behind the
 * label, like the passcode keys on a phone. The current page keeps a steady
 * bubble and does not grow. Keyboard focus shows the bubble plus the focus
 * ring and glow; a press (touch) shows it too. With reduced motion (the
 * Animation switch, else the OS setting; V0.49) the global
 * rule in index.css makes the bubble appear at once, and the grow is only
 * applied under `motion-safe`.
 */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative block whitespace-nowrap rounded-full px-4 py-2 text-base font-medium transition-transform duration-150 ease-out focus-visible:shadow-glow-focus lg:text-sm ${
    isActive ? 'text-fg' : 'text-muted motion-safe:hover:scale-[1.06]'
  }`

/** The bubble: same glass recipe as V0.25 panels (fill, blur, faint border, rim). */
const bubbleBase =
  'pointer-events-none absolute inset-0 rounded-full border border-border bg-surface glass-edge transition-[opacity,scale] duration-150 ease-out'

/**
 * Blur is only switched on while the bubble shows: six hidden blurred layers
 * would still be re-filtered on every frame of the animated background.
 */
const bubbleClass = (isActive: boolean) =>
  `${bubbleBase} ${
    isActive
      ? 'backdrop-blur-glass'
      : 'scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-hover:backdrop-blur-glass group-focus-visible:scale-100 group-focus-visible:opacity-100 group-focus-visible:backdrop-blur-glass group-active:scale-100 group-active:opacity-100 group-active:backdrop-blur-glass'
  }`

/** Frosted header glass (S25): bg at 80% (V0.35) plus backdrop blur. */
const glass = 'bg-bg-header backdrop-blur-glass'

/**
 * Site navigation (V0.38: vertical rail). There is no site name in it; the
 * Home button leads home and the name lives on the Home page and footer.
 *
 * - From lg: a slim rail fixed to the left edge, full height, buttons stacked
 *   in navItems order. Layout pads the page by the rail width (`pl-rail`), so
 *   nothing sits under it, and there is no top bar.
 * - Under lg: a sticky top bar (V0.35) with only the hamburger. It opens the
 *   same vertical buttons as an overlay below the bar.
 *
 * Frosted glass (S25): bg at 80% plus backdrop blur, so the space background
 * shows through but stays dark enough under the text, even with bright page
 * content scrolled beneath it (see index.css).
 *
 * The top bar's height is published as `--header-height` on <html>, which
 * index.css uses for `scroll-padding-top`, so anchors and focused elements
 * land below it. From lg the bar is hidden, so the value is 0 (index.css also
 * forces 0 from lg).
 *
 * The glass sits on its own layer behind the content instead of on <header>:
 * an element with a backdrop filter is a backdrop root, so the mobile menu
 * (a child that hangs below the bar) and the bubbles could not blur the page
 * behind them.
 *
 * Under lg the menu is an overlay below the bar rather than part of it, so
 * opening it doesn't push the page down from wherever the visitor scrolled
 * to. It scrolls on its own if it is taller than the viewport. Because it
 * covers the page, it closes when focus or a click goes outside the header,
 * so a focused element is never hidden under the open menu.
 */
export default function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Close the menu whenever the route changes. Adjusting state during render
  // is the React-recommended alternative to setState inside an effect.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  // Escape closes the menu and returns focus to the menu button.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    // A click or tap outside the header closes the overlay menu.
    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // Publish the top bar height for scroll-padding-top (index.css). The bar is
  // display:none from lg, so it measures 0 there.
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--header-height', `${bar.offsetHeight}px`)
    })
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--header-height')
    }
  }, [])

  // Focus moving out of the header (Tab past the last link, the skip link)
  // closes the menu. A null relatedTarget (window blur) leaves it open.
  function onBlur(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget
    if (open && next && !event.currentTarget.contains(next)) setOpen(false)
  }

  return (
    <header
      ref={headerRef}
      onBlur={onBlur}
      className="sticky top-0 z-40 lg:fixed lg:inset-y-0 lg:left-0 lg:w-rail"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 border-b border-border lg:border-r lg:border-b-0 ${glass}`}
      />
      <div ref={barRef} className="lg:hidden">
        <Container className="flex items-center justify-end py-3">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border text-fg ${glowClass} hover:border-accent hover:bg-surface hover:text-accent`}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </Container>
      </div>

      <nav
        id={MENU_ID}
        aria-label="Primary"
        className={`${open ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-height,4rem))] overflow-y-auto overscroll-contain border-b border-border ${glass} lg:static lg:block lg:h-full lg:max-h-none lg:border-0 lg:bg-transparent lg:backdrop-blur-none`}
      >
        <ul className="mx-auto flex max-w-page flex-col items-start gap-1 px-gutter py-3 lg:mx-0 lg:max-w-none lg:gap-2 lg:px-4 lg:py-6">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={bubbleClass(isActive)} />
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
