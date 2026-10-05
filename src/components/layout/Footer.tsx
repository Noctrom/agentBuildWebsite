import { profile } from '../../content'
import Container from '../ui/Container'

/** Site footer: social links and copyright. */
export default function Footer() {
  const year = new Date().getFullYear()
  const { email, github, linkedin } = profile.links

  const links = [
    { label: 'GitHub', href: github, external: true },
    { label: 'LinkedIn', href: linkedin, external: true },
    { label: 'Email', href: `mailto:${email}`, external: false },
  ]

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted">
          &copy; {year} {profile.name}
        </p>
        <ul aria-label="Social links" className="flex gap-6">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="rounded-md text-sm text-muted transition-colors hover:text-accent"
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
