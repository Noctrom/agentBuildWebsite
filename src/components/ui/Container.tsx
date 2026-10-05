import type { ElementType, ReactNode } from 'react'

export type ContainerProps = {
  /** Element to render. Defaults to `div`. */
  as?: ElementType
  /** Extra classes for the container element (e.g. flex layout, padding-y). */
  className?: string
  children?: ReactNode
}

/**
 * The one horizontal container for the site: centered, full width up to
 * `max-w-page`, with the page gutter as padding. `max-w-page` is the content
 * width plus both gutters (see `--container-page` in styles/index.css), so the
 * content inside is exactly `max-w-content` wide on desktop and the viewport
 * minus both gutters on mobile.
 *
 * Header, Footer and Section all use it, so their left and right edges line
 * up at every width. Pages that need a custom section layout should use it
 * too instead of their own `px-gutter` / `max-w-content` classes.
 */
export default function Container({
  as: Tag = 'div',
  className = '',
  children,
}: ContainerProps) {
  return (
    <Tag className={`mx-auto w-full max-w-page px-gutter ${className}`.trim()}>
      {children}
    </Tag>
  )
}
