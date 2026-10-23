<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePapersStore } from '../stores/papers'
import PaperCard from '../components/PaperCard.vue'
import PaperRow from '../components/PaperRow.vue'
import BreedDialog from '../components/BreedDialog.vue'
import { usePrefsStore } from '../stores/prefs'
import { useRouter } from 'vue-router'
import { paperLevel } from '../core/level'
import { t } from '../core/i18n'
import { api } from '../core/api'
import type { DailyPick } from '../core/types'

const store = usePapersStore()
const router = useRouter()
const prefs = usePrefsStore()
const query = ref('')
const filter = ref<'all' | 'read' | 'reading' | 'unread'>('all')
const sort = ref<'arxiv' | 'added' | 'rating' | 'level'>('arxiv')
const searchInput = ref<HTMLInputElement | null>(null)
const daily = ref<DailyPick | null>(null)
const breedOpen = ref(false)

const counts = computed(() => ({
  all: store.items.length,
  read: store.readCount,
  reading: store.readingCount,
  unread: store.items.length - store.readCount - store.readingCount,
}))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = store.items.filter((paper) => {
    if (filter.value !== 'all' && paper.status !== filter.value) return false
    if (!q) return true
    return [paper.title, paper.authors, paper.arxiv, paper.tags, paper.venue]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })

  return [...list].sort((a, b) => {
    if (sort.value === 'added') return b.addedAt.localeCompare(a.addedAt)
    if (sort.value === 'rating') return b.rating - a.rating || b.arxiv.localeCompare(a.arxiv)
    if (sort.value === 'level') return paperLevel(b).level - paperLevel(a).level
    return b.arxiv.localeCompare(a.arxiv, undefined, { numeric: true })
  })
})

const filters = computed<Array<{ key: typeof filter.value; label: string }>>(() => [
  { key: 'all', label: t('全部') },
  { key: 'read', label: t('已点亮') },
  { key: 'reading', label: t('在读') },
  { key: 'unread', label: t('未点亮') },
])

const unlit = computed(() => store.items.filter((paper) => paper.status !== 'read'))

function pickRandom() {
  if (!unlit.value.length) {
    store.notify(t('没有未点亮的论文了'))
    return
  }
  const paper = unlit.value[Math.floor(Math.random() * unlit.value.length)]
  store.notify(t('抽到 No.{id}', { id: paper.arxiv || '—' }))
  void router.push(`/p/${paper.id}`)
}

async function loadDaily() {
  daily.value = await api.daily().catch(() => null)
}

function openDaily() {
  if (daily.value?.paper) void router.push(`/p/${daily.value.paper.id}`)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (event.key === '/' && !typing) {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  void loadDaily()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="wrap page">
    <section v-if="daily?.paper" class="wild" :class="{ caught: daily.claimed }">
      <span class="wild-tag">🌿 {{ t('今日野生论文') }}</span>
      <RouterLink class="wild-title" :to="`/p/${daily.paper.id}`">
        {{ daily.paper.title }}
      </RouterLink>
      <span class="wild-reward">
        {{
          daily.claimed
            ? t('已捕获 +{xp} XP', { xp: daily.bonusXp })
            : t('今日读完双倍 XP（+{xp}）', { xp: daily.reward })
        }}
      </span>
      <span class="spacer" />
      <button type="button" class="btn sm" @click="openDaily">
        {{ daily.claimed ? t('查看') : t('去读') }}
      </button>
    </section>

    <div class="toolbar">
      <div class="search">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          ref="searchInput"
          v-model="query"
          class="input"
          type="search"
          :placeholder="t('搜索标题 / 作者 / 编号 / 标签')"
        />
      </div>

      <div class="chips">
        <button
          v-for="item in filters"
          :key="item.key"
          class="pill"
          :class="{ on: filter === item.key }"
          @click="filter = item.key"
        >
          {{ item.label }}
          <b class="mono">{{ counts[item.key] }}</b>
        </button>
      </div>

      <button
        type="button"
        class="dice"
        :disabled="!unlit.length"
        :title="t('从未点亮的论文里随机抽一篇')"
        @click="pickRandom"
      >
        🎲 <span>{{ t('随机未读') }}</span>
      </button>

      <button
        type="button"
        class="dice"
        :disabled="store.items.length < 2"
        :title="t('选两篇论文培育一个交叉想法')"
        @click="breedOpen = true"
      >
        🧬 <span>{{ t('培育') }}</span>
      </button>

      <div class="layout-switch" role="group" :aria-label="t('布局')">
        <button
          type="button"
          :class="{ on: prefs.layout === 'grid' }"
          :title="t('卡片布局')"
          @click="prefs.setLayout('grid')"
        >
          ▦
        </button>
        <button
          type="button"
          :class="{ on: prefs.layout === 'list' }"
          :title="t('列表布局')"
          @click="prefs.setLayout('list')"
        >
          ☰
        </button>
      </div>

      <select v-model="sort" class="select sort" :aria-label="t('排序')">
        <option value="arxiv">{{ t('按编号') }}</option>
        <option value="added">{{ t('按收录时间') }}</option>
        <option value="rating">{{ t('按评分') }}</option>
        <option value="level">{{ t('按等级') }}</option>
      </select>
    </div>

    <div v-if="store.error" class="banner">
      <b>{{ t('连不上后端。') }}</b>{{ store.error }}
    </div>

    <div v-if="store.loading" class="grid">
      <div v-for="i in 8" :key="i" class="skeleton" />
    </div>

    <div v-else-if="store.total === 0" class="empty">
      <div class="empty-ball" aria-hidden="true" />
      <h2>{{ t('图鉴还是空的') }}</h2>
      <p>{{ t('登记第一篇论文，它会变成一只属于你的精灵。读完点亮它。') }}</p>
      <RouterLink to="/new" class="btn">＋ {{ t('登记第一篇') }}</RouterLink>
    </div>

    <div v-else-if="filtered.length === 0" class="empty">
      <h2 class="mono">NO MATCH</h2>
      <p>{{ t('没有符合条件的精灵。换个关键词或筛选试试。') }}</p>
      <button class="btn ghost" @click="(query = ''), (filter = 'all')">
        {{ t('清空筛选') }}
      </button>
    </div>

    <TransitionGroup v-else-if="prefs.layout === 'grid'" name="card" tag="div" class="grid" appear>
      <PaperCard v-for="paper in filtered" :key="paper.id" :paper="paper" />
    </TransitionGroup>

    <TransitionGroup v-else name="card" tag="div" class="list" appear>
      <PaperRow v-for="paper in filtered" :key="paper.id" :paper="paper" />
    </TransitionGroup>

    <p class="hint">
      {{ t('编号即 arXiv 号 · 读完点亮 · 数据存在本地 SQLite（') }}<code>data/pokemonpaper.db</code>{{ t('）') }}
    </p>
  </div>

  <BreedDialog v-if="breedOpen" :papers="store.items" @close="breedOpen = false" />

  <RouterView />
</template>

<style scoped>
.page {
  padding-bottom: 60px;
}

.wild {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 11px;
  margin-bottom: 10px;
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: 3px 3px 0 var(--ink);
}

.wild.caught {
  opacity: 0.72;
}

.wild-tag {
  flex: none;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #dfe8c9;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 900;
}

.wild-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 800;
}

.wild-reward {
  flex: none;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
}

.wild .spacer {
  flex: 1;
}

@media (max-width: 720px) {
  .wild-reward {
    display: none;
  }
}

.toolbar {
  position: sticky;
  top: 68px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 0 12px;
  background: var(--paper);
  border-bottom: 2px dashed var(--line);
  margin-bottom: 20px;
}

.search {
  position: relative;
  flex: 1 1 240px;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  opacity: 0.55;
  pointer-events: none;
}

.search .input {
  padding-left: 32px;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chips .pill {
  cursor: pointer;
  gap: 5px;
  font-weight: 800;
}

.chips .pill b {
  font-size: 10.5px;
  color: var(--red);
}

.chips .pill.on b {
  color: var(--gold);
}

.dice {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 2px dashed var(--ink);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text);
  font-size: 11.5px;
  font-weight: 800;
  padding: 4px 12px;
}

.dice:hover:not(:disabled) {
  background: var(--gold);
}

.dice:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.layout-switch {
  display: inline-flex;
  border: 2.5px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
  flex: none;
  background: var(--panel);
}

.layout-switch button {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
}

.layout-switch button + button {
  border-left: 2.5px solid var(--ink);
}

.layout-switch button.on {
  background: var(--ink);
  color: var(--paper);
}

.list {
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.sort {
  width: auto;
  flex: none;
  font-size: 12.5px;
  padding-block: 6px;
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}

.card-move {
  transition: transform 0.25s ease;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;
}

.skeleton {
  height: 268px;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: linear-gradient(90deg, #efe6d0, #f8f1df, #efe6d0);
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
  opacity: 0.7;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.banner {
  border: 3px solid var(--ink);
  border-left: 6px solid var(--red);
  border-radius: 10px;
  background: #fdeee9;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 18px;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  padding: 70px 20px;
  border: 3px dashed var(--line);
  border-radius: 16px;
  background: rgba(255, 252, 242, 0.6);
}

.empty h2 {
  font-size: 22px;
}

.empty p {
  color: var(--muted);
  font-size: 14px;
  max-width: 420px;
}

.empty-ball {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 4px solid var(--ink);
  background: linear-gradient(to bottom, var(--red) 0 45%, var(--ink) 45% 55%, #fff 55% 100%);
  position: relative;
  filter: grayscale(0.65);
  opacity: 0.75;
}

.empty-ball::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid var(--ink);
  transform: translate(-50%, -50%);
}

.hint {
  margin-top: 34px;
  text-align: center;
  font-size: 11.5px;
  color: var(--dim);
}

.hint code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 1px 5px;
}

@media (max-width: 720px) {
  .toolbar {
    top: 60px;
  }

  .card-enter-active,
.card-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}

.card-move {
  transition: transform 0.25s ease;
}

.grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
}
</style>
