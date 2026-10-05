// PLACEHOLDER: UI copy for the 404 page (any unknown URL, the catch-all route).

import type { PageMetaCopy } from '../types'

export interface NotFoundPageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  intro: string
  /** Text of the button linking back to the home page. */
  homeLabel: string
}

export const notFoundPage: NotFoundPageCopy = {
  meta: {
    title: 'Page not found',
    description: 'Placeholder 404 description: lorem ipsum, this page does not exist.',
  },
  title: 'Page not found',
  intro:
    'Lorem ipsum placeholder text: the page you are looking for does not exist or has moved.',
  homeLabel: 'Back to home',
}
