import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // Forward all API calls to the Express backend during dev
            '/auth':        'http://localhost:3000',
            '/users':       'http://localhost:3000',
            '/goals':       'http://localhost:3000',
            '/tasks':       'http://localhost:3000',
            '/fixed-events':'http://localhost:3000',
            '/blocks':      'http://localhost:3000',
            '/scheduler':   'http://localhost:3000',
        },
    },
})
