import { paletteForCategory, type SpritePalette } from './palette'

export interface SpriteRect {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

export const SPRITE_SIZE = 32

const OUTLINE = '#2b2420'
const GLINT = '#fffdf4'
const SHADOW = 'rgba(43, 36, 32, 0.16)'

const S = SPRITE_SIZE
type Grid = Uint8Array

const EMPTY = 0
const BODY = 1
const LIGHT = 2
const DARK = 3
const EYE = 4
const WHITE = 5
const ACCENT = 6
const EDGE = 7
const SHADOW_PX = 9

const LOCKED: SpritePalette = {
  base: '#57503f',
  light: '#57503f',
  dark: '#57503f',
  accent: '#57503f',
}

/* --------------------------------------------------------------- random */

function hashStr(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

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

/* ---------------------------------------------------------------- paint */

function grid(): Grid {
  return new Uint8Array(S * S)
}

function px(g: Grid, x: number, y: number, v = BODY) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 1 || ix > S - 2 || iy < 1 || iy > S - 2) return
  g[iy * S + ix] = v
}

function at(g: Grid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= S || y >= S) return 0
  return g[y * S + x]
}

function isBody(v: number): boolean {
  return v === BODY || v === LIGHT || v === DARK || v === ACCENT
}

/** 只在身体像素上落笔，避免五官飘到轮廓外 */
function facePx(g: Grid, x: number, y: number, v: number) {
  if (isBody(at(g, Math.round(x), Math.round(y)))) px(g, x, y, v)
}

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, v = BODY) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(g, x, y, v)
    }
  }
}

function capsule(g: Grid, x1: number, y1: number, x2: number, y2: number, r: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    ellipse(g, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, r)
  }
}

function triangle(g: Grid, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const minX = Math.floor(Math.min(ax, bx, cx))
  const maxX = Math.ceil(Math.max(ax, bx, cx))
  const minY = Math.floor(Math.min(ay, by, cy))
  const maxY = Math.ceil(Math.max(ay, by, cy))
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  if (Math.abs(area) < 0.001) return
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) / area
      const w2 = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) / area
      if (w0 >= -0.05 && w1 >= -0.05 && w2 >= -0.05) px(g, x, y)
    }
  }
}

/* ------------------------------------------------------------ archetypes */

type Archetype = 'biped' | 'quadruped' | 'blob' | 'bird' | 'ghost'

interface Anatomy {
  kind: Archetype
  cx: number
  headCy: number
  headR: number
  bodyCy: number
  bodyR: number
  top: number
  bottom: number
  left: number
  right: number
  face: 'front' | 'side'
  eyeY: number
}

function drawEars(g: Grid, a: Anatomy, rnd: () => number) {
  const kind = Math.floor(rnd() * 5)
  const { cx, headCy, headR } = a
  if (kind === 0) {
    for (const s of [-1, 1]) {
      triangle(
        g,
        cx + s * headR * 0.55,
        headCy - headR * 0.55,
        cx + s * headR * 0.9,
        headCy - headR * 1.28,
        cx + s * headR * 0.15,
        headCy - headR * 1.2,
      )
    }
  } else if (kind === 1) {
    for (const s of [-1, 1]) {
      ellipse(g, cx + s * headR * 0.85, headCy - headR * 0.75, 2.4, 2.2)
    }
  } else if (kind === 2) {
    for (const s of [-1, 1]) {
      capsule(
        g,
        cx + s * headR * 0.55,
        headCy - headR * 0.6,
        cx + s * headR * 0.72,
        headCy - headR * 1.45,
        1.2,
      )
    }
  } else if (kind === 3) {
    triangle(
      g,
      cx - 1.7,
      headCy - headR * 0.9,
      cx + 1.7,
      headCy - headR * 0.9,
      cx,
      headCy - headR * 1.22,
    )
  }
}

function drawTail(g: Grid, a: Anatomy, rnd: () => number) {
  const kind = Math.floor(rnd() * 3)
  const x = a.right - 1
  const y = a.bodyCy + 1
  if (kind === 0) {
    capsule(g, x, y, x + 4, y - 4, 1.6)
    capsule(g, x + 4, y - 4, x + 5, y - 7, 1.2)
  } else if (kind === 1) {
    capsule(g, x, y, x + 5, y + 1.5, 1.4)
    ellipse(g, x + 6, y + 1.5, 2.2, 2.2)
  } else {
    for (let i = 0; i < 4; i += 1) {
      capsule(g, x + i, y - i * 1.5, x + i + 1, y - (i + 1) * 1.5, 1.1)
    }
  }
}

function drawBiped(g: Grid, rnd: () => number): Anatomy {
  const cx = 16
  const headR = 5.5 + rnd() * 0.8
  const headCy = 8.6
  const bodyCy = 19.6
  const bodyRx = 4.3 + rnd() * 0.7
  const bodyRy = 4.6 + rnd() * 0.6

  capsule(g, cx - 2.5, bodyCy + bodyRy - 1.6, cx - 3.0, 26.2, 1.8)
  capsule(g, cx + 2.5, bodyCy + bodyRy - 1.6, cx + 3.0, 26.2, 1.8)
  ellipse(g, cx - 3.5, 27.2, 2.9, 1.6)
  ellipse(g, cx + 3.5, 27.2, 2.9, 1.6)

  ellipse(g, cx, bodyCy, bodyRx, bodyRy)
  capsule(g, cx, headCy + headR * 0.55, cx, bodyCy - bodyRy * 0.55, 2.5)

  const shoulderY = bodyCy - 2.2
  capsule(g, cx - bodyRx * 1.05, shoulderY, cx - bodyRx - 1.6, shoulderY + 5.4, 1.7)
  capsule(g, cx + bodyRx * 1.05, shoulderY, cx + bodyRx + 1.6, shoulderY + 5.4, 1.7)
  ellipse(g, cx - bodyRx - 1.8, shoulderY + 6.0, 2.0, 2.0)
  ellipse(g, cx + bodyRx + 1.8, shoulderY + 6.0, 2.0, 2.0)

  ellipse(g, cx, headCy, headR, headR * 0.94)

  const anatomy: Anatomy = {
    kind: 'biped',
    cx,
    headCy,
    headR,
    bodyCy,
    bodyR: bodyRy,
    top: headCy - headR,
    bottom: 29,
    left: cx - bodyRx,
    right: cx + bodyRx,
    face: 'front',
    eyeY: headCy + 0.4,
  }
  drawEars(g, anatomy, rnd)
  if (rnd() < 0.6) drawTail(g, { ...anatomy, right: cx + bodyRx }, rnd)
  return anatomy
}

function drawQuadruped(g: Grid, rnd: () => number): Anatomy {
  const bodyCy = 19
  const bodyRx = 7.2 + rnd() * 1.2
  const bodyRy = 4.6 + rnd() * 0.8
  const headCy = 13
  const headRx = 4.9 + rnd() * 0.6

  for (const x of [16, 20, 10, 6]) {
    capsule(g, x, bodyCy + 2, x - 0.4, 26.6, 1.5)
    ellipse(g, x - 0.4, 27.4, 2.4, 1.5)
  }

  ellipse(g, 16, bodyCy, bodyRx, bodyRy)
  ellipse(g, 8.6, headCy, headRx, headRx * 0.95)
  ellipse(g, 4.7, headCy + 1.7, 2.5, 1.9)

  const anatomy: Anatomy = {
    kind: 'quadruped',
    cx: 8.6,
    headCy,
    headR: headRx,
    bodyCy,
    bodyR: bodyRy,
    top: headCy - headRx,
    bottom: 29,
    left: 2,
    right: 16 + bodyRx,
    face: 'side',
    eyeY: headCy - 0.1,
  }
  drawEars(g, anatomy, rnd)
  drawTail(g, { ...anatomy, bodyCy }, rnd)
  return anatomy
}

function drawBlob(g: Grid, rnd: () => number): Anatomy {
  const cx = 16
  const bodyCy = 19
  const bodyRx = 8.3 + rnd() * 1.2
  const bodyRy = 7.7 + rnd() * 1.0

  ellipse(g, cx - 4.6, 27.1, 3.2, 1.8)
  ellipse(g, cx + 4.6, 27.1, 3.2, 1.8)
  ellipse(g, cx, bodyCy, bodyRx, bodyRy)
  ellipse(g, cx - bodyRx - 0.6, bodyCy - 1, 1.9, 2.5)
  ellipse(g, cx + bodyRx + 0.6, bodyCy - 1, 1.9, 2.5)

  if (rnd() < 0.45) {
    capsule(g, cx, bodyCy - bodyRy + 1, cx + 1, bodyCy - bodyRy - 3, 1.2)
    ellipse(g, cx + 2, bodyCy - bodyRy - 4, 2.2, 1.6)
  }

  return {
    kind: 'blob',
    cx,
    headCy: bodyCy - bodyRy * 0.3,
    headR: bodyRx * 0.82,
    bodyCy,
    bodyR: bodyRy,
    top: bodyCy - bodyRy,
    bottom: 29,
    left: cx - bodyRx,
    right: cx + bodyRx,
    face: 'front',
    eyeY: bodyCy - bodyRy * 0.32,
  }
}

function drawBird(g: Grid, rnd: () => number): Anatomy {
  const cx = 16
  const bodyCy = 19
  const bodyRx = 6.8
  const bodyRy = 6.8
  const headCy = 10.4

  capsule(g, cx - 2, 26, cx - 2.4, 27.6, 1.2)
  capsule(g, cx + 2, 26, cx + 2.4, 27.6, 1.2)
  ellipse(g, cx, bodyCy, bodyRx, bodyRy)
  ellipse(g, cx, headCy, 5.5, 5.1)
  ellipse(g, cx - bodyRx - 0.4, bodyCy + 0.2, 2.2, 3.7)
  ellipse(g, cx + bodyRx + 0.4, bodyCy + 0.2, 2.2, 3.7)
  triangle(g, cx - 1.3, headCy + 2.3, cx + 1.3, headCy + 2.3, cx, headCy + 4.6)
  for (const dy of [-1, 0, 1]) {
    capsule(g, cx - 2, bodyCy + bodyRy - 1.5, cx - bodyRx - 3, bodyCy - 2 + dy * 2, 1.1)
  }

  const anatomy: Anatomy = {
    kind: 'bird',
    cx,
    headCy,
    headR: 5.3,
    bodyCy,
    bodyR: bodyRy,
    top: headCy - 5,
    bottom: 29,
    left: cx - bodyRx,
    right: cx + bodyRx,
    face: 'front',
    eyeY: headCy - 0.2,
  }
  if (rnd() < 0.5) {
    triangle(g, cx - 2, headCy - 4.8, cx + 2, headCy - 4.8, cx + 5, headCy - 7.2)
  }
  return anatomy
}

function drawGhost(g: Grid): Anatomy {
  const cx = 16
  const headCy = 15
  const rx = 7.7
  const ry = 7.0

  ellipse(g, cx, headCy, rx, ry)
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
    const t = (x - (cx - rx)) / (rx * 2)
    const bottom = headCy + ry + Math.sin(t * Math.PI * 3) * 1.8
    for (let y = Math.floor(headCy); y <= bottom; y += 1) {
      if (at(g, x, y) === EMPTY) px(g, x, y)
    }
  }
  ellipse(g, cx - rx - 0.4, headCy + 1, 1.7, 2.7)
  ellipse(g, cx + rx + 0.4, headCy + 1, 1.7, 2.7)

  return {
    kind: 'ghost',
    cx,
    headCy,
    headR: rx,
    bodyCy: headCy + 2,
    bodyR: ry,
    top: headCy - ry,
    bottom: headCy + ry + 2,
    left: cx - rx,
    right: cx + rx,
    face: 'front',
    eyeY: headCy - 1,
  }
}

/* ------------------------------------------------------------------ face */

const EYE_ROUND = ['.oo.', 'oooo', 'oowo', '.oo.']
const EYE_SLEEPY = ['....', 'oooo', 'oowo', '....']
const EYE_ANGRY = ['oo..', 'ooo.', 'oowo', '.oo.']

function drawEyeMask(g: Grid, x: number, y: number, mask: string[], mirror: boolean) {
  for (let row = 0; row < mask.length; row += 1) {
    for (let col = 0; col < mask[row].length; col += 1) {
      const ch = mask[row][mirror ? mask[row].length - 1 - col : col]
      if (ch === 'o') facePx(g, x + col, y + row, EYE)
      else if (ch === 'w') facePx(g, x + col, y + row, WHITE)
      else if (ch === 'b') facePx(g, x + col, y + row, EDGE)
    }
  }
}

function drawFace(g: Grid, a: Anatomy, rnd: () => number) {
  const style = Math.floor(rnd() * 3)
  const mask = style === 0 ? EYE_ROUND : style === 1 ? EYE_SLEEPY : EYE_ANGRY
  const eyeY = Math.round(a.eyeY)

  if (a.face === 'front') {
    const dx = Math.round(a.headR * 0.45) + 1
    drawEyeMask(g, a.cx - dx - 1, eyeY - 1, mask, false)
    drawEyeMask(g, a.cx + dx - 2, eyeY - 1, mask, true)

    const mouth = Math.floor(rnd() * 3)
    const my = eyeY + 4
    if (mouth === 1) {
      for (const dxm of [-1, 0, 1]) facePx(g, a.cx + dxm, my, EYE)
      facePx(g, a.cx, my + 1, EYE)
    } else if (mouth === 2) {
      facePx(g, a.cx - 1, my, EYE)
      facePx(g, a.cx, my, WHITE)
      facePx(g, a.cx + 1, my, EYE)
    }

    if (rnd() < 0.55) {
      const dxc = Math.round(a.headR * 0.75)
      for (const s of [-1, 1]) {
        facePx(g, a.cx + s * dxc - 1, eyeY + 3, ACCENT)
        facePx(g, a.cx + s * dxc, eyeY + 3, ACCENT)
      }
    }
  } else {
    const ex = Math.round(a.cx - a.headR * 0.4)
    drawEyeMask(g, ex, eyeY - 1, mask, false)
    if (rnd() < 0.6) {
      facePx(g, a.cx + 2, eyeY + 3, ACCENT)
      facePx(g, a.cx + 3, eyeY + 3, ACCENT)
    }
  }
}

/* --------------------------------------------------------------- shading */

function shade(g: Grid, a: Anatomy, rnd: () => number) {
  const height = Math.max(1, a.bottom - a.top)
  const width = Math.max(1, a.right - a.left)
  const belly = rnd() < 0.6
  const bellyCy = a.bodyCy + 1.5
  const bellyRx = Math.max(2, a.bodyR * 0.55)
  const bellyRy = Math.max(2, a.bodyR * 0.45)

  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      if (at(g, x, y) !== BODY) continue
      const t = (y - a.top) / height
      const u = (x - a.left) / width
      const inBelly =
        belly &&
        a.kind !== 'quadruped' &&
        ((x - a.cx) / bellyRx) ** 2 + ((y - bellyCy) / bellyRy) ** 2 <= 1

      let v = BODY
      if (inBelly) v = LIGHT
      else if (t > 0.93) v = DARK
      else if (t > 0.87 && (x + y) % 2 === 0) v = DARK
      else if (u < 0.18 && t > 0.16) v = LIGHT
      else if (t < 0.14 && u < 0.8) v = LIGHT
      else if (u > 0.86) v = DARK
      g[y * S + x] = v
    }
  }
}

/* --------------------------------------------------------------- outline */

function outline(g: Grid): void {
  const copy = Uint8Array.from(g)
  const solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return false
    return copy[y * S + x] !== EMPTY
  }
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      if (copy[y * S + x] !== EMPTY) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        g[y * S + x] = EDGE
      }
    }
  }
}

function groundShadow(g: Grid, a: Anatomy) {
  const cy = Math.min(S - 2, a.bottom + 0.3)
  const rx = Math.min(9.5, (a.right - a.left) * 0.62)
  for (let y = Math.floor(cy - 1.4); y <= Math.ceil(cy + 1.4); y += 1) {
    for (let x = Math.floor(a.cx - rx); x <= Math.ceil(a.cx + rx); x += 1) {
      const dx = (x - a.cx) / rx
      const dy = (y - cy) / 1.4
      if (dx * dx + dy * dy <= 1 && at(g, x, y) === EMPTY) px(g, x, y, SHADOW_PX)
    }
  }
}

/* ---------------------------------------------------------------- render */

const cache = new Map<string, SpriteRect[]>()

function colorFor(v: number, palette: SpritePalette, locked: boolean): string {
  if (locked) {
    if (v === EYE || v === EDGE) return OUTLINE
    if (v === WHITE) return '#cfc7b8'
    return LOCKED.base
  }
  switch (v) {
    case LIGHT:
      return palette.light
    case DARK:
      return palette.dark
    case EYE:
    case EDGE:
      return OUTLINE
    case WHITE:
      return GLINT
    case ACCENT:
      return palette.accent
    default:
      return palette.base
  }
}

export function buildSprite(seed: string, category: string, locked = false): SpriteRect[] {
  const key = `${seed}|${category}|${locked ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit

  const rnd = makeRng(hashStr(seed || 'anonymous'))
  const g = grid()
  const archetypes: Archetype[] = ['biped', 'quadruped', 'blob', 'bird', 'ghost']
  const kind = archetypes[Math.floor(rnd() * archetypes.length)]

  let anatomy: Anatomy
  if (kind === 'biped') anatomy = drawBiped(g, rnd)
  else if (kind === 'quadruped') anatomy = drawQuadruped(g, rnd)
  else if (kind === 'blob') anatomy = drawBlob(g, rnd)
  else if (kind === 'bird') anatomy = drawBird(g, rnd)
  else anatomy = drawGhost(g)

  shade(g, anatomy, rnd)
  drawFace(g, anatomy, rnd)
  outline(g)
  if (!locked) groundShadow(g, anatomy)

  const palette = paletteForCategory(category)
  const rects: SpriteRect[] = []

  for (let y = 0; y < S; y += 1) {
    let run: SpriteRect | null = null
    for (let x = 0; x < S; x += 1) {
      const v = at(g, x, y)
      const fill = v === SHADOW_PX ? SHADOW : v === EMPTY ? null : colorFor(v, palette, locked)
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
