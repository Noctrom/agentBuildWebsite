export type NavItem = {
  to: string
  label: string
}

/**
 * Primary navigation, in display order.
 *
 * From `lg` (1024px) up they are stacked in the fixed left rail, and below
 * that in the hamburger menu (V0.38). The rail width (`--spacing-rail` in
 * index.css) fits the longest label, "Behind the Scenes", at its hover
 * scale; re-measure it before adding a longer label.
 */
export const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects' },
  { to: '/resume', label: 'Resume' },
  { to: '/contact', label: 'Contact' },
  { to: '/behind-the-scenes', label: 'Behind the Scenes' },
]
