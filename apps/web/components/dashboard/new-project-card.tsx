export function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-full min-h-[140px] items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 transition hover:border-neutral-600"
    >
      <div className="text-center text-neutral-500">
        <div className="text-2xl">+</div>
        <div className="mt-1 text-sm">New Project</div>
      </div>
    </button>
  )
}
