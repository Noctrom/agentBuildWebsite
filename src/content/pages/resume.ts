// UI copy for the resume page (/resume). The entries themselves
// come from `experience` (experience.ts) and `education` (education.ts); the
// PDF path comes from `profile.resumeUrl`.

import type { PageMetaCopy } from '../types'

export interface ResumePageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  intro: string
  /** Text of the PDF download button. */
  downloadLabel: string
  experienceTitle: string
  experienceIntro: string
  /** Accessible label for each role's list of highlights. */
  highlightsLabel: string
  educationTitle: string
  educationIntro: string
}

export const resumePage: ResumePageCopy = {
  meta: {
    title: 'Resume',
    description:
      'Resume of Christopher Waldriff: computer science at the University of Minnesota Duluth and work experience, with a PDF download.',
  },
  title: 'Resume',
  intro:
    'A summary of my education and experience. Download the PDF for the full resume.',
  downloadLabel: 'Download PDF',
  experienceTitle: 'Experience',
  experienceIntro: 'Roles, most recent first.',
  highlightsLabel: 'Highlights',
  educationTitle: 'Education',
  educationIntro: 'Degree, coursework and honors.',
}
