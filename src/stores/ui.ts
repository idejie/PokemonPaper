import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', () => {
  const settingsOpen = ref(false)
  const importOpen = ref(false)
  const avatarOpen = ref(false)

  function openSettings() {
    settingsOpen.value = true
  }
  function closeSettings() {
    settingsOpen.value = false
  }
  function openImport() {
    importOpen.value = true
  }
  function closeImport() {
    importOpen.value = false
  }
  function openAvatar() {
    avatarOpen.value = true
  }
  function closeAvatar() {
    avatarOpen.value = false
  }

  return {
    settingsOpen,
    importOpen,
    avatarOpen,
    openAvatar,
    closeAvatar,
    openSettings,
    closeSettings,
    openImport,
    closeImport,
  }
})
