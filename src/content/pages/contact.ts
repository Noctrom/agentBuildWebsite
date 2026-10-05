// PLACEHOLDER: UI copy for the contact page (/contact). The address, links and
// call to action themselves come from `profile` (profile.ts).

import type { PageMetaCopy } from '../types'

export interface ContactPageCopy {
  /** Document title and meta description for `PageMeta`. */
  meta: PageMetaCopy
  /** Page heading (the page's h1). */
  title: string
  /** Label shown above the visible email address. */
  emailLabel: string
  /** Text of the mailto button. */
  emailButtonLabel: string
  githubButtonLabel: string
  linkedinButtonLabel: string
  /** Accessible label for the list of contact buttons. */
  linksLabel: string
}

export const contactPage: ContactPageCopy = {
  meta: {
    title: 'Contact',
    description:
      'Placeholder contact description: lorem ipsum ways to reach Jane Placeholder by email, GitHub or LinkedIn.',
  },
  title: 'Contact',
  emailLabel: 'Email',
  emailButtonLabel: 'Send an email',
  githubButtonLabel: 'GitHub',
  linkedinButtonLabel: 'LinkedIn',
  linksLabel: 'Contact links',
}
