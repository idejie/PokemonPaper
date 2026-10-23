import type { Paper } from './types'

export type MoveKind = 'attack' | 'special' | 'status' | 'defense'

export interface Move {
  name: string
  kind: MoveKind
  power: number
}

interface Rule {
  re: RegExp
  name: string
  kind: MoveKind
}

const RULES: Rule[] = [
  { re: /\battention\b/i, name: 'Attention Beam', kind: 'special' },
  { re: /\btransformer\b/i, name: 'Transformer Shift', kind: 'status' },
  { re: /\bdiffusion\b/i, name: 'Diffusion Burst', kind: 'special' },
  { re: /\breinforcement learning\b|\brl\b/i, name: 'Reward Rush', kind: 'attack' },
  { re: /\brlhf\b/i, name: 'RLHF Aura', kind: 'status' },
  { re: /\bimitation\b/i, name: 'Imitation Mimic', kind: 'status' },
  { re: /\bcontrastive\b/i, name: 'Contrastive Clash', kind: 'attack' },
  { re: /\bdistill/i, name: 'Distill Drain', kind: 'special' },
  { re: /\bquantiz/i, name: 'Quantize Quake', kind: 'attack' },
  { re: /\bprun/i, name: 'Prune Slash', kind: 'attack' },
  { re: /\bfederated\b/i, name: 'Federated Guard', kind: 'defense' },
  { re: /\bgraph\b|\bgnn\b/i, name: 'Graph Bind', kind: 'status' },
  { re: /\bgan\b|\badversarial\b/i, name: 'Adversarial Feint', kind: 'special' },
  { re: /\bvae\b|\blatent\b/i, name: 'Latent Veil', kind: 'status' },
  { re: /\bflow matching\b|\bnormalizing flow\b/i, name: 'Flow Charge', kind: 'special' },
  { re: /\bnerf\b/i, name: 'NeRF Phantom', kind: 'special' },
  { re: /\bgaussian splat/i, name: 'Splat Scatter', kind: 'special' },
  { re: /\bslam\b/i, name: 'SLAM Step', kind: 'status' },
  { re: /\blidar\b/i, name: 'LiDAR Sweep', kind: 'attack' },
  { re: /\bpoint cloud\b/i, name: 'Point Cloud Puff', kind: 'special' },
  { re: /\bllm\b|large language model/i, name: 'LLM Roar', kind: 'special' },
  { re: /\bmultimodal\b/i, name: 'Multimodal Mix', kind: 'status' },
  { re: /\bretrieval\b|\brag\b/i, name: 'Retrieval Rope', kind: 'status' },
  { re: /\blora\b|fine-?tun/i, name: 'LoRA Lash', kind: 'attack' },
  { re: /\bbenchmark\b/i, name: 'Benchmark Bash', kind: 'attack' },
  { re: /\bdataset\b/i, name: 'Dataset Dig', kind: 'status' },
  { re: /\bscaling law\b|\bscaling\b/i, name: 'Scaling Surge', kind: 'status' },
  { re: /\bworld model\b/i, name: 'World Weave', kind: 'special' },
  { re: /\bembodied\b/i, name: 'Embodied Stomp', kind: 'attack' },
  { re: /\bhumanoid\b/i, name: 'Humanoid Hop', kind: 'attack' },
  { re: /\bmanipulat/i, name: 'Grasp Grip', kind: 'attack' },
  { re: /\bnavigation\b/i, name: 'Nav Dash', kind: 'status' },
  { re: /\bplanning\b|\bplanner\b/i, name: 'Plan Pulse', kind: 'status' },
  { re: /\bcontrol\b|\bmpc\b/i, name: 'Control Lock', kind: 'defense' },
  { re: /\bbayesian\b/i, name: 'Bayes Blessing', kind: 'status' },
  { re: /\boptimi[sz]/i, name: 'Gradient Grind', kind: 'attack' },
  { re: /\bsafety\b|\brobust/i, name: 'Safety Shield', kind: 'defense' },
  { re: /\breasoning\b/i, name: 'Reason Ray', kind: 'special' },
  { re: /\bagent/i, name: 'Agent Ambush', kind: 'attack' },
  { re: /\bzero-?shot\b|\bfew-?shot\b/i, name: 'Zero-Shot Zap', kind: 'special' },
  { re: /\bprompt/i, name: 'Prompt Poke', kind: 'status' },
  { re: /\bvideo\b/i, name: 'Frame Flurry', kind: 'special' },
  { re: /\bspeech\b|\baudio\b/i, name: 'Audio Echo', kind: 'special' },
  { re: /\bprotein\b|\bbiomed/i, name: 'Bio Bloom', kind: 'status' },
  { re: /\bquantum\b|\bqubit\b/i, name: 'Qubit Quake', kind: 'special' },
]

const FILLERS: Rule[] = [
  { re: /$^/, name: 'Tackle', kind: 'attack' },
  { re: /$^/, name: 'Focus', kind: 'status' },
  { re: /$^/, name: 'Guard', kind: 'defense' },
  { re: /$^/, name: 'Quick Step', kind: 'status' },
]

function hash(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function movesFor(
  paper: Pick<Paper, 'arxiv' | 'title' | 'abstract' | 'tags'>,
): Move[] {
  const title = paper.title || ''
  const tags = paper.tags || ''
  const abstract = paper.abstract || ''
  const scored = RULES.map((rule) => {
    let score = 0
    if (rule.re.test(title)) score += 4
    if (rule.re.test(tags)) score += 3
    if (rule.re.test(abstract)) score += 1
    return { rule, score }
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.rule.name.localeCompare(b.rule.name))

  const picked = scored.slice(0, 4).map((entry) => entry.rule)
  const seed = hash(paper.arxiv || title)
  let offset = seed % FILLERS.length
  while (picked.length < 4) {
    const filler = FILLERS[offset % FILLERS.length]
    if (!picked.some((rule) => rule.name === filler.name)) picked.push(filler)
    offset += 1
  }

  return picked.map((rule, index) => ({
    name: rule.name,
    kind: rule.kind,
    power: 40 + ((seed + index * 17 + hash(rule.name)) % 60),
  }))
}

export const MOVE_ICON: Record<MoveKind, string> = {
  attack: '⚔️',
  special: '✨',
  status: '🌀',
  defense: '🛡️',
}
