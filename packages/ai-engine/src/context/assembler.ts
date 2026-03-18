import type { FileMap, ConversationMessage, Intent } from '@buildn/shared'
import { SYSTEM_PROMPT } from '../prompts/system'
import { buildCreatePrompt } from '../prompts/create-app'
import { buildModifyPrompt } from '../prompts/modify-code'
import { selectRelevantFiles, buildFileTree } from './retriever'
import { trimToTokenBudget } from './budget'

export interface AssembledPrompt {
  systemPrompt: string
  userPrompt: string
}

export function assemblePrompt(
  intent: Intent,
  userInput: string,
  projectFiles: FileMap,
  history: ConversationMessage[],
  tokenBudget: number,
): AssembledPrompt {
  const relevantItems = selectRelevantFiles(projectFiles, userInput)
  const selectedFiles = trimToTokenBudget(relevantItems, Math.floor(tokenBudget * 0.6))

  const fileContents = Array.from(selectedFiles.entries())
    .map(([path, content]) => `--- ${path} ---\n${content}\n--- end ---`)
    .join('\n\n')

  const fileTree = buildFileTree(projectFiles)
  const hasFiles = Object.keys(projectFiles).length > 0

  let userPrompt: string
  if (intent === 'create' || !hasFiles) {
    userPrompt = buildCreatePrompt(userInput, hasFiles ? fileContents : undefined)
  } else {
    userPrompt = buildModifyPrompt(userInput, fileTree, fileContents)
  }

  if (history.length > 0) {
    const historyText = history
      .slice(-5)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n')
    userPrompt = `Recent conversation:\n${historyText}\n\n${userPrompt}`
  }

  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}
