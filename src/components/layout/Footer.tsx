import { profile } from '../../content'
import Container from '../ui/Container'
import AnimationToggle from './AnimationToggle'
import { hideableClass } from './contentVisibility'
import HideContentButton from './HideContentButton'

interface FooterProps {
  /** True while the page content is hidden (V0.57). */
  contentHidden: boolean
  onToggleContent: () => void
}

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
 *
 * V0.57: the hide-content eye button sits between Email and the switch
 * (stacked: on its own line between the links and the switch). While content
 * is hidden every other footer item is hidden and inert; the button stays.
 */
export default function Footer({ contentHidden, onToggleContent }: FooterProps) {
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
        <p inert={contentHidden} className={`text-sm text-muted ${hideableClass(contentHidden)}`}>
          &copy; {year} {profile.name}
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ul
            aria-label="Social links"
            inert={contentHidden}
            className={`flex gap-6 ${hideableClass(contentHidden)}`}
          >
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
          <HideContentButton hidden={contentHidden} onToggle={onToggleContent} />
          {/* -mr-1.5 cancels the switch's own px-1.5 so it ends on the content edge */}
          <div inert={contentHidden} className={`sm:-mr-1.5 ${hideableClass(contentHidden)}`}>
            <AnimationToggle />
          </div>
        </div>
      </Container>
    </footer>
  )
}
