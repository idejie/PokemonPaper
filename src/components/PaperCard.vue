<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Paper } from '../core/types'
import { TIER_COLORS, paperLevel } from '../core/level'
import { categoryChipColor } from '../core/palette'
import SpriteSvg from './SpriteSvg.vue'

const props = defineProps<{ paper: Paper }>()
const router = useRouter()

const locked = computed(() => props.paper.status === 'unread')
const catColor = computed(() => categoryChipColor(props.paper.primaryCategory))
const seed = computed(() => props.paper.arxiv || props.paper.title)
const lv = computed(() => paperLevel(props.paper))
const statusText = computed(() => {
  if (props.paper.status === 'read') return '已点亮'
  if (props.paper.status === 'reading') return '在读'
  return '未点亮'
})
const levelTitle = computed(() =>
  props.paper.codeUrl
    ? `${lv.value.tier} · 开源 · ${props.paper.stars.toLocaleString()} star`
    : '常见 · 未开源',
)

function openDetail() {
  void router.push(`/p/${props.paper.id}`)
}

function readFull() {
  void router.push(`/p/${props.paper.id}/read?tab=pdf`)
}
</script>

<template>
  <article
    class="card"
    :class="[`is-${paper.status}`]"
    role="link"
    tabindex="0"
    :title="paper.title"
    @click="openDetail"
    @keydown.enter="openDetail"
  >
    <div class="card-top">
      <span class="no mono">
        <i class="dot" :class="paper.status" :title="statusText" />
        {{ paper.arxiv || '—' }}
      </span>
      <span class="lv mono" :style="{ background: TIER_COLORS[lv.tier] }" :title="levelTitle">
        Lv.{{ lv.level }}
      </span>
    </div>

    <div class="sprite-box">
      <SpriteSvg :seed="seed" :category="paper.primaryCategory" :locked="locked" />
      <span v-if="!locked" class="spark" aria-hidden="true">✦</span>
    </div>

    <h3 class="title">{{ paper.title }}</h3>

    <div class="card-foot">
      <span class="type-chip" :style="{ background: catColor }">
        {{ paper.primaryCategory || '未分类' }}
      </span>
      <span class="venue mono" :title="`${paper.venue || ''} ${paper.year || ''}`">
        {{ paper.venue || '—' }}{{ paper.year ? ` · ${paper.year}` : '' }}
      </span>
    </div>

    <button class="read-btn" type="button" @click.stop="readFull">阅读全文</button>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: var(--panel);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 9px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.card:hover,
.card:focus-visible {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow);
  outline: none;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.no {
  font-size: 10px;
  font-weight: 800;
  color: var(--dim);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--ink);
  display: inline-block;
  margin-right: 4px;
  vertical-align: middle;
}

.dot.read {
  background: var(--gold);
}

.dot.reading {
  background: #f0b429;
}

.dot.unread {
  background: #d9cdb2;
}

.lv {
  font-size: 9.5px;
  font-weight: 900;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1.5px solid var(--ink);
  color: #fff;
  white-space: nowrap;
  box-shadow: 1.5px 1.5px 0 var(--ink);
}

.sprite-box {
  position: relative;
  aspect-ratio: 1;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background-color: #f7ecd2;
  background-image: linear-gradient(rgba(43, 36, 32, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 36, 32, 0.07) 1px, transparent 1px);
  background-size: 16px 16px;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 6px;
}

.sprite-box :deep(svg) {
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.is-unread .sprite-box :deep(svg) {
  opacity: 0.42;
}

.is-reading .sprite-box :deep(svg) {
  opacity: 0.8;
  filter: saturate(0.65);
}

.is-read .sprite-box {
  box-shadow: inset 0 0 0 2px rgba(255, 203, 5, 0.7);
}

.spark {
  position: absolute;
  top: 3px;
  right: 6px;
  color: var(--gold);
  font-size: 13px;
  text-shadow: 1px 1px 0 var(--ink);
}

.title {
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
  letter-spacing: -0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.9em;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: auto;
}

.type-chip {
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 8px;
  box-shadow: 1.5px 1.5px 0 var(--ink);
  white-space: nowrap;
}

.venue {
  font-size: 9.5px;
  color: var(--dim);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.read-btn {
  width: 100%;
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 10.5px;
  font-weight: 800;
  padding: 3px 0;
  transition: background 0.12s ease;
}

.card:hover .read-btn {
  background: var(--gold);
}
</style>
