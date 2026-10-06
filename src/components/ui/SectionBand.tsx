import type { ReactNode } from 'react'
import { bandClass } from './tone'

export type SectionBandProps = {
  /** The sections to group; give them the default tone (the band is their surface). */
  children: ReactNode
  className?: string
}

/**
 * One frosted band around several `Section`s (V0.55), with no line between
 * them. Same recipe as `Section tone="surface"` (`bandClass`), so a grouped
 * band always matches a single-section band.
 *
 * `-my-px` cancels the band's 1px top and bottom border, so the gap across a
 * band edge stays the sections' own padding (V0.46's even `--spacing-section`
 * gaps). Renders a plain `<div>`: the sections inside carry the landmarks and
 * headings.
 */
export default function SectionBand({ children, className = '' }: SectionBandProps) {
  return <div className={`-my-px ${bandClass} ${className}`.trim()}>{children}</div>
}
