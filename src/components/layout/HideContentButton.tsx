import { useState } from 'react'

interface HideContentButtonProps {
  /** True while the page content is hidden. */
  hidden: boolean
  onToggle: () => void
}

/**
 * Footer eye button (V0.57) that hides all page content, leaving only the
 * space background and this button. Layout owns the state; see
 * contentVisibility.ts for how the rest of the page hides.
 *
 * - Name: "Hide content" while content shows (open eye), "Show content"
 *   while hidden (crossed-out eye). `aria-pressed` adds the state, so screen
 *   readers announce it as a toggle that is pressed while content is hidden.
 * - Tooltip: the same words in a small glass label on hover and keyboard
 *   focus: beside the button when stacked (below sm, so it never covers the
 *   links above), above it from sm. Esc dismisses it. It is decorative (`aria-hidden`); the accessible name
 *   comes from `aria-label`. Its fade follows the V0.49 motion rule.
 * - `relative z-50` keeps it above the full-screen "click to show" layer that
 *   Layout adds while content is hidden.
 * - Colors: muted icon, accent on hover, the global focus ring plus the focus
 *   glow, the same as the footer links and switch (AA notes in index.css).
 */
export default function HideContentButton({ hidden, onToggle }: HideContentButtonProps) {
  const label = hidden ? 'Show content' : 'Hide content'
  // Esc dismisses the tooltip (WCAG 1.4.13) until the pointer or focus leaves.
  const [tipDismissed, setTipDismissed] = useState(false)

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={label}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setTipDismissed(true)
      }}
      onBlur={() => setTipDismissed(false)}
      onPointerLeave={() => setTipDismissed(false)}
      className="group relative z-50 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:text-accent focus-visible:shadow-glow-focus"
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded-md border border-border bg-bg-glass px-2 py-1 text-xs whitespace-nowrap text-fg opacity-0 motion-safe:transition-opacity motion-safe:duration-150 sm:top-auto sm:bottom-full sm:left-1/2 sm:mb-2 sm:ml-0 sm:-translate-x-1/2 sm:translate-y-0 ${
          tipDismissed ? '' : 'group-hover:opacity-100 group-focus-visible:opacity-100'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

const iconProps = {
  'aria-hidden': true,
  focusable: false,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'size-5',
} as const

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  )
}
