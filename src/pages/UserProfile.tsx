import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase"; // <-- make sure this exists and exports initialized auth + db
import {
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Loader2, Save } from "lucide-react";

// ---------- Types ----------
export type ParentRole = "parentA" | "parentB";
export type UserDoc = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: ParentRole | null;
  familyId?: string | null;
  createdAt: any;
  updatedAt: any;
};

// ---------- Component ----------
export default function UserProfile() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [role, setRole] = useState<ParentRole | "">("");
  const [familyId, setFamilyId] = useState("");

  // ---------- Load auth + ensure user doc ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          // create a minimal user doc on first visit
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email ?? null,
            displayName: user.displayName ?? null,
            photoURL: user.photoURL ?? null,
            role: null,
            familyId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } as Partial<UserDoc>);
        }
        const data = (await getDoc(userRef)).data() as Partial<UserDoc>;
        setDisplayName(data.displayName ?? user.displayName ?? "");
        setPhotoURL(data.photoURL ?? user.photoURL ?? "");
        setRole((data.role as ParentRole) ?? "");
        setFamilyId(data.familyId ?? "");
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const canSave = useMemo(() => {
    return !!fbUser && !!displayName && !!role; // familyId optional at this step
  }, [fbUser, displayName, role]);

  // ---------- Save handler ----------
  const onSave = async () => {
    if (!fbUser) return;
    setSaving(true);
    setError(null);
    try {
      // update Firebase Auth profile
      await updateProfile(fbUser, { displayName, photoURL: photoURL || null });

      // update Firestore in a single batch
      const batch = writeBatch(db);
      const userRef = doc(db, "users", fbUser.uid);
      batch.set(
        userRef,
        {
          uid: fbUser.uid,
          email: fbUser.email ?? null,
          displayName: displayName || null,
          photoURL: photoURL || null,
          role: (role as ParentRole) || null,
          familyId: familyId || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Optional quality-of-life: ensure reverse link under /families/{id}/members/{uid}
      if (familyId) {
        const memberRef = doc(
          collection(db, "families", familyId, "members"),
          fbUser.uid
        );
        batch.set(
          memberRef,
          {
            uid: fbUser.uid,
            role: (role as ParentRole) || null,
            displayName: displayName || null,
            addedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[50vh] grid place-items-center text-sm opacity-80">
        <Loader2 className="animate-spin mr-2 inline-block" /> Loading profile…
      </div>
    );
  }

  if (!fbUser) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">User Profile</h1>
        <p className="opacity-80">
          You are not signed in. Please log in to edit your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">User Profile</h1>
        <p className="opacity-80 text-sm mt-1">
          Set your name and role so schedules and reports are attributed correctly.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            className="border rounded-2xl px-3 py-2 focus:outline-none focus:ring w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Charles Malec"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Photo URL (optional)</span>
          <input
            className="border rounded-2xl px-3 py-2 focus:outline-none focus:ring w-full"
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            placeholder="https://…"
          />
          <span className="text-xs opacity-70">
            (We’ll add real uploads later.)
          </span>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Role</span>
          <select
            className="border rounded-2xl px-3 py-2 focus:outline-none focus:ring w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as ParentRole)}
          >
            <option value="">Select role…</option>
            <option value="parentA">Parent A</option>
            <option value="parentB">Parent B</option>
          </select>
          <span className="text-xs opacity-70">
            We use A/B just as labels (e.g., in reports). You can rename later.
          </span>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Family ID (optional for now)</span>
          <input
            className="border rounded-2xl px-3 py-2 focus:outline-none focus:ring w-full"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            placeholder="Paste an existing family ID or leave empty"
          />
          <span className="text-xs opacity-70">
            Later we’ll add an invite flow to link parents automatically.
          </span>
        </label>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 shadow-sm border text-sm disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Saving…
            </>
          ) : (
            <>
              <Save size={16} /> Save profile
            </>
          )}
        </motion.button>

        <div className="text-xs opacity-70 mt-2">
          Email: {fbUser.email}
        </div>
      </div>
    </div>
  );
}
