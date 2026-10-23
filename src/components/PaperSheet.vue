<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PaperSprite from './PaperSprite.vue'
import { api } from '../core/api'
import { usePapersStore } from '../stores/papers'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { usePrefsStore } from '../stores/prefs'
import { useAuthStore } from '../stores/auth'
import { categoryChipColor } from '../core/palette'
import { TIER_COLORS, paperLevel } from '../core/level'
import { ARXIV_CATEGORIES } from '../core/arxivTaxonomy'
import { arxivAbsUrl, parseArxivId } from '../core/arxiv'
import { t, locale } from '../core/i18n'
import { downloadShareCard } from '../core/shareCard'
import { playCry } from '../core/cry'
import { SHINY_LABEL, shinyOf } from '../core/shiny'
import { MOVE_ICON, movesFor } from '../core/moves'
import { bondOf, bondStats, recordVisit, type BondInfo } from '../core/bond'
import type { Explain, Paper, PaperStatus } from '../core/types'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const store = usePapersStore()
const settings = useSettingsStore()
const ui = useUiStore()
const auth = useAuthStore()
const prefs = usePrefsStore()

const currentYear = new Date().getFullYear()
const form = reactive({
  arxiv: '',
  title: '',
  authors: '',
  venue: '',
  year: currentYear as number | null,
  status: 'unread' as PaperStatus,
  rating: 0,
  tags: '',
  notes: '',
  abstract: '',
  primaryCategory: '',
  codeUrl: '',
  stars: 0,
})

const saving = ref(false)
const fetching = ref(false)
const pdfBusy = ref(false)
const spriteBusy = ref(false)
const cardBusy = ref(false)
const bond = ref<BondInfo | null>(null)
const dexBusy = ref(false)
const tradeOpen = ref(false)
const tradeEmail = ref('')
const tradeBusy = ref(false)
const inParty = computed(() => store.party.some((member) => member.id === props.id))
const inEgg = computed(() => Boolean(paper.value?.eggAt))
const moves = computed(() => movesFor({ arxiv: form.arxiv, title: form.title, abstract: form.abstract, tags: form.tags }))
const shinyInfo = computed(() =>
  shinyOf({ arxiv: form.arxiv, venue: form.venue, stars: form.stars, year: form.year }),
)
const stageName = computed(() => {
  if (form.status === 'unread') return '幼体'
  if (form.status === 'reading') return '成长体'
  return form.notes.trim() ? '羁绊形态' : '完全体'
})
const explaining = ref(false)
const syncing = ref(false)

const creating = computed(() => !props.id)
const paper = computed(() => (props.id ? store.byId(props.id) : undefined))
const missing = computed(() => !creating.value && !store.loading && !paper.value)
const seed = computed(() => form.arxiv || form.title || 'pokemonpaper-new')
const catColor = computed(() => categoryChipColor(form.primaryCategory))

const level = computed(() => paperLevel({ codeUrl: form.codeUrl, stars: form.stars }))

const explainData = computed<Explain | null>(() => {
  const raw = paper.value?.explain
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Explain
    return parsed && parsed.oneLiner ? parsed : null
  } catch {
    return null
  }
})

function apply(entry: Paper) {
  form.arxiv = entry.arxiv
  form.title = entry.title
  form.authors = entry.authors
  form.venue = entry.venue
  form.year = entry.year ?? currentYear
  form.status = entry.status
  form.rating = entry.rating
  form.tags = entry.tags
  form.notes = entry.notes
  form.abstract = entry.abstract
  form.primaryCategory = entry.primaryCategory
  form.codeUrl = entry.codeUrl
  form.stars = entry.stars
}

watch(
  paper,
  (entry) => {
    if (entry) apply(entry)
  },
  { immediate: true },
)

function onArxivInput() {
  const parsed = parseArxivId(form.arxiv)
  if (parsed && parsed !== form.arxiv) form.arxiv = parsed
}

function setStatus(status: PaperStatus) {
  form.status = status
}

function setRating(value: number) {
  form.rating = form.rating === value ? 0 : value
}

function payload() {
  return {
    arxiv: form.arxiv.trim(),
    title: form.title.trim(),
    authors: form.authors.trim(),
    venue: form.venue.trim(),
    year: form.year ? Number(form.year) : null,
    status: form.status,
    rating: form.rating,
    tags: form.tags.trim(),
    notes: form.notes,
    abstract: form.abstract.trim(),
    primaryCategory: form.primaryCategory,
    categories: form.primaryCategory ? [form.primaryCategory] : [],
    codeUrl: form.codeUrl.trim(),
    stars: Number(form.stars) || 0,
    url: form.arxiv ? arxivAbsUrl(form.arxiv.trim()) : '',
  }
}

async function fetchMeta() {
  const id = parseArxivId(form.arxiv)
  if (!id) {
    store.notify(t('先填一个 arXiv 编号或链接'))
    return
  }
  fetching.value = true
  try {
    const [item] = await api.previewArxiv([id])
    if (!item) {
      store.notify(t('arXiv 上没找到这篇'))
      return
    }
    form.arxiv = item.arxiv
    form.title = item.title || form.title
    form.authors = item.authors || form.authors
    form.venue = item.venue || form.venue
    form.year = item.year ?? form.year
    form.abstract = item.abstract || form.abstract
    form.primaryCategory = item.primaryCategory || item.category || form.primaryCategory
    store.notify(t('已抓取元数据'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('抓取失败'))
  } finally {
    fetching.value = false
  }
}

async function save() {
  if (!form.title.trim()) {
    store.notify(t('标题不能为空'))
    return
  }
  saving.value = true
  try {
    if (creating.value) {
      const created = await store.create({ ...payload(), title: form.title.trim() })
      if (created) close()
    } else if (props.id) {
      const before = paper.value?.status
      const wasEgg = Boolean(paper.value?.eggAt)
      const hatching = before !== 'read' && form.status === 'read' && wasEgg
      const updated = await store.update(props.id, {
        ...payload(),
        ...(hatching ? { eggAt: null, incubatedAt: null } : {}),
      })
      if (updated) {
        if (before !== 'read' && updated.status === 'read') {
          playCry(updated.arxiv || updated.id, prefs.cryEnabled)
        }
        if (hatching) store.notify(t('🥚 破壳！No.{id}', { id: updated.arxiv || '—' }))
        else store.notify(t('已保存'))
        close()
      }
    }
  } finally {
    saving.value = false
  }
}

async function markLit() {
  form.status = 'read'
  if (creating.value) {
    await save()
    return
  }
  if (!props.id) return
  const wasRead = paper.value?.status === 'read'
  const wasEgg = Boolean(paper.value?.eggAt)
  const updated = await store.update(props.id, {
    ...payload(),
    status: 'read',
    readAt: new Date().toISOString(),
    ...(wasEgg ? { eggAt: null, incubatedAt: null } : {}),
  })
  if (updated) {
    if (!wasRead) playCry(updated.arxiv || updated.id, prefs.cryEnabled)
    store.notify(
      wasEgg
        ? t('🥚 破壳！No.{id}', { id: updated.arxiv || '—' })
        : t('No.{id} 已点亮！', { id: updated.arxiv || '—' }),
    )
    close()
  }
}

async function openPdf() {
  if (!props.id) return
  pdfBusy.value = true
  const updated = await store.ensurePdf(props.id)
  pdfBusy.value = false
  if (updated) window.open(api.pdfUrl(props.id), '_blank', 'noopener')
}

async function syncMetrics() {
  if (!props.id) {
    store.notify(t('先保存这篇论文，再同步指标'))
    return
  }
  syncing.value = true
  try {
    // 先把仓库地址存下来，服务端才能读到
    await store.update(props.id, { codeUrl: form.codeUrl.trim() })
    const result = await store.syncMetrics(props.id)
    if (result) {
      form.stars = result.paper.stars
      const failed = result.notes.find((note) => note.includes('失败'))
      store.notify(
        failed ? failed : t('已同步 {n} star', { n: result.paper.stars.toLocaleString() }),
      )
    }
  } finally {
    syncing.value = false
  }
}

function loadBond() {
  if (!props.id || !paper.value) {
    bond.value = null
    return
  }
  recordVisit(props.id)
  bond.value = bondOf(paper.value, bondStats(props.id))
  if (paper.value.eggAt && !paper.value.incubatedAt) {
    void store.update(props.id, { incubatedAt: new Date().toISOString() } as never)
  }
}

async function toggleEgg() {
  if (!paper.value) return
  const next = paper.value.eggAt ? null : new Date().toISOString()
  await store.update(paper.value.id, {
    eggAt: next,
    incubatedAt: null,
  } as never)
  store.notify(next ? t('已放入蛋队列') : t('已移出蛋队列'))
}

async function toggleParty() {
  if (paper.value) await store.toggleParty(paper.value)
}

async function tradePaper() {
  if (!paper.value || !tradeEmail.value.trim()) return
  tradeBusy.value = true
  try {
    const result = await api.tradePaper(paper.value.id, tradeEmail.value.trim())
    store.notify(t('已交换给 {name}', { name: result.to }))
    tradeOpen.value = false
    tradeEmail.value = ''
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('交换失败'))
  } finally {
    tradeBusy.value = false
  }
}

async function generateDexEntry() {
  if (!paper.value) return
  if (!settings.ready) {
    store.notify(t('先在设置里配置模型'))
    ui.openSettings()
    return
  }
  dexBusy.value = true
  try {
    await api.generateDexEntry(paper.value.id, settings.config, locale.value)
    await store.load()
    store.notify(t('图鉴描述已生成'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('生成失败'))
  } finally {
    dexBusy.value = false
  }
}

async function shareCard() {
  if (!paper.value) {
    store.notify(t('先保存这篇论文'))
    return
  }
  cardBusy.value = true
  try {
    await downloadShareCard({
      paper: paper.value,
      trainer: auth.user?.name || 'Trainer',
      avatarId: auth.user?.avatarId || 'red-cap',
      locale: locale.value,
    })
    store.notify(t('卡片已下载'))
  } catch {
    store.notify(t('生成卡片失败'))
  } finally {
    cardBusy.value = false
  }
}

async function generateArtwork() {
  if (!props.id) {
    store.notify(t('先保存这篇论文'))
    return
  }
  if (!settings.imageReady) {
    store.notify(t('先在设置里配置图像模型'))
    ui.openSettings()
    return
  }
  spriteBusy.value = true
  try {
    await api.generateSprite(props.id, settings.image)
    await store.load()
    store.notify(t('插画已生成'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('生成失败'))
  } finally {
    spriteBusy.value = false
  }
}

async function generateExplain() {
  if (!settings.ready) {
    ui.openSettings()
    return
  }
  if (!props.id) {
    store.notify(t('先保存这篇论文，再生成解读'))
    return
  }
  explaining.value = true
  try {
    const result = await api.explain(payload(), settings.config)
    const updated = await store.update(props.id, { explain: JSON.stringify(result) })
    if (updated) store.notify(t('解读已生成'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('生成失败'))
  } finally {
    explaining.value = false
  }
}

async function remove() {
  if (!props.id) return
  const ok = window.confirm(t('从图鉴中移除这篇论文？笔记和解读也会一起删除。'))
  if (!ok) return
  const done = await store.remove(props.id)
  if (done) close()
}

function close() {
  void router.push('/')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  loadBond()
})

watch(
  [() => props.id, () => paper.value?.id],
  () => loadBond(),
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <header class="sheet-head">
        <span class="no mono">No.{{ form.arxiv || 'NEW' }}</span>
        <h2 id="sheet-title">{{ creating ? t('登记新论文') : t('论文详情') }}</h2>
        <button class="close" type="button" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <div v-if="missing" class="missing">
        <h3>{{ t('图鉴里没有这只精灵') }}</h3>
        <p>{{ t('它可能已经被移除了。') }}</p>
        <button class="btn" type="button" @click="close">{{ t('返回图鉴') }}</button>
      </div>

      <div v-else class="sheet-body">
        <div class="main">
          <aside class="preview">
            <div class="stage" :class="{ dim: form.status === 'unread', lit: form.status === 'read' }">
              <PaperSprite :seed="seed" :category="form.primaryCategory" :locked="form.status === 'unread'" :sprite-url="paper?.spriteUrl ?? null" :status="form.status" :notes="form.notes" :shiny="shinyInfo.shiny" />
            </div>
            <button
              type="button"
              class="btn sm art-btn"
              :disabled="spriteBusy || !props.id || !settings.imageReady"
              @click="generateArtwork"
            >
              {{ spriteBusy ? t('生成中…') : paper?.spriteUrl ? t('重新生成插画') : t('生成插画') }}
            </button>
            <button
              type="button"
              class="btn sm ghost art-btn"
              :disabled="cardBusy || !props.id"
              @click="shareCard"
            >
              {{ cardBusy ? t('生成中…') : t('分享卡片') }}
            </button>
            <button
              type="button"
              class="btn sm ghost art-btn"
              :disabled="!props.id"
              @click="tradeOpen = !tradeOpen"
            >
              {{ t('交换') }}
            </button>
            <button
              type="button"
              class="btn sm ghost art-btn"
              :disabled="!props.id"
              @click="toggleParty"
            >
              {{ inParty ? t('移出队伍') : t('加入队伍') }}
            </button>
            <button
              v-if="paper && paper.status !== 'read'"
              type="button"
              class="btn sm ghost art-btn"
              :disabled="!props.id"
              @click="toggleEgg"
            >
              {{ inEgg ? t('移出蛋队列') : t('放入蛋队列') }}
            </button>
            <div v-if="tradeOpen" class="trade-row">
              <input v-model="tradeEmail" class="input" type="email" :placeholder="t('对方邮箱')" />
              <button
                type="button"
                class="btn sm"
                :disabled="tradeBusy || !tradeEmail.trim()"
                @click="tradePaper"
              >
                {{ tradeBusy ? t('交换中…') : t('确认') }}
              </button>
            </div>
            <div v-if="prefs.dexEntries" class="dex-entry">
              <span class="dex-kicker">📖 {{ t('图鉴描述') }}</span>
              <p v-if="paper?.dexEntry">{{ paper.dexEntry }}</p>
              <button
                v-else
                type="button"
                class="btn sm ghost"
                :disabled="dexBusy"
                @click="generateDexEntry"
              >
                {{ dexBusy ? t('生成中…') : t('生成图鉴描述') }}
              </button>
            </div>

            <div class="moves-line">
              <span class="moves-kicker">{{ t('招式') }}</span>
              <span v-for="move in moves" :key="move.name" class="move-chip">
                <i>{{ MOVE_ICON[move.kind] }}</i>
                {{ move.name }}
                <b class="mono">{{ move.power }}</b>
              </span>
            </div>

            <p class="stage-name">
              <span>{{ t(stageName) }}</span>
              <span
                v-if="shinyInfo.shiny"
                class="shiny-tag"
                :title="shinyInfo.reason ? t(SHINY_LABEL[shinyInfo.reason]) : ''"
              >
                ✦ {{ t('异色') }}
              </span>
              <span v-if="inEgg" class="egg-tag" :title="t('蛋')">🥚</span>
              <span v-if="inEgg" class="egg-state">{{ paper?.incubatedAt ? t('孵化中') : t('待孵化') }}</span>
            </p>
            <div v-if="bond" class="bond">
              <div class="bond-top">
                <span class="mono dim">{{ t('羁绊') }} {{ bond.score }}</span>
                <b>{{ t(bond.tier) }}</b>
                <span class="bond-hearts">
                  <i v-for="n in 3" :key="n" :class="{ on: n <= bond.hearts }">❤</i>
                </span>
              </div>
              <div class="bond-bar">
                <div class="bond-fill" :style="{ width: bond.score + '%' }" />
              </div>
            </div>

            <div class="preview-meta">
              <span class="type-chip" :style="{ background: catColor }">
                {{ form.primaryCategory || t('未分类') }}
              </span>
              <span class="mono dim">{{ form.arxiv || t('待登记') }}</span>
            </div>

            <div class="stars" role="group" :aria-label="t('评分')">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                class="star"
                :class="{ on: star <= form.rating }"
                :aria-label="t('{n} 星', { n: star })"
                @click="setRating(star)"
              >
                ★
              </button>
            </div>

            <div class="seg" role="group" :aria-label="t('阅读状态')">
              <button type="button" :class="{ on: form.status === 'unread' }" @click="setStatus('unread')">
                {{ t('未读') }}
              </button>
              <button type="button" :class="{ on: form.status === 'reading' }" @click="setStatus('reading')">
                {{ t('在读') }}
              </button>
              <button type="button" :class="{ on: form.status === 'read' }" @click="setStatus('read')">
                {{ t('已读') }}
              </button>
            </div>

            <p class="preview-hint">{{ t('精灵由 arXiv 编号生成，编号不变，精灵不变。') }}</p>
          </aside>

          <form class="form" @submit.prevent="save">
            <div class="pdfbar">
              <span class="pdf-tag">PDF</span>
              <span class="pdf-state">
                {{ paper?.pdfPath ? t('已存本地 · {path}', { path: paper.pdfPath }) : t('未下载，点右侧从 arXiv 拉取') }}
              </span>
              <RouterLink v-if="id" class="btn sm ghost" :to="`/p/${id}/read`">{{ t('在线阅读') }}</RouterLink>
              <button
                type="button"
                class="btn sm"
                :disabled="pdfBusy || !props.id || !form.arxiv"
                @click="openPdf"
              >
                {{ pdfBusy ? t('处理中…') : paper?.pdfPath ? t('打开 PDF') : t('下载 PDF') }}
              </button>
            </div>

            <div class="row2">
              <label class="field">
                <span>{{ t('arXiv 编号 / 链接') }}</span>
                <div class="input-row">
                  <input
                    v-model="form.arxiv"
                    class="input mono"
                    placeholder="2610.28480"
                    @input="onArxivInput"
                  />
                  <button
                    type="button"
                    class="btn sm ghost"
                    :disabled="fetching || !form.arxiv"
                    @click="fetchMeta"
                  >
                    {{ fetching ? '…' : t('抓取') }}
                  </button>
                </div>
              </label>
              <label class="field">
                <span>{{ t('年份') }}</span>
                <input v-model.number="form.year" class="input mono" type="number" min="1950" max="2100" />
              </label>
            </div>

            <label class="field">
              <span>{{ t('标题 *') }}</span>
              <input v-model="form.title" class="input" required />
            </label>

            <label class="field">
              <span>{{ t('作者') }}</span>
              <input v-model="form.authors" class="input" :placeholder="t('用逗号分隔')" />
            </label>

            <label class="field">
              <span>{{ t('会议 / 期刊') }}</span>
              <input v-model="form.venue" class="input" placeholder="CoRL / arXiv / Science Robotics" />
            </label>

            <label class="field">
              <span>{{ t('arXiv 分类') }}</span>
              <select v-model="form.primaryCategory" class="select">
                <option value="">{{ t('未设置') }}</option>
                <option v-for="item in ARXIV_CATEGORIES" :key="item.code" :value="item.code">
                  {{ item.code }} · {{ item.name }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>{{ t('标签') }}</span>
              <input v-model="form.tags" class="input" placeholder="world model, humanoid" />
            </label>

            <div class="levelbar">
              <div class="lv-badge" :style="{ background: TIER_COLORS[level.tier] }">
                Lv.{{ level.level }}
              </div>
              <div class="lv-info">
                <b>{{ t(level.tier) }}</b>
                <span class="mono">
                  {{ form.codeUrl ? t('开源 · {n} star', { n: Number(form.stars) || 0 }) : t('未开源，按普通计') }}
                </span>
              </div>
              <button
                type="button"
                class="btn sm ghost"
                :disabled="syncing || creating"
                @click="syncMetrics"
              >
                {{ syncing ? t('同步中…') : t('同步指标') }}
              </button>
            </div>

            <label class="field">
              <span>{{ t('开源仓库') }}</span>
              <input
                v-model="form.codeUrl"
                class="input mono"
                :placeholder="t('https://github.com/owner/repo（留空表示未开源）')"
              />
            </label>

            <label class="field">
              <span>GitHub Stars</span>
              <input v-model.number="form.stars" class="input mono" type="number" min="0" />
            </label>

            <label class="field">
              <span>{{ t('摘要') }}</span>
              <textarea
                v-model="form.abstract"
                class="textarea abstract"
                :placeholder="t('点「抓取」自动填；也可以手贴')"
              />
            </label>

            <label class="field">
              <span>{{ t('我的笔记') }}</span>
              <textarea
                v-model="form.notes"
                class="textarea"
                :placeholder="t('一句话结论、方法要点、要复现的东西…')"
              />
            </label>

            <div class="actions">
              <button v-if="!creating" type="button" class="btn danger" @click="remove">{{ t('删除') }}</button>
              <span class="spacer" />
              <button type="button" class="btn ghost" @click="close">{{ t('取消') }}</button>
              <button type="submit" class="btn" :disabled="saving">
                {{ saving ? t('保存中…') : t('保存') }}
              </button>
              <button v-if="form.status !== 'read'" type="button" class="btn lit" @click="markLit">
                ✦ {{ t('点亮') }}
              </button>
            </div>
          </form>
        </div>

        <section class="explain">
          <header class="explain-head">
            <h3>{{ t('AI 解读') }}</h3>
            <span class="hint">
              {{ settings.ready ? settings.config.model : t('还没配置模型') }}
            </span>
            <button v-if="!settings.ready" type="button" class="btn sm" @click="ui.openSettings()">
              {{ t('去配置') }}
            </button>
            <button
              v-else
              type="button"
              class="btn sm"
              :disabled="explaining || !paper"
              @click="generateExplain"
            >
              {{ explaining ? t('生成中…') : explainData ? t('重新生成') : t('生成解读') }}
            </button>
          </header>

          <div v-if="!explainData" class="explain-empty">
            {{ t('用摘要生成一张速读卡：一句话、问题、方法、关键数字、局限、下一步。') }}
            <span v-if="!form.abstract" class="warn">{{ t('还没有摘要，建议先点「抓取」。') }}</span>
          </div>

          <div v-else class="explain-grid">
            <p class="one-liner">{{ explainData.oneLiner }}</p>
            <div class="block">
              <h4>{{ t('问题') }}</h4>
              <p>{{ explainData.problem || '—' }}</p>
            </div>
            <div class="block">
              <h4>{{ t('方法') }}</h4>
              <p>{{ explainData.method || '—' }}</p>
            </div>
            <div class="block">
              <h4>{{ t('关键数字') }}</h4>
              <ul v-if="explainData.numbers.length">
                <li v-for="(item, i) in explainData.numbers" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">{{ t('摘要里没有定量结果') }}</p>
            </div>
            <div class="block">
              <h4>{{ t('局限') }}</h4>
              <ul v-if="explainData.limitations.length">
                <li v-for="(item, i) in explainData.limitations" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">—</p>
            </div>
            <div class="block">
              <h4>{{ t('下一步') }}</h4>
              <ul v-if="explainData.actions.length">
                <li v-for="(item, i) in explainData.actions" :key="i">{{ item }}</li>
              </ul>
              <p v-else class="muted">—</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(34, 29, 26, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.sheet {
  width: min(980px, 100%);
  max-height: calc(100vh - 44px);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 18px;
  box-shadow: 10px 10px 0 var(--ink);
  overflow: hidden;
  animation: pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

@keyframes pop {
  from {
    transform: scale(0.96) translateY(8px);
    opacity: 0.4;
  }
}

.sheet-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--red);
  color: #fff;
  border-bottom: 4px solid var(--ink);
  flex: none;
}

.sheet-head .no {
  background: #fff;
  color: var(--red);
  border: 2px solid var(--ink);
  border-radius: 5px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 800;
}

.sheet-head h2 {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
  flex: 1;
}

.close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--gold);
  color: var(--ink);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  display: grid;
  place-items: center;
}

.sheet-body {
  display: grid;
  gap: 18px;
  padding: 20px;
  overflow-y: auto;
}

.main {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 22px;
}

.preview {
  display: grid;
  gap: 10px;
  align-content: start;
}

.stage.lit :deep(svg) {
  animation: idle-float 3.4s ease-in-out infinite;
}

@keyframes idle-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  35% {
    transform: translateY(-3px) rotate(-1.2deg);
  }
  70% {
    transform: translateY(-1px) rotate(1deg);
  }
}

.stage {
  aspect-ratio: 1;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background-color: #f7ecd2;
  background-image: linear-gradient(rgba(43, 36, 32, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 36, 32, 0.07) 1px, transparent 1px);
  background-size: 20px 20px;
  padding: 12px;
  box-shadow: var(--shadow-sm);
}

.stage.dim :deep(svg) {
  opacity: 0.7;
}

.trade-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.trade-row .input {
  min-width: 0;
  height: 28px;
  font-size: 11px;
}

.moves-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 2px 0;
}

.moves-kicker {
  width: 100%;
  font-size: 9px;
  font-weight: 900;
  color: var(--muted);
}

.move-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  border: 1.5px solid var(--line);
  border-radius: 999px;
  background: var(--panel-2);
  font-size: 8.5px;
  font-weight: 800;
}

.move-chip i {
  font-style: normal;
  font-size: 8px;
}

.move-chip b {
  font-size: 8px;
  color: var(--muted);
}

.dex-entry {
  display: grid;
  gap: 3px;
  margin: 6px 2px 0;
  padding: 6px 7px;
  border: 1.5px dashed var(--line);
  border-radius: 7px;
  background: var(--panel-2);
}

.dex-kicker {
  font-size: 9px;
  font-weight: 900;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.dex-entry p {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--ink);
}

.bond {
  display: grid;
  gap: 3px;
  margin: 6px 2px 0;
}

.bond-top {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
}

.bond-top b {
  font-size: 10px;
}

.bond-hearts {
  margin-left: auto;
  letter-spacing: 1px;
  font-style: normal;
}

.bond-hearts i {
  font-style: normal;
  color: var(--line);
  font-size: 9px;
}

.bond-hearts i.on {
  color: #e0586f;
}

.bond-bar {
  height: 5px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  background: var(--panel);
  overflow: hidden;
}

.bond-fill {
  height: 100%;
  background: #e0586f;
  transition: width 0.3s ease;
}

.egg-state {
  font-size: 9px;
  font-weight: 800;
  color: var(--muted);
}

.stage-name {
  margin: 4px 0 0;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.art-btn {
  width: 100%;
  margin-top: 6px;
}

.preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.type-chip {
  border: 2px solid var(--ink);
  border-radius: 999px;
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 9px;
  box-shadow: 1.5px 1.5px 0 var(--ink);
}

.preview-meta .dim {
  font-size: 10px;
  color: var(--dim);
  font-weight: 700;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  border: none;
  background: none;
  font-size: 21px;
  line-height: 1;
  padding: 0 1px;
  color: #d9cdb2;
  transition: transform 0.1s ease, color 0.1s ease;
}

.star:hover {
  transform: scale(1.15);
}

.star.on {
  color: var(--gold);
  text-shadow: 1px 1px 0 var(--ink);
}

.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  overflow: hidden;
  background: var(--paper);
}

.seg button {
  border: none;
  background: transparent;
  padding: 5px 4px;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--muted);
}

.seg button + button {
  border-left: 2.5px solid var(--ink);
}

.seg button.on {
  background: var(--gold);
  color: var(--ink);
}

.preview-hint {
  font-size: 10.5px;
  color: var(--dim);
  line-height: 1.5;
}

.form {
  display: grid;
  gap: 12px;
  align-content: start;
}

.levelbar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2.5px solid var(--ink);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--panel-2);
  box-shadow: 2px 2px 0 var(--ink);
}

.lv-badge {
  flex: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 2px 8px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
}

.lv-info {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.lv-info b {
  font-size: 11.5px;
}

.lv-info span {
  font-size: 10px;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pdfbar {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2.5px dashed var(--line);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--paper);
}

.pdf-tag {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 800;
  background: var(--red);
  color: #fff;
  border-radius: 4px;
  padding: 1px 6px;
}

.pdf-state {
  flex: 1;
  font-size: 11.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.input-row {
  display: flex;
  gap: 6px;
}

.input-row .input {
  flex: 1;
  min-width: 0;
}

.textarea.abstract {
  min-height: 86px;
  font-size: 12.5px;
  line-height: 1.6;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 2px dashed var(--line);
}

.actions .spacer {
  flex: 1;
}

.btn.lit {
  background: linear-gradient(to bottom, #ffe27a, var(--gold));
}

.missing {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 60px 20px;
}

.missing h3 {
  font-size: 20px;
}

.missing p {
  color: var(--muted);
  font-size: 14px;
}

.explain {
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--panel-2);
  padding: 14px 16px 16px;
}

.explain-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.explain-head h3 {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.explain-head .hint {
  font-size: 11px;
  color: var(--dim);
  flex: 1;
}

.explain-empty {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.65;
}

.explain-empty .warn {
  color: var(--red);
  font-weight: 700;
}

.explain-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 16px;
}

.one-liner {
  grid-column: 1 / -1;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.5;
  border-left: 3px solid var(--red);
  padding-left: 10px;
}

.block h4 {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--dim);
  margin-bottom: 3px;
}

.block p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}

.block ul {
  margin: 0;
  padding-left: 16px;
}

.block li {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text);
}

.muted {
  color: var(--dim) !important;
  font-size: 12px;
}

@media (max-width: 760px) {
  .main {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .preview {
    grid-template-columns: 120px 1fr;
    grid-template-areas:
      'stage meta'
      'stage stars'
      'stage seg'
      'hint hint';
    align-items: center;
    gap: 8px 14px;
  }

  .stage.lit :deep(svg) {
  animation: idle-float 3.4s ease-in-out infinite;
}

@keyframes idle-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  35% {
    transform: translateY(-3px) rotate(-1.2deg);
  }
  70% {
    transform: translateY(-1px) rotate(1deg);
  }
}

.stage {
    grid-area: stage;
  }

  .stage-name {
  margin: 4px 0 0;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.art-btn {
  width: 100%;
  margin-top: 6px;
}

.preview-meta {
    grid-area: meta;
  }

  .stars {
    grid-area: stars;
  }

  .seg {
    grid-area: seg;
  }

  .preview-hint {
    grid-area: hint;
  }

  .row2 {
    grid-template-columns: 1fr;
  }

  .explain-grid {
    grid-template-columns: 1fr;
  }
}
</style>
