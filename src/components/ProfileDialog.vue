<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import AvatarSvg from './AvatarSvg.vue'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import { t } from '../core/i18n'

const auth = useAuthStore()
const store = usePapersStore()
const ui = useUiStore()

const progress = computed(() => store.xp)
const nextLevel = computed(() => progress.value.level + 1)

function openAccount() {
  ui.closeProfile()
  ui.openAvatar()
}

function close() {
  ui.closeProfile()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="t('训练家档案')">
      <header class="head">
        <h2>{{ t('训练家档案') }}</h2>
        <button class="link" type="button" @click="openAccount">{{ t('账号设置') }}</button>
        <button class="close" type="button" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <div class="body">
        <div class="hero">
          <div class="pic"><AvatarSvg :id="auth.user?.avatarId || 'red-cap'" /></div>
          <div class="who">
            <div class="name">{{ auth.user?.name }}</div>
            <div class="title">{{ t(progress.title) }}</div>
            <div class="lv mono">Lv.{{ progress.level }}</div>
          </div>
        </div>

        <div class="xp">
          <div class="xp-top">
            <span class="mono">{{ progress.xp }} XP</span>
            <span class="hint">{{ t('距离 Lv.{level} 还差 {n} XP', { level: nextLevel, n: progress.needed }) }}</span>
          </div>
          <div class="bar">
            <div class="fill" :style="{ width: progress.percent + '%' }" />
            <span class="percent mono">{{ progress.percent }}%</span>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><b class="mono">{{ progress.stats.total }}</b><span>{{ t('收录') }}</span></div>
          <div class="stat"><b class="mono lit">{{ progress.stats.read }}</b><span>{{ t('已点亮') }}</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.notes }}</b><span>{{ t('有笔记') }}</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.openSource }}</b><span>{{ t('开源') }}</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.explained }}</b><span>{{ t('AI 解读') }}</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.withPdf }}</b><span>{{ t('本地 PDF') }}</span></div>
        </div>

        <div class="badges">
          <div
            v-for="badge in progress.badges"
            :key="badge.id"
            class="badge"
            :class="{ on: badge.unlocked }"
            :title="t(badge.desc)"
          >
            <span class="dot" />
            <div>
              <b>{{ t(badge.name) }}</b>
              <small>{{ t(badge.desc) }}</small>
            </div>
          </div>
        </div>

        <details class="guide" open>
          <summary>{{ t('等级怎么算？') }}</summary>

          <h4>{{ t('论文等级') }}</h4>
          <p>
            {{ t('只看开源与 GitHub star：没开源 = Lv.1；开源后按 star 从 Lv.15 涨到 Lv.100。分为常见 / 稀有 / 史诗 / 传说四档。') }}
          </p>

          <h4>{{ t('训练家经验') }}</h4>
          <ul>
            <li>{{ t('读完一篇：论文等级 + 40 XP') }}</li>
            <li>{{ t('在读：论文等级的一半 + 10 XP') }}</li>
            <li>{{ t('写了笔记：+20 XP（在读 +10）') }}</li>
            <li>{{ t('只收录没读：0 XP') }}</li>
          </ul>
          <p class="note">
            {{ t('开源和 star 已经决定论文等级，不再单独加 XP，避免同一件事算两次。') }}
          </p>

          <h4>{{ t('升级曲线') }}</h4>
          <p>{{ t('升到 L 级需要 50·(L−1)·L 经验：Lv.2 = 100，Lv.5 = 1000，Lv.10 = 4500。') }}</p>

          <h4>{{ t('称号') }}</h4>
          <p>
            {{ t('新手训练家 → 见习研究员（5）→ 图鉴收集者（10）→ 论文猎人（20）→ 知识训练家（35）→ 文献大师（50）。') }}
          </p>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 115;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(34, 29, 26, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.sheet {
  width: min(680px, 100%);
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
  gap: 12px;
  padding: 10px 14px;
  background: var(--ink);
  color: var(--paper);
  border-bottom: 4px solid var(--ink);
}

.head h2 {
  font-size: 15px;
  font-weight: 900;
  flex: 1;
}

.link {
  border: none;
  background: none;
  color: var(--gold);
  font-size: 12px;
  font-weight: 800;
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
  gap: 16px;
  padding: 18px;
  overflow-y: auto;
}

.hero {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pic {
  width: 92px;
  height: 92px;
  padding: 6px;
  background: #f7ecd2;
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 4px 4px 0 var(--ink);
  flex: none;
}

.who {
  display: grid;
  gap: 2px;
}

.name {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.title {
  font-size: 12.5px;
  color: var(--red);
  font-weight: 800;
}

.lv {
  font-size: 13px;
  color: var(--muted);
  font-weight: 800;
}

.xp {
  display: grid;
  gap: 5px;
}

.xp-top {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 800;
}

.hint {
  color: var(--dim);
}

.bar {
  position: relative;
  height: 22px;
  border: 3px solid var(--ink);
  border-radius: 6px;
  background: var(--paper);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: linear-gradient(to bottom, #ffe27a 0 45%, var(--gold) 45% 100%);
  transition: width 0.4s ease;
}

.percent {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 900;
  color: var(--ink);
}

.stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.stat {
  display: grid;
  justify-items: center;
  padding: 7px 4px;
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  background: var(--paper);
}

.stat b {
  font-size: 16px;
  line-height: 1.2;
}

.stat b.lit {
  color: var(--red);
}

.stat span {
  font-size: 9.5px;
  color: var(--dim);
  font-weight: 700;
}

.badges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  opacity: 0.45;
}

.badge.on {
  opacity: 1;
  border-color: var(--ink);
  box-shadow: 2px 2px 0 var(--ink);
}

.badge .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d9cdb2;
  border: 2px solid var(--ink);
  flex: none;
}

.badge.on .dot {
  background: var(--gold);
}

.badge b {
  display: block;
  font-size: 11.5px;
}

.badge small {
  display: block;
  font-size: 9.5px;
  color: var(--dim);
}

.guide {
  border-top: 2px dashed var(--line);
  padding-top: 10px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
}

.guide summary {
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: 0.02em;
}

.guide h4 {
  margin: 10px 0 2px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dim);
}

.guide ul {
  margin: 2px 0;
  padding-left: 16px;
}

.guide .note {
  color: var(--dim);
  font-size: 10.5px;
}

@media (max-width: 560px) {
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .badges {
    grid-template-columns: 1fr;
  }
}
</style>
