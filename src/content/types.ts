/**
 * Content types shared by every page. Edit the data files next to this one
 * (profile.ts, projects.ts, ...) to change what the site shows.
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
  /** Path to the photo under public/, e.g. "/christopher-waldriff.jpg". */
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

/**
 * Per-page metadata for `PageMeta`: the document title becomes
 * "<title> · <profile.name>" and `description` fills `<meta name="description">`.
 * Every page copy file has a `meta` field of this type; Home uses
 * `HomePageMetaCopy` (no `title`), so its title is just `profile.name`.
 */
export interface PageMetaCopy {
  /** Page name in the browser tab, shown before the site name. */
  title: string
  /** Search-result snippet for the page, roughly 50–160 characters. */
  description: string
}

/** Home page metadata: no `title`, so the document title is the site name alone. */
export type HomePageMetaCopy = Omit<PageMetaCopy, 'title'>
