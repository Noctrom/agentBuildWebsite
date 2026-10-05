import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import { glassClass, glowClass } from './tone'

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'sm' | 'md'

type ButtonBaseProps = {
  /** Visual style. Defaults to `primary`. */
  variant?: ButtonVariant
  /** Defaults to `md`. `sm` suits card actions. */
  size?: ButtonSize
  className?: string
  children: ReactNode
}

/** Internal route: renders a React Router `<Link>`. */
export type ButtonLinkProps = ButtonBaseProps &
  Omit<LinkProps, keyof ButtonBaseProps> & {
    href?: never
  }

/**
 * Plain `<a>` for external URLs, `mailto:` links and files (e.g. `/resume.pdf`
 * with `download`). `http(s)://` URLs open in a new tab by default.
 */
export type ButtonAnchorProps = ButtonBaseProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof ButtonBaseProps | 'href' | 'target' | 'rel'
  > & {
    href: string
    to?: never
    /** Open in a new tab. Defaults to true for `http(s)://` URLs. */
    external?: boolean
  }

/** Native `<button>`; `type` defaults to `"button"`. */
export type ButtonButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    to?: never
    href?: never
  }

/** Discriminated by `to` (Link), `href` (anchor) or neither (button). */
export type ButtonProps = ButtonLinkProps | ButtonAnchorProps | ButtonButtonProps

const base = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-medium ${glowClass} disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none`

/**
 * `primary` stays a solid accent fill (the one strong call to action);
 * `secondary` is frosted glass. Both glow on hover and keyboard focus.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-accent-fg hover:border-accent-hover hover:bg-accent-hover',
  secondary: `border-border ${glassClass.surface} text-fg hover:border-accent hover:text-accent`,
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
}

const isHttpUrl = (href: string) => /^https?:\/\//i.test(href)

/** Primary/secondary button that renders as a Link, an anchor or a button. */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()

  if (rest.to !== undefined) {
    return (
      <Link {...(rest as Omit<ButtonLinkProps, keyof ButtonBaseProps>)} className={classes}>
        {children}
      </Link>
    )
  }

  if (rest.href !== undefined) {
    const { external = isHttpUrl(rest.href), ...anchorProps } = rest as Omit<
      ButtonAnchorProps,
      keyof ButtonBaseProps
    >
    return (
      <a
        {...anchorProps}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    )
  }

  const { type = 'button', ...buttonProps } = rest as Omit<
    ButtonButtonProps,
    keyof ButtonBaseProps
  >
  return (
    <button {...buttonProps} type={type} className={classes}>
      {children}
    </button>
  )
}
