import type { TypeKey } from './types'
import { TYPES } from './typeMap'

export interface SpriteRect {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

interface Palette {
  base: string
  light: string
  dark: string
}

const OUTLINE = '#2b2420'
const GLINT = '#fffdf4'
const SIZE = 16

/** 未点亮时统一成剪影色，只保留轮廓 */
const LOCKED_PALETTE: Palette = { base: '#57503f', light: '#57503f', dark: '#57503f' }

function hashStr(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32：同一 seed 永远生成同一只精灵 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Grid = number[][]

function paint(grid: Grid, cx: number, cy: number, rx: number, ry: number) {
  const x0 = Math.max(1, Math.floor(cx - rx))
  const x1 = Math.min(SIZE - 2, Math.ceil(cx + rx))
  const y0 = Math.max(1, Math.floor(cy - ry))
  const y1 = Math.min(SIZE - 2, Math.ceil(cy + ry))
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) grid[y][x] = 1
    }
  }
}

function put(grid: Grid, x: number, y: number, value = 1) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) grid[py][px] = value
}

interface Belly {
  cy: number
  rx: number
  ry: number
}

function buildGrid(seed: string) {
  const rnd = makeRng(hashStr(seed))
  const grid: Grid = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))

  const cx = 7.5
  const headRx = 2.3 + rnd() * 1.4
  const headRy = 2.0 + rnd() * 1.0
  const headCy = 3.2 + headRy
  const bodyRx = 1.9 + rnd() * 1.2
  const bodyRy = 1.7 + rnd() * 1.0
  const bodyCy = headCy + headRy + bodyRy - 0.7

  paint(grid, cx, bodyCy, bodyRx, bodyRy)
  paint(grid, cx, headCy + headRy - 0.3, 1.3, 1.1)
  paint(grid, cx, headCy, headRx, headRy)

  // 耳朵 / 独角 / 触角
  const kind = Math.floor(rnd() * 4)
  if (kind === 1) {
    const off = headRx * 0.78
    const ey = Math.round(headCy - headRy * 0.55)
    for (const s of [-1, 1]) {
      paint(grid, cx + s * off, ey, 1.0, 1.1)
      paint(grid, cx + s * off, ey + 1, 0.9, 0.9)
    }
  } else if (kind === 2) {
    const top = Math.round(headCy - headRy - 1.6)
    for (let y = top; y <= top + 3; y += 1) put(grid, cx, y)
    paint(grid, cx, top - 0.3, 1.0, 0.9)
  } else if (kind === 3) {
    const top = Math.round(headCy - headRy - 1.4)
    put(grid, cx - 1, top + 1)
    put(grid, cx + 1, top + 1)
    put(grid, cx - 1, top + 2)
    put(grid, cx + 1, top + 2)
    put(grid, cx, top, 2)
  }

  // 手臂（贴着身体，不留缝）
  if (rnd() < 0.6) {
    const ay = Math.round(bodyCy - 0.2)
    const ax = Math.round(bodyRx + 0.7)
    for (const s of [-1, 1]) {
      put(grid, cx + s * (bodyRx + 0.2), ay)
      paint(grid, cx + s * ax, ay, 0.85, 1.25)
    }
  }

  // 腿 + 脚
  const legY = Math.round(bodyCy + bodyRy - 0.2)
  const legW = rnd() < 0.5 ? 1 : 2
  const spread = Math.max(1, Math.round(bodyRx * 0.55))
  for (const s of [-1, 1]) {
    for (let k = 0; k < legW; k += 1) {
      const x = cx + s * spread + (s < 0 ? -k : k)
      for (let y = legY; y <= SIZE - 2; y += 1) put(grid, x, y)
    }
    put(grid, cx + s * spread + (s < 0 ? -1 : 0), SIZE - 2)
  }

  // 尾巴
  if (rnd() < 0.3) {
    const ty = Math.round(bodyCy + bodyRy * 0.3)
    const dir = rnd() < 0.5 ? -1 : 1
    for (let k = 1; k <= 2; k += 1) put(grid, cx + dir * (bodyRx + k - 0.4), ty + k - 1)
  }

  // 肚子浅色块
  let belly: Belly | null = null
  if (rnd() < 0.45) {
    belly = { cy: bodyCy + 0.3, rx: bodyRx * 0.55, ry: bodyRy * 0.6 }
  }

  // 眼睛 + 高光 + 嘴
  const eyeY = Math.round(headCy - headRy * 0.12)
  const eyeX = Math.max(1, Math.round(headRx * 0.42))
  for (const s of [-1, 1]) {
    put(grid, cx + s * eyeX, eyeY, 2)
    put(grid, cx + s * eyeX, eyeY + 1, 2)
    put(grid, cx + s * eyeX, eyeY, 3)
  }
  const mouth = rnd()
  if (mouth < 0.45) {
    put(grid, cx, eyeY + 2, 2)
    put(grid, cx + 1, eyeY + 2, 2)
  } else if (mouth < 0.7) {
    put(grid, cx, eyeY + 2, 2)
  }

  return { grid, belly, bodyCy, bodyRx, bodyRy, cx }
}

function colorFor(
  grid: Grid,
  x: number,
  y: number,
  palette: Palette,
  belly: Belly | null,
  bodyCy: number,
  bodyRy: number,
  cx: number,
): string {
  const v = grid[y][x]
  if (v === 2) return OUTLINE
  if (v === 3) return GLINT
  if (belly) {
    const dx = (x - cx) / belly.rx
    const dy = (y - belly.cy) / belly.ry
    if (dx * dx + dy * dy <= 1) return palette.light
  }
  if (y > bodyCy + bodyRy * 0.9) return palette.dark
  if (x + y < 13 && x <= cx) return palette.light
  return palette.base
}

const cache = new Map<string, SpriteRect[]>()

export function buildSprite(seed: string, type: TypeKey, locked = false): SpriteRect[] {
  const key = `${seed}|${type}|${locked ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit

  const { grid, belly, bodyCy, bodyRy, cx } = buildGrid(seed || 'anonymous')
  const palette: Palette = locked ? LOCKED_PALETTE : TYPES[type] ?? TYPES.normal
  const isBody = (x: number, y: number) =>
    x >= 0 && x < SIZE && y >= 0 && y < SIZE && grid[y][x] > 0

  const rects: SpriteRect[] = []
  for (let y = 0; y < SIZE; y += 1) {
    let run: SpriteRect | null = null
    for (let x = 0; x < SIZE; x += 1) {
      let fill: string | null = null
      if (grid[y][x] > 0) {
        fill = colorFor(grid, x, y, palette, belly, bodyCy, bodyRy, cx)
      } else if (isBody(x - 1, y) || isBody(x + 1, y) || isBody(x, y - 1) || isBody(x, y + 1)) {
        fill = OUTLINE
      }
      if (fill && run && run.fill === fill) {
        run.w += 1
      } else {
        if (run) rects.push(run)
        run = fill ? { x, y, w: 1, h: 1, fill } : null
      }
    }
    if (run) rects.push(run)
  }

  cache.set(key, rects)
  return rects
}

export function spriteSeedFor(paper: { arxiv: string; title: string }): string {
  return paper.arxiv || paper.title
}
