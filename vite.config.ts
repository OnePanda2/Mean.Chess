import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from the root of meanchess.siddheshthapa.com, so base is '/'.
// Real HTML entry points (welcome, /play/, /tutorial/, /rules/) let GitHub Pages serve every page
// without a client-side router.
export default defineConfig({
  base: '/',
  plugins: [react()],
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    play: resolve(import.meta.dirname, 'play/index.html'),
    tutorial: resolve(import.meta.dirname, 'tutorial/index.html'),
    rules: resolve(import.meta.dirname, 'rules/index.html'),
  },
})
