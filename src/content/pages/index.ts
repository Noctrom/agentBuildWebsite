/**
 * Page copy: the headings, intros and UI labels of each page, one file per
 * page. Pattern (follow it for new pages):
 * - File `pages/<page>.ts` exports `<page>Page` typed by `<Page>PageCopy`,
 *   with the interface declared in the same file.
 * - Field names: `title` = the page's h1, `intro` = text under it,
 *   `<section>Title` / `<section>Intro` for h2 sections, `<thing>Label` for
 *   button, link and accessible-name text.
 * - Data (profile, projects, experience, ...) stays in its own file under
 *   src/content/; labels used by more than one page go in labels.ts.
 */
export { homePage, type HomePageCopy } from './home'
export { aboutPage, type AboutPageCopy } from './about'
export { projectsPage, type ProjectsPageCopy } from './projects'
export { resumePage, type ResumePageCopy } from './resume'
export { contactPage, type ContactPageCopy } from './contact'
