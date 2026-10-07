// PLACEHOLDER: UI copy for the projects page (/projects). The projects and
// tags come from projects.ts; the card action labels from `sharedLabels`.

import type { PageMetaCopy } from '../types'

export interface ProjectsPageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  intro: string
  /** Accessible label for the tag filter group. */
  filterLabel: string
  /** Label for the button that clears the filter. */
  allLabel: string
  /** Result count announced politely when the filter changes. */
  resultCount: (shown: number, total: number) => string
}

export const projectsPage: ProjectsPageCopy = {
  meta: {
    title: 'Projects',
    description:
      'Placeholder projects description: lorem ipsum selection of projects by Christopher Waldriff, filterable by technology.',
  },
  title: 'Projects',
  intro:
    'Lorem ipsum dolor sit amet, a placeholder selection of things I have built. Filter by technology below.',
  filterLabel: 'Filter projects by technology',
  allLabel: 'All',
  resultCount: (shown, total) =>
    `Showing ${shown} of ${total} ${total === 1 ? 'project' : 'projects'}`,
}
