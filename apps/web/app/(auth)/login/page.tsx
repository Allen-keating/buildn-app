import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { OAuthButton } from '@/components/auth/oauth-button'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="w-96 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-6 text-center">
          <div className="mb-2 text-2xl font-bold">造 Buildn</div>
          <p className="text-sm text-neutral-400">Sign in to your account</p>
        </div>
        <div className="space-y-4">
          <OAuthButton />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-800" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">or</span></div>
          </div>
          <LoginForm />
          <p className="text-center text-sm text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-400 hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
