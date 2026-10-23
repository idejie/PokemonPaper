import type { Paper } from './types'

export type Tier = '普通' | '稀有' | '史诗' | '传说'

export interface LevelInfo {
  level: number
  tier: Tier
  parts: { code: number; stars: number; cites: number }
}

/**
 * 论文等级由三件事决定：
 * 有没有开源代码（+15）、GitHub star（最多 +40）、引用量（最多 +45）。
 * 对数刻度，避免一篇万引神作把所有精灵压成 1 级。
 */
export function paperLevel(paper: Pick<Paper, 'codeUrl' | 'stars' | 'citations'>): LevelInfo {
  const code = paper.codeUrl ? 15 : 0
  const stars = Math.min(
    40,
    (Math.log10(1 + Math.max(0, paper.stars || 0)) / Math.log10(10001)) * 40,
  )
  const cites = Math.min(
    45,
    (Math.log10(1 + Math.max(0, paper.citations || 0)) / Math.log10(5001)) * 45,
  )
  const level = Math.max(1, Math.min(100, Math.round(1 + code + stars + cites)))
  const tier: Tier = level >= 80 ? '传说' : level >= 60 ? '史诗' : level >= 35 ? '稀有' : '普通'
  return {
    level,
    tier,
    parts: { code, stars: Math.round(stars), cites: Math.round(cites) },
  }
}

export const TIER_COLORS: Record<Tier, string> = {
  普通: '#8d8175',
  稀有: '#3b5ba7',
  史诗: '#7b5cc4',
  传说: '#c9971b',
}
