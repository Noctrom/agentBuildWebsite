// PLACEHOLDER: UI copy for the About page (/about). The bio comes from
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
      'Placeholder about description: lorem ipsum background, skills and experience of Christopher Waldriff.',
  },
  title: 'About',
  skillsTitle: 'Skills',
  skillsIntro: 'Lorem ipsum placeholder intro: tools and technologies I work with.',
  experienceTitle: 'Experience',
  experienceIntro: 'Lorem ipsum placeholder intro: where I have worked, most recent first.',
}
