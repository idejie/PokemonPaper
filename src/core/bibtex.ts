export interface BibEntry {
  type: string
  key: string
  fields: Record<string, string>
}

const ARXIV_RE = /(\d{4}\.\d{4,5})(?:v\d+)?/

function clean(value: string): string {
  return value
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\\$/g, '$')
    .replace(/\\textbf\{([^{}]*)\}/g, '$1')
    .replace(/\\emph\{([^{}]*)\}/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
}

function readBalanced(input: string, start: number, open: string, close: string): [string, number] {
  let depth = 0
  let index = start
  for (; index < input.length; index += 1) {
    const char = input[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return [input.slice(start + 1, index), index + 1]
    }
  }
  return [input.slice(start + 1), input.length]
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let index = 0
  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index])) index += 1
    const nameStart = index
    while (index < body.length && /[A-Za-z0-9_-]/.test(body[index])) index += 1
    const name = body.slice(nameStart, index).toLowerCase()
    while (index < body.length && /\s/.test(body[index])) index += 1
    if (body[index] !== '=') {
      // 无法解析的片段，跳到下一个逗号
      const next = body.indexOf(',', index)
      if (next < 0) break
      index = next + 1
      continue
    }
    index += 1
    while (index < body.length && /\s/.test(body[index])) index += 1

    let value = ''
    if (body[index] === '{') {
      const [raw, next] = readBalanced(body, index, '{', '}')
      value = raw
      index = next
    } else if (body[index] === '"') {
      let cursor = index + 1
      let buffer = ''
      while (cursor < body.length && !(body[cursor] === '"' && body[cursor - 1] !== '\\')) {
        buffer += body[cursor]
        cursor += 1
      }
      value = buffer
      index = cursor + 1
    } else {
      const start = index
      while (index < body.length && body[index] !== ',' && body[index] !== '\n') index += 1
      value = body.slice(start, index)
    }

    if (name) fields[name] = clean(value)
    const comma = body.indexOf(',', index)
    if (comma < 0) break
    index = comma + 1
  }
  return fields
}

export function parseBibtex(input: string): BibEntry[] {
  const entries: BibEntry[] = []
  let cursor = 0
  while (cursor < input.length) {
    const at = input.indexOf('@', cursor)
    if (at < 0) break

    let index = at + 1
    while (index < input.length && /[A-Za-z]/.test(input[index])) index += 1
    const type = input.slice(at + 1, index).toLowerCase()
    while (index < input.length && /\s/.test(input[index])) index += 1

    const open = input[index]
    if (open !== '{' && open !== '(') {
      cursor = at + 1
      continue
    }
    const close = open === '{' ? '}' : ')'
    const [body, next] = readBalanced(input, index, open, close)
    cursor = next

    if (type === 'comment' || type === 'string' || type === 'preamble') continue

    const firstComma = body.indexOf(',')
    const key = firstComma < 0 ? body.trim() : body.slice(0, firstComma).trim()
    const fields = firstComma < 0 ? {} : parseFields(body.slice(firstComma + 1))
    if (!fields.title && !fields.arxiv && !fields.eprint) continue
    entries.push({ type, key, fields })
  }
  return entries
}

function normalizeAuthors(raw: string): string {
  if (!raw) return ''
  return raw
    .split(/\s+and\s+/i)
    .map((author) => {
      const name = author.trim()
      if (!name) return ''
      const parts = name.split(',').map((part) => part.trim())
      if (parts.length >= 2) {
        const last = parts[0]
        const rest = parts.slice(1).join(' ')
        return `${rest} ${last}`.trim()
      }
      return name
    })
    .filter(Boolean)
    .join(', ')
}

export interface BibPaperDraft {
  arxiv: string
  title: string
  authors: string
  venue: string
  year: number | null
  abstract: string
  tags: string
}

export function bibEntryToPaper(entry: BibEntry): BibPaperDraft {
  const { fields } = entry
  const haystack = [fields.eprint, fields.arxiv, fields.url, fields.journal, fields.note, fields.doi]
    .filter(Boolean)
    .join(' ')
  const arxiv = haystack.match(ARXIV_RE)?.[1] ?? ''

  return {
    arxiv,
    title: fields.title || entry.key,
    authors: normalizeAuthors(fields.author || ''),
    venue: fields.journal || fields.booktitle || fields.publisher || '',
    year: fields.year ? Number(fields.year) || null : null,
    abstract: fields.abstract || '',
    tags: fields.keywords || '',
  }
}
