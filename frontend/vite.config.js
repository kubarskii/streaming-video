import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')

  // Backend URL with fallback
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3000'

  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
          },
        },
      },
      // Ensure service worker is copied to build output
      copyPublicDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[Vite Proxy] →', req.method, req.url, '→', backendUrl + req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[Vite Proxy] ←', proxyRes.statusCode, req.url);
            });
          },
        },
        '/video': {
          target: backendUrl,
          changeOrigin: true,
          bypass: (req, res, options) => {
            // If URL has a path parameter (like /video/123), don't proxy it (let SPA handle it)
            // Only proxy if it has a query string (like /video?file=...)
            if (req.url.startsWith('/video/') || req.url === '/video') {
              console.log('[Vite] Bypassing proxy for SPA route:', req.url);
              return '/index.html'; // Let Vite serve the SPA
            }
            // If it has query params like /video?file=..., proxy to backend
            console.log('[Vite] Proxying video stream:', req.url);
            return null; // Continue with proxy
          },
        },
      },
    },
  }
})
