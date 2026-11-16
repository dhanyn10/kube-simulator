import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const bindingsApp = path.resolve(__dirname, './bindings/build-wails/app.ts');
  const bindingsFallback = path.resolve(__dirname, './src/gateway/bindings-fallback.ts');
  const appBindingsTarget = fs.existsSync(bindingsApp) ? bindingsApp : bindingsFallback;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@wailsjs': path.resolve(__dirname, './src/wailsjs'),
        '@bindings/build-wails/app': appBindingsTarget,
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
      host: '127.0.0.1',
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
