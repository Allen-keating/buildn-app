import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

export function DashboardHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold text-white">造</Link>
        <span className="text-sm text-neutral-500">My Projects</span>
      </div>
      <LogoutButton />
    </header>
  )
}
