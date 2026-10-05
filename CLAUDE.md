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
docs/agent-logs/  # One story log per dev agent (dev-1.md, dev-2.md)
docs/story-inbox.md  # Draft stories from the story-writer, waiting for leader triage
```

- All site text and data lives in `src/content/`. Pages never hardcode bio/project text.
- Pages compose `ui/` components; they don't reinvent buttons/cards.
- Placeholder content is clearly fake (e.g. "Project Alpha", lorem ipsum) so it's easy to find and replace later.

## Team workflow
- **Leader** = the main Claude Code session. Writes/assigns stories in `BACKLOG.md`, reviews dev work, merges, reports progress to Chris. Does not write feature code.
- **story-writer** (product owner) talks with Chris in its own session (`claude --agent story-writer`) and drafts user stories into `docs/story-inbox.md` (ids `D<n>`, status `draft` or `ready`). It writes no code, runs no git, and never edits `BACKLOG.md`.
- **dev-1** (foundation & design system) and **dev-2** (pages & content) are subagents in `.claude/agents/`.
- **Story intake:** when stories become `ready`, the story-writer sends the leader a one-line message (SendMessage). The leader triages at its next convenient point, without interrupting a story in progress. As a fallback in case a message is missed, the leader also checks `docs/story-inbox.md` when planning work. For each `ready` story it reviews scope and criteria, assigns an `S` id and owner, adds it to `BACKLOG.md`, removes it from the inbox, and commits both files on `leader`. `draft` stories are left alone; questions about a story go back to Chris.
- Each story is done on its own branch `story/<id>-<slug>` in an isolated worktree, then reviewed and merged into `leader` by the leader.
- Stay inside your owned folders. If you need a change in another dev's area, report it back instead of making it.

## Git workflow
```
main      ← production. Changes ONLY via a PR from leader, reviewed and merged by Chris on GitHub.
  └ leader   ← integration branch. Only the leader commits, merges and pushes here.
      └ story/<id>-<slug>   ← one per story, branched from leader, worked by one dev agent.
```
- **main**: nobody commits to or pushes `main`, ever. The leader opens a PR `leader → main` when a batch of stories is ready, and Chris reviews and merges it. The leader never merges PRs.
- **leader**: the leader's checkout (repo root) stays on `leader`. The leader merges reviewed story branches into it with `git merge --no-ff`, runs build + lint on the result, then pushes `leader`.
- **story branches**: dev agents create `story/<id>-<slug>` from the latest `leader`, commit small focused commits there (message prefixed with the story id), and never push, merge, rebase shared branches, or force anything. The leader merges or sends back for fixes.
- Never rewrite published history (no force push, no `--no-verify`, no amending pushed commits).
- If a story branch falls behind `leader`, the leader (not the dev) decides whether to merge `leader` into it.

## Story review & cleanup loop
1. The dev finishes the story on `story/<id>-<slug>`, writes a story log entry, and reports to the leader.
2. The leader reviews the code (diff, acceptance criteria, the log entry) and runs build + lint on the branch.
   - Not good: the leader messages the same dev agent (SendMessage) with the changes needed. The dev fixes on the same branch and reports again.
   - Good: the leader merges with `--no-ff` into `leader`, runs build + lint on the result, pushes `leader`, updates `BACKLOG.md`, then messages the dev: approved, merged and pushed.
3. On approval, the dev deletes its own story branch and worktree helper branch (`git branch -d` only; see the agent files).
4. The leader removes the dev's worktree folder (`git worktree remove`) and confirms no stale branches remain.

## Agent logs
Each dev keeps a story log at `docs/agent-logs/<agent>.md` (owned by that agent only). After every story it appends an entry: what it did, how it did it, verification, files, follow-ups. The entry is committed on the story branch, so it merges with the story. If two parallel stories by the same agent both append to the log, the leader resolves the merge conflict by keeping both entries.

Merge-conflict lesson (S6–S8): "keep both sides" is only safe for append-only files (logs, export lists, imports). For lines that *replace* something, such as route elements in `App.tsx`, resolve by hand: keeping both sides once left duplicate placeholder routes that shadowed the real pages, which build and lint did not catch. After resolving, read the merged file.

## Definition of done
- Every acceptance criterion in the story is met
- `npm run build` and `npm run lint` pass with no errors
- Works at mobile (375px) and desktop widths
- Commit message references the story id, e.g. `S7: Home hero section`
- Story log entry added to `docs/agent-logs/<agent>.md`

## Commands
Use Node 22 (`.nvmrc`). On this machine, prefix shell commands with:
`export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH`
(system Node is 18, which current Vite does not support).

- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm run lint` — ESLint
