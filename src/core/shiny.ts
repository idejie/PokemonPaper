import type { Paper } from './types'

export type ShinyReason = 'stars' | 'venue' | 'classic' | 'roll'

export interface ShinyInfo {
  shiny: boolean
  reason: ShinyReason | null
}

const TOP_VENUES: RegExp[] = [
  /neurips/i,
  /\bnips\b/i,
  /icml/i,
  /iclr/i,
  /cvpr/i,
  /iccv/i,
  /eccv/i,
  /\bacl\b/i,
  /emnlp/i,
  /naacl/i,
  /coling/i,
  /jmlr/i,
  /tpami/i,
  /tmlr/i,
  /aaai/i,
  /ijcai/i,
  /\bnature\b/i,
  /\bscience\b/i,
  /\bcell\b/i,
  /\bpnas\b/i,
]

function hash(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function shinyOf(
  paper: Pick<Paper, 'arxiv' | 'venue' | 'stars' | 'year'>,
): ShinyInfo {
  if ((paper.stars || 0) >= 5000) return { shiny: true, reason: 'stars' }
  if (paper.venue && TOP_VENUES.some((pattern) => pattern.test(paper.venue ?? ''))) {
    return { shiny: true, reason: 'venue' }
  }
  if (paper.year && paper.year <= new Date().getFullYear() - 10) {
    return { shiny: true, reason: 'classic' }
  }
  if (paper.arxiv && hash(paper.arxiv) % 64 === 0) return { shiny: true, reason: 'roll' }
  return { shiny: false, reason: null }
}

export const SHINY_LABEL: Record<ShinyReason, string> = {
  stars: '高引',
  venue: '顶会 / 顶刊',
  classic: '十年经典',
  roll: '1/64 概率',
}
