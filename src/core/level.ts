import type { Paper } from './types'

export type Tier = '普通' | '稀有' | '史诗' | '传说'

export interface LevelInfo {
  level: number
  tier: Tier
  parts: { code: number; stars: number }
}

/**
 * 等级只看两件事：
 * 1. 有没有开源代码 —— 没有就是 Lv.1「普通」
 * 2. GitHub star —— 对数刻度，0 star 从 Lv.15 起，5 万 star 封顶 Lv.100
 *
 */
export function paperLevel(paper: Pick<Paper, 'codeUrl' | 'stars'>): LevelInfo {
  if (!paper.codeUrl) {
    return { level: 1, tier: '普通', parts: { code: 0, stars: 0 } }
  }
  const stars = Math.max(0, paper.stars || 0)
  const raw = 15 + (85 * Math.log10(1 + stars)) / Math.log10(50001)
  const level = Math.max(15, Math.min(100, Math.round(raw)))
  const tier: Tier = level >= 70 ? '传说' : level >= 45 ? '史诗' : level >= 25 ? '稀有' : '普通'
  return { level, tier, parts: { code: 15, stars: level - 15 } }
}

export const TIER_COLORS: Record<Tier, string> = {
  普通: '#8d8175',
  稀有: '#3b5ba7',
  史诗: '#7b5cc4',
  传说: '#c9971b',
}
