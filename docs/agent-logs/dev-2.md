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
