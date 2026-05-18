import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
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
