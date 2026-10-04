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
