import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@wailsjs': path.resolve(__dirname, './src/wailsjs'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@xyflow/react',
        'framer-motion',
        'lucide-react',
        '@headlessui/react',
        'shepherd.js',
        'zustand',
        'zundo',
        'js-yaml',
        'dagre',
        'clsx',
        'tailwind-merge',
      ],
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', '@xyflow/react', 'framer-motion', 'lucide-react', 'zustand'],
          },
        },
      },
    },
    server: {
      strictPort: true,
      warmup: {
        clientFiles: ['./src/main.tsx', './src/App.tsx'],
      },
      fs: {
        allow: ['..'],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
