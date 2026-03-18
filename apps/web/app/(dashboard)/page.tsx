'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { ProjectCard } from '@/components/dashboard/project-card'
import { NewProjectCard } from '@/components/dashboard/new-project-card'
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog'

export default function DashboardPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: projects, refetch } = trpc.project.list.useQuery()
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => router.push(`/project/${project.id}`),
  })
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => refetch(),
  })

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Projects</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + New Project
        </button>
      </div>

      {projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
          <p className="mb-4 text-lg">No projects yet</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={() => deleteMutation.mutate({ id: p.id })} />
          ))}
          <NewProjectCard onClick={() => setDialogOpen(true)} />
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={(name, template) =>
          createMutation.mutate({ name, template: template as 'blank' | 'dashboard' | 'landing' | 'ecommerce' })
        }
      />
    </div>
  )
}
