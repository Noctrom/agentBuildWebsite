# Backlog

Status: `todo` · `in progress` · `review` · `done` · `blocked`

## Sprint 1

| ID  | Story                          | Owner  | Depends on | Status |
|-----|--------------------------------|--------|------------|--------|
| S1  | Project scaffold               | dev-1  | —          | done   |
| S2  | Theme & dark mode              | dev-1  | S1         | in progress |
| S3  | Site layout (header/footer)    | dev-1  | S1         | todo   |
| S4  | Core UI components             | dev-1  | S2         | todo   |
| S5  | Content model & placeholders   | dev-2  | S1         | in progress |
| S6  | Home page                      | dev-2  | S3, S4, S5 | todo   |
| S7  | About page                     | dev-2  | S3, S4, S5 | todo   |
| S8  | Projects page                  | dev-2  | S3, S4, S5 | todo   |
| S9  | Resume page                    | dev-2  | S3, S4, S5 | todo   |
| S10 | Contact page                   | dev-2  | S3, S4, S5 | todo   |
| S11 | 404 page & SEO metadata        | dev-1  | S3         | todo   |
| S12 | Deploy to Vercel               | leader | all        | todo   |

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
- [ ] Color, font, and spacing tokens defined in one place
- [ ] Defaults to the OS color scheme; a toggle overrides it and is remembered
- [ ] Text meets WCAG AA contrast in both themes

### S3 — Site layout
*As a visitor, I want consistent navigation on every page so I can find what I'm looking for.*
- [ ] Header with name/logo and links to all pages; current page is highlighted
- [ ] Collapses to a hamburger menu under 768px, keyboard accessible
- [ ] Footer with placeholder social links (GitHub, LinkedIn, email) and copyright year
- [ ] Layout shell wraps every route

### S4 — Core UI components
*As a developer, I want reusable components so pages look consistent and aren't duplicated.*
- [ ] `Button` (primary/secondary; renders as link or button)
- [ ] `Card` (title, description, optional image, optional tags, optional link)
- [ ] `Section` (heading + content wrapper with consistent spacing)
- [ ] `Tag` (small label/pill)
- [ ] All typed with exported prop types; usable in both themes

### S5 — Content model & placeholders
*As Chris, I want all site content in one place so I can swap placeholders for real info without touching page code.*
- [ ] Typed data files in `src/content/`: profile (name, title, bio, links), projects, experience, skills
- [ ] Clearly fake placeholder values (e.g. "Project Alpha", "Jane Doe Corp")
- [ ] Placeholder resume PDF at `public/resume.pdf`

### S6 — Home page
*As a recruiter, I want to know who Chris is and what Chris does within a few seconds of landing.*
- [ ] Hero with name, title, one-line pitch, and photo placeholder
- [ ] Buttons: "View Projects" and "Download Resume"
- [ ] Preview of up to 3 featured projects linking to `/projects`

### S7 — About page
*As a hiring manager, I want to learn about Chris's background and skills.*
- [ ] Bio paragraphs from content
- [ ] Skills grouped by category, rendered as tags
- [ ] Experience timeline (role, company, dates, summary)

### S8 — Projects page
*As a visitor, I want to browse Chris's work and filter it by technology.*
- [ ] Grid of project cards (title, description, tech tags, links to repo/demo)
- [ ] Filter by tech tag; "All" resets it
- [ ] Responsive: 1 column mobile, 2–3 on desktop

### S9 — Resume page
*As a recruiter, I want to view and download Chris's resume.*
- [ ] Summary of experience and education on the page
- [ ] Download button for `/resume.pdf`

### S10 — Contact page
*As a visitor, I want an easy way to reach Chris.*
- [ ] Email (`mailto:`) link plus GitHub and LinkedIn links from content
- [ ] Short call-to-action text
- [ ] No form yet (no backend)

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
