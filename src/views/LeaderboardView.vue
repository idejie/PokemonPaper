<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AvatarSvg from '../components/AvatarSvg.vue'
import SpriteSvg from '../components/SpriteSvg.vue'
import { api } from '../core/api'
import { t } from '../core/i18n'
import { titleForLevel } from '../core/progress'
import type { GymRankEntry, LeaderboardEntry } from '../core/types'
import { GYMS, GYM_LEVELS, gymLevelFor } from '../core/gyms'

const entries = ref<LeaderboardEntry[]>([])
const me = ref('')
const loading = ref(true)
const error = ref('')
const mode = ref<'xp' | 'gym'>('xp')
const gymId = ref('cs')
const gymData = ref<Record<string, GymRankEntry[]>>({})
const gymLoading = ref(false)

const gymEntries = computed(() => gymData.value[gymId.value] ?? [])

function levelLabel(entry: GymRankEntry): string {
  const level = gymLevelFor(entry.read, entry.notes)
  if (!level) return t('未入门')
  return `Lv.${level} ${t(GYM_LEVELS.find((tier) => tier.level === level)?.name ?? '')}`
}

async function loadGymData() {
  gymLoading.value = true
  try {
    gymData.value = (await api.gymLeaderboard()).gyms
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('加载失败')
  } finally {
    gymLoading.value = false
  }
}

watch(mode, (next) => {
  if (next === 'gym' && !Object.keys(gymData.value).length) void loadGymData()
})

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

      <div class="mode-tabs">
        <button type="button" :class="{ on: mode === 'xp' }" @click="mode = 'xp'">
          {{ t('总榜') }}
        </button>
        <button type="button" :class="{ on: mode === 'gym' }" @click="mode = 'gym'">
          {{ t('道馆榜') }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="loading" class="empty">{{ t('加载中…') }}</p>

      <template v-else>
        <template v-if="mode === 'xp'">
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
            <span>{{ t('获赞') }}</span>
          </div>
          <div
            v-for="(entry, index) in entries"
            :key="entry.userId"
            class="row"
            :class="{ self: entry.userId === me }"
            :style="{ animationDelay: `${index * 35}ms` }"
          >
            <span class="rank mono">{{ medals[entry.rank] || `#${entry.rank}` }}</span>
            <span class="who">
              <span class="pic"><AvatarSvg :id="entry.avatarId || 'red-cap'" /></span>
              <span class="name">
                {{ entry.name }}
                <b v-if="entry.userId === me" class="you">{{ t('你') }}</b>
              </span>
              <span class="title">{{ t(titleForLevel(entry.level)) }}</span>
              <span v-if="entry.party?.length" class="party-mini">
                <span v-for="member in entry.party" :key="member.arxiv" class="party-mini-pic">
                  <SpriteSvg
                    :seed="member.arxiv || '?'"
                    :category="member.primaryCategory"
                    :locked="member.status === 'unread'"
                    :status="member.status"
                  />
                </span>
              </span>
            </span>
            <span class="mono lv">Lv.{{ entry.level }}</span>
            <span class="mono">{{ entry.xp }}</span>
            <span class="mono">{{ entry.read }}</span>
            <span class="mono">{{ entry.summaries }}</span>
            <span class="mono">{{ entry.likes }}</span>
          </div>
        </div>

        <p v-if="!entries.length" class="empty">{{ t('还没有其他训练家，先去读一篇。') }}</p>
        </template>

        <template v-else>
          <div class="gym-picker">
            <button
              v-for="gym in GYMS"
              :key="gym.id"
              type="button"
              class="gym-tab"
              :class="{ on: gymId === gym.id }"
              @click="gymId = gym.id"
            >
              {{ gym.icon }} {{ t(gym.name) }}
            </button>
          </div>

          <p v-if="gymLoading" class="empty">{{ t('加载中…') }}</p>
          <template v-else>
            <div class="gym-table">
              <div class="gym-head">
                <span>{{ t('排名') }}</span>
                <span>{{ t('训练家') }}</span>
                <span>{{ t('已读') }}</span>
                <span>{{ t('笔记') }}</span>
                <span>{{ t('等级') }}</span>
              </div>
              <div
                v-for="(entry, index) in gymEntries"
                :key="entry.userId"
                class="gym-row"
                :class="{ self: entry.userId === me }"
              >
                <span class="rank mono">{{ medals[index + 1] || `#${index + 1}` }}</span>
                <span class="who">
                  <span class="pic"><AvatarSvg :id="entry.avatarId || 'red-cap'" /></span>
                  <span class="name">
                    {{ entry.name }}
                    <b v-if="entry.userId === me" class="you">{{ t('你') }}</b>
                  </span>
                </span>
                <span class="mono">{{ entry.read }}</span>
                <span class="mono">{{ entry.notes }}</span>
                <span class="mono">{{ levelLabel(entry) }}</span>
              </div>
            </div>
            <p v-if="!gymEntries.length" class="empty">{{ t('这个道馆还没有人读完论文。') }}</p>
          </template>
        </template>
      </template>

      <RouterLink to="/" class="back">← {{ t('返回图鉴') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.ladder-page {
  padding: 34px 0 90px;
}

.mode-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.mode-tabs button {
  padding: 3px 12px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  font-size: 11px;
  font-weight: 800;
}

.mode-tabs button.on {
  background: #f2c14e;
}

.gym-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.gym-tab {
  padding: 2px 8px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
}

.gym-tab.on {
  opacity: 1;
  border-color: var(--ink);
  background: #fff4cf;
}

.gym-table {
  border: 3px solid var(--ink);
  border-radius: 10px;
  overflow: hidden;
  background: var(--panel);
}

.gym-head,
.gym-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 64px 64px 120px;
  gap: 4px;
  align-items: center;
  padding: 8px 10px;
}

.gym-head {
  background: var(--ink);
  color: var(--paper);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.gym-row {
  border-top: 1.5px dashed var(--line);
  font-size: 11px;
}

.gym-row.self {
  background: #fff4cf;
}

.hero {
  animation: fade-up 0.35s ease-out both;
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
  animation: fade-up 0.35s ease-out both;
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
  grid-template-columns: 64px minmax(0, 1fr) 84px 84px 60px 64px 60px;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}

.row:last-child {
  border-bottom: 0;
}

.row:not(.head) {
  animation: fade-up 0.3s ease-out both;
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

.party-mini {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.party-mini-pic {
  width: 18px;
  height: 18px;
  padding: 1px;
  border: 1.5px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
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
  .row > :nth-child(6),
  .row > :nth-child(7) {
    display: none;
  }

  .title {
    display: none;
  }
}
</style>
