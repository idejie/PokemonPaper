const ARXIV_RE = /(\d{4}\.\d{4,5})(?:v\d+)?/i

/** 从 URL / PDF 链接 / 裸编号里提取 arXiv 编号，例如 2610.28480 */
export function parseArxivId(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null
  const match = raw.match(ARXIV_RE)
  return match ? match[1] : null
}

export function arxivPdfUrl(id: string): string {
  return `https://arxiv.org/pdf/${id}`
}

export function arxivAbsUrl(id: string): string {
  return `https://arxiv.org/abs/${id}`
}

/** 2610.28480 -> "2026-10"（arXiv 编号前四位是 YYMM） */
export function arxivMonth(id: string): string {
  const match = id.match(/^(\d{2})(\d{2})\./)
  if (!match) return ''
  return `20${match[1]}-${match[2]}`
}
