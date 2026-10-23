import { paletteForCategory, paletteVariant, type SpritePalette } from './palette'

export interface CartoonShape {
  tag: 'path' | 'ellipse' | 'circle' | 'rect'
  attrs: Record<string, string | number>
  fill?: string
  stroke?: string
}

export interface CartoonScene {
  shapes: CartoonShape[]
  palette: SpritePalette
}

export const CARTOON_SIZE = 64

const OUTLINE = '#2f2620'

function hash(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ell = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill = 'body',
  stroke: string | undefined = OUTLINE,
  sw = 2.2,
): CartoonShape => ({
  tag: 'ellipse',
  attrs: { cx, cy, rx, ry, 'stroke-width': sw, 'stroke-linejoin': 'round' },
  fill,
  stroke,
})

const circ = (cx: number, cy: number, r: number, fill = 'body', stroke?: string): CartoonShape => ({
  tag: 'circle',
  attrs: { cx, cy, r, 'stroke-width': 2 },
  fill,
  stroke,
})

const path = (
  d: string,
  fill: string | undefined,
  stroke: string | undefined = OUTLINE,
  sw = 2.2,
): CartoonShape => ({
  tag: 'path',
  attrs: { d, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' },
  fill,
  stroke,
})

/** 描边肢体：先粗黑线，再细一圈身体色 */
function limb(x1: number, y1: number, x2: number, y2: number, w = 7, color = 'body'): CartoonShape[] {
  const d = `M ${x1} ${y1} L ${x2} ${y2}`
  return [path(d, undefined, OUTLINE, w + 2.2), path(d, undefined, color, w)]
}

function face(cx: number, cy: number, headRx: number, headRy: number, eyeStyle: number): CartoonShape[] {
  const dx = headRx * 0.42
  const eyeY = cy - headRy * 0.08
  const out: CartoonShape[] = []

  if (eyeStyle === 2) {
    // 开心眯眼
    out.push(path(`M ${cx - dx - 3} ${eyeY} Q ${cx - dx} ${eyeY - 4} ${cx - dx + 3} ${eyeY}`, undefined, OUTLINE, 2.4))
    out.push(path(`M ${cx + dx - 3} ${eyeY} Q ${cx + dx} ${eyeY - 4} ${cx + dx + 3} ${eyeY}`, undefined, OUTLINE, 2.4))
  } else if (eyeStyle === 3) {
    // 凶
    out.push(ell(cx - dx, eyeY + 1, 2.8, 3.4, 'ink', undefined, 0))
    out.push(ell(cx + dx, eyeY + 1, 2.8, 3.4, 'ink', undefined, 0))
    out.push(path(`M ${cx - dx - 3} ${eyeY - 4} L ${cx - dx + 3} ${eyeY - 2}`, undefined, OUTLINE, 2.2))
    out.push(path(`M ${cx + dx + 3} ${eyeY - 4} L ${cx + dx - 3} ${eyeY - 2}`, undefined, OUTLINE, 2.2))
  } else {
    const big = eyeStyle === 1
    const rx = big ? 4.2 : 3.5
    const ry = big ? 5.2 : 4.4
    for (const sx of [-1, 1]) {
      out.push(ell(cx + sx * dx, eyeY, rx, ry, 'ink', undefined, 0))
      out.push(circ(cx + sx * dx + 1.2, eyeY - 1.6, 1.25, 'white'))
      out.push(circ(cx + sx * dx - 1.1, eyeY + 1.4, 0.7, 'white'))
    }
  }

  // 腮红
  out.push(circ(cx - headRx * 0.78, eyeY + 4.4, 2.7, 'cheek'))
  out.push(circ(cx + headRx * 0.78, eyeY + 4.4, 2.7, 'cheek'))

  // 张嘴笑：平顶 + 圆底，舌头压在里面
  const my = eyeY + 6.0
  out.push(
    path(
      `M ${cx - 4} ${my} L ${cx + 4} ${my} Q ${cx + 4} ${my + 5.2} ${cx} ${my + 5.2} Q ${cx - 4} ${my + 5.2} ${cx - 4} ${my} Z`,
      'mouth',
      OUTLINE,
      1.7,
    ),
  )
  out.push(ell(cx, my + 3.6, 1.9, 1.0, 'tongue', undefined, 0))
  return out
}

function accessory(kind: number, cx: number, headCy: number, headRx: number, rnd: () => number): CartoonShape[] {
  const top = headCy - headRx
  if (kind === 1) {
    return [
      path(`M ${cx - headRx * 0.9} ${top + 3} Q ${cx} ${top - 7} ${cx + headRx * 0.9} ${top + 3} Z`, 'accent'),
      path(`M ${cx + headRx * 0.2} ${top + 3} L ${cx + headRx * 1.5} ${top + 4}`, undefined, OUTLINE, 3),
    ]
  }
  if (kind === 2) {
    return [path(`M ${cx - 8} ${top + 2} L ${cx - 5} ${top - 7} L ${cx - 2} ${top} L ${cx + 1} ${top - 8} L ${cx + 4} ${top} L ${cx + 7} ${top - 7} L ${cx + 8} ${top + 2} Z`, 'accent')]
  }
  if (kind === 3) {
    return [path(`M ${cx - 2.6} ${top + 2} L ${cx + 2.6} ${top + 2} L ${cx + 0.6} ${top - 9} Z`, 'accent')]
  }
  if (kind === 4) {
    return [
      path(`M ${cx - 3} ${top + 2} Q ${cx - 6} ${top - 6} ${cx - 7} ${top - 8}`, undefined, OUTLINE, 2),
      circ(cx - 7.4, top - 9, 2, 'accent'),
      path(`M ${cx + 3} ${top + 2} Q ${cx + 6} ${top - 6} ${cx + 7} ${top - 8}`, undefined, OUTLINE, 2),
      circ(cx + 7.4, top - 9, 2, 'accent'),
    ]
  }
  if (kind === 5) {
    return [ell(cx, top - 5, headRx * 0.85, 2.4, undefined, 'accent', 2.2)]
  }
  if (kind === 6) {
    const y = headCy + headRx * 0.85
    return [path(`M ${cx - headRx * 0.8} ${y} Q ${cx} ${y + 3} ${cx + headRx * 0.8} ${y} L ${cx + headRx * 0.5} ${y + 5} L ${cx - headRx * 0.5} ${y + 5} Z`, 'accent')]
  }
  if (kind === 7) {
    const eyeY = headCy - headRx * 0.08
    const dx = headRx * 0.42
    return [
      circ(cx - dx, eyeY, 4.6, undefined, OUTLINE),
      circ(cx + dx, eyeY, 4.6, undefined, OUTLINE),
      path(`M ${cx - dx + 4.6} ${eyeY} L ${cx + dx - 4.6} ${eyeY}`, undefined, OUTLINE, 1.6),
    ]
  }
  // 随机小闪电装饰
  if (kind === 0 && rnd() < 0.35) {
    const sx = cx + (rnd() < 0.5 ? -1 : 1) * (headRx + 10)
    return [path(`M ${sx} ${headCy + 2} l -4 6 l 4 -1 l -3 6`, undefined, OUTLINE, 2)]
  }
  return []
}

/* ------------------------------------------------------------------ kinds */

function biped(_palette: SpritePalette, rnd: () => number): CartoonShape[] {
  const cx = 32
  const headCy = 22
  const headRx = 12.5
  const headRy = 11.5
  const shapes: CartoonShape[] = []

  shapes.push(...limb(25, 47, 22, 57, 8))
  shapes.push(...limb(39, 47, 42, 57, 8))
  shapes.push(ell(22, 58, 6.5, 3.4, 'body'))
  shapes.push(ell(42, 58, 6.5, 3.4, 'body'))

  shapes.push(ell(32, 41, 13.5, 14.5, 'body'))
  shapes.push(...limb(20, 35, 13, 45, 7))
  shapes.push(...limb(44, 35, 51, 45, 7))

  const earH = 16 + rnd() * 4
  for (const s of [-1, 1]) {
    shapes.push(
      path(
        `M ${cx + s * headRx * 0.55} ${headCy - headRy * 0.6} Q ${cx + s * (headRx + 2)} ${headCy - earH} ${cx + s * (headRx * 0.95)} ${headCy - headRy * 0.2} Z`,
        'body',
      ),
    )
  }

  if (rnd() < 0.55) {
    shapes.push(
      path(`M 45 43 l 7 -9 l -2 7 l 8 -3 l -10 11 l 1 -5 Z`, 'accent', OUTLINE, 2),
    )
  }

  shapes.push(ell(cx, headCy, headRx, headRy, 'body'))
  return shapes
}

function quadruped(_palette: SpritePalette, rnd: () => number): CartoonShape[] {
  const shapes: CartoonShape[] = []
  shapes.push(...limb(18, 45, 16, 56, 7))
  shapes.push(...limb(28, 46, 27, 56, 7))
  shapes.push(...limb(38, 46, 39, 56, 7))
  shapes.push(...limb(46, 45, 49, 55, 7))

  shapes.push(ell(32, 40, 18, 11, 'body'))
  shapes.push(ell(17, 30, 11.5, 10.5, 'body'))
  shapes.push(ell(9, 33, 5, 3.8, 'body'))

  for (const s of [-1, 1]) {
    shapes.push(
      path(
        `M ${17 + s * 8} 22 Q ${17 + s * 13} ${12 + rnd() * 3} ${17 + s * 6} 18 Z`,
        'body',
      ),
    )
  }
  shapes.push(path(`M 48 38 Q 58 34 56 24 Q 53 32 48 33 Z`, 'body'))
  return shapes
}

function blob(): CartoonShape[] {
  return [
    ell(24, 57, 6.5, 3.2, 'body'),
    ell(40, 57, 6.5, 3.2, 'body'),
    ell(32, 42, 18, 16, 'body'),
    ...limb(16, 36, 9, 44, 7),
    ...limb(48, 36, 55, 44, 7),
  ]
}

function bird(): CartoonShape[] {
  const shapes: CartoonShape[] = []
  shapes.push(...limb(30, 50, 28, 58, 4.5))
  shapes.push(...limb(34, 50, 36, 58, 4.5))
  shapes.push(ell(32, 41, 14, 15, 'body'))
  shapes.push(ell(32, 24, 11, 10, 'body'))
  shapes.push(path('M 32 27 L 27 30 L 37 30 Z', 'accent'))
  shapes.push(ell(20, 42, 5, 9, 'body'))
  shapes.push(ell(44, 42, 5, 9, 'body'))
  return shapes
}

function ghost(): CartoonShape[] {
  const shapes: CartoonShape[] = []
  shapes.push(
    path(
      'M 16 34 Q 16 14 32 14 Q 48 14 48 34 L 48 50 Q 44 46 40 50 Q 36 54 32 50 Q 28 46 24 50 Q 20 54 16 50 Z',
      'body',
    ),
  )
  shapes.push(...limb(17, 32, 10, 38, 6))
  shapes.push(...limb(47, 32, 54, 38, 6))
  return shapes
}

function insect(rnd: () => number): CartoonShape[] {
  const shapes: CartoonShape[] = []
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      shapes.push(...limb(32 + s * 8, 34 + i * 7, 32 + s * 18, 38 + i * 6, 3.4))
    }
  }
  shapes.push(ell(32, 30, 10, 9, 'body'))
  shapes.push(ell(32, 41, 12, 9, 'body'))
  shapes.push(ell(32, 50, 9, 7, 'body'))
  for (const s of [-1, 1]) {
    shapes.push(path(`M ${32 + s * 4} 22 Q ${32 + s * 9} 12 ${32 + s * 12} 10`, undefined, OUTLINE, 2))
    shapes.push(circ(32 + s * 12.5, 9.5, 2.2, 'accent'))
  }
  if (rnd() < 0.6) {
    shapes.push(ell(20, 32, 6, 10, 'accent', OUTLINE, 1.8))
    shapes.push(ell(44, 32, 6, 10, 'accent', OUTLINE, 1.8))
  }
  return shapes
}

function serpent(): CartoonShape[] {
  return [
    path('M 20 54 Q 12 40 26 38 Q 42 36 44 24', undefined, OUTLINE, 15),
    path('M 20 54 Q 12 40 26 38 Q 42 36 44 24', undefined, 'body', 11.5),
    ell(46, 20, 10, 9.5, 'body'),
  ]
}

function fish(): CartoonShape[] {
  return [
    path('M 22 34 L 8 24 Q 12 34 8 44 Z', 'body'),
    path('M 28 24 L 34 14 L 38 26 Z', 'body'),
    ell(34, 34, 17, 12, 'body'),
  ]
}

function mech(): CartoonShape[] {
  const shapes: CartoonShape[] = []
  shapes.push(path('M 22 44 L 18 56 L 26 56 L 28 46 Z', 'body'))
  shapes.push(path('M 42 44 L 46 56 L 38 56 L 36 46 Z', 'body'))
  shapes.push(path('M 20 32 L 44 32 L 46 46 L 18 46 Z', 'body'))
  shapes.push(path('M 24 16 L 40 16 L 42 30 L 22 30 Z', 'body'))
  shapes.push(path('M 27 21 L 37 21 L 37 26 L 27 26 Z', 'accent', OUTLINE, 1.6))
  shapes.push(path('M 42 17 L 48 9', undefined, OUTLINE, 2))
  shapes.push(circ(49, 8, 2.2, 'accent'))
  shapes.push(...limb(19, 35, 12, 44, 5))
  shapes.push(...limb(45, 35, 52, 44, 5))
  return shapes
}

function plant(rnd: () => number): CartoonShape[] {
  const shapes: CartoonShape[] = []
  shapes.push(ell(32, 44, 16, 13, 'body'))
  shapes.push(path('M 32 28 Q 31 12 24 8 Q 34 10 34 28 Z', 'accent'))
  shapes.push(path('M 33 28 Q 38 12 46 10 Q 38 18 36 30 Z', 'accent'))
  if (rnd() < 0.5) shapes.push(ell(22, 20, 5, 3, 'accent'))
  return shapes
}

/* ------------------------------------------------------------------ build */

export function buildCartoon(seed: string, category: string, locked = false): CartoonScene {
  const h = hash(seed || 'anonymous')
  const rnd = rng(h)
  const palette = paletteVariant(paletteForCategory(category), seed)
  const kinds = ['biped', 'quadruped', 'blob', 'bird', 'ghost', 'insect', 'serpent', 'fish', 'mech', 'plant']
  const kind = kinds[h % kinds.length]

  let shapes: CartoonShape[] = []
  let head = { cx: 32, cy: 24, rx: 12, ry: 11 }

  if (kind === 'biped') {
    shapes = biped(palette, rnd)
    head = { cx: 32, cy: 22, rx: 12.5, ry: 11.5 }
  } else if (kind === 'quadruped') {
    shapes = quadruped(palette, rnd)
    head = { cx: 17, cy: 30, rx: 11.5, ry: 10.5 }
  } else if (kind === 'blob') {
    shapes = blob()
    head = { cx: 32, cy: 34, rx: 14, ry: 12 }
  } else if (kind === 'bird') {
    shapes = bird()
    head = { cx: 32, cy: 24, rx: 11, ry: 10 }
  } else if (kind === 'ghost') {
    shapes = ghost()
    head = { cx: 32, cy: 28, rx: 12, ry: 11 }
  } else if (kind === 'insect') {
    shapes = insect(rnd)
    head = { cx: 32, cy: 30, rx: 10, ry: 9 }
  } else if (kind === 'serpent') {
    shapes = serpent()
    head = { cx: 46, cy: 20, rx: 10, ry: 9.5 }
  } else if (kind === 'fish') {
    shapes = fish()
    head = { cx: 34, cy: 34, rx: 12, ry: 9.5 }
  } else if (kind === 'mech') {
    shapes = mech()
    head = { cx: 32, cy: 23, rx: 9, ry: 7 }
  } else {
    shapes = plant(rnd)
    head = { cx: 32, cy: 42, rx: 12, ry: 9.5 }
  }

  if (locked) {
    return {
      shapes: [
        ell(32, 58, 17, 3.6, 'shadow', undefined, 0),
        ...shapes.map((shape) => ({ ...shape, fill: shape.fill === 'white' ? 'white' : 'locked', stroke: OUTLINE })),
      ],
      palette,
    }
  }

  shapes.unshift(ell(32, 58, 17, 3.6, 'shadow', undefined, 0))
  shapes.push(...face(head.cx, head.cy, head.rx, head.ry, Math.floor(rnd() * 4)))

  const acc = accessory(Math.floor(rnd() * 8), head.cx, head.cy, head.rx, rnd)
  shapes.push(...acc)

  // 高光小闪电
  if (rnd() < 0.5) {
    shapes.push(path('M 6 26 l 4 1 l -2 4', undefined, 'spark', 2.2))
    shapes.push(path('M 58 40 l -4 1 l 2 4', undefined, 'spark', 2.2))
  }

  return { shapes, palette }
}
