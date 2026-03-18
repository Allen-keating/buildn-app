import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export function Login() {
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const result = isRegister
        ? await api.register({ email, password, name })
        : await api.login({ email, password })
      localStorage.setItem('token', result.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <form onSubmit={handleSubmit} className="w-80 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-center text-2xl font-bold text-white">造 Buildn</h1>
        <p className="text-center text-sm text-neutral-400">
          {isRegister ? 'Create your account' : 'Sign in to your account'}
        </p>

        {isRegister && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {isRegister ? 'Register' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="w-full text-center text-xs text-neutral-400 hover:text-white"
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </button>
      </form>
    </div>
  )
}
