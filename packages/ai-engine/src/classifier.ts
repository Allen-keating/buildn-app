import type { Intent } from '@buildn/shared'

const DEPLOY_RE = /发布|部署|上线|deploy|publish|ship/i
const QUESTION_RE = /什么|怎么|为什么|如何|解释|告诉我|\?$|^(what|how|why|explain|describe|tell me)/i
const CREATE_RE = /创建|新建|做一个|生成|帮我做|build|create|make|generate|scaffold/i

export function classifyIntent(prompt: string, hasProject: boolean): Intent {
  const s = prompt.trim()
  if (DEPLOY_RE.test(s)) return 'deploy'
  if (QUESTION_RE.test(s)) return 'question'
  if (!hasProject || CREATE_RE.test(s)) return 'create'
  return 'modify'
}
