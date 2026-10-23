import type { Paper } from './types'

export interface Badge {
  id: string
  name: string
  desc: string
  unlocked: boolean
}

export interface ProgressStats {
  total: number
  read: number
  reading: number
  notes: number
  explained: number
  openSource: number
  withPdf: number
}

export interface Progress {
  xp: number
  level: number
  title: string
  currentLevelXp: number
  nextLevelXp: number
  intoLevel: number
  needed: number
  percent: number
  stats: ProgressStats
  badges: Badge[]
}

/** 每篇论文贡献的经验，按完成度叠加 */
const XP = {
  added: 10,
  read: 50,
  notes: 5,
  explain: 8,
  rated: 2,
  openSource: 15,
  pdf: 3,
}

const TITLES: Array<[number, string]> = [
  [50, '文献大师'],
  [35, '知识训练家'],
  [20, '论文猎人'],
  [10, '图鉴收集者'],
  [5, '见习研究员'],
  [1, '新手训练家'],
]

/** 第 L 级需要的累计经验：50·(L-1)·L —— L2=100，L5=1000，L10=4500 */
export function xpForLevel(level: number): number {
  return 50 * Math.max(0, level - 1) * level
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

export function titleForLevel(level: number): string {
  for (const [min, title] of TITLES) {
    if (level >= min) return title
  }
  return TITLES[TITLES.length - 1][1]
}

function paperXp(paper: Paper): number {
  let xp = XP.added
  if (paper.status === 'read') xp += XP.read
  if (paper.notes.trim()) xp += XP.notes
  if (paper.explain) xp += XP.explain
  if (paper.rating > 0) xp += XP.rated
  if (paper.codeUrl) xp += XP.openSource
  if (paper.pdfPath) xp += XP.pdf
  return xp
}

export function computeProgress(papers: Paper[]): Progress {
  const stats: ProgressStats = {
    total: papers.length,
    read: 0,
    reading: 0,
    notes: 0,
    explained: 0,
    openSource: 0,
    withPdf: 0,
  }

  let xp = 0
  for (const paper of papers) {
    xp += paperXp(paper)
    if (paper.status === 'read') stats.read += 1
    if (paper.status === 'reading') stats.reading += 1
    if (paper.notes.trim()) stats.notes += 1
    if (paper.explain) stats.explained += 1
    if (paper.codeUrl) stats.openSource += 1
    if (paper.pdfPath) stats.withPdf += 1
  }

  const level = levelForXp(xp)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)

  return {
    xp,
    level,
    title: titleForLevel(level),
    currentLevelXp,
    nextLevelXp,
    intoLevel: xp - currentLevelXp,
    needed: nextLevelXp - xp,
    percent: Math.min(100, Math.round(((xp - currentLevelXp) / span) * 100)),
    stats,
    badges: [
      {
        id: 'first',
        name: '初次登记',
        desc: '收录第一篇论文',
        unlocked: stats.total >= 1,
      },
      {
        id: 'ten',
        name: '十篇达成',
        desc: '图鉴收录 10 篇',
        unlocked: stats.total >= 10,
      },
      {
        id: 'lit-one',
        name: '第一束光',
        desc: '点亮第一只精灵',
        unlocked: stats.read >= 1,
      },
      {
        id: 'lit-ten',
        name: '十盏灯',
        desc: '点亮 10 只精灵',
        unlocked: stats.read >= 10,
      },
      {
        id: 'notes',
        name: '笔记习惯',
        desc: '给 5 篇论文写过笔记',
        unlocked: stats.notes >= 5,
      },
      {
        id: 'explain',
        name: '速读卡收藏家',
        desc: '生成 5 份 AI 解读',
        unlocked: stats.explained >= 5,
      },
      {
        id: 'open',
        name: '开源猎人',
        desc: '收录 5 篇有代码的论文',
        unlocked: stats.openSource >= 5,
      },
      {
        id: 'pdf',
        name: '本地图书馆',
        desc: '本地存下 10 份 PDF',
        unlocked: stats.withPdf >= 10,
      },
    ],
  }
}
