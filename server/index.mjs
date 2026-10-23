import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = join(ROOT, 'dist')
const DATA_DIR = join(ROOT, 'data')
const DB_PATH = process.env.POKEMONPAPER_DB || join(DATA_DIR, 'pokemonpaper.db')
const PORT = Number(process.env.PORT || 8787)

mkdirSync(DATA_DIR, { recursive: true })

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
    INSERT INTO papers (id, arxiv, title, authors, venue, year, type, status, rating, tags, notes, url, added_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    INSERT INTO papers (id, arxiv, title, authors, venue, year, type, status, rating, tags, notes, url, added_at, read_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    console.error('[pokemonpaper]', error)
    if (!res.headersSent) sendJSON(res, 500, { error: String(error?.message || error) })
    else res.end()
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PokemonPaper API  http://127.0.0.1:${PORT}`)
  console.log(`SQLite        ${DB_PATH}`)
})
