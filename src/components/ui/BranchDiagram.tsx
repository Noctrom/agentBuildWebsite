import { useId, type ReactNode } from 'react'
import { surfaceToneClass, type SurfaceTone } from './tone'

/** One branch level, e.g. `main`, `leader` or `story/<id>-<slug>`. */
export type BranchLevel = {
  /** Unique within the diagram. */
  id: string
  /** Branch name, shown in monospace, e.g. "main" or "story/<id>-<slug>". */
  name: string
  /** What the branch is for, e.g. "Production: the live site". */
  description?: string
  /** Who may change it and how, e.g. "Only Chris, by merging a pull request". */
  access: string
  /**
   * How this branch's work reaches the level above, shown on the arrow
   * between them, e.g. "Pull request, merged by Chris". Ignored on the first
   * (top) level.
   */
  mergeLabel?: string
  /** Optional example branch names, shown stacked, e.g. ["story/S20-...", "story/S21-..."]. */
  examples?: string[]
}

export type BranchDiagramProps = {
  /** Accessible name of the diagram, e.g. "Git branches and who can change them". */
  label: string
  /** Levels from most protected (top, e.g. `main`) down to the working branches. */
  levels: BranchLevel[]
  /** Optional small heading before each level's `access` text, e.g. "Who can change it". */
  accessLabel?: string
  /** Optional visible caption under the diagram. */
  caption?: ReactNode
  /**
   * Card background. Defaults to `surface`; use `bg` inside a
   * `<Section tone="surface">`.
   */
  tone?: SurfaceTone
  className?: string
}

/** Indent per level from `sm` up, so the hierarchy reads like a tree. */
const indent = ['', 'sm:ml-8', 'sm:ml-16', 'sm:ml-24']

function ArrowUp() {
  return (
    <svg
      viewBox="0 0 16 32"
      width="16"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-accent"
    >
      <path d="M8 30V3M3 8l5-5 5 5" />
    </svg>
  )
}

/**
 * Git branch levels (e.g. main ← leader ← story/*) and who may change each.
 * Rendered as a real ordered list (top level first) so it reads naturally
 * with a screen reader; arrows are decorative and each merge label is part
 * of its level's list item (read after the card). All text comes from props.
 */
export default function BranchDiagram({
  label,
  levels,
  accessLabel,
  caption,
  tone = 'surface',
  className = '',
}: BranchDiagramProps) {
  const labelId = `${useId()}-label`

  return (
    <figure aria-labelledby={labelId} className={className}>
      {/* Names the figure only (via aria-labelledby), so it isn't read twice. */}
      <span id={labelId} hidden>
        {label}
      </span>

      <ol className="flex flex-col">
        {levels.map((level, i) => (
          <li
            key={level.id}
            className={`flex flex-col ${indent[Math.min(i, indent.length - 1)]}`}
          >
            <div
              className={`grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6 ${surfaceToneClass[tone]}`}
            >
              <div className="min-w-0">
                <div className="font-mono text-base font-semibold break-words text-accent">
                  {level.name}
                </div>
                {level.description && (
                  <p className="mt-1 text-sm text-muted">{level.description}</p>
                )}
                {level.examples && level.examples.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {level.examples.map((example) => (
                      <li
                        key={example}
                        className="w-fit max-w-full rounded border border-border bg-bg px-2 py-0.5 font-mono text-xs break-all text-muted"
                      >
                        {example}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="min-w-0 border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                {accessLabel && (
                  <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {accessLabel}
                  </div>
                )}
                <p className="mt-1 text-sm font-medium text-fg">{level.access}</p>
              </div>
            </div>
            {/* After the card in reading order ("how it gets up"), but drawn
                above it, between this level and its parent. */}
            {i > 0 && (
              <div className="order-first flex items-center gap-2 py-1 pl-6">
                <ArrowUp />
                {level.mergeLabel && (
                  <p className="text-xs font-semibold text-accent">{level.mergeLabel}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {caption && (
        <figcaption className="mt-4 text-center text-sm text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
