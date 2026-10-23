<script setup lang="ts">
import { computed } from 'vue'
import { AVATARS, AVATAR_SIZE, buildAvatar } from '../core/avatar'

const props = defineProps<{ id: string }>()

const rects = computed(() => {
  const preset = AVATARS.find((item) => item.id === props.id) ?? AVATARS[0]
  return buildAvatar(preset)
})
</script>

<template>
  <svg
    class="avatar-svg"
    :viewBox="`-1 -1 ${AVATAR_SIZE + 2} ${AVATAR_SIZE + 2}`"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <rect
      v-for="(rect, index) in rects"
      :key="index"
      :x="rect.x"
      :y="rect.y"
      :width="rect.w"
      :height="rect.h"
      :fill="rect.fill"
    />
  </svg>
</template>

<style scoped>
.avatar-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
