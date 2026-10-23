<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SpriteSvg from './SpriteSvg.vue'
import { api } from '../core/api'
import { usePapersStore } from '../stores/papers'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { TYPE_KEYS, TYPE_COLORS, TYPES, guessType } from '../core/typeMap'
import { TIER_COLORS, paperLevel } from '../core/level'
import { arxivAbsUrl, parseArxivId } from '../core/arxiv'
import type { Explain, Paper, PaperStatus, TypeKey } from '../core/types'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const store = usePapersStore()
const settings = useSettingsStore()
const ui = useUiStore()

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
  abstract: '',
  codeUrl: '',
  stars: 0,
  citations: 0,
})

const typeTouched = ref(false)
const saving = ref(false)
const fetching = ref(false)
const pdfBusy = ref(false)
const explaining = ref(false)
const syncing = ref(false)

const creating = computed(() => !props.id)
const paper = computed(() => (props.id ? store.byId(props.id) : undefined))
const missing = computed(() => !creating.value && !store.loading && !paper.value)
const seed = computed(() => form.arxiv || form.title || 'pokemonpaper-new')
const typeDef = computed(() => TYPES[form.type] ?? TYPES.normal)
const typeColor = computed(() => TYPE_COLORS[form.type] ?? TYPE_COLORS.normal)

const scholarUrl = computed(
  () => `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${form.title}"`)}`,
)

const level = computed(() => paperLevel({ codeUrl: form.codeUrl, stars: form.stars }))

const explainData = computed<Explain | null>(() => {
  const raw = paper.value?.explain
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Explain
    return parsed && parsed.oneLiner ? parsed : null
  } catch {
    return null
  }
})

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
  form.abstract = entry.abstract
  form.codeUrl = entry.codeUrl
  form.stars = entry.stars
  form.citations = entry.citations
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
  form.type = guessType(form.title, form.tags, form.arxiv, form.abstract)
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
    abstract: form.abstract.trim(),
    codeUrl: form.codeUrl.trim(),
    stars: Number(form.stars) || 0,
    citations: Number(form.citations) || 0,
    url: form.arxiv ? arxivAbsUrl(form.arxiv.trim()) : '',
  }
}

async function fetchMeta() {
  const id = parseArxivId(form.arxiv)
  if (!id) {
    store.notify('先填一个 arXiv 编号或链接')
    return
  }
  fetching.value = true
  try {
    const [item] = await api.previewArxiv([id])
    if (!item) {
      store.notify('arXiv 上没找到这篇')
      return
    }
    form.arxiv = item.arxiv
    form.title = item.title || form.title
    form.authors = item.authors || form.authors
    form.venue = item.venue || form.venue
    form.year = item.year ?? form.year
    form.abstract = item.abstract || form.abstract
    if (!typeTouched.value) {
      form.type = guessType(item.title, item.abstract, item.comment, item.category)
    }
    store.notify('已抓取元数据')
  } catch (err) {
    store.notify(err instanceof Error ? err.message : '抓取失败')
  } finally {
    fetching.value = false
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

async function openPdf() {
  if (!props.id) return
  pdfBusy.value = true
  const updated = await store.ensurePdf(props.id)
  pdfBusy.value = false
  if (updated) window.open(api.pdfUrl(props.id), '_blank', 'noopener')
}

async function syncMetrics() {
  if (!props.id) {
    store.notify('先保存这篇论文，再同步指标')
    return
  }
  syncing.value = true
  try {
    // 先把仓库地址存下来，服务端才能读到
    await store.update(props.id, { codeUrl: form.codeUrl.trim() })
    const result = await store.syncMetrics(props.id, {
      provider: settings.config.scholarProvider,
      apiKey: settings.config.scholarKey,
    })
    if (result) {
      form.stars = result.paper.stars
      form.citations = result.paper.citations
      const scholarOn =
        settings.config.scholarProvider !== 'off' && Boolean(settings.config.scholarKey)
      const citationFailed = result.notes.some((note) => note.includes('引用量抓取失败'))
      const parts: string[] = []
      if (form.codeUrl) parts.push(`${result.paper.stars} star`)
      if (scholarOn && !citationFailed) parts.push(`${result.paper.citations} 引用`)
      const suffix = scholarOn && citationFailed ? '，引用量被限流，可手动填' : ''
      store.notify(parts.length ? `已同步 ${parts.join(' · ')}${suffix}` : `同步失败${suffix}`)
      if (result.notes.length) console.info('[metrics]', result.notes)
    }
  } finally {
    syncing.value = false
  }
}

async function generateExplain() {
  if (!settings.ready) {
    ui.openSettings()
    return
  }
  if (!props.id) {
    store.notify('先保存这篇论文，再生成解读')
    return
  }
  explaining.value = true
  try {
    const result = await api.explain(payload(), settings.config)
    const updated = await store.update(props.id, { explain: JSON.stringify(result) })
    if (updated) store.notify('解读已生成')
  } catch (err) {
    store.notify(err instanceof Error ? err.message : '生成失败')
  } finally {
    explaining.value = false
  }
}

async function remove() {
  if (!props.id) return
  const ok = window.confirm('从图鉴中移除这篇论文？笔记和解读也会一起删除。')
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
        <div class="main">
          <aside class="preview">
            <div class="stage" :class="{ dim: form.status === 'unread' }">
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
              <button type="button" :class="{ on: form.status === 'unread' }" @click="setStatus('unread')">
                未读
              </button>
              <button type="button" :class="{ on: form.status === 'reading' }" @click="setStatus('reading')">
                在读
              </button>
              <button type="button" :class="{ on: form.status === 'read' }" @click="setStatus('read')">
                已读
              </button>
            </div>

            <p class="preview-hint">精灵由 arXiv 编号生成，编号不变，精灵不变。</p>
          </aside>

          <form class="form" @submit.prevent="save">
            <div class="pdfbar">
              <span class="pdf-tag">PDF</span>
              <span class="pdf-state">
                {{ paper?.pdfPath ? `已存本地 · ${paper.pdfPath}` : '未下载，点右侧从 arXiv 拉取' }}
              </span>
              <button
                type="button"
                class="btn sm"
                :disabled="pdfBusy || !props.id || !form.arxiv"
                @click="openPdf"
              >
                {{ pdfBusy ? '处理中…' : paper?.pdfPath ? '阅读原文' : '下载并阅读' }}
              </button>
            </div>

            <div class="row2">
              <label class="field">
                <span>arXiv 编号 / 链接</span>
                <div class="input-row">
                  <input
                    v-model="form.arxiv"
                    class="input mono"
                    placeholder="2610.28480"
                    @input="onArxivInput"
                  />
                  <button
                    type="button"
                    class="btn sm ghost"
                    :disabled="fetching || !form.arxiv"
                    @click="fetchMeta"
                  >
                    {{ fetching ? '…' : '抓取' }}
                  </button>
                </div>
              </label>
              <label class="field">
                <span>年份</span>
                <input v-model.number="form.year" class="input mono" type="number" min="1950" max="2100" />
              </label>
            </div>

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
                <span>属性</span>
                <select v-model="form.type" class="select" @change="typeTouched = true">
                  <option v-for="key in TYPE_KEYS" :key="key" :value="key">{{ TYPES[key].cn }}</option>
                </select>
              </label>
            </div>

            <label class="field">
              <span>标签</span>
              <input v-model="form.tags" class="input" placeholder="world model, humanoid" @input="maybeGuessType" />
            </label>

            <div class="levelbar">
              <div class="lv-badge" :style="{ background: TIER_COLORS[level.tier] }">
                Lv.{{ level.level }}
              </div>
              <div class="lv-info">
                <b>{{ level.tier }}</b>
                <span class="mono">
                  {{ form.codeUrl ? `开源 · ${Number(form.stars) || 0} star` : '未开源，按普通计' }}
                </span>
              </div>
              <button
                type="button"
                class="btn sm ghost"
                :disabled="syncing || creating"
                @click="syncMetrics"
              >
                {{ syncing ? '同步中…' : '同步指标' }}
              </button>
            </div>

            <label class="field">
              <span>开源仓库</span>
              <input
                v-model="form.codeUrl"
                class="input mono"
                placeholder="https://github.com/owner/repo（留空表示未开源）"
              />
            </label>

            <div class="row2">
              <label class="field">
                <span>GitHub Stars</span>
                <input v-model.number="form.stars" class="input mono" type="number" min="0" />
              </label>
              <label class="field">
                <span>
                  引用量
                  <a class="gs-link" :href="scholarUrl" target="_blank" rel="noreferrer">Scholar ↗</a>
                </span>
                <input v-model.number="form.citations" class="input mono" type="number" min="0" />
              </label>
            </div>

            <label class="field">
              <span>摘要</span>
              <textarea
                v-model="form.abstract"
                class="textarea abstract"
                placeholder="点「抓取」自动填；也可以手贴"
              />
            </label>

            <label class="field">
              <span>我的笔记</span>
              <textarea
                v-model="form.notes"
                class="textarea"
                placeholder="一句话结论、方法要点、要复现的东西…"
              />
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

        <section class="explain">
          <header class="explain-head">
            <h3>AI 解读</h3>
            <span class="hint">
              {{ settings.ready ? settings.config.model : '还没配置模型' }}
            </span>
            <button v-if="!settings.ready" type="button" class="btn sm" @click="ui.openSettings()">
              去配置
            </button>
            <button
              v-else
              type="button"
              class="btn sm"
              :disabled="explaining || !paper"
              @click="generateExplain"
            >
              {{ explaining ? '生成中…' : explainData ? '重新生成' : '生成解读' }}
            </button>
          </header>

          <div v-if="!explainData" class="explain-empty">
            用摘要生成一张速读卡：一句话、问题、方法、关键数字、局限、下一步。
            <span v-if="!form.abstract" class="warn">还没有摘要，建议先点「抓取」。</span>
          </div>

          <div v-else class="explain-grid">
            <p class="one-liner">{{ explainData.oneLiner }}</p>
            <div class="block">
              <h4>问题</h4>
              <p>{{ explainData.problem || '—' }}</p>
            </div>
            <div class="block">
              <h4>方法</h4>
              <p>{{ explainData.method || '—' }}</p>
            </div>
            <div class="block">
              <h4>关键数字</h4>
              <ul v-if="explainData.numbers.length">
                <li v-for="(item, i) in explainData.numbers" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">摘要里没有定量结果</p>
            </div>
            <div class="block">
              <h4>局限</h4>
              <ul v-if="explainData.limitations.length">
                <li v-for="(item, i) in explainData.limitations" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">—</p>
            </div>
            <div class="block">
              <h4>下一步</h4>
              <ul v-if="explainData.actions.length">
                <li v-for="(item, i) in explainData.actions" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">—</p>
            </div>
          </div>
        </section>
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
  width: min(980px, 100%);
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
  gap: 18px;
  padding: 20px;
  overflow-y: auto;
}

.main {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 22px;
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
  opacity: 0.7;
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

.gs-link {
  float: right;
  font-size: 9.5px;
  color: var(--blue);
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}

.levelbar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--panel-2);
  box-shadow: 2px 2px 0 var(--ink);
}

.lv-badge {
  flex: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 2px 8px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
}

.lv-info {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.lv-info b {
  font-size: 11.5px;
}

.lv-info span {
  font-size: 10px;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pdfbar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2.5px dashed var(--line);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--paper);
}

.pdf-tag {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 800;
  background: var(--red);
  color: #fff;
  border-radius: 4px;
  padding: 1px 6px;
}

.pdf-state {
  flex: 1;
  font-size: 11.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.input-row {
  display: flex;
  gap: 6px;
}

.input-row .input {
  flex: 1;
  min-width: 0;
}

.textarea.abstract {
  min-height: 86px;
  font-size: 12.5px;
  line-height: 1.6;
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

.explain {
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--panel-2);
  padding: 14px 16px 16px;
}

.explain-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.explain-head h3 {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.explain-head .hint {
  font-size: 11px;
  color: var(--dim);
  flex: 1;
}

.explain-empty {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.65;
}

.explain-empty .warn {
  color: var(--red);
  font-weight: 700;
}

.explain-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 16px;
}

.one-liner {
  grid-column: 1 / -1;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.5;
  border-left: 3px solid var(--red);
  padding-left: 10px;
}

.block h4 {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--dim);
  margin-bottom: 3px;
}

.block p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}

.block ul {
  margin: 0;
  padding-left: 16px;
}

.block li {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text);
}

.muted {
  color: var(--dim) !important;
  font-size: 12px;
}

@media (max-width: 760px) {
  .main {
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

  .explain-grid {
    grid-template-columns: 1fr;
  }
}
</style>
