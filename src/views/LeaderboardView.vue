<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AvatarSvg from '../components/AvatarSvg.vue'
import { api } from '../core/api'
import { t } from '../core/i18n'
import { titleForLevel } from '../core/progress'
import type { LeaderboardEntry } from '../core/types'

const entries = ref<LeaderboardEntry[]>([])
const me = ref('')
const loading = ref(true)
const error = ref('')

const mine = computed(() => entries.value.find((entry) => entry.userId === me.value) ?? null)

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

onMounted(async () => {
  try {
    const data = await api.leaderboard()
    entries.value = data.entries
    me.value = data.me
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="ladder-page">
    <div class="wrap">
      <header class="hero">
        <p class="kicker mono">LADDER</p>
        <h1>{{ t('天梯') }}</h1>
        <p class="lead">{{ t('看看谁读得最多。按训练家经验排序，读论文和写总结都会加分。') }}</p>
        <p class="count mono">{{ t('共 {n} 位训练家', { n: entries.length }) }}</p>
      </header>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="loading" class="empty">{{ t('加载中…') }}</p>

      <template v-else>
        <div v-if="mine" class="me">
          <span class="me-rank mono">{{ t('你排第 {rank}', { rank: mine.rank }) }}</span>
          <span class="mono">Lv.{{ mine.level }}</span>
          <span class="mono">{{ mine.xp }} XP</span>
          <span class="mono">{{ t('已读 {n}', { n: mine.read }) }}</span>
          <span class="mono">{{ t('总结 {n}', { n: mine.summaries }) }}</span>
        </div>

        <div class="table">
          <div class="row head">
            <span>{{ t('排名') }}</span>
            <span>{{ t('训练家') }}</span>
            <span>{{ t('等级') }}</span>
            <span>{{ t('经验') }}</span>
            <span>{{ t('已读') }}</span>
            <span>{{ t('总结') }}</span>
          </div>
          <div
            v-for="entry in entries"
            :key="entry.userId"
            class="row"
            :class="{ self: entry.userId === me }"
          >
            <span class="rank mono">{{ medals[entry.rank] || `#${entry.rank}` }}</span>
            <span class="who">
              <span class="pic"><AvatarSvg :id="entry.avatarId || 'red-cap'" /></span>
              <span class="name">
                {{ entry.name }}
                <b v-if="entry.userId === me" class="you">{{ t('你') }}</b>
              </span>
              <span class="title">{{ t(titleForLevel(entry.level)) }}</span>
            </span>
            <span class="mono lv">Lv.{{ entry.level }}</span>
            <span class="mono">{{ entry.xp }}</span>
            <span class="mono">{{ entry.read }}</span>
            <span class="mono">{{ entry.summaries }}</span>
          </div>
        </div>

        <p v-if="!entries.length" class="empty">{{ t('还没有其他训练家，先去读一篇。') }}</p>
      </template>

      <RouterLink to="/" class="back">← {{ t('返回图鉴') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.ladder-page {
  padding: 34px 0 90px;
}

.hero {
  max-width: 720px;
  margin-bottom: 22px;
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

.count {
  margin-top: 6px;
  font-size: 10px;
  color: var(--dim);
}

.me {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: var(--panel-2);
  box-shadow: 3px 3px 0 var(--ink);
  padding: 9px 14px;
  margin-bottom: 16px;
  font-size: 11.5px;
  font-weight: 700;
}

.me-rank {
  color: var(--blue);
  font-weight: 900;
}

.table {
  border: 3px solid var(--ink);
  border-radius: 12px;
  overflow: hidden;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  max-width: 900px;
}

.row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 90px 90px 70px 70px;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}

.row:last-child {
  border-bottom: 0;
}

.row.head {
  background: var(--ink);
  color: var(--paper);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 800;
}

.row.self {
  background: rgba(255, 203, 5, 0.16);
}

.rank {
  font-weight: 900;
  font-size: 13px;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pic {
  width: 26px;
  height: 26px;
  flex: none;
  border: 2px solid var(--ink);
  border-radius: 6px;
  background: var(--panel-2);
  padding: 1px;
}

.name {
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.you {
  font-size: 8.5px;
  background: var(--ink);
  color: var(--paper);
  border-radius: 999px;
  padding: 0 5px;
  margin-left: 4px;
}

.title {
  font-size: 9px;
  color: var(--dim);
  white-space: nowrap;
}

.lv {
  font-weight: 900;
}

.error {
  color: var(--red);
  font-size: 12px;
  font-weight: 700;
}

.empty {
  font-size: 12px;
  color: var(--dim);
}

.back {
  display: inline-block;
  margin-top: 24px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

@media (max-width: 640px) {
  .row {
    grid-template-columns: 44px minmax(0, 1fr) 62px 62px;
    padding: 8px 10px;
  }

  .row > :nth-child(5),
  .row > :nth-child(6) {
    display: none;
  }

  .title {
    display: none;
  }
}
</style>
