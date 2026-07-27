import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8001', changeOrigin: false },
      '/ws': { target: 'ws://localhost:8001', ws: true },
    },
  },
});
