// PLACEHOLDER: UI copy for the home page (/). The hero name, title, pitch and
// photo come from `profile` (profile.ts); the cards come from `featuredProjects`.

export interface HomePageCopy {
  /** Hero button linking to /projects. */
  viewProjectsLabel: string
  /** Hero button that downloads the resume. */
  downloadResumeLabel: string
  /** Heading of the featured projects preview. */
  featuredTitle: string
  /** Optional intro under the featured heading. */
  featuredIntro?: string
  /** Button below the preview linking to /projects. */
  seeAllProjectsLabel: string
}

export const homePage: HomePageCopy = {
  viewProjectsLabel: 'View Projects',
  downloadResumeLabel: 'Download Resume',
  featuredTitle: 'Featured Projects',
  featuredIntro: 'Lorem ipsum placeholder intro: a few highlights from the projects page.',
  seeAllProjectsLabel: 'See all projects',
}
