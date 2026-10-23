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

const settings = useSettingsStore()
const store = usePapersStore()
const ui = useUiStore()

const candidates = computed(() => props.papers.filter((paper) => paper.arxiv))
const aId = ref(candidates.value[0]?.id ?? '')
const bId = ref(candidates.value.find((paper) => paper.id !== aId.value)?.id ?? '')
const a = computed(() => candidates.value.find((paper) => paper.id === aId.value) ?? null)
const b = computed(() => candidates.value.find((paper) => paper.id === bId.value) ?? null)
const busy = ref(false)
const result = ref<{
  idea: string
  seed: string
  category: string
} | null>(null)

async function breed() {
  if (!a.value || !b.value) {
    store.notify(t('至少需要两篇论文'))
    return
  }
  if (aId.value === bId.value) {
    store.notify(t('选两篇不同的论文'))
    return
  }
  if (!settings.ready) {
    store.notify(t('先在设置里配置模型'))
    ui.openSettings()
    return
  }
  busy.value = true
  try {
    result.value = await api.breed(aId.value, bId.value, settings.config, locale.value)
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

      <p class="lead">{{ t('选择两篇论文，模型会给一个可执行的交叉研究点。') }}</p>

      <div class="pickers">
        <label>
          <span>{{ t('论文 A') }}</span>
          <select v-model="aId" class="select">
            <option v-for="paper in candidates" :key="paper.id" :value="paper.id">
              {{ paper.title }}
            </option>
          </select>
        </label>
        <span class="plus">+</span>
        <label>
          <span>{{ t('论文 B') }}</span>
          <select v-model="bId" class="select">
            <option v-for="paper in candidates" :key="paper.id" :value="paper.id">
              {{ paper.title }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="a && b" class="parents">
        <div class="parent">
          <SpriteSvg :seed="a.arxiv || a.title" :category="a.primaryCategory" :status="a.status" />
          <small>{{ a.arxiv }}</small>
        </div>
        <span class="plus">+</span>
        <div class="parent">
          <SpriteSvg :seed="b.arxiv || b.title" :category="b.primaryCategory" :status="b.status" />
          <small>{{ b.arxiv }}</small>
        </div>
        <span class="arrow">→</span>
        <div class="parent hybrid" :class="{ empty: !result }">
          <SpriteSvg
            v-if="result"
            :seed="result.seed"
            :category="result.category"
          />
          <span v-else class="egg">🥚</span>
          <small>{{ result ? t('杂交种') : '?' }}</small>
        </div>
      </div>

      <button
        type="button"
        class="btn"
        :disabled="busy || !a || !b"
        @click="breed()"
      >
        {{ busy ? t('培育中…') : result ? t('再培育一次') : t('生成交叉想法') }}
      </button>

      <article v-if="result" class="idea">
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
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 18px 20px 20px;
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 8px 8px 0 var(--ink);
  display: grid;
  gap: 12px;
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

.pickers {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: end;
}

.pickers label {
  display: grid;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
}

.select {
  width: 100%;
  padding: 6px 8px;
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--panel);
  font-size: 11px;
}

.plus {
  font-size: 18px;
  font-weight: 900;
  padding-bottom: 6px;
}

.parents {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 0;
}

.parent {
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 96px;
  height: 96px;
  padding: 4px;
  border: 2px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
}

.parent.hybrid {
  border-color: #a86b12;
  background: #fff4cf;
}

.parent small {
  font-size: 8px;
  color: var(--muted);
}

.parent .egg {
  font-size: 38px;
  align-self: center;
}

.arrow {
  font-size: 18px;
  font-weight: 900;
}

.idea {
  border: 2px dashed var(--line);
  border-radius: 9px;
  background: var(--panel-2);
  padding: 10px 12px;
}

.idea h3 {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 900;
}

.idea p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.8;
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .pickers {
    grid-template-columns: 1fr;
  }

  .pickers .plus {
    display: none;
  }

  .parents {
    flex-wrap: wrap;
  }
}
</style>
