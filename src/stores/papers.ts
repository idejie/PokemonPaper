import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../core/api'
import type { Paper, PaperInput } from '../core/types'

export interface ToastMessage {
  id: number
  text: string
}

export const usePapersStore = defineStore('papers', () => {
  const items = ref<Paper[]>([])
  const loading = ref(true)
  const error = ref('')
  const toast = ref<ToastMessage | null>(null)
  let toastId = 0
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const total = computed(() => items.value.length)
  const readCount = computed(() => items.value.filter((p) => p.status === 'read').length)
  const readingCount = computed(() => items.value.filter((p) => p.status === 'reading').length)
  const level = computed(() => 1 + Math.floor(readCount.value / 5))
  const progress = computed(() =>
    total.value === 0 ? 0 : Math.round((readCount.value / total.value) * 100),
  )

  function notify(text: string) {
    toastId += 1
    toast.value = { id: toastId, text }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 2600)
  }

  async function load() {
    loading.value = true
    error.value = ''
    try {
      items.value = await api.list()
    } catch (err) {
      error.value =
        err instanceof Error && err.message
          ? err.message
          : '连不上本地服务'
      error.value += '（确认 pnpm dev 已启动，API 在 8787）'
    } finally {
      loading.value = false
    }
  }

  async function create(input: PaperInput): Promise<Paper | null> {
    try {
      const paper = await api.create(input)
      items.value = [paper, ...items.value]
      notify(`No.${paper.arxiv || '—'} 已登记`)
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : '保存失败')
      return null
    }
  }

  async function update(id: string, patch: Partial<Paper>): Promise<Paper | null> {
    try {
      const paper = await api.update(id, patch)
      items.value = items.value.map((p) => (p.id === id ? paper : p))
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : '保存失败')
      return null
    }
  }

  async function ensurePdf(id: string): Promise<Paper | null> {
    try {
      const paper = await api.ensurePdf(id)
      items.value = items.value.map((p) => (p.id === id ? paper : p))
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : 'PDF 下载失败')
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await api.remove(id)
      items.value = items.value.filter((p) => p.id !== id)
      notify('已从图鉴移除')
      return true
    } catch (err) {
      notify(err instanceof Error ? err.message : '删除失败')
      return false
    }
  }

  async function markRead(paper: Paper): Promise<Paper | null> {
    const next = await update(paper.id, {
      status: 'read',
      readAt: new Date().toISOString(),
    })
    if (next) notify(`No.${next.arxiv || '—'} 已点亮！`)
    return next
  }

  function byId(id: string): Paper | undefined {
    return items.value.find((p) => p.id === id)
  }

  function byArxiv(arxiv: string): Paper | undefined {
    return items.value.find((p) => p.arxiv === arxiv)
  }

  return {
    items,
    loading,
    error,
    toast,
    total,
    readCount,
    readingCount,
    level,
    progress,
    load,
    create,
    update,
    remove,
    ensurePdf,
    markRead,
    byId,
    byArxiv,
    notify,
  }
})
