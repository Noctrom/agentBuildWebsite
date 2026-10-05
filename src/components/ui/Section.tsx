import { useId, type ReactNode } from 'react'
import Container from './Container'
import { glassClass } from './tone'

export type HeadingLevel = 1 | 2 | 3 | 4

export type SectionProps = {
  /** Visible heading. Also labels the `<section>` via `aria-labelledby`. */
  title: ReactNode
  /** Heading element. Defaults to 2; use 1 for the page's main heading. */
  headingLevel?: HeadingLevel
  /** Anchor id for in-page links (e.g. `#experience`). */
  id?: string
  /** Optional intro paragraph under the heading. */
  intro?: ReactNode
  /**
   * `surface` gives a full-width frosted glass band to alternate sections;
   * `default` is transparent, so content sits directly on the space background.
   */
  tone?: 'default' | 'surface'
  className?: string
  children?: ReactNode
}

const headingSizes: Record<HeadingLevel, string> = {
  1: 'text-3xl sm:text-4xl',
  2: 'text-2xl sm:text-3xl',
  3: 'text-xl sm:text-2xl',
  4: 'text-lg sm:text-xl',
}

/**
 * Page section: heading, optional intro and content, with vertical rhythm and
 * the shared `Container` (page gutter + content width). Renders `<section>`, never
 * `<main>` (pages already sit inside Layout's `<main>`).
 */
export default function Section({
  title,
  headingLevel = 2,
  id,
  intro,
  tone = 'default',
  className = '',
  children,
}: SectionProps) {
  const headingId = `${useId()}-heading`
  const Heading = `h${headingLevel}` as const

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-4 py-section ${
        tone === 'surface' ? `glass-edge border-y border-border ${glassClass.surface}` : ''
      } ${className}`.trim()}
    >
      <Container>
        <Heading
          id={headingId}
          className={`font-bold tracking-tight text-fg ${headingSizes[headingLevel]}`}
        >
          {title}
        </Heading>
        {intro && <p className="mt-3 max-w-prose text-lg text-muted">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  )
}
