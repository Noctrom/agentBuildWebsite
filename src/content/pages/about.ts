// PLACEHOLDER: UI copy for the About page (/about). The bio comes from
// `profile` (profile.ts), the lists from `skills` and `experience`.

export interface AboutPageCopy {
  /** Page heading (the page's h1). */
  title: string
  skillsTitle: string
  skillsIntro: string
  experienceTitle: string
  experienceIntro: string
}

export const aboutPage: AboutPageCopy = {
  title: 'About',
  skillsTitle: 'Skills',
  skillsIntro: 'Lorem ipsum placeholder intro: tools and technologies I work with.',
  experienceTitle: 'Experience',
  experienceIntro: 'Lorem ipsum placeholder intro: where I have worked, most recent first.',
}
