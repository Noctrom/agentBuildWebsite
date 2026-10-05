export type NavItem = {
  to: string
  label: string
}

/**
 * Primary navigation, in display order.
 *
 * The header shows these inline from `lg` (1024px) up and in the hamburger
 * menu below that. With six items the inline nav is ~545px wide, which only
 * left ~23px beside the name at 768px, so the collapse point moved from `md`
 * to `lg` (S22). Re-measure the header before adding more items.
 */
export const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects' },
  { to: '/resume', label: 'Resume' },
  { to: '/contact', label: 'Contact' },
  { to: '/behind-the-scenes', label: 'Behind the Scenes' },
]
