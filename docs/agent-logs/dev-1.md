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
