export type PaperStatus = 'unread' | 'reading' | 'read'

export interface Paper {
  id: string
  arxiv: string
  title: string
  authors: string
  venue: string
  year: number | null
  status: PaperStatus
  rating: number
  tags: string
  notes: string
  abstract: string
  explain: string
  pdfPath: string
  codeUrl: string
  stars: number
  metricsAt: string | null
  summary: string
  summaryAt: string | null
  hasFullText: boolean
  fullTextChars: number
  primaryCategory: string
  categories: string[]
  url: string
  addedAt: string
  readAt: string | null
}

export type PaperInput = Partial<Omit<Paper, 'id' | 'addedAt'>> & {
  title: string
}

export interface ArxivItem {
  arxiv: string
  primaryCategory?: string
  categories?: string[]
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

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarId: string
  isAdmin: boolean
  createdAt: string
}

export interface AnnotationRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Annotation {
  id: string
  start: number
  end: number
  page: number
  rects: AnnotationRect[]
  quote: string
  color: 'yellow' | 'green' | 'blue' | 'pink'
  comment: string
  isPublic: boolean
  groupId: string | null
  mine: boolean
  author: string | null
  createdAt: string
  updatedAt: string | null
}

export interface Invite {
  code: string
  createdAt: string
  used: boolean
  usedAt: string | null
}

export interface LlmConfig {
  providerId: string
  baseUrl: string
  apiKey: string
  model: string
}
