<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MarkdownLite from '../components/MarkdownLite.vue'
import AvatarSvg from '../components/AvatarSvg.vue'
const PdfViewer = defineAsyncComponent(() => import('../components/PdfViewer.vue'))
import { api } from '../core/api'
import type { PaperQuestion, PublicSummary } from '../core/types'
import { paperLevel } from '../core/level'
import { categoryChipColor } from '../core/palette'
import { locale, t } from '../core/i18n'
import ShareCardDialog from '../components/ShareCardDialog.vue'
import { addReadingTime, recordVisit } from '../core/bond'
import { usePapersStore } from '../stores/papers'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'

const props = defineProps<{ id: string }>()
const route = useRoute()
const store = usePapersStore()
const settings = useSettingsStore()
const ui = useUiStore()
const shareOpen = ref(false)

type Tab = 'abstract' | 'pdf' | 'summary' | 'ask' | 'code'
function tabFromQuery(): Tab {
  const value = String(route.query.tab || '')
  return value === 'pdf' || value === 'summary' || value === 'ask' || value === 'code'
    ? value
    : 'abstract'
}

const tab = ref<Tab>(tabFromQuery())
const summarizing = ref(false)
const pdfBusy = ref(false)
const editingSummary = ref(false)
const summaryDraft = ref('')
const savingSummary = ref(false)
const publicSummaries = ref<PublicSummary[]>([])
const summaryPublicBusy = ref(false)
const questions = ref<PaperQuestion[]>([])
const askDraft = ref('')
const asking = ref(false)
const codeReview = ref('')
const codeReviewAt = ref<string | null>(null)
const reviewing = ref(false)
const askSuggestions = computed(() => [
  t('这篇论文解决了什么问题？'),
  t('用了什么数据集和指标？'),
  t('方法最大的局限是什么？'),
])
const codeReviewDate = computed(() =>
  codeReviewAt.value ? new Date(codeReviewAt.value).toLocaleDateString() : '',
)

async function loadQuestions() {
  if (!paper.value?.id) return
  questions.value = await api.questions(paper.value.id).catch(() => [])
}

async function loadCodeReview() {
  if (!paper.value?.id) return
  const data = await api.codeReview(paper.value.id).catch(() => null)
  codeReview.value = data?.review || ''
  codeReviewAt.value = data?.reviewedAt || null
}

async function ask() {
  const question = askDraft.value.trim()
  if (!paper.value || !question || asking.value) return
  if (!settings.ready) {
    store.notify(t('先在设置里配置模型'))
    ui.openSettings()
    return
  }
  asking.value = true
  try {
    const item = await api.askQuestion(paper.value.id, question, settings.config, locale.value)
    questions.value = [...questions.value, item]
    askDraft.value = ''
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('提问失败'))
  } finally {
    asking.value = false
  }
}

async function analyzeCode() {
  if (!paper.value?.codeUrl || reviewing.value) return
  if (!settings.ready) {
    store.notify(t('先在设置里配置模型'))
    ui.openSettings()
    return
  }
  reviewing.value = true
  try {
    const data = await api.analyzeCode(paper.value.id, settings.config, locale.value)
    codeReview.value = data.review
    codeReviewAt.value = data.reviewedAt
    store.notify(t('代码分析完成'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('代码分析失败'))
  } finally {
    reviewing.value = false
  }
}

async function loadPublicSummaries() {
  if (!paper.value?.id || !paper.value.arxiv) return
  publicSummaries.value = await api.publicSummaries(paper.value.id).catch(() => [])
}

async function toggleSummaryPublic() {
  if (!paper.value) return
  summaryPublicBusy.value = true
  try {
    await store.update(paper.value.id, {
      summaryPublic: !paper.value.summaryPublic,
    } as never)
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('保存失败'))
  } finally {
    summaryPublicBusy.value = false
  }
}

async function likeSummary(item: PublicSummary) {
  try {
    const result = await api.toggleLike('summary', item.id)
    publicSummaries.value = publicSummaries.value.map((entry) =>
      entry.id === item.id
        ? { ...entry, likes: result.likes, likedByMe: result.liked }
        : entry,
    )
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('点赞失败'))
  }
}

const paper = computed(() => store.byId(props.id))

watch(
  [tab, () => paper.value?.id],
  () => {
    if (tab.value === 'ask') void loadQuestions()
    if (tab.value === 'code') void loadCodeReview()
  },
  { immediate: true },
)
const lv = computed(() => (paper.value ? paperLevel(paper.value) : null))
const typeColor = computed(() => categoryChipColor(paper.value?.primaryCategory))
const summary = computed(() => paper.value?.summary ?? '')
const summaryDate = computed(() => {
  const raw = paper.value?.summaryAt
  return raw ? new Date(raw).toLocaleDateString('zh-CN') : ''
})

async function downloadPdf() {
  if (!paper.value || pdfBusy.value) return
  pdfBusy.value = true
  try {
    const updated = await store.ensurePdf(paper.value.id)
    if (updated) window.open(api.pdfUrl(paper.value.id), '_blank')
  } finally {
    pdfBusy.value = false
  }
}

function exportSummary() {
  const paperValue = paper.value
  if (!paperValue?.summary) return
  const meta = [paperValue.authors, [paperValue.venue, paperValue.year].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join('\n\n')
  const body = [
    `# ${paperValue.title}`,
    meta,
    paperValue.arxiv ? `**arXiv:** https://arxiv.org/abs/${paperValue.arxiv}` : '',
    paperValue.codeUrl ? `**Code:** ${paperValue.codeUrl}` : '',
    '## Summary',
    paperValue.summary,
  ]
    .filter(Boolean)
    .join('\n\n')
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${paperValue.arxiv || 'paper'}-summary.md`
  link.click()
  URL.revokeObjectURL(url)
  store.notify(t('已导出 Markdown'))
}

function startEditSummary() {
  summaryDraft.value = paper.value?.summary ?? ''
  editingSummary.value = true
}

function cancelEditSummary() {
  editingSummary.value = false
  summaryDraft.value = ''
}

async function saveManualSummary() {
  if (!props.id) return
  savingSummary.value = true
  try {
    await store.update(props.id, { summary: summaryDraft.value } as never)
    editingSummary.value = false
    store.notify(t('总结已保存'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('保存失败'))
  } finally {
    savingSummary.value = false
  }
}

async function generateSummary() {
  if (!settings.ready) {
    ui.openSettings()
    return
  }
  if (!props.id || !paper.value) return
  summarizing.value = true
  editingSummary.value = false
  try {
    // 有全文时总结更准；提取失败（扫描版）就退回摘要
    if (!paper.value.hasFullText) {
      await api.paperText(props.id, true).catch(() => null)
    }
    const result = await api.paperSummary(props.id, settings.config)
    await store.update(props.id, { summary: result })
    store.notify(t('总结已生成'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('生成失败'))
  } finally {
    summarizing.value = false
  }
}

watch(
  () => props.id,
  () => {
    tab.value = tabFromQuery()
  },
)

watch(
  [tab, () => paper.value?.id],
  () => {
    if (tab.value === 'summary') void loadPublicSummaries()
  },
  { immediate: true },
)

watch(
  () => route.query.tab,
  (value) => {
    if (value === 'pdf') tab.value = 'pdf'
  },
)

let readingTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  recordVisit(props.id)
  if (!store.items.length) await store.load()
  readingTimer = setInterval(() => {
    if (document.visibilityState === 'visible') addReadingTime(props.id, 30)
  }, 30000)
})

onBeforeUnmount(() => {
  if (readingTimer) clearInterval(readingTimer)
})
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div class="topbar">
        <RouterLink to="/" class="back">← {{ t('图鉴') }}</RouterLink>
        <span class="no mono">No.{{ paper?.arxiv || '—' }}</span>
        <span
          v-if="lv"
          class="lv mono"
          :style="{ background: lv.tier === '传说' ? '#c9971b' : 'var(--ink)' }"
        >
          Lv.{{ lv.level }}
        </span>
        <span class="spacer" />
        <button v-if="paper" type="button" class="link" @click="shareOpen = true">
          {{ t('分享卡片') }}
        </button>
        <RouterLink v-if="paper" :to="`/p/${paper.id}`" class="link">{{ t('详情') }}</RouterLink>
        <button v-if="paper" type="button" class="link" :disabled="pdfBusy" @click="downloadPdf">
          {{ pdfBusy ? t('准备中…') : t('下载 PDF ↗') }}
        </button>
      </div>

      <div v-if="!paper" class="missing">
        <h1>{{ t('找不到这篇论文') }}</h1>
        <RouterLink to="/" class="btn">{{ t('返回图鉴') }}</RouterLink>
      </div>

      <template v-else>
        <h1 class="title">{{ paper.title }}</h1>
        <p class="byline">
          <span v-if="paper.authors">{{ paper.authors }}</span>
          <span v-if="paper.venue" class="venue">{{ paper.venue }}</span>
          <span v-if="paper.year" class="mono">{{ paper.year }}</span>
          <span class="chip mono" :style="{ background: typeColor }">
            {{ paper.primaryCategory || t('未分类') }}
          </span>
        </p>

        <nav class="tabs">
          <button :class="{ on: tab === 'abstract' }" @click="tab = 'abstract'">
            {{ t('摘要') }}
          </button>
          <button :class="{ on: tab === 'pdf' }" @click="tab = 'pdf'">{{ t('原文 PDF') }}</button>
          <button :class="{ on: tab === 'summary' }" @click="tab = 'summary'">
            {{ t('总结') }}
          </button>
          <button :class="{ on: tab === 'ask' }" @click="tab = 'ask'">{{ t('问答') }}</button>
          <button :class="{ on: tab === 'code' }" @click="tab = 'code'">{{ t('复现') }}</button>
        </nav>

        <section v-if="tab === 'abstract'" class="panel">
          <p v-if="paper.abstract" class="abstract">{{ paper.abstract }}</p>
          <p v-else class="empty">
            {{ t('还没有摘要。回') }}<RouterLink :to="`/p/${paper.id}`" class="link">{{ t('详情页') }}</RouterLink>{{ t('点「抓取」补上。') }}
          </p>
        </section>

        <section v-else-if="tab === 'pdf'" class="pdf-panel">
          <PdfViewer :paper-id="paper.id" />
        </section>

        <section v-else-if="tab === 'summary'" class="panel">
          <div class="toolbar">
            <span class="hint">
              {{
                summary
                  ? t('生成于 {date}', { date: summaryDate })
                  : settings.ready
                    ? settings.config.model
                    : t('还没配置模型')
              }}
            </span>
            <span class="spacer" />
            <label v-if="summary" class="pub-toggle">
              <input
                type="checkbox"
                :checked="paper.summaryPublic"
                :disabled="summaryPublicBusy"
                @change="toggleSummaryPublic"
              />
              {{ t('公开') }}
            </label>
            <button v-if="summary" type="button" class="btn sm ghost" @click="exportSummary">
              {{ t('导出 Markdown') }}
            </button>
            <button
              v-if="summary && !editingSummary"
              type="button"
              class="btn sm ghost"
              @click="startEditSummary"
            >
              {{ t('编辑') }}
            </button>
            <button
              v-if="!summary && !editingSummary"
              type="button"
              class="btn sm ghost"
              @click="startEditSummary"
            >
              {{ t('手动写总结') }}
            </button>
            <button v-if="!settings.ready" type="button" class="btn sm" @click="ui.openSettings()">
              {{ t('去配置') }}
            </button>
            <button
              v-else
              type="button"
              class="btn sm"
              :disabled="summarizing"
              @click="generateSummary"
            >
              {{ summarizing ? t('生成中…') : summary ? t('重新生成') : t('生成总结') }}
            </button>
          </div>
          <div v-if="editingSummary" class="summary-edit">
            <textarea
              v-model="summaryDraft"
              class="textarea"
              :placeholder="t('用 Markdown 写总结：问题、方法、结果、局限…')"
            />
            <div class="row">
              <span class="hint">{{ t('支持 Markdown：标题、列表、加粗') }}</span>
              <span class="spacer" />
              <button type="button" class="btn sm ghost" @click="cancelEditSummary">
                {{ t('取消') }}
              </button>
              <button
                type="button"
                class="btn sm"
                :disabled="savingSummary"
                @click="saveManualSummary"
              >
                {{ savingSummary ? t('保存中…') : t('保存总结') }}
              </button>
            </div>
          </div>
          <MarkdownLite v-else-if="summary" :source="summary" />
          <p v-else class="empty">
            {{ t('基于摘要和全文生成一份 600–900 字的中文总结：问题、方法、结果、局限、适合谁读。') }}
          </p>

          <div v-if="publicSummaries.length" class="public-sums">
            <h3>{{ t('公开总结') }}</h3>
            <article v-for="item in publicSummaries" :key="item.id" class="public-sum">
              <header>
                <span class="mini-avatar"><AvatarSvg :id="item.avatarId" /></span>
                <b>{{ item.author }}</b>
                <button
                  type="button"
                  class="like"
                  :class="{ on: item.likedByMe }"
                  :title="t('点赞')"
                  @click="likeSummary(item)"
                >
                  ❤ {{ item.likes }}
                </button>
              </header>
              <MarkdownLite :source="item.summary" />
            </article>
          </div>
        </section>

        <section v-else-if="tab === 'ask'" class="panel">
          <div class="toolbar">
            <span class="hint">{{ t('基于摘要与全文回答；找不到会说「论文里没提到」。') }}</span>
            <span class="spacer" />
            <span class="mono hint">{{ questions.length }} Q</span>
          </div>

          <div v-if="!questions.length" class="ask-empty">
            <p>{{ t('问点具体的，比如：') }}</p>
            <div class="suggest-row">
              <button
                v-for="item in askSuggestions"
                :key="item"
                type="button"
                class="suggest"
                @click="askDraft = item; ask()"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <div v-else class="qa-list">
            <article v-for="item in questions" :key="item.id" class="qa">
              <p class="q">{{ item.question }}</p>
              <p class="a">{{ item.answer }}</p>
            </article>
          </div>

          <div class="ask-box">
            <input
              v-model="askDraft"
              class="input"
              maxlength="500"
              :placeholder="t('问这篇论文：方法、数据、局限…')"
              @keydown.enter="ask"
            />
            <button type="button" class="btn" :disabled="asking || !askDraft.trim()" @click="ask">
              {{ asking ? t('思考中…') : t('提问') }}
            </button>
          </div>
        </section>

        <section v-else class="panel">
          <div class="toolbar">
            <a v-if="paper.codeUrl" :href="paper.codeUrl" target="_blank" rel="noreferrer" class="link">
              {{ t('打开代码仓库 ↗') }}
            </a>
            <span v-else class="hint">{{ t('还没有填代码仓库') }}</span>
            <span class="spacer" />
            <span v-if="codeReviewDate" class="mono hint">{{ codeReviewDate }}</span>
            <button
              v-if="paper.codeUrl"
              type="button"
              class="btn sm"
              :disabled="reviewing"
              @click="analyzeCode"
            >
              {{ reviewing ? t('分析中…') : codeReview ? t('重新分析') : t('分析代码') }}
            </button>
          </div>

          <p v-if="!paper.codeUrl" class="empty">
            {{ t('回详情页填上 GitHub 仓库，再回来生成复现计划。') }}
          </p>
          <template v-else>
            <MarkdownLite v-if="codeReview" :source="codeReview" />
            <p v-else class="empty">
              {{ t('抓取 README、依赖文件和目录树，生成复现步骤与风险清单。只做静态分析，不会执行代码。') }}
            </p>
          </template>
        </section>
      </template>
    </div>

    <ShareCardDialog v-if="shareOpen && paper" :paper="paper" @close="shareOpen = false" />
  </div>
</template>

<style scoped>
.page {
  padding: 26px 0 80px;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding-bottom: 14px;
  border-bottom: 2px dashed var(--line);
  margin-bottom: 22px;
}

.back {
  font-weight: 800;
  color: var(--muted);
}

.no {
  color: var(--dim);
  font-weight: 700;
}

.lv {
  color: #fff;
  font-weight: 900;
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1.5px solid var(--ink);
}

.spacer {
  flex: 1;
}

.link {
  color: var(--blue);
  font-weight: 800;
  font-size: 12px;
}

.title {
  font-size: clamp(22px, 3.2vw, 32px);
  line-height: 1.35;
  font-weight: 900;
  letter-spacing: -0.02em;
  max-width: 860px;
}

.byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--dim);
}

.byline .venue {
  font-weight: 700;
  color: var(--muted);
}

.chip {
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  padding: 0 7px;
}

.tabs {
  display: flex;
  gap: 6px;
  margin: 22px 0 16px;
  overflow-x: auto;
}

.tabs button {
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  padding: 4px 16px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--muted);
}

.tabs button.on {
  background: var(--ink);
  color: var(--paper);
}

.panel {
  animation: fade-up 0.22s ease-out both;
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  padding: 22px 24px;
  max-width: 900px;
}

.pdf-panel {
  animation: fade-up 0.22s ease-out both;
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--panel-2);
  box-shadow: var(--shadow-sm);
  padding: 14px;
}

.abstract {
  font-size: 15.5px;
  line-height: 1.95;
  color: var(--text);
  white-space: pre-wrap;
}

.summary-edit {
  display: grid;
  gap: 8px;
}

.summary-edit .textarea {
  min-height: 320px;
  font-size: 13px;
  line-height: 1.75;
}

.summary-edit .row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pub-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--muted);
  flex: none;
}

.public-sums {
  margin-top: 22px;
  border-top: 2px dashed var(--line);
  padding-top: 14px;
  display: grid;
  gap: 10px;
}

.public-sums h3 {
  font-size: 13px;
  font-weight: 900;
}

.public-sum {
  border: 2px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
  padding: 12px 14px;
}

.public-sum header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.mini-avatar {
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--ink);
  border-radius: 5px;
  background: var(--panel);
  padding: 1px;
  display: inline-block;
}

.public-sum .like {
  margin-left: auto;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 8px;
}

.public-sum .like.on {
  background: #ffd7dd;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 2px dashed var(--line);
  font-size: 11.5px;
  color: var(--muted);
}

.hint {
  color: var(--dim);
}

.empty {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.8;
}

.missing {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 80px 0;
}

.missing h1 {
  font-size: 22px;
}

@media (max-width: 640px) {
  .panel {
    padding: 16px;
  }

  .pdf-panel {
    padding: 8px;
  }
}

.qa-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.qa {
  padding: 10px 12px;
  border: 2px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
}

.qa .q {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 900;
}

.qa .a {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.ask-empty {
  display: grid;
  gap: 10px;
  padding: 26px 0;
}

.ask-empty p {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
}

.suggest-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggest {
  padding: 6px 10px;
  border: 2px dashed var(--line);
  border-radius: 999px;
  background: var(--panel);
  font-size: 10px;
  font-weight: 700;
}

.ask-box {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 0;
  background: var(--paper);
}

.ask-box .input {
  flex: 1;
  min-width: 0;
}

</style>
