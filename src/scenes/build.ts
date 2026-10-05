import type { SceneBuild, SceneInstance } from './types'

/**
 * Helpers for incremental scene builds (S29). See "Heavy setup" in `types.ts`.
 */

/** True if `create` returned a generator build rather than a ready instance. */
export function isSceneBuild(value: SceneInstance | SceneBuild): value is SceneBuild {
  return typeof (value as Partial<SceneBuild>).next === 'function' && !('draw' in value)
}

/**
 * Run a generator to the end synchronously and return its result. Use it to
 * reuse a yielding bake where the work must finish now, e.g. in `resize`:
 *
 *   resize(next) { clouds = runToEnd(bakeClouds(next)) }
 */
export function runToEnd<T>(build: Generator<unknown, T, undefined>): T {
  for (;;) {
    const step = build.next()
    if (step.done) return step.value
  }
}
