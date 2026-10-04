import type { ButtonHTMLAttributes, ReactNode } from 'react'

const pill =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium'

export type TagProps = {
  children: ReactNode
  className?: string
}

/** Small static label/pill, e.g. a tech tag on a card. */
export function Tag({ children, className = '' }: TagProps) {
  return (
    <span className={`${pill} border-border bg-surface text-muted ${className}`.trim()}>
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
  className?: string
}

/** Toggleable tag (`aria-pressed` button), e.g. a project filter. */
export function TagButton({
  children,
  pressed,
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
          : 'border-border bg-surface text-muted hover:border-accent hover:text-accent'
      } ${className}`.trim()}
    >
      {children}
    </button>
  )
}
