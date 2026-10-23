import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

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
    arxiv      TEXT,
    title      TEXT NOT NULL,
    authors    TEXT NOT NULL DEFAULT '',
    venue      TEXT NOT NULL DEFAULT '',
    year       INTEGER,
    type       TEXT NOT NULL DEFAULT 'steel',
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

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    avatar_id     TEXT NOT NULL DEFAULT 'red-cap',
    created_at    TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id         TEXT PRIMARY KEY,
    paper_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    start      INTEGER NOT NULL,
    end        INTEGER NOT NULL,
    quote      TEXT NOT NULL DEFAULT '',
    color      TEXT NOT NULL DEFAULT 'yellow',
    comment    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_annotations_paper ON annotations(paper_id, user_id);

  CREATE TABLE IF NOT EXISTS invites (
    code       TEXT PRIMARY KEY,
    created_by TEXT,
    created_at TEXT NOT NULL,
    used_by    TEXT,
    used_at    TEXT
  );
`)

const annotationColumns = db.prepare('PRAGMA table_info(annotations)').all().map((c) => c.name)
for (const [name, ddl] of [
  ['page', 'INTEGER NOT NULL DEFAULT 0'],
  ['rects', "TEXT NOT NULL DEFAULT '[]'"],
  ['is_public', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!annotationColumns.includes(name)) {
    db.exec(`ALTER TABLE annotations ADD COLUMN ${name} ${ddl}`)
  }
}

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
if (!userColumns.includes('is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
}
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('registration', 'open')").run()
db.prepare("UPDATE papers SET type = 'steel' WHERE type = 'normal'").run()

// 老库升级：把 papers.arxiv 的全局 UNIQUE 换成 (user_id, arxiv) 的部分唯一索引
const papersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='papers'").get()
if (papersSql && /arxiv\s+TEXT\s+UNIQUE/i.test(papersSql.sql)) {
  const cols = db.prepare('PRAGMA table_info(papers)').all()
  const defs = cols
    .map((col) => {
      const pk = col.name === 'id' ? ' PRIMARY KEY' : ''
      const notNull = col.notnull ? ' NOT NULL' : ''
      const dflt = col.dflt_value !== null ? ` DEFAULT ${col.dflt_value}` : ''
      return `${col.name} ${col.type}${pk}${notNull}${dflt}`
    })
    .join(', ')
  const names = cols.map((col) => col.name).join(', ')
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN')
  db.exec(`CREATE TABLE papers_new (${defs})`)
  db.exec(`INSERT INTO papers_new (${names}) SELECT ${names} FROM papers`)
  db.exec('DROP TABLE papers')
  db.exec('ALTER TABLE papers_new RENAME TO papers')
  db.exec('COMMIT')
  db.exec('PRAGMA foreign_keys = ON')
  console.log('[paperdex] migrated papers: per-user arxiv uniqueness')
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_user_arxiv ON papers(user_id, arxiv) WHERE arxiv IS NOT NULL AND arxiv != ''",
)

// 老库升级：没有任何管理员时，把最早注册的用户提升为管理员
const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n
if (adminCount === 0) {
  const oldest = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get()
  if (oldest) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(oldest.id)
}

const paperColumns = db.prepare('PRAGMA table_info(papers)').all().map((c) => c.name)
for (const [name, ddl] of [
  ['abstract', "TEXT NOT NULL DEFAULT ''"],
  ['explain', "TEXT NOT NULL DEFAULT ''"],
  ['pdf_path', "TEXT NOT NULL DEFAULT ''"],
  ['code_url', "TEXT NOT NULL DEFAULT ''"],
  ['stars', "INTEGER NOT NULL DEFAULT 0"],
  ['citations', "INTEGER NOT NULL DEFAULT 0"],
  ['metrics_at', "TEXT"],
  ['user_id', "TEXT"],
  ['primary_category', "TEXT NOT NULL DEFAULT ''"],
  ['categories', "TEXT NOT NULL DEFAULT ''"],
  ['full_text', "TEXT NOT NULL DEFAULT ''"],
  ['full_text_at', "TEXT"],
  ['summary_text', "TEXT NOT NULL DEFAULT ''"],
  ['summary_at', "TEXT"],
]) {
  if (!paperColumns.includes(name)) db.exec(`ALTER TABLE papers ADD COLUMN ${name} ${ddl}`)
}

const FIELDS = {
  arxiv: 'arxiv',
  title: 'title',
  authors: 'authors',
  venue: 'venue',
  year: 'year',
  status: 'status',
  rating: 'rating',
  tags: 'tags',
  notes: 'notes',
  primaryCategory: 'primary_category',
  categories: 'categories',
  abstract: 'abstract',
  explain: 'explain',
  summary: 'summary_text',
  codeUrl: 'code_url',
  stars: 'stars',
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
    status: row.status ?? 'unread',
    rating: row.rating ?? 0,
    tags: row.tags ?? '',
    notes: row.notes ?? '',
    abstract: row.abstract ?? '',
    explain: row.explain ?? '',
    pdfPath: row.pdf_path ?? '',
    codeUrl: row.code_url ?? '',
    stars: row.stars ?? 0,
    metricsAt: row.metrics_at ?? null,
    primaryCategory: row.primary_category ?? '',
    categories: row.categories ? row.categories.split(',').filter(Boolean) : [],
    summary: row.summary_text ?? '',
    summaryAt: row.summary_at ?? null,
    hasFullText: Boolean(row.full_text),
    fullTextChars: row.full_text ? row.full_text.length : 0,
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
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
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


/* ----------------------------------------------------------------- auth */

const SESSION_DAYS = 30
const loginFailures = new Map()

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

function newInviteCode() {
  return randomBytes(4).toString('hex').toUpperCase()
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const key = scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(hashHex, 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email.split('@')[0],
    avatarId: row.avatar_id || 'red-cap',
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  }
}

function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000)
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(token, userId, now.toISOString(), expires.toISOString())
  return { token, expires }
}

function setSessionCookie(res, token, expires) {
  res.setHeader(
    'set-cookie',
    `pp_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      (expires.getTime() - Date.now()) / 1000,
    )}`,
  )
}

function clearSessionCookie(res) {
  res.setHeader('set-cookie', 'pp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
}

function currentUser(req) {
  const token = parseCookies(req).pp_session
  if (!token) return null
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id)
  return user ?? null
}

function validateCredentials(email, password) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ''))) {
    return '邮箱格式不对'
  }
  if (String(password || '').length < 8) {
    return '密码至少 8 位'
  }
  return ''
}

function tooManyAttempts(email) {
  const entry = loginFailures.get(email)
  if (!entry) return false
  if (entry.until < Date.now()) {
    loginFailures.delete(email)
    return false
  }
  return entry.count >= 5
}

function recordFailure(email) {
  const entry = loginFailures.get(email) ?? { count: 0, until: 0 }
  entry.count += 1
  entry.until = Date.now() + 60000
  loginFailures.set(email, entry)
}

function pick(body) {
  const out = {}
  for (const [key, column] of Object.entries(FIELDS)) {
    if (body[key] === undefined) continue
    out[column] = Array.isArray(body[key]) ? body[key].join(',') : body[key]
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
    const categories = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1])
    const primary =
      (entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/) || [])[1] || categories[0] || ''
    items.push({
      arxiv: idMatch[1],
      title: atomTag(entry, 'title'),
      authors,
      abstract: atomTag(entry, 'summary'),
      published,
      year: published ? Number(published.slice(0, 4)) : null,
      venue: atomTag(entry, 'arxiv:journal_ref'),
      comment: atomTag(entry, 'arxiv:comment'),
      category: primary,
      primaryCategory: primary,
      categories,
    })
  }
  return items
}

async function searchArxiv(query, maxResults = 20) {
  const cleaned = String(query || '').trim().slice(0, 200)
  if (!cleaned) throw new HttpError(400, '请输入搜索关键词')
  const field = /^[a-z]{2,12}:/i.test(cleaned)
    ? cleaned
    : `all:"${cleaned.replace(/"/g, '')}"`
  const params = new URLSearchParams({
    search_query: field,
    start: '0',
    max_results: String(Math.min(30, Math.max(1, maxResults))),
    sortBy: 'relevance',
    sortOrder: 'descending',
  })
  const res = await fetch(`${ARXIV_API}?${params}`, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new HttpError(502, `arXiv 返回 ${res.status}`)
  return parseAtom(await res.text())
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

async function backfillRows(rows) {
  let updated = 0
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50)
    const items = await fetchArxiv(chunk.map((row) => row.arxiv))
    const byId = new Map(items.map((item) => [item.arxiv, item]))
    for (const row of chunk) {
      const item = byId.get(row.arxiv)
      if (!item) continue
      db.prepare(
        `UPDATE papers SET
           primary_category = ?,
           categories = ?,
           abstract = CASE WHEN abstract = '' THEN ? ELSE abstract END,
           venue = CASE WHEN venue = '' THEN ? ELSE venue END
         WHERE id = ?`,
      ).run(
        item.primaryCategory ?? '',
        (item.categories ?? []).join(','),
        item.abstract ?? '',
        item.venue ?? '',
        row.id,
      )
      updated += 1
    }
  }
  return updated
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

async function chatCompletion(config, messages, maxTokens = 1400) {
  const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '')
  const apiKey = String(config.apiKey || '').trim()
  const model = String(config.model || '').trim()
  if (!baseUrl || !apiKey || !model) {
    throw new HttpError(400, '模型配置不完整：需要 baseUrl、apiKey、model')
  }

  let response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: maxTokens, messages }),
      signal: AbortSignal.timeout(180000),
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
  if (typeof content !== 'string' || !content.trim()) {
    throw new HttpError(502, '模型没有返回内容')
  }
  return content.trim()
}

async function callLLM(config, paper) {
  if (!paper.title && !paper.abstract) {
    throw new HttpError(400, '这篇论文还没有标题和摘要，先抓取元数据')
  }
  const content = await chatCompletion(config, [
    { role: 'system', content: '你是严谨的论文速读助手，只输出合法 JSON。' },
    { role: 'user', content: buildExplainPrompt(paper) },
  ])
  const parsed = extractJson(content)
  if (!parsed) throw new HttpError(502, '模型没有返回可解析的 JSON，换个模型试试')
  return normalizeExplain(parsed)
}

/* --------------------------------------------------------------- text */

async function extractPdfText(file) {
  const data = new Uint8Array(await readFile(file))
  const loadingTask = getDocument({ data, useSystemFonts: false, isEvalSupported: false })
  const doc = await loadingTask.promise
  const pages = doc.numPages
  const chunks = []
  for (let page = 1; page <= pages; page += 1) {
    const pdfPage = await doc.getPage(page)
    const content = await pdfPage.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) chunks.push(line)
  }
  await loadingTask.destroy?.()
  // PDF 断词：把行尾的 "mo- tions" 接回 "motions"
  const text = chunks.join('\n\n').replace(/([a-z])-\s+([a-z])/g, '$1$2')
  return { text, pages }
}

function buildSummaryPrompt(paper, fullText) {
  const limit = 18000
  let excerpt = fullText || ''
  if (excerpt.length > limit) {
    excerpt = `${excerpt.slice(0, 12000)}\n\n……（中段省略）……\n\n${excerpt.slice(-6000)}`
  }
  return [
    '你是一位机器人与具身智能方向的研究者，请基于下面的论文内容写一份中文总结。',
    '输出 Markdown，不要代码块，不要客套话。结构固定为：',
    '## 一句话',
    '## 研究问题',
    '## 方法',
    '## 主要结果',
    '## 局限',
    '## 适合谁读',
    '要求：数字只能来自原文，原文没有就写「原文未提及」，禁止编造；总长度 600–900 字。',
    '',
    `标题：${paper.title || ''}`,
    `作者：${paper.authors || ''}`,
    `摘要：${paper.abstract || '（无摘要）'}`,
    '',
    '全文：',
    excerpt || '（没有全文，只能基于摘要总结）',
  ].join('\n')
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

function upsert(paper, userId) {
  const now = new Date().toISOString()
  const existing = paper.arxiv
    ? db.prepare('SELECT id FROM papers WHERE arxiv = ? AND user_id = ?').get(paper.arxiv, userId)
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
    INSERT INTO papers (id, arxiv, title, authors, venue, year, type, status, rating, tags, notes, abstract, explain, code_url, stars, url, added_at, read_at, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    paper.arxiv || null,
    paper.title,
    paper.authors ?? '',
    paper.venue ?? '',
    paper.year ?? null,
    'steel',
    status,
    paper.rating ?? 0,
    paper.tags ?? '',
    paper.notes ?? '',
    paper.abstract ?? '',
    paper.explain ?? '',
    paper.codeUrl ?? '',
    Number(paper.stars) || 0,
    paper.url ?? (paper.arxiv ? `https://arxiv.org/abs/${paper.arxiv}` : ''),
    now,
    readAt,
    userId ?? null,
  )
  if (paper.primaryCategory || (Array.isArray(paper.categories) && paper.categories.length)) {
    db.prepare('UPDATE papers SET primary_category = ?, categories = ? WHERE id = ?').run(
      paper.primaryCategory ?? '',
      Array.isArray(paper.categories) ? paper.categories.join(',') : '',
      id,
    )
  }
  return rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(id))
}

async function api(req, res, url) {
  const { pathname } = url
  const method = req.method || 'GET'

  if (pathname === '/api/health') return sendJSON(res, 200, { ok: true })
  if (pathname === '/api/auth/config' && method === 'GET') {
    return sendJSON(res, 200, { registration: getSetting('registration', 'open') })
  }

  /* ------------------------------------------------------------ auth */

  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await readBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim().slice(0, 40)
    const invalid = validateCredentials(email, password)
    if (invalid) return sendJSON(res, 400, { error: invalid })
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return sendJSON(res, 409, { error: '这个邮箱已经注册过了' })
    }

    const mode = getSetting('registration', 'open')
    let invite = null
    if (mode === 'invite') {
      const code = String(body.invite || '').trim().toUpperCase()
      if (!code) return sendJSON(res, 400, { error: '这个站需要邀请码' })
      invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code)
      if (!invite) return sendJSON(res, 403, { error: '邀请码无效' })
      if (invite.used_by) return sendJSON(res, 403, { error: '邀请码已经被用掉了' })
    }

    const id = randomUUID()
    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, avatar_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, email, name, hashPassword(password), 'red-cap', new Date().toISOString())

    // 第一个注册的用户接管迁移前遗留的无主论文
    const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
    if (userCount === 1) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(id)
      db.prepare('UPDATE papers SET user_id = ? WHERE user_id IS NULL').run(id)
    }
    if (invite) {
      db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(
        id,
        new Date().toISOString(),
        invite.code,
      )
    }

    const { token, expires } = createSession(id)
    setSessionCookie(res, token, expires)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    return sendJSON(res, 201, { user: publicUser(row) })
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (tooManyAttempts(email)) {
      return sendJSON(res, 429, { error: '尝试太频繁，等一分钟再试' })
    }
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!row || !verifyPassword(password, row.password_hash)) {
      recordFailure(email)
      return sendJSON(res, 401, { error: '邮箱或密码不对' })
    }
    loginFailures.delete(email)
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      row.id,
    )
    const { token, expires } = createSession(row.id)
    setSessionCookie(res, token, expires)
    return sendJSON(res, 200, { user: publicUser(row) })
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(req).pp_session
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    clearSessionCookie(res)
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/auth/me') {
    const me = currentUser(req)
    if (method === 'GET') {
      if (!me) return sendJSON(res, 401, { error: 'not logged in' })
      return sendJSON(res, 200, { user: publicUser(me) })
    }
    if (method === 'PATCH') {
      if (!me) return sendJSON(res, 401, { error: 'not logged in' })
      const body = await readBody(req)
      const name = body.name === undefined ? me.name : String(body.name).trim().slice(0, 40)
      const avatarId =
        body.avatarId === undefined ? me.avatar_id : String(body.avatarId).trim().slice(0, 40)
      db.prepare('UPDATE users SET name = ?, avatar_id = ? WHERE id = ?').run(name, avatarId, me.id)
      const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id)
      return sendJSON(res, 200, { user: publicUser(fresh) })
    }
  }

  const user = currentUser(req)
  if (!user) return sendJSON(res, 401, { error: '请先登录' })

  /* --------------------------------------------------------- account */

  if (pathname === '/api/auth/password' && method === 'POST') {
    const body = await readBody(req)
    const current = String(body.currentPassword || '')
    const next = String(body.newPassword || '')
    if (!verifyPassword(current, user.password_hash)) {
      return sendJSON(res, 400, { error: '当前密码不对' })
    }
    if (next.length < 8) return sendJSON(res, 400, { error: '新密码至少 8 位' })
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id)
    // 其它设备上的会话全部失效
    const token = parseCookies(req).pp_session
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, token ?? '')
    return sendJSON(res, 200, { ok: true })
  }

  if (pathname === '/api/auth/me' && method === 'DELETE') {
    const body = await readBody(req)
    if (!verifyPassword(String(body.password || ''), user.password_hash)) {
      return sendJSON(res, 400, { error: '密码不对' })
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    db.prepare('DELETE FROM papers WHERE user_id = ?').run(user.id)
    db.prepare('DELETE FROM annotations WHERE user_id = ?').run(user.id)
    db.prepare('DELETE FROM invites WHERE created_by = ? AND used_by IS NULL').run(user.id)
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    clearSessionCookie(res)
    return sendJSON(res, 200, { ok: true })
  }

  /* ----------------------------------------------------------- admin */

  if (pathname.startsWith('/api/admin/')) {
    if (!user.is_admin) return sendJSON(res, 403, { error: '需要管理员权限' })

    if (pathname === '/api/admin/config') {
      if (method === 'GET') {
        return sendJSON(res, 200, { registration: getSetting('registration', 'open') })
      }
      if (method === 'PATCH') {
        const body = await readBody(req)
        const mode = body.registration === 'invite' ? 'invite' : 'open'
        setSetting('registration', mode)
        return sendJSON(res, 200, { registration: mode })
      }
    }

    if (pathname === '/api/admin/invites') {
      if (method === 'GET') {
        const rows = db
          .prepare('SELECT * FROM invites ORDER BY created_at DESC LIMIT 100')
          .all()
        return sendJSON(res, 200, {
          invites: rows.map((row) => ({
            code: row.code,
            createdAt: row.created_at,
            used: Boolean(row.used_by),
            usedAt: row.used_at ?? null,
          })),
        })
      }
      if (method === 'POST') {
        const code = newInviteCode()
        db.prepare('INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)').run(
          code,
          user.id,
          new Date().toISOString(),
        )
        return sendJSON(res, 201, { code })
      }
    }

    const inviteMatch = pathname.match(/^\/api\/admin\/invites\/([A-Z0-9]+)$/)
    if (inviteMatch && method === 'DELETE') {
      const row = db.prepare('SELECT * FROM invites WHERE code = ?').get(inviteMatch[1])
      if (!row) return sendJSON(res, 404, { error: '邀请码不存在' })
      if (row.used_by) return sendJSON(res, 409, { error: '已使用的邀请码不能撤销' })
      db.prepare('DELETE FROM invites WHERE code = ?').run(inviteMatch[1])
      return sendJSON(res, 200, { ok: true })
    }
  }


  if (pathname === '/api/papers' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM papers WHERE user_id = ? ORDER BY arxiv DESC').all(user.id)
    return sendJSON(res, 200, { papers: rows.map(rowToPaper) })
  }
  if (pathname === '/api/papers' && method === 'POST') {
    const body = await readBody(req)
    if (!body.title || !String(body.title).trim()) {
      return sendJSON(res, 400, { error: 'title is required' })
    }
    if (body.arxiv) {
      const dup = db
        .prepare('SELECT id FROM papers WHERE arxiv = ? AND user_id = ?')
        .get(String(body.arxiv), user.id)
      if (dup) return sendJSON(res, 409, { error: `arXiv ${body.arxiv} 已在图鉴中` })
    }
    const paper = upsert({ ...body, id: randomUUID() }, user.id)
    return sendJSON(res, 201, { paper })
  }
  if (pathname === '/api/export' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM papers WHERE user_id = ? ORDER BY arxiv ASC').all(user.id)
    return sendJSON(res, 200, { exportedAt: new Date().toISOString(), papers: rows.map(rowToPaper) })
  }
  if (pathname === '/api/import' && method === 'POST') {
    const body = await readBody(req, 8_000_000)
    const list = Array.isArray(body.papers) ? body.papers : []
    let count = 0
    for (const entry of list) {
      if (!entry || !entry.title) continue
      upsert(entry, user.id)
      count += 1
    }
    return sendJSON(res, 200, { imported: count })
  }


  if (pathname === '/api/papers/backfill' && method === 'POST') {
    const rows = db
      .prepare(
        "SELECT id, arxiv FROM papers WHERE user_id = ? AND arxiv != '' AND (primary_category IS NULL OR primary_category = '') LIMIT 50",
      )
      .all(user.id)
    if (!rows.length) return sendJSON(res, 200, { updated: 0, remaining: 0 })
    let updated = 0
    try {
      updated = await backfillRows(rows)
    } catch (error) {
      return sendJSON(res, 502, { error: `arXiv 查询失败：${error?.message || error}` })
    }
    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS n FROM papers WHERE user_id = ? AND arxiv != '' AND (primary_category IS NULL OR primary_category = '')",
      )
      .get(user.id).n
    return sendJSON(res, 200, { updated, remaining })
  }

  if (pathname === '/api/arxiv/search' && method === 'POST') {
    const body = await readBody(req)
    try {
      const items = await searchArxiv(body.query, Number(body.max) || 20)
      return sendJSON(res, 200, { items })
    } catch (error) {
      return sendJSON(res, error.statusCode || 502, {
        error: error?.message || 'arXiv 搜索失败',
      })
    }
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
    const row = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(metricsMatch[1], user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    const notes = []
    let stars = row.stars ?? 0

    if (row.code_url) {
      try {
        stars = await fetchStars(row.code_url)
      } catch (error) {
        notes.push(`Star 抓取失败：${error?.message || error}`)
      }
    } else {
      notes.push('没有填开源仓库，跳过 star')
    }

    db.prepare('UPDATE papers SET stars = ?, metrics_at = ? WHERE id = ?').run(
      stars,
      new Date().toISOString(),
      row.id,
    )
    const fresh = rowToPaper(db.prepare('SELECT * FROM papers WHERE id = ?').get(row.id))
    return sendJSON(res, 200, { paper: fresh, notes })
  }



  /* ------------------------------------------------------ annotations */

  const annotationMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/annotations$/)
  if (annotationMatch) {
    const paperId = annotationMatch[1]
    const paper = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(paperId, user.id)
    if (!paper) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'GET') {
      const own = db
        .prepare('SELECT * FROM annotations WHERE paper_id = ? AND user_id = ? ORDER BY start ASC')
        .all(paperId, user.id)
      const shared = paper.arxiv
        ? db
            .prepare(
              `SELECT a.*, u.name AS author
                 FROM annotations a
                 JOIN papers p ON p.id = a.paper_id
                 JOIN users u ON u.id = a.user_id
                WHERE p.arxiv = ? AND a.user_id != ? AND a.is_public = 1
                ORDER BY a.created_at ASC`,
            )
            .all(paper.arxiv, user.id)
        : []
      const shape = (row, mine) => ({
        id: row.id,
        start: row.start,
        end: row.end,
        page: row.page ?? 0,
        rects: JSON.parse(row.rects || '[]'),
        quote: row.quote,
        color: row.color,
        comment: row.comment,
        isPublic: Boolean(row.is_public),
        mine,
        author: row.author ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? null,
      })
      return sendJSON(res, 200, {
        annotations: [
          ...own.map((row) => shape(row, true)),
          ...shared.map((row) => shape(row, false)),
        ],
      })
    }

    if (method === 'POST') {
      const body = await readBody(req)
      const colors = ['yellow', 'green', 'blue', 'pink']
      const color = colors.includes(body.color) ? body.color : 'yellow'
      const page = Number(body.page)
      if (!Number.isInteger(page) || page < 1) {
        return sendJSON(res, 400, { error: '页码不合法' })
      }
      const rects = Array.isArray(body.rects) ? body.rects.slice(0, 200) : []
      if (!rects.length) return sendJSON(res, 400, { error: '没有选区' })
      const id = randomUUID()
      db.prepare(
        'INSERT INTO annotations (id, paper_id, user_id, start, end, page, rects, quote, color, comment, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        paperId,
        user.id,
        0,
        0,
        page,
        JSON.stringify(rects),
        String(body.quote || '').slice(0, 2000),
        color,
        String(body.comment || '').slice(0, 4000),
        body.isPublic ? 1 : 0,
        new Date().toISOString(),
      )
      return sendJSON(res, 201, { id })
    }
  }

  const annotationItem = pathname.match(/^\/api\/annotations\/([\w-]+)$/)
  if (annotationItem) {
    const row = db
      .prepare('SELECT * FROM annotations WHERE id = ? AND user_id = ?')
      .get(annotationItem[1], user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'PATCH') {
      const body = await readBody(req)
      const comment = body.comment === undefined ? row.comment : String(body.comment).slice(0, 4000)
      const colors = ['yellow', 'green', 'blue', 'pink']
      const color = colors.includes(body.color) ? body.color : row.color
      const isPublic = body.isPublic === undefined ? row.is_public ?? 0 : body.isPublic ? 1 : 0
      db.prepare(
        'UPDATE annotations SET comment = ?, color = ?, is_public = ?, updated_at = ? WHERE id = ?',
      ).run(comment, color, isPublic, new Date().toISOString(), row.id)
      return sendJSON(res, 200, { ok: true })
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM annotations WHERE id = ?').run(row.id)
      return sendJSON(res, 200, { ok: true })
    }
  }

  const textMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/text$/)
  if (textMatch) {
    const row = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(textMatch[1], user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'GET') {
      if (!row.full_text) return sendJSON(res, 404, { error: '还没提取全文' })
      return sendJSON(res, 200, { text: row.full_text, chars: row.full_text.length })
    }

    if (method === 'POST') {
      if (row.full_text) {
        return sendJSON(res, 200, { text: row.full_text, chars: row.full_text.length, cached: true })
      }
      const paper = await ensurePdf(row)
      const file = join(PDF_DIR, paper.pdfPath)
      const { text, pages } = await extractPdfText(file)
      if (!text) throw new HttpError(502, 'PDF 里没有可提取的文字（可能是扫描版）')
      db.prepare('UPDATE papers SET full_text = ?, full_text_at = ? WHERE id = ?').run(
        text,
        new Date().toISOString(),
        row.id,
      )
      return sendJSON(res, 200, { text, chars: text.length, pages })
    }
  }

  const summaryMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/summary$/)
  if (summaryMatch) {
    const row = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(summaryMatch[1], user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'GET') {
      if (!row.summary_text) return sendJSON(res, 404, { error: '还没有总结' })
      return sendJSON(res, 200, { summary: row.summary_text, summaryAt: row.summary_at })
    }

    if (method === 'POST') {
      const body = await readBody(req)
      if (!row.abstract && !row.full_text) {
        throw new HttpError(400, '这篇还没有摘要和全文，没法总结')
      }
      const content = await chatCompletion(
        body.config || {},
        [
          { role: 'system', content: '你是论文总结助手，输出中文 Markdown，只输出正文。' },
          { role: 'user', content: buildSummaryPrompt(row, row.full_text) },
        ],
        2200,
      )
      db.prepare('UPDATE papers SET summary_text = ?, summary_at = ? WHERE id = ?').run(
        content,
        new Date().toISOString(),
        row.id,
      )
      return sendJSON(res, 200, { summary: content })
    }
  }

  const pdfMatch = pathname.match(/^\/api\/papers\/([\w-]+)\/pdf$/)
  if (pdfMatch) {
    let row = db
      .prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?')
      .get(pdfMatch[1], user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'POST') {
      const paper = await ensurePdf(row)
      return sendJSON(res, 200, { paper })
    }

    if (method === 'GET') {
      // 直接打开链接时本地可能还没有文件：先下载再流式返回
      if (!row.pdf_path || !existsSync(join(PDF_DIR, row.pdf_path))) {
        try {
          await ensurePdf(row)
        } catch (error) {
          return sendJSON(res, error.statusCode || 502, {
            error: error?.message || 'PDF 下载失败',
          })
        }
        row = db.prepare('SELECT * FROM papers WHERE id = ?').get(pdfMatch[1])
        if (!row.pdf_path) return sendJSON(res, 502, { error: 'PDF 下载后仍不可用' })
      }
      const file = join(PDF_DIR, row.pdf_path)
      if (!existsSync(file)) return sendJSON(res, 404, { error: '本地 PDF 丢失，重新下载' })
      return streamPdf(req, res, file)
    }
  }

  const match = pathname.match(/^\/api\/papers\/([\w-]+)$/)
  if (match) {
    const id = match[1]
    const row = db.prepare('SELECT * FROM papers WHERE id = ? AND user_id = ?').get(id, user.id)
    if (!row) return sendJSON(res, 404, { error: 'not found' })

    if (method === 'GET') return sendJSON(res, 200, { paper: rowToPaper(row) })

    if (method === 'PATCH') {
      const body = await readBody(req)
      const patch = pick(body)
      if (patch.summary_text !== undefined) patch.summary_at = new Date().toISOString()
      if (patch.status === 'read' && !patch.read_at) patch.read_at = new Date().toISOString()
      if (patch.status && patch.status !== 'read' && body.readAt === undefined) patch.read_at = null
      const keys = Object.keys(patch)
      if (keys.length) {
        const sets = keys.map((k) => `${k} = ?`).join(', ')
        db.prepare(`UPDATE papers SET ${sets} WHERE id = ? AND user_id = ?`).run(
          ...keys.map((k) => patch[k]),
          id,
          user.id,
        )
      }
      const fresh = db.prepare('SELECT * FROM papers WHERE id = ?').get(id)
      return sendJSON(res, 200, { paper: rowToPaper(fresh) })
    }

    if (method === 'DELETE') {
      db.prepare('DELETE FROM annotations WHERE paper_id = ? AND user_id = ?').run(id, user.id)
      db.prepare('DELETE FROM papers WHERE id = ? AND user_id = ?').run(id, user.id)
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

  // 老数据没有分类：启动后后台去 arXiv 补一轮，不阻塞请求
  setTimeout(() => {
    const rows = db
      .prepare(
        "SELECT id, arxiv FROM papers WHERE arxiv != '' AND (primary_category IS NULL OR primary_category = '') LIMIT 50",
      )
      .all()
    if (!rows.length) return
    backfillRows(rows)
      .then((n) => {
        if (n) console.log(`[paperdex] backfilled ${n} arxiv categories`)
      })
      .catch((error) => console.warn('[paperdex] backfill failed:', error?.message || error))
  }, 1200)
})
