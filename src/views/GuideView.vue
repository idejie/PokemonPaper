<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { TIER_COLORS, paperLevel } from '../core/level'
import { TITLES, xpForLevel } from '../core/progress'
import { t } from '../core/i18n'
import { api } from '../core/api'
import { gymStatus } from '../core/gyms'
import { usePapersStore } from '../stores/papers'

const store = usePapersStore()
const gyms = computed(() => gymStatus(store.items))
const gymEarned = computed(() => gyms.value.filter((gym) => gym.earned).length)

const starRows = [0, 10, 100, 1000, 5000].map((stars) => {
  const lv = paperLevel({ codeUrl: 'https://github.com/example/repo', stars })
  return { stars, ...lv }
})

const milestones = [2, 5, 10, 20, 35, 50].map((level) => ({
  level,
  xp: xpForLevel(level),
}))

const leaders = ref<Record<string, { name: string; count: number }>>({})
const leaderMonth = ref('')

async function loadLeaders() {
  try {
    const data = await api.gymLeaders()
    leaders.value = data.gyms
    leaderMonth.value = data.month
  } catch {
    /* offline: keep the section usable without leaders */
  }
}

const badges = computed(() => store.xp.badges)
const titles = computed(() => [...TITLES].reverse())
const currentTitle = computed(() => store.xp.title)

onMounted(async () => {
  if (!store.items.length) await store.load()
  void loadLeaders()
})
</script>

<template>
  <div class="guide-page">
    <div class="wrap">
      <header class="hero">
        <p class="kicker mono">GUIDE</p>
        <h1>{{ t('等级系统') }}</h1>
        <p class="lead">{{ t('论文有等级，训练家也有等级。两者都只看真实投入，不看刷数量。') }}</p>
        <div class="now">
          <span class="mono">{{ t('你现在') }} Lv.{{ store.level }}</span>
          <span class="mono dim">{{ store.xp.xp }} XP</span>
          <span class="mono dim">{{ t('距离 Lv.{n} 还差 {m} XP', { n: store.level + 1, m: store.xp.needed }) }}</span>
        </div>
      </header>

      <section class="block">
        <h2><span class="num mono">01</span>{{ t('论文等级') }}</h2>
        <p>
          {{ t('只看开源与 GitHub star：没开源 = Lv.1；开源后按 star 计算，最高 Lv.100。') }}
        </p>
        <div class="formula mono">
          Lv = 15 + 85 · log10(1 + stars) / log10(50001)
        </div>
        <table>
          <thead>
            <tr>
              <th>{{ t('GitHub Stars') }}</th>
              <th>{{ t('论文等级') }}</th>
              <th>{{ t('档位') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="mono">{{ t('未开源') }}</td>
              <td class="mono">Lv.1</td>
              <td class="tier-cell"><span class="tier" :style="{ background: TIER_COLORS['常见'] }">{{ t('常见') }}</span></td>
            </tr>
            <tr v-for="row in starRows" :key="row.stars">
              <td class="mono">{{ row.stars.toLocaleString() }}</td>
              <td class="mono">Lv.{{ row.level }}</td>
              <td class="tier-cell">
                <span class="tier" :style="{ background: TIER_COLORS[row.tier] }">{{ t(row.tier) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="note">{{ t('开源和 star 只影响论文等级，不会在训练家经验里再加一次。') }}</p>
      </section>

      <section class="block">
        <h2><span class="num mono">02</span>{{ t('训练家经验') }}</h2>
        <p>{{ t('每篇论文的 XP 只看三件事：论文等级、读没读完、有没有笔记。') }}</p>
        <table>
          <thead>
            <tr>
              <th>{{ t('动作') }}</th>
              <th>{{ t('经验') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{{ t('读完一篇') }}</td><td class="mono">{{ t('论文等级 + 40') }}</td></tr>
            <tr><td>{{ t('在读') }}</td><td class="mono">{{ t('论文等级的一半 + 10') }}</td></tr>
            <tr><td>{{ t('写了笔记') }}</td><td class="mono">+20（{{ t('在读 +10') }}）</td></tr>
            <tr><td>{{ t('只收录没读') }}</td><td class="mono">0</td></tr>
            <tr><td>{{ t('公开批注 / 总结被点赞') }}</td><td class="mono">{{ t('每赞 +1') }}</td></tr>
          </tbody>
        </table>
        <div class="examples">
          <div class="example">
            <b class="mono">Lv.1</b>
            <span>{{ t('读完 + 笔记 = 61 XP') }}</span>
          </div>
          <div class="example">
            <b class="mono">Lv.81</b>
            <span>{{ t('读完 = 121 XP') }}</span>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">03</span>{{ t('升级曲线') }}</h2>
        <p>
          {{ t('升到 L 级需要 50·(L−1)·L 经验，越往后越慢。') }}
        </p>
        <div class="levels">
          <div v-for="m in milestones" :key="m.level" class="milestone">
            <b class="mono">Lv.{{ m.level }}</b>
            <span class="mono">{{ m.xp.toLocaleString() }} XP</span>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">04</span>{{ t('称号') }}</h2>
        <ol class="titles">
          <li v-for="[min, title] in titles" :key="title" :class="{ on: title === currentTitle }">
            <span class="mono">Lv.{{ min }}+</span>
            <b>{{ t(title) }}</b>
          </li>
        </ol>
      </section>

      <section class="block">
        <h2><span class="num mono">05</span>{{ t('徽章') }}</h2>
        <p>{{ t('徽章只看收集与阅读行为，不给经验。') }}</p>
        <div class="badges">
          <div
            v-for="badge in badges"
            :key="badge.id"
            class="badge"
            :class="{ on: badge.unlocked }"
          >
            <span class="dot" />
            <b>{{ t(badge.name) }}</b>
            <small>{{ t(badge.desc) }}</small>
          </div>
        </div>
      </section>

      <section class="block">
        <h2><span class="num mono">06</span>{{ t('道馆') }}</h2>
        <p>{{ t('每个 arXiv 大类是一座道馆：读满 3 篇、其中 1 篇有笔记，就能拿到徽章。') }}</p>
        <p class="dim mono">
          {{ t('已获得 {n} / {m}', { n: gymEarned, m: gyms.length }) }}
          <template v-if="leaderMonth"> · {{ t('本月馆主') }} {{ leaderMonth }}</template>
        </p>
        <div class="gyms">
          <div v-for="gym in gyms" :key="gym.id" class="gym-row" :class="{ on: gym.earned }">
            <span class="gym-icon">{{ gym.icon }}</span>
            <span class="gym-info">
              <b>{{ t(gym.name) }}</b>
              <small v-if="leaders[gym.id]" class="gym-lead">
                👑 {{ leaders[gym.id].name }} · {{ t('{n} 篇', { n: leaders[gym.id].count }) }}
              </small>
              <small v-else class="gym-lead empty">{{ t('暂无馆主') }}</small>
            </span>
            <span class="gym-progress mono">{{ gym.readCount }}/{{ gym.read }} · {{ gym.noteCount }}/{{ gym.notes }}</span>
            <span class="gym-state">{{ gym.earned ? t('已获得') : t('未获得') }}</span>
          </div>
        </div>
      </section>

      <RouterLink to="/" class="back">← {{ t('返回图鉴') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.guide-page {
  padding: 34px 0 90px;
}

.hero {
  animation: fade-up 0.35s ease-out both;
  max-width: 760px;
  margin-bottom: 30px;
}

.kicker {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--dim);
  text-transform: uppercase;
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

.now {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 14px;
  padding: 10px 14px;
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: var(--panel-2);
  font-size: 12px;
  font-weight: 700;
  box-shadow: 3px 3px 0 var(--ink);
}

.dim {
  color: var(--dim);
}

.block {
  animation: fade-up 0.35s ease-out both;
  border-top: 2px dashed var(--line);
  padding: 26px 0;
  max-width: 860px;
}

.block h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

.num {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.1em;
}

.block p {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.85;
  margin-bottom: 12px;
}

.formula {
  display: inline-block;
  padding: 8px 12px;
  margin-bottom: 14px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--ink);
  color: var(--paper);
  font-size: 11.5px;
  box-shadow: 3px 3px 0 var(--gold);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 12.5px;
}

th {
  text-align: left;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  padding: 6px 8px;
  border-bottom: 2px solid var(--ink);
}

td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
}

td:last-child {
  text-align: right;
}

.tier-cell {
  text-align: left !important;
}

.tier {
  display: inline-block;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  padding: 1px 8px;
}

.note {
  font-size: 11px !important;
  color: var(--dim) !important;
}

.examples {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.example {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--panel);
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 2px 2px 0 var(--ink);
}

.levels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.milestone {
  display: grid;
  gap: 2px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  background: var(--panel);
  padding: 8px 10px;
  font-size: 11px;
  box-shadow: 2px 2px 0 var(--ink);
}

.milestone span {
  color: var(--dim);
  font-size: 10px;
}

.titles {
  display: grid;
  gap: 6px;
  padding-left: 0;
  list-style: none;
}

.titles li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  border-bottom: 1px dashed var(--line);
  padding-bottom: 5px;
}

.titles .mono {
  color: var(--dim);
  font-size: 10px;
  min-width: 56px;
}

.titles li.on {
  background: var(--panel-2);
  border-radius: 6px;
  padding-left: 8px;
  padding-right: 8px;
}

.titles li.on b {
  color: var(--ink);
}

.badges {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  padding: 8px 10px;
  opacity: 0.55;
}

.badge.on {
  border-color: var(--ink);
  opacity: 1;
  box-shadow: 2px 2px 0 var(--ink);
}

.badge .dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: var(--panel);
}

.badge.on .dot {
  background: var(--gold);
}

.badge b {
  font-size: 11.5px;
}

.badge small {
  color: var(--dim);
  font-size: 9.5px;
  display: block;
}

.gyms {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.gym-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 11px;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  font-size: 11px;
  opacity: 0.6;
  filter: grayscale(1);
}

.gym-row.on {
  opacity: 1;
  filter: none;
  border-color: var(--ink);
  background: #fff4cf;
  box-shadow: 2px 2px 0 var(--ink);
}

.gym-icon {
  font-size: 16px;
}

.gym-info {
  display: grid;
  gap: 1px;
}

.gym-lead {
  color: #8a5a00;
  font-size: 9px;
  font-weight: 800;
}

.gym-lead.empty {
  color: var(--dim);
  font-weight: 600;
}

.gym-progress {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}

.gym-state {
  flex: none;
  font-size: 9px;
  font-weight: 800;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  padding: 0 6px;
}

.back {
  display: inline-block;
  margin-top: 26px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

@media (max-width: 640px) {
  .block {
    padding: 20px 0;
  }

  table {
    font-size: 11px;
  }
}
</style>
