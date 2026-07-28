import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/futures_agent/**',
          '**/logs/**',
          '**/*.json',
          '**/global_settings.json',
          '**/*.log',
          '**/*.zip',
          '**/.env*',
        ],
      },
    },
  };
});
