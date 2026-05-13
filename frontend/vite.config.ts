import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API target:
//   • In Docker (compose service "frontend") → backend service hostname
//   • On host → loopback IPv4 to match how Edge resolves "localhost"
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    // host 0.0.0.0 lets Docker expose the port; on host dev it still works
    host: process.env.VITE_HOST || '127.0.0.1',
    strictPort: true,
    // Polling is required because Windows-host bind mounts don't fire inotify
    watch: { usePolling: !!process.env.VITE_USE_POLLING, interval: 600 },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
