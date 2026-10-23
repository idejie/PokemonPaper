import type { Paper } from './types'

export interface BondStats {
  views: number
  seconds: number
  lastVisit: string
}

export interface BondInfo {
  score: number
  tier: string
  hearts: number
}

const KEY = 'pokemonpaper.bond.v1'

function load(): Record<string, BondStats> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, BondStats>
  } catch {
    return {}
  }
}

function save(all: Record<string, BondStats>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 隐私模式 */
  }
}

export function bondStats(paperId: string): BondStats {
  return load()[paperId] ?? { views: 0, seconds: 0, lastVisit: '' }
}

export function recordVisit(paperId: string) {
  const all = load()
  const entry = all[paperId] ?? { views: 0, seconds: 0, lastVisit: '' }
  entry.views += 1
  entry.lastVisit = new Date().toISOString()
  all[paperId] = entry
  save(all)
}

export function addReadingTime(paperId: string, seconds: number) {
  if (!paperId || seconds <= 0) return
  const all = load()
  const entry = all[paperId] ?? { views: 0, seconds: 0, lastVisit: '' }
  entry.seconds += seconds
  all[paperId] = entry
  save(all)
}

export function bondOf(paper: Paper, stats: BondStats): BondInfo {
  const chars = (paper.notes ?? '').trim().length
  const minutes = stats.seconds / 60
  const statusBonus = paper.status === 'read' ? 10 : paper.status === 'reading' ? 4 : 0
  const score = Math.min(
    100,
    Math.round(chars / 20 + stats.views * 3 + minutes * 2 + statusBonus),
  )
  const tier = score >= 80 ? '羁绊' : score >= 50 ? '亲密' : score >= 20 ? '熟悉' : '陌生'
  const hearts = score >= 80 ? 3 : score >= 50 ? 2 : score >= 20 ? 1 : 0
  return { score, tier, hearts }
}
