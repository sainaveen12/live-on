import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Fixed: changed . to /

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-gold': {
        target: 'https://www.goodreturns.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-gold/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    },
  },
});