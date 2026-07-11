import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { cloudflareFunctionsDev } from '../vite-plugins/cloudflare-functions-dev';

const useRootNodeModules = existsSync(resolve(__dirname, '../node_modules/vue'));
const nodeModulesPath = useRootNodeModules ? '../node_modules' : './node_modules';

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
      'vue': resolve(__dirname, `${nodeModulesPath}/vue`),
      'vue-router': resolve(__dirname, `${nodeModulesPath}/vue-router`),
      '@vueuse/core': resolve(__dirname, `${nodeModulesPath}/@vueuse/core`),
      '@supabase/supabase-js': resolve(__dirname, `${nodeModulesPath}/@supabase/supabase-js`),
      'axios': resolve(__dirname, `${nodeModulesPath}/axios`),
      'plyr': resolve(__dirname, `${nodeModulesPath}/plyr`)
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
