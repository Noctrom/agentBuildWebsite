import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { profile } from '../../content'
import Container from '../ui/Container'
import ThemeToggle from '../ui/ThemeToggle'
import { navItems } from './navItems'

const MENU_ID = 'primary-nav-menu'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-base font-medium transition-colors md:text-sm ${
    isActive
      ? 'bg-surface text-accent'
      : 'text-muted hover:bg-surface hover:text-fg'
  }`

/** Site header: name, primary nav (hamburger under md), theme toggle. */
export default function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)

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
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="border-b border-border bg-bg">
      <Container className="flex flex-wrap items-center gap-2 py-3">
        <Link
          to="/"
          className="mr-auto rounded-md text-lg font-bold text-fg transition-colors hover:text-accent"
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
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-border text-fg transition-colors hover:bg-surface hover:text-accent md:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <nav
          id={MENU_ID}
          aria-label="Primary"
          className={`${open ? 'block' : 'hidden'} order-last w-full md:order-none md:block md:w-auto`}
        >
          <ul className="flex flex-col gap-1 pt-2 md:flex-row md:pt-0">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <ThemeToggle />
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
