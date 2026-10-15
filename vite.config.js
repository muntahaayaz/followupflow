import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project at /followupflow/. Override with VITE_BASE
  // (e.g. VITE_BASE=/ npm run build) for a different host or a custom domain.
  base: process.env.VITE_BASE ?? '/followupflow/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
