/**
 * Content types shared by every page. Edit the data files next to this one
 * (profile.ts, projects.ts, ...) to replace placeholders with real content.
 */

/** Year and month, e.g. "2023-04". Pages format these for display. */
export type YearMonth = `${number}-${number}`

export interface ProfileLinks {
  /** Plain address, without "mailto:". */
  email: string
  github: string
  linkedin: string
}

export interface Profile {
  name: string
  title: string
  /** One-line pitch shown in the home hero. */
  pitch: string
  /** Bio, one string per paragraph. */
  bio: string[]
  /** Short call-to-action text for the contact page. */
  contactCta: string
  location: string
  links: ProfileLinks
  /** Path to the photo under public/, e.g. "/photo-placeholder.svg". */
  photo: string
  /** Alt text for the photo. */
  photoAlt: string
  /** Path to the downloadable resume under public/. */
  resumeUrl: string
}

export interface Project {
  /** Stable unique id, usable as a React key. */
  id: string
  title: string
  description: string
  /** Tech tags used for filtering on the projects page. */
  tags: string[]
  repoUrl?: string
  demoUrl?: string
  /** Optional image path under public/. */
  image?: string
  /** Featured projects are previewed on the home page. */
  featured: boolean
}

/** Copy for the projects page (S8). */
export interface ProjectsPageCopy {
  title: string
  intro: string
  /** Accessible label for the tag filter group. */
  filterLabel: string
  /** Label for the button that clears the filter. */
  allLabel: string
  /** Card action labels. */
  repoLabel: string
  demoLabel: string
  /** Result count announced politely when the filter changes. */
  resultCount: (shown: number, total: number) => string
}

export interface Experience {
  id: string
  role: string
  company: string
  location?: string
  start: YearMonth
  /** null means "Present". */
  end: YearMonth | null
  summary: string
  /** Optional bullet points for the resume page. */
  highlights?: string[]
}

export interface Education {
  id: string
  degree: string
  institution: string
  start: YearMonth
  /** null means "Present". */
  end: YearMonth | null
  details?: string
}

export interface SkillGroup {
  category: string
  skills: string[]
}

/** UI strings for the home page (labels and headings, not bio data). */
export interface HomeContent {
  /** Hero button linking to /projects. */
  viewProjectsLabel: string
  /** Hero button that downloads the resume. */
  downloadResumeLabel: string
  /** Heading of the featured projects preview. */
  featuredHeading: string
  /** Optional intro under the featured heading. */
  featuredIntro?: string
  /** Button below the preview linking to /projects. */
  seeAllProjectsLabel: string
  /** Card action label for a project's repository link. */
  repoLabel: string
  /** Card action label for a project's live demo link. */
  demoLabel: string
}
