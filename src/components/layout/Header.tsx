import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { profile } from '../../content'
import Container from '../ui/Container'
import { glowClass } from '../ui/tone'
import { navItems } from './navItems'

const MENU_ID = 'primary-nav-menu'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-md px-3 py-2 text-base font-medium ${glowClass} lg:text-sm ${
    isActive
      ? 'bg-surface text-accent'
      : 'text-muted hover:bg-surface hover:text-fg'
  }`

/** Frosted header glass (S25): bg at 80% (V0.35) plus backdrop blur. */
const glass = 'bg-bg-header backdrop-blur-glass'

/**
 * Site header: name, primary nav (hamburger under lg; see navItems.ts).
 * Frosted glass (S25): bg at 80% plus backdrop blur, so the space background
 * shows through but stays dark enough under the text, even with bright page
 * content scrolled beneath it (see index.css).
 *
 * Sticky (V0.35): pinned to the top of the viewport on every page. Its height
 * is published as `--header-height` on <html>, which index.css uses for
 * `scroll-padding-top`, so anchors and focused elements land below it.
 *
 * The glass sits on its own layer behind the content instead of on <header>:
 * an element with a backdrop filter is a backdrop root, so the mobile menu
 * (a child that hangs below the bar) could not blur the page behind it.
 *
 * Under lg the menu is an overlay below the bar rather than part of it, so
 * opening it doesn't push the page down from wherever the visitor scrolled
 * to, and the header height (and scroll padding) stays that of the bar. It
 * scrolls on its own if it is taller than the viewport. Because it covers
 * the page, it closes when focus or a click goes outside the header, so a
 * focused element is never hidden under the open menu.
 */
export default function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)

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

  // Publish the header height for scroll-padding-top (index.css). It changes
  // at the lg breakpoint and if a long name wraps.
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--header-height', `${header.offsetHeight}px`)
    })
    observer.observe(header)
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
    <header ref={headerRef} onBlur={onBlur} className="sticky top-0 z-40">
      <div aria-hidden="true" className={`absolute inset-0 -z-10 border-b border-border ${glass}`} />
      <Container className="flex flex-wrap items-center gap-2 py-3">
        <Link
          to="/"
          className="mr-auto rounded-md text-lg font-bold text-fg transition-colors duration-200 hover:text-accent focus-visible:shadow-glow-focus"
        >
          {profile.name}
        </Link>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border text-fg ${glowClass} hover:border-accent hover:bg-surface hover:text-accent lg:hidden`}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <nav
          id={MENU_ID}
          aria-label="Primary"
          className={`${open ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-height,4rem))] overflow-y-auto overscroll-contain border-b border-border ${glass} lg:static lg:block lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:backdrop-blur-none`}
        >
          <ul className="mx-auto flex max-w-page flex-col gap-1 px-gutter py-3 lg:mx-0 lg:max-w-none lg:flex-row lg:p-0">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
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
