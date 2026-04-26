import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiKey = env.API_KEY || process.env.API_KEY || "";
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Configure hot module replacement
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
