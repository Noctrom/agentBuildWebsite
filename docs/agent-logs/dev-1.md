# dev-1 story log

> Entries for S1–S3 were backfilled by the leader from dev-1's reports and the git history, because the story log rule didn't exist yet when they were done.

## S1 — Project scaffold (2026-10-03)
**Branch:** story/S1-project-scaffold · **Status:** done

**What I did**
- Vite + React + TypeScript app at the repo root.
- Tailwind CSS v4 wired in through the `@tailwindcss/vite` plugin.
- React Router with placeholder routes for `/`, `/about`, `/projects`, `/resume`, `/contact`.
- ESLint flat config; `npm run build` and `npm run lint` pass.
- `src/` folder structure from `CLAUDE.md`, with `.gitkeep` files holding the empty folders.
- `vercel.json` rewrites every path to `index.html` so deep links work.

**How I did it**
- Standard Vite React-TS layout: `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (vite config); `build` runs `tsc -b` before `vite build` so type errors fail the build.
- ESLint uses `typescript-eslint`, `react-hooks` and `react-refresh` recommended configs, ignoring `dist` and `.claude`.
- Placeholder routes are a single inline `Placeholder` component in `App.tsx`, to be replaced by dev-2's pages.

**Verification**
- `npm run build` and `npm run lint` pass.

**Files**
- Added: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `vercel.json`, `.gitignore`, `public/favicon.svg`, `src/main.tsx`, `src/App.tsx`, `src/styles/index.css`, `.gitkeep` files.

**Follow-ups**
- None.

## S2 — Theme & dark mode (2026-10-03)
**Branch:** story/S2-theme-dark-mode · **Status:** done

**What I did**
- Color, font and spacing tokens defined in one place, `src/styles/index.css`, and exposed as semantic Tailwind classes (`bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `text-accent`, `bg-accent`, `border-border`, `px-gutter`, `py-section`, `max-w-content`, …).
- The site defaults to the OS color scheme; a `ThemeToggle` button overrides it and remembers the choice.
- WCAG AA contrast in both themes (ratios below).

**How I did it**
- Each theme's colors are CSS variables on `:root` (light) and `[data-theme='dark']`, mapped into Tailwind with `@theme inline`, so components switch themes without `dark:` classes. A custom `dark` variant follows `data-theme`, not the media query.
- A small inline script in `index.html` sets `<html data-theme>` before first paint (saved choice, else OS) to avoid a flash of the wrong theme.
- `useTheme.ts` uses `useSyncExternalStore`; it follows live OS changes only while there's no saved choice, and syncs open tabs through the `storage` event. All `localStorage` access is in try/catch.
- The hook lives in its own file because the react-refresh lint rule forbids non-component exports from a component file.
- Two-state toggle (light/dark), no separate "system" option. Removed a redundant `--container-prose` token; Tailwind's built-in `max-w-prose` is used.
- Contrast (text vs bg / vs surface): light — fg 17.85/16.30, muted 7.58/6.92, accent 5.93/5.42; dark — fg 15.27/13.24, muted 7.34/6.36, accent 8.79/7.62; accent-fg on accent 5.93 (light), 8.79 (dark).

**Verification**
- `npm run build` and `npm run lint` pass; semantic classes present in the built CSS.
- Headless Chromium against the production build: follows OS light/dark, toggle persists across reload, keyboard toggle works, falls back to OS when `localStorage` throws. Screenshots at 375px and 1280px.
- Leader re-computed the contrast ratios independently; they match.

**Files**
- Added: `src/components/ui/ThemeToggle.tsx`, `src/components/ui/useTheme.ts`.
- Changed: `src/styles/index.css`, `index.html`, `src/App.tsx` (temporary toggle row).

**Follow-ups**
- S3: move the toggle into the header (done in S3).
- Storage key `'theme'` is duplicated in `index.html` and `useTheme.ts`; keep them in sync.

## S3 — Site layout (2026-10-03)
**Branch:** story/S3-site-layout · **Status:** done

**What I did**
- Header with the site name and links to all five pages; the current page is highlighted.
- Hamburger menu under 768px, keyboard accessible.
- Footer with GitHub, LinkedIn and email links plus the copyright year.
- Layout shell wraps every route, with a skip-to-content link; `ThemeToggle` moved into the header and the temporary row removed.

**How I did it**
- `NavLink` (with `end` on `/`) gives `aria-current="page"`; the active link gets `bg-surface text-accent`. The nav list lives in `navItems.ts`.
- The `<nav aria-label="Primary">` itself collapses; the hamburger is a real `<button>` outside it with `aria-expanded`, `aria-controls` and a changing `aria-label`. Escape closes the menu and returns focus to the button.
- The menu closes on navigation by comparing the previous pathname during render rather than calling setState in an effect, which satisfies the react-hooks v7 lint rules.
- Name and links come from `profile` in `src/content`. External links open in a new tab with a screen-reader-only "(opens in a new tab)".
- `App.tsx` uses a pathless layout route `<Route element={<Layout />}>` with `<Outlet />`; `<main id="main" tabIndex={-1}>` is the skip-link target. Placeholder pages changed from `<main>` to `<div>` to avoid two `<main>` elements.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium against `vite preview`: correct `aria-current` per route, menu open/Escape/close-on-navigate, skip link moves focus to main. Screenshots in both themes at 1280px and 375px (menu open and closed); no horizontal scroll at 375px.

**Files**
- Added: `src/components/layout/Header.tsx`, `Footer.tsx`, `Layout.tsx`, `navItems.ts`.
- Changed: `src/App.tsx`. Deleted: `src/components/layout/.gitkeep`.

**Follow-ups**
- dev-2: pages render inside Layout's `<main>`, so they must not add their own `<main>`; each page sets its own width and padding (e.g. `mx-auto max-w-content px-gutter`).

## S4 — Core UI components (2026-10-03)
**Branch:** story/S4-ui-components · **Status:** done

**What I did**
- `Button`: primary/secondary variants and `sm`/`md` sizes. It renders a React Router `Link` (`to`), an `<a>` (`href`: external URLs, `mailto:`, files with `download`) or a `<button>` (neither).
- `Card`: title, description, optional image (`{ src, alt }`), optional tags, an `actions` array (any number of links) and an optional `footer` slot.
- `Section`: `<section>` with heading, optional intro and content, using `px-gutter py-section` and `max-w-content`. Heading level is configurable (1–4), plus optional `id` and `tone="surface"` for an alternating band. It never renders `<main>`.
- `Tag` (static pill) and `TagButton` (toggle with `aria-pressed`) for the S8 filter.
- Barrel `src/components/ui/index.ts` exports all components and prop types, including `ThemeToggle`.

**How I did it**
- Button props are a discriminated union on `to` / `href` / neither (`?: never` on the other keys), so `to` + `href` or `external` on a Link don't compile. `http(s)://` hrefs default to `target="_blank" rel="noopener noreferrer"` plus a screen-reader-only "(opens in a new tab)", like the footer. `external` overrides that. `<button>` defaults to `type="button"`.
- Card actions render as small Buttons. Each action's accessible name includes the card title (e.g. "Code: Project Alpha (opens in a new tab)"), so repeated "Code"/"Demo" labels across a grid stay unambiguous. Cards are `<article>`s with `h-full` and `mt-auto` footers, so actions line up in a grid row. Tags are a `<ul>`.
- Section labels itself with `aria-labelledby` and a `useId` heading id.
- Only semantic theme classes are used. Focus rings come from the global `:focus-visible` rule.

**Verification**
- `npm run build` and `npm run lint` pass.
- Throwaway preview page (not committed) with headless Chromium against `vite preview`, in light and dark at 375px and 1280px: no horizontal overflow, correct `href`/`target`/`rel`/`download`, one `<main>`, sections labelled by the right heading level, the filter toggles `aria-pressed`, the Link navigates client-side, and the focus outline is visible.
- `@ts-expect-error` checks confirmed invalid prop combos are rejected.

**Files**
- Added: `src/components/ui/Button.tsx`, `Card.tsx`, `Section.tsx`, `Tag.tsx`, `index.ts`.

**Follow-ups**
- dev-2: import from `src/components/ui` (barrel). Wrap card grids in `<ul>`/`<li>`. Wrap filter TagButtons in `role="group"` with an `aria-label`.
- Cards use `bg-surface`. Inside a `tone="surface"` Section they are set apart only by their border, so prefer default-tone sections for card grids.

## S13 — Align header with page content (2026-10-04)
**Branch:** story/S13-align-header · **Status:** done

**What I did**
- Header, footer and `Section` content now share the same left and right edges at 375px, 768px and 1280px (previously the header and footer content sat 16px inside the page content on desktop).
- Added one shared container pattern: a `Container` component in `ui/`, used by Header, Footer and Section.

**How I did it**
- Root cause: Header/Footer put `px-gutter` inside their `max-w-content` box (content 64rem minus gutters), while Section put `px-gutter` outside it (content a full 64rem).
- New token `--container-page` = content width + 2 gutters (gives `max-w-page`). `Container` renders one element with `mx-auto w-full max-w-page px-gutter`, so the content inside is exactly 64rem on desktop and viewport minus gutters on mobile. That keeps Section's existing content width, so pages don't shift.
- Chose a component over a shared class string: one import, an `as` prop for semantics, and a `className` for flex/padding-y extras (Header and Footer pass their flex layout through it). Section's full-width `surface` band stays on the `<section>`; Container sits inside it.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core) against `vite preview`, measuring content edges on all 5 routes: header, site name, footer and every section have identical edges: 16/359 at 375px, 16/752 at 768px, 128/1152 at 1280px.

**Files**
- Added: `src/components/ui/Container.tsx`
- Changed: `src/components/ui/Section.tsx`, `src/components/ui/index.ts`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/styles/index.css`

**Follow-ups**
- dev-2: the Home hero (`src/pages/Home.tsx`) builds its own container (`px-gutter` on the section, `mx-auto max-w-content` inside). It lines up today, but should switch to `<Container>` from `components/ui` so there is only one pattern.

## S14 — Card & Tag background tones (2026-10-04)
**Branch:** story/S14-card-tag-tones · **Status:** done

**What I did**
- `Card`, `Tag` and `TagButton` take a `tone?: 'surface' | 'bg'` prop. Default stays `surface`, so pages that don't pass it look the same.
- Checked that `tone="bg"` cards and tags stand out inside a `<Section tone="surface">` in light and dark themes.
- Checked the pages: About's skill tags (`<Tag className="bg-bg">`) are the only `bg-*` override, and they are broken today (tag colour equals the band colour). No page passes `className` to `Card`. Page changes for dev-2 are listed under Follow-ups.

**How I did it**
- New `src/components/ui/tone.ts` with the `SurfaceTone` type and a tone → class map, shared by Card and Tag. It lives in its own file because exporting non-components from `Tag.tsx` breaks the react-refresh lint rule.
- I chose a prop over class merging (e.g. tailwind-merge) because it needs no new dependency, matches `Section`'s `tone` prop, and the allowed values are typed. Values are named after the colour token (`bg`/`surface`) and not `default`, because a Card's default is `surface`.
- Tags inside a Card keep their default (`surface`), so they stay distinct on a `tone="bg"` card and default cards don't change.
- Root cause confirmed: Tailwind v4 emits `bg-bg` before `bg-surface` in the CSS, so `bg-surface` wins whatever the class order. Doc comments now say to use `tone` instead of `className="bg-..."`.

**Verification**
- `npm run build` and `npm run lint` pass.
- Throwaway demo route (not committed) plus headless Chromium (playwright-core) against `vite preview`, in light and dark at 375px and 1280px. I compared computed backgrounds: `tone="bg"` Card/Tag/TagButton are distinct from the surface band (light #fff on #f1f5f9, dark rgb(11,17,32) on rgb(22,32,50)). `className="bg-bg"` stays the same colour as the band. No horizontal overflow. The current About page skill tags have the same colour as their band in both themes.

**Files**
- Added: `src/components/ui/tone.ts`
- Changed: `src/components/ui/Card.tsx`, `src/components/ui/Tag.tsx`, `src/components/ui/index.ts` (exports `SurfaceTone`)

**Follow-ups**
- dev-2: `src/pages/About.tsx` line 23, `<Tag className="bg-bg">{skill}</Tag>` → `<Tag tone="bg">{skill}</Tag>`.
- Any future Card inside a `tone="surface"` Section should use `tone="bg"`.

## S17 — Live reload on WSL (2026-10-04)
**Branch:** story/S17-wsl-live-reload · **Status:** done

**What I did**
- Plain `npm run dev` now live-reloads edits to `src/` (component, content and CSS) with no env vars.
- Polling is set in `vite.config.ts` under `server.watch`, with a comment explaining why (WSL on /mnt/c gets no file-change events).
- Idle CPU stays low: about 4% of one core, polling only project files.

**How I did it**
- `server.watch`: `usePolling: true`, `interval: 300` (chokidar's default is 100ms; 300ms still feels instant), `binaryInterval: 1000`.
- Vite already ignores `**/.git/**`, `**/node_modules/**` and its cache dir (checked `resolveChokidarOptions` in Vite 8.3.2). I added `dist/` and `.claude/` explicitly. `.claude/worktrees/` holds full repo copies of agent worktrees, so the root dev server would otherwise poll their `src/` too.
- Problem: a `**/.claude/**` glob matches absolute paths, and every agent worktree lives under `.claude/`, so it would ignore every file in a worktree. I anchored both patterns to the config folder (`fileURLToPath(new URL('.', import.meta.url))`) instead.

**Verification**
- `npm run build` and `npm run lint` pass.
- Ran `npm run dev -- --port 5199 --strictPort` in the worktree (no `CHOKIDAR_USEPOLLING`), with headless Chromium (playwright-core) on `/`. I made the edits from the Windows side with `powershell.exe` (like a Windows editor), so they could not reach Vite as native WSL events:
  - content (`src/content/profile.ts` name): DOM updated in ~0.9s, HMR (no full reload)
  - component (`Footer.tsx` aria-label): ~0.9s, HMR
  - CSS (`index.css` body outline): ~1.2s, HMR
  - Vite logged `hmr update ...` for each edit. I reverted the test edits with `git checkout -- src`, which Vite also picked up.
- Idle CPU: `top -p <vite pid>` sampled every 2s for ~10s: 3.5–4.5% (0.40s CPU time over 10s).

**Files**
- Changed: `vite.config.ts`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- Polling also runs on machines where native watching works (e.g. Vercel never runs the dev server, so builds are unaffected). If the repo ever moves to the WSL filesystem (`~/...`), polling can be removed.
- This log entry may conflict with S14's entry on merge; keep both.

## S11 — SEO metadata foundation (2026-10-04)
**Branch:** story/S11-seo-metadata · **Status:** done

**What I did**
- Added `PageMeta` (`src/components/ui/PageMeta.tsx`), with props `title?` and `description`. `PageMeta` and `PageMetaProps` are exported from the ui barrel. It renders React 19's built-in `<title>` and `<meta name="description">` (no new dependency).
- Title format is "<title> · <profile.name>", e.g. "About · Jane Placeholder". On Home, `title` is left out and the title is just `profile.name`.
- Fixed duplicate tags: at runtime there is exactly one `<title>` and one description in `<head>` on every route (details below).
- `index.html` site-wide placeholder defaults: `<title>`, meta description, `og:type`, `og:title`, `og:description`, `og:image` (`/og-image.png`), `twitter:card` (`summary_large_image`).
- Favicon: `<link rel="icon" href="/favicon.svg">` returns 200 `image/svg+xml` from the preview build.
- Usage for dev-2 is documented in PageMeta's doc comment.

**How I did it**
- First I used a naive PageMeta with a throwaway usage and checked headless Chromium. React 19 hoists both tags but does **not** replace existing ones:
  - It inserts its `<title>` before the static one, so `document.title` is right, but `<head>` holds two titles.
  - It appends its `<meta name="description">` after the static one, so the stale static description comes first in `<head>`. Anything reading the first one gets the wrong text.
- Fix: the static default `<title>` and description in index.html carry `data-default-meta`. A `useLayoutEffect` in PageMeta (ref-counted across instances) swaps those nodes for comment placeholders while any PageMeta is mounted, and puts them back when the last one unmounts. Result:
  - Crawlers and no-JS clients see the static defaults.
  - Once a page renders PageMeta, it is the only source of title/description.
  - Routes without PageMeta (Projects/Resume/Contact until S19) keep the defaults instead of ending up with an empty title.
  - On route change, the old page's cleanup and the new page's setup run in the same commit, so nothing flashes.
  - StrictMode's double effect run is fine because of the ref count.
- Rejected alternatives:
  - Removing the static description from index.html: no-JS crawlers would lose it.
  - Updating the static tag imperatively instead of rendering `<meta>`: goes against the story's "use React 19's built-in rendering".
- OG/Twitter tags stay static and site-wide (crawlers don't run JS). PageMeta deliberately doesn't touch them.
- `formatPageTitle` isn't exported, so `react-refresh/only-export-components` stays happy.

**Verification**
- `npm run build` and `npm run lint` pass (with the final, clean tree).
- `vite preview` on :4199. I used a playwright-core headless Chromium script with throwaway `<PageMeta>` usage in Home (no title) and About (not committed; reverted with `git checkout -- src/pages`). Results:
  - `/` initial: `document.title` "Jane Placeholder", 1 title, 1 description ("DESC Home")
  - header link to `/about`: "About · Jane Placeholder", 1 title, 1 description ("DESC About")
  - header link back to `/`: back to the Home values, still 1 of each
  - header link to `/projects` (no PageMeta): the static defaults restored, 1 of each
  - deep link `/about`: correct, 1 of each
  - OG/twitter tags present unchanged throughout
- Raw HTML (`curl /about`) contains all static defaults.
- `/favicon.svg` 200 `image/svg+xml`. `/og-image.png` currently returns index.html (SPA fallback), which is expected until S19 adds the file.
- No visual change, so I did not check widths.

**Files**
- Added: `src/components/ui/PageMeta.tsx`
- Changed: `src/components/ui/index.ts`, `index.html`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2 (S19): render one `<PageMeta>` per page, with title/description from `src/content/` (Home without `title`, 404 included). Add `public/og-image.png` (1200×630).
- dev-2 / Chris: the index.html default name/description are hardcoded placeholders. Keep them in sync with `profile.name` when real content lands.
- Leader (S12): many crawlers want an absolute `og:image` URL. Once the Vercel domain is known, change `/og-image.png` to `https://<domain>/og-image.png` and consider adding `og:url`. A missing `og-image.png` is served as index.html by the SPA rewrite, so make sure the file exists before deploying.

## S20 — Workflow diagrams (2026-10-04)
**Branch:** story/S20-workflow-diagrams · **Status:** done

**What I did**
- Added two reusable components in `src/components/ui/` and exported them with their prop types from the barrel:
  - `StoryFlowDiagram` (Diagram A): story flow as stages of steps, plus a "send back for fixes" loop.
  - `BranchDiagram` (Diagram B): branch levels (main ← leader ← story/*). Each level shows what it is for and who may change it, and each arrow says how work moves up.
- All text comes from props, which are data-driven arrays (`stages[].steps[]`, `levels[]`). The components contain no label text.
- Diagram A draws every step in the S20 order. The loop is a dashed accent bracket from "Leader review" back up to "dev-1 / dev-2", with its own label.
- Layout at 375px and 768px: a single vertical column (max 28rem), with no horizontal scroll. From `lg` up, Diagram A's stages sit side by side, and Diagram B indents each level like a tree.
- Colours use only theme tokens (fg, muted, accent, border, surface/bg), so they meet the documented AA ratios in light and dark. The smallest text is xs muted on surface: 6.92 / 6.36.
- Text alternatives:
  - A: the figure is named via `aria-labelledby`, the visual chart is `aria-hidden`, and screen readers get a visually hidden nested `<ol>` (stages → steps). The loop's full `description` sentence sits on the "from" step.
  - B: is itself a semantic `<ol>`. Arrows are decorative, and each merge label is read after its level's card.
- No new dependencies. Everything is HTML/CSS with small inline SVG arrows.

**How I did it**
- Loop rendering without measuring the DOM: when both loop ends are in the same stage, the steps from `to` to `from` are wrapped in a 2-column grid. The right column holds the bracket (dashed top/right/bottom border with an SVG arrowhead) and the label. If the ends are in different stages, the component falls back to a "↺ label" note under the `from` step.
- Problem: in the stacked layout, boxes outside the loop stage were wider than the bracketed ones, so the arrows didn't line up. Fix: when a bracket is drawn, every stage, stage label and stage arrow reserves the same right gutter below `lg` (`max-lg:pr-[6rem]`).
- A single-stage flow stays at max 28rem even on desktop instead of stretching to 1024px.
- Problem: the first a11y snapshot of B read "...merged by Chris leader", because the merge label came before the branch name. Fix: moved it after the card in the DOM and used `order-first` to keep it visually above. The figure's label is now a `hidden` span referenced by `aria-labelledby`, so it isn't read twice.
- Optional `tone` prop (S5 pattern): `bg` inside a `<Section tone="surface">`. Optional `caption` (rendered as figcaption). On `BranchDiagram`, `accessLabel` sets the small "Who can change it" heading and `examples` shows sample branch names.
- Fixed a TS narrowing bug: a type-predicate helper narrowed `loop` to `never` in the else-branch, so I made it a plain boolean.

**Verification**
- `npm run build` and `npm run lint` pass on the clean tree.
- Used a throwaway `/s20` route and preview page (reverted and deleted, never committed). I ran `vite preview` with playwright-core headless Chromium at 375, 768 and 1280, light and dark. Results:
  - Horizontal overflow 0 at every width/theme. No console errors.
  - Screenshots checked: the full page plus 2x crops of each figure.
  - Variants checked: on the page bg, inside a surface band with `tone="bg"`, single stage with no stage labels, and the cross-stage loop fallback.
- Playwright `ariaSnapshot` confirmed the accessible names and the list structure of both figures.

**Files**
- Added: `src/components/ui/StoryFlowDiagram.tsx`, `src/components/ui/BranchDiagram.tsx`
- Changed: `src/components/ui/index.ts`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2 (S21): put the step, loop and level text in `src/content/` and render `<StoryFlowDiagram>` and `<BranchDiagram>` in the matching sections. See the usage in the S20 report. Use `tone="bg"` if a diagram sits in a `Section tone="surface"`.

## S23 — Space palette & typography (always dark) (2026-10-04)
**Branch:** story/S23-space-palette · **Status:** done

**What I did**
- Removed the light theme: light tokens, the `[data-theme]` blocks and the `dark` custom variant are gone. I deleted `ThemeToggle.tsx` and `useTheme.ts`, removed their ui barrel exports and the header toggle, and dropped the pre-paint theme script from `index.html`. `:root` now sets `color-scheme: dark`.
- New space palette on `:root`: bg `#05060f` (deep space), surface `rgb(139 147 255 / 0.12)` (translucent glass), fg `#e8eaf6` (starlight), muted `#a3a8c8`, accent `#a5a0ff` (nebula violet-blue), accent-hover `#c7c4ff`, border `rgb(139 147 255 / 0.2)`. I added a warm sun accent: `sun` `#fbbf4d`, `sun-hover` `#fdd58a`, `sun-fg` (Tailwind `text-sun`, `bg-sun`, `text-sun-fg`). All existing token names still work, so pages and components needed no changes.
- WCAG AA: every text pair is checked against the solid bg, the surface composited over bg (`#15172c`) and surface nested twice (`#232645`, e.g. a default Card inside a surface band). The lowest is muted on double surface at 6.27. All numbers are in the `index.css` header.
- Font: unchanged, per Chris's clarification. The existing `font-sans` stack is used for headings and body.
- Browser UI: added `<meta name="theme-color" content="#05060f">` and `<meta name="color-scheme" content="dark">`.

**How I did it**
- Kept the raw values as `--theme-*` variables on `:root`, mapped through `@theme inline`, so S24 can read them from JS/CSS if needed.
- Contrast: a small script composited the surface over bg per channel (`a*surface + (1-a)*bg`) and computed WCAG ratios. I raised the surface alpha from 0.10 to 0.12 so the S14 `surface` vs `bg` tones stay visibly distinct (1.15:1 for surface vs bg; the old dark theme was about 1.18).
- Per Chris's mid-story clarification I made no font changes. I had only edited a comment above the font stack, and reverted that too.

**Verification**
- `npm run build` and `npm run lint` pass on the clean tree.
- Headless Chromium (playwright-core) against `vite preview`, at 375, 768 and 1280, with both light and dark OS preference, on `/`, `/about`, `/projects`, `/resume`, `/contact` and a 404 route:
  - No console errors, horizontal overflow 0, no `data-theme`.
  - Body bg `rgb(5,6,15)`, computed `color-scheme: dark`, theme-color `#05060f`.
  - h1 and body use the same font stack.
  - No toggle. The only selector hit was the "Highlights" aria-label on Resume, a substring false positive.
- A throwaway `/s23` preview (deleted, never committed) showed Buttons, Tags, a sun pill, Cards, `StoryFlowDiagram` and `BranchDiagram` on bg and inside a `Section tone="surface"` (with `tone="bg"`). Tones are clearly distinct and the diagrams read well. I also checked screenshots of Home and About at 375 and of the open mobile menu.

**Files**
- Changed: `index.html`, `src/styles/index.css`, `src/components/layout/Header.tsx`, `src/components/ui/index.ts`, `docs/agent-logs/dev-1.md`
- Deleted: `src/components/ui/ThemeToggle.tsx`, `src/components/ui/useTheme.ts`

**Follow-ups**
- dev-2: no page has hardcoded colors or uses the toggle; nothing to change. `text-sun` / `bg-sun` are available for warm highlights.
- S24: `Layout` and `body` still paint solid `bg-bg`. The background layer needs those to become transparent or sit above them, and it must stay dim enough to keep the ratios above.
- S25: the surface is already translucent; S25 can add blur and glow on top.
- BACKLOG.md / old log entries still mention ThemeToggle historically (leader's files; no action needed).

## S22 — Behind the Scenes nav link (2026-10-04)
**Branch:** story/S22-bts-nav-link · **Status:** done

**What I did**
- Added `{ to: '/behind-the-scenes', label: 'Behind the Scenes' }` as the last entry in `navItems.ts`. It shows in the desktop nav and the mobile menu, and the active highlight and `aria-current="page"` work on that route.
- Moved the header collapse breakpoint from `md` (768px) to `lg` (1024px). Below 1024px the header shows the hamburger. At 1024px and up it shows the inline nav.
- Added `whitespace-nowrap` to nav links, so "Behind the Scenes" can never break onto two lines inside its pill.

**How I did it**
- I measured with `md` kept first. The six-item inline nav is about 543px wide. At 768px there was only 23px between the name ("Jane Placeholder") and the nav. It fit on one row, but it looked crowded. A slightly longer real name would wrap the whole nav onto a second row (the header container is `flex-wrap`).
- At `lg` the gap at 1024px is about 279px, so there is plenty of room for a longer name. Tablets in portrait (768-1023) get the hamburger, which handles six items well. I chose `lg` over a custom breakpoint because it uses a standard Tailwind token and leaves real headroom.
- I documented the measurement in a comment in `navItems.ts`, so whoever adds a seventh item re-measures first.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core) against `vite preview`:
  - Header measured at 375, 768, 1023, 1024, 1025 and 1280. There is no horizontal overflow at any width. Below 1024 the hamburger shows. From 1024 up all six links sit on one row, each 36px tall (single line), and the header is 61px tall.
  - 1280: clicking "Behind the Scenes" from Home goes to `/behind-the-scenes` (h1 "Behind the Scenes"). After the transition only that link has `aria-current="page"` and the surface highlight.
  - 375 and 768: open the hamburger and all six items stack at full width, 40px each. Clicking "Behind the Scenes" navigates and closes the menu (`aria-expanded="false"`). Reopening shows it as current.
  - A deep link to `/behind-the-scenes` returns 200 with the link marked current.
  - I checked screenshots of the open menu at 375, the header at 768 (before) and 1024, and the desktop header on the new page.

**Files**
- Changed: `src/components/layout/navItems.ts`, `src/components/layout/Header.tsx`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- None. (This entry may conflict with S24's dev-1 log entry on merge. Keep both.)

## S24 — Animated space background (2026-10-04)
**Branch:** story/S24-space-background · **Status:** done

**What I did**
- Background on every route: `<SpaceBackground>` sits inside `Layout`. It is fixed behind all content and renders the scene mapped to the current route. The default starfield is used everywhere for now.
- Scene folder `src/scenes/`, owned by dev-2 from S26 on:
  - `types.ts`: the documented, typed scene contract (`Scene`, `SceneInstance`, `SceneSetup`, `SceneFrame`, `SceneSize`, `SceneBudget`).
  - `routes.ts`: the route → scene map plus `sceneForPath`.
  - `starfield.ts`: the default scene, also reusable as a base layer through `createStarfield(setup, options)`.
  - `random.ts`: a seeded random generator.
  - The engine itself lives in `components/layout/`.
- Default scene: three star layers (far, mid, near) with twinkling on the mid and near layers, two slowly drifting nebula cloud layers, and parallax on scroll with a different factor per layer. Colors follow Hubble/JWST nebula imagery.
- Drawn in code with Canvas 2D. No images, no new dependencies.
- Contrast: the engine shows the canvas at opacity 0.1. Even a pure white pixel then composites to rgb(30 31 39), so every text token stays at AA at every frame. The worst case is muted text on a surface nested twice, at 4.76.
- Reduce motion: one still frame drawn at time 0, with no parallax and no crossfade. It is redrawn on resize, and it reacts if the OS setting changes while the page is open.
- The loop pauses while the tab is hidden. The engine starts only after first paint plus idle, so it never delays content.
- Fallback: if Canvas 2D is unavailable or a scene throws, the engine stops and a static `.space-fallback` gradient shows. The site keeps working.
- Crossfade between scenes on navigation is built into the engine for S26: 1.2 s with easing, it handles interruptions, and it is skipped with reduce motion. It only runs when the scene id changes.

**How I did it**
- Split into an imperative engine (`backgroundEngine.ts`: rAF loop, one canvas per active scene, fades, ResizeObserver, visibilitychange, failure handling) and a thin React wrapper (`SpaceBackground.tsx`). The wrapper uses `useLocation` → `sceneForPath`, `useSyncExternalStore` for `prefers-reduced-motion`, and starts the engine lazily. The engine renders outside React, so nothing re-renders per frame.
- Contract: `create(setup)` returns `{ draw, resize?, dispose? }`. Each frame, the engine clears the canvas and sets a CSS-pixel transform, then calls `draw` with ctx, size, dpr, time, dt, scrollY, reducedMotion and budget. Scenes draw at full brightness and the engine applies the dimming. So dev-2 cannot break contrast, and the crossfade is just two canvases with opacities summing to 1 × budget.
- Brightness budget: computed with a WCAG script (white at opacity o over bg, then surface once or twice, against each text token). At 0.12, muted text on a twice-nested surface drops to 4.49, so I used 0.1. The numbers are in the `index.css` header.
- Layout: removed `bg-bg` from the wrapper and added `relative isolate`. The background is `fixed -z-10` inside that stacking context, so it paints above the body's solid bg and below content. Height is `h-lvh`, so the mobile URL bar showing and hiding doesn't resize the canvas while scrolling.
- Performance:
  - The far stars are baked into one bitmap.
  - The nebulae are baked at 1/4 resolution and drifted with `drawImage`.
  - Only the mid and near stars are drawn per star.
  - Fill rate was the bottleneck. At DPR 1.5 the 375px view ran at about 36 fps under 4x CPU throttle, so I capped DPR at 1 and canvas backing size at 1.1 MP. The content is dim and soft, so the loss in sharpness isn't visible.
- First nebula pass was round, uniform blobs and drifted off-screen at 375. I replaced it with filament chains of blobs along a wandering, center-steered path, plus a few `destination-out` dust holes for texture.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core) against `vite preview`, at 375/768/1280, on `/`, `/about`, `/projects`, `/resume`, `/contact`, `/behind-the-scenes` and a 404 route, with and without `reducedMotion: 'reduce'`. That is 42 runs. Every run had engine state `running`, one canvas, opacity 0.1, no horizontal overflow and no console errors. Animated runs change between screenshots 700 ms apart; reduced-motion runs are pixel-identical.
- Contrast: with page content hidden, the brightest background pixel across all 42 runs was rgb(30 30 39). Muted text over it measures 7.10:1 (bare bg).
- Hidden tab: 30 rAF calls per 500 ms while visible, 0 while hidden, and it resumes on visible.
- Fallback, with `getContext` forced to null: state `fallback`, gradient shown, page renders, no page errors.
- Crossfade, with a throwaway second scene on `/about` that I reverted and never committed:
  - Opacities went 0.099/0.0005 → 0.074/0.026 → 0.017/0.083 → a single layer at 0.1 after about 1.2 s.
  - Back-navigation mid-fade recovered cleanly.
  - Navigating between routes with the same scene did not fade.
  - With reduce motion, the swap was instant.
- Frame time while auto-scrolling at 375px, DPR 3 emulated: 4x CPU throttle gave 60 fps (avg 16.7 ms, 1 frame over 33 ms in 5 s); no-background baseline 16.6 ms. 1920 and 1280 unthrottled gave 60 fps. Engine JS is about 1 ms per frame at 4x. Headless Chromium uses software raster, so real GPU-backed devices should be faster.
- Resize from 375 to 1280 redraws correctly, both animated and as a still frame. Screenshots checked at all widths, including the fallback.

**Files**
- Added: `src/scenes/types.ts`, `src/scenes/routes.ts`, `src/scenes/starfield.ts`, `src/scenes/random.ts`, `src/components/layout/SpaceBackground.tsx`, `src/components/layout/backgroundEngine.ts`
- Changed: `src/components/layout/Layout.tsx`, `src/styles/index.css`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2 (S26/S27): add scene files in `src/scenes/` and map routes in `routes.ts`. Read the header of `types.ts`, and see `starfield.ts` / `createStarfield` for reusing the base starfield. Scenes must look complete at `time = 0` (the reduced-motion still frame).
- S25: the `Header` still paints solid `bg-bg`, so the background is hidden behind it. S25's translucent header will reveal it. `bg-bg` tone elements (Card image area, BranchDiagram badges, `tone="bg"`) stay opaque as before.
- Leader: the 0.1 opacity cap makes the background deliberately subtle, because the muted-on-double-surface pair limits it. If Chris wants it brighter, the options are raising `BACKGROUND_MAX_OPACITY` together with a lighter `muted` token, or ruling out double-nested surfaces.

## S25 — Space-styled components & layout (2026-10-04)
**Branch:** story/S25-space-components · **Status:** done

**What I did**
- Header and footer are translucent. The header is bg at 70% with a 12px backdrop blur. The footer is a frosted surface band. Text stays at AA over the moving background (numbers below).
- Frosted glass is a translucent fill, a backdrop blur and a faint border:
  - `Card`, `Section tone="surface"` bands and secondary `Button`s get the fill and the blur.
  - `Tag`, `TagButton` and the S20 diagram boxes get the glass fill and border, but no blur (see the performance bullet below).
  - The primary `Button` stays solid accent, so the main call to action still stands out.
- Tones stay distinct. `tone="bg"` is now a translucent deep tint (`bg-bg-glass`, bg at 80%) instead of solid bg. Inside a surface band, a `tone="bg"` panel measures 1.12:1 against the band over bare bg (it was 1.15 with solid bg) and 1.42 over the brightest background pixel. Each panel also keeps its border.
- Glow: a shared `glowClass` gives a soft accent halo on hover (`shadow-glow`, mouse only, since Tailwind v4 wraps hover in `@media (hover: hover)`) and a stronger one on keyboard focus (`shadow-glow-focus`), on top of the global 2px focus outline. It's used by Button, TagButton, the nav links and the menu button. The name link and the footer links get the focus glow too.
- Space detail: a new `glass-edge` utility draws a thin starlight highlight along the top border of cards, surface bands and the footer. It is static.
- Reduced motion: a global rule sets transition and animation durations to 0, so hover and focus changes snap instead of fading.
- Contrast notes in `index.css` are updated with the new fills (bg-glass, header, nav pill on the header). `BACKGROUND_MAX_OPACITY` is unchanged.

**How I did it**
- Tokens in `index.css`: `--color-bg-glass`, `--color-bg-header`, `--blur-glass` (12px), `--shadow-glow` and `--shadow-glow-focus`. The recipes live in `ui/tone.ts`: `surfaceToneClass` (fill only), `glassClass` (fill and blur) and `glowClass`.
- Contrast: the surface alpha is unchanged, so S23/S24's table still holds for every surface panel. Blur only averages the backdrop, so it can't get brighter than S24's worst-case pixel. I used no saturate or brightness filters, on purpose. I computed the new fills with the same compositing script. The lowest new pair is muted on a nav pill over the header, at 7.05.
- Performance: I measured auto-scroll frame times at 375px, DPR 3, 4x CPU throttle, against a saved build of `leader` on a second preview port.
  - With blur on the diagram boxes too, Behind the Scenes had more frames over 33ms in 5s: about 7 per run versus about 1 on baseline. With blur on the BranchDiagram cards only, it was still about 5.
  - With blur on neither, it matched baseline, so diagram boxes and tags get the fill only.
  - Inside a blurred band, a nested blur only sees the band (the band is the backdrop root) anyway, not the stars.
- Bug found in testing: my first reduced-motion rule used the common `0.01ms` duration. Because the default `transition-property` is `all`, every style change became a 0.01ms transition, and the focus check sometimes read the skip link's outline as 0px. I switched to `0s`, and 8 of 8 repeat checks then passed.

**Verification**
- `npm run build` and `npm run lint` pass.
- Headless Chromium (playwright-core) against `vite preview`, on 7 routes (`/`, `/about`, `/projects`, `/resume`, `/contact`, `/behind-the-scenes` and a 404) at 375, 768 and 1280, with and without `reducedMotion: 'reduce'`. That is 42 runs:
  - No horizontal overflow and no console errors in any run.
  - Header shows `rgba(5,6,15,0.7)` with `blur(12px)`, footer shows the blur, and there is one canvas.
  - Tabbing through every focusable element on each page, each one had `:focus-visible` with a 2px solid outline.
- Screenshots checked: full pages at all widths, plus close-ups of TagButton focus, secondary Button hover, nav link focus, primary Button focus and the open mobile menu at 375.
- Scroll performance (375px, 4x throttle, 3 runs per route): average frame time was 16.7–17.3ms on both baseline and S25 on every route. Long-frame counts overlapped in range between the two builds. dev-2 was building in parallel, so there were occasional noisy bursts on both builds (load average around 3).

**Files**
- Changed: `src/styles/index.css`, `src/components/ui/tone.ts`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Section.tsx`, `src/components/ui/Tag.tsx`, `src/components/ui/BranchDiagram.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2 (S28):
  - `src/pages/Contact.tsx` has a hand-built panel (`rounded-lg border border-border bg-surface p-5`). It has the glass fill but no blur or edge. Use `Card`, or add `backdrop-blur-glass glass-edge` to match.
  - The Home avatar uses `bg-surface`, which is fine as is.
  - Pages can use `glassClass` and `glowClass` from `components/ui/tone.ts` if they build something custom.
- Leader: the header is not sticky. That isn't in the story, and making it sticky would affect anchor offsets (`scroll-mt`). It's easy to add if Chris wants it.

## S29 — Scene engine follow-ups (2026-10-04)
**Branch:** story/S29-scene-engine-followups · **Status:** done

**What I did**
- Fixed the stale comments in `src/scenes/starfield.ts`: the file header and the `starfieldScene` doc no longer say it is the default for unmapped routes. They now point to `lostInSpaceScene` in `routes.ts` and say that `starfieldScene` is unused, kept as the simplest full example. I also fixed the same "default scene" wording in the `types.ts` header example.
- Measured the first-visit cost of scenes that bake in `create`. It does cause a visible hitch, so I added engine support for building a scene over several frames: `create` may now be a generator function. Existing scenes still work as before.

**How I did it**
- Measurement: headless Chromium (playwright-core) against `vite preview`, 375px at DPR 3 with 4x CPU throttle. I clicked the real header link Home → Resume and recorded every rAF timestamp, long tasks, and when the new page's `h1` was painted:
  - The new page paints after 58–151 ms. Then one long task of 174–241 ms runs (the nebula `create`), and that gives a **217–300 ms frame gap**. Every animation on the page freezes, including the twinkling background, and taps and scrolls wait behind it.
  - Home → About (sun) had a 217–267 ms gap, Contact 133 ms, and Projects 83 ms.
  - At 1280 without throttling, Resume had a 100–117 ms gap.
  - I timed `create` alone with temporary instrumentation (removed): nebula 182–186 ms, sun 79–99 ms, galaxy 34–44, solar system 25, black hole 21–23, planets 16–18, lost-in-space 15–17 (375/4x). At 1280 unthrottled: nebula 68, sun 28, the rest 6–14.
- Contract (`types.ts`): `create(setup): SceneInstance | SceneBuild`, where `SceneBuild = Generator<unknown, SceneInstance, undefined>`. A heavy scene writes `*create(setup) { ...; yield; ...; return instance }`. A new "Heavy setup" section documents when to use it, how often to yield (each slice under ~5 ms on a slow phone), cancellation, resize during a build, and an example.
- I chose generators over an async/Promise `create` because the engine controls the scheduling: it runs as many slices as fit a time budget and can drop a build at any `yield`. Scenes need no scheduler, abort signal or promise plumbing.
- Engine (`backgroundEngine.ts`):
  - A pending build is stepped in `setTimeout` tasks with a 6 ms budget each (`BUILD_SLICE_MS`). The first slice runs in a later task, so the new page always paints first.
  - The current scene keeps drawing until the instance is returned, and only then does the crossfade start.
  - Cancellation calls `return()` on the generator, so `finally` blocks run. Builds are cancelled when you navigate to another scene, navigate back to the shown scene, reduce motion changes, the engine is destroyed, or a scene fails.
  - If the viewport changed during the build, `resize` runs before the scene is shown. A hidden tab runs the build to the end at once, because timers are throttled there.
  - A reduce-motion change now settles fades, keeps the old layer, rebuilds the target scene and swaps it in without a fade. Before, it removed everything and rebuilt synchronously.
  - A plain object returned from `create` goes through the same path as before.
- `src/scenes/build.ts` (new): `isSceneBuild` (used by the engine), and `runToEnd` so scenes can reuse a yielding bake synchronously in `resize`.
- Proof on a throwaway, uncommitted copy of `nebula.ts` turned into a generator (yield every 2 rows of the cloud bake, `yield*` through `build`, cache written only at the end, `runToEnd` in `resize`). It type-checked as `create: createNebula` with no other change.
  - 375/4x Home → Resume: **no long tasks, max frame 33–67 ms** (was 217–300). Frames during the build averaged 19 ms.
  - Trade-off: the crossfade starts about 740 ms after the click instead of right after a 185 ms freeze. At 1280 unthrottled it starts after about 220 ms, with a 33 ms max frame and no long tasks.

**Verification**
- `npm run build` and `npm run lint` pass.
- Edge cases with the throwaway generator nebula and a temporary `data-scene` attribute (both reverted), 375/4x, checking canvases, opacity, size, lit pixels and console:
  - Back to Home mid-build: solar-system only.
  - Resume → Contact mid-build: galaxy only.
  - Reduce motion turned on mid-build: nebula, still frame (identical 800 ms apart), then animating again after turning it off.
  - Resize to 414×700 mid-build: nebula at 414×700.
  - Direct load of `/resume`, with and without reduce motion: correct.
  - Navigating with reduce motion on: correct.
  - A full tour of all 7 routes showed the right scene each time, one canvas at opacity 0.1 and no console errors.
- The final committed code (all scenes still synchronous) measured the same as before, at 375/4x and 1280.

**Files**
- Added `src/scenes/build.ts`
- Changed `src/scenes/types.ts`, `src/scenes/starfield.ts`, `src/components/layout/backgroundEngine.ts`, `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2: move `nebulaScene` to the generator `create`. The throwaway version above worked: yield every ~2 rows in `bakeClouds`, assign `cloudCache` only after the bake finishes, and use `runToEnd(build(next))` in `resize`. That removes a ~200–300 ms hitch on a slow phone.
- dev-2: `sunScene` (~80–100 ms at 375/4x) should move to it too. The others are under ~45 ms and can stay as they are.
- Until a scene adopts the generator path, its first-visit hitch is the same as before.

## S32 — Brighter space background (2026-10-05)
**Branch:** story/S32-brighter-background · **Status:** done

**What I did**
- Raised `BACKGROUND_MAX_OPACITY` from 0.1 to **0.2**, twice as bright as before and the top of the 1.5–2× target. Every scene is visibly brighter on every page: the sun, planets, black hole and nebulae now read clearly.
- Text stays WCAG AA over the brightest possible frame (pure white at 0.2 = rgb(55 56 63)), including muted text on a surface nested twice. The lowest pair is accent on a surface nested twice, at 4.96. Muted is at least 5.20 everywhere.
- Made room with tokens, not by dimming the background:
  - `surface` changed from pale `rgb(139 147 255 / 0.12)` to a darker, more opaque `rgb(51 55 98 / 0.35)`. Over the solid bg it composites to exactly the same `#15172c`, so panels look the same over dark space. Over a bright scene pixel it now dims the pixel instead of adding pale light on top.
  - `muted` went from `#a3a8c8` to `#a8adcc`, a small step. fg vs muted is 1.84:1 (was 1.95), so muted still reads as secondary.
  - The header (bg at 70%) and `bg-glass` (80%) needed no change: their worst case is 8.24 and 8.58 for muted.
- Updated the contrast notes in `backgroundEngine.ts`, `src/scenes/types.ts` and the `index.css` header, with full tables for bare bg and the worst-case pixel. Also updated the `tone.ts` description of the surface tone.
- Doubled the stop alphas of the static `.space-fallback` gradient to match. Even all three stops stacked at full strength stay dimmer than white at 0.2 (muted 5.70, accent 5.43).
- The crossfade timing is unchanged (that's S33). No scene, page or content files were touched.

**How I did it**
- Budget math with a compositing script (white at opacity o over bg, then each translucent fill, then WCAG ratio per text token). At 0.2 with the old tokens, muted on surface nested twice fell to 3.53 and accent to 3.57. The old surface was the limit: a pale tint at 12% *adds* light on top of a bright pixel.
- Fix: keep the look over dark space but stop the surface from lightening bright pixels. For an alpha `a`, I solved for the fill color that still composites to `#15172c` over bg (`c = bg + (#15172c - bg) / a`). Then I swept `a` against the opacity:
  - a = 0.35 (fill 51 55 98) passes at 0.2 with the old muted.
  - With the small muted bump, muted has margin (5.20).
  - Higher alphas trade away more of the background behind panels and make nested surfaces less distinct, for no gain: once the surface stops being the limit, the bare background (accent 5.05) is.
- Why 0.2 is the cap: accent on the bare background is 5.05 at 0.2 and 4.7 at 0.22. Going higher would mean changing accent too, which is outside the target.
- Side effects: a surface nested twice over bare bg is now `#20223f` (was `#232645`), so secondary buttons and tags inside cards are a shade darker. Surface vs surface-twice contrast is 1.14 (was 1.20), still distinct with the border. A tone="bg" panel against its band is unchanged at 1.12 over dark space, and 1.63 over a bright pixel.

**Verification**
- `npm run build` and `npm run lint` pass.
- Contrast scan in headless Chromium (playwright-core, based on dev-2's S28 script) against `vite preview`:
  - All 7 routes (`/`, `/about`, `/projects`, `/resume`, `/contact`, `/behind-the-scenes`, `/nope`) at 375/768/1280.
  - Pages scrolled in half-viewport steps to the bottom. At each step the script samples the canvas under every visible text box, composites it at the canvas's actual opacity (read from the DOM: 0.2) plus every translucent ancestor fill, and checks it against that element's color and AA threshold.
  - It reports the 95th-percentile pixel and the single brightest pixel. Three modes:
    - **Worst case** (every canvas pixel treated as pure white, through the real DOM fills): 1995 element samples, 0 failures, lowest 5.00 (accent on a surface, Resume company names). This matches the analytic table.
    - **Real scenes, still frame** (reduce motion): 1995 samples, 0 failures. Lowest p95 is 5.62 (About skills intro at 375, over the sun). Lowest single pixel is 5.27 (Behind the Scenes "Who can change it" at 768, over the black-hole disk).
    - **Real scenes, animated** (two samples 600 ms apart per step): 3990 samples, 0 failures. Lowest p95 is 5.66 (About at 375). Lowest single pixel is 5.30 (Projects card description at 375, over a planet).
  - The S28 tight spots at 0.2: About skills intro at 375 is 5.62. Projects card text and tags are at least 5.30 (single pixel). The Behind the Scenes diagram label at 768 is 5.27 (single pixel).
  - No console or page errors.
- Screenshots before/after (reduce motion, so the same frame) of Home, About, Projects, Behind the Scenes, Resume and Contact at 375/768/1280, plus scrolled views of About 375, Projects 375 and Behind the Scenes 768. Scenes are clearly brighter, and panels look the same over dark space. Nothing is distracting behind the Home hero or the Projects cards.

**Files**
- Changed: `src/styles/index.css`, `src/components/layout/backgroundEngine.ts`, `src/scenes/types.ts` (comment only), `src/components/ui/tone.ts` (comment only), `docs/agent-logs/dev-1.md`

**Follow-ups**
- dev-2 (optional, not needed for AA): on Behind the Scenes at 768 the black hole now clearly sits behind the end of the "Branches and reviews" intro and the top-right of the first branch diagram box. It passes (5.27 lowest pixel), but it is the most eye-catching object behind text on the site. Nudging it up/right at tablet widths would give the diagram more calm.
- dev-2: `public/photo-placeholder.svg` uses the old muted `#a3a8c8` for its label. It still passes, so only update it for consistency if you touch it.
- S33 (mine): the crossfade composites two canvases whose opacities sum to the budget, so it never exceeds 0.2. Keep that property when reworking the timing.
