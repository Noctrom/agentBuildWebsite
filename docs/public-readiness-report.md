# Public-readiness report (V0.66)

**Scanned by:** leader · **Date:** 2026-10-07 · **Scope:** `leader` at 2602cc6 and `main` at ea9fa6c (both pushed), plus every object reachable from any local ref (316 commits, including the local story branches in progress), and the production build (`npm run build` → `dist/`).

This report only lists findings; apart from this file, nothing was changed. Sensitive values are masked or shortened.

> **Important context: the GitHub repo is already public.** `gh repo view` reports `Noctrom/agentBuildWebsite` as `PUBLIC`, so everything already pushed to `leader` and `main` (including history) can be seen now. The levels below assume that. Nothing needs emergency action: no secrets, phone numbers or street addresses were found anywhere. The one item that needs your decision soon is the Milky Way reference photo (finding R1).

## Summary

| # | Check | Result | Level |
|---|-------|--------|-------|
| S1 | Secrets (scanner + manual) | Checked, nothing found | fine |
| P1 | Phone numbers | Checked, nothing found (text, both résumé PDFs, images) | fine |
| P2 | Street addresses | Checked, nothing found; only cities (Duluth, MN) | fine |
| M1 | Photo and file metadata | Checked, no GPS, camera serial or owner fields | fine |
| L1 | Local paths in current docs | Windows/WSL paths with your Windows user name in 2 docs | should fix |
| L2 | Local paths in history | An agent scratchpad path in an old V0.40 log version | fine (needs Chris's decision only if you want it gone) |
| G1 | Git identity | Your Gmail address on 310 commits | fine (please confirm) |
| R1 | Milky Way reference photo | Source and licence unknown; already on `main` | **must fix** (needs Chris's decision) |
| R2 | Other images, fonts, files | Made by you or the team; no shipped fonts | fine |
| I1 | Ignore rules | Two local Claude files not covered by `.gitignore` | should fix |
| I2 | Things that shouldn't be committed | Checked, none committed | fine |
| W1 | What the live site serves | Only the expected 7 files | fine |

## Findings

### S1 — Secrets: checked, nothing found (fine)
- **Tool:** [gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1 (MIT), the official release binary, checksum verified, run from the session scratchpad (not installed in the repo).
- **Commands:**
  - `gitleaks git --log-opts="--all" --redact -v .` scanned 242 commits (gitleaks skips merge commits, which add no content of their own). No leaks found.
  - `gitleaks dir --redact .` scanned the working tree. No leaks found.
- **Manual check:** a script read every blob in history and searched for `password`, `secret`, `api_key`, `access_token`, `private key`, `BEGIN … PRIVATE`, `sk-`, `ghp_`, `xoxb-`, `AIza`, `aws_` and similar. Every hit was a false positive:
  - the word "passwords" in the Social Media App project description (`src/content/projects.ts`, backlog);
  - the words "secret" and "private key" in this story's own text;
  - "sk-a…" and "sk-t…" inside ordinary words in a log and in `favicon.svg`.
- **`.env` files:** none in any commit. `.gitignore` already covers `.env` and `.env.*`.

### P1 — Phone numbers: checked, nothing found (fine)
- Every text blob in history was searched for US phone formats (`(•••) •••-••••`, `•••-•••-••••`, `+1 …`). There were no matches.
- **`public/resume.pdf`:** both versions in history were checked.
  - The current PDF's text shows name, "Duluth, MN", the email, education, projects, skills and work history. Its only digit runs are years, it has no phone number, and its single link is a `mailto:` to your email.
  - The old placeholder PDF ("Jane Placeholder") has no personal data.
- The screenshots in agent logs (V0.58, V0.59) show the Contact page (name, email, links) and the scenes. They contain no phone number.

### P2 — Street addresses: checked, nothing found (fine)
- History was searched for "number + street name + St/Ave/Rd/Dr/Ln/…" patterns and for "ST 12345" ZIP patterns. There were no matches.
- The only places are cities: Duluth, MN (you, UMD, employers). Cities are allowed under your rules.

### M1 — Photo and file metadata: checked, nothing found (fine)
Every image and PDF ever committed (14 file versions) was opened with Pillow/pypdf.

| File | Metadata found |
|------|----------------|
| `public/christopher-waldriff.jpg` | JFIF header only. No EXIF, no GPS, no camera or owner fields. |
| `public/og-image.png` (2 versions) | None |
| `public/favicon.svg`, `public/photo-placeholder.svg` (all versions) | Only code comments ("PLACEHOLDER favicon (S30)…"); no editor or author data |
| `public/resume.pdf` (current) | Title "Resume", Producer "Skia/PDF … Google Docs Renderer". No author, no XMP. |
| `public/resume.pdf` (old placeholder) | Title "Placeholder Resume", Author "Jane Placeholder" (fake) |
| V0.58 and V0.59 screenshots in `docs/agent-logs/…` | JFIF header; the V0.59 images also carry a standard sRGB colour profile (not personal) |
| `docs/story-inbox/night-sky-Milky-Way-Galaxy.webp` | None (see R1 for its rights) |

### L1 — Local paths in current docs (should fix)
- **What:** two story texts quote the original file locations of your headshot and résumé. They show your Windows user name and your Downloads folder (`C:\Users\<you>\Downloads\…jpg`, `…\Resume (1).pdf`, and the WSL form `/mnt/c/Users/<you>/…`).
  - `docs/backlog/v0/v0.50-v0.74.md`, V0.51 and V0.54 sections (lines 26 and 81)
  - `docs/story-inbox/v0/v0.50-v0.74.md`, the same stories (lines 24 and 79)
- **Also:** the V0.66 story text gives `/mnt/c/Users/<you>/...` and `/home/<wsl-user>/...` as examples. Your WSL user name is the same as your public GitHub name, so this reveals little.
- **Risk:** low. It's a first name and a Downloads file name, but it says how your machine is laid out.
- **Suggested fix:** replace the paths with "supplied by Chris" in those 4 places (a small docs-only story).
- **Suggested owner:** leader (backlog) and story-writer (inbox).

### L2 — Local paths in history (fine; needs Chris's decision only if you want it gone)
- **What:** commits 4404ef7 and 1b011b4 (V0.40 story log, older versions) contain an agent scratchpad path of the form `/tmp/claude-1000/-mnt-c-Users-<you>-…/scratchpad/v040/`. The current log no longer has it.
- **Risk:** low. The same Windows user name as L1.
- **Suggested fix:** leave it. Removing it means rewriting published history, which project rules forbid without your explicit decision. **Needs Chris's decision.**

### G1 — Git identity (fine; please confirm)
| Author / committer | Commits |
|---|---|
| `Noctrom <christopherwaldriff@gmail.com>` | 310 |
| `Noctrom <…+Noctrom@users.noreply.github.com>`, committed by `GitHub <noreply@github.com>` (PR merges on GitHub) | 6 |

- **What:** your Gmail address is public in every commit. It's the same address the site shows on purpose, so this is consistent with your rules.
- **Optional:** if you'd rather keep commits separate from your contact email, set `git config user.email` to your GitHub noreply address for future commits. Past commits keep the Gmail address unless history is rewritten. **Needs Chris's decision** (confirm you're happy, or switch for future commits).

### R1 — Milky Way reference photo: source and licence unknown (must fix; needs Chris's decision)
- **What:** `docs/story-inbox/night-sky-Milky-Way-Galaxy.webp` (1600×828), committed by the leader in 5a0b8e9 during V0.59 triage. It is on `origin/leader` and, through PR #6, on `origin/main`, so it is public now.
- **Related:** the V0.59 side-by-side screenshots (`docs/agent-logs/v0/v0.50-v0.74/v0.59-galaxy-palette/*.jpg`) include a scaled copy of the photo. They are on `origin/leader` only, not yet on `main`.
- **Why it matters:** the file name suggests it was downloaded from the web. Unless it's yours or has a licence that allows redistribution (e.g. public domain/NASA, CC BY with credit), republishing it in a public repo could infringe the photographer's copyright. It is not used by the site itself (W1).
- **Suggested fix:**
  1. Chris: tell me where the photo came from. If its licence allows it, add a credit line and keep it.
  2. Otherwise, a follow-up story removes the photo from the current tree and replaces the photo panel in the two V0.59 screenshots. The story text would then link to the photo's original page instead of copying it. Keep the photo locally, outside the repo (e.g. in `.gitignore`d `docs/story-inbox/local/`), for V0.60's reference.
  3. Removing it from **history** too would need a history rewrite on public branches. **Needs Chris's decision.**
- **Suggested owner:** leader (I committed it). Before the next PR to `main`, I'll hold V0.59's screenshots out of `main` if you prefer.
- **Note:** V0.60 (in progress) also uses this photo as its reference and may add another side-by-side image. I'll apply whatever you decide there as well.

### R2 — Other images, fonts and files (fine)
- **Images:**
  - **Headshot:** your own photo, supplied by you. If someone else took it (e.g. a professional photographer), check you're allowed to publish it.
  - **Team-made:** `og-image.png`, `favicon.svg` and the old `photo-placeholder.svg` were made by the team. The agent-log screenshots are of this site.
- **Fonts:** none shipped. The site uses system font stacks (`ui-sans-serif, system-ui, …`) and loads no web fonts.
- **Code:** npm dependencies (React, React Router, Vite, Tailwind, ESLint …) are open source under permissive licences and aren't committed (only `package-lock.json`, which is intended). The built JS bundles React and React Router, which allow this.

### I1 — Ignore rules (should fix)
- `.gitignore` covers `node_modules`, `dist`, `*.local`, `.env*`, `.vercel`, editor files and `.claude/worktrees/`.
- Not covered:
  - **`.claude/scheduled_tasks.lock`:** exists today and is ignored only by this computer's `.git/info/exclude`. A fresh clone would not ignore it.
  - **`.claude/settings.local.json`:** Claude Code's personal settings file. It doesn't exist yet and isn't matched by `*.local`.
- **Suggested fix:** add both to `.gitignore`.
- **Suggested owner:** leader (repo config).

### I2 — Things that shouldn't be in the repo: checked, none committed (fine)
- No commit has ever contained `.claude/worktrees/`, `node_modules/`, `dist/`, `.env*`, `.vercel/`, `*.log` or Claude memory files. Claude memory lives under `~/.claude/projects/…`, outside the repo.
- `package-lock.json` is committed on purpose; it pins dependency versions for builds.
- Committed `.claude/` files are `agents/*.md` (agent instructions) and `settings.json` (git safety deny rules and the worktree base). Neither has personal data.
- Files deleted from the tree are all harmless and contain no personal data: the old per-agent logs, `story-inbox.md`, placeholder content files, `photo-placeholder.svg`, `ThemeToggle`/`useTheme` and `.gitkeep` files.

### W1 — What the live site serves (fine)
`npm run build` produces exactly:

| File | Size |
|---|---|
| `index.html` | 2.6 KB |
| `assets/index-*.js` | 364 KB |
| `assets/index-*.css` | 41 KB |
| `christopher-waldriff.jpg` | 25 KB |
| `favicon.svg` | 1 KB |
| `og-image.png` | 139 KB |
| `resume.pdf` | 87 KB |

- There are no docs, logs, source maps or reference images, and the bundle contains no local paths.
- `vercel.json` only rewrites all paths to `index.html` (the SPA fallback).

## Findings in old commits (needs Chris's decision)
Nothing in history will be rewritten without your explicit decision.
1. **L2:** the agent scratchpad path in old V0.40 log versions (4404ef7, 1b011b4). Recommendation: leave it.
2. **R1:** the Milky Way photo in 5a0b8e9 (on `main` via PR #6). Recommendation: decide after you check its licence. If it isn't redistributable, removing it from the tree is enough for most purposes; a history rewrite is the only way to remove it completely.
3. **G1:** your Gmail address as the commit author. Recommendation: keep it, since it's already public on the site.

## Suggested follow-up stories
- **Remove local paths from story texts (L1):** owner leader with the story-writer. Docs only.
- **Ignore local Claude files (I1):** owner leader. `.gitignore` only.
- **Milky Way photo (R1):** depends on your answer about its source.
