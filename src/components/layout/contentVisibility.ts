/**
 * "Hide content" mode (V0.57): the footer eye button hides every part of the
 * page except itself, so only the space background shows.
 *
 * Each hideable part (skip link, header, main, the other footer items, the
 * auto-pause toast) gets `inert` plus the classes below. They hide with
 * `visibility` and `opacity`, never `display: none`, so the page keeps its
 * height and layout: the scroll position and the button's place on screen
 * stay exactly as they were. `inert` takes the part out of the tab order,
 * pointer hit testing and the accessibility tree at once, even during the
 * fade-out.
 *
 * Motion follows the V0.49 rule: the fade only exists under `motion-safe`,
 * and the global reduced-motion rule in styles/index.css zeroes it
 * otherwise, so with the Animation switch off (or the OS asking for reduced
 * motion) it switches instantly. `visibility` is transitioned with the
 * opacity: it stays visible until the fade-out ends and turns visible at the
 * start of the fade-in.
 */
export function hideableClass(hidden: boolean): string {
  return `motion-safe:transition-[opacity,visibility] motion-safe:duration-300 motion-safe:ease-out ${
    hidden ? 'invisible opacity-0' : ''
  }`
}
