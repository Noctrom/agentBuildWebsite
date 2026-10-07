// UI copy for the About page (/about). The bio comes from
// `profile` (profile.ts), the lists from `skills` and `experience`.

import type { PageMetaCopy } from '../types'

export interface AboutPageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  skillsTitle: string
  skillsIntro: string
  experienceTitle: string
  experienceIntro: string
}

export const aboutPage: AboutPageCopy = {
  meta: {
    title: 'About',
    description:
      'About Christopher Waldriff, a computer science student at the University of Minnesota Duluth: background, skills and work experience.',
  },
  title: 'About',
  skillsTitle: 'Skills',
  skillsIntro: 'Languages and tools I work with.',
  experienceTitle: 'Experience',
  experienceIntro: "Where I've worked, most recent first.",
}
