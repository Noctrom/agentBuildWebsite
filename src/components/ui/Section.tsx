import { useId, type ReactNode } from 'react'

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
  /** `surface` gives a full-width raised band to alternate sections. */
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
 * Page section: heading, optional intro and content, with the standard page
 * gutter, vertical rhythm and content width. Renders `<section>`, never
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
      className={`scroll-mt-4 px-gutter py-section ${
        tone === 'surface' ? 'border-y border-border bg-surface' : ''
      } ${className}`.trim()}
    >
      <div className="mx-auto max-w-content">
        <Heading
          id={headingId}
          className={`font-bold tracking-tight text-fg ${headingSizes[headingLevel]}`}
        >
          {title}
        </Heading>
        {intro && <p className="mt-3 max-w-prose text-lg text-muted">{intro}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}
