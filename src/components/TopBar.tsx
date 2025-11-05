// src/components/TopBar.tsx
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Link, useNavigate } from "react-router-dom";

export default function TopBar() {
  const nav = useNavigate();
  const doLogout = async () => {
    await signOut(auth);
    nav("/login", { replace: true });
  };
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b">
      <Link to="/profile" className="font-semibold">KidsPlanningPro</Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link to="/profile">Profile</Link>
        <button onClick={doLogout} className="rounded-2xl px-3 py-1 border">
          Logout
        </button>
      </nav>
    </header>
  );
}
