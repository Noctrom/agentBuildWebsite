import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // The repo lives on /mnt/c and runs from WSL, which does not forward
      // Windows file-change events, so native watching never fires. Poll
      // instead. Vite already skips node_modules, .git and its cache; we also
      // skip dist and .claude (agent worktrees are full repo copies). These
      // two are anchored to this folder, because a worktree's own path
      // contains ".claude" and a "**/.claude/**" glob would ignore everything.
      usePolling: true,
      interval: 300,
      binaryInterval: 1000,
      ignored: [`${root}dist/**`, `${root}.claude/**`],
    },
  },
})
