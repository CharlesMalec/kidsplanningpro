import { Routes, Route, Navigate } from "react-router-dom";
import UserProfile from "./pages/UserProfile";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/profile" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      {/* add other protected routes the same way */}
      <Route path="*" element={<Navigate to="/profile" replace />} />
    </Routes>
  );
}
