<script setup lang="ts">
import { usePapersStore } from '../stores/papers'

const store = usePapersStore()
</script>

<template>
  <Transition name="toast">
    <div v-if="store.toast" :key="store.toast.id" class="toast" role="status">
      <span class="dot" aria-hidden="true" />
      {{ store.toast.text }}
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--ink);
  color: var(--paper);
  border: 3px solid var(--ink);
  box-shadow: 4px 4px 0 rgba(255, 203, 5, 0.9);
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 800;
  max-width: min(92vw, 560px);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--gold);
  flex: none;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
