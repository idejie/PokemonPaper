<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import SpriteSvg from './SpriteSvg.vue'
import type { Paper } from '../core/types'
import { TIER_COLORS, paperLevel } from '../core/level'
import { TYPE_COLORS, TYPES } from '../core/typeMap'

const props = defineProps<{ paper: Paper }>()
const router = useRouter()

const seed = computed(() => props.paper.arxiv || props.paper.title)
const locked = computed(() => props.paper.status === 'unread')
const lv = computed(() => paperLevel(props.paper))
const typeDef = computed(() => TYPES[props.paper.type] ?? TYPES.steel)
const typeColor = computed(() => TYPE_COLORS[props.paper.type] ?? TYPE_COLORS.steel)
function openDetail() {
  void router.push(`/p/${props.paper.id}`)
}

function readFull() {
  void router.push(`/p/${props.paper.id}/read?tab=pdf`)
}

const statusText = computed(() => {
  if (props.paper.status === 'read') return '已点亮'
  if (props.paper.status === 'reading') return '在读'
  return '未点亮'
})
</script>

<template>
  <article
    class="row"
    :class="`is-${paper.status}`"
    role="link"
    tabindex="0"
    @click="openDetail"
    @keydown.enter="openDetail"
  >
    <div class="pic">
      <SpriteSvg :seed="seed" :type="paper.type" :locked="locked" />
    </div>

    <div class="main">
      <div class="title">{{ paper.title }}</div>
      <div class="meta">
        <span class="mono">No.{{ paper.arxiv || '—' }}</span>
        <span v-if="paper.authors" class="authors">{{ paper.authors }}</span>
        <span v-if="paper.venue || paper.year" class="mono venue">
          {{ paper.venue }}{{ paper.year ? ` · ${paper.year}` : '' }}
        </span>
      </div>
    </div>

    <div class="side">
      <span class="type-chip" :style="{ background: typeColor }">{{ typeDef.cn }}</span>
      <span v-if="paper.primaryCategory" class="cat mono">{{ paper.primaryCategory }}</span>
      <span class="lv mono" :style="{ background: TIER_COLORS[lv.tier] }" :title="`${lv.tier} · ${paper.stars} star`">
        Lv.{{ lv.level }}
      </span>
      <span class="state" :class="paper.status">{{ statusText }}</span>
    </div>

    <button class="read-btn" type="button" @click.stop="readFull">阅读</button>
  </article>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 2px dashed var(--line);
  transition: background 0.12s ease;
}

.row:last-child {
  border-bottom: none;
}

.row:hover,
.row:focus-visible {
  background: var(--panel-2);
  outline: none;
}

.pic {
  width: 52px;
  height: 52px;
  flex: none;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background-color: #f7ecd2;
  background-image: linear-gradient(rgba(43, 36, 32, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 36, 32, 0.07) 1px, transparent 1px);
  background-size: 12px 12px;
  padding: 3px;
}

.is-unread .pic :deep(svg) {
  opacity: 0.42;
}

.is-reading .pic :deep(svg) {
  opacity: 0.8;
  filter: saturate(0.65);
}

.main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
}

.title {
  font-size: 13.5px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  color: var(--dim);
  min-width: 0;
}

.authors {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.venue {
  flex: none;
}

.read-btn {
  flex: none;
  border: 2px solid var(--ink);
  border-radius: 6px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 9px;
}

.row:hover .read-btn {
  background: var(--gold);
}

.side {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
}

.type-chip {
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  padding: 0 7px;
}

.cat {
  font-size: 9px;
  color: var(--dim);
  font-weight: 700;
}

.lv {
  font-size: 9.5px;
  font-weight: 900;
  color: #fff;
  border: 2px solid var(--ink);
  border-radius: 5px;
  padding: 0 5px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
}

.state {
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1.5px solid var(--ink);
  white-space: nowrap;
}

.state.read {
  background: var(--gold);
  color: var(--ink);
}

.state.reading {
  background: #ffe8b0;
  color: #7a5b00;
}

.state.unread {
  background: #efe7d4;
  color: var(--dim);
}

@media (max-width: 720px) {
  .authors,
  .venue {
    display: none;
  }

  .type-chip,
  .cat {
    display: none;
  }
}
</style>
