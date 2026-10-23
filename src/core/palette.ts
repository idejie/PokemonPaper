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
