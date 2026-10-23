<script setup lang="ts">
import { onMounted } from 'vue'
import TrainerBar from './components/TrainerBar.vue'
import ToastHost from './components/ToastHost.vue'
import ImportDialog from './components/ImportDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { usePapersStore } from './stores/papers'
import { useUiStore } from './stores/ui'

const store = usePapersStore()
const ui = useUiStore()

onMounted(() => {
  void store.load()
  // 方便分享/调试：?import=1 或 ?settings=1 直接打开对应弹窗
  const params = new URLSearchParams(window.location.search)
  if (params.get('import') === '1') ui.openImport()
  if (params.get('settings') === '1') ui.openSettings()
})
</script>

<template>
  <TrainerBar />
  <RouterView />
  <ImportDialog v-if="ui.importOpen" />
  <SettingsDialog v-if="ui.settingsOpen" />
  <ToastHost />
</template>
