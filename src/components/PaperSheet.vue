<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SpriteSvg from './SpriteSvg.vue'
import { usePapersStore } from '../stores/papers'
import { TYPE_KEYS, TYPE_COLORS, TYPES, guessType } from '../core/typeMap'
import { arxivAbsUrl, parseArxivId } from '../core/arxiv'
import type { Paper, PaperStatus, TypeKey } from '../core/types'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const store = usePapersStore()

const currentYear = new Date().getFullYear()
const form = reactive({
  arxiv: '',
  title: '',
  authors: '',
  venue: '',
  year: currentYear as number | null,
  type: 'normal' as TypeKey,
  status: 'unread' as PaperStatus,
  rating: 0,
  tags: '',
  notes: '',
})

const typeTouched = ref(false)
const saving = ref(false)

const creating = computed(() => !props.id)
const paper = computed(() => (props.id ? store.byId(props.id) : undefined))
const missing = computed(() => !creating.value && !store.loading && !paper.value)
const seed = computed(() => form.arxiv || form.title || 'pokemonpaper-new')
const typeDef = computed(() => TYPES[form.type] ?? TYPES.normal)
const typeColor = computed(() => TYPE_COLORS[form.type] ?? TYPE_COLORS.normal)

function apply(entry: Paper) {
  form.arxiv = entry.arxiv
  form.title = entry.title
  form.authors = entry.authors
  form.venue = entry.venue
  form.year = entry.year ?? currentYear
  form.type = entry.type
  form.status = entry.status
  form.rating = entry.rating
  form.tags = entry.tags
  form.notes = entry.notes
  typeTouched.value = true
}

watch(
  paper,
  (entry) => {
    if (entry) apply(entry)
  },
  { immediate: true },
)

function maybeGuessType() {
  if (typeTouched.value) return
  form.type = guessType(form.title, form.tags, form.arxiv)
}

function onArxivInput() {
  const parsed = parseArxivId(form.arxiv)
  if (parsed && parsed !== form.arxiv) form.arxiv = parsed
  maybeGuessType()
}

function setStatus(status: PaperStatus) {
  form.status = status
}

function setRating(value: number) {
  form.rating = form.rating === value ? 0 : value
}

function payload() {
  return {
    arxiv: form.arxiv.trim(),
    title: form.title.trim(),
    authors: form.authors.trim(),
    venue: form.venue.trim(),
    year: form.year ? Number(form.year) : null,
    type: form.type,
    status: form.status,
    rating: form.rating,
    tags: form.tags.trim(),
    notes: form.notes,
    url: form.arxiv ? arxivAbsUrl(form.arxiv.trim()) : '',
  }
}

async function save() {
  if (!form.title.trim()) {
    store.notify('标题不能为空')
    return
  }
  saving.value = true
  try {
    if (creating.value) {
      const created = await store.create({ ...payload(), title: form.title.trim() })
      if (created) close()
    } else if (props.id) {
      const updated = await store.update(props.id, payload())
      if (updated) {
        store.notify('已保存')
        close()
      }
    }
  } finally {
    saving.value = false
  }
}

async function markLit() {
  form.status = 'read'
  if (creating.value) {
    await save()
    return
  }
  if (!props.id) return
  const updated = await store.update(props.id, {
    ...payload(),
    status: 'read',
    readAt: new Date().toISOString(),
  })
  if (updated) {
    store.notify(`No.${updated.arxiv || '—'} 已点亮！`)
    close()
  }
}

async function remove() {
  if (!props.id) return
  const ok = window.confirm('从图鉴中移除这篇论文？笔记也会一起删除。')
  if (!ok) return
  const done = await store.remove(props.id)
  if (done) close()
}

function close() {
  void router.push('/')
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
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <header class="sheet-head">
        <span class="no mono">No.{{ form.arxiv || 'NEW' }}</span>
        <h2 id="sheet-title">{{ creating ? '登记新论文' : '论文详情' }}</h2>
        <button class="close" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div v-if="missing" class="missing">
        <h3>图鉴里没有这只精灵</h3>
        <p>它可能已经被移除了。</p>
        <button class="btn" type="button" @click="close">返回图鉴</button>
      </div>

      <div v-else class="sheet-body">
        <aside class="preview">
          <div class="stage" :class="{ dim: form.status !== 'read' }">
            <SpriteSvg :seed="seed" :type="form.type" :locked="form.status === 'unread'" />
          </div>

          <div class="preview-meta">
            <span class="type-chip" :style="{ background: typeColor }">{{ typeDef.cn }}</span>
            <span class="mono dim">{{ form.arxiv || '待登记' }}</span>
          </div>

          <div class="stars" role="group" aria-label="评分">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              class="star"
              :class="{ on: star <= form.rating }"
              :aria-label="`${star} 星`"
              @click="setRating(star)"
            >
              ★
            </button>
          </div>

          <div class="seg" role="group" aria-label="阅读状态">
            <button
              type="button"
              :class="{ on: form.status === 'unread' }"
              @click="setStatus('unread')"
            >
              未读
            </button>
            <button
              type="button"
              :class="{ on: form.status === 'reading' }"
              @click="setStatus('reading')"
            >
              在读
            </button>
            <button type="button" :class="{ on: form.status === 'read' }" @click="setStatus('read')">
              已读
            </button>
          </div>

          <p class="preview-hint">精灵由 arXiv 编号生成，编号不变，精灵不变。</p>
        </aside>

        <form class="form" @submit.prevent="save">
          <label class="field">
            <span>arXiv 编号 / 链接</span>
            <input
              v-model="form.arxiv"
              class="input mono"
              placeholder="2610.28480 或 https://arxiv.org/pdf/2610.28480"
              @input="onArxivInput"
            />
          </label>

          <label class="field">
            <span>标题 *</span>
            <input v-model="form.title" class="input" required @input="maybeGuessType" />
          </label>

          <label class="field">
            <span>作者</span>
            <input v-model="form.authors" class="input" placeholder="用逗号分隔" />
          </label>

          <div class="row2">
            <label class="field">
              <span>会议 / 期刊</span>
              <input v-model="form.venue" class="input" placeholder="CoRL / arXiv / Science Robotics" />
            </label>
            <label class="field">
              <span>年份</span>
              <input v-model.number="form.year" class="input mono" type="number" min="1950" max="2100" />
            </label>
          </div>

          <div class="row2">
            <label class="field">
              <span>属性</span>
              <select v-model="form.type" class="select" @change="typeTouched = true">
                <option v-for="key in TYPE_KEYS" :key="key" :value="key">
                  {{ TYPES[key].cn }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>标签</span>
              <input v-model="form.tags" class="input" placeholder="world model, humanoid" @input="maybeGuessType" />
            </label>
          </div>

          <label class="field">
            <span>笔记</span>
            <textarea v-model="form.notes" class="textarea" placeholder="一句话结论、方法要点、要复现的东西…" />
          </label>

          <div class="actions">
            <button v-if="!creating" type="button" class="btn danger" @click="remove">删除</button>
            <span class="spacer" />
            <button type="button" class="btn ghost" @click="close">取消</button>
            <button type="submit" class="btn" :disabled="saving">
              {{ saving ? '保存中…' : '保存' }}
            </button>
            <button v-if="form.status !== 'read'" type="button" class="btn lit" @click="markLit">
              ✦ 点亮
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(34, 29, 26, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.sheet {
  width: min(920px, 100%);
  max-height: calc(100vh - 44px);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 18px;
  box-shadow: 10px 10px 0 var(--ink);
  overflow: hidden;
  animation: pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

@keyframes pop {
  from {
    transform: scale(0.96) translateY(8px);
    opacity: 0.4;
  }
}

.sheet-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--red);
  color: #fff;
  border-bottom: 4px solid var(--ink);
  flex: none;
}

.sheet-head .no {
  background: #fff;
  color: var(--red);
  border: 2px solid var(--ink);
  border-radius: 5px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 800;
}

.sheet-head h2 {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
  flex: 1;
}

.close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--gold);
  color: var(--ink);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  display: grid;
  place-items: center;
}

.sheet-body {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 22px;
  padding: 20px;
  overflow-y: auto;
}

.preview {
  display: grid;
  gap: 10px;
  align-content: start;
}

.stage {
  aspect-ratio: 1;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background-color: #f7ecd2;
  background-image: linear-gradient(rgba(43, 36, 32, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 36, 32, 0.07) 1px, transparent 1px);
  background-size: 20px 20px;
  padding: 12px;
  box-shadow: var(--shadow-sm);
}

.stage.dim :deep(svg) {
  opacity: 0.6;
}

.preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.type-chip {
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 9px;
  box-shadow: 1.5px 1.5px 0 var(--ink);
}

.preview-meta .dim {
  font-size: 10px;
  color: var(--dim);
  font-weight: 700;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  border: none;
  background: none;
  font-size: 21px;
  line-height: 1;
  padding: 0 1px;
  color: #d9cdb2;
  transition: transform 0.1s ease, color 0.1s ease;
}

.star:hover {
  transform: scale(1.15);
}

.star.on {
  color: var(--gold);
  text-shadow: 1px 1px 0 var(--ink);
}

.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  overflow: hidden;
  background: var(--paper);
}

.seg button {
  border: none;
  background: transparent;
  padding: 5px 4px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--muted);
}

.seg button + button {
  border-left: 2.5px solid var(--ink);
}

.seg button.on {
  background: var(--gold);
  color: var(--ink);
}

.preview-hint {
  font-size: 10.5px;
  color: var(--dim);
  line-height: 1.5;
}

.form {
  display: grid;
  gap: 12px;
  align-content: start;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 2px dashed var(--line);
}

.actions .spacer {
  flex: 1;
}

.btn.lit {
  background: linear-gradient(to bottom, #ffe27a, var(--gold));
}

.missing {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 60px 20px;
}

.missing h3 {
  font-size: 20px;
}

.missing p {
  color: var(--muted);
  font-size: 14px;
}

@media (max-width: 760px) {
  .sheet-body {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .preview {
    grid-template-columns: 120px 1fr;
    grid-template-areas:
      'stage meta'
      'stage stars'
      'stage seg'
      'hint hint';
    align-items: center;
    gap: 8px 14px;
  }

  .stage {
    grid-area: stage;
  }

  .preview-meta {
    grid-area: meta;
  }

  .stars {
    grid-area: stars;
  }

  .seg {
    grid-area: seg;
  }

  .preview-hint {
    grid-area: hint;
  }

  .row2 {
    grid-template-columns: 1fr;
  }
}
</style>
