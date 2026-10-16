import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built app works both locally (file:// or any
  // localhost path) and when served from a GitHub Pages project subpath
  // (https://<user>.github.io/incident-forge/) without hardcoding the repo name.
  base: './',
})
