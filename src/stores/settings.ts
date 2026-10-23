import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { PROVIDERS } from '../core/providers'
import type { LlmConfig } from '../core/types'

const STORAGE_KEY = 'pokemonpaper.llm.v1'
const IMAGE_KEY = 'pokemonpaper.image.v1'

export interface ImageConfig {
  baseUrl: string
  apiKey: string
  model: string
}

function imageDefaults(): ImageConfig {
  return { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-image-1' }
}

function loadImage(): ImageConfig {
  try {
    const raw = localStorage.getItem(IMAGE_KEY)
    if (!raw) return imageDefaults()
    return { ...imageDefaults(), ...(JSON.parse(raw) as Partial<ImageConfig>) }
  } catch {
    return imageDefaults()
  }
}

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
  const image = ref<ImageConfig>(loadImage())
  const imageReady = computed(
    () => Boolean(image.value.baseUrl && image.value.apiKey && image.value.model),
  )

  function saveImage(next: ImageConfig) {
    image.value = { ...next }
    try {
      localStorage.setItem(IMAGE_KEY, JSON.stringify(image.value))
    } catch {
      /* 隐私模式 */
    }
  }
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

  return { config, ready, save, clearKey, image, imageReady, saveImage }
})
