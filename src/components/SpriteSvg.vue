<script setup lang="ts">
import { computed, useId } from 'vue'
import { SPRITE_SIZE, buildSprite } from '../core/sprite'

const props = withDefaults(
  defineProps<{
    seed: string
    category: string
    locked?: boolean
    stage?: number
    shiny?: boolean
  }>(),
  { locked: false, stage: 3, shiny: false },
)

const rects = computed(() =>
  buildSprite(props.seed, props.category, props.locked, props.stage, props.shiny),
)
const stageScale = computed(() => [0, 0.78, 0.9, 1, 1.04][Math.min(4, Math.max(1, props.stage))] ?? 1)
const uid = useId()
const lightId = computed(() => `sprite-light-${uid}`)
const maskId = computed(() => `sprite-mask-${uid}`)
</script>

<template>
  <div class="sprite-tilt" :class="{ shiny: props.shiny && !props.locked }" :style="{ '--stage-scale': stageScale }">
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

      <g v-if="props.shiny && !props.locked" class="shiny-stars">
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(5 22)" />
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(62 30) scale(0.9)" />
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(10 52) scale(0.7)" />
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(56 5) scale(0.6)" />
      </g>

      <g v-if="props.stage >= 4" class="aura">
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(6 9)" />
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(61 13) scale(1.15)" />
        <path d="M 0 -3.4 L 1 -1 L 3.4 0 L 1 1 L 0 3.4 L -1 1 L -3.4 0 L -1 -1 Z" transform="translate(57 53) scale(0.8)" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.sprite-tilt {
  width: 100%;
  height: 100%;
  transform: perspective(820px) rotateX(9deg) rotateY(-9deg) scale(var(--stage-scale, 1));
  transform-origin: 50% 72%;
  filter: drop-shadow(1px 1.3px 0 #2b2420) drop-shadow(1px 1.3px 0 #2b2420)
    drop-shadow(1px 1.3px 0 #2b2420) drop-shadow(1px 1.3px 0 #2b2420)
    drop-shadow(2px 5px 0 rgba(43, 36, 32, 0.18));
  transition: transform 0.25s ease;
}

.sprite-tilt:hover {
  transform: perspective(820px) rotateX(12deg) rotateY(-16deg) translateY(-2px) scale(var(--stage-scale, 1));
}

.shiny-stars path {
  fill: #ffe6a3;
  stroke: #a86b12;
  stroke-width: 0.8;
  animation: shiny-twinkle 1.9s ease-in-out infinite;
}

.shiny-stars path:nth-child(2) {
  animation-delay: 0.35s;
}

.shiny-stars path:nth-child(3) {
  animation-delay: 0.7s;
}

.shiny-stars path:nth-child(4) {
  animation-delay: 1.05s;
}

@keyframes shiny-twinkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.sprite-tilt.shiny {
  filter: drop-shadow(0 0 8px rgba(242, 185, 62, 0.75))
    drop-shadow(2px 5px 0 rgba(43, 36, 32, 0.18));
}

.aura path {
  fill: #f2c14e;
  stroke: #2b2420;
  stroke-width: 0.8;
  transform-box: fill-box;
  transform-origin: center;
  animation: aura-twinkle 2.4s ease-in-out infinite;
}

.aura path:nth-child(2) {
  animation-delay: 0.5s;
}

.aura path:nth-child(3) {
  animation-delay: 1s;
}

@keyframes aura-twinkle {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.sprite {
  display: block;
  width: 100%;
  height: 100%;
  filter: blur(0.6px) saturate(1.06);
}

@media (prefers-reduced-motion: reduce) {
  .shiny-stars path {
  fill: #ffe6a3;
  stroke: #a86b12;
  stroke-width: 0.8;
  animation: shiny-twinkle 1.9s ease-in-out infinite;
}

.shiny-stars path:nth-child(2) {
  animation-delay: 0.35s;
}

.shiny-stars path:nth-child(3) {
  animation-delay: 0.7s;
}

.shiny-stars path:nth-child(4) {
  animation-delay: 1.05s;
}

@keyframes shiny-twinkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.sprite-tilt.shiny {
  filter: drop-shadow(0 0 8px rgba(242, 185, 62, 0.75))
    drop-shadow(2px 5px 0 rgba(43, 36, 32, 0.18));
}

.aura path {
    animation: none;
  }

  .sprite-tilt,
  .sprite-tilt:hover {
    transform: none;
  }
}
</style>
