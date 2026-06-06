import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          whitespace: 'condense'
        }
      }
    })
  ],

  // Allow importing files from the parent directory
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src')
    }
  },
  server: {
    fs: {
      allow: [
        resolve(__dirname),
        resolve(__dirname, '..')
      ]
    }
  },

  build: {
    target: 'es2020',
    minify: 'terser',
    outDir: 'dist',
    emptyOutDir: true
  }
});
