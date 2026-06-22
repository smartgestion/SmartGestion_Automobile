import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Tauri exposes env vars on the following:
// https://v2.tauri.app/reference/environment-variables/
const host = process.env.TAURI_DEV_HOST;

// @ts-ignore - vite config supports this signature
export default defineConfig(async ({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Vite options tailored for Tauri development.
    // Prevent Vite from obscuring rust errors:
    clearScreen: false,
    server: {
      // Tauri expects a fixed port; fail if it's not available.
      port: 1420,
      strictPort: true,
      // If host is set (mobile/network dev), bind to it; otherwise default.
      host: host || false,
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : host
          ? {
              protocol: 'ws',
              host,
              port: 1421,
            }
          : undefined,
      // Tell Vite to ignore watching `src-tauri` to avoid reload loops.
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    // Env variables starting with the item of `envPrefix` are exposed to the
    // Tauri frontend source code.
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    build: {
      // Tauri uses Chromium on Windows and WebKit on macOS/Linux.
      target:
        process.env.TAURI_ENV_PLATFORM === 'windows'
          ? 'chrome105'
          : 'safari13',
      // Don't minify for debug builds.
      minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
      // Produce sourcemaps for debug builds.
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});
