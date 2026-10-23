<script setup lang="ts">
import { computed } from 'vue'
import { SPRITE_SIZE, buildSprite } from '../core/sprite'
import type { TypeKey } from '../core/types'

const props = withDefaults(
  defineProps<{
    seed: string
    type: TypeKey
    locked?: boolean
  }>(),
  { locked: false },
)

const rects = computed(() => buildSprite(props.seed, props.type, props.locked))
</script>

<template>
  <svg class="sprite" :viewBox="`-2 -2 ${SPRITE_SIZE + 4} ${SPRITE_SIZE + 4}`" shape-rendering="crispEdges" aria-hidden="true">
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
.sprite {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
