import type { Paper } from './types'

export interface GymDef {
  id: string
  name: string
  icon: string
  prefixes: string[]
  read: number
  notes: number
}

export interface GymLevel {
  level: number
  name: string
  read: number
  notes: number
}

export interface GymStatus extends GymDef {
  readCount: number
  noteCount: number
  earned: boolean
  level: number
  tier: string
  next: GymLevel | null
}

export const GYM_LEVELS: GymLevel[] = [
  { level: 1, name: '青铜', read: 3, notes: 1 },
  { level: 2, name: '白银', read: 6, notes: 2 },
  { level: 3, name: '黄金', read: 12, notes: 4 },
  { level: 4, name: '铂金', read: 24, notes: 8 },
]

export function gymLevelFor(read: number, notes: number): number {
  let level = 0
  for (const tier of GYM_LEVELS) {
    if (read >= tier.read && notes >= tier.notes) level = tier.level
  }
  return level
}

export const GYMS: GymDef[] = [
  { id: 'cs', name: '代码道馆', icon: '💻', prefixes: ['cs.'], read: 3, notes: 1 },
  { id: 'math', name: '证明道馆', icon: '∑', prefixes: ['math.'], read: 3, notes: 1 },
  { id: 'stat', name: '数据道馆', icon: '📊', prefixes: ['stat.'], read: 3, notes: 1 },
  { id: 'eess', name: '电路道馆', icon: '⚡', prefixes: ['eess.'], read: 3, notes: 1 },
  { id: 'q-bio', name: '生命道馆', icon: '🧬', prefixes: ['q-bio.'], read: 3, notes: 1 },
  { id: 'q-fin', name: '量化道馆', icon: '💹', prefixes: ['q-fin.'], read: 3, notes: 1 },
  { id: 'econ', name: '经济道馆', icon: '🏦', prefixes: ['econ.'], read: 3, notes: 1 },
  { id: 'astro-ph', name: '星空道馆', icon: '🌌', prefixes: ['astro-ph.'], read: 3, notes: 1 },
  { id: 'cond-mat', name: '材料道馆', icon: '🔬', prefixes: ['cond-mat.'], read: 3, notes: 1 },
  { id: 'hep', name: '粒子道馆', icon: '⚛️', prefixes: ['hep-'], read: 3, notes: 1 },
  { id: 'quant-ph', name: '量子道馆', icon: '🌀', prefixes: ['quant-ph'], read: 3, notes: 1 },
  {
    id: 'physics',
    name: '物理道馆',
    icon: '🧲',
    prefixes: ['physics.', 'gr-qc', 'nlin.', 'math-ph', 'nucl-'],
    read: 3,
    notes: 1,
  },
]

function belongs(paper: Paper, gym: GymDef): boolean {
  const cats = [paper.primaryCategory, ...(paper.categories ?? [])]
  return cats.some(
    (cat) => Boolean(cat) && gym.prefixes.some((prefix) => cat === prefix || cat.startsWith(prefix)),
  )
}

export function gymStatus(papers: Paper[]): GymStatus[] {
  return GYMS.map((gym) => {
    const inGym = papers.filter((paper) => belongs(paper, gym))
    const read = inGym.filter((paper) => paper.status === 'read')
    const notes = read.filter((paper) => Boolean((paper.notes ?? '').trim()))
    const level = gymLevelFor(read.length, notes.length)
    return {
      ...gym,
      readCount: read.length,
      noteCount: notes.length,
      earned: level >= 1,
      level,
      tier: GYM_LEVELS.find((tier) => tier.level === level)?.name ?? '未入门',
      next: GYM_LEVELS.find((tier) => tier.level > level) ?? null,
    }
  })
}

export function paperInGym(paper: Paper, gymId: string): boolean {
  const gym = GYMS.find((item) => item.id === gymId)
  return gym ? belongs(paper, gym) : false
}
