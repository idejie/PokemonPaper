let ctx: AudioContext | null = null

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

/** Deterministic 3–5 note 8-bit cry; same arXiv ID always sounds the same. */
export function playCry(seed: string, enabled = true) {
  if (!enabled || !seed) return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!ctx) ctx = new Ctx()
    if (ctx.state === 'suspended') void ctx.resume()

    const h = hash(seed)
    const rnd = rng(h)
    const notes = 3 + (h % 3)
    const base = 240 + (h % 180)
    const now = ctx.currentTime + 0.01
    const master = ctx.createGain()
    master.gain.value = 0.07
    master.connect(ctx.destination)

    for (let i = 0; i < notes; i += 1) {
      const start = now + i * 0.085
      const end = start + 0.1
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const freq = base * (1 + Math.floor(rnd() * 6) / 12) * (i === notes - 1 ? 0.72 : 1)
      osc.type = i % 2 === 0 ? 'square' : 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      osc.frequency.exponentialRampToValueAtTime(freq * (i % 2 === 0 ? 0.78 : 1.32), end)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(gain)
      gain.connect(master)
      osc.start(start)
      osc.stop(end + 0.02)
    }

    window.setTimeout(
      () => {
        try {
          master.disconnect()
        } catch {
          /* already gone */
        }
      },
      (notes * 0.085 + 0.3) * 1000,
    )
  } catch {
    /* audio blocked or unsupported */
  }
}
