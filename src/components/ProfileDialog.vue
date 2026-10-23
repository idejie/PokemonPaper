<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import AvatarSvg from './AvatarSvg.vue'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'

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
    <section class="sheet" role="dialog" aria-modal="true" aria-label="训练家档案">
      <header class="head">
        <h2>训练家档案</h2>
        <button class="link" type="button" @click="openAccount">账号设置</button>
        <button class="close" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="body">
        <div class="hero">
          <div class="pic"><AvatarSvg :id="auth.user?.avatarId || 'red-cap'" /></div>
          <div class="who">
            <div class="name">{{ auth.user?.name }}</div>
            <div class="title">{{ progress.title }}</div>
            <div class="lv mono">Lv.{{ progress.level }}</div>
          </div>
        </div>

        <div class="xp">
          <div class="xp-top">
            <span class="mono">{{ progress.xp }} XP</span>
            <span class="hint">距离 Lv.{{ nextLevel }} 还差 {{ progress.needed }} XP</span>
          </div>
          <div class="bar">
            <div class="fill" :style="{ width: progress.percent + '%' }" />
            <span class="percent mono">{{ progress.percent }}%</span>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><b class="mono">{{ progress.stats.total }}</b><span>收录</span></div>
          <div class="stat"><b class="mono lit">{{ progress.stats.read }}</b><span>已点亮</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.notes }}</b><span>有笔记</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.openSource }}</b><span>开源</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.explained }}</b><span>AI 解读</span></div>
          <div class="stat"><b class="mono">{{ progress.stats.withPdf }}</b><span>本地 PDF</span></div>
        </div>

        <div class="badges">
          <div
            v-for="badge in progress.badges"
            :key="badge.id"
            class="badge"
            :class="{ on: badge.unlocked }"
            :title="badge.desc"
          >
            <span class="dot" />
            <div>
              <b>{{ badge.name }}</b>
              <small>{{ badge.desc }}</small>
            </div>
          </div>
        </div>

        <p class="rule">
          每篇论文：收录 +10 · 读完 +50 · 笔记 +5 · 解读 +8 · 评分 +2 · 开源 +15 · PDF +3。
          升级所需经验按 50·(L−1)·L 递增。
        </p>
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

.rule {
  font-size: 10.5px;
  color: var(--dim);
  line-height: 1.6;
  border-top: 2px dashed var(--line);
  padding-top: 10px;
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
