<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Paper } from '../core/types'
import { api } from '../core/api'
import { locale, t } from '../core/i18n'
import { useSettingsStore } from '../stores/settings'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import SpriteSvg from './SpriteSvg.vue'

const props = defineProps<{ papers: Paper[] }>()
const emit = defineEmits<{ close: [] }>()

const MAX = 5
const settings = useSettingsStore()
const store = usePapersStore()
const ui = useUiStore()

const candidates = computed(() => props.papers.filter((paper) => paper.arxiv))
const selected = ref<string[]>(candidates.value[0] ? [candidates.value[0].id] : [])
const idea = ref('')
const query = ref('')
const busy = ref(false)
const result = ref<{
  idea: string
  seed: string
  category: string
} | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return candidates.value
  return candidates.value.filter(
    (paper) =>
      paper.title.toLowerCase().includes(q) ||
      paper.arxiv.toLowerCase().includes(q) ||
      paper.authors.toLowerCase().includes(q),
  )
})

const selectedPapers = computed(() =>
  selected.value
    .map((id) => candidates.value.find((paper) => paper.id === id))
    .filter((paper): paper is Paper => Boolean(paper)),
)

function toggle(paper: Paper) {
  if (selected.value.includes(paper.id)) {
    selected.value = selected.value.filter((id) => id !== paper.id)
    return
  }
  if (selected.value.length >= MAX) {
    store.notify(t('最多选 5 篇论文'))
    return
  }
  selected.value = [...selected.value, paper.id]
}

function clear(id: string) {
  selected.value = selected.value.filter((item) => item !== id)
}

async function breed() {
  if (!selected.value.length) {
    store.notify(t('至少选一篇论文'))
    return
  }
  if (!settings.ready) {
    store.notify(t('先在设置里配置模型'))
    ui.openSettings()
    return
  }
  busy.value = true
  try {
    result.value = await api.breed(selected.value, idea.value.trim(), settings.config, locale.value)
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('培育失败'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="breed-overlay" @click.self="emit('close')">
    <section class="breed-sheet" role="dialog" aria-modal="true" aria-label="培育">
      <header>
        <h2>🧬 {{ t('培育') }}</h2>
        <button type="button" class="close" :aria-label="t('关闭')" @click="emit('close')">×</button>
      </header>

      <p class="lead">{{ t('选择 1–5 篇论文，可以加上你的想法。') }}</p>

      <div class="chosen">
        <span v-if="!selectedPapers.length" class="hint">{{ t('还没有选择论文') }}</span>
        <button
          v-for="paper in selectedPapers"
          :key="paper.id"
          type="button"
          class="chosen-chip"
          :title="paper.title"
          @click="clear(paper.id)"
        >
          {{ paper.arxiv }}
          <b>×</b>
        </button>
        <span class="chosen-count mono">{{ selected.length }} / {{ MAX }}</span>
      </div>

      <input v-model="query" class="input search" :placeholder="t('搜索标题 / 作者 / 编号')" />

      <div class="paper-list">
        <label v-for="paper in filtered" :key="paper.id" class="paper-line" :class="{ on: selected.includes(paper.id) }">
          <input
            type="checkbox"
            :checked="selected.includes(paper.id)"
            @change="toggle(paper)"
          />
          <span class="paper-title">{{ paper.title }}</span>
          <span class="mono paper-arxiv">{{ paper.arxiv }}</span>
          <small class="mono">{{ paper.primaryCategory }}</small>
        </label>
        <p v-if="!filtered.length" class="hint">{{ t('没有匹配的论文') }}</p>
      </div>

      <label class="idea">
        <span>{{ t('你的想法（可选）') }}</span>
        <textarea
          v-model="idea"
          class="textarea"
          maxlength="1200"
          :placeholder="t('例如：把扩散策略用到触觉反馈上，重点看 sim2real 差距')"
        />
      </label>

      <div class="parents">
        <div v-for="paper in selectedPapers" :key="paper.id" class="parent">
          <SpriteSvg :seed="paper.arxiv || paper.title" :category="paper.primaryCategory" :status="paper.status" />
          <small class="mono">{{ paper.arxiv }}</small>
        </div>
        <span v-if="selectedPapers.length" class="arrow">→</span>
        <div class="parent hybrid" :class="{ empty: !result }">
          <SpriteSvg v-if="result" :seed="result.seed" :category="result.category" />
          <span v-else class="egg">🥚</span>
          <small>{{ result ? t('杂交种') : '?' }}</small>
        </div>
      </div>

      <button type="button" class="btn" :disabled="busy || !selected.length" @click="breed">
        {{ busy ? t('培育中…') : result ? t('再培育一次') : t('培育 {n} 篇', { n: selected.length }) }}
      </button>

      <article v-if="result" class="idea-result">
        <h3>{{ t('交叉研究点') }}</h3>
        <p>{{ result.idea }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.breed-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(43, 36, 32, 0.55);
}

.breed-sheet {
  width: min(780px, 100%);
  max-height: 92vh;
  overflow: auto;
  padding: 16px 18px 18px;
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 8px 8px 0 var(--ink);
  display: grid;
  gap: 9px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  font-size: 18px;
  font-weight: 900;
}

.close {
  width: 30px;
  height: 30px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  background: #f2c14e;
  font-size: 16px;
  font-weight: 900;
}

.lead {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.chosen {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 26px;
}

.chosen-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: #fff4cf;
  font-size: 9px;
  font-family: var(--mono, monospace);
}

.chosen-chip b {
  font-size: 11px;
}

.chosen-count {
  margin-left: auto;
  font-size: 9px;
  color: var(--muted);
}

.search {
  height: 30px;
  font-size: 11px;
}

.paper-list {
  max-height: 200px;
  overflow: auto;
  border: 2px solid var(--line);
  border-radius: 9px;
  background: var(--panel-2);
}

.paper-line {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-bottom: 1px dashed var(--line);
  font-size: 11px;
  cursor: pointer;
}

.paper-line.on {
  background: #fff4cf;
}

.paper-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.paper-arxiv,
.paper-line small {
  flex: none;
  font-size: 8.5px;
  color: var(--muted);
}

.idea {
  display: grid;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
}

.idea .textarea {
  min-height: 64px;
  font-size: 11px;
}

.parents {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
}

.parent {
  display: grid;
  justify-items: center;
  gap: 1px;
  width: 76px;
  height: 76px;
  padding: 3px;
  border: 2px solid var(--line);
  border-radius: 9px;
  background: var(--panel-2);
}

.parent.hybrid {
  width: 88px;
  height: 88px;
  border-color: #a86b12;
  background: #fff4cf;
}

.parent small {
  font-size: 7.5px;
  color: var(--muted);
}

.parent .egg {
  font-size: 32px;
  align-self: center;
}

.arrow {
  font-size: 18px;
  font-weight: 900;
}

.idea-result {
  border: 2px dashed var(--line);
  border-radius: 9px;
  background: var(--panel-2);
  padding: 10px 12px;
}

.idea-result h3 {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 900;
}

.idea-result p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.8;
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .parents {
    gap: 5px;
  }

  .parent {
    width: 62px;
    height: 62px;
  }
}
</style>
