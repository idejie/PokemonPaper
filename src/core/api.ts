import type {
  Annotation,
  PartyMember,
  DailyPick,
  ArxivItem,
  AuthUser,
  Explain,
  Invite,
  LeaderboardEntry,
  LlmConfig,
  PdfJob,
  Paper,
  PublicSummary,
  PaperInput,
} from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* keep the status line */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export const api = {
  async getAuthConfig(): Promise<{ registration: 'open' | 'invite' }> {
    return request<{ registration: 'open' | 'invite' }>('/api/auth/config')
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },

  async deleteAccount(password: string): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    })
  },

  async adminGetConfig(): Promise<{ registration: 'open' | 'invite' }> {
    return request<{ registration: 'open' | 'invite' }>('/api/admin/config')
  },

  async adminSetConfig(registration: 'open' | 'invite'): Promise<{ registration: 'open' | 'invite' }> {
    return request<{ registration: 'open' | 'invite' }>('/api/admin/config', {
      method: 'PATCH',
      body: JSON.stringify({ registration }),
    })
  },

  async adminListInvites(): Promise<Invite[]> {
    const data = await request<{ invites: Invite[] }>('/api/admin/invites')
    return data.invites
  },

  async adminCreateInvite(): Promise<string> {
    const data = await request<{ code: string }>('/api/admin/invites', { method: 'POST' })
    return data.code
  },

  async adminRevokeInvite(code: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/admin/invites/${code}`, { method: 'DELETE' })
  },

  async forgotPassword(email: string): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
  },

  async adminResetLink(email: string): Promise<string> {
    const data = await request<{ url: string }>('/api/admin/reset-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return data.url
  },

  async register(input: {
    email: string
    password: string
    name?: string
    invite?: string
  }): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.user
  },

  async login(input: { email: string; password: string }): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.user
  },

  async logout(): Promise<void> {
    await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  },

  async completeOnboarding(): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>('/api/auth/onboarded', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return data.user
  },

  async me(): Promise<AuthUser | null> {
    try {
      const data = await request<{ user: AuthUser }>('/api/auth/me')
      return data.user
    } catch {
      return null
    }
  },

  async updateMe(patch: { name?: string; avatarId?: string }): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return data.user
  },

  async toggleLike(
    kind: 'annotation' | 'summary',
    targetId: string,
  ): Promise<{ liked: boolean; likes: number }> {
    return request<{ liked: boolean; likes: number }>('/api/likes', {
      method: 'POST',
      body: JSON.stringify({ kind, targetId }),
    })
  },

  async startSpriteBatch(config: {
    baseUrl: string
    apiKey: string
    model: string
  }): Promise<{
    running: boolean
    total: number
    done: number
    failed: number
    current: string
    finishedAt: string | null
  }> {
    const data = await request<{ job: never }>('/api/sprites/generate', {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
    return data.job
  },

  async spriteBatchStatus(): Promise<{
    running: boolean
    total: number
    done: number
    failed: number
    current: string
    finishedAt: string | null
  }> {
    const data = await request<{ job: never }>('/api/sprites/generate')
    return data.job
  },

  async questions(id: string): Promise<import('./types').PaperQuestion[]> {
    const data = await request<{ questions: import('./types').PaperQuestion[] }>(
      `/api/papers/${id}/questions`,
    )
    return data.questions
  },

  async askQuestion(
    id: string,
    question: string,
    config: { baseUrl: string; apiKey: string; model: string },
    locale: 'zh' | 'en',
  ): Promise<import('./types').PaperQuestion> {
    const data = await request<{ question: import('./types').PaperQuestion }>(
      `/api/papers/${id}/questions`,
      {
        method: 'POST',
        body: JSON.stringify({ question, config, locale }),
      },
    )
    return data.question
  },

  async codeReview(id: string): Promise<{ review: string; reviewedAt: string | null }> {
    return request(`/api/papers/${id}/code-review`)
  },

  async analyzeCode(
    id: string,
    config: { baseUrl: string; apiKey: string; model: string },
    locale: 'zh' | 'en',
  ): Promise<{ review: string; reviewedAt: string | null }> {
    return request(`/api/papers/${id}/code-review`, {
      method: 'POST',
      body: JSON.stringify({ config, locale }),
    })
  },

  async syncAffiliations(id: string): Promise<string[]> {
    const data = await request<{ affiliations: string[] }>(`/api/papers/${id}/affiliations`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    return data.affiliations
  },

  async breed(
    paperIds: string[],
    idea: string,
    config: { baseUrl: string; apiKey: string; model: string },
    locale: 'zh' | 'en',
  ): Promise<{
    idea: string
    seed: string
    category: string
    papers: Array<{ id: string; arxiv: string; title: string }>
  }> {
    return request('/api/breed', {
      method: 'POST',
      body: JSON.stringify({ paperIds, idea, config, locale }),
    })
  },

  async gymLeaderboard(): Promise<{ gyms: Record<string, import('./types').GymRankEntry[]> }> {
    return request('/api/gym-leaderboard')
  },

  async gymLeaders(): Promise<{
    month: string
    gyms: Record<
      string,
      { userId: string; name: string; avatarId: string; count: number }
    >
  }> {
    return request('/api/gym-leaders')
  },

  async party(): Promise<PartyMember[]> {
    const data = await request<{ party: PartyMember[] }>('/api/party')
    return data.party
  },

  async setParty(paperIds: string[]): Promise<PartyMember[]> {
    const data = await request<{ party: PartyMember[] }>('/api/party', {
      method: 'PUT',
      body: JSON.stringify({ paperIds }),
    })
    return data.party
  },

  async tradePaper(id: string, email: string): Promise<{ to: string; arxiv: string }> {
    return request<{ to: string; arxiv: string }>(`/api/papers/${id}/trade`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async generateDexEntry(
    id: string,
    config: { baseUrl: string; apiKey: string; model: string },
    locale: 'zh' | 'en',
  ): Promise<string> {
    const data = await request<{ dexEntry: string }>(`/api/papers/${id}/dex`, {
      method: 'POST',
      body: JSON.stringify({ config, locale }),
    })
    return data.dexEntry
  },

  async progressBonus(): Promise<{ likes: number; daily: number; total: number }> {
    return request<{ likes: number; daily: number; total: number }>('/api/progress/bonus')
  },

  async daily(): Promise<DailyPick> {
    return request<DailyPick>('/api/daily')
  },

  async publicSummaries(paperId: string): Promise<PublicSummary[]> {
    const data = await request<{ summaries: PublicSummary[] }>(`/api/papers/${paperId}/summaries`)
    return data.summaries
  },

  async leaderboard(): Promise<{ entries: LeaderboardEntry[]; me: string }> {
    return request<{ entries: LeaderboardEntry[]; me: string }>('/api/leaderboard')
  },

  async list(): Promise<Paper[]> {
    const data = await request<{ papers: Paper[] }>('/api/papers')
    return data.papers
  },

  async generateSprite(
    id: string,
    config: { baseUrl: string; apiKey: string; model: string },
  ): Promise<string> {
    const data = await request<{ spriteUrl: string }>(`/api/papers/${id}/sprite`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
    return data.spriteUrl
  },

  async startPdfBackfill(): Promise<PdfJob> {
    const data = await request<{ job: PdfJob }>('/api/papers/download-missing', {
      method: 'POST',
    })
    return data.job
  },

  async pdfBackfillStatus(): Promise<PdfJob> {
    const data = await request<{ job: PdfJob }>('/api/papers/download-missing')
    return data.job
  },

  async backfillPapers(): Promise<{ updated: number; remaining: number }> {
    return request<{ updated: number; remaining: number }>('/api/papers/backfill', {
      method: 'POST',
    })
  },

  async create(input: PaperInput): Promise<Paper> {
    const data = await request<{ paper: Paper }>('/api/papers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.paper
  },

  async update(id: string, patch: Partial<Paper>): Promise<Paper> {
    const data = await request<{ paper: Paper }>(`/api/papers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return data.paper
  },

  async ensurePdf(id: string): Promise<Paper> {
    const data = await request<{ paper: Paper }>(`/api/papers/${id}/pdf`, { method: 'POST' })
    return data.paper
  },

  pdfUrl(id: string): string {
    return `/api/papers/${id}/pdf`
  },

  async paperText(id: string, extract = false): Promise<{ text: string; chars: number; pages?: number }> {
    return request<{ text: string; chars: number; pages?: number }>(`/api/papers/${id}/text`, {
      method: extract ? 'POST' : 'GET',
    })
  },

  async listAnnotations(paperId: string): Promise<Annotation[]> {
    const data = await request<{ annotations: Annotation[] }>(`/api/papers/${paperId}/annotations`)
    return data.annotations
  },

  async createAnnotation(
    paperId: string,
    input: {
      page: number
      rects: unknown[]
      quote: string
      color: string
      comment: string
      isPublic: boolean
      groupId?: string | null
    },
  ): Promise<string> {
    const data = await request<{ id: string }>(`/api/papers/${paperId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.id
  },

  async updateAnnotation(
    id: string,
    patch: { comment?: string; color?: string; isPublic?: boolean },
  ): Promise<void> {
    await request<{ ok: boolean }>(`/api/annotations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  async deleteAnnotation(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/annotations/${id}`, { method: 'DELETE' })
  },

  async paperSummary(id: string, config?: unknown): Promise<string> {
    const data = await request<{ summary: string }>(`/api/papers/${id}/summary`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
    return data.summary
  },

  async syncMetrics(id: string): Promise<{ paper: Paper; notes: string[] }> {
    return request<{ paper: Paper; notes: string[] }>(`/api/papers/${id}/metrics`, {
      method: 'POST',
    })
  },

  async remove(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/papers/${id}`, { method: 'DELETE' })
  },

  async exportAll(): Promise<{ exportedAt: string; papers: Paper[] }> {
    return request<{ exportedAt: string; papers: Paper[] }>('/api/export')
  },

  async searchArxiv(query: string, max = 20): Promise<ArxivItem[]> {
    const data = await request<{ items: ArxivItem[] }>('/api/arxiv/search', {
      method: 'POST',
      body: JSON.stringify({ query, max }),
    })
    return data.items
  },

  async previewArxiv(ids: string[]): Promise<ArxivItem[]> {
    const data = await request<{ items: ArxivItem[] }>('/api/arxiv/preview', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    return data.items
  },

  async explain(paper: Partial<Paper>, config: LlmConfig): Promise<Explain> {
    const data = await request<{ explain: Explain }>('/api/explain', {
      method: 'POST',
      body: JSON.stringify({ paper, config }),
    })
    return data.explain
  },

  async importAll(payload: { papers: Paper[] }): Promise<number> {
    const data = await request<{ imported: number }>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data.imported
  },
}
