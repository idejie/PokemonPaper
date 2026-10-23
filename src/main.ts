import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './style.css'

// A deploy replaces hashed chunks. If a page still references an old one,
// reload once instead of failing the dynamic import forever.
window.addEventListener('vite:preloadError', () => {
  const key = 'pokemonpaper.preload-reload'
  const last = Number(sessionStorage.getItem(key) || 0)
  if (Date.now() - last < 10000) return
  sessionStorage.setItem(key, String(Date.now()))
  window.location.reload()
})

createApp(App).use(createPinia()).use(router).mount('#app')
