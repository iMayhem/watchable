import { createApp } from 'vue'
import './assets/styles/main.scss'
import App from './App.vue'
import { router } from './routes'

// Create app instance
const app = createApp(App)

// Use router
app.use(router)

// Mount app
app.mount('#app')

// Performance optimizations
if (import.meta.env.PROD) {
  // Prefetch critical routes after initial load
  requestIdleCallback(() => {
    // Manually prefetch critical dynamic imports
    import('./pages/Movies.vue')
    import('./pages/TVShows.vue')
    import('./pages/Anime.vue')
    import('./pages/Search.vue')
    import('./pages/Discover.vue')
  }, { timeout: 2000 })
}

// Development performance monitoring
if (import.meta.env.DEV) {
  console.log('[Performance] App mounted')
  
  // Log route change performance
  router.afterEach((to, from) => {
    if (from.name) {
      console.log(`[Performance] Route: ${String(from.name)} → ${String(to.name)}`)
    }
  })
}