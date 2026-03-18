import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">造 Buildn</span>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Sign In
          </Link>
          <Link href="/register" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex flex-col items-center px-6 pt-24 text-center">
        <p className="mb-3 text-sm tracking-widest text-neutral-500">AI-POWERED APP BUILDER</p>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight">Build apps with words</h1>
        <p className="mb-8 max-w-lg text-lg text-neutral-400">
          Describe what you want, and Buildn turns it into a real web application.
        </p>
        <Link href="/register" className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-500">
          Start Building
        </Link>

        <div className="mt-24 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: '💬', title: 'Chat to Build', desc: 'Describe your app in natural language' },
            { icon: '👁️', title: 'Live Preview', desc: 'See changes in real-time' },
            { icon: '🚀', title: 'One-Click Deploy', desc: 'Publish to the web instantly' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
