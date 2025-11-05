import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        await createUserWithEmailAndPassword(auth, email, pw);
      }
      nav("/profile", { replace: true });
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        {mode === "login" ? "Log in" : "Create account"}
      </h1>
      {err && <div className="mb-3 text-sm bg-red-50 text-red-700 p-2 rounded">{err}</div>}
      <form className="grid gap-3" onSubmit={submit}>
        <input className="border rounded-2xl px-3 py-2" placeholder="email"
               value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded-2xl px-3 py-2" placeholder="password" type="password"
               value={pw} onChange={e=>setPw(e.target.value)} />
        <button className="rounded-2xl px-4 py-2 border shadow-sm" disabled={loading}>
          {loading ? "Please wait…" : (mode==="login" ? "Log in" : "Sign up")}
        </button>
      </form>
      <button className="mt-3 text-sm underline" onClick={()=>setMode(mode==="login"?"signup":"login")}>
        {mode==="login" ? "Need an account? Sign up" : "Have an account? Log in"}
      </button>
    </div>
  );
}
