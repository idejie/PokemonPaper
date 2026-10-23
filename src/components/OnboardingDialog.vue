<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '../core/i18n'

const emit = defineEmits<{ close: [] }>()

const index = ref(0)
const steps = computed(() => [
  {
    icon: '🧬',
    title: t('每篇论文都是一只精灵'),
    body: t('编号就是 arXiv 号。未读是剪影，在读半彩，读完点亮，还会经历四段进化。'),
  },
  {
    icon: '📥',
    title: t('先登记第一篇'),
    body: t('右上角「导入」支持 arXiv 批量、BibTeX、JSON，也能扫分享卡二维码；「抓取」会自动补全标题、作者和摘要。'),
  },
  {
    icon: '📖',
    title: t('读的时候顺手留下东西'),
    body: t('PDF 里可以高亮、批注、搜索；AI 速读卡和手写总结都在阅读器里。公开批注或总结被点赞会加 XP。'),
  },
  {
    icon: '🏅',
    title: t('给自己一个长期目标'),
    body: t('训练家等级、12 座道馆（青铜到铂金）、地区图鉴、六人队伍和每日野生论文，都在图鉴和统计页里。'),
  },
  {
    icon: '✨',
    title: t('还有一些彩蛋'),
    body: t('分享卡带二维码、论文可以培育、点亮有 8-bit 叫声，还有 1/64 概率的异色精灵。右上角「?」有完整规则。'),
  },
])

const step = computed(() => steps.value[index.value])
const last = computed(() => index.value === steps.value.length - 1)

function next() {
  if (last.value) emit('close')
  else index.value += 1
}

function back() {
  if (index.value > 0) index.value -= 1
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="onboard-overlay" @click.self="emit('close')">
    <section class="onboard-card" role="dialog" aria-modal="true" :aria-label="t('新手导引')">
      <div class="dots">
        <span v-for="(item, i) in steps" :key="item.title" :class="{ on: i === index }" />
      </div>

      <span class="icon">{{ step.icon }}</span>
      <h2>{{ step.title }}</h2>
      <p>{{ step.body }}</p>

      <footer>
        <button type="button" class="skip" @click="emit('close')">{{ t('跳过') }}</button>
        <span class="spacer" />
        <button v-if="index > 0" type="button" class="btn ghost" @click="back">
          {{ t('上一步') }}
        </button>
        <button type="button" class="btn" @click="next">
          {{ last ? t('开始探索') : t('下一步') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.onboard-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(43, 36, 32, 0.62);
}

.onboard-card {
  width: min(560px, 100%);
  padding: 26px 26px 18px;
  border: 3px solid var(--ink);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 8px 8px 0 var(--ink);
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 8px;
  animation: sheet-in 0.28s ease-out both;
}

.dots {
  display: flex;
  gap: 5px;
  margin-bottom: 4px;
}

.dots span {
  width: 7px;
  height: 7px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--panel);
}

.dots span.on {
  background: #f2c14e;
}

.icon {
  font-size: 46px;
  line-height: 1;
}

h2 {
  margin: 2px 0 0;
  font-size: 21px;
  font-weight: 900;
}

p {
  margin: 0;
  max-width: 440px;
  font-size: 12.5px;
  line-height: 1.85;
  color: var(--muted);
}

footer {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.skip {
  border: none;
  background: none;
  font-size: 10px;
  font-weight: 800;
  color: var(--muted);
  text-decoration: underline;
}

.spacer {
  flex: 1;
}
</style>
