<script setup lang="ts">
import { computed, useId } from 'vue'
import { buildCartoon, CARTOON_SIZE } from '../core/cartoon'

const props = withDefaults(
  defineProps<{
    seed: string
    category: string
    locked?: boolean
  }>(),
  { locked: false },
)

const scene = computed(() => buildCartoon(props.seed, props.category, props.locked))
const uid = useId()

const bodyGrad = computed(() => `cartoon-body-${uid}`)

function paint(token: string | undefined): string | undefined {
  if (!token) return undefined
  if (props.locked && token === '#2f2620') return '#6f6658'
  const palette = scene.value.palette
  if (token === 'body' || token === 'locked') {
    return props.locked ? '#6f6658' : `url(#${bodyGrad.value})`
  }
  if (token === 'accent') return palette.accent
  if (token === 'ink') return '#2b2420'
  if (token === 'white') return '#fffdf6'
  if (token === 'cheek') return '#e8707f'
  if (token === 'mouth') return '#7c3535'
  if (token === 'tongue') return '#e58a8a'
  if (token === 'shadow') return 'rgba(43, 36, 32, 0.16)'
  if (token === 'spark') return '#f2b93e'
  return token
}
</script>

<template>
  <div class="sprite-tilt">
    <svg
      class="sprite"
      :viewBox="`-2 -2 ${CARTOON_SIZE + 4} ${CARTOON_SIZE + 4}`"
      aria-hidden="true"
    >
      <defs>
        <radialGradient :id="bodyGrad" cx="32%" cy="24%" r="82%">
          <stop offset="0" :stop-color="props.locked ? '#8b8172' : scene.palette.light" />
          <stop offset="0.55" :stop-color="props.locked ? '#6f6658' : scene.palette.base" />
          <stop offset="1" :stop-color="props.locked ? '#554e43' : scene.palette.dark" />
        </radialGradient>
      </defs>

      <template v-for="(shape, index) in scene.shapes" :key="index">
        <path
          v-if="shape.tag === 'path'"
          v-bind="shape.attrs"
          :fill="paint(shape.fill)"
          :stroke="paint(shape.stroke)"
        />
        <ellipse
          v-else-if="shape.tag === 'ellipse'"
          v-bind="shape.attrs"
          :fill="paint(shape.fill)"
          :stroke="paint(shape.stroke)"
        />
        <circle
          v-else-if="shape.tag === 'circle'"
          v-bind="shape.attrs"
          :fill="paint(shape.fill)"
          :stroke="paint(shape.stroke)"
        />
        <rect
          v-else
          v-bind="shape.attrs"
          :fill="paint(shape.fill)"
          :stroke="paint(shape.stroke)"
        />
      </template>
    </svg>
  </div>
</template>

<style scoped>
.sprite-tilt {
  width: 100%;
  height: 100%;
  transform: perspective(1000px) rotateX(4deg) rotateY(-5deg);
  transform-origin: 50% 70%;
  filter: drop-shadow(0 6px 5px rgba(43, 36, 32, 0.18));
  transition: transform 0.25s ease;
}

.sprite-tilt:hover {
  transform: perspective(1000px) rotateX(7deg) rotateY(-10deg) translateY(-2px);
}

.sprite {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

@media (prefers-reduced-motion: reduce) {
  .sprite-tilt,
  .sprite-tilt:hover {
    transform: none;
  }
}
</style>
