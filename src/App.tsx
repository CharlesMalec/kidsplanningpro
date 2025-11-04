import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import Auth from '@/components/Auth'
import FamilySetup from '@/components/FamilySetup'
import { doc, getDoc } from 'firebase/firestore'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasFamily, setHasFamily] = useState<boolean | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setHasFamily(null)
        setLoading(false)
        return
      }
      // Check if user has a familyId in users collection
      const userRef = doc(db, 'users', u.uid)
      const snap = await getDoc(userRef)
      setHasFamily(snap.exists() && !!snap.data().familyId)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const content = useMemo(() => {
    if (loading) return <div className="p-6">Loading…</div>
    if (!user) return <Auth />
    if (hasFamily === false) return <FamilySetup />
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">KidsPlanningPro</h1>
          <button
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => auth.signOut()}
          >
            Sign out
          </button>
        </header>
        <p className="text-gray-700">Welcome! Your account is set up. Next steps: scheduling, parity logic, reporting…</p>
        <div className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Dashboard (placeholder)</h2>
          <ul className="list-disc ml-5 text-sm text-gray-700">
            <li>Odd/Even week logic</li>
            <li>Calendar rendering</li>
            <li>Versioned events</li>
          </ul>
        </div>
      </div>
    )
  }, [user, loading, hasFamily])

  return <div className="min-h-screen">{content}</div>
}
