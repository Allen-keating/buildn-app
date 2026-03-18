import { describe, it, expect } from 'vitest'
import { estimateTokens, selectRelevantFiles, assemblePrompt } from '../src/context'

describe('estimateTokens', () => {
  it('estimates English text', () => {
    expect(estimateTokens('Hello world')).toBeGreaterThan(0)
    expect(estimateTokens('Hello world')).toBeLessThan(10)
  })
  it('estimates CJK text', () => {
    expect(estimateTokens('你好世界')).toBe(2)
  })
})

describe('selectRelevantFiles', () => {
  it('prioritizes mentioned files', () => {
    const files = { 'src/App.tsx': 'app', 'src/Button.tsx': 'btn' }
    const result = selectRelevantFiles(files, 'Change the Button component')
    expect(result[0].key).toBe('src/Button.tsx')
  })
  it('prioritizes entry files', () => {
    const files = { 'src/App.tsx': 'app', 'src/utils.ts': 'utils' }
    const result = selectRelevantFiles(files, 'do something')
    const appItem = result.find(r => r.key === 'src/App.tsx')
    const utilsItem = result.find(r => r.key === 'src/utils.ts')
    expect(appItem!.priority).toBeGreaterThan(utilsItem!.priority)
  })
})

describe('assemblePrompt', () => {
  it('builds create prompt when no files', () => {
    const result = assemblePrompt('create', 'Make a counter', {}, [], 100000)
    expect(result.systemPrompt).toContain('Buildn')
    expect(result.userPrompt).toContain('counter')
  })
  it('builds modify prompt with existing files', () => {
    const result = assemblePrompt('modify', 'Add dark mode', { 'src/App.tsx': 'code' }, [], 100000)
    expect(result.userPrompt).toContain('Modify')
    expect(result.userPrompt).toContain('src/App.tsx')
  })
})
