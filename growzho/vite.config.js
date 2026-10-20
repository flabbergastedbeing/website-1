import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// three.js / shadergradient are pulled in through dynamic imports (see App.jsx and cloth-logo.jsx),
// so Rollup puts them in their own chunks and the first load only ships React and the page itself.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
})