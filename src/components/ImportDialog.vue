<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../core/api'
import { arxivAbsUrl } from '../core/arxiv'
import { bibEntryToPaper, parseBibtex } from '../core/bibtex'
import type { Paper } from '../core/types'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import { t } from '../core/i18n'

interface Draft {
  picked: boolean
  arxiv: string
  title: string
  authors: string
  venue: string
  year: number | null
  abstract: string
  tags: string
  primaryCategory: string
}

type Tab = 'arxiv' | 'bibtex' | 'json'

const store = usePapersStore()
const ui = useUiStore()

const tab = ref<Tab>('arxiv')
const raw = ref('')
const items = ref<Draft[]>([])
const loading = ref(false)
const importing = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const tabs = computed<Array<{ key: Tab; label: string }>>(() => [
  { key: 'arxiv', label: t('arXiv 批量') },
  { key: 'bibtex', label: 'BibTeX' },
  { key: 'json', label: t('JSON 备份') },
])

const pickedCount = computed(() => items.value.filter((item) => item.picked).length)
const allPicked = computed(
  () => items.value.length > 0 && items.value.every((item) => item.picked),
)

function exists(draft: Draft): boolean {
  return Boolean(draft.arxiv) && Boolean(store.byArxiv(draft.arxiv))
}

function reset() {
  items.value = []
  error.value = ''
}

function switchTab(next: Tab) {
  tab.value = next
  raw.value = ''
  reset()
}

function makeDraft(partial: Partial<Draft> & { title: string }): Draft {
  return {
    picked: true,
    arxiv: '',
    authors: '',
    venue: '',
    year: null,
    abstract: '',
    tags: '',
    primaryCategory: '',
    ...partial,
  }
}

async function loadArxiv() {
  const ids = [
    ...new Set([...raw.value.matchAll(/(\d{4}\.\d{4,5})(?:v\d+)?/g)].map((m) => m[1])),
  ]
  if (!ids.length) {
    error.value = t('没识别到 arXiv 编号，检查一下粘贴内容')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const found = await api.previewArxiv(ids)
    items.value = found.map((item) => {
      const primaryCategory = item.primaryCategory || item.category || ''
      return makeDraft({
        arxiv: item.arxiv,
        title: item.title,
        authors: item.authors,
        venue: item.venue,
        year: item.year,
        abstract: item.abstract,
        primaryCategory,
      })
    })
    if (found.length < ids.length) {
      error.value = t('{total} 个编号里只找到 {found} 篇，其余可能编号有误', {
        total: ids.length,
        found: found.length,
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('抓取失败')
  } finally {
    loading.value = false
  }
}

function loadBibtex() {
  error.value = ''
  const entries = parseBibtex(raw.value)
  if (!entries.length) {
    error.value = t('没解析到条目，确认是 BibTeX 格式')
    return
  }
  items.value = entries.map((entry) => {
    const paper = bibEntryToPaper(entry)
    return makeDraft(paper)
  })
}

async function onBibFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  raw.value = await file.text()
  loadBibtex()
  input.value = ''
}

async function onJsonFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    const parsed = JSON.parse(await file.text()) as { papers?: Paper[] } | Paper[]
    const list = Array.isArray(parsed) ? parsed : (parsed.papers ?? [])
    items.value = list
      .filter((paper) => paper && paper.title)
      .map((paper) =>
        makeDraft({
          arxiv: paper.arxiv ?? '',
          title: paper.title,
          authors: paper.authors ?? '',
          venue: paper.venue ?? '',
          year: paper.year ?? null,
          abstract: paper.abstract ?? '',
          tags: paper.tags ?? '',
          primaryCategory: paper.primaryCategory ?? '',
        }),
      )
  } catch {
    error.value = t('JSON 解析失败')
  } finally {
    input.value = ''
  }
}

function toggleAll() {
  const next = !allPicked.value
  items.value.forEach((item) => {
    item.picked = next
  })
}

async function confirmImport() {
  const chosen = items.value.filter((item) => item.picked)
  if (!chosen.length) return
  importing.value = true
  try {
    const payload = chosen.map((item) => {
      const base = {
        arxiv: item.arxiv,
        title: item.title,
        authors: item.authors,
        venue: item.venue,
        year: item.year,
        tags: item.tags,
        abstract: item.abstract,
        primaryCategory: item.primaryCategory,
        categories: item.primaryCategory ? [item.primaryCategory] : [],
        url: item.arxiv ? arxivAbsUrl(item.arxiv) : '',
      }
      // 已存在的论文只更新元数据，不覆盖阅读状态和笔记
      return exists(item) ? base : { ...base, status: 'unread' as const, rating: 0, notes: '' }
    })
    const count = await api.importAll({ papers: payload as never[] })
    await store.load()
    store.notify(t('导入 {n} 篇', { n: count }))
    ui.closeImport()
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('导入失败'))
  } finally {
    importing.value = false
  }
}

function close() {
  ui.closeImport()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="t('导入论文')">
      <header class="head">
        <h2>{{ t('导入论文') }}</h2>
        <button class="close" type="button" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <div class="body">
        <div class="tabs">
          <button
            v-for="item in tabs"
            :key="item.key"
            type="button"
            class="tab"
            :class="{ on: tab === item.key }"
            @click="switchTab(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <template v-if="tab === 'arxiv'">
          <textarea
            v-model="raw"
            class="textarea mono"
            :placeholder="t('每行一个，链接或编号都行：\n2610.28480\nhttps://arxiv.org/pdf/2303.04137\n2406.09246')"
          />
          <div class="row">
            <span class="hint">{{ t('最多 50 个，重复的会自动合并') }}</span>
            <button class="btn" type="button" :disabled="loading || !raw.trim()" @click="loadArxiv">
              {{ loading ? t('抓取中…') : t('解析预览') }}
            </button>
          </div>
        </template>

        <template v-else-if="tab === 'bibtex'">
          <textarea
            v-model="raw"
            class="textarea mono"
            placeholder="@article{chi2023diffusion,&#10;  title={Diffusion Policy},&#10;  author={Chi, Cheng and others},&#10;  eprint={2303.04137}&#10;}"
          />
          <div class="row">
            <button class="btn ghost" type="button" @click="fileInput?.click()">{{ t('选 .bib 文件') }}</button>
            <span class="hint">{{ t('从 Zotero / Google Scholar 导出后整包粘贴') }}</span>
            <button class="btn" type="button" :disabled="!raw.trim()" @click="loadBibtex">
              {{ t('解析预览') }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="dropzone">
            <p>{{ t('选择之前从「导出」得到的 JSON 备份。') }}</p>
            <button class="btn" type="button" @click="fileInput?.click()">{{ t('选择 JSON 文件') }}</button>
            <p class="hint">{{ t('按 arXiv 号合并：已存在的只更新元数据，不覆盖笔记和阅读状态。') }}</p>
          </div>
        </template>

        <p v-if="error" class="error">{{ error }}</p>

        <div v-if="items.length" class="preview">
          <div class="preview-head">
            <span class="mono">{{ t('{n} 条', { n: items.length }) }}</span>
            <button type="button" class="link" @click="toggleAll">
              {{ allPicked ? t('取消全选') : t('全选') }}
            </button>
          </div>
          <label v-for="(item, index) in items" :key="`${item.arxiv}-${index}`" class="item">
            <input v-model="item.picked" type="checkbox" />
            <span class="info">
              <span class="title">{{ item.title }}</span>
              <span class="meta mono">
                {{ item.arxiv || 'NO-ARXIV' }} · {{ item.year || '—' }} ·
                {{ item.venue || '—' }}
              </span>
            </span>
            <span v-if="item.primaryCategory" class="cat mono">{{ item.primaryCategory }}</span>
            <span v-if="exists(item)" class="badge">{{ t('已存在') }}</span>
            <span v-else-if="!item.arxiv" class="badge warn">{{ t('无编号') }}</span>
          </label>
        </div>
      </div>

      <footer class="foot">
        <span class="hint">{{ t('已选 {n} 篇', { n: pickedCount }) }}</span>
        <span class="spacer" />
        <button class="btn ghost" type="button" @click="close">{{ t('取消') }}</button>
        <button
          class="btn"
          type="button"
          :disabled="!pickedCount || importing"
          @click="confirmImport"
        >
          {{ importing ? t('导入中…') : t('导入 {n} 篇', { n: pickedCount }) }}
        </button>
      </footer>

      <input
        ref="fileInput"
        type="file"
        :accept="tab === 'bibtex' ? '.bib,text/plain' : 'application/json'"
        class="sr-only"
        @change="tab === 'bibtex' ? onBibFile($event) : onJsonFile($event)"
      />
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(34, 29, 26, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.sheet {
  width: min(780px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 16px;
  box-shadow: 9px 9px 0 var(--ink);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--red);
  color: #fff;
  border-bottom: 4px solid var(--ink);
}

.head h2 {
  font-size: 15px;
  font-weight: 900;
}

.close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--gold);
  color: var(--ink);
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  display: grid;
  place-items: center;
}

.body {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  overflow-y: auto;
}

.tabs {
  display: flex;
  gap: 6px;
}

.tab {
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

.tab.on {
  background: var(--ink);
  color: var(--paper);
}

.textarea {
  min-height: 150px;
  font-size: 12.5px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.row .btn:last-child {
  margin-left: auto;
}

.hint {
  font-size: 11.5px;
  color: var(--dim);
}

.error {
  font-size: 12.5px;
  color: var(--red);
  font-weight: 700;
}

.dropzone {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 34px 16px;
  border: 2.5px dashed var(--line);
  border-radius: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.preview {
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  overflow: hidden;
  background: var(--paper);
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--panel-2);
  border-bottom: 2px solid var(--ink);
  font-size: 11.5px;
  color: var(--muted);
}

.link {
  background: none;
  border: none;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--blue);
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1.5px dashed var(--line);
  cursor: pointer;
}

.item:last-child {
  border-bottom: none;
}

.item input {
  width: 15px;
  height: 15px;
  accent-color: var(--red);
  flex: none;
}

.info {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.title {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 10.5px;
  color: var(--dim);
}

.cat {
  font-size: 9.5px;
  color: var(--dim);
  font-weight: 700;
  margin-left: auto;
}

.badge {
  flex: none;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1.5px solid var(--ink);
  background: #efe7d4;
  color: var(--muted);
}

.badge.warn {
  background: #ffe8b0;
  color: #7a5b00;
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-top: 3px solid var(--ink);
  background: var(--panel-2);
}

.spacer {
  flex: 1;
}
</style>
