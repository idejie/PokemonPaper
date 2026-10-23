<script setup lang="ts">
import { computed } from 'vue'
import { SPRITE_SIZE, buildSprite } from '../core/sprite'

const props = withDefaults(
  defineProps<{
    seed: string
    category: string
    locked?: boolean
  }>(),
  { locked: false },
)

const rects = computed(() => buildSprite(props.seed, props.category, props.locked))
</script>

<template>
  <div class="sprite-tilt">
    <svg
      class="sprite"
      :viewBox="`-2 -2 ${SPRITE_SIZE + 4} ${SPRITE_SIZE + 4}`"
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
  </div>
</template>

<style scoped>
.sprite-tilt {
  width: 100%;
  height: 100%;
  transform: perspective(820px) rotateX(9deg) rotateY(-9deg);
  transform-origin: 50% 72%;
  filter: drop-shadow(1px 1.3px 0 #2b2420) drop-shadow(1px 1.3px 0 #2b2420)
    drop-shadow(1px 1.3px 0 #2b2420) drop-shadow(1px 1.3px 0 #2b2420)
    drop-shadow(2px 5px 0 rgba(43, 36, 32, 0.18));
  transition: transform 0.25s ease;
}

.sprite-tilt:hover {
  transform: perspective(820px) rotateX(12deg) rotateY(-16deg) translateY(-2px);
}

.sprite {
  display: block;
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .sprite-tilt,
  .sprite-tilt:hover {
    transform: none;
  }
}
</style>
