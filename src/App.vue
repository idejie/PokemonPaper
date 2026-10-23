<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AuthView from './views/AuthView.vue'
import TrainerBar from './components/TrainerBar.vue'
import ToastHost from './components/ToastHost.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import AccountDialog from './components/AccountDialog.vue'
import ProfileDialog from './components/ProfileDialog.vue'
import { useAuthStore } from './stores/auth'
import { usePapersStore } from './stores/papers'
import { useUiStore } from './stores/ui'

const auth = useAuthStore()
const store = usePapersStore()
const ui = useUiStore()

let lastLevel: number | null = null
const hydrated = ref(false)

// 首次加载 / 切号时不要弹「升级」，只有真实操作导致的升级才提示
watch(
  () => store.loading,
  (loading) => {
    if (!loading) {
      window.setTimeout(() => {
        hydrated.value = true
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
      store.notify(`升到 Lv.${level} · ${store.xp.title}`)
    }
    lastLevel = level
  },
  { immediate: true },
)

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
    正在打开图鉴…
  </div>

  <AuthView v-else-if="!auth.user" />

  <template v-else>
    <TrainerBar />
    <RouterView />
    <ImportDialog v-if="ui.importOpen" />
    <SettingsDialog v-if="ui.settingsOpen" />
    <AccountDialog v-if="ui.avatarOpen" />
    <ProfileDialog v-if="ui.profileOpen" />
    <ToastHost />
  </template>
</template>

<style scoped>
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
