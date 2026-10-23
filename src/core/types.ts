export type PaperStatus = 'unread' | 'reading' | 'read'

export type TypeKey =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'ghost'
  | 'steel'
  | 'dark'
  | 'dragon'

export interface Paper {
  id: string
  arxiv: string
  title: string
  authors: string
  venue: string
  year: number | null
  type: TypeKey
  status: PaperStatus
  rating: number
  tags: string
  notes: string
  url: string
  addedAt: string
  readAt: string | null
}

export type PaperInput = Partial<Omit<Paper, 'id' | 'addedAt'>> & {
  title: string
}
