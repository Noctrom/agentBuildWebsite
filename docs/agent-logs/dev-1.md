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
