import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { surfaceToneClass, type SurfaceTone } from './tone'

const pill =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium'

export type TagProps = {
  children: ReactNode
  /**
   * Background. Defaults to `surface`; use `bg` inside a
   * `<Section tone="surface">`. Don't pass `bg-*` via `className`.
   */
  tone?: SurfaceTone
  className?: string
}

/** Small static label/pill, e.g. a tech tag on a card. */
export function Tag({ children, tone = 'surface', className = '' }: TagProps) {
  return (
    <span
      className={`${pill} border-border ${surfaceToneClass[tone]} text-muted ${className}`.trim()}
    >
      {children}
    </span>
  )
}

export type TagButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-pressed' | 'type'
> & {
  children: ReactNode
  /** Selected state, exposed to assistive tech as `aria-pressed`. */
  pressed: boolean
  /** Background when not pressed. Defaults to `surface`; use `bg` on surface bands. */
  tone?: SurfaceTone
  className?: string
}

/** Toggleable tag (`aria-pressed` button), e.g. a project filter. */
export function TagButton({
  children,
  pressed,
  tone = 'surface',
  className = '',
  ...rest
}: TagButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={pressed}
      className={`${pill} cursor-pointer transition-colors ${
        pressed
          ? 'border-accent bg-accent text-accent-fg hover:border-accent-hover hover:bg-accent-hover'
          : `border-border ${surfaceToneClass[tone]} text-muted hover:border-accent hover:text-accent`
      } ${className}`.trim()}
    >
      {children}
    </button>
  )
}
