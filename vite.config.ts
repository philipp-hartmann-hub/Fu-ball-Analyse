import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/openliga': {
        target: 'https://api.openligadb.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openliga/, ''),
      },
    },
  },
})
