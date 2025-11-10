import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function InviteSignup() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/profile";
  const inviteToken = params.get("invite");
  const familyId = params.get("family");

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(true);

  // Load invite → lock email → choose mode automatically
  useEffect(() => {
    (async () => {
      try {
        if (!inviteToken || !familyId) {
          setError("Missing invitation information.");
          setProbing(false);
          return;
        }
        const q = query(
          collection(db, "families", familyId, "invites"),
          where("token", "==", inviteToken)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setError("Invite not found or expired.");
          setProbing(false);
          return;
        }
        const data = snap.docs[0].data() as any;
        const inviteEmail = (data.email || "").toLowerCase();
        if (!inviteEmail) {
          setError("Invite is missing an email.");
          setProbing(false);
          return;
        }
        setEmail(inviteEmail);
        setEmailLocked(true);

        const methods = await fetchSignInMethodsForEmail(auth, inviteEmail);
        setMode(methods.length ? "login" : "signup");
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setProbing(false);
      }
    })();
  }, [inviteToken, familyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate(next, { replace: true }); // back to /accept-invite?... to finalize
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold mb-1">
            {mode === "login" ? "Log in" : "Create your password"}
          </h1>
          <p className="text-sm opacity-70">
            {mode === "login"
              ? "Enter your password to continue"
              : "Set a password for your first sign-in"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3">
            <Input
              type="email"
              value={email}
              readOnly={emailLocked}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder={mode === "login" ? "password" : "new password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {(error || probing) && (
              <div className="text-sm text-red-700 bg-red-50 p-2 rounded-2xl">
                {probing ? "Loading your invitation…" : error}
              </div>
            )}

            <Button type="submit" disabled={loading || probing}>
              {loading || probing
                ? "Please wait…"
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </Button>
          </form>

          {/* In case someone lands here without an invite, allow manual switch */}
          {!inviteToken && (
            <button
              className="text-sm text-brand-600 mt-3 underline"
              onClick={() =>
                setMode((m) => (m === "login" ? "signup" : "login"))
              }
            >
              {mode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Log in"}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
