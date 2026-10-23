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
  abstract: string
  explain: string
  pdfPath: string
  codeUrl: string
  stars: number
  citations: number
  metricsAt: string | null
  url: string
  addedAt: string
  readAt: string | null
}

export type PaperInput = Partial<Omit<Paper, 'id' | 'addedAt'>> & {
  title: string
}

export interface ArxivItem {
  arxiv: string
  title: string
  authors: string
  abstract: string
  published: string
  year: number | null
  venue: string
  comment: string
  category: string
}

export interface Explain {
  oneLiner: string
  problem: string
  method: string
  numbers: string[]
  limitations: string[]
  actions: string[]
}

export type ScholarProvider = 'off' | 'serpapi' | 'serper'

export interface LlmConfig {
  providerId: string
  baseUrl: string
  apiKey: string
  model: string
  scholarProvider: ScholarProvider
  scholarKey: string
}
