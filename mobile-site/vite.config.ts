import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { existsSync } from 'fs';

const useRootNodeModules = existsSync(resolve(__dirname, '../node_modules/vue'));
const nodeModulesPath = useRootNodeModules ? '../node_modules' : './node_modules';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          whitespace: 'condense'
        }
      }
    }),
    {
      name: 'download-proxy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/download' || req.url === '/download/') {
            res.writeHead(302, {
              Location: 'https://streamaggregator.in/download'
            });
            res.end();
            return;
          }
          next();
        });
      }
    }
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      'vue': resolve(__dirname, `${nodeModulesPath}/vue`),
      'vue-router': resolve(__dirname, `${nodeModulesPath}/vue-router`),
      '@vueuse/core': resolve(__dirname, `${nodeModulesPath}/@vueuse/core`),
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
