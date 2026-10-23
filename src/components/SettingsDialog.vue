<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { PROVIDERS, providerById } from '../core/providers'
import { useSettingsStore } from '../stores/settings'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import { usePrefsStore } from '../stores/prefs'
import { api } from '../core/api'
import type { PdfJob } from '../core/types'
import { t } from '../core/i18n'
import { playCry } from '../core/cry'

const settings = useSettingsStore()
const store = usePapersStore()
const ui = useUiStore()
const prefs = usePrefsStore()
const spriteJob = ref<{
  running: boolean
  total: number
  done: number
  failed: number
  current: string
  finishedAt: string | null
} | null>(null)
const artPending = computed(
  () => store.items.filter((paper) => paper.arxiv && !paper.spriteUrl).length,
)
const spritePct = computed(() =>
  spriteJob.value?.total
    ? Math.round(((spriteJob.value.done + spriteJob.value.failed) / spriteJob.value.total) * 100)
    : 0,
)
let spriteTimer: ReturnType<typeof setInterval> | null = null

async function refreshSpriteJob() {
  spriteJob.value = await api.spriteBatchStatus().catch(() => null)
}

function startSpritePolling() {
  if (spriteTimer) clearInterval(spriteTimer)
  spriteTimer = setInterval(async () => {
    await refreshSpriteJob()
    if (!spriteJob.value?.running) {
      if (spriteTimer) clearInterval(spriteTimer)
      spriteTimer = null
      await store.load()
    }
  }, 2000)
}

async function startSpriteBatch() {
  if (!settings.imageReady) {
    store.notify(t('先在设置里配置图像模型'))
    return
  }
  try {
    spriteJob.value = await api.startSpriteBatch(settings.image)
    store.notify(t('批量任务已开始'))
    startSpritePolling()
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('启动失败'))
  }
}
function toggleCry(event: Event) {
  prefs.setCry((event.target as HTMLInputElement).checked)
}

function toggleDexEntries(event: Event) {
  prefs.setDexEntries((event.target as HTMLInputElement).checked)
}

const form = reactive({ ...settings.config })
const imageForm = reactive({ ...settings.image })
const showKey = ref(false)
const pdfJob = ref<PdfJob | null>(null)
let pdfTimer: number | undefined

const missingPdf = computed(
  () => store.items.filter((paper) => paper.arxiv && !paper.pdfPath).length,
)

async function pollPdfJob() {
  const job = await api.pdfBackfillStatus()
  pdfJob.value = job
  if (!job.running) {
    window.clearInterval(pdfTimer)
    pdfTimer = undefined
    if (job.total) {
      store.notify(
        t('批量下载完成：成功 {done} 篇，失败 {failed} 篇', {
          done: job.done,
          failed: job.failed,
        }),
      )
      await store.load()
    }
  }
}

async function startPdfDownload() {
  if (pdfJob.value?.running) return
  pdfJob.value = await api.startPdfBackfill()
  window.clearInterval(pdfTimer)
  pdfTimer = window.setInterval(pollPdfJob, 1500)
}
const provider = computed(() => providerById(form.providerId))

function selectProvider(id: string) {
  form.providerId = id
  const next = providerById(id)
  if (next.id !== 'custom') {
    form.baseUrl = next.baseUrl
    form.model = next.models[0] ?? ''
  }
}

function save() {
  if (!form.baseUrl.trim() || !form.model.trim()) {
    store.notify(t('Base URL 和模型名不能为空'))
    return
  }
  settings.save({ ...form, baseUrl: form.baseUrl.trim(), model: form.model.trim() })
  settings.saveImage({
    ...imageForm,
    baseUrl: imageForm.baseUrl.trim(),
    model: imageForm.model.trim(),
  })
  store.notify(t('模型设置已保存到本地'))
  ui.closeSettings()
}

function close() {
  ui.closeSettings()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  void api.pdfBackfillStatus().then((job) => {
    pdfJob.value = job
    if (job.running) pdfTimer = window.setInterval(pollPdfJob, 1500)
  }).catch(() => {})
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.clearInterval(pdfTimer)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
onMounted(async () => {
  await refreshSpriteJob()
  if (spriteJob.value?.running) startSpritePolling()
})

onBeforeUnmount(() => {
  if (spriteTimer) clearInterval(spriteTimer)
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="t('模型设置')">
      <header class="head">
        <h2>{{ t('模型设置') }}</h2>
        <button class="close" type="button" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <div class="body">
        <p class="lead">
          {{ t('解读用 OpenAI 兼容接口。选一个厂商，填自己的 API Key。') }}
          <b>{{ t('Key 只存在这台浏览器') }}</b>{{ t('，请求经本地服务转发，不会上传到别处。') }}
        </p>

        <div class="providers">
          <button
            v-for="item in PROVIDERS"
            :key="item.id"
            type="button"
            class="provider"
            :class="{ on: form.providerId === item.id }"
            @click="selectProvider(item.id)"
          >
            <b>{{ t(item.name) }}</b>
            <small>{{ t(item.note) }}</small>
          </button>
        </div>

        <label class="field">
          <span>Base URL</span>
          <input v-model="form.baseUrl" class="input mono" placeholder="https://api.deepseek.com/v1" />
        </label>

        <label class="field">
          <span>{{ t('模型') }}</span>
          <input
            v-model="form.model"
            class="input mono"
            :list="`models-${form.providerId}`"
            placeholder="deepseek-chat"
          />
          <datalist :id="`models-${form.providerId}`">
            <option v-for="model in provider.models" :key="model" :value="model" />
          </datalist>
        </label>

        <label class="field">
          <span>API Key</span>
          <div class="key-row">
            <input
              v-model="form.apiKey"
              class="input mono"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-..."
              autocomplete="off"
            />
            <button type="button" class="btn ghost sm" @click="showKey = !showKey">
              {{ showKey ? t('隐藏') : t('显示') }}
            </button>
          </div>
        </label>

        <p v-if="provider.keyUrl" class="hint">
          {{ t('没有 Key？') }}
          <a :href="provider.keyUrl" target="_blank" rel="noreferrer">{{ t('去 {name} 申请 →', { name: t(provider.name) }) }}</a>
        </p>

        <div class="divider" />

        <h3 class="block-title">{{ t('插画生成') }}</h3>
        <p class="lead">
          {{ t('用图像模型为每篇论文生成插画，按张计费；不填则继续用程序精灵。') }}
        </p>
        <label class="field">
          <span>{{ t('图像接口') }}</span>
          <input v-model="imageForm.baseUrl" class="input mono" placeholder="https://api.openai.com/v1" />
        </label>
        <label class="field">
          <span>{{ t('图像模型') }}</span>
          <input v-model="imageForm.model" class="input mono" placeholder="gpt-image-1" />
        </label>
        <label class="field">
          <span>{{ t('图像 API Key') }}</span>
          <input
            v-model="imageForm.apiKey"
            class="input mono"
            type="password"
            placeholder="sk-..."
            autocomplete="off"
          />
        </label>

        <div class="maint art-batch">
          <span class="hint">{{ t('{n} 篇还没有插画', { n: artPending }) }}</span>
          <button
            type="button"
            class="btn sm"
            :disabled="spriteJob?.running || !artPending || !settings.imageReady"
            @click="startSpriteBatch"
          >
            {{ spriteJob?.running ? t('生成中…') : t('批量生成') }}
          </button>
        </div>
        <div v-if="spriteJob?.total" class="art-progress">
          <div class="art-bar">
            <div class="art-fill" :style="{ width: spritePct + '%' }" />
          </div>
          <span class="mono">
            {{ spriteJob.done }}/{{ spriteJob.total }}
            <template v-if="spriteJob.failed"> · {{ t('失败 {n}', { n: spriteJob.failed }) }}</template>
          </span>
        </div>

        <div class="divider" />

        <h3 class="block-title">{{ t('体验') }}</h3>
        <div class="cry-row">
          <label class="check">
            <input type="checkbox" :checked="prefs.cryEnabled" @change="toggleCry" />
            {{ t('点亮时播放 8-bit 叫声') }}
          </label>
          <button type="button" class="btn sm ghost" @click="playCry('demo-2610.28480', true)">
            {{ t('试听') }}
          </button>
        </div>
        <label class="check dex-toggle">
          <input type="checkbox" :checked="prefs.dexEntries" @change="toggleDexEntries" />
          {{ t('显示图鉴描述') }}
        </label>

        <div class="divider" />

        <h3 class="block-title">{{ t('维护') }}</h3>
        <p class="lead">{{ t('把还没有本地 PDF 的论文排队下载，一次一篇，后台执行。') }}</p>
        <div class="maint">
          <span class="hint">{{ t('{n} 篇待下载', { n: missingPdf }) }}</span>
          <button
            type="button"
            class="btn sm"
            :disabled="pdfJob?.running || !missingPdf"
            @click="startPdfDownload"
          >
            {{ pdfJob?.running ? t('下载中…') : t('批量下载') }}
          </button>
        </div>
        <p v-if="pdfJob?.running" class="hint mono">
          {{ pdfJob.done }}/{{ pdfJob.total }} · {{ pdfJob.current }}
        </p>

        <div class="actions">
          <button v-if="settings.config.apiKey" type="button" class="btn ghost sm" @click="settings.clearKey(), store.notify(t('已清除本地 Key'))">
            {{ t('清除 Key') }}
          </button>
          <span class="spacer" />
          <button type="button" class="btn ghost" @click="close">{{ t('取消') }}</button>
          <button type="button" class="btn" @click="save">{{ t('保存') }}</button>
        </div>
      </div>
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
  width: min(620px, 100%);
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
  background: var(--ink);
  color: var(--paper);
  border-bottom: 4px solid var(--ink);
}

.head h2 {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
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
  gap: 13px;
  padding: 18px;
  overflow-y: auto;
}

.lead {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.65;
}

.lead b {
  color: var(--text);
}

.providers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.provider {
  display: grid;
  gap: 2px;
  text-align: left;
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  background: var(--paper);
  padding: 7px 9px;
  box-shadow: 2px 2px 0 var(--ink);
}

.provider b {
  font-size: 12.5px;
}

.provider small {
  font-size: 10px;
  color: var(--dim);
  line-height: 1.35;
}

.provider.on {
  background: var(--gold);
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--ink);
}

.key-row {
  display: flex;
  gap: 8px;
}

.key-row .input {
  flex: 1;
}

.hint {
  font-size: 12px;
  color: var(--dim);
}

.cry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dex-toggle {
  margin-top: 8px;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}

.divider {
  border-top: 2px dashed var(--line);
  margin: 4px 0;
}

.block-title {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.art-batch {
  margin-top: 6px;
}

.art-progress {
  display: grid;
  gap: 3px;
  margin-top: 4px;
  font-size: 9px;
  color: var(--muted);
}

.art-bar {
  height: 6px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  overflow: hidden;
}

.art-fill {
  height: 100%;
  background: var(--ink);
  transition: width 0.3s ease;
}

.maint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding-top: 14px;
  border-top: 2px dashed var(--line);
}

.spacer {
  flex: 1;
}

@media (max-width: 620px) {
  .providers {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
