# Backlog

Status: `todo` · `in progress` · `review` · `done` · `blocked`

> **Handoff (2026-10-04):** S1–S10 are done, merged into `leader` and pushed. All story branches and worktrees are cleaned up; only `leader` and `main` exist. Next up: S11 (dev-1), the follow-ups S13–S15, then a `leader → main` PR for Chris to review, then S12 (deploy). S13 and S14 touch the same `ui/` and `layout/` files as S11 parts, so run S11, S13 and S14 as one dev-1 batch or one after another; S15 (dev-2) can run in parallel.

## Sprint 1

| ID  | Story                          | Owner  | Depends on | Status |
|-----|--------------------------------|--------|------------|--------|
| S1  | Project scaffold               | dev-1  | —          | done   |
| S2  | Theme & dark mode              | dev-1  | S1         | done   |
| S3  | Site layout (header/footer)    | dev-1  | S1         | done   |
| S4  | Core UI components             | dev-1  | S2         | done   |
| S5  | Content model & placeholders   | dev-2  | S1         | done   |
| S6  | Home page                      | dev-2  | S3, S4, S5 | done   |
| S7  | About page                     | dev-2  | S3, S4, S5 | done   |
| S8  | Projects page                  | dev-2  | S3, S4, S5 | done   |
| S9  | Resume page                    | dev-2  | S3, S4, S5 | done   |
| S10 | Contact page                   | dev-2  | S3, S4, S5 | done   |
| S11 | 404 page & SEO metadata        | dev-1  | S3         | todo   |
| S12 | Deploy to Vercel               | leader | all        | todo   |
| S13 | Align header with page content | dev-1  | S3         | done   |
| S14 | Card & Tag background tones    | dev-1  | S4         | in progress |
| S15 | Consistent page copy in content| dev-2  | S6–S10     | in progress |
| S16 | Home hero uses shared Container| dev-2  | S13, S15   | todo   |

**Parallelism:** S1 blocks everyone. Then dev-1 runs S2 → S3 → S4 while dev-2 does S5. Pages (S6–S10) start once S3 and S4 are merged.

---

### S1 — Project scaffold
*As a developer, I want a working project skeleton so the team can build features on a shared foundation.*
- [x] Vite + React + TypeScript app at repo root
- [x] Tailwind CSS configured and working
- [x] React Router with placeholder routes: `/`, `/about`, `/projects`, `/resume`, `/contact`
- [x] ESLint configured; `npm run build` and `npm run lint` pass
- [x] Folder structure matches `CLAUDE.md`
- [x] `vercel.json` rewrites all paths to `index.html` (so deep links work)

### S2 — Theme & dark mode
*As a visitor, I want a clean, consistent look that respects my light/dark preference.*
- [x] Color, font, and spacing tokens defined in one place
- [x] Defaults to the OS color scheme; a toggle overrides it and is remembered
- [x] Text meets WCAG AA contrast in both themes

### S3 — Site layout
*As a visitor, I want consistent navigation on every page so I can find what I'm looking for.*
- [x] Header with name/logo and links to all pages; current page is highlighted
- [x] Collapses to a hamburger menu under 768px, keyboard accessible
- [x] Footer with placeholder social links (GitHub, LinkedIn, email) and copyright year
- [x] Layout shell wraps every route

### S4 — Core UI components
*As a developer, I want reusable components so pages look consistent and aren't duplicated.*
- [x] `Button` (primary/secondary; renders as link or button)
- [x] `Card` (title, description, optional image, optional tags, optional link)
- [x] `Section` (heading + content wrapper with consistent spacing)
- [x] `Tag` (small label/pill)
- [x] All typed with exported prop types; usable in both themes

### S5 — Content model & placeholders
*As Chris, I want all site content in one place so I can swap placeholders for real info without touching page code.*
- [x] Typed data files in `src/content/`: profile (name, title, bio, links), projects, experience, skills
- [x] Clearly fake placeholder values (e.g. "Project Alpha", "Jane Doe Corp")
- [x] Placeholder resume PDF at `public/resume.pdf`

### S6 — Home page
*As a recruiter, I want to know who Chris is and what Chris does within a few seconds of landing.*
- [x] Hero with name, title, one-line pitch, and photo placeholder
- [x] Buttons: "View Projects" and "Download Resume"
- [x] Preview of up to 3 featured projects linking to `/projects`

### S7 — About page
*As a hiring manager, I want to learn about Chris's background and skills.*
- [x] Bio paragraphs from content
- [x] Skills grouped by category, rendered as tags
- [x] Experience timeline (role, company, dates, summary)

### S8 — Projects page
*As a visitor, I want to browse Chris's work and filter it by technology.*
- [x] Grid of project cards (title, description, tech tags, links to repo/demo)
- [x] Filter by tech tag; "All" resets it
- [x] Responsive: 1 column mobile, 2–3 on desktop

### S9 — Resume page
*As a recruiter, I want to view and download Chris's resume.*
- [x] Summary of experience and education on the page
- [x] Download button for `/resume.pdf`

### S10 — Contact page
*As a visitor, I want an easy way to reach Chris.*
- [x] Email (`mailto:`) link plus GitHub and LinkedIn links from content
- [x] Short call-to-action text
- [x] No form yet (no backend)

### S11 — 404 & SEO
*As a visitor who follows a bad link, I want a helpful page; as Chris, I want the site to look good when shared.*
- [ ] Catch-all route renders a 404 page linking home
- [ ] Per-page `<title>` and meta description
- [ ] Favicon and Open Graph tags (placeholder image)

### S12 — Deploy to Vercel
*As Chris, I want the site live at a public URL.*
- [ ] Repo pushed to GitHub, connected to Vercel
- [ ] Production build deploys from `main`; deep links work
- [ ] Chris has the live URL

### S13 — Align header with page content
*As a visitor, I want the header and page content to line up so the site looks polished.*
Found in S7/S10 review: at desktop widths the header's site name starts ~16px right of the page content's left edge. Header puts `px-gutter` inside its `max-w-content` box; `Section` puts `px-gutter` outside it.
- [x] Header, footer and `Section` content share the same left and right edges at 375px, 768px and 1280px
- [x] One consistent container pattern used by layout and `Section`

### S14 — Card & Tag background tones
*As a developer, I want cards and tags to stand out on any section background.*
Found in S9 review: `className="bg-bg"` can't override `Card`'s built-in `bg-surface` (CSS order), so cards disappear into `tone="surface"` Sections. About's `<Tag className="bg-bg">` may have the same problem.
- [ ] `Card` and `Tag` accept a tone/variant prop (e.g. `tone="bg" | "surface"`) or merge classes so overrides win
- [ ] Cards and tags are visibly distinct inside a `tone="surface"` Section in both themes
- [ ] About page skill tags checked; report any page changes needed to dev-2

### S15 — Consistent page copy in content
*As Chris, I want every page's text stored the same way so replacing placeholders is predictable.*
Found in S6–S10 review: page copy lives in different shapes (`home` typed in `types.ts`, `projectsPage` in `projects.ts`, `aboutPage` untyped, `contactPage`/`resumePage` with types in their own files), and "Code"/"Live demo" labels are defined twice.
- [ ] One pattern for page copy (file per page, typed, consistent naming), applied to all five pages
- [ ] Shared labels (e.g. project "Code" / "Live demo") defined once
- [ ] No visible text changes; build and lint pass

### S16 — Home hero uses shared Container
*As a developer, I want every page to use the same container so alignment can't drift again.*
Found in S13 review: the Home hero builds its own container (`px-gutter` on the `<section>`, `mx-auto max-w-content` inside) instead of using `Container` from `components/ui`.
- [ ] Home hero uses `<Container>`; no page uses its own `px-gutter` / `max-w-content` classes
- [ ] Hero edges still match header and sections at 375px, 768px and 1280px
