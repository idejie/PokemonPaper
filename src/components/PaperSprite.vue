<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SpriteSvg from './SpriteSvg.vue'

const props = withDefaults(
  defineProps<{
    seed: string
    category: string
    locked?: boolean
    spriteUrl?: string | null
  }>(),
  { locked: false, spriteUrl: null },
)

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
  <SpriteSvg v-else :seed="seed" :category="category" :locked="locked" />
</template>

<style scoped>
.sprite-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
