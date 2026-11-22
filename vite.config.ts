import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Dev: the app runs on :5173 and calls the API on :8000 (CORS allows it).
// Built: the API serves dist/ itself, so the app and API share one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom', setupFiles: ['src/test-setup.ts'] },
})
