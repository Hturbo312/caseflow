import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@store': path.resolve(__dirname, './src/store'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
    }
  },
  server: {
    allowedHosts: ['hturbo.top', 'www.hturbo.top'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-graph': ['react-force-graph-2d', 'react-force-graph-3d', '@xyflow/react'],
          'vendor-motion': ['framer-motion'],
          'vendor-ui': ['lucide-react', 'react-markdown'],
          'vendor-state': ['zustand'],
          'vendor-pdf': ['pdfjs-dist'],
        }
      }
    }
  }
})
