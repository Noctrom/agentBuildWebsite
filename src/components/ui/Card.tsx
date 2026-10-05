import type { ReactNode } from 'react'
import type { LinkProps } from 'react-router'
import Button, { type ButtonVariant } from './Button'
import { Tag } from './Tag'
import { glassClass, type SurfaceTone } from './tone'

/**
 * A link rendered as a small button in the card footer. Use `to` for internal
 * routes, `href` for external URLs and files (http(s) URLs open in a new tab).
 */
export type CardAction = {
  /** Visible text, e.g. "Code" or "Live demo". */
  label: string
  /** Defaults to `secondary`. */
  variant?: ButtonVariant
} & (
  | { to: LinkProps['to']; href?: never }
  | { href: string; to?: never; download?: boolean | string; external?: boolean }
)

export type CardImage = {
  src: string
  /** Describe the image, or pass "" if it's purely decorative. */
  alt: string
}

export type CardProps = {
  title: string
  description: ReactNode
  image?: CardImage
  tags?: string[]
  /** Footer links/buttons, e.g. repo and demo. */
  actions?: CardAction[]
  /** Extra footer content, rendered after `actions`. */
  footer?: ReactNode
  /** Heading element for the title. Defaults to 3 (cards usually sit under a section h2). */
  headingLevel?: 2 | 3 | 4
  /**
   * Card background. Defaults to `surface`; use `bg` inside a
   * `<Section tone="surface">` so the card stands out from the band.
   * Don't pass `bg-*` via `className` (it can't reliably override this).
   */
  tone?: SurfaceTone
  className?: string
}

/**
 * Content card: optional image, title, description, tags and footer actions.
 * Rendered as an `<article>`. Each action's accessible name includes the card
 * title (e.g. "Code: Project Alpha"), so repeated labels stay unambiguous.
 */
export default function Card({
  title,
  description,
  image,
  tags,
  actions,
  footer,
  headingLevel = 3,
  tone = 'surface',
  className = '',
}: CardProps) {
  const Heading = `h${headingLevel}` as const
  const hasFooter = (actions && actions.length > 0) || footer

  return (
    <article
      className={`glass-edge flex h-full flex-col overflow-hidden rounded-lg border border-border ${glassClass[tone]} ${className}`.trim()}
    >
      {image && (
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          className="aspect-video w-full border-b border-border bg-bg object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <Heading className="text-lg font-semibold text-fg">{title}</Heading>
        <div className="text-sm text-muted">{description}</div>

        {tags && tags.length > 0 && (
          <ul aria-label="Tags" className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        )}

        {hasFooter && (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {actions?.map((action) => {
              const content = (
                <>
                  {action.label}
                  <span className="sr-only">: {title}</span>
                </>
              )
              const variant = action.variant ?? 'secondary'
              return action.to !== undefined ? (
                <Button key={action.label} to={action.to} variant={variant} size="sm">
                  {content}
                </Button>
              ) : (
                <Button
                  key={action.label}
                  href={action.href}
                  download={action.download}
                  external={action.external}
                  variant={variant}
                  size="sm"
                >
                  {content}
                </Button>
              )
            })}
            {footer}
          </div>
        )}
      </div>
    </article>
  )
}
