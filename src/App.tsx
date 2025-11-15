import { Routes, Route, Navigate } from "react-router-dom";

import AppShell from "@/components/AppShell";

import UserProfile from "@/pages/UserProfile";
import LoginPage from "@/pages/LoginPage";
import FamilySetup from "@/pages/FamilySetup";
import InviteParent from "@/pages/InviteParent";
import AcceptInvite from "@/pages/AcceptInvite";
import InviteSignup from "@/pages/InviteSignup";

import ProtectedRoute from "@/routes/ProtectedRoute";



export default function App() {
  return (
    <Routes>
      {/* PUBLIC routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite-signup" element={<InviteSignup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="family/setup" element={<FamilySetup />} />
        {/* future: <Route path="calendar" element={<CalendarView />} /> */}
        {/* future: <Route path="reports" element={<ReportsView />} /> */}
      </Route>
      <Route
        path="invite"
        element={
          <ProtectedRoute>
            <InviteParent />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}