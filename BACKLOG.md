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
| S11 | SEO metadata foundation        | dev-1  | S3         | done   |
| S12 | Deploy to Vercel               | leader | all        | todo   |
| S13 | Align header with page content | dev-1  | S3         | done   |
| S14 | Card & Tag background tones    | dev-1  | S4         | done   |
| S15 | Consistent page copy in content| dev-2  | S6–S10     | done   |
| S16 | Home hero uses shared Container| dev-2  | S13, S15   | done   |
| S17 | Live reload on WSL             | dev-1  | S1         | done   |
| S18 | About skill tags use tone prop| dev-2  | S14        | done   |
| S19 | 404 page & per-page metadata   | dev-2  | S11, S18   | done   |
| S20 | Workflow diagrams              | dev-1  | S4         | done   |
| S21 | Behind the Scenes page         | dev-2  | S15, S19, S20 | done   |
| S22 | Behind the Scenes nav link     | dev-1  | S21, S23   | in progress |
| S23 | Space palette, always dark     | dev-1  | PR #2      | done   |
| S24 | Animated space background      | dev-1  | S23        | in progress |
| S25 | Space-styled components        | dev-1  | S23, S24   | todo   |
| S26 | Scenes: solar system, black hole | dev-2 | S21, S24  | todo   |
| S27 | Remaining page scenes          | dev-2  | S26        | todo   |
| S28 | Pages fitted to space theme    | dev-2  | S25, S26   | todo   |

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

### S11 — SEO metadata foundation
*As Chris, I want the site to look good in search results and when shared.*
Split on 2026-10-04: the 404 page, page copy and `public/` assets belong to dev-2, so those moved to S19. This story builds the mechanism.
- [x] `PageMeta` component in `ui/` (props: `title`, `description`) that sets the document `<title>` (format e.g. "About · Chris") and `<meta name="description">`, using React 19's built-in `<title>`/`<meta>` rendering; no extra dependency
- [x] `index.html` has site-wide defaults: `<title>`, meta description, Open Graph (`og:title`, `og:description`, `og:type`, `og:image` → `/og-image.png`) and `twitter:card`, all clearly placeholder. Note: crawlers read these without running JS, so OG tags stay site-wide (no per-page OG in an SPA)
- [x] Favicon link checked and working
- [x] Usage documented in the component's doc comment so dev-2 can wire pages in S19

### S12 — Deploy to Vercel
*As Chris, I want the site live at a public URL.*
- [ ] Repo pushed to GitHub, connected to Vercel
- [ ] Production build deploys from `main`; deep links work
- [ ] Chris has the live URL

Notes from S11: change `og:image` in index.html to an absolute URL once the Vercel domain is known (and consider `og:url`); make sure `public/og-image.png` exists first, or the SPA rewrite serves index.html in its place.
Note from S19: Vercel's SPA rewrite serves unknown URLs with HTTP 200 (soft 404). If search indexing of the 404 page matters, add a `noindex` option to `PageMeta` (dev-1) and use it on NotFound (dev-2).
### S13 — Align header with page content
*As a visitor, I want the header and page content to line up so the site looks polished.*
Found in S7/S10 review: at desktop widths the header's site name starts ~16px right of the page content's left edge. Header puts `px-gutter` inside its `max-w-content` box; `Section` puts `px-gutter` outside it.
- [x] Header, footer and `Section` content share the same left and right edges at 375px, 768px and 1280px
- [x] One consistent container pattern used by layout and `Section`

### S14 — Card & Tag background tones
*As a developer, I want cards and tags to stand out on any section background.*
Found in S9 review: `className="bg-bg"` can't override `Card`'s built-in `bg-surface` (CSS order), so cards disappear into `tone="surface"` Sections. About's `<Tag className="bg-bg">` may have the same problem.
- [x] `Card` and `Tag` accept a tone/variant prop (e.g. `tone="bg" | "surface"`) or merge classes so overrides win
- [x] Cards and tags are visibly distinct inside a `tone="surface"` Section in both themes
- [x] About page skill tags checked; report any page changes needed to dev-2

### S15 — Consistent page copy in content
*As Chris, I want every page's text stored the same way so replacing placeholders is predictable.*
Found in S6–S10 review: page copy lives in different shapes (`home` typed in `types.ts`, `projectsPage` in `projects.ts`, `aboutPage` untyped, `contactPage`/`resumePage` with types in their own files), and "Code"/"Live demo" labels are defined twice.
- [x] One pattern for page copy (file per page, typed, consistent naming), applied to all five pages
- [x] Shared labels (e.g. project "Code" / "Live demo") defined once
- [x] No visible text changes; build and lint pass

### S16 — Home hero uses shared Container
*As a developer, I want every page to use the same container so alignment can't drift again.*
Found in S13 review: the Home hero builds its own container (`px-gutter` on the `<section>`, `mx-auto max-w-content` inside) instead of using `Container` from `components/ui`.
- [x] Home hero uses `<Container>`; no page uses its own `px-gutter` / `max-w-content` classes
- [x] Hero edges still match header and sections at 375px, 768px and 1280px

### S17 — Live reload on WSL
*As Chris, I want the dev server to update the page when files change so I can watch the site as it's built.*
Found 2026-10-04: the repo lives on the Windows drive (`/mnt/c`) and is run from WSL, which doesn't pass file-change events to Vite, so `npm run dev` never live-reloads. Running with `CHOKIDAR_USEPOLLING=true` works as a stopgap.
- [x] Plain `npm run dev` picks up edits to `src/` files (component, content and CSS changes) without a manual refresh, with no env vars needed
- [x] Polling is set in `vite.config.ts` (`server.watch`) with a short comment explaining why
- [x] Polling interval keeps the dev server responsive (no noticeable CPU spin when idle)
- [x] `npm run build` and `npm run lint` pass

### S18 — About skill tags use tone prop
*As a visitor, I want the About page skill tags to be visible against their section.*
Found in S14 review: About's skill tags sit in a `tone="surface"` Section and pass `className="bg-bg"`, which can't override `Tag`'s built-in background, so they blend into the band in both themes.
- [x] `src/pages/About.tsx`: `<Tag className="bg-bg">` → `<Tag tone="bg">`; no page passes `bg-*` classes to `Card` or `Tag`
- [x] Skill tags are visibly distinct from the band in light and dark themes

### S19 — 404 page & per-page metadata
*As a visitor who follows a bad link, I want a helpful page; as Chris, I want each page to have its own title and description.*
Split from S11. Uses dev-1's `PageMeta` from S11.
- [x] Catch-all route (`path="*"`) inside the Layout renders a `NotFound` page with copy from `src/content/pages/notFound.ts` and a button home
- [x] Each page copy file gets `meta: { title, description }` (placeholder text) and every page, including 404, renders `PageMeta` with it
- [x] Placeholder Open Graph image at `public/og-image.png` (1200×630, clearly placeholder)
- [x] Browser tab shows the right title on each route, and on an unknown URL

### S20 — Workflow diagrams
Triaged from story inbox D1 (story-writer, 2026-10-04).

*As a visitor to the Behind the Scenes page, I want diagrams of how the agent team and the git workflow run so that I can understand the process at a glance instead of reading walls of text.*

Chris wants the Behind the Scenes page (D2) to show visually how this site is built. Two diagrams, built as reusable components that D2 places on the page. All labels come in as props (text lives in `src/content/`, per `CLAUDE.md`).

**Diagram A, story flow:** how one piece of work moves through the team.
Chris → story-writer (interview, drafts stories) → story inbox → leader (triage, assigns) → dev-1 / dev-2 (build on a story branch) → leader review (build + lint, approve or send back) → `leader` branch → pull request → Chris reviews & merges → `main` → Vercel deploy.
The "send back for fixes" loop between leader review and the dev must be visible.

**Diagram B, git branches:** `main` ← `leader` ← `story/<id>-<slug>` branches, showing that devs only commit to story branches, only the leader merges into `leader`, and only Chris merges into `main` (via PR).

- [x] Both diagrams render as components in `src/components/ui/` (exported from the barrel) with typed props for every label; no label text hardcoded in the components
- [x] Diagram A shows every step above in order, including the review → fix loop
- [x] Diagram B shows the three branch levels and who may change each one
- [x] Readable at 375px (diagram reflows vertically, no horizontal page scroll) and at desktop widths
- [x] Legible in light and dark themes, using the existing theme tokens; text meets WCAG AA contrast
- [x] Accessible: each diagram has a text alternative (e.g. `aria-label`/`<title>` or a visually hidden ordered list of the steps)
- [x] No new heavy dependencies (inline SVG or HTML/CSS is fine); `npm run build` and `npm run lint` pass

**Open questions:** None.

### S21 — Behind the Scenes page
Triaged from story inbox D2 (story-writer, 2026-10-04).

*As a hiring manager, I want to see how Chris built this site with a team of AI agents so that I can judge how Chris works with agents in a professional way.*

Chris wants a dedicated tab explaining how the site was created: the methodology, setup, how it works, and why it's built this way. The site has two goals at once: a personal website, and a demonstration of using agents professionally. The repo (`https://github.com/Noctrom/agentBuildWebsite`) is private now; Chris will make it public before launch. The repo holds the backlog, agent definitions and story logs for anyone who wants proof, so the page links to the repo rather than to individual files.

- [x] New page "Behind the Scenes" at `/behind-the-scenes` (route added in `App.tsx`), with its own `PageMeta` (S11/S19 pattern). The nav link is S22 (dev-1), because `navItems` is in `layout/`
- [x] Page text is the draft copy below, stored in `src/content/` following the S15 page-copy pattern; no text hardcoded in the page
- [x] Diagram A (story flow) appears in "How work flows" and Diagram B (git branches) in "Branches and reviews"
- [x] A "View the source on GitHub" button links to the repo URL, opening in a new tab; the URL is defined once in content
- [x] Works at 375px and desktop widths; `npm run build` and `npm run lint` pass

**Draft copy** (Chris will edit later; use as-is for now):

> **Heading:** Behind the Scenes
> **Intro:** This site has two jobs. It's my personal website, and it's a working example of how I build software with a team of AI agents. Everything here, from the first scaffold to this page, was planned, built and reviewed through the process below.
>
> **Why build it this way**
> AI coding agents are fast, but speed without structure produces messy code and surprises. I wanted to show that agents can work the way a good engineering team does: clear requirements, owned areas of the codebase, small reviewable changes, and a human who signs off on what ships. This site is small enough to follow end to end and real enough to prove the point.
>
> **The team**
> - **Me:** product owner and final reviewer. I decide what gets built and I approve every change that reaches production.
> - **Story writer:** talks with me about what I want and turns it into user stories with clear, testable acceptance criteria.
> - **Leader:** plans the backlog, assigns stories, reviews every change, merges approved work and reports progress back to me. It doesn't write feature code.
> - **dev-1:** owns the foundation and design system: layout, theme, and reusable components.
> - **dev-2:** owns the pages and content.
>
> Each agent has a written role definition, owned folders it stays inside, and rules it follows. If a dev needs a change in someone else's area, it reports back instead of making it.
>
> **How work flows**
> Every change starts as a user story ("As a visitor, I want…") with acceptance criteria. The leader assigns it to one developer, who builds it on its own branch in an isolated copy of the repo, checks that the build and linter pass, and writes a log entry explaining what it did and why. The leader reviews the work against the criteria and either sends it back with requested changes or merges it.
> *[Diagram A]*
>
> **Branches and reviews**
> No agent can push to production. Developers commit only to their story branch. Only the leader merges into the integration branch. Changes reach `main`, and the live site, only through a pull request that I review and merge myself.
> *[Diagram B]*
>
> **The stack**
> React and TypeScript, built with Vite, styled with Tailwind CSS, routed with React Router, and deployed as a static site on Vercel. The agents run in Claude Code.
>
> **How the site works**
> All text and data, including this page, lives in typed content files, separate from the page code. Pages are assembled from a small set of shared components (buttons, cards, sections, tags), so the design stays consistent and updating content never means touching layout code.
>
> **See for yourself**
> The full repository is public: the backlog, every agent's role definition, their story logs, and the commit history showing each story from branch to merge.
> *[Button: View the source on GitHub]*

**Open questions:** None. Chris confirmed: the repo link appears only on this page (not in the footer or elsewhere); naming Claude Code is fine; the "repository is public" line stays because Chris will make the repo public before launch.

### S22 — Behind the Scenes nav link
*As a visitor, I want to find the Behind the Scenes page from the main navigation.*
Split from inbox D2: `navItems` lives in `src/components/layout/` (dev-1). Runs after S21 so the link never points at a missing page.
- [ ] "Behind the Scenes" entry links to `/behind-the-scenes` in the desktop nav and mobile menu, with the active-page highlight working
- [ ] Header still fits without overflow at 375px, 768px and 1280px (check the breakpoint where the menu collapses; adjust it if the extra item crowds the bar)

## Sprint 2 — Space theme

Order: dev-1 S23 → S22 → S24 → S25; dev-2 S21, then S26 → S27 once S24 is merged (in parallel with S25), then S28 once S25 and S26 are in. PR #2 (S2–S20) merged by Chris on 2026-10-05.

### S23 — Space palette & typography (always dark)
Triaged from story inbox D3 (story-writer, 2026-10-04). Sequencing: built on a branch now; merged only after PR #2 lands. Removes the header toggle, so S22 (nav link) runs after it.

*As a visitor, I want the whole site to look like deep space so that it feels distinctive and memorable.*

Chris chose a space theme for the whole site (galaxies, black holes, nebulas, planets, suns, solar systems) and decided the site is **always dark**: the light theme and the theme toggle from S2 go away. This story sets the foundation; S25 restyles components, S24/S26/S27 add the animated backgrounds. Existing pages, including the S21 Behind the Scenes page and S20 diagrams, should pick up the new look through the tokens without page changes.

- [x] Light theme removed: no light tokens, no `ThemeToggle`/`useTheme`, no theme script in `index.html`, no toggle in the header; `color-scheme: dark`
- [x] New space palette in the tokens: near-black space background, translucent "glass" surface, starlight text, plus nebula accent (violet/blue range) and a warm sun accent (orange/gold range) for highlights
- [x] All text/background pairs meet WCAG AA, measured against the solid background and the translucent surface; contrast notes in `index.css` updated
- [x] Typography: keep the current font exactly as it is (Chris confirmed 2026-10-04: no new typeface, no separate display font) for headings and body; the space feel comes from color, spacing and the background, not the typeface
- [x] Browser UI matches (e.g. `theme-color` meta is dark)
- [x] Every existing page still renders correctly at 375px and desktop; `npm run build` and `npm run lint` pass

**Open questions:** None.

### S24 — Animated space background
Triaged from story inbox D5 (story-writer, 2026-10-04). Ownership: this story creates `src/scenes/` (scene files + route → scene map). From S26 on, dev-2 owns the scene files and the route map; dev-1 owns the engine and the `Layout` wiring. The scene interface is the contract between them.

*As a visitor, I want a living space background behind the site so that it feels immersive without getting in the way of the content.*

Chris chose **subtle motion** (not a full 3D scene), **drawn in code** (not image files), using real space imagery (e.g. NASA, Hubble, JWST) as visual reference for colors and shapes. This story builds the shared background layer and the base starfield/nebula used on every page; S26 and S27 add a different scene per page on top of it.

- [ ] A background component fixed behind all content on every route, wired into `Layout`, rendering the scene for the current route (this story ships a default scene used everywhere)
- [ ] Scenes are self-contained files in their own folder (e.g. `src/scenes/`) with a documented, typed scene interface and a route → scene map in that folder, so another dev can add or change scenes without touching the engine, `Layout` or `ui/` (this is what lets S26/S27 go to dev-2)
- [ ] Default scene: layered starfield with gentle twinkling, slowly drifting nebula clouds, and a slight parallax between layers on scroll
- [ ] Drawn in code (canvas/WebGL/SVG/CSS); no large image assets; no heavy 3D libraries without leader approval
- [ ] Stays dim behind content so text over it meets WCAG AA at every frame
- [ ] "Reduce motion" on: shows a still frame, no animation
- [ ] Pauses when the tab is hidden; smooth on a mid-range phone and laptop (no visible jank while scrolling); doesn't delay the page content appearing
- [ ] If the animation can't run, a static space gradient shows instead and the site still works
- [ ] Works at 375px and desktop; `npm run build` and `npm run lint` pass

**Open questions:** None.

### S25 — Space-styled components & layout
Triaged from story inbox D4 (story-writer, 2026-10-04). Runs after S24 (both touch `layout/`), alongside dev-2's S26/S27.

*As a visitor, I want the buttons, cards and navigation to feel like part of the space scene so that the site looks designed as one piece, not a template on a dark background.*

Chris wants the rest of the design to match the background. Content sits on frosted, see-through panels so the background shows through but text stays readable.

- [ ] Header and footer are translucent over the background and stay readable while it moves behind them
- [ ] `Card`, `Section` (tones from S14), `Tag` and `Button` use frosted glass panels (translucent fill + blur + faint border); the existing tone variants remain visibly distinct from each other
- [ ] Hover/focus states use a subtle glow in the accent colors; keyboard focus is clearly visible
- [ ] Optional small space details (e.g. orbit-line or star accents on hover/dividers), kept subtle
- [ ] All motion here is disabled when the OS "reduce motion" setting is on
- [ ] Works at 375px and desktop; text meets WCAG AA over the panels; `npm run build` and `npm run lint` pass

**Open questions:** None.

### S26 — Showpiece scenes: solar system & black hole
Triaged from story inbox D6 (story-writer, 2026-10-04). dev-2 works only in `src/scenes/` (scene files + route map), per the S24 ownership note. Needs S21 merged for the Behind the Scenes route.

*As a visitor, I want each page to show a different part of space so that moving around the site feels like travelling.*

Chris wants a different scene per page. These two are the most prominent, so they come first. dev-2 only adds scene files and route mappings in `src/scenes/`.

- [ ] **Home — solar system:** a sun with planets moving slowly on visible orbits, placed so it frames the hero rather than sitting behind its text
- [ ] **Behind the Scenes — black hole:** a black hole with a glowing accretion disk and faint light-bending around it, kept dim behind the page text and diagrams
- [ ] Each page shows its scene when visited (including on direct links and refresh); moving between pages changes the scene smoothly (crossfade, skipped with reduce motion)
- [ ] Same rules as S24: subtle motion, reduce motion = still frame, readable content, smooth on mid-range devices, 375px and desktop
- [ ] `npm run build` and `npm run lint` pass

**Open questions:** None.

### S27 — Remaining page scenes
Triaged from story inbox D7 (story-writer, 2026-10-04). dev-2 works only in `src/scenes/`, per the S24 ownership note.

*As a visitor, I want every page to have its own corner of space so that the theme feels complete.*

dev-2 works only in `src/scenes/`.

- [ ] **About — a sun:** close view of a star with slow surface shimmer and soft flares (warm accent)
- [ ] **Projects — planets:** a few distinct planets (e.g. ringed, gas giant, rocky) drifting at different depths
- [ ] **Resume — nebula:** a richer, more colorful nebula than the default
- [ ] **Contact — distant galaxy:** a quiet starfield with a slowly rotating spiral galaxy
- [ ] **404 — lost in space:** an empty, sparse starfield (or drifting debris)
- [ ] Same rules as S24/S26; `npm run build` and `npm run lint` pass

**Open questions:** None.

### S28 — Pages fitted to the space theme
Triaged from story inbox D8 (story-writer, 2026-10-04). Page and content files only; needs S25 (D4 components) and S26 (D6 scenes) merged.

*As a visitor, I want every page laid out to work with its space scene so that content and background feel composed together.*

After the new components (S25) and showpiece scenes (S26) land, each page needs a pass so content and scene don't fight. Page and content files only.

- [ ] Home hero leaves room for the solar system scene so the sun/planets frame the text instead of sitting behind it
- [ ] Every page (Home, About, Projects, Resume, Contact, Behind the Scenes, 404) checked over its scene: no page-level leftovers from the light theme, text readable, spacing works with the frosted panels
- [ ] Anything that needs a component or scene change is reported to the leader, not built in the page
- [ ] Works at 375px and desktop; `npm run build` and `npm run lint` pass

**Open questions:** None.
