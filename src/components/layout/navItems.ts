export type NavItem = {
  to: string
  /** Full page name: shown in the hamburger menu, on the current page and on hover/focus, and always the accessible name. */
  label: string
  /**
   * Collapsed rail label from lg (V0.47, approved copy). Omit it when the
   * full label is already short; the rail then always shows `label`.
   */
  shortLabel?: string
}

/**
 * Primary navigation, in display order.
 *
 * From `lg` (1024px) up they are stacked in the fixed left rail, and below
 * that in the hamburger menu (V0.38). The rail is only as wide as its
 * widest visible button (V0.47): the collapsed short labels plus the current
 * page's full name, so it widens on pages whose full name is long. Header.tsx
 * measures it and publishes `--rail-width` on <html>.
 */
export const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects', shortLabel: 'Proj' },
  { to: '/resume', label: 'Resume', shortLabel: 'Res' },
  { to: '/contact', label: 'Contact', shortLabel: 'Cont' },
  { to: '/behind-the-scenes', label: 'Behind the Scenes', shortLabel: 'BTS' },
]
