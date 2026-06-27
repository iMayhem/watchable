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

  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      'vue': resolve(__dirname, 'node_modules/vue'),
      'vue-router': resolve(__dirname, 'node_modules/vue-router'),
      '@vueuse/core': resolve(__dirname, 'node_modules/@vueuse/core'),
      '@supabase/supabase-js': resolve(__dirname, 'node_modules/@supabase/supabase-js'),
      'axios': resolve(__dirname, 'node_modules/axios')
    }
  },
  server: {
    fs: {
      allow: [
        resolve(__dirname),
        resolve(__dirname, '..')
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true
      }
    }
  },

  build: {
    target: 'es2020',
    minify: 'terser',
    outDir: 'dist',
    emptyOutDir: true
  }
});
