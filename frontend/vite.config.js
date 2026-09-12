import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/flow-translate/' : '/',
  server: {
    // [FIX #21] Ограничены разрешённые хосты (было true — уязвимость DNS Rebinding)
    allowedHosts: ['.loca.lt'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})