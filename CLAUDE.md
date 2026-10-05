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
BACKLOG.md        # Index: one row per version, linking to its full text
docs/backlog/     # Full story text, batches of 25: v0/v0.00-v0.24.md, v0/v0.25-v0.49.md, …
docs/story-inbox/ # Story-writer: drafts.md (unnumbered) + v0/<batch>.md (approved stories)
docs/agent-logs/  # One log file per story: v0/<batch>/v0.07-about-page.md
```

- All site text and data lives in `src/content/`. Pages never hardcode bio/project text.
- Pages compose `ui/` components; they don't reinvent buttons/cards.
- Placeholder content is clearly fake (e.g. "Project Alpha", lorem ipsum) so it's easy to find and replace later.

## Team workflow
- **Leader** = the main Claude Code session. Writes/assigns stories in `BACKLOG.md`, reviews dev work, merges, reports progress to Chris. Does not write feature code.
- **story-writer** (product owner) talks with Chris in its own session (`claude --agent story-writer`) and drafts user stories in `docs/story-inbox/`: unnumbered drafts in `drafts.md`; when Chris approves a story it gets the next free version and moves to the batch file (status `ready`). It writes no code, runs no git, and never edits `BACKLOG.md`.
- **dev-1** (foundation & design system) and **dev-2** (pages & content) are subagents in `.claude/agents/`.
- **Story intake:** when stories become `ready`, the story-writer sends the leader a one-line message (SendMessage). The leader triages at its next convenient point, without interrupting a story in progress. As a fallback in case a message is missed, the leader also checks `docs/story-inbox/` when planning work. For each `ready` story it reviews scope and criteria, picks an owner, adds a row to `BACKLOG.md` and the full text to the matching `docs/backlog/` batch file, sets the inbox copy's status to `in backlog` (it stays as the record of what Chris approved), and commits on `leader`. If the leader splits a story, the extra parts take the next free versions. Drafts are left alone; questions about a story go back to Chris.
- **Versions:** every story has one id, `V<major>.<nn>`, each story +0.01 (V0.07 is the 7th story; V0.00 is the starting point, not a story). Files are grouped in batches of 25 per whole number: `v0.00-v0.24`, `v0.25-v0.49`, `v0.50-v0.74`, `v0.75-v0.99`; V1.00 starts a new folder `v1/`. The first story in a new batch creates its batch file (backlog, inbox, log folder). Before V0.34 stories used `S<n>`/`D<n>` ids; the mapping table is in `BACKLOG.md`.
- Each story is done on its own branch `story/v0.35-<slug>` (lower-case version) in an isolated worktree, then reviewed and merged into `leader` by the leader.
- Stay inside your owned folders. If you need a change in another dev's area, report it back instead of making it.

## Git workflow
```
main      ← production. Changes ONLY via a PR from leader, reviewed and merged by Chris on GitHub.
  └ leader   ← integration branch. Only the leader commits, merges and pushes here.
      └ story/v0.35-<slug>   ← one per story, branched from leader, worked by one dev agent.
```
- **main**: nobody commits to or pushes `main`, ever. The leader opens a PR `leader → main` when a batch of stories is ready, and Chris reviews and merges it. The leader never merges PRs.
- **leader**: the leader's checkout (repo root) stays on `leader`. The leader merges reviewed story branches into it with `git merge --no-ff`, runs build + lint on the result, then pushes `leader`.
- **story branches**: dev agents create `story/v0.35-<slug>` from the latest `leader`, commit small focused commits there (message prefixed with the version, e.g. `V0.35:`), and never push, merge, rebase shared branches, or force anything. The leader merges or sends back for fixes.
- Never rewrite published history (no force push, no `--no-verify`, no amending pushed commits).
- If a story branch falls behind `leader`, the leader (not the dev) decides whether to merge `leader` into it.

## Story review & cleanup loop
1. The dev finishes the story on its `story/v0.35-<slug>` branch, writes the story's log file, and reports to the leader.
2. The leader reviews the code (diff, acceptance criteria, the log entry) and runs build + lint on the branch.
   - Not good: the leader messages the same dev agent (SendMessage) with the changes needed. The dev fixes on the same branch and reports again.
   - Good: the leader merges with `--no-ff` into `leader`, runs build + lint on the result, pushes `leader`, updates the story's status in `BACKLOG.md` (and ticks its criteria in the `docs/backlog/` batch file), then messages the dev: approved, merged and pushed.
3. On approval, the dev deletes its own story branch and worktree helper branch (`git branch -d` only; see the agent files).
4. The leader removes the dev's worktree folder (`git worktree remove`) and confirms no stale branches remain.

## Agent logs
Every story gets its own log file, written by the dev who did it: `docs/agent-logs/v0/<batch>/v0.35-<slug>.md` (e.g. `docs/agent-logs/v0/v0.00-v0.24/v0.07-about-page.md`), with the agent named inside. It covers what was done, how, verification, files and follow-ups, and is committed on the story branch, so it merges with the story. One file per story means parallel stories never conflict on logs. Logs from before V0.34 were split out of the old per-agent files with ids renumbered and content otherwise unchanged.

Merge-conflict lesson (V0.06–V0.08): "keep both sides" is only safe for append-only files (logs, export lists, imports). For lines that *replace* something, such as route elements in `App.tsx`, resolve by hand: keeping both sides once left duplicate placeholder routes that shadowed the real pages, which build and lint did not catch. After resolving, read the merged file.

## Definition of done
- Every acceptance criterion in the story is met
- `npm run build` and `npm run lint` pass with no errors
- Works at mobile (375px) and desktop widths
- Commit message starts with the version, e.g. `V0.35: Pin header to the top`
- Story log file added at `docs/agent-logs/v0/<batch>/v0.35-<slug>.md`

## Commands
Use Node 22 (`.nvmrc`). On this machine, prefix shell commands with:
`export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH`
(system Node is 18, which current Vite does not support).

- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm run lint` — ESLint
