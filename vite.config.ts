import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from the root of meanchess.siddheshthapa.com, so base is '/'.
// Two real HTML entry points let GitHub Pages serve /rules/ without a client-side router.
export default defineConfig({
  base: '/',
  plugins: [react()],
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    rules: resolve(import.meta.dirname, 'rules/index.html'),
  },
})
