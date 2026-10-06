import { blackHoleScene } from './blackHole'
import { galaxyScene } from './galaxy'
import { lostInSpaceScene } from './lostInSpace'
import { nebulaScene } from './nebula'
import { planetsScene } from './planets'
import { solarSystemScene } from './solarSystem'
import { sunScene } from './sun'
import type { Scene } from './types'

/**
 * Route -> scene map for the space background. The engine looks up the
 * current pathname here on every navigation. When the scene id changes, the
 * old scene fades out at once and the new one fades in as soon as it is ready
 * (with reduce motion, the swap is instant once the new scene is ready).
 * To give a page its own scene, add an entry: the key is the route
 * path exactly as in `App.tsx` (no trailing slash).
 *
 *   import { blackHoleScene } from './blackHole'
 *   '/behind-the-scenes': blackHoleScene,
 */
export const routeScenes: Readonly<Record<string, Scene>> = {
  '/': solarSystemScene,
  '/about': sunScene,
  '/projects': planetsScene,
  '/resume': nebulaScene,
  '/contact': galaxyScene,
  '/behind-the-scenes': blackHoleScene,
}

/**
 * Scene for routes not listed above, which means the 404 page. Every real
 * route in `App.tsx` must have its own entry above, or it would show the
 * "lost in space" scene.
 */
export const defaultScene: Scene = lostInSpaceScene

/** Scene for a pathname such as `/about` or `/about/`. */
export function sceneForPath(pathname: string): Scene {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return routeScenes[path] ?? defaultScene
}
