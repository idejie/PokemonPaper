import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Layout = 'grid' | 'list'

const KEY = 'pokemonpaper.layout'

export const usePrefsStore = defineStore('prefs', () => {
  const layout = ref<Layout>(load())

  function load(): Layout {
    try {
      const value = localStorage.getItem(KEY)
      return value === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  }

  function setLayout(next: Layout) {
    layout.value = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* 无痕模式下忽略 */
    }
  }

  return { layout, setLayout }
})
