import type { Paper, PaperInput } from './types'

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

  async remove(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/papers/${id}`, { method: 'DELETE' })
  },

  async exportAll(): Promise<{ exportedAt: string; papers: Paper[] }> {
    return request<{ exportedAt: string; papers: Paper[] }>('/api/export')
  },

  async importAll(payload: { papers: Paper[] }): Promise<number> {
    const data = await request<{ imported: number }>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data.imported
  },
}
