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
