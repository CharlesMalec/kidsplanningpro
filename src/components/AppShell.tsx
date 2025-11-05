import { Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


export default function AppShell() {
async function onLogout() {
await signOut(auth);
// navigation handled by ProtectedRoute redirect
}
return (
<div className="min-h-screen grid grid-rows-[auto,1fr]">
<header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
<div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
<Link to="/profile" className="font-semibold">KidsPlanningPro</Link>
<nav className="flex items-center gap-2">
<Link to="/calendar" className="text-sm px-3 py-1 rounded-2xl hover:bg-gray-100">Calendar</Link>
<Link to="/reports" className="text-sm px-3 py-1 rounded-2xl hover:bg-gray-100">Reports</Link>
<Button variant="secondary" onClick={onLogout}>Logout</Button>
</nav>
</div>
</header>
<main className="max-w-5xl mx-auto w-full px-4 py-6">
<Outlet />
</main>
</div>
);
}