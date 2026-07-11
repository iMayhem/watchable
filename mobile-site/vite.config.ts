import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { cloudflareFunctionsDev } from '../vite-plugins/cloudflare-functions-dev';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    cloudflareFunctionsDev(),
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
      'vue': resolve(__dirname, '../node_modules/vue'),
      'vue-router': resolve(__dirname, '../node_modules/vue-router'),
      '@vueuse/core': resolve(__dirname, '../node_modules/@vueuse/core'),
      '@supabase/supabase-js': resolve(__dirname, '../node_modules/@supabase/supabase-js'),
      'axios': resolve(__dirname, '../node_modules/axios'),
      'plyr': resolve(__dirname, '../node_modules/plyr')
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
