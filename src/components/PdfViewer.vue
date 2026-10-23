<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { api } from '../core/api'
import { t } from '../core/i18n'
import { usePapersStore } from '../stores/papers'
import type { Annotation } from '../core/types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ paperId: string }>()
const store = usePapersStore()

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const COLORS: Record<string, string> = {
  yellow: '#ffe9a8',
  green: '#c8ecc0',
  blue: '#c3e2ff',
  pink: '#ffd0dc',
}
const COLOR_KEYS = Object.keys(COLORS)

const pagesEl = ref<HTMLElement | null>(null)
const pages = ref<number[]>([])
const scale = ref(1.4)
const loading = ref(true)
const progress = ref(0)
const error = ref('')

const annotations = ref<Annotation[]>([])
const selection = ref<{ page: number; rects: Rect[]; quote: string } | null>(null)
const editing = ref<Annotation | null>(null)
const draft = ref('')

const canvasRefs = new Map<number, HTMLCanvasElement>()
const textRefs = new Map<number, HTMLDivElement>()
let doc: pdfjs.PDFDocumentProxy | null = null
let task: pdfjs.PDFDocumentLoadingTask | null = null

const count = computed(() => annotations.value.length)

function setCanvas(page: number, el: unknown) {
  if (el instanceof HTMLCanvasElement) canvasRefs.set(page, el)
}
function setTextLayer(page: number, el: unknown) {
  if (el instanceof HTMLDivElement) textRefs.set(page, el)
}

function rectsOf(ann: Annotation): Rect[] {
  return Array.isArray(ann.rects) ? ann.rects : []
}

function byPage(page: number): Annotation[] {
  return annotations.value.filter((ann) => ann.page === page)
}

async function loadAnnotations() {
  annotations.value = await api.listAnnotations(props.paperId).catch(() => [])
}

async function renderPage(pageNumber: number) {
  if (!doc) return
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: scale.value })
  const canvas = canvasRefs.get(pageNumber)
  const textDiv = textRefs.get(pageNumber)
  if (!canvas || !textDiv) return

  const ratio = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.floor(viewport.width * ratio)
  canvas.height = Math.floor(viewport.height * ratio)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`

  const context = canvas.getContext('2d')
  if (!context) return
  await page.render({
    canvasContext: context,
    viewport,
    transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
  } as never).promise

  textDiv.innerHTML = ''
  textDiv.style.width = `${viewport.width}px`
  textDiv.style.height = `${viewport.height}px`
  textDiv.style.setProperty('--scale-factor', String(scale.value))
  textDiv.style.setProperty('--total-scale-factor', String(scale.value))
  const layer = new pdfjs.TextLayer({
    textContentSource: page.streamTextContent(),
    container: textDiv,
    viewport,
  })
  await layer.render()
}

async function boot() {
  loading.value = true
  error.value = ''
  try {
    // 本地没有就现下，避免阅读器直接 404
    await fetch(`/api/papers/${props.paperId}/pdf`, {
      method: 'POST',
      credentials: 'same-origin',
    }).then((res) => {
      if (!res.ok) throw new Error(res.status === 401 ? t('请先登录') : t('PDF 下载失败'))
    })

    task = pdfjs.getDocument({
      url: `/api/papers/${props.paperId}/pdf`,
      withCredentials: true,
    })
    doc = await task.promise

    const first = await doc.getPage(1)
    const base = first.getViewport({ scale: 1 })
    const width = pagesEl.value?.clientWidth ?? 820
    scale.value = Math.min(2, Math.max(0.7, (width - 8) / base.width))

    pages.value = Array.from({ length: doc.numPages }, (_, i) => i + 1)
    await nextTick()

    for (const pageNumber of pages.value) {
      await renderPage(pageNumber)
      progress.value = pageNumber
    }
    await loadAnnotations()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('PDF 加载失败')
  } finally {
    loading.value = false
  }
}

function samePage(range: Range): HTMLElement | null {
  const startEl =
    range.startContainer.nodeType === 1
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
  const endEl =
    range.endContainer.nodeType === 1
      ? (range.endContainer as Element)
      : range.endContainer.parentElement
  const startPage = startEl?.closest('.pdf-page') as HTMLElement | null
  const endPage = endEl?.closest('.pdf-page') as HTMLElement | null
  if (!startPage || !endPage || startPage !== endPage) return null
  return startPage
}

function onMouseUp(event: MouseEvent) {
  if (editing.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const pageEl = samePage(range)
  if (!pageEl) {
    if (sel.toString().trim()) store.notify(t('一次标注请在同一页内选择'))
    return
  }
  const pageNumber = Number(pageEl.dataset.page)
  const box = pageEl.getBoundingClientRect()
  const rects: Rect[] = []
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 2 || rect.height < 2) continue
    rects.push({
      x: (rect.left - box.left) / box.width,
      y: (rect.top - box.top) / box.height,
      w: rect.width / box.width,
      h: rect.height / box.height,
    })
  }
  if (!rects.length) return
  const quote = sel.toString().replace(/\s+/g, ' ').trim().slice(0, 2000)
  if (!quote) return
  editing.value = null
  draft.value = ''
  selection.value = { page: pageNumber, rects, quote }
  event.stopPropagation()
}

function cancelSelection() {
  selection.value = null
  draft.value = ''
  window.getSelection()?.removeAllRanges()
}

async function createAnnotation(color: string) {
  if (!selection.value) return
  const { page, rects, quote } = selection.value
  const comment = draft.value.trim()
  const id = await api.createAnnotation(props.paperId, {
    page,
    rects,
    quote,
    color,
    comment,
  } as never)
  annotations.value = [
    ...annotations.value,
    {
      id,
      start: 0,
      end: 0,
      page,
      rects,
      quote,
      color: color as Annotation['color'],
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    },
  ]
  cancelSelection()
  store.notify(t('已高亮'))
}

function openEdit(ann: Annotation) {
  selection.value = null
  editing.value = ann
  draft.value = ann.comment
}

async function saveAnnotation() {
  if (!editing.value) return
  const ann = editing.value
  const comment = draft.value
  await api.updateAnnotation(ann.id, { comment })
  annotations.value = annotations.value.map((item) =>
    item.id === ann.id ? { ...item, comment } : item,
  )
  editing.value = null
  draft.value = ''
  store.notify(t('批注已保存'))
}

async function removeAnnotation() {
  if (!editing.value) return
  const id = editing.value.id
  await api.deleteAnnotation(id)
  annotations.value = annotations.value.filter((item) => item.id !== id)
  editing.value = null
  draft.value = ''
  store.notify(t('已删除标注'))
}

onMounted(boot)

onBeforeUnmount(() => {
  void task?.destroy()
  task = null
  doc = null
})
</script>

<template>
  <div class="viewer">
    <div class="toolbar">
      <span class="mono">{{ t('{n} 页', { n: pages.length }) }}</span>
      <span class="hint">{{ t('在页面上选文字即可高亮 / 写批注') }}</span>
      <span class="spacer" />
      <span class="count mono">{{ t('{n} 条标注', { n: count }) }}</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="loading">
      <span class="spin" />
      {{
        progress
          ? t('渲染 {current}/{total} 页…', { current: progress, total: pages.length })
          : t('正在打开 PDF…')
      }}
    </div>

    <div ref="pagesEl" class="pages" :class="{ hidden: loading }" @mouseup="onMouseUp">
      <div v-for="page in pages" :key="page" class="pdf-page" :data-page="page">
        <canvas :ref="(el) => setCanvas(page, el)" />
        <div class="hl-layer">
          <template v-for="ann in byPage(page)" :key="ann.id">
            <i
              v-for="(rect, index) in rectsOf(ann)"
              :key="`${ann.id}-${index}`"
              class="hl"
              :style="{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                background: COLORS[ann.color],
              }"
              @click.stop="openEdit(ann)"
            />
          </template>
        </div>
        <div :ref="(el) => setTextLayer(page, el)" class="text-layer" />
      </div>
    </div>

    <div v-if="selection || editing" class="annotate-bar" @mousedown.stop>
      <template v-if="selection">
        <span class="sel-quote">“{{ selection.quote.slice(0, 36) }}…”</span>
        <button
          v-for="color in COLOR_KEYS"
          :key="color"
          type="button"
          class="color-dot"
          :style="{ background: COLORS[color] }"
          :title="color"
          @click="createAnnotation(color)"
        />
        <input
          v-model="draft"
          class="input comment-input"
          :placeholder="t('写点批注（可选）')"
          @keydown.enter="createAnnotation('yellow')"
        />
        <button type="button" class="btn sm" @click="createAnnotation('yellow')">
          {{ t('保存') }}
        </button>
        <button type="button" class="btn sm ghost" @click="cancelSelection">{{ t('取消') }}</button>
      </template>

      <template v-else-if="editing">
        <span class="sel-quote">“{{ editing.quote.slice(0, 28) }}…”</span>
        <input
          v-model="draft"
          class="input comment-input"
          :placeholder="t('批注')"
          @keydown.enter="saveAnnotation"
        />
        <button type="button" class="btn sm" @click="saveAnnotation">{{ t('保存') }}</button>
        <button type="button" class="btn sm danger" @click="removeAnnotation">
          {{ t('删除') }}
        </button>
        <button type="button" class="btn sm ghost" @click="editing = null">{{ t('关闭') }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  display: grid;
  gap: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--muted);
  padding-bottom: 10px;
  border-bottom: 2px dashed var(--line);
}

.hint {
  color: var(--dim);
}

.spacer {
  flex: 1;
}

.count {
  color: var(--dim);
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
  padding: 24px 0;
}

.pages {
  display: grid;
  gap: 18px;
  justify-content: center;
}

.pages.hidden {
  visibility: hidden;
  height: 0;
  overflow: hidden;
}

.pdf-page {
  position: relative;
  background: #fff;
  box-shadow: 0 2px 16px rgba(34, 29, 26, 0.18);
  border: 1px solid #e6ddc8;
  margin: 0 auto;
  line-height: 0;
}

.pdf-page canvas {
  display: block;
}

.hl-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.hl {
  position: absolute;
  display: block;
  opacity: 0.45;
  mix-blend-mode: multiply;
  border-radius: 2px;
  pointer-events: auto;
  cursor: pointer;
}

.text-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
}

.text-layer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.text-layer :deep(span),
.text-layer :deep(br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1))
    scale(var(--min-font-size-inv));
}

.text-layer :deep(::selection) {
  background: rgba(59, 91, 167, 0.28);
}

.annotate-bar {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 6px 6px 0 var(--ink);
  padding: 8px 10px;
  max-width: min(92vw, 860px);
}

.sel-quote {
  font-size: 11px;
  color: var(--muted);
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  flex: none;
}

.comment-input {
  width: 210px;
}

@media (max-width: 720px) {
  .annotate-bar {
    flex-wrap: wrap;
    justify-content: center;
  }

  .comment-input {
    width: 140px;
  }
}
</style>
