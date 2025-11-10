import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic doc id for uniqueness; replace w/ SHA-256 later if you prefer
function emailKeyOf(email: string) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

export default function InviteParent() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [familyId, setFamilyId] = useState("");
  const [email, setEmail] = useState("");
  const [roleSuggested, setRoleSuggested] = useState<"parentA" | "parentB" | "">("parentB");
  const [inviteLink, setInviteLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep auth state in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // Prefill familyId from user doc if present
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        const fam = userSnap.data()?.familyId;
        if (fam) setFamilyId(fam);
      } catch {
        /* ignore */
      }
    })();
  }, [uid]);

  const canCreate = useMemo(
    () => !!uid && !!familyId && !!email && !!roleSuggested,
    [uid, familyId, email, roleSuggested]
  );

  async function createInvite() {
    try {
      setSaving(true);
      setError(null);

      const normalized = email.trim().toLowerCase();
      const inviteId = emailKeyOf(normalized);
      const ref = doc(collection(db, "families", familyId, "invites"), inviteId);

      const existing = await getDoc(ref);
      if (existing.exists()) {
        const data = existing.data() as any;
        if (data.status === "pending") {
          setError("An invite is already pending for this email.");
          setSaving(false);
          return;
        }
      }

      const token = randomToken(24);
      await setDoc(
        ref,
        {
          email: normalized,
          roleSuggested,
          token,
          status: "pending",
          createdAt: serverTimestamp(),
          createdBy: uid,
          version: (existing.data()?.version ?? 0) + 1,
        },
        { merge: true }
      );

      const link = `${window.location.origin}/accept-invite?family=${encodeURIComponent(
        familyId
      )}&token=${encodeURIComponent(token)}`;
      setInviteLink(link);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied to clipboard");
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <h1 className="text-2xl font-semibold">Invite the other parent</h1>
        <p className="text-sm opacity-70">
          Create a single pending invite per email. Re-inviting updates the same record.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 p-2 rounded-2xl mb-3">
            {error}
          </div>
        )}

        <div className="text-xs opacity-70 mb-2">
          You: <b>{uid ?? "—"}</b> • Family ID: <b>{familyId || "—"}</b>
        </div>

        <label className="grid gap-1 mb-3">
          <span className="text-sm font-medium">Family ID</span>
          <Input
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            placeholder="e.g. Malec"
          />
        </label>

        <label className="grid gap-1 mb-3">
          <span className="text-sm font-medium">Recipient email</span>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="other.parent@example.com"
          />
        </label>

        <label className="grid gap-1 mb-4">
          <span className="text-sm font-medium">Suggested role</span>
          <select
            className="border rounded-2xl px-3 py-2"
            value={roleSuggested}
            onChange={(e) => setRoleSuggested(e.target.value as any)}
          >
            <option value="">Select…</option>
            <option value="parentA">Parent A</option>
            <option value="parentB">Parent B</option>
          </select>
        </label>

        <Button onClick={createInvite} disabled={!canCreate || saving}>
          {saving ? "Creating…" : "Create invite"}
        </Button>

        {inviteLink && (
          <div className="grid gap-2 mt-4">
            <div className="text-sm">Share this link with the invited parent:</div>
            <div className="p-3 bg-gray-50 rounded-2xl text-xs break-all">
              {inviteLink}
            </div>
            <Button variant="secondary" onClick={copyLink}>
              Copy link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
