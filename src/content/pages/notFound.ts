// UI copy for the 404 page (any unknown URL, the catch-all route).

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
    description: "This page doesn't exist on Christopher Waldriff's site.",
  },
  title: 'Page not found',
  intro:
    "The page you're looking for doesn't exist or has moved.",
  homeLabel: 'Back to home',
}
