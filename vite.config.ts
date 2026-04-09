import { defineConfig } from 'vite';
import path from 'path';
import { compression } from 'vite-plugin-compression2';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: mode === 'development',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1500,
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: mode === 'production' ? ['console.log', 'console.time', 'console.timeEnd'] : [],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'engine': ['phaser'],
          'ecs': ['bitecs'],
          'noise': ['simplex-noise'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    assetsInlineLimit: 4096,
  },
  plugins: [
    compression({
      algorithm: 'gzip',
      threshold: 1024,
    }),
    compression({
      algorithm: 'brotliCompress',
      threshold: 1024,
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));
