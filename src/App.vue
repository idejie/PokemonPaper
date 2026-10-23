<script setup lang="ts">
import { onMounted } from 'vue'
import TrainerBar from './components/TrainerBar.vue'
import ToastHost from './components/ToastHost.vue'
import { usePapersStore } from './stores/papers'

const store = usePapersStore()

onMounted(() => {
  void store.load()
})
</script>

<template>
  <TrainerBar />
  <RouterView />
  <ToastHost />
</template>
