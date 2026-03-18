import Editor from '@monaco-editor/react'

interface CodeEditorProps {
  file: { path: string; content: string } | null
  onChange?: (path: string, content: string) => void
  readOnly?: boolean
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

export function CodeEditor({ file, onChange, readOnly }: CodeEditorProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Select a file to view
      </div>
    )
  }

  return (
    <Editor
      height="100%"
      language={getLanguage(file.path)}
      value={file.content}
      onChange={(value) => onChange?.(file.path, value ?? '')}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
      }}
    />
  )
}
