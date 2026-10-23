import type { ArxivItem, AuthUser, Explain, Invite, LlmConfig, Paper, PaperInput } from './types'

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

  async list(): Promise<Paper[]> {
    const data = await request<{ papers: Paper[] }>('/api/papers')
    return data.papers
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

  async paperSummary(id: string, config?: unknown): Promise<string> {
    const data = await request<{ summary: string }>(`/api/papers/${id}/summary`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
    return data.summary
  },

  async syncMetrics(
    id: string,
    scholar?: { provider: string; apiKey: string },
  ): Promise<{ paper: Paper; notes: string[] }> {
    return request<{ paper: Paper; notes: string[] }>(`/api/papers/${id}/metrics`, {
      method: 'POST',
      body: JSON.stringify({ scholar }),
    })
  },

  async remove(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/papers/${id}`, { method: 'DELETE' })
  },

  async exportAll(): Promise<{ exportedAt: string; papers: Paper[] }> {
    return request<{ exportedAt: string; papers: Paper[] }>('/api/export')
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
