import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const BACKEND = '127.0.0.1:8001';

function localHttps(env) {
  const cert = resolve(ROOT, env.HTTPS_CERT_FILE || 'certs/shaxian-lan.pem');
  const key = resolve(ROOT, env.HTTPS_KEY_FILE || 'certs/shaxian-lan-key.pem');
  if (!existsSync(cert) || !existsSync(key)) {
    return undefined;
  }
  return { cert: readFileSync(cert), key: readFileSync(key) };
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    https: localHttps(loadEnv(mode, ROOT, '')),
    proxy: {
      '/api': { target: `http://${BACKEND}`, changeOrigin: true },
      '/ws': { target: `ws://${BACKEND}`, ws: true },
    },
  },
}));
