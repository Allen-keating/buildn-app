import https from 'node:https'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-coder-plus'

function getConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY env var')
  return {
    apiKey,
    baseUrl: process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL,
  }
}

function streamRequest(
  url: string,
  apiKey: string,
  body: string,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errData = ''
          res.on('data', (c) => (errData += c))
          res.on('end', () => reject(new Error(`DashScope ${res.statusCode}: ${errData}`)))
          return
        }

        let buffer = ''
        res.setEncoding('utf-8')
        res.on('data', (raw: string) => {
          buffer += raw
          while (buffer.includes('\n')) {
            const idx = buffer.indexOf('\n')
            const line = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 1)

            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data || data === '[DONE]') continue

            try {
              const json = JSON.parse(data) as {
                choices?: { delta?: { content?: string | null } }[]
                error?: { message?: string }
              }
              if (json.error) {
                reject(new Error(`DashScope: ${json.error.message}`))
                return
              }
              const content = json.choices?.[0]?.delta?.content
              if (content) onChunk(content)
            } catch {
              // skip
            }
          }
        })
        res.on('end', resolve)
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function* callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL,
): AsyncGenerator<{ type: 'text'; text: string } | { type: 'done'; fullText: string }> {
  const { apiKey, baseUrl } = getConfig()
  const url = `${baseUrl}/chat/completions`

  const body = JSON.stringify({
    model,
    stream: true,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const chunks: string[] = []
  await streamRequest(url, apiKey, body, (text) => chunks.push(text))

  const fullText = chunks.join('')

  for (const text of chunks) {
    yield { type: 'text', text }
  }

  yield { type: 'done', fullText }
}
