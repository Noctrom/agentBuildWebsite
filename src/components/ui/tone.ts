/**
 * Background tone for cards and tags. Pick the opposite of what the element
 * sits on: `surface` (the default) on the page background, `bg` inside a
 * `<Section tone="surface">` band.
 *
 * Use the `tone` prop rather than `className="bg-..."`: an extra `bg-*` class
 * can't reliably override the built-in one, because Tailwind decides which
 * wins by its own CSS order, not by class order in the attribute.
 */
export type SurfaceTone = 'surface' | 'bg'

export const surfaceToneClass: Record<SurfaceTone, string> = {
  surface: 'bg-surface',
  bg: 'bg-bg',
}
