import { FormEvent, useState } from 'react'
import { auth, googleProvider } from '@/lib/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (err: any) {
      setError(err.message ?? 'Authentication error')
    }
  }

  async function google() {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      setError(err.message ?? 'Google sign-in error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-xl font-bold text-center">KidsPlanningPro</h1>
        <p className="text-center text-sm text-gray-600">Sign in or create an account</p>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border rounded px-3 py-2"
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
            required
          />
          <button type="submit" className="w-full py-2 rounded bg-black text-white hover:opacity-90">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button onClick={google} className="w-full py-2 rounded bg-white border hover:bg-gray-50">
          Continue with Google
        </button>

        <div className="text-center text-sm">
          {mode === 'signin' ? (
            <button className="underline" onClick={() => setMode('signup')}>Create an account</button>
          ) : (
            <button className="underline" onClick={() => setMode('signin')}>I already have an account</button>
          )}
        </div>
      </div>
    </div>
  )
}
