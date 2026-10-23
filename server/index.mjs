import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = join(ROOT, 'dist')
const DATA_DIR = join(ROOT, 'data')
const PDF_DIR = join(DATA_DIR, 'pdfs')
const DB_PATH = process.env.POKEMONPAPER_DB || join(DATA_DIR, 'pokemonpaper.db')
const PORT = Number(process.env.PORT || 8787)

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(PDF_DIR, { recursive: true })

/* ------------------------------------------------------------------ db */

const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS papers (
    id         TEXT PRIMARY KEY,
    arxiv      TEXT UNIQUE,
    title      TEXT NOT NULL,
    authors    TEXT NOT NULL DEFAULT '',
    venue      TEXT NOT NULL DEFAULT '',
    year       INTEGER,
    type       TEXT NOT NULL DEFAULT 'normal',
    status     TEXT NOT NULL DEFAULT 'unread',
    rating     INTEGER NOT NULL DEFAULT 0,
    tags       TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    url        TEXT NOT NULL DEFAULT '',
    added_at   TEXT NOT NULL,
    read_at    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
`)

const paperColumns = db.prepare('PRAGMA table_info(papers)').all().map((c) => c.name)
for (const [name, ddl] of [
  ['abstract', "TEXT NOT NULL DEFAULT ''"],
  ['explain', "TEXT NOT NULL DEFAULT ''"],
  ['pdf_path', "TEXT NOT NULL DEFAULT ''"],
  ['code_url', "TEXT NOT NULL DEFAULT ''"],
  ['stars', "INTEGER NOT NULL DEFAULT 0"],
  ['citations', "INTEGER NOT NULL DEFAULT 0"],
  ['metrics_at', "TEXT"],
]) {
  if (!paperColumns.includes(name)) db.exec(`ALTER TABLE papers ADD COLUMN ${name} ${ddl}`)
}

const FIELDS = {
  arxiv: 'arxiv',
  title: 'title',
  authors: 'authors',
  venue: 'venue',
  year: 'year',
  type: 'type',
  status: 'status',
  rating: 'rating',
  tags: 'tags',
  notes: 'notes',
  abstract: 'abstract',
  explain: 'explain',
  codeUrl: 'code_url',
  stars: 'stars',
  citations: 'citations',
  metricsAt: 'metrics_at',
  url: 'url',
  readAt: 'read_at',
}

function rowToPaper(row) {
  return {
    id: row.id,
    arxiv: row.arxiv ?? '',
    title: row.title,
    authors: row.authors ?? '',
    venue: row.venue ?? '',
    year: row.year ?? null,
    type: row.type ?? 'normal',
    status: row.status ?? 'unread',
    rating: row.rating ?? 0,
    tags: row.tags ?? '',
    notes: row.notes ?? '',
    abstract: row.abstract ?? '',
    explain: row.explain ?? '',
    pdfPath: row.pdf_path ?? '',
    codeUrl: row.code_url ?? '',
    stars: row.stars ?? 0,
    citations: row.citations ?? 0,
    metricsAt: row.metrics_at ?? null,
    url: row.url ?? '',
    addedAt: row.added_at,
    readAt: row.read_at ?? null,
  }
}

function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM papers').get()
  if (n > 0) return
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO papers (id, arxiv, title, authors, venue, year, type, status, rating, tags, notes, abstract, explain, url, added_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insert.run(
    randomUUID(),
    '2610.28480',
    'SuperMimic: Scaling Humanoid Whole-Body Control with One Differentiable World Model',
    'Qiayuan Liao, Yiyang Shao, Junfeng Long, Kevin Zakka, Roberto Horowitz, Pieter Abbeel, Koushil Sreenath',
    'CoRL',
    2026,
    'psychic',
    'read',
    5,
    'world model, humanoid, model-based RL',
    '一个可微世界模型摊销整个动作库；H=32 想象 + critic；单卡 3h 超过 SONIC。',
    '',
    '',
    'https://arxiv.org/abs/2610.28480',
    now,
    now,
  )
  insert.run(
    randomUUID(),
    '2610.10270',
    'Video Prediction Policy 2: Predict Better, Act Better',
    '',
    'arXiv',
    2026,
    'water',
    'unread',
    0,
    'world-action model, video prediction, RoboDojo',
    '',
    '',
    '',
    'https://arxiv.org/abs/2610.10270',
    now,
    null,
  )
}

seedIfEmpty()

/* ---------------------------------------------------------------- http */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function sendJSON(res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

async function readBody(req, limit = 1_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('payload too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function pick(body) {
  const out = {}
  for (const [key, column] of Object.entries(FIELDS)) {
    if (body[key] !== undefined) out[column] = body[key]
  }
  return out
}


/* ------------------------------------------------------------- arxiv */

const ARXIV_API = 'https://export.arxiv.org/api/query'

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function atomTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return match ? decodeXml(match[1]) : ''
}

function parseAtom(xml) {
  const items = []
  for (const chunk of xml.split('<entry>').slice(1)) {
    const entry = chunk.split('</entry>')[0]
    const rawId = atomTag(entry, 'id')
    const idMatch = rawId.match(/abs\/(\d{4}\.\d{4,5})/)
    if (!idMatch) continue
    const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/g)]
      .map((m) => decodeXml(m[1]))
      .join(', ')
    const published = atomTag(entry, 'published')
    items.push({
      arxiv: idMatch[1],
      title: atomTag(entry, 'title'),
      authors,
      abstract: atomTag(entry, 'summary'),
      published,
      year: published ? Number(published.slice(0, 4)) : null,
      venue: atomTag(entry, 'arxiv:journal_ref'),
      comment: atomTag(entry, 'arxiv:comment'),
      category: (entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/) || [])[1] || '',
    })
  }
  return items
}

async function fetchArxiv(ids) {
  const url = `${ARXIV_API}?id_list=${encodeURIComponent(ids.join(','))}&max_results=${ids.length}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new HttpError(502, `arXiv 返回 ${res.status}`)
  return parseAtom(await res.text())
}

/* --------------------------------------------------------------- llm */

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

const EXPLAIN_SCHEMA = {
  oneLiner: '',
  problem: '',
  method: '',
  numbers: [],
  limitations: [],
  actions: [],
}

function extractJson(text) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

function asText(value, limit = 600) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function asList(value, max = 5, limit = 160) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asText(item, limit))
    .filter(Boolean)
    .slice(0, max)
}

function normalizeExplain(value) {
  const out = {}
  for (const key of Object.keys(EXPLAIN_SCHEMA)) {
    out[key] = Array.isArray(EXPLAIN_SCHEMA[key])
      ? asList(value?.[key])
      : asText(value?.[key], key === 'oneLiner' ? 80 : 1200)
  }
  return out
}

function buildExplainPrompt(paper) {
  return [
    '你是一位机器人与具身智能方向的研究者，正在给同行写论文速读卡。',
    '只输出一个 JSON 对象，不要 markdown，不要解释。字段：',
    '{"oneLiner": string, "problem": string, "method": string, "numbers": string[], "limitations": string[], "actions": string[]}',
    '要求：',
    '1) 全部用中文；oneLiner 不超过 40 字。',
    '2) numbers 只写摘要中真实出现的定量结果（如 3 GPU·h、99.3%、2.3×）；摘要没有数字就给空数组，禁止编造。',
    '3) limitations 写方法或实验设计上的具体限制，不要写「未来可以改进」这种空话。',
    '4) actions 写给读者下一步可执行的动作（复现哪个实验、查哪篇对比、问作者什么）。',
    '5) 信息不足时宁可写「摘要未提及」，不要补全。',
    '',
    `标题：${paper.title || ''}`,
    `作者：${paper.authors || ''}`,
    `发表：${paper.venue || ''} ${paper.year || ''}`,
    `标签：${paper.tags || ''}`,
    `我的笔记：${paper.notes || ''}`,
    `摘要：${paper.abstract || '（无摘要）'}`,
  ].join('\n')
}

async function callLLM(config, paper) {
  const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '')
  const apiKey = String(config.apiKey || '').trim()
  const model = String(config.model || '').trim()
  if (!baseUrl || !apiKey || !model) {
    throw new HttpError(400, '模型配置不完整：需要 baseUrl、apiKey、model')
  }
  if (!paper.title && !paper.abstract) {
    throw new HttpError(400, '这篇论文还没有标题和摘要，先抓取元数据')
  }

  let response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: '你是严谨的论文速读助手，只输出合法 JSON。' },
          { role: 'user', content: buildExplainPrompt(paper) },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    })
  } catch (error) {
    throw new HttpError(502, `连不上模型服务：${error?.message || error}`)
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    throw new HttpError(502, `模型返回 ${response.status}${detail ? `：${detail}` : ''}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const parsed = extractJson(typeof content === 'string' ? content : '')
  if (!parsed) throw new HttpError(502, '模型没有返回可解析的 JSON，换个模型试试')
  return normalizeExplain(parsed)
}


/* --------------------------------------------------------------- pdf */

function pdfFileName(row) {
  return `${row.arxiv}.pdf`
}

async function ensurePdf(row) {
  if (!row.arxiv) throw new HttpError(400, '这篇没有 arXiv 编号，无法自动下载')
  if (!/^\d{4}\.\d{4,5}$/.test(row.arxiv)) throw new HttpError(400, 'arXiv 编号格式不对')

  const name = pdfFileName(row)
  const file = join(PDF_DIR, name)

  if (existsSync(file) && statSync(file).size > 1024) {
    if (row.pdf_path !== name) {
      db.prepare('UPDATE papers SET pdf_path = ? WHERE id = ?').run(name, row.id)
    }
    return rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(row.id))
  }

  let response
  try {
    response = await fetch(`https://arxiv.org/pdf/${row.arxiv}`, {
      redirect: 'follow',
      headers: { 'user-agent': 'PokemonPaper/0.1 (local paper manager)' },
      signal: AbortSignal.timeout(180000),
    })
  } catch (error) {
    throw new HttpError(502, `下载超时或网络错误：${error?.message || error}`)
  }
  if (!response.ok) throw new HttpError(502, `下载失败：arXiv 返回 ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 1024 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new HttpError(502, '返回的内容不是有效 PDF')
  }

  writeFileSync(file, buffer)
  db.prepare('UPDATE papers SET pdf_path = ? WHERE id = ?').run(name, row.id)
  return rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(row.id))
}

function streamPdf(req, res, file) {
  const size = statSync(file).size
  res.setHeader('content-type', 'application/pdf')
  res.setHeader('accept-ranges', 'bytes')
  res.setHeader('cache-control', 'no-store')

  const range = req.headers.range
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    const start = match && match[1] ? Number(match[1]) : 0
    let end = match && match[2] ? Number(match[2]) : size - 1
    if (start >= size || end < start) {
      res.writeHead(416, { 'content-range': `bytes */${size}` })
      res.end()
      return
    }
    end = Math.min(end, size - 1)
    res.writeHead(206, {
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    })
    createReadStream(file, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, { 'content-length': size })
  createReadStream(file).pipe(res)
}


/* ------------------------------------------------------------ metrics */

function parseRepo(input) {
  const text = String(input || '').trim()
  if (!text) return null
  const match = text.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i)
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
  const short = text.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (short) return { owner: short[1], repo: short[2] }
  return null
}

async function starsFromApi(repo, token) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'PokemonPaper/0.2' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return null
  const data = await response.json()
  return Number(data.stargazers_count) || 0
}

/** 无 token 时 API 很容易 403；退回到仓库页面里嵌的 stargazerCount */
async function starsFromHtml(repo) {
  const response = await fetch(`https://github.com/${repo.owner}/${repo.repo}`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      accept: 'text/html',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new HttpError(502, `GitHub 页面返回 ${response.status}`)
  const html = await response.text()
  const match = html.match(/"stargazerCount":(\d+)/)
  if (!match) throw new HttpError(502, '页面里没找到 star 数')
  return Number(match[1]) || 0
}

async function fetchStars(codeUrl) {
  const repo = parseRepo(codeUrl)
  if (!repo) throw new HttpError(400, '看不懂这个仓库地址')
  const token = process.env.GITHUB_TOKEN || ''
  const viaApi = await starsFromApi(repo, token).catch(() => null)
  if (viaApi !== null) return viaApi
  return starsFromHtml(repo)
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatches(a, b) {
  const left = normalizeTitle(a)
  const right = normalizeTitle(b)
  if (!left || !right) return false
  if (left.includes(right) || right.includes(left)) return true
  const words = new Set(left.split(' ').filter((w) => w.length > 3))
  const other = right.split(' ').filter((w) => w.length > 3)
  if (!words.size || !other.length) return false
  const hit = other.filter((w) => words.has(w)).length
  return hit / Math.max(words.size, other.length) >= 0.5
}

async function citationsFromOpenAlex(title) {
  if (!title) throw new HttpError(502, '没有标题，无法查 OpenAlex')
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(title)}` +
    '&per_page=3&select=display_name,cited_by_count&mailto=i@idejie.com'

  let response
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'PokemonPaper/0.2 (mailto:i@idejie.com)' },
      signal: AbortSignal.timeout(15000),
    })
    if (response.ok || response.status !== 429) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  if (!response || !response.ok) {
    throw new HttpError(502, `OpenAlex 返回 ${response ? response.status : '无响应'}，稍后再试`)
  }
  const data = await response.json()
  const hit = (data.results || []).find((work) => titleMatches(title, work.display_name))
  if (!hit) throw new HttpError(502, 'OpenAlex 没找到匹配的论文')
  return Number(hit.cited_by_count) || 0
}

async function scholarViaSerpApi(title, key) {
  const url =
    'https://serpapi.com/search.json?engine=google_scholar' +
    `&q=${encodeURIComponent(title)}&api_key=${encodeURIComponent(key)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new HttpError(502, `SerpAPI 返回 ${response.status}`)
  const data = await response.json()
  const total = data?.organic_results?.[0]?.inline_links?.cited_by?.total
  if (typeof total !== 'number') throw new HttpError(502, 'SerpAPI 没返回 cited_by')
  return total
}

async function scholarViaSerper(title, key) {
  const response = await fetch('https://google.serper.dev/scholar', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q: title }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new HttpError(502, `Serper 返回 ${response.status}`)
  const data = await response.json()
  const hit = data?.organic?.[0] ?? {}
  const direct = hit.citedBy ?? hit.cited_by
  if (typeof direct === 'number') return direct
  const match = JSON.stringify(hit).match(/Cited by (\d+)/)
  if (match) return Number(match[1])
  throw new HttpError(502, 'Serper 没返回引用数')
}

/** 直连 Google Scholar：机房 IP 基本必被 403，只在住宅网络下有机会 */
async function scholarDirect(title) {
  const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${title}"`)}&hl=en`
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new HttpError(502, `Google Scholar 返回 ${response.status}`)
  const html = await response.text()
  if (/unusual traffic|captcha|Sorry\.\.\./i.test(html)) {
    throw new HttpError(502, 'Google Scholar 要求验证码，换 SerpAPI 或手动填')
  }
  const match = html.match(/Cited by (\d+)/)
  if (!match) throw new HttpError(502, '页面里没找到 Cited by')
  return Number(match[1])
}

async function scholarCount(title, scholar) {
  if (!title) throw new HttpError(400, '没有标题，无法搜 Google Scholar')
  const provider = scholar?.provider
  const key = scholar?.apiKey
  if (provider === 'serpapi' && key) {
    return { count: await scholarViaSerpApi(title, key), source: 'Google Scholar · SerpAPI' }
  }
  if (provider === 'serper' && key) {
    return { count: await scholarViaSerper(title, key), source: 'Google Scholar · Serper' }
  }
  return { count: await scholarDirect(title), source: 'Google Scholar' }
}

async function citationsFromCrossref(title) {
  const url =
    'https://api.crossref.org/works?rows=3&select=title,is-referenced-by-count' +
    `&query.bibliographic=${encodeURIComponent(title)}`
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'PokemonPaper/0.3 (mailto:i@idejie.com)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new HttpError(502, `Crossref 返回 ${response.status}`)
  const data = await response.json()
  const hit = (data.message?.items || []).find((item) =>
    titleMatches(title, (item.title || [])[0]),
  )
  if (!hit) throw new HttpError(502, 'Crossref 没找到匹配')
  return Number(hit['is-referenced-by-count']) || 0
}

async function fetchCitations(arxiv, title, scholar) {
  const notes = []

  try {
    const result = await scholarCount(title, scholar)
    return { ...result, notes }
  } catch (error) {
    notes.push(`Google Scholar 失败：${error?.message || error}`)
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxiv}?fields=citationCount`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) },
    ).catch(() => null)
    if (response?.ok) {
      const data = await response.json()
      return { count: Number(data.citationCount) || 0, source: 'Semantic Scholar', notes }
    }
    if (!response || response.status !== 429) break
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }
  notes.push('Semantic Scholar 也失败了')

  try {
    const count = await citationsFromOpenAlex(title)
    return { count, source: 'OpenAlex', notes }
  } catch (error) {
    notes.push(`OpenAlex 失败：${error?.message || error}`)
  }

  try {
    const count = await citationsFromCrossref(title)
    return { count, source: 'Crossref（通常低于 Google Scholar）', notes }
  } catch (error) {
    notes.push(`Crossref 失败：${error?.message || error}`)
    throw new HttpError(502, notes.join('；'))
  }
}

function upsert(paper) {
  const now = new Date().toISOString()
  const existing = paper.arxiv
    ? db.prepare('SELECT id FROM papers WHERE arxiv = ?').get(paper.arxiv)
    : null

  if (existing) {
    const patch = pick(paper)
    if (patch.status === 'read' && !patch.read_at) patch.read_at = now
    const keys = Object.keys(patch)
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE papers SET ${sets} WHERE id = ?`).run(
        ...keys.map((k) => patch[k]),
        existing.id,
      )
    }
    return rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(existing.id))
  }

  const id = paper.id || randomUUID()
  const status = paper.status ?? 'unread'
  const readAt = status === 'read' ? paper.readAt || now : null
  db.prepare(`
    INSERT INTO papers (id, arxiv, title, authors, venue, year, type, status, rating, tags, notes, abstract, explain, code_url, stars, citations, url, added_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    paper.arxiv || null,
    paper.title,
    paper.authors ?? '',
    paper.venue ?? '',
    paper.year ?? null,
    paper.type ?? 'normal',
    status,
    paper.rating ?? 0,
    paper.tags ?? '',
    paper.notes ?? '',
    paper.abstract ?? '',
    paper.explain ?? '',
    paper.codeUrl ?? '',
    Number(paper.stars) || 0,
    Number(paper.citations) || 0,
    paper.url ?? (paper.arxiv ? `https://arxiv.org/abs/${paper.arxiv}` : ''),
    now,
    readAt,
  )
  return rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(id))
}

async function api(req, res, url) {
  const { pathname } = url
  const method = req.method || 'GET'

  if (pathname === '/api/health') return sendJSON(res, 200, { ok: true })
  if (pathname === '/api/papers' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM papers ORDER BY arxiv DESC').all()
    return sendJSON(res, 200, { papers: rows.map(rowToPaper) })
  }
  if (pathname === '/api/papers' && method === 'POST') {
    const body = await readBody(req)
    if (!body.title || !String(body.title).trim()) {
      return sendJSON(res, 400, { error: 'title is required' })
    }
    if (body.arxiv) {
      const dup = db.prepare('SELECT id FROM papers WHERE arxiv = ?').get(String(body.arxiv))
      if (dup) return sendJSON(res, 409, { error: `arXiv ${body.arxiv} 已在图鉴中` })
    }
    const paper = upsert({ ...body, id: randomUUID() })
    return sendJSON(res, 201, { paper })
  }
  if (pathname === '/api/export' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM papers ORDER BY arxiv ASC').all()
    return sendJSON(res, 200, { exportedAt: new Date().toISOString(), papers: rows.map(rowToPaper) })
  }
  if (pathname === '/api/import' && method === 'POST') {
    const body = await readBody(req, 8_000_000)
    const list = Array.isArray(body.papers) ? body.papers : []
    let count = 0
    for (const entry of list) {
      if (!entry || !entry.title) continue
      upsert(entry)
      count += 1
    }
    return sendJSON(res, 200, { imported: count })
  }


  if (pathname === '/api/arxiv/preview' && method === 'POST') {
    const body = await readBody(req)
    const ids = [...new Set(
      (Array.isArray(body.ids) ? body.ids : [])
        .map((id) => String(id).trim())
        .filter((id) => /^\d{4}\.\d{4,5}$/.test(id)),
    )].slice(0, 50)
    if (!ids.length) return sendJSON(res, 400, { error: '没有合法的 arXiv 编号' })
    const items = await fetchArxiv(ids)
    return sendJSON(res, 200, { items })
  }

  if (pathname === '/api/explain' && method === 'POST') {
    const body = await readBody(req, 2_000_000)
    const explain = await callLLM(body.config || {}, body.paper || {})
    return sendJSON(res, 200, { explain })
  }



  const metricsMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/metrics$/)
  if (metricsMatch && method === 'POST') {
    const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(metricsMatch[1])
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    const body = await readBody(req).catch(() => ({}))
    const notes = []
    let stars = row.stars ?? 0
    let citations = row.citations ?? 0

    if (row.code_url) {
      try {
        stars = await fetchStars(row.code_url)
      } catch (error) {
        notes.push(`Star 抓取失败：${error?.message || error}`)
      }
    } else {
      notes.push('没有填开源仓库，跳过 star')
    }

    const scholar = body.scholar
    const scholarReady = Boolean(
      scholar && scholar.provider && scholar.provider !== 'off' && scholar.apiKey,
    )
    if (!scholarReady) {
      notes.push('未配置 Google Scholar Key，跳过引用量（不影响等级）')
    } else if (row.arxiv) {
      try {
        const result = await fetchCitations(row.arxiv, row.title, scholar)
        citations = result.count
        notes.push(`引用来源：${result.source}`)
        notes.push(...result.notes)
      } catch (error) {
        notes.push(`引用量抓取失败：${error?.message || error}`)
      }
    } else {
      notes.push('没有 arXiv 编号，跳过引用量')
    }

    db.prepare('UPDATE papers SET stars = ?, citations = ?, metrics_at = ? WHERE id = ?').run(
      stars,
      citations,
      new Date().toISOString(),
      row.id,
    )
    const fresh = rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(row.id))
    return sendJSON(res, 200, { paper: fresh, notes })
  }

  const pdfMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/pdf$/)
  if (pdfMatch) {
    const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(pdfMatch[1])
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'POST') {
      const paper = await ensurePdf(row)
      return sendJSON(res, 200, { paper })
    }

    if (method === 'GET') {
      if (!row.pdf_path) return sendJSON(res, 404, { error: 'PDF 还没下载' })
      const file = join(PDF_DIR, row.pdf_path)
      if (!existsSync(file)) return sendJSON(res, 404, { error: '本地 PDF 丢失，重新下载' })
      return streamPdf(req, res, file)
    }
  }

  const match = pathname.match(/^\/api\/papers\/([\w-]+)$/)
  if (match) {
    const id = match[1]
    const row = db.prepare('SELECT * FROM papers WHERE id = ?').get(id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'GET') return sendJSON(res, 200, { paper: rowToPaper(row) })

    if (method === 'PATCH') {
      const body = await readBody(req)
      const patch = pick(body)
      if (patch.status === 'read' && !patch.read_at) patch.read_at = new Date().toISOString()
      if (patch.status && patch.status !== 'read' && body.readAt === undefined) patch.read_at = null
      const keys = Object.keys(patch)
      if (keys.length) {
        const sets = keys.map((k) => `${k} = ?`).join(', ')
        db.prepare(`UPDATE papers SET ${sets} WHERE id = ?`).run(
          ...keys.map((k) => patch[k]),
          id,
        )
      }
      const fresh = db.prepare('SELECT * FROM papers WHERE id = ?').get(id)
      return sendJSON(res, 200, { paper: rowToPaper(fresh) })
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM papers WHERE id = ?').run(id)
      return sendJSON(res, 200, { ok: true })
    }
  }

  return sendJSON(res, 404, { error: 'unknown api route' })
}

async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = resolve(join(DIST, rel))

  if (!file.startsWith(DIST + sep) && file !== DIST) {
    res.writeHead(403).end('forbidden')
    return
  }

  try {
    const info = await stat(file)
    if (info.isDirectory()) throw new Error('is directory')
    const data = await readFile(file)
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    })
    res.end(data)
  } catch {
    // SPA fallback
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' })
      res.end(html)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('dist/ 还没有构建。先运行 pnpm build，或开发时用 pnpm dev。')
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      return await api(req, res, url)
    }
    return await serveStatic(res, url.pathname)
  } catch (error) {
    const status = Number(error?.statusCode) || 500
    if (status >= 500) console.error('[pokemonpaper]', error)
    if (!res.headersSent) sendJSON(res, status, { error: String(error?.message || error) })
    else res.end()
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PokemonPaper API  http://127.0.0.1:${PORT}`)
  console.log(`SQLite        ${DB_PATH}`)
})
