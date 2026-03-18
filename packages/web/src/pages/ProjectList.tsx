import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

interface ProjectItem {
  id: string
  name: string
  description: string
  status: string
  updatedAt: string
}

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.listProjects().then((res) => setProjects(res.projects as ProjectItem[]))
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await api.createProject({ name: newName.trim() })
    const project = res.project as ProjectItem
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">造 Buildn</h1>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New project name..."
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleCreate}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Create
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="text-center text-neutral-500">No projects yet. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:border-neutral-700"
              >
                <h3 className="font-medium text-white">{p.name}</h3>
                <p className="mt-1 text-xs text-neutral-500">{p.description || 'No description'}</p>
                <p className="mt-2 text-xs text-neutral-600">{p.status}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
