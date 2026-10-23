export interface AvatarPreset {
  id: string
  name: string
  skin: string
  hair: string
  shirt: string
  hat: 'none' | 'cap' | 'beanie' | 'straw' | 'hood'
  hairStyle: 'short' | 'long' | 'bun'
  hatColor: string
  glasses: boolean
}

export interface AvatarRect {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

export const AVATARS: AvatarPreset[] = [
  {
    id: 'red-cap',
    name: '红帽少年',
    skin: '#f0c39a',
    hair: '#3b2a20',
    shirt: '#3b5ba7',
    hat: 'cap',
    hairStyle: 'short',
    hatColor: '#e3350d',
    glasses: false,
  },
  {
    id: 'blue-cap',
    name: '蓝帽少女',
    skin: '#f7d3b0',
    hair: '#241b16',
    shirt: '#fffdf4',
    hat: 'cap',
    hairStyle: 'long',
    hatColor: '#3b5ba7',
    glasses: false,
  },
  {
    id: 'short-hair',
    name: '短发训练家',
    skin: '#d9a273',
    hair: '#2b2420',
    shirt: '#4ea93b',
    hat: 'none',
    hairStyle: 'short',
    hatColor: '#4ea93b',
    glasses: false,
  },
  {
    id: 'long-hair',
    name: '长发研究员',
    skin: '#f0c39a',
    hair: '#6b4423',
    shirt: '#7b5cc4',
    hat: 'none',
    hairStyle: 'long',
    hatColor: '#7b5cc4',
    glasses: false,
  },
  {
    id: 'glasses',
    name: '眼镜学者',
    skin: '#e8b98c',
    hair: '#8d8175',
    shirt: '#c2b49a',
    hat: 'none',
    hairStyle: 'short',
    hatColor: '#c2b49a',
    glasses: true,
  },
  {
    id: 'beanie',
    name: '针织帽',
    skin: '#f7d3b0',
    hair: '#241b16',
    shirt: '#e3350d',
    hat: 'beanie',
    hairStyle: 'short',
    hatColor: '#ffcb05',
    glasses: false,
  },
  {
    id: 'straw',
    name: '草帽旅人',
    skin: '#d9a273',
    hair: '#d9b26a',
    shirt: '#2bb3c0',
    hat: 'straw',
    hairStyle: 'long',
    hatColor: '#e6c87a',
    glasses: false,
  },
  {
    id: 'pink-long',
    name: '粉发少女',
    skin: '#f7d3b0',
    hair: '#e58fb1',
    shirt: '#fffdf4',
    hat: 'none',
    hairStyle: 'long',
    hatColor: '#e58fb1',
    glasses: false,
  },
  {
    id: 'silver-glasses',
    name: '银发学者',
    skin: '#e8b98c',
    hair: '#cfd3d8',
    shirt: '#3b5ba7',
    hat: 'none',
    hairStyle: 'short',
    hatColor: '#3b5ba7',
    glasses: true,
  },
  {
    id: 'blond-bun',
    name: '金发研究员',
    skin: '#f0c39a',
    hair: '#e6c87a',
    shirt: '#4ea93b',
    hat: 'none',
    hairStyle: 'bun',
    hatColor: '#4ea93b',
    glasses: true,
  },
  {
    id: 'dark-athlete',
    name: '深肤运动员',
    skin: '#8d5a3b',
    hair: '#241b16',
    shirt: '#e3350d',
    hat: 'none',
    hairStyle: 'short',
    hatColor: '#e3350d',
    glasses: false,
  },
  {
    id: 'forest-hood',
    name: '森林兜帽',
    skin: '#d9a273',
    hair: '#2b2420',
    shirt: '#2f6b3a',
    hat: 'hood',
    hairStyle: 'short',
    hatColor: '#3f8a4f',
    glasses: false,
  },
  {
    id: 'purple-beanie',
    name: '紫帽训练家',
    skin: '#f0c39a',
    hair: '#6b4423',
    shirt: '#7b5cc4',
    hat: 'beanie',
    hairStyle: 'bun',
    hatColor: '#7b5cc4',
    glasses: false,
  },
  {
    id: 'orange-cap',
    name: '橙帽少女',
    skin: '#f7d3b0',
    hair: '#241b16',
    shirt: '#f0a03a',
    hat: 'cap',
    hairStyle: 'long',
    hatColor: '#e07a1f',
    glasses: false,
  },
  {
    id: 'teal-straw',
    name: '青帽旅人',
    skin: '#c98f63',
    hair: '#3b2a20',
    shirt: '#2bb3c0',
    hat: 'straw',
    hairStyle: 'short',
    hatColor: '#8fd3d9',
    glasses: false,
  },
]

export const AVATAR_SIZE = 24

const S = AVATAR_SIZE
const OUTLINE = '#2b2420'

type Grid = Uint8Array
const EMPTY = 0
const SKIN = 1
const HAIR = 2
const SHIRT = 3
const HAT = 4
const DARK = 5
const WHITE = 6
const SHADE_SHIRT = 7
const SHADE_HAT = 8

function grid(): Grid {
  return new Uint8Array(S * S)
}

function px(g: Grid, x: number, y: number, v: number) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= S || iy >= S) return
  g[iy * S + ix] = v
}

function at(g: Grid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= S || y >= S) return 0
  return g[y * S + x]
}

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, v: number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(g, x, y, v)
    }
  }
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, v: number) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) px(g, x, y, v)
  }
}

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
        g[y * S + x] = DARK
      }
    }
  }
}

function drawBackHair(g: Grid, preset: AvatarPreset) {
  if (preset.hat === 'hood') {
    ellipse(g, 12, 10, 7.4, 7.6, HAT)
    return
  }
  if (preset.hairStyle === 'long') {
    ellipse(g, 12, 8.5, 6.2, 5.4, HAIR)
    rect(g, 5, 9, 6, 17, HAIR)
    rect(g, 17, 9, 18, 17, HAIR)
  }
  if (preset.hairStyle === 'bun') {
    ellipse(g, 12, 3.2, 2.6, 2.4, HAIR)
  }
}

function drawBody(g: Grid) {
  // 肩膀
  for (let y = 16; y <= 23; y += 1) {
    const half = 5 + (y - 16) * 0.55
    rect(g, 12 - half, y, 11 + half, y, SHIRT)
  }
  // 领口
  rect(g, 10, 16, 13, 18, SHADE_SHIRT)
  // 脖子
  rect(g, 10.5, 13, 13.5, 16, SKIN)
}

function drawHead(g: Grid, preset: AvatarPreset) {
  ellipse(g, 12, 9.6, 5.3, 5.6, SKIN)
  // 头发（额前）
  if (preset.hat === 'none' || preset.hat === 'beanie') {
    ellipse(g, 12, 6.4, 5.5, 3.2, HAIR)
    rect(g, 6.6, 6, 7.6, 10, HAIR)
    rect(g, 16.4, 6, 17.4, 10, HAIR)
  }
}

function drawHat(g: Grid, preset: AvatarPreset) {
  if (preset.hat === 'cap') {
    ellipse(g, 12, 6.2, 5.7, 3.2, HAT)
    rect(g, 5.2, 8, 18.8, 9, HAT)
    rect(g, 5.2, 9, 18.8, 9, SHADE_HAT)
  } else if (preset.hat === 'beanie') {
    ellipse(g, 12, 5.4, 5.6, 3.4, HAT)
    rect(g, 6.2, 7.6, 17.8, 9, SHADE_HAT)
  } else if (preset.hat === 'straw') {
    ellipse(g, 12, 5.8, 5.6, 3.0, HAT)
    rect(g, 4.2, 7.4, 19.8, 8.8, HAT)
    rect(g, 5.6, 8.2, 18.4, 8.8, SHADE_HAT)
  } else if (preset.hat === 'hood') {
    // 兜帽：先铺一圈帽檐，再把脸露出来
    ellipse(g, 12, 10, 5.6, 6, SHADE_HAT)
    ellipse(g, 12, 10.4, 4.2, 4.6, SKIN)
  }
}

function drawFace(g: Grid, preset: AvatarPreset) {
  // 眼睛
  px(g, 9, 10, DARK)
  px(g, 9, 11, DARK)
  px(g, 14, 10, DARK)
  px(g, 14, 11, DARK)
  px(g, 9, 10, DARK)
  // 高光
  px(g, 10, 10, WHITE)
  px(g, 15, 10, WHITE)
  // 嘴
  px(g, 11, 13, DARK)
  px(g, 12, 13, DARK)

  if (preset.glasses) {
    rect(g, 7.5, 9.6, 10.5, 9.6, DARK)
    rect(g, 13.5, 9.6, 16.5, 9.6, DARK)
    px(g, 12, 9.6, DARK)
    px(g, 7.5, 11.4, DARK)
    px(g, 10.5, 11.4, DARK)
    px(g, 13.5, 11.4, DARK)
    px(g, 16.5, 11.4, DARK)
  }
}

function darken(hex: string, factor = 0.72): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) return hex
  const num = Number.parseInt(value, 16)
  const r = Math.round(((num >> 16) & 255) * factor)
  const g = Math.round(((num >> 8) & 255) * factor)
  const b = Math.round((num & 255) * factor)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function colorOf(v: number, preset: AvatarPreset): string | null {
  switch (v) {
    case SKIN:
      return preset.skin
    case HAIR:
      return preset.hair
    case SHIRT:
      return preset.shirt
    case HAT:
      return preset.hatColor
    case SHADE_SHIRT:
      return darken(preset.shirt)
    case SHADE_HAT:
      return darken(preset.hatColor, 0.62)
    case DARK:
      return OUTLINE
    case WHITE:
      return '#fffdf4'
    default:
      return null
  }
}

const cache = new Map<string, AvatarRect[]>()

export function buildAvatar(preset: AvatarPreset): AvatarRect[] {
  const hit = cache.get(preset.id)
  if (hit) return hit

  const g = grid()
  drawBackHair(g, preset)
  drawBody(g)
  drawHead(g, preset)
  drawHat(g, preset)
  drawFace(g, preset)
  outline(g)

  const rects: AvatarRect[] = []
  for (let y = 0; y < S; y += 1) {
    let run: AvatarRect | null = null
    for (let x = 0; x < S; x += 1) {
      const fill = colorOf(at(g, x, y), preset)
      if (fill && run && run.fill === fill) {
        run.w += 1
      } else {
        if (run) rects.push(run)
        run = fill ? { x, y, w: 1, h: 1, fill } : null
      }
    }
    if (run) rects.push(run)
  }

  cache.set(preset.id, rects)
  return rects
}
