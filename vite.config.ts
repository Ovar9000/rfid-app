import { defineConfig } from 'vite';

// BASE_PATH lets the GitHub Pages workflow serve from /<repo>/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { chunkSizeWarningLimit: 800 },
  test: { environment: 'node' },
});
