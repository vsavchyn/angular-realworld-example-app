import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://code.ionicframework.com https://fonts.googleapis.com; font-src 'self' https://code.ionicframework.com https://fonts.gstatic.com; img-src 'self' https:; connect-src 'self' https://api.realworld.show ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 4200,
    strictPort: true,
    headers: securityHeaders,
  },
  preview: {
    port: 4200,
    strictPort: true,
    headers: securityHeaders,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    pool: 'threads',
  },
});
