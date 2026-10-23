<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { categoryChipColor, paletteForCategory } from '../core/palette'
import { TIER_COLORS, paperLevel, type Tier } from '../core/level'
import { t } from '../core/i18n'
import { usePapersStore } from '../stores/papers'
import type { Paper } from '../core/types'

const store = usePapersStore()

interface Row {
  label: string
  value: number
  color?: string
}

function countBy(papers: Paper[], pick: (paper: Paper) => string | null): Row[] {
  const map = new Map<string, number>()
  for (const paper of papers) {
    const key = pick(paper)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

const papers = computed(() => store.items)
const total = computed(() => papers.value.length)
const read = computed(() => store.readCount)
const reading = computed(() => store.readingCount)
const notes = computed(() => papers.value.filter((paper) => paper.notes.trim()).length)
const readRate = computed(() =>
  total.value ? Math.round((read.value / total.value) * 100) : 0,
)

const categories = computed<Row[]>(() =>
  countBy(papers.value, (paper) => paper.primaryCategory || null).map((row) => ({
    ...row,
    color: paletteForCategory(row.label).base,
  })),
)

const years = computed<Row[]>(() =>
  countBy(papers.value, (paper) => (paper.year ? String(paper.year) : null)).sort((a, b) =>
    b.label.localeCompare(a.label),
  ),
)

const venues = computed<Row[]>(() =>
  countBy(papers.value, (paper) => paper.venue.trim() || null).slice(0, 10),
)

const tiers = computed<Row[]>(() => {
  const order: Tier[] = ['常见', '稀有', '史诗', '传说']
  const rows = countBy(papers.value, (paper) => paperLevel(paper).tier)
  return order.map((tier) => ({
    label: tier,
    value: rows.find((row) => row.label === tier)?.value ?? 0,
    color: TIER_COLORS[tier],
  }))
})

onMounted(async () => {
  if (!store.items.length) await store.load()
})
</script>

<template>
  <div class="stats-page">
    <div class="wrap">
      <header class="hero">
        <p class="kicker mono">STATS</p>
        <h1>{{ t('统计') }}</h1>
        <p class="lead">{{ t('你的图鉴都由什么组成：领域、年份、会议，以及点亮的比例。') }}</p>
      </header>

      <div class="cards">
        <div class="card">
          <b class="mono">{{ total }}</b>
          <span>{{ t('收录') }}</span>
        </div>
        <div class="card">
          <b class="mono">{{ read }} / {{ total }}</b>
          <span>{{ t('已点亮') }}</span>
        </div>
        <div class="card">
          <b class="mono">{{ reading }}</b>
          <span>{{ t('在读') }}</span>
        </div>
        <div class="card">
          <b class="mono">{{ readRate }}%</b>
          <span>{{ t('阅读率') }}</span>
        </div>
        <div class="card">
          <b class="mono">{{ notes }}</b>
          <span>{{ t('有笔记') }}</span>
        </div>
      </div>

      <section class="block">
        <h2><span class="num mono">01</span>{{ t('分类分布') }}</h2>
        <p v-if="!categories.length" class="empty">{{ t('还没有数据') }}</p>
        <div v-else class="bars">
          <div v-for="row in categories" :key="row.label" class="bar-row">
            <span class="bar-label mono" :title="row.label">{{ row.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{
                  width: `${(row.value / categories[0].value) * 100}%`,
                  background: row.color || categoryChipColor(row.label),
                }"
              />
            </div>
            <b class="mono">{{ row.value }}</b>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">02</span>{{ t('年份分布') }}</h2>
        <p v-if="!years.length" class="empty">{{ t('还没有数据') }}</p>
        <div v-else class="bars">
          <div v-for="row in years" :key="row.label" class="bar-row">
            <span class="bar-label mono">{{ row.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: `${(row.value / years[0].value) * 100}%`, background: 'var(--ink)' }"
              />
            </div>
            <b class="mono">{{ row.value }}</b>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">03</span>{{ t('会议 / 期刊') }}</h2>
        <p v-if="!venues.length" class="empty">{{ t('还没有数据') }}</p>
        <div v-else class="bars">
          <div v-for="row in venues" :key="row.label" class="bar-row">
            <span class="bar-label" :title="row.label">{{ row.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: `${(row.value / venues[0].value) * 100}%`, background: 'var(--blue)' }"
              />
            </div>
            <b class="mono">{{ row.value }}</b>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">04</span>{{ t('等级分布') }}</h2>
        <div class="tiers">
          <div v-for="row in tiers" :key="row.label" class="tier">
            <span class="tier-chip" :style="{ background: row.color }">{{ t(row.label) }}</span>
            <b class="mono">{{ row.value }}</b>
            <span class="tier-pct mono">
              {{ total ? Math.round((row.value / total) * 100) : 0 }}%
            </span>
          </div>
        </div>
      </section>

      <RouterLink to="/" class="back">← {{ t('返回图鉴') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.stats-page {
  padding: 34px 0 90px;
}

.hero {
  max-width: 720px;
  margin-bottom: 26px;
}

.kicker {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--dim);
}

.hero h1 {
  font-size: clamp(26px, 4vw, 38px);
  font-weight: 900;
  letter-spacing: -0.02em;
  margin: 6px 0 8px;
}

.lead {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.8;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.card {
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--panel);
  box-shadow: 3px 3px 0 var(--ink);
  padding: 12px 14px;
  display: grid;
  gap: 2px;
}

.card b {
  font-size: 24px;
  letter-spacing: -0.02em;
}

.card span {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--dim);
  text-transform: uppercase;
}

.block {
  border-top: 2px dashed var(--line);
  padding: 26px 0 8px;
  max-width: 860px;
}

.block h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 20px;
  font-weight: 900;
  margin-bottom: 14px;
}

.num {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.1em;
}

.bars {
  display: grid;
  gap: 7px;
}

.bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 40px;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
}

.bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-weight: 700;
}

.bar-track {
  height: 12px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--panel-2);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  min-width: 2px;
}

.bar-row b {
  text-align: right;
  color: var(--dim);
}

.tiers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.tier {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  padding: 8px 10px;
}

.tier b {
  margin-left: auto;
  font-size: 16px;
}

.tier-pct {
  font-size: 10px;
  color: var(--dim);
}

.tier-chip {
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 8px;
}

.empty {
  font-size: 12px;
  color: var(--dim);
}

.back {
  display: inline-block;
  margin-top: 26px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

@media (max-width: 560px) {
  .bar-row {
    grid-template-columns: 80px 1fr 32px;
  }
}
</style>
