// PLACEHOLDER: UI copy for the contact page. The address, links and call to
// action themselves come from `profile` (profile.ts).

export interface ContactPageContent {
  /** Page heading (the page's h1). */
  heading: string
  /** Label shown above the visible email address. */
  emailLabel: string
  /** Text of the mailto button. */
  emailButton: string
  githubButton: string
  linkedinButton: string
}

export const contactPage: ContactPageContent = {
  heading: 'Contact',
  emailLabel: 'Email',
  emailButton: 'Send an email',
  githubButton: 'GitHub',
  linkedinButton: 'LinkedIn',
}
