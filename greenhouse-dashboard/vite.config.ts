import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PI = 'http://192.168.1.116:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': PI,
      '/socket.io': {
        target: PI,
        ws: true,
      },
    },
  },
})
