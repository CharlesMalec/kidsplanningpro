import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore'

/**
 * FamilySetup.tsx – Family + Kids + Custody Rules
 * - If no family: show Create Family (name + timezone)
 * - If family exists: tabs = Children | Custody Rules
 *   - Children CRUD: /families/{familyId}/children
 *   - One active rule: /families/{familyId}/scheduleRules/active
 *
 * Note: timezone is stored on the Family doc, NOT inside rules (avoids mismatch).
 */

// ---------------- utils ----------------
const isHexColor = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v)
const toDateInput = (ts?: Timestamp) =>
  ts ? new Date(ts.toDate().getTime() - ts.toDate().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : ''
const fromDateInput = (value: string): Timestamp | null => {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  return Timestamp.fromDate(d)
}
const isHHmm = (s?: string) => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

// ---------------- rule types ----------------
type Owner = 'parentA' | 'parentB'
type WeekStart = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

type RuleOddEven = {
  type: 'ODD_EVEN'
  weekStart: WeekStart
  anchorDate: string            // YYYY-MM-DD
  anchorWeekIs: 'ODD' | 'EVEN'
  parentOnOdd: Owner
  parentOnEven: Owner
  shiftTime?: string            // HH:mm (optional)
  active: boolean
}

type RuleWeekly = {
  type: 'WEEKLY_TEMPLATE'
  weekStart: WeekStart
  days: { dow: 0 | 1 | 2 | 3 | 4 | 5 | 6; owner: Owner; start?: string; end?: string }[]
  shiftTime?: string            // HH:mm default handover time (optional)
  active: boolean
}

type Rule = RuleOddEven | RuleWeekly

// ---------------- component ----------------
export default function FamilySetup() {
  // user/family state
  const [userFamilyId, setUserFamilyId] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)

  // create family state
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels'
  )
  const [saving, setSaving] = useState(false)
  const tzOptions = useMemo(
    () => ['Europe/Brussels', 'Europe/Paris', 'Europe/Berlin', 'Europe/London', 'UTC', 'America/New_York', 'America/Los_Angeles'],
    []
  )

  // children state
  type Child = { id?: string; name: string; birthdate: Timestamp; color: string; createdAt?: Timestamp; updatedAt?: Timestamp }
  const [children, setChildren] = useState<Child[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [kidsLoading, setKidsLoading] = useState(false)
  const [edit, setEdit] = useState<Child & { id: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // rules state
  const [activeTab, setActiveTab] = useState<'children' | 'rules'>('children')
  const [ruleType, setRuleType] = useState<'ODD_EVEN' | 'WEEKLY_TEMPLATE'>('ODD_EVEN')
  const [oddEven, setOddEven] = useState<RuleOddEven>({
    type: 'ODD_EVEN',
    weekStart: 'MON',
    anchorDate: '',
    anchorWeekIs: 'ODD',
    parentOnOdd: 'parentA',
    parentOnEven: 'parentB',
    shiftTime: '18:00',
    active: true,
  })
  const [weekly, setWeekly] = useState<RuleWeekly>({
    type: 'WEEKLY_TEMPLATE',
    weekStart: 'MON',
    days: [0, 1, 2, 3, 4, 5, 6].map(d => ({
      dow: d as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      owner: d < 3 ? 'parentA' : 'parentB',
      start: '00:00',
      end: '24:00'
    })),
    shiftTime: '18:00',
    active: true,
  })
  const [rulesBusy, setRulesBusy] = useState(false)
  const [rulesMsg, setRulesMsg] = useState<string | null>(null)

  // load user.familyId
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { setFatalError('Not authenticated'); setUserLoading(false); return }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const fid = snap.exists() ? (snap.data() as any)?.familyId ?? null : null
        setUserFamilyId(fid)
      } catch (e: any) {
        setFatalError(e?.message || 'Failed to load user')
      } finally {
        setUserLoading(false)
      }
    })
    return () => unsub()
  }, [])

  // when family exists: stream children, members, and active rule
  useEffect(() => {
    if (!userFamilyId) return
    setKidsLoading(true)

    const childrenCol = collection(db, 'families', userFamilyId, 'children')
    const unsubKids = onSnapshot(query(childrenCol, orderBy('birthdate', 'asc')), (qs) => {
      setChildren(qs.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
      setKidsLoading(false)
    })

    const membersCol = collection(db, 'families', userFamilyId, 'members')
    const unsubMembers = onSnapshot(membersCol, (qs) => {
      setMembers(qs.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })

    const unsubRule = onSnapshot(doc(db, 'families', userFamilyId, 'scheduleRules', 'active'), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as Rule
      if (data.type === 'ODD_EVEN') {
        setRuleType('ODD_EVEN')
        setOddEven(v => ({ ...v, ...data }))
      } else if (data.type === 'WEEKLY_TEMPLATE') {
        setRuleType('WEEKLY_TEMPLATE')
        setWeekly(v => ({ ...v, ...data }))
      }
    })

    return () => { unsubKids(); unsubMembers(); unsubRule() }
  }, [userFamilyId])

  // create family (transaction)
  async function onCreateFamily(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setFatalError(null)
    setSaving(true)
    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not authenticated')
      const userRef = doc(db, 'users', user.uid)
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const already = userSnap.exists() && !!(userSnap.data() as any)?.familyId
        if (already) throw new Error('You already have a family linked to your account.')
        const familyId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const familyRef = doc(db, 'families', familyId)
        tx.set(familyRef, { name, timezone, owners: [user.uid], createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        tx.set(userRef, { familyId, updatedAt: serverTimestamp() }, { merge: true })
      })
      // refresh state
      const u = auth.currentUser!
      const snap = await getDoc(doc(db, 'users', u.uid))
      setUserFamilyId(snap.exists() ? (snap.data() as any)?.familyId ?? null : null)
    } catch (err: any) {
      setFatalError(err?.message ?? 'Error saving family')
    } finally {
      setSaving(false)
    }
  }

  // children CRUD
  const childrenCol = userFamilyId ? collection(db, 'families', userFamilyId, 'children') : null

  async function addChild(payload: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!childrenCol) throw new Error('No family selected')
    await addDoc(childrenCol, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
  async function saveChild(id: string, payload: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!userFamilyId) throw new Error('No family selected')
    await updateDoc(doc(db, 'families', userFamilyId, 'children', id), { ...payload, updatedAt: serverTimestamp() })
  }
  async function removeChild(id: string) {
    if (!userFamilyId) throw new Error('No family selected')
    await deleteDoc(doc(db, 'families', userFamilyId, 'children', id))
  }

  // rules save
  const activeRuleRef = userFamilyId ? doc(db, 'families', userFamilyId, 'scheduleRules', 'active') : null

  function validateRule(r: Rule): string | null {
    if (r.type === 'ODD_EVEN') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.anchorDate)) return 'Set a valid anchor date (YYYY-MM-DD).'
      if (!['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(r.weekStart)) return 'Week start must be MON or SUN.'
      if (r.shiftTime && !isHHmm(r.shiftTime)) return 'Shift time must be HH:mm.'
      return null
    }
    // WEEKLY_TEMPLATE
    if (!['MON', 'SUN'].includes(r.weekStart)) return 'Week start must be a valid day (Mon–Sun).'
    for (const d of r.days) {
      if (d.start && !isHHmm(d.start)) return 'Day start must be HH:mm.'
      if (d.end && !/^24:00$|^([01]\d|2[0-3]):[0-5]\d$/.test(d.end)) return 'Day end must be HH:mm or 24:00.'
    }
    if (r.shiftTime && !isHHmm(r.shiftTime)) return 'Shift time must be HH:mm.'
    return null
  }

  async function saveRules() {
    if (!activeRuleRef) return
    setRulesBusy(true); setRulesMsg(null)
    try {
      const payload: Rule = ruleType === 'ODD_EVEN' ? { ...oddEven } : { ...weekly }
      const v = validateRule(payload)
      if (v) throw new Error(v)
      await setDoc(activeRuleRef, { ...payload, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true })
      setRulesMsg('Rules saved.')
    } catch (e: any) {
      setRulesMsg(e?.message || 'Failed to save rules')
    } finally {
      setRulesBusy(false)
    }
  }

  // child form
  function ChildForm({
    initial, onCancel, onSubmit, submitLabel
  }: {
    initial?: Child & { id?: string },
    onCancel?: () => void,
    onSubmit: (d: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void,
    submitLabel: string
  }) {
    const [n, setN] = useState(initial?.name ?? '')
    const [b, setB] = useState<string>(toDateInput(initial?.birthdate))
    const [c, setC] = useState(initial?.color ?? '#4f46e5')
    const [busy, setBusy] = useState(false)

    const validate = (): string | null => {
      const name = n.trim()
      if (!name) return 'Please enter a name.'
      if (name.length > 60) return 'Name is too long (max 60).'
      const ts = fromDateInput(b)
      if (!ts) return 'Please pick a valid birthdate.'
      const today = new Date()
      if (ts.toDate() > new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'Birthdate cannot be in the future.'
      if (!isHexColor(c)) return 'Please choose a valid color.'
      return null
    }

    async function handle(e: FormEvent) {
      e.preventDefault()
      const v = validate()
      if (v) { setFormError(v); return }
      setBusy(true)
      try {
        await onSubmit({ name: n.trim(), birthdate: fromDateInput(b)!, color: c })
        if (!initial) { setN(''); setB(''); setC('#4f46e5') }
        setFormError(null)
      } catch (e: any) {
        setFormError(e?.message || 'Failed to save')
      } finally { setBusy(false) }
    }

    return (
      <form onSubmit={handle} className="space-y-3 p-4 border rounded-2xl">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full rounded-xl border px-3 py-2" value={n} onChange={(e) => setN(e.target.value)} placeholder="Agathe" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input className="h-10 w-16 rounded border" type="color" value={c} onChange={(e) => setC(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Birthdate</label>
          <input type="date" className="rounded-xl border px-3 py-2" value={b} onChange={(e) => setB(e.target.value)} required />
        </div>
        {formError && <p className="text-red-600 text-sm">{formError}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 text-white px-4 py-2 disabled:opacity-50">{submitLabel}</button>
          {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2">Cancel</button>}
        </div>
      </form>
    )
  }

  // ---------------- render ----------------
  if (userLoading) return <div className="min-h-screen flex items-center justify-center p-6">Loading…</div>
  if (fatalError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow p-6 text-red-700 border border-red-200">{fatalError}</div>
      </div>
    )
  }

  // create family screen
  if (!userFamilyId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create your family</h2>
          <p className="text-sm text-gray-600">This sets your family container (name & timezone). You can invite the co-parent later.</p>
          {fatalError && (<div className="text-sm rounded border border-red-200 bg-red-50 p-3 text-red-700">{fatalError}</div>)}
          <form onSubmit={onCreateFamily} className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-700">Family name</span>
              <input className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g., Malec Family" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Timezone</span>
              <select className="mt-1 w/full border rounded px-3 py-2" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {tzOptions.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
              </select>
            </label>
            <button disabled={saving} className="w-full py-2 rounded bg-black text-white hover:opacity-90 disabled:opacity-50" type="submit">
              {saving ? 'Saving…' : 'Create family'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // family exists: children + rules
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Family setup</h1>
        <p className="text-gray-600">Manage your children and base custody rules. You can refine later.</p>
        {!!members.length && (
          <div className="flex gap-2 flex-wrap">
            {members.map((m) => (
              <span key={m.id} className="text-xs border rounded-full px-2 py-1">
                {m.role || 'member'} · {m.email || m.id}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('children')} className={`px-3 py-1 rounded-2xl border ${activeTab === 'children' ? 'bg-gray-100' : ''}`}>Children</button>
        <button onClick={() => setActiveTab('rules')} className={`px-3 py-1 rounded-2xl border ${activeTab === 'rules' ? 'bg-gray-100' : ''}`}>Custody Rules</button>
      </div>

      {activeTab === 'children' && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Add a child</h2>
            <ChildForm submitLabel="Add child" onSubmit={addChild} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Children</h2>
            {kidsLoading && <div>Loading children…</div>}
            {!kidsLoading && children.length === 0 && <p className="text-gray-600">No children yet. Add your first one above.</p>}
            <div className="space-y-3">
              {children.map((c) => (
                <div key={c.id} className="border rounded-2xl">
                  {edit?.id === c.id ? (
                    <div className="p-3">
                      <ChildForm
                        initial={c as any}
                        submitLabel="Save"
                        onCancel={() => setEdit(null)}
                        onSubmit={async (payload) => { await saveChild(c.id!, payload); setEdit(null) }}
                      />
                    </div>
                  ) : (
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 rounded" style={{ background: c.color }} />
                        <div>
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-sm text-gray-600">{toDateInput(c.birthdate)}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEdit(c as any)} className="border rounded-xl px-3 py-1">Edit</button>
                        <button onClick={() => removeChild(c.id!)} className="border rounded-xl px-3 py-1">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'rules' && (
        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="rtype" value="ODD_EVEN" checked={ruleType === 'ODD_EVEN'} onChange={() => setRuleType('ODD_EVEN')} />
              <span>Odd/Even weeks</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="rtype" value="WEEKLY_TEMPLATE" checked={ruleType === 'WEEKLY_TEMPLATE'} onChange={() => setRuleType('WEEKLY_TEMPLATE')} />
              <span>Weekly template</span>
            </label>
          </div>

          {ruleType === 'ODD_EVEN' ? (
            <div className="space-y-3 p-4 border rounded-2xl">
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="block text-sm mb-1">Anchor date (first odd/even week)</span>
                  <input type="date" className="w-full border rounded px-3 py-2"
                    value={oddEven.anchorDate}
                    onChange={(e) => setOddEven(v => ({ ...v, anchorDate: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm mb-1">Anchor is</span>
                  <select className="border rounded px-3 py-2"
                    value={oddEven.anchorWeekIs}
                    onChange={(e) => setOddEven(v => ({ ...v, anchorWeekIs: e.target.value as 'ODD' | 'EVEN' }))}>
                    <option value="ODD">Odd week</option>
                    <option value="EVEN">Even week</option>
                  </select>
                </label>
              </div>

              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="block text-sm mb-1">Parent on ODD weeks</span>
                  <select className="w-full border rounded px-3 py-2"
                    value={oddEven.parentOnOdd}
                    onChange={(e) => setOddEven(v => ({ ...v, parentOnOdd: e.target.value as Owner }))}>
                    <option value="parentA">Parent A</option>
                    <option value="parentB">Parent B</option>
                  </select>
                </label>
                <label className="flex-1">
                  <span className="block text-sm mb-1">Parent on EVEN weeks</span>
                  <select className="w-full border rounded px-3 py-2"
                    value={oddEven.parentOnEven}
                    onChange={(e) => setOddEven(v => ({ ...v, parentOnEven: e.target.value as Owner }))}>
                    <option value="parentA">Parent A</option>
                    <option value="parentB">Parent B</option>
                  </select>
                </label>
              </div>

              <div className="flex gap-3 items-end">
                <label>
                  <span className="block text-sm mb-1">Week starts</span>
                  <select className="border rounded px-3 py-2"
                    value={oddEven.weekStart}
                    onChange={(e) => setOddEven(v => ({ ...v, weekStart: e.target.value as WeekStart }))}>
                    <option value="MON">Mon</option>
                    <option value="TUE">Tue</option>
                    <option value="WED">Wed</option>
                    <option value="THU">Thu</option>
                    <option value="FRI">Fri</option>
                    <option value="SAT">Sat</option>
                    <option value="SUN">Sun</option>
                  </select>
                </label>
                <label>
                  <span className="block text-sm mb-1">Shift time (optional)</span>
                  <input placeholder="18:00" className="border rounded px-3 py-2"
                    value={oddEven.shiftTime || ''}
                    onChange={(e) => setOddEven(v => ({ ...v, shiftTime: e.target.value || undefined }))} />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 border rounded-2xl">
              <div className="flex gap-3 items-end">
                <label>
                  <span className="block text-sm mb-1">Week starts</span>
                  <select className="border rounded px-3 py-2"
                    value={weekly.weekStart}
                    onChange={(e) => setWeekly(v => ({ ...v, weekStart: e.target.value as WeekStart }))}>
                    <option value="MON">Mon</option>
                    <option value="SUN">Sun</option>
                  </select>
                </label>
                <label>
                  <span className="block text-sm mb-1">Default shift time (optional)</span>
                  <input placeholder="18:00" className="border rounded px-3 py-2"
                    value={weekly.shiftTime || ''}
                    onChange={(e) => setWeekly(v => ({ ...v, shiftTime: e.target.value || undefined }))} />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weekly.days.map((d, i) => (
                  <div key={i} className="border rounded-xl p-3">
                    <div className="text-sm font-medium mb-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dow]}</div>
                    <div className="flex gap-2 items-center">
                      <select className="border rounded px-2 py-1"
                        value={d.owner}
                        onChange={(e) => setWeekly(v => { const arr = [...v.days]; arr[i] = { ...arr[i], owner: e.target.value as Owner }; return { ...v, days: arr } })}>
                        <option value="parentA">Parent A</option>
                        <option value="parentB">Parent B</option>
                      </select>
                      <input className="border rounded px-2 py-1 w-24" placeholder="00:00"
                        value={d.start || ''}
                        onChange={(e) => setWeekly(v => { const arr = [...v.days]; arr[i] = { ...arr[i], start: e.target.value || undefined }; return { ...v, days: arr } })} />
                      <span className="text-xs">to</span>
                      <input className="border rounded px-2 py-1 w-24" placeholder="24:00"
                        value={d.end || ''}
                        onChange={(e) => setWeekly(v => { const arr = [...v.days]; arr[i] = { ...arr[i], end: e.target.value || undefined }; return { ...v, days: arr } })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rulesMsg && (
            <p className={`text-sm ${rulesMsg === 'Rules saved.' ? 'text-green-700' : 'text-red-700'}`}>{rulesMsg}</p>
          )}

          <div className="flex gap-2">
            <button onClick={saveRules} disabled={rulesBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50">
              {rulesBusy ? 'Saving…' : 'Save rules'}
            </button>
            <button onClick={() => setActiveTab('children')} className="rounded-xl border px-4 py-2">Back to children</button>
          </div>
        </section>
      )}

      <footer className="pt-2">
        <button onClick={() => (window.location.href = '/calendar')} className="rounded-xl bg-black text-white px-4 py-2">
          Continue to Calendar
        </button>
      </footer>
    </div>
  )
}
