import type { TypeKey } from './types'

export interface TypeDef {
  cn: string
  base: string
  light: string
  dark: string
}

export const TYPES: Record<TypeKey, TypeDef> = {
  normal: { cn: '普通', base: '#c2b49a', light: '#e0d5c0', dark: '#94876f' },
  fire: { cn: '火', base: '#ef7a52', light: '#ffa587', dark: '#bf4f2c' },
  water: { cn: '水', base: '#5f8ee8', light: '#8fb4f5', dark: '#3f66b8' },
  grass: { cn: '草', base: '#6fbe57', light: '#9ad989', dark: '#4a8f3a' },
  electric: { cn: '电', base: '#f2c53d', light: '#ffe27a', dark: '#c29520' },
  psychic: { cn: '超能', base: '#a97fe0', light: '#c9a9f2', dark: '#7b57b3' },
  ghost: { cn: '幽灵', base: '#7a6aa8', light: '#a396c9', dark: '#54487d' },
  steel: { cn: '钢', base: '#9fb0c2', light: '#c4d2df', dark: '#6f8093' },
  dark: { cn: '恶', base: '#6b5a52', light: '#95827a', dark: '#443833' },
  dragon: { cn: '龙', base: '#7b5ad1', light: '#a488ea', dark: '#553aa3' },
}

export const TYPE_KEYS = Object.keys(TYPES) as TypeKey[]

export const TYPE_COLORS: Record<TypeKey, string> = {
  normal: '#8d8175',
  fire: '#d95f3b',
  water: '#3f66b8',
  grass: '#4a8f3a',
  electric: '#b8860b',
  psychic: '#7b57b3',
  ghost: '#54487d',
  steel: '#5f7286',
  dark: '#443833',
  dragon: '#553aa3',
}

const RULES: Array<[RegExp, TypeKey]> = [
  [/world[- ]model|wam|视频预测|video prediction|model-based/i, 'psychic'],
  [/humanoid|human-plus|whole[- ]body|locomotion|motion tracking/i, 'steel'],
  [/reinforcement|\brl\b|ppo|\brl\b|reward/i, 'fire'],
  [/diffusion|generative|vae|flow matching|denois/i, 'ghost'],
  [/video|vision|visual|image|vlm/i, 'water'],
  [/large|foundation|scaling|llm|transformer/i, 'dragon'],
  [/benchmark|evaluation|dataset|data engine/i, 'dark'],
  [/imitation|behavior cloning|dagger|policy/i, 'normal'],
  [/efficien|compute|gpu|throughput/i, 'electric'],
  [/manipulation|grasp|dexterous|robot arm/i, 'grass'],
]

export function guessType(...parts: Array<string | undefined | null>): TypeKey {
  const text = parts.filter(Boolean).join(' ')
  for (const [re, type] of RULES) {
    if (re.test(text)) return type
  }
  return 'normal'
}
