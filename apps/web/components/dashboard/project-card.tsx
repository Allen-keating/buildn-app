'use client'

import Link from 'next/link'
import type { Project } from '@buildn/shared'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  return (
    <div className="group relative">
      <Link
        href={`/project/${project.id}`}
        className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
      >
        <div className="mb-3 h-20 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900" />
        <h3 className="font-medium text-white">{project.name}</h3>
        <p className="mt-1 text-xs text-neutral-500">{timeAgo(project.updated_at)}</p>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); onDelete() }}
        className="absolute right-3 top-3 hidden rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white group-hover:block"
      >
        &times;
      </button>
    </div>
  )
}
