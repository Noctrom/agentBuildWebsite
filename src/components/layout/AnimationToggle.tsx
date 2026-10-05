import { setMotionChoice, useReducedMotion } from './motionPreference'

/**
 * Footer switch for the background animation (V0.41). Shows the effective
 * state: the visitor's saved choice, else the OS "reduce motion" setting
 * (auto-paused counts as off). Flipping it saves an explicit on/off choice
 * that overrides the OS setting in both directions.
 *
 * A native button with role="switch": keyboard (Enter/Space) for free, and
 * screen readers announce "Animation, switch, on/off". The visible On/Off
 * word repeats the state for sighted users and is hidden from assistive tech
 * so the name stays "Animation".
 */
export default function AnimationToggle() {
  const animating = !useReducedMotion()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={animating}
      onClick={() => setMotionChoice(animating ? 'off' : 'on')}
      className="inline-flex min-h-6 items-center gap-2 rounded-md px-1.5 text-sm text-muted transition-colors duration-200 hover:text-accent focus-visible:shadow-glow-focus"
    >
      <span>Animation</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-200 ${
          animating ? 'border-accent bg-accent' : 'border-muted bg-transparent'
        }`}
      >
        <span
          className={`absolute h-2.5 w-2.5 rounded-full transition-[left] duration-200 ${
            animating ? 'left-[0.875rem] bg-accent-fg' : 'left-0.5 bg-muted'
          }`}
        />
      </span>
      <span aria-hidden="true" className="w-6 text-left">
        {animating ? 'On' : 'Off'}
      </span>
    </button>
  )
}
