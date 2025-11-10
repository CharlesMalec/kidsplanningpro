import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

export default function AcceptInvite() {
    const [params] = useSearchParams();
    const familyId = params.get("family") || "";
    const token = params.get("token") || "";

    const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const nav = useNavigate();
    const location = useLocation();

    // Keep auth state in sync
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
        return () => unsub();
    }, []);

    // Stop spinner once params are present (even if logged out)
    useEffect(() => {
        if (familyId && token) setLoading(false);
    }, [familyId, token]);

    const canAccept = useMemo(
        () => !!familyId && !!token && !!uid,
        [familyId, token, uid]
    );

    // Auto-accept once logged in (after invite-signup)
    useEffect(() => {
        if (uid && familyId && token && !loading) {
            accept();
        }
    }, [uid]);

    async function accept() {
        if (!uid) return;
        setLoading(true);
        setError(null);
        try {
            // find invite by token
            const invitesQ = query(
                collection(db, "families", familyId, "invites"),
                where("token", "==", token)
            );
            const snap = await getDocs(invitesQ);
            if (snap.empty) throw new Error("Invite not found or already used.");
            const inviteDoc = snap.docs[0];
            const invite = inviteDoc.data() as any;
            if (invite.status && invite.status !== "pending") {
                throw new Error("Invite is not pending.");
            }

            // link membership
            const memberRef = doc(collection(db, "families", familyId, "members"), uid);
            await setDoc(
                memberRef,
                {
                    uid,
                    role: invite.roleSuggested ?? "parentB",
                    displayName: auth.currentUser?.displayName ?? null,
                    addedAt: serverTimestamp(),
                },
                { merge: true }
            );

            // update user doc
            const userRef = doc(db, "users", uid);
            await setDoc(userRef, { familyId, updatedAt: serverTimestamp() }, { merge: true });

            // mark invite accepted (rules allow member/owner update)
            await updateDoc(inviteDoc.ref, {
                status: "accepted",
                acceptedAt: serverTimestamp(),
                acceptedBy: uid,
            });

            nav("/profile", { replace: true });
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }

    const goLogin = () => {
        const next = `${location.pathname}${location.search}`; // /accept-invite?... 
        nav(
            `/invite-signup?next=${encodeURIComponent(next)}&invite=${encodeURIComponent(
                token
            )}&family=${encodeURIComponent(familyId)}`
        );
    };

    return (
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <h1 className="text-2xl font-semibold">Accept invitation</h1>
                <p className="text-sm opacity-70">
                    You’ll join the family and your account will be linked.
                </p>
            </CardHeader>
            <CardContent>
                <div className="text-sm opacity-80 mb-3">
                    Family: <b>{familyId || "—"}</b>
                </div>

                {error && (
                    <div className="text-sm text-red-700 bg-red-50 p-2 rounded-2xl mb-3">
                        {error}
                    </div>
                )}

                {!uid ? (
                    <>
                        <div className="text-sm mb-2">
                            You’ll need to log in or create your account to accept this invite.
                        </div>
                        <Button onClick={goLogin} disabled={loading}>
                            {loading ? "Please wait…" : "Continue to sign-in"}
                        </Button>
                    </>
                ) : (
                    <Button onClick={accept} disabled={!canAccept || loading}>
                        {loading ? "Please wait…" : "Accept & join family"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
