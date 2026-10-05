# dev-2 story log

> The S5 entry was backfilled by the leader from dev-2's report, because the story log rule didn't exist yet when it was done.

## S5 — Content model & placeholders (2026-10-03)
**Branch:** story/S5-content-model · **Status:** done

**What I did**
- Typed data files in `src/content/`: profile, projects, experience, education and skills, with a barrel `index.ts`.
- Clearly fake placeholder values throughout.
- Placeholder resume at `public/resume.pdf` and photo at `public/photo-placeholder.svg`.

**How I did it**
- All types in `types.ts`, re-exported from `index.ts`, so pages can `import { profile, type Project } from '../content'`.
- Profile: name, title, pitch, bio paragraphs, `contactCta` (for S10), location, links (email without `mailto:`, GitHub, LinkedIn), photo and alt text, `resumeUrl`.
- 6 projects (Alpha–Zeta), 3 featured, with overlapping tags so the S8 filter is meaningful; optional `repoUrl`, `demoUrl` and `image`. Also exports `featuredProjects` and a sorted `projectTags` list.
- 3 experience entries, 1 education entry, 4 skill groups. Dates are `YearMonth` strings ("2023-04"); `end: null` means "Present". Every entry has a stable `id` for React keys.
- Placeholder values like "Jane Placeholder", "Jane Doe Corp", example.com links and lorem ipsum; each data file starts with a `// PLACEHOLDER` comment.
- The resume PDF is a hand-built one-page PDF 1.4; with no PDF tools installed, a Python script checked that `startxref`, the xref offsets and the stream `/Length` are correct.

**Verification**
- `npm run build` and `npm run lint` pass (`tsc -b` type-checks the data against its types).
- `file` reports the resume as "PDF document, version 1.4, 1 page(s)". Not opened in a viewer.

**Files**
- Added: `src/content/types.ts`, `profile.ts`, `projects.ts`, `experience.ts`, `education.ts`, `skills.ts`, `index.ts`, `public/resume.pdf`, `public/photo-placeholder.svg`.

**Follow-ups**
- dev-1 (S4): projects can have both `repoUrl` and `demoUrl`, so `Card` must support more than one link.
- S7/S9 will need a shared date formatter for `YearMonth`.
- The static resume PDF must be replaced by hand along with the real content.

## S10 — Contact page (2026-10-03)
**Branch:** story/S10-contact-page · **Status:** done

**What I did**
- Email (`mailto:`) button plus GitHub and LinkedIn buttons, all from `profile.links`. The email address is also shown as plain, selectable text so people can copy it.
- Call-to-action text from `profile.contactCta`, shown as the section intro under the page's h1.
- No form.
- `/contact` route now renders the page instead of the Placeholder.

**How I did it**
- `src/pages/Contact.tsx` is one `Section` (`headingLevel={1}`, intro = CTA) holding a bordered `bg-surface` panel: an "Email" label, the address (`select-all`, `break-all` so long addresses never overflow at 375px), then the three Buttons in a labelled `<ul>`. Email is the primary button; GitHub and LinkedIn are secondary. `Button` handles new-tab and the screen-reader "(opens in a new tab)" for the http links. The mailto link stays in the same tab.
- I didn't use `Card`: it needs a title heading and adds the card title to each action's accessible name, which doesn't fit here. A plain panel with theme classes was simpler.
- The page heading and button labels live in a new `src/content/contact.ts` (`contactPage`), exported from the content barrel, so the page has no hardcoded text. I kept its type in that file and didn't touch `types.ts`/`profile.ts`, so the parallel page stories are less likely to conflict.
- Only semantic theme classes are used. No `<main>`, one h1.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core) against `vite preview` at `/contact`, light and dark at 375px and 1280px: one h1 ("Contact"), one `<main>`, no `<form>`, no horizontal overflow, no console errors. Links are `mailto:hello@example.com` (no target), GitHub and LinkedIn with `target="_blank" rel="noopener noreferrer"`. Screenshots look right in both themes. At 375px the buttons wrap onto two rows.

**Files**
- Added: `src/pages/Contact.tsx`, `src/content/contact.ts`.
- Changed: `src/content/index.ts` (one export line), `src/App.tsx` (Contact import and the `/contact` route element only).

**Follow-ups**
- Leader: S6–S8 also add an import below the `Layout` import in `src/App.tsx` and may append to `src/content/index.ts`. If they conflict at merge time, keep all lines.
- dev-1 (minor, seen in screenshots): at desktop the header's site name starts about 16px to the right of the page content's left edge.
## S7 — About page (2026-10-03)
**Branch:** story/S7-about-page · **Status:** done

**What I did**
- Bio: the page renders every `profile.bio` paragraph under the page's single `h1` ("About").
- Skills: one block per `skills` category (an `h3` plus a `<ul>` of `Tag` pills), 1 column on mobile and 2 on desktop, in a `tone="surface"` Section.
- Experience timeline: an `<ol>` over `experience` showing role (`h3`), company, optional location, dates and summary. Each date is a `<time dateTime="YYYY-MM">`; an open end shows "Present" with no `<time>`.
- Shared date helper for S9 at `src/content/format.ts`, exported from the `src/content` barrel: `formatYearMonth(value: YearMonth): string` ('2023-03' → 'Mar 2023'), `formatDateRange(start: YearMonth, end: YearMonth | null): string` ('Mar 2023 – Present') and `PRESENT_LABEL`.
- Wired `/about` in `src/App.tsx` to `<About />` (one import plus that route's element; `Placeholder` and the other routes are untouched).

**How I did it**
- Built from `Section` and `Tag` only. No `<main>` (Layout provides it), and only semantic theme classes. The timeline line is `border-l border-border` on the `<ol>`; the dots are decorative `aria-hidden` spans with `bg-accent`.
- Section headings and intros are in a new `src/content/about.ts` (`aboutPage`), so the page hardcodes no text.
- The date helper uses a fixed month-name array and a regex on the `YYYY-MM` string, with no `Date` object, so the output can't shift with time zone or locale. Bad input (e.g. '2020-13') comes back unchanged instead of throwing.
- The page formats start and end separately so each date can get its own `<time>` element. S9 can use `formatDateRange` when plain text is enough.
- Problem: the worktree sandbox refused compound shell commands, so I wrote files with the editor tools and ran commands one at a time.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core against `vite preview`) at 375px and 1280px, in light and dark themes: one `h1`, one `main`, no horizontal overflow, no console errors, `<time>` values correct (e.g. `2023-03=Mar 2023`). I looked at the screenshots: both themes read well.
- Ran the helper under `TZ=Pacific/Honolulu`: 'Mar 2023', 'Dec 2019', 'Mar 2023 – Present', 'Jun 2020 – Feb 2023'.

**Files**
- Added: `src/pages/About.tsx`, `src/content/format.ts`, `src/content/about.ts`.
- Changed: `src/content/index.ts` (2 export lines), `src/App.tsx` (About import plus `/about` element).

**Follow-ups**
- Leader: `src/content/index.ts` gets 2 export lines appended, and parallel stories may append there too. If they conflict on merge, keep both sides.
- dev-1 (minor): at 1280px the header brand sits about 15px to the right of page content's left edge, so header and Section don't share a left edge. Spotted in screenshots, not investigated.
## S6 — Home page (2026-10-03)
**Branch:** story/S6-home-page · **Status:** done

**What I did**
- Hero with `profile.name` (the page's only `h1`), `profile.title`, `profile.pitch` and the photo placeholder (`profile.photo` / `photoAlt`).
- Hero buttons: "View Projects" (primary, `to="/projects"`) and "Download Resume" (secondary, `href={profile.resumeUrl}` with `download`).
- "Featured Projects" Section with up to 3 `featuredProjects` as Cards in a `<ul>`/`<li>` grid, each with "Code" / "Live demo" actions when the project has `repoUrl` / `demoUrl`, plus a "See all projects" Button to `/projects`.
- Swapped the `/` route in `src/App.tsx` to `<Home />` (plus its import); other routes and `Placeholder` untouched.

**How I did it**
- New `src/content/home.ts` (`HomeContent` type in `types.ts`, exported from the barrel) holds the button labels, section heading/intro and card action labels, so the page has no hardcoded text.
- The hero is a plain `<section aria-labelledby>` rather than a `Section`, because `Section` stacks children under the heading and the hero needs text beside the photo. It uses the same `px-gutter py-section max-w-content` tokens. On mobile it stacks (photo on top, centered text); from `md` it is side by side.
- The featured Section uses the default tone (cards are `bg-surface`) and `pt-0`, since the hero already provides the bottom spacing. The grid is 1 / 2 / 3 columns (`sm`, `lg`).
- Card images get `alt=""` (decorative; the title is next to them). No placeholder project has an image yet.
- Only semantic theme classes are used.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (Playwright) against `vite preview`, light and dark at 375px and 1280px: no horizontal overflow, one `<main>`, one `h1`, photo loads, resume link has `download`, repo/demo links open in a new tab with card-specific accessible names, 3 cards, no console errors. Clicking "View Projects" navigates client-side to `/projects`. Screenshots checked visually.

**Files**
- Added: `src/pages/Home.tsx`, `src/content/home.ts`.
- Changed: `src/content/types.ts`, `src/content/index.ts`, `src/App.tsx` (`/` route + import), `docs/agent-logs/dev-2.md`.

**Follow-ups**
- Leader: `src/content/index.ts` and `types.ts` were appended to; parallel S7/S8/S10 branches may append there too, so expect trivial merge conflicts (keep both).
- S8 may want the same "Code" / "Live demo" labels; they are in `home.ts` for now and could move to a shared content file.
- The placeholder photo's "PLACEHOLDER" caption is slightly clipped by the round crop. That's fine for a placeholder; a real photo won't have it.
## S8 — Projects page (2026-10-03)
**Branch:** story/S8-projects-page · **Status:** done

**What I did**
- Projects page at `/projects`: a grid of `Card`s from `projects` showing title, description, tech tags, and repo/demo links as Card `actions` ("Code" is secondary, "Live demo" is primary; each one only appears if its URL exists).
- Tech tag filter: `TagButton`s (`aria-pressed`) over `projectTags`, in a `role="group"` labelled "Filter projects by technology". "All" resets the filter, and clicking the active tag again also resets it. Under the filter, a visible `aria-live="polite"` line reads "Showing N of 6 projects".
- Responsive `<ul>` grid: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`.

**How I did it**
- One `Section` (default tone, `headingLevel={1}`) holds the page h1, intro, filter, count and grid. The cards use `headingLevel={2}` because they sit directly under the h1.
- The filter is single-select (`useState<string | null>`). The visible list is derived on each render with no extra state.
- Page copy (title, intro, filter label, "All", action labels, result-count formatter) is a new `projectsPage` export in `src/content/projects.ts`, typed as `ProjectsPageCopy` in `types.ts` and re-exported from the barrel. The page itself has no hardcoded text.
- The optional `project.image` is passed to Card with `alt=""` because the card title already names it. No placeholder project has an image yet.
- `App.tsx`: added the `Projects` import and changed only the `/projects` route element.

**Verification**
- `npm run build` and `npm run lint` pass.
- Ran headless Chromium (playwright-core in the scratchpad) against `vite preview`, light and dark, at 375px and 1280px: one `<main>`, one h1, no horizontal overflow, 1 column at 375px and 3 at 1280px, no console errors. Screenshots looked right in both themes.
- Clicked filters: Python showed Gamma and Delta ("Showing 2 of 6 projects"). Docker showed Gamma and Zeta. Clicking Docker again reset to All (6). React showed Alpha and Epsilon. All reset to 6. Exactly one button had `aria-pressed="true"` each time. Action links have the right href, `target="_blank"` and `rel="noopener noreferrer"`, with accessible names like "Code: Project Alpha (opens in a new tab)".

**Files**
- Added: `src/pages/Projects.tsx`
- Changed: `src/App.tsx` (import + `/projects` route), `src/content/projects.ts`, `src/content/types.ts`, `src/content/index.ts`

**Follow-ups**
- Leader: the parallel S6/S7/S10 branches will probably also add an import line under the `Layout` import in `App.tsx`, and may also edit `src/content/index.ts`/`types.ts`. Those merge conflicts are trivial: keep all lines.

## S9 — Resume page (2026-10-03)
**Branch:** story/S9-resume-page · **Status:** done

**What I did**
- Resume page at `/resume`. It shows experience from `experience` (role, company, location, dates, summary, and `highlights` as a bullet list when present) and education from `education` (degree, institution, dates, details).
- Download button: `Button href={profile.resumeUrl} download` ("Download PDF"), placed under the h1 and intro.
- `App.tsx`: the `/resume` route now renders `Resume`. I deleted the `Placeholder` component and its comment because nothing uses it anymore.

**How I did it**
- Three `Section`s: h1 "Resume" with the intro and download button, then "Experience" and "Education" (h2). Each entry is a `Card` (h3 = role/degree). The company or institution, the dates, the summary and the highlights go in the Card's `description` node, all inside an `<ol>`.
- Dates reuse `formatYearMonth` and `PRESENT_LABEL` from `src/content`, rendered as `<time dateTime>` the same way the About page does it. A small local `DateRange` component renders them, so the markup isn't repeated for experience and education. It adds no new formatting logic. I didn't use `formatDateRange`, because it returns a single string and then the dates can't be wrapped in `<time>`.
- Page copy (title, intro, download label, section titles/intros, highlights list label) lives in the new `src/content/resume.ts` (`resumePage`, typed by `ResumePageContent`, same pattern as `contact.ts`). It is exported from the content barrel.
- Problem: I first put Experience in a `tone="surface"` band with `className="bg-bg"` on the Cards, but the screenshots showed the cards the same colour as the band. Card's built-in `bg-surface` wins over the `bg-bg` override because of CSS order. I dropped the surface band instead. All sections use the default tone with `pt-0` on the later two (same trick as Home), so the cards stand out on `bg`.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core in the scratchpad) against `vite preview`, light and dark, 375px and 1280px: one `<main>`, one h1, h2s Experience/Education, 4 h3s, no horizontal overflow, no console errors, 7 `<time>` elements with correct `datetime` values, 3 highlight items. The download link has `href="/resume.pdf"`, a `download` attribute and no `target`. Clicking it triggers a download named `resume.pdf`. `GET /resume.pdf` returns 200 `application/pdf` with a `%PDF-` header. I checked the screenshots in both themes at both widths.

**Files**
- Added: `src/pages/Resume.tsx`, `src/content/resume.ts`
- Changed: `src/content/index.ts`, `src/App.tsx` (import + `/resume` route, `Placeholder` removed), `docs/agent-logs/dev-2.md`

**Follow-ups**
- dev-1: `Card`'s `className` can't override its background (`bg-surface` wins over e.g. `bg-bg`), so cards can't sit on a `tone="surface"` Section. About's `<Tag className="bg-bg">` may hit the same conflict. A `tone`/`variant` prop or class merging in Card/Tag would fix it.

## S15 — Consistent page copy in content (2026-10-04)
**Branch:** story/S15-page-copy · **Status:** done

**What I did**
- One pattern for page copy, used by all five pages. Each page has its own file in `src/content/pages/` (`home.ts`, `about.ts`, `projects.ts`, `resume.ts`, `contact.ts`). Each file exports `<page>Page`, typed by `<Page>PageCopy`.
- Shared labels are defined once in `src/content/labels.ts` as `sharedLabels`: `projectRepo` ("Code"), `projectDemo` ("Live demo") and `present` ("Present", which replaces `PRESENT_LABEL`). Home and Projects both take card action labels from there.
- No visible text changes: rendered text and accessible names are byte-identical before and after (see Verification).

**How I did it**
- **The pattern (follow it for new pages):**
  - `src/content/pages/<page>.ts` declares `export interface <Page>PageCopy` and `export const <page>Page: <Page>PageCopy` in the same file, so the shape and the text are edited together. `pages/index.ts` re-exports them and its doc comment repeats these rules. The `src/content` barrel does `export * from './pages'`.
  - Field names: `title` is the page's h1, `intro` is the text under it, `<section>Title`/`<section>Intro` are for h2 sections, and `<thing>Label` is for button, link and accessible-name text.
  - Data (profile, projects, experience, education, skills) stays in its own files with types in `types.ts`. Page copy holds only UI text. A label used on more than one page goes in `labels.ts`.
  - S11 meta: each page adds a `meta: { title: string; description: string }` field to its own `<Page>PageCopy`, or a shared `PageMeta` type in `labels.ts`/`types.ts`. Every page, including Home (whose h1 is `profile.name`), already has its own copy object to hold it.
- Renames to fit the pattern: `home` → `homePage` (`featuredHeading` → `featuredTitle`, `HomeContent` → `HomePageCopy`); `contactPage.heading` → `title`; `emailButton`/`githubButton`/`linkedinButton` → `...ButtonLabel`; `ContactPageContent`/`ResumePageContent` → `...PageCopy`; `aboutPage` now has an `AboutPageCopy` type. `projectsPage` moved out of `projects.ts` (data only now), and `ProjectsPageCopy`/`HomeContent` moved out of `types.ts`.
- I found Contact's hardcoded `aria-label="Contact links"` and moved it to `contactPage.linksLabel`.
- `format.ts` now reads `sharedLabels.present`, so "Present" lives in one place. `PRESENT_LABEL` is removed. About and Resume use `sharedLabels.present`.
- Home and Projects each still have their own small `projectActions` helper. They really differ: Projects makes the demo button primary. Only the labels are shared.

**Verification**
- `npm run build` and `npm run lint` pass.
- Before/after render diff: playwright-core (scratchpad) against `vite preview` dumped `document.title`, `body.innerText` and every `aria-label`/`alt`/`title` attribute for `/`, `/about`, `/projects`, `/projects` with the "Go" filter active, `/resume` and `/contact`, at 1280px and 375px. I ran it on `leader` (63c1571) and on this branch. `diff` shows no differences at either width. There is no horizontal overflow at either width.

**Files**
- Added: `src/content/labels.ts`, `src/content/pages/index.ts`, `src/content/pages/projects.ts`
- Moved and changed: `src/content/{home,about,contact,resume}.ts` → `src/content/pages/`
- Changed: `src/content/index.ts`, `src/content/types.ts`, `src/content/projects.ts`, `src/content/format.ts`, `src/pages/{Home,About,Projects,Resume,Contact}.tsx`, `docs/agent-logs/dev-2.md`

**Follow-ups**
- Leader/dev-1 (S11): add `meta` per page as described above. Content exports renamed: `home` → `homePage`, `PRESENT_LABEL` → `sharedLabels.present`, `ContactPageContent`/`ResumePageContent` → `...PageCopy`. Nothing in `src/components/` used them (only `profile`), so dev-1's S13 isn't affected.
