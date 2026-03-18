/**
 * Test DashScope API keys against available models.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=sk-xxx npx tsx scripts/test-dashscope.ts
 *
 * Or with multiple keys:
 *   DASHSCOPE_API_KEYS="sk-xxx,sk-yyy" npx tsx scripts/test-dashscope.ts
 */

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

const MODELS_TO_TEST = [
  // Commercial - Qwen3
  'qwen3-max',
  'qwen3-plus',
  'qwen3-turbo',
  // Commercial - Qwen3.5
  'qwen3.5-plus',
  'qwen3.5-flash',
  // Commercial - Qwen Plus/Turbo
  'qwen-plus',
  'qwen-turbo',
  'qwen-long',
  // Commercial - QwQ
  'qwq-plus',
  // Commercial - Coder
  'qwen-coder-plus',
  'qwen-coder-turbo',
  // Commercial - VL (vision)
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen3-vl-plus',
  // Open source
  'qwen3-235b-a22b',
  'qwen3-32b',
  'qwen3-14b',
  'qwen3-8b',
  'qwen3-4b',
  'qwen2.5-72b-instruct',
  'qwen2.5-32b-instruct',
  'qwen2.5-14b-instruct',
  'qwen2.5-7b-instruct',
  'qwen2.5-coder-32b-instruct',
  // Deepseek (if available via DashScope)
  'deepseek-v3',
  'deepseek-r1',
]

interface TestResult {
  model: string
  status: 'ok' | 'error'
  detail: string
  latencyMs: number
}

async function testModel(apiKey: string, model: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    })

    const latencyMs = Date.now() - start
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      error?: { message?: string; code?: string }
    }

    if (res.ok && data.choices?.[0]?.message?.content) {
      return {
        model,
        status: 'ok',
        detail: `"${data.choices[0].message.content.slice(0, 50)}"`,
        latencyMs,
      }
    }

    return {
      model,
      status: 'error',
      detail: data.error?.message ?? `HTTP ${res.status}`,
      latencyMs,
    }
  } catch (err) {
    return {
      model,
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    }
  }
}

async function testKey(apiKey: string, label: string) {
  const masked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing key: ${label} (${masked})`)
  console.log('='.repeat(60))

  // First check if key is valid at all with a known model
  const probe = await testModel(apiKey, 'qwen-turbo')
  if (probe.status === 'error' && probe.detail.includes('Invalid API-key')) {
    console.log(`\n  Key is INVALID: ${probe.detail}`)
    return
  }

  // Test all models concurrently (in batches of 5 to avoid rate limiting)
  const results: TestResult[] = []
  for (let i = 0; i < MODELS_TO_TEST.length; i += 5) {
    const batch = MODELS_TO_TEST.slice(i, i + 5)
    const batchResults = await Promise.all(batch.map((m) => testModel(apiKey, m)))
    results.push(...batchResults)
  }

  // Print results
  const available = results.filter((r) => r.status === 'ok')
  const unavailable = results.filter((r) => r.status === 'error')

  console.log(`\n  Available models (${available.length}):`)
  for (const r of available) {
    console.log(`    [OK]  ${r.model.padEnd(35)} ${r.latencyMs}ms  ${r.detail}`)
  }

  if (unavailable.length > 0) {
    console.log(`\n  Unavailable models (${unavailable.length}):`)
    for (const r of unavailable) {
      console.log(`    [--]  ${r.model.padEnd(35)} ${r.detail.slice(0, 60)}`)
    }
  }
}

async function main() {
  const keys: { key: string; label: string }[] = []

  // Read from DASHSCOPE_API_KEY (single)
  if (process.env.DASHSCOPE_API_KEY) {
    keys.push({ key: process.env.DASHSCOPE_API_KEY, label: 'DASHSCOPE_API_KEY' })
  }

  // Read from DASHSCOPE_API_KEYS (comma-separated)
  if (process.env.DASHSCOPE_API_KEYS) {
    const parts = process.env.DASHSCOPE_API_KEYS.split(',').map((k) => k.trim())
    parts.forEach((k, i) => keys.push({ key: k, label: `Key ${i + 1}` }))
  }

  if (keys.length === 0) {
    console.error(
      'No API keys found. Set DASHSCOPE_API_KEY or DASHSCOPE_API_KEYS env var.\n\n' +
        'Usage:\n' +
        '  DASHSCOPE_API_KEY=sk-xxx npx tsx scripts/test-dashscope.ts\n' +
        '  DASHSCOPE_API_KEYS="sk-aaa,sk-bbb" npx tsx scripts/test-dashscope.ts',
    )
    process.exit(1)
  }

  console.log(`Testing ${keys.length} key(s) against ${MODELS_TO_TEST.length} models...`)

  for (const { key, label } of keys) {
    await testKey(key, label)
  }

  console.log('\nDone.')
}

main()
