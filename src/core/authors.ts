import type { Paper } from './types'

export interface AuthorStat {
  name: string
  papers: number
  read: number
  categories: string[]
}

/** Handles both arXiv style ("Ada Lovelace, Alan Turing") and BibTeX ("Lovelace, Ada and Turing, Alan"). */
export function parseAuthors(raw: string): string[] {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return []

  const bibtex = /\s+and\s+/i.test(text)
  const parts = bibtex
    ? text.split(/\s+and\s+/i)
    : text.includes(';')
      ? text.split(';')
      : text.split(',')

  const names: string[] = []
  for (let part of parts) {
    part = part
      .replace(/\bet al\.?/gi, '')
      .replace(/\band others\b/gi, '')
      .trim()
    if (!part) continue
    if (bibtex && part.includes(',')) {
      const [last, ...rest] = part.split(',')
      if (rest.length && last.trim() && rest.join(',').trim()) {
        part = `${rest.join(',').trim()} ${last.trim()}`
      }
    }
    part = part.replace(/^[,;]+|[,;]+$/g, '').trim()
    if (part.length >= 2 && !/^others?$/i.test(part)) names.push(part)
  }
  return [...new Set(names)]
}

export function authorStats(papers: Paper[]): AuthorStat[] {
  const map = new Map<
    string,
    { name: string; papers: number; read: number; categories: Set<string> }
  >()
  for (const paper of papers) {
    for (const name of parseAuthors(paper.authors)) {
      const key = name.toLowerCase()
      const entry = map.get(key) ?? {
        name,
        papers: 0,
        read: 0,
        categories: new Set<string>(),
      }
      entry.papers += 1
      if (paper.status === 'read') entry.read += 1
      if (paper.primaryCategory) entry.categories.add(paper.primaryCategory)
      map.set(key, entry)
    }
  }
  return [...map.values()]
    .map((entry) => ({
      name: entry.name,
      papers: entry.papers,
      read: entry.read,
      categories: [...entry.categories].slice(0, 3),
    }))
    .sort(
      (a, b) =>
        b.read - a.read ||
        b.papers - a.papers ||
        a.name.localeCompare(b.name),
    )
}


export interface UnitStat {
  name: string
  papers: number
  read: number
}

export function unitStats(papers: Paper[]): UnitStat[] {
  const map = new Map<string, { name: string; papers: number; read: number }>()
  for (const paper of papers) {
    const units = (paper.affiliations || '')
      .split(',')
      .map((unit) => unit.trim())
      .filter((unit) => unit.length >= 2)
    for (const unit of [...new Set(units)]) {
      const key = unit.toLowerCase()
      const entry = map.get(key) ?? { name: unit, papers: 0, read: 0 }
      entry.papers += 1
      if (paper.status === 'read') entry.read += 1
      map.set(key, entry)
    }
  }
  return [...map.values()].sort(
    (a, b) => b.read - a.read || b.papers - a.papers || a.name.localeCompare(b.name),
  )
}
