import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { t } from '../core/i18n'
import { api } from '../core/api'
import type { Paper, PaperInput, PartyMember } from '../core/types'
import { computeProgress } from '../core/progress'

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
  const likesReceived = ref(0)
  const dailyXp = ref(0)
  const party = ref<PartyMember[]>([])
  const bonusXp = computed(() => likesReceived.value + dailyXp.value)
  const xp = computed(() => computeProgress(items.value, bonusXp.value))
  const level = computed(() => xp.value.level)
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

  let backfillTried = false

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const [list, bonus, members] = await Promise.all([
        api.list(),
        api.progressBonus().catch(() => ({ likes: 0, daily: 0, total: 0 })),
        api.party().catch(() => []),
      ])
      items.value = list
      likesReceived.value = bonus.likes
      dailyXp.value = bonus.daily
      party.value = members
    } catch (err) {
      error.value =
        err instanceof Error && err.message
          ? err.message
          : t('连不上本地服务')
      error.value += t('（确认 pnpm dev 已启动，API 在 8787）')
    } finally {
      loading.value = false
    }

    // 老论文没有分类：后台去 arXiv 补一次，不阻塞首屏
    if (!backfillTried && items.value.some((p) => p.arxiv && !p.primaryCategory)) {
      backfillTried = true
      void api
        .backfillPapers()
        .then(async (result) => {
          if (!result.updated) return
          items.value = await api.list()
          notify(t('已从 arXiv 补全 {n} 篇分类', { n: result.updated }))
        })
        .catch(() => {})
    }
  }

  async function create(input: PaperInput): Promise<Paper | null> {
    try {
      const paper = await api.create(input)
      items.value = [paper, ...items.value]
      notify(t('No.{id} 已登记', { id: paper.arxiv || '—' }))
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : t('保存失败'))
      return null
    }
  }

  async function update(id: string, patch: Partial<Paper>): Promise<Paper | null> {
    try {
      const paper = await api.update(id, patch)
      items.value = items.value.map((p) => (p.id === id ? paper : p))
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : t('保存失败'))
      return null
    }
  }

  async function ensurePdf(id: string): Promise<Paper | null> {
    try {
      const paper = await api.ensurePdf(id)
      items.value = items.value.map((p) => (p.id === id ? paper : p))
      return paper
    } catch (err) {
      notify(err instanceof Error ? err.message : t('PDF 下载失败'))
      return null
    }
  }

  async function syncMetrics(id: string): Promise<{ paper: Paper; notes: string[] } | null> {
    try {
      const result = await api.syncMetrics(id)
      items.value = items.value.map((p) => (p.id === id ? result.paper : p))
      return result
    } catch (err) {
      notify(err instanceof Error ? err.message : t('同步失败'))
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await api.remove(id)
      items.value = items.value.filter((p) => p.id !== id)
      notify(t('已从图鉴移除'))
      return true
    } catch (err) {
      notify(err instanceof Error ? err.message : t('删除失败'))
      return false
    }
  }

  async function markRead(paper: Paper): Promise<Paper | null> {
    const next = await update(paper.id, {
      status: 'read',
      readAt: new Date().toISOString(),
    })
    if (next) notify(t('No.{id} 已点亮！', { id: next.arxiv || '—' }))
    return next
  }

  async function toggleParty(paper: Paper): Promise<boolean> {
    const ids = party.value.map((member) => member.id)
    const next = ids.includes(paper.id)
      ? ids.filter((id) => id !== paper.id)
      : [...ids, paper.id]
    if (next.length > 6) {
      notify(t('队伍最多 6 只'))
      return false
    }
    try {
      party.value = await api.setParty(next)
      notify(
        ids.includes(paper.id)
          ? t('已移出队伍')
          : t('已加入队伍'),
      )
      return true
    } catch (err) {
      notify(err instanceof Error ? err.message : t('队伍更新失败'))
      return false
    }
  }

  function clear() {
    items.value = []
    party.value = []
    likesReceived.value = 0
    dailyXp.value = 0
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
    xp,
    likesReceived,
    dailyXp,
    party,
    toggleParty,
    readCount,
    readingCount,
    level,
    progress,
    load,
    create,
    update,
    remove,
    ensurePdf,
    syncMetrics,
    markRead,
    clear,
    byId,
    byArxiv,
    notify,
  }
})
