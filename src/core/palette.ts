export interface SpritePalette {
  base: string
  light: string
  dark: string
  accent: string
}

/** 精灵配色按 arXiv 一级领域分，不再用宝可梦属性名 */
const PALETTES: Record<string, SpritePalette> = {
  blue: { base: '#5f8ee8', light: '#8fb4f5', dark: '#3f66b8', accent: '#8fb4f5' },
  teal: { base: '#3fb3b8', light: '#7fd6da', dark: '#2a8286', accent: '#7fd6da' },
  purple: { base: '#a97fe0', light: '#c9a9f2', dark: '#7b57b3', accent: '#c9a9f2' },
  indigo: { base: '#7b5ad1', light: '#a488ea', dark: '#553aa3', accent: '#a488ea' },
  rose: { base: '#e0708f', light: '#f2a3b8', dark: '#b04a67', accent: '#f2a3b8' },
  gold: { base: '#e0b23f', light: '#f5d479', dark: '#b3862a', accent: '#f5d479' },
  green: { base: '#6fbe57', light: '#9ad989', dark: '#4a8f3a', accent: '#9ad989' },
  steel: { base: '#9fb0c2', light: '#c4d2df', dark: '#6f8093', accent: '#c4d2df' },
  crimson: { base: '#d9644a', light: '#f0927c', dark: '#a8432d', accent: '#f0927c' },
  slate: { base: '#8c94a8', light: '#b4bccd', dark: '#626a7d', accent: '#b4bccd' },
}

const CODE_PALETTE: Record<string, keyof typeof PALETTES> = {
  'cs.RO': 'blue',
  'cs.CV': 'teal',
  'cs.LG': 'purple',
  'cs.AI': 'indigo',
  'cs.CL': 'rose',
  'cs.MA': 'slate',
  'cs.CR': 'crimson',
  'cs.DB': 'steel',
  'cs.IR': 'gold',
  'cs.HC': 'gold',
  'cs.GR': 'teal',
  'cs.SD': 'teal',
  'stat.ML': 'purple',
  'stat.ME': 'slate',
  'eess.SY': 'gold',
  'eess.AS': 'teal',
  'eess.IV': 'teal',
  'eess.SP': 'gold',
  'math.OC': 'slate',
}

const PREFIX_PALETTE: Array<[string, keyof typeof PALETTES]> = [
  ['cs.', 'steel'],
  ['stat.', 'purple'],
  ['eess.', 'gold'],
  ['math.', 'slate'],
  ['econ.', 'gold'],
  ['q-fin.', 'gold'],
  ['q-bio.', 'green'],
  ['astro-ph.', 'indigo'],
  ['cond-mat.', 'steel'],
  ['gr-qc', 'purple'],
  ['hep-', 'crimson'],
  ['math-ph', 'purple'],
  ['nlin.', 'slate'],
  ['nucl-', 'crimson'],
  ['physics.', 'steel'],
  ['quant-ph', 'indigo'],
]

export function paletteForCategory(code: string | undefined | null): SpritePalette {
  if (code) {
    const exact = CODE_PALETTE[code]
    if (exact) return PALETTES[exact]
    for (const [prefix, key] of PREFIX_PALETTE) {
      if (code.startsWith(prefix)) return PALETTES[key]
    }
  }
  return PALETTES.steel
}

export function categoryChipColor(code: string | undefined | null): string {
  const palette = paletteForCategory(code)
  return palette.dark
}


/* ------------------------------------------------------------ variation */

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 1) + 1) % 1
  const sat = Math.min(1, Math.max(0, s))
  const lig = Math.min(1, Math.max(0, l))
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat
  const p = 2 * lig - q
  const channel = (t: number) => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(channel(hue + 1 / 3))}${toHex(channel(hue))}${toHex(channel(hue - 1 / 3))}`
}

/** 同一分类内，按 arXiv 号做 ±10° 色相与少量明度偏移，避免千篇一律 */
export function paletteVariant(palette: SpritePalette, seed: string): SpritePalette {
  const h = hashSeed(seed || 'anonymous')
  const shift = ((h % 21) - 10) / 360
  const satDelta = (((h >> 8) % 9) - 4) / 100
  const lightDelta = (((h >> 16) % 9) - 4) / 100

  const shiftColor = (hex: string, extraLight = 0): string => {
    const [r, g, b] = hexToRgb(hex)
    const [hue, sat, light] = rgbToHsl(r, g, b)
    return hslToHex(hue + shift, sat + satDelta, light + lightDelta + extraLight)
  }

  return {
    base: shiftColor(palette.base),
    light: shiftColor(palette.light, 0.03),
    dark: shiftColor(palette.dark, -0.03),
    accent: shiftColor(palette.accent, 0.02),
  }
}
