import { profile } from '../../content'
import Container from '../ui/Container'
import AnimationToggle from './AnimationToggle'

/**
 * Site footer: copyright, social links and the animation switch (V0.41).
 *
 * See-through since V0.50: no fill, blur or top border, so the space
 * background shows through exactly as it does behind the page (like the
 * V0.47 rail). Contrast over the bare background is in styles/index.css.
 *
 * From sm one row: copyright on the far left, then GitHub, LinkedIn, Email
 * and the switch at the far right. Below sm stacked and centred in the same
 * order. The DOM order is the visual order, so the tab order matches.
 */
export default function Footer() {
  const year = new Date().getFullYear()
  const { email, github, linkedin } = profile.links

  const links = [
    { label: 'GitHub', href: github, external: true },
    { label: 'LinkedIn', href: linkedin, external: true },
    { label: 'Email', href: `mailto:${email}`, external: false },
  ]

  return (
    <footer>
      <Container className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted">
          &copy; {year} {profile.name}
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ul aria-label="Social links" className="flex gap-6">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="rounded-md text-sm text-muted transition-colors duration-200 hover:text-accent focus-visible:shadow-glow-focus"
                  {...(link.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {link.label}
                  {link.external && (
                    <span className="sr-only"> (opens in a new tab)</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          {/* -mr-1.5 cancels the switch's own px-1.5 so it ends on the content edge */}
          <div className="sm:-mr-1.5">
            <AnimationToggle />
          </div>
        </div>
      </Container>
    </footer>
  )
}
