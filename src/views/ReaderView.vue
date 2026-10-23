<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import MarkdownLite from '../components/MarkdownLite.vue'
import { api } from '../core/api'
import { paperLevel } from '../core/level'
import { TYPE_COLORS, TYPES } from '../core/typeMap'
import { usePapersStore } from '../stores/papers'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'

const props = defineProps<{ id: string }>()
const store = usePapersStore()
const settings = useSettingsStore()
const ui = useUiStore()

type Tab = 'abstract' | 'text' | 'summary'
const tab = ref<Tab>('abstract')

const text = ref('')
const textLoading = ref(false)
const textError = ref('')
const summarizing = ref(false)

const paper = computed(() => store.byId(props.id))
const lv = computed(() => (paper.value ? paperLevel(paper.value) : null))
const typeDef = computed(() => (paper.value ? TYPES[paper.value.type] ?? TYPES.normal : TYPES.normal))
const typeColor = computed(() =>
  paper.value ? TYPE_COLORS[paper.value.type] ?? TYPE_COLORS.normal : TYPE_COLORS.normal,
)
const summary = computed(() => paper.value?.summary ?? '')
const summaryDate = computed(() => {
  const raw = paper.value?.summaryAt
  if (!raw) return ''
  return new Date(raw).toLocaleDateString('zh-CN')
})
const hasText = computed(() => text.value.length > 0 || Boolean(paper.value?.hasFullText))

async function ensureText(force = false) {
  if (!props.id) return
  if (!force && text.value) return
  if (!force && !paper.value?.hasFullText) {
    // 没提取过就自动提取一次
  }
  textLoading.value = true
  textError.value = ''
  try {
    const cached = !force && paper.value?.hasFullText
    const result = await api.paperText(props.id, !cached)
    text.value = result.text
    if (!cached) store.notify(`全文已提取，${result.chars.toLocaleString()} 字`)
  } catch (err) {
    textError.value = err instanceof Error ? err.message : '提取失败'
  } finally {
    textLoading.value = false
  }
}

async function generateSummary() {
  if (!settings.ready) {
    ui.openSettings()
    return
  }
  if (!props.id) return
  summarizing.value = true
  try {
    const result = await api.paperSummary(props.id, settings.config)
    await store.update(props.id, { summary: result })
    store.notify('总结已生成')
  } catch (err) {
    store.notify(err instanceof Error ? err.message : '生成失败')
  } finally {
    summarizing.value = false
  }
}

function switchTab(next: Tab) {
  tab.value = next
  if (next === 'text' && !text.value) void ensureText()
}

watch(
  () => props.id,
  () => {
    text.value = ''
    textError.value = ''
    tab.value = 'abstract'
  },
)

onMounted(async () => {
  if (!store.items.length) await store.load()
})
</script>

<template>
  <div class="page">
    <div class="wrap">
      <div class="topbar">
        <RouterLink to="/" class="back">← 图鉴</RouterLink>
        <span class="no mono">No.{{ paper?.arxiv || '—' }}</span>
        <span v-if="lv" class="lv mono" :style="{ background: lv.tier === '传说' ? '#c9971b' : 'var(--ink)' }">
          Lv.{{ lv.level }}
        </span>
        <span class="spacer" />
        <RouterLink v-if="paper" :to="`/p/${paper.id}`" class="link">详情</RouterLink>
        <a v-if="paper" :href="`/api/papers/${paper.id}/pdf`" target="_blank" rel="noreferrer" class="link">
          PDF ↗
        </a>
      </div>

      <div v-if="!paper" class="missing">
        <h1>找不到这篇论文</h1>
        <RouterLink to="/" class="btn">返回图鉴</RouterLink>
      </div>

      <template v-else>
        <h1 class="title">{{ paper.title }}</h1>
        <p class="byline">
          <span v-if="paper.authors">{{ paper.authors }}</span>
          <span v-if="paper.venue" class="venue">{{ paper.venue }}</span>
          <span v-if="paper.year" class="mono">{{ paper.year }}</span>
          <span class="chip" :style="{ background: typeColor }">{{ typeDef.cn }}</span>
        </p>

        <nav class="tabs">
          <button :class="{ on: tab === 'abstract' }" @click="switchTab('abstract')">摘要</button>
          <button :class="{ on: tab === 'text' }" @click="switchTab('text')">全文</button>
          <button :class="{ on: tab === 'summary' }" @click="switchTab('summary')">总结</button>
        </nav>

        <section v-if="tab === 'abstract'" class="panel">
          <p v-if="paper.abstract" class="abstract">{{ paper.abstract }}</p>
          <p v-else class="empty">
            还没有摘要。回
            <RouterLink :to="`/p/${paper.id}`" class="link">详情页</RouterLink>
            点「抓取」补上。
          </p>
        </section>

        <section v-else-if="tab === 'text'" class="panel">
          <div class="toolbar">
            <span v-if="text" class="mono">{{ text.length.toLocaleString() }} 字</span>
            <span v-else-if="textLoading" class="mono">解析中…</span>
            <span v-else class="hint">还没有提取全文</span>
            <span class="spacer" />
            <button
              v-if="hasText || textError"
              type="button"
              class="btn sm ghost"
              :disabled="textLoading"
              @click="ensureText(true)"
            >
              重新提取
            </button>
            <button
              v-else
              type="button"
              class="btn sm"
              :disabled="textLoading"
              @click="ensureText(true)"
            >
              提取全文
            </button>
          </div>
          <p v-if="textError" class="error">{{ textError }}</p>
          <div v-if="textLoading" class="loading">正在解析 PDF，长论文要等几秒…</div>
          <article v-else-if="text" class="fulltext">{{ text }}</article>
          <p v-else class="empty">点「提取全文」把 PDF 转成可读文本，之后会缓存在本地。</p>
        </section>

        <section v-else class="panel">
          <div class="toolbar">
            <span class="hint">
              {{ summary ? `生成于 ${summaryDate}` : settings.ready ? settings.config.model : '还没配置模型' }}
            </span>
            <span class="spacer" />
            <button
              v-if="!settings.ready"
              type="button"
              class="btn sm"
              @click="ui.openSettings()"
            >
              去配置
            </button>
            <button v-else type="button" class="btn sm" :disabled="summarizing" @click="generateSummary">
              {{ summarizing ? '生成中…' : summary ? '重新生成' : '生成总结' }}
            </button>
          </div>
          <MarkdownLite v-if="summary" :source="summary" />
          <p v-else class="empty">
            用摘要（和已提取的全文）生成一份 600–900 字的中文总结：问题、方法、结果、局限、适合谁读。
          </p>
        </section>
      </template>
    </div>
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
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  padding: 22px 24px;
  max-width: 900px;
}

.abstract {
  font-size: 15.5px;
  line-height: 1.95;
  color: var(--text);
  white-space: pre-wrap;
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

.error {
  color: var(--red);
  font-size: 12.5px;
  font-weight: 700;
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  padding: 20px 0;
}

.fulltext {
  white-space: pre-wrap;
  font-size: 14.5px;
  line-height: 2;
  color: var(--text);
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 8px;
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

  .fulltext {
    font-size: 13.5px;
    line-height: 1.9;
  }
}
</style>
