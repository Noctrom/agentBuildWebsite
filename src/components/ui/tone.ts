/**
 * Background tone for cards and tags. Pick the opposite of what the element
 * sits on: `surface` (the default) on the page background, `bg` inside a
 * `<Section tone="surface">` band.
 *
 * Both tones are frosted glass (S25): a translucent fill plus a backdrop blur,
 * so the space background shows through. `surface` is a nebula-blue tint
 * (lighter than the page; since S32 a darker, more opaque tint that also
 * dims bright scene pixels behind it); `bg` is a deep space tint (darker than
 * a surface band), so the two stay visibly distinct. Contrast numbers are in
 * styles/index.css.
 *
 * Use the `tone` prop rather than `className="bg-..."`: an extra `bg-*` class
 * can't reliably override the built-in one, because Tailwind decides which
 * wins by its own CSS order, not by class order in the attribute.
 */
export type SurfaceTone = 'surface' | 'bg'

/**
 * Translucent fill only (no blur). Used by tags and the S20 diagram boxes,
 * which are many small elements: see `glassClass`.
 */
export const surfaceToneClass: Record<SurfaceTone, string> = {
  surface: 'bg-surface',
  bg: 'bg-bg-glass',
}

/**
 * Full frosted glass: translucent fill plus backdrop blur. Used by the header,
 * footer, `Section tone="surface"` bands, cards and secondary buttons.
 *
 * Blur is deliberately not on tags or diagram boxes. Each blurred element
 * re-filters its backdrop on every frame of the animated background; with blur
 * on the diagram boxes, scrolling Behind the Scenes at 375px with 4x CPU
 * throttling dropped noticeably more frames (S25). Over the dim background the
 * blur on small pills is invisible anyway, and inside a blurred band a nested
 * blur only sees the band (the band is the backdrop root), not the stars.
 */
export const glassClass: Record<SurfaceTone, string> = {
  surface: `${surfaceToneClass.surface} backdrop-blur-glass`,
  bg: `${surfaceToneClass.bg} backdrop-blur-glass`,
}

/**
 * Hover/focus glow for interactive elements: a soft accent halo on hover and a
 * stronger one on keyboard focus (on top of the global focus outline).
 * Transitions snap under prefers-reduced-motion (global rule in index.css).
 */
export const glowClass =
  'transition-[color,background-color,border-color,box-shadow] duration-200 hover:shadow-glow focus-visible:shadow-glow-focus'
