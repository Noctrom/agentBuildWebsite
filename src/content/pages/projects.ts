// UI copy for the projects page (/projects). The projects and
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
      'Projects by Christopher Waldriff: SQL data analysis, a team-built social media app and this website, filterable by technology.',
  },
  title: 'Projects',
  intro:
    "Things I've built, from SQL data analysis to a team-built app and this website. Filter by technology below.",
  filterLabel: 'Filter projects by technology',
  allLabel: 'All',
  resultCount: (shown, total) =>
    `Showing ${shown} of ${total} ${total === 1 ? 'project' : 'projects'}`,
}
