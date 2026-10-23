import type { Paper } from './types'
import { SPRITE_SIZE, buildSprite } from './sprite'
import { AVATARS, AVATAR_SIZE, buildAvatar, decodeAvatar } from './avatar'
import { paperLevel, TIER_COLORS, type Tier } from './level'
import { categoryChipColor } from './palette'
import { movesFor } from './moves'
import QRCode from 'qrcode'

export interface ShareCardInput {
  paper: Paper
  trainer: string
  avatarId: string
  locale: 'zh' | 'en'
}

const W = 640
const H = 900
const SCALE = 2
const INK = '#2b2420'
const PAPER = '#f7f1df'
const PANEL = '#efe6cf'
const DIM = '#7a6f5c'

const FONT = '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", system-ui, sans-serif'
const MONO = '"SF Mono", "JetBrains Mono", ui-monospace, monospace'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  const tokens = /\s/.test(text) ? text.split(/(\s+)/).filter(Boolean) : Array.from(text)
  for (const token of tokens) {
    if (token === '\n') {
      lines.push(line)
      line = ''
      if (lines.length >= maxLines) break
      continue
    }
    const test = line + token
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = token.trimStart()
      if (lines.length >= maxLines) break
      // a single word wider than the line: break it by characters
      while (line && ctx.measureText(line).width > maxWidth) {
        let cut = line.length - 1
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
        if (lines.length >= maxLines) break
      }
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    if (last !== lines[maxLines - 1]) lines[maxLines - 1] = `${last}…`
  }
  return lines
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1)
  return `${out}…`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'same-origin'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = url
  })
}

async function drawSprite(
  ctx: CanvasRenderingContext2D,
  paper: Paper,
  x: number,
  y: number,
  size: number,
) {
  if (paper.spriteUrl) {
    try {
      const image = await loadImage(paper.spriteUrl)
      const ratio = Math.min(size / image.width, size / image.height)
      const w = image.width * ratio
      const h = image.height * ratio
      ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h)
      return
    } catch {
      /* fall back to procedural sprite */
    }
  }

  const rects = buildSprite(
    paper.arxiv || paper.title,
    paper.primaryCategory,
    paper.status === 'unread',
  )
  const box = SPRITE_SIZE + 4
  const unit = size / box
  for (const rect of rects) {
    ctx.fillStyle = rect.fill
    ctx.fillRect(
      x + (rect.x + 2) * unit,
      y + (rect.y + 2) * unit,
      rect.w * unit,
      rect.h * unit,
    )
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  avatarId: string,
  x: number,
  y: number,
  size: number,
) {
  const preset = AVATARS.find((item) => item.id === avatarId) ?? decodeAvatar(avatarId) ?? AVATARS[0]
  const rects = buildAvatar(preset)
  const unit = size / AVATAR_SIZE
  ctx.fillStyle = '#fffdf4'
  ctx.fillRect(x, y, size, size)
  for (const rect of rects) {
    ctx.fillStyle = rect.fill
    ctx.fillRect(x + rect.x * unit, y + rect.y * unit, rect.w * unit, rect.h * unit)
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, size, size)
}

const TIER_EN: Record<Tier, string> = {
  常见: 'Common',
  稀有: 'Rare',
  史诗: 'Epic',
  传说: 'Legendary',
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const { paper, trainer, avatarId, locale } = input
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.scale(SCALE, SCALE)

  const zh = locale === 'zh'
  const level = paperLevel(paper)
  const category = paper.primaryCategory || 'arXiv'
  const status =
    paper.status === 'read'
      ? zh
        ? '已点亮'
        : 'Read'
      : paper.status === 'reading'
        ? zh
          ? '在读'
          : 'Reading'
        : zh
          ? '未点亮'
          : 'Unread'

  // paper background + dot grid
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(43, 36, 32, 0.07)'
  for (let x = 16; x < W; x += 22) {
    for (let y = 16; y < H; y += 22) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // frame
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  roundRect(ctx, 20, 20, W - 40, H - 40, 18)
  ctx.stroke()

  // header
  ctx.fillStyle = '#f2c14e'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(56, 62, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(56, 62, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `800 19px ${FONT}`
  ctx.fillText('PokemonPaper', 78, 60)
  ctx.font = `700 9px ${MONO}`
  ctx.fillStyle = DIM
  ctx.fillText('PAPER DEX', 78, 74)

  ctx.font = `700 13px ${MONO}`
  ctx.fillStyle = DIM
  ctx.textAlign = 'right'
  ctx.fillText(paper.arxiv ? `No.${paper.arxiv}` : 'No.------', W - 48, 62)
  ctx.textAlign = 'left'

  // sprite frame
  const frameX = 64
  const frameY = 104
  const frameW = W - 128
  const frameH = 330
  ctx.fillStyle = PANEL
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  roundRect(ctx, frameX, frameY, frameW, frameH, 14)
  ctx.fill()
  ctx.stroke()

  await drawSprite(ctx, paper, frameX + 16, frameY + 14, frameH - 28)

  // chips
  const chipY = frameY + frameH + 24
  ctx.font = `800 13px ${FONT}`
  const categoryWidth = ctx.measureText(category).width + 26
  ctx.fillStyle = categoryChipColor(paper.primaryCategory)
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  roundRect(ctx, 64, chipY, categoryWidth, 28, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fffdf4'
  ctx.fillText(category, 77, chipY + 19)

  ctx.font = `800 13px ${MONO}`
  const levelText = `Lv.${level.level}`
  const levelWidth = ctx.measureText(levelText).width + 24
  ctx.fillStyle = TIER_COLORS[level.tier]
  roundRect(ctx, 64 + categoryWidth + 10, chipY, levelWidth, 28, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fffdf4'
  ctx.fillText(levelText, 64 + categoryWidth + 22, chipY + 19)

  ctx.fillStyle = DIM
  ctx.font = `700 12px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(status, W - 64, chipY + 19)
  ctx.textAlign = 'left'

  // title
  ctx.fillStyle = INK
  ctx.font = `800 31px ${FONT}`
  const titleLines = wrap(ctx, paper.title || 'Untitled paper', frameW, 3)
  let titleY = chipY + 64
  for (const line of titleLines) {
    ctx.fillText(line, 64, titleY)
    titleY += 40
  }

  // authors + stats
  ctx.fillStyle = DIM
  ctx.font = `500 14px ${FONT}`
  ctx.fillText(clipText(ctx, paper.authors || '', frameW), 64, titleY + 14)

  const statsY = titleY + 52
  ctx.font = `700 14px ${FONT}`
  ctx.fillStyle = INK
  ctx.fillText(`★ ${paper.stars >= 1000 ? `${(paper.stars / 1000).toFixed(1)}k` : paper.stars || 0}`, 64, statsY)
  const notesLabel = paper.notes
    ? zh
      ? `✎ ${paper.notes.length} 字笔记`
      : `✎ ${paper.notes.length} chars`
    : zh
      ? '✎ 无笔记'
      : '✎ No notes'
  ctx.fillText(clipText(ctx, notesLabel, 150), 170, statsY)
  if (level.tier) {
    ctx.fillStyle = TIER_COLORS[level.tier]
    ctx.fillText(zh ? level.tier : TIER_EN[level.tier], 280, statsY)
  }
  ctx.fillStyle = DIM
  ctx.font = `600 12px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toISOString().slice(0, 10), W - 64, statsY)
  ctx.textAlign = 'left'

  // moves
  const moves = movesFor({
    arxiv: paper.arxiv,
    title: paper.title,
    abstract: paper.abstract,
    tags: paper.tags,
  })
  ctx.fillStyle = DIM
  ctx.font = `700 9px ${MONO}`
  ctx.fillText(zh ? '招式' : 'MOVES', 64, statsY + 22)
  let moveX = 64
  const moveY = statsY + 28
  for (const move of moves) {
    ctx.font = `700 9.5px ${FONT}`
    const label = `${move.name} ${move.power}`
    const width = ctx.measureText(label).width + 14
    if (moveX + width > W - 64) break
    ctx.fillStyle = '#efe6cf'
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    roundRect(ctx, moveX, moveY, width, 20, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.fillText(label, moveX + 7, moveY + 13.5)
    moveX += width + 6
  }

  // divider
  ctx.strokeStyle = 'rgba(43, 36, 32, 0.35)'
  ctx.lineWidth = 2
  ctx.setLineDash([7, 7])
  ctx.beginPath()
  ctx.moveTo(64, 748)
  ctx.lineTo(W - 64, 748)
  ctx.stroke()
  ctx.setLineDash([])

  // trainer
  drawAvatar(ctx, avatarId, 64, 776, 52)
  ctx.fillStyle = DIM
  ctx.font = `700 10px ${MONO}`
  ctx.fillText(zh ? '训练家' : 'TRAINER', 130, 792)
  ctx.fillStyle = INK
  ctx.font = `800 20px ${FONT}`
  ctx.fillText(clipText(ctx, trainer || 'Trainer', 260), 130, 814)

  ctx.fillStyle = DIM
  ctx.font = `600 11px ${FONT}`
  ctx.fillText(
    zh ? 'arXiv 编号 = 图鉴编号 · 读完点亮' : 'arXiv ID = dex number · read to light up',
    64,
    840,
  )

  // QR code for scanning back into the app
  if (paper.arxiv) {
    try {
      const qr = document.createElement('canvas')
      await QRCode.toCanvas(qr, `PP1:${paper.arxiv}:${paper.primaryCategory || ''}`, {
        width: 168,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#2b2420', light: '#f7f1df' },
      })
      ctx.drawImage(qr, W - 64 - 84, 754, 84, 84)
      ctx.fillStyle = DIM
      ctx.font = `700 8px ${MONO}`
      ctx.textAlign = 'right'
      ctx.fillText(zh ? '扫码导入' : 'SCAN TO IMPORT', W - 64, 852)
      ctx.textAlign = 'left'
    } catch {
      /* QR is optional */
    }
  }

  // footer
  ctx.fillStyle = DIM
  ctx.font = `600 10px ${MONO}`
  ctx.fillText('PokemonPaper · paper dex', 64, 870)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('toBlob failed'))
    }, 'image/png')
  })
}

export async function downloadShareCard(input: ShareCardInput) {
  const blob = await renderShareCard(input)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${input.paper.arxiv || 'paper'}-card.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
