import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic()
  }
  return client
}

export async function* callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'claude-sonnet-4-6-20250514',
): AsyncGenerator<{ type: 'text'; text: string } | { type: 'done'; fullText: string }> {
  const anthropic = getClient()

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  let fullText = ''

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text
      yield { type: 'text', text: event.delta.text }
    }
  }

  yield { type: 'done', fullText }
}
