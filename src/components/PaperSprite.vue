<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SpriteSvg from './SpriteSvg.vue'
import type { PaperStatus } from '../core/types'

const props = withDefaults(
  defineProps<{
    seed: string
    category: string
    locked?: boolean
    spriteUrl?: string | null
    status?: PaperStatus
    notes?: string
  }>(),
  { locked: false, spriteUrl: null, status: undefined, notes: '' },
)

const stage = computed(() => {
  const status = props.status ?? (props.locked ? 'unread' : 'read')
  if (status === 'unread') return 1
  if (status === 'reading') return 2
  return props.notes?.trim() ? 4 : 3
})

const failed = ref(false)
watch(
  () => props.spriteUrl,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => Boolean(props.spriteUrl) && !props.locked && !failed.value)
</script>

<template>
  <img
    v-if="showImage"
    :src="props.spriteUrl ?? undefined"
    class="sprite-art"
    alt=""
    @error="failed = true"
  />
  <SpriteSvg v-else :seed="seed" :category="category" :locked="locked" :stage="stage" />
</template>

<style scoped>
.sprite-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
