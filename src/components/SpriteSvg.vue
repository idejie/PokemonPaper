<script setup lang="ts">
import { computed, useId } from 'vue'
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
const uid = useId()
const lightId = computed(() => `sprite-light-${uid}`)
const maskId = computed(() => `sprite-mask-${uid}`)
</script>

<template>
  <div class="sprite-tilt">
    <svg
      class="sprite"
      :viewBox="`-2 -2 ${SPRITE_SIZE + 4} ${SPRITE_SIZE + 4}`"
      shape-rendering="geometricPrecision"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="lightId" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stop-color="#fffdf4" stop-opacity="0.3" />
          <stop offset="0.42" stop-color="#fffdf4" stop-opacity="0" />
          <stop offset="1" stop-color="#2b2420" stop-opacity="0.24" />
        </linearGradient>
        <mask :id="maskId" maskUnits="userSpaceOnUse" x="-2" y="-2" :width="SPRITE_SIZE + 4" :height="SPRITE_SIZE + 4">
          <rect
            v-for="(rect, index) in rects"
            :key="`m-${index}`"
            :x="rect.x"
            :y="rect.y"
            :width="rect.w"
            :height="rect.h"
            fill="#fff"
          />
        </mask>
      </defs>

      <rect
        v-for="(rect, index) in rects"
        :key="index"
        :x="rect.x"
        :y="rect.y"
        :width="rect.w"
        :height="rect.h"
        rx="0.42"
        ry="0.42"
        :fill="rect.fill"
      />

      <rect
        x="-2"
        y="-2"
        :width="SPRITE_SIZE + 4"
        :height="SPRITE_SIZE + 4"
        :fill="`url(#${lightId})`"
        :mask="`url(#${maskId})`"
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
  filter: blur(0.6px) saturate(1.06);
}

@media (prefers-reduced-motion: reduce) {
  .sprite-tilt,
  .sprite-tilt:hover {
    transform: none;
  }
}
</style>
