const NETLIFY_API = 'https://api.netlify.com/api/v1'

function getToken(): string {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')
  return token
}

async function netlifyFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Netlify API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function createSite(name: string): Promise<{ id: string; url: string }> {
  const data = await netlifyFetch('/sites', {
    method: 'POST',
    body: JSON.stringify({ name: `buildn-${name}-${Date.now()}` }),
  })
  return { id: data.id, url: data.ssl_url || data.url }
}

export async function createDeploy(
  siteId: string,
  fileDigests: Record<string, string>,
): Promise<{ id: string; required: string[] }> {
  const data = await netlifyFetch(`/sites/${siteId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ files: fileDigests }),
  })
  return { id: data.id, required: data.required || [] }
}

export async function uploadFile(
  deployId: string,
  path: string,
  content: Uint8Array,
): Promise<void> {
  const res = await fetch(`${NETLIFY_API}/deploys/${deployId}/files/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content as unknown as BodyInit,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}

export async function getNetlifyDeployStatus(
  deployId: string,
): Promise<{ state: string; url: string }> {
  const data = await netlifyFetch(`/deploys/${deployId}`)
  return { state: data.state, url: data.ssl_url || data.url }
}
