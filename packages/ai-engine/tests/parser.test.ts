import { describe, it, expect } from 'vitest'
import { parseFileOperations } from '../src/parser'

describe('parseFileOperations', () => {
  it('parses ---FILE: format', () => {
    const output = `---FILE: src/App.tsx---
export function App() { return <div>Hello</div> }
---END FILE---`
    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe('create')
    expect(ops[0].path).toBe('src/App.tsx')
    expect(ops[0].content).toContain('App')
  })

  it('detects modify vs create', () => {
    const output = `---FILE: src/App.tsx---
new content
---END FILE---`
    const ops = parseFileOperations(output, { 'src/App.tsx': 'old' })
    expect(ops[0].type).toBe('modify')
  })

  it('strips markdown fences from content', () => {
    const output = '---FILE: src/App.tsx---\n```tsx\nexport function App() {}\n```\n---END FILE---'
    const ops = parseFileOperations(output, {})
    expect(ops[0].content).not.toContain('```')
    expect(ops[0].content).toContain('export function App')
  })

  it('parses multiple files', () => {
    const output = `---FILE: src/App.tsx---
app content
---END FILE---

---FILE: src/Button.tsx---
button content
---END FILE---`
    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(2)
  })

  it('returns empty for unparseable output', () => {
    expect(parseFileOperations('just text', {})).toHaveLength(0)
  })
})
