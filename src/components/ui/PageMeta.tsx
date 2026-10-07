import { useLayoutEffect } from 'react'
import { profile } from '../../content'

export type PageMetaProps = {
  /**
   * Page name shown before the site name, e.g. `"About"` gives
   * `"About · <profile.name>"`. Leave it out on Home: the title is then just
   * the site name (`profile.name`).
   */
  title?: string
  /** Text for `<meta name="description">` (search result snippet). */
  description: string
}

/** Builds the document title: "<Page> · <site name>", or the site name alone. */
function formatPageTitle(title?: string): string {
  return title ? `${title} · ${profile.name}` : profile.name
}

/**
 * Selector for the static defaults in index.html that PageMeta takes over.
 * Those tags carry `data-default-meta`; keep the attribute if you edit them.
 */
const DEFAULT_META_SELECTOR = 'head > [data-default-meta]'

/** Number of mounted PageMeta instances; the defaults are detached while > 0. */
let mounted = 0
let detached: { node: Element; placeholder: Comment }[] = []

/**
 * While any PageMeta is mounted, swap index.html's default `<title>` and
 * `<meta name="description">` out of <head> for placeholder comments, and put
 * them back when the last one unmounts.
 *
 * Why: React 19 hoists the `<title>`/`<meta>` that PageMeta renders into
 * <head> but does not replace tags that are already there. Without this,
 * <head> holds two titles and two descriptions, and the static description
 * comes first, so anything reading the first one gets the stale default.
 * Routes that don't render PageMeta keep the defaults.
 */
function useTakeOverDefaultMeta() {
  useLayoutEffect(() => {
    mounted += 1
    if (mounted === 1) {
      detached = [...document.querySelectorAll(DEFAULT_META_SELECTOR)].map((node) => {
        const placeholder = document.createComment('default meta (replaced by PageMeta)')
        node.replaceWith(placeholder)
        return { node, placeholder }
      })
    }
    return () => {
      mounted -= 1
      if (mounted === 0) {
        detached.forEach(({ node, placeholder }) => placeholder.replaceWith(node))
        detached = []
      }
    }
  }, [])
}

/**
 * Sets the document `<title>` and `<meta name="description">` for a page.
 * Uses React 19's built-in metadata support: the tags render where PageMeta
 * is used and React hoists them into <head>. No extra dependency.
 *
 * Usage (dev-2, S19): render it once at the top of every page, with the text
 * coming from `src/content/`, never hardcoded in the page:
 *
 * ```tsx
 * import { PageMeta } from '../components/ui'
 * import { aboutPage } from '../content'
 *
 * export default function About() {
 *   return (
 *     <>
 *       <PageMeta title={aboutPage.metaTitle} description={aboutPage.metaDescription} />
 *       ...
 *     </>
 *   )
 * }
 * ```
 *
 * - Title format: `"<title> · <profile.name>"`, e.g. "About · Christopher Waldriff".
 * - Home: omit `title`; the document title is just `profile.name`.
 * - Render only one PageMeta per route (React does not dedupe them).
 * - The site-wide defaults (title, description, Open Graph, Twitter card) live
 *   in index.html. Crawlers and link previews read those without running JS,
 *   so Open Graph tags stay site-wide; PageMeta only handles title and
 *   description. While a PageMeta is mounted, the index.html default title and
 *   description are taken out of <head> so there is only ever one of each.
 */
export default function PageMeta({ title, description }: PageMetaProps) {
  useTakeOverDefaultMeta()
  return (
    <>
      <title>{formatPageTitle(title)}</title>
      <meta name="description" content={description} />
    </>
  )
}
