import type { Intent } from '@buildn/shared'

const QUESTION_PATTERNS = [
  /什么|怎么|为什么|是什么|做什么|如何|解释|告诉我/,
  /\?$/,
  /^(what|how|why|explain|describe|tell me|can you)/i,
]

const DEPLOY_PATTERNS = [/发布|部署|上线|deploy|publish|ship/i]

const CREATE_PATTERNS = [/创建|新建|做一个|生成|帮我做|build|create|make|generate|scaffold/i]

export function classifyIntent(prompt: string, hasExistingProject: boolean): Intent {
  const trimmed = prompt.trim()

  if (DEPLOY_PATTERNS.some((p) => p.test(trimmed))) return 'deploy'
  if (QUESTION_PATTERNS.some((p) => p.test(trimmed))) return 'question'
  if (!hasExistingProject || CREATE_PATTERNS.some((p) => p.test(trimmed))) return 'create'

  return 'modify'
}
