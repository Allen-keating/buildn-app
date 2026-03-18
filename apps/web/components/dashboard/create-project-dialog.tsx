'use client'

import { useState } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, template: string) => void
}

export function CreateProjectDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('blank')

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim(), template)
    setName('')
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => onOpenChange(false)}>
      <div className="w-96 rounded-xl border border-neutral-800 bg-neutral-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">Create New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Project Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="My awesome app" required autoFocus
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Template</label>
            <div className="grid grid-cols-2 gap-2">
              {['blank', 'dashboard', 'landing', 'ecommerce'].map((t) => (
                <button
                  key={t} type="button" onClick={() => setTemplate(t)}
                  className={`rounded-lg border p-3 text-left text-sm capitalize ${template === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            Create Project
          </button>
        </form>
      </div>
    </div>
  )
}
