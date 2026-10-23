<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AuthView from './views/AuthView.vue'
import TrainerBar from './components/TrainerBar.vue'
import LocaleToggle from './components/LocaleToggle.vue'
import ToastHost from './components/ToastHost.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import AccountDialog from './components/AccountDialog.vue'
import ProfileDialog from './components/ProfileDialog.vue'
import OnboardingDialog from './components/OnboardingDialog.vue'
import { useAuthStore } from './stores/auth'
import { usePapersStore } from './stores/papers'
import { useUiStore } from './stores/ui'
import { t } from './core/i18n'

const auth = useAuthStore()
const route = useRoute()
const store = usePapersStore()
const ui = useUiStore()

let lastLevel: number | null = null
const hydrated = ref(false)
const levelUp = ref<{ level: number; title: string } | null>(null)
const showOnboarding = computed(
  () => Boolean(auth.user && (ui.onboarding || !auth.user.onboardedAt)),
)
let levelTimer: number | undefined

function playLevelChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.value = 0.025
      osc.connect(gain)
      gain.connect(ctx.destination)
      const at = ctx.currentTime + index * 0.09
      osc.start(at)
      osc.stop(at + 0.12)
    })
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // 没有音频权限就静默
  }
}

// 首次加载 / 切号时不要弹「升级」，只有真实操作导致的升级才提示
watch(
  () => store.loading,
  (loading) => {
    if (!loading) {
      window.setTimeout(() => {
        hydrated.value = true
        lastLevel = store.xp.level
      }, 400)
    }
  },
  { immediate: true },
)

watch(
  () => store.xp.level,
  (level) => {
    if (!hydrated.value || lastLevel === null) {
      lastLevel = level
      return
    }
    if (level > lastLevel) {
      store.notify(t('升到 Lv.{level} · {title}', { level, title: t(store.xp.title) }))
      levelUp.value = { level, title: store.xp.title }
      playLevelChime()
      window.clearTimeout(levelTimer)
      levelTimer = window.setTimeout(() => {
        levelUp.value = null
      }, 2400)
    }
    lastLevel = level
  },
  { immediate: true },
)

async function finishOnboarding() {
  ui.closeOnboarding()
  if (auth.user && !auth.user.onboardedAt) await auth.completeOnboarding()
}

onMounted(async () => {
  await auth.fetchMe()
  const params = new URLSearchParams(window.location.search)
  if (params.get('import') === '1') ui.openImport()
  if (params.get('settings') === '1') ui.openSettings()
  if (params.get('avatar') === '1') ui.openAvatar()
  if (params.get('profile') === '1') ui.openProfile()
})

watch(
  () => auth.user,
  (user) => {
    hydrated.value = false
    lastLevel = null
    if (user) void store.load()
    else store.clear()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="auth.loading" class="boot">
    <span class="spin" />
    {{ t('正在打开图鉴…') }}
  </div>

  <template v-else-if="!auth.user">
    <div class="locale-fixed"><LocaleToggle /></div>
    <RouterView v-if="route.name === 'reset'" />
    <AuthView v-else />
  </template>

  <template v-else>
    <TrainerBar />
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <OnboardingDialog v-if="showOnboarding" @close="finishOnboarding" />

    <div v-if="levelUp" class="levelup" @click="levelUp = null">
      <div class="levelup-card">
        <span class="kicker mono">LEVEL UP</span>
        <b class="mono">Lv.{{ levelUp.level }}</b>
        <span class="title">{{ t(levelUp.title) }}</span>
      </div>
    </div>
    <ImportDialog v-if="ui.importOpen" />
    <SettingsDialog v-if="ui.settingsOpen" />
    <AccountDialog v-if="ui.avatarOpen" />
    <ProfileDialog v-if="ui.profileOpen" />
    <ToastHost />
  </template>
</template>

<style scoped>
.levelup {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  background: rgba(43, 36, 32, 0.25);
  animation: fade-in 0.2s ease;
}

.levelup-card {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 22px 38px;
  background: var(--gold);
  border: 4px solid var(--ink);
  border-radius: 16px;
  box-shadow: 8px 8px 0 var(--ink);
  animation: level-pop 0.5s cubic-bezier(0.2, 1.5, 0.4, 1);
}

.levelup-card .kicker {
  font-size: 10px;
  letter-spacing: 0.22em;
  font-weight: 900;
}

.levelup-card b {
  font-size: 46px;
  line-height: 1;
  letter-spacing: -0.03em;
  text-shadow: 3px 3px 0 rgba(43, 36, 32, 0.25);
}

.levelup-card .title {
  font-size: 14px;
  font-weight: 900;
}

@keyframes level-pop {
  0% {
    transform: scale(0.6) rotate(-4deg);
    opacity: 0;
  }
  70% {
    transform: scale(1.05) rotate(1deg);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.locale-fixed {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 50;
}

.boot {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}
</style>
