'use client'

import Editor from '@monaco-editor/react'

interface CodeEditorProps {
  path: string
  content: string
  onChange: (content: string) => void
}

function getLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.html')) return 'html'
  if (path.endsWith('.md')) return 'markdown'
  return 'plaintext'
}

export function CodeEditor({ path, content, onChange }: CodeEditorProps) {
  return (
    <Editor
      key={path}
      height="100%"
      language={getLanguage(path)}
      value={content}
      onChange={(value) => onChange(value ?? '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  )
}
