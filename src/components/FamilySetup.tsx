import { FormEvent, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

export default function FamilySetup() {
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const tzOptions = useMemo(() => {
    // Minimal list to start; can be expanded later
    return [
      'Europe/Paris','Europe/Brussels','Europe/Berlin','Europe/London','UTC','America/New_York','America/Los_Angeles'
    ]
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not authenticated')
      const familyId = crypto.randomUUID()
      await setDoc(doc(db, 'families', familyId), {
        name,
        timezone,
        owners: [user.uid],
        createdAt: serverTimestamp()
      })
      await setDoc(doc(db, 'users', user.uid), {
        familyId,
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (err: any) {
      setError(err.message ?? 'Error saving family')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create your family</h2>
        <p className="text-sm text-gray-600">This sets the base container (name + timezone). You can invite the second parent later.</p>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm text-gray-700">Family name</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="e.g., Malec Family"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Timezone</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            >
              {tzOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>

          <button
            disabled={saving}
            className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-50"
            type="submit"
          >
            {saving ? 'Saving…' : 'Create family'}
          </button>
        </form>
      </div>
    </div>
  )
}
