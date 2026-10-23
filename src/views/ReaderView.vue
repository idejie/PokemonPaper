<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MarkdownLite from '../components/MarkdownLite.vue'
const PdfViewer = defineAsyncComponent(() => import('../components/PdfViewer.vue'))
import { api } from '../core/api'
import { paperLevel } from '../core/level'
import { TYPE_COLORS, TYPES } from '../core/typeMap'
import { usePapersStore } from '../stores/papers'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'

const props = defineProps<{ id: string }>()
const route = useRoute()
const store = usePapersStore()
const settings = useSettingsStore()
const ui = useUiStore()

type Tab = 'abstract' | 'pdf' | 'summary'
const tab = ref<Tab>(route.query.tab === 'pdf' ? 'pdf' : 'abstract')
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
  return raw ? new Date(raw).toLocaleDateString('zh-CN') : ''
})

async function generateSummary() {
  if (!settings.ready) {
    ui.openSettings()
    return
  }
  if (!props.id || !paper.value) return
  summarizing.value = true
  try {
    // 有全文时总结更准；提取失败（扫描版）就退回摘要
    if (!paper.value.hasFullText) {
      await api.paperText(props.id, true).catch(() => null)
    }
    const result = await api.paperSummary(props.id, settings.config)
    await store.update(props.id, { summary: result })
    store.notify('总结已生成')
  } catch (err) {
    store.notify(err instanceof Error ? err.message : '生成失败')
  } finally {
    summarizing.value = false
  }
}

watch(
  () => props.id,
  () => {
    tab.value = route.query.tab === 'pdf' ? 'pdf' : 'abstract'
  },
)

watch(
  () => route.query.tab,
  (value) => {
    if (value === 'pdf') tab.value = 'pdf'
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
        <span
          v-if="lv"
          class="lv mono"
          :style="{ background: lv.tier === '传说' ? '#c9971b' : 'var(--ink)' }"
        >
          Lv.{{ lv.level }}
        </span>
        <span class="spacer" />
        <RouterLink v-if="paper" :to="`/p/${paper.id}`" class="link">详情</RouterLink>
        <a
          v-if="paper"
          :href="`/api/papers/${paper.id}/pdf`"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          下载 PDF ↗
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
          <button :class="{ on: tab === 'abstract' }" @click="tab = 'abstract'">摘要</button>
          <button :class="{ on: tab === 'pdf' }" @click="tab = 'pdf'">原文 PDF</button>
          <button :class="{ on: tab === 'summary' }" @click="tab = 'summary'">总结</button>
        </nav>

        <section v-if="tab === 'abstract'" class="panel">
          <p v-if="paper.abstract" class="abstract">{{ paper.abstract }}</p>
          <p v-else class="empty">
            还没有摘要。回
            <RouterLink :to="`/p/${paper.id}`" class="link">详情页</RouterLink>
            点「抓取」补上。
          </p>
        </section>

        <section v-else-if="tab === 'pdf'" class="pdf-panel">
          <PdfViewer :paper-id="paper.id" />
        </section>

        <section v-else class="panel">
          <div class="toolbar">
            <span class="hint">
              {{
                summary
                  ? `生成于 ${summaryDate}`
                  : settings.ready
                    ? settings.config.model
                    : '还没配置模型'
              }}
            </span>
            <span class="spacer" />
            <button v-if="!settings.ready" type="button" class="btn sm" @click="ui.openSettings()">
              去配置
            </button>
            <button
              v-else
              type="button"
              class="btn sm"
              :disabled="summarizing"
              @click="generateSummary"
            >
              {{ summarizing ? '生成中…' : summary ? '重新生成' : '生成总结' }}
            </button>
          </div>
          <MarkdownLite v-if="summary" :source="summary" />
          <p v-else class="empty">
            基于摘要和全文生成一份 600–900 字的中文总结：问题、方法、结果、局限、适合谁读。
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

.pdf-panel {
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
</style>
