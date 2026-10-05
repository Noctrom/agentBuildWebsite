import { useSyncExternalStore } from 'react'

/**
 * Site-wide animation setting (V0.41): the one source of truth for whether
 * the background scenes move.
 *
 * - `'on'` / `'off'`: the visitor chose with the footer control. Overrides
 *   the OS "reduce motion" setting in both directions.
 * - `'auto-paused'`: reserved for the site pausing animation itself (V0.42,
 *   slow devices). Treated as off, shown as off, but not a visitor choice.
 * - `null`: no choice saved; follow the OS setting.
 *
 * The choice is saved in localStorage. Every storage access is wrapped in
 * try/catch: if storage is blocked or throws, the choice still applies for
 * this page session and the site keeps working. Updates are live: the OS
 * setting, this tab's control and other tabs (the `storage` event) all
 * notify subscribers.
 *
 * V0.49: the same effective state also drives small UI motion. It is
 * mirrored to `data-motion="reduce" | "full"` on <html> (see
 * `syncMotionAttribute`), which the `motion-safe:` / `motion-reduce:`
 * variants and the global reduced-motion rule in styles/index.css key on.
 * An inline script in index.html sets the attribute before first paint; it
 * repeats the storage key, the choice values and the media query below, so
 * keep the two in sync.
 */
export type MotionChoice = 'on' | 'off' | 'auto-paused'

// Also read by the inline script in index.html (V0.49): keep both in sync.
const STORAGE_KEY = 'motion-preference'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const CHOICES: readonly MotionChoice[] = ['on', 'off', 'auto-paused']

function parseChoice(value: string | null): MotionChoice | null {
  return CHOICES.find((choice) => choice === value) ?? null
}

function readStoredChoice(): MotionChoice | null {
  try {
    return parseChoice(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function writeStoredChoice(choice: MotionChoice | null) {
  try {
    if (choice) window.localStorage.setItem(STORAGE_KEY, choice)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode, blocked, full): keep it in memory only.
  }
}

let currentChoice: MotionChoice | null | undefined
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** The saved choice, or null when the site follows the OS setting. */
export function getMotionChoice(): MotionChoice | null {
  if (currentChoice === undefined) currentChoice = readStoredChoice()
  return currentChoice
}

/**
 * Save a choice (or `null` to go back to following the OS setting) and
 * update every subscriber at once.
 */
export function setMotionChoice(choice: MotionChoice | null) {
  writeStoredChoice(choice)
  if (choice === getMotionChoice()) return
  currentChoice = choice
  notify()
}

/** True when the visitor picked on/off themselves (not auto-paused, not unset). */
export function isExplicitMotionChoice(choice = getMotionChoice()): boolean {
  return choice === 'on' || choice === 'off'
}

function osPrefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Whether scenes should be still: the saved choice if any, else the OS setting. */
export function getReducedMotion(): boolean {
  const choice = getMotionChoice()
  if (choice === 'on') return false
  if (choice === 'off' || choice === 'auto-paused') return true
  return osPrefersReducedMotion()
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  const choice = readStoredChoice()
  if (choice === currentChoice) return
  currentChoice = choice
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null
  query?.addEventListener('change', listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    query?.removeEventListener('change', listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

/** Live "should scenes be still" flag for React components. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getReducedMotion, () => false)
}

/** Live saved choice (null = following the OS) for React components. */
export function useMotionChoice(): MotionChoice | null {
  return useSyncExternalStore(subscribe, getMotionChoice, () => null)
}

/** Value of the `data-motion` attribute on <html> (V0.49). */
export type MotionAttribute = 'reduce' | 'full'

function applyMotionAttribute() {
  const value: MotionAttribute = getReducedMotion() ? 'reduce' : 'full'
  const root = document.documentElement
  if (root.dataset.motion !== value) root.dataset.motion = value
}

/**
 * Keep `data-motion` on <html> in step with the effective setting (V0.49):
 * the footer switch, auto-pause, other tabs and OS changes all update it
 * live. Call once at startup; returns a function that stops the sync.
 */
export function syncMotionAttribute(): () => void {
  applyMotionAttribute()
  return subscribe(applyMotionAttribute)
}
