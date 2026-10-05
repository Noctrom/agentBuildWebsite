import { useId, type ReactNode } from 'react'
import { surfaceToneClass, type SurfaceTone } from './tone'

/** One box in the flow. */
export type FlowStep = {
  /** Unique within the diagram; referenced by `FlowLoop.from` / `FlowLoop.to`. */
  id: string
  /** Main text, e.g. "Leader". */
  label: string
  /** Optional second line, e.g. "Triages and assigns". */
  detail?: string
  /** `branch` shows the label in a monospace font (for git branch names). */
  kind?: 'step' | 'branch'
}

/** A group of consecutive steps, shown as one column on wide screens. */
export type FlowStage = {
  /** Optional small heading above the column, e.g. "Plan". */
  label?: string
  steps: FlowStep[]
}

/**
 * A "go back" arrow from a later step to an earlier one, e.g. review sending a
 * story back to the developer. Drawn as a dashed bracket when both steps are
 * in the same stage, otherwise as a note under the `from` step.
 */
export type FlowLoop = {
  /** Id of the step the loop starts at (the later step, e.g. review). */
  from: string
  /** Id of the step the loop returns to (the earlier step, e.g. the dev). */
  to: string
  /** Short visible label on the loop, e.g. "Send back for fixes". */
  label: string
  /** Full sentence for screen readers, e.g. "If changes are needed, ...". */
  description: string
}

export type StoryFlowDiagramProps = {
  /** Accessible name of the diagram, e.g. "How a story moves through the team". */
  label: string
  /** Stages in order; steps flow top to bottom, stage to stage. */
  stages: FlowStage[]
  loop?: FlowLoop
  /** Optional visible caption under the diagram. */
  caption?: ReactNode
  /**
   * Box background. Defaults to `surface`; use `bg` inside a
   * `<Section tone="surface">`.
   */
  tone?: SurfaceTone
  className?: string
}

function ArrowDown({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 24"
      width="16"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M8 2v19M3 16l5 5 5-5" />
    </svg>
  )
}

function StepBox({ step, tone }: { step: FlowStep; tone: SurfaceTone }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center ${
        step.kind === 'branch' ? 'border-accent' : 'border-border'
      } ${surfaceToneClass[tone]}`}
    >
      <div
        className={
          step.kind === 'branch'
            ? 'font-mono text-sm font-semibold text-accent'
            : 'text-sm font-semibold text-fg'
        }
      >
        {step.label}
      </div>
      {step.detail && <div className="mt-0.5 text-xs text-muted">{step.detail}</div>}
    </div>
  )
}

function StepColumn({ steps, tone }: { steps: FlowStep[]; tone: SurfaceTone }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => (
        <div key={step.id} className="flex flex-col">
          {i > 0 && <ArrowDown className="mx-auto my-1 text-muted" />}
          <StepBox step={step} tone={tone} />
        </div>
      ))}
    </div>
  )
}

/** Steps `to`..`from` with a dashed bracket on the right pointing back up. */
function LoopRange({
  steps,
  loop,
  tone,
}: {
  steps: FlowStep[]
  loop: FlowLoop
  tone: SurfaceTone
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-x-2">
      <StepColumn steps={steps} tone={tone} />
      <div className="relative">
        {/* Bracket: from the middle of the last box back up to the first. */}
        <div className="absolute -left-2 right-0 top-5 bottom-5 rounded-r-xl border-y-2 border-r-2 border-dashed border-accent" />
        {/* Arrowhead pointing left, into the first box. */}
        <svg
          viewBox="0 0 10 12"
          width="10"
          height="12"
          aria-hidden="true"
          focusable="false"
          className="absolute -left-2 top-5 -translate-y-1/2 fill-accent"
        >
          <path d="M0 6 10 0v12z" />
        </svg>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-1.5 text-center text-xs font-semibold leading-tight text-accent">
          {loop.label}
        </div>
      </div>
    </div>
  )
}

/** Width of the loop bracket column plus its gap; boxes leave this free. */
const LOOP_GUTTER = 'pr-[6rem]'
const LOOP_GUTTER_STACKED = 'max-lg:pr-[6rem]'

/** True when both loop ends are in `steps`, in flow order (bracket is drawn). */
function containsLoop(steps: FlowStep[], loop?: FlowLoop): boolean {
  if (!loop) return false
  const toIndex = steps.findIndex((s) => s.id === loop.to)
  const fromIndex = steps.findIndex((s) => s.id === loop.from)
  return toIndex !== -1 && fromIndex > toIndex
}

function StageSteps({
  steps,
  loop,
  tone,
}: {
  steps: FlowStep[]
  loop?: FlowLoop
  tone: SurfaceTone
}) {
  if (loop && containsLoop(steps, loop)) {
    const toIndex = steps.findIndex((s) => s.id === loop.to)
    const fromIndex = steps.findIndex((s) => s.id === loop.from)
    const before = steps.slice(0, toIndex)
    const range = steps.slice(toIndex, fromIndex + 1)
    const after = steps.slice(fromIndex + 1)
    return (
      <div className="flex flex-col">
        {before.length > 0 && (
          <div className={`flex flex-col ${LOOP_GUTTER}`}>
            <StepColumn steps={before} tone={tone} />
            <ArrowDown className="mx-auto my-1 text-muted" />
          </div>
        )}
        <LoopRange steps={range} loop={loop} tone={tone} />
        {after.length > 0 && (
          <div className={`flex flex-col ${LOOP_GUTTER}`}>
            <ArrowDown className="mx-auto my-1 text-muted" />
            <StepColumn steps={after} tone={tone} />
          </div>
        )}
      </div>
    )
  }

  // Loop ends in different stages (or not in this one): plain column, with a
  // note under the `from` step if it is here.
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => (
        <div key={step.id} className="flex flex-col">
          {i > 0 && <ArrowDown className="mx-auto my-1 text-muted" />}
          <StepBox step={step} tone={tone} />
          {loop && step.id === loop.from && (
            <div className="mt-1 text-center text-xs font-semibold text-accent">
              <span aria-hidden="true">↺ </span>
              {loop.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Flow chart of how one story moves through the team: stages of steps, top
 * to bottom on narrow screens and as side-by-side columns from `lg` up, with
 * an optional "send back" loop. All text comes from props.
 *
 * The visual chart is hidden from assistive tech; screen readers get an
 * equivalent nested ordered list (stages → steps, plus the loop description).
 */
export default function StoryFlowDiagram({
  label,
  stages,
  loop,
  caption,
  tone = 'surface',
  className = '',
}: StoryFlowDiagramProps) {
  const labelId = `${useId()}-label`
  // When a bracket is drawn, the stacked (narrow) layout keeps every box in
  // the same column as the bracketed ones, so the arrows line up.
  const hasBracket = stages.some((stage) => containsLoop(stage.steps, loop))
  const stackedGutter = hasBracket ? LOOP_GUTTER_STACKED : ''

  return (
    <figure aria-labelledby={labelId} className={className}>
      {/* Names the figure only (via aria-labelledby), so it isn't read twice. */}
      <span id={labelId} hidden>
        {label}
      </span>

      <ol className="sr-only">
        {stages.map((stage, si) => (
          <li key={si}>
            {stage.label}
            <ol>
              {stage.steps.map((step) => (
                <li key={step.id}>
                  {step.label}
                  {step.detail && `: ${step.detail}`}
                  {loop && step.id === loop.from && <p>{loop.description}</p>}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      <div
        aria-hidden="true"
        className={`mx-auto flex max-w-md flex-col ${
          stages.length > 1 ? 'lg:max-w-none lg:flex-row lg:items-start' : ''
        }`}
      >
        {stages.map((stage, si) => {
          const bracketed = containsLoop(stage.steps, loop)
          const gutter = bracketed ? LOOP_GUTTER : stackedGutter
          return (
            <div key={si} className="contents">
              {si > 0 && (
                <div
                  className={`flex justify-center py-1 lg:self-center lg:px-2 lg:py-0 ${stackedGutter}`}
                >
                  <ArrowDown className="text-muted lg:-rotate-90" />
                </div>
              )}
              <div className="min-w-0 lg:flex-1">
                {stage.label && (
                  <div
                    className={`mb-2 text-center text-xs font-semibold tracking-wide text-muted uppercase ${gutter}`}
                  >
                    {stage.label}
                  </div>
                )}
                <div className={bracketed ? '' : stackedGutter}>
                  <StageSteps steps={stage.steps} loop={loop} tone={tone} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {caption && (
        <figcaption className="mt-4 text-center text-sm text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
