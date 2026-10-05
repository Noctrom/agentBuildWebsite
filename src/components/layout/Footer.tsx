import { profile } from '../../content'
import Container from '../ui/Container'
import { glassClass } from '../ui/tone'
import AnimationToggle from './AnimationToggle'

/**
 * Site footer: copyright, the animation switch (V0.41) and social links, on a
 * frosted glass band (S25). Stacked at mobile, one row from sm.
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
    <footer className={`glass-edge border-t border-border ${glassClass.surface}`}>
      <Container className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted">
          &copy; {year} {profile.name}
        </p>
        <AnimationToggle />
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
      </Container>
    </footer>
  )
}
