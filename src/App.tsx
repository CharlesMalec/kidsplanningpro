import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import UserProfile from "@/pages/UserProfile";
import LoginPage from "@/pages/LoginPage";
import ProtectedRoute from "@/routes/ProtectedRoute";


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="profile" element={<UserProfile />} />
        {/* future: <Route path="calendar" element={<CalendarView />} /> */}
        {/* future: <Route path="reports" element={<ReportsView />} /> */}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}