import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        proxy: {
            '/api': {
                target: 'https://dash.evse.cloud',
                changeOrigin: true,
                secure: true,
            },
        },
    },
});
