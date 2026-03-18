const API_BASE = '/api'

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  register: (data: { email: string; password: string; name: string }) =>
    fetchJSON<{ user: unknown; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchJSON<{ user: unknown; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => fetchJSON<{ user: unknown }>('/auth/me'),

  listProjects: () => fetchJSON<{ projects: unknown[] }>('/projects'),

  createProject: (data: { name: string; template?: string }) =>
    fetchJSON<{ project: unknown }>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  getProject: (id: string) =>
    fetchJSON<{ project: unknown; files: Record<string, string> }>(`/projects/${id}`),

  deleteProject: (id: string) =>
    fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    }),

  streamChat: (projectId: string, prompt: string) => {
    const token = localStorage.getItem('token')
    return fetch(`${API_BASE}/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt }),
    })
  },

  getMessages: (projectId: string) =>
    fetchJSON<{ messages: unknown[] }>(`/projects/${projectId}/messages`),
}
