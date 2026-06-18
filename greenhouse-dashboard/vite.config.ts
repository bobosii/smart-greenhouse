import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PI = 'http://172.20.10.4:3000'

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
