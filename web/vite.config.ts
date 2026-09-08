import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
