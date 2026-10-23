<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Paper } from '../core/types'
import { renderShareCard } from '../core/shareCard'
import { locale, t } from '../core/i18n'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'

const props = defineProps<{ paper: Paper }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const store = usePapersStore()
const blob = ref<Blob | null>(null)
const url = ref('')
const error = ref('')
const loading = ref(true)

const filename = computed(() => `${props.paper.arxiv || 'paper'}-card.png`)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    blob.value = await renderShareCard({
      paper: props.paper,
      trainer: auth.user?.name || 'Trainer',
      avatarId: auth.user?.avatarId || 'red-cap',
      locale: locale.value,
    })
    url.value = URL.createObjectURL(blob.value)
  } catch {
    error.value = t('生成卡片失败')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (url.value) URL.revokeObjectURL(url.value)
})

async function copyImage() {
  if (!blob.value) return
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      throw new Error('unsupported')
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob.value })])
    store.notify(t('图片已复制'))
  } catch {
    store.notify(t('复制图片失败，请下载保存'))
  }
}
</script>

<template>
  <div class="share-overlay" @click.self="emit('close')">
    <section class="share-sheet" role="dialog" aria-modal="true" :aria-label="t('分享卡片')">
      <header>
        <h2>{{ t('分享卡片') }}</h2>
        <button type="button" class="close" :aria-label="t('关闭')" @click="emit('close')">×</button>
      </header>

      <div class="preview">
        <img v-if="url" :src="url" :alt="t('分享卡片')" />
        <p v-else-if="error" class="error">{{ error }}</p>
        <p v-else class="loading">{{ loading ? t('生成中…') : '' }}</p>
      </div>

      <footer>
        <span class="hint mono">{{ filename }}</span>
        <span class="spacer" />
        <button type="button" class="btn ghost" @click="emit('close')">{{ t('关闭') }}</button>
        <button v-if="url" type="button" class="btn ghost" @click="copyImage">
          {{ t('复制图片') }}
        </button>
        <a
          v-if="url"
          class="btn"
          :href="url"
          :download="filename"
        >
          {{ t('下载图片') }}
        </a>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(43, 36, 32, 0.62);
}

.share-sheet {
  width: min(680px, 100%);
  max-height: 94vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  padding: 14px 16px 16px;
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 8px 8px 0 var(--ink);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  font-size: 17px;
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

.preview {
  min-height: 200px;
  display: grid;
  place-items: center;
  overflow: auto;
  border: 2px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
  padding: 10px;
}

.preview img {
  max-width: 100%;
  max-height: 66vh;
  display: block;
  border: 2px solid var(--ink);
  border-radius: 8px;
  box-shadow: 4px 4px 0 rgba(43, 36, 32, 0.18);
}

.loading,
.error {
  font-size: 12px;
  color: var(--muted);
}

.error {
  color: #b04a3a;
}

footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

footer .hint {
  font-size: 9px;
  color: var(--muted);
}

.spacer {
  flex: 1;
}
</style>
