<script setup lang="ts">
import { ref } from 'vue'
import AvatarSvg from './AvatarSvg.vue'
import LocaleToggle from './LocaleToggle.vue'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import { api } from '../core/api'
import { t } from '../core/i18n'

const store = usePapersStore()
const ui = useUiStore()
const auth = useAuthStore()

async function logout() {
  await auth.logout()
}
const busy = ref(false)

async function exportJson() {
  busy.value = true
  try {
    const data = await api.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pokemonpaper-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    store.notify(t('已导出 JSON 备份'))
  } catch {
    store.notify(t('导出失败'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <header class="trainer">
    <div class="wrap bar">
      <RouterLink to="/" class="brand">
        <span class="ball" />
        <span class="brand-text">
          <strong>PokemonPaper</strong>
          <small>{{ t('论文图鉴') }}</small>
        </span>
      </RouterLink>

      <div class="stats">
        <div class="stat">
          <b class="mono">{{ store.total }}</b>
          <span>{{ t('收录') }}</span>
        </div>
        <div class="stat">
          <b class="mono lit">{{ store.readCount }}</b>
          <span>{{ t('已点亮') }}</span>
        </div>
        <button
          class="trainer-chip"
          type="button"
          :title="t('训练家档案')"
          @click="ui.openProfile()"
        >
          <span class="avatar"><AvatarSvg :id="auth.user?.avatarId || 'red-cap'" /></span>
          <span class="meta">
            <b class="mono">Lv.{{ store.level }}</b>
            <small>{{ auth.user?.name }}</small>
          </span>
        </button>
        <div
          class="progress"
          :title="t('距离 Lv.{n} 还差 {m} XP', { n: store.level + 1, m: store.xp.needed })"
        >
          <div class="progress-fill" :style="{ width: store.xp.percent + '%' }" />
          <span class="progress-label mono">{{ store.xp.percent }}%</span>
        </div>
      </div>

      <div class="actions">
        <RouterLink to="/new" class="btn">＋ {{ t('登记论文') }}</RouterLink>
        <button class="btn ghost import-btn" @click="ui.openImport()">{{ t('导入') }}</button>
        <button class="btn ghost" :disabled="busy" @click="exportJson">{{ t('导出') }}</button>
        <button class="btn ghost" :title="t('退出登录')" @click="logout">{{ t('退出') }}</button>
        <RouterLink
          to="/leaderboard"
          class="btn icon"
          :title="t('天梯')"
          :aria-label="t('天梯')"
        >
          🏆
        </RouterLink>
        <RouterLink to="/stats" class="btn icon" :title="t('统计')" :aria-label="t('统计')">
          📊
        </RouterLink>
        <RouterLink to="/guide" class="btn icon" :title="t('等级说明')" :aria-label="t('等级说明')">
          ?
        </RouterLink>
        <a
          class="btn icon"
          href="https://github.com/idejie/PokemonPaper"
          target="_blank"
          rel="noreferrer"
          title="GitHub"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
        </a>
        <LocaleToggle />
        <button
          class="btn icon"
          :title="t('模型设置')"
          :aria-label="t('模型设置')"
          @click="ui.openSettings()"
        >
          ⚙
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.trainer {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--paper);
  border-bottom: 3px solid var(--ink);
}

.bar {
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 68px;
  padding-block: 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.ball {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid var(--ink);
  background: linear-gradient(to bottom, var(--red) 0 45%, var(--ink) 45% 55%, #fff 55% 100%);
  position: relative;
  flex: none;
}

.ball::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--ink);
  transform: translate(-50%, -50%);
}

.brand-text {
  display: grid;
  line-height: 1.15;
}

.brand-text strong {
  font-size: 15px;
  letter-spacing: 0.01em;
}

.brand-text small {
  font-size: 10.5px;
  color: var(--dim);
  font-weight: 700;
  letter-spacing: 0.18em;
}

.stats {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-left: auto;
}

.stat {
  display: grid;
  line-height: 1.2;
}

.stat b {
  font-size: 17px;
}

.stat b.lit {
  color: var(--red);
}

.stat span {
  font-size: 10px;
  color: var(--dim);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.progress {
  position: relative;
  width: 130px;
  height: 16px;
  border: 2.5px solid var(--ink);
  border-radius: 4px;
  background: var(--panel);
  overflow: hidden;
}

.progress-fill {
  transition: width 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
  height: 100%;
  background: linear-gradient(to bottom, #ffe27a 0 45%, var(--gold) 45% 100%);
  transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.progress-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 9.5px;
  font-weight: 800;
  color: var(--ink);
}

.trainer-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  padding: 2px 10px 2px 2px;
  box-shadow: 2px 2px 0 var(--ink);
  transition: transform 0.1s ease;
}

.trainer-chip:hover {
  transform: translate(-1px, -1px);
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--ink);
  background: #f7ecd2;
  flex: none;
}

.meta {
  display: grid;
  line-height: 1.1;
  text-align: left;
}

.meta b {
  font-size: 12px;
}

.meta small {
  font-size: 9.5px;
  color: var(--dim);
  font-weight: 700;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn.icon {
  padding: 7px 9px;
  font-size: 14px;
  background: var(--panel);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

@media (max-width: 980px) {
  .stats .trainer-chip .meta,
  .progress {
    display: none;
  }
}

@media (max-width: 760px) {
  .brand-text small,
  .stats {
    display: none;
  }

  .actions .import-btn {
    display: none;
  }

  .bar {
    justify-content: space-between;
  }
}
</style>
