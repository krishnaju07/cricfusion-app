import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/cf-dynamic': {
        target: 'https://newwwwapiiiiii.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cf-dynamic/, '/main'),
      },
      '/fc-cdn': {
        target:       'https://in-mc-fblive.fancode.com',
        changeOrigin: true,
        rewrite:      (path) => path.replace(/^\/fc-cdn/, ''),
        // Strip headers that reveal our origin — FanCode CDN 403s on them
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('sec-fetch-site')
            proxyReq.removeHeader('sec-fetch-mode')
            proxyReq.removeHeader('sec-fetch-dest')
            proxyReq.removeHeader('sec-fetch-storage-access')
            proxyReq.removeHeader('sec-fetch-user')
          })
        },
      },
    },
  },
})
