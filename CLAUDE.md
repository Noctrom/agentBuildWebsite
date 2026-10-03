# Personal Website

Professional personal website for Chris. Static frontend only (no backend yet).

## Stack
- React + TypeScript, built with Vite
- Tailwind CSS for styling
- React Router for pages
- Deployed on Vercel (static build, SPA rewrites in `vercel.json`)

## Architecture
```
src/
  components/
    layout/     # Header, Footer, Layout shell            (Dev 1)
    ui/         # Button, Card, Section, Tag, etc.         (Dev 1)
  pages/        # Home, About, Projects, Resume, Contact   (Dev 2)
  content/      # Typed placeholder data (profile, projects, experience) (Dev 2)
  styles/       # Tailwind entry, theme tokens             (Dev 1)
  App.tsx       # Routes                                   (Dev 1 owns; Dev 2 may add routes)
public/         # Static assets, resume PDF, favicon
```

- All site text and data lives in `src/content/`. Pages never hardcode bio/project text.
- Pages compose `ui/` components; they don't reinvent buttons/cards.
- Placeholder content is clearly fake (e.g. "Project Alpha", lorem ipsum) so it's easy to find and replace later.

## Team workflow
- **Leader** = the main Claude Code session. Writes/assigns stories in `BACKLOG.md`, reviews dev work, merges, reports progress to Chris. Does not write feature code.
- **dev-1** (foundation & design system) and **dev-2** (pages & content) are subagents in `.claude/agents/`.
- Each story is done on its own branch `story/<id>-<slug>` in an isolated worktree, then reviewed and merged into `main` by the leader.
- Stay inside your owned folders. If you need a change in another dev's area, report it back instead of making it.

## Definition of done
- Every acceptance criterion in the story is met
- `npm run build` and `npm run lint` pass with no errors
- Works at mobile (375px) and desktop widths
- Commit message references the story id, e.g. `S7: Home hero section`

## Commands
- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm run lint` — ESLint
