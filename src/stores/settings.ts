import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { PROVIDERS } from '../core/providers'
import type { LlmConfig } from '../core/types'

const STORAGE_KEY = 'pokemonpaper.llm.v1'

function defaults(): LlmConfig {
  const deepseek = PROVIDERS[0]
  return {
    providerId: deepseek.id,
    baseUrl: deepseek.baseUrl,
    apiKey: '',
    model: deepseek.models[0],
  }
}

function load(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<LlmConfig>
    return { ...defaults(), ...parsed }
  } catch {
    return defaults()
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<LlmConfig>(load())
  const ready = computed(
    () => Boolean(config.value.baseUrl && config.value.apiKey && config.value.model),
  )

  function save(next: LlmConfig) {
    config.value = { ...next }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
    } catch {
      /* 隐私模式下写不进去，内存里仍然可用 */
    }
  }

  function clearKey() {
    save({ ...config.value, apiKey: '' })
  }

  return { config, ready, save, clearKey }
})
