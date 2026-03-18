import type { FileMap, ConversationMessage, Intent } from '@buildn/shared'
import { SYSTEM_PROMPT, buildCreatePrompt, buildModifyPrompt } from './prompts'

export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  return Math.ceil(cjk / 2 + (text.length - cjk) / 4)
}

export function selectRelevantFiles(
  files: FileMap,
  prompt: string,
): { key: string; content: string; priority: number }[] {
  return Object.entries(files)
    .map(([path, content]) => {
      let priority = 1
      if (['src/App.tsx', 'src/main.tsx', 'package.json'].includes(path)) priority = 5
      const name = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? ''
      if (prompt.toLowerCase().includes(name.toLowerCase())) priority = 10
      return { key: path, content, priority }
    })
    .sort((a, b) => b.priority - a.priority)
}

export function trimToTokenBudget(
  items: { key: string; content: string }[],
  budget: number,
): Map<string, string> {
  const result = new Map<string, string>()
  let used = 0
  for (const item of items) {
    const tokens = estimateTokens(item.content)
    if (used + tokens > budget) continue
    result.set(item.key, item.content)
    used += tokens
  }
  return result
}

export function assemblePrompt(
  intent: Intent,
  userInput: string,
  projectFiles: FileMap,
  history: ConversationMessage[],
  tokenBudget: number,
): { systemPrompt: string; userPrompt: string } {
  const relevant = selectRelevantFiles(projectFiles, userInput)
  const selected = trimToTokenBudget(relevant, Math.floor(tokenBudget * 0.6))
  const fileContents = Array.from(selected.entries())
    .map(([path, content]) => `--- ${path} ---\n${content}\n--- end ---`)
    .join('\n\n')
  const fileTree = Object.keys(projectFiles).sort().map(p => `  ${p}`).join('\n')
  const hasFiles = Object.keys(projectFiles).length > 0

  let userPrompt: string
  if (intent === 'create' || !hasFiles) {
    userPrompt = buildCreatePrompt(userInput, hasFiles ? fileContents : undefined)
  } else {
    userPrompt = buildModifyPrompt(userInput, fileTree, fileContents)
  }

  if (history.length > 0) {
    const historyText = history.slice(-5).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')
    userPrompt = `Recent conversation:\n${historyText}\n\n${userPrompt}`
  }

  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}
