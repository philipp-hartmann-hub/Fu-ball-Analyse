import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(gitSha()),
  },
  server: {
    proxy: {
      '/api/openliga': {
        target: 'https://api.openligadb.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openliga/, ''),
      },
      '/api/fixtures': {
        target: 'https://fixturedownload.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/fixtures/, '/feed/json'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/__fixtures__/**', 'src/**/*.test.ts'],
    },
  },
})
