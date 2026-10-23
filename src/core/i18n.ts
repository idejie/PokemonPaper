import { computed, ref } from 'vue'
import { pagesDict } from './i18n.pages'
import { dialogsDict } from './i18n.dialogs'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'pokemonpaper.locale'
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null

export const locale = ref<Locale>(saved === 'en' ? 'en' : 'zh')
export const localeSwitch = computed(() => (locale.value === 'zh' ? 'EN' : '中'))

const dict: Record<string, string> = { ...pagesDict, ...dialogsDict }

/**
 * 以中文原文作为 key 翻译。英文缺词时回退中文，不会出现空白。
 * 支持 {n} 这类占位符：t('共 {n} 篇', { n: 3 })
 */
export function t(zh: string, vars?: Record<string, string | number>): string {
  let out = locale.value === 'zh' ? zh : dict[zh] ?? zh
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      out = out.replaceAll(`{${key}}`, String(value))
    }
  }
  return out
}

export function setLocale(next: Locale): void {
  locale.value = next
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
}

export function toggleLocale(): void {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}

document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
