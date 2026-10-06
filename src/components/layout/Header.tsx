import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type Ref } from 'react'
import { NavLink, useLocation } from 'react-router'
import Container from '../ui/Container'
import { glowClass } from '../ui/tone'
import { useBackgroundMirror, useMirrorFallback } from './backgroundMirror'
import { navItems, type NavItem } from './navItems'

const MENU_ID = 'primary-nav-menu'

/**
 * Nav button (V0.38, slimmed in V0.47). No hover color or background: on
 * hover the button grows a little and a frosted glass bubble fades and
 * expands in behind the label, like the passcode keys on a phone. The current
 * page keeps a steady bubble and does not grow.
 *
 * Keyboard focus shows the bubble plus the focus ring and glow. The ring is
 * drawn on the expander (below), not the link, so from lg it wraps the
 * expanded button rather than the collapsed box. A press (touch) shows the
 * bubble too.
 *
 * Motion follows the Animation switch, else the OS setting (V0.49): the grow
 * and the expand transitions are only applied under `motion-safe`, and the
 * global reduced-motion rule in index.css zeroes any other transition, so
 * with motion off everything snaps.
 */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative block origin-left whitespace-nowrap rounded-full text-base font-medium focus-visible:outline-none lg:text-sm ${
    isActive ? 'text-fg' : 'text-muted motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:scale-[1.06]'
  }`

/** The bubble: same glass recipe as V0.25 panels (fill, blur, faint border, rim). */
const bubbleBase =
  'pointer-events-none absolute inset-0 rounded-full border border-border bg-surface glass-edge motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:ease-out'

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

/** Focus ring and glow, drawn on the expander when the link has keyboard focus. */
const focusRing =
  'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring group-focus-visible:shadow-glow-focus'

/**
 * Expander: the bubble plus the full label. Below lg, and for buttons that
 * never collapse (no short label, or the current page), it is the button
 * itself, in flow.
 *
 * From lg, a collapsible button (V0.47) is sized by its short label (an
 * in-flow, aria-hidden span) and the expander is laid over it, absolutely
 * positioned, so expanding never moves anything. Collapsed it is clipped to
 * the short label's box (`max-w-full`: 100% of the link) and its label is
 * transparent; on hover or focus the clip opens to the full label's width,
 * `--expanded-w` (measured by NavButton), while the full label fades in over
 * the short one. Animating to the real width, rather than to a fixed cap,
 * keeps the expand speed the same for every button. Until measured,
 * `--expanded-w` is unset, so the max-width is `none` and it simply opens.
 *
 * No opacity on the expander itself: an ancestor with opacity below 1 is a
 * backdrop root and would stop the bubble's blur mid-fade.
 */
const expanderClass = (collapsible: boolean) =>
  `relative block rounded-full ${focusRing} ${
    collapsible
      ? 'lg:absolute lg:inset-y-0 lg:left-0 lg:w-max lg:max-w-full lg:overflow-hidden lg:group-hover:max-w-(--expanded-w) lg:group-focus-visible:max-w-(--expanded-w) motion-safe:transition-[max-width] motion-safe:duration-200 motion-safe:ease-out'
      : ''
  }`

/**
 * Full label: always the accessible name. From lg it is hidden while
 * collapsed, and keeps its own width (`w-max`) inside the clipped expander.
 */
const fullLabelClass = (collapsible: boolean) =>
  `relative block px-4 py-2 ${
    collapsible
      ? 'lg:w-max lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out'
      : ''
  }`

/** Short label (lg only, aria-hidden): sizes the collapsed button and fades out as it expands. */
const shortLabelClass =
  'hidden px-4 py-2 group-hover:opacity-0 group-focus-visible:opacity-0 lg:block motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out'

/**
 * Site navigation (V0.38: vertical rail; V0.47: slim, see-through rail).
 * There is no site name in it; the Home button leads home and the name lives
 * on the Home page and footer.
 *
 * - From lg: a rail fixed to the left edge, full height, with the buttons
 *   stacked in navItems order and vertically centered. It has no fill and no
 *   divider, so the space background shows through. It is only as wide as
 *   its content: the short labels (Proj, Res, Cont, BTS) plus the current
 *   page's full name, so it widens on pages with a long name. Its measured
 *   width is published as `--rail-width` on <html> (see below).
 * - Under lg: a sticky top bar (V0.35) with only the hamburger. It opens the
 *   same vertical buttons, with full labels, as an overlay below the bar.
 *
 * `--rail-width` (V0.47): the rail's real rendered width in px from lg, 0px
 * below lg. Set by a ResizeObserver on <header>, so it follows breakpoint
 * changes, and in a layout effect on every route change (the current page's
 * button changes width), so it is current before any passive effect. Layout
 * pads the page by it (`lg:pl-(--rail-width)`), so content never sits under
 * the rail; scenes can use it to center in the area beside the rail.
 *
 * The top bar's height is published as `--header-height` on <html>, which
 * index.css uses for `scroll-padding-top`, so anchors and focused elements
 * land below it. From lg the bar is hidden, so the value is 0 (index.css also
 * forces 0 from lg).
 *
 * Below lg the bar and the open menu show the space background, and only
 * the background (V0.48; it was frosted glass with a line under it). Behind
 * them is one backdrop layer, sized to the bar plus the open menu, holding a
 * copy of the background's pixels at that spot (see backgroundMirror.ts). It
 * is opaque, so page content scrolling under the bar or lying under the menu
 * is hidden, and it matches the page around it, so the bar has no edge. It
 * is a layer of its own, not a background on <header> or <nav>, so one
 * canvas covers both and the menu can scroll over it.
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
  const navRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

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

  // Size the backdrop (V0.48) to the bar plus the open menu. The menu is
  // display:none while closed, so it adds 0 then. From lg the backdrop is hidden.
  useEffect(() => {
    const bar = barRef.current
    const nav = navRef.current
    const backdrop = backdropRef.current
    if (!bar || !nav || !backdrop) return
    const update = () => {
      backdrop.style.height = `${bar.offsetHeight + nav.offsetHeight}px`
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [])

  // Publish the rail's width (V0.47). Below lg the header is the sticky top
  // bar, not a rail, so 0. Rounded up to whole px: a fractional padding left a
  // 1px horizontal overflow. Runs before paint, so the padding is right on the
  // first frame. The ResizeObserver follows breakpoint and font changes.
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const publish = () => publishRailWidth(header)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(header)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--rail-width')
    }
  }, [])

  // On a route change the current page's button changes, and with it the
  // rail's width (V0.56). The ResizeObserver only reports that after layout,
  // which is after passive effects: a scene drawing its one still frame
  // (animation off) in a passive effect read the old width and never redrew.
  // Layout effects run before any passive effect, so publish here too. The
  // observer then finds the value unchanged and doesn't write it again.
  useLayoutEffect(() => {
    if (headerRef.current) publishRailWidth(headerRef.current)
  }, [pathname])

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
      className="sticky top-0 z-40 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:justify-center-safe"
    >
      <Backdrop ref={backdropRef} />
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
        ref={navRef}
        id={MENU_ID}
        aria-label="Primary"
        className={`${open ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-height,4rem))] overflow-y-auto overscroll-contain lg:static lg:block lg:max-h-none lg:overflow-visible`}
      >
        <ul className="mx-auto flex max-w-page flex-col items-start gap-1 px-gutter py-3 lg:mx-0 lg:max-w-none lg:gap-2 lg:px-3 lg:py-6">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavButton item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

/**
 * Write the rail's rendered width to `--rail-width` on <html> (V0.47): whole
 * px, rounded up, from lg (where the header is the fixed rail), else 0px.
 * Skips the write when the value hasn't changed.
 */
function publishRailWidth(header: HTMLElement) {
  const root = document.documentElement
  const isRail = getComputedStyle(header).position === 'fixed'
  const value = isRail ? `${Math.ceil(header.getBoundingClientRect().width)}px` : '0px'
  if (root.style.getPropertyValue('--rail-width') !== value) root.style.setProperty('--rail-width', value)
}

/**
 * Backdrop behind the top bar and the open menu, below lg (V0.48): a canvas
 * mirroring the space background, over the solid page color. Until the
 * background starts it is just the page color, like the page. If the
 * background has fallen back to the static gradient, it shows that gradient
 * instead, sized to the viewport (the header sits at the viewport's top-left,
 * so it lines up with the page's).
 */
function Backdrop({ ref }: { ref: Ref<HTMLDivElement> }) {
  const canvasRef = useBackgroundMirror()
  const fallback = useMirrorFallback()
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 -z-10 bg-bg lg:hidden print:hidden ${fallback ? 'space-fallback' : ''}`}
      style={fallback ? fallbackStyle : undefined}
    >
      <canvas ref={canvasRef} className={`block size-full ${fallback ? 'hidden' : ''}`} />
    </div>
  )
}

const fallbackStyle = { backgroundSize: '100% 100lvh', backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' }

/**
 * One nav button. From lg a button with a short label shows it collapsed
 * (unless it is the current page) and expands to the full label on hover or
 * focus; see expanderClass. The short label is aria-hidden, so the accessible
 * name is always the full page name.
 *
 * The full label's width is written straight to the expander as
 * `--expanded-w` (no re-render), the target of the expand animation. A
 * ResizeObserver keeps it right if the font or text size changes.
 */
function NavButton({ item }: { item: NavItem }) {
  const expanderRef = useRef<HTMLSpanElement>(null)
  const fullRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const expander = expanderRef.current
    const full = fullRef.current
    if (!expander || !full) return
    const publish = () =>
      expander.style.setProperty('--expanded-w', `${full.getBoundingClientRect().width}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(full)
    return () => observer.disconnect()
  }, [])

  return (
    <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
      {({ isActive }) => {
        const collapsible = Boolean(item.shortLabel) && !isActive
        return (
          <>
            {collapsible && (
              <span aria-hidden="true" className={shortLabelClass}>
                {item.shortLabel}
              </span>
            )}
            <span ref={expanderRef} className={expanderClass(collapsible)}>
              <span aria-hidden="true" className={bubbleClass(isActive)} />
              <span ref={fullRef} className={fullLabelClass(collapsible)}>
                {item.label}
              </span>
            </span>
          </>
        )
      }}
    </NavLink>
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
