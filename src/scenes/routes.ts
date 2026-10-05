import { starfieldScene } from './starfield'
import type { Scene } from './types'

/**
 * Route -> scene map for the space background. The engine looks up the
 * current pathname here on every navigation and crossfades when the scene id
 * changes. To give a page its own scene, add an entry: the key is the route
 * path exactly as in `App.tsx` (no trailing slash).
 *
 *   import { blackHoleScene } from './blackHole'
 *   '/behind-the-scenes': blackHoleScene,
 */
export const routeScenes: Readonly<Record<string, Scene>> = {
  '/': starfieldScene,
}

/** Scene for routes not listed above, including the 404 page. */
export const defaultScene: Scene = starfieldScene

/** Scene for a pathname such as `/about` or `/about/`. */
export function sceneForPath(pathname: string): Scene {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return routeScenes[path] ?? defaultScene
}
