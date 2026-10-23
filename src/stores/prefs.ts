import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Layout = 'grid' | 'list'

const KEY = 'pokemonpaper.layout'
const CRY_KEY = 'pokemonpaper.cries'

export const usePrefsStore = defineStore('prefs', () => {
  const layout = ref<Layout>(load())
  const cryEnabled = ref(loadCry())

  function load(): Layout {
    try {
      const value = localStorage.getItem(KEY)
      return value === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  }

  function loadCry(): boolean {
    try {
      const value = localStorage.getItem(CRY_KEY)
      return value === null ? true : value === '1'
    } catch {
      return true
    }
  }

  function setCry(next: boolean) {
    cryEnabled.value = next
    try {
      localStorage.setItem(CRY_KEY, next ? '1' : '0')
    } catch {
      /* 无痕模式下忽略 */
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

  return { layout, setLayout, cryEnabled, setCry }
})
