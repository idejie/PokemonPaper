<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AuthView from './views/AuthView.vue'
import TrainerBar from './components/TrainerBar.vue'
import ToastHost from './components/ToastHost.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import AvatarDialog from './components/AvatarDialog.vue'
import { useAuthStore } from './stores/auth'
import { usePapersStore } from './stores/papers'
import { useUiStore } from './stores/ui'

const auth = useAuthStore()
const store = usePapersStore()
const ui = useUiStore()

onMounted(async () => {
  await auth.fetchMe()
  const params = new URLSearchParams(window.location.search)
  if (params.get('import') === '1') ui.openImport()
  if (params.get('settings') === '1') ui.openSettings()
  if (params.get('avatar') === '1') ui.openAvatar()
})

watch(
  () => auth.user,
  (user) => {
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
    <AvatarDialog v-if="ui.avatarOpen" />
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
