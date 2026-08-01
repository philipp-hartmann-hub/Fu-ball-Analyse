import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const fdToken = env.VITE_FOOTBALL_DATA_TOKEN || env.FOOTBALL_DATA_TOKEN || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/openliga': {
          target: 'https://api.openligadb.de',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openliga/, ''),
        },
        '/api/fd': {
          target: 'https://api.football-data.org/v4',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fd/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (fdToken && !proxyReq.getHeader('x-auth-token')) {
                proxyReq.setHeader('X-Auth-Token', fdToken)
              }
            })
          },
        },
      },
    },
  }
})
