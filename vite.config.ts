import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // MuPDF and djvu-rs ship their own WASM loaders; let Vite copy them as-is.
  optimizeDeps: { exclude: ['mupdf', 'djvu-rs'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
})
