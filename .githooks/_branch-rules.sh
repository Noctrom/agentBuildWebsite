
#!/bin/sh# Shared helpers for the repo's git hooks. See "Git workflow" in CLAUDE.md.
current_branch() { git symbolic-ref --quiet --short HEAD 2>/dev/null; }
# Dev agents work in isolated worktrees under .claude/worktrees/.
in_agent_worktree() {
  case "$(git rev-parse --show-toplevel)" in */.claude/worktrees/*) return 0 ;; *) return 1 ;; esac
}
block() { echo "BLOCKED by .githooks: $1" >&2; exit 1; }
