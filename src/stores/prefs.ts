import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Layout = 'grid' | 'list'

const KEY = 'pokemonpaper.layout'
const CRY_KEY = 'pokemonpaper.cries'
const DEX_KEY = 'pokemonpaper.dexEntries'

export const usePrefsStore = defineStore('prefs', () => {
  const layout = ref<Layout>(load())
  const cryEnabled = ref(loadCry())
  const dexEntries = ref(loadDex())

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

  function loadDex(): boolean {
    try {
      const value = localStorage.getItem(DEX_KEY)
      return value === null ? true : value === '1'
    } catch {
      return true
    }
  }

  function setDexEntries(next: boolean) {
    dexEntries.value = next
    try {
      localStorage.setItem(DEX_KEY, next ? '1' : '0')
    } catch {
      /* 无痕模式下忽略 */
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

  return { layout, setLayout, cryEnabled, setCry, dexEntries, setDexEntries }
})
